import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { Nakes, MasterStatus } from '../../types';
import {
  getNakesList,
  createNakes,
  updateNakes,
  deleteNakes,
} from '../../services/masterService';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Stethoscope,
  Phone,
  FileCheck,
  X,
  Loader2,
} from 'lucide-react';

export const MasterNakesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [nakesList, setNakesList] = useState<Nakes[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNakes, setEditingNakes] = useState<Nakes | null>(null);

  const [formNakesId, setFormNakesId] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formSipNumber, setFormSipNumber] = useState('');
  const [formPhoneNumber, setFormPhoneNumber] = useState('');
  const [formStatus, setFormStatus] = useState<MasterStatus>('ACTIVE');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [nakesToDelete, setNakesToDelete] = useState<Nakes | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getNakesList();
      setNakesList(data);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data nakes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredNakes = useMemo(() => {
    return nakesList.filter((n) => {
      const matchSearch =
        n.nakesId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.sipNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.phoneNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'ALL' || n.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [nakesList, searchQuery, filterStatus]);

  const openAddModal = () => {
    setEditingNakes(null);
    setFormNakesId('NKS-');
    setFormFullName('');
    setFormSipNumber('');
    setFormPhoneNumber('');
    setFormStatus('ACTIVE');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (n: Nakes) => {
    setEditingNakes(n);
    setFormNakesId(n.nakesId);
    setFormFullName(n.fullName);
    setFormSipNumber(n.sipNumber || '');
    setFormPhoneNumber(n.phoneNumber || '');
    setFormStatus(n.status);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const cleanId = formNakesId.trim().toUpperCase();
    const cleanName = formFullName.trim();

    if (!cleanId || !cleanName) {
      setFormError('Nakes ID dan Nama Lengkap wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const userPayload = {
        userId: currentUser?.userId || 'SYS_USER',
        fullName: currentUser?.fullName || 'User TENKO',
      };

      if (editingNakes) {
        await updateNakes(
          editingNakes.nakesDocumentId,
          {
            fullName: cleanName,
            sipNumber: formSipNumber.trim(),
            phoneNumber: formPhoneNumber.trim(),
            status: formStatus,
          },
          userPayload
        );
        showToast(`Data ${cleanName} berhasil diperbarui.`, 'success');
      } else {
        await createNakes(
          {
            nakesId: cleanId,
            fullName: cleanName,
            sipNumber: formSipNumber.trim(),
            phoneNumber: formPhoneNumber.trim(),
            status: formStatus,
          },
          userPayload
        );
        showToast(`Nakes ${cleanName} berhasil ditambahkan.`, 'success');
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
    if (!nakesToDelete) return;
    setDeleting(true);
    try {
      await deleteNakes(nakesToDelete.nakesDocumentId, nakesToDelete.nakesId, {
        userId: currentUser?.userId || 'SYS_USER',
        fullName: currentUser?.fullName || 'Super Admin',
      });
      showToast(`Data Nakes ${nakesToDelete.fullName} berhasil dihapus.`, 'success');
      setNakesToDelete(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus nakes.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div id="master-nakes-view" className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Master Tenaga Kesehatan (Nakes)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Kelola data petugas medis, nomor SIP, dan kontak pemeriksa</p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tambah Nakes</span>
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
              placeholder="Cari ID, Nama Nakes, No SIP..."
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
          <div className="py-12 text-center text-slate-400 text-xs">Memuat data nakes...</div>
        ) : filteredNakes.length === 0 ? (
          <div className="py-12 text-center">
            <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Tidak ada data nakes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pl-1">Nakes ID</th>
                  <th className="pb-3">Nama Lengkap</th>
                  <th className="pb-3">Nomor SIP</th>
                  <th className="pb-3">Nomor Telepon</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right pr-1">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNakes.map((n) => (
                  <tr key={n.nakesDocumentId} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 pl-1 font-mono font-bold text-blue-900">{n.nakesId}</td>
                    <td className="py-3.5 font-bold text-slate-900">{n.fullName}</td>
                    <td className="py-3.5 font-mono text-slate-600">{n.sipNumber || '-'}</td>
                    <td className="py-3.5 text-slate-600">{n.phoneNumber || '-'}</td>
                    <td className="py-3.5">
                      <StatusBadge type="master" value={n.status} size="sm" />
                    </td>
                    <td className="py-3.5 text-right pr-1">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(n)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setNakesToDelete(n)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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
                {editingNakes ? 'Edit Tenaga Kesehatan' : 'Tambah Nakes Baru'}
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
                <label className="block font-bold text-slate-700 mb-1">Nakes ID *</label>
                <input
                  type="text"
                  value={formNakesId}
                  onChange={(e) => setFormNakesId(e.target.value.toUpperCase())}
                  disabled={!!editingNakes}
                  placeholder="NKS-001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold uppercase disabled:bg-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap & Gelar *</label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="Ns. Ratna Sari, S.Kep"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor SIP (Surat Izin Praktik)</label>
                <input
                  type="text"
                  value={formSipNumber}
                  onChange={(e) => setFormSipNumber(e.target.value)}
                  placeholder="503/SIP.042/SDK/2024"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor WhatsApp / Telepon</label>
                <input
                  type="tel"
                  value={formPhoneNumber}
                  onChange={(e) => setFormPhoneNumber(e.target.value)}
                  placeholder="0812-3456-7890"
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
                  <span>{editingNakes ? 'Simpan' : 'Tambah'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {nakesToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Hapus Tenaga Kesehatan?</h3>
            <p className="text-xs text-slate-600">
              Yakin ingin menghapus data nakes <strong>{nakesToDelete.fullName}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNakesToDelete(null)}
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
