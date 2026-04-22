import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { logActivity } from '../services/activity';

export function InventoryModule() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustment, setAdjustment] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchProducts = () => {
    invoke('get_products').then((data: any) => setProducts(data)).catch(() => {});
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAdjustStock = async () => {
    if (!selectedProduct) return;
    try {
      await invoke('update_product', {
        id: selectedProduct.id,
        product: { ...selectedProduct, stock: selectedProduct.stock + adjustment }
      });
      logActivity('Update Stok', selectedProduct.name, `${adjustment >= 0 ? '+' : ''}${adjustment} → ${selectedProduct.stock + adjustment} ${selectedProduct.unit || ''}`);
      toast.success(`Stok berhasil disesuaikan untuk ${selectedProduct.name}`);
      setIsDialogOpen(false);
      setAdjustment(0);
      fetchProducts();
    } catch (error) {
      toast.error('Gagal menyesuaikan stok');
    }
  };

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Manajemen Inventaris</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stok Saat Ini</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Stok Saat Ini</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{product.stock} {product.unit}</TableCell>
                  <TableCell>
                    {product.stock <= 10 ? (
                      <Badge variant="destructive">Stok Menipis</Badge>
                    ) : (
                      <Badge className="bg-emerald-500">Tersedia</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => {
                      setSelectedProduct(product);
                      setIsDialogOpen(true);
                    }}>Sesuaikan Stok</Button>
                    <Dialog open={isDialogOpen && selectedProduct?.id === product.id} onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) setSelectedProduct(null);
                    }}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Sesuaikan Stok: {product.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Stok Saat Ini: {product.stock} {product.unit}</Label>
                            <div className="flex items-center gap-4">
                              <Button variant="outline" onClick={() => setAdjustment(a => a - 1)}>-</Button>
                              <Input 
                                type="number" 
                                value={adjustment} 
                                onChange={(e) => setAdjustment(Number(e.target.value))}
                                className="text-center"
                              />
                              <Button variant="outline" onClick={() => setAdjustment(a => a + 1)}>+</Button>
                            </div>
                            <p className="text-sm text-slate-500">
                              Stok Baru akan menjadi: {product.stock + adjustment} {product.unit}
                            </p>
                          </div>
                          <Button onClick={handleAdjustStock} className="w-full bg-orange-500 hover:bg-orange-600">
                            Konfirmasi Penyesuaian
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
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
