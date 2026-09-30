import React from 'react';
import { Menu, Plus, User, LogOut, ShieldCheck, Stethoscope, Building2, Shield, UserCog } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NavigationPage } from './Sidebar';

interface HeaderProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onNavigate,
  onOpenMobileMenu,
}) => {
  const { currentUser, logout } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const renderRoleHeader = () => {
    switch (currentUser?.role) {
      case 'SUPER_ADMIN':
        return (
          <>
            <ShieldCheck className="w-3 h-3 text-purple-600" />
            <span>Super Admin</span>
          </>
        );
      case 'NAKES':
        return (
          <>
            <Stethoscope className="w-3 h-3 text-blue-600" />
            <span>Nakes Medis</span>
          </>
        );
      case 'SECURITY':
        return (
          <>
            <Shield className="w-3 h-3 text-emerald-600" />
            <span>Security / Gate</span>
          </>
        );
      default:
        return (
          <>
            <User className="w-3 h-3 text-slate-500" />
            <span>Petugas</span>
          </>
        );
    }
  };

  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between print:hidden min-h-[56px]"
    >
      <div className="flex items-center gap-3">
        <button
          id="btn-open-mobile-menu"
          onClick={onOpenMobileMenu}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 lg:hidden cursor-pointer"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* User Info Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
            {currentUser?.fullName ? currentUser.fullName.charAt(0) : 'U'}
          </div>

          <div className="hidden md:block text-right">
            <p className="text-xs font-bold text-slate-800 leading-none">{currentUser?.fullName || 'Pengguna'}</p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center justify-end gap-1">
              {renderRoleHeader()}
            </p>
          </div>

          <button
            id="btn-header-logout"
            onClick={logout}
            title="Keluar"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition ml-1 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
