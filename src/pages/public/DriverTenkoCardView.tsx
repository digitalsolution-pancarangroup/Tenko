import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { TenkoExamination } from '../../types';
import { DigitalTenkoCard } from '../../components/tenko/DigitalTenkoCard';
import { checkTenkoValidity, checkIfTenkoAlreadyUsed } from '../../services/securityGateService';
import {
  Loader2,
  AlertCircle,
  Search,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Lock,
  User,
  Truck,
  Calendar,
  XCircle,
} from 'lucide-react';

interface DriverTenkoCardViewProps {
  initialTenkoId?: string;
}

export const DriverTenkoCardView: React.FC<DriverTenkoCardViewProps> = ({
  initialTenkoId,
}) => {
  const [searchId, setSearchId] = useState(initialTenkoId || '');
  const [loading, setLoading] = useState(false);
  const [examination, setExamination] = useState<TenkoExamination | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Examination by Tenko ID / Barcode / Document ID
  const fetchExamination = async (targetId: string) => {
    const cleanId = (targetId || '').trim();
    if (!cleanId) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      let resolvedExam: TenkoExamination | null = null;

      // 1. Try direct doc ID match first
      const docRef = doc(db, 'tenkoExaminations', cleanId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        resolvedExam = {
          tenkoDocumentId: docSnap.id,
          ...docSnap.data(),
        } as TenkoExamination;
      }

      // 2. Query by tenkoId
      if (!resolvedExam) {
        const qTenkoId = query(
          collection(db, 'tenkoExaminations'),
          where('tenkoId', '==', cleanId)
        );
        const snapTenkoId = await getDocs(qTenkoId);
        if (!snapTenkoId.empty) {
          const foundDoc = snapTenkoId.docs[0];
          resolvedExam = {
            tenkoDocumentId: foundDoc.id,
            ...foundDoc.data(),
          } as TenkoExamination;
        }
      }

      // 3. Fallback: Search all recent documents in collection
      if (!resolvedExam) {
        const allDocsSnap = await getDocs(collection(db, 'tenkoExaminations'));
        const lowerCleanId = cleanId.toLowerCase();

        for (const d of allDocsSnap.docs) {
          const data = d.data() as TenkoExamination;
          if (
            d.id.toLowerCase() === lowerCleanId ||
            (data.tenkoId && data.tenkoId.toLowerCase() === lowerCleanId) ||
            (data.driverId && data.driverId.toLowerCase() === lowerCleanId)
          ) {
            resolvedExam = {
              tenkoDocumentId: d.id,
              ...data,
            };
            break;
          }
        }
      }

      if (resolvedExam) {
        // Double-check security gate logs directly to ensure instantaneous confirmation reflection
        try {
          const usedCheck = await checkIfTenkoAlreadyUsed(
            resolvedExam.tenkoId,
            resolvedExam.tenkoDocumentId
          );
          if (usedCheck.isUsed && usedCheck.previousLog) {
            resolvedExam.isUsed = true;
            resolvedExam.securityGateStatus = usedCheck.previousLog.gateStatus;
            resolvedExam.securityOfficerName = usedCheck.previousLog.securityOfficerName;
            resolvedExam.securityCheckedAt = usedCheck.previousLog.checkedAt;
            resolvedExam.vehiclePlateNumber = resolvedExam.vehiclePlateNumber || usedCheck.previousLog.vehiclePlateNumber;
            resolvedExam.securityNotes = resolvedExam.securityNotes || usedCheck.previousLog.securityNotes;
          }
        } catch {
          // ignore
        }

        setExamination(resolvedExam);
      } else {
        setErrorMessage(`Data Kartu Tenko "${cleanId}" tidak ditemukan atau belum tersinkronisasi.`);
        setExamination(null);
      }
    } catch (err: any) {
      console.error('Error fetching examination for driver card:', err);
      setErrorMessage('Terjadi kesalahan saat memuat kartu. Silakan periksa koneksi internet Anda.');
      setExamination(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialTenkoId) {
      fetchExamination(initialTenkoId);
    }
  }, [initialTenkoId]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) {
      fetchExamination(searchId.trim());
    }
  };

  const validity = examination ? checkTenkoValidity(examination) : null;
  const isHeld = Boolean(validity?.isHeld || examination?.securityGateStatus === 'REJECTED');
  const isUsed = Boolean(
    validity?.isUsed ||
    examination?.isUsed ||
    examination?.securityGateStatus === 'PASSED' ||
    examination?.securityGateStatus === 'WARNING_PASSED' ||
    isHeld
  );
  const isExpired = Boolean(validity?.isExpired);
  const isUnfit = examination?.recommendation === 'UNFIT TO WORK';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-6 px-3 sm:px-6 antialiased selection:bg-blue-600 selection:text-white">
      {/* TOP BRANDING BAR (Without 'Masuk Petugas' Button) */}
      <header className="max-w-2xl mx-auto w-full flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#0B3B60] border border-blue-400/40 text-white font-black text-base flex items-center justify-center shadow-md">
            T
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
              PT PANCARAN DARAT TRANSPORT
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">
              Sistem Tenko & Keselamatan Operasional Pengemudi
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-amber-400 font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>SAFETY FIRST</span>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-2xl mx-auto w-full my-auto py-4 flex flex-col items-center">
        {/* 1. LOADING STATE */}
        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 w-full shadow-xl">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-2" />
            <h2 className="text-base font-bold text-white">Memuat Kartu Tenko Digital...</h2>
            <p className="text-xs text-slate-400 font-mono">
              Memeriksa keabsahan dan data pemeriksaan dari database...
            </p>
          </div>
        )}

        {/* 2. ERROR STATE / NOT FOUND */}
        {!loading && errorMessage && (
          <div className="w-full space-y-4">
            <div className="bg-rose-950/50 border-2 border-rose-800 rounded-2xl p-6 text-rose-200 flex items-start gap-4">
              <AlertCircle className="w-7 h-7 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Kartu Tidak Ditemukan</h3>
                <p className="text-xs text-rose-300 leading-relaxed">{errorMessage}</p>
              </div>
            </div>

            {/* Re-Search Box */}
            <form
              onSubmit={handleManualSearch}
              className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3"
            >
              <label className="block text-xs font-bold text-slate-300">
                Masukkan Ulang ID Kartu Tenko / NIK Driver:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Contoh: TNK_20260916_109523... atau NIK"
                  className="flex-1 bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Cari</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 3. CASE A1: KARTU DITAHAN OLEH SECURITY GERBANG (HOLD) */}
        {!loading && examination && isHeld && (
          <div className="w-full space-y-4 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 border-2 border-rose-700 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-3xl bg-rose-950 text-rose-400 border border-rose-700 flex items-center justify-center mx-auto shadow-inner">
                <XCircle className="w-8 h-8 text-rose-400" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-widest font-mono">
                  ARMADA DITAHAN • TIDAK DIIZINKAN KELUAR GERBANG
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
                  Kartu Tenko Ditahan (HOLD)
                </h2>
                <p className="text-xs sm:text-sm text-rose-200 max-w-md mx-auto mt-1 leading-relaxed">
                  Pemeriksaan Tenko ini telah diverifikasi oleh Petugas Security Gerbang dan dinyatakan <strong>DITAHAN</strong>. Pengemudi dilarang keluar gerbang pool.
                </p>
              </div>

              {/* Clearance Details Box */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs text-left space-y-2 max-w-md mx-auto">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Pengemudi:</span>
                  <span className="font-bold text-white uppercase">{examination.driverNameSnapshot} ({examination.driverId})</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Armada / Group:</span>
                  <span className="font-medium text-slate-200">{examination.driverGroupSnapshot || '-'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Petugas Security:</span>
                  <span className="font-bold text-rose-400">{validity?.usedByOfficer || examination.securityOfficerName || 'Security Gerbang'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Waktu Verifikasi:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {validity?.usedAt ? new Date(validity.usedAt).toLocaleString('id-ID') : (examination.securityCheckedAt ? new Date(examination.securityCheckedAt).toLocaleString('id-ID') : '-')} WIB
                  </span>
                </div>
                {examination.securityNotes && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Catatan Security:</span>
                    <span className="text-rose-300 font-medium italic">{examination.securityNotes}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status Kartu:</span>
                  <span className="font-mono font-black text-rose-400">DITAHAN (HOLD)</span>
                </div>
              </div>

              {/* Safety Rule Note */}
              <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-2xl text-[11px] text-rose-200 leading-relaxed max-w-md mx-auto text-left flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  Sesuai prosedur operasional keselamatan, kartu ini tidak dapat digunakan. Silakan pengemudi segera melapor kembali ke Pos Kesehatan / Tim Operasional.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3. CASE A2: KARTU SUDAH DIGUNAKAN / CHECK-OUT SELESAI (PASSED) */}
        {!loading && examination && isUsed && !isHeld && (
          <div className="w-full space-y-4 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-3xl bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center mx-auto shadow-inner">
                <Lock className="w-8 h-8 text-amber-400" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest font-mono">
                  LINK DINONAKTIFKAN • SELESAI DIGUNAKAN
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
                  Kartu Tenko Sudah Digunakan
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto mt-1 leading-relaxed">
                  Pemeriksaan Tenko ini telah diverifikasi & disetujui oleh Petugas Security di Gerbang Pool untuk keluar ritase.
                </p>
              </div>

              {/* Clearance Details Box */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs text-left space-y-2 max-w-md mx-auto">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Pengemudi:</span>
                  <span className="font-bold text-white uppercase">{examination.driverNameSnapshot} ({examination.driverId})</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Armada / Group:</span>
                  <span className="font-medium text-slate-200">{examination.driverGroupSnapshot || '-'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Petugas Security:</span>
                  <span className="font-bold text-amber-400">{validity?.usedByOfficer || examination.securityOfficerName || 'Security Gerbang'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Waktu Verifikasi Gerbang:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {validity?.usedAt ? new Date(validity.usedAt).toLocaleString('id-ID') : (examination.securityCheckedAt ? new Date(examination.securityCheckedAt).toLocaleString('id-ID') : '-')} WIB
                  </span>
                </div>
                {examination.vehiclePlateNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Nomor Polisi Truk:</span>
                    <span className="font-mono font-black text-amber-400">{examination.vehiclePlateNumber}</span>
                  </div>
                )}
              </div>

              {/* Safety Rule Note */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] text-slate-300 leading-relaxed max-w-md mx-auto text-left flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Pemeriksaan telah selesai diverifikasi oleh security gerbang. Tautan dan barcode dinonaktifkan demi keselamatan operasional. Driver wajib menjalani pemeriksaan Tenko baru di Pos Medis untuk ritase berikutnya.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3. CASE B: KARTU KADALUWARSA (> 8 JAM) */}
        {!loading && examination && !isUsed && isExpired && (
          <div className="w-full space-y-4 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 border-2 border-rose-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-3xl bg-rose-950 text-rose-400 border border-rose-800 flex items-center justify-center mx-auto shadow-inner">
                <Clock className="w-8 h-8 text-rose-400" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase tracking-widest font-mono">
                  TIKET KADALUWARSA
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
                  Masa Berlaku Kartu Tenko Habis
                </h2>
                <p className="text-xs sm:text-sm text-rose-300 max-w-md mx-auto mt-1 leading-relaxed">
                  Masa berlaku pemeriksaan Tenko (maksimal 8 jam shift) telah melewati batas waktu pada{' '}
                  <strong className="text-white font-mono">{validity?.validUntil.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</strong>.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-left space-y-2 max-w-md mx-auto">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Pengemudi:</span>
                  <span className="font-bold text-white uppercase">{examination.driverNameSnapshot} ({examination.driverId})</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Waktu Pemeriksaan Nakes:</span>
                  <span className="font-mono text-slate-200">
                    {examination.examinationDate} {new Date(examination.finishTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status Validitas:</span>
                  <span className="font-mono font-black text-rose-400">EXPIRED (&gt; 8 JAM)</span>
                </div>
              </div>

              <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-2xl text-[11px] text-rose-200 leading-relaxed max-w-md mx-auto text-left flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  Sesuai Standar Operasional Keselamatan (SOP), barcode kadaluarsa <strong>tidak dapat di-scan oleh Security di Gerbang</strong>. Silakan hubungi Petugas Medis untuk pemeriksaan Tenko baru.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3. CASE C: ACTIVE & VALID KARTU TENKO (TAMPILKAN KARTU + UNDUH GAMBAR PNG SAJA) */}
        {!loading && examination && !isUsed && !isExpired && (
          <div className="w-full flex flex-col items-center space-y-3 animate-in fade-in zoom-in-95">
            {/* The exact Digital Tenko Card with actionVariant="download_only" */}
            <DigitalTenkoCard
              examination={examination}
              actionVariant="download_only"
            />

            {/* Helpful Driver Instructions */}
            <div className="text-center pt-2 space-y-1.5 max-w-lg">
              <p className="text-xs text-slate-300 font-medium flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Tunjukkan QR Code di kartu ini kepada Security di Gerbang Pool.</span>
              </p>
              {validity && (
                <p className="text-[11px] text-slate-400 font-mono">
                  Masa berlaku kartu tersisa: <strong className="text-emerald-400">{validity.hoursRemaining} Jam {validity.minutesRemaining} Menit</strong> (s/d {validity.validUntil.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)
                </p>
              )}
            </div>
          </div>
        )}

        {/* 4. EMPTY INITIAL SEARCH IF NO ID GIVEN */}
        {!loading && !examination && !errorMessage && (
          <form
            onSubmit={handleManualSearch}
            className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 w-full text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Lihat Kartu Tenko Driver</h3>
              <p className="text-xs text-slate-400 mt-1">
                Masukkan ID Tiket Tenko atau NIK Driver untuk melihat kartu resmi.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Contoh: TNK_20260916_109523... atau NIK"
                className="flex-1 bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari</span>
              </button>
            </div>
          </form>
        )}
      </main>

      {/* FOOTER */}
      <footer className="max-w-2xl mx-auto w-full pt-4 border-t border-slate-800 text-center text-[10px] text-slate-400">
        <p className="font-mono">PT PANCARAN DARAT TRANSPORT • SAFETY FIRST</p>
      </footer>
    </div>
  );
};

