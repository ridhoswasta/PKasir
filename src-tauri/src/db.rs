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
    // Performance pragmas. WAL lets reads proceed during writes and makes
    // commits much cheaper; NORMAL sync is safe with WAL (durable except on
    // power loss, never corrupting). busy_timeout avoids spurious lock errors.
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA cache_size = -8000;
        PRAGMA temp_store = MEMORY;
        ",
    )?;
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
        CREATE TABLE IF NOT EXISTS discounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('percentage','fixed')),
            value REAL NOT NULL,
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            productIds TEXT,
            categoryFilter TEXT,
            isActive INTEGER NOT NULL DEFAULT 1,
            priority INTEGER NOT NULL DEFAULT 0,
            description TEXT
        );
        -- ── Inventory add-ons (all optional / opt-in; do not affect base stock flow) ──
        CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            contactPerson TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            note TEXT,
            createdAt TEXT
        );
        CREATE TABLE IF NOT EXISTS product_batches (
            id TEXT PRIMARY KEY,
            productId TEXT NOT NULL,
            batchNo TEXT,
            expiryDate TEXT,
            qty INTEGER NOT NULL DEFAULT 0,
            initialQty INTEGER NOT NULL DEFAULT 0,
            costPrice REAL,
            supplierId TEXT,
            receivedDate TEXT,
            note TEXT,
            createdAt TEXT
        );
        CREATE TABLE IF NOT EXISTS stock_movements (
            id TEXT PRIMARY KEY,
            productId TEXT NOT NULL,
            productName TEXT,
            batchId TEXT,
            type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            balanceAfter INTEGER,
            reference TEXT,
            note TEXT,
            user TEXT,
            date TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id TEXT PRIMARY KEY,
            supplierId TEXT,
            supplierName TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            orderDate TEXT,
            expectedDate TEXT,
            receivedDate TEXT,
            note TEXT,
            total REAL DEFAULT 0,
            items TEXT NOT NULL DEFAULT '[]',
            createdAt TEXT
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
        "ALTER TABLE settings ADD COLUMN displayPhotos TEXT DEFAULT '[]'",
        "ALTER TABLE settings ADD COLUMN displaySlideshowInterval INTEGER DEFAULT 5",
        "ALTER TABLE transactions ADD COLUMN tableName TEXT",
        "ALTER TABLE transactions ADD COLUMN note TEXT",
        "ALTER TABLE transactions ADD COLUMN cashier TEXT",
        "ALTER TABLE users ADD COLUMN avatar TEXT",
        // Indexes for fast ORDER BY date DESC + LIMIT/OFFSET paging
        "CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC)",
        "CREATE INDEX IF NOT EXISTS idx_money_flow_date ON money_flow(date DESC)",
        "CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(date DESC)",
        // Discount support on transactions
        "ALTER TABLE transactions ADD COLUMN discount REAL DEFAULT 0",
        "ALTER TABLE transactions ADD COLUMN discountId TEXT",
        "ALTER TABLE transactions ADD COLUMN discountName TEXT",
        // Loyalty settings
        "ALTER TABLE settings ADD COLUMN loyaltyEnabled INTEGER DEFAULT 0",
        "ALTER TABLE settings ADD COLUMN redeemRate REAL DEFAULT 100",
        "ALTER TABLE settings ADD COLUMN minRedeemPoints REAL DEFAULT 100",
        // SMTP / email alert settings
        "ALTER TABLE settings ADD COLUMN emailAlertEnabled INTEGER DEFAULT 0",
        "ALTER TABLE settings ADD COLUMN smtpHost TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN smtpPort INTEGER DEFAULT 587",
        "ALTER TABLE settings ADD COLUMN smtpUseTls INTEGER DEFAULT 1",
        "ALTER TABLE settings ADD COLUMN smtpFrom TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN smtpUsername TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN smtpPassword TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN emailRecipient TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN lowStockThreshold INTEGER DEFAULT 5",
        // Canonical shop identity (used by PO PDF, reports, etc.)
        "ALTER TABLE settings ADD COLUMN shopName TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN shopAddress TEXT DEFAULT ''",
        // Loyalty usage on transactions
        "ALTER TABLE transactions ADD COLUMN pointsRedeemed REAL DEFAULT 0",
        "ALTER TABLE transactions ADD COLUMN pointsEarned REAL DEFAULT 0",
        "ALTER TABLE transactions ADD COLUMN redemptionDiscount REAL DEFAULT 0",
        // Inventory add-ons: per-product opt-in batch/expiry tracking + supplier link
        "ALTER TABLE products ADD COLUMN trackBatches INTEGER DEFAULT 0",
        "ALTER TABLE products ADD COLUMN supplierId TEXT",
        "ALTER TABLE products ADD COLUMN reorderPoint INTEGER DEFAULT 0",
        // Indexes for the new inventory tables
        "CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(productId)",
        "CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON product_batches(expiryDate)",
        "CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(productId)",
        "CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(date DESC)",
        "CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(orderDate DESC)",
        // ── Recipe Costing ────────────────────────────────────────────────────
        // ingredients: master list of raw materials with unit cost & stock
        "CREATE TABLE IF NOT EXISTS ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            unit TEXT NOT NULL,
            cost_per_unit REAL NOT NULL,
            stock_qty REAL DEFAULT 0,
            low_stock_threshold REAL DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        )",
        // recipes: links products to ingredients with required quantity per unit sold
        "CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT NOT NULL,
            ingredient_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            UNIQUE(product_id, ingredient_id)
        )",
        "CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id)",
        "CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name)",
        // ── Dynamic QRIS ──────────────────────────────────────────────────────
        "ALTER TABLE settings ADD COLUMN qrisEnabled INTEGER DEFAULT 0",
        "ALTER TABLE settings ADD COLUMN qrisStatic TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN qrisMerchantName TEXT DEFAULT ''",
        // ── QRIS image-upload flow (v2) ───────────────────────────────────────
        // qrisMerchantCity: extracted from tag 60 of the decoded QRIS string
        // qrisMode: 'static' (show uploaded image as-is) | 'dynamic' (generate QR with amount)
        "ALTER TABLE settings ADD COLUMN qrisMerchantCity TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN qrisMode TEXT DEFAULT 'static'",
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
             VALUES ('default', 10, 5, 'POS-58', '58mm', 'PKasir \nJl. Sudirman \nPekanbaru', 'Terima Kasih\nSelamat Datang Kembali', '', 'Kopi,Non-Kopi,Makanan,Snack', 'Penjualan,Modal,Bahan Baku,Operasional,Gaji', 'Pcs,Kg,Gr,Ltr,Btl', 1000)",
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
