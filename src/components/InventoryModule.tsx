import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { Package, Plus, Trash2, Edit, History, CalendarClock, Layers, AlertTriangle, Boxes } from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { toast } from 'sonner';
import { logActivity } from '../services/activity';
import { useAuth } from '../services/auth';
import type { Product, ProductBatch, StockMovement } from '../types';

const MOVE_META: Record<string, { label: string; cls: string }> = {
  sale: { label: 'Penjualan', cls: 'bg-destructive/12 text-destructive' },
  purchase: { label: 'Pembelian', cls: 'bg-success/12 text-success' },
  adjustment: { label: 'Penyesuaian', cls: 'bg-info/12 text-info' },
  return: { label: 'Retur', cls: 'bg-warning/15 text-warning' },
  expiry: { label: 'Kadaluarsa', cls: 'bg-destructive/12 text-destructive' },
  initial: { label: 'Stok Awal', cls: 'bg-muted text-muted-foreground' },
  transfer: { label: 'Transfer', cls: 'bg-muted text-muted-foreground' },
};

const fmtDate = (d?: string, withTime = false) => {
  if (!d) return '-';
  try { return format(new Date(d), withTime ? 'dd MMM yyyy HH:mm' : 'dd MMM yyyy'); } catch { return d; }
};

const blankBatch = { id: '', batchNo: '', expiryDate: '', qty: 0, costPrice: 0, note: '' };

export function InventoryModule() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [allBatches, setAllBatches] = useState<ProductBatch[]>([]);
  const [expiring, setExpiring] = useState<ProductBatch[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [tab, setTab] = useState('stock');
  const [movementsLoading, setMovementsLoading] = useState(false);

  // Adjust-stock dialog
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustment, setAdjustment] = useState(0);
  const [adjustNote, setAdjustNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Batch manager
  const [batchProduct, setBatchProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [batchForm, setBatchForm] = useState<any>(blankBatch);
  const [batchEditing, setBatchEditing] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<ProductBatch | null>(null);

  const fetchProducts = () => invoke<Product[]>('get_products').then(setProducts).catch(() => {});
  const fetchAllBatches = () => invoke<ProductBatch[]>('get_batches', {}).then(setAllBatches).catch(() => {});
  const fetchExpiring = () => invoke<ProductBatch[]>('get_expiring_batches', { withinDays: 30 }).then(setExpiring).catch(() => {});
  const fetchMovements = () => {
    setMovementsLoading(true);
    invoke<StockMovement[]>('get_stock_movements', { limit: 500 })
      .then(setMovements)
      .catch(() => {})
      .finally(() => setMovementsLoading(false));
  };

  const refreshAll = () => { fetchProducts(); fetchAllBatches(); fetchExpiring(); };

  useEffect(() => { refreshAll(); fetchMovements(); }, []);

  // Aggregate batch info per product for the stock table
  const batchInfo = useMemo(() => {
    const map: Record<string, { count: number; qty: number; nearest?: string }> = {};
    for (const b of allBatches) {
      if (!b.productId) continue;
      const m = map[b.productId] || { count: 0, qty: 0, nearest: undefined };
      if ((b.qty ?? 0) > 0) {
        m.count += 1;
        m.qty += b.qty ?? 0;
        if (b.expiryDate && (!m.nearest || b.expiryDate < m.nearest)) m.nearest = b.expiryDate;
      }
      map[b.productId] = m;
    }
    return map;
  }, [allBatches]);

  const stockStatus = (p: Product) => {
    const s = p.stock ?? 0;
    const rp = p.reorderPoint ?? 0;
    if (s <= 0) return { label: 'Stok Habis', cls: 'bg-destructive/12 text-destructive' };
    if (rp > 0 && s <= rp) return { label: 'Perlu Pesan Ulang', cls: 'bg-warning/15 text-warning' };
    if (s <= 10) return { label: 'Stok Menipis', cls: 'bg-warning/15 text-warning' };
    return { label: 'Tersedia', cls: 'bg-success/12 text-success' };
  };

  const expiryDays = (d?: string) => (d ? differenceInCalendarDays(new Date(d), new Date()) : null);

  // ── Adjust stock ───────────────────────────────────────────────────────────
  const openAdjust = (p: Product) => { setAdjustProduct(p); setAdjustment(0); setAdjustNote(''); };
  const handleAdjust = async () => {
    if (!adjustProduct || adjustment === 0) { setAdjustProduct(null); return; }
    setAdjusting(true);
    try {
      await invoke('adjust_stock', {
        productId: adjustProduct.id,
        delta: adjustment,
        note: adjustNote || undefined,
        user: user?.displayName,
      });
      logActivity('Penyesuaian Stok', adjustProduct.name, `${adjustment >= 0 ? '+' : ''}${adjustment} ${adjustProduct.unit || ''}`);
      toast.success(`Stok ${adjustProduct.name} disesuaikan`);
      setAdjustProduct(null);
      refreshAll(); fetchMovements();
    } catch (e: any) {
      toast.error('Gagal menyesuaikan stok: ' + (e?.message || e));
    } finally {
      setAdjusting(false);
    }
  };

  // ── Batch management ─────────────────────────────────────────────────────────
  const openBatchManager = (p: Product) => {
    setBatchProduct(p);
    setBatchForm(blankBatch);
    setBatchEditing(false);
    invoke<ProductBatch[]>('get_batches', { productId: p.id }).then(setBatches).catch(() => setBatches([]));
  };
  const reloadBatches = () => {
    if (!batchProduct) return;
    invoke<ProductBatch[]>('get_batches', { productId: batchProduct.id }).then(setBatches).catch(() => {});
  };
  const editBatch = (b: ProductBatch) => {
    setBatchEditing(true);
    setBatchForm({ id: b.id, batchNo: b.batchNo || '', expiryDate: b.expiryDate || '', qty: b.qty ?? 0, costPrice: b.costPrice ?? 0, note: b.note || '' });
  };
  const saveBatch = async () => {
    if (!batchProduct) return;
    setSavingBatch(true);
    const payload = {
      productId: batchProduct.id,
      batchNo: batchForm.batchNo || undefined,
      expiryDate: batchForm.expiryDate || undefined,
      qty: Number(batchForm.qty) || 0,
      costPrice: Number(batchForm.costPrice) || undefined,
      note: batchForm.note || undefined,
    };
    try {
      if (batchEditing) {
        await invoke('update_batch', { id: batchForm.id, batch: payload, user: user?.displayName });
        logActivity('Ubah Batch', batchProduct.name, batchForm.batchNo);
        toast.success('Batch diperbarui');
      } else {
        await invoke('create_batch', { batch: payload, user: user?.displayName });
        logActivity('Tambah Batch', batchProduct.name, `${payload.qty} ${batchProduct.unit || ''}`);
        toast.success('Batch ditambahkan, stok bertambah');
      }
      setBatchForm(blankBatch); setBatchEditing(false);
      reloadBatches(); refreshAll(); fetchMovements();
    } catch (e: any) {
      toast.error('Gagal menyimpan batch: ' + (e?.message || e));
    } finally {
      setSavingBatch(false);
    }
  };
  const confirmDeleteBatch = async () => {
    if (!batchToDelete) return;
    try {
      await invoke('delete_batch', { id: batchToDelete.id, user: user?.displayName });
      logActivity('Hapus Batch', batchProduct?.name, batchToDelete.batchNo);
      toast.success('Batch dihapus, stok dikurangi');
      setBatchToDelete(null);
      reloadBatches(); refreshAll(); fetchMovements();
    } catch (e: any) {
      toast.error('Gagal menghapus batch: ' + (e?.message || e));
    }
  };

  const expiringSoonCount = expiring.length;

  return (
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto h-full">
      <PageHeader
        icon={Package}
        title="Inventaris"
        description="Pantau stok, riwayat pergerakan, dan batch kadaluarsa"
      />

      {/* Expiry alert banner */}
      {expiringSoonCount > 0 && (
        <button
          onClick={() => setTab('expiry')}
          className="w-full text-left flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 hover-lift"
        >
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{expiringSoonCount} batch akan / sudah kadaluarsa</p>
            <p className="text-xs text-muted-foreground">Klik untuk melihat daftar batch yang kedaluwarsa dalam 30 hari ke depan.</p>
          </div>
          <Badge className="bg-warning/15 text-warning">Tinjau</Badge>
        </button>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="stock"><Boxes className="w-3.5 h-3.5 mr-1.5" />Stok</TabsTrigger>
          <TabsTrigger value="history"><History className="w-3.5 h-3.5 mr-1.5" />Riwayat</TabsTrigger>
          <TabsTrigger value="expiry"><CalendarClock className="w-3.5 h-3.5 mr-1.5" />Kadaluarsa</TabsTrigger>
        </TabsList>

        {/* ── Stock tab ── */}
        <TabsContent value="stock" className="mt-5">
          <Card className="rounded-2xl ring-1 ring-foreground/10">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Stok</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState icon={Package} title="Belum ada produk" description="Tambahkan produk di menu Produk." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((p) => {
                      const st = stockStatus(p);
                      const bi = batchInfo[p.id];
                      const nearestDays = expiryDays(bi?.nearest);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.name}
                            {p.trackBatches ? <span className="ml-2 text-xs bg-info/10 text-info px-2 py-0.5 rounded">Batch</span> : null}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.category}</TableCell>
                          <TableCell className="font-semibold tabular-nums">{p.stock} <span className="text-xs font-normal text-muted-foreground">{p.unit}</span></TableCell>
                          <TableCell>
                            {p.trackBatches ? (
                              bi && bi.count > 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  {bi.count} batch
                                  {bi.nearest && (
                                    <span className={nearestDays !== null && nearestDays < 0 ? 'text-destructive' : nearestDays !== null && nearestDays <= 30 ? 'text-warning' : ''}>
                                      {' · '}exp {fmtDate(bi.nearest)}
                                    </span>
                                  )}
                                </span>
                              ) : <span className="text-xs text-muted-foreground italic">belum ada</span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {p.trackBatches ? (
                                <Button variant="outline" size="sm" onClick={() => openBatchManager(p)}>
                                  <Layers className="w-3.5 h-3.5 mr-1.5" />Batch
                                </Button>
                              ) : null}
                              <Button variant="outline" size="sm" onClick={() => openAdjust(p)}>Sesuaikan</Button>
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
        </TabsContent>

        {/* ── History tab ── */}
        <TabsContent value="history" className="mt-5">
          <Card className="rounded-2xl ring-1 ring-foreground/10">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Oleh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementsLoading && movements.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-10 text-center"><Spinner className="mx-auto" /></TableCell></TableRow>
                  ) : movements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState icon={History} title="Belum ada pergerakan stok" description="Penjualan, pembelian, dan penyesuaian akan tercatat di sini." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    movements.map((m) => {
                      const meta = MOVE_META[m.type] || { label: m.type, cls: 'bg-muted text-muted-foreground' };
                      const up = (m.quantity ?? 0) >= 0;
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(m.date, true)}</TableCell>
                          <TableCell className="font-medium">{m.productName || m.productId}</TableCell>
                          <TableCell><Badge className={meta.cls}>{meta.label}</Badge></TableCell>
                          <TableCell className={`text-right font-semibold tabular-nums ${up ? 'text-success' : 'text-destructive'}`}>{up ? '+' : ''}{m.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{m.balanceAfter ?? '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.note || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.user || '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground/70 mt-2">Menampilkan maksimal 500 pergerakan terbaru.</p>
        </TabsContent>

        {/* ── Expiry tab ── */}
        <TabsContent value="expiry" className="mt-5">
          <Card className="rounded-2xl ring-1 ring-foreground/10">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead>No. Batch</TableHead>
                    <TableHead>Kadaluarsa</TableHead>
                    <TableHead className="text-right">Sisa Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiring.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <EmptyState icon={CalendarClock} title="Tidak ada batch kadaluarsa" description="Tidak ada batch yang kedaluwarsa dalam 30 hari ke depan." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    expiring.map((b) => {
                      const days = expiryDays(b.expiryDate);
                      const expired = days !== null && days < 0;
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.productName || b.productId}</TableCell>
                          <TableCell className="text-muted-foreground">{b.batchNo || '-'}</TableCell>
                          <TableCell>{fmtDate(b.expiryDate)}</TableCell>
                          <TableCell className="text-right tabular-nums">{b.qty}</TableCell>
                          <TableCell>
                            {expired ? (
                              <Badge className="bg-destructive/12 text-destructive">Kadaluarsa {Math.abs(days as number)} hari lalu</Badge>
                            ) : (
                              <Badge className="bg-warning/15 text-warning">{days} hari lagi</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust stock dialog */}
      <Dialog open={!!adjustProduct} onOpenChange={(open) => !open && setAdjustProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sesuaikan Stok: {adjustProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Stok saat ini: <span className="font-semibold text-foreground">{adjustProduct?.stock} {adjustProduct?.unit}</span></p>
            <div className="space-y-2">
              <Label>Penyesuaian (boleh negatif)</Label>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" aria-label="Kurangi" onClick={() => setAdjustment(a => a - 1)}>-</Button>
                <Input type="number" value={adjustment} onChange={(e) => setAdjustment(Number(e.target.value))} className="text-center" />
                <Button variant="outline" size="icon" aria-label="Tambah" onClick={() => setAdjustment(a => a + 1)}>+</Button>
              </div>
              <p className="text-sm text-muted-foreground">Stok baru: <span className="font-semibold text-foreground">{(adjustProduct?.stock ?? 0) + adjustment} {adjustProduct?.unit}</span></p>
            </div>
            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="Mis. stok opname, barang rusak..." />
            </div>
            {adjustProduct?.trackBatches ? (
              <p className="text-xs text-muted-foreground">Produk ini dilacak per batch — penambahan dibuat sebagai lot "PENYESUAIAN", pengurangan dipotong FEFO.</p>
            ) : null}
            <Button onClick={handleAdjust} disabled={adjusting || adjustment === 0} className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
              {adjusting && <Spinner className="mr-2 text-current" />}Konfirmasi Penyesuaian
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch manager dialog */}
      <Dialog open={!!batchProduct} onOpenChange={(open) => { if (!open) { setBatchProduct(null); setBatchForm(blankBatch); setBatchEditing(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kelola Batch: {batchProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1 max-h-[70vh] overflow-y-auto">
            {/* Add / edit form */}
            <div className="rounded-xl ring-1 ring-foreground/10 p-4 space-y-3">
              <p className="text-sm font-semibold">{batchEditing ? 'Ubah Batch' : 'Tambah Batch (menambah stok)'}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>No. Batch</Label>
                  <Input value={batchForm.batchNo} onChange={(e) => setBatchForm((f: any) => ({ ...f, batchNo: e.target.value }))} placeholder="mis. B-2026-01" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tanggal Kadaluarsa</Label>
                  <Input type="date" value={batchForm.expiryDate} onChange={(e) => setBatchForm((f: any) => ({ ...f, expiryDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{batchEditing ? 'Sisa Qty' : 'Qty Diterima'}</Label>
                  <Input type="number" value={batchForm.qty} onChange={(e) => setBatchForm((f: any) => ({ ...f, qty: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Harga Beli / unit</Label>
                  <Input type="number" min="0" value={batchForm.costPrice} onChange={(e) => setBatchForm((f: any) => ({ ...f, costPrice: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveBatch} disabled={savingBatch} className="bg-brand text-brand-foreground hover:bg-brand/90">
                  {savingBatch && <Spinner className="mr-2 text-current" />}
                  {batchEditing ? 'Simpan Perubahan' : <><Plus className="w-4 h-4 mr-1" />Tambah Batch</>}
                </Button>
                {batchEditing && (
                  <Button variant="outline" onClick={() => { setBatchForm(blankBatch); setBatchEditing(false); }}>Batal</Button>
                )}
              </div>
              {batchEditing && <p className="text-xs text-muted-foreground">Mengubah Sisa Qty akan menyesuaikan stok produk sesuai selisihnya.</p>}
            </div>

            {/* Existing batches */}
            <div className="rounded-xl ring-1 ring-foreground/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Batch</TableHead>
                    <TableHead>Kadaluarsa</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="p-0"><EmptyState compact icon={Layers} title="Belum ada batch" /></TableCell></TableRow>
                  ) : (
                    batches.map((b) => {
                      const days = expiryDays(b.expiryDate);
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.batchNo || <span className="text-muted-foreground italic">tanpa nomor</span>}</TableCell>
                          <TableCell>
                            {b.expiryDate ? (
                              <span className={days !== null && days < 0 ? 'text-destructive' : days !== null && days <= 30 ? 'text-warning' : ''}>{fmtDate(b.expiryDate)}</span>
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{b.qty}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" aria-label="Ubah batch" onClick={() => editBatch(b)}><Edit className="w-4 h-4 text-info" /></Button>
                              <Button variant="ghost" size="icon" aria-label="Hapus batch" onClick={() => setBatchToDelete(b)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!batchToDelete}
        onOpenChange={(open) => !open && setBatchToDelete(null)}
        variant="destructive"
        title="Hapus Batch"
        description={<>Hapus batch <strong>{batchToDelete?.batchNo || 'tanpa nomor'}</strong>? Sisa {batchToDelete?.qty} unit akan dikurangi dari stok.</>}
        confirmLabel="Hapus"
        onConfirm={confirmDeleteBatch}
      />
    </div>
  );
}
