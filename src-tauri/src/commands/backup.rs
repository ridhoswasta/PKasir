use crate::db::AppDb;
use rusqlite::Connection;
use std::path::PathBuf;
use tauri::State;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub db_path: String,
    pub db_size: u64,
}

#[tauri::command]
pub fn get_backup_info(db: State<'_, AppDb>) -> Result<BackupInfo, String> {
    let path = db.1.clone();
    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    Ok(BackupInfo {
        db_path: path.to_string_lossy().to_string(),
        db_size: size,
    })
}

#[tauri::command]
pub fn backup_database(db: State<'_, AppDb>, target_path: String) -> Result<serde_json::Value, String> {
    let target = PathBuf::from(&target_path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Gagal membuat folder: {}", e))?;
        }
    }

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Remove existing file at target (VACUUM INTO fails if it exists)
    if target.exists() {
        std::fs::remove_file(&target).map_err(|e| format!("Gagal menimpa file: {}", e))?;
    }
    // VACUUM INTO creates a fresh, consistent copy of the DB
    let escaped = target_path.replace('\'', "''");
    conn.execute_batch(&format!("VACUUM INTO '{}'", escaped))
        .map_err(|e| format!("Gagal backup: {}", e))?;

    // Update lastBackupAt
    let now = chrono::Utc::now().to_rfc3339();
    let _ = conn.execute(
        "UPDATE settings SET lastBackupAt=?1 WHERE id='default'",
        [&now],
    );

    Ok(serde_json::json!({ "ok": true, "path": target_path, "at": now }))
}

#[tauri::command]
pub fn restore_database(db: State<'_, AppDb>, source_path: String) -> Result<serde_json::Value, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err("File backup tidak ditemukan".into());
    }

    // Validate source is a valid SQLite DB with our tables
    {
        let test = Connection::open(&source).map_err(|e| format!("File bukan database valid: {}", e))?;
        let ok: Result<i64, _> = test.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='settings'",
            [],
            |r| r.get(0),
        );
        if !matches!(ok, Ok(n) if n > 0) {
            return Err("File backup tidak berisi data POS yang valid".into());
        }
    }

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let escaped = source_path.replace('\'', "''");

    // Use a transaction that: attaches the source, clears and copies each known table, detaches
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute_batch(&format!("ATTACH DATABASE '{}' AS src;", escaped))
        .map_err(|e| format!("Gagal attach backup: {}", e))?;

    let tables = [
        "settings",
        "products",
        "customers",
        "transactions",
        "money_flow",
        "users",
        "activity_log",
        "discounts",
        "held_orders",
        "suppliers",
        "product_batches",
        "stock_movements",
        "purchase_orders",
    ];
    for t in &tables {
        // Only copy if the source has the table (older backups may not)
        let has: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM src.sqlite_master WHERE type='table' AND name=?1",
                [t],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if has == 0 {
            continue;
        }
        tx.execute_batch(&format!("DELETE FROM {}; INSERT INTO {} SELECT * FROM src.{};", t, t, t))
            .map_err(|e| format!("Gagal restore tabel {}: {}", t, e))?;
    }
    tx.execute_batch("DETACH DATABASE src;")
        .map_err(|e| format!("Gagal detach: {}", e))?;
    tx.commit().map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub fn pick_backup_save_path(default_name: Option<String>) -> Option<String> {
    let name = default_name.unwrap_or_else(|| format!("pkasir-backup-{}.db", chrono::Local::now().format("%Y%m%d-%H%M%S")));
    rfd::FileDialog::new()
        .add_filter("SQLite DB", &["db"])
        .set_file_name(&name)
        .save_file()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn pick_backup_open_path() -> Option<String> {
    rfd::FileDialog::new()
        .add_filter("SQLite DB", &["db"])
        .pick_file()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn pick_directory() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

/// Periodic auto-backup called by the frontend on an interval.
/// Does NOT check time - the frontend's interval controls timing.
/// Returns the path of the created backup, or None if disabled / no path.
#[tauri::command]
pub fn auto_backup_tick(db: State<'_, AppDb>) -> Result<Option<String>, String> {
    let (enabled, dir): (i64, String) = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT autoBackupEnabled, autoBackupPath FROM settings WHERE id='default'",
            [],
            |r| Ok((
                r.get::<_, Option<i64>>(0)?.unwrap_or(0),
                r.get::<_, Option<String>>(1)?.unwrap_or_default(),
            )),
        )
        .map_err(|e| e.to_string())?
    };

    if enabled == 0 || dir.trim().is_empty() {
        return Ok(None);
    }

    let dir_path = PathBuf::from(&dir);
    std::fs::create_dir_all(&dir_path).map_err(|e| format!("Gagal membuat folder backup: {}", e))?;
    // Always use a fixed filename so each auto-backup replaces the previous one
    let target = dir_path.join("pkasir-auto-backup.db");
    let target_str = target.to_string_lossy().to_string();

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    if target.exists() {
        std::fs::remove_file(&target).map_err(|e| format!("Gagal menimpa file: {}", e))?;
    }
    let escaped = target_str.replace('\'', "''");
    conn.execute_batch(&format!("VACUUM INTO '{}'", escaped))
        .map_err(|e| format!("Gagal auto-backup: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    let _ = conn.execute(
        "UPDATE settings SET lastBackupAt=?1 WHERE id='default'",
        [&now],
    );

    Ok(Some(target_str))
}

/// Run auto-backup if it is enabled and has not been done today.
/// Returns the path of the created backup, or None if no backup was made.
#[tauri::command]
pub fn auto_backup_if_due(db: State<'_, AppDb>) -> Result<Option<String>, String> {
    let (enabled, dir, last): (i64, String, String) = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT autoBackupEnabled, autoBackupPath, lastBackupAt FROM settings WHERE id='default'",
            [],
            |r| Ok((
                r.get::<_, Option<i64>>(0)?.unwrap_or(0),
                r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                r.get::<_, Option<String>>(2)?.unwrap_or_default(),
            )),
        )
        .map_err(|e| e.to_string())?
    };

    if enabled == 0 || dir.trim().is_empty() {
        return Ok(None);
    }

    // Skip if last backup was within the last 20 hours
    if !last.is_empty() {
        if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(&last) {
            let hours = chrono::Utc::now().signed_duration_since(parsed.with_timezone(&chrono::Utc)).num_hours();
            if hours < 20 {
                return Ok(None);
            }
        }
    }

    let dir_path = PathBuf::from(&dir);
    std::fs::create_dir_all(&dir_path).map_err(|e| format!("Gagal membuat folder backup: {}", e))?;
    // Single rolling file — replaces previous auto-backup
    let target = dir_path.join("pkasir-auto-backup.db");
    let target_str = target.to_string_lossy().to_string();

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    if target.exists() {
        std::fs::remove_file(&target).map_err(|e| format!("Gagal menimpa file: {}", e))?;
    }
    let escaped = target_str.replace('\'', "''");
    conn.execute_batch(&format!("VACUUM INTO '{}'", escaped))
        .map_err(|e| format!("Gagal auto-backup: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    let _ = conn.execute(
        "UPDATE settings SET lastBackupAt=?1 WHERE id='default'",
        [&now],
    );

    Ok(Some(target_str))
}
