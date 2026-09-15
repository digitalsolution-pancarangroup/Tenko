import React from 'react';
import { TenkoExamination } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Printer,
  PlusCircle,
  Eye,
  LayoutDashboard,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  Stethoscope,
  FileSpreadsheet,
} from 'lucide-react';

interface ExaminationResultPageProps {
  examination: TenkoExamination;
  onPrint: () => void;
  onNewExamination: () => void;
  onViewDetail: () => void;
  onBackDashboard: () => void;
}

export const ExaminationResultPage: React.FC<ExaminationResultPageProps> = ({
  examination,
  onPrint,
  onNewExamination,
  onViewDetail,
  onBackDashboard,
}) => {
  const isFit = examination.recommendation === 'FIT TO WORK';
  const isFitNote = examination.recommendation === 'FIT TO WORK WITH NOTE';
  const isUnfit = examination.recommendation === 'UNFIT TO WORK';

  return (
    <div id="examination-result-view" className="max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Header Banner with Big Recommendation Status */}
      <div
        className={`rounded-3xl p-8 text-center border-2 shadow-xl ${
          isFit
            ? 'bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-white border-emerald-400'
            : isFitNote
            ? 'bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-white border-amber-400'
            : 'bg-gradient-to-b from-rose-500/10 via-rose-500/5 to-white border-rose-400'
        }`}
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 shadow-lg ring-8 ring-white">
          {isFit && (
            <div className="w-full h-full rounded-full bg-emerald-600 text-white flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12" />
            </div>
          )}
          {isFitNote && (
            <div className="w-full h-full rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
              <AlertTriangle className="w-12 h-12" />
            </div>
          )}
          {isUnfit && (
            <div className="w-full h-full rounded-full bg-rose-600 text-white flex items-center justify-center">
              <XCircle className="w-12 h-12" />
            </div>
          )}
        </div>

        <span className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
          HASIL PEMERIKSAAN KESIAPAN TENKO
        </span>

        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
          {examination.recommendation}
        </h2>

        <p className="text-xs md:text-sm text-slate-600 max-w-md mx-auto mt-2 font-medium">
          {isFit && 'Pengemudi dinyatakan sehat, siap, dan layak menjalankan tugas pengiriman logistik.'}
          {isFitNote && 'Pengemudi dapat bertugas dengan pengawasan dan mematuhi catatan istirahat medis.'}
          {isUnfit && 'Pengemudi TIDAK DIIZINKAN melakukan pengiriman demi keselamatan berkendara.'}
        </p>

        <div className="inline-flex items-center gap-2 mt-4 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-800">
          <span>ID TENKO: {examination.tenkoId}</span>
        </div>
      </div>

      {/* Main Details Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
          Ringkasan Pemeriksaan Pengemudi
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 font-medium block text-[11px]">NAMA DRIVER / KENEK</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{examination.driverNameSnapshot}</span>
            <span className="font-mono text-blue-700 font-semibold">{examination.driverId} • {examination.positionSnapshot}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 font-medium block text-[11px]">DRIVER GROUP</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{examination.driverGroupSnapshot}</span>
            <span className="text-slate-500 font-medium">{examination.locationNameSnapshot || 'Pool Marunda'}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 font-medium block text-[11px]">TANGGAL & WAKTU SELESAI</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{examination.examinationDate}</span>
            <span className="text-slate-600 font-medium">{new Date(examination.finishTime).toLocaleTimeString('id-ID')} WIB</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 font-medium block text-[11px]">SUMMARY & VITAL SIGN</span>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge type="summary" value={examination.summary} size="sm" />
              <span className="font-mono font-bold text-slate-800">{examination.bloodPressureResult}</span>
            </div>
          </div>
        </div>

        {/* Note section */}
        {examination.note && (
          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 text-xs">
            <span className="font-bold text-blue-900 uppercase block mb-1">Catatan Nakes Pemeriksa:</span>
            <p className="text-slate-800 italic leading-relaxed">{examination.note}</p>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>Pemeriksa: <strong className="text-slate-800">{examination.examinerName}</strong></span>
          <span>Status Sistem: <strong className="text-emerald-700">Tersimpan di Firestore</strong></span>
        </div>
      </div>

      {/* 4 Required Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. PRINT HASIL TENKO */}
        <button
          id="btn-result-print-tenko"
          onClick={onPrint}
          className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
        >
          <Printer className="w-5 h-5" />
          <span>Print Hasil TENKO</span>
        </button>

        {/* 2. PEMERIKSAAN BARU */}
        <button
          id="btn-result-new-exam"
          onClick={onNewExamination}
          className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md shadow-black/10 transition cursor-pointer"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Pemeriksaan Baru</span>
        </button>

        {/* 3. LIHAT DETAIL */}
        <button
          id="btn-result-view-detail"
          onClick={onViewDetail}
          className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs shadow-xs transition cursor-pointer"
        >
          <Eye className="w-5 h-5 text-slate-600" />
          <span>Lihat Detail</span>
        </button>

        {/* 4. KEMBALI KE DASHBOARD */}
        <button
          id="btn-result-back-dashboard"
          onClick={onBackDashboard}
          className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs shadow-xs transition cursor-pointer"
        >
          <LayoutDashboard className="w-5 h-5 text-slate-600" />
          <span>Ke Dashboard</span>
        </button>
      </div>
    </div>
  );
};
