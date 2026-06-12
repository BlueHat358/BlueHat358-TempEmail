// src/theme.js — Catppuccin CSS variables, shared styles, and base HTML layout

export const CATPPUCCIN_CSS = `
/* ═══════════════════════════════════════════
 *   Catppuccin — Mocha (dark) + Latte (light)
 *   ═══════════════════════════════════════════ */

:root {
  /* Mocha (dark) — default */
  --bg:        #1E1E2E;
  --base:      #1E1E2E;
  --mantle:    #181825;
  --crust:     #11111B;
  --surface:   #313244;
  --surface1:  #45475A;
  --surface2:  #585B70;
  --overlay:   #6C7086;
  --text:      #CDD6F4;
  --subtext:   #BAC2DE;
  --subtext0:  #A6ADC8;
  --accent:    #CBA6F7;
  --blue:      #89B4FA;
  --green:     #A6E3A1;
  --red:       #F38BA8;
  --yellow:    #F9E2AF;
  --lavender:  #B4BEFE;
  --peach:     #FAB387;
  --maroon:    #EBA0AC;
  --pink:      #F5C2E7;
  --teal:      #94E2D5;
  --sky:       #89DCEB;
  --sapphire:  #74C7EC;
  --flamingo:  #F2CDCD;

  /* UI tokens */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow:    0 2px 12px rgba(0,0,0,0.35);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.45);
  --trans:     all 200ms ease;
}

html.light {
  /* Latte (light) */
  --bg:        #EFF1F5;
  --base:      #EFF1F5;
  --mantle:    #E6E9EF;
  --crust:     #DCE0E8;
  --surface:   #CCD0DA;
  --surface1:  #BCC0CC;
  --surface2:  #ACB0BE;
  --overlay:   #9CA0B0;
  --text:      #4C4F69;
  --subtext:   #5C5F77;
  --subtext0:  #6C6F85;
  --accent:    #8839EF;
  --blue:      #1E66F5;
  --green:     #40A02B;
  --red:       #D20F39;
  --yellow:    #DF8E1D;
  --lavender:  #7287FD;
  --peach:     #FE640B;
  --maroon:    #E64553;
  --pink:      #EA76CB;
  --teal:      #179299;
  --sky:       #04A5E5;
  --sapphire:  #209FB5;
  --flamingo:  #DD7878;
  --shadow:    0 2px 12px rgba(76,79,105,0.15);
  --shadow-lg: 0 8px 32px rgba(76,79,105,0.2);
}

/* ═══════════════════════════════
 *   Reset & Base
 *   ═══════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  font-size: 15px;
  scroll-behavior: smooth;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
  min-height: 100vh;
  transition: background 200ms ease, color 200ms ease;
  line-height: 1.6;
}

/* ═══════════════════════════════
 *   Typography
 *   ═══════════════════════════════ */
h1, h2, h3, h4 {
  font-family: 'Space Grotesk', 'Outfit', system-ui, sans-serif;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

a {
  color: var(--accent);
  text-decoration: none;
  transition: color 150ms ease;
}
a:hover { color: var(--lavender); text-decoration: underline; }

code, kbd, pre {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

/* ═══════════════════════════════
 *   Layout
 *   ═══════════════════════════════ */
.wrapper {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* ═══════════════════════════════
 *   Topbar / Header
 *   ═══════════════════════════════ */
.topbar {
  background: var(--mantle);
  border-bottom: 1px solid var(--surface);
  padding: 0.85rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
}

.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 800;
  font-size: 1.2rem;
  color: var(--text);
  text-decoration: none;
  letter-spacing: -0.03em;
}
.logo:hover { color: var(--accent); text-decoration: none; }

.logo-icon {
  width: 32px; height: 32px;
  background: linear-gradient(135deg, var(--accent), var(--blue));
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem;
}

.logo-sub {
  font-size: 0.65rem;
  font-weight: 400;
  color: var(--subtext);
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* ═══════════════════════════════
 *   Theme Toggle
 *   ═══════════════════════════════ */
.theme-btn {
  background: var(--surface);
  border: 1px solid var(--surface1);
  color: var(--subtext);
  cursor: pointer;
  border-radius: var(--radius-md);
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  font-family: inherit;
  transition: var(--trans);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.theme-btn:hover {
  background: var(--surface1);
  color: var(--text);
  border-color: var(--accent);
}

/* ═══════════════════════════════
 *   Buttons
 *   ═══════════════════════════════ */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1.25rem;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--trans);
  border: none;
  text-decoration: none;
  white-space: nowrap;
}

.btn-primary {
  background: var(--accent);
  color: var(--mantle);
}
.btn-primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(203,166,247,0.3);
  text-decoration: none;
  color: var(--mantle);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--surface1);
}
.btn-secondary:hover {
  background: var(--surface1);
  border-color: var(--accent);
  text-decoration: none;
  color: var(--text);
}

.btn-danger {
  background: transparent;
  color: var(--red);
  border: 1px solid var(--red);
}
.btn-danger:hover {
  background: var(--red);
  color: var(--mantle);
  text-decoration: none;
}

.btn-sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
}

.btn-ghost {
  background: transparent;
  color: var(--subtext);
  border: 1px solid transparent;
}
.btn-ghost:hover {
  background: var(--surface);
  color: var(--text);
  border-color: var(--surface1);
  text-decoration: none;
}

/* ═══════════════════════════════
 *   Badges
 *   ═══════════════════════════════ */
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0.55rem;
  border-radius: 99px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.badge-unread {
  background: var(--accent);
  color: var(--mantle);
}
.badge-read {
  background: var(--surface1);
  color: var(--overlay);
}
.badge-att {
  background: var(--surface);
  color: var(--peach);
  border: 1px solid var(--surface1);
}

/* ═══════════════════════════════
 *   Cards
 *   ═══════════════════════════════ */
.card {
  background: var(--surface);
  border: 1px solid var(--surface1);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow);
}

/* ═══════════════════════════════
 *   Form elements
 *   ═══════════════════════════════ */
.input {
  background: var(--mantle);
  border: 1.5px solid var(--surface1);
  border-radius: var(--radius-md);
  color: var(--text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 1rem;
  padding: 0.65rem 1rem;
  transition: var(--trans);
  outline: none;
  width: 100%;
}
.input::placeholder { color: var(--overlay); }
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(203,166,247,0.15);
}

.input-addon {
  display: inline-flex;
  align-items: center;
  background: var(--surface);
  border: 1.5px solid var(--surface1);
  border-left: none;
  padding: 0.65rem 1rem;
  color: var(--subtext);
  font-size: 0.875rem;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  white-space: nowrap;
}
.input-group {
  display: flex;
}
.input-group .input {
  border-radius: var(--radius-md) 0 0 var(--radius-md);
}

/* ═══════════════════════════════
 *   Alerts / Notice
 *   ═══════════════════════════════ */
.alert {
  padding: 0.85rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  line-height: 1.5;
}
.alert-warning {
  background: rgba(249,226,175,0.1);
  border: 1px solid var(--yellow);
  color: var(--yellow);
}
.alert-error {
  background: rgba(243,139,168,0.1);
  border: 1px solid var(--red);
  color: var(--red);
}
.alert-info {
  background: rgba(137,180,250,0.1);
  border: 1px solid var(--blue);
  color: var(--blue);
}

/* ═══════════════════════════════
 *   Spinner
 *   ═══════════════════════════════ */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spinner {
  width: 1rem; height: 1rem;
  border: 2px solid var(--surface1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

/* ═══════════════════════════════
 *   Divider
 *   ═══════════════════════════════ */
.divider {
  border: none;
  border-top: 1px solid var(--surface1);
  margin: 1.5rem 0;
}

/* ═══════════════════════════════
 *   Footer
 *   ═══════════════════════════════ */
.footer {
  border-top: 1px solid var(--surface);
  padding: 1.5rem 0;
  margin-top: 4rem;
  text-align: center;
  color: var(--overlay);
  font-size: 0.8rem;
}
.footer a { color: var(--subtext); }
.footer a:hover { color: var(--accent); }

/* ═══════════════════════════════
 *   Toast notification
 *   ═══════════════════════════════ */
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}
.toast {
  background: var(--surface);
  border: 1px solid var(--surface1);
  border-left: 3px solid var(--accent);
  color: var(--text);
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  box-shadow: var(--shadow-lg);
  animation: slideIn 0.25s ease;
  pointer-events: auto;
  max-width: 320px;
}
.toast.success { border-left-color: var(--green); }
.toast.error   { border-left-color: var(--red); }

@keyframes slideIn {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ═══════════════════════════════
 *   Responsive
 *   ═══════════════════════════════ */
@media (max-width: 640px) {
  html { font-size: 14px; }
  .wrapper { padding: 0 1rem; }
  .topbar { padding: 0.65rem 0; }
  .logo-sub { display: none; }
  .card { padding: 1rem; }
}
`;

// ─────────────────────────────────────────────
// Shared JavaScript (theme toggle, toast, polling)
// ─────────────────────────────────────────────
export const SHARED_JS = `
// Theme management
(function() {
  var saved = localStorage.getItem('theme');
  var prefer = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  var theme = saved || prefer;
  document.documentElement.classList.toggle('light', theme === 'light');
})();

function toggleTheme() {
  var isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  var btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = isLight ? '🌙 Mocha' : '☀️ Latte';
}

function getThemeLabel() {
  return document.documentElement.classList.contains('light') ? '🌙 Mocha' : '☀️ Latte';
}

// Toast notification
function showToast(msg, type) {
  type = type || 'default';
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(function() { toast.remove(); }, 350);
  }, 3000);
}

// Copy to clipboard
function copyToClipboard(text, label) {
  navigator.clipboard.writeText(text).then(function() {
    showToast((label || 'Disalin') + ' ke clipboard!', 'success');
  }).catch(function() {
    showToast('Gagal menyalin', 'error');
  });
}

// Confirm delete
function confirmDelete(msg, onConfirm) {
  if (window.confirm(msg || 'Yakin ingin menghapus?')) {
    onConfirm();
  }
}
`;

// ─────────────────────────────────────────────
// Base HTML shell
// ─────────────────────────────────────────────
export function baseLayout({ title, head = "", body, inboxName = null, brandDomain = "bluehat358.biz.id" }) {
  return `<!DOCTYPE html>
  <html lang="id">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — BlueHat358 TempMail</title>
  <meta name="description" content="Email sementara instan. Tanpa daftar, tanpa password.">
  <meta name="robots" content="noindex, nofollow">
  <style>
  body, code, pre, input, button {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, 'SF Mono', monospace;
  }
  h1, h2, h3, h4, .logo {
    font-family: 'Space Grotesk', system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  }
  ${CATPPUCCIN_CSS}
  </style>
  ${head}
  </head>
  <body>
  <script>
  (function() {
    var saved = localStorage.getItem('theme');
    var prefer = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.classList.toggle('light', (saved || prefer) === 'light');
  })();
  </script>

  <!-- Topbar -->
  <header class="topbar">
  <div class="wrapper topbar-inner">
  <a href="/" class="logo">
  <div class="logo-icon">📬</div>
  <div>
  <div>BlueHat<span style="color:var(--accent)">358</span></div>
  <div class="logo-sub">TempMail · @${escapeHtml(brandDomain || "bluehat358.biz.id")}</div>
  </div>
  </a>
  <div class="topbar-right">
  ${inboxName ? `
    <span style="font-size:0.8rem;color:var(--subtext);font-family:'JetBrains Mono',monospace;">
    <span style="color:var(--overlay)">inbox:</span>
    <span style="color:var(--accent)">${escapeHtml(inboxName)}</span>
    </span>` : ""}
    <button class="theme-btn" id="theme-btn" onclick="toggleTheme()">☀️ Latte</button>
    </div>
    </div>
    </header>

    <!-- Main content -->
    <main style="padding: 2rem 0 4rem;">
    <div class="wrapper">
    ${body}
    </div>
    </main>

    <!-- Footer -->
    <footer class="footer">
    <div class="wrapper">
    <p>
    <strong style="color:var(--subtext)">BlueHat358 TempMail</strong>
    &nbsp;·&nbsp; Email otomatis dihapus setelah 7 hari
    &nbsp;·&nbsp; <a href="/">Buat inbox baru</a>
    &nbsp;·&nbsp; <a href="/about">Tentang & FAQ</a>
    </p>
    <p style="margin-top:0.4rem">
    ⚠️ Inbox bersifat <strong>publik</strong> — jangan gunakan untuk informasi sensitif, OTP bank, atau akun penting.
    </p>
    </div>
    </footer>

    <div id="toast-container" class="toast-container"></div>

    <script>
    ${SHARED_JS}
    // Set correct theme button label on load
    document.addEventListener('DOMContentLoaded', function() {
      var btn = document.getElementById('theme-btn');
      if (btn) btn.textContent = getThemeLabel();
    });
      </script>
      </body>
      </html>`;
}

// ─────────────────────────────────────────────
// HTML escaping
// ─────────────────────────────────────────────
export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");
}
