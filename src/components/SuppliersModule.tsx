import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Truck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { logActivity } from '../services/activity';
import type { Supplier } from '../types';

type SupplierForm = {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  note: string;
};

const emptyForm: SupplierForm = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  note: '',
};

export function SuppliersModule() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);

  const fetchSuppliers = () => {
    invoke<Supplier[]>('get_suppliers').then(setSuppliers).catch(() => {});
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setIsAddOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setActiveSupplier(s);
    setForm({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      note: s.note || '',
    });
    setIsEditOpen(true);
  };

  const openDelete = (s: Supplier) => {
    setActiveSupplier(s);
    setIsDeleteOpen(true);
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    contactPerson: form.contactPerson.trim() || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    address: form.address.trim() || undefined,
    note: form.note.trim() || undefined,
  });

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error('Nama pemasok wajib diisi');
      return;
    }
    try {
      await invoke('create_supplier', { supplier: buildPayload() });
      logActivity('Tambah Pemasok', form.name.trim());
      toast.success('Pemasok berhasil ditambahkan');
      setIsAddOpen(false);
      fetchSuppliers();
    } catch (e: any) {
      toast.error(typeof e === 'string' ? e : (e?.message || 'Gagal menambahkan pemasok'));
    }
  };

  const handleEdit = async () => {
    if (!activeSupplier) return;
    if (!form.name.trim()) {
      toast.error('Nama pemasok wajib diisi');
      return;
    }
    try {
      await invoke('update_supplier', { id: activeSupplier.id, supplier: buildPayload() });
      logActivity('Edit Pemasok', form.name.trim());
      toast.success('Pemasok berhasil diperbarui');
      setIsEditOpen(false);
      fetchSuppliers();
    } catch (e: any) {
      toast.error(typeof e === 'string' ? e : (e?.message || 'Gagal memperbarui pemasok'));
    }
  };

  const handleDelete = async () => {
    if (!activeSupplier) return;
    try {
      await invoke('delete_supplier', { id: activeSupplier.id });
      logActivity('Hapus Pemasok', activeSupplier.name);
      toast.success('Pemasok dihapus');
      setIsDeleteOpen(false);
      setActiveSupplier(null);
      fetchSuppliers();
    } catch {
      toast.error('Gagal menghapus pemasok');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto h-full">
      <PageHeader
        title="Pemasok"
        description="Kelola data pemasok untuk pembelian dan stok."
        icon={Truck}
        actions={
          <Button onClick={openAdd} className="bg-brand text-brand-foreground hover:bg-brand/90">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Pemasok
          </Button>
        }
      />

      <Card className="rounded-2xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right w-32">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      icon={Truck}
                      title="Belum ada pemasok"
                      description="Tambahkan pemasok pertama untuk mulai mengelola pembelian dan stok."
                      action={
                        <Button onClick={openAdd} className="bg-brand text-brand-foreground hover:bg-brand/90">
                          <Plus className="w-4 h-4 mr-2" />
                          Tambah Pemasok
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.contactPerson || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell>{s.phone || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell>{s.email || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                          <Edit className="w-4 h-4 text-info" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDelete(s)} aria-label={`Hapus ${s.name}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
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

      {/* Add Supplier Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Pemasok Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nama Kontak</Label>
              <Input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telepon</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Alamat</Label>
              <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
            <Button onClick={handleAdd} className="bg-brand text-brand-foreground hover:bg-brand/90">
              Simpan Pemasok
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pemasok</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nama Kontak</Label>
              <Input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telepon</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Alamat</Label>
              <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
            <Button onClick={handleEdit} className="bg-brand text-brand-foreground hover:bg-brand/90">
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Pemasok"
        description={
          <>
            Yakin ingin menghapus pemasok <b>{activeSupplier?.name}</b>?
          </>
        }
        variant="destructive"
        confirmLabel="Hapus"
        onConfirm={handleDelete}
      />
    </div>
  );
}
