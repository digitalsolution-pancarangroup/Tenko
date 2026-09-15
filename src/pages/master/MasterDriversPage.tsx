import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { Driver, DriverGroup, DriverPosition, MasterStatus } from '../../types';
import {
  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
} from '../../services/driverService';
import { getDriverGroups } from '../../services/masterService';
import { StatusBadge } from '../../components/common/StatusBadge';
import { QuickAddDriverGroupModal } from '../../components/common/QuickAddDriverGroupModal';
import { ImportDriverModal } from '../../components/master/ImportDriverModal';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Truck,
  Users,
  ShieldCheck,
  Loader2,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';

export const MasterDriversPage: React.FC = () => {
  const { currentUser, isSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverGroups, setDriverGroups] = useState<DriverGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPosition, setFilterPosition] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterGroup, setFilterGroup] = useState<string>('ALL');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  // Quick Add Group Modal & Import Modal
  const [isQuickAddGroupOpen, setIsQuickAddGroupOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Modal Form State
  const [formDriverId, setFormDriverId] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formPosition, setFormPosition] = useState<DriverPosition>('DRIVER');
  const [formDriverGroupId, setFormDriverGroupId] = useState('');
  const [formStatus, setFormStatus] = useState<MasterStatus>('ACTIVE');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    setLoading(true);
    try {
      const [allDrivers, allGroups] = await Promise.all([
        getDrivers(),
        getDriverGroups(),
      ]);
      setDrivers(allDrivers);
      setDriverGroups(allGroups);
      if (allGroups.length > 0 && !formDriverGroupId) {
        setFormDriverGroupId(allGroups[0].groupName || allGroups[0].groupId);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal memuat data driver.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupCreated = async (newGroup: DriverGroup) => {
    const groupDisplayName = newGroup.groupName || newGroup.groupId;
    await loadMasterData();
    setFormDriverGroupId(groupDisplayName);
    showToast(`Driver Group "${groupDisplayName}" berhasil dipilih.`, 'success');
  };

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const matchSearch =
        d.driverId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.driverGroupId.toLowerCase().includes(searchQuery.toLowerCase());

      const matchPos = filterPosition === 'ALL' || d.position === filterPosition;
      const matchStat = filterStatus === 'ALL' || d.status === filterStatus;
      const matchGrp = filterGroup === 'ALL' || d.driverGroupId === filterGroup;

      return matchSearch && matchPos && matchStat && matchGrp;
    });
  }, [drivers, searchQuery, filterPosition, filterStatus, filterGroup]);

  const openAddModal = () => {
    setEditingDriver(null);
    setFormDriverId('');
    setFormFullName('');
    setFormPosition('DRIVER');
    setFormDriverGroupId(driverGroups[0]?.groupName || driverGroups[0]?.groupId || 'TETAP');
    setFormStatus('ACTIVE');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    setFormDriverId(driver.driverId);
    setFormFullName(driver.fullName);
    setFormPosition(driver.position);
    setFormDriverGroupId(driver.driverGroupId);
    setFormStatus(driver.status);
    setFormError('');
    setIsModalOpen(true);
  };

  const handlePositionChange = (newPos: DriverPosition) => {
    setFormPosition(newPos);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const cleanId = formDriverId.trim().toUpperCase();
    const cleanName = formFullName.trim();

    if (!cleanId) {
      setFormError('Driver ID wajib diisi.');
      return;
    }
    if (!cleanName) {
      setFormError('Nama Lengkap wajib diisi.');
      return;
    }
    if (!formDriverGroupId) {
      setFormError('Driver Group wajib dipilih.');
      return;
    }

    setSubmitting(true);
    try {
      const userPayload = {
        userId: currentUser?.userId || 'SYS_USER',
        fullName: currentUser?.fullName || 'User TENKO',
      };

      if (editingDriver) {
        // Update
        await updateDriver(
          editingDriver.driverDocumentId,
          {
            fullName: cleanName,
            position: formPosition,
            driverGroupId: formDriverGroupId,
            status: formStatus,
          },
          userPayload
        );
        showToast(`Data ${cleanName} berhasil diperbarui.`, 'success');
      } else {
        // Create
        await createDriver(
          {
            driverId: cleanId,
            fullName: cleanName,
            position: formPosition,
            driverGroupId: formDriverGroupId,
            status: formStatus,
          },
          userPayload
        );
        showToast(`Driver/Kenek ${cleanName} berhasil ditambahkan.`, 'success');
      }

      setIsModalOpen(false);
      await loadMasterData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!driverToDelete) return;
    setDeleting(true);
    try {
      await deleteDriver(driverToDelete.driverDocumentId, driverToDelete.driverId, {
        userId: currentUser?.userId || 'SYS_USER',
        fullName: currentUser?.fullName || 'Super Admin',
      });
      showToast(`Driver ${driverToDelete.fullName} berhasil dihapus.`, 'success');
      setDriverToDelete(null);
      await loadMasterData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus driver.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div id="master-drivers-view" className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
            {drivers.length} Driver & Kenek
          </span>
          <span className="text-xs text-slate-400 font-medium">
            (Menampilkan {filteredDrivers.length} aktif / filter)
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          {/* Import Button */}
          <button
            id="btn-open-import-driver"
            onClick={() => setIsImportModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-xl transition shadow-xs cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Import Excel / CSV</span>
          </button>

          {/* Add Driver Button */}
          <button
            id="btn-add-driver-master"
            onClick={openAddModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>+ Tambah Driver/Kenek</span>
          </button>
        </div>
      </div>

      {/* Search & Multi-Filters Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              id="input-search-master-driver"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID, Nama, atau Group..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          {/* Filter Posisi */}
          <div>
            <select
              id="select-filter-position"
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              <option value="ALL">Semua Posisi</option>
              <option value="DRIVER">DRIVER (Pengemudi)</option>
              <option value="KENEK">KENEK (Helper)</option>
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <select
              id="select-filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">ACTIVE (Aktif)</option>
              <option value="INACTIVE">INACTIVE (Non-Aktif)</option>
            </select>
          </div>

          {/* Filter Group */}
          <div>
            <select
              id="select-filter-group"
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              <option value="ALL">Semua Driver Group</option>
              {driverGroups.map((g) => {
                const name = g.groupName || g.driverGroupName || g.groupId;
                return (
                  <option key={g.groupId || g.driverGroupId} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Driver Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Data Driver: {filteredDrivers.length} Personel
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Memuat data driver...</div>
        ) : filteredDrivers.length === 0 ? (
          <div className="py-12 text-center">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Tidak ada data driver yang sesuai.</p>
            <p className="text-xs text-slate-400 mt-0.5">Coba ubah kata kunci pencarian, gunakan Import Excel, atau tambah baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
            <table className="w-full min-w-[750px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 pl-4 min-w-[130px]">Driver ID</th>
                  <th className="py-3 px-3.5 min-w-[200px]">Nama Lengkap</th>
                  <th className="py-3 px-3.5 min-w-[110px]">Posisi</th>
                  <th className="py-3 px-3.5 min-w-[180px]">Driver Group</th>
                  <th className="py-3 px-3.5 min-w-[100px]">Status</th>
                  <th className="py-3 px-3.5 pr-4 min-w-[80px] text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredDrivers.map((drv) => (
                  <tr key={drv.driverDocumentId} className="hover:bg-blue-50/40 transition">
                    <td className="py-3.5 px-3.5 pl-4 font-mono font-bold text-blue-900 whitespace-nowrap">{drv.driverId}</td>
                    <td className="py-3.5 px-3.5 font-bold text-slate-900">{drv.fullName}</td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                        drv.position === 'DRIVER'
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {drv.position}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-700 font-medium">{drv.driverGroupId}</td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <StatusBadge type="master" value={drv.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-3.5 pr-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(drv)}
                          title="Edit Driver"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDriverToDelete(drv)}
                          title="Hapus Driver"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Truck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingDriver ? 'Edit Data Driver / Kenek' : 'Tambah Driver / Kenek Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              {/* Position selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Posisi Armada</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePositionChange('DRIVER')}
                    className={`py-2 px-3 rounded-xl font-bold border transition ${
                      formPosition === 'DRIVER'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    DRIVER (Pengemudi)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePositionChange('KENEK')}
                    className={`py-2 px-3 rounded-xl font-bold border transition ${
                      formPosition === 'KENEK'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    KENEK (Helper)
                  </button>
                </div>
              </div>

              {/* Driver ID */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Driver ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formDriverId}
                  onChange={(e) => setFormDriverId(e.target.value.toUpperCase())}
                  disabled={!!editingDriver}
                  placeholder="Contoh: 301240143 atau DRV-00125"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 disabled:bg-slate-100 text-slate-900"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">ID unik karyawan atau nomor induk armada.</p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="Contoh: Muhammad Santoso"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                />
              </div>

              {/* Driver Group with Quick Add Action Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">
                    Driver Group <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    id="btn-quick-add-group-in-driver-page"
                    onClick={() => setIsQuickAddGroupOpen(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Group Baru</span>
                  </button>
                </div>
                <select
                  value={formDriverGroupId}
                  onChange={(e) => setFormDriverGroupId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                >
                  <option value="" disabled>-- Pilih Driver Group --</option>
                  {driverGroups.map((grp) => {
                    const name = grp.groupName || grp.driverGroupName || grp.groupId;
                    return (
                      <option key={grp.groupId || grp.driverGroupId} value={name}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Keaktifan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus('ACTIVE')}
                    className={`py-2 px-3 rounded-xl font-bold border transition ${
                      formStatus === 'ACTIVE'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    ACTIVE
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('INACTIVE')}
                    className={`py-2 px-3 rounded-xl font-bold border transition ${
                      formStatus === 'INACTIVE'
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    INACTIVE
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{editingDriver ? 'Simpan Perubahan' : 'Tambah Driver'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD DRIVER GROUP MODAL */}
      <QuickAddDriverGroupModal
        isOpen={isQuickAddGroupOpen}
        onClose={() => setIsQuickAddGroupOpen(false)}
        onSuccess={handleGroupCreated}
      />

      {/* IMPORT EXCEL DRIVER MODAL */}
      <ImportDriverModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => loadMasterData()}
        existingDrivers={drivers}
        existingGroups={driverGroups}
      />

      {/* DELETE CONFIRMATION MODAL */}
      {driverToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Hapus Driver / Kenek?</h3>
                <p className="text-xs text-slate-500">Tindakan ini akan menghapus data master.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
              Apakah Anda yakin ingin menghapus <strong>{driverToDelete.fullName}</strong> ({driverToDelete.driverId})?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDriverToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
