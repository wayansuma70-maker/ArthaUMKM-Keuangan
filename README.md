# ArthaUMKM — Frontend

Aplikasi keuangan otomatis untuk UMKM (HTML/CSS/JS vanilla). Backend: Google Apps Script (REST API).

## Struktur
```
index.html        ← aplikasi utama (Pemilik & Karyawan)
katalog.html      ← katalog produk publik
css/style.css
js/config.js      ← ISI GAS_URL DI SINI sebelum push
js/api.js  js/utils.js  js/app.js  js/katalog.js
PANDUAN-INSTALASI.md
```

## Cepat
1. Deploy backend (lihat PANDUAN-INSTALASI.md) dan salin URL `/exec`.
2. Edit `js/config.js` → isi `GAS_URL`.
3. `git init` di folder ini → push → aktifkan GitHub Pages (branch main, root).
