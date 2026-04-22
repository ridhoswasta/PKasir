use crate::db::AppDb;
use crate::models::{CreateMoneyFlowInput, MoneyFlow, MoneyFlowPage};
use tauri::State;

fn now_id() -> String {
    chrono::Utc::now().timestamp_millis().to_string()
}

#[tauri::command]
pub fn get_money_flow(db: State<'_, AppDb>) -> Result<Vec<MoneyFlow>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, date, type, category, amount, description FROM money_flow ORDER BY date DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(MoneyFlow {
                id: row.get(0)?,
                date: row.get(1)?,
                r#type: row.get(2)?,
                category: row.get(3)?,
                amount: row.get(4)?,
                description: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// Paginated cash flow list + aggregate totals — keeps the Arus Kas page
/// responsive even with thousands of rows.
#[tauri::command]
pub fn get_money_flow_page(
    db: State<'_, AppDb>,
    limit: i64,
    offset: i64,
) -> Result<MoneyFlowPage, String> {
    let limit = limit.clamp(1, 500);
    let offset = offset.max(0);

    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let (total, total_income, total_expense): (i64, f64, f64) = conn
        .query_row(
            "SELECT
                COUNT(*),
                COALESCE(SUM(CASE WHEN type='Pemasukan' THEN amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN type='Pengeluaran' THEN amount ELSE 0 END), 0)
             FROM money_flow",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, date, type, category, amount, description
             FROM money_flow
             ORDER BY date DESC
             LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![limit, offset], |row| {
            Ok(MoneyFlow {
                id: row.get(0)?,
                date: row.get(1)?,
                r#type: row.get(2)?,
                category: row.get(3)?,
                amount: row.get(4)?,
                description: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::with_capacity(limit as usize);
    for r in rows {
        items.push(r.map_err(|e| e.to_string())?);
    }

    Ok(MoneyFlowPage {
        items,
        total,
        total_income,
        total_expense,
    })
}

#[tauri::command]
pub fn create_money_flow(
    db: State<'_, AppDb>,
    input: CreateMoneyFlowInput,
) -> Result<MoneyFlow, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = now_id();
    let date = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO money_flow (id, date, type, category, amount, description) VALUES (?1,?2,?3,?4,?5,?6)",
        rusqlite::params![id, date, input.r#type, input.category, input.amount, input.description],
    ).map_err(|e| e.to_string())?;
    Ok(MoneyFlow {
        id,
        date: Some(date),
        r#type: Some(input.r#type),
        category: Some(input.category),
        amount: Some(input.amount),
        description: input.description,
    })
}

#[tauri::command]
pub fn delete_money_flow(db: State<'_, AppDb>, id: String) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM money_flow WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
