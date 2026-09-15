import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  ExaminationRecommendation,
  ExaminationSummary,
  AccountStatus,
  ScreeningResult,
  ReadinessStatus,
  PhysicalObservationStatus,
} from '../../types';

interface StatusBadgeProps {
  type?: 'recommendation' | 'summary' | 'status' | 'screening' | 'readiness' | 'physical';
  value: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type = 'recommendation',
  value,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs md:text-sm px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm md:text-base px-4 py-2 gap-2 font-semibold',
  };

  // Recommendation
  if (type === 'recommendation' || value === 'FIT TO WORK' || value === 'FIT TO WORK WITH NOTE' || value === 'UNFIT TO WORK') {
    if (value === 'FIT TO WORK') {
      return (
        <span
          id="badge-fit-to-work"
          className={`inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 ${sizeClasses[size]}`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>FIT TO WORK</span>
        </span>
      );
    }
    if (value === 'FIT TO WORK WITH NOTE') {
      return (
        <span
          id="badge-fit-with-note"
          className={`inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-300 ${sizeClasses[size]}`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>FIT TO WORK WITH NOTE</span>
        </span>
      );
    }
    if (value === 'UNFIT TO WORK') {
      return (
        <span
          id="badge-unfit-to-work"
          className={`inline-flex items-center rounded-full bg-rose-50 text-rose-700 border border-rose-300 ${sizeClasses[size]}`}
        >
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>UNFIT TO WORK</span>
        </span>
      );
    }
  }

  // Summary (LULUS / TIDAK LULUS)
  if (type === 'summary' || value === 'PASSED' || value === 'FAILED' || value === 'LULUS' || value === 'TIDAK LULUS') {
    const isPassed = value === 'PASSED' || value === 'LULUS';
    return (
      <span
        id={`badge-summary-${value}`}
        className={`inline-flex items-center rounded-full ${
          isPassed
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        } ${sizeClasses[size]}`}
      >
        {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        <span>{isPassed ? 'LULUS' : 'TIDAK LULUS'}</span>
      </span>
    );
  }

  // Account / Master Status (ACTIVE / INACTIVE)
  if (type === 'status' || value === 'ACTIVE' || value === 'INACTIVE') {
    const isActive = value === 'ACTIVE';
    return (
      <span
        id={`badge-status-${value}`}
        className={`inline-flex items-center rounded-full ${
          isActive
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-slate-100 text-slate-600 border border-slate-200'
        } ${sizeClasses[size]}`}
      >
        {isActive ? <UserCheck className="w-3.5 h-3.5 text-blue-600" /> : <UserX className="w-3.5 h-3.5 text-slate-500" />}
        <span>{isActive ? 'AKTIF' : 'NONAKTIF'}</span>
      </span>
    );
  }

  // Screening (POSITIVE / NEGATIVE / NO TEST)
  if (type === 'screening') {
    if (value === 'NEGATIVE') {
      return (
        <span className={`inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses[size]}`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>NEGATIF</span>
        </span>
      );
    }
    if (value === 'POSITIVE') {
      return (
        <span className={`inline-flex items-center rounded-full bg-rose-50 text-rose-700 border border-rose-300 font-semibold ${sizeClasses[size]}`}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          <span>POSITIF</span>
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses[size]}`}>
        <span>TIDAK DITES</span>
      </span>
    );
  }

  // Readiness (READY / NOT READY)
  if (type === 'readiness') {
    const isReady = value === 'READY' || value === 'SIAP';
    return (
      <span className={`inline-flex items-center rounded-full ${isReady ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'} border border-current/20 ${sizeClasses[size]}`}>
        <span>{isReady ? 'SIAP' : 'TIDAK SIAP'}</span>
      </span>
    );
  }

  // Physical (NORMAL / ABNORMAL)
  if (type === 'physical') {
    const isNormal = value === 'NORMAL';
    return (
      <span className={`inline-flex items-center rounded-full ${isNormal ? 'bg-slate-50 text-slate-700' : 'bg-amber-50 text-amber-800 font-medium'} border border-current/20 ${sizeClasses[size]}`}>
        <span>{isNormal ? 'NORMAL' : 'TIDAK NORMAL'}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-full bg-slate-100 text-slate-700 ${sizeClasses[size]}`}>
      {value}
    </span>
  );
};
