import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  ShieldAlert,
  LogOut,
  ChevronDown,
  ChevronRight,
  Truck,
  Building2,
  FolderKanban,
  UserCog,
  HeartPulse,
  Pill,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavigationPage =
  | 'dashboard'
  | 'nakes_dashboard'
  | 'superadmin_dashboard'
  | 'new_examination'
  | 'examination_result'
  | 'examination_detail'
  | 'data_tenko'
  | 'driver_health'
  | 'medical_inventory'
  | 'master_drivers'
  | 'master_driver_groups'
  | 'master_location'
  | 'master_health_indications'
  | 'master_vitamins'
  | 'master_nakes'
  | 'user_management'
  | 'audit_logs'
  | 'print_examination';

interface SidebarProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { currentUser, logout } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const isMasterActive =
    currentPage === 'master_drivers' ||
    currentPage === 'master_driver_groups' ||
    currentPage === 'master_location' ||
    currentPage === 'master_health_indications' ||
    currentPage === 'master_vitamins';

  // Keep master menu expanded by default or when one of its children is active
  const [isMasterExpanded, setIsMasterExpanded] = useState(true);

  const handleNav = (page: NavigationPage) => {
    onNavigate(page);
    onCloseMobile();
  };

  const isDashboardActive =
    currentPage === 'dashboard' ||
    currentPage === 'nakes_dashboard' ||
    currentPage === 'superadmin_dashboard';

  const isDataTenkoActive =
    currentPage === 'data_tenko' ||
    currentPage === 'new_examination' ||
    currentPage === 'examination_result' ||
    currentPage === 'examination_detail' ||
    currentPage === 'print_examination';

  const isDriverHealthActive = currentPage === 'driver_health';

  const navItemClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs md:text-sm transition-all duration-200 cursor-pointer ${
      isActive
        ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  const subNavItemClass = (isActive: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 cursor-pointer ${
      isActive
        ? 'bg-blue-50 text-blue-700 font-bold border-l-2 border-blue-600 pl-2.5'
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
    }`;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          id="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed top-0 left-0 bottom-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } print:hidden`}
      >
        {/* Brand & Logo Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/25">
              TK
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-slate-900">TENKO</span>
            </div>
          </div>
        </div>

        {/* Navigation List - 5 Main Structured Menus */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Navigasi Utama
            </p>
            <nav className="space-y-1">
              {/* Dashboard */}
              <button
                id="nav-dashboard"
                onClick={() => handleNav(isSuperAdmin ? 'superadmin_dashboard' : 'nakes_dashboard')}
                className={`w-full ${navItemClass(isDashboardActive)}`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Dashboard</span>
              </button>

              {/* Data TENKO */}
              <button
                id="nav-data-tenko"
                onClick={() => handleNav('data_tenko')}
                className={`w-full ${navItemClass(isDataTenkoActive)}`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Data TENKO</span>
              </button>

              {/* Driver Health */}
              <button
                id="nav-driver-health"
                onClick={() => handleNav('driver_health')}
                className={`w-full ${navItemClass(isDriverHealthActive)}`}
              >
                <HeartPulse className={`w-4 h-4 shrink-0 ${isDriverHealthActive ? 'text-white' : 'text-rose-500'}`} />
                <span>Driver Health</span>
              </button>

              {/* Medical Inventory (Standalone Menu) */}
              <button
                id="nav-medical-inventory"
                onClick={() => handleNav('medical_inventory')}
                className={`w-full ${navItemClass(currentPage === 'medical_inventory')}`}
              >
                <Pill className={`w-4 h-4 shrink-0 ${currentPage === 'medical_inventory' ? 'text-white' : 'text-emerald-600'}`} />
                <span>Medical Inventory</span>
              </button>

              {/* Master Data (Collapsible Menu with Sub-menus) */}
              <div className="space-y-1">
                <button
                  id="nav-master-data-toggle"
                  type="button"
                  onClick={() => setIsMasterExpanded(!isMasterExpanded)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs md:text-sm transition-all duration-200 cursor-pointer ${
                    isMasterActive
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FolderKanban className="w-4 h-4 shrink-0 text-blue-600" />
                    <span>Master Data</span>
                  </div>
                  {isMasterExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {/* Sub-menu items */}
                {isMasterExpanded && (
                  <div className="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-slate-100 ml-4">
                    {/* Master Driver & Kenek */}
                    <button
                      id="nav-master-drivers"
                      onClick={() => handleNav('master_drivers')}
                      className={`w-full ${subNavItemClass(currentPage === 'master_drivers')}`}
                    >
                      <Truck className="w-3.5 h-3.5 shrink-0" />
                      <span>Driver & Kenek</span>
                    </button>

                    {/* Master Driver Group */}
                    <button
                      id="nav-master-driver-groups"
                      onClick={() => handleNav('master_driver_groups')}
                      className={`w-full ${subNavItemClass(currentPage === 'master_driver_groups')}`}
                    >
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span>Driver Group</span>
                    </button>

                    {/* Master Lokasi / Pool */}
                    <button
                      id="nav-master-location"
                      onClick={() => handleNav('master_location')}
                      className={`w-full ${subNavItemClass(currentPage === 'master_location')}`}
                    >
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Lokasi / Pool</span>
                    </button>

                    {/* Master Indikasi */}
                    <button
                      id="nav-master-health-indications"
                      onClick={() => handleNav('master_health_indications')}
                      className={`w-full ${subNavItemClass(currentPage === 'master_health_indications')}`}
                    >
                      <Activity className="w-3.5 h-3.5 shrink-0" />
                      <span>Master Indikasi</span>
                    </button>

                    {/* Master Vitamin */}
                    <button
                      id="nav-master-vitamins"
                      onClick={() => handleNav('master_vitamins')}
                      className={`w-full ${subNavItemClass(currentPage === 'master_vitamins')}`}
                    >
                      <Pill className="w-3.5 h-3.5 shrink-0" />
                      <span>Master Vitamin</span>
                    </button>
                  </div>
                )}
              </div>

              {/* User Management */}
              <button
                id="nav-user-management"
                onClick={() => handleNav('user_management')}
                className={`w-full ${navItemClass(currentPage === 'user_management')}`}
              >
                <UserCog className="w-4 h-4 shrink-0 text-purple-600" />
                <span>User Management</span>
              </button>

              {/* Audit Log */}
              <button
                id="nav-audit-logs"
                onClick={() => handleNav('audit_logs')}
                className={`w-full ${navItemClass(currentPage === 'audit_logs')}`}
              >
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Audit Log</span>
              </button>
            </nav>
          </div>
        </div>
      </aside>
    </>
  );
};

