import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Pagination } from './Pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { Trash2, Printer, Eye, Receipt, Utensils, User, FileSpreadsheet } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { printThermal, buildReceiptSections, isVirtualPrinter, htmlPrintReceipt } from '../services/printer';
import { logActivity } from '../services/activity';
import { exportCSV } from '../services/export';
import { composeReceiptHeader } from '../services/utils';

export function TransactionHistoryModule() {
  const [paginated, setPaginated] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>({});
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [viewTx, setViewTx] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [exporting, setExporting] = useState(false);

  const fetchPage = () => {
    setLoading(true);
    invoke<{ items: any[]; total: number }>('get_transactions_page', {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then((res) => {
        setPaginated(res.items || []);
        setTotalCount(res.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPage();
  }, [page, pageSize]);

  useEffect(() => {
    invoke('get_settings').then(setSettings).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const handlePrint = async (t: any) => {
    setPrintingId(t.id);
    try {
      const taxRate = settings.taxRate || 0;
      const serviceRate = settings.serviceCharge || 0;
      const items = (t.items || []).map((it: any) => ({
        name: it.name,
        qty: it.quantity,
        price: it.price || 0,
        variantName: it.variantName,
      }));
      const receipt = {
        txId: t.id,
        txDate: t.date,
        header: composeReceiptHeader(settings),
        footer: (settings.receiptFooter || '').replace(/\\n/g, '\n'),
        customer: t.customer,
        tableName: t.tableName,
        note: t.note,
        cashier: t.cashier,
        items,
        subtotal: t.subtotal || 0,
        tax: t.tax || 0,
        taxRate,
        serviceCharge: t.serviceCharge || 0,
        serviceRate,
        total: t.total || 0,
        discount: t.discount || 0,
        discountName: t.discountName || undefined,
        paymentMethod: t.paymentMethod,
        amountPaid: t.amountPaid,
        change: t.change,
      };

      // Tauri plugin (USB / Bluetooth via system printer)
      if (settings.printerType === 'tauri' && settings.tauriPrinterName) {
        // Virtual printers (Print to PDF, XPS, etc.) can't decode raw ESC/POS
        if (isVirtualPrinter(settings.tauriPrinterName)) {
          htmlPrintReceipt(receipt, {
            paperWidth: settings.paperWidth,
            logo: settings.logo,
            logoWidth: settings.logoWidth,
            logoHeight: settings.logoHeight,
          });
          toast.success('Struk dicetak ulang (HTML)');
          return;
        }
        await printThermal({
          printer: settings.tauriPrinterName,
          paper_size: (settings.paperWidth || '').includes('58') ? 'Mm58' : 'Mm80',
          options: {
            cut_paper: true,
            beep: false,
            open_cash_drawer: !!settings.printerOpenDrawer,
          },
          sections: buildReceiptSections(receipt),
        });
        toast.success('Struk dicetak ulang');
        return;
      }

      // Network ESC/POS
      if (settings.printerType === 'network' && settings.printerIp) {
        try {
          await invoke('print_receipt', { receipt });
        } catch (err: any) {
          throw new Error(err?.error || err || 'Print gagal');
        }
        toast.success('Struk dicetak ulang');
        return;
      }

      // Browser dialog fallback
      const w = window.open('', '_blank');
      if (!w) { toast.error('Popup diblokir browser'); return; }
      const itemRows = items.map((it: any) => `
        <div class="item">
          <span>${it.qty}x ${it.name}${it.variantName ? ' (' + it.variantName + ')' : ''}</span>
          <span>Rp ${((it.price || 0) * it.qty).toLocaleString('id-ID')}</span>
        </div>`).join('');
      w.document.write(`
        <html><head><title>Struk #${t.id}</title>
        <style>
          body { font-family: monospace; padding: 20px; width: ${settings.paperWidth || '80mm'}; margin: 0 auto; }
          .header, .footer { text-align: center; white-space: pre-wrap; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .total { font-weight: bold; }
        </style></head><body>
          ${settings.logo ? `<img src="${settings.logo}" style="display:block;margin:0 auto 8px;width:${settings.logoWidth || 120}px;height:${settings.logoHeight || 32}px;object-fit:contain" />` : ''}
          <div class="header">${composeReceiptHeader(settings)}</div>
          <div>Struk #${t.id}</div>
          <div>${new Date(t.date).toLocaleString('id-ID')}</div>
          ${t.customer ? `<div>Pelanggan: ${t.customer}</div>` : ''}
          <div class="divider"></div>
          ${itemRows}
          <div class="divider"></div>
          <div class="item"><span>Subtotal</span><span>Rp ${(t.subtotal || 0).toLocaleString('id-ID')}</span></div>
          ${t.discount ? `<div class="item" style="color:#dc2626"><span>Diskon${t.discountName ? ` (${t.discountName})` : ''}</span><span>-Rp ${(t.discount || 0).toLocaleString('id-ID')}</span></div>` : ''}
          ${t.tax ? `<div class="item"><span>Pajak (${taxRate}%)</span><span>Rp ${t.tax.toLocaleString('id-ID')}</span></div>` : ''}
          ${t.serviceCharge ? `<div class="item"><span>Layanan (${serviceRate}%)</span><span>Rp ${t.serviceCharge.toLocaleString('id-ID')}</span></div>` : ''}
          <div class="divider"></div>
          <div class="item total"><span>Total</span><span>Rp ${(t.total || 0).toLocaleString('id-ID')}</span></div>
          <div class="item"><span>Pembayaran</span><span>${t.paymentMethod}</span></div>
          <div class="divider"></div>
          <div class="footer">${(settings.receiptFooter || 'Terima Kasih').replace(/\\n/g, '\n')}</div>
        </body></html>`);
      w.document.close();
      w.print();
    } catch (e: any) {
      toast.error('Gagal cetak: ' + (e.message || e));
    } finally {
      setPrintingId(null);
    }
  };

  const confirmDelete = (id: string) => {
    setTransactionToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleExport = async () => {
    if (totalCount === 0) {
      toast.error('Belum ada transaksi untuk diekspor');
      return;
    }
    setExporting(true);
    try {
      // Export pulls the full history on-demand (not on page load)
      const all: any[] = await invoke('get_transactions');
      const headers = [
        'ID Transaksi',
        'Tanggal',
        'Waktu',
        'Pelanggan',
        'Meja',
        'Kasir',
        'Item',
        'Jumlah Item',
        'Subtotal',
        'Diskon',
        'Pajak',
        'Biaya Layanan',
        'Total',
        'Metode Pembayaran',
        'Dibayar',
        'Kembalian',
        'Catatan',
      ];
      const rows = all.map((t: any) => {
        const items = t.items || [];
        const itemSummary = items.map((i: any) => `${i.quantity}x ${i.name}${i.variantName ? ` (${i.variantName})` : ''}`).join(', ');
        const totalQty = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
        const d = new Date(t.date);
        return [
          t.id,
          format(d, 'yyyy-MM-dd'),
          format(d, 'HH:mm:ss'),
          t.customer || '',
          t.tableName || '',
          t.cashier || '',
          itemSummary,
          totalQty,
          t.subtotal || 0,
          t.discount || 0,
          t.tax || 0,
          t.serviceCharge || 0,
          t.total || 0,
          t.paymentMethod || '',
          t.amountPaid || 0,
          t.change || 0,
          t.note || '',
        ];
      });
      const stamp = format(new Date(), 'yyyyMMdd-HHmm');
      const result = await exportCSV(`riwayat-transaksi-${stamp}.csv`, [headers, ...rows]);
      if (!result.saved) return; // user cancelled the dialog
      logActivity('Export Riwayat Transaksi', `${all.length} baris`, result.path);
      toast.success(
        `Berhasil mengekspor ${all.length} transaksi`,
        result.path ? { description: result.path } : undefined,
      );
    } catch (e: any) {
      toast.error('Gagal menyimpan file: ' + (e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    try {
      await invoke('delete_transaction', { id: transactionToDelete });
      logActivity('Hapus Transaksi', `#${transactionToDelete}`);
      toast.success('Transaksi berhasil dihapus');
      setIsDeleteDialogOpen(false);
      setTransactionToDelete(null);
      fetchPage();
    } catch (error) {
      toast.error('Gagal menghapus transaksi');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto h-full">
      <PageHeader
        title="Riwayat Transaksi"
        icon={Receipt}
        actions={
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={totalCount === 0 || exporting}
            className="border-success/40 text-success hover:bg-success/10 hover:text-success"
            title="Ekspor ke file CSV (dapat dibuka di Excel)"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {exporting ? 'Mengekspor...' : 'Export Excel'}
          </Button>
        }
      />

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        variant="destructive"
        title="Konfirmasi Hapus"
        description="Apakah Anda yakin ingin menghapus transaksi ini? Data yang dihapus tidak dapat dikembalikan."
        confirmLabel="Hapus Transaksi"
        onConfirm={handleDelete}
      />

      {/* View Transaction Detail Dialog */}
      <Dialog open={!!viewTx} onOpenChange={(open) => { if (!open) setViewTx(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Transaksi #{viewTx?.id}</DialogTitle>
          </DialogHeader>
          {viewTx && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Tanggal</span>
                  <p className="font-medium">{format(new Date(viewTx.date), 'dd MMM yyyy HH:mm:ss', { locale: id })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Metode Pembayaran</span>
                  <p className="font-medium">{viewTx.paymentMethod}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Kasir</span>
                  <p className="font-medium">{viewTx.cashier || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Pelanggan</span>
                  <p className="font-medium">{viewTx.customer || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Meja</span>
                  <p className="font-medium">{viewTx.tableName || '-'}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Item</h4>
                <div className="space-y-1.5">
                  {(viewTx.items || []).map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>
                        {item.quantity}x {item.name}
                        {item.variantName ? <span className="text-muted-foreground"> ({item.variantName})</span> : ''}
                      </span>
                      <span className="font-medium">Rp {((item.price || 0) * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>Rp {(viewTx.subtotal || 0).toLocaleString('id-ID')}</span></div>
                {viewTx.discount > 0 && <div className="flex justify-between text-destructive"><span>Diskon{viewTx.discountName ? ` (${viewTx.discountName})` : ''}</span><span>-Rp {(viewTx.discount || 0).toLocaleString('id-ID')}</span></div>}
                {viewTx.tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>Rp {viewTx.tax.toLocaleString('id-ID')}</span></div>}
                {viewTx.serviceCharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Biaya Layanan</span><span>Rp {viewTx.serviceCharge.toLocaleString('id-ID')}</span></div>}
                <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
                  <span>Total</span><span>Rp {(viewTx.total || 0).toLocaleString('id-ID')}</span>
                </div>
                {viewTx.paymentMethod === 'Tunai' && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Dibayar</span><span>Rp {(viewTx.amountPaid || 0).toLocaleString('id-ID')}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span>Rp {(viewTx.change || 0).toLocaleString('id-ID')}</span></div>
                  </>
                )}
              </div>

              {viewTx.note && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">Catatan</h4>
                    <div className="bg-muted rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap">
                      {viewTx.note}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTx(null)}>Tutup</Button>
            {viewTx && (
              <Button
                onClick={() => { handlePrint(viewTx); }}
                disabled={printingId === viewTx?.id}
                className="bg-brand text-brand-foreground hover:bg-brand/90"
              >
                <Printer className="w-4 h-4 mr-2" />
                Cetak Ulang
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="rounded-2xl ring-1 ring-foreground/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Semua Penjualan</CardTitle>
          <span className="text-sm text-muted-foreground">{totalCount} transaksi</span>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && paginated.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Spinner className="size-6" />
              <p>Memuat transaksi…</p>
            </div>
          )}
          {paginated.map((t) => {
              const items = t.items || [];
              const visibleItems = items.slice(0, 3).map((i: any) => `${i.quantity}x ${i.name}`).join(', ');
              const remaining = items.length - 3;
              const totalQty = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
              return (
                <div
                  key={t.id}
                  className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:border-brand/40 hover:shadow-sm transition-all"
                >
                  {/* Left: ID + meta + items preview */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground text-sm">
                        <Receipt className="w-3.5 h-3.5 text-brand" />#{t.id}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(t.date), 'dd MMM yyyy HH:mm', { locale: id })}
                      </span>
                      {t.tableName && (
                        <Badge variant="secondary" className="h-5 text-[11px] font-medium">
                          <Utensils className="w-3 h-3 mr-1" />
                          {t.tableName}
                        </Badge>
                      )}
                      <Badge variant="outline" className="h-5 text-[11px] font-medium">
                        {t.paymentMethod}
                      </Badge>
                      {t.customer && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          {t.customer}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate" title={items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}>
                      {visibleItems}
                      {remaining > 0 && (
                        <span className="text-brand font-medium"> +{remaining} lainnya</span>
                      )}
                    </p>
                    {t.note && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate" title={t.note}>
                        Catatan: {t.note}
                      </p>
                    )}
                  </div>

                  {/* Middle: total */}
                  <div className="shrink-0 text-right">
                    {t.discount > 0 && (
                      <p className="text-xs text-muted-foreground line-through whitespace-nowrap">
                        Rp {((t.total || 0) + (t.discount || 0)).toLocaleString('id-ID')}
                      </p>
                    )}
                    <p className="text-base font-bold text-foreground whitespace-nowrap">
                      Rp {t.total.toLocaleString('id-ID')}
                    </p>
                    {t.discount > 0 && (
                      <p className="text-[11px] text-destructive font-medium">Diskon -Rp {(t.discount || 0).toLocaleString('id-ID')}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">{totalQty} item</p>
                  </div>

                  {/* Right: actions — always visible */}
                  <div className="shrink-0 flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" onClick={() => setViewTx(t)} title="Lihat detail" aria-label={`Lihat detail transaksi #${t.id}`}>
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePrint(t)}
                      disabled={printingId === t.id}
                      title="Cetak ulang struk"
                      aria-label={`Cetak ulang struk transaksi #${t.id}`}
                    >
                      <Printer className={`w-4 h-4 ${printingId === t.id ? 'animate-pulse text-brand' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => confirmDelete(t.id)} title="Hapus transaksi" aria-label={`Hapus transaksi #${t.id}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}

          {!loading && totalCount === 0 && (
            <EmptyState
              icon={Receipt}
              title="Belum ada transaksi"
              description="Transaksi yang Anda selesaikan di POS akan muncul di sini."
            />
          )}

          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalCount}
            onPageChange={setPage}
            pageSizeOptions={[10, 15, 25, 50]}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
