import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Pencil, Trash2, Key, Shield, ShieldCheck, Briefcase, ShoppingCart, Users } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '../services/activity';

type User = { id: string; username: string; role: string; displayName: string };

const ROLE_BADGE: Record<string, { label: string; className: string; icon: any }> = {
  admin: { label: 'Admin', className: 'bg-destructive/12 text-destructive', icon: ShieldCheck },
  manager: { label: 'Manager', className: 'bg-info/12 text-info', icon: Briefcase },
  cashier: { label: 'Kasir', className: 'bg-success/12 text-success', icon: ShoppingCart },
};

export function UserManagementModule() {
  const [users, setUsers] = useState<User[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [active, setActive] = useState<User | null>(null);
  const [form, setForm] = useState({ displayName: '', username: '', password: '', role: 'cashier' });
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = () => invoke<User[]>('get_users').then(setUsers).catch(() => {});
  useEffect(() => { fetchUsers(); }, []);

  const handleAdd = async () => {
    if (!form.displayName || !form.username || !form.password) { toast.error('Semua field wajib diisi'); return; }
    try {
      await invoke('create_user', { input: form });
      logActivity('Tambah User', form.username, `Role: ${form.role}, Nama: ${form.displayName}`);
      toast.success('Pengguna berhasil ditambahkan');
      setIsAddOpen(false);
      fetchUsers();
    } catch (e: any) { toast.error(e); }
  };

  const handleEdit = async () => {
    if (!active) return;
    try {
      await invoke('update_user', { id: active.id, input: { displayName: form.displayName, username: form.username, role: form.role } });
      logActivity('Edit User', form.username, `Role: ${form.role}`);
      toast.success('Pengguna berhasil diperbarui');
      setIsEditOpen(false);
      fetchUsers();
    } catch (e: any) { toast.error(e); }
  };

  const handleChangePassword = async () => {
    if (!active || !newPassword) { toast.error('Password wajib diisi'); return; }
    if (newPassword.length < 4) { toast.error('Password minimal 4 karakter'); return; }
    try {
      await invoke('update_user', { id: active.id, input: { password: newPassword } });
      logActivity('Ganti Password', active.username);
      toast.success('Password berhasil diubah');
      setIsPasswordOpen(false);
      setNewPassword('');
    } catch (e: any) { toast.error(e); }
  };

  const handleDelete = async () => {
    if (!active) return;
    try {
      await invoke('delete_user', { id: active.id });
      logActivity('Hapus User', active.username);
      toast.success('Pengguna dihapus');
      setIsDeleteOpen(false);
      fetchUsers();
    } catch (e: any) { toast.error(e); }
  };

  const openAdd = () => {
    setForm({ displayName: '', username: '', password: '000000', role: 'cashier' });
    setIsAddOpen(true);
  };

  const openEdit = (u: User) => {
    setActive(u);
    setForm({ displayName: u.displayName, username: u.username, password: '', role: u.role });
    setIsEditOpen(true);
  };

  const openPassword = (u: User) => {
    setActive(u);
    setNewPassword('');
    setIsPasswordOpen(true);
  };

  const openDelete = (u: User) => {
    setActive(u);
    setIsDeleteOpen(true);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto h-full">
      <PageHeader
        title="Manajemen Pengguna"
        icon={Shield}
        actions={
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Pengguna
          </Button>
        }
      />

      <Card className="rounded-2xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right w-72">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState
                      icon={Users}
                      title="Belum ada pengguna"
                      description="Tambahkan pengguna untuk mulai mengelola akses."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const rb = ROLE_BADGE[u.role] || ROLE_BADGE.cashier;
                  const Icon = rb.icon;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.displayName}</TableCell>
                      <TableCell className="text-muted-foreground">{u.username}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`gap-1 ${rb.className}`}>
                          <Icon className="w-3 h-3" /> {rb.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                            <Pencil className="w-3.5 h-3.5 mr-1 text-info" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openPassword(u)}>
                            <Key className="w-3.5 h-3.5 mr-1 text-warning" /> Password
                          </Button>
                          {u.role !== 'admin' && (
                            <Button variant="ghost" size="icon" aria-label={`Hapus ${u.displayName}`} onClick={() => openDelete(u)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          )}
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

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Pengguna Baru</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              <p className="text-xs text-muted-foreground">Default: 000000</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v ?? '' })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Kasir</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
            <Button onClick={handleAdd}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Pengguna</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                disabled={active?.role === 'admin'}
              />
            </div>
            {active?.role !== 'admin' && (
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v ?? '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Kasir</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
            <Button onClick={handleEdit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ubah Password — {active?.displayName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Password Baru</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Masukkan password baru"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordOpen(false)}>Batal</Button>
            <Button onClick={handleChangePassword}>Ubah Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        variant="destructive"
        title="Hapus Pengguna"
        description={<>Yakin ingin menghapus <b>{active?.displayName}</b> ({active?.username})?</>}
        confirmLabel="Hapus"
        onConfirm={handleDelete}
      />
    </div>
  );
}
