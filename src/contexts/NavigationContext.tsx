import React, { createContext, useContext, useState } from 'react';

interface NavigationContextType {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  navigationData: any;
  setNavigationData: (data: any) => void;
  clearNavigationData: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [navigationData, setNavigationData] = useState<any>(null);

  const clearNavigationData = () => setNavigationData(null);

  return (
    <NavigationContext.Provider value={{ currentPage, setCurrentPage, navigationData, setNavigationData, clearNavigationData }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
