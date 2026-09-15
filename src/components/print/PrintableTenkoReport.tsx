import React from 'react';
import { TenkoExamination } from '../../types';
import {
  Printer,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface PrintableTenkoReportProps {
  examination: TenkoExamination;
  onBack?: () => void;
}

export const PrintableTenkoReport: React.FC<PrintableTenkoReportProps> = ({
  examination,
  onBack,
}) => {
  const handlePrint = () => {
    try {
      const originalTitle = document.title;
      const safeTenkoId = (examination.tenkoId || 'TENKO').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeDriverName = (examination.driverNameSnapshot || 'Driver').replace(/[^a-zA-Z0-9_-]/g, '_');
      document.title = `${safeTenkoId}_${safeDriverName}`;

      window.print();

      setTimeout(() => {
        document.title = originalTitle;
      }, 1500);
    } catch (e) {
      console.error('Print error:', e);
    }
  };

  const isFit = examination.recommendation === 'FIT TO WORK';
  const isFitNote = examination.recommendation === 'FIT TO WORK WITH NOTE';
  const isUnfit = examination.recommendation === 'UNFIT TO WORK';

  return (
    <div id="printable-tenko-wrapper" className="min-h-full pb-12 print:bg-white print:p-0">
      {/* Print Control Toolbar - Sticky at top of content area, hidden during actual print */}
      <div className="sticky top-0 z-30 mb-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-slate-200/90 print:hidden flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print-controls">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              id="btn-print-back"
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900">Dokumen Hasil Pemeriksaan TENKO</h2>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                {examination.tenkoId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Driver: <strong className="text-slate-800">{examination.driverNameSnapshot}</strong> ({examination.driverId}) • {examination.driverGroupSnapshot}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <button
            id="btn-trigger-print"
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Dokumen (Print / PDF)</span>
          </button>
        </div>
      </div>

      {/* Official A4 Document Card */}
      <div
        id="tenko-official-document"
        className="max-w-4xl mx-auto bg-white border border-slate-300 p-8 md:p-10 shadow-lg print:shadow-none print:border-none print:max-w-full print:p-6 text-slate-900"
        style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}
      >
        {/* HEADER SECTION */}
        <div className="border-b-2 border-slate-800 pb-4 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-xl tracking-tighter">
                TK
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">TENKO</h1>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                  Pancaran Logistics – Health & Safety Division
                </p>
              </div>
            </div>

            <div className="text-right">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                PEMERIKSAAN KESIAPAN DRIVER / KENEK
              </h2>
              <p className="text-xs text-slate-600 font-semibold uppercase">
                PRE-SHIPMENT HEALTH CLEARANCE REPORT
              </p>
            </div>
          </div>
        </div>

        {/* GENERAL INFORMATION BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5 mb-5 text-xs">
          <div>
            <span className="text-slate-500 font-medium block text-[10px] uppercase">ID TENKO</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{examination.tenkoId}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block text-[10px] uppercase">Tanggal Pemeriksaan</span>
            <span className="font-semibold text-slate-900">
              {new Date(examination.examinationDate || examination.createdAt).toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block text-[10px] uppercase">Waktu Selesai</span>
            <span className="font-semibold text-slate-900">
              {new Date(examination.finishTime).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              })} WIB
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block text-[10px] uppercase">Lokasi / Pool</span>
            <span className="font-semibold text-slate-900">
              {examination.locationNameSnapshot || examination.locationId || 'Pool Marunda - Jakarta Utara'}
            </span>
          </div>
        </div>

        {/* SECTION A: DATA DRIVER / KENEK */}
        <div className="mb-5 page-break-inside-avoid">
          <div className="bg-slate-800 text-white px-3 py-1.5 font-bold text-xs uppercase tracking-wider rounded-t">
            SECTION A : DATA DRIVER / KENEK (HISTORICAL SNAPSHOT)
          </div>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="w-1/4 p-2 font-semibold bg-slate-50 border-r border-slate-200">ID Driver / Kenek</td>
                <td className="w-1/4 p-2 font-mono font-bold text-blue-900 border-r border-slate-200">{examination.driverId}</td>
                <td className="w-1/4 p-2 font-semibold bg-slate-50 border-r border-slate-200">Posisi Armada</td>
                <td className="w-1/4 p-2 font-bold">{examination.positionSnapshot}</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold bg-slate-50 border-r border-slate-200">Nama Lengkap</td>
                <td className="p-2 font-bold border-r border-slate-200">{examination.driverNameSnapshot}</td>
                <td className="p-2 font-semibold bg-slate-50 border-r border-slate-200">Driver Group</td>
                <td className="p-2 font-medium">{examination.driverGroupSnapshot}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION B & C: KESIAPAN KERJA & TANDA VITAL (SIDE BY SIDE) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 page-break-inside-avoid">
          {/* SECTION B */}
          <div>
            <div className="bg-slate-800 text-white px-3 py-1.5 font-bold text-xs uppercase tracking-wider rounded-t">
              SECTION B : KESIAPAN KERJA
            </div>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-semibold bg-slate-50 border-r border-slate-200">RHA - JMP</td>
                  <td className="p-2 font-bold">{examination.rhaJmp === 'READY' ? 'SIAP' : 'TIDAK SIAP'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-semibold bg-slate-50 border-r border-slate-200">DOK - JMP</td>
                  <td className="p-2 font-bold">{examination.dokJmp === 'READY' ? 'SIAP' : 'TIDAK SIAP'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-semibold bg-slate-50 border-r border-slate-200">Daily Non-Working Hours</td>
                  <td className="p-2 font-bold">{examination.dailyNonWorkingHours === '>= 11 HOURS' ? '≥ 11 JAM' : '< 11 JAM'}</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold bg-slate-50 border-r border-slate-200">Durasi Tidur Off-Duty</td>
                  <td className="p-2 font-bold">{examination.offDutySleepDuration} Jam</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SECTION C */}
          <div>
            <div className="bg-slate-800 text-white px-3 py-1.5 font-bold text-xs uppercase tracking-wider rounded-t">
              SECTION C : TANDA VITAL
            </div>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-semibold bg-slate-50 border-r border-slate-200">Suhu Tubuh</td>
                  <td className="p-2 font-bold">{examination.temperature} °C</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-semibold bg-slate-50 border-r border-slate-200">Tekanan Darah (S/D)</td>
                  <td className="p-2 font-bold font-mono text-blue-900">{examination.bloodPressureResult}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 font-semibold bg-slate-50 border-r border-slate-200">Sistolik / Diastolik</td>
                  <td className="p-2 font-medium">{examination.bloodPressureSystolic} / {examination.bloodPressureDiastolic} mmHg</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold bg-slate-50 border-r border-slate-200">Denyut Nadi</td>
                  <td className="p-2 font-bold">{examination.heartRate} BPM</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION D: SCREENING */}
        <div className="mb-5 page-break-inside-avoid">
          <div className="bg-slate-800 text-white px-3 py-1.5 font-bold text-xs uppercase tracking-wider rounded-t">
            SECTION D : ALCOHOL & DRUG SCREENING
          </div>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <tbody>
              <tr>
                <td className="w-1/4 p-2 font-semibold bg-slate-50 border-r border-slate-200">Alcohol Test (BAC)</td>
                <td className="w-1/4 p-2 font-bold border-r border-slate-200">
                  <span className={examination.alcoholTest === 'POSITIVE' ? 'text-rose-600 font-black' : 'text-emerald-700'}>
                    {examination.alcoholTest === 'POSITIVE' ? 'POSITIF (+)' : examination.alcoholTest === 'NEGATIVE' ? 'NEGATIF (-)' : 'TIDAK DITES'}
                  </span>
                </td>
                <td className="w-1/4 p-2 font-semibold bg-slate-50 border-r border-slate-200">Drug Screening Test</td>
                <td className="w-1/4 p-2 font-bold">
                  <span className={examination.drugTest === 'POSITIVE' ? 'text-rose-600 font-black' : 'text-emerald-700'}>
                    {examination.drugTest === 'POSITIVE' ? 'POSITIF (+)' : examination.drugTest === 'NEGATIVE' ? 'NEGATIF (-)' : 'TIDAK DITES'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION E: PEMERIKSAAN FISIK & PERILAKU */}
        <div className="mb-5 page-break-inside-avoid">
          <div className="bg-slate-800 text-white px-3 py-1.5 font-bold text-xs uppercase tracking-wider rounded-t">
            SECTION E : PEMERIKSAAN FISIK & PERILAKU (11 PARAMETER OBSERVASI)
          </div>
          <div className="grid grid-cols-3 gap-2 border border-slate-300 p-3 text-xs">
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-600">1. Penampilan (Appearance):</span>
              <span className="font-bold">{examination.appearance === 'NORMAL' ? 'NORMAL' : 'TIDAK NORMAL'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-600">2. Mata (Eyes):</span>
              <span className="font-bold">{examination.eyes === 'NORMAL' ? 'NORMAL' : 'TIDAK NORMAL'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-600">3. Wajah (Face):</span>
              <span className="font-bold">{examination.face === 'NORMAL' ? 'NORMAL' : 'TIDAK NORMAL'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-600">4. Rambut (Hair):</span>
              <span className="font-bold">{examination.hair === 'NORMAL' ? 'NORMAL' : 'TIDAK NORMAL'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-600">5. Regulasi Emosi:</span>
              <span className="font-bold">{examination.emotionalRegulation === 'NORMAL' ? 'NORMAL' : 'TIDAK NORMAL'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-600">6. Problem Solving:</span>
              <span className="font-bold">{examination.problemSolving === 'NORMAL' ? 'NORMAL' : 'TIDAK NORMAL'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-600">7. Kesadaran Diri (Self-Awareness):</span>
              <span className="font-bold">{examination.selfAwareness === 'NORMAL' ? 'NORMAL' : 'TIDAK NORMAL'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-600">8. Komunikasi:</span>
              <span className="font-bold">{examination.communication === 'NORMAL' ? 'NORMAL' : 'TIDAK NORMAL'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-600">9. Decision Making:</span>
              <span className="font-bold">{examination.decisionMaking === 'NORMAL' ? 'NORMAL' : 'TIDAK NORMAL'}</span>
            </div>
            <div className="flex justify-between border-slate-200">
              <span className="text-slate-600">10. Balance Test:</span>
              <span className="font-bold">{examination.balanceTest === 'NORMAL' ? 'NORMAL' : 'TIDAK NORMAL'}</span>
            </div>
            <div className="flex justify-between border-slate-200">
              <span className="text-slate-600">11. Wawancara (Interview):</span>
              <span className="font-bold">{examination.interview === 'NORMAL' ? 'NORMAL' : 'TIDAK NORMAL'}</span>
            </div>
          </div>
        </div>

        {/* SECTION F: HASIL PEMERIKSAAN (PROMINENT RESULT BOX) */}
        <div className="mb-6 border-2 border-slate-800 rounded-lg p-4 bg-slate-50 page-break-inside-avoid">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-3 mb-3">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">SUMMARY KESEHATAN</span>
              <div className="flex items-center gap-2 mt-0.5">
                {examination.summary === 'PASSED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <span className="font-black text-base md:text-lg text-slate-900">
                  {examination.summary === 'PASSED' ? 'LULUS (PASSED)' : 'TIDAK LULUS (FAILED)'}
                </span>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <span className="text-xs font-semibold text-slate-500 uppercase">REKOMENDASI AKHIR NAKES</span>
              <div className="mt-1">
                <span
                  className={`inline-block px-4 py-1.5 rounded-md font-black text-sm md:text-base border ${
                    isFit
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : isFitNote
                      ? 'bg-amber-500 text-slate-950 border-amber-600'
                      : 'bg-rose-600 text-white border-rose-700'
                  }`}
                >
                  {examination.recommendation}
                </span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-700 uppercase">Catatan Pemeriksaan / Instruksi Nakes:</span>
            <p className="text-xs text-slate-800 mt-1 italic bg-white p-2.5 rounded border border-slate-200 min-h-[42px]">
              {examination.note || '- Tidak ada catatan tambahan -'}
            </p>
          </div>
        </div>

        {/* SIGNATURE AREA (OFFICIAL ACKNOWLEDGEMENT) */}
        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-300 text-xs page-break-inside-avoid">
          <div className="text-center">
            <p className="font-semibold text-slate-600 uppercase">Driver / Kenek Yang Diperiksa</p>
            <div className="h-16 flex items-center justify-center text-slate-300 italic">
              ( Tanda Tangan )
            </div>
            <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 inline-block min-w-[180px]">
              {examination.driverNameSnapshot}
            </p>
            <p className="text-[11px] text-slate-500">ID: {examination.driverId}</p>
          </div>

          <div className="text-center">
            <p className="font-semibold text-slate-600 uppercase">Pemeriksa / Nakes Berwenang</p>
            <div className="h-16 flex items-center justify-center text-slate-300 italic">
              ( Tanda Tangan & Cap Nakes )
            </div>
            <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 inline-block min-w-[180px]">
              {examination.examinerName || examination.createdBy}
            </p>
            <p className="text-[11px] text-slate-500">
              Waktu Selesai: {new Date(examination.finishTime).toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* FOOTER NOTICE */}
        <div className="mt-8 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
          <span>Sistem Tenko Pancaran Logistics — Pre-Shipment Health Clearance</span>
          <span>Dokumen ini sah dan tercatat secara digital pada database perusahaan.</span>
        </div>
      </div>
    </div>
  );
};
