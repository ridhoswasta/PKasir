# PKasir - Aplikasi POS Desktop

Aplikasi Point of Sale (POS) desktop yang dibangun menggunakan **React + Vite** untuk frontend dan **Rust (Tauri v2)** dengan **SQLite (rusqlite)** untuk backend native.

## Arsitektur

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Rust via Tauri v2 invoke commands
- **Database**: SQLite (rusqlite), disimpan di app data directory
- **Printer**: Thermal printer via `tauri-plugin-thermal-printer` + network ESC/POS

Semua operasi database dan logika bisnis berjalan di sisi Rust. Frontend memanggil backend melalui `invoke()` dari `@tauri-apps/api/core`.

## Prasyarat

1. **Node.js** (versi 18 atau lebih baru)
2. **Rust** (Instal melalui [rustup.rs](https://rustup.rs/))
3. **Build Tools** sesuai OS:
   - **Windows**: Build Tools for Visual Studio (C++ build tools)
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
   - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, dll. (Lihat [dokumentasi Tauri](https://v2.tauri.app/start/prerequisites/))

## Development

```bash
npm install
npm run tauri dev
```

## Build (Installer)

```bash
npm run tauri build
```

Hasil build berada di `src-tauri/target/release/bundle/`.
