// ── QRIS Dynamic Generator ───────────────────────────────────────────────────
//
// Converts a static QRIS string (EMVCo TLV format) into a dynamic one by:
//   1. Stripping the CRC trailer ("6304XXXX")
//   2. Changing tag 01 value "11" (static) → "12" (dynamic)
//   3. Removing any existing tag 54 (transaction amount)
//   4. Inserting tag 54 with the given amount before tag 58 (country code)
//   5. Re-appending "6304" and computing CRC-16/CCITT-FALSE
//   6. Appending the 4-char uppercase hex CRC
//
// No external crates are used — CRC-16 is implemented from scratch.
// ─────────────────────────────────────────────────────────────────────────────

/// CRC-16/CCITT-FALSE
///   poly  = 0x1021
///   init  = 0xFFFF
///   refIn = false
///   refOut= false
///   xorOut= 0x0000
fn crc16_ccitt(data: &str) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for byte in data.bytes() {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

/// Generate a dynamic QRIS string from a static one with a specific amount.
///
/// # Arguments
/// * `static_qris` — The merchant's static QRIS string (copied from their QR code)
/// * `amount`      — Transaction amount in integer IDR (e.g. 15000 for Rp 15.000)
///
/// # Returns
/// The complete dynamic QRIS string ready to be rendered as a QR code.
#[tauri::command]
pub fn generate_dynamic_qris(static_qris: String, amount: u64) -> Result<String, String> {
    // Preserve original casing — uppercasing would corrupt mixed-case merchant
    // data (the recomputed CRC would still "pass", hiding the corruption).
    let qris = static_qris.trim();

    if qris.len() < 16 {
        return Err("QRIS string terlalu pendek (minimum 16 karakter)".into());
    }
    if !qris.starts_with("000201") {
        return Err("QRIS tidak valid: harus diawali dengan '000201'".into());
    }

    // ── Step 1: Strip last 8 chars (existing "6304XXXX" CRC tag) ──────────
    let base = if qris.ends_with_crc_tag() {
        &qris[..qris.len() - 8]
    } else {
        return Err("QRIS tidak valid: tidak ditemukan tag CRC '6304' di akhir string".into());
    };

    // ── Step 2: Change tag 01 value "11" → "12" (static → dynamic) ───────
    // Tag 01 is always at position 6 in a valid QRIS: "000201" (6 chars) then "01"
    let base: String = if base.len() > 12 && &base[6..10] == "0102" {
        // Standard case: replace value at known position
        let val = &base[10..12];
        if val == "11" {
            format!("{}12{}", &base[..10], &base[12..])
        } else {
            // Already dynamic or has unexpected value — just continue
            base.to_string()
        }
    } else {
        // Fallback: search and replace
        base.replacen("010211", "010212", 1)
    };

    // ── Step 3 & 4: Walk the TLV, remove tag 54, locate tag 58 ───────────
    let mut result = String::with_capacity(base.len() + 20);
    let mut pos = 0usize;
    let mut tag58_result_pos: Option<usize> = None;

    while pos + 4 <= base.len() {
        let tag = &base[pos..pos + 2];
        let len_str = &base[pos + 2..pos + 4];

        let len: usize = len_str
            .parse::<usize>()
            .map_err(|_| format!("TLV panjang tidak valid di posisi {}", pos))?;

        let end = pos + 4 + len;
        if end > base.len() {
            // Malformed — append remainder verbatim and stop
            result.push_str(&base[pos..]);
            break;
        }

        if tag == "54" {
            // Skip any existing amount tag
            pos = end;
            continue;
        }

        if tag == "58" && tag58_result_pos.is_none() {
            // Record where tag 58 starts in the OUTPUT buffer
            // (before we append tag 58 itself)
            tag58_result_pos = Some(result.len());
        }

        result.push_str(&base[pos..end]);
        pos = end;
    }

    // ── Step 4 cont.: Build tag 54 and splice it in before tag 58 ─────────
    let amount_str = amount.to_string();
    let tag54 = format!("54{:02}{}", amount_str.len(), amount_str);

    let base_with_amount: String = match tag58_result_pos {
        Some(p) => {
            let mut s = result.clone();
            s.insert_str(p, &tag54);
            s
        }
        None => {
            // No tag 58 found — append amount before the reassembled end
            result + &tag54
        }
    };

    // ── Step 5 & 6: Re-append "6304", compute CRC, append 4-char hex ──────
    let with_crc_prefix = format!("{}6304", base_with_amount);
    let crc = crc16_ccitt(&with_crc_prefix);
    let final_qris = format!("{}{:04X}", with_crc_prefix, crc);

    Ok(final_qris)
}

/// Basic structural validation of a static QRIS string.
///
/// Checks:
///   - Starts with "000201" (EMVCo format indicator)
///   - Contains "5802ID" (Indonesian country code with fixed length)
///   - Ends with "6304" followed by exactly 4 hex digits (CRC tag)
///   - CRC value matches recomputed CRC
#[tauri::command]
pub fn validate_static_qris(qris: String) -> bool {
    // Do NOT uppercase: the CRC was computed by the issuer over the original
    // bytes, and QRIS payloads are often mixed-case (merchant name, domains).
    let qris = qris.trim();

    if qris.len() < 24 {
        return false;
    }
    if !qris.starts_with("000201") {
        return false;
    }
    if !qris.contains("5802ID") {
        return false;
    }
    if !qris.ends_with_crc_tag() {
        return false;
    }

    // Verify CRC: compute over everything up to and including "6304"
    let len = qris.len();
    let crc_hex = &qris[len - 4..];
    if crc_hex.chars().any(|c| !c.is_ascii_hexdigit()) {
        return false;
    }

    let payload = &qris[..len - 4]; // includes the "6304" prefix but not the 4-char CRC
    let expected = crc16_ccitt(payload);
    let actual = match u16::from_str_radix(crc_hex, 16) {
        Ok(v) => v,
        Err(_) => return false,
    };

    expected == actual
}

// ── Helper trait ─────────────────────────────────────────────────────────────

trait QrisStr {
    /// Returns true when the string ends with "6304" followed by 4 hex chars.
    fn ends_with_crc_tag(&self) -> bool;
}

impl QrisStr for str {
    fn ends_with_crc_tag(&self) -> bool {
        let len = self.len();
        if len < 8 {
            return false;
        }
        &self[len - 8..len - 4] == "6304"
            && self[len - 4..].chars().all(|c| c.is_ascii_hexdigit())
    }
}
