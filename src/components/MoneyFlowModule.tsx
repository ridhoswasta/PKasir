import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';

export function MoneyFlowModule() {
  const [flows, setFlows] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newFlow, setNewFlow] = useState({ type: 'Pengeluaran', category: '', amount: 0, description: '' });

  const fetchFlows = () => {
    fetch('/api/money-flow').then(res => res.json()).then(setFlows);
  };

  useEffect(() => {
    fetchFlows();
    fetch('/api/settings').then(res => res.json()).then(setSettings);
  }, []);

  const handleAddFlow = async () => {
    try {
      const res = await fetch('/api/money-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFlow)
      });
      if (res.ok) {
        toast.success('Transaksi kas berhasil dicatat');
        setIsDialogOpen(false);
        setNewFlow({ type: 'Pengeluaran', category: '', amount: 0, description: '' });
        fetchFlows();
      }
    } catch (error) {
      toast.error('Gagal mencatat transaksi');
    }
  };

  const handleDeleteFlow = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan ini?')) return;
    try {
      const res = await fetch(`/api/money-flow/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Catatan berhasil dihapus');
        fetchFlows();
      }
    } catch (error) {
      toast.error('Gagal menghapus catatan');
    }
  };

  const totalIncome = flows.filter(f => f.type === 'Pemasukan').reduce((sum, f) => sum + f.amount, 0);
  const totalExpense = flows.filter(f => f.type === 'Pengeluaran').reduce((sum, f) => sum + f.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-800">Arus Kas</h2>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Catat Arus Kas
        </Button>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Saldo Saat Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">Rp {balance.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Pemasukan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">Rp {totalIncome.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Pengeluaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">Rp {totalExpense.toLocaleString('id-ID')}</div>
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
              {flows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((flow) => (
                <TableRow key={flow.id}>
                  <TableCell>{format(new Date(flow.date), 'dd MMM yyyy HH:mm', { locale: id })}</TableCell>
                  <TableCell>{flow.description}</TableCell>
                  <TableCell>{flow.category}</TableCell>
                  <TableCell>
                    <Badge variant={flow.type === 'Pemasukan' ? 'default' : 'destructive'} className={flow.type === 'Pemasukan' ? 'bg-emerald-500' : ''}>
                      {flow.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    Rp {flow.amount.toLocaleString('id-ID')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteFlow(flow.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
