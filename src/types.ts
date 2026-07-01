/**
 * Issue #24: core domain TypeScript interfaces.
 * Use these instead of `any` for the most-used objects across the app.
 * Gradually replace `useState<any[]>` and `product: any` usages with these types.
 */

export interface ProductVariant {
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  unit: string;
  description?: string;
  image?: string;
  variants?: ProductVariant[];
  // Inventory add-ons (opt-in per product; default off — base stock flow unchanged)
  trackBatches?: number; // 0 | 1
  supplierId?: string;
  reorderPoint?: number;
}

// ── Inventory add-ons ────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  createdAt?: string;
}

export interface ProductBatch {
  id: string;
  productId: string;
  productName?: string;
  batchNo?: string;
  expiryDate?: string; // YYYY-MM-DD
  qty: number;
  initialQty: number;
  costPrice?: number;
  supplierId?: string;
  receivedDate?: string;
  note?: string;
  createdAt?: string;
}

export type StockMovementType =
  | 'sale' | 'purchase' | 'adjustment' | 'return' | 'expiry' | 'initial' | 'transfer';

export interface StockMovement {
  id: string;
  productId: string;
  productName?: string;
  batchId?: string;
  type: StockMovementType | string;
  quantity: number; // signed: +in / -out
  balanceAfter?: number;
  reference?: string;
  note?: string;
  user?: string;
  date: string;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  qty: number;
  costPrice: number;
  qtyReceived?: number;
  batchNo?: string;
  expiryDate?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId?: string;
  supplierName?: string;
  status: PurchaseOrderStatus | string;
  orderDate?: string;
  expectedDate?: string;
  receivedDate?: string;
  note?: string;
  total?: number;
  items: PurchaseOrderItem[];
  createdAt?: string;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  costPrice: number;
  quantity: number;
  variantName?: string;
  image?: string;
  note?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  points: number;
}

export interface TransactionItem {
  name: string;
  quantity: number;
  price: number;
  variantName?: string;
  note?: string;
}

export interface Transaction {
  id: string;
  date: string;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  discount?: number;
  discountId?: string;
  discountName?: string;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  customer: string;
  tableName?: string;
  note?: string;
  cashier?: string;
}

export interface HeldOrder {
  id: string;
  label?: string;
  date?: string;
  customer?: string;
  tableName?: string;
  cashier?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
}

export interface Discount {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  description?: string;
}

export interface AppSettings {
  shopName?: string;
  shopAddress?: string;
  taxRate: number;
  serviceCharge: number;
  paperWidth: string;
  receiptHeader: string;
  receiptFooter: string;
  logo?: string;
  logoWidth?: number;
  logoHeight?: number;
  productCategories: string[];
  productUnits: string[];
  tables: string[];
  printerType: 'browser' | 'network' | 'tauri';
  printerIp?: string;
  printerPort?: number;
  printerCharset?: string;
  printerOpenDrawer?: number;
  tauriPrinterName?: string;
  tauriPrinterInterface?: string;
  cartSound?: string;
  virtualKeyboard?: number;
  qrisImage?: string;
  displayPhotos?: string[];
  displaySlideshowInterval?: number;
  pointMultiplier?: number;
  // Dynamic QRIS
  qrisEnabled?: number; // 0 | 1
  qrisStatic?: string;
  qrisMerchantName?: string;
}
