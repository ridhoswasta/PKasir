import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, ShoppingCart, Package, Coffee, 
  BarChart3, Users, Wallet, Settings as SettingsIcon, Receipt 
} from 'lucide-react';
import { isToday, isThisMonth } from 'date-fns';

export function DashboardModule({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/transactions').then(res => res.json()).then(setTransactions);
  }, []);

  const todayTransactions = transactions.filter(t => isToday(new Date(t.date)));
  const monthTransactions = transactions.filter(t => isThisMonth(new Date(t.date)));

  const todayRevenue = todayTransactions.reduce((sum, t) => sum + t.total, 0);
  const monthRevenue = monthTransactions.reduce((sum, t) => sum + t.total, 0);

  const quickAccess = [
    { id: 'pos', label: 'Kasir (POS)', icon: ShoppingCart, color: 'bg-blue-500' },
    { id: 'transactions', label: 'Riwayat Transaksi', icon: Receipt, color: 'bg-indigo-500' },
    { id: 'inventory', label: 'Inventaris', icon: Package, color: 'bg-purple-500' },
    { id: 'products', label: 'Produk', icon: Coffee, color: 'bg-amber-500' },
    { id: 'reports', label: 'Laporan', icon: BarChart3, color: 'bg-emerald-500' },
    { id: 'money', label: 'Arus Kas', icon: Wallet, color: 'bg-teal-500' },
    { id: 'customers', label: 'Pelanggan', icon: Users, color: 'bg-rose-500' },
    { id: 'settings', label: 'Pengaturan', icon: SettingsIcon, color: 'bg-slate-500' },
  ];

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <h2 className="text-3xl font-bold text-slate-800">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Omset Hari Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">Rp {todayRevenue.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Transaksi Hari Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">{todayTransactions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Omset Bulan Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">Rp {monthRevenue.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Transaksi Bulan Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">{monthTransactions.length}</div>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">Akses Cepat</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickAccess.map((item) => {
          const Icon = item.icon;
          return (
            <Button 
              key={item.id} 
              variant="outline" 
              className="h-32 flex flex-col items-center justify-center gap-3 hover:border-orange-500 hover:text-orange-500 transition-all"
              onClick={() => setActiveTab(item.id)}
            >
              <div className={`p-3 rounded-full text-white ${item.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <span className="font-medium">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
