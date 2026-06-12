// src/pages/email-detail.js — Email detail view: body + tabs + attachments
// Fase: multi-domain support

import { baseLayout, escapeHtml } from "../theme.js";
import { formatDate, formatBytes, timeAgo, formatExpiry, isExpiringSoon } from "../utils.js";

export function renderEmailDetailPage(inboxName, email, { domain = "" } = {}) {
  const currentDomain = domain || "bluehat358.biz.id";
  const emailAddr = `${inboxName}@${currentDomain}`;
  const hasHtml = !!email.htmlBody;
  const hasText = !!email.body;
  const hasAtt = email.attachments && email.attachments.length > 0;
  const attCount = email.attachments ? email.attachments.length : 0;

  const attachmentsHtml = hasAtt
    ? email.attachments.map(renderAttachmentRow).join("")
    : "";

  // HTML email sandbox — prevent XSS
  const htmlBodyEncoded = hasHtml
    ? `data:text/html;charset=utf-8,${encodeURIComponent(email.htmlBody)}`
    : "";

  const body = `
    <!-- Breadcrumb -->
    <div style="
      display:flex;align-items:center;gap:0.5rem;
      font-size:0.8rem;color:var(--subtext);
      margin-bottom:1.5rem;flex-wrap:wrap;
    ">
      <a href="/">Beranda</a>
      <span style="color:var(--overlay)">›</span>
      <a href="/${encodeURIComponent(inboxName)}?domain=${encodeURIComponent(currentDomain)}">${escapeHtml(emailAddr)}</a>
      <span style="color:var(--overlay)">›</span>
      <span style="color:var(--text)">Email</span>
    </div>

    <!-- Email card -->
    <div style="
      background:var(--surface);
      border:1px solid var(--surface1);
      border-radius:var(--radius-lg);
      box-shadow:var(--shadow-lg);
      overflow:hidden;
    ">
      <!-- Email header -->
      <div style="padding:1.5rem;border-bottom:1px solid var(--surface1);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
          <h1 style="font-size:1.3rem;line-height:1.35;flex:1;">${escapeHtml(email.subject)}</h1>
          <div style="display:flex;gap:0.5rem;flex-shrink:0;">
            <a href="/${encodeURIComponent(inboxName)}?domain=${encodeURIComponent(currentDomain)}" class="btn btn-sm btn-secondary">
              ← Kembali
            </a>
            <button class="btn btn-sm btn-danger" onclick="deleteThisEmail()">🗑️ Hapus</button>
          </div>
        </div>

        <!-- Metadata grid -->
        <div style="
          display:grid;
          grid-template-columns:auto 1fr;
          gap:0.4rem 1rem;
          font-size:0.85rem;
          align-items:center;
        ">
          ${metaRow("Dari", escapeHtml(email.from))}
          ${metaRow("Ke", escapeHtml(email.to))}
          ${metaRow("Diterima", `${formatDate(email.date)} (${timeAgo(email.receivedAt)})`)}
          ${metaRow("Ukuran", formatBytes(email.sizeBytes || 0))}
          ${email.expiresAt ? metaRow("Kedaluwarsa", `<span style="color:${isExpiringSoon(email.expiresAt) ? "var(--yellow)" : "var(--subtext)"}">${formatExpiry(email.expiresAt)}</span>`) : ""}
          ${hasAtt ? metaRow("Lampiran", `${attCount} file`) : ""}
        </div>

        <!-- Copy email address -->
        <div style="margin-top:1rem;">
          <button
            class="btn btn-sm btn-secondary"
            onclick="copyToClipboard('${escapeHtml(emailAddr)}', 'Alamat email')"
          >📋 Salin Alamat Email</button>
        </div>
      </div>

      <!-- Tabs -->
      <div style="
        display:flex;
        border-bottom:1px solid var(--surface1);
        background:var(--mantle);
        overflow-x:auto;
      ">
        ${hasHtml ? tabBtn("tab-html", "🌐 HTML", true) : ""}
        ${hasText ? tabBtn("tab-text", "📄 Plain Text", !hasHtml) : ""}
        ${hasAtt ? tabBtn("tab-att", `📎 Lampiran (${attCount})`, !hasHtml && !hasText) : ""}
        ${!hasHtml && !hasText ? tabBtn("tab-empty", "📭 Kosong", true) : ""}
      </div>

      <!-- Tab panels -->
      ${
        hasHtml
          ? `<div id="panel-tab-html" class="tab-panel">
          <div class="alert alert-warning" style="border-radius:0;border-left:none;border-right:none;border-top:none;">
            ⚠️ Konten HTML ditampilkan dalam sandbox yang aman. Script dalam email diblokir.
          </div>
          <iframe
            id="html-frame"
            sandbox="allow-same-origin"
            style="
              width:100%;
              min-height:400px;
              border:none;
              display:block;
              background:white;
            "
            srcdoc=""
          ></iframe>
        </div>`
          : ""
      }

      ${
        hasText
          ? `<div id="panel-tab-text" class="tab-panel" style="${hasHtml ? "display:none" : ""}">
          <pre style="
            padding:1.5rem;
            white-space:pre-wrap;
            word-break:break-word;
            font-size:0.875rem;
            line-height:1.7;
            color:var(--text);
            max-height:600px;
            overflow-y:auto;
          ">${escapeHtml(email.body)}</pre>
        </div>`
          : ""
      }

      ${
        hasAtt
          ? `<div id="panel-tab-att" class="tab-panel" style="${hasHtml || hasText ? "display:none" : ""}">
          <div style="padding:1.25rem;display:flex;flex-direction:column;gap:0.5rem;">
            ${attachmentsHtml}
          </div>
        </div>`
          : ""
      }

      ${
        !hasHtml && !hasText
          ? `<div id="panel-tab-empty" class="tab-panel">
          <div style="text-align:center;padding:3rem;color:var(--subtext);">
            <p>Email ini tidak memiliki konten teks.</p>
          </div>
        </div>`
          : ""
      }
    </div>

    <!-- Attachment section (always visible if has attachments) -->
    ${
      hasAtt
        ? `<div style="margin-top:1.5rem;">
      <h2 style="font-size:1rem;margin-bottom:0.85rem;color:var(--subtext);">Lampiran (${attCount})</h2>
      <div style="display:flex;flex-direction:column;gap:0.5rem;">
        ${attachmentsHtml}
      </div>
    </div>`
        : ""
    }
  `;

  const head = `
  <style>
    .tab-btn {
      padding: 0.75rem 1.25rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--subtext);
      cursor: pointer;
      white-space: nowrap;
      transition: var(--trans);
    }
    .tab-btn:hover {
      color: var(--text);
      background: rgba(203,166,247,0.05);
    }
    .tab-btn.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
    .tab-panel { display: block; }
    .att-row {
      background: var(--mantle);
      border: 1px solid var(--surface1);
      border-radius: var(--radius-md);
      padding: 0.85rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
  </style>`;

  const page = baseLayout({
    title: `${email.subject} — ${inboxName}`,
    inboxName,
    head,
    body,
    brandDomain: currentDomain,
  });

  const htmlBodyEscaped = hasHtml
    ? JSON.stringify(email.htmlBody)
    : '""';

  return page.replace(
    "</body>",
    `<script>
var INBOX = '${escapeHtml(inboxName)}';
var EMAIL_ID = '${escapeHtml(email.id)}';
var DOMAIN = '${escapeHtml(currentDomain)}';

// Inject HTML email into sandbox iframe
var htmlBody = ${htmlBodyEscaped};
if (htmlBody) {
  var frame = document.getElementById('html-frame');
  if (frame) {
    frame.srcdoc = htmlBody;
    // Auto-resize iframe
    frame.onload = function() {
      try {
        var h = frame.contentDocument.documentElement.scrollHeight;
        frame.style.height = Math.min(Math.max(h + 32, 200), 800) + 'px';
      } catch(e) {}
    };
  }
}

// Tab switching
window.switchTab = function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.style.display = 'none'; });
  document.getElementById('btn-' + id).classList.add('active');
  document.getElementById('panel-' + id).style.display = 'block';
};

// Delete helper
window.deleteThisEmail = function deleteThisEmail() {
  confirmDelete('Hapus email ini?', function() {
    fetch('/api/inbox/' + INBOX + '/' + EMAIL_ID, { method: 'DELETE' })
      .then(function(r) {
        if (r.ok) {
          showToast('Email dihapus', 'success');
          setTimeout(function() {
            window.location.href = '/' + INBOX + '?domain=' + encodeURIComponent(DOMAIN);
          }, 800);
        } else {
          showToast('Gagal menghapus', 'error');
        }
      })
      .catch(function() { showToast('Gagal menghapus', 'error'); });
  });
};
</script>
</body>`
  );
}

function metaRow(label, value) {
  return `
    <span style="color:var(--overlay);white-space:nowrap;">${escapeHtml(label)}:</span>
    <span style="color:var(--text);word-break:break-all;">${value}</span>
  `;
}

function tabBtn(id, label, active) {
  return `<button
    id="btn-${escapeHtml(id)}"
    class="tab-btn ${active ? "active" : ""}"
    onclick="switchTab('${escapeHtml(id)}')"
  >${label}</button>`;
}

function renderAttachmentRow(att) {
  const icon = getFileIcon(att.contentType);
  const sizeStr = formatBytes(att.size);

  if (att.skipped) {
    return `<div class="att-row" style="opacity:0.6;">
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span style="font-size:1.5rem;">${icon}</span>
        <div>
          <div style="font-weight:600;font-size:0.9rem;">${escapeHtml(att.filename)}</div>
          <div style="font-size:0.75rem;color:var(--subtext);">${sizeStr} · ${escapeHtml(att.contentType)}</div>
        </div>
      </div>
      <span class="badge" style="background:var(--surface1);color:var(--red);">
        ⚠️ Terlalu besar (maks 10 MB)
      </span>
    </div>`;
  }

  return `<div class="att-row">
    <div style="display:flex;align-items:center;gap:0.75rem;">
      <span style="font-size:1.5rem;">${icon}</span>
      <div>
        <div style="font-weight:600;font-size:0.9rem;">${escapeHtml(att.filename)}</div>
        <div style="font-size:0.75rem;color:var(--subtext);">${sizeStr} · ${escapeHtml(att.contentType)}</div>
      </div>
    </div>
    <a
      href="/api/attachments/${encodeURIComponent(att.id)}"
      class="btn btn-sm btn-primary"
      download="${escapeHtml(att.filename)}"
    >⬇️ Download</a>
  </div>`;
}

function getFileIcon(contentType) {
  if (!contentType) return "📄";
  if (contentType.startsWith("image/")) return "🖼️";
  if (contentType.startsWith("video/")) return "🎬";
  if (contentType.startsWith("audio/")) return "🎵";
  if (contentType.includes("pdf")) return "📑";
  if (contentType.includes("zip") || contentType.includes("compress") || contentType.includes("tar")) return "🗜️";
  if (contentType.includes("word") || contentType.includes("document")) return "📝";
  if (contentType.includes("sheet") || contentType.includes("excel")) return "📊";
  if (contentType.includes("text/")) return "📄";
  if (contentType.includes("json") || contentType.includes("javascript")) return "🟨";
  return "📎";
}
