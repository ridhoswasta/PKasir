use crate::db::AppDb;
use crate::models::{CreateTransactionInput, Transaction, TransactionsPage};
use tauri::State;

fn now_id() -> String {
    chrono::Utc::now().timestamp_millis().to_string()
}

#[tauri::command]
pub fn get_transactions(db: State<'_, AppDb>) -> Result<Vec<Transaction>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, date, subtotal, tax, serviceCharge, total, paymentMethod, amountPaid, change, customer, items, tableName, note, cashier FROM transactions ORDER BY date DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let items_str: String = row.get::<_, String>(10).unwrap_or_else(|_| "[]".into());
            let items: serde_json::Value =
                serde_json::from_str(&items_str).unwrap_or(serde_json::json!([]));
            Ok(Transaction {
                id: row.get(0)?,
                date: row.get(1)?,
                subtotal: row.get(2)?,
                tax: row.get(3)?,
                service_charge: row.get(4)?,
                total: row.get(5)?,
                payment_method: row.get(6)?,
                amount_paid: row.get(7)?,
                change: row.get(8)?,
                customer: row.get(9)?,
                items,
                table_name: row.get(11)?,
                note: row.get(12)?,
                cashier: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut txs = Vec::new();
    for r in rows {
        txs.push(r.map_err(|e| e.to_string())?);
    }
    Ok(txs)
}

/// Paginated transaction list — avoids loading the full history on the
/// Riwayat Transaksi page. Relies on `idx_transactions_date` for fast
/// ORDER BY + LIMIT/OFFSET.
#[tauri::command]
pub fn get_transactions_page(
    db: State<'_, AppDb>,
    limit: i64,
    offset: i64,
) -> Result<TransactionsPage, String> {
    let limit = limit.clamp(1, 500);
    let offset = offset.max(0);

    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM transactions", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, date, subtotal, tax, serviceCharge, total, paymentMethod, amountPaid, change, customer, items, tableName, note, cashier
             FROM transactions
             ORDER BY date DESC
             LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![limit, offset], |row| {
            let items_str: String = row.get::<_, String>(10).unwrap_or_else(|_| "[]".into());
            let items: serde_json::Value =
                serde_json::from_str(&items_str).unwrap_or(serde_json::json!([]));
            Ok(Transaction {
                id: row.get(0)?,
                date: row.get(1)?,
                subtotal: row.get(2)?,
                tax: row.get(3)?,
                service_charge: row.get(4)?,
                total: row.get(5)?,
                payment_method: row.get(6)?,
                amount_paid: row.get(7)?,
                change: row.get(8)?,
                customer: row.get(9)?,
                items,
                table_name: row.get(11)?,
                note: row.get(12)?,
                cashier: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::with_capacity(limit as usize);
    for r in rows {
        items.push(r.map_err(|e| e.to_string())?);
    }

    Ok(TransactionsPage { items, total })
}

#[tauri::command]
pub fn create_transaction(
    db: State<'_, AppDb>,
    input: CreateTransactionInput,
) -> Result<Transaction, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = now_id();
    let date = chrono::Utc::now().to_rfc3339();
    let items_json = serde_json::to_string(&input.items).unwrap_or_else(|_| "[]".into());

    // Atomic: insert tx + update stock + insert money_flow + update customer points
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO transactions (id, date, subtotal, tax, serviceCharge, total, paymentMethod, amountPaid, change, customer, items, tableName, note, cashier) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
        rusqlite::params![id, date, input.subtotal, input.tax, input.service_charge, input.total, input.payment_method, input.amount_paid, input.change, input.customer, items_json, input.table_name, input.note, input.cashier],
    ).map_err(|e| e.to_string())?;

    // Update stock for each item
    if let Some(items) = input.items.as_array() {
        for item in items {
            let qty = item.get("quantity").and_then(|v| v.as_i64()).unwrap_or(0);
            let product_id = item.get("productId").and_then(|v| v.as_str()).unwrap_or("");
            if !product_id.is_empty() && qty > 0 {
                tx.execute(
                    "UPDATE products SET stock = stock - ?1 WHERE id = ?2",
                    rusqlite::params![qty, product_id],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    // Record income in money_flow
    let flow_id = format!("{}_flow", id);
    tx.execute(
        "INSERT INTO money_flow (id, date, type, category, amount, description) VALUES (?1,?2,?3,?4,?5,?6)",
        rusqlite::params![flow_id, date, "Pemasukan", "Penjualan", input.total, format!("Transaksi #{}", id)],
    ).map_err(|e| e.to_string())?;

    // Update customer points
    if let Some(ref cust) = input.customer {
        if cust != "Walk-In Customer" && !cust.is_empty() {
            let point_multiplier: f64 = tx
                .query_row(
                    "SELECT pointMultiplier FROM settings WHERE id='default'",
                    [],
                    |r| r.get(0),
                )
                .unwrap_or(1000.0);
            let earned = (input.total / point_multiplier).floor() as i64;
            if earned > 0 {
                tx.execute(
                    "UPDATE customers SET points = points + ?1 WHERE name = ?2",
                    rusqlite::params![earned, cust],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(Transaction {
        id,
        date: Some(date),
        subtotal: Some(input.subtotal),
        tax: Some(input.tax),
        service_charge: Some(input.service_charge),
        total: Some(input.total),
        payment_method: Some(input.payment_method),
        amount_paid: Some(input.amount_paid),
        change: Some(input.change),
        customer: input.customer,
        items: input.items,
        table_name: input.table_name,
        note: input.note,
        cashier: input.cashier,
    })
}

#[tauri::command]
pub fn delete_transaction(db: State<'_, AppDb>, id: String) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM transactions WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM money_flow WHERE description=?1",
        [&format!("Transaksi #{}", id)],
    )
    .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
