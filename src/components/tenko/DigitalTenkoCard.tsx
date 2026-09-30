import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas-pro';
import { TenkoExamination } from '../../types';
import {
  openTenkoWhatsApp,
  generateTenkoDriverPassUrl,
  generateTenkoSecurityScanUrl,
} from '../../utils/whatsappHelper';
import { checkTenkoValidity } from '../../services/securityGateService';
import { getDriverByCustomId, updateDriver } from '../../services/driverService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import {
  Download,
  Printer,
  Copy,
  Send,
  Loader2,
  CheckSquare,
  AlertTriangle,
  XSquare,
  Phone,
  Info,
  Save,
} from 'lucide-react';

interface DigitalTenkoCardProps {
  examination: TenkoExamination;
  showActions?: boolean;
  actionVariant?: 'full' | 'download_only' | 'none';
  onPrint?: () => void;
}

export const DigitalTenkoCard: React.FC<DigitalTenkoCardProps> = ({
  examination,
  showActions = true,
  actionVariant,
  onPrint,
}) => {
  const effectiveVariant = actionVariant || (showActions ? 'full' : 'none');
  const cardRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [downloadingImage, setDownloadingImage] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [customPhone, setCustomPhone] = useState(examination.driverPhoneSnapshot || '');
  const [activeDriverDocId, setActiveDriverDocId] = useState<string>('');

  const validity = checkTenkoValidity(examination);
  const driverPassUrl = generateTenkoDriverPassUrl(examination);
  const securityScanUrl = generateTenkoSecurityScanUrl(examination);

  const isFit = examination.recommendation === 'FIT TO WORK';
  const isFitWithNote = examination.recommendation === 'FIT TO WORK WITH NOTE';
  const isUnfit = examination.recommendation === 'UNFIT TO WORK';

  // Format validTo date as: M/d/YYYY H:mm:ss (Matching the exact card reference)
  const validToDate = validity.validUntil;
  const formattedValidTo = `${validToDate.getMonth() + 1}/${validToDate.getDate()}/${validToDate.getFullYear()} ${validToDate.getHours()}:${String(validToDate.getMinutes()).padStart(2, '0')}:${String(validToDate.getSeconds()).padStart(2, '0')}`;

  // Tenko Message text and styling
  let tenkoMessage = 'Anda sehat, selamat bertugas!';
  if (isFitWithNote) {
    tenkoMessage = examination.note && examination.note !== '-' ? `Fit Bersyarat: ${examination.note}` : 'Fit dengan Catatan Nakes.';
  } else if (isUnfit) {
    tenkoMessage = examination.note && examination.note !== '-' ? `UNFIT: ${examination.note}` : 'Dinyatakan UNFIT - Dilarang Mengemudi!';
  }

  // Handle Download Image (PNG)
  const handleDownloadCardImage = async () => {
    if (!cardRef.current) return;
    setDownloadingImage(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, // High resolution for crisp barcode scanning
        useCORS: true,
        backgroundColor: '#CCD1D6',
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeName = (examination.driverNameSnapshot || 'Driver').replace(/\s+/g, '_');
      const dateStr = examination.examinationDate || 'TENKO';
      link.download = `Digital_Tenko_Card_${safeName}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();

      showToast('Kartu Tenko Digital berhasil disimpan sebagai gambar PNG.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Gagal mengunduh gambar kartu.', 'error');
    } finally {
      setDownloadingImage(false);
    }
  };

  // Handle Copy Verification Link (Driver pass URL)
  const handleCopyLink = () => {
    navigator.clipboard.writeText(driverPassUrl);
    showToast('Tautan Kartu Tenko Driver berhasil disalin!', 'success');
  };

  // Handle Dynamic WhatsApp Click: Live lookup to Master Driver
  const handleSendWhatsApp = async () => {
    setCheckingPhone(true);
    try {
      let resolvedPhone = customPhone.trim() || (examination.driverPhoneSnapshot || '').trim();

      // 1. Check live Master Driver data
      if (examination.driverId) {
        const liveDriver = await getDriverByCustomId(examination.driverId);
        if (liveDriver) {
          if (liveDriver.driverDocumentId) {
            setActiveDriverDocId(liveDriver.driverDocumentId);
          }
          if (liveDriver.phoneNumber && liveDriver.phoneNumber.trim()) {
            resolvedPhone = liveDriver.phoneNumber.trim();
            setCustomPhone(resolvedPhone);
          }
        }
      }

      // 2. If phone is found, directly open WhatsApp without modal
      if (resolvedPhone) {
        openTenkoWhatsApp(examination, resolvedPhone);
        showToast('Membuka WhatsApp...', 'info');
      } else {
        // Driver truly has no phone in Master Driver -> show informative modal
        setIsPhoneModalOpen(true);
      }
    } catch (err) {
      console.error('Error in live driver phone check:', err);
      if (customPhone.trim() || examination.driverPhoneSnapshot?.trim()) {
        openTenkoWhatsApp(examination, customPhone.trim() || examination.driverPhoneSnapshot!.trim());
      } else {
        setIsPhoneModalOpen(true);
      }
    } finally {
      setCheckingPhone(false);
    }
  };

  const handleConfirmSendWhatsAppModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneToSave = customPhone.trim();
    if (!phoneToSave) {
      showToast('Silakan masukkan nomor WhatsApp driver.', 'error');
      return;
    }

    setSavingPhone(true);
    try {
      // Auto-save the phone number to Master Driver so future examinations & lookups are seamless
      if (examination.driverId) {
        const liveDriver = await getDriverByCustomId(examination.driverId);
        const docId = activeDriverDocId || liveDriver?.driverDocumentId;
        if (docId) {
          await updateDriver(
            docId,
            { phoneNumber: phoneToSave },
            {
              userId: currentUser?.userId || 'SYS_NAKES',
              fullName: currentUser?.fullName || 'Nakes Pemeriksa',
            }
          );
          showToast('Nomor HP berhasil disimpan ke Master Driver.', 'success');
        }
      }
    } catch (err: any) {
      console.warn('Gagal menyimpan nomor HP ke Master Driver:', err);
    } finally {
      setSavingPhone(false);
      openTenkoWhatsApp(examination, phoneToSave);
      setIsPhoneModalOpen(false);
      showToast('Membuka WhatsApp...', 'info');
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* THE PHYSICAL DIGITAL TENKO CARD (Container that gets captured or displayed) */}
      <div
        ref={cardRef}
        id={`digital-tenko-card-${examination.tenkoId || examination.tenkoDocumentId}`}
        className="w-full max-w-2xl bg-[#CCD1D6] border-2 sm:border-4 border-black text-black font-sans shadow-2xl overflow-hidden select-none"
        style={{
          boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.4), 0 0 0 1px #000000',
        }}
      >
        {/* HEADER: Solid Navy Blue */}
        <div className="bg-[#0B3B60] text-white py-3.5 px-4 text-center border-b-2 sm:border-b-3 border-black">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-sans drop-shadow-xs">
            Digital Tenko Card
          </h1>
          <p className="text-xs sm:text-sm font-semibold italic text-slate-100 tracking-wide mt-0.5">
            No Tenko, No Get Out!!!
          </p>
        </div>

        {/* CARD BODY */}
        <div className="p-4 sm:p-5">
          {/* Top Bar: Valid to */}
          <div className="flex items-center text-xs sm:text-sm font-bold text-black pb-3 mb-3 border-b border-slate-400/60">
            <span className="w-24 sm:w-28 shrink-0 font-bold">Valid to</span>
            <span className="mr-2 font-bold">:</span>
            <span className="font-mono font-bold tracking-tight text-black">
              {formattedValidTo}
            </span>
            {validity.isExpired && (
              <span className="ml-2 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase font-mono">
                EXPIRED
              </span>
            )}
          </div>

          {/* MAIN GRID: Left Fields + Right QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch">
            {/* LEFT COLUMN: Driver Identity Fields & Tenko Message */}
            <div className="sm:col-span-7 flex flex-col justify-between space-y-2">
              {/* Field: ID Driver */}
              <div className="flex items-center text-xs sm:text-sm">
                <span className="w-24 sm:w-28 shrink-0 font-bold text-black">ID Driver</span>
                <span className="mr-2 font-bold text-black">:</span>
                <div className="flex-1 bg-white border border-slate-400 px-2.5 py-1 text-black font-bold font-mono text-xs sm:text-sm shadow-xs truncate">
                  {examination.driverId || '-'}
                </div>
              </div>

              {/* Field: Name */}
              <div className="flex items-center text-xs sm:text-sm">
                <span className="w-24 sm:w-28 shrink-0 font-bold text-black">Name</span>
                <span className="mr-2 font-bold text-black">:</span>
                <div className="flex-1 bg-white border border-slate-400 px-2.5 py-1 text-black font-bold text-xs sm:text-sm shadow-xs uppercase truncate">
                  {examination.driverNameSnapshot || '-'}
                </div>
              </div>

              {/* Field: Position */}
              <div className="flex items-center text-xs sm:text-sm">
                <span className="w-24 sm:w-28 shrink-0 font-bold text-black">Position</span>
                <span className="mr-2 font-bold text-black">:</span>
                <div className="flex-1 bg-white border border-slate-400 px-2.5 py-1 text-black font-bold text-xs sm:text-sm shadow-xs uppercase truncate">
                  {examination.positionSnapshot || 'DRIVER'}
                </div>
              </div>

              {/* Field: Group */}
              <div className="flex items-center text-xs sm:text-sm">
                <span className="w-24 sm:w-28 shrink-0 font-bold text-black">Group</span>
                <span className="mr-2 font-bold text-black">:</span>
                <div className="flex-1 bg-white border border-slate-400 px-2.5 py-1 text-black font-bold text-xs sm:text-sm shadow-xs uppercase truncate">
                  {examination.driverGroupSnapshot || '-'}
                </div>
              </div>

              {/* Tenko Message Box */}
              <div className="pt-2">
                <p className="text-[11px] sm:text-xs font-semibold italic text-black mb-1">
                  Tenko Message :
                </p>
                <div className="bg-[#BFC5CB] border border-slate-400 p-2.5 sm:p-3 flex items-center gap-2.5 min-h-[58px] shadow-inner">
                  {isFit && (
                    <div className="shrink-0 text-emerald-600 bg-white p-0.5 rounded-xs border border-emerald-600 shadow-xs">
                      <CheckSquare className="w-6 h-6 sm:w-7 sm:h-7 fill-emerald-500 text-white" />
                    </div>
                  )}
                  {isFitWithNote && (
                    <div className="shrink-0 text-amber-600 bg-white p-0.5 rounded-xs border border-amber-600 shadow-xs">
                      <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600" />
                    </div>
                  )}
                  {isUnfit && (
                    <div className="shrink-0 text-rose-600 bg-white p-0.5 rounded-xs border border-rose-600 shadow-xs">
                      <XSquare className="w-6 h-6 sm:w-7 sm:h-7 fill-rose-600 text-white" />
                    </div>
                  )}
                  <span className="text-xs sm:text-sm font-black text-black leading-snug">
                    {tenkoMessage}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: QR Code for Security Gate Confirmation */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center border-t sm:border-t-0 sm:border-l border-slate-400/60 pt-3 sm:pt-0 sm:pl-3">
              <p className="text-[11px] sm:text-xs font-semibold italic text-black text-center mb-1.5 font-sans">
                Scan for Security Confirmation
              </p>
              <div className="bg-white p-2 sm:p-2.5 border-2 border-black shadow-md flex items-center justify-center">
                <QRCodeSVG
                  value={securityScanUrl}
                  size={168}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      {effectiveVariant === 'download_only' && (
        <div className="w-full max-w-2xl mt-4">
          <button
            type="button"
            id="btn-download-tenko-card-png"
            onClick={handleDownloadCardImage}
            disabled={downloadingImage}
            className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-60 border border-blue-400/40"
          >
            {downloadingImage ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan Gambar...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Unduh Gambar (PNG)</span>
              </>
            )}
          </button>
        </div>
      )}

      {effectiveVariant === 'full' && (
        <div className="w-full max-w-2xl mt-4 flex flex-col gap-2.5">
          {/* Primary Action: Send to WhatsApp */}
          <button
            type="button"
            id="btn-send-tenko-wa"
            onClick={handleSendWhatsApp}
            disabled={checkingPhone}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
          >
            {checkingPhone ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memeriksa Nomor WhatsApp...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Kirim Kartu ke WhatsApp Driver</span>
              </>
            )}
          </button>

          {/* Secondary Actions Row */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              id="btn-download-tenko-card-png"
              onClick={handleDownloadCardImage}
              disabled={downloadingImage}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              {downloadingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>Unduh Gambar (PNG)</span>
            </button>

            {onPrint && (
              <button
                type="button"
                id="btn-print-tenko-card"
                onClick={onPrint}
                className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-purple-600" />
                <span>Cetak PDF</span>
              </button>
            )}

            <button
              type="button"
              id="btn-copy-tenko-verify-url"
              onClick={handleCopyLink}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-slate-600" />
              <span>Salin Link</span>
            </button>
          </div>
        </div>
      )}

      {/* INFORMATIVE MODAL: LENGKAPI NOMOR WHATSAPP DRIVER */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Nomor WhatsApp Belum Terdaftar</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Driver <strong className="text-slate-800">{examination.driverNameSnapshot}</strong> ({examination.driverId}) belum memiliki nomor HP di Master Driver.
                </p>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200/70 rounded-2xl text-[11px] text-blue-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Masukkan nomor WhatsApp di bawah. Sistem akan <strong>otomatis menyimpannya ke Master Driver</strong> dan langsung membuka WhatsApp untuk mengirim Kartu Tenko.
              </span>
            </div>

            <form onSubmit={handleConfirmSendWhatsAppModal} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nomor WhatsApp Driver
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm font-mono font-semibold"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Format nomor akan otomatis disesuaikan dengan kode negara Indonesia (+62).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPhoneModalOpen(false)}
                  disabled={savingPhone}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPhone}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-60"
                >
                  {savingPhone ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan & Buka WhatsApp</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
