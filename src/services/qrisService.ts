// ── QRIS Service ─────────────────────────────────────────────────────────────
//
// Provides frontend utilities for working with QRIS (Quick Response Code
// Indonesian Standard) strings:
//
//   1. decodeQRFromImage   — reads a QR code from a File using jsQR
//   2. parseTLV            — EMVCo TLV parser (tag / length / value)
//   3. extractMerchantInfo — pulls tag 59 (merchant name) and tag 60 (city)
//   4. isValidQRIS         — structural + CRC-16/CCITT-FALSE validation
//
// The CRC implementation mirrors src-tauri/src/commands/qris.rs exactly so
// the frontend can validate without a round-trip to the Rust backend.
// ─────────────────────────────────────────────────────────────────────────────

export interface TLVField {
  tag: string;
  length: number;
  value: string;
}

// ── QR code decoding from image ───────────────────────────────────────────────

/**
 * Decode a QR code from an image File using jsQR.
 *
 * Flow: File → createObjectURL → <img> → <canvas> → getImageData → jsQR()
 *
 * Dynamic import avoids compile-time errors when the types are not installed
 * and lets the rest of the app bundle without the library until it is needed.
 */
export function decodeQRFromImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Tidak dapat membuat konteks canvas'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (import('jsqr') as Promise<any>)
        .then((mod) => {
          // jsQR may arrive as a default export (ESM) or a CJS module
          const jsQR = mod.default ?? mod;
          const result = jsQR(imageData.data, imageData.width, imageData.height);
          if (result?.data) {
            resolve(result.data);
          } else {
            reject(
              new Error(
                'QR code tidak terdeteksi. Pastikan gambar jelas, tidak buram, dan berisi kode QR QRIS.'
              )
            );
          }
        })
        .catch(() =>
          reject(
            new Error('Gagal memuat pustaka jsQR. Pastikan "npm install" sudah dijalankan.')
          )
        );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal memuat gambar. Pastikan format file didukung (JPG, PNG, dll.).'));
    };

    img.src = url;
  });
}

// ── TLV parser ────────────────────────────────────────────────────────────────

/**
 * Walk a top-level EMVCo TLV string.
 *
 * Each field is: tag(2 chars) + length(2 decimal digits) + value(length chars).
 * Nested sub-TLVs (e.g. merchant account info in tags 02–51) are returned as
 * opaque string values — the caller can recurse if needed, but for tag 59/60
 * (merchant name / city) a single top-level pass is sufficient.
 */
export function parseTLV(qris: string): TLVField[] {
  const fields: TLVField[] = [];
  const src = qris.toUpperCase(); // compare tags as uppercase
  let pos = 0;

  while (pos + 4 <= src.length) {
    const tag = src.slice(pos, pos + 2);
    const lenStr = src.slice(pos + 2, pos + 4);
    const len = parseInt(lenStr, 10);

    if (isNaN(len) || len < 0) break;

    const end = pos + 4 + len;
    if (end > qris.length) break; // truncated / malformed

    // Preserve original casing for the value (merchant names may be mixed-case)
    const value = qris.slice(pos + 4, end);
    fields.push({ tag, length: len, value });
    pos = end;
  }

  return fields;
}

/**
 * Extract merchant name (tag 59) and merchant city (tag 60) from a QRIS string.
 *
 * Both are top-level TLV fields defined in the EMVCo / QRIS specification.
 */
export function extractMerchantInfo(qris: string): {
  merchantName: string;
  merchantCity: string;
} {
  const fields = parseTLV(qris);
  let merchantName = '';
  let merchantCity = '';

  for (const f of fields) {
    if (f.tag === '59') merchantName = f.value;
    if (f.tag === '60') merchantCity = f.value;
    if (merchantName && merchantCity) break; // both found — stop early
  }

  return { merchantName, merchantCity };
}

// ── CRC-16/CCITT-FALSE ────────────────────────────────────────────────────────
// poly   = 0x1021
// init   = 0xFFFF
// refIn  = false
// refOut = false
// xorOut = 0x0000
//
// This mirrors the Rust function crc16_ccitt() in src-tauri/src/commands/qris.rs.

function crc16Ccitt(data: string): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc;
}

// ── QRIS validation ───────────────────────────────────────────────────────────

/**
 * Basic structural + CRC validation of a QRIS string.
 *
 * Mirrors the Rust `validate_static_qris` Tauri command so the frontend can
 * validate locally without a network round-trip.
 *
 * Checks:
 *   1. Starts with "000201"  (EMVCo format indicator)
 *   2. Contains "5802ID"     (Indonesian country code tag with fixed length)
 *   3. Ends with "6304" + exactly 4 uppercase hex digits (CRC tag)
 *   4. CRC-16/CCITT-FALSE of the payload (everything up to and including "6304")
 *      matches the trailing 4-char hex value
 */
export function isValidQRIS(qris: string): boolean {
  // The CRC must be computed over the ORIGINAL bytes. QRIS payloads are often
  // mixed-case (merchant name, account domains) — uppercasing first changes
  // the bytes and produces a different checksum than the embedded one.
  const raw = qris.trim();
  const upper = raw.toUpperCase();

  if (raw.length < 24) return false;
  if (!raw.startsWith('000201')) return false;
  if (!upper.includes('5802ID')) return false;

  const len = raw.length;

  // Last 8 chars must be "6304XXXX"
  const crcTag = raw.slice(len - 8, len - 4);
  const crcHex = upper.slice(len - 4);
  if (crcTag !== '6304') return false;
  if (!/^[0-9A-F]{4}$/.test(crcHex)) return false;

  // Payload = everything up to and including "6304" (i.e. excludes the 4-char CRC value)
  const payload = raw.slice(0, len - 4);
  const expected = crc16Ccitt(payload);
  const actual = parseInt(crcHex, 16);

  return expected === actual;
}
