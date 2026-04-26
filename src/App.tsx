import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { DashboardModule } from './components/DashboardModule';
import { POSModule } from './components/POSModule';
import { InventoryModule } from './components/InventoryModule';
import { ProductsModule } from './components/ProductsModule';
import { ReportsModule } from './components/ReportsModule';
import { MoneyFlowModule } from './components/MoneyFlowModule';
import { CustomersModule } from './components/CustomersModule';
import { SettingsModule } from './components/SettingsModule';
import { TransactionHistoryModule } from './components/TransactionHistoryModule';
import { UserManagementModule } from './components/UserManagementModule';
import { DiscountsModule } from './components/DiscountsModule';
import { SplashScreen } from './components/SplashScreen';
import { LoginScreen } from './components/LoginScreen';
import { WindowTitlebar } from './components/WindowTitlebar';
import { CustomerDisplay } from './components/CustomerDisplay';
import { AuthProvider, useAuth, ROLE_TABS, ROLE_DEFAULT_TAB } from './services/auth';
import { ThemeProvider, useTheme } from './services/theme';
import { invoke } from '@tauri-apps/api/core';
import { Toaster } from 'sonner';

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster position="top-right" theme={resolved} />;
}

function AppInner() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSplash, setShowSplash] = useState(true);

  // Auto-backup: startup check (runs if > 20h since last), plus periodic interval
  const [backupIntervalSeconds, setBackupIntervalSeconds] = useState(0);

  const refreshBackupInterval = () => {
    invoke<any>('get_settings').then((s) => {
      const enabled = !!s.autoBackupEnabled;
      const interval = Number(s.autoBackupIntervalSeconds || 0);
      setBackupIntervalSeconds(enabled && interval > 0 ? interval : 0);
    }).catch(() => {});
  };

  useEffect(() => {
    // Startup check
    invoke('auto_backup_if_due').catch(() => {});
    // Read current interval
    refreshBackupInterval();
    // Re-read when settings change
    const onUpdate = () => refreshBackupInterval();
    window.addEventListener('settings-updated', onUpdate);
    return () => window.removeEventListener('settings-updated', onUpdate);
  }, []);

  // Periodic backup timer — restarts whenever interval changes
  useEffect(() => {
    if (backupIntervalSeconds <= 0) return;
    const ms = Math.max(5, backupIntervalSeconds) * 1000; // minimum 5s safety floor
    const id = setInterval(() => {
      invoke('auto_backup_tick').catch(() => {});
    }, ms);
    return () => clearInterval(id);
  }, [backupIntervalSeconds]);

  // When user logs in, set default tab for their role
  useEffect(() => {
    if (user) {
      const defaultTab = ROLE_DEFAULT_TAB[user.role] || 'dashboard';
      setActiveTab(defaultTab);
    }
  }, [user?.id, user?.role]);

  // Guard: if user navigates to a tab they don't have access to, redirect
  useEffect(() => {
    if (user && !ROLE_TABS[user.role]?.includes(activeTab)) {
      setActiveTab(ROLE_DEFAULT_TAB[user.role] || 'pos');
    }
  }, [activeTab, user?.role]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardModule setActiveTab={setActiveTab} />;
      case 'pos': return <POSModule />;
      case 'transactions': return <TransactionHistoryModule />;
      case 'inventory': return <InventoryModule />;
      case 'products': return <ProductsModule />;
      case 'reports': return <ReportsModule />;
      case 'money': return <MoneyFlowModule />;
      case 'customers': return <CustomersModule />;
      case 'settings': return <SettingsModule />;
      case 'users': return <UserManagementModule />;
      case 'discounts': return <DiscountsModule />;
      default: return <DashboardModule setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <WindowTitlebar />
      <div className="flex-1 overflow-hidden relative">
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
        {!user ? (
          <LoginScreen />
        ) : (
          <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
            {renderContent()}
          </Layout>
        )}
        <ThemedToaster />
      </div>
    </div>
  );
}

export default function App() {
  // Customer Display window: skip auth/layout but keep the custom titlebar
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('display') === 'customer') {
    return (
      <ThemeProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <WindowTitlebar />
          <div className="flex-1 overflow-hidden relative">
            <CustomerDisplay />
          </div>
        </div>
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  );
}
