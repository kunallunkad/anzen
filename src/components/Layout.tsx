import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';
import { NotificationDropdown } from './NotificationDropdown';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Warehouse,
  Users,
  UserCircle,
  ShoppingCart,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  Globe,
  Truck,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { currentPage, setCurrentPage } = useNavigation();

  const menuItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, roles: ['admin', 'accounts', 'sales', 'warehouse'] },
    { id: 'products', label: t('nav.products'), icon: Package, roles: ['admin', 'sales', 'warehouse'] },
    { id: 'stock', label: t('nav.stock'), icon: Warehouse, roles: ['admin', 'sales', 'warehouse', 'accounts'] },
    { id: 'batches', label: t('nav.batches'), icon: Boxes, roles: ['admin', 'warehouse', 'accounts'] },
    { id: 'inventory', label: t('nav.inventory'), icon: Warehouse, roles: ['admin', 'warehouse'] },
    { id: 'customers', label: t('nav.customers'), icon: Users, roles: ['admin', 'accounts', 'sales'] },
    { id: 'crm', label: t('nav.crm'), icon: UserCircle, roles: ['admin', 'sales'] },
    { id: 'delivery-challan', label: 'Delivery Challan', icon: Truck, roles: ['admin', 'accounts', 'sales', 'warehouse'] },
    { id: 'sales', label: t('nav.sales'), icon: ShoppingCart, roles: ['admin', 'accounts', 'sales'] },
    { id: 'finance', label: t('nav.finance'), icon: DollarSign, roles: ['admin', 'accounts'] },
    { id: 'settings', label: t('nav.settings'), icon: Settings, roles: ['admin'] },
  ];

  const visibleMenuItems = menuItems.filter(item =>
    profile && item.roles.includes(profile.role)
  );

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'id' : 'en');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className={`fixed inset-0 bg-gray-900 bg-opacity-50 z-20 lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 z-30 h-full w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img src="/src/assets/Untitled-1.svg" alt="Logo" className="h-10 w-10" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-gray-900">PT. SHUBHAM ANZEN</span>
              <span className="text-sm font-bold text-gray-900">PHARMA JAYA</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {profile?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profile?.full_name}
              </p>
              <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded hover:bg-gray-100"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              <NotificationDropdown />

              <button
                onClick={toggleLanguage}
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100"
              >
                <Globe className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700 uppercase">
                  {language}
                </span>
              </button>

              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 text-gray-700"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">{t('auth.logout')}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
