// src/config.js — Konfigurasi terpusat
// Semua nilai yang mungkin perlu disesuaikan ada di sini.
// Tidak perlu mencari ke file lain untuk mengubah behavior aplikasi.

// ─── Penyimpanan & Quota ──────────────────────────────────────────────────
export const MAX_EMAILS_PER_INBOX = 20;        // Maks email per inbox (FIFO jika penuh)
export const MAX_TOTAL_INBOXES    = 10;        // Maks inbox aktif di seluruh sistem
export const MAX_ATTACHMENT_SIZE  = 10 * 1024 * 1024; // Maks ukuran per attachment (bytes)

// ─── TTL / Expiry ─────────────────────────────────────────────────────────
export const EMAIL_TTL_DAYS       = 7;         // Email dihapus otomatis setelah N hari
export const ATTACHMENT_TTL_DAYS  = 7;         // Attachment R2 dihapus setelah N hari
export const STATS_TTL_DAYS       = 14;        // Stats KV dihapus setelah N hari

// ─── Polling (countdown) ──────────────────────────────────────────────────
export const POLL_INTERVAL_SEC    = 30;        // Interval cek email baru (detik)

// ─── UI ───────────────────────────────────────────────────────────────────
export const INBOX_QUOTA_DISPLAY  = 50;        // Angka "Maks X email" yang tampil di UI
export const INBOX_WARN_THRESHOLD = 45;        // Tampilkan warning "hampir penuh" di atas N email

// ─── Domain default ───────────────────────────────────────────────────────
export const DEFAULT_DOMAIN       = "bluehat358.eu.cc";

// ─── Rate Limiting ────────────────────────────────────────────────────────
// Format: { max: jumlah_request, windowSec: rentang_waktu_detik }
export const RATE_LIMITS = {
  page:     { max: 120, windowSec: 60 },  // Halaman HTML
  api:      { max: 60,  windowSec: 60 },  // API read (inbox, stats)
  delete:   { max: 20,  windowSec: 60 },  // Operasi hapus
  download: { max: 30,  windowSec: 60 },  // Download attachment
};

// ─── Computed display values (otomatis dihitung dari config di atas) ───────
// Jangan ubah ini — ubah nilai di atas, ini ikut otomatis
export const MAX_ATTACHMENT_SIZE_MB = MAX_ATTACHMENT_SIZE / (1024 * 1024);
