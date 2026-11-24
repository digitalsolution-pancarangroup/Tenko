import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  AttendanceLogItem,
  AttendanceComparisonItem,
  TenkoExamination,
  Driver,
  Location,
} from '../../types';
import {
  getAttendanceLogs,
  getRecentAttendanceDates,
  deleteSelectedAttendanceLogs,
  computeAttendanceTenkoComparison,
} from '../../services/attendanceService';
import { getTenkoExaminations } from '../../services/tenkoService';
import { getDrivers } from '../../services/driverService';
import { getLocations } from '../../services/masterService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { ImportAttendanceModal } from '../../components/attendance/ImportAttendanceModal';
import {
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Upload,
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  Send,
  Trash2,
  Check,
  AlertCircle,
  Layers,
  ArrowUpDown,
  Phone,
} from 'lucide-react';

interface AttendanceLogPageProps {
  onStartExaminationWithDriver?: (driverId: string) => void;
  onNavigate?: (page: any) => void;
}

export const AttendanceLogPage: React.FC<AttendanceLogPageProps> = ({
  onStartExaminationWithDriver,
  onNavigate,
}) => {
  const { currentUser, isSuperAdmin: authIsSuperAdmin } = useAuth();
  const canDeleteLogs = authIsSuperAdmin || currentUser?.role === 'SUPER_ADMIN';
  const { showToast } = useToast();

  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogItem[]>([]);
  const [examinations, setExaminations] = useState<TenkoExamination[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [recentDates, setRecentDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDateLogs, setLoadingDateLogs] = useState(false);

  // Filter States
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSite, setFilterSite] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'DONE'>('ALL');
  const [filterFlag, setFilterFlag] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Modals & Selection State (Super Admin only)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    loadAllData(false);
  }, []);

  const loadAllData = async (forceRefresh = true) => {
    setLoading(true);
    try {
      const [recentDateList, examsData, driversData, locsData] = await Promise.all([
        getRecentAttendanceDates(6, forceRefresh),
        getTenkoExaminations(undefined, forceRefresh),
        getDrivers(forceRefresh),
        getLocations(forceRefresh),
      ]);

      setRecentDates(recentDateList);
      setExaminations(examsData);
      setDrivers(driversData);
      setLocations(locsData);

      let targetDate = selectedDate || todayStr;
      if (!forceRefresh && recentDateList.length > 0 && !recentDateList.includes(todayStr)) {
        targetDate = recentDateList[0];
        setSelectedDate(targetDate);
      }

      const logsData = await getAttendanceLogs(targetDate, forceRefresh);
      setAttendanceLogs(logsData);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal memuat data absensi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    setCurrentPageNum(1);
    if (!newDate) return;
    setLoadingDateLogs(true);
    try {
      const logsData = await getAttendanceLogs(newDate, false);
      setAttendanceLogs(logsData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDateLogs(false);
    }
  };

  // Compute available dates from recent dates + currently selected date
  const availableDates = useMemo(() => {
    const dates = new Set<string>(recentDates);
    if (todayStr) dates.add(todayStr);
    if (selectedDate) dates.add(selectedDate);
    return Array.from(dates).filter(Boolean).sort().reverse();
  }, [recentDates, todayStr, selectedDate]);

  // Compute available sites
  const availableSites = useMemo(() => {
    const sites = Array.from(new Set(attendanceLogs.map((l) => l.siteName))).filter(Boolean);
    sites.sort();
    return sites;
  }, [attendanceLogs]);

  // Compute Comparison Stats & List
  const comparisonResult = useMemo(() => {
    return computeAttendanceTenkoComparison(
      attendanceLogs,
      examinations,
      drivers,
      selectedDate
    );
  }, [attendanceLogs, examinations, drivers, selectedDate]);

  // Filtered List
  const filteredList = useMemo(() => {
    let result = comparisonResult.comparisonList;

    // Filter by Finger Flag (Masuk vs Keluar)
    if (filterFlag === 'IN') {
      result = result.filter((item) => item.fingerFlag === 1);
    } else if (filterFlag === 'OUT') {
      result = result.filter((item) => item.fingerFlag === 0);
    }

    // Filter by Site
    if (filterSite !== 'ALL') {
      result = result.filter(
        (item) => item.siteName.toLowerCase() === filterSite.toLowerCase()
      );
    }

    // Filter by Status (Pending TENKO vs Done TENKO)
    if (filterStatus === 'PENDING') {
      result = result.filter((item) => !item.hasTenko && item.fingerFlag === 1);
    } else if (filterStatus === 'DONE') {
      result = result.filter((item) => item.hasTenko);
    }

    // Search Query (User Code, Driver Name, Site, Group)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.userCode.toLowerCase().includes(q) ||
          item.driverName.toLowerCase().includes(q) ||
          item.siteName.toLowerCase().includes(q) ||
          (item.driverGroup && item.driverGroup.toLowerCase().includes(q))
      );
    }

    return result;
  }, [comparisonResult, filterFlag, filterSite, filterStatus, searchQuery]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPageNum - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPageNum, itemsPerPage]);

  // Clamp currentPageNum when dataset shrinks after deletion or filter change
  useEffect(() => {
    if (currentPageNum > totalPages) {
      setCurrentPageNum(totalPages);
    }
  }, [currentPageNum, totalPages]);

  // Auto-reset selection whenever date or filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedDate, filterFlag, filterSite, filterStatus, searchQuery]);

  const getLogRowId = (item: AttendanceComparisonItem): string => item.logDocumentId || '';

  const filteredIds = useMemo(
    () => filteredList.map(getLogRowId).filter(Boolean),
    [filteredList]
  );

  const paginatedIds = useMemo(
    () => paginatedList.map(getLogRowId).filter(Boolean),
    [paginatedList]
  );

  const selectedCount = selectedIds.size;

  const isPageAllSelected = useMemo(
    () => paginatedIds.length > 0 && paginatedIds.every((id) => selectedIds.has(id)),
    [paginatedIds, selectedIds]
  );

  const isPagePartiallySelected = useMemo(
    () => paginatedIds.some((id) => selectedIds.has(id)) && !isPageAllSelected,
    [paginatedIds, selectedIds, isPageAllSelected]
  );

  const isAllFilteredSelected = useMemo(
    () => filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id)),
    [filteredIds, selectedIds]
  );

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPagePartiallySelected;
    }
  }, [isPagePartiallySelected]);

  const toggleSelectOne = (rowId: string) => {
    if (!rowId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const toggleSelectPage = () => {
    if (paginatedIds.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isPageAllSelected) {
        paginatedIds.forEach((id) => next.delete(id));
      } else {
        paginatedIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filteredIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteSelectedLogs = async () => {
    if (selectedIds.size === 0) {
      showToast('Pilih minimal 1 log absensi terlebih dahulu untuk dihapus.', 'error');
      setIsDeleteModalOpen(false);
      return;
    }

    setDeleting(true);
    try {
      const count = await deleteSelectedAttendanceLogs(Array.from(selectedIds), {
        userId: currentUser?.userId,
        email: currentUser?.email,
        fullName: currentUser?.fullName,
      });
      showToast(`Berhasil menghapus ${count} log absensi terpilih.`, 'success');
      setSelectedIds(new Set());
      setIsDeleteModalOpen(false);
      await loadAllData(true);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal menghapus log absensi.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredList.length === 0) {
      showToast('Tidak ada data untuk diekspor.', 'error');
      return;
    }

    const exportData = filteredList.map((item, idx) => ({
      'NO': idx + 1,
      'TANGGAL ABSEN': item.logDate,
      'USER CODE / NIK': item.userCode,
      'NAMA DRIVER': item.driverName,
      'TIPE ABSENSI': item.fingerFlag === 1 ? '1 - MASUK (IN)' : '0 - KELUAR (OUT)',
      'LOG TIME': item.logTime || item.inLogTime,
      'GROUP ARMADA': item.driverGroup || '-',
      'LOKASI / SITE': item.siteName,
      'STATUS TENKO': item.hasTenko
        ? 'SUDAH TENKO'
        : item.fingerFlag === 1
        ? 'BELUM TENKO'
        : 'TAP KELUAR',
      'HASIL REKOMENDASI': item.tenkoRecommendation || '-',
      'WAKTU PEMERIKSAAN TENKO': item.tenkoTime || '-',
      'NO WHATSAPP': item.phoneNumber || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Attendance_TENKO_${selectedDate}`);
    XLSX.writeFile(wb, `Rekap_Absensi_vs_TENKO_${selectedDate}.xlsx`);
    showToast('Rekap absensi & status TENKO berhasil diekspor.', 'success');
  };

  const handleSendReminderWA = (item: AttendanceComparisonItem) => {
    const rawPhone = item.phoneNumber ? item.phoneNumber.replace(/[^0-9]/g, '') : '';
    let phoneNum = rawPhone;
    if (phoneNum.startsWith('0')) {
      phoneNum = '62' + phoneNum.slice(1);
    }

    const message = encodeURIComponent(
      `Halo Bapak ${item.driverName} (ID: ${item.userCode}), kami mencatat Anda telah hadir di ${item.siteName} pada ${item.logTime || item.inLogTime}. Harap segera merapat ke Pos Kesehatan / Ruang TENKO untuk melakukan pemeriksaan kesehatan pra-tugas. Terima kasih. - PIC TENKO Logistik`
    );

    if (phoneNum) {
      window.open(`https://wa.me/${phoneNum}?text=${message}`, '_blank');
    } else {
      showToast(`Nomor HP Driver ${item.driverName} belum tercatat di Master Driver.`, 'error');
    }
  };

  return (
    <div id="attendance-log-page-container" className="space-y-6">
      {/* Top Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Attendance Log
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring data absensi masuk/keluar ERP & kepatuhan pemeriksaan kesehatan TENKO
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          <button
            type="button"
            onClick={() => loadAllData(true)}
            disabled={loading || loadingDateLogs}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl text-xs transition cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading || loadingDateLogs ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold rounded-2xl text-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Rekap (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Data Absensi ERP</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Log */}
        <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Log</p>
          <p className="text-xl font-black text-slate-900 mt-1">{comparisonResult.totalLogs}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Semua Record</p>
        </div>

        {/* 2. Tap Masuk (IN) */}
        <div className="p-4 bg-emerald-50/70 rounded-3xl border border-emerald-200 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Tap Masuk (IN)</p>
          <p className="text-xl font-black text-emerald-800 mt-1">{comparisonResult.totalDriversAttendedIn}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Driver Bertugas</p>
        </div>

        {/* 3. Tap Keluar (OUT) */}
        <div className="p-4 bg-slate-100 rounded-3xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Tap Keluar (OUT)</p>
          <p className="text-xl font-black text-slate-800 mt-1">{comparisonResult.totalDriversAttendedOut}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Selesai Dinas</p>
        </div>

        {/* 4. Sudah TENKO */}
        <div className="p-4 bg-blue-50/70 rounded-3xl border border-blue-200 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Sudah TENKO</p>
          <p className="text-xl font-black text-blue-800 mt-1">{comparisonResult.totalTenkoDone}</p>
          <p className="text-[11px] text-blue-600 mt-0.5">Clear Pra-Tugas</p>
        </div>

        {/* 5. Belum TENKO */}
        <div className="p-4 bg-amber-50/70 rounded-3xl border border-amber-200 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Belum TENKO</p>
          <p className="text-xl font-black text-amber-800 mt-1">{comparisonResult.totalPendingTenko}</p>
          <p className="text-[11px] text-amber-600 mt-0.5">Antrean Poskes</p>
        </div>

        {/* 6. Kepatuhan TENKO */}
        <div className="p-4 bg-indigo-50/70 rounded-3xl border border-indigo-200 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Kepatuhan</p>
          <p className="text-xl font-black text-indigo-800 mt-1">{comparisonResult.complianceRate}%</p>
          <p className="text-[11px] text-indigo-600 mt-0.5">Kepatuhan Masuk</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Date Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Tanggal Absensi
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 2. Tipe Absensi (IN / OUT Filter) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Tipe Absensi / Flag
            </label>
            <select
              value={filterFlag}
              onChange={(e) => {
                setFilterFlag(e.target.value as any);
                setCurrentPageNum(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">Semua Absensi (IN + OUT)</option>
              <option value="IN">🟢 Tap Masuk (IN) Saja</option>
              <option value="OUT">⚪ Tap Keluar (OUT) Saja</option>
            </select>
          </div>

          {/* 3. Site / Pool Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Lokasi / Site Name
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={filterSite}
                onChange={(e) => {
                  setFilterSite(e.target.value);
                  setCurrentPageNum(1);
                }}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
              >
                <option value="ALL">Semua Pool / Site ({availableSites.length})</option>
                {availableSites.map((site) => (
                  <option key={site} value={site}>
                    {site}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. TENKO Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Status TENKO
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as any);
                setCurrentPageNum(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="PENDING">⚠️ Belum TENKO ({comparisonResult.totalPendingTenko})</option>
              <option value="DONE">✅ Sudah TENKO ({comparisonResult.totalTenkoDone})</option>
            </select>
          </div>

          {/* 5. Search Query */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Cari Driver / User Code
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ketik NIK atau Nama..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPageNum(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Quick Date Quick-Select Pill Tags */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Tanggal Tersedia di Log:</span>
          {availableDates.slice(0, 6).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDateChange(d)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                selectedDate === d
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {d} {d === todayStr ? '(Hari Ini)' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-2">
            <span>Daftar Kehadiran Driver & Kepatuhan TENKO:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px]">
              {filteredList.length} Log Ditampilkan
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500">Tampilkan per halaman:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPageNum(1);
              }}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Selection Toolbar & Cross-Page Filter Select Banner (Super Admin Only) */}
        {canDeleteLogs && selectedCount > 0 && (
          <div className="mx-4 mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-blue-50/90 border border-blue-200 text-xs animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center gap-2 text-blue-950">
              <span className="font-extrabold px-2.5 py-0.5 rounded-lg bg-blue-600 text-white">
                {selectedCount} dipilih
              </span>
              {isPageAllSelected && filteredList.length > paginatedList.length && !isAllFilteredSelected && (
                <>
                  <span className="text-slate-600">
                    ({paginatedList.length} log di halaman ini dipilih)
                  </span>
                  <button
                    type="button"
                    id="btn-select-all-filtered-attendance"
                    onClick={handleSelectAllFiltered}
                    className="font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                  >
                    Pilih semua {filteredList.length} log hasil filter
                  </button>
                </>
              )}
              {isAllFilteredSelected && filteredList.length > paginatedList.length && (
                <span className="text-blue-800 font-semibold">
                  Semua {filteredList.length} log hasil filter telah dipilih.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Batal Pilih
              </button>
              <button
                type="button"
                id="btn-bulk-delete-attendance"
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Data ({selectedCount})</span>
              </button>
            </div>
          </div>
        )}

        {/* Table View */}
        <div className={`overflow-x-auto min-w-full ${canDeleteLogs && selectedCount > 0 ? 'mt-3' : ''}`}>
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                {canDeleteLogs && (
                  <th className="py-3 px-3 pl-4 w-10">
                    <input
                      ref={headerCheckboxRef}
                      id="checkbox-select-all-page-attendance"
                      type="checkbox"
                      checked={isPageAllSelected}
                      onChange={toggleSelectPage}
                      aria-label="Pilih semua log di halaman ini"
                      title="Pilih semua log di halaman ini"
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-center w-12">No</th>
                <th className="px-4 py-3">User Code (ID Driver)</th>
                <th className="px-4 py-3">Nama Driver / Kenek</th>
                <th className="px-4 py-3 text-center">Tipe Absensi</th>
                <th className="px-4 py-3">Group Armada</th>
                <th className="px-4 py-3">Log Time</th>
                <th className="px-4 py-3">Site / Pool</th>
                <th className="px-4 py-3 text-center">Status TENKO</th>
                <th className="px-4 py-3 text-center">Aksi / Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={canDeleteLogs ? 10 : 9} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat data absensi ERP & pencocokan TENKO...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={canDeleteLogs ? 10 : 9} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <FileSpreadsheet className="w-10 h-10 text-slate-300" />
                      <p className="font-bold text-slate-700 text-sm">
                        Tidak ada data absensi untuk tanggal {selectedDate}
                      </p>
                      <p className="text-xs text-slate-400">
                        Klik tombol <strong>"Import Data Absensi ERP"</strong> di atas untuk mengunggah file absensi Excel harian.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, idx) => {
                  const absoluteIdx = (currentPageNum - 1) * itemsPerPage + idx + 1;
                  const isClockIn = item.fingerFlag === 1;
                  const rowId = getLogRowId(item);
                  const isSelected = Boolean(rowId) && selectedIds.has(rowId);

                  return (
                    <tr
                      key={rowId || `${item.userCode}_${item.fingerFlag}_${idx}`}
                      className={`transition ${
                        isSelected
                          ? 'bg-blue-50/70 hover:bg-blue-50'
                          : isClockIn && !item.hasTenko
                          ? 'bg-amber-50/20 hover:bg-slate-50/80'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {canDeleteLogs && (
                        <td className="py-3.5 px-3 pl-4 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!rowId}
                            onChange={() => toggleSelectOne(rowId)}
                            aria-label={`Pilih log absensi ${item.userCode} - ${item.driverName}`}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                          />
                        </td>
                      )}
                      {/* No */}
                      <td className="px-4 py-3.5 text-center text-slate-400 font-medium">
                        {absoluteIdx}
                      </td>

                      {/* User Code / ID */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200/60">
                          {item.userCode}
                        </span>
                      </td>

                      {/* Driver Name */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{item.driverName}</div>
                        {item.phoneNumber && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{item.phoneNumber}</span>
                          </div>
                        )}
                      </td>

                      {/* Tipe Absensi (Flag IN / OUT) */}
                      <td className="px-4 py-3.5 text-center">
                        {isClockIn ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            <span>1 (MASUK)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>0 (KELUAR)</span>
                          </span>
                        )}
                      </td>

                      {/* Driver Group */}
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.driverGroup || 'REGULER'}
                        </span>
                      </td>

                      {/* Log Time */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-mono text-slate-800 text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold">{item.logTime || item.inLogTime}</span>
                        </div>
                      </td>

                      {/* Site Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={item.siteName}>
                            {item.siteName}
                          </span>
                        </div>
                      </td>

                      {/* Status TENKO */}
                      <td className="px-4 py-3.5 text-center">
                        {item.hasTenko ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>SUDAH TENKO</span>
                            </span>
                            {item.tenkoRecommendation && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                item.tenkoRecommendation === 'FIT TO WORK'
                                  ? 'text-emerald-600'
                                  : item.tenkoRecommendation === 'FIT TO WORK WITH NOTE'
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }`}>
                                {item.tenkoRecommendation}
                              </span>
                            )}
                          </div>
                        ) : isClockIn ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-xs animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>BELUM TENKO</span>
                            </span>
                            <span className="text-[10px] font-bold text-amber-700">
                              Wajib Pra-Tugas
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              TAP KELUAR
                            </span>
                            <span className="text-[10px] text-slate-400">Selesai Tugas</span>
                          </div>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isClockIn && !item.hasTenko ? (
                            <>
                              {onStartExaminationWithDriver ? (
                                <button
                                  type="button"
                                  onClick={() => onStartExaminationWithDriver(item.userCode)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-sm transition cursor-pointer"
                                  title="Lakukan Pemeriksaan TENKO Sekarang"
                                >
                                  <ClipboardPlus className="w-3.5 h-3.5" />
                                  <span>Periksa</span>
                                </button>
                              ) : null}

                              {/* WhatsApp Reminder Button */}
                              <button
                                type="button"
                                onClick={() => handleSendReminderWA(item)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold text-[11px] transition cursor-pointer"
                                title="Kirim Pengingat WhatsApp"
                              >
                                <Send className="w-3 h-3 text-emerald-600" />
                                <span>WA</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400 italic">
                              {item.hasTenko ? 'Selesai' : 'Log Keluar'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredList.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Menampilkan{' '}
              <span className="font-bold text-slate-900">
                {(currentPageNum - 1) * itemsPerPage + 1} -{' '}
                {Math.min(currentPageNum * itemsPerPage, filteredList.length)}
              </span>{' '}
              dari <span className="font-bold text-slate-900">{filteredList.length}</span> Log
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPageNum((p) => Math.max(1, p - 1))}
                disabled={currentPageNum === 1}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-bold text-slate-800">
                Halaman {currentPageNum} dari {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPageNum((p) => Math.min(totalPages, p + 1))}
                disabled={currentPageNum === totalPages}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      <ImportAttendanceModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => loadAllData(true)}
      />

      {/* Delete Selected Attendance Logs Confirmation Modal */}
      {isDeleteModalOpen && selectedCount > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Hapus {selectedCount} Log Absensi?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tindakan ini akan{' '}
                  <strong>
                    menghapus permanen {selectedCount === filteredList.length && selectedCount > 1 ? `seluruh ${selectedCount}` : selectedCount} log absensi yang dipilih
                  </strong>{' '}
                  (tanggal <span className="font-bold text-slate-700">{selectedDate}</span>) dari database Firestore.
                </p>
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl mt-3 border border-amber-200 text-left">
                  ⚠️ <strong>Catatan:</strong> Log absensi yang dihapus tidak dapat dipulihkan. Data <strong>TENKO</strong> dan <strong>Master Driver</strong> tidak akan terhapus.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deleting}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  id="btn-confirm-delete-selected-attendance"
                  onClick={handleDeleteSelectedLogs}
                  disabled={deleting}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {deleting ? (
                    <span>Menghapus...</span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Ya, Hapus ({selectedCount} Data)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
