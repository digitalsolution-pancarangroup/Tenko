import React from 'react';
import { TenkoExamination } from '../../types';
import { NavigationPage } from '../../components/layout/Sidebar';
import { ExecutiveDashboardView } from '../../components/dashboard/ExecutiveDashboardView';

interface NakesDashboardProps {
  onNavigate: (page: NavigationPage) => void;
  onSelectExamination: (exam: TenkoExamination, printImmediate?: boolean) => void;
  onStartExaminationWithDriver?: (driverId: string) => void;
}

export const NakesDashboard: React.FC<NakesDashboardProps> = ({
  onNavigate,
  onSelectExamination,
  onStartExaminationWithDriver,
}) => {
  return (
    <div id="nakes-dashboard-page">
      <ExecutiveDashboardView
        onNavigate={onNavigate}
        onSelectExamination={onSelectExamination}
        onStartExaminationWithDriver={onStartExaminationWithDriver}
      />
    </div>
  );
};
