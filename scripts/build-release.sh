#!/usr/bin/env bash
set -Eeuo pipefail

# Build release artifacts for PKasir.
#
# Default behavior:
#   - create a source zip from tracked + untracked non-ignored files
#   - build installers for the current host OS
#   - on Linux/macOS, also try to cross-build a Windows NSIS installer when the
#     required tools from the Tauri Windows installer guide are installed
#
# Useful env vars:
#   VERSION=0.1.0              Override release version/name
#   RELEASE_DIR=release        Output directory
#   BUILD_LINUX=0              Skip Linux bundles
#   BUILD_WINDOWS=0            Skip Windows bundles/cross-build
#   BUILD_SOURCE=0             Skip source zip
#   SOURCE_ONLY=1              Only create source zip
#   INSTALL_RUST_TOOLS=1       Auto-install cargo-xwin and rust target if missing
#   WINDOWS_TARGET=...         Defaults to x86_64-pc-windows-msvc
#   LINUX_BUNDLES=deb,appimage Defaults to deb,appimage
#   WINDOWS_BUNDLES=nsis       Defaults to nsis on non-Windows, nsis,msi on Windows

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="${VERSION:-$(node -p "require('./package.json').version" 2>/dev/null || printf '0.0.0')}"
RELEASE_DIR="${RELEASE_DIR:-release}"
ARTIFACT_DIR="$ROOT_DIR/$RELEASE_DIR/v$VERSION"
SOURCE_PREFIX="PKasir-v$VERSION"
WINDOWS_TARGET="${WINDOWS_TARGET:-x86_64-pc-windows-msvc}"
LINUX_BUNDLES="${LINUX_BUNDLES:-deb,appimage}"
BUILD_SOURCE="${BUILD_SOURCE:-1}"
BUILD_LINUX="${BUILD_LINUX:-1}"
BUILD_WINDOWS="${BUILD_WINDOWS:-1}"
SOURCE_ONLY="${SOURCE_ONLY:-0}"
INSTALL_RUST_TOOLS="${INSTALL_RUST_TOOLS:-0}"

case "${1:-}" in
  --source-only)
    SOURCE_ONLY=1
    ;;
  --help|-h)
    cat <<'USAGE'
Usage: bash scripts/build-release.sh [--source-only]

Creates release artifacts under release/v<version>/.

On Linux:
  - Builds Linux bundles with: npm run tauri build -- --bundles deb,appimage
  - Cross-builds Windows NSIS with: npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
  - MSI cannot be produced on Linux; Tauri/WiX requires Windows for .msi.

Required Linux packages for Tauri Linux bundles depend on distro. For Debian/Ubuntu,
install the official Tauri prerequisites plus common bundlers, for example:
  sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf

Extra Linux packages for Windows NSIS cross-build, from Tauri docs:
  sudo apt install nsis llvm lld clang
  rustup target add x86_64-pc-windows-msvc
  cargo install --locked cargo-xwin

Set INSTALL_RUST_TOOLS=1 to let this script install the Rust target and cargo-xwin.
USAGE
    exit 0
    ;;
esac

log() { printf '\n==> %s\n' "$*"; }
warn() { printf '\nWARNING: %s\n' "$*" >&2; }
need() { command -v "$1" >/dev/null 2>&1; }

host_os() {
  case "$(uname -s)" in
    Linux*) printf 'linux' ;;
    Darwin*) printf 'macos' ;;
    MINGW*|MSYS*|CYGWIN*) printf 'windows' ;;
    *) printf 'unknown' ;;
  esac
}

copy_artifacts() {
  local source_dir="$1"
  local target_dir="$2"
  mkdir -p "$target_dir"
  if [[ -d "$source_dir" ]]; then
    find "$source_dir" -type f \( \
      -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' -o \
      -name '*.msi' -o -name '*setup*.exe' -o -name '*-setup.exe' -o -name '*.exe' \
    \) -print0 | while IFS= read -r -d '' file; do
      cp -f "$file" "$target_dir/"
    done
  fi
}

create_source_zip() {
  log "Creating source zip"
  mkdir -p "$ARTIFACT_DIR/source"
  local zip_path="$ARTIFACT_DIR/source/${SOURCE_PREFIX}-source.zip"
  python3 - "$zip_path" "$SOURCE_PREFIX" <<'PY'
import subprocess
import sys
import zipfile
from pathlib import Path

zip_path = Path(sys.argv[1])
prefix = sys.argv[2].rstrip('/')
root = Path.cwd()

# Include committed files plus untracked source files, but respect .gitignore.
result = subprocess.run(
    ['git', 'ls-files', '-co', '--exclude-standard'],
    cwd=root,
    text=True,
    check=True,
    stdout=subprocess.PIPE,
)
files = []
for line in result.stdout.splitlines():
    if not line:
        continue
    path = root / line
    if path.is_file():
        files.append(line)

zip_path.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for rel in sorted(files):
        zf.write(root / rel, f'{prefix}/{rel}')
print(zip_path)
print(f'files={len(files)}')
PY
}

ensure_node_deps() {
  if [[ ! -d node_modules ]]; then
    log "Installing npm dependencies with npm ci"
    npm ci
  fi
}

run_frontend_checks() {
  log "Running TypeScript check"
  npm run lint
}

maybe_install_rust_cross_tools() {
  if [[ "$INSTALL_RUST_TOOLS" != "1" ]]; then
    return 0
  fi
  log "Ensuring Rust Windows target and cargo-xwin are installed"
  rustup target add "$WINDOWS_TARGET"
  if ! need cargo-xwin; then
    cargo install --locked cargo-xwin
  fi
}

build_linux() {
  if [[ "$(host_os)" != "linux" ]]; then
    warn "Skipping Linux installer build: Linux bundles must be built on Linux."
    return 0
  fi

  log "Building Linux installers ($LINUX_BUNDLES)"
  npm run tauri build -- --bundles "$LINUX_BUNDLES"
  copy_artifacts "src-tauri/target/release/bundle" "$ARTIFACT_DIR/linux"
}

build_windows_on_windows() {
  local bundles="${WINDOWS_BUNDLES:-nsis,msi}"
  log "Building Windows installers on Windows ($bundles)"
  npm run tauri build -- --bundles "$bundles"
  copy_artifacts "src-tauri/target/release/bundle" "$ARTIFACT_DIR/windows"
}

build_windows_cross_nsis() {
  local bundles="${WINDOWS_BUNDLES:-nsis}"

  if [[ "$bundles" == *msi* ]]; then
    warn "MSI cannot be created on Linux/macOS. Tauri uses WiX for MSI and WiX only runs on Windows. Building NSIS only."
    bundles="nsis"
  fi

  local missing=()
  need makensis || missing+=("makensis/nsis")
  need llvm-rc || missing+=("llvm-rc/llvm")
  need clang-cl || need clang || missing+=("clang/clang-cl")
  need lld-link || need lld || missing+=("lld")
  need cargo-xwin || missing+=("cargo-xwin")
  rustup target list --installed | grep -qx "$WINDOWS_TARGET" || missing+=("rust target $WINDOWS_TARGET")

  if (( ${#missing[@]} > 0 )); then
    warn "Skipping Windows NSIS cross-build; missing: ${missing[*]}"
    warn "Install prerequisites from the Tauri Windows installer guide: sudo apt install nsis llvm lld clang; rustup target add $WINDOWS_TARGET; cargo install --locked cargo-xwin"
    warn "Or run on Windows/GitHub Actions to build NSIS + MSI."
    return 0
  fi

  log "Cross-building Windows NSIS installer ($WINDOWS_TARGET)"
  npm run tauri build -- --runner cargo-xwin --target "$WINDOWS_TARGET" --bundles "$bundles"
  copy_artifacts "src-tauri/target/$WINDOWS_TARGET/release/bundle" "$ARTIFACT_DIR/windows"
}

build_windows() {
  case "$(host_os)" in
    windows) build_windows_on_windows ;;
    linux|macos) maybe_install_rust_cross_tools; build_windows_cross_nsis ;;
    *) warn "Skipping Windows installer build on unsupported host OS." ;;
  esac
}

summarize() {
  log "Release artifacts"
  if [[ -d "$ARTIFACT_DIR" ]]; then
    find "$ARTIFACT_DIR" -type f -maxdepth 3 | sort
  else
    warn "No artifact directory created: $ARTIFACT_DIR"
  fi
}

mkdir -p "$ARTIFACT_DIR"

if [[ "$BUILD_SOURCE" == "1" ]]; then
  create_source_zip
fi

if [[ "$SOURCE_ONLY" == "1" ]]; then
  summarize
  exit 0
fi

ensure_node_deps
run_frontend_checks

if [[ "$BUILD_LINUX" == "1" ]]; then
  build_linux
fi

if [[ "$BUILD_WINDOWS" == "1" ]]; then
  build_windows
fi

summarize
