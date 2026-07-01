use crate::db::AppDb;
use crate::models::{Product, ProductInput};
use tauri::State;

fn now_id() -> String {
    chrono::Utc::now().timestamp_millis().to_string()
}

#[tauri::command]
pub fn get_products(db: State<'_, AppDb>) -> Result<Vec<Product>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, image, category, unit, costPrice, price, stock, variants, trackBatches, supplierId, reorderPoint FROM products")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let variants_str: String = row.get::<_, String>(9).unwrap_or_else(|_| "[]".into());
            let variants: serde_json::Value =
                serde_json::from_str(&variants_str).unwrap_or(serde_json::json!([]));
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                image: row.get(3)?,
                category: row.get(4)?,
                unit: row.get(5)?,
                cost_price: row.get(6)?,
                price: row.get(7)?,
                stock: row.get(8)?,
                variants,
                track_batches: row.get(10).ok(),
                supplier_id: row.get(11).ok(),
                reorder_point: row.get(12).ok(),
            })
        })
        .map_err(|e| e.to_string())?;
    let mut products = Vec::new();
    for r in rows {
        products.push(r.map_err(|e| e.to_string())?);
    }
    Ok(products)
}

#[tauri::command]
pub fn create_product(db: State<'_, AppDb>, product: ProductInput) -> Result<Product, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = now_id();
    let variants_json = serde_json::to_string(&product.variants.unwrap_or(serde_json::json!([]))).unwrap_or_else(|_| "[]".into());
    let track_batches = product.track_batches.unwrap_or(0);
    let reorder_point = product.reorder_point.unwrap_or(0);
    conn.execute(
        "INSERT INTO products (id, name, description, image, category, unit, costPrice, price, stock, variants, trackBatches, supplierId, reorderPoint) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
        rusqlite::params![id, product.name, product.description, product.image, product.category, product.unit, product.cost_price, product.price, product.stock, variants_json, track_batches, product.supplier_id, reorder_point],
    ).map_err(|e| e.to_string())?;
    // If created with batch tracking on + opening stock, seed an opening batch.
    let _ = crate::commands::inventory::ensure_opening_batch(&conn, &id);
    Ok(Product {
        id,
        name: product.name,
        description: product.description,
        image: product.image,
        category: product.category,
        unit: product.unit,
        cost_price: product.cost_price,
        price: product.price,
        stock: product.stock,
        variants: serde_json::from_str(&variants_json).unwrap_or(serde_json::json!([])),
        track_batches: Some(track_batches),
        supplier_id: product.supplier_id,
        reorder_point: Some(reorder_point),
    })
}

#[tauri::command]
pub fn update_product(db: State<'_, AppDb>, id: String, product: ProductInput) -> Result<Product, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let variants_json = serde_json::to_string(&product.variants.unwrap_or(serde_json::json!([]))).unwrap_or_else(|_| "[]".into());
    let track_batches = product.track_batches.unwrap_or(0);
    let reorder_point = product.reorder_point.unwrap_or(0);
    conn.execute(
        "UPDATE products SET name=?1, description=?2, image=?3, category=?4, unit=?5, costPrice=?6, price=?7, stock=?8, variants=?9, trackBatches=?10, supplierId=?11, reorderPoint=?12 WHERE id=?13",
        rusqlite::params![product.name, product.description, product.image, product.category, product.unit, product.cost_price, product.price, product.stock, variants_json, track_batches, product.supplier_id, reorder_point, id],
    ).map_err(|e| e.to_string())?;
    // If batch tracking was just enabled on a product that has stock, seed an opening batch.
    let _ = crate::commands::inventory::ensure_opening_batch(&conn, &id);
    Ok(Product {
        id,
        name: product.name,
        description: product.description,
        image: product.image,
        category: product.category,
        unit: product.unit,
        cost_price: product.cost_price,
        price: product.price,
        stock: product.stock,
        variants: serde_json::from_str(&variants_json).unwrap_or(serde_json::json!([])),
        track_batches: Some(track_batches),
        supplier_id: product.supplier_id,
        reorder_point: Some(reorder_point),
    })
}

#[tauri::command]
pub fn delete_product(db: State<'_, AppDb>, id: String) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM products WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
