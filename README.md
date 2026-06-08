# BlueHat358 TempMail — Fase 3

> Cloudflare Workers · KV · R2 · Durable Objects · @bluehat358.biz.id

Fase 3 melanjutkan Fase 2 dengan mengaktifkan fitur-fitur lanjutan:
**SSE real-time via Durable Objects**, **rate limiting upgrade**, dan **auto-refresh email list**.

---

## ✅ Yang Baru di Fase 3

| Fitur | Status |
|---|---|
| SSE real-time via Durable Objects (`InboxBroadcaster`) | ✅ Baru |
| Auto-refresh email list saat ada email baru | ✅ Baru |
| Handle event `email-deleted` via SSE | ✅ Baru |
| Rate limit untuk SSE connections (10/menit/IP) | ✅ Baru |
| Endpoint `/api/connections/{name}` — hitung SSE aktif | ✅ Baru |
| Broadcast `email-deleted` saat email dihapus via API | ✅ Baru |
| Fallback polling tetap berfungsi jika DO tidak tersedia | ✅ Dipertahankan |

---

## 🏗️ Arsitektur SSE (Fase 3)

```
Browser                     Worker                    Durable Object
  |                            |                            |
  |-- GET /events/{inbox} ---> |                            |
  |                            |-- WebSocket upgrade -----> |
  |                            |<-- WebSocket (server) ---- |
  |<-- SSE stream (text/ev) -- |                            |
  |                            |                            |
  |  [email baru masuk]        |                            |
  |                  email()   |                            |
  |              ctx.waitUntil |-- POST /broadcast -------> |
  |                            |                   DO broadcast ke semua WS
  |<-- event: new-email ------|<-- WebSocket message ------ |
```

**Kenapa WebSocket DO → SSE Worker, bukan langsung SSE DO?**
Cloudflare Durable Objects tidak mendukung streaming SSE langsung ke browser. 
Polanya: Worker membuat SSE stream ke browser, lalu bridge via WebSocket ke DO.
DO menjaga daftar semua WS aktif dan broadcast ke semuanya saat ada email baru.

---

## 📁 Struktur File

```
fase3/
├── src/
│   ├── index.js                          # Entry point — semua route + DO export
│   ├── email-handler.js                  # Email ingestion + broadcast ke DO
│   ├── rate-limit.js                     # Rate limiting KV sliding window
│   ├── utils.js                          # KV helpers, validasi, format
│   ├── theme.js                          # Catppuccin CSS, base layout
│   ├── durable-objects/
│   │   └── inbox-broadcaster.js          # InboxBroadcaster DO class
│   └── pages/
│       ├── home.js                       # Halaman beranda
│       ├── inbox.js                      # Inbox + SSE client (upgrade)
│       ├── email-detail.js              # Detail email
│       └── about.js                     # Tentang & FAQ
├── wrangler.toml                         # Config dengan DO binding aktif
├── package.json
└── README.md
```

---

## 🚀 Deploy ke Cloudflare

### Prasyarat (dari Fase 1 & 2)
- KV namespace `EMAILS` sudah dibuat dan ID diisi di `wrangler.toml`
- R2 bucket `bluehat358-attachments` sudah dibuat
- Email Routing wildcard rule `*@bluehat358.biz.id` → Worker sudah aktif

### Langkah Deploy Fase 3

```bash
# 1. Install dependencies
npm install

# 2. Deploy (Wrangler otomatis buat DO class dari migrations)
npm run deploy

# 3. Verifikasi DO terdaftar
wrangler durable-objects list
# Harus ada: InboxBroadcaster

# 4. Tes SSE
curl -N https://bluehat358.biz.id/events/test-inbox
# Harus muncul: event: ping\ndata: {}\n\n

# 5. Monitor logs
npm run tail
```

### Aktifkan DO di wrangler.toml
File `wrangler.toml` sudah dikonfigurasi. Pastikan bagian ini **tidak** dikomentari:

```toml
[[durable_objects.bindings]]
name       = "INBOX_BROADCASTER"
class_name = "InboxBroadcaster"

[[migrations]]
tag         = "v1"
new_classes = ["InboxBroadcaster"]
```

---

## 🔌 Endpoint Baru (Fase 3)

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/events/{inboxName}` | GET | SSE stream (sekarang via DO, bukan ping-only) |
| `/api/connections/{name}` | GET | Jumlah SSE connections aktif di inbox |

### GET /api/connections/{name}
```json
{
  "connections": 3,
  "durable_objects": true
}
```

---

## 🔔 SSE Events (Lengkap)

```
event: new-email
data: {"id":"1718000000000","from":"sender@example.com","subject":"Hello","receivedAt":1718000000000,"unread":2}

event: email-deleted
data: {"id":"1718000000000","unread":1}

event: ping
data: {}
```

**Client behavior:**
- `new-email` → auto-refresh daftar email + toast notifikasi
- `email-deleted` → hapus baris email dari DOM dengan animasi
- `ping` → keep-alive, tidak perlu aksi

---

## ⚙️ Cara Kerja Durable Object

`InboxBroadcaster` adalah stateful compute di Cloudflare Workers:

- **Satu instance per inbox**: ID = `"broadcast:" + inboxName`
- **Session management**: Map<WebSocket, metadata> di memory DO
- **3 endpoints internal**:
  - `POST /broadcast` — terima event dari Worker, kirim ke semua WS
  - `GET /subscribe` — upgrade WebSocket dari Worker baru
  - `GET /stats` — hitung koneksi aktif
  - `GET /ping` — heartbeat + cleanup dead connections

---

## 🔄 Kompatibilitas dengan Fase 1 & 2

Fase 3 **sepenuhnya backward compatible**:
- Semua KV schema, R2 key format, dan endpoint API tidak berubah
- Jika `INBOX_BROADCASTER` binding tidak tersedia (misal lokal dev), Worker otomatis fallback ke SSE ping-only
- Polling fallback (`/?check={inbox}`) tetap berfungsi normal

---

## 🔒 Keamanan (Tambahan Fase 3)

- DO hanya bisa diakses dari Worker sendiri (internal fetch) — tidak exposed ke internet
- Rate limit SSE: 10 koneksi/menit/IP (mencegah exhaustion DO sessions)
- WebSocket ke DO menggunakan URL internal `https://do-internal/` — Cloudflare tidak routing ini ke internet

---

## 📊 Estimasi Penggunaan DO (Free Plan)

| Resource | Batas | Estimasi |
|---|---|---|
| DO Requests | 1 juta/bulan | 1 broadcast per email masuk + 1 subscribe per user view |
| DO Duration | 400.000 GB-detik/bulan | DO aktif selama ada koneksi WS. Idle DO hibernate otomatis |
| DO Storage | 1 GB | InboxBroadcaster tidak menyimpan ke storage DO (state di memory) |

---

*BlueHat358 TempMail · Fase 3 · Juni 2026 · Catppuccin Mocha + Latte*
