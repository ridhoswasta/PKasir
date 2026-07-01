import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit, Percent, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { logActivity } from '../services/activity';

function formatDate(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTimeLocal(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DiscountsModule() {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState<any>(null);
  const [current, setCurrent] = useState({
    id: '', name: '', type: 'percentage', value: 0,
    startDate: '', endDate: '',
    productIds: [] as string[], categoryFilter: [] as string[],
    isActive: true, priority: 0, description: '',
  });

  const fetchDiscounts = () => {
    invoke<any[]>('get_discounts').then(setDiscounts).catch(() => {});
  };

  useEffect(() => {
    fetchDiscounts();
    invoke<any[]>('get_products').then(setProducts).catch(() => {});
    invoke<any>('get_settings').then(setSettings).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!current.name.trim()) { toast.error('Nama diskon wajib diisi'); return; }
    if (!current.startDate || !current.endDate) { toast.error('Tanggal mulai dan selesai wajib diisi'); return; }
    if (current.value <= 0) { toast.error('Nilai diskon harus lebih dari 0'); return; }
    try {
      const payload = {
        name: current.name.trim(),
        type: current.type,
        value: current.value,
        startDate: new Date(current.startDate).toISOString(),
        endDate: new Date(current.endDate).toISOString(),
        productIds: current.productIds.length > 0 ? current.productIds : null,
        categoryFilter: current.categoryFilter.length > 0 ? current.categoryFilter : null,
        isActive: current.isActive ? 1 : 0,
        priority: current.priority,
        description: current.description || null,
      };
      if (isEditMode) {
        await invoke('update_discount', { id: current.id, discount: payload });
        logActivity('Edit Diskon', current.name, `Tipe: ${current.type}, Nilai: ${current.value}`);
        toast.success('Diskon berhasil diperbarui');
      } else {
        await invoke('create_discount', { discount: payload });
        logActivity('Tambah Diskon', current.name, `Tipe: ${current.type}, Nilai: ${current.value}`);
        toast.success('Diskon berhasil ditambahkan');
      }
      setIsDialogOpen(false);
      fetchDiscounts();
    } catch (e: any) {
      toast.error('Gagal menyimpan: ' + (e?.message || e));
    }
  };

  const handleDelete = async () => {
    if (!discountToDelete) return;
    try {
      await invoke('delete_discount', { id: discountToDelete.id });
      logActivity('Hapus Diskon', discountToDelete.name);
      toast.success('Diskon berhasil dihapus');
      setDiscountToDelete(null);
      fetchDiscounts();
    } catch (e: any) {
      toast.error('Gagal menghapus: ' + (e?.message || e));
    }
  };

  const openAddDialog = () => {
    const now = new Date();
    const later = new Date(now.getTime() + 7*24*60*60*1000);
    setCurrent({
      id: '', name: '', type: 'percentage', value: 10,
      startDate: formatDateTimeLocal(now.toISOString()),
      endDate: formatDateTimeLocal(later.toISOString()),
      productIds: [], categoryFilter: [],
      isActive: true, priority: 0, description: '',
    });
    setIsEditMode(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (d: any) => {
    setCurrent({
      id: d.id, name: d.name, type: d.type, value: d.value,
      startDate: formatDateTimeLocal(d.startDate),
      endDate: formatDateTimeLocal(d.endDate),
      productIds: Array.isArray(d.productIds) ? d.productIds : [],
      categoryFilter: Array.isArray(d.categoryFilter) ? d.categoryFilter : [],
      isActive: !!d.isActive, priority: d.priority || 0, description: d.description || '',
    });
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const toggleProduct = (id: string) => {
    setCurrent(prev => ({
      ...prev,
      productIds: prev.productIds.includes(id)
        ? prev.productIds.filter(p => p !== id)
        : [...prev.productIds, id],
    }));
  };

  const toggleCategory = (cat: string) => {
    setCurrent(prev => ({
      ...prev,
      categoryFilter: prev.categoryFilter.includes(cat)
        ? prev.categoryFilter.filter(c => c !== cat)
        : [...prev.categoryFilter, cat],
    }));
  };

  const isActiveNow = (d: any) => {
    if (!d.isActive) return false;
    const now = new Date().getTime();
    return now >= new Date(d.startDate).getTime() && now <= new Date(d.endDate).getTime();
  };

  const typeLabel = (t: string) => t === 'percentage' ? 'Persentase' : 'Nominal';

  return (
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto h-full">
      <PageHeader
        title="Diskon & Promo"
        description="Kelola event diskon berdasarkan jadwal dan target produk"
        icon={Percent}
        actions={
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Diskon
          </Button>
        }
      />

      <Card className="rounded-2xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Nilai</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      icon={Percent}
                      title="Belum ada diskon"
                      description="Klik Tambah Diskon untuk membuat event diskon pertama Anda."
                    />
                  </TableCell>
                </TableRow>
              )}
              {discounts.map((d) => (
                <TableRow key={d.id} className={!d.isActive ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-brand" />
                      {d.name}
                    </div>
                    {d.description && <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {typeLabel(d.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {d.type === 'percentage' ? `${d.value}%` : `Rp ${(d.value || 0).toLocaleString('id-ID')}`}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{formatDate(d.startDate)}</div>
                    <div className="text-muted-foreground">s/d {formatDate(d.endDate)}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {Array.isArray(d.productIds) && d.productIds.length > 0
                      ? `${d.productIds.length} produk`
                      : Array.isArray(d.categoryFilter) && d.categoryFilter.length > 0
                        ? `${d.categoryFilter.length} kategori`
                        : 'Semua produk'}
                  </TableCell>
                  <TableCell>
                    {isActiveNow(d) ? (
                      <Badge className="bg-success/12 text-success text-xs">Aktif</Badge>
                    ) : d.isActive ? (
                      <Badge variant="secondary" className="text-xs">Terjadwal</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground text-xs">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" aria-label={`Edit diskon ${d.name}`} onClick={() => openEditDialog(d)}>
                        <Edit className="w-4 h-4 text-info" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Hapus diskon ${d.name}`} onClick={() => setDiscountToDelete(d)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Diskon' : 'Tambah Diskon Baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label>Nama Diskon *</Label>
              <Input
                value={current.name}
                onChange={e => setCurrent({ ...current, name: e.target.value })}
                placeholder="Contoh: Promo Ramadan, Diskon Akhir Tahun"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipe Diskon</Label>
              <Select value={current.type} onValueChange={v => setCurrent({ ...current, type: v ?? '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Persentase (%)</SelectItem>
                  <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{current.type === 'percentage' ? 'Persentase (%)' : 'Nominal (Rp)'}</Label>
              <Input
                type="number"
                min={0}
                value={current.value}
                onChange={e => setCurrent({ ...current, value: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Mulai *</Label>
              <Input
                type="datetime-local"
                value={current.startDate}
                onChange={e => setCurrent({ ...current, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Selesai *</Label>
              <Input
                type="datetime-local"
                value={current.endDate}
                onChange={e => setCurrent({ ...current, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Prioritas (0-99)</Label>
              <Input
                type="number"
                min={0}
                max={99}
                value={current.priority}
                onChange={e => setCurrent({ ...current, priority: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">Semakin tinggi, semakin diutamakan</p>
            </div>
            <div className="space-y-2 flex items-end pb-1">
              <div className="flex items-center space-x-3">
                <Switch
                  id="discount-active"
                  aria-label="Aktif"
                  checked={current.isActive}
                  onCheckedChange={v => setCurrent({ ...current, isActive: v })}
                />
                <Label htmlFor="discount-active">Aktif</Label>
              </div>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Deskripsi</Label>
              <Input
                value={current.description}
                onChange={e => setCurrent({ ...current, description: e.target.value })}
                placeholder="Deskripsi tambahan (opsional)"
              />
            </div>

            {/* Product selector */}
            <div className="space-y-3 col-span-2 border rounded-lg p-4">
              <Label className="text-base">Produk yang Didiskon</Label>
              <p className="text-sm text-muted-foreground">
                Pilih produk tertentu, atau kosongkan untuk semua produk
              </p>
              {current.productIds.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{current.productIds.length} produk dipilih</span>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCurrent({ ...current, productIds: [] })}>
                    Hapus semua
                  </Button>
                </div>
              )}
              <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                {products.map((p: any) => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={current.productIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      className="rounded"
                    />
                    <span>{p.name}</span>
                    <span className="text-muted-foreground text-xs ml-auto">{p.category}</span>
                  </label>
                ))}
                {products.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">Belum ada produk</p>
                )}
              </div>
            </div>

            {/* Category filter */}
            <div className="space-y-3 col-span-2 border rounded-lg p-4">
              <Label className="text-base">Filter Kategori</Label>
              <p className="text-sm text-muted-foreground">
                Diskon hanya berlaku untuk kategori tertentu (kosongkan = semua)
              </p>
              {current.categoryFilter.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{current.categoryFilter.length} kategori dipilih</span>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCurrent({ ...current, categoryFilter: [] })}>
                    Hapus semua
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {(settings.productCategories || []).map((cat: string) => (
                  <Badge
                    key={cat}
                    variant={current.categoryFilter.includes(cat) ? 'default' : 'outline'}
                    className={`cursor-pointer ${current.categoryFilter.includes(cat) ? 'bg-brand text-brand-foreground hover:bg-brand/90' : 'hover:bg-muted'}`}
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
                {(settings.productCategories || []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Belum ada kategori di pengaturan</p>
                )}
              </div>
            </div>

            <Button onClick={handleSave} className="w-full col-span-2 mt-2">
              <Percent className="w-4 h-4 mr-2" />
              {isEditMode ? 'Simpan Perubahan' : 'Simpan Diskon'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!discountToDelete}
        onOpenChange={(open) => !open && setDiscountToDelete(null)}
        variant="destructive"
        title="Hapus Diskon"
        description={
          <>
            Apakah Anda yakin ingin menghapus diskon <strong>{discountToDelete?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
          </>
        }
        confirmLabel="Hapus"
        onConfirm={handleDelete}
      />
    </div>
  );
}
