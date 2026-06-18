// src/pages/inbox.js — Inbox page dengan countdown polling

import { baseLayout, escapeHtml } from "../theme.js";
import { timeAgo, formatBytes, formatExpiry, isExpiringSoon } from "../utils.js";
import { POLL_INTERVAL_SEC, INBOX_QUOTA_DISPLAY, INBOX_WARN_THRESHOLD, MAX_EMAILS_PER_INBOX, EMAIL_TTL_DAYS } from "../config.js";

export function renderInboxPage(inboxName, emails, stats, searchQuery = "", { domains = [], domain = "", nonce = "" } = {}) {
  const currentDomain = domain || domains[0] || "bluehat358.pp.ua";
  const localPart     = inboxName.includes("@") ? inboxName.split("@")[0] : inboxName;
  const emailAddr     = `${localPart}@${currentDomain}`;
  const unread        = emails.filter((e) => !e.read).length;
  const totalEmails   = stats.total || emails.length;

  const emailListHtml = emails.length === 0
    ? `<div style="text-align:center;padding:4rem 2rem;color:var(--subtext);">
        <div style="font-size:3rem;margin-bottom:1rem;">${searchQuery ? "🔍" : "📭"}</div>
        <p style="font-size:1.05rem;font-weight:600;margin-bottom:0.5rem;">
          ${searchQuery ? `Tidak ada email yang cocok dengan "${escapeHtml(searchQuery)}"` : "Inbox kosong"}
        </p>
        <p style="font-size:0.875rem;">
          ${searchQuery
            ? `<a href="/${encodeURIComponent(localPart)}?domain=${encodeURIComponent(currentDomain)}" style="color:var(--accent)">Hapus filter pencarian</a>`
            : `Kirim email ke <code style="color:var(--accent)">${escapeHtml(emailAddr)}</code> untuk mulai.`}
        </p>
      </div>`
    : emails.map((email) => renderEmailRow(inboxName, email, currentDomain)).join("");

  const body = `
    <!-- Inbox header -->
    <div style="background:var(--surface);border:1px solid var(--surface1);border-radius:var(--radius-lg);padding:1.5rem;margin-bottom:1rem;box-shadow:var(--shadow);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
        <div>
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;flex-wrap:wrap;">
            <h1 style="font-size:1.5rem;">
              <span style="color:var(--accent)">${escapeHtml(localPart)}</span>
              <span style="color:var(--subtext);font-weight:400;">@${escapeHtml(currentDomain)}</span>
            </h1>
            <span id="unread-badge" class="badge badge-unread" style="${unread > 0 ? "" : "display:none;"}">
              ${unread > 0 ? `${unread} baru` : ""}
            </span>
          </div>

          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <code style="background:var(--mantle);border:1px solid var(--surface1);padding:0.35rem 0.85rem;border-radius:var(--radius-md);font-size:0.9rem;color:var(--text);display:inline-block;">${escapeHtml(emailAddr)}</code>
            <button class="btn btn-sm btn-secondary" id="copy-email-btn" data-copy="${escapeHtml(emailAddr)}">📋 Salin</button>
          </div>

          <div style="margin-top:0.75rem;display:flex;gap:1.25rem;flex-wrap:wrap;color:var(--subtext);font-size:0.8rem;">
            <span id="email-count-display">📧 ${emails.length}${searchQuery ? ` dari ${totalEmails}` : ""} email</span>
            ${unread > 0
              ? `<span style="color:var(--accent)">● ${unread} belum dibaca</span>`
              : '<span style="color:var(--green)">✓ Semua terbaca</span>'}
            <span style="color:var(--overlay)">📦 Maks ${INBOX_QUOTA_DISPLAY} email</span>
            ${totalEmails >= INBOX_WARN_THRESHOLD ? `<span style="color:var(--yellow)">⚠️ Inbox hampir penuh</span>` : ""}
          </div>
        </div>

        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:flex-start;">
          <button class="btn btn-sm btn-secondary" id="refresh-btn">🔄 Refresh</button>
          <button class="btn btn-sm btn-primary" id="mark-all-read-btn" ${unread > 0 ? "" : 'style="display:none;"'}>✅ Tandai Semua Dibaca</button>
          ${emails.length > 0 ? `<button class="btn btn-sm btn-danger" data-action="delete-all">🗑️ Hapus Semua</button>` : ""}
        </div>
      </div>

      <!-- Countdown status bar -->
      <div id="poll-status" style="margin-top:1rem;padding:0.5rem 0.85rem;background:var(--mantle);border:1px solid var(--surface1);border-radius:var(--radius-md);font-size:0.78rem;display:flex;align-items:center;gap:0.75rem;color:var(--subtext);">
        <span id="poll-dot">🔄</span>
        <span id="poll-text">Memuat...</span>
        <div style="flex:1;height:3px;background:var(--surface1);border-radius:2px;overflow:hidden;">
          <div id="poll-bar" style="height:100%;background:var(--accent);width:100%;transition:width 1s linear;border-radius:2px;"></div>
        </div>
        <span id="poll-countdown" style="font-size:0.72rem;color:var(--overlay);min-width:2.5rem;text-align:right;"></span>
      </div>
    </div>

    <!-- Search bar -->
    <div style="background:var(--surface);border:1px solid var(--surface1);border-radius:var(--radius-md);padding:0.85rem 1rem;margin-bottom:1rem;display:flex;align-items:center;gap:0.75rem;">
      <span style="color:var(--overlay);font-size:1rem;">🔍</span>
      <input type="text" id="search-input" placeholder="Cari berdasarkan subjek atau pengirim..."
        value="${escapeHtml(searchQuery)}"
        style="flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:'JetBrains Mono',monospace;font-size:0.875rem;">
      <a id="search-clear-link" href="/${encodeURIComponent(localPart)}?domain=${encodeURIComponent(currentDomain)}"
        style="color:var(--overlay);font-size:0.8rem;text-decoration:none;white-space:nowrap;padding:0.25rem 0.6rem;background:var(--surface1);border-radius:var(--radius-sm);${searchQuery ? "" : "display:none;"}">✕ Hapus</a>
    </div>

    ${searchQuery
      ? `<div id="search-summary" style="font-size:0.8rem;color:var(--subtext);margin-bottom:0.75rem;padding:0 0.25rem;">
          ${emails.length > 0
            ? `Menampilkan <strong style="color:var(--text)">${emails.length}</strong> hasil untuk "<span style="color:var(--accent)">${escapeHtml(searchQuery)}</span>"`
            : "Tidak ada hasil"}
        </div>`
      : `<div id="search-summary" style="display:none;"></div>`}

    <!-- Email list -->
    <div id="email-list">${emailListHtml}</div>

    ${totalEmails >= INBOX_WARN_THRESHOLD
      ? `<div class="alert alert-warning" style="margin-top:1rem;">
          <span>⚠️</span>
          <div>
            <strong>Inbox hampir penuh!</strong> Sudah ${totalEmails}/${INBOX_QUOTA_DISPLAY} email.
            Email baru akan di-drop jika inbox sudah penuh.
            <button data-action="delete-all" style="background:none;border:none;color:var(--accent);cursor:pointer;font-family:inherit;font-size:inherit;text-decoration:underline;padding:0;">Hapus semua sekarang</button>
          </div>
        </div>`
      : ""}
  `;

  const head = `<style>
    /* [Fix M-1] pengganti onmouseover/onmouseout inline (CSP nonce tidak
       mengizinkan inline event handler attribute) */
    .email-row:hover { border-color: var(--accent) !important; box-shadow: var(--shadow); }
  </style>`;

  const page = baseLayout({ title: `Inbox: ${localPart}`, inboxName, head, body, brandDomain: currentDomain, emailTtlDays: EMAIL_TTL_DAYS, nonce });

  return page.replace("</body>", `<script nonce="${nonce}">
// ── Config (disuntikkan dari server) ─────────────────────────────────────
var INBOX         = '${escapeHtml(inboxName)}';
var INBOX_LOCAL   = '${escapeHtml(localPart)}';
var DOMAIN        = '${escapeHtml(currentDomain)}';
var CURRENT_TOTAL = ${totalEmails};
var POLL_INTERVAL = ${POLL_INTERVAL_SEC}; // detik — ubah di src/config.js

// ── State ─────────────────────────────────────────────────────────────────
var pollInterval  = null;
var countdownSec  = POLL_INTERVAL;
var searchTimer   = null;

// ── Expose ke window ──────────────────────────────────────────────────────
window.deleteSingleEmail = deleteSingleEmail;
window.deleteAll         = deleteAll;
window.markAllRead       = markAllRead;
window.confirmDelete     = confirmDelete;

window.refreshInbox = function() {
  var btn = document.getElementById('refresh-btn');
  if (btn && !btn.disabled) {
    btn.dataset.orig = btn.innerHTML;
    btn.disabled     = true;
    btn.innerHTML    = '<span style="display:inline-block;animation:spin 0.6s linear infinite;">🔄</span>';
  }
  // Reset countdown saat manual refresh
  countdownSec = POLL_INTERVAL;
  updateCountdownUI();
  return refreshEmailList().finally(function() {
    if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.orig || '🔄 Refresh'; }
  });
};

window.handleSearch = function(val) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(function() {
    var q    = val.trim().toLowerCase();
    var rows = document.querySelectorAll('#email-list [id^="email-row-"]');
    var vis  = 0;
    rows.forEach(function(row) {
      var match = !q || row.textContent.toLowerCase().includes(q);
      row.style.display = match ? '' : 'none';
      if (match) vis++;
    });
    updateSearchSummary(q, vis);
    var cl = document.getElementById('search-clear-link');
    if (cl) cl.style.display = q ? '' : 'none';
  }, 200);
};

// ── Countdown UI ──────────────────────────────────────────────────────────
function updateCountdownUI() {
  var bar      = document.getElementById('poll-bar');
  var countdown = document.getElementById('poll-countdown');
  var dot      = document.getElementById('poll-dot');
  var txt      = document.getElementById('poll-text');
  if (!bar || !countdown) return;
  var pct = (countdownSec / POLL_INTERVAL) * 100;
  bar.style.width = pct + '%';
  countdown.textContent = countdownSec + 'd';
  if (dot) dot.textContent = '🔄';
  if (txt) txt.textContent = 'Refresh otomatis dalam';
}

function setStatusNew() {
  var dot = document.getElementById('poll-dot');
  var txt = document.getElementById('poll-text');
  var bar = document.getElementById('poll-bar');
  if (dot) dot.textContent = '📬';
  if (txt) txt.textContent = 'Email baru masuk!';
  if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; }
}

function setStatusRefreshing() {
  var dot = document.getElementById('poll-dot');
  var txt = document.getElementById('poll-text');
  if (dot) dot.textContent = '⏳';
  if (txt) txt.textContent = 'Memperbarui...';
}

// ── Polling loop ──────────────────────────────────────────────────────────
function startPolling() {
  countdownSec = POLL_INTERVAL;
  updateCountdownUI();

  // Countdown tick setiap 1 detik
  pollInterval = setInterval(function() {
    countdownSec--;
    if (countdownSec <= 0) {
      countdownSec = POLL_INTERVAL;
      setStatusRefreshing();
      checkForNewEmails();
    } else {
      updateCountdownUI();
    }
  }, 1000);
}

function checkForNewEmails() {
  fetch('/api/stats/' + encodeURIComponent(INBOX))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.total > CURRENT_TOTAL) {
        setStatusNew();
        showToast('Ada email baru!', 'success');
        setTimeout(function() { refreshEmailList(); }, 400);
      } else {
        updateCountdownUI();
      }
    })
    .catch(function() { updateCountdownUI(); });
}

// ── Email list refresh ────────────────────────────────────────────────────
function refreshEmailList() {
  var q = getSearchQuery();
  var url = '/api/inbox/' + encodeURIComponent(INBOX) + (q ? '?q=' + encodeURIComponent(q) : '');
  return fetch(url)
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) {
      if (!data.emails) return;
      CURRENT_TOTAL = data.total || 0;
      var list = document.getElementById('email-list');
      if (list) {
        list.innerHTML = data.emails.length > 0
          ? data.emails.map(buildEmailRowHtml).join('')
          : renderEmptyList();
      }
      updateUnreadBadge(data.emails);
      updateSearchSummary(q, data.emails.length);
      updateCountdownUI();
    })
    .catch(function(err) {
      console.error('refreshEmailList error', err);
      showToast('Gagal memuat email', 'error');
    });
}

// ── Email actions ─────────────────────────────────────────────────────────
function deleteAll() {
  confirmDelete('Hapus semua email di inbox ini?', function() {
    fetch('/api/inbox/' + INBOX, { method: 'DELETE' })
      .then(function(r) {
        if (r.ok) {
          document.getElementById('email-list').innerHTML = renderEmptyList();
          showToast('Semua email dihapus', 'success');
          CURRENT_TOTAL = 0;
          var el = document.getElementById('email-count-display');
          if (el) el.textContent = '📧 0 email';
        } else { showToast('Gagal menghapus email', 'error'); }
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
            row.style.opacity   = '0';
            row.style.transform = 'translateX(-8px)';
            row.style.transition = 'opacity 0.3s, transform 0.3s, max-height 0.4s 0.1s';
            row.style.maxHeight  = row.offsetHeight + 'px';
            setTimeout(function() { row.style.maxHeight = '0'; row.style.overflow = 'hidden'; row.style.marginBottom = '0'; row.style.padding = '0'; }, 100);
            setTimeout(function() { row.remove(); }, 500);
          }
          showToast('Email dihapus', 'success');
          CURRENT_TOTAL = Math.max(0, CURRENT_TOTAL - 1);
          var el = document.getElementById('email-count-display');
          if (el) el.textContent = '📧 ' + CURRENT_TOTAL + ' email';
        } else { showToast('Gagal menghapus', 'error'); }
      })
      .catch(function() { showToast('Gagal menghapus', 'error'); });
  });
}

function markAllRead() {
  var btn = document.getElementById('mark-all-read-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Menandai...'; }
  fetch('/api/inbox/' + encodeURIComponent(INBOX) + '/mark-read', { method: 'POST' })
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) {
      var badge = document.getElementById('unread-badge');
      if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
      document.querySelectorAll('#email-list [id^="email-row-"]').forEach(function(row) {
        row.querySelectorAll('.badge-unread').forEach(function(b) { b.remove(); });
        row.style.borderColor     = 'var(--surface1)';
        row.style.borderLeftColor = 'var(--surface1)';
        var sub = row.querySelector('span[style*="font-weight"]');
        if (sub) sub.style.fontWeight = '500';
      });
      if (btn) btn.style.display = 'none';
      showToast(data.marked + ' email ditandai sudah dibaca', 'success');
    })
    .catch(function(err) {
      console.error('markAllRead error', err);
      showToast('Gagal menandai email', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✅ Tandai Semua Dibaca'; }
    });
}

// ── UI helpers ────────────────────────────────────────────────────────────
function getSearchQuery() {
  var inp = document.getElementById('search-input');
  return inp ? inp.value.trim() : '';
}

function updateSearchSummary(query, count) {
  var el = document.getElementById('search-summary');
  if (!el) return;
  if (!query) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  el.innerHTML = count > 0
    ? 'Menampilkan <strong style="color:var(--text)">' + count + '</strong> hasil untuk "<span style="color:var(--accent)">' + escHtml(query) + '</span>"'
    : 'Tidak ada hasil';
}

function updateUnreadBadge(emails) {
  var n     = (emails || []).filter(function(e) { return !e.read; }).length;
  var badge = document.getElementById('unread-badge');
  if (badge) { badge.textContent = n > 0 ? n + ' baru' : ''; badge.style.display = n > 0 ? '' : 'none'; }
  var btn = document.getElementById('mark-all-read-btn');
  if (btn) btn.style.display = n > 0 ? '' : 'none';
}

function renderEmptyList() {
  return '<div style="text-align:center;padding:4rem 2rem;color:var(--subtext)"><div style="font-size:3rem;margin-bottom:1rem">📭</div><p>Inbox kosong</p></div>';
}

function buildEmailRowHtml(email) {
  var isUnread = !email.read;
  var hasAtt   = email.attachmentCount > 0;
  var border   = isUnread ? 'var(--accent)' : 'var(--surface1)';
  var inboxEnc = encodeURIComponent(INBOX_LOCAL);
  var emailEnc = encodeURIComponent(email.id);
  return '<div id="email-row-' + email.id + '" class="email-row" style="background:var(--surface);border:1px solid ' + border + ';border-left:3px solid ' + border + ';border-radius:var(--radius-md);margin-bottom:0.5rem;overflow:hidden;">' +
    '<a href="/' + inboxEnc + '/' + emailEnc + '?domain=' + encodeURIComponent(DOMAIN) + '" style="display:block;padding:1rem 1.25rem;text-decoration:none;color:inherit;">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">' +
        '<div style="flex:1;min-width:0;">' +
          (isUnread ? '<span class="badge badge-unread" style="font-size:0.65rem;">BARU</span> ' : '') +
          '<span style="font-weight:' + (isUnread ? '700' : '500') + ';font-size:0.95rem;display:block;">' + escHtml(email.subject || '(Tanpa Judul)') + '</span>' +
          '<div style="color:var(--subtext);font-size:0.8rem;">' + escHtml(email.from) + '</div>' +
        '</div>' +
        (hasAtt ? '<span class="badge badge-att">📎 ' + email.attachmentCount + '</span>' : '') +
      '</div>' +
    '</a>' +
    '<div style="border-top:1px solid var(--surface1);padding:0.4rem 1.25rem;display:flex;justify-content:flex-end;">' +
      '<button class="btn btn-sm btn-ghost" data-action="delete" data-id="' + encodeURIComponent(email.id) + '" style="color:var(--red);font-size:0.75rem;">🗑️ Hapus</button>' +
    '</div>' +
  '</div>';
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  startPolling();

  // Keyboard shortcut: Ctrl/Cmd+K → fokus search
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      var inp = document.getElementById('search-input');
      if (inp) { inp.focus(); inp.select(); }
    }
  });

  // Search input keyboard + input
  var si = document.getElementById('search-input');
  if (si) {
    si.addEventListener('input', function() { handleSearch(si.value); });
    si.addEventListener('keydown', function(e) {
      if (e.key === 'Enter')  { clearTimeout(searchTimer); handleSearch(si.value); }
      if (e.key === 'Escape') { si.value = ''; handleSearch(''); }
    });
  }

  // [Fix M-1] Tombol-tombol ini sebelumnya pakai onclick inline — CSP
  // nonce-based tidak mengizinkannya, jadi dipasang lewat addEventListener.
  var copyBtn = document.getElementById('copy-email-btn');
  if (copyBtn) copyBtn.addEventListener('click', function() { copyToClipboard(copyBtn.dataset.copy, 'Alamat email'); });

  var refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', refreshInbox);

  var markAllBtn = document.getElementById('mark-all-read-btn');
  if (markAllBtn) markAllBtn.addEventListener('click', markAllRead);
});

// Delete button & "Hapus Semua" delegation
document.addEventListener('click', function(e) {
  var delBtn = e.target.closest('[data-action="delete"]');
  if (delBtn) {
    e.stopPropagation();
    deleteSingleEmail(decodeURIComponent(delBtn.dataset.id));
    return;
  }
  var delAllBtn = e.target.closest('[data-action="delete-all"]');
  if (delAllBtn) deleteAll();
});
</script>
</body>`);
}

function renderEmailRow(inboxName, email, currentDomain) {
  const localPart    = inboxName.includes("@") ? inboxName.split("@")[0] : inboxName;
  const ago          = timeAgo(email.receivedAt);
  const hasAtt       = email.attachments && email.attachments.length > 0;
  const isUnread     = !email.read;
  const expiringSoon = email.expiresAt && isExpiringSoon(email.expiresAt);
  const expiryLabel  = email.expiresAt ? formatExpiry(email.expiresAt) : "";

  return `
  <div id="email-row-${escapeHtml(email.id)}" class="email-row" style="
    background:var(--surface);
    border:1px solid ${isUnread ? "var(--accent)" : "var(--surface1)"};
    border-left:3px solid ${isUnread ? "var(--accent)" : expiringSoon ? "var(--yellow)" : "var(--surface1)"};
    border-radius:var(--radius-md);
    margin-bottom:0.5rem;
    transition:border-color 150ms ease, box-shadow 150ms ease, opacity 300ms, transform 300ms;
    overflow:hidden;
  ">
    <a href="/${encodeURIComponent(localPart)}/${encodeURIComponent(email.id)}?domain=${encodeURIComponent(currentDomain)}"
       style="display:block;padding:1rem 1.25rem;text-decoration:none;color:inherit;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;flex-wrap:wrap;">
            ${isUnread ? '<span class="badge badge-unread" style="font-size:0.65rem;">BARU</span>' : ""}
            ${expiringSoon ? `<span class="badge" style="background:color-mix(in srgb, var(--yellow) 15%, var(--surface));color:var(--yellow);font-size:0.65rem;border:1px solid var(--yellow);">⏰ SEGERA EXPIRED</span>` : ""}
            <span style="font-weight:${isUnread ? "700" : "500"};font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px;color:var(--text);">${escapeHtml(email.subject || "(Tanpa Judul)")}</span>
          </div>
          <div style="color:var(--subtext);font-size:0.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            <span style="color:var(--overlay)">dari:</span> ${escapeHtml(email.from)}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem;flex-shrink:0;">
          <span style="font-size:0.75rem;color:var(--overlay);">${escapeHtml(ago)}</span>
          <div style="display:flex;align-items:center;gap:0.4rem;">
            ${hasAtt ? `<span class="badge badge-att">📎 ${email.attachments.length}</span>` : ""}
            ${expiringSoon ? `<span style="font-size:0.7rem;color:var(--yellow);">${escapeHtml(expiryLabel)}</span>` : ""}
          </div>
        </div>
      </div>
    </a>
    <div style="border-top:1px solid var(--surface1);padding:0.4rem 1.25rem;display:flex;justify-content:flex-end;">
      <button class="btn btn-sm btn-ghost" data-action="delete" data-id="${encodeURIComponent(email.id)}" style="color:var(--red);font-size:0.75rem;">🗑️ Hapus</button>
    </div>
  </div>`;
}
