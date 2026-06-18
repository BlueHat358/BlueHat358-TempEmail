// src/email-handler.js — Email ingestion via Cloudflare Email Routing

import PostalMime from "postal-mime";
import {
  MAX_ATTACHMENT_SIZE,
  MAX_EMAILS_PER_INBOX,
  MAX_TOTAL_INBOXES,
  EMAIL_TTL_DAYS,
  ATTACHMENT_TTL_DAYS,
  STATS_TTL_DAYS,
} from "./config.js";
import {
  isValidInboxName,
  sanitizeInboxName,
  generateAttachmentId,
  sanitizeFilenameForHeader,
  KV_KEYS,
  listEmailRecords,
  saveEmailRecord,
  incrementStats,
  deleteEmail,
} from "./utils.js";

/**
 * Main email() handler — dipanggil oleh Cloudflare Email Routing
 */
export async function handleIncomingEmail(message, env, ctx) {
  let inboxName;

  try {
    // ── 1. Extract & validate inbox name ──────────────────────────────
    const toAddress   = message.to || "";
    const atIdx       = toAddress.indexOf("@");
    const localPart   = atIdx > -1 ? toAddress.slice(0, atIdx) : toAddress;
    const domainPart  = atIdx > -1 ? toAddress.slice(atIdx + 1) : "";
    const sanitizedLocal  = sanitizeInboxName(localPart);
    const sanitizedDomain = domainPart.toLowerCase().trim();
    inboxName = sanitizedDomain ? `${sanitizedLocal}@${sanitizedDomain}` : sanitizedLocal;

    if (!isValidInboxName(inboxName)) {
      console.log(`[email] Rejected: invalid inbox name "${inboxName}"`);
      return;
    }

    // ── 2. Global inbox count check ───────────────────────────────────
    const existingEmails = await listEmailRecords(env, inboxName);
    if (existingEmails.length === 0) {
      const inboxCountKey = "system:inbox-count";
      const countData     = await env.EMAILS.get(inboxCountKey, { type: "json" });
      let knownInboxes    = countData?.inboxes || [];

      const activeChecks = await Promise.all(
        knownInboxes.map(async (name) => {
          const msgs = await listEmailRecords(env, name);
          return msgs.length > 0 ? name : null;
        })
      );
      knownInboxes = activeChecks.filter(Boolean);

      if (!knownInboxes.includes(inboxName)) {
        if (knownInboxes.length >= MAX_TOTAL_INBOXES) {
          console.log(`[email] Rejected: max ${MAX_TOTAL_INBOXES} inboxes reached. Inbox "${inboxName}" is new.`);
          return;
        }
        knownInboxes.push(inboxName);
      }

      await env.EMAILS.put(inboxCountKey, JSON.stringify({ inboxes: knownInboxes }), {
        expirationTtl: STATS_TTL_DAYS * 24 * 60 * 60,
      });
    }

    // ── 3. Per-inbox quota check — FIFO ──────────────────────────────
    if (existingEmails.length >= MAX_EMAILS_PER_INBOX) {
      const oldest = existingEmails[existingEmails.length - 1];
      await deleteEmail(env, inboxName, oldest.id);
      console.log(`[email] FIFO: dropped oldest message ${oldest.id} from "${inboxName}"`);
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

    const receivedAt  = Date.now();
    const expiresAt   = receivedAt + EMAIL_TTL_DAYS * 24 * 60 * 60 * 1000;
    const emailTtlSec = EMAIL_TTL_DAYS * 24 * 60 * 60;
    const attTtlSec   = ATTACHMENT_TTL_DAYS * 24 * 60 * 60;

    // ── 6. Process attachments ────────────────────────────────────────
    const attachmentMetas = [];
    // Pemetaan Content-ID (gambar/file inline) → URL attachment, supaya
    // referensi "cid:..." pada htmlBody bisa diganti jadi URL yang bisa
    // di-load browser. Tanpa ini, gambar inline/embedded (mis. screenshot
    // yang ditempel langsung di body email) akan tampil sebagai broken image.
    const cidMap = new Map();

    for (const att of parsed.attachments || []) {
      const attId       = generateAttachmentId();
      const content     = att.content;
      const size        = content ? content.byteLength : 0;
      const filename    = att.filename || "unnamed";
      const contentType = att.mimeType || "application/octet-stream";
      const attExpiresAt = receivedAt + ATTACHMENT_TTL_DAYS * 24 * 60 * 60 * 1000;

      const meta = { id: attId, filename, contentType, size, expiresAt: attExpiresAt, skipped: false };

      if (size > MAX_ATTACHMENT_SIZE) {
        console.log(`[email] Attachment "${filename}" skipped (${(size / 1024 / 1024).toFixed(1)} MB > ${MAX_ATTACHMENT_SIZE / 1024 / 1024} MB limit)`);
        meta.skipped = true;
      } else if (content) {
        // [Fix M-2] filename dari email masuk tidak dipercaya — bisa berisi
        // tanda kutip, titik koma, atau newline yang memutus format header
        // Content-Disposition (header injection / filename spoofing).
        const safeFilename = sanitizeFilenameForHeader(filename);
        await env.ATTACHMENTS.put(`att:${attId}`, content, {
          httpMetadata: { contentType, contentDisposition: `attachment; filename="${safeFilename}"` },
          customMetadata: { expiresAt: String(attExpiresAt), inboxName },
        });
        await env.EMAILS.put(KV_KEYS.attachment(attId), JSON.stringify(meta), { expirationTtl: attTtlSec });

        // Header Content-ID datang dalam format "<xxxx@yyyy>" — strip tanda
        // kurung siku karena referensi di HTML ("cid:xxxx@yyyy") tidak memakainya.
        if (att.contentId) {
          const cid = String(att.contentId).trim().replace(/^<|>$/g, "");
          if (cid) cidMap.set(cid, attId);
        }
      }

      attachmentMetas.push(meta);
    }

    // Ganti semua referensi "cid:xxx" di HTML body dengan URL attachment asli
    let htmlBody = parsed.html || "";
    if (htmlBody && cidMap.size > 0) {
      htmlBody = htmlBody.replace(/cid:([^"'\s)>]+)/gi, (full, rawCid) => {
        let cid = rawCid;
        try { cid = decodeURIComponent(rawCid); } catch {}
        const attId = cidMap.get(cid) || cidMap.get(rawCid);
        return attId ? `/api/attachments/${attId}` : full;
      });
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
      htmlBody,
      date:     parsed.date ? new Date(parsed.date).toISOString() : new Date(receivedAt).toISOString(),
      receivedAt, read: false, expiresAt,
      attachments: attachmentMetas,
      sizeBytes: rawBuffer.byteLength,
    };

    await saveEmailRecord(env, emailRecord, emailTtlSec);

    // ── 8. Update stats ───────────────────────────────────────────────
    await incrementStats(env, inboxName);

    console.log(`[email] Saved ${emailId} to "${inboxName}" (${rawBuffer.byteLength} bytes, ${attachmentMetas.length} att)`);

  } catch (err) {
    console.error(`[email] Unhandled error for inbox "${inboxName}":`, err);
  }
}
