
# PKasir - aplikasi POS desktop offline open source untuk UMKM

PKasir adalah aplikasi Point of Sale (POS) desktop yang dirancang untuk bekerja secara offline, untuk usaha kecil, kedai kopi, restoran, kios, minimarket, dan toko retail. Aplikasi ini berjalan lokal dengan backend Rust berbasis Tauri v2, frontend React, dan penyimpanan SQLite, sehingga operasional kasir harian tidak bergantung pada koneksi internet dan tanpa ada biaya langganan.

#MERDEKAdariBIAYALANGGANAN

## Default password 
000000

## Sreenshots 
### Layar Kasir
<img width="1919" height="1052" alt="image" src="https://github.com/user-attachments/assets/64694c30-885c-4045-bb58-eaa93a3d01ca" />
### Layar Customer
<img width="1361" height="768" alt="image" src="https://github.com/user-attachments/assets/97c85943-367c-48b4-bc7a-ae67ea6bf965" />


## Kenapa PKasir

- POS desktop offline dengan data SQLite lokal
- Backend native handal dan ringan menggunakan Rust dan Tauri v2
- Antarmuka modern berbasis React 19 dan Tailwind CSS
- Dirancang untuk alur kerja retail dan F&B di Indonesia
- Support pembayaran QRIS, termasuk mode QRIS statis dan dinamis (manual check).
- Dukungan printer thermal untuk cetak struk.
- Inventaris, pemasok, purchase order, resep, laporan, pengguna, dan pengaturan dalam satu aplikasi

## Daftar isi

- [Fitur](#fitur)
- [Layar dan modul](#layar-dan-modul)
- [Tech stack](#tech-stack)
- [Arsitektur](#arsitektur)
- [Mulai cepat](#mulai-cepat)
- [Perintah development](#perintah-development)
- [Build installer](#build-installer)
- [Struktur proyek](#struktur-proyek)
- [Catatan data, backup, dan keamanan](#catatan-data-backup-dan-keamanan)
- [Kontribusi](#kontribusi)
- [Topik SEO](#topik-seo)
- [Lisensi](#lisensi)

## Fitur

### POS dan checkout

- Pencarian produk dengan shortcut keyboard untuk mempercepat kerja kasir
- Manajemen cart dengan kontrol jumlah, varian produk, catatan, nama meja, dan pilihan pelanggan
- Metode pembayaran: tunai, kartu, QRIS, dan bayar nanti/held order
- Dialog pembayaran tunai dengan input uang diterima dan hitung kembalian
- Dialog pembayaran QRIS dengan gambar QR statis atau QR dinamis sesuai nominal transaksi
- Customer display untuk menampilkan cart dan pembayaran QRIS ke pelanggan
- Tahan dan lanjutkan pesanan untuk dine-in, tagihan tertunda, atau checkout yang terputus
- Cetak ulang struk terakhir dan cetak pesanan dapur
- Virtual keyboard opsional untuk setup kasir layar sentuh
- Efek suara cart yang bisa dikonfigurasi

### Produk dan inventaris

- CRUD produk dengan gambar, kategori, unit, harga modal, harga jual, stok, pemasok, reorder point, dan varian
- Dashboard inventaris untuk memantau stok
- Tracking batch dan tanggal kedaluwarsa untuk produk yang perlu kontrol lot
- Dukungan deduksi batch FEFO di backend Rust
- Ledger pergerakan stok untuk penyesuaian, penjualan, penerimaan, dan audit
- Pencarian batch mendekati kedaluwarsa dan visibilitas stok menipis
- Validasi agar harga produk tidak bernilai negatif

### Bahan baku dan recipe costing

- Master data bahan baku
- Editor resep untuk menghubungkan bahan baku ke produk jual
- Perhitungan otomatis biaya resep per produk
- Visibilitas margin dari biaya bahan dibanding harga jual
- Pengurangan stok bahan baku setelah penjualan selesai
- Indikator stok menipis untuk bahan baku

### Pelanggan dan loyalitas

- Database pelanggan dengan nomor telepon dan poin loyalitas
- Poin loyalitas didapat dari transaksi
- Penukaran poin saat checkout berdasarkan aturan yang dapat dikonfigurasi
- Pengaturan minimum poin redeem dan nilai tukar poin
- Saldo poin pelanggan diperbarui setelah transaksi

### Diskon dan promo

- Manajemen diskon dengan status aktif/nonaktif
- Dukungan diskon persentase atau nominal tetap
- Penjadwalan berdasarkan rentang tanggal
- Filter diskon berdasarkan produk tertentu atau kategori
- Prioritas diskon untuk pemilihan saat checkout

### Transaksi dan laporan

- Riwayat transaksi dengan pagination
- Detail transaksi berisi kasir, pelanggan, item, meja, metode pembayaran, diskon, pajak, dan service charge
- Modul dashboard untuk ringkasan penjualan
- Modul laporan dengan omset, jumlah transaksi, rata-rata transaksi, laba kotor, diskon, margin, produk terlaris, dan daftar transaksi
- Export laporan PDF menggunakan jsPDF dan jspdf-autotable
- Export CSV bergaya Excel untuk data arus kas

### Arus kas dan alat bantu akuntansi

- Pencatatan pemasukan dan pengeluaran
- Kategori arus kas yang bisa dikonfigurasi
- Data arus kas dengan pagination
- Export CSV yang bisa dibuka di aplikasi spreadsheet
- Penerimaan purchase order dapat mencatat biaya pembelian ke arus kas

### Pemasok dan purchase order

- CRUD pemasok dengan contact person, telepon, email, alamat, dan catatan
- Pembuatan, pembaruan, penghapusan, dan penerimaan purchase order
- Penyimpanan item purchase order dan perhitungan total
- Terima purchase order ke stok dan catat arus kas terkait

### Printing dan struk

- Fallback cetak browser untuk printer standar
- Integrasi printer thermal Tauri untuk USB/Bluetooth melalui `tauri-plugin-thermal-printer`
- Cetak network ESC/POS menggunakan IP dan port
- Opsi kertas 58mm dan 80mm
- Struk mendukung logo, header, footer, pajak, service charge, kasir, pelanggan, meja, catatan, diskon, dan metode pembayaran
- Opsi buka laci kas
- Konfigurasi character set untuk printer ESC/POS
- Fallback preview HTML untuk printer virtual seperti Print to PDF

### Pembayaran QRIS

- Upload gambar QRIS statis dan decode di frontend menggunakan `jsqr`
- Validasi struktur payload QRIS dan CRC-16/CCITT-FALSE
- Ekstraksi nama merchant dan kota dari data TLV QRIS
- Mode QRIS statis untuk menampilkan gambar QR yang di-upload
- Mode QRIS dinamis untuk membuat string QRIS sesuai nominal transaksi di Rust
- Tampilan QRIS realtime di dialog kasir dan customer display

### Backup dan restore

- Backup manual database SQLite
- Restore database dari file backup pilihan pengguna
- Pilih folder backup lewat dialog file native
- Backup otomatis saat startup jika sudah jatuh tempo
- Backup otomatis berkala berdasarkan interval yang dikonfigurasi
- Informasi path dan ukuran database di pengaturan

### Email alert

- Pengaturan SMTP untuk notifikasi email stok menipis
- Konfigurasi STARTTLS/plain SMTP
- Pengaturan pengirim, username, password, penerima, dan ambang batas stok
- Tombol test email di pengaturan
- Email alert stok menipis setelah transaksi jika stok berada di bawah ambang batas

### Manajemen pengguna dan akses

- Login dengan akses berbasis role
- Role: kasir, manager, admin
- Akses kasir: hanya POS
- Akses manager: dashboard, POS, transaksi, inventaris, produk, laporan, arus kas, pelanggan, diskon, pemasok, pembelian, dan bahan baku
- Akses admin: semua modul manager ditambah pengaturan dan manajemen user
- CRUD user dengan display name, role, password, dan avatar
- Session storage untuk status login pengguna
- Activity log untuk aksi penting seperti login, logout, perubahan pengaturan, export, dan operasi lain

### Pengaturan dan kustomisasi

- Nama dan alamat toko
- Tarif pajak dan service charge
- Layout struk, logo, header, dan footer
- Kategori produk, unit produk, kategori arus kas, dan nama meja
- Toggle tema terang/gelap
- Mode fullscreen
- Sidebar yang bisa diciutkan
- Foto display dan interval slideshow untuk customer display
- Style suara cart
- Toggle virtual keyboard
- Pengaturan printer, QRIS, backup, loyalitas, email, dan activity log

### UI dan kemudahan penggunaan

- Modul fitur di-code-split agar startup lebih cepat
- Custom titlebar untuk aplikasi desktop
- Splash screen dan loading state
- Skeleton card saat produk sedang dimuat
- Dialog konfirmasi untuk aksi cart yang destruktif
- Debounce pencarian di POS
- Shortcut keyboard:
  - `/` atau `Ctrl+F` fokus ke pencarian produk
  - `F5` membuka pembayaran tunai
  - `Ctrl+H` menahan pesanan saat ini
  - `Escape` menutup dialog pembayaran yang terbuka
- Label berbahasa Indonesia untuk alur kerja kasir

## Layar dan modul

PKasir saat ini memiliki modul utama berikut:

| Modul | Fungsi |
| --- | --- |
| Hub / Dashboard | Ringkasan penjualan dan navigasi cepat |
| Kasir / POS | Checkout, cart, pembayaran, printing, held order, customer display |
| Riwayat Transaksi | Riwayat dan detail transaksi |
| Inventaris | Stok, batch, kedaluwarsa, pergerakan, penyesuaian |
| Produk | Katalog produk, varian, tampilan biaya resep |
| Laporan | Laporan penjualan dan export PDF |
| Arus Kas | Pencatatan pemasukan dan pengeluaran dengan export CSV |
| Pelanggan | Data pelanggan dan poin loyalitas |
| Pemasok / Supplier | Data pemasok |
| Pembelian / Purchase Order | Alur purchase order dan penerimaan barang |
| Bahan Baku & Resep | Bahan baku, resep, dan costing produk |
| Diskon & Promo | Aturan diskon dan promo |
| Pengaturan | Toko, struk, printer, QRIS, backup, loyalitas, email, dan sistem |
| Manajemen User | Manajemen pengguna untuk admin |

## Tech stack

### Frontend

- React 19
- Vite 8
- TypeScript 6
- Tailwind CSS 4
- Komponen UI Base UI / gaya shadcn
- Recharts
- jsPDF dan jspdf-autotable
- qrcode dan jsqr
- Sonner notifications
- Lucide React icons

### Backend dan desktop runtime

- Tauri v2
- Rust 2024 edition
- SQLite melalui rusqlite dengan bundled SQLite
- lettre untuk SMTP email
- tokio untuk operasi printer jaringan
- rfd untuk dialog file native
- sha2 dan hex untuk dukungan hashing password
- tauri-plugin-thermal-printer untuk integrasi printer thermal

## Arsitektur

PKasir meng-*handle* logika bisnis menggunakan bahasa pemrograman Rust. Frontend React memanggil fungsi backend melalui Tauri `invoke()` commands.

```text
React + Vite UI
    |
    | Tauri invoke commands
    v
Rust backend commands
    |
    | rusqlite
    v
Database SQLite lokal di app data directory
```

Area utama backend:

- `products`, `transactions`, `held_orders`, `customers`
- `inventory`, `suppliers`, `purchase_orders`, `ingredients`
- `settings`, `users`, `discounts`, `money_flow`
- `backup`, `export`, `printer`, `qris`, `email`, `activity_log`

## Quickstart

### Prasyarat

Install dulu:

1. Node.js 24+ direkomendasikan dan digunakan oleh workflow GitHub Actions
2. Rust melalui [rustup.rs](https://rustup.rs/)
3. Dependency sistem Tauri sesuai OS

Pengguna Linux membutuhkan WebKitGTK dan build tools. Ikuti prasyarat resmi Tauri v2 untuk distribusi Anda:

https://v2.tauri.app/start/prerequisites/

### Install dependency

```bash
npm install
```

### Jalankan mode development

```bash
npm run tauri dev
```

Perintah Tauri dev akan menjalankan frontend Vite dan membuka aplikasi desktop.

## Perintah development

```bash
# Install dependency
npm install

# Jalankan type check frontend
npm run lint

# Build frontend saja
npm run build

# Jalankan aplikasi Tauri dalam mode development
npm run tauri dev

# Build installer/bundle desktop
npm run tauri build
```

## Build installer dan paket release

Gunakan script release untuk membuat artifact yang siap di-upload ke GitHub Release:

```bash
npm run release
```

Script ini membuat output di:

```text
release/v<VERSION>/
├── source/      # ZIP source code, menghormati .gitignore
├── linux/       # Installer Linux jika dijalankan di Linux
└── windows/     # Installer Windows jika tool/OS mendukung
```

Untuk membuat ZIP source saja:

```bash
npm run release:source
```

### Linux installer

Di Linux, script menjalankan:

```bash
npm run tauri build -- --bundles deb,appimage
```

Pastikan dependency sistem Tauri Linux sudah terpasang. Untuk Debian/Ubuntu biasanya membutuhkan prasyarat resmi Tauri ditambah bundler umum seperti:

```bash
sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

### Windows installer

Mengacu dokumentasi Tauri v2 Windows Installer: Windows dapat didistribusikan sebagai NSIS `-setup.exe` atau MSI `.msi`. MSI menggunakan WiX dan hanya bisa dibuat di Windows. Cross-build dari Linux/macOS hanya mendukung NSIS dan memiliki beberapa kekurangan, sehingga paling stabil untuk release final adalah memakai Windows runner/VM/GitHub Actions.

Di Windows, dapat menjalankan:

```bash
npm run tauri build -- --bundles nsis,msi
```

Di Linux/macOS, script mencoba cross-build NSIS dengan:

```bash
npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
```

Prasyarat cross-build Windows NSIS di Linux:

```bash
sudo apt install nsis llvm lld clang
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin
```

Jika ingin script memasang Rust target dan `cargo-xwin` otomatis, jalankan:

```bash
INSTALL_RUST_TOOLS=1 npm run release
```

Catatan: MSI tetap harus dibuat di Windows karena batasan WiX/Tauri.

## Struktur proyek

```text
PKasir/
├── src/                         # Frontend React
│   ├── components/              # Modul POS dan layar UI
│   ├── services/                # Wrapper invoke Tauri, printing, QRIS, auth, utils
│   └── types.ts                 # Interface bersama untuk frontend
├── src-tauri/                   # Backend Rust/Tauri
│   ├── src/commands/            # Modul command Tauri
│   ├── src/db.rs                # Setup SQLite dan migrasi
│   ├── src/models.rs            # Model data Rust
│   ├── Cargo.toml               # Dependency Rust
│   └── tauri.conf.json          # Konfigurasi app desktop dan bundle
├── package.json                 # Dependency frontend dan script
└── README.md
```

## Catatan data, backup, dan keamanan

- PKasir menyimpan data operasional di database SQLite lokal pada app data directory.
- Gunakan pengaturan backup sebelum upgrade, migrasi, atau deployment produksi.
- Password SMTP disimpan secara lokal di tabel settings SQLite. Gunakan app password, bukan password utama akun email.
- Generasi QRIS dinamis memvalidasi payload QRIS dan menghitung ulang CRC sebelum ditampilkan.
- Penanganan password diimplementasikan di backend lokal. Review kebijakan autentikasi dan password sebelum aplikasi dipakai oleh tim yang lebih luas.
- Repository ini belum memiliki file `LICENSE`. Tambahkan license sebelum mempublikasikan proyek sebagai open source atau menerima kontribusi eksternal.

## Kontribusi

Kontribusi terbuka setelah repository dipublikasikan dengan license dan kebijakan kontribusi yang jelas.

Alur kontribusi yang disarankan:

1. Fork repository
2. Buat branch fitur
3. Jalankan `npm install`
4. Buat perubahan
5. Jalankan `npm run lint` dan `npm run build`
6. Untuk perubahan backend, jalankan juga `cargo check` dari `src-tauri/`
7. Buka pull request dengan deskripsi singkat dan screenshot untuk perubahan UI

Ide good first issue untuk kontributor:

- Menambah test coverage untuk Tauri commands
- Menambah profil printer
- Menambah format import/export untuk produk dan inventaris
- Meningkatkan aksesibilitas untuk workflow kasir layar sentuh
- Menambah filter dan chart laporan
- Menyiapkan build package untuk Linux dan macOS


## Lisensi

Lisensi GPL-3.0


