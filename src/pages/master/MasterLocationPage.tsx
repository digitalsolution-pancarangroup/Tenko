import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { Location, MasterStatus } from '../../types';
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../../services/masterService';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Building2,
  MapPin,
  X,
  Loader2,
} from 'lucide-react';

export const MasterLocationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);

  const [formLocId, setFormLocId] = useState('');
  const [formLocName, setFormLocName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formStatus, setFormStatus] = useState<MasterStatus>('ACTIVE');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [locToDelete, setLocToDelete] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getLocations();
      setLocations(data);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat lokasi pool.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = useMemo(() => {
    return locations.filter((l) => {
      const matchSearch =
        l.locationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.address || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'ALL' || l.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [locations, searchQuery, filterStatus]);

  const openAddModal = () => {
    setEditingLoc(null);
    setFormLocId('LOC-');
    setFormLocName('');
    setFormAddress('');
    setFormStatus('ACTIVE');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (loc: Location) => {
    setEditingLoc(loc);
    setFormLocId(loc.locationId);
    setFormLocName(loc.locationName);
    setFormAddress(loc.address || '');
    setFormStatus(loc.status);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const cleanId = formLocId.trim().toUpperCase();
    const cleanName = formLocName.trim();

    if (!cleanId || !cleanName) {
      setFormError('Location ID dan Nama Lokasi wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const userPayload = {
        userId: currentUser?.userId || 'SYS_USER',
        fullName: currentUser?.fullName || 'User TENKO',
      };

      if (editingLoc) {
        await updateLocation(
          editingLoc.locationDocumentId,
          {
            locationName: cleanName,
            address: formAddress.trim(),
            status: formStatus,
          },
          userPayload
        );
        showToast(`Lokasi ${cleanName} berhasil diperbarui.`, 'success');
      } else {
        await createLocation(
          {
            locationId: cleanId,
            locationName: cleanName,
            address: formAddress.trim(),
            status: formStatus,
          },
          userPayload
        );
        showToast(`Lokasi ${cleanName} berhasil ditambahkan.`, 'success');
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!locToDelete) return;
    setDeleting(true);
    try {
      await deleteLocation(locToDelete.locationDocumentId, locToDelete.locationId, {
        userId: currentUser?.userId || 'SYS_USER',
        fullName: currentUser?.fullName || 'Super Admin',
      });
      showToast(`Lokasi ${locToDelete.locationName} berhasil dihapus.`, 'success');
      setLocToDelete(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus lokasi.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div id="master-location-view" className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
            {locations.length} Lokasi Pool
          </span>
          <span className="text-xs text-slate-400 font-medium">
            (Menampilkan {filteredLocations.length} aktif / filter)
          </span>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tambah Lokasi Pool</span>
        </button>
      </div>

      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID, Nama Pool, Alamat..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Memuat lokasi pool...</div>
        ) : filteredLocations.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Tidak ada data lokasi pool.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
            <table className="w-full min-w-[650px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 pl-4 min-w-[140px]">Location ID</th>
                  <th className="py-3 px-3.5 min-w-[200px]">Nama Pool / Hub</th>
                  <th className="py-3 px-3.5 min-w-[200px]">Alamat</th>
                  <th className="py-3 px-3.5 min-w-[100px]">Status</th>
                  <th className="py-3 px-3.5 pr-4 min-w-[80px] text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredLocations.map((loc) => (
                  <tr key={loc.locationDocumentId} className="hover:bg-blue-50/40 transition">
                    <td className="py-3.5 px-3.5 pl-4 font-mono font-bold text-blue-900 whitespace-nowrap">{loc.locationId}</td>
                    <td className="py-3.5 px-3.5 font-bold text-slate-900">{loc.locationName}</td>
                    <td className="py-3.5 px-3.5 text-slate-600 max-w-xs truncate" title={loc.address}>{loc.address || '-'}</td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <StatusBadge type="master" value={loc.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-3.5 pr-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(loc)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setLocToDelete(loc)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Hapus"
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

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingLoc ? 'Edit Lokasi Pool' : 'Tambah Lokasi Pool Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Location ID *</label>
                <input
                  type="text"
                  value={formLocId}
                  onChange={(e) => setFormLocId(e.target.value.toUpperCase())}
                  disabled={!!editingLoc}
                  placeholder="LOC-MRD"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold uppercase disabled:bg-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lokasi Pool *</label>
                <input
                  type="text"
                  value={formLocName}
                  onChange={(e) => setFormLocName(e.target.value)}
                  placeholder="Pool Marunda - Jakarta Utara"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Jl. Raya Marunda No. 88..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as MasterStatus)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingLoc ? 'Simpan' : 'Tambah'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {locToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Hapus Lokasi Pool?</h3>
            <p className="text-xs text-slate-600">
              Yakin ingin menghapus <strong>{locToDelete.locationName}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLocToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
