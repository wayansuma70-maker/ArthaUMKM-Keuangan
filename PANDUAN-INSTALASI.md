# 📋 PANDUAN INSTALASI — ArthaUMKM

Template Keuangan Otomatis UMKM · Backend: Google Apps Script · Frontend: GitHub Pages

---

## BAGIAN 1 — BACKEND (Google Apps Script)

1. Buka https://script.google.com → **Proyek Baru**.
2. Rename file `Code.gs` → **`Kode`**, hapus isinya, lalu **paste seluruh isi `Kode.gs`**.
3. Tampilkan manifest: ⚙️ **Project Settings** → centang **"Show appsscript.json manifest file in editor"**. Buka `appsscript.json`, ganti isinya dengan file `appsscript.json` yang diberikan (zona waktu Asia/Jakarta).
4. Jalankan **`setupAppEnvironment()` — HANYA SEKALI**:
   - Dropdown fungsi → pilih `setupAppEnvironment` → ▶ **Run**.
   - Klik **Review permissions** → pilih akun → izinkan akses Drive, Sheets, Gmail.
   - Buka **Execution Log**, pastikan semua ✅ muncul.
   - **CATAT email & PIN login** yang tampil di log (🔐 AKUN LOGIN). PIN hanya tampil sekali.
   - Cek Google Drive: folder `📁 ArthaUMKM — Keuangan UMKM` (berisi Foto_Produk, Bukti_Pembayaran, Invoice_PDF, Laporan_PDF dan spreadsheet database).
   - ⚠️ **Jangan jalankan setup lebih dari sekali.** Jika terpanggil lagi, fungsi akan berhenti sendiri dan tidak membuat duplikat.
5. **Deploy** → **New deployment** → jenis **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy** → **COPY URL** yang berakhiran **`/exec`**.
6. Setiap kali Anda mengubah `Kode.gs`, lakukan **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (URL tetap sama).

### Setelah setup
| Keperluan | Cara |
|---|---|
| Ganti email pemilik / karyawan | Buka spreadsheet → sheet **Pengguna** → edit kolom **Email** |
| Ganti / reset PIN | Edit `EMAIL` dan `PIN` di fungsi **`setPinPengguna()`** → Run |
| Isi profil usaha (tampil di invoice & katalog) | Sheet **Pengaturan**: Nama_Usaha, Alamat, Kontak, **WhatsApp** (format 08xx atau 62xx), Email_Notifikasi |
| Hapus data contoh sebelum dipakai sungguhan | Jalankan fungsi **`hapusDataContoh()`** |

> 🔒 PIN disimpan sebagai hash (SHA-256 + salt), bukan teks asli. Login dibatasi 5 kali salah per 5 menit.

---

## BAGIAN 2 — FRONTEND (GitHub Pages)

> 📁 **Folder kerja = folder hasil ekstraksi ZIP (`artha-umkm`).**
> Di folder itulah `index.html` berada, dan **di folder itulah `git init` dijalankan**.
> Jangan masuk lebih dalam, jangan naik satu level.

### 2.1 Isi URL backend (WAJIB sebelum push pertama)
Buka **`js/config.js`**, ganti tulisan `ISI_URL_EXEC_DARI_APPS_SCRIPT_DI_SINI` dengan URL `/exec` dari langkah 5 di atas:

```js
window.APP_CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec'
};
```

### 2.2 Verifikasi isi folder
Di dalam folder `artha-umkm`, jalankan:

```powershell
dir
```
(Mac/Linux/Git Bash: `ls -la`). Yang **harus** terlihat: `index.html`, `katalog.html`, folder `css`, folder `js`.
Jika yang terlihat justru folder lain (bukan `index.html`), Anda berada di folder yang salah.

### 2.3 Push ke GitHub (satu perintah per langkah)
```bash
git init
git add .
git commit -m "Upload pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```
- Repo di GitHub harus **Public** dan dibuat **tanpa** README/.gitignore/license.
- Saat diminta *password*, gunakan **Personal Access Token** (scope `repo`), bukan password akun. Saat mengetik/paste token, layar memang tampak kosong — itu normal.

### 2.4 Aktifkan GitHub Pages
Repo → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch **main** · **/(root)** → **Save** (centang **Enforce HTTPS**).
Tunggu 1–2 menit → situs tayang di `https://USERNAME.github.io/NAMA-REPO/`

### 2.5 Update di kemudian hari
```bash
git add .
git commit -m "Deskripsi perubahan"
git push
```
Jika tampilan masih lama: **Ctrl+Shift+R**.

---

## BAGIAN 3 — UJI COBA

1. Buka URL GitHub Pages → login dengan email & PIN dari log setup (Pemilik).
2. **Beranda** menampilkan saldo, grafik mingguan, transaksi terbaru (data contoh).
3. Ketuk **＋ Catat** → isi nominal → **Simpan** → cek sheet **Transaksi** bertambah.
4. Pilih produk → stok berkurang otomatis di sheet **Produk**.
5. Aktifkan **Invoice Otomatis** → PDF muncul di Drive › `Invoice_PDF`.
6. Buka `…/katalog.html` tanpa login → hanya produk bertanda "Tampil di Katalog".
7. Login sebagai **Karyawan** → hanya form catat transaksi yang tampil.
8. Chrome DevTools (F12) › Network: pastikan tidak ada error CORS.

---

## 🧩 Catatan Penting

- **Hak akses dicek di server**, bukan hanya disembunyikan di tampilan.
- **Karyawan** hanya bisa mencatat transaksi (tanpa melihat saldo/riwayat/produk modal). Pembuatan invoice hanya untuk Pemilik.
- **Kuota email Gmail:** ±100 penerima/hari (akun gratis). Cukup untuk ±20 transaksi/hari.
- **Link invoice** dibagikan "siapa pun yang punya link" agar bisa dikirim lewat WhatsApp. Bukti bayar/nota tetap **privat**.
- **WhatsApp** dibuka lewat tautan `wa.me` (pesan siap kirim) — tidak dikirim otomatis dari server.
- **Foto** dikompres di browser (maks 1280 px) sebelum diunggah; batas 5 MB.
- **Sesi login** berlaku 6 jam, lalu perlu masuk ulang.
- Aplikasi ini sengaja tidak menyertakan: edit transaksi (hanya hapus + catat ulang), halaman kelola pelanggan terpisah, dan halaman pengaturan di dalam aplikasi (pengaturan lewat sheet **Pengaturan**).

## 🛠️ Troubleshooting cepat

| Gejala | Penyebab | Solusi |
|---|---|---|
| "URL backend belum diisi" | `js/config.js` belum diedit | Isi `GAS_URL`, lalu `git add . && git commit -m "fix config" && git push` |
| "Respons server tidak valid" | Deploy salah | Deploy ulang: Execute as **Me**, access **Anyone** |
| Login selalu gagal | PIN salah / email beda | Jalankan `setPinPengguna()` |
| Perubahan backend tidak terasa | Belum deploy versi baru | Manage deployments → New version |
| Halaman 404 di GitHub Pages | `git init` di folder yang salah | Pastikan `index.html` terlihat di root repo di github.com |
| Halaman tanpa styling | Struktur folder rata | Pastikan folder `css/` dan `js/` ada di repo |
| Foto produk tidak tampil | Pengaturan berbagi Drive diblokir (akun Workspace) | Buka folder Foto_Produk di Drive → bagikan "Siapa saja dengan link" |
