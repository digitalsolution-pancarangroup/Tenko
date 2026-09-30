import React, { useState } from 'react';
import { clearAllSystemData, ClearDataOptions, ClearDataResult } from '../../services/systemService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { Trash2, AlertTriangle, CheckCircle2, ShieldAlert, Loader2, X } from 'lucide-react';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: ClearDataResult) => void;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [options, setOptions] = useState<ClearDataOptions>({
    clearTenkoExaminations: true,
    clearAttendanceLogs: true,
    clearDriverHealthRecords: true,
    clearDriversMaster: true,
    clearStockMovements: true,
    clearAuditLogs: false,
  });

  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isConfirmed = confirmKeyword.trim().toUpperCase() === 'RESET';

  const handleClear = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    try {
      const result = await clearAllSystemData(options, currentUser ? { userId: currentUser.userId, fullName: currentUser.fullName } : undefined);
      showToast(`Berhasil membersihkan ${result.totalDeleted} record data sistem.`, 'success');
      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal membersihkan data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Clear System Data</h3>
              <p className="text-xs text-slate-500">Bersihkan data sample agar siap diinput oleh pengguna</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 my-5">
          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-3 text-amber-900 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Perhatian Pembersihan Data:</p>
              <p className="text-amber-800 mt-0.5">
                Data master esensial seperti <strong>166 Driver Groups</strong>, <strong>Master Lokasi/Pool</strong>, <strong>Indikasi Kesehatan</strong>, <strong>Katalog Vitamin</strong>, dan <strong>Akun Petugas Nakes/Admin</strong> tetap dipertahankan.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              Pilih Komponen Data yang Akan Dikosongkan:
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <span className="text-sm font-medium text-slate-800">Riwayat Pemeriksaan TENKO</span>
              <input
                type="checkbox"
                checked={options.clearTenkoExaminations}
                onChange={(e) => setOptions({ ...options, clearTenkoExaminations: e.target.checked })}
                className="w-4 h-4 rounded-md text-rose-600 focus:ring-rose-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <span className="text-sm font-medium text-slate-800">Data Master Driver & Kenek</span>
              <input
                type="checkbox"
                checked={options.clearDriversMaster}
                onChange={(e) => setOptions({ ...options, clearDriversMaster: e.target.checked })}
                className="w-4 h-4 rounded-md text-rose-600 focus:ring-rose-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <span className="text-sm font-medium text-slate-800">Log Presensi / Absensi ERP</span>
              <input
                type="checkbox"
                checked={options.clearAttendanceLogs}
                onChange={(e) => setOptions({ ...options, clearAttendanceLogs: e.target.checked })}
                className="w-4 h-4 rounded-md text-rose-600 focus:ring-rose-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <span className="text-sm font-medium text-slate-800">Riwayat Keluhan & Intervensi Kesehatan</span>
              <input
                type="checkbox"
                checked={options.clearDriverHealthRecords}
                onChange={(e) => setOptions({ ...options, clearDriverHealthRecords: e.target.checked })}
                className="w-4 h-4 rounded-md text-rose-600 focus:ring-rose-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <span className="text-sm font-medium text-slate-800">Log Mutasi Stok Farmasi</span>
              <input
                type="checkbox"
                checked={options.clearStockMovements}
                onChange={(e) => setOptions({ ...options, clearStockMovements: e.target.checked })}
                className="w-4 h-4 rounded-md text-rose-600 focus:ring-rose-500"
              />
            </label>
          </div>

          <div className="pt-2">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Ketik <span className="font-bold text-rose-600">RESET</span> untuk mengonfirmasi:
            </label>
            <input
              type="text"
              value={confirmKeyword}
              onChange={(e) => setConfirmKeyword(e.target.value)}
              placeholder="Ketik RESET"
              disabled={loading}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!isConfirmed || loading}
            className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Membersihkan...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Hapus & Kosongkan Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
