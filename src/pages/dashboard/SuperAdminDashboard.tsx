import React from 'react';
import { TenkoExamination } from '../../types';
import { NavigationPage } from '../../components/layout/Sidebar';
import { ExecutiveDashboardView } from '../../components/dashboard/ExecutiveDashboardView';

interface SuperAdminDashboardProps {
  onNavigate: (page: NavigationPage) => void;
  onSelectExamination: (exam: TenkoExamination, printImmediate?: boolean) => void;
  onStartExaminationWithDriver?: (driverId: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onNavigate,
  onSelectExamination,
  onStartExaminationWithDriver,
}) => {
  return (
    <div id="superadmin-dashboard-page">
      <ExecutiveDashboardView
        onNavigate={onNavigate}
        onSelectExamination={onSelectExamination}
        onStartExaminationWithDriver={onStartExaminationWithDriver}
      />
    </div>
  );
};
