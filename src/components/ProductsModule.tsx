import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Upload, Trash2, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { logActivity } from '../services/activity';

export function ProductsModule() {
  const [products, setProducts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [currentProduct, setCurrentProduct] = useState({ 
    id: '', name: '', category: '', price: 0, costPrice: 0, stock: 0, description: '', image: '', unit: '', variants: [] as any[]
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = () => {
    invoke('get_products').then(setProducts).catch(() => {});
  };

  useEffect(() => {
    fetchProducts();
    invoke('get_settings').then(setSettings).catch(() => {});
  }, []);

  const handleSaveProduct = async () => {
    if (!currentProduct.unit) {
      toast.error('Satuan wajib dipilih');
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
      setCurrentProduct({ id: '', name: '', category: '', price: 0, costPrice: 0, stock: 0, description: '', image: '', unit: '', variants: [] });
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
    setCurrentProduct({ id: '', name: '', category: '', price: 0, costPrice: 0, stock: 0, description: '', image: '', unit: '', variants: [] });
    setIsEditMode(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: any) => {
    setCurrentProduct({ ...product, variants: product.variants || [] });
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Daftar Produk</h2>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={openAddDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Tambah Produk
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Nama Produk</Label>
                <Input value={currentProduct.name} onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={currentProduct.category} onValueChange={(val) => setCurrentProduct({...currentProduct, category: val})}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                  <SelectContent>
                    {settings.productCategories?.map((cat: string) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Harga Pokok (Modal)</Label>
                <Input type="number" value={currentProduct.costPrice} onChange={e => setCurrentProduct({...currentProduct, costPrice: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>Harga Jual</Label>
                <Input type="number" value={currentProduct.price} onChange={e => setCurrentProduct({...currentProduct, price: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>Stok Awal</Label>
                <Input type="number" value={currentProduct.stock} onChange={e => setCurrentProduct({...currentProduct, stock: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>Satuan</Label>
                <Select value={currentProduct.unit} onValueChange={(val) => setCurrentProduct({...currentProduct, unit: val})}>
                  <SelectTrigger><SelectValue placeholder="Pilih Satuan" /></SelectTrigger>
                  <SelectContent>
                    {settings.productUnits?.map((unit: string) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 col-span-2 border p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Varian Produk</Label>
                    <p className="text-sm text-slate-500">Tambahkan varian seperti ukuran, rasa, suhu, dll.</p>
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
                          onClick={() => {
                            const updated = currentProduct.variants.filter((__: any, i: number) => i !== idx);
                            setCurrentProduct(prev => ({ ...prev, variants: updated }));
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500">Tambahan harga = selisih dari harga dasar. Isi 0 jika tidak ada tambahan.</p>
                  </div>
                )}
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Foto Produk</Label>
                <div className="flex gap-2">
                  <Input value={currentProduct.image} onChange={e => setCurrentProduct({...currentProduct, image: e.target.value})} placeholder="URL Foto atau Upload..." className="flex-1" />
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </div>
                {currentProduct.image && (
                  <img src={currentProduct.image} alt="Preview" className="h-20 w-20 object-cover rounded mt-2 border" />
                )}
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Deskripsi Produk</Label>
                <Input value={currentProduct.description} onChange={e => setCurrentProduct({...currentProduct, description: e.target.value})} />
              </div>
              <Button onClick={handleSaveProduct} className="w-full bg-orange-500 hover:bg-orange-600 col-span-2 mt-4">
                {isEditMode ? 'Simpan Perubahan' : 'Simpan Produk'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Foto</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Harga Pokok</TableHead>
                <TableHead>Harga Jual</TableHead>
                <TableHead>Satuan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400">No Img</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {product.name}
                    {product.variants && product.variants.length > 0 && (
                      <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Varian</span>
                    )}
                    <p className="text-xs text-slate-500 font-normal">{product.description}</p>
                  </TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>Rp {(product.costPrice || 0).toLocaleString('id-ID')}</TableCell>
                  <TableCell>Rp {(product.price || 0).toLocaleString('id-ID')}</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                        <Edit className="w-4 h-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setProductToDelete(product)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Produk</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Apakah Anda yakin ingin menghapus produk <strong>{productToDelete?.name}</strong>?</p>
            <p className="text-sm text-slate-500 mt-2">Tindakan ini tidak dapat dibatalkan.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductToDelete(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDeleteProduct}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
