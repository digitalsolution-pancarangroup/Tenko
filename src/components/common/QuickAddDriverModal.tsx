import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, Check, Loader2, Plus } from 'lucide-react';
import { Driver, DriverGroup, DriverPosition } from '../../types';
import { createDriver } from '../../services/driverService';
import { getDriverGroups } from '../../services/masterService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from './Toast';
import { QuickAddDriverGroupModal } from './QuickAddDriverGroupModal';

interface QuickAddDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDriver: Driver) => void;
  initialDriverId?: string;
  initialFullName?: string;
}

export const QuickAddDriverModal: React.FC<QuickAddDriverModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDriverId = '',
  initialFullName = '',
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [driverId, setDriverId] = useState(initialDriverId);
  const [fullName, setFullName] = useState(initialFullName);
  const [driverGroupId, setDriverGroupId] = useState('');
  const [position, setPosition] = useState<DriverPosition>('DRIVER');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [groups, setGroups] = useState<DriverGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isQuickGroupOpen, setIsQuickGroupOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDriverId(initialDriverId);
      setFullName(initialFullName);
      setErrorMsg('');
      loadGroups();
    }
  }, [isOpen, initialDriverId, initialFullName]);

  const loadGroups = async () => {
    try {
      const g = await getDriverGroups();
      setGroups(g.filter((item) => item.status === 'ACTIVE'));
      if (g.length > 0 && !driverGroupId) {
        setDriverGroupId(g[0].groupName || g[0].driverGroupName || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGroupCreated = (newGrp: DriverGroup) => {
    const name = newGrp.groupName || newGrp.groupId;
    setGroups((prev) => [newGrp, ...prev]);
    setDriverGroupId(name);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverId.trim()) {
      setErrorMsg('Driver ID wajib diisi.');
      return;
    }
    if (!fullName.trim()) {
      setErrorMsg('Nama Lengkap wajib diisi.');
      return;
    }
    if (!driverGroupId) {
      setErrorMsg('Driver Group wajib dipilih.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const created = await createDriver(
        {
          driverId: driverId.trim().toUpperCase(),
          fullName: fullName.trim(),
          driverGroupId,
          position,
          joinDate,
          status: 'ACTIVE',
        },
        {
          userId: currentUser?.userId || 'SYS',
          fullName: currentUser?.fullName || 'Nakes Pemeriksa',
        }
      );

      showToast('Driver/Kenek berhasil didaftarkan.', 'success');
      onSuccess(created);
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan saat mendaftarkan Driver/Kenek.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="quick-add-driver-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div
        id="quick-add-driver-modal-card"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base md:text-lg">Tambah Driver / Kenek Baru</h3>
              <p className="text-xs text-slate-500">Registrasi cepat langsung pada sesi pemeriksaan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1 text-xs uppercase tracking-wider">
                Driver ID <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-new-driver-id"
                type="text"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value.toUpperCase())}
                placeholder="Contoh: DRV-00130"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono text-sm font-semibold uppercase"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">Harus unik sesuai nomor induk armada.</p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1 text-xs uppercase tracking-wider">
                Posisi <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-select-driver-pos"
                  onClick={() => setPosition('DRIVER')}
                  className={`py-2.5 px-3 rounded-xl font-medium border text-xs flex items-center justify-center gap-1.5 transition ${
                    position === 'DRIVER'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {position === 'DRIVER' && <Check className="w-3.5 h-3.5" />}
                  DRIVER
                </button>
                <button
                  type="button"
                  id="btn-select-kenek-pos"
                  onClick={() => setPosition('KENEK')}
                  className={`py-2.5 px-3 rounded-xl font-medium border text-xs flex items-center justify-center gap-1.5 transition ${
                    position === 'KENEK'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {position === 'KENEK' && <Check className="w-3.5 h-3.5" />}
                  KENEK
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1 text-xs uppercase tracking-wider">
              Nama Lengkap <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-new-driver-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Contoh: Muhammad Santoso"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-medium text-slate-700 text-xs uppercase tracking-wider">
                  Driver Group <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  id="btn-quick-add-group-in-driver-modal"
                  onClick={() => setIsQuickGroupOpen(true)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 hover:underline cursor-pointer normal-case"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Tambah Group</span>
                </button>
              </div>
              <select
                id="select-new-driver-group"
                value={driverGroupId}
                onChange={(e) => setDriverGroupId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm bg-white"
                required
              >
                <option value="" disabled>-- Pilih Driver Group --</option>
                {groups.map((grp) => {
                  const name = grp.groupName || grp.driverGroupName || grp.groupId;
                  return (
                    <option key={grp.groupId || grp.driverGroupId} value={name}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1 text-xs uppercase tracking-wider">
                Tanggal Bergabung
              </label>
              <input
                id="input-new-driver-join-date"
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm bg-white"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              id="btn-cancel-new-driver"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-xs transition"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              id="btn-submit-new-driver"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Daftarkan & Pilih</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Quick Add Driver Group Nested Modal */}
      <QuickAddDriverGroupModal
        isOpen={isQuickGroupOpen}
        onClose={() => setIsQuickGroupOpen(false)}
        onSuccess={handleGroupCreated}
      />
    </div>
  );
};
