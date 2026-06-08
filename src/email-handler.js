// src/email-handler.js — Email ingestion via Cloudflare Email Routing
// Fase 3: broadcast SSE event ke InboxBroadcaster Durable Object setelah simpan email

import { parseEmail } from "postal-mime";
import {
  isValidInboxName,
  sanitizeInboxName,
  generateAttachmentId,
  KV_KEYS,
  listEmailRecords,
  saveEmailRecord,
  incrementStats,
} from "./utils.js";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_EMAILS_PER_INBOX = 50;

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

    // ── 2. Quota check ────────────────────────────────────────────────
    const existing = await listEmailRecords(env, inboxName);
    if (existing.length >= MAX_EMAILS_PER_INBOX) {
      console.log(`[email] Quota reached for inbox "${inboxName}" — dropping email`);
      return;
    }

    // ── 3. Parse MIME ─────────────────────────────────────────────────
    const rawBuffer = await new Response(message.raw).arrayBuffer();
    let parsed;
    try {
      parsed = await parseEmail(rawBuffer);
    } catch (parseErr) {
      console.error(`[email] postal-mime parse error for "${inboxName}":`, parseErr);
      return;
    }

    // ── 4. Build email ID ─────────────────────────────────────────────
    let emailId = String(Date.now());
    const collisionCheck = await env.EMAILS.get(KV_KEYS.email(inboxName, emailId));
    if (collisionCheck) {
      emailId = emailId + "-" + Math.random().toString(36).substring(2, 7);
    }

    const receivedAt = Date.now();
    const expiresAt  = receivedAt + 7 * 24 * 60 * 60 * 1000;

    // ── 5. Process attachments ────────────────────────────────────────
    const attachmentMetas = [];

    for (const att of parsed.attachments || []) {
      const attId       = generateAttachmentId();
      const content     = att.content;
      const size        = content ? content.byteLength : 0;
      const filename    = att.filename || "unnamed";
      const contentType = att.mimeType || "application/octet-stream";
      const attExpiresAt = receivedAt + 8 * 24 * 60 * 60 * 1000;

      const meta = { id: attId, filename, contentType, size, expiresAt: attExpiresAt, skipped: false };

      if (size > MAX_ATTACHMENT_SIZE) {
        console.log(`[email] Attachment "${filename}" skipped (${size} bytes > 10MB)`);
        meta.skipped = true;
      } else if (content) {
        await env.ATTACHMENTS.put(`att:${attId}`, content, {
          httpMetadata: { contentType, contentDisposition: `attachment; filename="${filename}"` },
          customMetadata: { expiresAt: String(attExpiresAt), inboxName },
        });
        await env.EMAILS.put(KV_KEYS.attachment(attId), JSON.stringify(meta), { expirationTtl: 691200 });
      }

      attachmentMetas.push(meta);
    }

    // ── 6. Build & save EmailRecord ───────────────────────────────────
    const fromField = parsed.from
      ? `${parsed.from.name ? parsed.from.name + " " : ""}<${parsed.from.address}>`
      : message.from || "unknown";

    const emailRecord = {
      id: emailId, inboxName,
      from: fromField, to: toAddress,
      subject: parsed.subject || "(Tanpa Judul)",
      body: parsed.text || "", htmlBody: parsed.html || "",
      date: parsed.date ? new Date(parsed.date).toISOString() : new Date(receivedAt).toISOString(),
      receivedAt, read: false, expiresAt,
      attachments: attachmentMetas, sizeBytes: rawBuffer.byteLength,
    };

    await saveEmailRecord(env, emailRecord);

    // ── 7. Update stats ───────────────────────────────────────────────
    await incrementStats(env, inboxName);

    console.log(`[email] Saved ${emailId} to "${inboxName}" (${rawBuffer.byteLength} bytes, ${attachmentMetas.length} att)`);

    // ── 8. Broadcast SSE via Durable Object (Fase 3) ─────────────────
    ctx.waitUntil(broadcastNewEmail(env, inboxName, emailRecord));

  } catch (err) {
    console.error(`[email] Unhandled error for inbox "${inboxName}":`, err);
  }
}

/**
 * Broadcast event "new-email" ke InboxBroadcaster DO
 */
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

/**
 * Broadcast event "email-deleted" ke SSE clients
 */
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
