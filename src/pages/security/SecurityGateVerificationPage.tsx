import React, { useState, useEffect, useRef } from 'react';
import { TenkoExamination, SecurityGatePassLog, GatePassStatus } from '../../types';
import { getTenkoById, getTenkoExaminations } from '../../services/tenkoService';
import {
  checkTenkoValidity,
  checkIfTenkoAlreadyUsed,
  createGateClearanceLog,
  getSavedSecurityOfficerName,
  getSavedSecurityGateLocation,
  saveSecurityOfficerName,
  saveSecurityGateLocation,
} from '../../services/securityGateService';
import { useToast } from '../../components/common/Toast';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  QrCode,
  Search,
  Truck,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Camera,
  CameraOff,
  Phone,
  Loader2,
  Lock,
  Check,
  RotateCcw,
} from 'lucide-react';

interface SecurityGateVerificationPageProps {
  initialTenkoId?: string;
  onBackToApp?: () => void;
  isStandalonePublicView?: boolean;
}

export const SecurityGateVerificationPage: React.FC<SecurityGateVerificationPageProps> = ({
  initialTenkoId,
  isStandalonePublicView = false,
}) => {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState(initialTenkoId || '');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [matchedExam, setMatchedExam] = useState<TenkoExamination | null>(null);
  const [searchError, setSearchError] = useState('');
  const [previousPassLog, setPreviousPassLog] = useState<SecurityGatePassLog | null>(null);

  // Security Form States (Persisted in localStorage)
  const [securityOfficerName, setSecurityOfficerName] = useState(getSavedSecurityOfficerName());
  const [gateLocation, setGateLocation] = useState(getSavedSecurityGateLocation());
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState('');
  const [securityNotes, setSecurityNotes] = useState('');
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);

  // Modal and Completion Screen States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmedLog, setConfirmedLog] = useState<SecurityGatePassLog | null>(null);
  const [isVerificationCompleted, setIsVerificationCompleted] = useState(false);

  // Camera Scanner States (For fallback when no ID provided)
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Load initial examination from parameter
  useEffect(() => {
    if (initialTenkoId) {
      handleLookupExam(initialTenkoId);
    }
  }, [initialTenkoId]);

  const handleLookupExam = async (queryStr: string) => {
    const clean = queryStr.trim();
    if (!clean) return;

    setLoadingSearch(true);
    setSearchError('');
    setPreviousPassLog(null);
    setIsVerificationCompleted(false);

    try {
      // 1. Direct search by Tenko ID / Document ID
      let found = await getTenkoById(clean);

      // 2. If not found, search across all recent examinations
      if (!found) {
        const all = await getTenkoExaminations();
        found = all.find(
          (e) =>
            (e.tenkoId && e.tenkoId.toLowerCase() === clean.toLowerCase()) ||
            (e.tenkoDocumentId && e.tenkoDocumentId.toLowerCase() === clean.toLowerCase()) ||
            (e.driverId && e.driverId.toLowerCase() === clean.toLowerCase())
        ) || null;
      }

      if (found) {
        setMatchedExam(found);
        setSearchError('');

        // Check if already used in gate logs
        const usedCheck = await checkIfTenkoAlreadyUsed(found.tenkoId, found.tenkoDocumentId);
        if (usedCheck.isUsed && usedCheck.previousLog) {
          setPreviousPassLog(usedCheck.previousLog);
          showToast(`PERINGATAN: Kartu Tenko ${found.driverNameSnapshot} sudah pernah di-scan/digunakan!`, 'error');
        } else if (found.isUsed || found.securityGateStatus === 'PASSED' || found.securityGateStatus === 'WARNING_PASSED') {
          showToast(`PERINGATAN: Kartu Tenko ${found.driverNameSnapshot} sudah berstatus DIGUNAKAN.`, 'error');
        } else {
          showToast(`Data Tenko untuk ${found.driverNameSnapshot} ditemukan.`, 'success');
        }
      } else {
        setMatchedExam(null);
        setSearchError(`Data Tenko tidak ditemukan untuk ID / NIK: "${clean}". Pastikan Driver sudah melakukan pemeriksaan.`);
        showToast('Data Tenko tidak ditemukan.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      setSearchError('Terjadi kesalahan saat memeriksa data.');
      showToast('Gagal memverifikasi data.', 'error');
    } finally {
      setLoadingSearch(false);
    }
  };

  // Camera handling for fallback
  const startCamera = async () => {
    setCameraError('');
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Kamera tidak dapat diakses atau izin ditolak.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Handle Gate Clearance Submission
  const handleConfirmGatePass = async (gateStatus: GatePassStatus) => {
    if (!matchedExam) return;

    if (!securityOfficerName.trim()) {
      showToast('Harap masukkan Nama Petugas Security Gerbang.', 'error');
      return;
    }

    const validity = checkTenkoValidity(matchedExam);

    setIsSubmittingPass(true);
    try {
      saveSecurityOfficerName(securityOfficerName);
      saveSecurityGateLocation(gateLocation);

      const cleanPlate = vehiclePlateNumber.trim().toUpperCase() || undefined;
      const cleanNotes = securityNotes.trim() || undefined;

      const log = await createGateClearanceLog({
        tenkoId: matchedExam.tenkoId || matchedExam.tenkoDocumentId || '',
        tenkoDocumentId: matchedExam.tenkoDocumentId || matchedExam.tenkoId || '',
        driverId: matchedExam.driverId || '',
        driverName: matchedExam.driverNameSnapshot || 'Driver',
        driverGroup: matchedExam.driverGroupSnapshot || 'Armada Logistik',
        position: matchedExam.positionSnapshot || 'DRIVER',
        vehiclePlateNumber: cleanPlate,
        recommendation: matchedExam.recommendation || 'FIT TO WORK',
        gateStatus: gateStatus,
        securityOfficerName: securityOfficerName.trim(),
        securityNotes: cleanNotes,
        locationName: gateLocation.trim() || 'Gate Utama',
        isExpired: Boolean(validity.isExpired),
      });

      // Update local state to immediately show verified status
      setMatchedExam((prev) =>
        prev
          ? {
              ...prev,
              isUsed: true,
              securityGateStatus: gateStatus,
              securityOfficerName: securityOfficerName.trim(),
              securityCheckedAt: log.checkedAt,
              vehiclePlateNumber: cleanPlate || prev.vehiclePlateNumber,
            }
          : null
      );

      setConfirmedLog(log);
      setShowConfirmModal(true);
    } catch (err: any) {
      console.error(err);
      showToast('Gagal menyimpan log security.', 'error');
    } finally {
      setIsSubmittingPass(false);
    }
  };

  // Close popup and exit from confirmation screen to completion screen
  const handleAcknowledgeSuccess = () => {
    setShowConfirmModal(false);
    setIsVerificationCompleted(true);
    try {
      if (typeof window !== 'undefined' && window.opener) {
        window.close();
      }
    } catch {
      // ignore
    }
  };

  // Reset to scan next driver
  const handleResetForNextDriver = () => {
    setMatchedExam(null);
    setSearchQuery('');
    setSearchError('');
    setPreviousPassLog(null);
    setVehiclePlateNumber('');
    setSecurityNotes('');
    setConfirmedLog(null);
    setIsVerificationCompleted(false);
  };

  const validity = matchedExam ? checkTenkoValidity(matchedExam) : null;
  const isHeld = Boolean(
    validity?.isHeld ||
    matchedExam?.securityGateStatus === 'REJECTED' ||
    previousPassLog?.gateStatus === 'REJECTED'
  );
  const isAlreadyUsed = Boolean(
    validity?.isUsed ||
    matchedExam?.isUsed ||
    previousPassLog !== null ||
    matchedExam?.securityGateStatus === 'PASSED' ||
    matchedExam?.securityGateStatus === 'WARNING_PASSED' ||
    isHeld
  );
  const isFit = matchedExam?.recommendation === 'FIT TO WORK';
  const isFitWithNote = matchedExam?.recommendation === 'FIT TO WORK WITH NOTE';
  const isUnfit = matchedExam?.recommendation === 'UNFIT TO WORK';

  // 1. COMPLETION SCREEN (After Security clicks OK on the confirmation popup)
  if (isVerificationCompleted && confirmedLog) {
    const isPassed = confirmedLog.gateStatus === 'PASSED' || confirmedLog.gateStatus === 'WARNING_PASSED';
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-6 px-4 antialiased">
        <header className="max-w-xl mx-auto w-full flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0B3B60] border border-blue-400/40 text-white font-black text-sm flex items-center justify-center">
              T
            </div>
            <div>
              <h1 className="text-xs font-black text-white tracking-wide uppercase">
                PT PANCARAN DARAT TRANSPORT
              </h1>
              <p className="text-[10px] text-slate-400">Pos Security Gerbang Pool</p>
            </div>
          </div>
        </header>

        <main className="max-w-xl mx-auto w-full my-auto py-8 text-center space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-xl ${
              isPassed ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border-2 border-rose-500/40'
            }`}>
              {isPassed ? <Check className="w-10 h-10 text-emerald-400 stroke-[3]" /> : <XCircle className="w-10 h-10 text-rose-400" />}
            </div>

            <div className="space-y-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest font-mono border ${
                isPassed ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-rose-950 text-rose-300 border-rose-800'
              }`}>
                {isPassed ? 'VERIFIKASI GERBANG SELESAI' : 'ARMADA DITAHAN (HOLD)'}
              </span>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {isPassed ? 'Driver Diizinkan Keluar Gerbang' : 'Driver Dilarang Keluar Gerbang'}
              </h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Data pemeriksaan telah terkonfirmasi oleh <strong className="text-white">{confirmedLog.securityOfficerName}</strong> dan status Tenko telah diperbarui secara real-time di sistem aplikasi.
              </p>
            </div>

            {/* Summary Details Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-left space-y-2.5 max-w-md mx-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Pengemudi:</span>
                <span className="font-bold text-white uppercase">{confirmedLog.driverName} ({confirmedLog.driverId})</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Posisi / Group:</span>
                <span className="font-medium text-slate-200">{confirmedLog.position} • {confirmedLog.driverGroup}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Waktu Verifikasi:</span>
                <span className="font-mono text-slate-200">
                  {new Date(confirmedLog.checkedAt).toLocaleTimeString('id-ID')} WIB ({new Date(confirmedLog.checkedAt).toLocaleDateString('id-ID')})
                </span>
              </div>
              {confirmedLog.vehiclePlateNumber && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">Plat Truk:</span>
                  <span className="font-mono font-bold text-amber-400">{confirmedLog.vehiclePlateNumber}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Nomor Log Gate:</span>
                <span className="font-mono text-[11px] text-slate-400">{confirmedLog.gateLogId}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto">
              <button
                type="button"
                onClick={handleResetForNextDriver}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Scan Driver Berikutnya</span>
              </button>
            </div>
          </div>
        </main>

        <footer className="max-w-xl mx-auto w-full pt-4 border-t border-slate-800 text-center text-[10px] text-slate-400">
          <p className="font-mono">PT PANCARAN DARAT TRANSPORT • SAFETY FIRST</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 antialiased">
      {/* 1. TOP CLEAN HEADER (No 'Kembali ke Aplikasi', No long title text) */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-6 py-3.5">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0B3B60] border border-blue-400/40 text-white font-black text-sm flex items-center justify-center shadow-md">
              T
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
                PT PANCARAN DARAT TRANSPORT
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">
                Pos Security Gerbang • Konfirmasi Keluar Armada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-amber-400 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>GATE PORTAL</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTAINER */}
      <main className="max-w-3xl mx-auto w-full px-4 pt-6">
        {/* Loading Search Indicator */}
        {loadingSearch && (
          <div className="bg-slate-900 rounded-3xl p-12 border border-slate-800 text-center flex flex-col items-center justify-center space-y-3 animate-in fade-in">
            <Loader2 className="w-10 h-10 animate-spin text-amber-400 mb-2" />
            <h3 className="text-base font-bold text-white">Memverifikasi Kartu Tenko...</h3>
            <p className="text-xs text-slate-400 font-mono">Memeriksa status kelayakan medis dan barcode...</p>
          </div>
        )}

        {/* Search Error Notice */}
        {!loadingSearch && searchError && (
          <div className="p-6 rounded-3xl bg-rose-950/40 border-2 border-rose-800 text-rose-200 flex items-start gap-4 animate-in fade-in">
            <XCircle className="w-8 h-8 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-black text-rose-300">DATA TIDAK DITEMUKAN / DITOLAK</h3>
              <p className="text-sm mt-1 text-rose-200 leading-relaxed">{searchError}</p>
              <p className="text-xs text-rose-400 font-mono mt-2 font-bold uppercase">
                ATURAN: DRIVER WAJIB MENJALANI PEMERIKSAAN TENKO SEBELUM KELUAR GERBANG!
              </p>
            </div>
          </div>
        )}

        {/* 3. MATCHED EXAMINATION: DIRECT FOCUSED CLEARANCE SCREEN */}
        {!loadingSearch && matchedExam && validity && (
          <div className="space-y-4 animate-in fade-in zoom-in-95">
            {/* BIG SECURITY GATE STATUS BANNER */}
            <div
              className={`p-5 sm:p-6 rounded-3xl border-2 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isAlreadyUsed
                  ? 'bg-slate-900 border-amber-600 text-amber-200'
                  : validity.isExpired
                  ? 'bg-slate-900 border-slate-700 text-slate-300'
                  : isUnfit
                  ? 'bg-rose-950/90 border-rose-600 text-rose-100 shadow-rose-900/30'
                  : isFitWithNote
                  ? 'bg-amber-950/90 border-amber-500 text-amber-100 shadow-amber-900/30'
                  : 'bg-emerald-950/90 border-emerald-500 text-emerald-100 shadow-emerald-900/30'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                    isAlreadyUsed
                      ? 'bg-amber-500 text-slate-950'
                      : validity.isExpired
                      ? 'bg-slate-800 text-slate-400'
                      : isUnfit
                      ? 'bg-rose-600 text-white'
                      : isFitWithNote
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-500 text-slate-950'
                  }`}
                >
                  {isAlreadyUsed ? (
                    <ShieldAlert className="w-7 h-7" />
                  ) : validity.isExpired ? (
                    <Clock className="w-7 h-7" />
                  ) : isUnfit ? (
                    <ShieldAlert className="w-7 h-7" />
                  ) : isFitWithNote ? (
                    <AlertTriangle className="w-7 h-7" />
                  ) : (
                    <ShieldCheck className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block font-mono">
                    HASIL VERIFIKASI KEAMANAN GERBANG
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                    {isAlreadyUsed
                      ? 'TIKET SUDAH DIGUNAKAN (CHECK-OUT SELESAI)'
                      : validity.isExpired
                      ? 'TIKET KADALUWARSA (> 8 JAM)'
                      : isUnfit
                      ? 'UNFIT • DILARANG KELUAR GERBANG!'
                      : isFitWithNote
                      ? 'FIT DENGAN CATATAN (BERSYARAT)'
                      : 'FIT TO DRIVE • DIIZINKAN KELUAR'}
                  </h2>
                  <p className="text-xs opacity-90 mt-0.5">
                    {isAlreadyUsed
                      ? `Kartu ini sudah pernah diverifikasi & di-pass oleh Security (${previousPassLog?.securityOfficerName || validity?.usedByOfficer || matchedExam?.securityOfficerName || 'Petugas'}). Dilarang mengizinkan ulang.`
                      : validity.isExpired
                      ? 'Pemeriksaan sudah lebih dari 8 jam. Driver wajib melakukan Tenko ulang.'
                      : isUnfit
                      ? 'Driver tidak memenuhi syarat kesehatan fisik/mental. Wajib istirahat dan batal jalan.'
                      : isFitWithNote
                      ? 'Driver diizinkan mengemudi dengan pengawasan catatan medis nakes.'
                      : 'Driver dalam kondisi prima dan memenuhi standar keselamatan berkendara.'}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-white/20 pt-2.5 sm:pt-0 sm:pl-4 shrink-0">
                <span className="text-[10px] font-bold uppercase opacity-75 block">Status Validitas</span>
                <span className="text-sm font-black font-mono">
                  {isAlreadyUsed ? 'SUDAH DIGUNAKAN' : validity.isExpired ? 'EXPIRED' : `${validity.hoursRemaining}J ${validity.minutesRemaining}M`}
                </span>
                <span className="text-[10px] opacity-75 block mt-0.5">
                  {isAlreadyUsed
                    ? `Di-pass: ${previousPassLog?.checkedAt ? new Date(previousPassLog.checkedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : (validity?.usedAt ? new Date(validity.usedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-')} WIB`
                    : `Berlaku s/d: ${validity.validUntil.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`}
                </span>
              </div>
            </div>

            {/* DRIVER PROFILE & MEDICAL REVIEW CARD */}
            <div className="bg-slate-950 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-xl shadow-md">
                    {matchedExam.driverNameSnapshot.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 text-[10px] font-bold border border-blue-700/50">
                        {matchedExam.positionSnapshot}
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-400">
                        NIK: {matchedExam.driverId}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white mt-1">
                      {matchedExam.driverNameSnapshot}
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Truck className="w-3.5 h-3.5 text-slate-500" />
                      <span>{matchedExam.driverGroupSnapshot || 'Armada Logistik'}</span>
                      {matchedExam.driverPhoneSnapshot && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {matchedExam.driverPhoneSnapshot}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-500 block">ID TENKO</span>
                  <span className="text-xs font-mono font-black text-amber-400 truncate max-w-[120px] block">{matchedExam.tenkoId}</span>
                </div>
              </div>

              {/* Vitals Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
                <div className="p-2.5 bg-slate-900 rounded-2xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block">Tekanan Darah</span>
                  <p className="text-sm font-black text-white mt-0.5">{matchedExam.bloodPressureResult || `${matchedExam.bloodPressureSystolic}/${matchedExam.bloodPressureDiastolic}`}</p>
                  <span className="text-[9px] text-slate-500">mmHg</span>
                </div>

                <div className="p-2.5 bg-slate-900 rounded-2xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block">Suhu Tubuh</span>
                  <p className="text-sm font-black text-white mt-0.5">{matchedExam.temperature}°C</p>
                  <span className="text-[9px] text-slate-500">Normal</span>
                </div>

                <div className="p-2.5 bg-slate-900 rounded-2xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block">Denyut Nadi</span>
                  <p className="text-sm font-black text-white mt-0.5">{matchedExam.heartRate} bpm</p>
                  <span className="text-[9px] text-slate-500">Normal</span>
                </div>

                <div className="p-2.5 bg-slate-900 rounded-2xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block">Alkohol / Narkoba</span>
                  <p className={`text-xs font-black mt-1 ${matchedExam.alcoholTest === 'NEGATIVE' && matchedExam.drugTest === 'NEGATIVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {matchedExam.alcoholTest} / {matchedExam.drugTest}
                  </p>
                </div>
              </div>

              {/* Nakes Note */}
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span>Catatan Nakes Pemeriksa:</span>
                  <span className="text-amber-400">{matchedExam.examinerName || 'Nakes'} • {matchedExam.examinationDate}</span>
                </div>
                <p className="text-slate-200 italic">
                  "{matchedExam.note && matchedExam.note !== '-' ? matchedExam.note : 'Kondisi kesehatan stabil dan layak berkendara.'}"
                </p>
              </div>
            </div>

            {/* SECURITY CLEARANCE ACTION FORM */}
            <div className="bg-slate-950 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                  Tindakan Petugas Security Gerbang (Gate Clearance)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Nama Petugas Security <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="input-security-officer-name"
                    type="text"
                    value={securityOfficerName}
                    onChange={(e) => setSecurityOfficerName(e.target.value)}
                    placeholder="Contoh: Danu Prasetyo / Bobi"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 text-xs font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Nomor Polisi / Plat Truk (Opsional)
                  </label>
                  <input
                    id="input-security-vehicle-plate"
                    type="text"
                    value={vehiclePlateNumber}
                    onChange={(e) => setVehiclePlateNumber(e.target.value)}
                    placeholder="Contoh: B 9281 UXT"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 text-xs font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Catatan Petugas Security (Opsional)
                  </label>
                  <input
                    id="input-security-notes"
                    type="text"
                    value={securityNotes}
                    onChange={(e) => setSecurityNotes(e.target.value)}
                    placeholder="Contoh: Muatan lengkap, APD terpasang"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 text-xs font-medium"
                  />
                </div>
              </div>

              {/* Already Used Alert */}
              {isAlreadyUsed && (
                <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 ${
                  isHeld
                    ? 'bg-rose-950/60 border-rose-700 text-rose-200'
                    : 'bg-amber-950/50 border-amber-700 text-amber-200'
                }`}>
                  <AlertTriangle className={`w-5 h-5 shrink-0 ${isHeld ? 'text-rose-400' : 'text-amber-400'}`} />
                  <div>
                    <strong className="block text-xs uppercase font-bold mb-0.5">
                      {isHeld ? 'KARTU DITAHAN (HOLD)' : 'KARTU SUDAH DIGUNAKAN (CHECK-OUT SELESAI)'}
                    </strong>
                    <span>
                      {isHeld
                        ? `Kartu ini telah dinyatakan DITAHAN oleh Security (${previousPassLog?.securityOfficerName || matchedExam.securityOfficerName || 'Petugas'}). Driver dilarang keluar pool.`
                        : `Tiket Tenko ini sudah pernah diproses & diverifikasi oleh Security (${previousPassLog?.securityOfficerName || matchedExam.securityOfficerName || 'Petugas'}). Tombol aksi dinonaktifkan demi keselamatan.`}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Approve / Pass Button */}
                <button
                  type="button"
                  id="btn-gate-approve-pass"
                  onClick={() => handleConfirmGatePass(isFitWithNote ? 'WARNING_PASSED' : 'PASSED')}
                  disabled={isSubmittingPass || isUnfit || validity.isExpired || isAlreadyUsed}
                  className={`py-3.5 px-4 rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2 transition ${
                    isUnfit || validity.isExpired || isAlreadyUsed
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 cursor-pointer'
                  }`}
                >
                  {isSubmittingPass ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>IZINKAN KELUAR GERBANG (PASS)</span>
                </button>

                {/* Reject / Hold Button */}
                <button
                  type="button"
                  id="btn-gate-reject-hold"
                  onClick={() => handleConfirmGatePass('REJECTED')}
                  disabled={isSubmittingPass || isAlreadyUsed}
                  className={`py-3.5 px-4 rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2 transition ${
                    isAlreadyUsed
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-rose-700 hover:bg-rose-600 text-white shadow-rose-900/40 cursor-pointer'
                  }`}
                >
                  {isSubmittingPass ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  <span>TAHAN / TOLAK KELUAR (HOLD)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. FALLBACK: IF NO DRIVER SCANNED YET, SHOW CLEAN PROMPT WITH CAMERA BUTTON */}
        {!matchedExam && !searchError && !loadingSearch && (
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 text-center flex flex-col items-center justify-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-800 text-amber-400 flex items-center justify-center border border-slate-700 shadow-inner">
              <QrCode className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Pindai Barcode Kartu Tenko</h3>
              <p className="text-xs text-slate-400 mt-1">
                Scan QR Code pada Kartu Tenko Digital pengemudi di pos gerbang pool.
              </p>
            </div>

            {isCameraActive ? (
              <div className="w-full space-y-2">
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-amber-500/60 shadow-lg">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                </div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                >
                  Tutup Kamera
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                className="py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Camera className="w-4 h-4" />
                <span>Buka Kamera Scan</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* 5. INSTANT CONFIRMATION POPUP MODAL (User Requirement: Pop-up terkonfirmasi oleh security dengan nama & waktu) */}
      {showConfirmModal && confirmedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-2 border-slate-700 animate-in zoom-in-95 space-y-5 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-xl ${
              confirmedLog.gateStatus === 'PASSED' || confirmedLog.gateStatus === 'WARNING_PASSED'
                ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/60'
                : 'bg-rose-500/20 text-rose-400 border-2 border-rose-500/60'
            }`}>
              {confirmedLog.gateStatus === 'PASSED' || confirmedLog.gateStatus === 'WARNING_PASSED' ? (
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              ) : (
                <XCircle className="w-9 h-9 text-rose-400" />
              )}
            </div>

            <div className="space-y-1.5">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest font-mono border ${
                confirmedLog.gateStatus === 'PASSED' || confirmedLog.gateStatus === 'WARNING_PASSED'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border-rose-800'
              }`}>
                {confirmedLog.gateStatus === 'PASSED' || confirmedLog.gateStatus === 'WARNING_PASSED' ? 'PASSED • DIIZINKAN KELUAR' : 'HOLD • DITAHAN'}
              </span>
              <h3 className="text-xl font-black text-white tracking-tight">
                Sudah Terkonfirmasi oleh Security
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Data Tenko di aplikasi telah otomatis diperbarui dengan keterangan terkonfirmasi oleh Security.
              </p>
            </div>

            {/* Detail Snapshot */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-left space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Pengemudi:</span>
                <span className="font-bold text-white uppercase">{confirmedLog.driverName} ({confirmedLog.driverId})</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Petugas Security:</span>
                <span className="font-bold text-amber-400">{confirmedLog.securityOfficerName}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Waktu Verifikasi:</span>
                <span className="font-mono text-slate-200">
                  {new Date(confirmedLog.checkedAt).toLocaleDateString('id-ID')} pukul {new Date(confirmedLog.checkedAt).toLocaleTimeString('id-ID')} WIB
                </span>
              </div>
              {confirmedLog.vehiclePlateNumber && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">No. Polisi Truk:</span>
                  <span className="font-mono font-bold text-amber-300">{confirmedLog.vehiclePlateNumber}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status Data di Aplikasi:</span>
                <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Terkonfirmasi Security
                </span>
              </div>
            </div>

            {/* OK Button - Automatically exits from confirmation page */}
            <button
              type="button"
              id="btn-confirm-security-modal-ok"
              onClick={handleAcknowledgeSuccess}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              OK / Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
