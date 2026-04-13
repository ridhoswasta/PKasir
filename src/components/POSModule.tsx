import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Coffee, ShoppingCart, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function POSModule() {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [selectedCustomer, setSelectedCustomer] = useState('Walk-In Customer');
  const [settings, setSettings] = useState<any>({ 
    taxRate: 10, serviceCharge: 5, paperWidth: '80mm', receiptHeader: '', receiptFooter: '', productCategories: [] 
  });

  const [isCashDialogOpen, setIsCashDialogOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState<number | ''>('');

  useEffect(() => {
    fetch('/api/products').then(res => res.json()).then(setProducts);
    fetch('/api/settings').then(res => res.json()).then(setSettings);
    fetch('/api/customers').then(res => res.json()).then(setCustomers);
  }, []);

  const categories = ['Semua', ...(settings.productCategories || [])];

  const filteredProducts = products.filter(p => 
    (selectedCategory === 'Semua' || p.category === selectedCategory) &&
    (p.name || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  const addToCart = (product: any, variant?: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.variantName === variant?.name);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id && item.variantName === variant?.name
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        price: product.price + (variant?.price || 0), 
        costPrice: product.costPrice || 0,
        variantName: variant?.name,
        quantity: 1 
      }];
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const newCart = [...prev];
      newCart[index].quantity += delta;
      if (newCart[index].quantity <= 0) {
        newCart.splice(index, 1);
      }
      return newCart;
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * (settings.taxRate / 100);
  const serviceCharge = subtotal * (settings.serviceCharge / 100);
  const total = subtotal + tax + serviceCharge;
  const change = typeof amountPaid === 'number' ? amountPaid - total : 0;

  const handleCheckout = async (paymentMethod: string, paidAmount?: number, changeAmount?: number) => {
    if (cart.length === 0) return;

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          subtotal,
          tax,
          serviceCharge,
          total,
          paymentMethod,
          amountPaid: paidAmount || total,
          change: changeAmount || 0,
          customer: selectedCustomer
        })
      });

      if (res.ok) {
        const transaction = await res.json();
        toast.success('Transaksi Berhasil!');
        setIsCashDialogOpen(false);
        setAmountPaid('');
        
        // Print receipt logic
        const receiptWindow = window.open('', '_blank');
        if (receiptWindow) {
          receiptWindow.document.write(`
            <html>
              <head>
                <title>Struk #${transaction.id}</title>
                <style>
                  body { font-family: monospace; padding: 20px; width: ${settings.paperWidth || '80mm'}; margin: 0 auto; }
                  .header { text-align: center; margin-bottom: 20px; white-space: pre-wrap; }
                  .logo { width: ${settings.logoWidth || 120}px; height: ${settings.logoHeight || 32}px; object-fit: contain; margin: 0 auto 10px auto; display: block; }
                  .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
                  .divider { border-top: 1px dashed #000; margin: 10px 0; }
                  .total { font-weight: bold; }
                  .footer { text-align: center; margin-top: 20px; white-space: pre-wrap; }
                </style>
              </head>
              <body>
                ${settings.logo ? `<img src="${settings.logo}" class="logo" alt="Logo" />` : ''}
                <div class="header">${(settings.receiptHeader || 'CAFE POS').replace(/\\n/g, '\n')}\n\nStruk #${transaction.id}\n${new Date(transaction.date || Date.now()).toLocaleString('id-ID')}</div>
                <div class="divider"></div>
                <div class="item"><span>Pelanggan:</span><span>${selectedCustomer}</span></div>
                <div class="divider"></div>
                ${cart.map(item => `
                  <div class="item">
                    <span>${item.quantity}x ${item.name} ${item.variantName ? `(${item.variantName})` : ''}</span>
                    <span>Rp ${((item.price || 0) * item.quantity).toLocaleString('id-ID')}</span>
                  </div>
                `).join('')}
                <div class="divider"></div>
                <div class="item"><span>Subtotal</span><span>Rp ${(subtotal || 0).toLocaleString('id-ID')}</span></div>
                <div class="item"><span>Pajak (${settings.taxRate}%)</span><span>Rp ${(tax || 0).toLocaleString('id-ID')}</span></div>
                <div class="item"><span>Layanan (${settings.serviceCharge}%)</span><span>Rp ${(serviceCharge || 0).toLocaleString('id-ID')}</span></div>
                <div class="divider"></div>
                <div class="item total"><span>Total</span><span>Rp ${(total || 0).toLocaleString('id-ID')}</span></div>
                <div class="item"><span>Pembayaran</span><span>${paymentMethod}</span></div>
                ${paymentMethod === 'Tunai' ? `
                  <div class="item"><span>Tunai</span><span>Rp ${(paidAmount || 0).toLocaleString('id-ID')}</span></div>
                  <div class="item"><span>Kembalian</span><span>Rp ${(changeAmount || 0).toLocaleString('id-ID')}</span></div>
                ` : ''}
                <div class="divider"></div>
                <div class="footer">${(settings.receiptFooter || 'Terima Kasih').replace(/\\n/g, '\n')}</div>
              </body>
            </html>
          `);
          receiptWindow.document.close();
          receiptWindow.print();
        }

        setCart([]);
        setSelectedCustomer('Walk-In Customer');
        fetch('/api/products').then(res => res.json()).then(setProducts);
      }
    } catch (error) {
      toast.error('Transaksi Gagal');
    }
  };

  return (
    <div className="flex h-full w-full bg-slate-50">
      {/* Products Section */}
      <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input 
              placeholder="Cari produk..." 
              className="pl-10 bg-white border-slate-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(cat => (
              <Badge 
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                className="cursor-pointer text-sm py-1 px-4 whitespace-nowrap"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-6">
            {filteredProducts.map(product => (
              <Card 
                key={product.id} 
                className="cursor-pointer hover:border-orange-500 transition-colors overflow-hidden group"
                onClick={() => (!product.variants || product.variants.length === 0) && addToCart(product)}
              >
                <div className="h-32 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Coffee className="w-12 h-12 text-slate-300 group-hover:text-orange-200 transition-colors" />
                  )}
                  {product.stock <= 10 && (
                    <Badge variant="destructive" className="absolute top-2 right-2">Stok Menipis</Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-800 truncate">{product.name}</h3>
                  <p className="text-orange-600 font-medium">Rp {(product.price || 0).toLocaleString('id-ID')}</p>
                  
                  {product.variants?.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {product.variants.map((v: any) => (
                        <Button 
                          key={v.name} 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 h-8 text-xs"
                          onClick={(e) => { e.stopPropagation(); addToCart(product, v); }}
                        >
                          {v.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart Section */}
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-xl z-10">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
            <ShoppingCart className="w-6 h-6" />
            Pesanan Saat Ini
          </h2>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Pilih Pelanggan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Walk-In Customer">Walk-In Customer</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <ShoppingCart className="w-16 h-16 opacity-20" />
              <p>Keranjang kosong</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item, index) => (
                <div key={index} className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-800 leading-tight">{item.name}</h4>
                    {item.variantName && <p className="text-xs text-slate-500">{item.variantName}</p>}
                    <p className="text-sm text-orange-600 font-medium">Rp {((item.price || 0) * item.quantity).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-100">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => updateQuantity(index, -1)}>
                      {item.quantity === 1 ? <Trash2 className="w-4 h-4 text-red-500" /> : <Minus className="w-4 h-4" />}
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => updateQuantity(index, 1)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>Rp {(subtotal || 0).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Pajak ({settings.taxRate}%)</span>
              <span>Rp {(tax || 0).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Layanan ({settings.serviceCharge}%)</span>
              <span>Rp {(serviceCharge || 0).toLocaleString('id-ID')}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-lg font-bold text-slate-800">
              <span>Total</span>
              <span>Rp {(total || 0).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <Button 
              className="flex flex-col items-center gap-1 h-16 bg-emerald-600 hover:bg-emerald-700" 
              disabled={cart.length === 0}
              onClick={() => setIsCashDialogOpen(true)}
            >
              <Banknote className="w-5 h-5" />
              <span className="text-xs">Tunai</span>
            </Button>
            <Button 
              className="flex flex-col items-center gap-1 h-16 bg-blue-600 hover:bg-blue-700"
              disabled={cart.length === 0}
              onClick={() => handleCheckout('QRIS')}
            >
              <QrCode className="w-5 h-5" />
              <span className="text-xs">QRIS</span>
            </Button>
            <Button 
              className="flex flex-col items-center gap-1 h-16 bg-indigo-600 hover:bg-indigo-700"
              disabled={cart.length === 0}
              onClick={() => handleCheckout('Kartu')}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-xs">Kartu</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Cash Payment Dialog */}
      <Dialog open={isCashDialogOpen} onOpenChange={setIsCashDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pembayaran Tunai</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex justify-between items-center text-lg">
              <span className="font-medium text-slate-500">Total Tagihan:</span>
              <span className="font-bold text-slate-800 text-2xl">Rp {(total || 0).toLocaleString('id-ID')}</span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Jumlah Bayar (Rp)</label>
              <Input 
                type="number" 
                className="text-2xl h-14"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value ? Number(e.target.value) : '')}
                autoFocus
              />
            </div>
            <div className="flex justify-between items-center text-lg">
              <span className="font-medium text-slate-500">Kembalian:</span>
              <span className={cn("font-bold text-2xl", change < 0 ? "text-red-500" : "text-emerald-600")}>
                Rp {(change || 0).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCashDialogOpen(false)}>Batal</Button>
            <Button 
              className="bg-orange-500 hover:bg-orange-600" 
              disabled={change < 0 || amountPaid === ''}
              onClick={() => handleCheckout('Tunai', Number(amountPaid), change)}
            >
              Selesaikan Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
