import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Upload, Trash2, Edit, Coffee } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CalendarClock, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '../services/activity';
import { RecipeEditor } from './RecipeEditor';
import { getAllProductCosts } from '../services/ingredientService';

export function ProductsModule() {
  const [products, setProducts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  // Recipe costing: map of productId → ingredient cost
  const [recipeCosts, setRecipeCosts] = useState<Record<string, number>>({});
  const blankProduct = {
    id: '', name: '', category: '', price: 0, costPrice: 0, stock: 0, description: '', image: '', unit: '',
    variants: [] as any[], trackBatches: 0, supplierId: '', reorderPoint: 0,
  };
  const [currentProduct, setCurrentProduct] = useState(blankProduct);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = () => {
    invoke<any[]>('get_products').then(setProducts).catch(() => {});
    getAllProductCosts().then(setRecipeCosts).catch(() => {});
  };

  useEffect(() => {
    fetchProducts();
    invoke('get_settings').then(setSettings).catch(() => {});
    invoke<any[]>('get_suppliers').then(setSuppliers).catch(() => {});
  }, []);

  const handleSaveProduct = async () => {
    if (!currentProduct.unit) {
      toast.error('Satuan wajib dipilih');
      return;
    }
    // Issue #13: prevent negative prices
    if (currentProduct.price < 0 || currentProduct.costPrice < 0) {
      toast.error('Harga tidak boleh negatif');
      return;
    }
    try {
      const cleanVariants = (currentProduct.variants || []).filter((v: any) => v.name?.trim());
      const productData = { ...currentProduct, variants: cleanVariants };

      if (isEditMode) {
        await invoke('update_product', { id: currentProduct.id, product: productData });
        logActivity('Edit Produk', currentProduct.name, `Harga: Rp ${currentProduct.price?.toLocaleString('id-ID')}`);
      } else {
        await invoke('create_product', { product: productData });
        logActivity('Tambah Produk', currentProduct.name, `Kategori: ${currentProduct.category}, Harga: Rp ${currentProduct.price?.toLocaleString('id-ID')}`);
      }

      toast.success(isEditMode ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan');
      setIsDialogOpen(false);
      setCurrentProduct(blankProduct);
      fetchProducts();
    } catch (error) {
      toast.error('Gagal menyimpan produk');
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await invoke('delete_product', { id: productToDelete.id });
      logActivity('Hapus Produk', productToDelete.name);
      toast.success('Produk berhasil dihapus');
      setProductToDelete(null);
      fetchProducts();
    } catch (error) {
      toast.error('Gagal menghapus produk');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentProduct(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddDialog = () => {
    setCurrentProduct(blankProduct);
    setIsEditMode(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: any) => {
    setCurrentProduct({ ...blankProduct, ...product, variants: product.variants || [] });
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto h-full">
      <PageHeader
        title="Produk"
        description="Kelola daftar produk, harga, dan varian"
        icon={Coffee}
        actions={
          <Button className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Produk
          </Button>
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="info" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="shrink-0 mx-0">
              <TabsTrigger value="info">
                <Coffee className="w-3.5 h-3.5 mr-1.5" />
                Informasi
              </TabsTrigger>
              <TabsTrigger value="recipe">
                <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                Resep &amp; Biaya
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Informasi ── */}
            <TabsContent value="info" className="overflow-y-auto flex-1 min-h-0 mt-0 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
                <div className="space-y-2">
                  <Label>Nama Produk</Label>
                  <Input value={currentProduct.name} onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select value={currentProduct.category} onValueChange={(val) => setCurrentProduct({...currentProduct, category: val ?? ''})}>
                    <SelectTrigger><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                    <SelectContent>
                      {/* Issue #16: show helper when no categories configured */}
                      {(!settings.productCategories?.length) ? (
                        <div className="px-2 py-2 text-xs text-muted-foreground italic">
                          Tambah kategori di Pengaturan → Produk
                        </div>
                      ) : (
                        settings.productCategories.map((cat: string) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Harga Pokok Tambahan (Modal)</Label>
                  {/* Issue #13: min=0 prevents negative price entry */}
                  <Input type="number" min="0" value={currentProduct.costPrice} onChange={e => setCurrentProduct({...currentProduct, costPrice: Number(e.target.value)})} />
                  {(recipeCosts[currentProduct.id] ?? 0) > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      + Biaya bahan resep Rp {(recipeCosts[currentProduct.id] ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })} ={' '}
                      <span className="font-medium text-foreground">
                        HPP total Rp {((currentProduct.costPrice || 0) + (recipeCosts[currentProduct.id] ?? 0)).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Biaya di luar bahan baku (kemasan, dll). Biaya bahan dari resep ditambahkan otomatis.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Harga Jual</Label>
                  <Input type="number" min="0" value={currentProduct.price} onChange={e => setCurrentProduct({...currentProduct, price: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Stok Awal</Label>
                  <Input type="number" value={currentProduct.stock} onChange={e => setCurrentProduct({...currentProduct, stock: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Satuan</Label>
                  <Select value={currentProduct.unit} onValueChange={(val) => setCurrentProduct({...currentProduct, unit: val ?? ''})}>
                    <SelectTrigger><SelectValue placeholder="Pilih Satuan" /></SelectTrigger>
                    <SelectContent>
                      {settings.productUnits?.map((unit: string) => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3 sm:col-span-2 border border-border p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Varian Produk</Label>
                      <p className="text-sm text-muted-foreground">Tambahkan varian seperti ukuran, rasa, suhu, dll.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentProduct(prev => ({
                        ...prev,
                        variants: [...(prev.variants || []), { name: '', price: 0 }]
                      }))}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Varian
                    </Button>
                  </div>
                  {(currentProduct.variants || []).length > 0 && (
                    <div className="space-y-2">
                      {(currentProduct.variants || []).map((_: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            placeholder="Nama varian (mis. Panas, Large, Pedas)"
                            value={currentProduct.variants[idx]?.name || ''}
                            onChange={(e) => {
                              const updated = [...currentProduct.variants];
                              updated[idx] = { ...updated[idx], name: e.target.value };
                              setCurrentProduct(prev => ({ ...prev, variants: updated }));
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="Tambahan harga"
                            value={currentProduct.variants[idx]?.price || 0}
                            onChange={(e) => {
                              const updated = [...currentProduct.variants];
                              updated[idx] = { ...updated[idx], price: Number(e.target.value) || 0 };
                              setCurrentProduct(prev => ({ ...prev, variants: updated }));
                            }}
                            className="w-32"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            aria-label="Hapus varian"
                            onClick={() => {
                              const updated = currentProduct.variants.filter((__: any, i: number) => i !== idx);
                              setCurrentProduct(prev => ({ ...prev, variants: updated }));
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">Tambahan harga = selisih dari harga dasar. Isi 0 jika tidak ada tambahan.</p>
                    </div>
                  )}
                </div>
                <div className="space-y-4 sm:col-span-2 border border-border p-4 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <CalendarClock className="w-4 h-4 text-info mt-0.5 shrink-0" />
                      <div>
                        <Label className="text-base">Lacak Batch &amp; Kadaluarsa</Label>
                        <p className="text-sm text-muted-foreground">Aktifkan untuk produk dengan tanggal kadaluarsa (mis. makanan, obat). Stok dipotong FEFO — batch kadaluarsa terdekat lebih dulu. Tidak memengaruhi produk lain.</p>
                      </div>
                    </div>
                    <Switch
                      aria-label="Lacak Batch & Kadaluarsa"
                      checked={!!currentProduct.trackBatches}
                      onCheckedChange={(c: boolean) => setCurrentProduct((p: any) => ({ ...p, trackBatches: c ? 1 : 0 }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2 min-w-0">
                      <Label className="leading-tight">Pemasok Utama (opsional)</Label>
                      <Select
                        value={currentProduct.supplierId || '__none__'}
                        onValueChange={(val) => setCurrentProduct((p: any) => ({ ...p, supplierId: val === '__none__' ? '' : (val ?? '') }))}
                      >
                        <SelectTrigger className="min-w-0">
                          <SelectValue placeholder="Pilih pemasok">
                            {(value: string) => (!value || value === '__none__' ? '— Tanpa pemasok —' : (suppliers.find((s: any) => s.id === value)?.name ?? '— Tanpa pemasok —'))}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Tanpa pemasok —</SelectItem>
                          {suppliers.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label className="leading-tight">Titik Pesan Ulang (opsional)</Label>
                      <Input type="number" min="0" value={currentProduct.reorderPoint || 0} onChange={e => setCurrentProduct((p: any) => ({ ...p, reorderPoint: Number(e.target.value) }))} />
                      <p className="text-xs text-muted-foreground">Inventaris menandai "Perlu Pesan Ulang" saat stok ≤ angka ini.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Foto Produk</Label>
                  <div className="flex gap-2 min-w-0">
                    <Input value={currentProduct.image} onChange={e => setCurrentProduct({...currentProduct, image: e.target.value})} placeholder="URL Foto atau pilih gambar..." className="flex-1 min-w-0" />
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" />
                      Pilih Gambar
                    </Button>
                  </div>
                  {currentProduct.image && (
                    <img src={currentProduct.image} alt="Preview" className="h-20 w-20 object-cover rounded mt-2 border border-border" />
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Deskripsi Produk</Label>
                  <Input value={currentProduct.description} onChange={e => setCurrentProduct({...currentProduct, description: e.target.value})} />
                </div>
                <Button onClick={handleSaveProduct} className="w-full bg-brand text-brand-foreground hover:bg-brand/90 sm:col-span-2 mt-4">
                  {isEditMode ? 'Simpan Perubahan' : 'Simpan Produk'}
                </Button>
              </div>
            </TabsContent>

            {/* ── Tab: Resep & Biaya ── */}
            <TabsContent value="recipe" className="overflow-y-auto flex-1 min-h-0 mt-0 pt-4 px-1">
              <RecipeEditor
                productId={isEditMode && currentProduct.id ? currentProduct.id : undefined}
                price={currentProduct.price}
                additionalCost={currentProduct.costPrice || 0}
                isNewProduct={!isEditMode || !currentProduct.id}
                onSaved={fetchProducts}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Card className="rounded-2xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Foto</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Harga Pokok</TableHead>
                <TableHead>Biaya Bahan</TableHead>
                <TableHead>Harga Jual</TableHead>
                <TableHead>Satuan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState
                      icon={Coffee}
                      title="Belum ada produk"
                      description="Mulai dengan menambahkan produk pertama Anda."
                      action={
                        <Button className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={openAddDialog}>
                          <Plus className="w-4 h-4 mr-2" />
                          Tambah Produk
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => {
                  const ingredientCost = recipeCosts[product.id] ?? 0;
                  const hasRecipe = ingredientCost > 0;
                  return (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">No Img</div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {product.name}
                      {product.variants && product.variants.length > 0 && (
                        <span className="ml-2 text-xs bg-brand/10 text-brand px-2 py-0.5 rounded">Varian</span>
                      )}
                      {product.trackBatches ? (
                        <span className="ml-2 text-xs bg-info/10 text-info px-2 py-0.5 rounded">Batch</span>
                      ) : null}
                      {hasRecipe && (
                        <span className="ml-2 text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded inline-flex items-center gap-0.5">
                          <FlaskConical className="w-2.5 h-2.5" /> Resep
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground font-normal">{product.description}</p>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>
                      Rp {((product.costPrice || 0) + ingredientCost).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                      {hasRecipe && (product.costPrice || 0) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Rp {(product.costPrice || 0).toLocaleString('id-ID')} tambahan
                        </p>
                      )}
                    </TableCell>
                    <TableCell className={hasRecipe ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                      {hasRecipe
                        ? `Rp ${ingredientCost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
                        : '—'}
                    </TableCell>
                    <TableCell>Rp {(product.price || 0).toLocaleString('id-ID')}</TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" aria-label="Edit produk" onClick={() => openEditDialog(product)}>
                          <Edit className="w-4 h-4 text-info" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Hapus produk" onClick={() => setProductToDelete(product)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
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

      <ConfirmDialog
        open={!!productToDelete}
        onOpenChange={(open) => !open && setProductToDelete(null)}
        variant="destructive"
        title="Hapus Produk"
        description={
          <>
            Apakah Anda yakin ingin menghapus produk <strong>{productToDelete?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
          </>
        }
        confirmLabel="Hapus"
        onConfirm={handleDeleteProduct}
      />
    </div>
  );
}
