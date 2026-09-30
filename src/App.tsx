import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { Layout } from './components/layout/Layout';
import { NavigationPage } from './components/layout/Sidebar';
import { LoginPage } from './pages/auth/LoginPage';
import { NakesDashboard } from './pages/dashboard/NakesDashboard';
import { SuperAdminDashboard } from './pages/dashboard/SuperAdminDashboard';
import { NewExaminationStepper } from './pages/examination/NewExaminationStepper';
import { ExaminationResultPage } from './pages/examination/ExaminationResultPage';
import { ExaminationDetailPage } from './pages/examination/ExaminationDetailPage';
import { DataTenkoPage } from './pages/history/DataTenkoPage';
import { MasterDriversPage } from './pages/master/MasterDriversPage';
import { MasterDriverGroupsPage } from './pages/master/MasterDriverGroupsPage';
import { MasterLocationPage } from './pages/master/MasterLocationPage';
import { MasterHealthIndicationsPage } from './pages/master/MasterHealthIndicationsPage';
import { MasterVitaminsPage } from './pages/master/MasterVitaminsPage';
import { MasterNakesPage } from './pages/master/MasterNakesPage';
import { DriverHealthPage } from './pages/health/DriverHealthPage';
import { MedicalInventoryPage } from './pages/inventory/MedicalInventoryPage';
import { UserManagementPage } from './pages/users/UserManagementPage';
import { PrintableTenkoReport } from './components/print/PrintableTenkoReport';
import { SecurityGateVerificationPage } from './pages/security/SecurityGateVerificationPage';
import { AttendanceLogPage } from './pages/attendance/AttendanceLogPage';
import { AssessmentReportPage } from './pages/report/AssessmentReportPage';
import { DriverTenkoCardView } from './pages/public/DriverTenkoCardView';
import { TenkoExamination } from './types';
import { seedInitialMasterData } from './services/seedData';
import { Loader2 } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { currentUser, loading, isSuperAdmin } = useAuth();

  const [currentPage, setCurrentPage] = useState<NavigationPage>('nakes_dashboard');
  const [returnPage, setReturnPage] = useState<NavigationPage>('data_tenko');
  const [selectedExamination, setSelectedExamination] = useState<TenkoExamination | null>(null);
  const [preselectedDriverId, setPreselectedDriverId] = useState<string | undefined>(undefined);

  // Check URL query parameters for public QR Scan / Verification / Driver Pass
  const [publicVerifyId, setPublicVerifyId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('pass') || params.get('card') || params.get('verify') || null;
    }
    return null;
  });

  const [isDriverCardMode, setIsDriverCardMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const passParam = params.get('pass') || params.get('card');
      const verifyParam = params.get('verify');
      const scanParam = params.get('scan');
      if (passParam) return true;
      if (verifyParam && scanParam !== 'true' && scanParam !== 'gate') return true;
    }
    return false;
  });

  const [isSecurityGateScanMode, setIsSecurityGateScanMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const scanParam = params.get('scan');
      return scanParam === 'true' || scanParam === 'gate';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const passParam = params.get('pass') || params.get('card');
      const verifyParam = params.get('verify');
      const scanParam = params.get('scan');

      if (scanParam === 'true' || scanParam === 'gate') {
        setPublicVerifyId(verifyParam || passParam || null);
        setIsSecurityGateScanMode(true);
        setIsDriverCardMode(false);
      } else if (passParam) {
        setPublicVerifyId(passParam);
        setIsDriverCardMode(true);
        setIsSecurityGateScanMode(false);
      } else if (verifyParam) {
        setPublicVerifyId(verifyParam);
        setIsDriverCardMode(true);
        setIsSecurityGateScanMode(false);
      }
    }
  }, []);

  // Initialize seed data once on mount
  useEffect(() => {
    seedInitialMasterData();
  }, []);

  // 1. DEDICATED DRIVER DIGITAL TENKO CARD VIEW (Clean ID Card view for driver's phone via WhatsApp link)
  if (isDriverCardMode && publicVerifyId) {
    return (
      <DriverTenkoCardView
        initialTenkoId={publicVerifyId}
      />
    );
  }

  // 2. DEDICATED SECURITY GATE CLEARANCE PORTAL (For Gate Officers scanning driver QR codes)
  if (isSecurityGateScanMode) {
    return (
      <SecurityGateVerificationPage
        initialTenkoId={publicVerifyId || undefined}
        isStandalonePublicView={true}
        onBackToApp={() => {
          setIsSecurityGateScanMode(false);
          setIsDriverCardMode(false);
          setPublicVerifyId(null);
          // Remove query params from url cleanly
          if (window.history.pushState) {
            window.history.pushState({}, document.title, window.location.pathname);
          }
        }}
      />
    );
  }

  // Update default landing page based on role when user logs in
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'SUPER_ADMIN') {
        setCurrentPage('superadmin_dashboard');
      } else {
        setCurrentPage('nakes_dashboard');
      }
    }
  }, [currentUser?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-bold tracking-wider uppercase">Memuat Sistem TENKO...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  const handleSelectExamination = (exam: TenkoExamination, printImmediate = false) => {
    setSelectedExamination(exam);
    if (printImmediate) {
      setReturnPage(currentPage);
      setCurrentPage('print_examination');
    } else {
      setCurrentPage('examination_detail');
    }
  };

  const handlePrintExamination = (exam: TenkoExamination) => {
    setSelectedExamination(exam);
    setReturnPage(currentPage);
    setCurrentPage('print_examination');
  };

  const handleExaminationCreated = (createdExam: TenkoExamination) => {
    setSelectedExamination(createdExam);
    setCurrentPage('examination_result');
  };

  return (
    <>
      <Layout currentPage={currentPage} onNavigate={(p) => setCurrentPage(p)}>
        {/* VIEW 1: Nakes Dashboard */}
        {currentPage === 'nakes_dashboard' && (
          <NakesDashboard
            onNavigate={(p) => setCurrentPage(p)}
            onSelectExamination={handleSelectExamination}
            onStartExaminationWithDriver={(driverId) => {
              setPreselectedDriverId(driverId);
              setCurrentPage('new_examination');
            }}
          />
        )}

        {/* VIEW 2: Super Admin Dashboard */}
        {currentPage === 'superadmin_dashboard' && (
          <SuperAdminDashboard
            onNavigate={(p) => setCurrentPage(p)}
            onSelectExamination={handleSelectExamination}
            onStartExaminationWithDriver={(driverId) => {
              setPreselectedDriverId(driverId);
              setCurrentPage('new_examination');
            }}
          />
        )}

        {/* VIEW 3: 6-Step Examination Form */}
        {currentPage === 'new_examination' && (
          <NewExaminationStepper
            initialDriverId={preselectedDriverId}
            onSuccess={(createdExam) => {
              setPreselectedDriverId(undefined);
              handleExaminationCreated(createdExam);
            }}
            onCancel={() => {
              setPreselectedDriverId(undefined);
              if (currentUser.role === 'SUPER_ADMIN') {
                setCurrentPage('superadmin_dashboard');
              } else {
                setCurrentPage('nakes_dashboard');
              }
            }}
          />
        )}

        {/* VIEW 4: Examination Result Banner Screen */}
        {currentPage === 'examination_result' && selectedExamination && (
          <ExaminationResultPage
            examination={selectedExamination}
            onPrint={() => handlePrintExamination(selectedExamination)}
            onNewExamination={() => setCurrentPage('new_examination')}
            onViewDetail={() => setCurrentPage('examination_detail')}
            onBackDashboard={() => {
              if (currentUser.role === 'SUPER_ADMIN') {
                setCurrentPage('superadmin_dashboard');
              } else {
                setCurrentPage('nakes_dashboard');
              }
            }}
          />
        )}

        {/* VIEW 5: Examination Multi-Section Detail */}
        {currentPage === 'examination_detail' && selectedExamination && (
          <ExaminationDetailPage
            examination={selectedExamination}
            onBack={() => setCurrentPage('data_tenko')}
            onPrint={() => handlePrintExamination(selectedExamination)}
          />
        )}

        {/* VIEW 6: Data TENKO (Pemeriksaan Baru & Data Hasil Pemeriksaan) */}
        {(currentPage === 'examination_history' || currentPage === 'data_tenko') && (
          <DataTenkoPage
            onSelectExamination={handleSelectExamination}
            onNewExamination={() => setCurrentPage('new_examination')}
          />
        )}

        {/* VIEW 6-ATTENDANCE: Attendance Log (Absensi Driver ERP vs TENKO) */}
        {currentPage === 'attendance_log' && (
          <AttendanceLogPage
            onStartExaminationWithDriver={(driverId) => {
              setPreselectedDriverId(driverId);
              setCurrentPage('new_examination');
            }}
            onNavigate={(p) => setCurrentPage(p)}
          />
        )}

        {/* VIEW 6-REPORT: Assessment Report (Result Tenko Assessment) */}
        {currentPage === 'assessment_report' && (
          <AssessmentReportPage
            onSelectExamination={handleSelectExamination}
          />
        )}

        {/* VIEW 6-SECURITY: Security Gate Verification Portal */}
        {currentPage === 'security_gate' && (
          <SecurityGateVerificationPage />
        )}

        {/* VIEW 6B: Driver Health (Monitoring Keluhan & Evaluasi Nakes) */}
        {currentPage === 'driver_health' && <DriverHealthPage />}

        {/* VIEW 6C: Medical Inventory (Manajemen Stok Obat Per Pool & Akumulasi) */}
        {currentPage === 'medical_inventory' && <MedicalInventoryPage />}

        {/* VIEW 7: Master Drivers */}
        {currentPage === 'master_drivers' && <MasterDriversPage />}

        {/* VIEW 8: Master Driver Groups */}
        {currentPage === 'master_driver_groups' && <MasterDriverGroupsPage />}

        {/* VIEW 9: Master Location */}
        {currentPage === 'master_location' && <MasterLocationPage />}

        {/* VIEW 9B: Master Health Indications */}
        {currentPage === 'master_health_indications' && <MasterHealthIndicationsPage />}

        {/* VIEW 9C: Master Vitamins */}
        {currentPage === 'master_vitamins' && <MasterVitaminsPage />}

        {/* VIEW 10: User Management (Consolidates Nakes, Super Admin, Security) */}
        {(currentPage === 'user_management' || currentPage === 'master_nakes') && <UserManagementPage />}

        {/* VIEW 11: Dedicated Printable TENKO Report View */}
        {currentPage === 'print_examination' && selectedExamination && (
          <PrintableTenkoReport
            examination={selectedExamination}
            onBack={() => setCurrentPage(returnPage)}
          />
        )}
      </Layout>
    </>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
