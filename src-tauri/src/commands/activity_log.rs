use crate::db::AppDb;
use crate::models::{ActivityLog, CreateActivityLogInput};
use tauri::State;

fn now_id() -> String {
    chrono::Utc::now().timestamp_millis().to_string()
}

#[tauri::command]
pub fn get_activity_logs(db: State<'_, AppDb>) -> Result<Vec<ActivityLog>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, date, user, role, action, target, detail FROM activity_log ORDER BY date DESC LIMIT 500")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ActivityLog {
                id: row.get(0)?,
                date: row.get(1)?,
                user: row.get(2)?,
                role: row.get(3)?,
                action: row.get(4)?,
                target: row.get(5)?,
                detail: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn log_activity(db: State<'_, AppDb>, input: CreateActivityLogInput) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = now_id();
    let date = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO activity_log (id, date, user, role, action, target, detail) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        rusqlite::params![id, date, input.user, input.role, input.action, input.target, input.detail],
    )
    .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub fn clear_activity_logs(db: State<'_, AppDb>) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM activity_log", [])
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "ok": true }))
}
