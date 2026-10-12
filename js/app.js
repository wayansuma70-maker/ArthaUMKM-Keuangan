// ============================================
// APP — ArthaUMKM (SPA vanilla JS)
// ============================================
const S = {
  user: null, view: 'beranda',
  dash: null, prod: null, report: {}, form: null, formAt: 0,
  periode: 'bulan_ini', prodFilter: 'semua', prodQ: '',
  trxJenis: '', trxQ: '', sync: null
};
const TITLES = { beranda: 'Beranda', catat: 'Catat Transaksi', produk: 'Produk dan Stok', laporan: 'Laporan Keuangan', transaksi: 'Semua Transaksi' };
const KAT = {
  Pemasukan: ['Penjualan Produk', 'Jasa / Custom', 'Pembayaran Piutang', 'Lainnya'],
  Pengeluaran: ['Bahan Baku', 'Operasional', 'Gaji', 'Listrik & Air', 'Sewa', 'Lainnya']
};
const METODE = ['Tunai', 'QRIS', 'Transfer', 'Lainnya'];
const isOwner = () => S.user && S.user.peran === 'Pemilik';

document.addEventListener('DOMContentLoaded', boot);
window.addEventListener('auth-expired', () => { showLogin(); toast('Sesi berakhir. Silakan masuk lagi.', 'error'); });

// ============================================
// BOOT & LOGIN
// ============================================
function boot() {
  bindGlobal();
  if (API.token && API.user) {
    startApp(API.user);
    API.post('me').then(r => { if (r && r.success === false && r.code !== 'AUTH' && r.message) toast(r.message, 'error'); });
  } else showLogin();
}

function showLogin() {
  S.user = null; S.dash = null; S.prod = null; S.report = {}; S.form = null;
  $('#shell').hidden = true; $('#screen-login').hidden = false;
  document.body.classList.remove('staff');
  const em = localStorage.getItem('artha_email'); if (em) $('#login-email').value = em;
  closeSheet();
}

function startApp(user) {
  S.user = user;
  $('#screen-login').hidden = true; $('#shell').hidden = false;
  document.body.classList.toggle('staff', !isOwner());
  $('#role-badge').textContent = user.peran;
  $('#avatar-btn').textContent = initials(user.nama);
  buildCatat();
  go(isOwner() ? 'beranda' : 'catat');
}

async function doLogin(e) {
  e.preventDefault();
  const btn = $('#login-btn'), email = $('#login-email').value.trim(), pin = $('#login-pin').value;
  btn.disabled = true; btn.textContent = 'Memeriksa...';
  const r = await API.post('login', { email, pin });
  btn.disabled = false; btn.textContent = 'Masuk';
  if (!r.success) { toast(r.message || 'Gagal masuk.', 'error'); return; }
  localStorage.setItem('artha_email', email);
  $('#login-pin').value = '';
  API.setSession(r.data.token, r.data.user);
  startApp(r.data.user);
}

function logout() {
  API.post('logout');
  API.clear(); showLogin();
}

// ============================================
// NAVIGASI
// ============================================
function go(view, opts) {
  if (!isOwner() && view !== 'catat') view = 'catat';
  S.view = view;
  ['beranda', 'catat', 'produk', 'laporan', 'transaksi'].forEach(v => $('#view-' + v).classList.toggle('active', v === view));
  $$('#bottom-nav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === view));
  $('#topbar-sub').textContent = TITLES[view];
  window.scrollTo(0, 0);
  ({ beranda: loadBeranda, catat: loadCatat, produk: loadProduk, laporan: loadLaporan, transaksi: loadTransaksi })[view](opts || {});
}

function skeleton() {
  return '<div class="skel" style="height:190px;margin-top:.8rem"></div><div class="skel" style="height:90px;margin-top:.8rem"></div><div class="skel" style="height:170px;margin-top:.8rem"></div>';
}
function errorBox(msg, act) {
  return '<div class="empty">' + ic('cloud_off') + '<p>' + esc(msg) + '</p><br><button class="btn btn-soft btn-sm" data-act="' + act + '">Coba Lagi</button></div>';
}
function invalidate() { S.dash = null; S.prod = null; S.report = {}; S.formAt = 0; }

// ============================================
// GLOBAL EVENTS (delegasi)
// ============================================
const ACT = {
  nav: t => go(t.dataset.nav),
  quick: t => go('catat', { jenis: t.dataset.jenis }),
  'to-laporan': () => go('laporan'),
  'to-trx': () => go('transaksi'),
  'to-produk': t => go('produk', { filter: t.dataset.filter }),
  bell: () => { if (S.dash && S.dash.stokMenipis.length) go('produk', { filter: 'menipis' }); else toast('Tidak ada notifikasi baru.'); },
  retry: t => go(S.view),
  menu: openMenu,
  'prod-edit': t => openProductSheet(S.prod.items.find(p => p.id === t.dataset.id)),
  'prod-new': () => openProductSheet(null),
  'prod-stok': t => openStockSheet(S.prod.items.find(p => p.id === t.dataset.id)),
  'prod-filter': t => { S.prodFilter = t.dataset.f; renderProdChips(); renderProdList(); },
  periode: t => { S.periode = t.dataset.p; loadLaporan(); },
  pdf: exportPdf, 'email-rekap': emailRekap,
  'new-invoice': () => go('catat', { jenis: 'Pemasukan', invoice: true }),
  drive: () => { const r = S.report[S.periode]; if (r && r.driveUrl) window.open(r.driveUrl, '_blank', 'noopener'); },
  'share-inv': t => shareInvoice(t.dataset.no, t.dataset.link),
  'trx-filter': t => { S.trxJenis = t.dataset.j; loadTransaksi(); },
  'trx-del': t => deleteTrx(t.dataset.id),
  'trx-inv': t => makeInvoice(t.dataset.id),
  back: () => go('beranda')
};

function bindGlobal() {
  $('#login-form').addEventListener('submit', doLogin);
  $('#avatar-btn').addEventListener('click', openMenu);
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act],[data-nav]');
    if (!t) return;
    if (t.dataset.act && ACT[t.dataset.act]) { ACT[t.dataset.act](t, e); return; }
    if (t.dataset.nav) go(t.dataset.nav);
  });
  // toggle katalog (produk)
  $('#view-produk').addEventListener('change', async e => {
    const el = e.target.closest('input[data-toggle]'); if (!el) return;
    const p = S.prod.items.find(x => x.id === el.dataset.toggle);
    const r = await API.post('toggleCatalog', { id: p.id, tampil: el.checked });
    if (r.success) { p.tampil = el.checked; renderProdChips(); toast(el.checked ? 'Ditampilkan di katalog.' : 'Disembunyikan dari katalog.', 'success'); }
    else { el.checked = !el.checked; toast(r.message, 'error'); }
  });
  $('#view-produk').addEventListener('input', e => {
    if (e.target.id === 'prod-q') { S.prodQ = e.target.value; renderProdList(); }
  });
}

function openMenu() {
  openSheet(
    '<h2>' + esc(S.user.nama) + '</h2><p class="muted">' + esc(S.user.email) + ' · ' + esc(S.user.peran) + '</p>' +
    '<div class="actions">' +
    '<button class="btn btn-soft" id="m-refresh">' + ic('sync') + ' Segarkan Data</button>' +
    '<a class="btn btn-soft" href="katalog.html" target="_blank" rel="noopener">' + ic('storefront') + ' Buka Katalog Publik</a>' +
    '<button class="btn btn-danger" id="m-logout">' + ic('logout') + ' Keluar</button></div>',
    sh => {
      $('#m-refresh', sh).onclick = () => { invalidate(); closeSheet(); go(S.view); toast('Data disegarkan.', 'success'); };
      $('#m-logout', sh).onclick = () => { closeSheet(); logout(); };
    });
}

// ============================================
// BERANDA
// ============================================
async function loadBeranda() {
  const el = $('#view-beranda');
  if (S.dash) renderBeranda(); else el.innerHTML = skeleton();
  const r = await API.post('getDashboard');
  if (!r.success) { if (!S.dash && S.view === 'beranda') el.innerHTML = errorBox(r.message, 'retry'); return; }
  S.dash = r.data; S.sync = new Date();
  if (S.view === 'beranda') renderBeranda();
}

function txItem(t, full) {
  const inn = t.jenis === 'Pemasukan';
  const tags = [];
  if (t.bukti) tags.push('<a class="tag" href="' + esc(t.bukti) + '" target="_blank" rel="noopener">' + ic('attach_file', 'xs') + ' Bukti</a>');
  if (t.invoiceNo) tags.push('<a class="tag" href="' + esc(t.invoiceLink) + '" target="_blank" rel="noopener">' + ic('receipt_long', 'xs') + ' ' + esc(t.invoiceNo) + '</a>');
  const title = inn ? (t.produk ? (t.jumlah > 1 ? t.jumlah + 'x ' : 'Penjualan ') + t.produk : t.kategori) : (t.keterangan || t.kategori);
  const who = inn ? (t.pelanggan || t.kategori) : t.kategori;
  let actions = '';
  if (full) {
    actions = '<div class="tx-actions">' +
      (inn && !t.invoiceNo ? '<button class="mini-btn" data-act="trx-inv" data-id="' + esc(t.id) + '">' + ic('receipt_long', 'xs') + ' Buat Invoice</button>' : '') +
      '<button class="mini-btn danger" data-act="trx-del" data-id="' + esc(t.id) + '">' + ic('delete', 'xs') + ' Hapus</button></div>';
  }
  return '<div class="tx"><div class="tx-ico ' + (inn ? 'in' : 'out') + '">' + ic(inn ? 'arrow_downward' : 'arrow_upward') + '</div>' +
    '<div class="grow"><div class="tx-title">' + esc(title) + '</div>' +
    '<div class="tx-sub"><span>' + esc(full ? fmtDateTime(t.tanggal) : relDay(t.tanggal)) + '</span><span>·</span><span>' + esc(who) + '</span>' + tags.join('') + '</div>' + actions + '</div>' +
    '<div class="tx-amt"><b class="' + (inn ? 'in' : 'out') + '">' + rpSigned(t.nominal, t.jenis) + '</b><small>' + esc(t.metode || '') + '</small></div></div>';
}

function renderBeranda() {
  const d = S.dash, low = d.stokMenipis;
  const w = d.minggu, max = Math.max.apply(null, w.values.concat([1]));
  const growth = d.growth == null ? '' : '<b>' + (d.growth >= 0 ? '+' : '') + String(d.growth).replace('.', ',') + '%</b> vs bulan lalu';
  const sync = S.sync ? 'Tersinkron ke Google Sheets' : 'Memuat...';

  $('#view-beranda').innerHTML =
    '<div class="sync-row"><div class="grow"><span class="dot"></span>' + ic('cloud_done', 'xs') + ' ' + sync + '</div><span class="muted">' + esc(fmtDate(d.hariIni)) + '</span></div>' +
    '<div class="greet"><div><h1>Selamat Datang, ' + esc(S.user.nama) + '</h1><p>' + ic('storefront', 'sm') + ' ' + esc(d.toko) + '</p></div>' +
    '<button class="icon-btn" data-act="bell" aria-label="Notifikasi">' + ic('notifications') + (low.length ? '<span class="dot-badge"></span>' : '') + '</button></div>' +

    '<div class="hero"><div class="hero-top"><span>Saldo Kas Bersih • ' + esc(d.bulan) + '</span><span class="pill">Aktif</span></div>' +
    '<div class="hero-amount">' + rp(d.saldo) + '</div><div class="hero-growth">' + growth + '</div>' +
    '<div class="hero-split"><div><small>' + ic('arrow_circle_down', 'sm') + ' Total Pemasukan</small><b>' + rp(d.masuk) + '</b></div>' +
    '<div><small>' + ic('arrow_circle_up', 'sm') + ' Total Pengeluaran</small><b>' + rp(d.keluar) + '</b></div></div>' +
    '<div class="hero-foot"><span>Estimasi Laba Bersih<br>(Margin ' + String(d.margin).replace('.', ',') + '%)</span><b>' + (d.saldo >= 0 ? '+' : '') + rp(d.saldo) + '</b></div></div>' +

    '<div class="sec-head"><h2 style="font-size:15px">Aksi Cepat</h2><button data-act="to-laporan">Semua Pintasan</button></div>' +
    '<div class="chips scroll"><button class="chip chip-primary" data-act="quick" data-jenis="Pemasukan" style="height:48px;padding:0 1.1rem;font-size:15px">' + ic('add_circle') + ' Pemasukan</button>' +
    '<button class="chip chip-expense" data-act="quick" data-jenis="Pengeluaran" style="height:48px;padding:0 1.1rem;font-size:15px">' + ic('do_not_disturb_on') + ' Pengeluaran</button>' +
    '<button class="chip outline" data-act="to-laporan" style="height:48px;padding:0 1.1rem;font-size:15px">' + ic('picture_as_pdf') + ' Cetak Invoice</button></div>' +

    (low.length ? '<div class="alert-card" style="margin-top:1rem"><div class="row"><div class="ico">' + ic('inventory_2') + '</div><div class="grow"><h3>' + low.length + ' Produk Perlu Restok Segera</h3><p>Stok berada di bawah batas minimum</p></div>' +
      '<button class="btn btn-sm" style="background:#fff;color:var(--tertiary)" data-act="to-produk" data-filter="menipis">Lihat Stok</button></div>' +
      '<div class="row" style="margin-top:.7rem">' + low.slice(0, 2).map(p => '<div class="mini-prod">' + ic('shopping_bag', 'sm') + '<span>' + esc(p.nama) + '</span><span class="pill red">Sisa ' + p.stok + '</span></div>').join('') + '</div></div>' : '') +

    '<div class="card lift" style="margin-top:1rem"><div class="row between"><div><div class="card-title">Tren Pemasukan Mingguan</div><div class="card-sub">Senin s.d Minggu Ini</div></div>' +
    '<div style="text-align:right"><div class="card-sub">Rata-rata/hari</div><b class="up">' + rp(w.rataHarian) + '</b></div></div>' +
    '<div class="bars">' + w.values.map((v, i) => {
      const hi = i === w.hariIdx;
      return '<div class="bar-col"><span class="v ' + (hi ? 'hi' : '') + '">' + (v ? shortRp(v) : '') + '</span><div class="b ' + (hi ? 'hi' : '') + '" style="height:' + Math.max(3, v / max * 110) + 'px"></div><span class="l ' + (hi ? 'hi' : '') + '">' + w.labels[i] + '</span></div>';
    }).join('') + '</div></div>' +

    '<div class="sec-head"><h2>Transaksi Terbaru</h2><button data-act="to-trx">Lihat Semua</button></div>' +
    '<div class="card tx-list">' + (d.terbaru.length ? d.terbaru.map(t => txItem(t)).join('') : '<div class="empty">' + ic('receipt_long') + 'Belum ada transaksi.<br>Ketuk tombol + untuk mencatat.</div>') + '</div>';
}

// ============================================
// CATAT TRANSAKSI
// ============================================
const F = { jenis: 'Pemasukan', kategori: 'Penjualan Produk', metode: 'Tunai', idProduk: '', qty: 1, nominalAuto: false, file: null };

function buildCatat() {
  $('#view-catat').innerHTML =
    '<div class="stack" style="margin-top:.4rem">' +
    '<div class="banner">' + ic('bolt', 'sm') + ' Mode Kasir Instan • Target entri &lt; 30 detik <span class="pill">Auto-Sync ON</span></div>' +
    '<div class="seg" id="c-seg"><button type="button" class="in on" data-jenis="Pemasukan">' + ic('arrow_downward', 'sm') + ' Pemasukan (+)</button>' +
    '<button type="button" class="out" data-jenis="Pengeluaran">' + ic('arrow_upward', 'sm') + ' Pengeluaran (-)</button></div>' +

    '<div class="card"><div class="row"><span class="ico-box">' + ic('calendar_month') + '</span><div class="grow"><div class="card-sub">Tanggal &amp; Waktu Transaksi</div>' +
    '<input type="datetime-local" id="c-tgl" style="border:0;background:transparent;font-weight:600;font-size:15px;width:100%;outline:0"></div></div></div>' +

    '<div class="card"><div class="row between"><b>Nominal Transaksi</b><span class="pill mint" id="c-flow">Kas Masuk</span></div>' +
    '<div class="rp-input" id="c-rpbox" style="margin-top:.6rem"><span class="rp">Rp</span><input id="c-nominal" inputmode="numeric" placeholder="0" autocomplete="off"></div>' +
    '<div class="chips" style="margin-top:.6rem">' + [50000, 100000, 250000, 500000].map(n => '<button type="button" class="chip" data-add="' + n + '">+' + shortRp(n) + '</button>').join('') + '</div></div>' +

    '<div class="card"><b>Kategori Keuangan</b><div class="chips" id="c-kat" style="margin-top:.6rem"></div>' +
    '<div style="margin-top:.9rem"><b>Metode Pembayaran</b></div><div class="chips" id="c-metode" style="margin-top:.6rem"></div></div>' +

    '<div class="card" id="c-prod-card"><div class="row between"><b>' + ic('inventory_2', 'sm') + ' Kaitkan Produk (Potong Stok)</b><span class="muted small">Opsional</span></div>' +
    '<div class="input soft" style="margin-top:.6rem"><select id="c-prod"><option value="">Memuat produk...</option></select>' + ic('expand_more') + '</div>' +
    '<div class="sel-prod" id="c-prod-panel" hidden><div class="row"><div class="thumb" id="c-prod-img"></div><div class="grow"><b id="c-prod-name"></b><div class="muted small" id="c-prod-meta"></div></div></div>' +
    '<div class="row between" style="margin-top:.6rem"><div class="stepper"><button type="button" id="c-minus">' + ic('remove') + '</button><b id="c-qty">1</b><button type="button" id="c-plus">' + ic('add') + '</button></div>' +
    '<span class="pill green" id="c-stok"></span></div></div></div>' +

    '<div class="card" id="c-cust-card"><div class="row between"><b>Pelanggan</b><span class="muted small">Opsional</span></div>' +
    '<div class="input soft" style="margin-top:.6rem">' + ic('person') + '<input id="c-cust" list="c-cust-list" placeholder="Nama pelanggan" maxlength="80" autocomplete="off"><datalist id="c-cust-list"></datalist></div>' +
    '<div class="row" style="margin-top:.5rem"><div class="input soft grow">' + ic('call', 'sm') + '<input id="c-hp" inputmode="tel" placeholder="No. HP / WhatsApp" maxlength="20"></div>' +
    '<div class="input soft grow">' + ic('mail', 'sm') + '<input id="c-email" type="email" inputmode="email" placeholder="Email" maxlength="120"></div></div></div>' +

    '<div class="card"><b>Catatan Transaksi</b><div class="input soft" style="margin-top:.6rem">' + ic('notes') + '<input id="c-note" maxlength="300" placeholder="Contoh: pesanan via WhatsApp"></div></div>' +

    '<div class="card"><div class="row between"><b>' + ic('cloud_upload', 'sm') + ' Bukti Bayar / Nota</b><span class="pill" style="background:var(--sec-c);color:var(--on-sec-c)">Maks 5 MB • Drive</span></div>' +
    '<label class="file-box" style="margin-top:.6rem;cursor:pointer"><div class="thumb" id="c-file-img">' + ic('photo_camera') + '</div>' +
    '<div class="grow"><b id="c-file-name">Ketuk untuk ambil foto / pilih berkas</b><div class="muted small" id="c-file-meta">JPG, PNG, atau PDF</div></div>' +
    '<input type="file" id="c-file" accept="image/*,application/pdf" hidden></label></div>' +

    '<div class="card" id="c-inv-card"><div class="row"><span class="ico-box">' + ic('mark_email_read') + '</span><div class="grow"><b>Invoice Otomatis</b><div class="muted small">PDF ke Drive &amp; email pelanggan (bila ada)</div></div>' +
    '<label class="switch"><input type="checkbox" id="c-inv" checked><span></span></label></div></div>' +

    '<button class="btn btn-primary btn-block" id="c-submit" type="button">' + ic('bolt') + ' Simpan Transaksi (≤30 Detik)</button>' +
    '<p class="fine">' + ic('lock', 'xs') + ' Tersimpan otomatis ke sheet Transaksi</p></div>';

  const v = $('#view-catat');
  v.addEventListener('click', e => {
    const j = e.target.closest('[data-jenis]'); if (j) return setJenis(j.dataset.jenis);
    const a = e.target.closest('[data-add]'); if (a) { const n = digits($('#c-nominal').value) + Number(a.dataset.add); $('#c-nominal').value = fmtDigits(n); F.nominalAuto = false; return; }
    const k = e.target.closest('[data-kat]'); if (k) { F.kategori = k.dataset.kat; renderKat(); return; }
    const m = e.target.closest('[data-metode]'); if (m) { F.metode = m.dataset.metode; renderKat(); return; }
    if (e.target.closest('#c-minus')) return setQty(F.qty - 1);
    if (e.target.closest('#c-plus')) return setQty(F.qty + 1);
    if (e.target.closest('#c-submit')) return submitCatat();
  });
  $('#c-nominal').addEventListener('input', e => { e.target.value = fmtDigits(digits(e.target.value)); F.nominalAuto = false; });
  $('#c-prod').addEventListener('change', e => { F.idProduk = e.target.value; F.qty = 1; if (F.idProduk) F.kategori = 'Penjualan Produk'; renderKat(); updateProdPanel(true); });
  $('#c-cust').addEventListener('change', e => {
    const c = (S.form ? S.form.pelanggan : []).find(x => x.nama.toLowerCase() === e.target.value.trim().toLowerCase());
    if (c) { $('#c-hp').value = c.hp || ''; $('#c-email').value = c.email || ''; }
  });
  $('#c-file').addEventListener('change', onPickFile);
  $('#c-tgl').value = nowLocalInput();
  setJenis('Pemasukan');
}

function renderKat() {
  $('#c-kat').innerHTML = KAT[F.jenis].map(k => '<button type="button" class="chip ' + (F.kategori === k ? 'on' : '') + '" data-kat="' + esc(k) + '">' + esc(k) + '</button>').join('');
  $('#c-metode').innerHTML = METODE.map(m => '<button type="button" class="chip outline ' + (F.metode === m ? 'on' : '') + '" data-metode="' + m + '">' + m + '</button>').join('');
}

function setJenis(j) {
  F.jenis = j;
  if (KAT[j].indexOf(F.kategori) < 0) F.kategori = KAT[j][0];
  if (j === 'Pengeluaran') { F.idProduk = ''; F.qty = 1; $('#c-prod').value = ''; }
  $$('#c-seg button').forEach(b => b.classList.toggle('on', b.dataset.jenis === j));
  $$('#c-seg button').forEach(b => { b.classList.remove('in', 'out'); b.classList.add(b.dataset.jenis === 'Pemasukan' ? 'in' : 'out'); });
  const flow = $('#c-flow'); flow.textContent = j === 'Pemasukan' ? 'Kas Masuk' : 'Kas Keluar';
  flow.className = 'pill ' + (j === 'Pemasukan' ? 'mint' : 'red');
  $('#c-rpbox').classList.toggle('out', j === 'Pengeluaran');
  $('#c-prod-card').hidden = j !== 'Pemasukan';
  $('#c-cust-card').hidden = j !== 'Pemasukan';
  $('#c-inv-card').hidden = !(j === 'Pemasukan' && isOwner());
  renderKat(); updateProdPanel(false);
}

function setQty(n) {
  const p = prodById(F.idProduk); if (!p) return;
  F.qty = Math.min(Math.max(1, n), Math.max(1, p.stok));
  updateProdPanel(true);
}
function prodById(id) { return S.form ? S.form.produk.find(p => p.id === id) : null; }

function updateProdPanel(autoNominal) {
  const p = prodById(F.idProduk), panel = $('#c-prod-panel');
  panel.hidden = !p;
  if (!p) return;
  $('#c-prod-img').innerHTML = thumb(p.foto);
  $('#c-prod-name').textContent = p.nama;
  $('#c-prod-meta').textContent = (p.sku ? 'SKU: ' + p.sku + ' • ' : '') + rp(p.harga) + ' / ' + p.satuan;
  $('#c-qty').textContent = F.qty;
  const sisa = p.stok - F.qty, el = $('#c-stok');
  el.textContent = 'Stok: ' + p.stok + ' → ' + sisa + ' tersisa';
  el.className = 'pill ' + (sisa < 0 ? 'red' : sisa <= 3 ? 'warn' : 'green');
  if (autoNominal) { $('#c-nominal').value = fmtDigits(p.harga * F.qty); F.nominalAuto = true; }
}

function fillFormData() {
  if (!S.form) return;
  const sel = $('#c-prod');
  sel.innerHTML = '<option value="">— Tidak dikaitkan ke produk —</option>' + S.form.produk.map(p =>
    '<option value="' + esc(p.id) + '"' + (p.stok <= 0 ? ' disabled' : '') + (p.id === F.idProduk ? ' selected' : '') + '>' + esc(p.nama) + ' — ' + rp(p.harga) + (p.stok <= 0 ? ' (habis)' : ' (stok ' + p.stok + ')') + '</option>').join('');
  $('#c-cust-list').innerHTML = S.form.pelanggan.map(c => '<option value="' + esc(c.nama) + '"></option>').join('');
  if (F.idProduk && !prodById(F.idProduk)) F.idProduk = '';
  updateProdPanel(false);
}

async function loadCatat(opts) {
  if (opts.jenis) setJenis(opts.jenis);
  if (opts.invoice && isOwner()) $('#c-inv').checked = true;
  if (S.form) fillFormData();
  if (Date.now() - S.formAt > 60000) {
    const r = await API.post('getFormData');
    if (r.success) { S.form = r.data; S.formAt = Date.now(); fillFormData(); }
    else if (!S.form) { $('#c-prod').innerHTML = '<option value="">Gagal memuat produk</option>'; toast(r.message, 'error'); }
  }
}

async function onPickFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const p = await filePayload(f, true);
    F.file = f;
    $('#c-file-name').textContent = f.name;
    $('#c-file-meta').textContent = fmtSize(p.size) + ' • Siap diunggah ke Drive';
    $('#c-file-img').innerHTML = p.mime === 'application/pdf' ? ic('picture_as_pdf') : '<img alt="" src="data:' + p.mime + ';base64,' + p.base64 + '">';
  } catch (err) { F.file = null; e.target.value = ''; toast(err.message, 'error'); }
}

async function submitCatat() {
  const nominal = digits($('#c-nominal').value);
  if (!nominal) return toast('Isi nominal transaksi dulu.', 'error');
  const p = prodById(F.idProduk);
  if (F.jenis === 'Pemasukan' && p && F.qty > p.stok) return toast('Jumlah melebihi stok tersedia.', 'error');
  const btn = $('#c-submit'), label = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = 'Menyimpan...';
  try {
    const bukti = F.file ? await filePayload(F.file, true) : null;
    const r = await API.post('addTransaction', {
      jenis: F.jenis, tanggal: $('#c-tgl').value, nominal, kategori: F.kategori, metode: F.metode,
      idProduk: F.jenis === 'Pemasukan' ? F.idProduk : '', jumlah: F.jenis === 'Pemasukan' && F.idProduk ? F.qty : 0,
      pelanggan: F.jenis === 'Pemasukan' ? $('#c-cust').value : '', hp: $('#c-hp').value, email: $('#c-email').value,
      keterangan: $('#c-note').value,
      buatInvoice: isOwner() && F.jenis === 'Pemasukan' && $('#c-inv').checked,
      bukti: bukti ? { name: bukti.name, mime: bukti.mime, base64: bukti.base64 } : null
    });
    if (!r.success) { toast(r.message, 'error'); return; }
    invalidate();
    resetCatat();
    const inv = r.data.invoice;
    if (inv) showInvoiceSheet(r.data.id, inv);
    else toast('Transaksi ' + r.data.id + ' tersimpan.', 'success');
    if (r.data.warning) toast(r.data.warning, 'error');
    loadCatat({});
  } catch (err) { toast(err.message || 'Gagal menyimpan.', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = label; }
}

function resetCatat() {
  F.idProduk = ''; F.qty = 1; F.file = null; F.nominalAuto = false;
  ['c-nominal', 'c-cust', 'c-hp', 'c-email', 'c-note'].forEach(id => $('#' + id).value = '');
  $('#c-file').value = ''; $('#c-file-name').textContent = 'Ketuk untuk ambil foto / pilih berkas';
  $('#c-file-meta').textContent = 'JPG, PNG, atau PDF'; $('#c-file-img').innerHTML = ic('photo_camera');
  $('#c-prod').value = ''; $('#c-tgl').value = nowLocalInput();
  setJenis(F.jenis);
}

function showInvoiceSheet(trxId, inv) {
  openSheet(
    '<h2>' + ic('check_circle', 'fill') + ' Transaksi Tersimpan</h2>' +
    '<p class="muted">ID <b>' + esc(trxId) + '</b> · Invoice <b>' + esc(inv.no) + '</b> sudah dibuat dan disimpan di Google Drive.' + (inv.emailed ? ' Salinan sudah dikirim ke email pelanggan.' : '') + '</p>' +
    '<div class="actions"><a class="btn btn-primary" href="' + esc(inv.link) + '" target="_blank" rel="noopener">' + ic('picture_as_pdf') + ' Buka Invoice PDF</a>' +
    (inv.waLink ? '<a class="btn btn-mint" href="' + esc(inv.waLink) + '" target="_blank" rel="noopener">' + ic('chat') + ' Kirim via WhatsApp</a>' : '') +
    '<button class="btn btn-secondary" id="inv-close">Tutup</button></div>',
    sh => { $('#inv-close', sh).onclick = closeSheet; });
}

// ============================================
// PRODUK & STOK
// ============================================
async function loadProduk(opts) {
  if (opts.filter) S.prodFilter = opts.filter;
  const el = $('#view-produk');
  if (S.prod) renderProduk(); else el.innerHTML = skeleton();
  const r = await API.post('getProducts');
  if (!r.success) { if (!S.prod && S.view === 'produk') el.innerHTML = errorBox(r.message, 'retry'); return; }
  S.prod = r.data; S.sync = new Date();
  if (S.view === 'produk') renderProduk();
}

function renderProduk() {
  const r = S.prod.ringkas;
  $('#view-produk').innerHTML =
    '<div class="card lift" style="margin-top:.4rem"><div class="row between"><b>' + ic('warehouse', 'sm') + ' Ringkasan Gudang</b><span class="pill green">● Auto-Sync</span></div>' +
    '<div class="price-box" style="margin-top:.7rem"><div><small>Total Produk</small><b>' + r.total + ' <span style="font-size:13px;font-weight:600">Item</span></b></div><div><small>Total Nilai Stok</small><b>' + rp(r.nilaiStok) + '</b></div></div>' +
    '<p class="muted small" style="margin-top:.6rem">' + ic('table_chart', 'xs') + ' Tersinkron ke Google Sheets "Produk"</p></div>' +
    '<button class="btn btn-primary btn-block" style="margin-top:.8rem" data-act="prod-new">' + ic('add_circle') + ' Tambah Produk Baru</button>' +
    '<div class="search" style="margin-top:.8rem">' + ic('search') + '<input id="prod-q" placeholder="Cari nama barang atau kategori..." value="' + esc(S.prodQ) + '"></div>' +
    '<div class="chips scroll" id="prod-chips" style="margin-top:.7rem"></div>' +
    '<div id="prod-alert"></div><div class="stack" id="prod-list" style="margin-top:.8rem"></div>';
  renderProdChips(); renderProdList();
}

function renderProdChips() {
  const it = S.prod.items, menipis = it.filter(p => p.aktif && p.stok <= p.stokMin).length, kat = it.filter(p => p.tampil).length;
  const c = (f, label, extra) => '<button class="chip outline ' + (S.prodFilter === f ? 'on' : '') + '" data-act="prod-filter" data-f="' + f + '">' + label + (extra || '') + '</button>';
  $('#prod-chips').innerHTML = c('semua', 'Semua ' + it.length) + c('menipis', 'Stok Menipis', menipis ? ' <span class="count">' + menipis + '</span>' : '') + c('katalog', 'Aktif di Katalog ' + kat);
  $('#prod-alert').innerHTML = menipis ? '<div class="alert-card" style="margin-top:.7rem;display:flex;gap:.5rem;align-items:center;padding:.7rem .9rem"><span class="down">' + ic('warning') + '</span><span class="grow small" style="color:var(--tertiary);font-weight:600">' + menipis + ' produk butuh restok sebelum akhir pekan!</span><button class="small" style="color:var(--tertiary);font-weight:700;text-decoration:underline" data-act="prod-filter" data-f="menipis">Lihat</button></div>' : '';
}

function prodCard(p) {
  const habis = p.stok <= 0, low = p.stok <= p.stokMin;
  const stokPill = habis ? '<span class="pill" style="background:var(--surface-high);color:var(--slate-700)">' + ic('block', 'xs') + ' Stok: 0 ' + esc(p.satuan) + ' (Habis)</span>'
    : low ? '<span class="pill red">' + ic('error', 'xs') + ' Sisa ' + p.stok + ' ' + esc(p.satuan) + '</span> <span class="muted small">(Min: ' + p.stokMin + ' ' + esc(p.satuan) + ')</span>'
      : '<span class="pill green">' + ic('check_circle', 'xs') + ' Stok: ' + p.stok + ' ' + esc(p.satuan) + '</span>';
  return '<div class="prod-card ' + (habis ? 'habis' : '') + '" style="' + (p.aktif ? '' : 'opacity:.55') + '"><div class="prod-top">' +
    '<div class="prod-img">' + thumb(p.foto) + (p.sku ? '<span class="sku">' + esc(p.sku) + '</span>' : '') + '</div>' +
    '<div class="grow"><div class="row between"><span class="prod-cat">' + esc(p.kategori || 'Umum') + '</span><button aria-label="Ubah" data-act="prod-edit" data-id="' + esc(p.id) + '" style="color:var(--slate-500)">' + ic('edit', 'sm') + '</button></div>' +
    '<div class="prod-name">' + esc(p.nama) + '</div><div style="margin-top:.3rem">' + stokPill + (p.aktif ? '' : ' <span class="pill warn">Nonaktif</span>') + '</div></div></div>' +
    '<div class="price-box"><div><small>Harga Jual</small><b>' + rp(p.hargaJual) + '</b></div><div><small>Harga Modal</small><b style="color:var(--slate-700)">' + rp(p.hargaModal) + '</b></div></div>' +
    (habis ? '<div class="restock-note">Perlu restok sebelum akhir pekan</div>' : '') +
    '<div class="prod-foot"><label><span class="switch"><input type="checkbox" data-toggle="' + esc(p.id) + '" ' + (p.tampil ? 'checked' : '') + '><span></span></span> Tampil di Katalog</label>' +
    (habis ? '<button class="btn btn-danger-solid btn-sm" data-act="prod-stok" data-id="' + esc(p.id) + '">' + ic('assignment_add', 'sm') + ' Restok Sekarang</button>'
      : low ? '<button class="btn btn-mint btn-sm" data-act="prod-stok" data-id="' + esc(p.id) + '">' + ic('add', 'sm') + ' Tambah Stok</button>'
        : '<button class="btn btn-soft btn-sm" data-act="prod-stok" data-id="' + esc(p.id) + '">' + ic('add', 'sm') + ' Stok</button>') + '</div></div>';
}

function renderProdList() {
  const q = S.prodQ.trim().toLowerCase();
  let list = S.prod.items.slice();
  if (S.prodFilter === 'menipis') list = list.filter(p => p.aktif && p.stok <= p.stokMin);
  if (S.prodFilter === 'katalog') list = list.filter(p => p.tampil);
  if (q) list = list.filter(p => (p.nama + ' ' + p.kategori + ' ' + p.sku).toLowerCase().indexOf(q) >= 0);
  $('#prod-list').innerHTML = list.length ? list.map(prodCard).join('') : '<div class="empty">' + ic('inventory_2') + 'Tidak ada produk yang cocok.</div>';
}

function openStockSheet(p) {
  if (!p) return;
  openSheet(
    '<h2>' + (p.stok <= 0 ? 'Restok' : 'Tambah Stok') + '</h2><p class="muted">' + esc(p.nama) + ' · stok saat ini <b>' + p.stok + ' ' + esc(p.satuan) + '</b></p>' +
    '<label class="field-label">Jumlah (isi angka negatif untuk koreksi/mengurangi)</label>' +
    '<div class="input"><input id="st-n" type="number" step="1" inputmode="numeric" value="10"></div>' +
    '<p class="muted small" id="st-prev" style="margin-top:.4rem"></p>' +
    '<div class="actions two"><button class="btn btn-secondary" id="st-cancel">Batal</button><button class="btn btn-primary" id="st-save">Simpan</button></div>',
    sh => {
      const inp = $('#st-n', sh), prev = () => { const n = parseInt(inp.value, 10) || 0; $('#st-prev', sh).textContent = 'Stok baru: ' + (p.stok + n) + ' ' + p.satuan; };
      inp.addEventListener('input', prev); prev(); inp.focus(); inp.select();
      $('#st-cancel', sh).onclick = closeSheet;
      $('#st-save', sh).onclick = async () => {
        const n = parseInt(inp.value, 10) || 0;
        if (!n) return toast('Isi jumlah yang valid.', 'error');
        const b = $('#st-save', sh); b.disabled = true;
        const r = await API.post('adjustStock', { id: p.id, delta: n });
        b.disabled = false;
        if (!r.success) return toast(r.message, 'error');
        p.stok = r.data.stok; S.dash = null; S.formAt = 0; closeSheet(); renderProduk(); toast('Stok diperbarui.', 'success');
      };
    });
}

function openProductSheet(p) {
  const isNew = !p; p = p || { nama: '', kategori: '', sku: '', hargaJual: '', hargaModal: '', stok: 0, stokMin: 5, satuan: 'pcs', deskripsi: '', tampil: true, aktif: true, foto: '' };
  let picked = null;
  openSheet(
    '<h2>' + (isNew ? 'Tambah Produk Baru' : 'Ubah Produk') + '</h2>' +
    '<label class="file-box" style="cursor:pointer"><div class="thumb" id="pf-img" style="width:64px;height:64px">' + thumb(p.foto) + '</div><div class="grow"><b>Foto produk</b><div class="muted small" id="pf-meta">Ketuk untuk pilih foto (dikompres otomatis)</div></div><input type="file" id="pf-file" accept="image/*" hidden></label>' +
    '<label class="field-label">Nama produk *</label><div class="input"><input id="pf-nama" maxlength="100" value="' + esc(p.nama) + '"></div>' +
    '<div class="row"><div class="grow"><label class="field-label">Kategori</label><div class="input"><input id="pf-kat" maxlength="50" value="' + esc(p.kategori) + '"></div></div>' +
    '<div class="grow"><label class="field-label">SKU</label><div class="input"><input id="pf-sku" maxlength="30" value="' + esc(p.sku) + '"></div></div></div>' +
    '<div class="row"><div class="grow"><label class="field-label">Harga jual (Rp)</label><div class="input"><input id="pf-jual" inputmode="numeric" value="' + fmtDigits(p.hargaJual) + '"></div></div>' +
    '<div class="grow"><label class="field-label">Harga modal (Rp)</label><div class="input"><input id="pf-modal" inputmode="numeric" value="' + fmtDigits(p.hargaModal) + '"></div></div></div>' +
    '<div class="row">' + (isNew ? '<div class="grow"><label class="field-label">Stok awal</label><div class="input"><input id="pf-stok" type="number" min="0" inputmode="numeric" value="' + p.stok + '"></div></div>' : '') +
    '<div class="grow"><label class="field-label">Stok minimum</label><div class="input"><input id="pf-min" type="number" min="0" inputmode="numeric" value="' + p.stokMin + '"></div></div>' +
    '<div class="grow"><label class="field-label">Satuan</label><div class="input"><input id="pf-sat" maxlength="15" value="' + esc(p.satuan) + '"></div></div></div>' +
    (isNew ? '' : '<p class="muted small" style="margin-top:.4rem">Untuk mengubah jumlah stok, gunakan tombol "Tambah Stok".</p>') +
    '<label class="field-label">Deskripsi (tampil di katalog)</label><div class="input"><textarea id="pf-desc" rows="2" maxlength="500">' + esc(p.deskripsi) + '</textarea></div>' +
    '<div class="row between" style="margin-top:.8rem"><b>Tampil di Katalog</b><label class="switch"><input type="checkbox" id="pf-tampil" ' + (p.tampil ? 'checked' : '') + '><span></span></label></div>' +
    '<div class="row between" style="margin-top:.6rem"><b>Produk aktif</b><label class="switch"><input type="checkbox" id="pf-aktif" ' + (p.aktif ? 'checked' : '') + '><span></span></label></div>' +
    '<div class="actions two"><button class="btn btn-secondary" id="pf-cancel">Batal</button><button class="btn btn-primary" id="pf-save">Simpan</button></div>',
    sh => {
      ['pf-jual', 'pf-modal'].forEach(id => $('#' + id, sh).addEventListener('input', e => { e.target.value = fmtDigits(digits(e.target.value)); }));
      $('#pf-file', sh).addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        try { const pl = await filePayload(f, false); picked = pl; $('#pf-meta', sh).textContent = fmtSize(pl.size) + ' • siap diunggah'; $('#pf-img', sh).innerHTML = '<img alt="" src="data:' + pl.mime + ';base64,' + pl.base64 + '">'; }
        catch (err) { picked = null; e.target.value = ''; toast(err.message, 'error'); }
      });
      $('#pf-cancel', sh).onclick = closeSheet;
      $('#pf-save', sh).onclick = async () => {
        const nama = $('#pf-nama', sh).value.trim();
        if (!nama) return toast('Nama produk wajib diisi.', 'error');
        const b = $('#pf-save', sh); b.disabled = true; b.textContent = 'Menyimpan...';
        const r = await API.post('saveProduct', {
          id: isNew ? '' : p.id, nama, kategori: $('#pf-kat', sh).value, sku: $('#pf-sku', sh).value,
          hargaJual: digits($('#pf-jual', sh).value), hargaModal: digits($('#pf-modal', sh).value),
          stok: isNew ? parseInt($('#pf-stok', sh).value, 10) || 0 : 0, stokMin: parseInt($('#pf-min', sh).value, 10) || 0,
          satuan: $('#pf-sat', sh).value, deskripsi: $('#pf-desc', sh).value,
          tampil: $('#pf-tampil', sh).checked, aktif: $('#pf-aktif', sh).checked,
          foto: picked ? { name: picked.name, mime: picked.mime, base64: picked.base64 } : null
        });
        b.disabled = false; b.textContent = 'Simpan';
        if (!r.success) return toast(r.message, 'error');
        closeSheet(); invalidate(); toast('Produk tersimpan.', 'success'); loadProduk({});
      };
    });
}

// ============================================
// LAPORAN
// ============================================
async function loadLaporan() {
  const el = $('#view-laporan'), key = S.periode;
  if (S.report[key]) renderLaporan(S.report[key]); else el.innerHTML = skeleton();
  const r = await API.post('getReport', { periode: key });
  if (!r.success) { if (!S.report[key] && S.view === 'laporan') el.innerHTML = errorBox(r.message, 'retry'); return; }
  S.report[key] = r.data;
  if (S.view === 'laporan' && S.periode === key) renderLaporan(r.data);
}

function renderLaporan(r) {
  const n = new Date(), y = n.getFullYear();
  const chip = (p, label) => '<button class="chip ' + (S.periode === p ? 'chip-primary' : 'outline') + '" data-act="periode" data-p="' + p + '" style="' + (S.periode === p ? '' : '') + '">' + label + '</button>';
  const max = Math.max.apply(null, r.tren.map(t => Math.max(t.masuk, t.keluar)).concat([1]));
  const last = r.tren.length - 1;
  $('#view-laporan').innerHTML =
    '<div style="margin:.3rem 0 .6rem"><div class="small muted" style="font-weight:700;letter-spacing:.04em">LAPORAN &amp; ANALISIS</div>' +
    '<div class="row between"><h1 class="page-title" style="margin:0">Kinerja Finansial Usaha</h1></div></div>' +
    '<div class="chips scroll">' + chip('bulan_ini', ic('calendar_month', 'sm') + ' Bulan Ini (' + BLN[n.getMonth()] + ' ' + y + ')') + chip('bulan_lalu', 'Bulan Lalu') + chip('tahun_ini', 'Tahun ' + y) + '</div>' +

    '<div class="card lift" style="margin-top:.9rem"><div class="row between"><span class="muted">Laba Bersih Operasional</span>' +
    (r.growth != null ? '<span class="pill ' + (r.growth >= 0 ? 'mint' : 'red') + '">' + ic(r.growth >= 0 ? 'trending_up' : 'trending_down', 'xs') + ' ' + (r.growth >= 0 ? '+' : '') + String(r.growth).replace('.', ',') + '%</span>' : '') + '</div>' +
    '<div style="font-size:32px;font-weight:800;letter-spacing:-.02em;color:' + (r.laba >= 0 ? 'var(--primary)' : 'var(--tertiary)') + '">' + rp(r.laba) + '</div>' +
    '<div class="row" style="margin-top:.6rem;align-items:stretch"><div class="inv grow">' + '<div class="row small up"><b>' + ic('arrow_circle_down', 'sm') + ' Pemasukan</b></div><b style="font-size:17px">' + rp(r.masuk) + '</b><div class="muted small">Dari ' + r.countMasuk + ' pesanan</div></div>' +
    '<div class="inv grow"><div class="row small down"><b>' + ic('arrow_circle_up', 'sm') + ' Pengeluaran</b></div><b style="font-size:17px;color:var(--tertiary)">' + rp(r.keluar) + '</b><div class="muted small">Bahan &amp; operasional</div></div></div>' +
    '<div class="inv row between" style="margin-top:.6rem"><span class="small">' + ic('receipt_long', 'sm') + ' Total Transaksi: <b>' + r.countTotal + ' nota</b></span><span class="small muted">Rata-rata: <b>' + rp(r.rataTrx) + '</b></span></div></div>' +

    '<div class="card" style="margin-top:.9rem"><div class="card-title">Tren Arus Kas Bulanan</div><div class="card-sub">Perbandingan 4 bulan terakhir (Jutaan Rp)</div>' +
    '<div class="legend"><span><i style="background:var(--primary)"></i>Pemasukan</span><span><i style="background:var(--tertiary)"></i>Pengeluaran</span></div>' +
    '<div class="gbars">' + r.tren.map((t, i) => '<div class="gcol">' + (i === last && t.masuk ? '<span class="tag" style="position:absolute;top:0">' + shortRp(t.masuk) + '</span>' : '') +
      '<div class="gpair"><i class="m" style="height:' + Math.max(2, t.masuk / max * 125) + 'px;align-self:flex-end"></i><i class="k" style="height:' + Math.max(2, t.keluar / max * 125) + 'px;align-self:flex-end"></i></div></div>').join('') + '</div>' +
    '<div class="glabels">' + r.tren.map((t, i) => '<span' + (i === last ? ' style="color:var(--primary);font-weight:800"' : '') + '>' + t.label + (i === last ? ' ★' : '') + '</span>').join('') + '</div>' +
    '<div class="insight">' + ic('auto_awesome', 'sm') + '<span>' + esc(r.insight) + '</span></div></div>' +

    '<div class="card" style="margin-top:.9rem"><div class="row between"><div><div class="card-title">3 Produk Terlaris</div><div class="card-sub">Kontribusi terbesar omzet ' + esc(r.label) + '</div></div></div><div class="stack" style="margin-top:.7rem">' +
    (r.top.length ? r.top.map((t, i) => '<div class="rank"><div class="thumb">' + thumb(t.foto) + '<span class="no">' + (i + 1) + '</span></div><div class="grow"><b>' + esc(t.nama) + '</b><div class="muted small">' + t.terjual + ' terjual</div></div><div style="text-align:right"><b>' + rp(t.omzet) + '</b><div class="small up" style="font-weight:700">' + String(t.porsi).replace('.', ',') + '% Omzet</div></div></div>').join('') : '<div class="empty" style="padding:1rem">Belum ada penjualan produk pada periode ini.</div>') + '</div></div>' +

    '<div class="card" style="margin-top:.9rem"><div class="row"><span class="ico-box">' + ic('print') + '</span><div class="grow"><div class="card-title">Cetak &amp; Sinkronisasi</div><div class="card-sub">Ekspor laporan standar UMKM</div></div><span class="pill mint">Aktif</span></div>' +
    '<button class="btn btn-primary btn-block" style="margin-top:.8rem" data-act="pdf">' + ic('picture_as_pdf') + ' Unduh Laporan PDF (Simpan ke Drive)</button>' +
    '<button class="btn btn-soft btn-block" style="margin-top:.5rem" data-act="email-rekap">' + ic('forward_to_inbox') + ' Kirim Rekap ke Gmail Pemilik</button>' +
    '<div class="insight" style="background:var(--surface-low);color:var(--slate-700)">' + ic('schedule', 'sm') + '<span><b>Otomasi rekap bulanan aktif.</b> Trigger kirim otomatis tiap tanggal 1 pukul 07:00 WIB via Gmail dan tersimpan di Google Drive.</span></div></div>' +

    '<div class="card" style="margin-top:.9rem"><div class="row between"><div><div class="card-title">Riwayat Invoice Terakhir</div><div class="card-sub">Dokumen penagihan &amp; tanda bayar digital</div></div></div><div class="stack" style="margin-top:.7rem">' +
    (r.invoices.length ? r.invoices.map(v => '<div class="inv"><div class="row between"><b>' + esc(v.no) + '</b><b>' + rp(v.nominal) + '</b></div><div class="row between small muted" style="margin-top:.2rem"><span>Pelanggan: <b style="color:var(--ink)">' + esc(v.pelanggan) + '</b></span><span>' + esc(fmtDate(v.tanggal)) + '</span></div>' +
      '<div class="row between" style="margin-top:.5rem"><span class="small up" style="font-weight:600">' + ic('check_circle', 'xs') + ' Tersimpan di Drive</span><span class="row"><a class="mini-btn" href="' + esc(v.link) + '" target="_blank" rel="noopener">' + ic('visibility', 'xs') + ' Lihat</a><button class="mini-btn" style="background:var(--primary);color:#fff" data-act="share-inv" data-no="' + esc(v.no) + '" data-link="' + esc(v.link) + '">' + ic('share', 'xs') + ' Kirim</button></span></div></div>').join('')
      : '<div class="empty" style="padding:1rem">Belum ada invoice.</div>') + '</div>' +
    '<div class="row" style="margin-top:.8rem"><button class="btn btn-mint grow" data-act="new-invoice">' + ic('add_circle', 'sm') + ' Buat Invoice Baru</button><button class="btn btn-soft grow" data-act="drive">' + ic('folder_open', 'sm') + ' Folder Drive</button></div></div>';
}

async function exportPdf() {
  showLoading(true);
  const r = await API.post('exportReportPdf', { periode: S.periode });
  showLoading(false);
  if (!r.success) return toast(r.message, 'error');
  toast(r.message, 'success');
  window.open(r.data.link, '_blank', 'noopener');
}
async function emailRekap() {
  showLoading(true);
  const r = await API.post('sendReportEmail', { periode: S.periode });
  showLoading(false);
  toast(r.message, r.success ? 'success' : 'error');
}
function shareInvoice(no, link) {
  const text = 'Invoice ' + no + ': ' + link;
  if (navigator.share) navigator.share({ title: 'Invoice ' + no, text, url: link }).catch(() => { });
  else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
}

// ============================================
// SEMUA TRANSAKSI
// ============================================
let _trxTimer;
function loadTransaksi() {
  const v = $('#view-transaksi');
  if (!$('#trx-q')) {
    v.innerHTML = '<div class="row" style="margin:.2rem 0 .7rem"><button class="icon-btn" data-act="back" aria-label="Kembali">' + ic('arrow_back') + '</button><h1 class="page-title" style="margin:0">Semua Transaksi</h1></div>' +
      '<div class="search">' + ic('search') + '<input id="trx-q" placeholder="Cari kategori, produk, pelanggan..."></div>' +
      '<div class="chips" id="trx-chips" style="margin:.7rem 0"></div><div class="card tx-list" id="trx-list"></div>';
    $('#trx-q').addEventListener('input', e => { S.trxQ = e.target.value; clearTimeout(_trxTimer); _trxTimer = setTimeout(fetchTrx, 350); });
  }
  $('#trx-chips').innerHTML = [['', 'Semua'], ['Pemasukan', 'Pemasukan'], ['Pengeluaran', 'Pengeluaran']].map(x =>
    '<button class="chip outline ' + (S.trxJenis === x[0] ? 'on' : '') + '" data-act="trx-filter" data-j="' + x[0] + '">' + x[1] + '</button>').join('');
  fetchTrx();
}
async function fetchTrx() {
  const list = $('#trx-list');
  list.innerHTML = '<div class="skel" style="height:140px;margin:.8rem 0"></div>';
  const r = await API.post('getTransactions', { q: S.trxQ, jenis: S.trxJenis });
  if (!r.success) { list.innerHTML = errorBox(r.message, 'retry'); return; }
  list.innerHTML = r.data.items.length
    ? r.data.items.map(t => txItem(t, true)).join('') + (r.data.total > r.data.items.length ? '<p class="fine">Menampilkan ' + r.data.items.length + ' dari ' + r.data.total + ' transaksi. Persempit dengan pencarian.</p>' : '')
    : '<div class="empty">' + ic('receipt_long') + 'Tidak ada transaksi.</div>';
}
async function deleteTrx(id) {
  const ok = await confirmBox('Hapus transaksi?', 'Transaksi ' + id + ' akan dihapus permanen dari Google Sheets. Jika ini penjualan produk, stok dikembalikan.', 'Hapus', true);
  if (!ok) return;
  showLoading(true);
  const r = await API.post('deleteTransaction', { id });
  showLoading(false);
  if (!r.success) return toast(r.message, 'error');
  invalidate(); toast(r.message, 'success'); fetchTrx();
}
async function makeInvoice(id) {
  showLoading(true);
  const r = await API.post('createInvoice', { id });
  showLoading(false);
  if (!r.success) return toast(r.message, 'error');
  invalidate(); showInvoiceSheet(id, r.data); fetchTrx();
}
