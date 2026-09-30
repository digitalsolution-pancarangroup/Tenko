import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { User, UserRole, AccountStatus, Location } from '../../types';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../../services/userService';
import { getLocations } from '../../services/masterService';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  UserCog,
  Plus,
  Search,
  Edit2,
  Trash2,
  KeyRound,
  ShieldCheck,
  Stethoscope,
  Shield,
  Building2,
  Phone,
  Mail,
  X,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  UserCheck,
  Users,
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [usersList, setUsersList] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('NAKES');
  const [formPassword, setFormPassword] = useState('Pancaran@2026');
  const [formLocationId, setFormLocationId] = useState('');
  const [formPhoneNumber, setFormPhoneNumber] = useState('');
  const [formSipNumber, setFormSipNumber] = useState('');
  const [formStatus, setFormStatus] = useState<AccountStatus>('ACTIVE');

  // Reset Password Modal
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('Pancaran@2026');
  const [resettingPassword, setResettingPassword] = useState(false);

  // Delete Modal
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, locList] = await Promise.all([getUsers(), getLocations()]);
      setUsersList(uList);
      setLocations(locList);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data pengguna.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Metrics Count
  const stats = useMemo(() => {
    const total = usersList.length;
    const adminCount = usersList.filter((u) => u.role === 'SUPER_ADMIN').length;
    const nakesCount = usersList.filter((u) => u.role === 'NAKES').length;
    const securityCount = usersList.filter((u) => u.role === 'SECURITY').length;
    const activeCount = usersList.filter((u) => u.status === 'ACTIVE').length;
    return { total, adminCount, nakesCount, securityCount, activeCount };
  }, [usersList]);

  // Filtered List
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchSearch =
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.locationName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.sipNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.phoneNumber || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [usersList, searchQuery, roleFilter, statusFilter]);

  const openAddModal = () => {
    setEditingUser(null);
    setFormFullName('');
    setFormEmail('');
    setFormRole('NAKES');
    setFormPassword('Pancaran@2026');
    setFormLocationId(locations[0]?.locationId || '');
    setFormPhoneNumber('');
    setFormSipNumber('');
    setFormStatus('ACTIVE');
    setFormError('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setFormFullName(u.fullName);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormPassword('');
    setFormLocationId(u.locationId || '');
    setFormPhoneNumber(u.phoneNumber || '');
    setFormSipNumber(u.sipNumber || '');
    setFormStatus(u.status);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formFullName.trim() || !formEmail.trim()) {
      setFormError('Nama Lengkap dan Email/Username wajib diisi.');
      return;
    }

    const selectedLoc = locations.find((l) => l.locationId === formLocationId);
    const locName = selectedLoc ? selectedLoc.locationName : '';

    setSubmitting(true);
    try {
      const currentActor = {
        userId: currentUser?.userId || 'SYS_ADMIN',
        fullName: currentUser?.fullName || 'Super Admin',
      };

      if (editingUser) {
        await updateUser(
          editingUser.userId,
          {
            fullName: formFullName.trim(),
            email: formEmail.trim().toLowerCase(),
            role: formRole,
            phoneNumber: formPhoneNumber.trim(),
            sipNumber: formRole === 'NAKES' ? formSipNumber.trim() : '',
            locationId: formLocationId,
            locationName: locName,
            status: formStatus,
          },
          currentActor
        );
        showToast(`Data pengguna ${formFullName} berhasil diperbarui.`, 'success');
      } else {
        await createUser(
          {
            fullName: formFullName.trim(),
            email: formEmail.trim().toLowerCase(),
            role: formRole,
            phoneNumber: formPhoneNumber.trim(),
            sipNumber: formRole === 'NAKES' ? formSipNumber.trim() : '',
            locationId: formLocationId,
            locationName: locName,
            tempPassword: formPassword.trim() || 'Pancaran@2026',
            status: formStatus,
          },
          currentActor
        );
        showToast(`Pengguna baru ${formFullName} berhasil didaftarkan.`, 'success');
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data pengguna.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetModalUser || !newPasswordValue.trim()) return;
    setResettingPassword(true);
    try {
      await updateUser(
        resetModalUser.userId,
        { tempPassword: newPasswordValue.trim() },
        {
          userId: currentUser?.userId || 'SYS_ADMIN',
          fullName: currentUser?.fullName || 'Super Admin',
        }
      );
      showToast(`Password untuk ${resetModalUser.fullName} berhasil diubah ke: ${newPasswordValue}`, 'success');
      setResetModalUser(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah kata sandi.', 'error');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleToggleStatus = async (u: User) => {
    const newStatus: AccountStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateUser(
        u.userId,
        { status: newStatus },
        {
          userId: currentUser?.userId || 'SYS_ADMIN',
          fullName: currentUser?.fullName || 'Super Admin',
        }
      );
      showToast(`Status ${u.fullName} diubah menjadi ${newStatus}.`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await deleteUser(userToDelete.userId, {
        userId: currentUser?.userId || 'SYS_ADMIN',
        fullName: currentUser?.fullName || 'Super Admin',
      });
      showToast(`Akun ${userToDelete.fullName} berhasil dihapus.`, 'success');
      setUserToDelete(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus user.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Super Admin</span>
          </span>
        );
      case 'NAKES':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
            <span>Tenaga Kesehatan</span>
          </span>
        );
      case 'SECURITY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Security / Gate</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div id="user-management-view" className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Manajemen Pengguna
          </h1>
          <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold whitespace-nowrap">
            {usersList.length} Akun
          </span>
        </div>

        <button
          id="btn-add-user"
          onClick={openAddModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tambah User Baru</span>
        </button>
      </div>

      {/* Role Filter Tabs & Search Controls */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        {/* Role Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <button
            onClick={() => setRoleFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              roleFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Role ({stats.total})
          </button>
          <button
            onClick={() => setRoleFilter('SUPER_ADMIN')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              roleFilter === 'SUPER_ADMIN'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Super Admin ({stats.adminCount})</span>
          </button>
          <button
            onClick={() => setRoleFilter('NAKES')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              roleFilter === 'NAKES'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Tenaga Kesehatan ({stats.nakesCount})</span>
          </button>
          <button
            onClick={() => setRoleFilter('SECURITY')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              roleFilter === 'SECURITY'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Security ({stats.securityCount})</span>
          </button>
        </div>

        {/* Search & Status Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama pengguna, email/username, lokasi pool, nomor telepon..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              <option value="ALL">Semua Status Akun</option>
              <option value="ACTIVE">ACTIVE (Aktif)</option>
              <option value="INACTIVE">INACTIVE (Nonaktif)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Memuat data pengguna...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <UserCog className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Tidak ada pengguna yang sesuai kriteria.</p>
            <p className="text-xs text-slate-400 mt-1">Coba sesuaikan pencarian atau filter role.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
            <table className="w-full min-w-[850px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 pl-4 min-w-[220px]">Pengguna</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Role / Akses</th>
                  <th className="py-3 px-3.5 min-w-[200px]">Penugasan Lokasi Pool</th>
                  <th className="py-3 px-3.5 min-w-[170px]">Kontak & Keterangan</th>
                  <th className="py-3 px-3.5 min-w-[100px]">Status</th>
                  <th className="py-3 px-3.5 pr-4 min-w-[110px] text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredUsers.map((u) => (
                  <tr key={u.userId} className="hover:bg-blue-50/40 transition">
                    <td className="py-3.5 px-3.5 pl-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            u.role === 'SUPER_ADMIN'
                              ? 'bg-purple-100 text-purple-700'
                              : u.role === 'NAKES'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.fullName}</p>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">{u.email}</p>
                          {u.tempPassword && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono mt-1" title="Kata sandi yang didaftarkan">
                              <KeyRound className="w-2.5 h-2.5 text-amber-500" />
                              <span>Pass: {u.tempPassword}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">{renderRoleBadge(u.role)}</td>
                    <td className="py-3.5 px-3.5">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{u.locationName || 'Semua Pool (Pusat)'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 space-y-0.5">
                      {u.phoneNumber && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{u.phoneNumber}</span>
                        </div>
                      )}
                      {u.sipNumber && (
                        <p className="text-[11px] font-mono text-blue-700">SIP: {u.sipNumber}</p>
                      )}
                      {!u.phoneNumber && !u.sipNumber && <span className="text-slate-400">-</span>}
                    </td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        title={`Klik untuk ubah menjadi ${u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}`}
                        className="cursor-pointer"
                      >
                        <StatusBadge type="master" value={u.status} size="sm" />
                      </button>
                    </td>
                    <td className="py-3.5 px-3.5 pr-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setResetModalUser(u);
                            setNewPasswordValue('Pancaran@2026');
                          }}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          title="Reset Password Default"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Edit Pengguna"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setUserToDelete(u)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Hapus Pengguna"
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

      {/* CREATE / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingUser ? 'Edit Data Pengguna' : 'Pendaftaran User Baru (Opsi A)'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingUser
                      ? 'Perbarui data profil & hak akses akun'
                      : 'Daftarkan email, role, lokasi, dan setel password awal'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Full Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Lengkap & Gelar *</label>
                  <input
                    type="text"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="Contoh: Ns. Ratna Sari, S.Kep"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email / Username Login *</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="nama@pancaran-logistic.id"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Hak Akses / Role *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormRole('SUPER_ADMIN')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      formRole === 'SUPER_ADMIN'
                        ? 'bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5 text-purple-600" />
                    <span className="font-bold text-[11px]">Super Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRole('NAKES')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      formRole === 'NAKES'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Stethoscope className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-[11px]">Nakes Medis</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRole('SECURITY')}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      formRole === 'SECURITY'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Shield className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-[11px]">Security / Posko</span>
                  </button>
                </div>
              </div>

              {/* Initial Password field (for new user) */}
              {!editingUser && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Password Awal Login (Opsi A) *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Pancaran@2026"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Super Admin memberikan password awal ini kepada user agar bisa langsung login.
                  </p>
                </div>
              )}

              {/* Location Assignment & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Penugasan Lokasi Pool</label>
                  <select
                    value={formLocationId}
                    onChange={(e) => setFormLocationId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  >
                    <option value="">Semua Lokasi / Pool Pusat</option>
                    {locations.map((loc) => (
                      <option key={loc.locationId} value={loc.locationId}>
                        {loc.locationName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor WhatsApp / Telepon</label>
                  <input
                    type="tel"
                    value={formPhoneNumber}
                    onChange={(e) => setFormPhoneNumber(e.target.value)}
                    placeholder="0812-3456-7890"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Conditional SIP Number if Role is NAKES */}
              {formRole === 'NAKES' && (
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                  <label className="block font-bold text-blue-900 mb-1">
                    Nomor SIP (Surat Izin Praktik Nakes)
                  </label>
                  <input
                    type="text"
                    value={formSipNumber}
                    onChange={(e) => setFormSipNumber(e.target.value)}
                    placeholder="Contoh: 503/SIP.042/SDK/2024"
                    className="w-full px-3.5 py-2 rounded-lg border border-blue-300 bg-white font-mono text-xs focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                  <p className="text-[10px] text-blue-600 mt-1">
                    Nomor SIP dicantumkan pada Surat Keterangan Laik Jalan hasil pemeriksaan.
                  </p>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Akun</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as AccountStatus)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  <option value="ACTIVE">ACTIVE (Dapat Login & Beroperasi)</option>
                  <option value="INACTIVE">INACTIVE (Akses Login Dinonaktifkan)</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingUser ? 'Simpan Perubahan' : 'Daftarkan Pengguna'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reset Password Pengguna</h3>
                <p className="text-xs text-slate-500">
                  Untuk: <strong>{resetModalUser.fullName}</strong> ({resetModalUser.email})
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Setel Password Baru</label>
              <input
                type="text"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                placeholder="Pancaran@2026"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-xs"
              />
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                Setelah direset, informasikan password baru ini kepada karyawan untuk login.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                disabled={resettingPassword}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resettingPassword}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {resettingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Simpan Password Baru</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Hapus Pengguna?</h3>
            <p className="text-xs text-slate-600">
              Yakin ingin menghapus akun pengguna <strong>{userToDelete.fullName}</strong> ({userToDelete.email})?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
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
