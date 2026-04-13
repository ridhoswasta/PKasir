import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';

const app = express();
app.use(express.json({ limit: '50mb' }));

let db: any;

async function initDb() {
  db = new Database('pos.db');

  db.exec(`
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
  `);

  try { db.exec('ALTER TABLE settings ADD COLUMN logoWidth INTEGER'); } catch (e) {}
  try { db.exec('ALTER TABLE settings ADD COLUMN logoHeight INTEGER'); } catch (e) {}
  try { db.exec('ALTER TABLE settings ADD COLUMN productCategories TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE settings ADD COLUMN flowCategories TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE settings ADD COLUMN productUnits TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE settings ADD COLUMN pointMultiplier REAL'); } catch (e) {}

  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (settingsCount.count === 0) {
    db.prepare(`
      INSERT INTO settings (id, taxRate, serviceCharge, printerName, paperWidth, receiptHeader, receiptFooter, logo, productCategories, flowCategories, productUnits, pointMultiplier)
      VALUES ('default', 10, 5, 'POS-80', '80mm', 'CAFE POS\\nJl. Sudirman No. 1\\nJakarta', 'Terima Kasih\\nSelamat Datang Kembali', '', 'Kopi,Non-Kopi,Makanan,Snack', 'Penjualan,Modal,Bahan Baku,Operasional,Gaji', 'Gelas,Piring,Pcs,Porsi', 1000)
    `).run();
  }
}

// API Routes
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.json(products.map((p: any) => ({ ...p, variants: JSON.parse(p.variants || '[]') })));
});

app.post('/api/products', (req, res) => {
  const id = Date.now().toString();
  const { name, description, image, category, unit, costPrice, price, stock, variants } = req.body;
  db.prepare(
    'INSERT INTO products (id, name, description, image, category, unit, costPrice, price, stock, variants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, description, image, category, unit, costPrice, price, stock, JSON.stringify(variants || []));
  res.json({ id, ...req.body });
});

app.put('/api/products/:id', (req, res) => {
  const { name, description, image, category, unit, costPrice, price, stock, variants } = req.body;
  db.prepare(
    'UPDATE products SET name=?, description=?, image=?, category=?, unit=?, costPrice=?, price=?, stock=?, variants=? WHERE id=?'
  ).run(name, description, image, category, unit, costPrice, price, stock, JSON.stringify(variants || []), req.params.id);
  res.json({ id: req.params.id, ...req.body });
});

app.delete('/api/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/transactions', (req, res) => {
  const transactions = db.prepare('SELECT * FROM transactions').all();
  res.json(transactions.map((t: any) => ({ ...t, items: JSON.parse(t.items || '[]') })));
});

app.post('/api/transactions', (req, res) => {
  const id = Date.now().toString();
  const date = new Date().toISOString();
  const { subtotal, tax, serviceCharge, total, paymentMethod, amountPaid, change, customer, items } = req.body;
  
  db.prepare(
    'INSERT INTO transactions (id, date, subtotal, tax, serviceCharge, total, paymentMethod, amountPaid, change, customer, items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, date, subtotal, tax, serviceCharge, total, paymentMethod, amountPaid, change, customer, JSON.stringify(items || []));

  // Update stock
  const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
  for (const item of items) {
    updateStock.run(item.quantity, item.productId);
  }

  // Record income
  db.prepare(
    'INSERT INTO money_flow (id, date, type, category, amount, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(Date.now().toString() + '_flow', date, 'Pemasukan', 'Penjualan', total, `Transaksi #${id}`);

  // Update customer points
  if (customer && customer !== 'Walk-In Customer') {
    const settings = db.prepare("SELECT pointMultiplier FROM settings WHERE id='default'").get();
    const pointMultiplier = settings?.pointMultiplier || 1000;
    const earnedPoints = Math.floor(total / pointMultiplier);
    
    db.prepare('UPDATE customers SET points = points + ? WHERE name = ?').run(earnedPoints, customer);
  }

  res.json({ id, date, ...req.body });
});

app.delete('/api/transactions/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id=?').run(req.params.id);
  db.prepare('DELETE FROM money_flow WHERE description=?').run(`Transaksi #${req.params.id}`);
  res.json({ success: true });
});

app.get('/api/customers', (req, res) => {
  const customers = db.prepare('SELECT * FROM customers').all();
  res.json(customers);
});

app.post('/api/customers', (req, res) => {
  const id = Date.now().toString();
  const { name, phone } = req.body;
  db.prepare('INSERT INTO customers (id, name, phone, points) VALUES (?, ?, ?, ?)').run(id, name, phone, 0);
  res.json({ id, name, phone, points: 0 });
});

app.get('/api/money-flow', (req, res) => {
  const flows = db.prepare('SELECT * FROM money_flow').all();
  res.json(flows);
});

app.post('/api/money-flow', (req, res) => {
  const id = Date.now().toString();
  const date = new Date().toISOString();
  const { type, category, amount, description } = req.body;
  db.prepare(
    'INSERT INTO money_flow (id, date, type, category, amount, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, date, type, category, amount, description);
  res.json({ id, date, ...req.body });
});

app.delete('/api/money-flow/:id', (req, res) => {
  db.prepare('DELETE FROM money_flow WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const settings = db.prepare("SELECT * FROM settings WHERE id='default'").get() as any;
  if (settings) {
    settings.productCategories = settings.productCategories ? settings.productCategories.split(',').filter(Boolean) : [];
    settings.flowCategories = settings.flowCategories ? settings.flowCategories.split(',').filter(Boolean) : [];
    settings.productUnits = settings.productUnits ? settings.productUnits.split(',').filter(Boolean) : [];
    if (settings.receiptHeader) settings.receiptHeader = settings.receiptHeader.replace(/\\n/g, '\n');
    if (settings.receiptFooter) settings.receiptFooter = settings.receiptFooter.replace(/\\n/g, '\n');
  }
  res.json(settings || {});
});

app.put('/api/settings', (req, res) => {
  try {
    const { taxRate, serviceCharge, printerName, paperWidth, receiptHeader, receiptFooter, logo, logoWidth, logoHeight, productCategories, flowCategories, productUnits, pointMultiplier } = req.body;
    db.prepare(
      `UPDATE settings SET 
        taxRate=?, serviceCharge=?, printerName=?, paperWidth=?, receiptHeader=?, receiptFooter=?, logo=?, logoWidth=?, logoHeight=?, 
        productCategories=?, flowCategories=?, productUnits=?, pointMultiplier=? 
      WHERE id='default'`
    ).run(
      taxRate, serviceCharge, printerName, paperWidth, receiptHeader, receiptFooter, logo, logoWidth || 120, logoHeight || 32, 
      (productCategories || []).join(','), (flowCategories || []).join(','), (productUnits || []).join(','), pointMultiplier || 1000
    );
    res.json(req.body);
  } catch (error: any) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  await initDb();
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
