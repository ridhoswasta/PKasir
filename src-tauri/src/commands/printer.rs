use crate::db::AppDb;
use crate::models::PrintReceiptInput;
use tauri::State;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

const ESC: u8 = 0x1b;
const GS: u8 = 0x1d;
const LF: u8 = 0x0a;

fn fmt_rp(n: f64) -> String {
    // Simple Indonesian-style thousands formatting
    let i = n as i64;
    let s = i.to_string();
    let mut out = String::new();
    for (idx, ch) in s.chars().rev().enumerate() {
        if idx > 0 && idx % 3 == 0 {
            out.push('.');
        }
        out.push(ch);
    }
    format!("Rp {}", out.chars().rev().collect::<String>())
}

fn pad(left: &str, right: &str, cols: usize) -> String {
    let space = cols.saturating_sub(left.len() + right.len()).max(1);
    format!("{}{}{}", left, " ".repeat(space), right)
}

fn center(s: &str, cols: usize) -> String {
    if s.len() >= cols {
        return s.to_string();
    }
    let left = (cols - s.len()) / 2;
    format!("{}{}", " ".repeat(left), s)
}

fn build_receipt_bytes(input: &PrintReceiptInput, settings_row: &ReceiptSettings) -> Vec<u8> {
    let cols: usize = if settings_row.paper_width.contains("58") { 32 } else { 48 };
    let mut buf: Vec<u8> = Vec::new();
    let divider = || "-".repeat(cols);

    let _push_text = |buf: &mut Vec<u8>, s: &str| buf.extend_from_slice(s.as_bytes());
    let push_line = |buf: &mut Vec<u8>, s: &str| {
        buf.extend_from_slice(s.as_bytes());
        buf.push(LF);
    };

    // Init
    buf.extend_from_slice(&[ESC, 0x40]);
    buf.extend_from_slice(&[ESC, 0x74, 0x00]); // code page

    // Header centered + double height
    buf.extend_from_slice(&[ESC, 0x61, 0x01]);
    buf.extend_from_slice(&[ESC, 0x21, 0x10]);
    for ln in settings_row.header.split('\n') {
        push_line(&mut buf, &center(ln, cols));
    }
    buf.extend_from_slice(&[ESC, 0x21, 0x00]);
    buf.push(LF);
    buf.extend_from_slice(&[ESC, 0x61, 0x00]);

    push_line(&mut buf, &format!("Struk #{}", input.tx_id));
    let date_str = input.tx_date.as_deref().unwrap_or("");
    push_line(&mut buf, date_str);
    if let Some(ref c) = input.cashier {
        push_line(&mut buf, &format!("Kasir: {}", c));
    }
    if let Some(ref c) = input.customer {
        push_line(&mut buf, &format!("Pelanggan: {}", c));
    }
    if let Some(ref t) = input.table_name {
        buf.extend_from_slice(&[ESC, 0x21, 0x08]);
        push_line(&mut buf, &format!("Meja: {}", t));
        buf.extend_from_slice(&[ESC, 0x21, 0x00]);
    }
    push_line(&mut buf, &divider());

    for item in &input.items {
        let name = if let Some(ref v) = item.variant_name {
            format!("{}x {} ({})", item.qty, item.name, v)
        } else {
            format!("{}x {}", item.qty, item.name)
        };
        let price_str = fmt_rp(item.price * item.qty as f64);
        let name_max = cols.saturating_sub(price_str.len() + 1);
        let name_trunc = if name.len() > name_max { &name[..name_max] } else { &name };
        push_line(&mut buf, &pad(name_trunc, &price_str, cols));
        if let Some(ref n) = item.note {
            if !n.is_empty() {
                push_line(&mut buf, &format!("  * {}", n));
            }
        }
    }
    push_line(&mut buf, &divider());

    push_line(&mut buf, &pad("Subtotal", &fmt_rp(input.subtotal), cols));
    if let Some(disc) = input.discount {
        if disc > 0.0 {
            let label = match input.discount_name.as_deref() {
                Some(n) if !n.is_empty() => format!("Diskon ({})", n),
                _ => "Diskon".to_string(),
            };
            push_line(&mut buf, &pad(&label, &format!("-{}", fmt_rp(disc)), cols));
        }
    }
    if input.tax > 0.0 {
        push_line(&mut buf, &pad(&format!("Pajak ({}%)", settings_row.tax_rate), &fmt_rp(input.tax), cols));
    }
    if input.service_charge > 0.0 {
        push_line(&mut buf, &pad(&format!("Layanan ({}%)", settings_row.service_rate), &fmt_rp(input.service_charge), cols));
    }
    push_line(&mut buf, &divider());

    buf.extend_from_slice(&[ESC, 0x21, 0x10]);
    push_line(&mut buf, &pad("TOTAL", &fmt_rp(input.total), cols));
    buf.extend_from_slice(&[ESC, 0x21, 0x00]);
    push_line(&mut buf, &pad("Pembayaran", &input.payment_method, cols));
    if input.payment_method == "Tunai" {
        push_line(&mut buf, &pad("Tunai", &fmt_rp(input.amount_paid.unwrap_or(0.0)), cols));
        push_line(&mut buf, &pad("Kembalian", &fmt_rp(input.change.unwrap_or(0.0)), cols));
    }
    if let Some(ref n) = input.note {
        if !n.is_empty() {
            push_line(&mut buf, &format!("Catatan: {}", n));
        }
    }
    push_line(&mut buf, &divider());

    buf.extend_from_slice(&[ESC, 0x61, 0x01]);
    for ln in settings_row.footer.split('\n') {
        push_line(&mut buf, &center(ln, cols));
    }
    buf.extend_from_slice(&[ESC, 0x61, 0x00]);

    // Feed + cut
    buf.push(LF);
    buf.push(LF);
    buf.push(LF);
    buf.extend_from_slice(&[GS, 0x56, 0x42, 0x00]);

    if settings_row.open_drawer {
        buf.extend_from_slice(&[ESC, 0x70, 0x00, 0x19, 0xfa]);
    }

    buf
}

struct ReceiptSettings {
    header: String,
    footer: String,
    paper_width: String,
    tax_rate: f64,
    service_rate: f64,
    open_drawer: bool,
}

async fn send_to_printer(ip: &str, port: u16, data: &[u8]) -> Result<(), String> {
    let addr = format!("{}:{}", ip, port);
    let mut stream = timeout(Duration::from_secs(5), TcpStream::connect(&addr))
        .await
        .map_err(|_| "Printer connection timed out (5s)".to_string())?
        .map_err(|e| format!("Koneksi printer gagal: {}", e))?;

    stream
        .write_all(data)
        .await
        .map_err(|e| format!("Gagal kirim data: {}", e))?;
    stream
        .shutdown()
        .await
        .map_err(|e| format!("Gagal tutup koneksi: {}", e))?;
    Ok(())
}

/// Compose the printed/displayed shop header from the canonical shop identity
/// (shopName + shopAddress) plus any extra receiptHeader lines. Falls back to
/// the legacy receiptHeader-only behaviour when no shop name/address is set.
fn compose_header(name: Option<String>, addr: Option<String>, extra: Option<String>) -> String {
    let name = name.unwrap_or_default();
    let addr = addr.unwrap_or_default();
    let extra = extra.unwrap_or_default().replace("\\n", "\n");
    let (name_t, addr_t, extra_t) = (name.trim(), addr.trim(), extra.trim());
    if name_t.is_empty() && addr_t.is_empty() {
        return if extra_t.is_empty() { "CAFE POS".into() } else { extra };
    }
    let mut parts: Vec<&str> = Vec::new();
    if !name_t.is_empty() { parts.push(name_t); }
    if !addr_t.is_empty() { parts.push(addr_t); }
    if !extra_t.is_empty() { parts.push(extra_t); }
    parts.join("\n")
}

#[tauri::command]
pub async fn print_test(
    db: State<'_, AppDb>,
    ip: Option<String>,
    port: Option<u16>,
) -> Result<serde_json::Value, String> {
    let (printer_ip, printer_port, header) = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let (sip, sport, sname, saddr, sheader): (Option<String>, Option<i64>, Option<String>, Option<String>, Option<String>) = conn
            .query_row(
                "SELECT printerIp, printerPort, shopName, shopAddress, receiptHeader FROM settings WHERE id='default'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
            )
            .map_err(|e| e.to_string())?;
        (sip, sport, compose_header(sname, saddr, sheader))
    };

    let target_ip = ip.or(printer_ip).ok_or("Printer IP belum diset")?;
    let target_port = port.unwrap_or(printer_port.unwrap_or(9100) as u16);

    let mut buf: Vec<u8> = Vec::new();
    buf.extend_from_slice(&[ESC, 0x40, ESC, 0x61, 0x01, ESC, 0x21, 0x10]);
    buf.extend_from_slice(b"TEST PRINT\n");
    buf.extend_from_slice(&[ESC, 0x21, 0x00]);
    buf.extend_from_slice(format!("{}\n", header).as_bytes());
    buf.extend_from_slice(b"Koneksi printer berhasil!\n\n\n");
    buf.extend_from_slice(&[GS, 0x56, 0x42, 0x00]);

    send_to_printer(&target_ip, target_port, &buf).await?;
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub async fn print_receipt(
    db: State<'_, AppDb>,
    receipt: PrintReceiptInput,
) -> Result<serde_json::Value, String> {
    let settings = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let (pt, pip, pport, rh, rf, pw, tr, sc, od, sname, saddr): (
            Option<String>, Option<String>, Option<i64>,
            Option<String>, Option<String>, Option<String>,
            Option<f64>, Option<f64>, Option<i64>,
            Option<String>, Option<String>,
        ) = conn
            .query_row(
                "SELECT printerType, printerIp, printerPort, receiptHeader, receiptFooter, paperWidth, taxRate, serviceCharge, printerOpenDrawer, shopName, shopAddress FROM settings WHERE id='default'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?, r.get(7)?, r.get(8)?, r.get(9)?, r.get(10)?)),
            )
            .map_err(|e| e.to_string())?;

        let ptype = pt.unwrap_or_else(|| "browser".into());
        if ptype != "network" {
            return Err("Printer bukan mode network".into());
        }
        let ip = pip.ok_or("Printer IP belum diset")?;

        (
            ip,
            pport.unwrap_or(9100) as u16,
            ReceiptSettings {
                header: compose_header(sname, saddr, rh),
                footer: rf.unwrap_or_default().replace("\\n", "\n"),
                paper_width: pw.unwrap_or_else(|| "80mm".into()),
                tax_rate: tr.unwrap_or(0.0),
                service_rate: sc.unwrap_or(0.0),
                open_drawer: od.unwrap_or(0) != 0,
            },
        )
    };

    let buf = build_receipt_bytes(&receipt, &settings.2);
    send_to_printer(&settings.0, settings.1, &buf).await?;
    Ok(serde_json::json!({ "ok": true }))
}
