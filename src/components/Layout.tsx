import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Coffee, 
  BarChart3, 
  Users, 
  Wallet, 
  Settings as SettingsIcon,
  Receipt,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [settings, setSettings] = useState<any>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const fetchSettings = () => {
    fetch('/api/settings').then(res => res.json()).then(setSettings);
  };

  useEffect(() => {
    fetchSettings();
    window.addEventListener('settings-updated', fetchSettings);
    return () => window.removeEventListener('settings-updated', fetchSettings);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'Kasir (POS)', icon: ShoppingCart },
    { id: 'transactions', label: 'Riwayat Transaksi', icon: Receipt },
    { id: 'inventory', label: 'Inventaris', icon: Package },
    { id: 'products', label: 'Produk', icon: Coffee },
    { id: 'reports', label: 'Laporan', icon: BarChart3 },
    { id: 'money', label: 'Arus Kas', icon: Wallet },
    { id: 'customers', label: 'Pelanggan', icon: Users },
    { id: 'settings', label: 'Pengaturan', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out shrink-0",
          isSidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        <div className="p-6 flex items-center justify-between min-w-[256px]">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            {settings.logo ? (
              <img 
                src={settings.logo} 
                alt="Logo" 
                style={{ 
                  width: settings.logoWidth ? `${settings.logoWidth}px` : '120px', 
                  height: settings.logoHeight ? `${settings.logoHeight}px` : '32px' 
                }}
                className="object-contain" 
              />
            ) : (
              <>
                <Coffee className="w-8 h-8 text-orange-500" />
                CafePOS
              </>
            )}
          </h1>
          <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto min-w-[256px]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                  isActive 
                    ? "bg-orange-500 text-white font-medium" 
                    : "hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800 min-w-[256px]">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-medium">
              A
            </div>
            <div>
              <p className="text-sm font-medium text-white">Admin User</p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="bg-white border-b px-4 py-3 flex items-center gap-4 shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-slate-800">
            {navItems.find(item => item.id === activeTab)?.label || 'CafePOS'}
          </h2>
        </header>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
