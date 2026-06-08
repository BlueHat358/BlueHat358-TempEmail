// src/durable-objects/inbox-broadcaster.js
// Fase 3: SSE real-time broker per inbox via Durable Objects
//
// Arsitektur:
//   - Satu DO instance per inboxName
//   - DO menjaga daftar WebSocket connections aktif
//   - Worker email() → fetch DO /broadcast → DO kirim ke semua WS
//   - Worker GET /events/{name} → fetch DO /subscribe → upgrade WS
//
// Cloudflare Workers Durable Objects menggunakan WebSocket untuk
// komunikasi persisten karena DO tidak bisa langsung handle SSE stream
// yang di-tunnel dari client. Polanya:
//   Client → Worker (SSE stream) → DO (WebSocket internal)

export class InboxBroadcaster {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Map<websocket, { inboxName, connectedAt }>
    this.sessions = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    // ── /subscribe — upgrade WebSocket dari Worker ke DO ──────────────
    if (url.pathname === "/subscribe") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.state.acceptWebSocket(server);
      this.sessions.set(server, { connectedAt: Date.now() });

      return new Response(null, { status: 101, webSocket: client });
    }

    // ── /broadcast — terima event dari email Worker ───────────────────
    if (url.pathname === "/broadcast" && request.method === "POST") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return new Response("Bad JSON", { status: 400 });
      }

      const eventType = payload.type || "new-email";
      const data = JSON.stringify(payload.data || {});
      const message = `event: ${eventType}\ndata: ${data}\n\n`;

      // Kirim ke semua WebSocket aktif
      let sent = 0;
      const deadSockets = [];

      for (const [ws] of this.sessions) {
        try {
          ws.send(message);
          sent++;
        } catch {
          // WebSocket sudah mati
          deadSockets.push(ws);
        }
      }

      // Cleanup dead sockets
      for (const ws of deadSockets) {
        this.sessions.delete(ws);
        try { ws.close(); } catch {}
      }

      return new Response(JSON.stringify({ sent, total: this.sessions.size }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── /ping — health check & heartbeat ke semua clients ────────────
    if (url.pathname === "/ping") {
      const message = `event: ping\ndata: {}\n\n`;
      const deadSockets = [];
      let alive = 0;

      for (const [ws] of this.sessions) {
        try {
          ws.send(message);
          alive++;
        } catch {
          deadSockets.push(ws);
        }
      }

      for (const ws of deadSockets) {
        this.sessions.delete(ws);
        try { ws.close(); } catch {}
      }

      return new Response(JSON.stringify({ alive, cleaned: deadSockets.length }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── /stats — jumlah koneksi aktif ────────────────────────────────
    if (url.pathname === "/stats") {
      return new Response(JSON.stringify({ connections: this.sessions.size }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  // ── WebSocket lifecycle handlers ──────────────────────────────────
  webSocketMessage(ws, message) {
    // Client tidak perlu mengirim apa-apa, tapi kita handle ping dari client
    try {
      const data = JSON.parse(message);
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch {}
  }

  webSocketClose(ws, code, reason) {
    this.sessions.delete(ws);
  }

  webSocketError(ws, error) {
    this.sessions.delete(ws);
    try { ws.close(); } catch {}
  }
}
