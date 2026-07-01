use crate::db::AppDb;
use crate::models::{Ingredient, IngredientInput, RecipeItem, RecipeItemInput, SaleItem};
use tauri::State;

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

// ── Ingredient CRUD ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_ingredients(db: State<'_, AppDb>) -> Result<Vec<Ingredient>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, unit, cost_per_unit, stock_qty, low_stock_threshold, created_at, updated_at
             FROM ingredients ORDER BY name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Ingredient {
                id: row.get(0)?,
                name: row.get(1)?,
                unit: row.get(2)?,
                cost_per_unit: row.get(3)?,
                stock_qty: row.get::<_, f64>(4).unwrap_or(0.0),
                low_stock_threshold: row.get::<_, f64>(5).unwrap_or(0.0),
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn create_ingredient(db: State<'_, AppDb>, input: IngredientInput) -> Result<Ingredient, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = now_iso();
    let stock_qty = input.stock_qty.unwrap_or(0.0);
    let low_stock_threshold = input.low_stock_threshold.unwrap_or(0.0);
    conn.execute(
        "INSERT INTO ingredients (name, unit, cost_per_unit, stock_qty, low_stock_threshold, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            input.name, input.unit, input.cost_per_unit,
            stock_qty, low_stock_threshold, now, now
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Ingredient {
        id,
        name: input.name,
        unit: input.unit,
        cost_per_unit: input.cost_per_unit,
        stock_qty,
        low_stock_threshold,
        created_at: Some(now.clone()),
        updated_at: Some(now),
    })
}

#[tauri::command]
pub fn update_ingredient(
    db: State<'_, AppDb>,
    id: i64,
    input: IngredientInput,
) -> Result<Ingredient, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = now_iso();
    let stock_qty = input.stock_qty.unwrap_or(0.0);
    let low_stock_threshold = input.low_stock_threshold.unwrap_or(0.0);
    conn.execute(
        "UPDATE ingredients SET name=?1, unit=?2, cost_per_unit=?3, stock_qty=?4, low_stock_threshold=?5, updated_at=?6
         WHERE id=?7",
        rusqlite::params![
            input.name, input.unit, input.cost_per_unit,
            stock_qty, low_stock_threshold, now, id
        ],
    )
    .map_err(|e| e.to_string())?;

    // Re-read created_at from DB so caller gets the full record
    let created_at: Option<String> = conn
        .query_row("SELECT created_at FROM ingredients WHERE id=?1", [id], |r| r.get(0))
        .ok();

    Ok(Ingredient {
        id,
        name: input.name,
        unit: input.unit,
        cost_per_unit: input.cost_per_unit,
        stock_qty,
        low_stock_threshold,
        created_at,
        updated_at: Some(now),
    })
}

#[tauri::command]
pub fn delete_ingredient(db: State<'_, AppDb>, id: i64) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Remove from recipes first to avoid orphaned rows (no FK cascade in schema)
    conn.execute("DELETE FROM recipes WHERE ingredient_id=?1", [id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM ingredients WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(true)
}

// ── Recipe CRUD ───────────────────────────────────────────────────────────────

/// Return all recipe items for a product, joining ingredient details.
#[tauri::command]
pub fn get_recipe(db: State<'_, AppDb>, id: String) -> Result<Vec<RecipeItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT r.id, r.product_id, r.ingredient_id, i.name, i.unit, r.quantity, i.cost_per_unit
             FROM recipes r
             JOIN ingredients i ON i.id = r.ingredient_id
             WHERE r.product_id = ?1
             ORDER BY i.name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&id], |row| {
            let quantity: f64 = row.get(5)?;
            let cost_per_unit: f64 = row.get(6)?;
            Ok(RecipeItem {
                id: row.get(0)?,
                product_id: row.get(1)?,
                ingredient_id: row.get(2)?,
                ingredient_name: row.get(3)?,
                unit: row.get(4)?,
                quantity,
                cost_per_unit,
                subtotal: quantity * cost_per_unit,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

/// Atomically replace the recipe for a product (delete-then-insert in a transaction).
#[tauri::command]
pub fn save_recipe(
    db: State<'_, AppDb>,
    id: String,
    items: Vec<RecipeItemInput>,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM recipes WHERE product_id=?1", [&id])
        .map_err(|e| e.to_string())?;
    for item in &items {
        if item.quantity <= 0.0 {
            continue; // skip zero-quantity entries
        }
        conn.execute(
            "INSERT OR REPLACE INTO recipes (product_id, ingredient_id, quantity) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, item.ingredient_id, item.quantity],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(true)
}

/// Compute total ingredient cost for one unit of product sold.
#[tauri::command]
pub fn get_product_cost(db: State<'_, AppDb>, id: String) -> Result<f64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let cost: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(r.quantity * i.cost_per_unit), 0.0)
             FROM recipes r
             JOIN ingredients i ON i.id = r.ingredient_id
             WHERE r.product_id = ?1",
            [&id],
            |row| row.get(0),
        )
        .unwrap_or(0.0);
    Ok(cost)
}

/// Return ingredient cost per product for ALL products with a recipe, in one
/// call (productId → total ingredient cost). Used by POS and Reports so the
/// effective HPP (costPrice + ingredient cost) can be computed without N
/// round-trips.
#[tauri::command]
pub fn get_all_product_costs(
    db: State<'_, AppDb>,
) -> Result<std::collections::HashMap<String, f64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT r.product_id, COALESCE(SUM(r.quantity * i.cost_per_unit), 0.0)
             FROM recipes r
             JOIN ingredients i ON i.id = r.ingredient_id
             GROUP BY r.product_id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?)))
        .map_err(|e| e.to_string())?;
    let mut map = std::collections::HashMap::new();
    for r in rows {
        let (id, cost) = r.map_err(|e| e.to_string())?;
        map.insert(id, cost);
    }
    Ok(map)
}

// ── Sales deduction ───────────────────────────────────────────────────────────

/// Deduct ingredient stock for all items sold. Negative stock is allowed (warn on frontend).
#[tauri::command]
pub fn deduct_ingredients_for_sale(
    db: State<'_, AppDb>,
    items: Vec<SaleItem>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    for item in &items {
        // Collect recipe rows first, then release the statement borrow before executing UPDATE
        let recipe_entries: Vec<(i64, f64)> = {
            let mut stmt = conn
                .prepare("SELECT ingredient_id, quantity FROM recipes WHERE product_id=?1")
                .map_err(|e| e.to_string())?;
            stmt.query_map([&item.product_id], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, f64>(1)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect()
        }; // stmt dropped here

        for (ingredient_id, qty_per_unit) in recipe_entries {
            let total_deduct = qty_per_unit * (item.quantity as f64);
            conn.execute(
                "UPDATE ingredients SET stock_qty = stock_qty - ?1, updated_at = datetime('now') WHERE id = ?2",
                rusqlite::params![total_deduct, ingredient_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
