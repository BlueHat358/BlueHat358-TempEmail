// src/pages/about.js — Halaman About/FAQ
import { baseLayout, escapeHtml } from "../theme.js";

export function renderAboutPage() {
  const body = `
    <!-- Header -->
    <div style="margin-bottom: 2.5rem;">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
        <a href="/" style="color:var(--subtext);font-size:0.85rem;text-decoration:none;">← Beranda</a>
      </div>
      <h1 style="font-size:2rem;margin-bottom:0.5rem;">
        Tentang <span style="color:var(--accent)">BlueHat358</span> TempMail
      </h1>
      <p style="color:var(--subtext);font-size:1rem;font-family:'Space Grotesk',sans-serif;">
        Layanan email sementara serverless berbasis Cloudflare Workers.
      </p>
    </div>

    <!-- Two-column layout -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:2rem;" class="about-grid">

      <!-- What is it -->
      <div class="about-card">
        <div class="about-card-icon">📬</div>
        <h2>Apa itu TempMail?</h2>
        <p>
          BlueHat358 TempMail adalah layanan email sementara — kamu bisa langsung membuat inbox instan
          tanpa mendaftar, tanpa password, tanpa akun. Cocok untuk registrasi di layanan yang ingin kamu
          coba tanpa memberikan email asli.
        </p>
      </div>

      <!-- How it works -->
      <div class="about-card">
        <div class="about-card-icon">⚙️</div>
        <h2>Cara Kerja</h2>
        <p>
          Setiap nama yang kamu masukkan otomatis menjadi inbox di domain
          <code>@bluehat358.biz.id</code>. Tidak ada proses pendaftaran.
          Email masuk langsung disimpan dan bisa dibuka siapapun yang tahu URL-nya.
        </p>
      </div>

      <!-- Privacy -->
      <div class="about-card about-card-warning">
        <div class="about-card-icon">⚠️</div>
        <h2>Privasi — Baca Ini!</h2>
        <p>
          Inbox bersifat <strong>publik sepenuhnya</strong>. Siapa saja yang mengetahui nama inbox kamu
          dapat membaca semua email di dalamnya. <strong>Jangan gunakan</strong> untuk OTP bank, reset
          password akun penting, atau informasi sensitif apapun.
        </p>
      </div>

      <!-- Tech -->
      <div class="about-card">
        <div class="about-card-icon">🛠️</div>
        <h2>Teknologi</h2>
        <p>
          Dibangun di atas Cloudflare Workers (edge serverless), KV untuk metadata, R2 untuk attachment,
          dan postal-mime untuk parsing MIME. Tidak ada server, tidak ada database tradisional.
        </p>
      </div>
    </div>

    <!-- FAQ -->
    <div style="margin-bottom:2.5rem;">
      <h2 style="font-size:1.4rem;margin-bottom:1.25rem;color:var(--subtext);font-family:'Space Grotesk',sans-serif;">
        ❓ FAQ — Pertanyaan yang Sering Ditanyakan
      </h2>
      <div style="display:flex;flex-direction:column;gap:0.75rem;" id="faq-list">
        ${faqItem("Berapa lama email disimpan?",
          "Email otomatis dihapus setelah <strong>7 hari</strong> sejak diterima. Attachment disimpan selama <strong>8 hari</strong>. Ini tidak bisa diperpanjang.")}
        ${faqItem("Apakah inbox saya aman?",
          "Tidak sepenuhnya. Inbox hanya seaman nama yang kamu pilih — jika orang lain bisa menebak nama inbox kamu, mereka bisa membaca email kamu. Gunakan nama yang cukup unik untuk mengurangi risiko.")}
        ${faqItem("Berapa batas ukuran attachment?",
          "Maksimal <strong>10 MB per file attachment</strong>. File yang lebih besar akan di-skip (tidak disimpan), tapi info nama dan ukuran file tetap ditampilkan.")}
        ${faqItem("Berapa banyak email yang bisa masuk?",
          "Maksimal <strong>50 email per inbox</strong>. Setelah itu, email baru yang masuk akan di-drop secara diam-diam. Pengirim tidak mendapat notifikasi error.")}
        ${faqItem("Apakah ada tracking atau iklan?",
          "Tidak ada. Tidak ada analytics, tidak ada cookie tracking pihak ketiga, tidak ada iklan. Ini layanan murni berbasis utilitas.")}
        ${faqItem("Apakah bisa menerima email HTML?",
          "Ya. Email HTML di-render dalam iframe yang di-sandbox untuk mencegah XSS. Script dalam email diblokir sepenuhnya.")}
        ${faqItem("Apa itu nama inbox yang valid?",
          "Nama inbox hanya boleh menggunakan huruf kecil (a–z), angka (0–9), dan tanda hubung (-). Minimal 3 karakter, maksimal 32 karakter. Tidak boleh diawali atau diakhiri tanda hubung.")}
        ${faqItem("Kenapa email saya tidak muncul?",
          "Periksa: (1) Apakah alamat email sudah benar? (2) Email mungkin tertahan di server pengirim. (3) Inbox mungkin sudah penuh (50 email). (4) Coba klik Refresh. Ingat, tidak semua layanan bisa kirim ke domain baru.")}
        ${faqItem("Apakah bisa mengirim email dari sini?",
          "Tidak. Layanan ini hanya untuk <em>menerima</em> email. Tidak ada fitur kirim email.")}
        ${faqItem("Apakah data saya dilindungi GDPR?",
          "Layanan ini tidak menyimpan data pribadi (tidak ada akun, tidak ada login). Email yang masuk disimpan sementara di Cloudflare KV/R2 dan otomatis dihapus setelah TTL habis.")}
      </div>
    </div>

    <!-- Limits table -->
    <div style="margin-bottom:2.5rem;">
      <h2 style="font-size:1.4rem;margin-bottom:1.25rem;color:var(--subtext);font-family:'Space Grotesk',sans-serif;">
        📊 Batas Sistem
      </h2>
      <div style="overflow-x:auto;">
        <table class="limits-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Nilai</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Umur email</td><td><span class="limit-badge">7 hari</span></td><td>Auto-hapus oleh KV TTL</td></tr>
            <tr><td>Umur attachment</td><td><span class="limit-badge">8 hari</span></td><td>R2 cleanup tiap jam + lifecycle rule</td></tr>
            <tr><td>Maks email/inbox</td><td><span class="limit-badge">50 email</span></td><td>Email ke-51+ di-drop diam-diam</td></tr>
            <tr><td>Maks ukuran attachment</td><td><span class="limit-badge">10 MB</span></td><td>File lebih besar di-skip</td></tr>
            <tr><td>Panjang nama inbox</td><td><span class="limit-badge">3–32 karakter</span></td><td>Huruf kecil, angka, tanda hubung</td></tr>
            <tr><td>Rate limit halaman</td><td><span class="limit-badge">120 req/mnt</span></td><td>Per IP</td></tr>
            <tr><td>Rate limit API</td><td><span class="limit-badge">60 req/mnt</span></td><td>Per IP</td></tr>
            <tr><td>Rate limit hapus</td><td><span class="limit-badge">20 req/mnt</span></td><td>Per IP</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Cloudflare notice -->
    <div class="about-card" style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
      <div style="font-size:2.5rem;">☁️</div>
      <div>
        <h3 style="margin-bottom:0.3rem;">Ditenagai Cloudflare Workers</h3>
        <p style="color:var(--subtext);font-size:0.875rem;">
          Berjalan di 300+ edge node global. Latensi rendah, tidak ada server sentral yang bisa down.
          Storage di Cloudflare KV (metadata) dan R2 (attachment binary).
        </p>
      </div>
    </div>
  `;

  const head = `
  <style>
    .about-grid { }
    @media(max-width:640px) { .about-grid { grid-template-columns: 1fr !important; } }
    .about-card {
      background: var(--surface);
      border: 1px solid var(--surface1);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
    }
    .about-card-warning {
      border-color: var(--yellow);
      background: color-mix(in srgb, var(--yellow) 5%, var(--surface));
    }
    .about-card-icon {
      font-size: 1.75rem;
      margin-bottom: 0.75rem;
    }
    .about-card h2 {
      font-size: 1rem;
      margin-bottom: 0.6rem;
      font-family: 'Space Grotesk', sans-serif;
    }
    .about-card p {
      color: var(--subtext);
      font-size: 0.875rem;
      line-height: 1.7;
    }
    .about-card p code {
      color: var(--accent);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85em;
    }
    .faq-item {
      background: var(--surface);
      border: 1px solid var(--surface1);
      border-radius: var(--radius-md);
      overflow: hidden;
      transition: var(--trans);
    }
    .faq-item:hover { border-color: var(--accent); }
    .faq-question {
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      padding: 1rem 1.25rem;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      transition: var(--trans);
    }
    .faq-question:hover { color: var(--accent); }
    .faq-arrow { transition: transform 200ms; color: var(--overlay); font-size: 0.75rem; }
    .faq-item.open .faq-arrow { transform: rotate(180deg); }
    .faq-answer {
      max-height: 0;
      overflow: hidden;
      transition: max-height 300ms ease, padding 200ms ease;
      padding: 0 1.25rem;
      color: var(--subtext);
      font-size: 0.875rem;
      line-height: 1.7;
    }
    .faq-item.open .faq-answer {
      max-height: 200px;
      padding: 0 1.25rem 1rem;
    }
    .limits-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .limits-table th {
      background: var(--mantle);
      padding: 0.75rem 1rem;
      text-align: left;
      color: var(--subtext);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--surface1);
    }
    .limits-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--surface1);
      color: var(--text);
    }
    .limits-table tr:last-child td { border-bottom: none; }
    .limits-table tr:hover td { background: var(--surface); }
    .limits-table { background: var(--mantle); border: 1px solid var(--surface1); border-radius: var(--radius-md); overflow: hidden; }
    .limit-badge {
      background: var(--surface1);
      color: var(--accent);
      padding: 0.2rem 0.6rem;
      border-radius: var(--radius-sm);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      white-space: nowrap;
    }
  </style>`;

  const page = baseLayout({ title: "Tentang & FAQ", head, body });

  return page.replace("</body>", `
<script>
function toggleFaq(el) {
  var item = el.closest('.faq-item');
  var wasOpen = item.classList.contains('open');
  // Close all
  document.querySelectorAll('.faq-item.open').forEach(function(i) {
    i.classList.remove('open');
  });
  if (!wasOpen) item.classList.add('open');
}
</script>
</body>`);
}

function faqItem(question, answerHtml) {
  return `<div class="faq-item">
    <button class="faq-question" onclick="toggleFaq(this)">
      <span>${escapeHtml(question)}</span>
      <span class="faq-arrow">▼</span>
    </button>
    <div class="faq-answer">${answerHtml}</div>
  </div>`;
}
