use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};

#[tauri::command]
pub fn send_email(
    smtp_host: String,
    smtp_port: u16,
    use_tls: bool,
    username: String,
    password: String,
    from: String,
    to: String,
    subject: String,
    body: String,
) -> Result<(), String> {
    if smtp_host.is_empty() {
        return Err("SMTP host tidak boleh kosong".to_string());
    }
    if from.is_empty() || to.is_empty() {
        return Err("Alamat email pengirim dan penerima tidak boleh kosong".to_string());
    }

    let email = Message::builder()
        .from(from.parse().map_err(|e| format!("Alamat pengirim tidak valid: {}", e))?)
        .to(to.parse().map_err(|e| format!("Alamat penerima tidak valid: {}", e))?)
        .subject(subject)
        .body(body)
        .map_err(|e| format!("Gagal membuat email: {}", e))?;

    let creds = Credentials::new(username, password);

    let mailer = if use_tls {
        SmtpTransport::starttls_relay(&smtp_host)
            .map_err(|e| format!("Gagal menghubungkan SMTP: {}", e))?
            .port(smtp_port)
            .credentials(creds)
            .build()
    } else {
        SmtpTransport::builder_dangerous(&smtp_host)
            .port(smtp_port)
            .credentials(creds)
            .build()
    };

    mailer
        .send(&email)
        .map_err(|e| format!("Gagal mengirim email: {}", e))?;

    Ok(())
}
