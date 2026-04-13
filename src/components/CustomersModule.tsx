import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';

export function CustomersModule() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

  const fetchCustomers = () => {
    fetch('/api/customers').then(res => res.json()).then(setCustomers);
  };

  const fetchTransactions = () => {
    fetch('/api/transactions').then(res => res.json()).then(setTransactions);
  };

  useEffect(() => {
    fetchCustomers();
    fetchTransactions();
  }, []);

  const handleAddCustomer = async () => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
      if (res.ok) {
        toast.success('Pelanggan berhasil ditambahkan');
        setIsDialogOpen(false);
        setNewCustomer({ name: '', phone: '' });
        fetchCustomers();
      }
    } catch (error) {
      toast.error('Gagal menambahkan pelanggan');
    }
  };

  const handleViewCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setIsViewDialogOpen(true);
  };

  const customerTransactions = selectedCustomer 
    ? transactions.filter(t => t.customer === selectedCustomer.name)
    : [];

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-800">Pelanggan</h2>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Tambah Pelanggan
        </Button>
        
        {/* Add Customer Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Pelanggan Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nama</Label>
                <Input value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Nomor Telepon</Label>
                <Input value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
              </div>
              <Button onClick={handleAddCustomer} className="w-full bg-orange-500 hover:bg-orange-600">
                Simpan Pelanggan
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Customer Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Detail Pelanggan</DialogTitle>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-500">Nama</p>
                    <p className="font-semibold text-lg">{selectedCustomer.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Nomor Telepon</p>
                    <p className="font-semibold text-lg">{selectedCustomer.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Poin</p>
                    <p className="font-semibold text-lg text-orange-600">{selectedCustomer.points}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Transaksi</p>
                    <p className="font-semibold text-lg">{customerTransactions.length}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Riwayat Transaksi</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>ID Transaksi</TableHead>
                          <TableHead>Metode</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerTransactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-4 text-slate-500">Belum ada transaksi</TableCell>
                          </TableRow>
                        ) : (
                          customerTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                            <TableRow key={t.id}>
                              <TableCell>{format(new Date(t.date), 'dd MMM yyyy HH:mm', { locale: id })}</TableCell>
                              <TableCell>#{t.id}</TableCell>
                              <TableCell>{t.paymentMethod}</TableCell>
                              <TableCell className="text-right font-medium">Rp {t.total.toLocaleString('id-ID')}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Nomor Telepon</TableHead>
                <TableHead>Poin</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.points}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleViewCustomer(customer)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Lihat
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
