import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Coffee, ShoppingCart, User, Armchair, Printer, CheckCircle2, UtensilsCrossed, Monitor, StickyNote, UserPlus, ChevronDown, Phone, X, Calculator, PauseCircle, Clock, PlayCircle, BookOpen, Percent, Tag, Star } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { printThermal, buildReceiptSections, isVirtualPrinter, htmlPrintReceipt } from '../services/printer';
import { playAddToCart } from '../services/sound';
import { useAuth } from '../services/auth';
import type { ReceiptInput } from '../services/printer';
import { logActivity } from '../services/activity';
import { composeReceiptHeader, getShopName } from '../services/utils';
import { deductIngredientsForSale, getAllProductCosts } from '../services/ingredientService';
import { VirtualKeyboard } from './VirtualKeyboard';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { CalculatorDialog } from './CalculatorDialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { QRCodeDisplay } from './QRCodeDisplay';

export function POSModule() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  // Issue #18: raw search input (debounced into searchQuery below)
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [selectedCustomer, setSelectedCustomer] = useState('Walk-In Customer');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [settings, setSettings] = useState<any>({ 
    taxRate: 10, serviceCharge: 5, paperWidth: '80mm', receiptHeader: '', receiptFooter: '', productCategories: [] 
  });

  const [isCashDialogOpen, setIsCashDialogOpen] = useState(false);
  const [isQrisDialogOpen, setIsQrisDialogOpen] = useState(false);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  // Dynamic QRIS: the generated QRIS string for the current transaction
  const [dynamicQrisString, setDynamicQrisString] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [printingLast, setPrintingLast] = useState(false);
  const [printingKitchen, setPrintingKitchen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successOverlay, setSuccessOverlay] = useState<{ show: boolean; txId?: string; total?: number } | null>(null);
  const [focusedInput, setFocusedInput] = useState<'search' | 'amount' | null>(null);
  const [variantProduct, setVariantProduct] = useState<any>(null);
  const [noteEditingIndex, setNoteEditingIndex] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [heldOrders, setHeldOrders] = useState<any[]>([]);
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false);
  const [holdLabel, setHoldLabel] = useState('');
  const [isHeldListOpen, setIsHeldListOpen] = useState(false);
  const [savingHold, setSavingHold] = useState(false);
  const [isShowMenuOpen, setIsShowMenuOpen] = useState(false);
  const [activeDiscounts, setActiveDiscounts] = useState<any[]>([]);
  const [selectedDiscount, setSelectedDiscount] = useState<any>(null);
  // Issue #8: loading state for product fetch
  const [productsLoading, setProductsLoading] = useState(true);
  // Issue #2: pending confirm states replacing window.confirm()
  const [pendingResumeHeld, setPendingResumeHeld] = useState<any>(null);
  const [pendingDeleteHeld, setPendingDeleteHeld] = useState<any>(null);
  // Issue #18: debounce ref for search input
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayChannelRef = useRef<BroadcastChannel | null>(null);
  const displayStateRef = useRef<any>({});
  const [lastPaymentForDisplay, setLastPaymentForDisplay] = useState<{ txId: string; total: number } | null>(null);
  // Loyalty point redemption
  const [useRedemption, setUseRedemption] = useState(false);

  const refreshSettings = () =>
    invoke('get_settings').then(setSettings).catch(() => {});

  // Ingredient (recipe) cost per product. Effective HPP recorded on each sale
  // item = product.costPrice (additional cost) + this ingredient cost.
  const [recipeCosts, setRecipeCosts] = useState<Record<string, number>>({});

  const refreshHeldOrders = () => {
    invoke<any[]>('get_held_orders').then(setHeldOrders).catch(() => {});
  };

  useEffect(() => {
    // Issue #8: track loading state so skeleton is shown during fetch
    setProductsLoading(true);
    invoke<any[]>('get_products').then((data) => { setProducts(data); setProductsLoading(false); }).catch(() => setProductsLoading(false));
    getAllProductCosts().then(setRecipeCosts).catch(() => {});
    refreshSettings();
    invoke<any[]>('get_customers').then(setCustomers).catch(() => {});
    refreshHeldOrders();
    invoke<any[]>('get_active_discounts').then(setActiveDiscounts).catch(() => {});

    const onUpdate = () => refreshSettings();
    window.addEventListener('settings-updated', onUpdate);
    return () => window.removeEventListener('settings-updated', onUpdate);
  }, []);

  // Issue #19: keyboard shortcuts for common POS actions
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if focus is on an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable;

      // Ctrl+F or / → focus search
      if ((e.key === '/' || (e.ctrlKey && e.key === 'f')) && !isEditing) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      // F5 → open cash payment dialog
      if (e.key === 'F5' && !isEditing) {
        e.preventDefault();
        if (cart.length > 0 && !isCashDialogOpen) {
          setPaymentNote('');
          setIsCashDialogOpen(true);
        }
        return;
      }
      // Ctrl+H → hold order
      if (e.ctrlKey && e.key === 'h' && !isEditing) {
        e.preventDefault();
        if (cart.length > 0) {
          setHoldLabel('');
          setIsHoldDialogOpen(true);
        }
        return;
      }
      // Escape → close any open payment dialog
      if (e.key === 'Escape') {
        if (isCashDialogOpen) setIsCashDialogOpen(false);
        if (isQrisDialogOpen) setIsQrisDialogOpen(false);
        if (isCardDialogOpen) setIsCardDialogOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart, isCashDialogOpen, isQrisDialogOpen, isCardDialogOpen]);

  const categories = ['Semua', ...(settings.productCategories || [])];

  const filteredProducts = products.filter(p => 
    (selectedCategory === 'Semua' || p.category === selectedCategory) &&
    (p.name || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  const addToCart = (product: any, variant?: any) => {
    if (product.stock === 0) return;
    playAddToCart();
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.variantName === variant?.name);
      if (existing) {
        const newQty = existing.quantity + 1;
        if (newQty > product.stock) return prev;
        return prev.map(item => 
          item.productId === product.id && item.variantName === variant?.name
            ? { ...item, quantity: newQty }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price + (variant?.price || 0),
        // Effective HPP: additional cost (manual) + ingredient cost from recipe
        costPrice: (product.costPrice || 0) + (recipeCosts[product.id] || 0),
        variantName: variant?.name,
        image: product.image || undefined,
        quantity: 1
      }];
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const newCart = [...prev];
      const product = products.find(p => p.id === newCart[index].productId);
      const newQty = newCart[index].quantity + delta;
      if (newQty <= 0) {
        newCart.splice(index, 1);
      } else if (product && newQty > product.stock) {
        return prev;
      } else {
        newCart[index].quantity = newQty;
      }
      return newCart;
    });
  };

  const handlePrintLastReceipt = async () => {
    setPrintingLast(true);
    try {
      const txList: any[] = await invoke('get_transactions');
      if (!txList.length) {
        toast.error('Belum ada transaksi');
        return;
      }
      const last = txList.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      const receipt: ReceiptInput = {
        txId: last.id,
        txDate: last.date,
        header: composeReceiptHeader(settings),
        footer: (settings.receiptFooter || '').replace(/\\n/g, '\n'),
        customer: last.customer,
        tableName: last.tableName,
        note: last.note,
        cashier: last.cashier,
        items: (last.items || []).map((it: any) => ({
          name: it.name,
          qty: it.quantity,
          price: it.price || 0,
          variantName: it.variantName,
          note: it.note,
        })),
        subtotal: last.subtotal || 0,
        tax: last.tax || 0,
        taxRate: settings.taxRate,
        serviceCharge: last.serviceCharge || 0,
        serviceRate: settings.serviceCharge,
        total: last.total || 0,
        discount: last.discount || undefined,
        discountName: last.discountName || undefined,
        paymentMethod: last.paymentMethod,
        amountPaid: last.amountPaid,
        change: last.change,
      };

      // Tauri plugin
      if (settings.printerType === 'tauri' && settings.tauriPrinterName) {
        if (isVirtualPrinter(settings.tauriPrinterName)) {
          htmlPrintReceipt(receipt, {
            paperWidth: settings.paperWidth, logo: settings.logo,
            logoWidth: settings.logoWidth, logoHeight: settings.logoHeight,
          });
        } else {
          await printThermal({
            printer: settings.tauriPrinterName,
            paper_size: (settings.paperWidth || '').includes('58') ? 'Mm58' : 'Mm80',
            options: { cut_paper: true, open_cash_drawer: false },
            sections: buildReceiptSections(receipt),
          });
        }
        toast.success('Struk terakhir dicetak ulang');
        return;
      }

      // Network ESC/POS
      if (settings.printerType === 'network' && settings.printerIp) {
        await invoke('print_receipt', { receipt });
        toast.success('Struk terakhir dicetak ulang');
        return;
      }

      // Browser fallback
      htmlPrintReceipt(receipt, {
        paperWidth: settings.paperWidth, logo: settings.logo,
        logoWidth: settings.logoWidth, logoHeight: settings.logoHeight,
      });
      toast.success('Struk terakhir dicetak ulang');
    } catch (e: any) {
      toast.error('Gagal cetak: ' + (e.message || e));
    } finally {
      setPrintingLast(false);
    }
  };

  const handlePrintKitchenOrder = async () => {
    setPrintingKitchen(true);
    try {
      const txList: any[] = await invoke('get_transactions');
      if (!txList.length) { toast.error('Belum ada transaksi'); return; }
      const last = txList.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const items: { name: string; qty: number; variantName?: string; note?: string }[] = (last.items || []).map((it: any) => ({
        name: it.name, qty: it.quantity, variantName: it.variantName, note: it.note,
      }));

      const kitchenHtml = `<!DOCTYPE html><html><head><title>Order Dapur #${last.id}</title>
        <style>
          @page { size: ${settings.paperWidth || '80mm'} auto; margin: 4mm; }
          body { font-family: monospace; font-size: 13px; width: ${settings.paperWidth || '80mm'}; margin: 0 auto; padding: 4px; }
          h2 { text-align: center; margin: 0 0 4px; font-size: 16px; }
          .meta { text-align: center; font-size: 11px; color: #555; margin-bottom: 8px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .item { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; font-weight: bold; }
          .item-note { font-size: 12px; color: #000; font-weight: normal; font-style: italic; margin-left: 12px; margin-bottom: 4px; padding: 2px 6px; border-left: 3px solid #000; background: #f0f0f0; }
          .note { font-size: 11px; color: #555; margin-top: 6px; }
        </style></head><body>
        <h2>ORDER DAPUR</h2>
        <div class="meta">
          #${last.id}<br/>
          ${new Date(last.date).toLocaleString('id-ID')}
          ${last.cashier ? '<br/>Kasir: ' + last.cashier : ''}
          ${last.tableName ? '<br/><b>Meja: ' + last.tableName + '</b>' : ''}
          ${last.customer && last.customer !== 'Walk-In Customer' ? '<br/>Pelanggan: ' + last.customer : ''}
        </div>
        <div class="divider"></div>
        ${items.map(it => `<div class="item"><span>${it.qty}x ${it.name}${it.variantName ? ' (' + it.variantName + ')' : ''}</span></div>${it.note ? '<div class="item-note">📝 ' + it.note + '</div>' : ''}`).join('')}
        <div class="divider"></div>
        ${last.note ? '<div class="note">Catatan: ' + last.note + '</div>' : ''}
      </body></html>`;

      // Use hidden iframe to print (same technique as htmlPrintReceipt)
      const existing = document.getElementById('__kitchen_print_frame');
      if (existing) existing.remove();
      const iframe = document.createElement('iframe');
      iframe.id = '__kitchen_print_frame';
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      document.body.appendChild(iframe);
      const cw = iframe.contentWindow;
      if (!cw) throw new Error('Tidak dapat membuat iframe print');
      cw.document.open();
      cw.document.write(kitchenHtml);
      cw.document.close();
      const triggerPrint = () => { try { cw.focus(); cw.print(); } catch {} setTimeout(() => iframe.remove(), 60000); };
      if (cw.document.readyState === 'complete') setTimeout(triggerPrint, 100);
      else iframe.onload = () => setTimeout(triggerPrint, 100);

      toast.success('Order dapur dicetak');
    } catch (e: any) {
      toast.error('Gagal cetak order dapur: ' + (e.message || e));
    } finally {
      setPrintingKitchen(false);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * (settings.taxRate / 100);
  const serviceCharge = subtotal * (settings.serviceCharge / 100);
  const total = subtotal + tax + serviceCharge;
  const discountAmount = selectedDiscount
    ? (selectedDiscount.type === 'percentage'
        ? subtotal * (selectedDiscount.value / 100)
        : Math.min(selectedDiscount.value, total))
    : 0;
  const discountedTotal = Math.max(0, total - discountAmount);

  // ─── Loyalty calculations ───
  const loyaltyEnabled = !!settings.loyaltyEnabled;
  const pointMultiplier: number = settings.pointMultiplier || 1000;   // Rp per 1 point earned
  const redeemRate: number = settings.redeemRate || 100;              // Rp per 1 point redeemed
  const minRedeemPoints: number = settings.minRedeemPoints || 100;
  const selectedCustomerObj = customers.find((c: any) => c.name === selectedCustomer) || null;
  const customerPoints: number = selectedCustomerObj?.points || 0;
  const canRedeem = loyaltyEnabled && selectedCustomerObj && customerPoints >= minRedeemPoints;
  const redemptionDiscount = (useRedemption && canRedeem) ? Math.min(customerPoints * redeemRate, discountedTotal) : 0;
  const finalPayable = Math.max(0, discountedTotal - redemptionDiscount);
  const pointsRedeemed = (useRedemption && canRedeem) ? Math.floor(redemptionDiscount / redeemRate) : 0;
  const pointsEarned = loyaltyEnabled && selectedCustomerObj ? Math.floor(finalPayable / pointMultiplier) : 0;

  const change = typeof amountPaid === 'number' ? amountPaid - finalPayable : 0;

  // ─── Customer Display: BroadcastChannel sync ───
  // Keep displayStateRef current so the 'ready' handler can send latest state
  useEffect(() => {
    displayStateRef.current = {
      cart: cart.map((i) => ({ name: i.name, variantName: i.variantName, quantity: i.quantity, price: i.price, note: i.note, image: i.image })),
      subtotal, tax, taxRate: settings.taxRate || 0,
      serviceCharge, serviceRate: settings.serviceCharge || 0,
      total: discountedTotal,
      discountAmount, discountName: selectedDiscount?.name,
      customer: selectedCustomer !== 'Walk-In Customer' ? selectedCustomer : undefined,
      tableName: selectedTable || undefined,
      logo: settings.logo,
      header: getShopName(settings),
      address: settings.shopAddress || '',
      displayPhotos: settings.displayPhotos || [],
      displaySlideshowInterval: settings.displaySlideshowInterval || 5,
      lastPayment: lastPaymentForDisplay,
      qrisPayment: isQrisDialogOpen
        ? {
            total: discountedTotal,
            // Static mode → send the uploaded image; dynamic mode → send the generated string
            qrisImage:
              settings.qrisEnabled && (settings.qrisMode || 'static') === 'static'
                ? settings.qrisImage || ''
                : '',
            qrisString:
              settings.qrisEnabled &&
              (settings.qrisMode || 'static') === 'dynamic' &&
              dynamicQrisString
                ? dynamicQrisString
                : undefined,
          }
        : null,
      showMenu: isShowMenuOpen
        ? {
            categories: settings.productCategories || [],
            products: products.map((p: any) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              image: p.image,
              category: p.category,
              variants: (p.variants || []).map((v: any) => ({ name: v.name, price: v.price })),
            })),
          }
        : null,
    };
  }, [cart, subtotal, tax, serviceCharge, discountedTotal, discountAmount, selectedDiscount, selectedCustomer, selectedTable, settings, lastPaymentForDisplay, isQrisDialogOpen, isShowMenuOpen, products, dynamicQrisString]);

  // Set up channel once; broadcast on state changes + respond to 'ready'
  useEffect(() => {
    const bc = new BroadcastChannel('pos-customer-display');
    displayChannelRef.current = bc;
    bc.onmessage = (e) => {
      if (e.data?.type === 'ready') {
        bc.postMessage({ type: 'update', data: displayStateRef.current });
      }
    };
    return () => { bc.close(); displayChannelRef.current = null; };
  }, []);

  // Broadcast whenever displayable state changes
  useEffect(() => {
    displayChannelRef.current?.postMessage({ type: 'update', data: displayStateRef.current });
  }, [cart, subtotal, tax, serviceCharge, discountedTotal, discountAmount, selectedDiscount, selectedCustomer, selectedTable, settings, lastPaymentForDisplay, isQrisDialogOpen, isShowMenuOpen, products, dynamicQrisString]);

  // ─── Dynamic QRIS generation ──────────────────────────────────────────
  // Runs whenever the QRIS dialog opens with dynamic mode enabled.
  // Clears the string when dialog closes or mode is not dynamic.
  useEffect(() => {
    if (!isQrisDialogOpen) {
      setDynamicQrisString('');
      return;
    }
    // Only generate when mode is explicitly 'dynamic' (default is 'static')
    const isDynamic = (settings.qrisMode || 'static') === 'dynamic';
    if (!settings.qrisEnabled || !isDynamic || !settings.qrisStatic) {
      setDynamicQrisString('');
      return;
    }
    // finalPayable is the amount after all discounts and loyalty redemptions
    invoke<string>('generate_dynamic_qris', {
      staticQris: settings.qrisStatic,
      amount: Math.round(finalPayable),
    })
      .then((result) => setDynamicQrisString(result))
      .catch((err) => {
        console.error('generate_dynamic_qris error:', err);
        toast.error('Gagal membuat QRIS dinamis: ' + (err?.message || String(err)));
        setDynamicQrisString('');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQrisDialogOpen, settings.qrisEnabled, settings.qrisMode, settings.qrisStatic, finalPayable]);

  const handleQuickAddCustomer = async () => {
    const name = quickCustomerName.trim();
    if (!name) {
      toast.error('Nama pelanggan wajib diisi');
      return;
    }
    if (customers.some((c: any) => (c.name || '').toLowerCase() === name.toLowerCase())) {
      toast.error('Nama pelanggan sudah terdaftar');
      return;
    }
    setSavingCustomer(true);
    try {
      const created: any = await invoke('create_customer', {
        input: { name, phone: quickCustomerPhone.trim() || null, points: 0 },
      });
      const list: any[] = await invoke('get_customers');
      setCustomers(list);
      setSelectedCustomer(created?.name || name);
      logActivity('Tambah Pelanggan', name, quickCustomerPhone ? `Telp: ${quickCustomerPhone}` : undefined);
      toast.success(`Pelanggan "${name}" ditambahkan`);
      setQuickCustomerName('');
      setQuickCustomerPhone('');
      setIsQuickAddCustomerOpen(false);
    } catch (e: any) {
      toast.error('Gagal menambah pelanggan: ' + (e?.message || e));
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleHoldOrder = async () => {
    if (cart.length === 0) return;
    setSavingHold(true);
    try {
      const defaultLabel = selectedTable || (selectedCustomer !== 'Walk-In Customer' ? selectedCustomer : '');
      await invoke('create_held_order', {
        input: {
          label: holdLabel.trim() || defaultLabel || null,
          customer: selectedCustomer !== 'Walk-In Customer' ? selectedCustomer : null,
          tableName: selectedTable || null,
          note: null,
          cashier: user?.displayName || null,
          items: cart.map((i: any) => ({
            productId: i.productId,
            name: i.name,
            variantName: i.variantName,
            quantity: i.quantity,
            price: i.price,
            costPrice: i.costPrice,
            note: i.note,
            image: i.image,
          })),
          subtotal,
          tax,
          serviceCharge,
          total: discountedTotal,
        },
      });
      logActivity('Tahan Pesanan', `${cart.length} item`, `Total: Rp ${discountedTotal.toLocaleString('id-ID')}`);
      toast.success('Pesanan ditahan. Bisa dilanjutkan nanti.');
      refreshHeldOrders();
      // Clear cart
      setCart([]);
      setSelectedDiscount(null);
      setUseRedemption(false);
      setSelectedCustomer('Walk-In Customer');
      setSelectedTable('');
      setHoldLabel('');
      setIsHoldDialogOpen(false);
    } catch (e: any) {
      toast.error('Gagal menahan pesanan: ' + (e?.message || e));
    } finally {
      setSavingHold(false);
    }
  };

  // Issue #2: replaced window.confirm() with ConfirmDialog state
  const doResumeHeld = async (h: any) => {
    setPendingResumeHeld(null);
    try {
      setCart((h.items || []).map((i: any) => ({
        productId: i.productId,
        name: i.name,
        variantName: i.variantName,
        quantity: i.quantity,
        price: i.price,
        costPrice: i.costPrice,
        note: i.note,
        image: i.image,
      })));
      if (h.customer) setSelectedCustomer(h.customer); else setSelectedCustomer('Walk-In Customer');
      setSelectedTable(h.tableName || '');
      await invoke('delete_held_order', { id: h.id });
      logActivity('Lanjutkan Pesanan Ditahan', h.label || h.id);
      toast.success('Pesanan dimuat. Lanjutkan pembayaran.');
      refreshHeldOrders();
      setIsHeldListOpen(false);
    } catch (e: any) {
      toast.error('Gagal memuat pesanan: ' + (e?.message || e));
    }
  };

  const handleResumeHeld = (h: any) => {
    if (cart.length > 0) {
      setPendingResumeHeld(h);
    } else {
      doResumeHeld(h);
    }
  };

  const handleDeleteHeld = async (h: any) => {
    setPendingDeleteHeld(h);
  };

  const doDeleteHeld = async (h: any) => {
    setPendingDeleteHeld(null);
    try {
      await invoke('delete_held_order', { id: h.id });
      logActivity('Hapus Pesanan Ditahan', h.label || h.id);
      toast.success('Pesanan dihapus');
      refreshHeldOrders();
    } catch (e: any) {
      toast.error('Gagal menghapus: ' + (e?.message || e));
    }
  };

  const openCustomerDisplay = async () => {
    try {
      const existing = await WebviewWindow.getByLabel('customer-display');
      if (existing) {
        await existing.setFocus();
        return;
      }
      const webview = new WebviewWindow('customer-display', {
        url: '/?display=customer',
        title: 'Customer Display',
        width: 900,
        height: 1100,
        decorations: false,
        resizable: true,
      });
      webview.once('tauri://error', (e) => {
        console.error('Gagal membuka Customer Display:', e);
        toast.error('Gagal membuka Customer Display');
      });
    } catch (e: any) {
      toast.error('Gagal membuka Customer Display: ' + (e.message || e));
    }
  };

  const handleCheckout = async (paymentMethod: string, paidAmount?: number, changeAmount?: number, note?: string) => {
    if (cart.length === 0 || processing) return;
    setProcessing(true);

    try {
      // finalPayable accounts for loyalty redemption discount on top of promo discounts
      const transaction: any = await invoke('create_transaction', {
        input: {
          items: cart,
          subtotal,
          tax,
          serviceCharge,
          total: finalPayable,
          paymentMethod,
          amountPaid: paidAmount || finalPayable,
          change: changeAmount || 0,
          customer: selectedCustomer,
          tableName: selectedTable || null,
          note: note || null,
          cashier: user?.displayName || null,
          discount: (discountAmount || 0) + redemptionDiscount,
          discountId: selectedDiscount?.id || null,
          discountName: selectedDiscount ? selectedDiscount.name + (redemptionDiscount > 0 ? ' + Poin' : '') : (redemptionDiscount > 0 ? 'Redeem Poin' : null),
        }
      });

      // ─── Update customer loyalty points ───────────────────────────────
      if (loyaltyEnabled && selectedCustomerObj) {
        const newPoints = Math.max(0, customerPoints - pointsRedeemed) + pointsEarned;
        try {
          await invoke('update_customer', {
            id: selectedCustomerObj.id,
            input: {
              name: selectedCustomerObj.name,
              phone: selectedCustomerObj.phone || null,
              points: newPoints,
            },
          });
          // Show loyalty summary toast
          const parts: string[] = [];
          if (pointsRedeemed > 0) parts.push(`Poin digunakan: ${pointsRedeemed}`);
          if (pointsEarned > 0) parts.push(`Poin didapat: +${pointsEarned}`);
          parts.push(`Saldo: ${newPoints} poin`);
          toast.info(parts.join(' | '), { duration: 4000 });
        } catch (e: any) {
          console.error('Failed to update customer points:', e);
        }
        // refresh customers list
        invoke<any[]>('get_customers').then(setCustomers).catch(() => {});
      }

      // ─── Deduct ingredient stock for the sale ─────────────────────────────
      // Warn but never block checkout if deduction fails or stock goes negative
      try {
        await deductIngredientsForSale(
          cart.map((item: any) => ({ productId: item.productId, quantity: item.quantity })),
        );
      } catch (e: any) {
        console.warn('Ingredient deduction warning:', e);
        toast.warning('Stok bahan baku tidak berhasil dikurangi otomatis. Cek menu Bahan Baku.', { duration: 4000 });
      }

      logActivity('Transaksi Baru', `#${transaction.id}`, `Total: Rp ${finalPayable.toLocaleString('id-ID')}, ${paymentMethod}${selectedDiscount ? ` (Diskon: ${selectedDiscount.name})` : ''}${redemptionDiscount > 0 ? ` (Redeem ${pointsRedeemed} poin)` : ''}`);

      {
        // Show prominent success overlay
        setSuccessOverlay({ show: true, txId: transaction.id, total: discountedTotal });
        setTimeout(() => setSuccessOverlay(null), 3000);

        // Also signal Customer Display
        setLastPaymentForDisplay({ txId: transaction.id, total });
        setTimeout(() => setLastPaymentForDisplay(null), 4500);

        setIsCashDialogOpen(false);
        setIsQrisDialogOpen(false);
        setIsCardDialogOpen(false);
        setAmountPaid('');
        setPaymentNote('');
        
        // Print receipt — Tauri thermal plugin (USB / Bluetooth) → Network → Browser fallback
        if (settings.printerType === 'tauri' && settings.tauriPrinterName) {
          const receiptInput = {
            txId: transaction.id,
            txDate: transaction.date,
            header: composeReceiptHeader(settings),
            footer: (settings.receiptFooter || '').replace(/\\n/g, '\n'),
            customer: selectedCustomer,
            tableName: selectedTable || undefined,
            cashier: user?.displayName || undefined,
            items: cart.map(it => ({
              name: it.name,
              qty: it.quantity,
              price: it.price || 0,
              variantName: it.variantName,
              note: it.note,
            })),
            subtotal,
            tax,
            taxRate: settings.taxRate,
            serviceCharge,
            serviceRate: settings.serviceCharge,
            total: discountedTotal,
            discount: discountAmount || undefined,
            discountName: selectedDiscount?.name,
            paymentMethod,
            amountPaid: paidAmount || total,
            change: changeAmount || 0,
            note: note || undefined,
          };

          // Virtual printers (Print to PDF, XPS, etc.) can't decode raw ESC/POS
          if (isVirtualPrinter(settings.tauriPrinterName)) {
            try {
              htmlPrintReceipt(receiptInput, {
                paperWidth: settings.paperWidth,
                logo: settings.logo,
                logoWidth: settings.logoWidth,
                logoHeight: settings.logoHeight,
              });
            } catch (e: any) {
              toast.error('Cetak gagal: ' + (e.message || e));
            }
            setCart([]);
            setSelectedDiscount(null);
            setUseRedemption(false);
            setSelectedCustomer('Walk-In Customer');
            setSelectedTable('');
            invoke<any[]>('get_products').then(setProducts).catch(() => {});
            return;
          }

          try {
            await printThermal({
              printer: settings.tauriPrinterName,
              paper_size: (settings.paperWidth || '').includes('58') ? 'Mm58' : 'Mm80',
              options: {
                cut_paper: true,
                beep: false,
                open_cash_drawer: !!settings.printerOpenDrawer,
              },
              sections: buildReceiptSections(receiptInput),
            });
          } catch (e: any) {
            toast.error('Cetak thermal gagal: ' + (e.message || e));
          }

          setCart([]);
          setSelectedDiscount(null);
          setSelectedCustomer('Walk-In Customer');
          setSelectedTable('');
          invoke<any[]>('get_products').then(setProducts).catch(() => {});
          return;
        }

        if (settings.printerType === 'network' && settings.printerIp) {
          try {
            await invoke('print_receipt', {
              receipt: {
                txId: transaction.id,
                txDate: transaction.date,
                items: cart.map(it => ({
                  name: it.name,
                  qty: it.quantity,
                  price: it.price || 0,
                  variantName: it.variantName,
                  note: it.note,
                })),
                subtotal, tax, serviceCharge, total: discountedTotal,
                discount: discountAmount || undefined,
                discountName: selectedDiscount?.name,
                paymentMethod,
                amountPaid: paidAmount || total,
                change: changeAmount || 0,
                customer: selectedCustomer,
                tableName: selectedTable || undefined,
                note: note || undefined,
                cashier: user?.displayName || undefined,
              }
            });
          } catch (e: any) {
            toast.error('Cetak struk gagal: ' + (e.message || e));
          }

          setCart([]);
          setSelectedDiscount(null);
          setSelectedCustomer('Walk-In Customer');
          setSelectedTable('');
          invoke<any[]>('get_products').then(setProducts).catch(() => {});
          return;
        }

        const receiptWindow = window.open('', '_blank');
        if (receiptWindow) {
          // Issue #22: escape dynamic values to prevent HTML injection
          const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          receiptWindow.document.write(`
            <html>
              <head>
                <title>Struk #${esc(String(transaction.id))}</title>
                <style>
                  body { font-family: monospace; padding: 20px; width: ${settings.paperWidth || '80mm'}; margin: 0 auto; }
                  .header { text-align: center; margin-bottom: 20px; white-space: pre-wrap; }
                  .logo { width: ${(settings.paperWidth || '').includes('58') ? Math.min(settings.logoWidth || 160, 160) : Math.min(settings.logoWidth || 200, 200)}px; height: ${(settings.paperWidth || '').includes('58') ? Math.min(settings.logoHeight || 45, 50) : Math.min(settings.logoHeight || 50, 60)}px; object-fit: contain; margin: 0 auto 10px auto; display: block; filter: grayscale(100%) contrast(1.2); }
                  .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
                  .divider { border-top: 1px dashed #000; margin: 10px 0; }
                  .total { font-weight: bold; }
                  .footer { text-align: center; margin-top: 20px; white-space: pre-wrap; }
                </style>
              </head>
              <body>
                ${settings.logo ? `<img src="${settings.logo}" class="logo" alt="Logo" />` : ''}
                <div class="header">${esc(composeReceiptHeader(settings))}\n\nStruk #${esc(String(transaction.id))}\n${new Date(transaction.date || Date.now()).toLocaleString('id-ID')}</div>
                <div class="divider"></div>
                ${user?.displayName ? `<div class="item"><span>Kasir:</span><span>${esc(user.displayName)}</span></div>` : ''}
                <div class="item"><span>Pelanggan:</span><span>${esc(selectedCustomer)}</span></div>
                ${selectedTable ? `<div class="item"><span>Meja:</span><span>${esc(selectedTable)}</span></div>` : ''}
                <div class="divider"></div>
                ${cart.map(item => `
                  <div class="item">
                    <span>${esc(String(item.quantity))}x ${esc(item.name)} ${item.variantName ? `(${esc(item.variantName)})` : ''}</span>
                    <span>Rp ${((item.price || 0) * item.quantity).toLocaleString('id-ID')}</span>
                  </div>
                `).join('')}
                <div class="divider"></div>
                <div class="item"><span>Subtotal</span><span>Rp ${(subtotal || 0).toLocaleString('id-ID')}</span></div>
                <div class="item"><span>Pajak (${settings.taxRate}%)</span><span>Rp ${(tax || 0).toLocaleString('id-ID')}</span></div>
                <div class="item"><span>Layanan (${settings.serviceCharge}%)</span><span>Rp ${(serviceCharge || 0).toLocaleString('id-ID')}</span></div>
                ${discountAmount > 0 ? `<div class="item"><span>Diskon${selectedDiscount?.name ? ` (${selectedDiscount.name})` : ''}</span><span class="text-red-500">-Rp ${(discountAmount || 0).toLocaleString('id-ID')}</span></div>` : ''}
                <div class="divider"></div>
                <div class="item total"><span>Total</span><span>Rp ${(discountedTotal || 0).toLocaleString('id-ID')}</span></div>
                <div class="item"><span>Pembayaran</span><span>${paymentMethod}</span></div>
                ${paymentMethod === 'Tunai' ? `
                  <div class="item"><span>Tunai</span><span>Rp ${(paidAmount || 0).toLocaleString('id-ID')}</span></div>
                  <div class="item"><span>Kembalian</span><span>Rp ${(changeAmount || 0).toLocaleString('id-ID')}</span></div>
                ` : ''}
                <div class="divider"></div>
                <div class="footer">${esc((settings.receiptFooter || 'Terima Kasih').replace(/\\n/g, '\n'))}</div>
              </body>
            </html>
          `);
          receiptWindow.document.close();
          receiptWindow.print();
        }

        setCart([]);
        setSelectedDiscount(null);
        setUseRedemption(false);
        setSelectedCustomer('Walk-In Customer');
        setSelectedTable('');
        invoke<any[]>('get_products').then((updatedProducts) => {
          setProducts(updatedProducts);
          // ─── Low-stock email alert check ─────────────────────────────
          if (settings.emailAlertEnabled && settings.smtpHost && settings.emailRecipient) {
            const threshold = settings.lowStockThreshold ?? 5;
            const storeName = getShopName(settings);
            const lowItems = updatedProducts.filter((p: any) => (p.stock ?? 0) <= threshold && (p.stock ?? 0) >= 0);
            if (lowItems.length > 0) {
              const subject = `[${storeName}] Peringatan Stok Menipis — ${lowItems.length} produk`;
              const bodyLines = [
                `Laporan Stok Menipis`,
                `Toko: ${storeName}`,
                `Waktu: ${new Date().toLocaleString('id-ID')}`,
                ``,
                `Produk dengan stok di bawah atau sama dengan ambang batas (${threshold}):`,
                ``,
                ...lowItems.map((p: any) => `- ${p.name}: ${p.stock ?? 0} ${p.unit || 'pcs'} tersisa`),
                ``,
                `Harap segera lakukan pengisian stok.`,
              ];
              invoke('send_email', {
                smtpHost: settings.smtpHost,
                smtpPort: settings.smtpPort ?? 587,
                useTls: !!(settings.smtpUseTls ?? 1),
                username: settings.smtpUsername || '',
                password: settings.smtpPassword || '',
                from: settings.smtpFrom || settings.emailRecipient,
                to: settings.emailRecipient,
                subject,
                body: bodyLines.join('\n'),
              }).catch(() => {}); // fire-and-forget, no blocking toast
            }
          }
        }).catch(() => {});
      }
    } catch (error: any) {
      // Issue #20: include backend error detail instead of a generic message
      toast.error('Transaksi Gagal: ' + (error?.message || String(error)));
    } finally {
      setProcessing(false);
    }
  };

  const categoryProductCount = (cat: string) =>
    cat === 'Semua' ? products.length : products.filter(p => p.category === cat).length;

  return (
    <div className="flex h-full w-full bg-background">
      {/* ─── Products Panel ─── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top bar — clean search only */}
        <div className="flex items-center gap-2 px-5 py-3 bg-background border-b border-border/70">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Cari produk... (/ untuk fokus)"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-all"
              ref={searchInputRef}
              value={searchInput}
              onChange={(e) => {
                const val = e.target.value;
                setSearchInput(val);
                // Issue #18: debounce search by 180ms to avoid re-filtering on every keystroke
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = setTimeout(() => setSearchQuery(val), 180);
              }}
              onFocus={() => settings.virtualKeyboard && setFocusedInput('search')}
              onBlur={() => setTimeout(() => setFocusedInput((prev) => prev === 'search' ? null : prev), 100)}
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 px-5 py-3 overflow-x-auto shrink-0 scrollbar-none">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground/80 border-border hover:bg-accent/60 hover:text-foreground"
                )}
              >
                {cat}
                <span className={cn("ml-1.5 text-xs font-normal", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {categoryProductCount(cat)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-5">
          {/* Issue #8: show skeleton cards while products are loading */}
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square flex flex-col bg-card rounded-2xl border border-border overflow-hidden">
                  <Skeleton className="flex-1" />
                  <div className="p-3 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4 rounded" />
                    <Skeleton className="h-3.5 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 stagger">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                disabled={product.stock === 0}
                className="group relative aspect-square flex flex-col bg-card rounded-2xl border border-border overflow-hidden text-left transition-all duration-200 hover:border-foreground/30 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (product.variants?.length > 0) setVariantProduct(product);
                  else addToCart(product);
                }}
              >
                <div className="flex-1 min-h-0 bg-muted relative overflow-hidden">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Coffee className="w-10 h-10 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                    </div>
                  )}
                  {product.stock === 0 ? (
                    <span className="absolute top-2 right-2 bg-muted-foreground text-background text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      Habis
                    </span>
                  ) : product.stock <= 10 && (
                    <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      Sisa {product.stock}
                    </span>
                  )}
                </div>
                <div className="p-3 shrink-0">
                  <h3 className="text-sm font-semibold text-foreground truncate leading-tight">{product.name}</h3>
                  <p className="text-foreground/80 text-sm font-bold mt-1">Rp {(product.price || 0).toLocaleString('id-ID')}</p>
                </div>
              </button>
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <EmptyState icon={Coffee} title="Tidak ada produk ditemukan" />
          )}
            </>
          )}
        </div>

        {/* Bottom action bar — enterprise POS-style colorful quick-action tiles */}
        <div className="shrink-0 grid grid-cols-6 gap-1.5 px-3 py-2.5 bg-background border-t border-border/70">
          {/* Order Dapur — warning */}
          <button
            type="button"
            onClick={handlePrintKitchenOrder}
            disabled={printingKitchen}
            aria-label="Cetak Order Dapur"
            title={printingKitchen ? 'Mencetak order dapur...' : 'Cetak Order Dapur'}
            className="h-16 rounded-xl bg-warning hover:bg-warning/90 active:bg-warning/80 disabled:opacity-60 disabled:cursor-not-allowed text-warning-foreground font-bold shadow-md ring-1 ring-warning/40 transition-all active:scale-[0.97] inline-flex flex-col items-center justify-center gap-1 px-2"
          >
            <UtensilsCrossed className={`w-5 h-5 ${printingKitchen ? 'animate-pulse' : ''}`} />
            <span className="text-[11px] leading-tight text-center whitespace-nowrap">
              {printingKitchen ? 'Mencetak...' : 'Order Dapur'}
            </span>
          </button>

          {/* Struk Terakhir — info */}
          <button
            type="button"
            onClick={handlePrintLastReceipt}
            disabled={printingLast}
            aria-label="Cetak Struk Terakhir"
            title={printingLast ? 'Mencetak struk...' : 'Cetak Struk Terakhir'}
            className="h-16 rounded-xl bg-info hover:bg-info/90 active:bg-info/80 disabled:opacity-60 disabled:cursor-not-allowed text-info-foreground font-bold shadow-md ring-1 ring-info/40 transition-all active:scale-[0.97] inline-flex flex-col items-center justify-center gap-1 px-2"
          >
            <Printer className={`w-5 h-5 ${printingLast ? 'animate-pulse' : ''}`} />
            <span className="text-[11px] leading-tight text-center whitespace-nowrap">
              {printingLast ? 'Mencetak...' : 'Struk Terakhir'}
            </span>
          </button>

          {/* Customer Display — brand */}
          <button
            type="button"
            onClick={openCustomerDisplay}
            aria-label="Customer Display"
            title="Customer Display"
            className="h-16 rounded-xl bg-brand hover:bg-brand/90 active:bg-brand/80 text-brand-foreground font-bold shadow-md ring-1 ring-brand/40 transition-all active:scale-[0.97] inline-flex flex-col items-center justify-center gap-1 px-2"
          >
            <Monitor className="w-5 h-5" />
            <span className="text-[11px] leading-tight text-center whitespace-nowrap">Customer Display</span>
          </button>

          {/* Tampilkan Menu — success / active indicator (Issue #17) */}
          <button
            type="button"
            onClick={() => setIsShowMenuOpen(!isShowMenuOpen)}
            aria-label={isShowMenuOpen ? 'Menu Aktif — klik untuk tutup' : 'Tampilkan Menu di Customer Display'}
            title={isShowMenuOpen ? 'Menu Aktif — klik untuk tutup' : 'Tampilkan Menu di Customer Display'}
            className={cn(
              "h-16 rounded-xl font-bold shadow-md transition-all active:scale-[0.97] inline-flex flex-col items-center justify-center gap-1 px-2",
              isShowMenuOpen
                ? "bg-success text-success-foreground ring-2 ring-success ring-offset-1"
                : "bg-success hover:bg-success/90 active:bg-success/80 text-success-foreground ring-1 ring-success/40"
            )}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[11px] leading-tight text-center whitespace-nowrap">
              {isShowMenuOpen ? 'Menu Aktif ✓' : 'Tampilkan Menu'}
            </span>
          </button>

          {/* Kalkulator — muted/neutral (Issue #5: differentiated from Struk Terakhir which keeps bg-info) */}
          <button
            type="button"
            onClick={() => setIsCalculatorOpen(true)}
            aria-label="Kalkulator"
            title="Kalkulator"
            className="h-16 rounded-xl bg-muted hover:bg-muted/70 active:bg-muted/60 text-foreground font-bold shadow-md ring-1 ring-border transition-all active:scale-[0.97] inline-flex flex-col items-center justify-center gap-1 px-2"
          >
            <Calculator className="w-5 h-5" />
            <span className="text-[11px] leading-tight text-center whitespace-nowrap">Kalkulator</span>
          </button>

          {/* Pesanan Ditahan — secondary/neutral (Issue #6: was destructive red, reserved for actual deletions) */}
          <button
            type="button"
            onClick={() => setIsHeldListOpen(true)}
            aria-label={`Pesanan Ditahan${heldOrders.length > 0 ? ` (${heldOrders.length})` : ''}`}
            title={`Pesanan Ditahan${heldOrders.length > 0 ? ` (${heldOrders.length})` : ''}`}
            className="relative h-16 rounded-xl bg-secondary hover:bg-secondary/80 active:bg-secondary/70 text-secondary-foreground font-bold shadow-md ring-1 ring-border transition-all active:scale-[0.97] inline-flex flex-col items-center justify-center gap-1 px-2"
          >
            <Clock className="w-5 h-5" />
            <span className="text-[11px] leading-tight text-center whitespace-nowrap">Pesanan Ditahan</span>
            {heldOrders.length > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-warning text-warning-foreground text-[10px] font-extrabold rounded-full min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center leading-none shadow">
                {heldOrders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── Cart Panel ─── */}
      {/* Issue #10: responsive cart width instead of fixed 360px */}
      <div className="w-[320px] xl:w-[360px] bg-card border-l border-border/70 flex flex-col h-full shrink-0">
        {/* Cart header */}
        <div className="px-5 pt-5 pb-4 space-y-3 border-b border-border/70">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-foreground/75" />
            Pesanan Baru
            {cart.length > 0 && (
              <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </h2>
          {/* Customer + Table pickers */}
          <div className="grid grid-cols-2 gap-2">
            {/* Customer */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pelanggan</span>
                <button
                  type="button"
                  onClick={() => { setQuickCustomerName(''); setQuickCustomerPhone(''); setIsQuickAddCustomerOpen(true); }}
                  title="Tambah pelanggan baru"
                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-foreground/80 hover:text-foreground transition-colors"
                >
                  <UserPlus className="w-3 h-3" />
                  Tambah
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setCustomerSearch(''); setIsCustomerPickerOpen(true); }}
                className="h-9 w-full text-xs bg-muted hover:bg-accent/70 border border-border hover:border-foreground/30 text-foreground rounded-lg transition-colors flex items-center gap-1.5 pl-2.5 pr-2 outline-none focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1 text-left font-medium">
                  {selectedCustomer === 'Walk-In Customer' ? 'Walk-In' : selectedCustomer}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </button>
            </div>

            {/* Table */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Meja</span>
                {selectedTable && (
                  <button
                    type="button"
                    onClick={() => setSelectedTable('')}
                    aria-label="Hapus pilihan meja"
                    title="Hapus pilihan meja"
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus
                  </button>
                )}
              </div>
              <Select value={selectedTable || '__none__'} onValueChange={(v) => setSelectedTable(v && v !== '__none__' ? v : '')}>
                <SelectTrigger className="h-9 w-full text-xs bg-muted hover:bg-accent/70 border-border hover:border-foreground/30 text-foreground rounded-lg transition-colors data-[state=open]:border-ring/60 data-[state=open]:ring-2 data-[state=open]:ring-ring/30">
                  <Armchair className={`w-3.5 h-3.5 shrink-0 ${selectedTable ? 'text-foreground/75' : 'text-muted-foreground'}`} />
                  <span className={`truncate flex-1 text-left font-medium ${selectedTable ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {selectedTable || 'Tanpa Meja'}
                  </span>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none__">
                    <Armchair className="w-3.5 h-3.5 text-muted-foreground" />
                    Tanpa Meja
                  </SelectItem>
                  {(settings.tables || []).length > 0 && <div className="my-1 h-px bg-border" />}
                  {(settings.tables || []).map((t: string) => (
                    <SelectItem key={t} value={t}>
                      <Armchair className="w-3.5 h-3.5 text-muted-foreground" />
                      {t}
                    </SelectItem>
                  ))}
                  {(settings.tables || []).length === 0 && (
                    <div className="px-2 py-2 text-[11px] text-muted-foreground italic">
                      Belum ada meja. Tambah di Pengaturan.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <ShoppingCart className="w-14 h-14 opacity-30" />
              <p className="text-sm">Keranjang kosong</p>
            </div>
          ) : (
            <div className="space-y-1">
              {cart.map((item, index) => (
                <div key={index} className="py-2.5 border-b border-border/70 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{item.name}</h4>
                      {item.variantName && <p className="text-[11px] text-muted-foreground">{item.variantName}</p>}
                      {/* Issue #11: show per-unit price when qty > 1 */}
                      {item.quantity > 1 && (
                        <p className="text-xs text-muted-foreground mt-0.5">Rp {(item.price || 0).toLocaleString('id-ID')} × {item.quantity}</p>
                      )}
                      <p className="text-sm text-foreground/85 font-semibold mt-0.5">Rp {((item.price || 0) * item.quantity).toLocaleString('id-ID')}</p>
                    </div>
                    <button
                      className={cn(
                        "h-7 w-7 rounded-md flex items-center justify-center transition-colors shrink-0",
                        item.note
                          ? "bg-warning/15 text-warning hover:bg-warning/25"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      aria-label={item.note ? 'Edit catatan' : 'Tambah catatan'}
                      title={item.note ? 'Edit catatan' : 'Tambah catatan'}
                      onClick={() => { setNoteEditingIndex(index); setNoteDraft(item.note || ''); }}
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 border border-border">
                      <button
                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        aria-label={item.quantity === 1 ? 'Hapus item' : 'Kurangi jumlah'}
                        onClick={() => updateQuantity(index, -1)}
                      >
                        {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-destructive" /> : <Minus className="w-3.5 h-3.5" />}
                      </button>
                      <span className="w-7 text-center text-sm font-bold text-foreground">{item.quantity}</span>
                      <button
                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        aria-label="Tambah jumlah"
                        onClick={() => updateQuantity(index, 1)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {item.note && (
                    <div className="mt-1.5 text-[11px] text-warning italic bg-warning/10 border-l-2 border-warning/40 pl-2 py-1 rounded-r">
                      {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals & Payment */}
        <div className="px-5 py-4 bg-muted/40 border-t border-border/70 space-y-4 shrink-0">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="text-foreground/85">Rp {(subtotal || 0).toLocaleString('id-ID')}</span>
            </div>
            {settings.taxRate > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Pajak ({settings.taxRate}%)</span>
                <span className="text-foreground/85">Rp {(tax || 0).toLocaleString('id-ID')}</span>
              </div>
            )}
            {settings.serviceCharge > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Layanan ({settings.serviceCharge}%)</span>
                <span className="text-foreground/85">Rp {(serviceCharge || 0).toLocaleString('id-ID')}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-destructive font-semibold">
                <span className="flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5" />
                  Diskon{selectedDiscount ? ` (${selectedDiscount.name})` : ''}
                </span>
                <span>-Rp {discountAmount.toLocaleString('id-ID')}</span>
              </div>
            )}
            {/* Loyalty redemption line item */}
            {redemptionDiscount > 0 && (
              <div className="flex justify-between text-warning font-semibold">
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5" />
                  Redeem Poin ({pointsRedeemed} poin)
                </span>
                <span>-Rp {redemptionDiscount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="border-t border-border pt-2 mt-2 flex justify-between items-baseline">
              <span className="text-base font-bold text-foreground/80">Total</span>
              <div className="text-right">
                {(discountAmount > 0 || redemptionDiscount > 0) && (
                  <span className="text-xs text-muted-foreground line-through block">Rp {(total || 0).toLocaleString('id-ID')}</span>
                )}
                <span className="text-xl font-extrabold text-foreground">Rp {(finalPayable || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>
            {/* Customer points balance */}
            {loyaltyEnabled && selectedCustomerObj && (
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Star className="w-3 h-3 text-warning" />
                  {selectedCustomerObj.name}: {customerPoints} poin
                </span>
                {pointsEarned > 0 && (
                  <span className="text-success font-semibold">+{pointsEarned} poin</span>
                )}
              </div>
            )}
          </div>

          {/* Discount Selector */}
          {activeDiscounts.length > 0 && (
            <div className="px-5 py-0 shrink-0">
              {selectedDiscount ? (
                <div className="flex items-center gap-2 bg-success/10 border border-success/30 rounded-lg px-3 py-2">
                  <Tag className="w-4 h-4 text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-success truncate">{selectedDiscount.name}</p>
                    <p className="text-xs text-success/80">
                      {selectedDiscount.type === 'percentage'
                        ? `Diskon ${selectedDiscount.value}%`
                        : `Potongan Rp ${(selectedDiscount.value || 0).toLocaleString('id-ID')}`}
                      {' '}- Rp {discountAmount.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => setSelectedDiscount(null)}
                    aria-label="Hapus diskon"
                    title="Hapus diskon"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeDiscounts.map((d: any) => (
                    <button
                      key={d.id}
                      type="button"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-warning/10 border border-warning/20 hover:bg-warning/20 hover:border-warning/40 text-warning text-xs font-semibold transition-colors"
                      onClick={() => setSelectedDiscount(d)}
                      title={`${d.type === 'percentage' ? `${d.value}%` : `Rp ${d.value}`} — ${d.description || ''}`}
                    >
                      <Percent className="w-3 h-3" />
                      {d.name}
                      <span className="opacity-70">
                        ({d.type === 'percentage' ? `${d.value}%` : `Rp ${d.value}`})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Issue #15: increased height and applied persistent warning styling to improve visual hierarchy */}
          <button
            className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-warning/10 border border-warning/40 text-warning text-xs font-semibold transition-colors hover:bg-warning/20 hover:border-warning/60 disabled:opacity-40 disabled:pointer-events-none"
            disabled={cart.length === 0}
            onClick={() => { setHoldLabel(''); setIsHoldDialogOpen(true); }}
            title="Tahan pesanan untuk dibayar nanti"
          >
            <PauseCircle className="w-4 h-4" />
            Bayar Nanti (Tahan Pesanan)
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              className="flex flex-col items-center justify-center gap-1 h-14 rounded-xl bg-warning hover:bg-warning/90 text-warning-foreground font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
              disabled={cart.length === 0}
              onClick={() => { setPaymentNote(''); setIsCashDialogOpen(true); }}
            >
              <Banknote className="w-5 h-5" />
              <span className="text-[11px]">Tunai</span>
            </button>
            <button
              className="flex flex-col items-center justify-center gap-1 h-14 rounded-xl bg-info hover:bg-info/90 text-info-foreground font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
              disabled={cart.length === 0}
              onClick={() => { setPaymentNote(''); setIsQrisDialogOpen(true); }}
            >
              <QrCode className="w-5 h-5" />
              <span className="text-[11px]">QRIS</span>
            </button>
            <button
              className="flex flex-col items-center justify-center gap-1 h-14 rounded-xl bg-brand hover:bg-brand/90 text-brand-foreground font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
              disabled={cart.length === 0}
              onClick={() => { setPaymentNote(''); setIsCardDialogOpen(true); }}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-[11px]">Kartu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calculator */}
      <CalculatorDialog open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen} />

      {/* Hold Order Dialog — optional label before saving */}
      <Dialog open={isHoldDialogOpen} onOpenChange={setIsHoldDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="w-5 h-5 text-warning" />
              Tahan Pesanan (Bayar Nanti)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning space-y-1">
              <p className="font-semibold">Ringkasan pesanan</p>
              <div className="flex justify-between"><span>Item</span><span>{cart.reduce((s, i) => s + i.quantity, 0)} pcs</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span>Rp {discountedTotal.toLocaleString('id-ID')}</span></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Label Pesanan <span className="text-muted-foreground/70 font-normal">(opsional)</span></label>
              <Input
                placeholder="Mis. Pak Budi meja 3, Bu Ani..."
                value={holdLabel}
                onChange={(e) => setHoldLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !savingHold) { e.preventDefault(); handleHoldOrder(); } }}
                autoFocus
                maxLength={60}
              />
              <p className="text-[11px] text-muted-foreground">
                Jika kosong, akan pakai Meja/Pelanggan yang terpilih sebagai label.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHoldDialogOpen(false)} disabled={savingHold}>Batal</Button>
            <Button
              onClick={handleHoldOrder}
              disabled={savingHold || cart.length === 0}
              className="bg-warning hover:bg-warning/90 text-warning-foreground"
            >
              <PauseCircle className="w-4 h-4 mr-1.5" />
              {savingHold ? 'Menahan...' : 'Tahan Pesanan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Held Orders List Dialog */}
      <Dialog open={isHeldListOpen} onOpenChange={setIsHeldListOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand" />
              Pesanan Ditahan
              <span className="text-sm font-normal text-muted-foreground">({heldOrders.length})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto border-t border-border bg-muted/30">
            {heldOrders.length === 0 ? (
              <EmptyState
                icon={PauseCircle}
                title="Belum ada pesanan yang ditahan"
                description='Gunakan tombol "Bayar Nanti" di panel pesanan untuk menahan transaksi.'
              />
            ) : (
              <div className="divide-y divide-border">
                {heldOrders.map((h: any) => {
                  const items = h.items || [];
                  const visibleItems = items.slice(0, 3).map((i: any) => `${i.quantity}x ${i.name}`).join(', ');
                  const remaining = items.length - 3;
                  const totalQty = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
                  return (
                    <div key={h.id} className="flex items-start gap-3 px-5 py-4 bg-card hover:bg-warning/10 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-warning/15 text-warning shrink-0 flex items-center justify-center">
                        <PauseCircle className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <span className="font-semibold text-foreground text-sm">
                            {h.label || `Pesanan #${h.id}`}
                          </span>
                          {h.tableName && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium inline-flex items-center gap-1">
                              <Armchair className="w-3 h-3" />{h.tableName}
                            </span>
                          )}
                          {h.customer && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium inline-flex items-center gap-1">
                              <User className="w-3 h-3" />{h.customer}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {h.date ? new Date(h.date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          {h.cashier && <span> • Kasir: {h.cashier}</span>}
                        </p>
                        <p className="text-sm text-muted-foreground truncate" title={items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}>
                          {visibleItems}
                          {remaining > 0 && <span className="text-brand font-medium"> +{remaining} lainnya</span>}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-bold text-foreground whitespace-nowrap">Rp {(h.total || 0).toLocaleString('id-ID')}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{totalQty} item</p>
                        <div className="flex items-center gap-1 mt-2 justify-end">
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs bg-success hover:bg-success/90 text-success-foreground"
                            onClick={() => handleResumeHeld(h)}
                            title="Lanjutkan pesanan ini"
                          >
                            <PlayCircle className="w-3.5 h-3.5 mr-1" />
                            Lanjutkan
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDeleteHeld(h)}
                            aria-label="Hapus pesanan ditahan"
                            title="Hapus pesanan ditahan"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Picker Dialog — searchable list */}
      <Dialog open={isCustomerPickerOpen} onOpenChange={(open) => { setIsCustomerPickerOpen(open); if (!open) setCustomerSearch(''); }}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-brand" />
              Pilih Pelanggan
            </DialogTitle>
          </DialogHeader>

          {/* Search bar */}
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Cari nama atau no. telepon..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                autoFocus
                className="pl-9 pr-9 h-10"
              />
              {customerSearch && (
                <button
                  type="button"
                  onClick={() => setCustomerSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                  aria-label="Bersihkan pencarian"
                  title="Bersihkan pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[50vh] overflow-y-auto border-t border-border bg-muted/30">
            {(() => {
              const q = customerSearch.trim().toLowerCase();
              const filtered = q
                ? customers.filter((c: any) =>
                    (c.name || '').toLowerCase().includes(q) ||
                    (c.phone || '').toLowerCase().includes(q)
                  )
                : customers;
              const showWalkIn = !q || 'walk-in'.includes(q) || 'walkin'.includes(q);
              return (
                <>
                  {showWalkIn && (
                    <button
                      type="button"
                      onClick={() => { setSelectedCustomer('Walk-In Customer'); setIsCustomerPickerOpen(false); }}
                      className={`w-full flex items-center gap-3 px-5 py-3 border-b border-border hover:bg-brand/10 transition-colors text-left ${selectedCustomer === 'Walk-In Customer' ? 'bg-brand/10' : 'bg-card'}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Walk-In</p>
                        <p className="text-xs text-muted-foreground">Pelanggan tidak teridentifikasi</p>
                      </div>
                      {selectedCustomer === 'Walk-In Customer' && <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />}
                    </button>
                  )}
                  {filtered.map((c: any) => {
                    const active = selectedCustomer === c.name;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedCustomer(c.name); setIsCustomerPickerOpen(false); }}
                        className={`w-full flex items-center gap-3 px-5 py-3 border-b border-border hover:bg-brand/10 transition-colors text-left ${active ? 'bg-brand/10' : 'bg-card'}`}
                      >
                        <div className="w-9 h-9 rounded-full bg-brand text-brand-foreground flex items-center justify-center font-semibold text-sm shrink-0">
                          {(c.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                          {c.phone ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {c.phone}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Tidak ada no. telepon</p>
                          )}
                        </div>
                        {c.points > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-semibold shrink-0">
                            {c.points} pts
                          </span>
                        )}
                        {active && <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />}
                      </button>
                    );
                  })}
                  {filtered.length === 0 && !showWalkIn && (
                    <EmptyState
                      icon={Search}
                      compact
                      title={`Tidak ada pelanggan cocok dengan "${customerSearch}"`}
                    />
                  )}
                  {customers.length === 0 && showWalkIn && (
                    <div className="text-center py-6 text-xs text-muted-foreground italic">
                      Belum ada pelanggan terdaftar
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Footer action */}
          <div className="px-5 py-3 border-t border-border bg-card">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setIsCustomerPickerOpen(false);
                setQuickCustomerName(customerSearch.trim().replace(/[0-9+]/g, '').trim());
                setQuickCustomerPhone(/[0-9+]/.test(customerSearch) ? customerSearch.trim() : '');
                setIsQuickAddCustomerOpen(true);
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Tambah Pelanggan Baru
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Customer Dialog */}
      <Dialog open={isQuickAddCustomerOpen} onOpenChange={setIsQuickAddCustomerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand" />
              Tambah Pelanggan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nama Pelanggan <span className="text-destructive">*</span></label>
              <Input
                placeholder="Mis. Budi Santoso"
                value={quickCustomerName}
                onChange={(e) => setQuickCustomerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !savingCustomer) { e.preventDefault(); handleQuickAddCustomer(); }
                }}
                autoFocus
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">No. Telepon <span className="text-muted-foreground/70 font-normal">(opsional)</span></label>
              <Input
                placeholder="Mis. 08123456789"
                value={quickCustomerPhone}
                onChange={(e) => setQuickCustomerPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !savingCustomer) { e.preventDefault(); handleQuickAddCustomer(); }
                }}
                inputMode="tel"
                maxLength={20}
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Pelanggan baru akan langsung terpilih pada transaksi ini. Poin loyalitas dimulai dari 0 dan bertambah otomatis setelah pembayaran.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickAddCustomerOpen(false)} disabled={savingCustomer}>
              Batal
            </Button>
            <Button
              onClick={handleQuickAddCustomer}
              disabled={savingCustomer || !quickCustomerName.trim()}
              className="bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              {savingCustomer ? 'Menyimpan...' : 'Simpan & Pilih'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-item Note Editor */}
      <Dialog open={noteEditingIndex !== null} onOpenChange={(open) => !open && setNoteEditingIndex(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-brand" />
              Catatan Item
            </DialogTitle>
          </DialogHeader>
          {noteEditingIndex !== null && cart[noteEditingIndex] && (
            <div className="space-y-3 py-2">
              <div className="text-sm">
                <div className="font-semibold text-foreground">{cart[noteEditingIndex].name}</div>
                {cart[noteEditingIndex].variantName && (
                  <div className="text-xs text-muted-foreground">{cart[noteEditingIndex].variantName}</div>
                )}
              </div>
              <textarea
                className="w-full min-h-[80px] rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                placeholder="Mis. Less sugar, No ice, Extra spicy, Tanpa bawang..."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                autoFocus
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">{noteDraft.length}/200 karakter</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            {noteEditingIndex !== null && cart[noteEditingIndex]?.note && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setCart(prev => prev.map((it, i) => i === noteEditingIndex ? { ...it, note: undefined } : it));
                  setNoteEditingIndex(null);
                }}
              >
                Hapus Catatan
              </Button>
            )}
            <Button variant="outline" onClick={() => setNoteEditingIndex(null)}>Batal</Button>
            <Button
              className="bg-brand hover:bg-brand/90 text-brand-foreground"
              onClick={() => {
                const trimmed = noteDraft.trim();
                setCart(prev => prev.map((it, i) => i === noteEditingIndex ? { ...it, note: trimmed || undefined } : it));
                setNoteEditingIndex(null);
              }}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant Selection Popup */}
      <Dialog open={!!variantProduct} onOpenChange={(open) => !open && setVariantProduct(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">{variantProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            {variantProduct?.variants?.map((v: any) => (
              <button
                key={v.name}
                className="h-12 rounded-xl bg-muted hover:bg-brand/10 border border-border hover:border-brand text-foreground font-semibold text-sm transition-colors"
                onClick={() => { addToCart(variantProduct, v); setVariantProduct(null); }}
              >
                {v.name} — Rp {((variantProduct?.price || 0) + (v.price || 0)).toLocaleString('id-ID')}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Payment Dialog */}
      <Dialog open={isCashDialogOpen} onOpenChange={setIsCashDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pembayaran Tunai</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Loyalty redemption toggle */}
            {canRedeem && (
              <div className="flex items-center justify-between rounded-lg bg-warning/10 border border-warning/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-warning shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-warning">Gunakan Poin</p>
                    <p className="text-xs text-warning/80">{customerPoints} poin = Rp {(customerPoints * redeemRate).toLocaleString('id-ID')}</p>
                  </div>
                </div>
                <Switch checked={useRedemption} onCheckedChange={(v: boolean) => setUseRedemption(v)} />
              </div>
            )}
            <div className="flex justify-between items-center text-lg">
              <span className="font-medium text-muted-foreground">Total Tagihan:</span>
              <div className="text-right">
                {redemptionDiscount > 0 && <span className="text-xs text-muted-foreground line-through block">Rp {(discountedTotal || 0).toLocaleString('id-ID')}</span>}
                <span className="font-bold text-foreground text-2xl">Rp {(finalPayable || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground/80">Jumlah Bayar (Rp)</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive/80"
                  onClick={() => setAmountPaid('')}
                  disabled={amountPaid === ''}
                >
                  Reset
                </Button>
              </div>
              <Input
                type="number"
                className="text-2xl h-14"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value ? Number(e.target.value) : '')}
                autoFocus
                onFocus={() => settings.virtualKeyboard && setFocusedInput('amount')}
                onBlur={() => setTimeout(() => setFocusedInput((prev) => prev === 'amount' ? null : prev), 100)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tambah Cepat (klik berkali-kali untuk akumulasi)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000].map(n => (
                  <Button
                    key={n}
                    type="button"
                    variant="outline"
                    className="h-11 text-sm font-semibold hover:bg-brand/10 hover:border-brand/50 hover:text-brand"
                    onClick={() => setAmountPaid(prev => (typeof prev === 'number' ? prev : 0) + n)}
                  >
                    + Rp {n.toLocaleString('id-ID')}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 text-xs hover:bg-success/10 hover:border-success/50 hover:text-success"
                  onClick={() => setAmountPaid(finalPayable)}
                  disabled={!finalPayable}
                >
                  Uang Pas (Rp {(finalPayable || 0).toLocaleString('id-ID')})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 text-xs hover:bg-success/10 hover:border-success/50 hover:text-success"
                  onClick={() => {
                    // Round up to nearest 5,000
                    const rounded = Math.ceil(finalPayable / 5000) * 5000;
                    setAmountPaid(rounded);
                  }}
                  disabled={!finalPayable}
                >
                  Bulatkan ke 5rb
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center text-lg pt-1 border-t border-border">
              <span className="font-medium text-muted-foreground">Kembalian:</span>
              <span className={cn("font-bold text-2xl", change < 0 ? "text-destructive" : "text-success")}>
                Rp {(change || 0).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="space-y-2 pt-1 border-t border-border">
              <label className="text-sm font-medium text-foreground/80">Catatan (opsional)</label>
              <Input
                placeholder="Mis. nominal pecahan, referensi, dll."
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCashDialogOpen(false)}>Batal</Button>
            <Button
              className="bg-warning hover:bg-warning/90 text-warning-foreground"
              disabled={change < 0 || amountPaid === '' || processing}
              onClick={() => handleCheckout('Tunai', Number(amountPaid), change, paymentNote)}
            >
              {processing ? 'Memproses...' : 'Selesaikan Pembayaran'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QRIS Payment Dialog */}
      <Dialog open={isQrisDialogOpen} onOpenChange={setIsQrisDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-info" />
              Pembayaran QRIS
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Loyalty redemption toggle */}
            {canRedeem && (
              <div className="flex items-center justify-between rounded-lg bg-warning/10 border border-warning/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-warning shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-warning">Gunakan Poin</p>
                    <p className="text-xs text-warning/80">{customerPoints} poin = Rp {(customerPoints * redeemRate).toLocaleString('id-ID')}</p>
                  </div>
                </div>
                <Switch checked={useRedemption} onCheckedChange={(v: boolean) => setUseRedemption(v)} />
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center text-lg">
              <span className="font-medium text-muted-foreground">Total Tagihan:</span>
              <div className="text-right">
                {redemptionDiscount > 0 && (
                  <span className="text-xs text-muted-foreground line-through block">
                    Rp {(discountedTotal || 0).toLocaleString('id-ID')}
                  </span>
                )}
                <span className="font-bold text-foreground text-2xl">
                  Rp {(finalPayable || 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* QR display: mode-aware — dynamic generates QR with amount; static shows uploaded image */}
            {settings.qrisEnabled && (settings.qrisMode || 'static') === 'dynamic' && settings.qrisStatic ? (
              // ── Dynamic mode ────────────────────────────────────────────────
              <div className="flex flex-col items-center gap-2">
                <div className="bg-white rounded-2xl p-3 shadow ring-1 ring-border">
                  {dynamicQrisString ? (
                    <QRCodeDisplay value={dynamicQrisString} size={220} />
                  ) : (
                    <div className="w-[220px] h-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <QrCode className="w-12 h-12 opacity-30 animate-pulse" />
                      <span className="text-xs">Membuat QR Code...</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  QR Code dengan nominal <strong>Rp {(finalPayable || 0).toLocaleString('id-ID')}</strong>.<br />
                  Scan menggunakan aplikasi e-wallet / mobile banking.
                </p>
              </div>
            ) : settings.qrisEnabled && settings.qrisImage ? (
              // ── Static mode — show the original uploaded image ───────────────
              <div className="flex flex-col items-center gap-2">
                <div className="bg-white rounded-2xl p-3 shadow ring-1 ring-border">
                  <img
                    src={settings.qrisImage}
                    alt="QRIS"
                    className="w-[220px] h-[220px] object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  QRIS statis — pelanggan scan lalu input nominal secara manual.
                </p>
              </div>
            ) : null}

            {/* Info banner */}
            <div className="rounded-md bg-info/10 border border-info/30 p-3 text-sm text-info">
              Pastikan pelanggan sudah menyelesaikan pembayaran QRIS sebelum mengkonfirmasi.
            </div>

            {/* Reference note */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">
                Catatan / No. Referensi QRIS (opsional)
              </label>
              <Input
                placeholder="Mis. No. transaksi QRIS, ID pembayaran..."
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                autoFocus={!(settings.qrisEnabled && (settings.qrisImage || settings.qrisStatic))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQrisDialogOpen(false)}>Batal</Button>
            <Button
              className="bg-info hover:bg-info/90 text-info-foreground"
              disabled={processing}
              onClick={() => handleCheckout('QRIS', finalPayable, 0, paymentNote)}
            >
              {processing ? 'Memproses...' : 'Konfirmasi Pembayaran QRIS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card Payment Dialog */}
      <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand" />
              Pembayaran Kartu
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {canRedeem && (
              <div className="flex items-center justify-between rounded-lg bg-warning/10 border border-warning/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-warning shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-warning">Gunakan Poin</p>
                    <p className="text-xs text-warning/80">{customerPoints} poin = Rp {(customerPoints * redeemRate).toLocaleString('id-ID')}</p>
                  </div>
                </div>
                <Switch checked={useRedemption} onCheckedChange={(v: boolean) => setUseRedemption(v)} />
              </div>
            )}
            <div className="flex justify-between items-center text-lg">
              <span className="font-medium text-muted-foreground">Total Tagihan:</span>
              <div className="text-right">
                {redemptionDiscount > 0 && <span className="text-xs text-muted-foreground line-through block">Rp {(discountedTotal || 0).toLocaleString('id-ID')}</span>}
                <span className="font-bold text-foreground text-2xl">Rp {(finalPayable || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>
            <div className="rounded-md bg-brand/10 border border-brand/30 p-3 text-sm text-brand">
              Pastikan transaksi kartu (debit/kredit) berhasil di mesin EDC sebelum mengkonfirmasi.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Catatan / No. Referensi Kartu (opsional)</label>
              <Input
                placeholder="Mis. Approval code, 4 digit terakhir kartu..."
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCardDialogOpen(false)}>Batal</Button>
            <Button
              className="bg-brand hover:bg-brand/90 text-brand-foreground"
              disabled={processing}
              onClick={() => handleCheckout('Kartu', finalPayable, 0, paymentNote)}
            >
              {processing ? 'Memproses...' : 'Konfirmasi Pembayaran Kartu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Menu Dialog — keeps customer display on menu while open */}
      <Dialog open={isShowMenuOpen} onOpenChange={setIsShowMenuOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand" />
              Menampilkan Menu
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-brand/15 flex items-center justify-center">
              <Monitor className="w-8 h-8 text-brand" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Menu produk sedang ditampilkan di layar pelanggan.
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Tutup dialog ini untuk kembali ke tampilan pesanan.
            </p>
          </div>
          <DialogFooter>
            <Button
              className="w-full bg-brand hover:bg-brand/90 text-brand-foreground"
              onClick={() => setIsShowMenuOpen(false)}
            >
              Tutup Menu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Overlay */}
      {successOverlay?.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="bg-success text-success-foreground rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-3 animate-[successPop_0.4s_ease-out]">
            <CheckCircle2 className="w-16 h-16 drop-shadow-lg" strokeWidth={2} />
            <div className="text-2xl font-bold tracking-tight">Transaksi Berhasil!</div>
            {successOverlay.txId && (
              <div className="text-success-foreground/80 text-sm">Struk #{successOverlay.txId}</div>
            )}
            {successOverlay.total != null && (
              <div className="text-3xl font-extrabold mt-1">
                Rp {(successOverlay.total || 0).toLocaleString('id-ID')}
              </div>
            )}
          </div>
          <style>{`
            @keyframes successPop {
              0% { transform: scale(0.5); opacity: 0; }
              60% { transform: scale(1.05); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Issue #2: ConfirmDialog replacements for window.confirm() */}
      <ConfirmDialog
        open={!!pendingResumeHeld}
        onOpenChange={(open) => !open && setPendingResumeHeld(null)}
        title="Ganti Keranjang?"
        description="Keranjang saat ini berisi item lain. Melanjutkan pesanan ditahan akan mengganti keranjang. Lanjutkan?"
        confirmLabel="Ya, Lanjutkan"
        variant="destructive"
        onConfirm={() => pendingResumeHeld && doResumeHeld(pendingResumeHeld)}
      />
      <ConfirmDialog
        open={!!pendingDeleteHeld}
        onOpenChange={(open) => !open && setPendingDeleteHeld(null)}
        title="Hapus Pesanan Ditahan?"
        description={pendingDeleteHeld ? `Hapus pesanan "${pendingDeleteHeld.label || pendingDeleteHeld.id}"? Tindakan ini tidak bisa dibatalkan.` : ''}
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={() => pendingDeleteHeld && doDeleteHeld(pendingDeleteHeld)}
      />

      {/* Virtual Keyboard */}
      {!!settings.virtualKeyboard && (
        <VirtualKeyboard
          mode={focusedInput === 'amount' ? 'numeric' : 'text'}
          visible={focusedInput !== null}
          onDismiss={() => setFocusedInput(null)}
          onKeyPress={(key) => {
            if (focusedInput === 'search') {
              setSearchInput(prev => prev + key);
              setSearchQuery(prev => prev + key);
            } else if (focusedInput === 'amount') {
              setAmountPaid(prev => {
                const s = String(prev === '' ? '' : prev) + key;
                return Number(s) || '';
              });
            }
          }}
          onBackspace={() => {
            if (focusedInput === 'search') {
              setSearchInput(prev => prev.slice(0, -1));
              setSearchQuery(prev => prev.slice(0, -1));
            } else if (focusedInput === 'amount') {
              setAmountPaid(prev => {
                const s = String(prev === '' ? '' : prev).slice(0, -1);
                return s ? Number(s) : '';
              });
            }
          }}
          onClear={() => {
            if (focusedInput === 'search') { setSearchInput(''); setSearchQuery(''); }
            else if (focusedInput === 'amount') setAmountPaid('');
          }}
        />
      )}
    </div>
  );
}
