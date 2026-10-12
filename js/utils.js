// ============================================
// UTILITIES — format, escape, sheet, toast
// ============================================
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ic(name, cls) { return '<span class="ms ' + (cls || '') + '">' + name + '</span>'; }

// Rupiah: "Rp 1.450.000" (spasi tak terputus, titik ribuan, tanpa desimal)
function rp(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-' : '') + 'Rp\u00a0' + Math.abs(v).toLocaleString('id-ID');
}
function rpSigned(n, jenis) { return (jenis === 'Pemasukan' ? '+' : '-') + rp(Math.abs(n)); }
function shortRp(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'jt';
  if (n >= 1e3) return Math.round(n / 1e3) + 'rb';
  return String(Math.round(n));
}
function digits(s) { return parseInt(String(s || '').replace(/\D/g, ''), 10) || 0; }
function fmtDigits(n) { return n ? Number(n).toLocaleString('id-ID') : ''; }

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function parseTs(str) {
  const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
}
function fmtDate(str) {
  const d = parseTs(str); if (!d) return '';
  return d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear();
}
function fmtDateTime(str) {
  const d = parseTs(str); if (!d) return '';
  return fmtDate(str) + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function relDay(str) {
  const d = parseTs(str); if (!d) return '';
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const diff = Math.round((t - x) / 86400000);
  if (diff === 0) return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' WIB';
  if (diff === 1) return 'Kemarin';
  if (diff > 1 && diff < 7) return diff + ' hari lalu';
  return fmtDate(str);
}
function nowLocalInput() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// ---------- Toast & loading ----------
let _notifTimer;
function toast(msg, type) {
  const n = $('#notif');
  n.textContent = msg; n.className = 'notif notif-' + (type || 'info') + ' show';
  clearTimeout(_notifTimer);
  _notifTimer = setTimeout(() => n.classList.remove('show'), type === 'error' ? 4500 : 2800);
}
function showLoading(on) { const l = $('#loading'); if (l) l.hidden = !on; }

// ---------- Bottom sheet ----------
function openSheet(html, onMount) {
  closeSheet();
  const root = $('#sheet-root');
  root.innerHTML = '<div class="backdrop" id="sheet-bd"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div></div>';
  $('#sheet-bd').addEventListener('click', e => { if (e.target.id === 'sheet-bd') closeSheet(); });
  if (onMount) onMount($('.sheet', root));
}
function closeSheet() { const r = $('#sheet-root'); if (r) r.innerHTML = ''; }

function confirmBox(title, message, okLabel, danger) {
  return new Promise(resolve => {
    openSheet(
      '<h2>' + esc(title) + '</h2><p class="muted">' + esc(message) + '</p>' +
      '<div class="actions two"><button class="btn btn-secondary" data-r="0">Batal</button>' +
      '<button class="btn ' + (danger ? 'btn-danger-solid' : 'btn-primary') + '" data-r="1">' + esc(okLabel || 'Ya') + '</button></div>',
      sh => $$('[data-r]', sh).forEach(b => b.addEventListener('click', () => { closeSheet(); resolve(b.dataset.r === '1'); }))
    );
  });
}

// ---------- File → base64 (foto dikompres di browser) ----------
function readB64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(new Error('Gagal membaca berkas.'));
    r.readAsDataURL(blob);
  });
}
async function imageToJpeg(file, maxDim) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Format foto tidak didukung. Gunakan JPG/PNG.')); i.src = url; });
    const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
  } finally { URL.revokeObjectURL(url); }
}
// Hasil: { name, mime, base64, size } — melempar Error jika > 5 MB / format salah
async function filePayload(file, allowPdf) {
  if (!file) return null;
  const MAX = 5 * 1024 * 1024;
  if (file.type === 'application/pdf') {
    if (!allowPdf) throw new Error('Gunakan foto JPG/PNG.');
    if (file.size > MAX) throw new Error('Ukuran berkas melebihi 5 MB.');
    return { name: file.name, mime: file.type, base64: await readB64(file), size: file.size };
  }
  if (!/^image\//.test(file.type)) throw new Error('Format berkas tidak didukung.');
  const blob = await imageToJpeg(file, 1280);
  if (blob.size > MAX) throw new Error('Ukuran foto melebihi 5 MB.');
  return { name: file.name.replace(/\.\w+$/, '') + '.jpg', mime: 'image/jpeg', base64: await readB64(blob), size: blob.size };
}
function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function thumb(url, size) {
  return url ? '<img src="' + esc(url) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : ic('image', 'sm');
}
