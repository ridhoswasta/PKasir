import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { logActivity } from '../services/activity';

type Customer = { id: string; name: string; phone: string; points: number };

export function CustomersModule() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', points: 0 });

  const fetchCustomers = () => {
    invoke('get_customers').then(setCustomers).catch(() => {});
  };

  const fetchTransactions = () => {
    invoke('get_transactions').then(setTransactions).catch(() => {});
  };

  useEffect(() => {
    fetchCustomers();
    fetchTransactions();
  }, []);

  const openAdd = () => {
    setForm({ name: '', phone: '', points: 0 });
    setIsAddOpen(true);
  };

  const openView = (c: Customer) => {
    setActiveCustomer(c);
    setIsViewOpen(true);
  };

  const openEdit = (c: Customer) => {
    setActiveCustomer(c);
    setForm({ name: c.name, phone: c.phone || '', points: c.points || 0 });
    setIsEditOpen(true);
  };

  const openDelete = (c: Customer) => {
    setActiveCustomer(c);
    setIsDeleteOpen(true);
  };

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error('Nama wajib diisi');
      return;
    }
    try {
      await invoke('create_customer', { input: { name: form.name.trim(), phone: form.phone.trim() } });
      logActivity('Tambah Pelanggan', form.name.trim());
      toast.success('Pelanggan berhasil ditambahkan');
      setIsAddOpen(false);
      fetchCustomers();
    } catch (e: any) {
      toast.error(typeof e === 'string' ? e : (e?.message || 'Gagal menambahkan pelanggan'));
    }
  };

  const handleEdit = async () => {
    if (!activeCustomer) return;
    if (!form.name.trim()) {
      toast.error('Nama wajib diisi');
      return;
    }
    try {
      await invoke('update_customer', {
        id: activeCustomer.id,
        input: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          points: Number(form.points) || 0,
        },
      });
      logActivity('Edit Pelanggan', form.name.trim());
      toast.success('Pelanggan berhasil diperbarui');
      setIsEditOpen(false);
      fetchCustomers();
      fetchTransactions();
    } catch (e: any) {
      toast.error(typeof e === 'string' ? e : (e?.message || 'Gagal memperbarui pelanggan'));
    }
  };

  const handleDelete = async () => {
    if (!activeCustomer) return;
    try {
      await invoke('delete_customer', { id: activeCustomer.id });
      logActivity('Hapus Pelanggan', activeCustomer.name);
      toast.success('Pelanggan dihapus');
      setIsDeleteOpen(false);
      setActiveCustomer(null);
      fetchCustomers();
    } catch {
      toast.error('Gagal menghapus pelanggan');
    }
  };

  const customerTransactions = activeCustomer
    ? transactions.filter(t => t.customer === activeCustomer.name)
    : [];

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Pelanggan</h2>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Tambah Pelanggan
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Nomor Telepon</TableHead>
                <TableHead>Poin</TableHead>
                <TableHead className="text-right w-64">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                    Belum ada pelanggan
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone || <span className="text-slate-400">-</span>}</TableCell>
                    <TableCell>{c.points || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openView(c)}>
                          <Eye className="w-4 h-4 mr-1" /> Lihat
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                          <Pencil className="w-4 h-4 mr-1 text-blue-600" /> Edit
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDelete(c)} title="Hapus pelanggan">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Customer Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Pelanggan Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nomor Telepon</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
            <Button onClick={handleAdd} className="bg-orange-500 hover:bg-orange-600">
              Simpan Pelanggan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pelanggan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nomor Telepon</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Poin</Label>
              <Input
                type="number"
                value={form.points}
                onChange={e => setForm({ ...form, points: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
            <Button onClick={handleEdit} className="bg-orange-500 hover:bg-orange-600">
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Pelanggan</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            Yakin ingin menghapus pelanggan <b>{activeCustomer?.name}</b>? Riwayat transaksinya tidak ikut terhapus.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Customer Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detail Pelanggan</DialogTitle>
          </DialogHeader>
          {activeCustomer && (
            <div className="space-y-5 py-2 overflow-y-auto flex-1 -mx-6 px-6">
              <div className="grid grid-cols-2 gap-4 bg-muted/50 border border-border p-4 rounded-lg">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Nama</p>
                  <p className="font-semibold text-base truncate text-foreground">{activeCustomer.name}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Nomor Telepon</p>
                  <p className="font-semibold text-base truncate text-foreground">{activeCustomer.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Poin</p>
                  <p className="font-semibold text-base text-orange-600 dark:text-orange-400">{activeCustomer.points || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Transaksi</p>
                  <p className="font-semibold text-base text-foreground">{customerTransactions.length}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-2 text-foreground">Riwayat Transaksi</h3>
                {customerTransactions.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg">
                    Belum ada transaksi
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerTransactions
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(t => (
                        <div key={t.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {format(new Date(t.date), 'dd MMM yyyy, HH:mm', { locale: id })}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              #{t.id} · {t.paymentMethod}
                            </p>
                          </div>
                          <p className="font-semibold text-sm text-foreground whitespace-nowrap shrink-0">
                            Rp {t.total.toLocaleString('id-ID')}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Tutup</Button>
            {activeCustomer && (
              <Button onClick={() => { setIsViewOpen(false); openEdit(activeCustomer); }} className="bg-orange-500 hover:bg-orange-600 text-white">
                <Pencil className="w-4 h-4 mr-2" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
