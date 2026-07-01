use serde::{Deserialize, Serialize};

// ── Products ─────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub cost_price: Option<f64>,
    pub price: Option<f64>,
    pub stock: Option<i64>,
    pub variants: serde_json::Value, // parsed JSON array
    // Inventory add-ons (opt-in, default off — do not affect base stock flow)
    pub track_batches: Option<i64>,
    pub supplier_id: Option<String>,
    pub reorder_point: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub cost_price: Option<f64>,
    pub price: Option<f64>,
    pub stock: Option<i64>,
    pub variants: Option<serde_json::Value>,
    pub track_batches: Option<i64>,
    pub supplier_id: Option<String>,
    pub reorder_point: Option<i64>,
}

// ── Discounts ────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Discount {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub value: f64,
    pub start_date: String,
    pub end_date: String,
    pub product_ids: serde_json::Value,
    pub category_filter: serde_json::Value,
    pub is_active: i64,
    pub priority: i64,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscountInput {
    pub name: String,
    pub r#type: String,
    pub value: f64,
    pub start_date: String,
    pub end_date: String,
    pub product_ids: Option<serde_json::Value>,
    pub category_filter: Option<serde_json::Value>,
    pub is_active: Option<i64>,
    pub priority: Option<i64>,
    pub description: Option<String>,
}

// ── Transactions ─────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub date: Option<String>,
    pub subtotal: Option<f64>,
    pub tax: Option<f64>,
    pub service_charge: Option<f64>,
    pub total: Option<f64>,
    pub payment_method: Option<String>,
    pub amount_paid: Option<f64>,
    pub change: Option<f64>,
    pub customer: Option<String>,
    pub items: serde_json::Value,
    pub table_name: Option<String>,
    pub note: Option<String>,
    pub cashier: Option<String>,
    pub discount: Option<f64>,
    pub discount_id: Option<String>,
    pub discount_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTransactionInput {
    pub subtotal: f64,
    pub tax: f64,
    pub service_charge: f64,
    pub total: f64,
    pub payment_method: String,
    pub amount_paid: f64,
    pub change: f64,
    pub customer: Option<String>,
    pub items: serde_json::Value,
    pub table_name: Option<String>,
    pub note: Option<String>,
    pub cashier: Option<String>,
    pub discount: Option<f64>,
    pub discount_id: Option<String>,
    pub discount_name: Option<String>,
}

// ── Held Orders (Bayar Nanti) ────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HeldOrder {
    pub id: String,
    pub date: Option<String>,
    pub label: Option<String>,
    pub customer: Option<String>,
    pub table_name: Option<String>,
    pub note: Option<String>,
    pub cashier: Option<String>,
    pub items: serde_json::Value,
    pub subtotal: Option<f64>,
    pub tax: Option<f64>,
    pub service_charge: Option<f64>,
    pub total: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHeldOrderInput {
    pub label: Option<String>,
    pub customer: Option<String>,
    pub table_name: Option<String>,
    pub note: Option<String>,
    pub cashier: Option<String>,
    pub items: serde_json::Value,
    pub subtotal: f64,
    pub tax: f64,
    pub service_charge: f64,
    pub total: f64,
}

// ── Customers ────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub id: String,
    pub name: Option<String>,
    pub phone: Option<String>,
    pub points: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerInput {
    pub name: String,
    pub phone: Option<String>,
    pub points: Option<f64>,
}

// ── Settings ─────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub tax_rate: Option<f64>,
    pub service_charge: Option<f64>,
    pub printer_name: Option<String>,
    pub paper_width: Option<String>,
    pub receipt_header: Option<String>,
    pub receipt_footer: Option<String>,
    pub logo: Option<String>,
    pub logo_width: Option<i64>,
    pub logo_height: Option<i64>,
    pub product_categories: Vec<String>,
    pub flow_categories: Vec<String>,
    pub product_units: Vec<String>,
    pub point_multiplier: Option<f64>,
    pub printer_type: Option<String>,
    pub printer_ip: Option<String>,
    pub printer_port: Option<i64>,
    pub printer_charset: Option<String>,
    pub printer_open_drawer: Option<i64>,
    pub tauri_printer_name: Option<String>,
    pub tauri_printer_interface: Option<String>,
    pub tables: Vec<String>,
    pub cart_sound: Option<String>,
    pub virtual_keyboard: Option<i64>,
    pub backup_path: Option<String>,
    pub auto_backup_enabled: Option<i64>,
    pub auto_backup_path: Option<String>,
    pub last_backup_at: Option<String>,
    pub auto_backup_interval_seconds: Option<i64>,
    pub qris_image: Option<String>,
    pub display_photos: Vec<String>,
    pub display_slideshow_interval: Option<i64>,
    // Loyalty
    pub loyalty_enabled: Option<i64>,
    pub redeem_rate: Option<f64>,
    pub min_redeem_points: Option<f64>,
    // SMTP email alerts
    pub email_alert_enabled: Option<i64>,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<i64>,
    pub smtp_use_tls: Option<i64>,
    pub smtp_from: Option<String>,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    pub email_recipient: Option<String>,
    pub low_stock_threshold: Option<i64>,
    // Canonical shop identity
    pub shop_name: Option<String>,
    pub shop_address: Option<String>,
    // Dynamic QRIS
    pub qris_enabled: Option<i64>,
    pub qris_static: Option<String>,
    pub qris_merchant_name: Option<String>,
    // QRIS v2 image-upload flow
    pub qris_merchant_city: Option<String>,
    pub qris_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInput {
    pub tax_rate: Option<f64>,
    pub service_charge: Option<f64>,
    pub printer_name: Option<String>,
    pub paper_width: Option<String>,
    pub receipt_header: Option<String>,
    pub receipt_footer: Option<String>,
    pub logo: Option<String>,
    pub logo_width: Option<i64>,
    pub logo_height: Option<i64>,
    pub product_categories: Option<Vec<String>>,
    pub flow_categories: Option<Vec<String>>,
    pub product_units: Option<Vec<String>>,
    pub point_multiplier: Option<f64>,
    pub printer_type: Option<String>,
    pub printer_ip: Option<String>,
    pub printer_port: Option<i64>,
    pub printer_charset: Option<String>,
    pub printer_open_drawer: Option<i64>,
    pub tauri_printer_name: Option<String>,
    pub tauri_printer_interface: Option<String>,
    pub tables: Option<Vec<String>>,
    pub cart_sound: Option<String>,
    pub virtual_keyboard: Option<i64>,
    pub backup_path: Option<String>,
    pub auto_backup_enabled: Option<i64>,
    pub auto_backup_path: Option<String>,
    pub auto_backup_interval_seconds: Option<i64>,
    pub qris_image: Option<String>,
    pub display_photos: Option<Vec<String>>,
    pub display_slideshow_interval: Option<i64>,
    // Loyalty
    pub loyalty_enabled: Option<i64>,
    pub redeem_rate: Option<f64>,
    pub min_redeem_points: Option<f64>,
    // SMTP email alerts
    pub email_alert_enabled: Option<i64>,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<i64>,
    pub smtp_use_tls: Option<i64>,
    pub smtp_from: Option<String>,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    pub email_recipient: Option<String>,
    pub low_stock_threshold: Option<i64>,
    pub shop_name: Option<String>,
    pub shop_address: Option<String>,
    // Dynamic QRIS
    pub qris_enabled: Option<i64>,
    pub qris_static: Option<String>,
    pub qris_merchant_name: Option<String>,
    // QRIS v2 image-upload flow
    pub qris_merchant_city: Option<String>,
    pub qris_mode: Option<String>,
}

// ── Users ────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserPublic {
    pub id: String,
    pub username: String,
    pub role: String,
    pub display_name: String,
    pub avatar: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserInput {
    pub username: String,
    pub password: String,
    pub role: String,
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserInput {
    pub username: Option<String>,
    pub password: Option<String>,
    pub role: Option<String>,
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub current_password: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
    pub user: UserPublic,
}

// ── Money Flow ───────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MoneyFlow {
    pub id: String,
    pub date: Option<String>,
    pub r#type: Option<String>,
    pub category: Option<String>,
    pub amount: Option<f64>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMoneyFlowInput {
    pub r#type: String,
    pub category: String,
    pub amount: f64,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionsPage {
    pub items: Vec<Transaction>,
    pub total: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoneyFlowPage {
    pub items: Vec<MoneyFlow>,
    pub total: i64,
    pub total_income: f64,
    pub total_expense: f64,
}

// ── Activity Log ────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActivityLog {
    pub id: String,
    pub date: String,
    pub user: Option<String>,
    pub role: Option<String>,
    pub action: String,
    pub target: Option<String>,
    pub detail: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateActivityLogInput {
    pub user: Option<String>,
    pub role: Option<String>,
    pub action: String,
    pub target: Option<String>,
    pub detail: Option<String>,
}

// ── Printer ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintReceiptInput {
    pub tx_id: String,
    pub tx_date: Option<String>,
    pub items: Vec<PrintItem>,
    pub subtotal: f64,
    pub tax: f64,
    pub service_charge: f64,
    pub total: f64,
    pub payment_method: String,
    pub amount_paid: Option<f64>,
    pub change: Option<f64>,
    pub customer: Option<String>,
    pub table_name: Option<String>,
    pub note: Option<String>,
    pub cashier: Option<String>,
    pub discount: Option<f64>,
    pub discount_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintItem {
    pub name: String,
    pub qty: i64,
    pub price: f64,
    pub variant_name: Option<String>,
    pub note: Option<String>,
}

// ── Suppliers ────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Supplier {
    pub id: String,
    pub name: Option<String>,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub note: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierInput {
    pub name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub note: Option<String>,
}

// ── Product Batches (expiry / lot tracking) ──────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProductBatch {
    pub id: String,
    pub product_id: String,
    pub product_name: Option<String>,
    pub batch_no: Option<String>,
    pub expiry_date: Option<String>,
    pub qty: i64,
    pub initial_qty: i64,
    pub cost_price: Option<f64>,
    pub supplier_id: Option<String>,
    pub received_date: Option<String>,
    pub note: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductBatchInput {
    pub product_id: String,
    pub batch_no: Option<String>,
    pub expiry_date: Option<String>,
    pub qty: i64,
    pub cost_price: Option<f64>,
    pub supplier_id: Option<String>,
    pub received_date: Option<String>,
    pub note: Option<String>,
}

// ── Stock Movements (ledger) ─────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StockMovement {
    pub id: String,
    pub product_id: String,
    pub product_name: Option<String>,
    pub batch_id: Option<String>,
    pub r#type: String,
    pub quantity: i64,
    pub balance_after: Option<i64>,
    pub reference: Option<String>,
    pub note: Option<String>,
    pub user: Option<String>,
    pub date: String,
}

// ── Purchase Orders ──────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseOrder {
    pub id: String,
    pub supplier_id: Option<String>,
    pub supplier_name: Option<String>,
    pub status: String,
    pub order_date: Option<String>,
    pub expected_date: Option<String>,
    pub received_date: Option<String>,
    pub note: Option<String>,
    pub total: Option<f64>,
    pub items: serde_json::Value,
    pub created_at: Option<String>,
}

// ── Recipe Costing ───────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Ingredient {
    pub id: i64,
    pub name: String,
    pub unit: String,
    pub cost_per_unit: f64,
    pub stock_qty: f64,
    pub low_stock_threshold: f64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngredientInput {
    pub name: String,
    pub unit: String,
    pub cost_per_unit: f64,
    pub stock_qty: Option<f64>,
    pub low_stock_threshold: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecipeItem {
    pub id: i64,
    pub product_id: String,
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub unit: String,
    pub quantity: f64,
    pub cost_per_unit: f64,
    pub subtotal: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeItemInput {
    pub ingredient_id: i64,
    pub quantity: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleItem {
    pub product_id: String,
    pub quantity: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseOrderInput {
    pub supplier_id: Option<String>,
    pub supplier_name: Option<String>,
    pub status: Option<String>,
    pub order_date: Option<String>,
    pub expected_date: Option<String>,
    pub note: Option<String>,
    pub items: serde_json::Value,
}
