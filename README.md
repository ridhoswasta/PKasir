# Panduan Build Desktop (Tauri)

Aplikasi ini dibangun menggunakan **React + Vite** untuk frontend dan **Node.js (Express) + SQLite** untuk backend. Untuk mengubahnya menjadi aplikasi desktop menggunakan [Tauri](https://tauri.app/), Anda perlu mengikuti beberapa langkah penyesuaian, karena Tauri secara bawaan hanya membungkus frontend (HTML/CSS/JS) dan menggunakan Rust sebagai backend-nya.

Berikut adalah panduan langkah demi langkah untuk melakukan *build* versi desktop.

## Prasyarat (Prerequisites)

Sebelum memulai, pastikan komputer Anda sudah terinstal:
1. **Node.js** (versi 18 atau lebih baru)
2. **Rust** (Instal melalui [rustup.rs](https://rustup.rs/))
3. **Build Tools** sesuai OS Anda:
   - **Windows**: Build Tools for Visual Studio (C++ build tools)
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
   - **Linux**: Dependensi sistem seperti `libwebkit2gtk-4.0-dev`, `build-essential`, dll. (Lihat [dokumentasi Tauri](https://tauri.app/v1/guides/getting-started/prerequisites/linux)).

## Langkah 1: Instalasi Tauri CLI

Buka terminal di direktori proyek ini, lalu jalankan:

```bash
npm install -D @tauri-apps/cli
```

## Langkah 2: Inisialisasi Tauri

Jalankan perintah inisialisasi:

```bash
npx tauri init
```

Anda akan ditanya beberapa konfigurasi. Isi seperti berikut:
- *What is your app name?* `CafePOS` (atau nama aplikasi Anda)
- *What should the window title be?* `Cafe POS`
- *Where are your web assets located?* `../dist`
- *What is the url of your dev server?* `http://localhost:3000`
- *What is your frontend dev command?* `npm run dev`
- *What is your frontend build command?* `npm run build`

Perintah ini akan membuat folder `src-tauri` yang berisi konfigurasi Rust.

## Langkah 3: Penyesuaian Backend (PENTING!)

Aplikasi ini menggunakan **Node.js (Express)** dan **SQLite** (`server.ts`). Tauri **tidak** menjalankan Node.js secara otomatis. Anda memiliki dua pilihan arsitektur:

### Opsi A: Menggunakan Tauri Sidecar (Direkomendasikan untuk aplikasi ini)
Anda dapat membungkus server Node.js Anda ke dalam sebuah *executable* (misalnya menggunakan `pkg` atau `vercel/pkg`) dan menjalankannya sebagai "Sidecar" di Tauri.
1. *Compile* `server.ts` menjadi *binary* mandiri.
2. Konfigurasikan `tauri.conf.json` untuk menjalankan *binary* tersebut saat aplikasi desktop dibuka.
3. Frontend React akan tetap menembak API ke `http://localhost:3000/api/...` yang dijalankan oleh Sidecar tersebut.

### Opsi B: Migrasi Backend ke Rust (Native Tauri)
Jika Anda ingin aplikasi yang sepenuhnya *native* tanpa Node.js:
1. Pindahkan logika *database* SQLite dari `server.ts` ke Rust menggunakan plugin resmi `tauri-plugin-sql`.
2. Ubah fungsi `fetch('/api/...')` di React menjadi pemanggilan perintah Tauri (`invoke('nama_fungsi')`).

## Langkah 4: Menjalankan Mode Development

Jika Anda sudah mengatur backend (misalnya menjalankan `npm run dev` di terminal terpisah untuk menyalakan server Node.js), Anda bisa membuka jendela desktop Tauri dengan perintah:

```bash
npx tauri dev
```

## Langkah 5: Build Aplikasi (Installer)

Untuk membuat *installer* (.exe untuk Windows, .dmg untuk Mac, atau .deb/.AppImage untuk Linux), jalankan:

```bash
npx tauri build
```

Hasil *build* akan berada di dalam folder `src-tauri/target/release/bundle/`.

---

**Catatan Tambahan:**
Karena aplikasi ini dirancang sebagai aplikasi *Full-Stack* (Client-Server), menjadikannya aplikasi desktop murni (tanpa server lokal yang berjalan di latar belakang) memerlukan modifikasi pada cara aplikasi membaca dan menulis ke *database* (Opsi B di atas).
