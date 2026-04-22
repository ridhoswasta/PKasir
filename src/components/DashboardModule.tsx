import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ShoppingCart, Package, Coffee,
  BarChart3, Users, Wallet, Settings as SettingsIcon, Receipt, ChevronRight
} from 'lucide-react';
import { isToday, isThisMonth, subDays, startOfDay, format } from 'date-fns';
import { cn } from '@/lib/utils';

export function DashboardModule({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    invoke('get_transactions').then(setTransactions).catch(() => {});
    invoke('get_products').then(setProducts).catch(() => {});
  }, []);

  const todayTransactions = transactions.filter(t => isToday(new Date(t.date)));
  const monthTransactions = transactions.filter(t => isThisMonth(new Date(t.date)));
  const todayRevenue = todayTransactions.reduce((sum, t) => sum + t.total, 0);
  const monthRevenue = monthTransactions.reduce((sum, t) => sum + t.total, 0);

  // Last 7 days bars for the Reports card
  const today = startOfDay(new Date());
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // matches Yoco
  const weekBars = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(today, 6 - i);
    const total = transactions
      .filter(t => startOfDay(new Date(t.date)).getTime() === d.getTime())
      .reduce((s, t) => s + (t.total || 0), 0);
    return { date: d, total, label: dayLabels[d.getDay() === 0 ? 6 : d.getDay() - 1] };
  });
  const maxBar = Math.max(1, ...weekBars.map(b => b.total));

  const tiles: {
    id: string;
    label: string;
    metric: string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'products',
      label: 'Produk',
      metric: `${products.length}`,
      sub: 'Total',
      icon: Coffee,
    },
    {
      id: 'transactions',
      label: 'Riwayat Penjualan',
      metric: `Rp ${todayRevenue.toLocaleString('id-ID')}`,
      sub: 'Hari ini',
      icon: Receipt,
    },
    {
      id: 'money',
      label: 'Arus Kas',
      metric: `Rp ${monthRevenue.toLocaleString('id-ID')}`,
      sub: 'Bulan ini',
      icon: Wallet,
    },
    {
      id: 'inventory',
      label: 'Inventaris',
      metric: `${products.reduce((s, p) => s + (p.stock || 0), 0)}`,
      sub: 'Unit stok',
      icon: Package,
    },
  ];

  const quickAccess = [
    { id: 'pos', label: 'Kasir', icon: ShoppingCart },
    { id: 'customers', label: 'Pelanggan', icon: Users },
    { id: 'reports', label: 'Laporan', icon: BarChart3 },
    { id: 'settings', label: 'Pengaturan', icon: SettingsIcon },
  ];

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full">
      {/* Most visited */}
      <section className="space-y-4">
        <h3 className="text-[15px] font-semibold text-foreground/75">Sering dikunjungi</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiles.map(tile => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                onClick={() => setActiveTab(tile.id)}
                className="group text-left bg-card hover:bg-accent/60 rounded-2xl p-5 h-[168px] flex flex-col justify-between transition-colors"
              >
                <div className="flex items-start justify-between">
                  <span className="text-[13px] font-medium text-foreground/75">{tile.label}</span>
                  <Icon className="w-[18px] h-[18px] text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.8} />
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-foreground tracking-tight truncate">{tile.metric}</p>
                  <p className="text-xs text-muted-foreground">{tile.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Reports */}
      <section className="space-y-4">
        <button
          onClick={() => setActiveTab('reports')}
          className="inline-flex items-center gap-1 text-[15px] font-semibold text-foreground hover:text-foreground/80 transition-colors"
        >
          Laporan
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Gross revenue chart — larger */}
          <div className="lg:col-span-2 bg-card rounded-2xl p-6">
            <p className="text-sm font-medium text-foreground/75 mb-5">Pendapatan Kotor</p>
            <div className="flex items-end gap-3 h-40">
              {weekBars.map((b, idx) => {
                const h = Math.max(6, Math.round((b.total / maxBar) * 140));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        "w-full rounded-md transition-all",
                        b.total > 0 ? "bg-[color:var(--brand-blue)]" : "bg-muted"
                      )}
                      style={{ height: `${h}px` }}
                    />
                    <span className="text-[11px] text-muted-foreground font-medium">{b.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/70">
              <span className="text-xs text-muted-foreground">7 hari terakhir</span>
              <span className="text-sm font-semibold text-foreground">
                Rp {weekBars.reduce((s, b) => s + b.total, 0).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Product summary */}
          <div className="bg-card rounded-2xl p-6 flex flex-col">
            <p className="text-sm font-medium text-foreground/75 mb-4">Laporan Produk</p>
            <div className="flex-1 flex flex-col justify-center gap-3">
              <div>
                <p className="text-3xl font-bold text-foreground tracking-tight">
                  {todayTransactions.length}
                </p>
                <p className="text-xs text-muted-foreground">Transaksi hari ini</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground tracking-tight">
                  {monthTransactions.length}
                </p>
                <p className="text-xs text-muted-foreground">Transaksi bulan ini</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('reports')}
              className="mt-4 text-xs font-semibold text-[color:var(--brand-blue)] hover:underline text-left"
            >
              Lihat laporan lengkap →
            </button>
          </div>
        </div>
      </section>

      {/* Quick access */}
      <section className="space-y-4">
        <h3 className="text-[15px] font-semibold text-foreground/75">Akses cepat</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickAccess.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="group bg-card hover:bg-accent/60 rounded-2xl p-5 h-28 flex flex-col justify-between transition-colors text-left"
              >
                <Icon className="w-5 h-5 text-foreground/75" strokeWidth={1.8} />
                <span className="text-sm font-semibold text-foreground">{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
