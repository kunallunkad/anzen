import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import { Login } from './components/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Customers } from './pages/Customers';
import { Stock } from './pages/Stock';
import { Batches } from './pages/Batches';
import { Inventory } from './pages/Inventory';
import { CRM } from './pages/CRM';
import { DeliveryChallan } from './pages/DeliveryChallan';
import { Sales } from './pages/Sales';
import { Finance } from './pages/Finance';
import { Settings } from './pages/Settings';
import { Setup } from './pages/Setup';
import { initializeNotificationChecks } from './utils/notifications';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const { currentPage } = useNavigation();

  useEffect(() => {
    if (user && profile) {
      initializeNotificationChecks();
    }
  }, [user, profile]);

  if (window.location.pathname === '/setup') {
    return <Setup />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <Products />;
      case 'stock':
        return <Stock />;
      case 'batches':
        return <Batches />;
      case 'inventory':
        return <Inventory />;
      case 'customers':
        return <Customers />;
      case 'crm':
        return <CRM />;
      case 'delivery-challan':
        return <DeliveryChallan />;
      case 'sales':
        return <Sales />;
      case 'finance':
        return <Finance />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return renderPage();
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <NavigationProvider>
          <AppContent />
        </NavigationProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
