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
  Maximize,
  Minimize,
  LogOut,
  Shield,
  Sun,
  Moon,
  Clock,
  Percent,
  Truck,
  ClipboardList,
  FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
// getCurrentWindow removed — now via useFullscreen hook (Issue #12)
import { useAuth, ROLE_TABS } from '../services/auth';
import { useTheme } from '../services/theme';
import { useFullscreen } from '../services/useFullscreen';
import { ProfileDialog } from './ProfileDialog';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { user, logout } = useAuth();
  const { resolved, toggle } = useTheme();
  // Issue #12: use shared hook, removing duplicated fullscreen logic
  const { isFullScreen, toggleFullScreen } = useFullscreen();
  const [settings, setSettings] = useState<any>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // Issue #23: clock updates every 60s (only HH:MM needed) — was every 1s
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const fetchSettings = () => {
    invoke('get_settings').then(setSettings).catch(() => {});
  };

  useEffect(() => {
    fetchSettings();
    window.addEventListener('settings-updated', fetchSettings);
    return () => window.removeEventListener('settings-updated', fetchSettings);
  }, []);

  const allNavItems = [
    { id: 'dashboard', label: 'Hub', icon: LayoutDashboard },
    { id: 'pos', label: 'Kasir', icon: ShoppingCart },
    { id: 'transactions', label: 'Riwayat', icon: Receipt },
    { id: 'inventory', label: 'Inventaris', icon: Package },
    { id: 'products', label: 'Produk', icon: Coffee },
    { id: 'reports', label: 'Laporan', icon: BarChart3 },
    { id: 'money', label: 'Arus Kas', icon: Wallet },
    { id: 'customers', label: 'Pelanggan', icon: Users },
    { id: 'suppliers', label: 'Pemasok', icon: Truck },
    { id: 'purchases', label: 'Pembelian', icon: ClipboardList },
    { id: 'ingredients', label: 'Bahan Baku', icon: FlaskConical },
    { id: 'settings', label: 'Pengaturan', icon: SettingsIcon },
    { id: 'users', label: 'Pengguna', icon: Shield },
    { id: 'discounts', label: 'Diskon', icon: Percent },
  ];

  const fullLabelMap: Record<string, string> = {
    dashboard: 'Hub',
    pos: 'Kasir (POS)',
    transactions: 'Riwayat Transaksi',
    inventory: 'Inventaris',
    products: 'Produk',
    reports: 'Laporan',
    money: 'Arus Kas',
    customers: 'Pelanggan',
    suppliers: 'Pemasok / Supplier',
    purchases: 'Pembelian (Purchase Order)',
    ingredients: 'Bahan Baku & Resep',
    settings: 'Pengaturan',
    users: 'Manajemen User',
    discounts: 'Diskon & Promo',
  };

  const allowedTabs = user ? ROLE_TABS[user.role] || [] : [];
  const navItems = allNavItems.filter(item => allowedTabs.includes(item.id));

  const roleBadge: Record<string, { label: string }> = {
    admin: { label: 'Admin' },
    manager: { label: 'Manager' },
    cashier: { label: 'Kasir' },
  };
  const badge = user ? roleBadge[user.role] || roleBadge.cashier : roleBadge.cashier;
  const initials = (user?.displayName || 'U').charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Sidebar — theme-aware gradient; Issue #4: icon-only collapsed state (was w-0 hidden) */}
      <aside
        className={cn(
          "yoco-sidebar-bg text-sidebar-foreground flex flex-col transition-all duration-300 ease-in-out shrink-0 border-r border-sidebar-border overflow-hidden",
          isSidebarOpen ? "w-[168px]" : "w-[56px]"
        )}
      >
        {/* Brand */}
        <div className={cn("pt-6 pb-8 flex items-center justify-center", isSidebarOpen ? "px-3" : "px-0")}>
          {isSidebarOpen ? (
            settings.logo ? (
              <img
                src={settings.logo}
                alt="Logo"
                style={{
                  width: settings.logoWidth ? `${settings.logoWidth}px` : '120px',
                  height: settings.logoHeight ? `${settings.logoHeight}px` : '32px',
                  maxWidth: '100%',
                }}
                className="object-contain"
              />
            ) : (
              <span className="text-[22px] font-extrabold tracking-tight text-sidebar-foreground leading-none">
                PKasir
              </span>
            )
          ) : (
            <Coffee className="w-6 h-6 text-sidebar-foreground/80" strokeWidth={1.8} />
          )}
        </div>

        {/* Nav — icon-only when collapsed */}
        <nav className={cn("flex-1 space-y-1 overflow-y-auto overflow-x-hidden stagger", isSidebarOpen ? "px-3" : "px-2")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  isSidebarOpen ? "px-3 py-2.5 text-left" : "px-0 py-2.5 justify-center",
                  isActive
                    ? "bg-sidebar-foreground/10 text-sidebar-foreground font-semibold"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-foreground/[0.06] hover:text-sidebar-foreground"
                )}
                title={fullLabelMap[item.id]}
              >
                <span className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "bg-transparent text-sidebar-foreground/90"
                )}>
                  <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.2 : 1.9} />
                </span>
                {isSidebarOpen && <span className="text-[13px] leading-none truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer — profile & logout; icon-only when collapsed */}
        <div className={cn("pb-4 pt-3 border-t border-sidebar-border", isSidebarOpen ? "px-2" : "px-1")}>
          <div className={cn("flex items-center", isSidebarOpen ? "gap-1" : "flex-col gap-1")}>
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className={cn(
                "flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-sidebar-foreground/[0.06] transition-colors text-left",
                isSidebarOpen ? "flex-1 min-w-0" : "justify-center w-full"
              )}
              title={isSidebarOpen ? 'Buka profil' : (user?.displayName || user?.username || 'User')}
            >
              <div className="w-8 h-8 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user?.displayName || ''} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-sidebar-foreground truncate leading-tight">
                    {user?.displayName || user?.username || 'User'}
                  </p>
                  <p className="text-[10px] text-sidebar-foreground/65 truncate leading-tight">{badge.label}</p>
                </div>
              )}
            </button>
            <button
              onClick={logout}
              className="p-1.5 rounded-md text-sidebar-foreground/70 hover:text-destructive hover:bg-sidebar-foreground/[0.06] transition-colors shrink-0"
              title="Keluar"
              aria-label="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <ProfileDialog open={isProfileOpen} onOpenChange={setIsProfileOpen} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-background">
        <header className="bg-background border-b border-border/60 px-6 py-4 flex items-center gap-4 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
            aria-label={isSidebarOpen ? 'Sembunyikan menu' : 'Tampilkan menu'}
            aria-expanded={isSidebarOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-foreground flex-1 tracking-tight">
            {fullLabelMap[activeTab] || 'PKasir'}
          </h2>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/80 border border-border/60"
            title={now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            aria-label="Jam saat ini"
          >
            <Clock className="w-4 h-4 text-foreground/60" />
            {/* Issue #23: display HH:MM only — seconds not needed in POS context */}
            <span className="text-sm font-semibold tabular-nums tracking-tight">
              {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          </div>
          <button
            onClick={toggle}
            className="p-2 rounded-lg text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
            title={resolved === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            aria-label="Toggle theme"
          >
            {resolved === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleFullScreen}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              isFullScreen
                ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                : "bg-foreground/10 text-foreground/80 hover:bg-foreground/15 hover:text-foreground"
            )}
            title={isFullScreen ? 'Keluar Full Screen (Esc)' : 'Full Screen'}
            aria-label={isFullScreen ? 'Keluar Full Screen' : 'Full Screen'}
          >
            {isFullScreen ? (
              <>
                <Minimize className="w-4 h-4" />
                <span className="hidden sm:inline">Keluar Full Screen</span>
              </>
            ) : (
              <>
                <Maximize className="w-4 h-4" />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            )}
          </button>
        </header>
        <div className="flex-1 overflow-hidden bg-background">
          <div key={activeTab} className="h-full anim-page">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
