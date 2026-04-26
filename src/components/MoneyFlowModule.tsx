import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Pagination } from './Pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { logActivity } from '../services/activity';
import { exportCSV } from '../services/export';

export function MoneyFlowModule() {
  const [paginatedFlows, setPaginatedFlows] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [txsForDiscount, setTxsForDiscount] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newFlow, setNewFlow] = useState({ type: 'Pengeluaran', category: '', amount: 0, description: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [exporting, setExporting] = useState(false);

  const fetchPage = () => {
    setLoading(true);
    invoke<{ items: any[]; total: number; totalIncome: number; totalExpense: number }>('get_money_flow_page', {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then((res) => {
        setPaginatedFlows(res.items || []);
        setTotalCount(res.total || 0);
        setTotalIncome(res.totalIncome || 0);
        setTotalExpense(res.totalExpense || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPage();
    invoke<any[]>('get_transactions').then((txs) => {
      setTxsForDiscount(txs || []);
      const disc = (txs || []).reduce((s: number, t: any) => s + (t.discount || 0), 0);
      setTotalDiscount(disc);
    }).catch(() => {});
  }, [page, pageSize]);

  const discountMap = useMemo(() => {
    const m = new Map<string, number>();
    txsForDiscount.forEach((t: any) => {
      if ((t.discount || 0) > 0) m.set(t.id, t.discount || 0);
    });
    return m;
  }, [txsForDiscount]);

  const mergedFlows = useMemo(() => {
    return paginatedFlows.map(f => {
      if (f.type === 'Pemasukan' && f.description?.startsWith('Transaksi #')) {
        const txId = f.description.replace('Transaksi #', '').split(' [')[0];
        const disc = discountMap.get(txId) || 0;
        return { ...f, discountAmount: disc > 0 ? disc : undefined };
      }
      return { ...f };
    });
  }, [paginatedFlows, discountMap]);

  useEffect(() => {
    invoke('get_settings').then(setSettings).catch(() => {});
  }, []);

  const handleAddFlow = async () => {
    try {
      await invoke('create_money_flow', { input: { type: newFlow.type, category: newFlow.category, amount: newFlow.amount, description: newFlow.description } });
      logActivity('Tambah Arus Kas', `${newFlow.type} - ${newFlow.category}`, `Rp ${newFlow.amount.toLocaleString('id-ID')}`);
      toast.success('Transaksi kas berhasil dicatat');
      setIsDialogOpen(false);
      setNewFlow({ type: 'Pengeluaran', category: '', amount: 0, description: '' });
      fetchPage();
    } catch (error) {
      toast.error('Gagal mencatat transaksi');
    }
  };

  const handleExport = async () => {
    if (totalCount === 0) {
      toast.error('Belum ada catatan arus kas untuk diekspor');
      return;
    }
    setExporting(true);
    try {
      // Pull full history just for the export — keeps the page load fast
      const all: any[] = await invoke('get_money_flow');
      const headers = [
        'Tanggal',
        'Waktu',
        'Jenis',
        'Kategori',
        'Keterangan',
        'Pemasukan',
        'Pengeluaran',
        'Saldo Berjalan',
      ];
      // Walk oldest→newest so the running balance makes sense
      const chronological = [...all].reverse();
      let running = 0;
      const rows = chronological.map((f: any) => {
        const d = new Date(f.date);
        const income = f.type === 'Pemasukan' ? f.amount : 0;
        const expense = f.type === 'Pengeluaran' ? f.amount : 0;
        running += income - expense;
        return [
          format(d, 'yyyy-MM-dd'),
          format(d, 'HH:mm:ss'),
          f.type || '',
          f.category || '',
          f.description || '',
          income,
          expense,
          running,
        ];
      }).reverse(); // back to newest-first for the output

      // Summary total row
      rows.push([
        '', '', '', '', 'TOTAL',
        totalIncome,
        totalExpense,
        totalIncome - totalExpense,
      ]);

      const stamp = format(new Date(), 'yyyyMMdd-HHmm');
      const result = await exportCSV(`arus-kas-${stamp}.csv`, [headers, ...rows]);
      if (!result.saved) return; // user cancelled the dialog
      logActivity('Export Arus Kas', `${all.length} baris`, result.path);
      toast.success(
        `Berhasil mengekspor ${all.length} catatan arus kas`,
        result.path ? { description: result.path } : undefined,
      );
    } catch (e: any) {
      toast.error('Gagal menyimpan file: ' + (e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan ini?')) return;
    try {
      await invoke('delete_money_flow', { id: flowId });
      logActivity('Hapus Arus Kas', flowId);
      toast.success('Catatan berhasil dihapus');
      fetchPage();
    } catch (error) {
      toast.error('Gagal menghapus catatan');
    }
  };

  const balance = totalIncome - totalExpense;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-3xl font-bold text-foreground">Arus Kas</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={totalCount === 0 || exporting}
            className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
            title="Ekspor ke file CSV (dapat dibuka di Excel)"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {exporting ? 'Mengekspor...' : 'Export Excel'}
          </Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Catat Arus Kas
          </Button>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Catat Pemasukan / Pengeluaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Jenis</Label>
                <Select value={newFlow.type} onValueChange={(val) => setNewFlow({...newFlow, type: val})}>
                  <SelectTrigger><SelectValue placeholder="Pilih jenis" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pemasukan">Pemasukan</SelectItem>
                    <SelectItem value="Pengeluaran">Pengeluaran</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={newFlow.category} onValueChange={(val) => setNewFlow({...newFlow, category: val})}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {settings.flowCategories?.map((cat: string) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jumlah (Rp)</Label>
                <Input type="number" value={newFlow.amount} onChange={e => setNewFlow({...newFlow, amount: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Input value={newFlow.description} onChange={e => setNewFlow({...newFlow, description: e.target.value})} />
              </div>
              <Button onClick={handleAddFlow} className="w-full bg-orange-500 hover:bg-orange-600">
                Simpan Catatan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Saat Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">Rp {balance.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pemasukan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">Rp {totalIncome.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Diskon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500 dark:text-red-400">Rp {(totalDiscount || 0).toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pengeluaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">Rp {totalExpense.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Arus Kas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mergedFlows.map((flow) => (
                <TableRow key={flow.id}>
                  <TableCell>{format(new Date(flow.date), 'dd MMM yyyy HH:mm', { locale: id })}</TableCell>
                  <TableCell>{flow.description}</TableCell>
                  <TableCell>{flow.category}</TableCell>
                  <TableCell>
                    <Badge variant={flow.type === 'Pemasukan' ? 'default' : 'destructive'} className={flow.type === 'Pemasukan' ? 'bg-emerald-500' : ''}>
                      {flow.type}
                    </Badge>
                    {flow.description?.includes('[Diskon:') && (
                      <Badge className="ml-1 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs">Diskon</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {flow.discountAmount ? (
                      <div>
                        <span className="text-muted-foreground line-through text-xs block">Rp {(flow.amount + flow.discountAmount).toLocaleString('id-ID')}</span>
                        <span className="block">Rp {flow.amount.toLocaleString('id-ID')}</span>
                        <span className="text-red-500 text-xs block">Diskon -Rp {flow.discountAmount.toLocaleString('id-ID')}</span>
                      </div>
                    ) : (
                      <span>Rp {flow.amount.toLocaleString('id-ID')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteFlow(flow.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {loading && paginatedFlows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Memuat catatan…
                  </TableCell>
                </TableRow>
              )}
              {!loading && totalCount === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Belum ada catatan arus kas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

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
