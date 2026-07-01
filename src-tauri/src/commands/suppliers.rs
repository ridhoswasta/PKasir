use crate::db::AppDb;
use crate::models::{Supplier, SupplierInput};
use rusqlite::params;
use tauri::State;

fn now_id() -> String {
    chrono::Utc::now().timestamp_millis().to_string()
}

#[tauri::command]
pub fn get_suppliers(db: State<'_, AppDb>) -> Result<Vec<Supplier>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, contactPerson, phone, email, address, note, createdAt FROM suppliers ORDER BY name COLLATE NOCASE ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Supplier {
                id: row.get(0)?,
                name: row.get(1)?,
                contact_person: row.get(2)?,
                phone: row.get(3)?,
                email: row.get(4)?,
                address: row.get(5)?,
                note: row.get(6)?,
                created_at: row.get(7)?,
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
pub fn create_supplier(db: State<'_, AppDb>, supplier: SupplierInput) -> Result<Supplier, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = now_id();
    let created = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO suppliers (id, name, contactPerson, phone, email, address, note, createdAt) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![id, supplier.name, supplier.contact_person, supplier.phone, supplier.email, supplier.address, supplier.note, created],
    ).map_err(|e| e.to_string())?;
    Ok(Supplier {
        id,
        name: Some(supplier.name),
        contact_person: supplier.contact_person,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        note: supplier.note,
        created_at: Some(created),
    })
}

#[tauri::command]
pub fn update_supplier(db: State<'_, AppDb>, id: String, supplier: SupplierInput) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE suppliers SET name=?1, contactPerson=?2, phone=?3, email=?4, address=?5, note=?6 WHERE id=?7",
        params![supplier.name, supplier.contact_person, supplier.phone, supplier.email, supplier.address, supplier.note, id],
    ).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn delete_supplier(db: State<'_, AppDb>, id: String) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM suppliers WHERE id=?1", [&id]).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
