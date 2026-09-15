import React, { useState } from 'react';
import { Sidebar, NavigationPage } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentPage,
  onNavigate,
  children,
}) => {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Responsive Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 print:pl-0 flex flex-col min-w-0">
        <Header
          currentPage={currentPage}
          onNavigate={onNavigate}
          onOpenMobileMenu={() => setIsOpenMobile(true)}
        />

        <main className="flex-1 p-4 md:p-8 print:p-0 max-w-7xl print:max-w-none w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
