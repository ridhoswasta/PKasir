import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, BarChart, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users, UserCircle, Layers, Archive, Award, AlertTriangle, Zap, Boxes, Percent, Tag, BarChart3, PieChart as PieChartIcon, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--info)', 'var(--success)', 'var(--brand)'];

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

type DateRange = '7d' | '30d' | '90d' | 'all' | 'custom';

export function ReportsModule() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [moneyFlow, setMoneyFlow] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [range, setRange] = useState<DateRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [settings, setSettings] = useState<any>({});
  const [exportingPDF, setExportingPDF] = useState(false);
  // Ingredient cost per product (recipe). Effective HPP = costPrice + this.
  const [recipeCosts, setRecipeCosts] = useState<Record<string, number>>({});

  useEffect(() => {
    invoke<any[]>('get_transactions').then(setTransactions).catch(() => {});
    invoke<any[]>('get_money_flow').then(setMoneyFlow).catch(() => {});
    invoke<any[]>('get_products').then(setProducts).catch(() => {});
    invoke<any[]>('get_customers').then(setCustomers).catch(() => {});
    invoke<any>('get_settings').then(setSettings).catch(() => {});
    invoke<Record<string, number>>('get_all_product_costs').then(setRecipeCosts).catch(() => {});
  }, []);

  // Filter by date range
  const filtered = useMemo(() => {
    if (range === 'all') return transactions;
    let from: Date, to: Date;
    if (range === 'custom') {
      if (!customFrom || !customTo) return transactions;
      from = startOfDay(new Date(customFrom));
      to = endOfDay(new Date(customTo));
    } else {
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      from = startOfDay(subDays(new Date(), days));
      to = endOfDay(new Date());
    }
    return transactions.filter(t => {
      const d = new Date(t.date);
      return isWithinInterval(d, { start: from, end: to });
    });
  }, [transactions, range, customFrom, customTo]);

  const filteredFlow = useMemo(() => {
    if (range === 'all') return moneyFlow;
    let from: Date, to: Date;
    if (range === 'custom') {
      if (!customFrom || !customTo) return moneyFlow;
      from = startOfDay(new Date(customFrom));
      to = endOfDay(new Date(customTo));
    } else {
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      from = startOfDay(subDays(new Date(), days));
      to = endOfDay(new Date());
    }
    return moneyFlow.filter(f => {
      const d = new Date(f.date);
      return isWithinInterval(d, { start: from, end: to });
    });
  }, [moneyFlow, range, customFrom, customTo]);

  // KPIs
  const totalSales = filtered.reduce((s, t) => s + (t.total || 0), 0);
  const totalDiscount = filtered.reduce((s, t) => s + (t.discount || 0), 0);
  const totalTx = filtered.length;
  const txWithDiscountCount = filtered.filter(t => (t.discount || 0) > 0).length;
  const avgTx = totalTx > 0 ? Math.round(totalSales / totalTx) : 0;
  const totalItemsSold = filtered.reduce((s, t) => s + (t.items || []).reduce((a: number, i: any) => a + i.quantity, 0), 0);

  // Daily chart
  const dailyMap = filtered.reduce((acc: any, t: any) => {
    const d = format(new Date(t.date), 'yyyy-MM-dd');
    if (!acc[d]) acc[d] = { date: d, omset: 0, count: 0, discount: 0 };
    acc[d].omset += (t.total || 0);
    acc[d].count += 1;
    acc[d].discount += (t.discount || 0);
    return acc;
  }, {});
  const dailyChart = Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // Product rankings
  const productMap = filtered.reduce((acc: any, t: any) => {
    (t.items || []).forEach((it: any) => {
      if (!acc[it.name]) acc[it.name] = { name: it.name, qty: 0, revenue: 0 };
      acc[it.name].qty += it.quantity;
      acc[it.name].revenue += (it.price || 0) * it.quantity;
    });
    return acc;
  }, {});
  const topProducts = Object.values(productMap).sort((a: any, b: any) => b.revenue - a.revenue);

  // Payment methods
  const payMap = filtered.reduce((acc: any, t: any) => {
    if (!acc[t.paymentMethod]) acc[t.paymentMethod] = { name: t.paymentMethod, value: 0, count: 0 };
    acc[t.paymentMethod].value += t.total;
    acc[t.paymentMethod].count += 1;
    return acc;
  }, {});
  const paymentData = Object.values(payMap);

  // Hourly heatmap
  const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}:00`, count: 0, total: 0 }));
  filtered.forEach(t => {
    const h = new Date(t.date).getHours();
    hourly[h].count += 1;
    hourly[h].total += t.total;
  });

  // P&L
  let totalCostOfGoods = 0, totalRevenue = 0;
  filtered.forEach(t => (t.items || []).forEach((it: any) => {
    totalRevenue += (it.price || 0) * it.quantity;
    totalCostOfGoods += (it.costPrice || 0) * it.quantity;
  }));
  const totalTax = filtered.reduce((s, t) => s + (t.tax || 0), 0);
  const totalServiceCharge = filtered.reduce((s, t) => s + (t.serviceCharge || 0), 0);
  const totalPassThrough = totalTax + totalServiceCharge;
  const netSales = totalRevenue - totalDiscount;
  const totalGrossSales = totalRevenue + totalPassThrough;
  const grossProfit = netSales - totalCostOfGoods;
  const otherIncome = filteredFlow.filter(f => f.type === 'Pemasukan' && f.category !== 'Penjualan').reduce((s, f) => s + f.amount, 0);
  const totalExpenses = filteredFlow.filter(f => f.type === 'Pengeluaran').reduce((s, f) => s + f.amount, 0);
  const netProfit = grossProfit + otherIncome - totalExpenses;
  const margin = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : '0';

  // Expense breakdown
  const expenseMap = filteredFlow.filter(f => f.type === 'Pengeluaran').reduce((acc: any, f: any) => {
    const cat = f.category || 'Lainnya';
    if (!acc[cat]) acc[cat] = { name: cat, value: 0 };
    acc[cat].value += f.amount;
    return acc;
  }, {});
  const expenseData = Object.values(expenseMap).sort((a: any, b: any) => b.value - a.value);

  // ─── Category breakdown (revenue by product category) ───
  const productLookup = useMemo(() => {
    const m: Record<string, any> = {};
    products.forEach((p: any) => { if (p.name) m[p.name] = p; });
    return m;
  }, [products]);

  const categoryBreakdown = useMemo(() => {
    const acc: Record<string, { name: string; qty: number; revenue: number; products: Set<string>; cogs: number }> = {};
    filtered.forEach(t => {
      (t.items || []).forEach((it: any) => {
        const product = productLookup[it.name];
        const cat = product?.category || 'Lain-lain';
        if (!acc[cat]) acc[cat] = { name: cat, qty: 0, revenue: 0, products: new Set(), cogs: 0 };
        acc[cat].qty += it.quantity;
        acc[cat].revenue += (it.price || 0) * it.quantity;
        acc[cat].cogs += ((product?.costPrice || 0) + (product ? recipeCosts[product.id] || 0 : 0)) * it.quantity;
        acc[cat].products.add(it.name);
      });
    });
    return Object.values(acc)
      .map(c => ({ ...c, productCount: c.products.size, profit: c.revenue - c.cogs, margin: c.revenue > 0 ? ((c.revenue - c.cogs) / c.revenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered, productLookup, recipeCosts]);
  const totalCategoryRevenue = categoryBreakdown.reduce((s, c) => s + c.revenue, 0);

  // ─── Cashier performance ───
  const cashierBreakdown = useMemo(() => {
    const acc: Record<string, { name: string; txCount: number; revenue: number; items: number }> = {};
    filtered.forEach(t => {
      const name = t.cashier || 'Tidak diketahui';
      if (!acc[name]) acc[name] = { name, txCount: 0, revenue: 0, items: 0 };
      acc[name].txCount += 1;
      acc[name].revenue += t.total || 0;
      acc[name].items += (t.items || []).reduce((s: number, i: any) => s + i.quantity, 0);
    });
    return Object.values(acc)
      .map(c => ({ ...c, avgTicket: c.txCount > 0 ? c.revenue / c.txCount : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // ─── Discount & promo breakdown by name ───
  const discountBreakdown = useMemo(() => {
    const acc: Record<string, { name: string; txCount: number; totalDiscount: number; totalRevenue: number; firstDate: string; lastDate: string }> = {};
    filtered.forEach(t => {
      if (!t.discount || t.discount <= 0) return;
      const name = (t.discountName && String(t.discountName).trim()) || 'Tanpa Nama';
      if (!acc[name]) acc[name] = { name, txCount: 0, totalDiscount: 0, totalRevenue: 0, firstDate: t.date, lastDate: t.date };
      acc[name].txCount += 1;
      acc[name].totalDiscount += t.discount || 0;
      acc[name].totalRevenue += t.total || 0;
      if (new Date(t.date) > new Date(acc[name].lastDate)) acc[name].lastDate = t.date;
      if (new Date(t.date) < new Date(acc[name].firstDate)) acc[name].firstDate = t.date;
    });
    return Object.values(acc)
      .map(d => ({ ...d, avgDiscount: d.txCount > 0 ? d.totalDiscount / d.txCount : 0 }))
      .sort((a, b) => b.totalDiscount - a.totalDiscount);
  }, [filtered]);
  const avgDiscountPerTx = txWithDiscountCount > 0 ? totalDiscount / txWithDiscountCount : 0;
  const discountedRevenue = useMemo(
    () => filtered.filter(t => (t.discount || 0) > 0).reduce((s, t) => s + (t.total || 0), 0),
    [filtered],
  );

  // ─── Customer analytics ───
  const WALK_IN_NAMES = new Set(['Walk-In', 'Walk-In Customer', '']);
  const customerBreakdown = useMemo(() => {
    const acc: Record<string, { name: string; txCount: number; revenue: number; items: number; firstDate: string; lastDate: string }> = {};
    filtered.forEach(t => {
      const name = t.customer || 'Walk-In';
      if (!acc[name]) acc[name] = { name, txCount: 0, revenue: 0, items: 0, firstDate: t.date, lastDate: t.date };
      acc[name].txCount += 1;
      acc[name].revenue += t.total || 0;
      acc[name].items += (t.items || []).reduce((s: number, i: any) => s + i.quantity, 0);
      if (new Date(t.date) > new Date(acc[name].lastDate)) acc[name].lastDate = t.date;
      if (new Date(t.date) < new Date(acc[name].firstDate)) acc[name].firstDate = t.date;
    });
    return Object.values(acc).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const identifiedCustomers = customerBreakdown.filter(c => !WALK_IN_NAMES.has(c.name));
  const uniqueCustomerCount = identifiedCustomers.length;
  const returningCount = identifiedCustomers.filter(c => c.txCount > 1).length;
  const returningRate = uniqueCustomerCount > 0 ? (returningCount / uniqueCustomerCount * 100).toFixed(1) : '0';
  const walkInStats = customerBreakdown.find(c => WALK_IN_NAMES.has(c.name));
  const avgSpendPerCustomer = uniqueCustomerCount > 0
    ? identifiedCustomers.reduce((s, c) => s + c.revenue, 0) / uniqueCustomerCount
    : 0;

  const frequencyBuckets = [
    { range: '1×', count: identifiedCustomers.filter(c => c.txCount === 1).length },
    { range: '2×', count: identifiedCustomers.filter(c => c.txCount === 2).length },
    { range: '3–5×', count: identifiedCustomers.filter(c => c.txCount >= 3 && c.txCount <= 5).length },
    { range: '6–10×', count: identifiedCustomers.filter(c => c.txCount >= 6 && c.txCount <= 10).length },
    { range: '10×+', count: identifiedCustomers.filter(c => c.txCount > 10).length },
  ];

  // ─── Stock analytics ───
  const daysInRange = useMemo(() => {
    if (range === '7d') return 7;
    if (range === '30d') return 30;
    if (range === '90d') return 90;
    if (filtered.length === 0) return 1;
    const ds = filtered.map(t => new Date(t.date).getTime());
    const span = (Math.max(...ds) - Math.min(...ds)) / 86400000;
    return Math.max(1, span);
  }, [range, filtered]);

  const stockBreakdown = useMemo(() => {
    const sold: Record<string, number> = {};
    filtered.forEach(t => (t.items || []).forEach((it: any) => {
      sold[it.name] = (sold[it.name] || 0) + it.quantity;
    }));
    return products.map((p: any) => {
      const soldQty = sold[p.name] || 0;
      const dailyRate = soldQty / daysInRange;
      const stock = p.stock || 0;
      const daysUntilOut = dailyRate > 0 ? Math.floor(stock / dailyRate) : null;
      return {
        id: p.id,
        name: p.name,
        category: p.category || 'Lain-lain',
        stock,
        costPrice: (p.costPrice || 0) + (recipeCosts[p.id] || 0),
        price: p.price || 0,
        soldQty,
        dailyRate,
        daysUntilOut,
        stockValue: ((p.costPrice || 0) + (recipeCosts[p.id] || 0)) * stock,
        retailValue: (p.price || 0) * stock,
      };
    });
  }, [products, filtered, daysInRange, recipeCosts]);

  const totalStockValue = stockBreakdown.reduce((s, p) => s + p.stockValue, 0);
  const totalRetailValue = stockBreakdown.reduce((s, p) => s + p.retailValue, 0);
  const outOfStockCount = stockBreakdown.filter(p => p.stock === 0).length;
  const lowStockCount = stockBreakdown.filter(p => p.stock > 0 && p.stock <= 10).length;
  const criticalStock = stockBreakdown
    .filter(p => p.stock > 0 && p.daysUntilOut !== null && (p.daysUntilOut as number) <= 7)
    .sort((a, b) => (a.daysUntilOut as number) - (b.daysUntilOut as number));
  const slowMovers = stockBreakdown.filter(p => p.stock > 0 && p.soldQty === 0);
  const fastMovers = [...stockBreakdown].filter(p => p.soldQty > 0).sort((a, b) => b.soldQty - a.soldQty).slice(0, 10);

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      // Lazy-loaded: the PDF stack (jsPDF + html2canvas + canvg) is heavy and only
      // pulled in when the user actually exports, keeping the initial load light.
      const { exportReportPDF } = await import('../services/pdfExport');
      const storeName = (settings.shopName || settings.receiptHeader || 'PKasir').split('\n')[0].trim();
      const result = await exportReportPDF({
        storeName,
        logo: settings.logo,
        range,
        customFrom,
        customTo,
        totalSales,
        totalTx,
        avgTx,
        totalDiscount,
        grossProfit,
        margin,
        topProducts: topProducts as any[],
        transactions: filtered,
      });
      if (!result.saved) {
        toast.info('Ekspor PDF dibatalkan');
      } else if (result.path) {
        toast.success(`PDF disimpan ke ${result.path}`);
      } else {
        toast.success('PDF berhasil diekspor');
      }
    } catch (e: any) {
      toast.error('Gagal ekspor PDF: ' + (e?.message || e));
    } finally {
      setExportingPDF(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Ringkasan' },
    { id: 'sales', label: 'Penjualan' },
    { id: 'products', label: 'Produk' },
    { id: 'categories', label: 'Kategori' },
    { id: 'payments', label: 'Pembayaran' },
    { id: 'discounts', label: 'Diskon & Promo' },
    { id: 'cashiers', label: 'Kasir' },
    { id: 'customers', label: 'Pelanggan' },
    { id: 'stock', label: 'Stok' },
    { id: 'profit', label: 'Laba Rugi' },
  ];

  const ranges: { id: DateRange; label: string }[] = [
    { id: '7d', label: '7 Hari' },
    { id: '30d', label: '30 Hari' },
    { id: '90d', label: '90 Hari' },
    { id: 'all', label: 'Semua' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full bg-muted/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Laporan & Analitik</h2>
          <p className="text-sm text-muted-foreground mt-1">Insight bisnis real-time untuk keputusan yang lebih baik</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-card rounded-xl border border-border shadow-sm p-1 gap-0.5">
            {ranges.map(r => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  range === r.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-1.5">
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 text-xs w-32" />
              <span className="text-muted-foreground/70 text-xs">—</span>
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 text-xs w-32" />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={exportingPDF || filtered.length === 0}
            className="h-8 gap-1.5 text-xs font-semibold"
            title="Export laporan ke PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            {exportingPDF ? 'Mengekspor...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 bg-card rounded-xl border border-border shadow-sm p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-[100px] px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === t.id
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════ OVERVIEW ═══════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard icon={DollarSign} label="Total Omset" value={fmt(totalSales)} color="indigo"
              sub={`Rata-rata ${fmt(avgTx)} / transaksi`} trend={totalSales > 0 ? 'up' : undefined} />
            <KPICard icon={Percent} label="Total Diskon" value={fmt(totalDiscount)} color="rose"
              sub={`${txWithDiscountCount} transaksi`} />
            <KPICard icon={ShoppingCart} label="Transaksi" value={totalTx.toLocaleString()} color="cyan"
              sub={`${totalItemsSold} item terjual`} />
            <KPICard icon={TrendingUp} label="Laba Kotor" value={fmt(grossProfit)} color="emerald"
              sub={`Margin ${margin}%`} trend={grossProfit > 0 ? 'up' : grossProfit < 0 ? 'down' : undefined} />
            <KPICard icon={TrendingDown} label="Pengeluaran" value={fmt(totalExpenses)} color="rose"
              sub={expenseData.length > 0 ? `${expenseData.length} kategori` : 'Tidak ada'} />
          </div>

          {/* Revenue Chart */}
          <Card className="border border-border shadow-sm bg-card overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground/80">Tren Pendapatan Harian</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyChart} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="omsetGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={d => format(new Date(d), 'dd MMM', { locale: idLocale })} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 13 }}
                    labelFormatter={l => format(new Date(l), 'EEEE, dd MMMM yyyy', { locale: idLocale })}
                    formatter={(v: any, n: any) => {
                      if (n === 'omset') return [fmt(v), 'Omset'];
                      if (n === 'diskon') return [fmt(v), 'Diskon'];
                      return [v, n];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area yAxisId="left" type="monotone" dataKey="omset" name="Omset" fill="url(#omsetGrad)" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
                  <Bar yAxisId="right" dataKey="count" name="Transaksi" fill="var(--chart-2)" radius={[4, 4, 0, 0]} barSize={16} />
                  {totalDiscount > 0 && (
                    <Bar yAxisId="left" dataKey="diskon" name="Diskon" fill="var(--destructive)" radius={[2, 2, 0, 0]} barSize={10} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Two column: Top Products + Peak Hours */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Produk Terlaris</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topProducts.slice(0, 5).map((p: any, i) => {
                    const maxRev = (topProducts[0] as any)?.revenue || 1;
                    return (
                      <div key={p.name} className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-warning text-warning-foreground' : i === 1 ? 'bg-muted text-muted-foreground' : i === 2 ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground'
                        }`}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm font-medium truncate">{p.name}</span>
                            <span className="text-xs text-muted-foreground ml-2 shrink-0">{p.qty} terjual</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(p.revenue / maxRev) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-foreground/80 w-28 text-right">{fmt(p.revenue)}</span>
                      </div>
                    );
                  })}
                  {topProducts.length === 0 && <p className="text-muted-foreground/70 text-sm text-center py-6">Belum ada data</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Jam Sibuk (Peak Hours)</CardTitle></CardHeader>
              <CardContent className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourly.filter(h => h.count > 0)} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(v: any) => [v, 'Transaksi']} />
                    <Bar dataKey="count" name="Transaksi" radius={[6, 6, 0, 0]} barSize={14}>
                      {hourly.filter(h => h.count > 0).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ SALES ═══════ */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Grafik Omset & Transaksi Harian</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyChart} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={d => format(new Date(d), 'dd MMM', { locale: idLocale })} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 13 }}
                    labelFormatter={l => format(new Date(l), 'dd MMMM yyyy', { locale: idLocale })}
                    formatter={(v: any, n: any) => [n === 'omset' ? fmt(v) : v, n === 'omset' ? 'Omset' : 'Transaksi']} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area yAxisId="left" type="monotone" dataKey="omset" name="Omset" fill="url(#salesGrad)" stroke="var(--success)" strokeWidth={2.5} dot={false} />
                  <Bar yAxisId="right" dataKey="count" name="Transaksi" fill="var(--success)" radius={[4, 4, 0, 0]} barSize={14} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm overflow-hidden bg-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Tanggal</TableHead>
                    <TableHead className="text-center font-semibold">Transaksi</TableHead>
                    <TableHead className="text-right font-semibold">Omset</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyChart.map((d: any) => (
                    <TableRow key={d.date} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{format(new Date(d.date), 'EEEE, dd MMM yyyy', { locale: idLocale })}</TableCell>
                      <TableCell className="text-center"><span className="inline-flex items-center justify-center bg-info/12 text-info text-xs font-bold w-8 h-6 rounded-md">{d.count}</span></TableCell>
                      <TableCell className="text-right font-semibold">{fmt(d.omset)}</TableCell>
                    </TableRow>
                  ))}
                  {dailyChart.length > 0 && (
                    <TableRow className="bg-primary hover:bg-primary">
                      <TableCell className="font-bold text-primary-foreground">Total</TableCell>
                      <TableCell className="text-center font-bold text-primary-foreground">{totalTx}</TableCell>
                      <TableCell className="text-right font-bold text-primary-foreground">{fmt(totalSales)}</TableCell>
                    </TableRow>
                  )}
                  {dailyChart.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground/70 py-10">Belum ada data transaksi</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════ PRODUCTS ═══════ */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Top 10 Produk Berdasarkan Pendapatan</CardTitle></CardHeader>
              <CardContent className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(v: any) => [fmt(v), 'Pendapatan']} />
                    <Bar dataKey="revenue" name="Pendapatan" radius={[0, 6, 6, 0]} barSize={18}>
                      {topProducts.slice(0, 10).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Top 10 Produk Berdasarkan Kuantitas</CardTitle></CardHeader>
              <CardContent className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...topProducts].sort((a: any, b: any) => b.qty - a.qty).slice(0, 10)} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(v: any) => [v, 'Terjual']} />
                    <Bar dataKey="qty" name="Terjual" radius={[0, 6, 6, 0]} barSize={18}>
                      {topProducts.slice(0, 10).map((_, i) => <Cell key={i} fill={PALETTE[(i + 3) % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border shadow-sm overflow-hidden bg-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8 font-semibold">#</TableHead>
                    <TableHead className="font-semibold">Produk</TableHead>
                    <TableHead className="text-center font-semibold">Qty Terjual</TableHead>
                    <TableHead className="text-right font-semibold">Total Pendapatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p: any, i) => (
                    <TableRow key={p.name} className="hover:bg-muted/50">
                      <TableCell className="text-muted-foreground/70 font-medium">{i + 1}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-center">{p.qty}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {topProducts.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground/70 py-10">Belum ada data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════ PAYMENTS ═══════ */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Distribusi Metode Pembayaran</CardTitle></CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={4} dataKey="value" cornerRadius={6}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}>
                      {paymentData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 13 }}
                      formatter={(v: any) => [fmt(v), 'Total']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Detail Pembayaran</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {paymentData.map((p: any, i) => {
                    const maxVal = Math.max(...paymentData.map((x: any) => x.value), 1);
                    return (
                      <div key={p.name} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                            <span className="font-medium text-sm">{p.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-sm">{fmt(p.value)}</span>
                            <span className="text-xs text-muted-foreground/70 ml-2">({p.count}x)</span>
                          </div>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${(p.value / maxVal) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                        </div>
                      </div>
                    );
                  })}
                  {paymentData.length === 0 && <p className="text-muted-foreground/70 text-sm text-center py-8">Belum ada data</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ DISCOUNTS & PROMOS ═══════ */}
      {activeTab === 'discounts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard icon={Percent} label="Total Diskon" value={fmt(totalDiscount)} color="rose"
              sub={`${txWithDiscountCount} dari ${totalTx} transaksi`} />
            <KPICard icon={Tag} label="Jenis Diskon Terpakai" value={String(discountBreakdown.length)} color="indigo"
              sub={discountBreakdown[0] ? `Teratas: ${discountBreakdown[0].name}` : 'Belum ada'} />
            <KPICard icon={DollarSign} label="Avg Diskon / Transaksi" value={fmt(avgDiscountPerTx)} color="amber"
              sub={txWithDiscountCount > 0 ? 'Per transaksi berdiskon' : 'Tidak ada diskon'} />
            <KPICard icon={ShoppingCart} label="Omset Berdiskon" value={fmt(discountedRevenue)} color="emerald"
              sub={totalSales > 0 ? `${((discountedRevenue / totalSales) * 100).toFixed(1)}% dari total omset` : '0% dari total omset'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Pangsa Diskon per Nama</CardTitle></CardHeader>
              <CardContent className="h-[320px]">
                {discountBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={discountBreakdown} cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={4} dataKey="totalDiscount" cornerRadius={6}
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}>
                        {discountBreakdown.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 13 }}
                        formatter={(v: any) => [fmt(v), 'Diskon']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState compact icon={PieChartIcon} title="Belum ada diskon" description="Belum ada diskon pada periode ini" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Frekuensi Pemakaian</CardTitle></CardHeader>
              <CardContent className="h-[320px]">
                {discountBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={discountBreakdown} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={120} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 12 }}
                        formatter={(v: any) => [v, 'Transaksi']} />
                      <Bar dataKey="txCount" name="Transaksi" radius={[0, 6, 6, 0]} barSize={18}>
                        {discountBreakdown.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState compact icon={BarChart3} title="Belum ada diskon" description="Belum ada diskon pada periode ini" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border shadow-sm overflow-hidden bg-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8 font-semibold">#</TableHead>
                    <TableHead className="font-semibold">Nama Diskon / Promo</TableHead>
                    <TableHead className="text-center font-semibold">Transaksi</TableHead>
                    <TableHead className="text-right font-semibold">Total Diskon</TableHead>
                    <TableHead className="text-right font-semibold">Avg / Transaksi</TableHead>
                    <TableHead className="text-right font-semibold">Omset Setelah Diskon</TableHead>
                    <TableHead className="text-right font-semibold">Pangsa Diskon</TableHead>
                    <TableHead className="font-semibold">Terakhir Dipakai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discountBreakdown.map((d: any, i) => (
                    <TableRow key={d.name} className="hover:bg-muted/50">
                      <TableCell className="text-muted-foreground/70 font-medium">{i + 1}</TableCell>
                      <TableCell className="font-medium flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                        {d.name}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center bg-destructive/12 text-destructive text-xs font-bold w-8 h-6 rounded-md">
                          {d.txCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-destructive">-{fmt(d.totalDiscount)}</TableCell>
                      <TableCell className="text-right">{fmt(d.avgDiscount)}</TableCell>
                      <TableCell className="text-right">{fmt(d.totalRevenue)}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {totalDiscount > 0 ? ((d.totalDiscount / totalDiscount) * 100).toFixed(1) : '0'}%
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(d.lastDate), 'dd MMM yyyy', { locale: idLocale })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {discountBreakdown.length > 0 && (
                    <TableRow className="bg-destructive hover:bg-destructive">
                      <TableCell colSpan={2} className="font-bold text-destructive-foreground">Total</TableCell>
                      <TableCell className="text-center font-bold text-destructive-foreground">{txWithDiscountCount}</TableCell>
                      <TableCell className="text-right font-bold text-destructive-foreground">-{fmt(totalDiscount)}</TableCell>
                      <TableCell className="text-right font-bold text-destructive-foreground">{fmt(avgDiscountPerTx)}</TableCell>
                      <TableCell className="text-right font-bold text-destructive-foreground">{fmt(discountedRevenue)}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  )}
                  {discountBreakdown.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground/70 py-10">Belum ada transaksi berdiskon pada periode ini</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════ CATEGORIES ═══════ */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard icon={Layers} label="Total Kategori" value={String(categoryBreakdown.length)} color="indigo"
              sub={`${Object.keys(productLookup).length} produk terdaftar`} />
            <KPICard icon={Award} label="Kategori Teratas" value={categoryBreakdown[0]?.name || '-'} color="amber"
              sub={categoryBreakdown[0] ? fmt(categoryBreakdown[0].revenue) : 'Belum ada data'} />
            <KPICard icon={ShoppingCart} label="Item Terjual" value={categoryBreakdown.reduce((s, c) => s + c.qty, 0).toLocaleString()} color="cyan" />
            <KPICard icon={TrendingUp} label="Rata-rata Margin" value={`${categoryBreakdown.length > 0 ? (categoryBreakdown.reduce((s, c) => s + c.margin, 0) / categoryBreakdown.length).toFixed(1) : '0'}%`} color="emerald" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Pangsa Pendapatan per Kategori</CardTitle></CardHeader>
              <CardContent className="h-[320px]">
                {categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={4} dataKey="revenue" cornerRadius={6}
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}>
                        {categoryBreakdown.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 13 }}
                        formatter={(v: any) => [fmt(v), 'Pendapatan']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState compact icon={PieChartIcon} title="Belum ada data" description="Belum ada data pada periode ini" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Performa Kategori</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryBreakdown.map((c: any, i) => (
                    <div key={c.name} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                          <span className="text-sm font-medium">{c.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c.productCount} produk</span>
                        </div>
                        <span className="text-sm font-semibold">{fmt(c.revenue)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${totalCategoryRevenue > 0 ? (c.revenue / totalCategoryRevenue) * 100 : 0}%`,
                          backgroundColor: PALETTE[i % PALETTE.length],
                        }} />
                      </div>
                    </div>
                  ))}
                  {categoryBreakdown.length === 0 && <p className="text-muted-foreground/70 text-sm text-center py-6">Belum ada data</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border shadow-sm overflow-hidden bg-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Kategori</TableHead>
                    <TableHead className="text-center font-semibold">Produk</TableHead>
                    <TableHead className="text-center font-semibold">Qty</TableHead>
                    <TableHead className="text-right font-semibold">Pendapatan</TableHead>
                    <TableHead className="text-right font-semibold">Laba Kotor</TableHead>
                    <TableHead className="text-right font-semibold">Margin</TableHead>
                    <TableHead className="text-right font-semibold">Pangsa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryBreakdown.map((c: any, i) => (
                    <TableRow key={c.name} className="hover:bg-muted/50">
                      <TableCell className="font-medium flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                        {c.name}
                      </TableCell>
                      <TableCell className="text-center">{c.productCount}</TableCell>
                      <TableCell className="text-center">{c.qty}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(c.revenue)}</TableCell>
                      <TableCell className="text-right">{fmt(c.profit)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${c.margin >= 40 ? 'bg-success/12 text-success' : c.margin >= 20 ? 'bg-warning/15 text-warning' : 'bg-destructive/12 text-destructive'}`}>
                          {c.margin.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {totalCategoryRevenue > 0 ? ((c.revenue / totalCategoryRevenue) * 100).toFixed(1) : '0'}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {categoryBreakdown.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground/70 py-10">Belum ada data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════ CASHIERS ═══════ */}
      {activeTab === 'cashiers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard icon={UserCircle} label="Jumlah Kasir Aktif" value={String(cashierBreakdown.length)} color="indigo"
              sub={`${totalTx} transaksi dilayani`} />
            <KPICard icon={Award} label="Kasir Terbaik" value={cashierBreakdown[0]?.name || '-'} color="amber"
              sub={cashierBreakdown[0] ? fmt(cashierBreakdown[0].revenue) : 'Belum ada data'} />
            <KPICard icon={ShoppingCart} label="Avg Transaksi/Kasir" value={cashierBreakdown.length > 0 ? Math.round(totalTx / cashierBreakdown.length).toLocaleString() : '0'} color="cyan" />
            <KPICard icon={DollarSign} label="Avg Pendapatan/Kasir" value={fmt(cashierBreakdown.length > 0 ? totalSales / cashierBreakdown.length : 0)} color="emerald" />
          </div>

          {cashierBreakdown.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cashierBreakdown.slice(0, 3).map((c: any, i) => {
                const accents = ['bg-warning', 'bg-muted-foreground/40', 'bg-brand'];
                const labels = ['Juara 1', 'Juara 2', 'Juara 3'];
                return (
                  <Card key={c.name} className="border border-border shadow-sm overflow-hidden bg-card">
                    <div className={`h-1.5 ${accents[i]}`} />
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Award className={`w-4 h-4 ${i === 0 ? 'text-warning' : i === 1 ? 'text-muted-foreground/70' : 'text-brand'}`} />
                          {labels[i]}
                        </span>
                        <UserCircle className="w-5 h-5 text-muted-foreground/70" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground/90 mb-3 truncate">{c.name}</h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Pendapatan</p>
                          <p className="font-bold text-foreground/90 text-sm">{fmt(c.revenue)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Transaksi</p>
                          <p className="font-bold text-foreground/90 text-sm">{c.txCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Ticket</p>
                          <p className="font-bold text-foreground/90 text-sm">{fmt(c.avgTicket)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Item Terjual</p>
                          <p className="font-bold text-foreground/90 text-sm">{c.items}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Card className="border border-border shadow-sm bg-card">
            <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Pendapatan per Kasir</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
              {cashierBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashierBreakdown} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={120} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(v: any) => [fmt(v), 'Pendapatan']} />
                    <Bar dataKey="revenue" name="Pendapatan" radius={[0, 6, 6, 0]} barSize={20}>
                      {cashierBreakdown.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <EmptyState compact icon={BarChart3} title="Belum ada data" description="Belum ada data pada periode ini" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm overflow-hidden bg-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8 font-semibold">#</TableHead>
                    <TableHead className="font-semibold">Kasir</TableHead>
                    <TableHead className="text-center font-semibold">Transaksi</TableHead>
                    <TableHead className="text-center font-semibold">Item Terjual</TableHead>
                    <TableHead className="text-right font-semibold">Avg Ticket</TableHead>
                    <TableHead className="text-right font-semibold">Total Pendapatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashierBreakdown.map((c: any, i) => (
                    <TableRow key={c.name} className="hover:bg-muted/50">
                      <TableCell className="text-muted-foreground/70 font-medium">{i + 1}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-center">{c.txCount}</TableCell>
                      <TableCell className="text-center">{c.items}</TableCell>
                      <TableCell className="text-right">{fmt(c.avgTicket)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(c.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {cashierBreakdown.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground/70 py-10">Belum ada data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════ CUSTOMERS ═══════ */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard icon={Users} label="Pelanggan Teridentifikasi" value={uniqueCustomerCount.toLocaleString()} color="indigo"
              sub={`${customers.length} terdaftar di database`} />
            <KPICard icon={TrendingUp} label="Returning Rate" value={`${returningRate}%`} color="emerald"
              sub={`${returningCount} dari ${uniqueCustomerCount} pelanggan`} trend={Number(returningRate) >= 30 ? 'up' : undefined} />
            <KPICard icon={DollarSign} label="Avg Spend / Pelanggan" value={fmt(avgSpendPerCustomer)} color="cyan" />
            <KPICard icon={UserCircle} label="Walk-In" value={walkInStats ? `${walkInStats.txCount}` : '0'} color="slate"
              sub={walkInStats ? `Kontribusi ${fmt(walkInStats.revenue)}` : 'Tidak ada'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Top 10 Pelanggan</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {identifiedCustomers.slice(0, 10).map((c: any, i) => {
                    const maxRev = (identifiedCustomers[0] as any)?.revenue || 1;
                    return (
                      <div key={c.name} className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-warning text-warning-foreground' : i === 1 ? 'bg-muted text-muted-foreground' : i === 2 ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground'
                        }`}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm font-medium truncate">{c.name}</span>
                            <span className="text-xs text-muted-foreground ml-2 shrink-0">{c.txCount}× kunjungan</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-info" style={{ width: `${(c.revenue / maxRev) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-foreground/80 w-28 text-right">{fmt(c.revenue)}</span>
                      </div>
                    );
                  })}
                  {identifiedCustomers.length === 0 && <p className="text-muted-foreground/70 text-sm text-center py-6">Belum ada pelanggan teridentifikasi</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Frekuensi Kunjungan</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={frequencyBuckets} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(v: any) => [v, 'Pelanggan']} />
                    <Bar dataKey="count" name="Pelanggan" radius={[6, 6, 0, 0]} barSize={36}>
                      {frequencyBuckets.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border shadow-sm overflow-hidden bg-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8 font-semibold">#</TableHead>
                    <TableHead className="font-semibold">Pelanggan</TableHead>
                    <TableHead className="text-center font-semibold">Kunjungan</TableHead>
                    <TableHead className="text-center font-semibold">Item Dibeli</TableHead>
                    <TableHead className="font-semibold">Kunjungan Terakhir</TableHead>
                    <TableHead className="text-right font-semibold">Total Belanja</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {identifiedCustomers.map((c: any, i) => (
                    <TableRow key={c.name} className="hover:bg-muted/50">
                      <TableCell className="text-muted-foreground/70 font-medium">{i + 1}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center text-xs font-bold w-8 h-6 rounded-md ${c.txCount > 1 ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {c.txCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{c.items}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(c.lastDate), 'dd MMM yyyy', { locale: idLocale })}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(c.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {identifiedCustomers.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground/70 py-10">Belum ada pelanggan teridentifikasi pada periode ini</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════ STOCK ═══════ */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard icon={Boxes} label="Nilai Stok (HPP)" value={fmt(totalStockValue)} color="indigo"
              sub={`${products.length} produk`} />
            <KPICard icon={DollarSign} label="Potensi Penjualan" value={fmt(totalRetailValue)} color="emerald"
              sub={`Potensi laba ${fmt(totalRetailValue - totalStockValue)}`} />
            <KPICard icon={AlertTriangle} label="Stok Menipis" value={lowStockCount.toLocaleString()} color="amber"
              sub="Stok ≤ 10 unit" trend={lowStockCount > 0 ? 'down' : undefined} />
            <KPICard icon={Archive} label="Stok Habis" value={outOfStockCount.toLocaleString()} color="rose"
              sub={outOfStockCount > 0 ? 'Segera restock!' : 'Semua tersedia'} />
          </div>

          {criticalStock.length > 0 && (
            <Card className="shadow-sm bg-destructive/8 border border-destructive/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Perlu Segera Restock (habis dalam ≤ 7 hari)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {criticalStock.slice(0, 9).map((p: any) => (
                    <div key={p.id} className="bg-card rounded-lg p-3 border border-destructive/20 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.category} · Stok {p.stock}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold text-destructive">{p.daysUntilOut}d</p>
                        <p className="text-[10px] text-muted-foreground">{p.dailyRate.toFixed(1)}/hari</p>
                      </div>
                    </div>
                  ))}
                </div>
                {criticalStock.length > 9 && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">+{criticalStock.length - 9} produk lain juga butuh restock</p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground/80 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-warning" /> Fast Movers (Terlaris dalam Periode)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {fastMovers.map((p: any, i) => (
                    <div key={p.id} className="flex items-center gap-3 py-1">
                      <span className="text-xs text-muted-foreground/70 font-bold w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.category} · Stok {p.stock}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-success">{p.soldQty} terjual</p>
                        <p className="text-[11px] text-muted-foreground/70">{p.dailyRate.toFixed(1)}/hari</p>
                      </div>
                    </div>
                  ))}
                  {fastMovers.length === 0 && <p className="text-muted-foreground/70 text-sm text-center py-6">Belum ada produk terjual pada periode ini</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground/80 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-muted-foreground" /> Slow Movers (Tidak Terjual pada Periode)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto">
                  {slowMovers.slice(0, 20).map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 py-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.category}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-foreground/80">Stok {p.stock}</p>
                        <p className="text-[11px] text-muted-foreground/70">{fmt(p.stockValue)} tertahan</p>
                      </div>
                    </div>
                  ))}
                  {slowMovers.length === 0 && <p className="text-muted-foreground/70 text-sm text-center py-6">Semua produk terjual pada periode ini</p>}
                  {slowMovers.length > 20 && <p className="text-xs text-muted-foreground/70 text-center pt-2">+{slowMovers.length - 20} produk lain</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ PROFIT / LOSS ═══════ */}
      {activeTab === 'profit' && (
        <div className="space-y-6">
          {/* P&L Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard icon={DollarSign} label="Pendapatan Kotor" value={fmt(totalRevenue)} color="indigo" />
            <KPICard icon={TrendingUp} label="Total Diskon" value={fmt(totalDiscount)} color="rose" sub={`${txWithDiscountCount} transaksi dengan diskon`} />
            <KPICard icon={Package} label="Harga Pokok" value={fmt(totalCostOfGoods)} color="slate" />
            <KPICard icon={TrendingUp} label="Laba Kotor" value={fmt(grossProfit)} color="emerald"
              sub={`Margin ${margin}%`} trend={grossProfit >= 0 ? 'up' : 'down'} />
            <KPICard icon={TrendingDown} label="Laba Bersih" value={fmt(netProfit)} color={netProfit >= 0 ? 'emerald' : 'rose'}
              trend={netProfit >= 0 ? 'up' : 'down'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* P&L Statement */}
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="border-b bg-muted/50">
                <CardTitle className="text-base font-semibold text-foreground/80">Laporan Laba Rugi</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <PLSection title="Penjualan" items={[
                  { label: 'Pendapatan Penjualan (Gross)', value: totalRevenue },
                  { label: `Diskon & Promo`, value: -totalDiscount },
                ]} total={{ label: 'Penjualan Bersih (Net)', value: netSales }} color="emerald" />

                <PLSection title="Harga Pokok" items={[
                  { label: 'Harga Pokok Penjualan (HPP)', value: -totalCostOfGoods },
                ]} total={{ label: 'Laba Kotor', value: grossProfit }} color="emerald" />

                {totalPassThrough > 0 && (
                  <div className="space-y-1.5">
                    <PLSection title="Pajak & Biaya Layanan" items={[
                      { label: 'Pajak', value: totalTax },
                      { label: 'Biaya Layanan', value: totalServiceCharge },
                    ].filter(x => x.value > 0)} total={{ label: 'Total Pajak & Biaya ', value: totalPassThrough }} color="slate" />
                    <p className="text-xs text-muted-foreground/70 italic px-1">
                      Pajak dan Biaya Layanan tidak Termasuk dalam perhitungan Laba Kotor karena bersifat pass-through (diteruskan ke pemerintah/pelanggan) dan tidak mempengaruhi margin penjualan.
                    </p>
                  </div>
                )}

                <PLSection title="Pendapatan Lain" items={
                  filteredFlow.filter(f => f.type === 'Pemasukan' && f.category !== 'Penjualan').map(f => ({
                    label: f.description || f.category, value: f.amount,
                  }))
                } total={{ label: 'Total Pendapatan Lain', value: otherIncome }} color="cyan"
                  empty="Tidak ada pendapatan lain" />

                <PLSection title="Pengeluaran" items={
                  filteredFlow.filter(f => f.type === 'Pengeluaran').map(f => ({
                    label: f.description || f.category, value: f.amount,
                  }))
                } total={{ label: 'Total Pengeluaran', value: totalExpenses }} color="rose"
                  empty="Tidak ada pengeluaran" />

                {totalPassThrough > 0 && (
                  <div className="flex justify-between items-center px-3 py-2.5 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
                    <span>Total Omset (Pendapatan + Pajak + Layanan)</span>
                    <span className="font-semibold text-foreground/80">{fmt(totalGrossSales)}</span>
                  </div>
                )}

                <div className={`flex justify-between items-center p-4 rounded-xl font-bold text-lg ${
                  netProfit >= 0
                    ? 'bg-success text-success-foreground'
                    : 'bg-destructive text-destructive-foreground'
                }`}>
                  <span>Laba Bersih</span>
                  <span>{fmt(netProfit)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Expense Breakdown */}
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold text-foreground/80">Distribusi Pengeluaran</CardTitle></CardHeader>
              <CardContent className="h-[340px]">
                {expenseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseData} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={4} dataKey="value" cornerRadius={6}
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}>
                        {expenseData.map((_, i) => <Cell key={i} fill={PALETTE[(i + 2) % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 13 }}
                        formatter={(v: any) => [fmt(v), 'Total']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState compact icon={PieChartIcon} title="Belum ada pengeluaran" description="Belum ada data pengeluaran pada periode ini" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════ Sub-components ═══════

function KPICard({ icon: Icon, label, value, color, sub }: {
  icon: any; label: string; value: string; color: string; sub?: string; trend?: 'up' | 'down';
}) {
  const tones: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'brand'> = {
    indigo: 'info',
    cyan: 'info',
    emerald: 'success',
    rose: 'destructive',
    slate: 'default',
    amber: 'warning',
  };
  return (
    <StatCard
      icon={Icon}
      label={label}
      value={value}
      sub={sub}
      tone={tones[color] || 'info'}
    />
  );
}

function PLSection({ title, items, total, color, empty }: {
  title: string; items: { label: string; value: number }[]; total: { label: string; value: number };
  color: string; empty?: string;
}) {
  const bg: Record<string, string> = {
    emerald: 'bg-success/12 text-success',
    cyan: 'bg-info/12 text-info',
    rose: 'bg-destructive/12 text-destructive',
    slate: 'bg-muted text-foreground/80',
  };
  return (
    <div className="space-y-1.5">
      <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{title}</h4>
      {items.length > 0 ? items.map((it, i) => (
        <div key={i} className="flex justify-between py-1 text-sm">
          <span className="text-muted-foreground">{it.label}</span>
          <span className="font-medium text-foreground">{it.value < 0 ? `(${fmt(Math.abs(it.value))})` : fmt(it.value)}</span>
        </div>
      )) : (
        <p className="text-xs text-muted-foreground/70 italic py-1">{empty || 'Tidak ada data'}</p>
      )}
      <div className={`flex justify-between py-2 px-3 rounded-lg font-semibold text-sm ${bg[color] || bg.emerald}`}>
        <span>{total.label}</span>
        <span>{fmt(total.value)}</span>
      </div>
    </div>
  );
}
