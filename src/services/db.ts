import Database from '@tauri-apps/plugin-sql';

let dbInstance: Database | null = null;

export const isTauri = () => {
  return (window as any).__TAURI_INTERNALS__ !== undefined;
};

export const getDb = async () => {
  if (!isTauri()) return null;
  if (!dbInstance) {
    try {
      dbInstance = await Database.load('sqlite:pos.db');
      await initDb(dbInstance);
    } catch (e) {
      console.error("Failed to load SQLite DB", e);
    }
  }
  return dbInstance;
};

const initDb = async (db: Database) => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      price REAL,
      costPrice REAL,
      stock INTEGER,
      description TEXT,
      image TEXT,
      unit TEXT
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT,
      subtotal REAL,
      tax REAL,
      serviceCharge REAL,
      total REAL,
      paymentMethod TEXT,
      amountPaid REAL,
      change REAL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transactionId TEXT,
      productId TEXT,
      name TEXT,
      price REAL,
      quantity INTEGER,
      variantName TEXT,
      FOREIGN KEY(transactionId) REFERENCES transactions(id)
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS money_flow (
      id TEXT PRIMARY KEY,
      date TEXT,
      type TEXT,
      category TEXT,
      amount REAL,
      description TEXT
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      taxRate REAL,
      serviceCharge REAL,
      printerName TEXT,
      paperWidth TEXT,
      receiptHeader TEXT,
      receiptFooter TEXT,
      logo TEXT,
      productCategories TEXT,
      flowCategories TEXT,
      productUnits TEXT
    );
  `);
  
  // Insert default settings if empty
  const settingsCount = await db.select<{count: number}[]>('SELECT COUNT(*) as count FROM settings');
  if (settingsCount[0].count === 0) {
    await db.execute(`
      INSERT INTO settings (id, taxRate, serviceCharge, paperWidth, receiptHeader, receiptFooter, logo, productCategories, flowCategories, productUnits)
      VALUES ('default', 10, 5, '80mm', 'CAFE POS', 'Terima Kasih', '', 'Kopi,Non-Kopi,Makanan,Snack', 'Penjualan,Modal,Operasional,Gaji', 'Gelas,Piring,Pcs')
    `);
  }
};

// Helper for API fallback
export const apiCall = async (endpoint: string, options?: RequestInit) => {
  const res = await fetch(`/api${endpoint}`, options);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};
