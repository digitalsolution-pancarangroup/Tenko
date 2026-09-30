import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { VitaminItem, MasterStatus } from '../../types';
import {
  getVitamins,
  createVitamin,
  updateVitamin,
  deleteVitamin,
} from '../../services/healthService';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Pill,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

export const MasterVitaminsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [vitamins, setVitamins] = useState<VitaminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VitaminItem | null>(null);

  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDosageUnit, setFormDosageUnit] = useState('Tablet');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<MasterStatus>('ACTIVE');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<VitaminItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getVitamins();
      setVitamins(data);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data master vitamin.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredVitamins = useMemo(() => {
    return vitamins.filter((item) => {
      const matchSearch =
        item.vitaminId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'ALL' || item.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [vitamins, searchQuery, filterStatus]);

  const openAddModal = () => {
    setEditingItem(null);
    const nextNum = vitamins.length + 1;
    setFormId(`VTM-${nextNum.toString().padStart(2, '0')}`);
    setFormName('');
    setFormCategory('Daya Tahan Tubuh');
    setFormDosageUnit('Tablet');
    setFormDescription('');
    setFormStatus('ACTIVE');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: VitaminItem) => {
    setEditingItem(item);
    setFormId(item.vitaminId);
    setFormName(item.name);
    setFormCategory(item.category || 'Umum');
    setFormDosageUnit(item.dosageUnit || 'Tablet');
    setFormDescription(item.description || '');
    setFormStatus(item.status);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const cleanName = formName.trim();

    if (!cleanName) {
      setFormError('Nama vitamin / suplemen wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        const docId = editingItem.vitaminDocumentId || editingItem.vitaminId;
        await updateVitamin(
          docId,
          {
            name: cleanName,
            category: formCategory.trim() || 'Umum',
            dosageUnit: formDosageUnit.trim() || 'Tablet',
            description: formDescription.trim(),
            status: formStatus,
          },
          { userId: currentUser?.userId || 'SYS', fullName: currentUser?.fullName || 'Nakes' }
        );
        showToast('Data vitamin berhasil diperbarui.', 'success');
      } else {
        await createVitamin(
          {
            vitaminId: formId.trim() || undefined,
            name: cleanName,
            category: formCategory.trim() || 'Umum',
            dosageUnit: formDosageUnit.trim() || 'Tablet',
            description: formDescription.trim(),
            status: formStatus,
          },
          { userId: currentUser?.userId || 'SYS', fullName: currentUser?.fullName || 'Nakes' }
        );
        showToast('Data vitamin baru berhasil ditambahkan.', 'success');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data vitamin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      const docId = itemToDelete.vitaminDocumentId || itemToDelete.vitaminId;
      await deleteVitamin(docId, {
        userId: currentUser?.userId || 'SYS',
        fullName: currentUser?.fullName || 'Nakes',
      });
      showToast(`Vitamin ${itemToDelete.name} berhasil dihapus.`, 'success');
      setItemToDelete(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus vitamin.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Master Data Vitamin
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            {vitamins.length} Jenis
          </span>
        </div>

        <button
          id="btn-add-vitamin"
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Vitamin</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-vitamin"
            type="text"
            placeholder="Cari vitamin (Vitamin C, Vitamin B, Paracetamol, dll)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Status:</label>
          <select
            id="filter-status-vitamin"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Table List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <p className="text-xs font-medium">Memuat data vitamin...</p>
          </div>
        ) : filteredVitamins.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
            <p className="text-sm font-bold text-slate-700">Tidak ada vitamin yang cocok</p>
            <p className="text-xs text-slate-400 mt-1">Gunakan tombol 'Tambah Vitamin' untuk menambahkan item baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 w-28">Kode ID</th>
                  <th className="py-3 px-4 w-56">Nama Vitamin / Obat</th>
                  <th className="py-3 px-4 w-40">Kategori</th>
                  <th className="py-3 px-4 w-28 text-center">Satuan Dosis</th>
                  <th className="py-3 px-6">Indikasi / Khasiat</th>
                  <th className="py-3 px-4 w-28 text-center">Status</th>
                  <th className="py-3 px-4 w-24 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVitamins.map((item, idx) => (
                  <tr key={item.vitaminId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-600">{item.vitaminId}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        {item.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-700">
                        {item.category || 'Umum'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-slate-700">
                      {item.dosageUnit}
                    </td>
                    <td className="py-3 px-6 text-slate-600 font-medium leading-relaxed">
                      {item.description || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Edit Vitamin"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Hapus Vitamin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Pill className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  {editingItem ? 'Edit Data Vitamin' : 'Tambah Vitamin Baru'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kode ID <span className="text-slate-400 font-normal">(Auto / Unik)</span>
                </label>
                <input
                  type="text"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value.toUpperCase())}
                  disabled={!!editingItem}
                  placeholder="VTM-01"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 disabled:opacity-60 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Vitamin / Suplemen / Obat <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Vitamin C 500mg, Paracetamol"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    placeholder="Daya Tahan Tubuh, Saraf, dll"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Satuan Dosis</label>
                  <select
                    value={formDosageUnit}
                    onChange={(e) => setFormDosageUnit(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Kaplet">Kaplet</option>
                    <option value="Kapsul">Kapsul</option>
                    <option value="Strip">Strip</option>
                    <option value="Sachet">Sachet</option>
                    <option value="Botol">Botol</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Khasiat / Deskripsi</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Menjaga daya tahan tubuh, meredakan nyeri ringan..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as MasterStatus)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
                >
                  <option value="ACTIVE">Aktif (Tersedia untuk diberikan)</option>
                  <option value="INACTIVE">Nonaktif</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingItem ? 'Simpan Perubahan' : 'Tambah Vitamin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-900">Hapus Data Vitamin?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Apakah Anda yakin ingin menghapus <strong className="text-slate-800">{itemToDelete.name}</strong> ({itemToDelete.vitaminId})?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
