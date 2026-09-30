import React, { useState, useEffect, useMemo } from 'react';
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
  deleteAttendanceLogsByDate,
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
  const { currentUser, isSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogItem[]>([]);
  const [examinations, setExaminations] = useState<TenkoExamination[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSite, setFilterSite] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'DONE'>('ALL');
  const [filterFlag, setFilterFlag] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteDateModalOpen, setIsDeleteDateModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Pagination
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [logsData, examsData, driversData, locsData] = await Promise.all([
        getAttendanceLogs(),
        getTenkoExaminations(),
        getDrivers(),
        getLocations(),
      ]);

      setAttendanceLogs(logsData);
      setExaminations(examsData);
      setDrivers(driversData);
      setLocations(locsData);

      // If no logs for today, but logs exist, auto-select the latest date in logs
      if (logsData.length > 0) {
        const uniqueDates = Array.from(new Set(logsData.map((l) => l.logDate))).filter(Boolean);
        uniqueDates.sort().reverse();
        if (!uniqueDates.includes(todayStr) && uniqueDates.length > 0) {
          setSelectedDate(uniqueDates[0]);
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal memuat data absensi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Compute available dates from attendance logs
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(attendanceLogs.map((l) => l.logDate))).filter(Boolean);
    if (!dates.includes(todayStr)) {
      dates.push(todayStr);
    }
    dates.sort().reverse();
    return dates;
  }, [attendanceLogs, todayStr]);

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

  const handleDeleteCurrentDateLogs = async () => {
    if (!selectedDate) return;
    setDeleting(true);
    try {
      const count = await deleteAttendanceLogsByDate(selectedDate, {
        email: currentUser?.email,
        fullName: currentUser?.fullName,
      });
      showToast(`Berhasil menghapus ${count} log absensi tanggal ${selectedDate}.`, 'success');
      setIsDeleteDateModalOpen(false);
      await loadAllData();
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
      `Halo Bapak ${item.driverName} (ID: ${item.userCode}), kami mencatat Anda telah hadir di ${item.siteName} pada ${item.logTime || item.inLogTime}. Harap segera merapat ke Pos Kesehatan / Ruang TENKO untuk melakukan pemeriksaan kesehatan pra-tugas. Terima kasih. - Nakes TENKO Logistik`
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
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl text-xs transition cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
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
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setCurrentPageNum(1);
                }}
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
              onClick={() => {
                setSelectedDate(d);
                setCurrentPageNum(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                selectedDate === d
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {d} {d === todayStr ? '(Hari Ini)' : ''}
            </button>
          ))}

          {/* Superadmin Delete Logs for Selected Date */}
          {isSuperAdmin && comparisonResult.totalLogs > 0 && (
            <button
              type="button"
              onClick={() => setIsDeleteDateModalOpen(true)}
              className="ml-auto flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-semibold px-2.5 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua Log Tanggal {selectedDate}</span>
            </button>
          )}
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

        {/* Table View */}
        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
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
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat data absensi ERP & pencocokan TENKO...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
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

                  return (
                    <tr
                      key={item.logDocumentId || `${item.userCode}_${item.fingerFlag}_${idx}`}
                      className={`hover:bg-slate-50/80 transition ${
                        isClockIn && !item.hasTenko ? 'bg-amber-50/20' : ''
                      }`}
                    >
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
        onSuccess={loadAllData}
      />

      {/* Delete Date Confirm Modal */}
      {isDeleteDateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Hapus Log Absensi Tanggal Ini?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Apakah Anda yakin ingin menghapus seluruh log absensi ERP pada tanggal{' '}
                <span className="font-bold text-slate-800">{selectedDate}</span>?
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteDateModalOpen(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteCurrentDateLogs}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Semua Log</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
