use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppDb(pub Mutex<Connection>, pub PathBuf);

impl AppDb {
    pub fn new(conn: Connection, path: PathBuf) -> Self {
        AppDb(Mutex::new(conn), path)
    }
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS settings (
            id TEXT PRIMARY KEY,
            taxRate REAL,
            serviceCharge REAL,
            printerName TEXT,
            paperWidth TEXT,
            receiptHeader TEXT,
            receiptFooter TEXT,
            logo TEXT,
            logoWidth INTEGER,
            logoHeight INTEGER,
            productCategories TEXT,
            flowCategories TEXT,
            productUnits TEXT,
            pointMultiplier REAL
        );
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            image TEXT,
            category TEXT,
            unit TEXT,
            costPrice REAL,
            price REAL,
            stock INTEGER,
            variants TEXT
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            date TEXT,
            subtotal REAL,
            tax REAL,
            serviceCharge REAL,
            total REAL,
            paymentMethod TEXT,
            amountPaid REAL,
            change REAL,
            customer TEXT,
            items TEXT
        );
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT,
            phone TEXT,
            points REAL
        );
        CREATE TABLE IF NOT EXISTS money_flow (
            id TEXT PRIMARY KEY,
            date TEXT,
            type TEXT,
            category TEXT,
            amount REAL,
            description TEXT
        );
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin','manager','cashier')),
            displayName TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS activity_log (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            user TEXT,
            role TEXT,
            action TEXT NOT NULL,
            target TEXT,
            detail TEXT
        );
        CREATE TABLE IF NOT EXISTS held_orders (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            label TEXT,
            customer TEXT,
            tableName TEXT,
            note TEXT,
            cashier TEXT,
            items TEXT NOT NULL,
            subtotal REAL,
            tax REAL,
            serviceCharge REAL,
            total REAL
        );
        ",
    )?;

    // Migrations - safe to run multiple times (ALTER TABLE errors are silently ignored)
    let migrations = vec![
        "ALTER TABLE settings ADD COLUMN printerType TEXT DEFAULT 'browser'",
        "ALTER TABLE settings ADD COLUMN printerIp TEXT",
        "ALTER TABLE settings ADD COLUMN printerPort INTEGER DEFAULT 9100",
        "ALTER TABLE settings ADD COLUMN printerCharset TEXT DEFAULT 'CP437'",
        "ALTER TABLE settings ADD COLUMN printerOpenDrawer INTEGER DEFAULT 0",
        "ALTER TABLE settings ADD COLUMN tauriPrinterName TEXT",
        "ALTER TABLE settings ADD COLUMN tauriPrinterInterface TEXT DEFAULT 'USB'",
        "ALTER TABLE settings ADD COLUMN tables TEXT",
        "ALTER TABLE settings ADD COLUMN cartSound TEXT DEFAULT 'scanner'",
        "ALTER TABLE settings ADD COLUMN virtualKeyboard INTEGER DEFAULT 0",
        "ALTER TABLE settings ADD COLUMN backupPath TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN autoBackupEnabled INTEGER DEFAULT 0",
        "ALTER TABLE settings ADD COLUMN autoBackupPath TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN lastBackupAt TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN autoBackupIntervalSeconds INTEGER DEFAULT 0",
        "ALTER TABLE settings ADD COLUMN qrisImage TEXT DEFAULT ''",
        "ALTER TABLE transactions ADD COLUMN tableName TEXT",
        "ALTER TABLE transactions ADD COLUMN note TEXT",
        "ALTER TABLE transactions ADD COLUMN cashier TEXT",
        "ALTER TABLE users ADD COLUMN avatar TEXT",
        // Indexes for fast ORDER BY date DESC + LIMIT/OFFSET paging
        "CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC)",
        "CREATE INDEX IF NOT EXISTS idx_money_flow_date ON money_flow(date DESC)",
        "CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(date DESC)",
    ];
    for m in migrations {
        let _ = conn.execute(m, []);
    }

    // Seed default settings
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM settings",
        [],
        |r| r.get(0),
    )?;
    if count == 0 {
        conn.execute(
            "INSERT INTO settings (id, taxRate, serviceCharge, printerName, paperWidth, receiptHeader, receiptFooter, logo, productCategories, flowCategories, productUnits, pointMultiplier)
             VALUES ('default', 10, 5, 'POS-80', '80mm', 'CAFE POS\nJl. Sudirman No. 1\nJakarta', 'Terima Kasih\nSelamat Datang Kembali', '', 'Kopi,Non-Kopi,Makanan,Snack', 'Penjualan,Modal,Bahan Baku,Operasional,Gaji', 'Gelas,Piring,Pcs,Porsi', 1000)",
            [],
        )?;
    }

    // Seed default users
    let user_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users",
        [],
        |r| r.get(0),
    )?;
    if user_count == 0 {
        use sha2::{Sha256, Digest};
        let hash = |pw: &str| -> String {
            let mut h = Sha256::new();
            h.update(pw.as_bytes());
            hex::encode(h.finalize())
        };
        let default_pw = hash("000000");
        conn.execute(
            "INSERT INTO users (id, username, password, role, displayName) VALUES (?1, ?2, ?3, ?4, ?5)",
            ["admin_default", "admin", &default_pw, "admin", "Administrator"],
        )?;
        conn.execute(
            "INSERT INTO users (id, username, password, role, displayName) VALUES (?1, ?2, ?3, ?4, ?5)",
            ["manager_default", "manager", &default_pw, "manager", "Manager"],
        )?;
        conn.execute(
            "INSERT INTO users (id, username, password, role, displayName) VALUES (?1, ?2, ?3, ?4, ?5)",
            ["cashier_default", "kasir", &default_pw, "cashier", "Kasir"],
        )?;
    }

    Ok(())
}
