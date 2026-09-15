import React from 'react';
import { TenkoExamination } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  ArrowLeft,
  Printer,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  Stethoscope,
  Heart,
  Thermometer,
  Activity,
  FileText,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface ExaminationDetailPageProps {
  examination: TenkoExamination;
  onBack: () => void;
  onPrint: () => void;
}

export const ExaminationDetailPage: React.FC<ExaminationDetailPageProps> = ({
  examination,
  onBack,
  onPrint,
}) => {
  return (
    <div id="examination-detail-container" className="max-w-4xl mx-auto space-y-6">
      {/* Header Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">Detail Pemeriksaan TENKO</h2>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                {examination.tenkoId}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Diperiksa pada {examination.examinationDate} pukul {new Date(examination.finishTime).toLocaleTimeString('id-ID')} WIB
            </p>
          </div>
        </div>

        <button
          onClick={onPrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print Hasil TENKO</span>
        </button>
      </div>

      {/* Main Multi-Section Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6 text-xs">
        {/* SECTION 1: Data Driver/Kenek (Snapshot) */}
        <div>
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            1. Data Driver / Kenek (Snapshot Historis)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <span className="text-slate-500 block text-[11px]">ID Driver</span>
              <span className="font-mono font-bold text-blue-900 text-sm">{examination.driverId}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Nama Driver / Kenek</span>
              <span className="font-bold text-slate-900 text-sm">{examination.driverNameSnapshot}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Posisi Armada</span>
              <span className="font-bold text-slate-800">{examination.positionSnapshot}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Driver Group</span>
              <span className="font-bold text-slate-800">{examination.driverGroupSnapshot}</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Kesiapan Kerja */}
        <div>
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            2. Kesiapan Kerja
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <span className="text-slate-500 block text-[11px]">RHA - JMP</span>
              <StatusBadge type="readiness" value={examination.rhaJmp} size="sm" />
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">DOK - JMP</span>
              <StatusBadge type="readiness" value={examination.dokJmp} size="sm" />
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Daily Non-Working Hours</span>
              <span className="font-bold text-slate-800">{examination.dailyNonWorkingHours === '>= 11 HOURS' ? '≥ 11 JAM' : '< 11 JAM'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Durasi Tidur Off-Duty</span>
              <span className="font-bold text-slate-800">{examination.offDutySleepDuration} Jam</span>
            </div>
          </div>
        </div>

        {/* SECTION 3: Tanda Vital */}
        <div>
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-600" />
            3. Tanda Vital
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <span className="text-slate-500 block text-[11px]">Suhu Tubuh</span>
              <span className="font-bold text-slate-900 text-sm">{examination.temperature} °C</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Tekanan Darah (S/D)</span>
              <span className="font-mono font-bold text-blue-900 text-sm">{examination.bloodPressureResult}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Sistolik / Diastolik</span>
              <span className="font-medium text-slate-800">{examination.bloodPressureSystolic} / {examination.bloodPressureDiastolic} mmHg</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Denyut Nadi</span>
              <span className="font-bold text-slate-900 text-sm">{examination.heartRate} BPM</span>
            </div>
          </div>
        </div>

        {/* SECTION 4: Screening */}
        <div>
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            4. Alcohol & Drug Screening
          </h3>
          <div className="grid grid-cols-2 gap-4 mt-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <span className="text-slate-500 block text-[11px] mb-1">Alcohol Test (BAC)</span>
              <StatusBadge type="screening" value={examination.alcoholTest} size="md" />
            </div>
            <div>
              <span className="text-slate-500 block text-[11px] mb-1">Drug Screening Test</span>
              <StatusBadge type="screening" value={examination.drugTest} size="md" />
            </div>
          </div>
        </div>

        {/* SECTION 5: Pemeriksaan Fisik & Perilaku */}
        <div>
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            5. Pemeriksaan Fisik & Perilaku (11 Parameter)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div><span className="text-slate-500 block text-[11px]">Appearance:</span> <StatusBadge type="physical" value={examination.appearance} size="sm" /></div>
            <div><span className="text-slate-500 block text-[11px]">Eyes:</span> <StatusBadge type="physical" value={examination.eyes} size="sm" /></div>
            <div><span className="text-slate-500 block text-[11px]">Face:</span> <StatusBadge type="physical" value={examination.face} size="sm" /></div>
            <div><span className="text-slate-500 block text-[11px]">Hair:</span> <StatusBadge type="physical" value={examination.hair} size="sm" /></div>
            <div><span className="text-slate-500 block text-[11px]">Emotional Regulation:</span> <StatusBadge type="physical" value={examination.emotionalRegulation} size="sm" /></div>
            <div><span className="text-slate-500 block text-[11px]">Problem Solving:</span> <StatusBadge type="physical" value={examination.problemSolving} size="sm" /></div>
            <div><span className="text-slate-500 block text-[11px]">Self-Awareness:</span> <StatusBadge type="physical" value={examination.selfAwareness} size="sm" /></div>
            <div><span className="text-slate-500 block text-[11px]">Communication:</span> <StatusBadge type="physical" value={examination.communication} size="sm" /></div>
            <div><span className="text-slate-500 block text-[11px]">Decision Making:</span> <StatusBadge type="physical" value={examination.decisionMaking} size="sm" /></div>
            <div><span className="text-slate-500 block text-[11px]">Balance Test:</span> <StatusBadge type="physical" value={examination.balanceTest} size="sm" /></div>
            <div><span className="text-slate-500 block text-[11px]">Interview:</span> <StatusBadge type="physical" value={examination.interview} size="sm" /></div>
          </div>
        </div>

        {/* SECTION 6: Summary & Recommendation */}
        <div>
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            6. Hasil & Rekomendasi
          </h3>
          <div className="mt-3 p-5 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-slate-500 block text-[11px]">Summary Medis:</span>
                <StatusBadge type="summary" value={examination.summary} size="md" />
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Rekomendasi Nakes:</span>
                <StatusBadge type="recommendation" value={examination.recommendation} size="md" />
              </div>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px] mb-1">Catatan Nakes:</span>
              <p className="bg-white p-3 rounded-xl border border-blue-100 text-slate-800 italic">
                {examination.note || '- Tidak ada catatan tambahan -'}
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 7 & 8: Informasi Pemeriksaan & Audit Trail */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
              7. Informasi Pemeriksa
            </h4>
            <div className="space-y-1 text-slate-600">
              <p>Nakes Pemeriksa: <strong className="text-slate-900">{examination.examinerName}</strong></p>
              <p>Waktu Selesai: <strong className="text-slate-900">{new Date(examination.finishTime).toLocaleString('id-ID')}</strong></p>
              <p>Lokasi Pool: <strong className="text-slate-900">{examination.locationNameSnapshot || 'Pool Marunda'}</strong></p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
              8. Audit Trail Information
            </h4>
            <div className="space-y-1 text-slate-600">
              <p>Created Date: <strong className="text-slate-900">{new Date(examination.createdAt).toLocaleString('id-ID')}</strong></p>
              <p>Created By: <strong className="text-slate-900">{examination.createdBy}</strong></p>
              {examination.updatedAt && (
                <p>Updated Date: <strong className="text-slate-900">{new Date(examination.updatedAt).toLocaleString('id-ID')}</strong></p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
