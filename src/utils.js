// src/utils.js — Utilities: validation, ID generation, KV helpers

// ─────────────────────────────────────────────
// Inbox Name Validation
// ─────────────────────────────────────────────
// Karakter yang diizinkan di local part:
//   - huruf kecil (a-z), angka (0-9)
//   - tanda hubung (-), titik (.), underscore (_), plus (+)
// Aturan:
//   - Minimal 3, maksimal 64 karakter
//   - Harus diawali dan diakhiri huruf/angka (bukan simbol)
//   - Tidak boleh ada simbol berurutan (mis: "..", "--", "._", "+.")
const LOCAL_REGEX  = /^[a-z0-9]([a-z0-9._+\-]*[a-z0-9])?$/;
const DOMAIN_REGEX = /^[a-z0-9][a-z0-9\-\.]{1,60}[a-z0-9]$/;
// Simbol berurutan dilarang (mis: "..", "__", "+-", "-.")
const CONSECUTIVE_SYMBOLS = /[._+\-]{2,}/;

export function isValidInboxName(name) {
  if (!name || typeof name !== "string") return false;
  if (name.includes("@")) {
    const atIdx = name.indexOf("@");
    const local  = name.slice(0, atIdx);
    const domain = name.slice(atIdx + 1);
    return isValidLocal(local) && DOMAIN_REGEX.test(domain);
  }
  return isValidLocal(name);
}

function isValidLocal(local) {
  if (local.length < 3 || local.length > 64) return false;
  if (CONSECUTIVE_SYMBOLS.test(local)) return false;
  return LOCAL_REGEX.test(local);
}

export function sanitizeInboxName(raw) {
  return raw
    .toLowerCase()
    .trim()
    // hapus karakter selain yang diizinkan
    .replace(/[^a-z0-9._+\-]/g, "")
    // hapus simbol berurutan
    .replace(/[._+\-]{2,}/g, "-")
    // hapus simbol di awal/akhir
    .replace(/^[._+\-]+|[._+\-]+$/g, "");
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

/**
 * [Fix H-2] Sebelumnya: 24 adjektif x 21 noun x 90 angka (10-99) = 45.360
 * kombinasi — bisa di-brute-force dalam hitungan jam. Sekarang ditambah
 * suffix 8 karakter hex acak-kriptografis (crypto.getRandomValues, bukan
 * Math.random yang predictable), sehingga entropi efektif naik ke
 * 504 x 16^8 ≈ 2,2 triliun kombinasi.
 */
export function generateRandomInboxName() {
  const adj = ADJECTIVES[secureRandomInt(ADJECTIVES.length)];
  const noun = NOUNS[secureRandomInt(NOUNS.length)];
  const suffixBytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(suffixBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${adj}-${noun}-${suffix}`;
}

function secureRandomInt(maxExclusive) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % maxExclusive;
}

export function generateAttachmentId() {
  // [Fix M-3] crypto.randomUUID() menghasilkan 122 bit entropi acak murni —
  // jauh lebih aman daripada timestamp (dapat ditebak) + 5 karakter acak.
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * [Fix M-1 helper] Nonce acak per-request untuk Content-Security-Policy.
 * Dipakai supaya script-src bisa lepas dari 'unsafe-inline'.
 */
export function generateNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
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
  const listed = await env.TEMP_MAILS.list({ prefix, limit });
  if (!listed.keys.length) return [];

  // Fetch all records in parallel
  const promises = listed.keys.map((k) =>
    env.TEMP_MAILS.get(k.name, { type: "json" })
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
  return env.TEMP_MAILS.get(key, { type: "json" });
}

/**
 * Save an email record — ttlSec selalu dipass dari email-handler via config.js (EMAIL_TTL_DAYS)
 */
export async function saveEmailRecord(env, record, ttlSec) {
  const key = KV_KEYS.email(record.inboxName, record.id);
  await env.TEMP_MAILS.put(key, JSON.stringify(record), {
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
    await env.TEMP_MAILS.put(key, JSON.stringify(stats), {
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
      await env.TEMP_ATTACHMENTS.delete(`att:${att.id}`).catch(() => {});
    }
    await env.TEMP_MAILS.delete(KV_KEYS.attachment(att.id)).catch(() => {});
  }

  // Delete email record
  await env.TEMP_MAILS.delete(KV_KEYS.email(inboxName, emailId));

  // Update stats
  await updateStatsOnDelete(env, inboxName, record.read ? 0 : 1);

  return true;
}

/**
 * Delete all emails in an inbox
 */
export async function deleteAllEmails(env, inboxName) {
  const prefix = KV_KEYS.emailPrefix(inboxName);
  const listed = await env.TEMP_MAILS.list({ prefix, limit: 100 });

  for (const kv of listed.keys) {
    const record = await env.TEMP_MAILS.get(kv.name, { type: "json" });
    if (!record) continue;
    for (const att of record.attachments || []) {
      if (!att.skipped) {
        await env.TEMP_ATTACHMENTS.delete(`att:${att.id}`).catch(() => {});
      }
      await env.TEMP_MAILS.delete(KV_KEYS.attachment(att.id)).catch(() => {});
    }
    await env.TEMP_MAILS.delete(kv.name);
  }

  // Reset stats
  const statsKey = KV_KEYS.stats(inboxName);
  await env.TEMP_MAILS.put(
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
  const stats = await env.TEMP_MAILS.get(key, { type: "json" });
  return stats || { inboxName, total: 0, unread: 0, lastUpdated: 0 };
}

export async function incrementStats(env, inboxName) {
  const key = KV_KEYS.stats(inboxName);
  const stats = await getStats(env, inboxName);
  stats.total += 1;
  stats.unread += 1;
  stats.lastUpdated = Date.now();
  await env.TEMP_MAILS.put(key, JSON.stringify(stats), {
    expirationTtl: 1209600, // 14 hari
  });
}

async function decrementUnread(env, inboxName) {
  const key = KV_KEYS.stats(inboxName);
  const stats = await getStats(env, inboxName);
  stats.unread = Math.max(0, stats.unread - 1);
  await env.TEMP_MAILS.put(key, JSON.stringify(stats), {
    expirationTtl: 1209600, // 14 hari
  });
}

async function updateStatsOnDelete(env, inboxName, unreadDelta) {
  const key = KV_KEYS.stats(inboxName);
  const stats = await getStats(env, inboxName);
  stats.total = Math.max(0, stats.total - 1);
  stats.unread = Math.max(0, stats.unread - unreadDelta);
  await env.TEMP_MAILS.put(key, JSON.stringify(stats), {
    expirationTtl: 1209600, // 14 hari
  });
}

/**
 * [Fix M-2] Bersihkan nama file sebelum dipakai di header HTTP
 * (Content-Disposition). Membuang karakter yang bisa memutus format header
 * (tanda kutip, titik koma, CR/LF) atau dipakai untuk path traversal.
 */
export function sanitizeFilenameForHeader(filename) {
  if (!filename || typeof filename !== "string") return "file";
  const cleaned = filename
    .replace(/[\r\n]/g, "")
    .replace(/["\\;]/g, "_")
    .replace(/[/\\]/g, "_")
    .trim();
  return cleaned.slice(0, 255) || "file";
}

// ─────────────────────────────────────────────
// Security Headers
// ─────────────────────────────────────────────
export function addSecurityHeaders(headers = new Headers(), nonce = null) {
  // [Fix M-1] script-src tidak lagi 'unsafe-inline' — memakai nonce acak
  // per-request. Browser hanya akan menjalankan <script nonce="..."> yang
  // nonce-nya cocok, sehingga skrip yang disuntikkan via celah XSS lain
  // (yang tidak tahu nonce request ini) akan diblokir CSP sebagai lapisan
  // pertahanan kedua. style-src tetap 'unsafe-inline' karena seluruh UI
  // memakai inline style="" attribute secara ekstensif (risiko jauh lebih
  // rendah daripada script-src untuk eksekusi kode).
  const scriptSrc = nonce ? `'self' 'nonce-${nonce}'` : "'self'";
  headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; frame-src 'self'; base-uri 'self'; form-action 'self'`
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

export function htmlResponse(html, status = 200, nonce = null) {
  const h = addSecurityHeaders(
    new Headers({ "Content-Type": "text/html;charset=UTF-8" }),
    nonce
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
 * Validate attachment ID — format baru: 32 karakter hex (crypto.randomUUID
 * tanpa tanda hubung). Tetap menerima panjang 8-20 untuk kompatibilitas
 * mundur dengan attachment lama (format timestamp+random) yang mungkin
 * masih ada di KV/R2 sampai TTL-nya habis.
 */
export function isValidAttachmentId(id) {
  if (!id || typeof id !== "string") return false;
  return /^[a-z0-9]{8,32}$/i.test(id) && id.length <= 32;
}

/**
 * Cek apakah sebuah content type aman untuk dipreview langsung (inline) di
 * browser tanpa harus didownload dulu. Sengaja TIDAK termasuk text/html dan
 * image/svg+xml — keduanya bisa membawa script, dan karena attachment
 * disajikan dari origin yang sama dengan aplikasi, render inline untuk tipe
 * itu berisiko XSS. Tipe lain di luar daftar ini selalu dipaksa download.
 */
export function isPreviewableType(contentType) {
  if (!contentType || typeof contentType !== "string") return false;
  const ct = contentType.toLowerCase().split(";")[0].trim();
  if (ct === "application/pdf") return true;
  if (ct === "text/plain") return true;
  if (ct.startsWith("image/") && ct !== "image/svg+xml") return true;
  if (ct.startsWith("audio/")) return true;
  if (ct.startsWith("video/")) return true;
  return false;
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