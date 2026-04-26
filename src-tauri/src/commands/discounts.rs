use crate::db::AppDb;
use crate::models::{Discount, DiscountInput};
use tauri::State;

fn now_id() -> String {
    chrono::Utc::now().timestamp_millis().to_string()
}

#[tauri::command]
pub fn get_discounts(db: State<'_, AppDb>) -> Result<Vec<Discount>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, type, value, startDate, endDate, productIds, categoryFilter, isActive, priority, description FROM discounts ORDER BY priority DESC, endDate DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let product_ids_str: String = row.get::<_, String>(6).unwrap_or_else(|_| "[]".into());
            let product_ids: serde_json::Value =
                serde_json::from_str(&product_ids_str).unwrap_or(serde_json::json!([]));
            let category_filter_str: String = row.get::<_, String>(7).unwrap_or_else(|_| "[]".into());
            let category_filter: serde_json::Value =
                serde_json::from_str(&category_filter_str).unwrap_or(serde_json::json!([]));
            Ok(Discount {
                id: row.get(0)?,
                name: row.get(1)?,
                r#type: row.get(2)?,
                value: row.get(3)?,
                start_date: row.get(4)?,
                end_date: row.get(5)?,
                product_ids,
                category_filter,
                is_active: row.get(8)?,
                priority: row.get(9)?,
                description: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut discounts = Vec::new();
    for r in rows {
        discounts.push(r.map_err(|e| e.to_string())?);
    }
    Ok(discounts)
}

#[tauri::command]
pub fn get_active_discounts(db: State<'_, AppDb>) -> Result<Vec<Discount>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let mut stmt = conn
        .prepare("SELECT id, name, type, value, startDate, endDate, productIds, categoryFilter, isActive, priority, description FROM discounts WHERE isActive = 1 AND startDate <= ?1 AND endDate >= ?1 ORDER BY priority DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&now], |row| {
            let product_ids_str: String = row.get::<_, String>(6).unwrap_or_else(|_| "[]".into());
            let product_ids: serde_json::Value =
                serde_json::from_str(&product_ids_str).unwrap_or(serde_json::json!([]));
            let category_filter_str: String = row.get::<_, String>(7).unwrap_or_else(|_| "[]".into());
            let category_filter: serde_json::Value =
                serde_json::from_str(&category_filter_str).unwrap_or(serde_json::json!([]));
            Ok(Discount {
                id: row.get(0)?,
                name: row.get(1)?,
                r#type: row.get(2)?,
                value: row.get(3)?,
                start_date: row.get(4)?,
                end_date: row.get(5)?,
                product_ids,
                category_filter,
                is_active: row.get(8)?,
                priority: row.get(9)?,
                description: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut discounts = Vec::new();
    for r in rows {
        discounts.push(r.map_err(|e| e.to_string())?);
    }
    Ok(discounts)
}

#[tauri::command]
pub fn create_discount(db: State<'_, AppDb>, discount: DiscountInput) -> Result<Discount, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = now_id();
    let product_ids_json = serde_json::to_string(&discount.product_ids.unwrap_or(serde_json::json!([])))
        .unwrap_or_else(|_| "[]".into());
    let category_filter_json = serde_json::to_string(&discount.category_filter.unwrap_or(serde_json::json!([])))
        .unwrap_or_else(|_| "[]".into());
    let is_active = discount.is_active.unwrap_or(1);
    let priority = discount.priority.unwrap_or(0);
    conn.execute(
        "INSERT INTO discounts (id, name, type, value, startDate, endDate, productIds, categoryFilter, isActive, priority, description) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
        rusqlite::params![id, discount.name, discount.r#type, discount.value, discount.start_date, discount.end_date, product_ids_json, category_filter_json, is_active, priority, discount.description],
    ).map_err(|e| e.to_string())?;
    Ok(Discount {
        id,
        name: discount.name,
        r#type: discount.r#type,
        value: discount.value,
        start_date: discount.start_date,
        end_date: discount.end_date,
        product_ids: serde_json::from_str(&product_ids_json).unwrap_or(serde_json::json!([])),
        category_filter: serde_json::from_str(&category_filter_json).unwrap_or(serde_json::json!([])),
        is_active,
        priority,
        description: discount.description,
    })
}

#[tauri::command]
pub fn update_discount(db: State<'_, AppDb>, id: String, discount: DiscountInput) -> Result<Discount, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let product_ids_json = serde_json::to_string(&discount.product_ids.unwrap_or(serde_json::json!([])))
        .unwrap_or_else(|_| "[]".into());
    let category_filter_json = serde_json::to_string(&discount.category_filter.unwrap_or(serde_json::json!([])))
        .unwrap_or_else(|_| "[]".into());
    let is_active = discount.is_active.unwrap_or(1);
    let priority = discount.priority.unwrap_or(0);
    conn.execute(
        "UPDATE discounts SET name=?1, type=?2, value=?3, startDate=?4, endDate=?5, productIds=?6, categoryFilter=?7, isActive=?8, priority=?9, description=?10 WHERE id=?11",
        rusqlite::params![discount.name, discount.r#type, discount.value, discount.start_date, discount.end_date, product_ids_json, category_filter_json, is_active, priority, discount.description, id],
    ).map_err(|e| e.to_string())?;
    Ok(Discount {
        id,
        name: discount.name,
        r#type: discount.r#type,
        value: discount.value,
        start_date: discount.start_date,
        end_date: discount.end_date,
        product_ids: serde_json::from_str(&product_ids_json).unwrap_or(serde_json::json!([])),
        category_filter: serde_json::from_str(&category_filter_json).unwrap_or(serde_json::json!([])),
        is_active,
        priority,
        description: discount.description,
    })
}

#[tauri::command]
pub fn delete_discount(db: State<'_, AppDb>, id: String) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM discounts WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
