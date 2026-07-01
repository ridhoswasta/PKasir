use crate::db::AppDb;
use crate::models::{ProductBatch, ProductBatchInput, StockMovement};
use rusqlite::{params, Connection};
use tauri::State;

fn uid(prefix: &str) -> String {
    format!("{}{}", prefix, chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0))
}

// ── Shared helpers (used by sales, purchase orders, manual ops) ──────────────

/// Append an entry to the stock-movement ledger. Best-effort: callers wrap in
/// `let _ =` on hot paths so a logging failure never breaks a sale.
#[allow(clippy::too_many_arguments)]
pub fn record_movement(
    conn: &Connection,
    product_id: &str,
    product_name: Option<&str>,
    batch_id: Option<&str>,
    mtype: &str,
    quantity: i64,
    balance_after: Option<i64>,
    reference: Option<&str>,
    note: Option<&str>,
    user: Option<&str>,
) -> rusqlite::Result<usize> {
    let date = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO stock_movements (id, productId, productName, batchId, type, quantity, balanceAfter, reference, note, user, date)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
        params![uid("mv"), product_id, product_name, batch_id, mtype, quantity, balance_after, reference, note, user, date],
    )
}

/// Deduct `qty` units from a product's batches, earliest-expiry first (FEFO).
/// Best-effort: if batches sum to less than qty, it deducts what's available.
/// `products.stock` remains the authoritative quantity regardless.
pub fn fefo_deduct(conn: &Connection, product_id: &str, qty: i64) -> rusqlite::Result<()> {
    if qty <= 0 {
        return Ok(());
    }
    // Collect candidate batches first (so the prepared statement is dropped
    // before we issue UPDATEs on the same connection).
    let batches: Vec<(String, i64)> = {
        let mut stmt = conn.prepare(
            "SELECT id, qty FROM product_batches
             WHERE productId = ?1 AND qty > 0
             ORDER BY (expiryDate IS NULL OR expiryDate = ''), expiryDate ASC, createdAt ASC",
        )?;
        let rows = stmt.query_map([product_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))?;
        rows.filter_map(|r| r.ok()).collect()
    };
    let mut remaining = qty;
    for (bid, bqty) in batches {
        if remaining <= 0 {
            break;
        }
        let take = remaining.min(bqty);
        conn.execute("UPDATE product_batches SET qty = qty - ?1 WHERE id = ?2", params![take, bid])?;
        remaining -= take;
    }
    Ok(())
}

/// When batch tracking is turned on for a product that already has stock but no
/// batches, create a single opening batch so SUM(batch qty) == products.stock.
/// Does NOT change stock. Safe to call repeatedly.
pub fn ensure_opening_batch(conn: &Connection, product_id: &str) -> rusqlite::Result<()> {
    let (tracks, stock): (i64, i64) = conn
        .query_row(
            "SELECT COALESCE(trackBatches,0), COALESCE(stock,0) FROM products WHERE id = ?1",
            [product_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0, 0));
    if tracks != 1 || stock <= 0 {
        return Ok(());
    }
    let batch_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM product_batches WHERE productId = ?1", [product_id], |r| r.get(0))
        .unwrap_or(0);
    if batch_count > 0 {
        return Ok(());
    }
    let created = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO product_batches (id, productId, batchNo, expiryDate, qty, initialQty, costPrice, supplierId, receivedDate, note, createdAt)
         VALUES (?1,?2,?3,NULL,?4,?4,NULL,NULL,?5,?6,?5)",
        params![uid("bt"), product_id, "STOK-AWAL", stock, created, "Stok awal saat batch tracking diaktifkan"],
    )?;
    Ok(())
}

fn map_batch(row: &rusqlite::Row) -> rusqlite::Result<ProductBatch> {
    Ok(ProductBatch {
        id: row.get(0)?,
        product_id: row.get(1)?,
        product_name: row.get(2)?,
        batch_no: row.get(3)?,
        expiry_date: row.get(4)?,
        qty: row.get(5)?,
        initial_qty: row.get(6)?,
        cost_price: row.get(7)?,
        supplier_id: row.get(8)?,
        received_date: row.get(9)?,
        note: row.get(10)?,
        created_at: row.get(11)?,
    })
}

const BATCH_SELECT: &str = "SELECT b.id, b.productId, p.name, b.batchNo, b.expiryDate, b.qty, b.initialQty, b.costPrice, b.supplierId, b.receivedDate, b.note, b.createdAt FROM product_batches b LEFT JOIN products p ON p.id = b.productId";

// ── Batch commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_batches(db: State<'_, AppDb>, product_id: Option<String>) -> Result<Vec<ProductBatch>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "{} WHERE (?1 IS NULL OR b.productId = ?1) ORDER BY (b.expiryDate IS NULL OR b.expiryDate = ''), b.expiryDate ASC, b.createdAt ASC",
        BATCH_SELECT
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![product_id], map_batch)
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// Add a received lot. Increases product stock by `qty` and logs a movement.
#[tauri::command]
pub fn create_batch(db: State<'_, AppDb>, batch: ProductBatchInput, user: Option<String>) -> Result<ProductBatch, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let id = uid("bt");
    let created = chrono::Utc::now().to_rfc3339();
    let received = batch.received_date.clone().unwrap_or_else(|| created.clone());
    tx.execute(
        "INSERT INTO product_batches (id, productId, batchNo, expiryDate, qty, initialQty, costPrice, supplierId, receivedDate, note, createdAt)
         VALUES (?1,?2,?3,?4,?5,?5,?6,?7,?8,?9,?10)",
        params![id, batch.product_id, batch.batch_no, batch.expiry_date, batch.qty, batch.cost_price, batch.supplier_id, received, batch.note, created],
    ).map_err(|e| e.to_string())?;

    if batch.qty != 0 {
        tx.execute("UPDATE products SET stock = COALESCE(stock,0) + ?1 WHERE id = ?2", params![batch.qty, batch.product_id])
            .map_err(|e| e.to_string())?;
    }
    let balance: i64 = tx.query_row("SELECT COALESCE(stock,0) FROM products WHERE id = ?1", [&batch.product_id], |r| r.get(0)).unwrap_or(0);
    let name: Option<String> = tx.query_row("SELECT name FROM products WHERE id = ?1", [&batch.product_id], |r| r.get(0)).ok();
    let _ = record_movement(&tx, &batch.product_id, name.as_deref(), Some(&id), "purchase", batch.qty, Some(balance), None, batch.note.as_deref(), user.as_deref());
    tx.commit().map_err(|e| e.to_string())?;

    Ok(ProductBatch {
        id,
        product_id: batch.product_id,
        product_name: name,
        batch_no: batch.batch_no,
        expiry_date: batch.expiry_date,
        qty: batch.qty,
        initial_qty: batch.qty,
        cost_price: batch.cost_price,
        supplier_id: batch.supplier_id,
        received_date: Some(received),
        note: batch.note,
        created_at: Some(created),
    })
}

/// Edit a batch. If `qty` changes, the difference is applied to product stock
/// and logged as an adjustment so SUM(batch qty) stays consistent with stock.
#[tauri::command]
pub fn update_batch(db: State<'_, AppDb>, id: String, batch: ProductBatchInput, user: Option<String>) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let old_qty: i64 = tx.query_row("SELECT qty FROM product_batches WHERE id = ?1", [&id], |r| r.get(0))
        .map_err(|_| "Batch tidak ditemukan".to_string())?;
    tx.execute(
        "UPDATE product_batches SET batchNo=?1, expiryDate=?2, qty=?3, costPrice=?4, supplierId=?5, receivedDate=?6, note=?7 WHERE id=?8",
        params![batch.batch_no, batch.expiry_date, batch.qty, batch.cost_price, batch.supplier_id, batch.received_date, batch.note, id],
    ).map_err(|e| e.to_string())?;
    let delta = batch.qty - old_qty;
    if delta != 0 {
        tx.execute("UPDATE products SET stock = COALESCE(stock,0) + ?1 WHERE id = ?2", params![delta, batch.product_id])
            .map_err(|e| e.to_string())?;
        let balance: i64 = tx.query_row("SELECT COALESCE(stock,0) FROM products WHERE id = ?1", [&batch.product_id], |r| r.get(0)).unwrap_or(0);
        let name: Option<String> = tx.query_row("SELECT name FROM products WHERE id = ?1", [&batch.product_id], |r| r.get(0)).ok();
        let _ = record_movement(&tx, &batch.product_id, name.as_deref(), Some(&id), "adjustment", delta, Some(balance), None, Some("Koreksi batch"), user.as_deref());
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

/// Delete a batch. Its remaining quantity is removed from product stock and
/// logged as an adjustment.
#[tauri::command]
pub fn delete_batch(db: State<'_, AppDb>, id: String, user: Option<String>) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let (product_id, qty): (String, i64) = tx
        .query_row("SELECT productId, qty FROM product_batches WHERE id = ?1", [&id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|_| "Batch tidak ditemukan".to_string())?;
    tx.execute("DELETE FROM product_batches WHERE id = ?1", [&id]).map_err(|e| e.to_string())?;
    if qty != 0 {
        tx.execute("UPDATE products SET stock = COALESCE(stock,0) - ?1 WHERE id = ?2", params![qty, product_id])
            .map_err(|e| e.to_string())?;
        let balance: i64 = tx.query_row("SELECT COALESCE(stock,0) FROM products WHERE id = ?1", [&product_id], |r| r.get(0)).unwrap_or(0);
        let name: Option<String> = tx.query_row("SELECT name FROM products WHERE id = ?1", [&product_id], |r| r.get(0)).ok();
        let _ = record_movement(&tx, &product_id, name.as_deref(), None, "adjustment", -qty, Some(balance), None, Some("Hapus batch"), user.as_deref());
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

/// Batches expiring within `within_days` days (includes already-expired). qty>0 only.
#[tauri::command]
pub fn get_expiring_batches(db: State<'_, AppDb>, within_days: i64) -> Result<Vec<ProductBatch>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let modifier = format!("+{} days", within_days.max(0));
    let sql = format!(
        "{} WHERE b.qty > 0 AND b.expiryDate IS NOT NULL AND b.expiryDate != '' AND date(b.expiryDate) <= date('now', ?1) ORDER BY b.expiryDate ASC",
        BATCH_SELECT
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![modifier], map_batch).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

// ── Stock-movement ledger ────────────────────────────────────────────────────

#[tauri::command]
pub fn get_stock_movements(db: State<'_, AppDb>, product_id: Option<String>, limit: Option<i64>) -> Result<Vec<StockMovement>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(500).clamp(1, 5000);
    let mut stmt = conn
        .prepare(
            "SELECT id, productId, productName, batchId, type, quantity, balanceAfter, reference, note, user, date
             FROM stock_movements
             WHERE (?1 IS NULL OR productId = ?1)
             ORDER BY date DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![product_id, limit], |row| {
            Ok(StockMovement {
                id: row.get(0)?,
                product_id: row.get(1)?,
                product_name: row.get(2)?,
                batch_id: row.get(3)?,
                r#type: row.get(4)?,
                quantity: row.get(5)?,
                balance_after: row.get(6)?,
                reference: row.get(7)?,
                note: row.get(8)?,
                user: row.get(9)?,
                date: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// Manual stock adjustment with proper ledger logging. Replaces the old
/// "update_product with new stock" approach used by the Inventory screen.
/// For batch-tracked products it keeps batches consistent (FEFO out / opening-in).
#[tauri::command]
pub fn adjust_stock(db: State<'_, AppDb>, product_id: String, delta: i64, note: Option<String>, user: Option<String>) -> Result<i64, String> {
    if delta == 0 {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        return conn.query_row("SELECT COALESCE(stock,0) FROM products WHERE id = ?1", [&product_id], |r| r.get(0)).map_err(|e| e.to_string());
    }
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute("UPDATE products SET stock = COALESCE(stock,0) + ?1 WHERE id = ?2", params![delta, product_id])
        .map_err(|e| e.to_string())?;
    let balance: i64 = tx.query_row("SELECT COALESCE(stock,0) FROM products WHERE id = ?1", [&product_id], |r| r.get(0)).unwrap_or(0);
    let name: Option<String> = tx.query_row("SELECT name FROM products WHERE id = ?1", [&product_id], |r| r.get(0)).ok();
    let tracks: i64 = tx.query_row("SELECT COALESCE(trackBatches,0) FROM products WHERE id = ?1", [&product_id], |r| r.get(0)).unwrap_or(0);
    let _ = record_movement(&tx, &product_id, name.as_deref(), None, "adjustment", delta, Some(balance), None, note.as_deref(), user.as_deref());
    if tracks == 1 {
        if delta < 0 {
            let _ = fefo_deduct(&tx, &product_id, -delta);
        } else {
            // Positive manual adjustment becomes a no-expiry "adjustment" lot.
            let created = chrono::Utc::now().to_rfc3339();
            let _ = tx.execute(
                "INSERT INTO product_batches (id, productId, batchNo, expiryDate, qty, initialQty, costPrice, supplierId, receivedDate, note, createdAt)
                 VALUES (?1,?2,?3,NULL,?4,?4,NULL,NULL,?5,?6,?5)",
                params![uid("bt"), product_id, "PENYESUAIAN", delta, created, note.unwrap_or_else(|| "Penyesuaian stok".into())],
            );
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(balance)
}
