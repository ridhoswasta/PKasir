import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Eye, Pencil, Trash2, ClipboardList, PackageCheck, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { logActivity } from '../services/activity';
import { useAuth } from '../services/auth';
import type { Supplier, Product, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../types';

const NO_SUPPLIER = '__none__';

const rp = (n: number) => `Rp ${(Number.isFinite(n) ? n : 0).toLocaleString('id-ID')}`;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtDate = (d?: string) => {
  if (!d) return '-';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '-' : format(dt, 'dd MMM yyyy');
};

const STATUS_META: Record<PurchaseOrderStatus, { label: string; className: string }> = {
  draft: { label: 'Draf', className: 'bg-muted text-muted-foreground' },
  ordered: { label: 'Dipesan', className: 'bg-info/12 text-info' },
  received: { label: 'Diterima', className: 'bg-success/12 text-success' },
  cancelled: { label: 'Dibatalkan', className: 'bg-destructive/12 text-destructive' },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as PurchaseOrderStatus] ?? STATUS_META.draft;
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

type FormItem = PurchaseOrderItem;

interface PoForm {
  supplierId: string;
  supplierName: string;
  expectedDate: string;
  note: string;
  items: FormItem[];
}

const blankItem = (): FormItem => ({ productId: '', productName: '', qty: 1, costPrice: 0 });

const blankForm = (): PoForm => ({
  supplierId: '',
  supplierName: '',
  expectedDate: '',
  note: '',
  items: [blankItem()],
});

const itemsTotal = (items: { qty: number; costPrice: number }[]) =>
  items.reduce((sum, it) => sum + num(it.qty) * num(it.costPrice), 0);

export function PurchaseOrdersModule() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [generatePdf, setGeneratePdf] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PoForm>(blankForm());

  const [activeOrder, setActiveOrder] = useState<PurchaseOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<FormItem[]>([]);
  const [recordExpense, setRecordExpense] = useState(true);
  const [receiving, setReceiving] = useState(false);

  const fetchOrders = () => {
    invoke<PurchaseOrder[]>('get_purchase_orders').then(setOrders).catch(() => {});
  };

  useEffect(() => {
    fetchOrders();
    invoke<Supplier[]>('get_suppliers').then(setSuppliers).catch(() => {});
    invoke<Product[]>('get_products').then(setProducts).catch(() => {});
    invoke('get_settings').then(setSettings).catch(() => {});
  }, []);

  const productById = (id: string) => products.find((p) => p.id === id);

  // Generate a supplier-facing PO PDF (native save dialog in Tauri).
  const generatePoPdf = async (po: PurchaseOrder) => {
    try {
      const { exportPurchaseOrderPDF } = await import('../services/poPdf');
      const storeName = (settings.shopName || settings.receiptHeader || 'PKasir').split('\n')[0].trim();
      const storeAddress = settings.shopAddress || '';
      const supplier = suppliers.find((s) => s.id === po.supplierId);
      const res = await exportPurchaseOrderPDF({ storeName, storeAddress, logo: settings.logo, po, supplier });
      if (!res.saved) toast.info('Ekspor PDF dibatalkan');
      else if (res.path) toast.success(`PDF PO disimpan ke ${res.path}`);
      else toast.success('PDF PO berhasil dibuat');
    } catch (e: any) {
      toast.error('Gagal membuat PDF PO: ' + (e?.message || e));
    }
  };

  // ── Create / Edit ──────────────────────────────────────
  const openCreate = () => {
    setEditId(null);
    setForm(blankForm());
    setGeneratePdf(false);
    setIsFormOpen(true);
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditId(po.id);
    setForm({
      supplierId: po.supplierId || '',
      supplierName: po.supplierName || '',
      expectedDate: po.expectedDate ? po.expectedDate.slice(0, 10) : '',
      note: po.note || '',
      items:
        po.items && po.items.length
          ? po.items.map((it) => ({
              productId: it.productId,
              productName: it.productName,
              qty: num(it.qty),
              costPrice: num(it.costPrice),
            }))
          : [blankItem()],
    });
    setIsFormOpen(true);
  };

  const setSupplier = (val: string | null) => {
    if (!val || val === NO_SUPPLIER) {
      setForm((f) => ({ ...f, supplierId: '', supplierName: '' }));
      return;
    }
    const s = suppliers.find((x) => x.id === val);
    setForm((f) => ({ ...f, supplierId: val, supplierName: s?.name || '' }));
  };

  const setItemProduct = (idx: number, productId: string) => {
    const p = productById(productId);
    setForm((f) => {
      const items = [...f.items];
      items[idx] = {
        ...items[idx],
        productId,
        productName: p?.name || '',
        costPrice: p ? num(p.costPrice) : num(items[idx].costPrice),
      };
      return { ...f, items };
    });
  };

  const setItemField = (idx: number, patch: Partial<FormItem>) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], ...patch };
      return { ...f, items };
    });
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, blankItem()] }));

  const removeItem = (idx: number) =>
    setForm((f) => {
      const items = f.items.filter((_, i) => i !== idx);
      return { ...f, items: items.length ? items : [blankItem()] };
    });

  const handleSave = async () => {
    const validItems = form.items
      .filter((it) => it.productId && num(it.qty) > 0)
      .map((it) => ({
        productId: it.productId,
        productName: it.productName,
        qty: num(it.qty),
        costPrice: num(it.costPrice),
      }));

    if (validItems.length === 0) {
      toast.error('Tambahkan minimal satu item dengan produk dan jumlah > 0');
      return;
    }

    const payload = {
      supplierId: form.supplierId || undefined,
      supplierName: form.supplierName || undefined,
      status: 'ordered' as PurchaseOrderStatus,
      expectedDate: form.expectedDate || undefined,
      note: form.note.trim() || undefined,
      items: validItems,
    };

    try {
      let createdPo: PurchaseOrder | null = null;
      if (editId) {
        await invoke('update_purchase_order', { id: editId, order: payload });
        logActivity('Edit Pembelian', form.supplierName || editId, `${validItems.length} item`);
        toast.success('PO berhasil diperbarui');
      } else {
        createdPo = await invoke<PurchaseOrder>('create_purchase_order', { order: payload });
        logActivity('Buat Pembelian', form.supplierName || '-', `${validItems.length} item`);
        toast.success('PO berhasil dibuat');
      }
      setIsFormOpen(false);
      fetchOrders();
      // Auto-generate the supplier PDF if requested on a new PO.
      if (createdPo && generatePdf) await generatePoPdf(createdPo);
    } catch (e: any) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Gagal menyimpan PO');
    }
  };

  // ── Receive ────────────────────────────────────────────
  const openReceive = (po: PurchaseOrder) => {
    setActiveOrder(po);
    setRecordExpense(true);
    setReceiveItems(
      (po.items || []).map((it) => ({
        productId: it.productId,
        productName: it.productName,
        qty: num(it.qty),
        costPrice: num(it.costPrice),
        qtyReceived: it.qtyReceived != null ? num(it.qtyReceived) : num(it.qty),
        batchNo: it.batchNo || '',
        expiryDate: it.expiryDate ? it.expiryDate.slice(0, 10) : '',
      })),
    );
    setIsReceiveOpen(true);
  };

  const setReceiveField = (idx: number, patch: Partial<FormItem>) => {
    setReceiveItems((items) => {
      const next = [...items];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const isReceived = activeOrder?.status === 'received';

  const handleReceive = async () => {
    if (!activeOrder) return;
    const lines = receiveItems.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      qty: num(it.qty),
      costPrice: num(it.costPrice),
      qtyReceived: num(it.qtyReceived),
      batchNo: it.batchNo?.trim() || undefined,
      expiryDate: it.expiryDate || undefined,
    }));

    setReceiving(true);
    try {
      await invoke<{ success: boolean; total: number }>('receive_purchase_order', {
        id: activeOrder.id,
        items: lines,
        recordExpense,
        user: user?.displayName,
      });
      logActivity('Terima Pembelian', activeOrder.supplierName || activeOrder.id, `${lines.length} item`);
      toast.success('Stok diterima');
      setIsReceiveOpen(false);
      setActiveOrder(null);
      fetchOrders();
    } catch (e: any) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Gagal menerima stok');
    } finally {
      setReceiving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────
  const openDelete = (po: PurchaseOrder) => {
    setActiveOrder(po);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!activeOrder) return;
    try {
      await invoke('delete_purchase_order', { id: activeOrder.id });
      logActivity('Hapus Pembelian', activeOrder.supplierName || activeOrder.id);
      toast.success('PO dihapus');
      setIsDeleteOpen(false);
      setActiveOrder(null);
      fetchOrders();
    } catch (e: any) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Gagal menghapus PO');
    }
  };

  const formTotal = itemsTotal(form.items);
  const receiveTotal = receiveItems.reduce(
    (sum, it) => sum + num(it.qtyReceived) * num(it.costPrice),
    0,
  );

  return (
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto h-full">
      <PageHeader
        title="Pembelian"
        description="Purchase order & penerimaan stok dari pemasok"
        icon={ClipboardList}
        actions={
          <Button className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Buat PO
          </Button>
        }
      />

      <Card className="rounded-2xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pemasok</TableHead>
                <TableHead>Jumlah Item</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={ClipboardList}
                      title="Belum ada purchase order"
                      description="Buat PO pertama untuk memesan dan menerima stok dari pemasok."
                      action={
                        <Button className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={openCreate}>
                          <Plus className="w-4 h-4 mr-2" />
                          Buat PO
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((po) => {
                  const received = po.status === 'received';
                  return (
                    <TableRow key={po.id}>
                      <TableCell>{fmtDate(po.orderDate)}</TableCell>
                      <TableCell className="font-medium">
                        {po.supplierName || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>{po.items?.length ?? 0}</TableCell>
                      <TableCell>{rp(num(po.total ?? itemsTotal(po.items || [])))}</TableCell>
                      <TableCell>
                        <StatusBadge status={po.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => generatePoPdf(po)}
                            aria-label={`Unduh PDF PO ${po.supplierName || po.id}`}
                            title="Unduh PDF (kirim ke pemasok)"
                          >
                            <FileText className="w-4 h-4 text-info" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openReceive(po)}
                            aria-label={received ? `Lihat PO ${po.supplierName || po.id}` : `Terima PO ${po.supplierName || po.id}`}
                          >
                            {received ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <PackageCheck className="w-4 h-4 text-success" />
                            )}
                          </Button>
                          {!received && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(po)}
                              aria-label={`Edit PO ${po.supplierName || po.id}`}
                            >
                              <Pencil className="w-4 h-4 text-info" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDelete(po)}
                            aria-label={`Hapus PO ${po.supplierName || po.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit PO Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Purchase Order' : 'Buat Purchase Order'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1 -mx-6 px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pemasok</Label>
                <Select value={form.supplierId || NO_SUPPLIER} onValueChange={setSupplier}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih Pemasok">
                      {(value: string) => (!value || value === NO_SUPPLIER ? 'Tanpa Pemasok' : (suppliers.find((s) => s.id === value)?.name ?? 'Tanpa Pemasok'))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SUPPLIER}>Tanpa Pemasok</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Diharapkan</Label>
                <Input
                  type="date"
                  value={form.expectedDate}
                  onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Opsional"
              />
            </div>

            <div className="space-y-3 border border-border p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base">Item Pembelian</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Item
                </Button>
              </div>

              <div className="space-y-2.5">
                {form.items.map((it, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-3 space-y-2.5">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        <Label className="text-xs text-muted-foreground">Produk</Label>
                        <Select value={it.productId} onValueChange={(v) => setItemProduct(idx, v ?? '')}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih Produk">
                              {(value: string) => products.find((x) => x.id === value)?.name ?? null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {products.length === 0 ? (
                              <div className="px-2 py-2 text-xs text-muted-foreground italic">
                                Belum ada produk
                              </div>
                            ) : (
                              products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 self-end"
                        aria-label="Hapus item"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Jumlah</Label>
                        <Input
                          type="number"
                          min="0"
                          value={it.qty}
                          onChange={(e) => setItemField(idx, { qty: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Harga Beli</Label>
                        <Input
                          type="number"
                          min="0"
                          value={it.costPrice}
                          onChange={(e) => setItemField(idx, { costPrice: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    {it.productId && (
                      <p className="text-xs text-muted-foreground">
                        Subtotal: {rp(num(it.qty) * num(it.costPrice))}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-semibold text-foreground">{rp(formTotal)}</span>
              </div>
            </div>

            {!editId && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none rounded-lg bg-muted/50 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="accent-brand w-4 h-4"
                  checked={generatePdf}
                  onChange={(e) => setGeneratePdf(e.target.checked)}
                />
                <FileText className="w-4 h-4 text-info shrink-0" />
                <span>Buat PDF PO setelah disimpan <span className="text-muted-foreground">(untuk dikirim ke pemasok)</span></span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Batal
            </Button>
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={handleSave}>
              {editId ? 'Simpan Perubahan' : 'Simpan PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={isReceiveOpen} onOpenChange={setIsReceiveOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{isReceived ? 'Detail Penerimaan' : 'Terima Stok'}</DialogTitle>
          </DialogHeader>
          {activeOrder && (
            <div className="space-y-4 py-2 overflow-y-auto flex-1 -mx-6 px-6">
              <div className="grid grid-cols-2 gap-4 bg-muted/50 border border-border p-4 rounded-lg">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Pemasok</p>
                  <p className="font-semibold text-sm truncate text-foreground">
                    {activeOrder.supplierName || '-'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={activeOrder.status} />
                </div>
              </div>

              <div className="space-y-3">
                {receiveItems.map((it, idx) => {
                  const p = productById(it.productId);
                  const tracksBatches = p?.trackBatches === 1;
                  return (
                    <div key={idx} className="border border-border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {it.productName || '-'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Dipesan: {num(it.qty)} · {rp(num(it.costPrice))}
                          </p>
                        </div>
                        <div className="w-28 shrink-0 space-y-1">
                          <Label className="text-xs text-muted-foreground">Jumlah Diterima</Label>
                          <Input
                            type="number"
                            min="0"
                            disabled={isReceived}
                            value={it.qtyReceived ?? 0}
                            onChange={(e) => setReceiveField(idx, { qtyReceived: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      {tracksBatches && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">No. Batch</Label>
                            <Input
                              disabled={isReceived}
                              value={it.batchNo || ''}
                              onChange={(e) => setReceiveField(idx, { batchNo: e.target.value })}
                              placeholder="Opsional"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Tanggal Kadaluarsa</Label>
                            <Input
                              type="date"
                              disabled={isReceived}
                              value={it.expiryDate || ''}
                              onChange={(e) => setReceiveField(idx, { expiryDate: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!isReceived && (
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input accent-brand"
                    checked={recordExpense}
                    onChange={(e) => setRecordExpense(e.target.checked)}
                  />
                  Catat sebagai pengeluaran (Arus Kas)
                </label>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Total Diterima</span>
                <span className="font-semibold text-foreground">{rp(receiveTotal)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReceiveOpen(false)}>
              {isReceived ? 'Tutup' : 'Batal'}
            </Button>
            {!isReceived && (
              <Button
                className="bg-brand text-brand-foreground hover:bg-brand/90"
                onClick={handleReceive}
                disabled={receiving}
              >
                <PackageCheck className="w-4 h-4 mr-2" />
                Terima Stok
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Purchase Order"
        description={
          <>
            Yakin ingin menghapus PO{' '}
            <b>{activeOrder?.supplierName || activeOrder?.id}</b>? Tindakan ini tidak dapat dibatalkan.
          </>
        }
        variant="destructive"
        confirmLabel="Hapus"
        onConfirm={handleDelete}
      />
    </div>
  );
}
