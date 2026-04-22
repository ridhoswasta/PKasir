use crate::db::AppDb;
use crate::models::{Customer, CustomerInput};
use rusqlite::OptionalExtension;
use tauri::State;

fn now_id() -> String {
    chrono::Utc::now().timestamp_millis().to_string()
}

#[tauri::command]
pub fn get_customers(db: State<'_, AppDb>) -> Result<Vec<Customer>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, phone, points FROM customers")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                points: row.get(3)?,
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
pub fn create_customer(db: State<'_, AppDb>, input: CustomerInput) -> Result<Customer, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let phone_trim = input.phone.as_deref().map(str::trim).unwrap_or("").to_string();
    if !phone_trim.is_empty() {
        let existing: Option<String> = conn
            .query_row(
                "SELECT name FROM customers WHERE phone = ?1 LIMIT 1",
                [&phone_trim],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .flatten();
        if let Some(other_name) = existing {
            return Err(format!("Nomor telepon sudah terdaftar atas nama: {}", other_name));
        }
    }
    let phone_to_store = if phone_trim.is_empty() { None } else { Some(phone_trim.clone()) };
    let id = now_id();
    conn.execute(
        "INSERT INTO customers (id, name, phone, points) VALUES (?1,?2,?3,?4)",
        rusqlite::params![id, input.name, phone_to_store, 0],
    )
    .map_err(|e| e.to_string())?;
    Ok(Customer {
        id,
        name: Some(input.name),
        phone: if phone_trim.is_empty() { None } else { Some(phone_trim) },
        points: Some(0.0),
    })
}

#[tauri::command]
pub fn update_customer(
    db: State<'_, AppDb>,
    id: String,
    input: CustomerInput,
) -> Result<Customer, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Get old name to propagate changes
    let old_name: Option<String> = conn
        .query_row("SELECT name FROM customers WHERE id=?1", [&id], |r| r.get(0))
        .map_err(|_| "Customer tidak ditemukan".to_string())?;

    let phone_trim = input.phone.as_deref().map(str::trim).unwrap_or("").to_string();
    if !phone_trim.is_empty() {
        let conflict: Option<String> = conn
            .query_row(
                "SELECT name FROM customers WHERE phone = ?1 AND id <> ?2 LIMIT 1",
                rusqlite::params![phone_trim, id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .flatten();
        if let Some(other_name) = conflict {
            return Err(format!("Nomor telepon sudah terdaftar atas nama: {}", other_name));
        }
    }
    let phone_to_store = if phone_trim.is_empty() { None } else { Some(phone_trim.clone()) };

    conn.execute(
        "UPDATE customers SET name=?1, phone=?2, points=?3 WHERE id=?4",
        rusqlite::params![input.name, phone_to_store, input.points.unwrap_or(0.0), id],
    )
    .map_err(|e| e.to_string())?;

    // Propagate name change to transactions
    if let Some(old) = old_name {
        if old != input.name {
            conn.execute(
                "UPDATE transactions SET customer=?1 WHERE customer=?2",
                rusqlite::params![input.name, old],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(Customer {
        id,
        name: Some(input.name),
        phone: if phone_trim.is_empty() { None } else { Some(phone_trim) },
        points: input.points,
    })
}

#[tauri::command]
pub fn delete_customer(db: State<'_, AppDb>, id: String) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM customers WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
