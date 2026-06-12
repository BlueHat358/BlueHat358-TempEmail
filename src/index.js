// src/index.js — Cloudflare Workers Entry Point
// Fase 3: SSE real-time via Durable Objects, rate limiting upgrade,
//         search, about page, lengkap & production-ready

import { handleIncomingEmail, broadcastEmailDeleted } from "./email-handler.js";
import { InboxBroadcaster } from "./durable-objects/inbox-broadcaster.js";
import { renderHomePage }        from "./pages/home.js";
import { renderInboxPage }       from "./pages/inbox.js";
import { renderEmailDetailPage } from "./pages/email-detail.js";
import { renderAboutPage }       from "./pages/about.js";
import {
  isValidInboxName,
  isValidEmailId,
  isValidAttachmentId,
  sanitizeInboxName,
  listEmailRecords,
  getEmailRecord,
  getStats,
  markEmailRead,
  markAllEmailsRead,
  deleteEmail,
  deleteAllEmails,
  jsonResponse,
  htmlResponse,
} from "./utils.js";
import { escapeHtml } from "./theme.js";
import {
  checkRateLimit,
  rateLimitHeaders,
  getClientIp,
} from "./rate-limit.js";

const DEFAULT_DOMAINS = ["bluehat358.biz.id"];

function parseDomainList(env) {
  const raw = env.DOMAIN_LIST || env.DOMAIN_LISTING;
  if (!raw || typeof raw !== "string") return [...DEFAULT_DOMAINS];
  const parsed = raw
    .split(/[\s,;]+/)
    .map((d) => d.trim().replace(/^@/, ""))
    .filter(Boolean);
  return parsed.length ? parsed : [...DEFAULT_DOMAINS];
}

function getDomainForHost(hostname, domains) {
  if (!hostname) return domains[0];
  const lower = hostname.split(":")[0];
  const matched = domains.find((d) => d.toLowerCase() === lower.toLowerCase());
  return matched || domains[0];
}

// Re-export Durable Object class (wrangler butuh ini di entry point)
export { InboxBroadcaster };

/**
 * Gabungkan local part + domain menjadi inboxName yang unik per-domain.
 * resolveInboxName("darkrail", "bluehat358.biz.id") → "darkrail@bluehat358.biz.id"
 */
function resolveInboxName(localPart, domain) {
  const local = sanitizeInboxName(localPart);
  // Kalau sudah mengandung @domain (dari API call JS client), jangan tambah lagi
  if (local.includes("@")) return local;
  if (!domain) return local;
  return `${local}@${domain.toLowerCase().trim()}`;
}

// ─────────────────────────────────────────────
// HTTP Request Handler
// ─────────────────────────────────────────────
async function handleRequest(request, env, ctx) {
  const url      = new URL(request.url);
  const pathname = url.pathname;
  const method   = request.method;
  const ip       = getClientIp(request);

  const domains = parseDomainList(env);
  const queryDomain = (url.searchParams.get("domain") || "").trim();
  const normalizedQuery = queryDomain
    ? domains.find((d) => d.toLowerCase() === queryDomain.toLowerCase())
    : null;
  const hostDomain = getDomainForHost(url.hostname, domains);
  const resolvedDomain = normalizedQuery || hostDomain;

  // Build dynamic allowed origins from available domains
  const allowedOrigins = domains.map((d) => `https://${d}`);
  allowedOrigins.push("http://localhost:8787", url.origin);

  // ── OPTIONS (CORS preflight) ─────────────────────────────────────
  if (method === "OPTIONS") {
    const requestOrigin = request.headers.get("Origin") || "";
    const corsOrigin = allowedOrigins.find((a) => requestOrigin.startsWith(a)) || "";
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":  corsOrigin || (domains.length > 0 ? `https://${domains[0]}` : "https://bluehat358.biz.id"),
        "Access-Control-Allow-Methods": "GET, DELETE",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age":       "86400",
        "Vary":                         "Origin",
      },
    });
  }

  // ── CORS check untuk DELETE ──────────────────────────────────────
  if (method === "DELETE") {
    const origin  = request.headers.get("Origin") || "";
    if (origin && !allowedOrigins.some((a) => origin.startsWith(a))) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
  }

  // ── GET / ────────────────────────────────────────────────────────
  if (pathname === "/" && method === "GET") {
    // Polling fallback: /?check=inboxName
    const checkParam = url.searchParams.get("check");
    if (checkParam) {
      const rl = await checkRateLimit(env, "api", ip);
      if (!rl.allowed) {
        return jsonResponse(
          { error: "Terlalu banyak request", retryAfter: rl.resetIn },
          429,
          { ...rateLimitHeaders("api", rl), "Retry-After": String(rl.resetIn) }
        );
      }
      const name = resolveInboxName(checkParam, resolvedDomain);
      if (!isValidInboxName(name)) {
        return jsonResponse({ error: "Nama inbox tidak valid" }, 400);
      }
      const stats = await getStats(env, name);
      return jsonResponse(
        { unread: stats.unread, total: stats.total, lastUpdated: stats.lastUpdated },
        200,
        rateLimitHeaders("api", rl)
      );
    }

    const rl = await checkRateLimit(env, "page", ip);
    if (!rl.allowed) {
      return htmlResponse(
        errorPage("429 — Terlalu Banyak Request", `Tunggu ${rl.resetIn} detik lalu coba lagi.`),
        429
      );
    }
    return htmlResponse(renderHomePage({
      domains,
      defaultDomain: hostDomain,
      forcedDomain: normalizedQuery,
      domain: resolvedDomain,
    }));
  }

  // ── GET /about ────────────────────────────────────────────────────
  if (pathname === "/about" && method === "GET") {
    const rl = await checkRateLimit(env, "page", ip);
    if (!rl.allowed) {
      return htmlResponse(
        errorPage("429 — Terlalu Banyak Request", `Tunggu ${rl.resetIn} detik lalu coba lagi.`),
        429
      );
    }
    return htmlResponse(renderAboutPage({ domains, domain: resolvedDomain }));
  }

  // ── GET /events/{inboxName} — SSE via Durable Objects ────────────
  if (pathname.startsWith("/events/") && method === "GET") {
    const inboxName = resolveInboxName(decodeURIComponent(pathname.slice(8)), resolvedDomain);
    if (!isValidInboxName(inboxName)) {
      return jsonResponse({ error: "Nama inbox tidak valid" }, 400);
    }

    // Rate limit SSE connections per IP
    const rl = await checkRateLimit(env, "sse", ip);
    if (!rl.allowed) {
      return jsonResponse(
        { error: "Terlalu banyak koneksi SSE", retryAfter: rl.resetIn },
        429,
        { "Retry-After": String(rl.resetIn) }
      );
    }

    // ── Mode 1: Durable Object tersedia → WebSocket bridge ke DO ────
    if (env.INBOX_BROADCASTER) {
      return handleSseWithDO(env, inboxName, request);
    }

    // ── Mode 2: Fallback — SSE ping-only (tanpa DO) ─────────────────
    return handleSsePingOnly(request);
  }

  // ── /api/* ────────────────────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    return handleApiRoute(pathname, method, url, env, ctx, ip, resolvedDomain);
  }

  // ── Route: /{inboxName} dan /{inboxName}/{emailId} ───────────────
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 1 && method === "GET") {
    const rl = await checkRateLimit(env, "page", ip);
    if (!rl.allowed) {
      return htmlResponse(
        errorPage("429 — Terlalu Banyak Request", `Tunggu ${rl.resetIn} detik lalu coba lagi.`),
        429
      );
    }

    const inboxName = resolveInboxName(decodeURIComponent(parts[0]), resolvedDomain);
    if (!isValidInboxName(inboxName)) {
      return htmlResponse(
        errorPage(
          "Nama inbox tidak valid",
          "Gunakan 3–32 karakter: huruf kecil (a–z), angka (0–9), dan tanda hubung. Tidak boleh diawali/diakhiri tanda hubung."
        ),
        400
      );
    }

    const searchQuery = url.searchParams.get("q")?.trim().toLowerCase() || "";

    const [emails, stats] = await Promise.all([
      listEmailRecords(env, inboxName),
      getStats(env, inboxName),
    ]);

    const filtered = searchQuery
      ? emails.filter(
          (e) =>
            e.subject?.toLowerCase().includes(searchQuery) ||
            e.from?.toLowerCase().includes(searchQuery)
        )
      : emails;

    return htmlResponse(
      renderInboxPage(inboxName, filtered, stats, searchQuery, {
        domains,
        domain: resolvedDomain,
      })
    );
  }

  if (parts.length === 2 && method === "GET") {
    const rl = await checkRateLimit(env, "page", ip);
    if (!rl.allowed) {
      return htmlResponse(
        errorPage("429 — Terlalu Banyak Request", `Tunggu ${rl.resetIn} detik lalu coba lagi.`),
        429
      );
    }

    const inboxName = resolveInboxName(decodeURIComponent(parts[0]), resolvedDomain);
    const emailId   = decodeURIComponent(parts[1]);

    if (!isValidInboxName(inboxName)) {
      return htmlResponse(errorPage("Nama inbox tidak valid"), 400);
    }
    if (!isValidEmailId(emailId)) {
      return htmlResponse(errorPage("ID email tidak valid", "Format ID tidak dikenal."), 400);
    }

    const email = await getEmailRecord(env, inboxName, emailId);
    if (!email) {
      return htmlResponse(
        errorPage("Email tidak ditemukan", "Email mungkin sudah expired (7 hari) atau dihapus."),
        404
      );
    }

    ctx.waitUntil(markEmailRead(env, inboxName, emailId));

    return htmlResponse(renderEmailDetailPage(inboxName, email, { domain: resolvedDomain }));
  }

  return htmlResponse(
    errorPage("Halaman tidak ditemukan", "URL yang kamu buka tidak tersedia."),
    404
  );
}

// ─────────────────────────────────────────────
// SSE Handler — dengan Durable Object
// Browser ← SSE stream ← Worker ← WebSocket ← DO
// ─────────────────────────────────────────────
async function handleSseWithDO(env, inboxName, request) {
  const doId  = env.INBOX_BROADCASTER.idFromName(`broadcast:${inboxName}`);
  const stub  = env.INBOX_BROADCASTER.get(doId);

  // Upgrade WebSocket ke DO
  const doResp = await stub.fetch("https://do-internal/subscribe", {
    headers: { Upgrade: "websocket" },
  });

  if (doResp.status !== 101) {
    // Fallback ke ping-only jika DO tidak bisa upgrade
    return handleSsePingOnly(request);
  }

  const doWs = doResp.webSocket;
  doWs.accept();

  // Buat SSE stream ke browser
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc    = new TextEncoder();

  // Kirim komentar awal agar browser langsung tau koneksi terbuka
  writer.write(enc.encode(": SSE connected\n\n"));
  writer.write(enc.encode("event: ping\ndata: {}\n\n"));

  // Forward pesan dari DO WebSocket ke SSE stream
  doWs.addEventListener("message", (event) => {
    // Pesan dari DO sudah dalam format SSE: "event: ...\ndata: ...\n\n"
    writer.write(enc.encode(event.data)).catch(() => {
      doWs.close();
    });
  });

  doWs.addEventListener("close", () => {
    writer.close().catch(() => {});
  });

  doWs.addEventListener("error", () => {
    writer.close().catch(() => {});
  });

  // Heartbeat setiap 25 detik (cegah timeout proxy/Cloudflare)
  const pingTimer = setInterval(() => {
    writer.write(enc.encode("event: ping\ndata: {}\n\n")).catch(() => {
      clearInterval(pingTimer);
      doWs.close();
    });
  }, 25000);

  // Cleanup saat client disconnect
  request.signal?.addEventListener("abort", () => {
    clearInterval(pingTimer);
    doWs.close();
    writer.close().catch(() => {});
  });

  return new Response(readable, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// SSE fallback tanpa Durable Object — hanya ping
function handleSsePingOnly(request) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc    = new TextEncoder();

  writer.write(enc.encode("event: ping\ndata: {}\n\n"));

  const timer = setInterval(() => {
    writer.write(enc.encode("event: ping\ndata: {}\n\n")).catch(() => {
      clearInterval(timer);
    });
  }, 25000);

  request.signal?.addEventListener("abort", () => {
    clearInterval(timer);
    writer.close().catch(() => {});
  });

  return new Response(readable, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ─────────────────────────────────────────────
// API Route Handler
// ─────────────────────────────────────────────
async function handleApiRoute(pathname, method, url, env, ctx, ip, resolvedDomain) {
  const segments = pathname.slice(5).split("/").filter(Boolean);

  // GET /api/inbox/{name} — list emails JSON (dengan search)
  if (segments[0] === "inbox" && segments.length === 2 && method === "GET") {
    const rl = await checkRateLimit(env, "api", ip);
    if (!rl.allowed) {
      return jsonResponse(
        { error: "Terlalu banyak request", retryAfter: rl.resetIn },
        429,
        { "Retry-After": String(rl.resetIn), ...rateLimitHeaders("api", rl) }
      );
    }

    const inboxName = resolveInboxName(decodeURIComponent(segments[1]), resolvedDomain);
    if (!isValidInboxName(inboxName)) {
      return jsonResponse({ error: "Nama inbox tidak valid", hint: "Gunakan a-z, 0-9, dan tanda hubung" }, 400);
    }

    const q = url.searchParams.get("q")?.trim().toLowerCase() || "";

    const [emails, stats] = await Promise.all([
      listEmailRecords(env, inboxName),
      getStats(env, inboxName),
    ]);

    const filtered = q
      ? emails.filter(
          (e) =>
            e.subject?.toLowerCase().includes(q) ||
            e.from?.toLowerCase().includes(q)
        )
      : emails;

    const preview = filtered.map((e) => ({
      id:              e.id,
      from:            e.from,
      subject:         e.subject,
      date:            e.date,
      receivedAt:      e.receivedAt,
      expiresAt:       e.expiresAt,
      read:            e.read,
      hasAttachments:  (e.attachments || []).length > 0,
      attachmentCount: (e.attachments || []).length,
    }));

    return jsonResponse(
      {
        inbox:    inboxName,
        emails:   preview,
        total:    stats.total,
        unread:   stats.unread,
        filtered: q ? filtered.length : null,
        query:    q || null,
      },
      200,
      rateLimitHeaders("api", rl)
    );
  }

  // DELETE /api/inbox/{name}/{emailId} — hapus satu email
  if (segments[0] === "inbox" && segments.length === 3 && method === "DELETE") {
    const rl = await checkRateLimit(env, "delete", ip);
    if (!rl.allowed) {
      return jsonResponse(
        { error: "Terlalu banyak request", retryAfter: rl.resetIn },
        429,
        { "Retry-After": String(rl.resetIn) }
      );
    }

    const inboxName = resolveInboxName(decodeURIComponent(segments[1]), resolvedDomain);
    const emailId   = decodeURIComponent(segments[2]);

    if (!isValidInboxName(inboxName)) return jsonResponse({ error: "Nama inbox tidak valid" }, 400);
    if (!isValidEmailId(emailId))     return jsonResponse({ error: "ID email tidak valid" }, 400);

    const ok = await deleteEmail(env, inboxName, emailId);
    if (!ok) return jsonResponse({ error: "Email tidak ditemukan atau sudah dihapus" }, 404);

    // Broadcast SSE email-deleted
    ctx.waitUntil(broadcastEmailDeleted(env, inboxName, emailId));

    return new Response(null, { status: 204 });
  }

  // POST /api/inbox/{name}/mark-read — tandai semua email dibaca
  if (segments[0] === "inbox" && segments.length === 3 && segments[2] === "mark-read" && method === "POST") {
    const rl = await checkRateLimit(env, "api", ip);
    if (!rl.allowed) {
      return jsonResponse(
        { error: "Terlalu banyak request", retryAfter: rl.resetIn },
        429,
        { "Retry-After": String(rl.resetIn), ...rateLimitHeaders("api", rl) }
      );
    }

    const inboxName = resolveInboxName(decodeURIComponent(segments[1]), resolvedDomain);
    if (!isValidInboxName(inboxName)) return jsonResponse({ error: "Nama inbox tidak valid" }, 400);

    const marked = await markAllEmailsRead(env, inboxName);
    return jsonResponse({ marked, inbox: inboxName }, 200, rateLimitHeaders("api", rl));
  }

  // DELETE /api/inbox/{name} — hapus semua email
  if (segments[0] === "inbox" && segments.length === 2 && method === "DELETE") {
    const rl = await checkRateLimit(env, "delete", ip);
    if (!rl.allowed) {
      return jsonResponse(
        { error: "Terlalu banyak request", retryAfter: rl.resetIn },
        429,
        { "Retry-After": String(rl.resetIn) }
      );
    }

    const inboxName = resolveInboxName(decodeURIComponent(segments[1]), resolvedDomain);
    if (!isValidInboxName(inboxName)) return jsonResponse({ error: "Nama inbox tidak valid" }, 400);

    ctx.waitUntil(deleteAllEmails(env, inboxName));
    return new Response(null, { status: 204 });
  }

  // GET /api/attachments/{attId} — download attachment dari R2
  if (segments[0] === "attachments" && segments.length === 2 && method === "GET") {
    const rl = await checkRateLimit(env, "download", ip);
    if (!rl.allowed) {
      return jsonResponse(
        { error: "Terlalu banyak request", retryAfter: rl.resetIn },
        429,
        { "Retry-After": String(rl.resetIn) }
      );
    }

    const attId = decodeURIComponent(segments[1]);
    if (!isValidAttachmentId(attId)) return jsonResponse({ error: "ID attachment tidak valid" }, 400);

    const obj = await env.ATTACHMENTS.get(`att:${attId}`);
    if (!obj) return jsonResponse({ error: "File tidak ditemukan atau sudah expired" }, 404);

    const headers = new Headers();
    headers.set("Content-Type",        obj.httpMetadata?.contentType || "application/octet-stream");
    headers.set("Content-Disposition", obj.httpMetadata?.contentDisposition || `attachment; filename="file"`);
    headers.set("Cache-Control",       "no-store");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(obj.body, { headers });
  }

  // GET /api/stats/{inboxName} — ringkasan stats inbox
  if (segments[0] === "stats" && segments.length === 2 && method === "GET") {
    const rl = await checkRateLimit(env, "api", ip);
    if (!rl.allowed) {
      return jsonResponse(
        { error: "Terlalu banyak request", retryAfter: rl.resetIn },
        429,
        { "Retry-After": String(rl.resetIn) }
      );
    }

    const inboxName = resolveInboxName(decodeURIComponent(segments[1]), resolvedDomain);
    if (!isValidInboxName(inboxName)) return jsonResponse({ error: "Nama inbox tidak valid" }, 400);

    const stats = await getStats(env, inboxName);
    return jsonResponse({ ...stats }, 200, rateLimitHeaders("api", rl));
  }

  // GET /api/connections/{inboxName} — jumlah SSE connections aktif (Fase 3)
  if (segments[0] === "connections" && segments.length === 2 && method === "GET") {
    const inboxName = resolveInboxName(decodeURIComponent(segments[1]), resolvedDomain);
    if (!isValidInboxName(inboxName)) return jsonResponse({ error: "Nama inbox tidak valid" }, 400);

    if (!env.INBOX_BROADCASTER) {
      return jsonResponse({ connections: 0, durable_objects: false }, 200);
    }

    try {
      const doId  = env.INBOX_BROADCASTER.idFromName(`broadcast:${inboxName}`);
      const stub  = env.INBOX_BROADCASTER.get(doId);
      const resp  = await stub.fetch("https://do-internal/stats");
      const data  = await resp.json();
      return jsonResponse({ ...data, durable_objects: true }, 200);
    } catch {
      return jsonResponse({ connections: 0, durable_objects: true, error: "DO unavailable" }, 200);
    }
  }

  // GET /api/system/status — cek apakah inbox-count sudah penuh
  if (segments[0] === "system" && segments[1] === "status" && method === "GET") {
    const countData = await env.EMAILS.get("system:inbox-count", { type: "json" });
    const knownInboxes = countData?.inboxes || [];

    // Cek berapa yang masih aktif (punya pesan) langsung via KV list
    const activeChecks = await Promise.all(
      knownInboxes.map(async (name) => {
        const listed = await env.EMAILS.list({ prefix: `inbox:${name}:`, limit: 1 });
        return listed.keys.length > 0 ? name : null;
      })
    );
    const activeInboxes = activeChecks.filter(Boolean);
    const MAX_SLOTS = 10;

    return jsonResponse({
      total_slots: MAX_SLOTS,
      used_slots: activeInboxes.length,
      available_slots: Math.max(0, MAX_SLOTS - activeInboxes.length),
      is_full: activeInboxes.length >= MAX_SLOTS,
    }, 200);
  }

  return jsonResponse({ error: "Endpoint tidak ditemukan", hint: "Periksa dokumentasi API" }, 404);
}

// ─────────────────────────────────────────────
// Scheduled Cron — cleanup R2 expired attachments
// ─────────────────────────────────────────────
async function handleScheduled(event, env, ctx) {
  console.log("[cron] Starting R2 expired attachment cleanup...");
  const now = Date.now();
  let deleted = 0;
  let cursor;

  try {
    do {
      const list = await env.ATTACHMENTS.list({ cursor, limit: 1000 });
      for (const obj of list.objects) {
        const exp = obj.customMetadata?.expiresAt;
        if (exp && now > Number(exp)) {
          await env.ATTACHMENTS.delete(obj.key);
          deleted++;
        }
      }
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);

    console.log(`[cron] Cleanup done. Deleted ${deleted} expired R2 objects.`);
  } catch (err) {
    console.error("[cron] Cleanup error:", err);
  }
}

// ─────────────────────────────────────────────
// Error page HTML
// ─────────────────────────────────────────────
function errorPage(title, detail = "") {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} — BlueHat358 TempMail</title>
  <script>
    (function(){
      var s=localStorage.getItem('theme'),p=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
      document.documentElement.classList.toggle('light',(s||p)==='light');
    })();
  </script>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@700;800&display=swap">
  <style>
    :root{--bg:#1E1E2E;--text:#CDD6F4;--subtext:#BAC2DE;--surface:#313244;--surface1:#45475A;--accent:#CBA6F7;--red:#F38BA8;--mantle:#181825;}
    html.light{--bg:#EFF1F5;--text:#4C4F69;--subtext:#5C5F77;--surface:#CCD0DA;--surface1:#BCC0CC;--accent:#8839EF;--red:#D20F39;--mantle:#E6E9EF;}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:var(--bg);color:var(--text);font-family:'JetBrains Mono',monospace;
      display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;}
    .box{background:var(--surface);border:1px solid var(--surface1);border-radius:16px;padding:2.5rem;max-width:480px;width:100%;text-align:center;}
    .error-icon{font-size:3rem;margin-bottom:0.75rem;}
    h1{font-size:1.3rem;margin-bottom:0.75rem;color:var(--red);font-family:'Space Grotesk',sans-serif;}
    p{color:var(--subtext);font-size:0.875rem;margin-bottom:1.5rem;line-height:1.6;}
    .btn{display:inline-flex;align-items:center;gap:0.4rem;padding:.65rem 1.4rem;background:var(--accent);color:#1E1E2E;
      border-radius:8px;text-decoration:none;font-weight:600;font-family:'Space Grotesk',sans-serif;font-size:0.9rem;transition:opacity 150ms;}
    .btn:hover{opacity:0.85;}
  </style>
</head>
<body>
  <div class="box">
    <div class="error-icon">⚠️</div>
    <h1>${escapeHtml(title)}</h1>
    ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
    <a href="/" class="btn">← Kembali ke Beranda</a>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// Export — Cloudflare Workers ES Module format
// ─────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (err) {
      console.error("[worker] Unhandled error:", err);
      return htmlResponse(
        errorPage("Internal Server Error", "Terjadi kesalahan internal. Coba lagi dalam beberapa saat."),
        500
      );
    }
  },

  async email(message, env, ctx) {
    return handleIncomingEmail(message, env, ctx);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env, ctx));
  },
};