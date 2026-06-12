// src/pages/inbox.js — Inbox page: list emails, search, copy address, delete all
// Fase 2: search filter, expiry indicator, improved UX
// Fase: multi-domain support

import { baseLayout, escapeHtml } from "../theme.js";
import { timeAgo, formatBytes, formatExpiry, isExpiringSoon } from "../utils.js";

export function renderInboxPage(inboxName, emails, stats, searchQuery = "", { domains = [], domain = "" } = {}) {
  const currentDomain = domain || domains[0] || "bluehat358.biz.id";
  // inboxName mungkin sudah "local@domain" — ambil hanya local part untuk display
  const localPart = inboxName.includes("@") ? inboxName.split("@")[0] : inboxName;
  const emailAddr = `${localPart}@${currentDomain}`;
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
    ? `<a href="/${encodeURIComponent(inboxName)}?domain=${encodeURIComponent(currentDomain)}" style="color:var(--accent)">Hapus filter pencarian</a>`
    : `Kirim email ke <code style="color:var(--accent)">${escapeHtml(emailAddr)}</code> untuk mulai.`}
    </p>
    </div>`
    : emails.map((email) => renderEmailRow(inboxName, email, currentDomain)).join("");

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
    <span style="color:var(--accent)">${escapeHtml(localPart)}</span>
    <span style="color:var(--subtext);font-weight:400;">@${escapeHtml(currentDomain)}</span>
    </h1>
    <span id="unread-badge" class="badge badge-unread" style="${unread > 0 ? "" : "display:none;"}">
      ${unread > 0 ? `${unread} baru` : ""}
    </span>
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
        <button class="btn btn-sm btn-primary" id="mark-all-read-btn" onclick="markAllRead()" ${unread > 0 ? "" : 'style="display:none;"'}>
        ✅ Tandai Semua Dibaca
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
            ? `<a href="/${encodeURIComponent(inboxName)}?domain=${encodeURIComponent(currentDomain)}" style="
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
  ? `<div id="search-summary" style="
  font-size:0.8rem;
  color:var(--subtext);
  margin-bottom:0.75rem;
  padding:0 0.25rem;
  ">
  ${emails.length > 0
    ? `Menampilkan <strong style="color:var(--text)">${emails.length}</strong> hasil untuk "<span style="color:var(--accent)">${escapeHtml(searchQuery)}</span>"`
    : "Tidak ada hasil"}
    </div>`
    : `<div id="search-summary" style="display:none;"></div>`}

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
                    title: `Inbox: ${localPart}`,
                    inboxName,
                    body,
                    brandDomain: currentDomain,
                  });

                  return page.replace(
                    "</body>",
                    `<script>
                    var INBOX = '${escapeHtml(inboxName)}';
                    var DOMAIN = '${escapeHtml(currentDomain)}';
                    var CURRENT_TOTAL = ${totalEmails};
                    var pollInterval = null;
                    var eventSource = null;
                    var searchTimer = null;
                    window.deleteSingleEmail = deleteSingleEmail;
                    window.deleteAll = deleteAll;
                    window.markAllRead = markAllRead;
                    window.confirmDelete = confirmDelete;

                    // Helper to build URL with domain param
                    function withDomain(path) {
                      return path + (path.indexOf('?') === -1 ? '?' : '&') + 'domain=' + encodeURIComponent(DOMAIN);
                    }

                    // FIX: expose ke window agar onclick="refreshInbox()" bisa menemukan fungsi
                    // bahkan jika script di-parse setelah HTML body
                    window.refreshInbox = function refreshInbox() {
                      var btn = document.getElementById('refresh-btn');
                      if (btn && !btn.disabled) {
                        btn.dataset.originalHtml = btn.innerHTML;
                        btn.disabled = true;
                        btn.innerHTML = '<span style="display:inline-block;animation:spin 0.6s linear infinite;">🔄</span>';
                      }
                      return refreshEmailList().finally(function() {
                        if (btn) {
                          btn.disabled = false;
                          btn.innerHTML = btn.dataset.originalHtml || '🔄 Refresh';
                          delete btn.dataset.originalHtml;
                        }
                      });
                    };

                    window.handleSearch = function handleSearch(val) {
                      clearTimeout(searchTimer);
                      searchTimer = setTimeout(function() {
                        var q = val.trim();
                        var target = '/' + encodeURIComponent(INBOX) + (q ? '?q=' + encodeURIComponent(q) + '&domain=' + encodeURIComponent(DOMAIN) : '?domain=' + encodeURIComponent(DOMAIN));
                        window.location.href = target;
                      }, 600);
                    };

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

                    function markAllRead() {
                      var btn = document.getElementById('mark-all-read-btn');
                      if (btn) {
                        btn.disabled = true;
                        btn.textContent = '⏳ Menandai...';
                      }

                      fetch('/api/inbox/' + encodeURIComponent(INBOX) + '/mark-read', { method: 'POST' })
                      .then(function(r) {
                        if (!r.ok) throw new Error('HTTP ' + r.status);
                        return r.json();
                      })
                      .then(function(data) {
                        // Update unread badge
                        var badge = document.getElementById('unread-badge');
                        if (badge) {
                          badge.textContent = '';
                          badge.style.display = 'none';
                        }

                        // Remove all "BARU" badges and unread styling from email rows
                        var rows = document.querySelectorAll('#email-list [id^="email-row-"]');
                        rows.forEach(function(row) {
                          // Remove BARU badge
                          var badges = row.querySelectorAll('.badge-unread');
                          badges.forEach(function(b) { b.remove(); });
                          // Reset border to default
                          row.style.borderColor = 'var(--surface1)';
                          row.style.borderLeftColor = 'var(--surface1)';
                          // Reset font weight on subject
                          var subjectSpan = row.querySelector('span[style*="font-weight"]');
                          if (subjectSpan) {
                            subjectSpan.style.fontWeight = '500';
                          }
                        });

                        // Hide the mark-all-read button itself
                        if (btn) {
                          btn.style.display = 'none';
                        }

                        showToast(data.marked + ' email ditandai sudah dibaca', 'success');
                      })
                      .catch(function(err) {
                        console.error('markAllRead error', err);
                        showToast('Gagal menandai email', 'error');
                        if (btn) {
                          btn.disabled = false;
                          btn.textContent = '✅ Tandai Semua Dibaca';
                        }
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

                    function getSearchQuery() {
                      var inp = document.getElementById('search-input');
                      return inp ? inp.value.trim() : '';
                    }

                    function updateSearchSummary(query, count) {
                      var summary = document.getElementById('search-summary');
                      if (!summary) return;
                      if (!query) {
                        summary.style.display = 'none';
                        summary.innerHTML = '';
                      } else {
                        summary.style.display = '';
                        if (count > 0) {
                          summary.innerHTML = 'Menampilkan <strong style="color:var(--text)">' + count + '</strong> hasil untuk "<span style="color:var(--accent)">' + escHtml(query) + '</span>"';
                        } else {
                          summary.innerHTML = 'Tidak ada hasil';
                        }
                      }
                    }

                    function updateUnreadBadge(emails) {
                      var unreadCount = (emails || []).filter(function(e) { return !e.read; }).length;
                      var badge = document.getElementById('unread-badge');
                      if (badge) {
                        badge.textContent = unreadCount > 0 ? unreadCount + ' baru' : '';
                        badge.style.display = unreadCount > 0 ? '' : 'none';
                      }
                      var markBtn = document.getElementById('mark-all-read-btn');
                      if (markBtn) {
                        markBtn.style.display = unreadCount > 0 ? '' : 'none';
                      }
                    }

                    function renderEmptyList() {
                      return '<div style="text-align:center;padding:4rem 2rem;color:var(--subtext)"><div style="font-size:3rem;margin-bottom:1rem">📭</div><p>Inbox kosong</p></div>';
                    }

                    function refreshEmailList() {
                      var q = getSearchQuery();
                      var target = '/api/inbox/' + encodeURIComponent(INBOX) + (q ? '?q=' + encodeURIComponent(q) : '');
                      return fetch(target)
                      .then(function(r) {
                        if (!r.ok) throw new Error('HTTP ' + r.status);
                        return r.json();
                      })
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
                        if (eventSource && eventSource.readyState === 1) {
                          setSseStatus('connected', '🟢 Terhubung — update real-time aktif');
                        } else {
                          setSseStatus('polling', '🟡 Polling mode — cek email baru setiap 20 detik');
                        }
                      })
                      .catch(function(err) {
                        console.error('refreshEmailList error', err);
                        showToast('Gagal memuat email', 'error');
                      });
                    }

                    function buildEmailRowHtml(email) {
                      var isUnread = !email.read;
                      var hasAtt = email.attachmentCount > 0;
                      var border = isUnread ? 'var(--accent)' : 'var(--surface1)';
                      var emailIdEscaped = encodeURIComponent(email.id);
                      var inboxEnc = encodeURIComponent(INBOX);
                      var emailEnc = encodeURIComponent(email.id);
                      return '<div id="email-row-' + email.id + '" style="background:var(--surface);border:1px solid ' + border + ';border-left:3px solid ' + border + ';border-radius:var(--radius-md);margin-bottom:0.5rem;overflow:hidden;">' +
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
                          '<button class="btn btn-sm btn-ghost" data-action="delete" data-id="' + emailIdEscaped + '" style="color:var(--red);font-size:0.75rem;">🗑️ Hapus</button>' +
                        '</div>' +
                      '</div>';
                    }

                    function escHtml(s) {
                      if (!s) return '';
                      return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
                    }

                    function startPolling() {
                      setSseStatus('polling', '🟡 Polling mode — cek email baru setiap 20 detik');
                      pollInterval = setInterval(function() {
                        fetch('/api/stats/' + encodeURIComponent(INBOX))
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                          if (data.total > CURRENT_TOTAL) {
                            setSseStatus('new', '📬 Email baru masuk!');
                            showToast('Ada email baru!', 'success');
                            setTimeout(function() { refreshEmailList(); }, 400);
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
                          eventSource.addEventListener('new-email', function(e) {
                            setSseStatus('new', '📬 Email baru masuk!');
                            showToast('Email baru dari ' + (JSON.parse(e.data||'{}').from||'seseorang') + '!', 'success');
                            setTimeout(function() { refreshEmailList(); }, 800);
                          });
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

                      document.addEventListener('keydown', function(e) {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                          e.preventDefault();
                          var inp = document.getElementById('search-input');
                          if (inp) { inp.focus(); inp.select(); }
                        }
                      });
                    });

                    document.addEventListener('click', function(e) {
                      var btn = e.target.closest('[data-action="delete"]');
                      if (!btn) return;
                      e.stopPropagation();
                      var id = decodeURIComponent(btn.dataset.id);
                      deleteSingleEmail(id);
                    });

                    document.addEventListener('DOMContentLoaded', function() {
                      var si = document.getElementById('search-input');
                      if (si) {
                        si.addEventListener('keydown', function(e) {
                          if (e.key === 'Enter') {
                            clearTimeout(searchTimer);
                            var q = si.value.trim();
                            window.location.href = '/' + encodeURIComponent(INBOX) + (q ? '?q=' + encodeURIComponent(q) + '&domain=' + encodeURIComponent(DOMAIN) : '?domain=' + encodeURIComponent(DOMAIN));
                          }
                          if (e.key === 'Escape') {
                            si.value = '';
                            window.location.href = '/' + encodeURIComponent(INBOX) + '?domain=' + encodeURIComponent(DOMAIN);
                          }
                        });
                      }
                    });
                    </script>
                    </body>`
                  );
}

function renderEmailRow(inboxName, email, currentDomain) {
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
  <a href="/${encodeURIComponent(inboxName)}/${encodeURIComponent(email.id)}?domain=${encodeURIComponent(currentDomain)}"
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
  data-action="delete"
  data-id="${encodeURIComponent(email.id)}"
  style="color:var(--red);font-size:0.75rem;"
  >🗑️ Hapus</button>
  </div>
  </div>`;
}