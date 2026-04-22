use crate::db::AppDb;
use crate::models::{CreateHeldOrderInput, HeldOrder};
use tauri::State;

fn now_id() -> String {
    chrono::Utc::now().timestamp_millis().to_string()
}

#[tauri::command]
pub fn get_held_orders(db: State<'_, AppDb>) -> Result<Vec<HeldOrder>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, date, label, customer, tableName, note, cashier, items, subtotal, tax, serviceCharge, total
             FROM held_orders ORDER BY date DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let items_str: String = row.get(7)?;
            let items = serde_json::from_str(&items_str).unwrap_or(serde_json::json!([]));
            Ok(HeldOrder {
                id: row.get(0)?,
                date: row.get(1)?,
                label: row.get(2)?,
                customer: row.get(3)?,
                table_name: row.get(4)?,
                note: row.get(5)?,
                cashier: row.get(6)?,
                items,
                subtotal: row.get(8)?,
                tax: row.get(9)?,
                service_charge: row.get(10)?,
                total: row.get(11)?,
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
pub fn create_held_order(
    db: State<'_, AppDb>,
    input: CreateHeldOrderInput,
) -> Result<HeldOrder, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = now_id();
    let date = chrono::Utc::now().to_rfc3339();
    let items_str = serde_json::to_string(&input.items).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO held_orders (id, date, label, customer, tableName, note, cashier, items, subtotal, tax, serviceCharge, total)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        rusqlite::params![
            id,
            date,
            input.label,
            input.customer,
            input.table_name,
            input.note,
            input.cashier,
            items_str,
            input.subtotal,
            input.tax,
            input.service_charge,
            input.total,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(HeldOrder {
        id,
        date: Some(date),
        label: input.label,
        customer: input.customer,
        table_name: input.table_name,
        note: input.note,
        cashier: input.cashier,
        items: input.items,
        subtotal: Some(input.subtotal),
        tax: Some(input.tax),
        service_charge: Some(input.service_charge),
        total: Some(input.total),
    })
}

#[tauri::command]
pub fn delete_held_order(db: State<'_, AppDb>, id: String) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM held_orders WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
