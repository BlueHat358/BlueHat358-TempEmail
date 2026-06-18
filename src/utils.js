// src/utils.js — Utilities: validation, ID generation, KV helpers

// ─────────────────────────────────────────────
// Inbox Name Validation
// ─────────────────────────────────────────────
const LOCAL_REGEX  = /^[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]$/;
const DOMAIN_REGEX = /^[a-z0-9][a-z0-9\-\.]{1,60}[a-z0-9]$/;

export function isValidInboxName(name) {
  if (!name || typeof name !== "string") return false;
  if (name.includes("@")) {
    const atIdx = name.indexOf("@");
    const local  = name.slice(0, atIdx);
    const domain = name.slice(atIdx + 1);
    return LOCAL_REGEX.test(local) && DOMAIN_REGEX.test(domain);
  }
  // fallback tanpa domain (backward-compat)
  return LOCAL_REGEX.test(name);
}

export function sanitizeInboxName(raw) {
  return raw.toLowerCase().trim();
}

// ─────────────────────────────────────────────
// Random ID / Name Generation
// ─────────────────────────────────────────────
const ADJECTIVES = [
  "swift", "bold", "calm", "dark", "echo", "free", "good", "warm",
  "cool", "blue", "fast", "keen", "lazy", "mild", "neat", "open",
  "pure", "quiet", "rich", "safe", "tiny", "vast", "wild", "zen"
];
const NOUNS = [
  "panda", "eagle", "storm", "maple", "river", "cloud", "flame",
  "stone", "tiger", "ocean", "pixel", "quark", "lunar", "ember",
  "frost", "grove", "haven", "ivory", "jewel", "karma", "light"
];

export function generateRandomInboxName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90 + 10); // 10-99
  return `${adj}-${noun}-${num}`;
}

export function generateAttachmentId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  return `${ts}${rand}`;
}

// ─────────────────────────────────────────────
// KV Key Helpers
// ─────────────────────────────────────────────
export const KV_KEYS = {
  email: (inboxName, emailId) => `inbox:${inboxName}:${emailId}`,
  attachment: (attId) => `att:${attId}`,
  stats: (inboxName) => `stats:${inboxName}`,
  emailPrefix: (inboxName) => `inbox:${inboxName}:`,
};

// ─────────────────────────────────────────────
// KV Operations
// ─────────────────────────────────────────────

/**
 * List all email records for an inbox (keys only first, then fetch details)
 */
export async function listEmailRecords(env, inboxName, limit = 100) {
  const prefix = KV_KEYS.emailPrefix(inboxName);
  const listed = await env.EMAILS.list({ prefix, limit });
  if (!listed.keys.length) return [];

  // Fetch all records in parallel
  const promises = listed.keys.map((k) =>
    env.EMAILS.get(k.name, { type: "json" })
  );
  const records = await Promise.all(promises);

  // Filter nulls (race condition: key expired between list and get)
  return records
    .filter(Boolean)
    .sort((a, b) => b.receivedAt - a.receivedAt);
}

/**
 * Get a single email record
 */
export async function getEmailRecord(env, inboxName, emailId) {
  const key = KV_KEYS.email(inboxName, emailId);
  return env.EMAILS.get(key, { type: "json" });
}

/**
 * Save an email record — ttlSec selalu dipass dari email-handler via config.js (EMAIL_TTL_DAYS)
 */
export async function saveEmailRecord(env, record, ttlSec) {
  const key = KV_KEYS.email(record.inboxName, record.id);
  await env.EMAILS.put(key, JSON.stringify(record), {
    expirationTtl: ttlSec,
  });
}

/**
 * Mark email as read
 */
export async function markEmailRead(env, inboxName, emailId) {
  const record = await getEmailRecord(env, inboxName, emailId);
  if (!record || record.read) return;

  record.read = true;
  await saveEmailRecord(env, record);
  await decrementUnread(env, inboxName);
}

/**
 * Mark all emails in an inbox as read
 */
export async function markAllEmailsRead(env, inboxName) {
  const emails = await listEmailRecords(env, inboxName);
  let marked = 0;

  for (const email of emails) {
    if (!email.read) {
      email.read = true;
      await saveEmailRecord(env, email);
      marked++;
    }
  }

  // Reset unread count to 0
  if (marked > 0) {
    const key = KV_KEYS.stats(inboxName);
    const stats = await getStats(env, inboxName);
    stats.unread = 0;
    await env.EMAILS.put(key, JSON.stringify(stats), {
      expirationTtl: 1209600, // 14 hari
    });
  }

  return marked;
}

/**
 * Delete a single email and all its attachments
 */
export async function deleteEmail(env, inboxName, emailId) {
  const record = await getEmailRecord(env, inboxName, emailId);
  if (!record) return false;

  // Delete attachments from R2 and KV
  for (const att of record.attachments || []) {
    if (!att.skipped) {
      await env.ATTACHMENTS.delete(`att:${att.id}`).catch(() => {});
    }
    await env.EMAILS.delete(KV_KEYS.attachment(att.id)).catch(() => {});
  }

  // Delete email record
  await env.EMAILS.delete(KV_KEYS.email(inboxName, emailId));

  // Update stats
  await updateStatsOnDelete(env, inboxName, record.read ? 0 : 1);

  return true;
}

/**
 * Delete all emails in an inbox
 */
export async function deleteAllEmails(env, inboxName) {
  const prefix = KV_KEYS.emailPrefix(inboxName);
  const listed = await env.EMAILS.list({ prefix, limit: 100 });

  for (const kv of listed.keys) {
    const record = await env.EMAILS.get(kv.name, { type: "json" });
    if (!record) continue;
    for (const att of record.attachments || []) {
      if (!att.skipped) {
        await env.ATTACHMENTS.delete(`att:${att.id}`).catch(() => {});
      }
      await env.EMAILS.delete(KV_KEYS.attachment(att.id)).catch(() => {});
    }
    await env.EMAILS.delete(kv.name);
  }

  // Reset stats
  const statsKey = KV_KEYS.stats(inboxName);
  await env.EMAILS.put(
    statsKey,
    JSON.stringify({ inboxName, total: 0, unread: 0, lastUpdated: Date.now() }),
    { expirationTtl: 1209600 }
  );
}

// ─────────────────────────────────────────────
// Stats Helpers
// ─────────────────────────────────────────────
export async function getStats(env, inboxName) {
  const key = KV_KEYS.stats(inboxName);
  const stats = await env.EMAILS.get(key, { type: "json" });
  return stats || { inboxName, total: 0, unread: 0, lastUpdated: 0 };
}

export async function incrementStats(env, inboxName) {
  const key = KV_KEYS.stats(inboxName);
  const stats = await getStats(env, inboxName);
  stats.total += 1;
  stats.unread += 1;
  stats.lastUpdated = Date.now();
  await env.EMAILS.put(key, JSON.stringify(stats), {
    expirationTtl: 1209600, // 14 hari
  });
}

async function decrementUnread(env, inboxName) {
  const key = KV_KEYS.stats(inboxName);
  const stats = await getStats(env, inboxName);
  stats.unread = Math.max(0, stats.unread - 1);
  await env.EMAILS.put(key, JSON.stringify(stats), {
    expirationTtl: 1209600, // 14 hari
  });
}

async function updateStatsOnDelete(env, inboxName, unreadDelta) {
  const key = KV_KEYS.stats(inboxName);
  const stats = await getStats(env, inboxName);
  stats.total = Math.max(0, stats.total - 1);
  stats.unread = Math.max(0, stats.unread - unreadDelta);
  await env.EMAILS.put(key, JSON.stringify(stats), {
    expirationTtl: 1209600, // 14 hari
  });
}

// ─────────────────────────────────────────────
// Security Headers
// ─────────────────────────────────────────────
export function addSecurityHeaders(headers = new Headers()) {
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-src 'self'"
  );
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );
  return headers;
}

// ─────────────────────────────────────────────
// Response Helpers
// ─────────────────────────────────────────────
export function jsonResponse(data, status = 200, extraHeaders = {}) {
  const h = addSecurityHeaders(new Headers({ "Content-Type": "application/json" }));
  for (const [k, v] of Object.entries(extraHeaders)) {
    h.set(k, v);
  }
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function htmlResponse(html, status = 200) {
  const h = addSecurityHeaders(
    new Headers({ "Content-Type": "text/html;charset=UTF-8" })
  );
  return new Response(html, { status, headers: h });
}

// ─────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────
export function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  return `${days} hari lalu`;
}

// ─────────────────────────────────────────────
// Input Validation — Fase 2
// ─────────────────────────────────────────────

/**
 * Validate email ID (timestamp-based, numeric with optional suffix)
 */
export function isValidEmailId(id) {
  if (!id || typeof id !== "string") return false;
  // Accept: numeric timestamp (ms), optionally followed by -random suffix
  return /^\d{10,15}(-[a-z0-9]{2,8})?$/.test(id) && id.length <= 30;
}

/**
 * Validate attachment ID (base36 timestamp + random)
 */
export function isValidAttachmentId(id) {
  if (!id || typeof id !== "string") return false;
  return /^[a-z0-9]{8,20}$/i.test(id) && id.length <= 24;
}

/**
 * Truncate string to max length
 */
export function truncate(str, max = 200) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

/**
 * Check if expiry is soon (within 24 hours)
 */
export function isExpiringSoon(expiresAt) {
  const diff = expiresAt - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

/**
 * Format remaining time until expiry
 */
export function formatExpiry(expiresAt) {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "kedaluwarsa";
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}h ${hrs}j lagi`;
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `${hrs}j ${mins}m lagi`;
  return `${mins} menit lagi`;
}