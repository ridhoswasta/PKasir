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
