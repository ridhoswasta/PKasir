#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use pos_system::commands;
use pos_system::db::{init_db, AppDb};
use rusqlite::Connection;
use std::fs;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_thermal_printer::init())
        .setup(|app| {
            // Use app data dir for the database so it works in production installs
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
            let db_path = app_dir.join("pos.db");

            let conn = Connection::open(&db_path)
                .expect("Failed to open SQLite database");
            conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
                .expect("Failed to set PRAGMA");
            init_db(&conn).expect("Failed to initialize database");

            app.manage(AppDb::new(conn, db_path));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Products
            commands::products::get_products,
            commands::products::create_product,
            commands::products::update_product,
            commands::products::delete_product,
            // Transactions
            commands::transactions::get_transactions,
            commands::transactions::get_transactions_page,
            commands::transactions::create_transaction,
            commands::transactions::delete_transaction,
            // Customers
            commands::customers::get_customers,
            commands::customers::create_customer,
            commands::customers::update_customer,
            commands::customers::delete_customer,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            // Users
            commands::users::get_users,
            commands::users::create_user,
            commands::users::update_user,
            commands::users::delete_user,
            // Auth
            commands::auth::login,
            // Money Flow
            commands::money_flow::get_money_flow,
            commands::money_flow::get_money_flow_page,
            commands::money_flow::create_money_flow,
            commands::money_flow::delete_money_flow,
            // Network Printer
            commands::printer::print_test,
            commands::printer::print_receipt,
            // Activity Log
            commands::activity_log::get_activity_logs,
            commands::activity_log::log_activity,
            commands::activity_log::clear_activity_logs,
            // Backup & Restore
            commands::backup::get_backup_info,
            commands::backup::backup_database,
            commands::backup::restore_database,
            commands::backup::pick_backup_save_path,
            commands::backup::pick_backup_open_path,
            commands::backup::pick_directory,
            commands::backup::auto_backup_if_due,
            commands::backup::auto_backup_tick,
            // Held Orders (Bayar Nanti)
            commands::held_orders::get_held_orders,
            commands::held_orders::create_held_order,
            commands::held_orders::delete_held_order,
            // CSV Export
            commands::export::export_csv,
            // Discounts
            commands::discounts::get_discounts,
            commands::discounts::get_active_discounts,
            commands::discounts::create_discount,
            commands::discounts::update_discount,
            commands::discounts::delete_discount,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
