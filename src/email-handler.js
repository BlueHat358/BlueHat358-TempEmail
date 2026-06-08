// src/email-handler.js — Email ingestion via Cloudflare Email Routing
// Fase 3: broadcast SSE event ke InboxBroadcaster Durable Object setelah simpan email

import PostalMime from "postal-mime";
import {
  isValidInboxName,
  sanitizeInboxName,
  generateAttachmentId,
  KV_KEYS,
  listEmailRecords,
  saveEmailRecord,
  incrementStats,
} from "./utils.js";

// ─────────────────────────────────────────────
// Limit personal — konservatif & aman
// ─────────────────────────────────────────────
const MAX_ATTACHMENT_SIZE  = 3 * 1024 * 1024; // 3 MB per file  (was 10 MB)
const MAX_EMAILS_PER_INBOX = 20;              // 20 email/inbox  (was 50)
const MAX_TOTAL_INBOXES    = 10;              // max 10 inbox berbeda di seluruh sistem
const EMAIL_TTL_DAYS       = 3;              // email expired 3 hari (was 7)
const ATTACHMENT_TTL_DAYS  = 4;              // attachment R2 expired 4 hari (was 8)
const STATS_TTL_DAYS       = 14;             // stats expired 14 hari (was 30)

// Estimasi worst case dengan limit ini:
// 10 inbox × 20 email × 3 MB = 600 MB R2 — sangat jauh dari 5 GB
// ─────────────────────────────────────────────

/**
 * Main email() handler — dipanggil oleh Cloudflare Email Routing
 */
export async function handleIncomingEmail(message, env, ctx) {
  let inboxName;

  try {
    // ── 1. Extract & validate inbox name ──────────────────────────────
    const toAddress = message.to || "";
    const localPart = toAddress.split("@")[0] || "";
    inboxName = sanitizeInboxName(localPart);

    if (!isValidInboxName(inboxName)) {
      console.log(`[email] Rejected: invalid inbox name "${inboxName}"`);
      return;
    }

    // ── 2. Global inbox count check ───────────────────────────────────
    // Cek apakah inbox ini baru & sudah ada terlalu banyak inbox
    const existingEmails = await listEmailRecords(env, inboxName);
    if (existingEmails.length === 0) {
      // Inbox baru — cek total inbox di sistem
      const inboxCountKey = "system:inbox-count";
      const countData = await env.EMAILS.get(inboxCountKey, { type: "json" });
      const knownInboxes = countData?.inboxes || [];

      if (!knownInboxes.includes(inboxName)) {
        if (knownInboxes.length >= MAX_TOTAL_INBOXES) {
          console.log(`[email] Rejected: max ${MAX_TOTAL_INBOXES} inboxes reached. Inbox "${inboxName}" is new.`);
          return;
        }
        // Daftarkan inbox baru
        knownInboxes.push(inboxName);
        await env.EMAILS.put(inboxCountKey, JSON.stringify({ inboxes: knownInboxes }), {
          expirationTtl: STATS_TTL_DAYS * 24 * 60 * 60,
        });
      }
    }

    // ── 3. Per-inbox quota check ──────────────────────────────────────
    if (existingEmails.length >= MAX_EMAILS_PER_INBOX) {
      console.log(`[email] Quota reached for inbox "${inboxName}" (${existingEmails.length}/${MAX_EMAILS_PER_INBOX}) — dropping`);
      return;
    }

    // ── 4. Parse MIME ─────────────────────────────────────────────────
    const rawBuffer = await new Response(message.raw).arrayBuffer();
    let parsed;
    try {
      parsed = await PostalMime.parse(rawBuffer);
    } catch (parseErr) {
      console.error(`[email] postal-mime parse error for "${inboxName}":`, parseErr);
      return;
    }

    // ── 5. Build email ID ─────────────────────────────────────────────
    let emailId = String(Date.now());
    const collisionCheck = await env.EMAILS.get(KV_KEYS.email(inboxName, emailId));
    if (collisionCheck) {
      emailId = emailId + "-" + Math.random().toString(36).substring(2, 7);
    }

    const receivedAt   = Date.now();
    const expiresAt    = receivedAt + EMAIL_TTL_DAYS * 24 * 60 * 60 * 1000;
    const emailTtlSec  = EMAIL_TTL_DAYS * 24 * 60 * 60;
    const attTtlSec    = ATTACHMENT_TTL_DAYS * 24 * 60 * 60;

    // ── 6. Process attachments ────────────────────────────────────────
    const attachmentMetas = [];

    for (const att of parsed.attachments || []) {
      const attId        = generateAttachmentId();
      const content      = att.content;
      const size         = content ? content.byteLength : 0;
      const filename     = att.filename || "unnamed";
      const contentType  = att.mimeType || "application/octet-stream";
      const attExpiresAt = receivedAt + ATTACHMENT_TTL_DAYS * 24 * 60 * 60 * 1000;

      const meta = { id: attId, filename, contentType, size, expiresAt: attExpiresAt, skipped: false };

      if (size > MAX_ATTACHMENT_SIZE) {
        console.log(`[email] Attachment "${filename}" skipped (${(size/1024/1024).toFixed(1)} MB > ${MAX_ATTACHMENT_SIZE/1024/1024} MB limit)`);
        meta.skipped = true;
      } else if (content) {
        await env.ATTACHMENTS.put(`att:${attId}`, content, {
          httpMetadata: { contentType, contentDisposition: `attachment; filename="${filename}"` },
          customMetadata: { expiresAt: String(attExpiresAt), inboxName },
        });
        await env.EMAILS.put(KV_KEYS.attachment(attId), JSON.stringify(meta), { expirationTtl: attTtlSec });
      }

      attachmentMetas.push(meta);
    }

    // ── 7. Build & save EmailRecord ───────────────────────────────────
    const fromField = parsed.from
      ? `${parsed.from.name ? parsed.from.name + " " : ""}<${parsed.from.address}>`
      : message.from || "unknown";

    const emailRecord = {
      id: emailId, inboxName,
      from: fromField, to: toAddress,
      subject:  parsed.subject || "(Tanpa Judul)",
      body:     parsed.text    || "",
      htmlBody: parsed.html    || "",
      date:     parsed.date ? new Date(parsed.date).toISOString() : new Date(receivedAt).toISOString(),
      receivedAt, read: false, expiresAt,
      attachments: attachmentMetas,
      sizeBytes: rawBuffer.byteLength,
    };

    await saveEmailRecord(env, emailRecord, emailTtlSec);

    // ── 8. Update stats ───────────────────────────────────────────────
    await incrementStats(env, inboxName);

    console.log(`[email] Saved ${emailId} to "${inboxName}" (${rawBuffer.byteLength} bytes, ${attachmentMetas.length} att)`);

    // ── 9. Broadcast SSE via Durable Object ──────────────────────────
    ctx.waitUntil(broadcastNewEmail(env, inboxName, emailRecord));

  } catch (err) {
    console.error(`[email] Unhandled error for inbox "${inboxName}":`, err);
  }
}

async function broadcastNewEmail(env, inboxName, emailRecord) {
  if (!env.INBOX_BROADCASTER) return;
  try {
    const doId  = env.INBOX_BROADCASTER.idFromName(`broadcast:${inboxName}`);
    const stub  = env.INBOX_BROADCASTER.get(doId);
    const stats = await env.EMAILS.get(`stats:${inboxName}`, { type: "json" });
    const unread = stats?.unread ?? 1;

    await stub.fetch("https://do-internal/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "new-email",
        data: { id: emailRecord.id, from: emailRecord.from, subject: emailRecord.subject, receivedAt: emailRecord.receivedAt, unread },
      }),
    });
  } catch (err) {
    console.warn(`[email] SSE broadcast failed for "${inboxName}":`, err);
  }
}

export async function broadcastEmailDeleted(env, inboxName, emailId) {
  if (!env.INBOX_BROADCASTER) return;
  try {
    const doId  = env.INBOX_BROADCASTER.idFromName(`broadcast:${inboxName}`);
    const stub  = env.INBOX_BROADCASTER.get(doId);
    const stats = await env.EMAILS.get(`stats:${inboxName}`, { type: "json" });
    const unread = stats?.unread ?? 0;

    await stub.fetch("https://do-internal/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "email-deleted", data: { id: emailId, unread } }),
    });
  } catch (err) {
    console.warn(`[email] SSE delete-broadcast failed for "${inboxName}":`, err);
  }
}
