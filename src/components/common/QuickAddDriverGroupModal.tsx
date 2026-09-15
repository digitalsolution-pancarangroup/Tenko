import React, { useState } from 'react';
import { X, Users, Check, AlertCircle, Loader2 } from 'lucide-react';
import { DriverGroup } from '../../types';
import { createDriverGroup } from '../../services/masterService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from './Toast';

interface QuickAddDriverGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newGroup: DriverGroup) => void;
  initialGroupName?: string;
}

export const QuickAddDriverGroupModal: React.FC<QuickAddDriverGroupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialGroupName = '',
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [groupName, setGroupName] = useState(initialGroupName);
  const [groupId, setGroupId] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setGroupName(initialGroupName);
      if (initialGroupName) {
        // Auto-generate code from name if available
        const autoCode = 'GRP-' + initialGroupName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
        setGroupId(autoCode);
      } else {
        setGroupId('');
      }
      setDescription('');
      setErrorMsg('');
    }
  }, [isOpen, initialGroupName]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setGroupName(val);
    if (!groupId || groupId.startsWith('GRP-')) {
      const code = 'GRP-' + val.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
      setGroupId(code);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = groupName.trim().toUpperCase();
    const cleanId = (groupId.trim() || 'GRP-' + cleanName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8)).toUpperCase();

    if (!cleanName) {
      setErrorMsg('Nama Driver Group wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const created = await createDriverGroup(
        {
          groupId: cleanId,
          groupName: cleanName,
          description: description.trim(),
          status: 'ACTIVE',
        },
        {
          userId: currentUser?.userId || 'SYS_USER',
          fullName: currentUser?.fullName || 'User TENKO',
        }
      );

      showToast(`Driver Group "${cleanName}" berhasil ditambahkan.`, 'success');
      onSuccess(created);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menambahkan Driver Group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="quick-add-driver-group-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm md:text-base">Tambah Driver Group Baru</h3>
              <p className="text-xs text-slate-500">Registrasi group / unit armada langsung</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[11px]">
              Nama Driver Group <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-quick-group-name"
              type="text"
              value={groupName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Contoh: ABPN1-Helper Reguler Balikpapan"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              required
              autoFocus
            />
            <p className="text-[10px] text-slate-400 mt-1">Nama grup operasional pengemudi/kenek.</p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[11px]">
              Kode Group ID (Singkatan)
            </label>
            <input
              id="input-quick-group-id"
              type="text"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value.toUpperCase())}
              placeholder="Contoh: GRP-ABPN1"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 uppercase"
            />
            <p className="text-[10px] text-slate-400 mt-1">Kode unik identifikasi grup (otomatis dibuat jika kosong).</p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[11px]">
              Keterangan / Rute (Opsional)
            </label>
            <input
              id="input-quick-group-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Armada distribusi Balikpapan area"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              id="btn-submit-quick-group"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan & Pilih Group</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
