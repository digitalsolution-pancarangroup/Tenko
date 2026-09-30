import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { DriverGroup, MasterStatus } from '../../types';
import {
  getDriverGroups,
  createDriverGroup,
  updateDriverGroup,
  deleteDriverGroup,
} from '../../services/masterService';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Layers,
} from 'lucide-react';

export const MasterDriverGroupsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [groups, setGroups] = useState<DriverGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DriverGroup | null>(null);

  // Form State
  const [formGroupId, setFormGroupId] = useState('');
  const [formGroupName, setFormGroupName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<MasterStatus>('ACTIVE');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [groupToDelete, setGroupToDelete] = useState<DriverGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await getDriverGroups();
      setGroups(data);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal memuat driver group.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchSearch =
        g.groupId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.groupName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.description || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = filterStatus === 'ALL' || g.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [groups, searchQuery, filterStatus]);

  const totalPages = Math.ceil(filteredGroups.length / pageSize) || 1;
  const paginatedGroups = useMemo(() => {
    if (pageSize === -1) return filteredGroups;
    const start = (currentPage - 1) * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, currentPage, pageSize]);

  const openAddModal = () => {
    setEditingGroup(null);
    setFormGroupId('GRP-');
    setFormGroupName('');
    setFormDescription('');
    setFormStatus('ACTIVE');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (group: DriverGroup) => {
    setEditingGroup(group);
    setFormGroupId(group.groupId);
    setFormGroupName(group.groupName);
    setFormDescription(group.description || '');
    setFormStatus(group.status);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanId = formGroupId.trim().toUpperCase();
    const cleanName = formGroupName.trim().toUpperCase();

    if (!cleanId) {
      setFormError('Group ID wajib diisi.');
      return;
    }
    if (!cleanName) {
      setFormError('Group Name wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const userPayload = {
        userId: currentUser?.userId || 'SYS_USER',
        fullName: currentUser?.fullName || 'User TENKO',
      };

      if (editingGroup) {
        await updateDriverGroup(
          editingGroup.groupDocumentId,
          {
            groupName: cleanName,
            description: formDescription.trim(),
            status: formStatus,
          },
          userPayload
        );
        showToast(`Driver Group ${cleanName} berhasil diperbarui.`, 'success');
      } else {
        await createDriverGroup(
          {
            groupId: cleanId,
            groupName: cleanName,
            description: formDescription.trim(),
            status: formStatus,
          },
          userPayload
        );
        showToast(`Driver Group ${cleanName} berhasil ditambahkan.`, 'success');
      }

      setIsModalOpen(false);
      await loadGroups();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!groupToDelete) return;
    setDeleting(true);
    try {
      await deleteDriverGroup(groupToDelete.groupDocumentId, groupToDelete.groupId, {
        userId: currentUser?.userId || 'SYS_USER',
        fullName: currentUser?.fullName || 'Super Admin',
      });
      showToast(`Driver Group ${groupToDelete.groupName} berhasil dihapus.`, 'success');
      setGroupToDelete(null);
      await loadGroups();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus group.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div id="master-driver-groups-view" className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Master Driver Groups
          </h1>
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold whitespace-nowrap">
            {groups.length} Group
          </span>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tambah Driver Group</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID, Nama Group, Deskripsi..."
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

      {/* Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Total Data Group:
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-black">
              {filteredGroups.length} Group
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Tampilkan per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded-lg border border-slate-300 font-bold text-slate-700 bg-white"
            >
              <option value={25}>25 data</option>
              <option value={50}>50 data</option>
              <option value={100}>100 data</option>
              <option value={-1}>Semua ({filteredGroups.length})</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Memuat driver groups...</div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-12 text-center">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Tidak ada data driver group.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
            <table className="w-full min-w-[700px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 pl-4 min-w-[50px] w-12">No</th>
                  <th className="py-3 px-3.5 min-w-[140px]">Group ID</th>
                  <th className="py-3 px-3.5 min-w-[180px]">Nama Group</th>
                  <th className="py-3 px-3.5 min-w-[200px]">Deskripsi</th>
                  <th className="py-3 px-3.5 min-w-[100px]">Status</th>
                  <th className="py-3 px-3.5 pr-4 min-w-[80px] text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedGroups.map((grp, index) => {
                  const itemIndex = pageSize === -1 ? index + 1 : (currentPage - 1) * pageSize + index + 1;
                  return (
                    <tr key={grp.groupDocumentId} className="hover:bg-blue-50/40 transition">
                      <td className="py-3.5 px-3.5 pl-4 font-mono text-slate-400 font-semibold">{itemIndex}</td>
                      <td className="py-3.5 px-3.5 font-mono font-bold text-blue-900 whitespace-nowrap">{grp.groupId}</td>
                      <td className="py-3.5 px-3.5 font-bold text-slate-900">{grp.groupName}</td>
                      <td className="py-3.5 px-3.5 text-slate-600 max-w-xs truncate" title={grp.description}>{grp.description || '-'}</td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <StatusBadge type="master" value={grp.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-3.5 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(grp)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setGroupToDelete(grp)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Navigation */}
        {!loading && filteredGroups.length > 0 && pageSize !== -1 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Menampilkan <strong>{(currentPage - 1) * pageSize + 1}</strong> -{' '}
              <strong>{Math.min(currentPage * pageSize, filteredGroups.length)}</strong> dari{' '}
              <strong>{filteredGroups.length}</strong> grup
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &larr; Sebelumnya
              </button>
              <span className="px-3 py-1.5 font-bold text-slate-700">
                Halaman {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Selanjutnya &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingGroup ? 'Edit Driver Group' : 'Tambah Driver Group Baru'}
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
                <label className="block font-bold text-slate-700 mb-1">Group ID *</label>
                <input
                  type="text"
                  value={formGroupId}
                  onChange={(e) => setFormGroupId(e.target.value.toUpperCase())}
                  disabled={!!editingGroup}
                  placeholder="GRP-TETAP"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold uppercase disabled:bg-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Group Name *</label>
                <input
                  type="text"
                  value={formGroupName}
                  onChange={(e) => setFormGroupName(e.target.value.toUpperCase())}
                  placeholder="TETAP"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold uppercase"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Keterangan kategori pengemudi..."
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
                  <span>{editingGroup ? 'Simpan' : 'Tambah'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Hapus Driver Group?</h3>
            <p className="text-xs text-slate-600">
              Yakin ingin menghapus group <strong>{groupToDelete.groupName}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
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
