use crate::db::AppDb;
use crate::models::{PurchaseOrder, PurchaseOrderInput};
use rusqlite::params;
use tauri::State;

fn now_id() -> String {
    chrono::Utc::now().timestamp_millis().to_string()
}

fn uid(prefix: &str) -> String {
    format!("{}{}", prefix, chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0))
}

fn items_total(items: &serde_json::Value) -> f64 {
    items
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|it| {
                    let qty = it.get("qty").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let cost = it.get("costPrice").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    qty * cost
                })
                .sum()
        })
        .unwrap_or(0.0)
}

fn map_po(row: &rusqlite::Row) -> rusqlite::Result<PurchaseOrder> {
    let items_str: String = row.get::<_, String>(9).unwrap_or_else(|_| "[]".into());
    let items: serde_json::Value = serde_json::from_str(&items_str).unwrap_or(serde_json::json!([]));
    Ok(PurchaseOrder {
        id: row.get(0)?,
        supplier_id: row.get(1)?,
        supplier_name: row.get(2)?,
        status: row.get(3)?,
        order_date: row.get(4)?,
        expected_date: row.get(5)?,
        received_date: row.get(6)?,
        note: row.get(7)?,
        total: row.get(8)?,
        items,
        created_at: row.get(10)?,
    })
}

const PO_SELECT: &str = "SELECT id, supplierId, supplierName, status, orderDate, expectedDate, receivedDate, note, total, items, createdAt FROM purchase_orders";

#[tauri::command]
pub fn get_purchase_orders(db: State<'_, AppDb>) -> Result<Vec<PurchaseOrder>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!("{} ORDER BY orderDate DESC", PO_SELECT))
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], map_po).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn create_purchase_order(db: State<'_, AppDb>, order: PurchaseOrderInput) -> Result<PurchaseOrder, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = now_id();
    let created = chrono::Utc::now().to_rfc3339();
    let order_date = order.order_date.clone().unwrap_or_else(|| created.clone());
    let status = order.status.clone().unwrap_or_else(|| "draft".into());
    let total = items_total(&order.items);
    let items_json = serde_json::to_string(&order.items).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "INSERT INTO purchase_orders (id, supplierId, supplierName, status, orderDate, expectedDate, receivedDate, note, total, items, createdAt)
         VALUES (?1,?2,?3,?4,?5,?6,NULL,?7,?8,?9,?10)",
        params![id, order.supplier_id, order.supplier_name, status, order_date, order.expected_date, order.note, total, items_json, created],
    ).map_err(|e| e.to_string())?;
    Ok(PurchaseOrder {
        id,
        supplier_id: order.supplier_id,
        supplier_name: order.supplier_name,
        status,
        order_date: Some(order_date),
        expected_date: order.expected_date,
        received_date: None,
        note: order.note,
        total: Some(total),
        items: order.items,
        created_at: Some(created),
    })
}

#[tauri::command]
pub fn update_purchase_order(db: State<'_, AppDb>, id: String, order: PurchaseOrderInput) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Don't allow editing an already-received PO (stock has been applied).
    let status: String = conn.query_row("SELECT status FROM purchase_orders WHERE id=?1", [&id], |r| r.get(0))
        .map_err(|_| "PO tidak ditemukan".to_string())?;
    if status == "received" {
        return Err("PO yang sudah diterima tidak dapat diubah".into());
    }
    let total = items_total(&order.items);
    let items_json = serde_json::to_string(&order.items).unwrap_or_else(|_| "[]".into());
    let new_status = order.status.clone().unwrap_or(status);
    conn.execute(
        "UPDATE purchase_orders SET supplierId=?1, supplierName=?2, status=?3, orderDate=COALESCE(?4, orderDate), expectedDate=?5, note=?6, total=?7, items=?8 WHERE id=?9",
        params![order.supplier_id, order.supplier_name, new_status, order.order_date, order.expected_date, order.note, total, items_json, id],
    ).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn delete_purchase_order(db: State<'_, AppDb>, id: String) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM purchase_orders WHERE id=?1", [&id]).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

/// Receive a purchase order: adds stock for each line, creates batches for
/// batch-tracked products, logs stock movements, and (optionally) records the
/// purchase as an expense in money_flow. Idempotent-guarded against double receive.
#[tauri::command]
pub fn receive_purchase_order(
    db: State<'_, AppDb>,
    id: String,
    items: Option<serde_json::Value>,
    record_expense: Option<bool>,
    user: Option<String>,
) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let (status, supplier_id, supplier_name, stored_items): (String, Option<String>, Option<String>, String) = tx
        .query_row(
            "SELECT status, supplierId, supplierName, items FROM purchase_orders WHERE id=?1",
            [&id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|_| "PO tidak ditemukan".to_string())?;
    if status == "received" {
        return Err("PO ini sudah diterima".into());
    }

    let lines = items.unwrap_or_else(|| serde_json::from_str(&stored_items).unwrap_or(serde_json::json!([])));
    let now = chrono::Utc::now().to_rfc3339();
    let mut total_cost = 0.0_f64;
    let mut updated_items: Vec<serde_json::Value> = Vec::new();

    if let Some(arr) = lines.as_array() {
        for it in arr {
            let product_id = it.get("productId").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let qty_ordered = it.get("qty").and_then(|v| v.as_i64()).unwrap_or(0);
            let received = it.get("qtyReceived").and_then(|v| v.as_i64()).unwrap_or(qty_ordered);
            let cost = it.get("costPrice").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let batch_no = it.get("batchNo").and_then(|v| v.as_str()).filter(|s| !s.is_empty());
            let expiry = it.get("expiryDate").and_then(|v| v.as_str()).filter(|s| !s.is_empty());

            if !product_id.is_empty() && received > 0 {
                tx.execute("UPDATE products SET stock = COALESCE(stock,0) + ?1 WHERE id=?2", params![received, product_id])
                    .map_err(|e| e.to_string())?;
                let balance: i64 = tx.query_row("SELECT COALESCE(stock,0) FROM products WHERE id=?1", [&product_id], |r| r.get(0)).unwrap_or(0);
                let pname: Option<String> = tx.query_row("SELECT name FROM products WHERE id=?1", [&product_id], |r| r.get(0)).ok();
                let tracks: i64 = tx.query_row("SELECT COALESCE(trackBatches,0) FROM products WHERE id=?1", [&product_id], |r| r.get(0)).unwrap_or(0);

                let mut batch_id: Option<String> = None;
                if tracks == 1 {
                    let bid = uid("bt");
                    tx.execute(
                        "INSERT INTO product_batches (id, productId, batchNo, expiryDate, qty, initialQty, costPrice, supplierId, receivedDate, note, createdAt)
                         VALUES (?1,?2,?3,?4,?5,?5,?6,?7,?8,?9,?8)",
                        params![bid, product_id, batch_no, expiry, received, cost, supplier_id, now, format!("Penerimaan PO #{}", id)],
                    ).map_err(|e| e.to_string())?;
                    batch_id = Some(bid);
                }
                let _ = crate::commands::inventory::record_movement(
                    &tx, &product_id, pname.as_deref(), batch_id.as_deref(), "purchase", received, Some(balance), Some(&id), Some("Penerimaan PO"), user.as_deref(),
                );
                total_cost += received as f64 * cost;
            }

            let mut obj = it.clone();
            if let Some(m) = obj.as_object_mut() {
                m.insert("qtyReceived".into(), serde_json::json!(received));
            }
            updated_items.push(obj);
        }
    }

    let updated_items_str = serde_json::to_string(&updated_items).unwrap_or_else(|_| "[]".into());
    tx.execute(
        "UPDATE purchase_orders SET status='received', receivedDate=?1, items=?2 WHERE id=?3",
        params![now, updated_items_str, id],
    ).map_err(|e| e.to_string())?;

    if record_expense.unwrap_or(true) && total_cost > 0.0 {
        let flow_id = uid("pof");
        let desc = match &supplier_name {
            Some(s) if !s.is_empty() => format!("Pembelian PO #{} - {}", id, s),
            _ => format!("Pembelian PO #{}", id),
        };
        tx.execute(
            "INSERT INTO money_flow (id, date, type, category, amount, description) VALUES (?1,?2,?3,?4,?5,?6)",
            params![flow_id, now, "Pengeluaran", "Pembelian", total_cost, desc],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true, "total": total_cost }))
}
