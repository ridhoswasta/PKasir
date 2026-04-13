import React, { useState } from 'react';
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
import { Toaster } from 'sonner';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

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
      default: return <DashboardModule setActiveTab={setActiveTab} />;
    }
  };

  return (
    <>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>
      <Toaster position="top-right" />
    </>
  );
}
