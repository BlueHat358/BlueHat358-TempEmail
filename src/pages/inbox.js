// src/pages/inbox.js — Inbox page: list emails, search, copy address, delete all
// Fase 2: search filter, expiry indicator, improved UX

import { baseLayout, escapeHtml } from "../theme.js";
import { timeAgo, formatBytes, formatExpiry, isExpiringSoon } from "../utils.js";

export function renderInboxPage(inboxName, emails, stats, searchQuery = "") {
  const emailAddr = `${inboxName}@bluehat358.biz.id`;
  const unread = emails.filter((e) => !e.read).length;
  const totalEmails = stats.total || emails.length;

  const emailListHtml =
    emails.length === 0
      ? `<div style="
          text-align:center;
          padding:4rem 2rem;
          color:var(--subtext);
        ">
          <div style="font-size:3rem;margin-bottom:1rem;">${searchQuery ? "🔍" : "📭"}</div>
          <p style="font-size:1.05rem;font-weight:600;margin-bottom:0.5rem;">
            ${searchQuery ? `Tidak ada email yang cocok dengan "${escapeHtml(searchQuery)}"` : "Inbox kosong"}
          </p>
          <p style="font-size:0.875rem;">
            ${searchQuery
              ? `<a href="/${encodeURIComponent(inboxName)}" style="color:var(--accent)">Hapus filter pencarian</a>`
              : `Kirim email ke <code style="color:var(--accent)">${escapeHtml(emailAddr)}</code> untuk mulai.`}
          </p>
        </div>`
      : emails.map((email) => renderEmailRow(inboxName, email)).join("");

  const body = `
    <!-- Inbox header -->
    <div style="
      background:var(--surface);
      border:1px solid var(--surface1);
      border-radius:var(--radius-lg);
      padding:1.5rem;
      margin-bottom:1rem;
      box-shadow:var(--shadow);
    ">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
        <div>
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;flex-wrap:wrap;">
            <h1 style="font-size:1.5rem;">
              <span style="color:var(--accent)">${escapeHtml(inboxName)}</span>
              <span style="color:var(--subtext);font-weight:400;">@bluehat358.biz.id</span>
            </h1>
            ${unread > 0 ? `<span class="badge badge-unread">${unread} baru</span>` : ""}
          </div>

          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <code style="
              background:var(--mantle);
              border:1px solid var(--surface1);
              padding:0.35rem 0.85rem;
              border-radius:var(--radius-md);
              font-size:0.9rem;
              color:var(--text);
              display:inline-block;
            ">${escapeHtml(emailAddr)}</code>
            <button
              class="btn btn-sm btn-secondary"
              onclick="copyToClipboard('${escapeHtml(emailAddr)}', 'Alamat email')"
            >📋 Salin</button>
          </div>

          <div style="
            margin-top:0.75rem;
            display:flex;gap:1.25rem;flex-wrap:wrap;
            color:var(--subtext);
            font-size:0.8rem;
          ">
            <span>📧 ${emails.length}${searchQuery ? ` dari ${totalEmails}` : ""} email</span>
            ${unread > 0
              ? `<span style="color:var(--accent)">● ${unread} belum dibaca</span>`
              : '<span style="color:var(--green)">✓ Semua terbaca</span>'}
            <span style="color:var(--overlay)">📦 Maks 50 email</span>
            ${totalEmails >= 45
              ? `<span style="color:var(--yellow)">⚠️ Inbox hampir penuh</span>`
              : ""}
          </div>
        </div>

        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:flex-start;">
          <button class="btn btn-sm btn-secondary" onclick="refreshInbox()" id="refresh-btn">
            🔄 Refresh
          </button>
          ${emails.length > 0
            ? `<button class="btn btn-sm btn-danger" onclick="deleteAll()">
            🗑️ Hapus Semua
          </button>`
            : ""}
        </div>
      </div>

      <!-- SSE/Polling status -->
      <div id="sse-status" style="
        margin-top:1rem;
        padding:0.5rem 0.85rem;
        background:var(--mantle);
        border:1px solid var(--surface1);
        border-radius:var(--radius-md);
        font-size:0.78rem;
        display:flex;
        align-items:center;
        gap:0.5rem;
        color:var(--subtext);
      ">
        <span id="sse-dot">⏳</span>
        <span id="sse-text">Menghubungkan ke real-time updates...</span>
      </div>
    </div>

    <!-- Search bar -->
    <div style="
      background:var(--surface);
      border:1px solid var(--surface1);
      border-radius:var(--radius-md);
      padding:0.85rem 1rem;
      margin-bottom:1rem;
      display:flex;
      align-items:center;
      gap:0.75rem;
    ">
      <span style="color:var(--overlay);font-size:1rem;">🔍</span>
      <input
        type="text"
        id="search-input"
        placeholder="Cari berdasarkan subjek atau pengirim..."
        value="${escapeHtml(searchQuery)}"
        oninput="handleSearch(this.value)"
        style="
          flex:1;
          background:transparent;
          border:none;
          outline:none;
          color:var(--text);
          font-family:'JetBrains Mono',monospace;
          font-size:0.875rem;
        "
      >
      ${searchQuery
        ? `<a href="/${encodeURIComponent(inboxName)}" style="
          color:var(--overlay);
          font-size:0.8rem;
          text-decoration:none;
          white-space:nowrap;
          padding:0.25rem 0.6rem;
          background:var(--surface1);
          border-radius:var(--radius-sm);
        ">✕ Hapus</a>`
        : ""}
    </div>

    ${searchQuery
      ? `<div style="
          font-size:0.8rem;
          color:var(--subtext);
          margin-bottom:0.75rem;
          padding:0 0.25rem;
        ">
          ${emails.length > 0
            ? `Menampilkan <strong style="color:var(--text)">${emails.length}</strong> hasil untuk "<span style="color:var(--accent)">${escapeHtml(searchQuery)}</span>"`
            : "Tidak ada hasil"}
        </div>`
      : ""}

    <!-- Email list -->
    <div id="email-list">
      ${emailListHtml}
    </div>

    <!-- Quota warning (more prominent) -->
    ${totalEmails >= 45
      ? `<div class="alert alert-warning" style="margin-top:1rem;">
      <span>⚠️</span>
      <div>
        <strong>Inbox hampir penuh!</strong> Sudah ${totalEmails}/50 email.
        Email baru akan di-drop secara diam-diam jika inbox sudah penuh.
        <button onclick="deleteAll()" style="
          background:none;border:none;color:var(--accent);cursor:pointer;
          font-family:inherit;font-size:inherit;text-decoration:underline;padding:0;
        ">Hapus semua sekarang</button>
      </div>
    </div>`
      : ""}
  `;

  const page = baseLayout({
    title: `Inbox: ${inboxName}`,
    inboxName,
    body,
  });

  return page.replace(
    "</body>",
    `<script>
var INBOX = '${escapeHtml(inboxName)}';
var CURRENT_TOTAL = ${totalEmails};
var pollInterval = null;
var eventSource = null;
var searchTimer = null;

function refreshInbox() {
  var btn = document.getElementById('refresh-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;animation:spin 0.6s linear infinite;">🔄</span>';
  }
  var q = document.getElementById('search-input');
  var qval = q ? q.value.trim() : '';
  var target = '/' + encodeURIComponent(INBOX) + (qval ? '?q=' + encodeURIComponent(qval) : '');
  window.location.href = target;
}

function handleSearch(val) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(function() {
    var q = val.trim();
    var target = '/' + encodeURIComponent(INBOX) + (q ? '?q=' + encodeURIComponent(q) : '');
    window.location.href = target;
  }, 600);
}

function deleteAll() {
  var count = document.querySelectorAll('#email-list [id^="email-row-"]').length;
  confirmDelete('Hapus semua email di inbox ini?', function() {
    fetch('/api/inbox/' + INBOX, { method: 'DELETE' })
      .then(function(r) {
        if (r.ok) {
          document.getElementById('email-list').innerHTML = '<div style="text-align:center;padding:4rem 2rem;color:var(--subtext)"><div style="font-size:3rem;margin-bottom:1rem">📭</div><p>Inbox kosong</p></div>';
          showToast('Semua email dihapus', 'success');
          CURRENT_TOTAL = 0;
        } else {
          showToast('Gagal menghapus email', 'error');
        }
      })
      .catch(function() { showToast('Gagal menghapus email', 'error'); });
  });
}

function deleteSingleEmail(emailId) {
  confirmDelete('Hapus email ini?', function() {
    fetch('/api/inbox/' + INBOX + '/' + emailId, { method: 'DELETE' })
      .then(function(r) {
        if (r.ok) {
          var row = document.getElementById('email-row-' + emailId);
          if (row) {
            row.style.opacity = '0';
            row.style.transform = 'translateX(-8px)';
            row.style.transition = 'opacity 0.3s, transform 0.3s, max-height 0.4s 0.1s';
            row.style.maxHeight = row.offsetHeight + 'px';
            setTimeout(function() {
              row.style.maxHeight = '0';
              row.style.overflow = 'hidden';
              row.style.marginBottom = '0';
              row.style.padding = '0';
            }, 100);
            setTimeout(function() { row.remove(); }, 500);
          }
          showToast('Email dihapus', 'success');
          CURRENT_TOTAL = Math.max(0, CURRENT_TOTAL - 1);
        } else {
          showToast('Gagal menghapus', 'error');
        }
      })
      .catch(function() { showToast('Gagal menghapus', 'error'); });
  });
}

function setSseStatus(type, text) {
  var dot = document.getElementById('sse-dot');
  var txt = document.getElementById('sse-text');
  if (!dot || !txt) return;
  var icons = { connected: '🟢', polling: '🟡', error: '🔴', new: '📬', disconnected: '⚪' };
  dot.textContent = icons[type] || '⏳';
  txt.textContent = text;
}

function refreshEmailList() {
  fetch('/api/inbox/' + encodeURIComponent(INBOX))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.emails) return;
      CURRENT_TOTAL = data.total || 0;
      var list = document.getElementById('email-list');
      if (!list) return;
      if (data.emails.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:4rem 2rem;color:var(--subtext)"><div style="font-size:3rem;margin-bottom:1rem">📭</div><p>Inbox kosong</p></div>';
        return;
      }
      // Tambahkan email baru ke atas list (yang belum ada di DOM)
      data.emails.forEach(function(email) {
        if (!document.getElementById('email-row-' + email.id)) {
          var tmp = document.createElement('div');
          tmp.innerHTML = buildEmailRowHtml(email);
          var newRow = tmp.firstChild;
          newRow.style.opacity = '0';
          newRow.style.transform = 'translateY(-8px)';
          newRow.style.transition = 'opacity 0.3s, transform 0.3s';
          list.prepend(newRow);
          setTimeout(function() {
            newRow.style.opacity = '1';
            newRow.style.transform = 'translateY(0)';
          }, 50);
        }
      });
      // Update badge unread
      var unreadCount = data.emails.filter(function(e) { return !e.read; }).length;
      var badge = document.getElementById('unread-badge');
      if (badge) {
        badge.textContent = unreadCount > 0 ? unreadCount + ' baru' : '';
        badge.style.display = unreadCount > 0 ? '' : 'none';
      }
    })
    .catch(function() {});
}

function buildEmailRowHtml(email) {
  var isUnread = !email.read;
  var hasAtt = email.attachmentCount > 0;
  var border = isUnread ? 'var(--accent)' : 'var(--surface1)';
  return '<div id="email-row-' + email.id + '" style="background:var(--surface);border:1px solid ' + border + ';border-left:3px solid ' + border + ';border-radius:var(--radius-md);margin-bottom:0.5rem;overflow:hidden;">' +
    '<a href="/' + encodeURIComponent(INBOX) + '/' + encodeURIComponent(email.id) + '" style="display:block;padding:1rem 1.25rem;text-decoration:none;color:inherit;">' +
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">' +
    '<div style="flex:1;min-width:0;">' +
    (isUnread ? '<span class="badge badge-unread" style="font-size:0.65rem;">BARU</span> ' : '') +
    '<span style="font-weight:' + (isUnread?'700':'500') + ';font-size:0.95rem;display:block;">' + escHtml(email.subject||'(Tanpa Judul)') + '</span>' +
    '<div style="color:var(--subtext);font-size:0.8rem;">' + escHtml(email.from) + '</div>' +
    '</div>' +
    (hasAtt ? '<span class="badge badge-att">📎 ' + email.attachmentCount + '</span>' : '') +
    '</div></a>' +
    '<div style="border-top:1px solid var(--surface1);padding:0.4rem 1.25rem;display:flex;justify-content:flex-end;">' +
    '<button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();deleteSingleEmail('' + email.id + '')" style="color:var(--red);font-size:0.75rem;">🗑️ Hapus</button>' +
    '</div></div>';
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function startPolling() {
  setSseStatus('polling', '🟡 Polling mode — cek email baru setiap 20 detik');
  pollInterval = setInterval(function() {
    fetch('/api/stats/' + encodeURIComponent(INBOX))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.total > CURRENT_TOTAL) {
          setSseStatus('new', '📬 Email baru masuk! Klik Refresh untuk melihat.');
          showToast('Ada email baru! Klik Refresh untuk melihat.', 'success');
        }
      })
      .catch(function() {});
  }, 20000);
}

document.addEventListener('DOMContentLoaded', function() {
  if (typeof EventSource !== 'undefined') {
    try {
      eventSource = new EventSource('/events/' + encodeURIComponent(INBOX));
      eventSource.onopen = function() {
        setSseStatus('connected', '🟢 Terhubung — update real-time aktif');
      };
      // Email baru masuk — tampilkan notifikasi + auto-refresh list
      eventSource.addEventListener('new-email', function(e) {
        setSseStatus('new', '📬 Email baru masuk!');
        showToast('Email baru dari ' + (JSON.parse(e.data||'{}').from||'seseorang') + '!', 'success');
        // Auto-refresh email list setelah jeda singkat
        setTimeout(function() { refreshEmailList(); }, 800);
      });
      // Email dihapus dari sesi lain
      eventSource.addEventListener('email-deleted', function(e) {
        try {
          var d = JSON.parse(e.data || '{}');
          if (d.id) {
            var row = document.getElementById('email-row-' + d.id);
            if (row) {
              row.style.opacity = '0';
              row.style.transition = 'opacity 0.3s';
              setTimeout(function() { row.remove(); }, 350);
              CURRENT_TOTAL = Math.max(0, CURRENT_TOTAL - 1);
            }
          }
        } catch(ex) {}
      });
      eventSource.onerror = function() {
        eventSource.close();
        startPolling();
      };
      // Timeout jika SSE tidak konek dalam 5 detik
      setTimeout(function() {
        if (eventSource.readyState !== 1) {
          eventSource.close();
          startPolling();
        }
      }, 5000);
    } catch(e) {
      startPolling();
    }
  } else {
    startPolling();
  }

  // Search input keyboard shortcut
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      var inp = document.getElementById('search-input');
      if (inp) { inp.focus(); inp.select(); }
    }
  });
});

// Keyboard: Enter in search box
document.addEventListener('DOMContentLoaded', function() {
  var si = document.getElementById('search-input');
  if (si) {
    si.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        clearTimeout(searchTimer);
        var q = si.value.trim();
        window.location.href = '/' + encodeURIComponent(INBOX) + (q ? '?q=' + encodeURIComponent(q) : '');
      }
      if (e.key === 'Escape') {
        si.value = '';
        window.location.href = '/' + encodeURIComponent(INBOX);
      }
    });
  }
});
</script>
</body>`
  );
}

function renderEmailRow(inboxName, email) {
  const ago = timeAgo(email.receivedAt);
  const hasAtt = email.attachments && email.attachments.length > 0;
  const isUnread = !email.read;
  const expiringSoon = email.expiresAt && isExpiringSoon(email.expiresAt);
  const expiryLabel = email.expiresAt ? formatExpiry(email.expiresAt) : "";

  return `
  <div id="email-row-${escapeHtml(email.id)}" style="
    background:var(--surface);
    border:1px solid ${isUnread ? "var(--accent)" : "var(--surface1)"};
    border-left:3px solid ${isUnread ? "var(--accent)" : expiringSoon ? "var(--yellow)" : "var(--surface1)"};
    border-radius:var(--radius-md);
    margin-bottom:0.5rem;
    transition:border-color 150ms ease, box-shadow 150ms ease, opacity 300ms, transform 300ms;
    overflow:hidden;
  " onmouseover="this.style.borderColor='var(--accent)';this.style.boxShadow='var(--shadow)'"
     onmouseout="this.style.borderColor='${isUnread ? "var(--accent)" : "var(--surface1)"}';this.style.boxShadow='none'">
    <a href="/${encodeURIComponent(inboxName)}/${encodeURIComponent(email.id)}"
       style="display:block;padding:1rem 1.25rem;text-decoration:none;color:inherit;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;flex-wrap:wrap;">
            ${isUnread ? '<span class="badge badge-unread" style="font-size:0.65rem;">BARU</span>' : ""}
            ${expiringSoon ? `<span class="badge" style="background:color-mix(in srgb, var(--yellow) 15%, var(--surface));color:var(--yellow);font-size:0.65rem;border:1px solid var(--yellow);">⏰ SEGERA EXPIRED</span>` : ""}
            <span style="
              font-weight:${isUnread ? "700" : "500"};
              font-size:0.95rem;
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
              max-width:400px;
              color:var(--text);
            ">${escapeHtml(email.subject || "(Tanpa Judul)")}</span>
          </div>
          <div style="
            color:var(--subtext);
            font-size:0.8rem;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
          ">
            <span style="color:var(--overlay)">dari:</span>
            ${escapeHtml(email.from)}
          </div>
        </div>
        <div style="
          display:flex;flex-direction:column;align-items:flex-end;
          gap:0.4rem;flex-shrink:0;
        ">
          <span style="font-size:0.75rem;color:var(--overlay);">${escapeHtml(ago)}</span>
          <div style="display:flex;align-items:center;gap:0.4rem;">
            ${hasAtt ? `<span class="badge badge-att">📎 ${email.attachments.length}</span>` : ""}
            ${expiringSoon ? `<span style="font-size:0.7rem;color:var(--yellow);">${escapeHtml(expiryLabel)}</span>` : ""}
          </div>
        </div>
      </div>
    </a>
    <div style="
      border-top:1px solid var(--surface1);
      padding:0.4rem 1.25rem;
      display:flex;
      justify-content:flex-end;
    ">
      <button
        class="btn btn-sm btn-ghost"
        onclick="event.stopPropagation();deleteSingleEmail('${escapeHtml(email.id)}')"
        style="color:var(--red);font-size:0.75rem;"
      >🗑️ Hapus</button>
    </div>
  </div>`;
}
