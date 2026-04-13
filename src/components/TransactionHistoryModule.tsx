import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';

export function TransactionHistoryModule() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const fetchTransactions = () => {
    fetch('/api/transactions').then(res => res.json()).then(setTransactions);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const confirmDelete = (id: string) => {
    setTransactionToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    try {
      const res = await fetch(`/api/transactions/${transactionToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Transaksi berhasil dihapus');
        setIsDeleteDialogOpen(false);
        setTransactionToDelete(null);
        fetchTransactions();
      }
    } catch (error) {
      toast.error('Gagal menghapus transaksi');
    }
  };

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <h2 className="text-3xl font-bold text-slate-800">Riwayat Transaksi</h2>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            Apakah Anda yakin ingin menghapus transaksi ini? Data yang dihapus tidak dapat dikembalikan.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus Transaksi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Semua Penjualan</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Transaksi</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Metode Pembayaran</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">#{t.id}</TableCell>
                  <TableCell>{format(new Date(t.date), 'dd MMM yyyy HH:mm', { locale: id })}</TableCell>
                  <TableCell>
                    {t.items?.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.paymentMethod}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    Rp {t.total.toLocaleString('id-ID')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => confirmDelete(t.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    Belum ada transaksi
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
