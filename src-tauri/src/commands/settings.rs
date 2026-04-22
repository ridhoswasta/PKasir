use crate::db::AppDb;
use crate::models::{Settings, SettingsInput};
use tauri::State;

fn split_csv(s: &Option<String>) -> Vec<String> {
    s.as_deref()
        .unwrap_or("")
        .split(',')
        .filter(|x| !x.is_empty())
        .map(|x| x.to_string())
        .collect()
}

#[tauri::command]
pub fn get_settings(db: State<'_, AppDb>) -> Result<Settings, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT taxRate, serviceCharge, printerName, paperWidth, receiptHeader, receiptFooter, logo, logoWidth, logoHeight, productCategories, flowCategories, productUnits, pointMultiplier, printerType, printerIp, printerPort, printerCharset, printerOpenDrawer, tauriPrinterName, tauriPrinterInterface, tables, cartSound, virtualKeyboard, backupPath, autoBackupEnabled, autoBackupPath, lastBackupAt, autoBackupIntervalSeconds, qrisImage FROM settings WHERE id='default'",
        [],
        |row| {
            let product_categories: Option<String> = row.get(9)?;
            let flow_categories: Option<String> = row.get(10)?;
            let product_units: Option<String> = row.get(11)?;
            let tables: Option<String> = row.get(20)?;
            let receipt_header: Option<String> = row.get(4)?;
            let receipt_footer: Option<String> = row.get(5)?;
            Ok(Settings {
                tax_rate: row.get(0)?,
                service_charge: row.get(1)?,
                printer_name: row.get(2)?,
                paper_width: row.get(3)?,
                receipt_header: receipt_header.map(|s| s.replace("\\n", "\n")),
                receipt_footer: receipt_footer.map(|s| s.replace("\\n", "\n")),
                logo: row.get(6)?,
                logo_width: row.get(7)?,
                logo_height: row.get(8)?,
                product_categories: split_csv(&product_categories),
                flow_categories: split_csv(&flow_categories),
                product_units: split_csv(&product_units),
                point_multiplier: row.get(12)?,
                printer_type: row.get(13)?,
                printer_ip: row.get(14)?,
                printer_port: row.get(15)?,
                printer_charset: row.get(16)?,
                printer_open_drawer: row.get(17)?,
                tauri_printer_name: row.get(18)?,
                tauri_printer_interface: row.get(19)?,
                tables: split_csv(&tables),
                cart_sound: row.get(21)?,
                virtual_keyboard: row.get(22)?,
                backup_path: row.get(23)?,
                auto_backup_enabled: row.get(24)?,
                auto_backup_path: row.get(25)?,
                last_backup_at: row.get(26)?,
                auto_backup_interval_seconds: row.get(27)?,
                qris_image: row.get(28)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_settings(db: State<'_, AppDb>, settings: SettingsInput) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let join = |v: &Option<Vec<String>>| -> String {
        v.as_ref().map(|a| a.join(",")).unwrap_or_default()
    };
    conn.execute(
        "UPDATE settings SET taxRate=?1, serviceCharge=?2, printerName=?3, paperWidth=?4, receiptHeader=?5, receiptFooter=?6, logo=?7, logoWidth=?8, logoHeight=?9, productCategories=?10, flowCategories=?11, productUnits=?12, pointMultiplier=?13, printerType=?14, printerIp=?15, printerPort=?16, printerCharset=?17, printerOpenDrawer=?18, tauriPrinterName=?19, tauriPrinterInterface=?20, tables=?21, cartSound=?22, virtualKeyboard=?23, backupPath=?24, autoBackupEnabled=?25, autoBackupPath=?26, autoBackupIntervalSeconds=?27, qrisImage=?28 WHERE id='default'",
        rusqlite::params![
            settings.tax_rate,
            settings.service_charge,
            settings.printer_name,
            settings.paper_width,
            settings.receipt_header,
            settings.receipt_footer,
            settings.logo,
            settings.logo_width.unwrap_or(120),
            settings.logo_height.unwrap_or(32),
            join(&settings.product_categories),
            join(&settings.flow_categories),
            join(&settings.product_units),
            settings.point_multiplier.unwrap_or(1000.0),
            settings.printer_type.as_deref().unwrap_or("browser"),
            settings.printer_ip.as_deref().unwrap_or(""),
            settings.printer_port.unwrap_or(9100),
            settings.printer_charset.as_deref().unwrap_or("CP437"),
            settings.printer_open_drawer.unwrap_or(0),
            settings.tauri_printer_name.as_deref().unwrap_or(""),
            settings.tauri_printer_interface.as_deref().unwrap_or("USB"),
            join(&settings.tables),
            settings.cart_sound.as_deref().unwrap_or("scanner"),
            settings.virtual_keyboard.unwrap_or(0),
            settings.backup_path.as_deref().unwrap_or(""),
            settings.auto_backup_enabled.unwrap_or(0),
            settings.auto_backup_path.as_deref().unwrap_or(""),
            settings.auto_backup_interval_seconds.unwrap_or(0),
            settings.qris_image.as_deref().unwrap_or(""),
        ],
    ).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
