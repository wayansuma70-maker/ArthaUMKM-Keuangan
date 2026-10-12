// ============================================
// KATALOG PUBLIK — tanpa login, hanya data aman
// ============================================
const K = { data: null, kat: '', q: '' };

document.addEventListener('DOMContentLoaded', async () => {
  const grid = $('#cat-grid');
  grid.innerHTML = '<div class="skel" style="height:220px"></div><div class="skel" style="height:220px"></div>';
  const r = await API.get('getCatalog');
  if (!r.success) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><span class="ms">cloud_off</span>' + esc(r.message || 'Gagal memuat katalog.') + '</div>';
    return;
  }
  K.data = r.data;
  document.title = 'Katalog — ' + K.data.toko.nama;
  $('#cat-nama').textContent = K.data.toko.nama;
  $('#cat-desc').textContent = [K.data.toko.deskripsi, K.data.toko.alamat].filter(Boolean).join(' • ');
  $('#cat-q').addEventListener('input', e => { K.q = e.target.value; renderGrid(); });
  $('#cat-chips').addEventListener('click', e => { const c = e.target.closest('[data-k]'); if (c) { K.kat = c.dataset.k; renderChips(); renderGrid(); } });
  $('#cat-grid').addEventListener('click', e => {
    const b = e.target.closest('[data-order]'); if (!b) return;
    const p = K.data.items.find(x => x.id === b.dataset.order);
    const wa = K.data.toko.whatsapp;
    const text = 'Halo, saya tertarik dengan ' + p.nama + ' (' + rp(p.harga) + '). Apakah masih tersedia?';
    window.open('https://wa.me/' + (wa || '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  });
  renderChips(); renderGrid();
});

function renderChips() {
  const cats = Array.from(new Set(K.data.items.map(p => p.kategori).filter(Boolean)));
  $('#cat-chips').innerHTML = [''].concat(cats).map(c => '<button class="chip outline ' + (K.kat === c ? 'on' : '') + '" data-k="' + esc(c) + '">' + (c ? esc(c) : 'Semua') + '</button>').join('');
}

function renderGrid() {
  const q = K.q.trim().toLowerCase();
  const list = K.data.items.filter(p => (!K.kat || p.kategori === K.kat) && (!q || (p.nama + ' ' + p.kategori + ' ' + p.deskripsi).toLowerCase().indexOf(q) >= 0));
  $('#cat-grid').innerHTML = list.length ? list.map(p =>
    '<div class="p-card"><div class="p-img">' + thumb(p.foto) + '<span class="pill ' + (p.tersedia ? 'green' : 'red') + '">' + (p.tersedia ? 'Tersedia' : 'Habis') + '</span></div>' +
    '<div class="p-body"><span class="cat">' + esc(p.kategori || 'Umum') + '</span><h3>' + esc(p.nama) + '</h3>' +
    '<span class="small muted">' + esc(p.deskripsi) + '</span><span class="price">' + rp(p.harga) + '</span>' +
    '<button class="btn btn-primary" data-order="' + esc(p.id) + '"' + (p.tersedia ? '' : ' disabled') + '><span class="ms sm">chat</span> Pesan via WhatsApp</button></div></div>').join('')
    : '<div class="empty" style="grid-column:1/-1"><span class="ms">inventory_2</span>Belum ada produk yang ditampilkan.</div>';
}
