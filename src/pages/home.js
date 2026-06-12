// src/pages/home.js — Homepage: form input inbox + generate random
// Fase: multi-domain support with select box

import { baseLayout, escapeHtml } from "../theme.js";

export function renderHomePage({ domains = [], defaultDomain = "", domain = "" } = {}) {
  const currentDomain = domain || defaultDomain || domains[0] || "bluehat358.biz.id";

  const domainOptions = domains.map((d) =>
    `<option value="${escapeHtml(d)}"${d === currentDomain ? ' selected' : ''}>${escapeHtml(d)}</option>`
  ).join("");

  const body = `
    <!-- Hero section -->
    <div style="text-align:center; padding: 3rem 0 2rem;">

      <!-- Banner: sistem penuh -->
      <div id="system-full-banner" style="
        display:none;
        align-items:center;
        gap:0.75rem;
        background:color-mix(in srgb, var(--red) 15%, transparent);
        border:1px solid var(--red);
        border-radius:var(--radius-md);
        padding:0.85rem 1.25rem;
        margin-bottom:1.5rem;
        text-align:left;
        font-size:0.88rem;
        color:var(--text);
        max-width:560px;
        margin-left:auto;
        margin-right:auto;
      ">
        <span style="font-size:1.4rem;">🚫</span>
        <div>
          <strong style="color:var(--red);">Sistem Penuh</strong><br>
          <span style="color:var(--subtext);">Semua slot alamat email sedang terpakai. Slot akan terbuka otomatis setelah pesan lama kedaluwarsa (3 hari). Coba lagi nanti.</span>
        </div>
      </div>

      <!-- Banner: slot hampir habis -->
      <div id="system-warn-banner" style="
        display:none;
        align-items:center;
        gap:0.75rem;
        background:color-mix(in srgb, var(--yellow, #f9e2af) 15%, transparent);
        border:1px solid var(--yellow, #f9e2af);
        border-radius:var(--radius-md);
        padding:0.85rem 1.25rem;
        margin-bottom:1.5rem;
        text-align:left;
        font-size:0.88rem;
        color:var(--text);
        max-width:560px;
        margin-left:auto;
        margin-right:auto;
      ">
        <span style="font-size:1.4rem;">⚠️</span>
        <div>
          <strong>Slot Hampir Habis</strong><br>
          <span style="color:var(--subtext);">Hanya tersisa <strong id="available-slots">?</strong> slot alamat email. Gunakan nama yang sudah pernah dipakai jika memungkinkan.</span>
        </div>
      </div>
      <div style="
        display:inline-flex;
        align-items:center;
        gap:0.5rem;
        background:var(--surface);
        border:1px solid var(--surface1);
        padding:0.4rem 1rem;
        border-radius:99px;
        font-size:0.78rem;
        color:var(--subtext);
        margin-bottom:1.5rem;
        letter-spacing:0.04em;
      ">
        <span style="color:var(--green)">●</span> SERVERLESS · EDGE · NO TRACKING
      </div>

      <h1 style="font-size:clamp(2rem,5vw,3.2rem); margin-bottom:0.75rem;">
        Email sementara<br>
        <span style="color:var(--accent)">tanpa ribet.</span>
      </h1>

      <p style="
        color:var(--subtext);
        font-size:1.05rem;
        max-width:520px;
        margin: 0 auto 2.5rem;
        line-height:1.7;
        font-family:'Space Grotesk',sans-serif;
      ">
        Inbox instan di <code style="color:var(--accent)" id="hero-domain-display">@${escapeHtml(currentDomain)}</code>.
        Tanpa daftar, tanpa password. Email otomatis hilang dalam 7 hari.
      </p>

      <!-- Inbox form -->
      <div class="card" style="max-width:560px;margin:0 auto;text-align:left;">
        <label style="
          display:block;
          font-size:0.8rem;
          color:var(--subtext);
          font-weight:600;
          text-transform:uppercase;
          letter-spacing:0.06em;
          margin-bottom:0.75rem;
        ">Nama Inbox</label>

        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <div class="input-group" style="flex:1;min-width:220px;">
            <input
              type="text"
              id="inbox-input"
              class="input"
              placeholder="nama-inbox"
              maxlength="32"
              pattern="[a-z0-9\\-]{3,32}"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              onkeydown="if(event.key==='Enter')goToInbox()"
              oninput="validateInput(this)"
              style="border-radius: var(--radius-md) 0 0 var(--radius-md);"
            >
            <div class="input-addon" id="domain-suffix">
              @ 
              <select id="domain-select" onchange="updateDomainDisplay()" style="
                background:transparent;
                border:none;
                color:var(--text);
                font-family:'JetBrains Mono',monospace;
                font-size:0.9rem;
                padding:0;
                outline:none;
                cursor:pointer;
                min-width:120px;
              ">
                ${domainOptions}
              </select>
            </div>
          </div>
          <button id="open-inbox-btn" class="btn btn-primary" onclick="goToInbox()">
            Buka Inbox →
          </button>
        </div>

        <div id="input-error" style="
          color:var(--red);
          font-size:0.8rem;
          margin-top:0.5rem;
          display:none;
        "></div>

        <div style="
          display:flex;
          align-items:center;
          gap:1rem;
          margin:1.25rem 0;
          color:var(--overlay);
          font-size:0.8rem;
        ">
          <hr style="flex:1;border:none;border-top:1px solid var(--surface1);">
          atau
          <hr style="flex:1;border:none;border-top:1px solid var(--surface1);">
        </div>

        <button class="btn btn-secondary" onclick="generateRandom()" style="width:100%;">
          🎲 Generate Nama Acak
        </button>
      </div>
    </div>

    <!-- Features grid -->
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
      gap:1rem;
      margin-top:3rem;
    ">
      ${featureCard("⚡", "Instan", "Inbox langsung aktif saat kamu buka. Tidak perlu verifikasi apapun.")}
      ${featureCard("🔒", "Anonim", "Tidak ada akun, tidak ada cookie tracking, tidak ada log aktivitas.")}
      ${featureCard("📎", "Attachment", "Terima email dengan lampiran hingga 10 MB. Disimpan di Cloudflare R2.")}
      ${featureCard("⏱️", "Auto-Hapus", "Email otomatis kedaluwarsa dalam 7 hari. Attachment dalam 8 hari.")}
      ${featureCard("🌐", "Edge Network", "Dijalankan di 300+ lokasi global via Cloudflare Workers. Latensi < 50ms.")}
      ${featureCard("🎨", "Catppuccin", "Tema gelap/terang yang bisa kamu pilih. Preferensi tersimpan otomatis.")}
    </div>

    <!-- Privacy warning -->
    <div class="alert alert-warning" style="margin-top:2.5rem;max-width:760px;margin-left:auto;margin-right:auto;">
      <span>⚠️</span>
      <div>
        <strong>Perhatian Privasi:</strong> Inbox bersifat <strong>publik</strong> — siapa saja yang tahu URL
        inbox kamu dapat membaca semua email. Layanan ini <em>tidak cocok</em> untuk OTP bank,
        password reset akun penting, atau informasi sensitif lainnya.
      </div>
    </div>

    <!-- How to use -->
    <div style="margin-top:3rem;max-width:760px;margin:3rem auto 0;">
      <h2 style="font-size:1.4rem;margin-bottom:1.25rem;color:var(--subtext);font-family:'Space Grotesk',sans-serif;">
        Cara Pakai
      </h2>
      <div style="display:grid;gap:0.75rem;">
        ${stepCard("01", "Buat nama inbox", "Ketik nama inbox kamu atau klik Generate Acak. Nama hanya bisa menggunakan huruf kecil (a–z), angka (0–9), dan tanda hubung.")}
        ${stepCard("02", "Bagikan alamat emailmu", `Gunakan alamat <code style='color:var(--accent)'>nama@${escapeHtml(currentDomain)}</code> saat mendaftar di layanan yang ingin kamu coba.`)}
        ${stepCard("03", "Terima email", "Email akan muncul otomatis di inboxmu. Tidak perlu refresh — halaman akan update sendiri.")}
        ${stepCard("04", "Selesai", "Email dan attachment akan otomatis dihapus setelah 7–8 hari. Atau kamu bisa hapus manual kapan saja.")}
      </div>
    </div>
  `;

  const head = `
  <style>
    .feature-card {
      background: var(--surface);
      border: 1px solid var(--surface1);
      border-radius: var(--radius-lg);
      padding: 1.25rem 1.5rem;
      transition: var(--trans);
    }
    .feature-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }
    .step-card {
      background: var(--surface);
      border: 1px solid var(--surface1);
      border-radius: var(--radius-md);
      padding: 1rem 1.25rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }
    #domain-select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(203,166,247,0.15);
    }
  </style>`;

  const page = baseLayout({
    title: "Beranda",
    head,
    body,
    brandDomain: currentDomain,
  });

  // Inject JS — including domain list for client-side
  return page.replace(
    "</body>",
    `<script>
  var DOMAINS = ${JSON.stringify(domains)};
  var CURRENT_DOMAIN = '${escapeHtml(currentDomain)}';

  // Cek status sistem saat halaman dimuat
  (async function checkSystemStatus() {
    try {
      const res = await fetch('/api/system/status');
      const data = await res.json();
      if (data.is_full) {
        var banner = document.getElementById('system-full-banner');
        if (banner) banner.style.display = 'flex';
        var btn = document.getElementById('open-inbox-btn');
        if (btn) {
          btn.disabled = true;
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';
          btn.title = 'Sistem penuh, tidak bisa membuat alamat baru';
        }
      } else if (data.available_slots <= 2) {
        var warn = document.getElementById('system-warn-banner');
        if (warn) {
          warn.style.display = 'flex';
          var slot = document.getElementById('available-slots');
          if (slot) slot.textContent = data.available_slots;
        }
      }
    } catch(e) {}
  })();

  // Update domain display when select changes
  function updateDomainDisplay() {
    var sel = document.getElementById('domain-select');
    var domain = sel ? sel.value : CURRENT_DOMAIN;
    var hero = document.getElementById('hero-domain-display');
    if (hero) hero.textContent = '@' + domain;
    CURRENT_DOMAIN = domain;
  }

  // Validation
  function validateInput(el) {
    var val = el.value.toLowerCase().trim();
    el.value = val.replace(/[^a-z0-9\\-]/g,'');
    var err = document.getElementById('input-error');
    if (val.length > 0 && (val.length < 3 || !/^[a-z0-9][a-z0-9\\-]{1,30}[a-z0-9]$/.test(val) && val.length > 2)) {
      err.style.display = 'block';
      err.textContent = 'Nama tidak valid. Gunakan 3\u201332 karakter: huruf kecil, angka, tanda hubung. Tidak boleh diawali/diakhiri "-".';
    } else {
      err.style.display = 'none';
    }
  }

  function goToInbox() {
    var btn = document.getElementById('open-inbox-btn');
    if (btn && btn.disabled) {
      showToast('Sistem penuh. Tunggu beberapa hari hingga slot tersedia.', 'error');
      return;
    }
    var val = document.getElementById('inbox-input').value.toLowerCase().trim();
    if (!val) { showToast('Masukkan nama inbox terlebih dahulu', 'error'); return; }
    if (val.length < 3) { showToast('Nama inbox minimal 3 karakter', 'error'); return; }
    if (!/^[a-z0-9][a-z0-9\\-]{1,30}[a-z0-9]$/.test(val) && val.length > 2) {
      showToast('Nama inbox tidak valid', 'error'); return;
    }
    var domain = document.getElementById('domain-select')?.value || CURRENT_DOMAIN;
    var params = domain ? '?domain=' + encodeURIComponent(domain) : '';
    window.location.href = '/' + encodeURIComponent(val) + params;
  }

  function generateRandom() {
    var adjs = ['swift','bold','calm','dark','echo','free','good','warm','cool','blue','fast','keen','lazy','mild','neat','open','pure','quiet','rich','safe','tiny','vast','wild','zen'];
    var nouns = ['panda','eagle','storm','maple','river','cloud','flame','stone','tiger','ocean','pixel','quark','lunar','ember','frost','grove','haven','ivory','jewel','karma','light'];
    var adj = adjs[Math.floor(Math.random()*adjs.length)];
    var noun = nouns[Math.floor(Math.random()*nouns.length)];
    var num = Math.floor(Math.random()*90+10);
    var name = adj+'-'+noun+'-'+num;
    document.getElementById('inbox-input').value = name;
    document.getElementById('input-error').style.display = 'none';
    document.getElementById('inbox-input').focus();
  }
</script>
</body>`
  );
}

function featureCard(icon, title, desc) {
  return `<div class="feature-card">
    <div style="font-size:1.75rem;margin-bottom:0.75rem;">${icon}</div>
    <h3 style="font-size:1rem;margin-bottom:0.4rem;font-family:'Space Grotesk',sans-serif;">${escapeHtml(title)}</h3>
    <p style="color:var(--subtext);font-size:0.85rem;line-height:1.6;">${escapeHtml(desc)}</p>
  </div>`;
}

function stepCard(num, title, desc) {
  return `<div class="step-card">
    <div style="
      min-width:2.5rem;height:2.5rem;
      background:var(--mantle);
      border:1px solid var(--surface1);
      border-radius:var(--radius-md);
      display:flex;align-items:center;justify-content:center;
      font-size:0.75rem;font-weight:700;color:var(--accent);
      font-family:'JetBrains Mono',monospace;
    ">${num}</div>
    <div>
      <div style="font-weight:600;margin-bottom:0.25rem;">${escapeHtml(title)}</div>
      <div style="color:var(--subtext);font-size:0.85rem;">${desc}</div>
    </div>
  </div>`;
}
