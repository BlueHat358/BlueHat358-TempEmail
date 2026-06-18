// src/rate-limit.js — Rate limiting dengan sliding window per IP

import { RATE_LIMITS } from "./config.js";

/**
 * Ambil IP client dari request headers (Cloudflare selalu set CF-Connecting-IP)
 */
export function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Check & increment rate limit counter menggunakan KV sliding window.
 * Returns { allowed: boolean, remaining: number, resetIn: number }
 */
export async function checkRateLimit(env, action, ip) {
  if (!env.EMAILS || ip === "unknown") {
    return { allowed: true, remaining: 999, resetIn: 60 };
  }

  const config = RATE_LIMITS[action] || RATE_LIMITS.api;
  const now    = Math.floor(Date.now() / 1000);
  const key    = `rl:${action}:${ip}`;

  try {
    const existing = await env.EMAILS.get(key, { type: "json" });

    if (!existing) {
      await env.EMAILS.put(key, JSON.stringify({ count: 1, windowStart: now }), { expirationTtl: config.windowSec + 10 });
      return { allowed: true, remaining: config.max - 1, resetIn: config.windowSec };
    }

    if (existing.windowStart < now - config.windowSec) {
      await env.EMAILS.put(key, JSON.stringify({ count: 1, windowStart: now }), { expirationTtl: config.windowSec + 10 });
      return { allowed: true, remaining: config.max - 1, resetIn: config.windowSec };
    }

    if (existing.count >= config.max) {
      const resetIn = config.windowSec - (now - existing.windowStart);
      return { allowed: false, remaining: 0, resetIn: Math.max(1, resetIn) };
    }

    await env.EMAILS.put(
      key,
      JSON.stringify({ count: existing.count + 1, windowStart: existing.windowStart }),
      { expirationTtl: config.windowSec + 10 }
    );

    return {
      allowed:   true,
      remaining: config.max - existing.count - 1,
      resetIn:   config.windowSec - (now - existing.windowStart),
    };
  } catch (err) {
    console.warn("[rate-limit] KV error:", err);
    return { allowed: true, remaining: 99, resetIn: 60 };
  }
}

/**
 * Build standard rate limit headers untuk response
 */
export function rateLimitHeaders(action, result) {
  const config = RATE_LIMITS[action] || RATE_LIMITS.api;
  return {
    "X-RateLimit-Limit":     String(config.max),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset":     String(Math.floor(Date.now() / 1000) + result.resetIn),
    ...(result.allowed ? {} : { "Retry-After": String(result.resetIn) }),
  };
}
