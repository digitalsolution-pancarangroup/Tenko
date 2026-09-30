import React, { useState, useEffect, useMemo } from 'react';
import {
  TenkoExamination,
  Driver,
  Nakes,
  DriverGroup,
  Location,
  AttendanceLogItem,
  ExaminationRecommendation,
} from '../../types';
import { getTenkoExaminations } from '../../services/tenkoService';
import { getDrivers } from '../../services/driverService';
import { getNakesList, getDriverGroups, getLocations } from '../../services/masterService';
import { getAttendanceLogs } from '../../services/attendanceService';
import { useAuth } from '../../context/AuthContext';
import { NavigationPage } from '../layout/Sidebar';
import * as XLSX from 'xlsx';
import {
  Search,
  Download,
  Calendar,
  Clock,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  HeartPulse,
  Thermometer,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  MessageCircle,
  Eye,
  SlidersHorizontal,
  FileSpreadsheet,
  AlertCircle,
  UserCheck,
  UserX,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ExecutiveDashboardViewProps {
  onNavigate: (page: NavigationPage) => void;
  onSelectExamination?: (exam: TenkoExamination, printImmediate?: boolean) => void;
  onStartExaminationWithDriver?: (driverId: string) => void;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  onNavigate,
  onSelectExamination,
  onStartExaminationWithDriver,
}) => {
  const { currentUser } = useAuth();

  // Master & Transaction Data States
  const [examinations, setExaminations] = useState<TenkoExamination[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [nakesList, setNakesList] = useState<Nakes[]>([]);
  const [driverGroups, setDriverGroups] = useState<DriverGroup[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters for Chart 1 (Monthly Result)
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Filters for Chart 2 (Daily Attendance vs Tenko)
  const [dailyRangeOption, setDailyRangeOption] = useState<'7' | '14' | '30'>('14');

  // Filters for Table 3 (Result Data Tenko)
  const [tableResultSearch, setTableResultSearch] = useState('');
  const [tableResultFilterRec, setTableResultFilterRec] = useState<string>('ALL');
  const [tableResultFilterDate, setTableResultFilterDate] = useState<'ALL' | 'TODAY' | 'MONTH'>('TODAY');
  const [tableResultPage, setTableResultPage] = useState(1);
  const tableResultPerPage = 7;

  // Filters for Table 4 (Attendance Log Driver/Kenek Belum Absen)
  const [tableAbsenSearch, setTableAbsenSearch] = useState('');
  const [tableAbsenTab, setTableAbsenTab] = useState<'BELUM_ABSEN' | 'SUDAH_ABSEN_BELUM_TENKO'>('BELUM_ABSEN');
  const [tableAbsenPage, setTableAbsenPage] = useState(1);
  const tableAbsenPerPage = 7;

  // Current Date Strings
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const formattedToday = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const currentHubLocation = useMemo(() => {
    return currentUser?.locationName || currentUser?.locationId || 'Hub Pancaran Logistic';
  }, [currentUser]);

  useEffect(() => {
    loadAllDashboardData();
  }, []);

  const loadAllDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [allExams, allDrivers, allNakes, allGroups, allLocs, allLogs] = await Promise.all([
        getTenkoExaminations(),
        getDrivers(),
        getNakesList(),
        getDriverGroups(),
        getLocations(),
        getAttendanceLogs(),
      ]);

      setExaminations(allExams);
      setDrivers(allDrivers);
      setNakesList(allNakes);
      setDriverGroups(allGroups);
      setLocations(allLocs);
      setAttendanceLogs(allLogs);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // =========================================================================
  // 1. DATA PERHITUNGAN CHART 1: BARCHART RESULT PER BULAN
  // =========================================================================
  const monthlyChartData = useMemo(() => {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
    ];

    // Filter examinations by selected year
    const examsInYear = examinations.filter((exam) => {
      const dateStr = exam.examinationDate || '';
      return dateStr.startsWith(String(selectedYear));
    });

    return monthNames.map((name, index) => {
      const monthStr = String(index + 1).padStart(2, '0');
      const targetPrefix = `${selectedYear}-${monthStr}`;

      let fitCount = 0;
      let fitWithNoteCount = 0;
      let unfitCount = 0;

      for (const exam of examsInYear) {
        if ((exam.examinationDate || '').startsWith(targetPrefix)) {
          const rec = (exam.recommendation || '').toUpperCase();
          if (rec.includes('WITH NOTE')) {
            fitWithNoteCount++;
          } else if (rec.includes('UNFIT')) {
            unfitCount++;
          } else if (rec.includes('FIT')) {
            fitCount++;
          }
        }
      }

      return {
        month: name,
        'Fit to Work': fitCount,
        'Fit with Note': fitWithNoteCount,
        'Unfit to Work': unfitCount,
        total: fitCount + fitWithNoteCount + unfitCount,
      };
    });
  }, [examinations, selectedYear]);

  // =========================================================================
  // 2. DATA PERHITUNGAN CHART 2: BARCHART DAILY (ATTENDANCE VS RESULT TENKO)
  // =========================================================================
  const dailyChartData = useMemo(() => {
    const daysCount = parseInt(dailyRangeOption, 10) || 14;
    const resultList: Array<{
      date: string;
      label: string;
      'Absensi Driver': number;
      'Hasil Tenko': number;
      'Belum Tenko': number;
    }> = [];

    const now = new Date();

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const shortLabel = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
      }).format(d);

      // Attendance on this date (distinct drivers clocked IN, fingerFlag === 1)
      const dayLogs = attendanceLogs.filter(
        (log) => log.logDate === dateStr && Number(log.fingerFlag) === 1
      );
      const uniqueAttendedDrivers = new Set(
        dayLogs.map((log) => String(log.userCode || '').trim().toUpperCase())
      );
      const attendanceCount = uniqueAttendedDrivers.size;

      // Tenko exams on this date
      const dayExams = examinations.filter((exam) => exam.examinationDate === dateStr);
      const uniqueTenkoDrivers = new Set(
        dayExams.map((exam) => String(exam.driverId || '').trim().toUpperCase())
      );
      const tenkoCount = uniqueTenkoDrivers.size;

      const pendingCount = Math.max(0, attendanceCount - tenkoCount);

      resultList.push({
        date: dateStr,
        label: shortLabel,
        'Absensi Driver': attendanceCount,
        'Hasil Tenko': tenkoCount,
        'Belum Tenko': pendingCount,
      });
    }

    return resultList;
  }, [attendanceLogs, examinations, dailyRangeOption]);

  // =========================================================================
  // 3. DATA PERHITUNGAN TABEL 3: DATABASE RESULT DATA TENKO
  // =========================================================================
  const filteredResultTenko = useMemo(() => {
    const searchLower = tableResultSearch.trim().toLowerCase();
    const currentMonthPrefix = todayStr.slice(0, 7);

    return examinations.filter((exam) => {
      // Date filter
      if (tableResultFilterDate === 'TODAY' && exam.examinationDate !== todayStr) {
        return false;
      }
      if (tableResultFilterDate === 'MONTH' && !(exam.examinationDate || '').startsWith(currentMonthPrefix)) {
        return false;
      }

      // Recommendation filter
      if (tableResultFilterRec !== 'ALL') {
        const rec = (exam.recommendation || '').toUpperCase();
        if (tableResultFilterRec === 'FIT' && (rec !== 'FIT TO WORK' && !rec.startsWith('FIT TO WORK'))) return false;
        if (tableResultFilterRec === 'NOTE' && !rec.includes('WITH NOTE')) return false;
        if (tableResultFilterRec === 'UNFIT' && !rec.includes('UNFIT')) return false;
      }

      // Search keyword
      if (searchLower) {
        const matchId = (exam.tenkoId || '').toLowerCase().includes(searchLower);
        const matchDriverId = (exam.driverId || '').toLowerCase().includes(searchLower);
        const matchDriverName = (exam.driverNameSnapshot || '').toLowerCase().includes(searchLower);
        const matchGroup = (exam.driverGroupSnapshot || '').toLowerCase().includes(searchLower);
        const matchExaminer = (exam.examinerName || '').toLowerCase().includes(searchLower);
        if (!matchId && !matchDriverId && !matchDriverName && !matchGroup && !matchExaminer) {
          return false;
        }
      }

      return true;
    });
  }, [examinations, tableResultSearch, tableResultFilterRec, tableResultFilterDate, todayStr]);

  const paginatedResultTenko = useMemo(() => {
    const startIdx = (tableResultPage - 1) * tableResultPerPage;
    return filteredResultTenko.slice(startIdx, startIdx + tableResultPerPage);
  }, [filteredResultTenko, tableResultPage]);

  const totalResultTenkoPages = Math.max(1, Math.ceil(filteredResultTenko.length / tableResultPerPage));

  // =========================================================================
  // 4. DATA PERHITUNGAN TABEL 4: ATTENDANCE LOG DRIVER / KENEK BELUM ABSEN
  // =========================================================================
  const { driversBelumAbsenHariIni, driversSudahAbsenBelumTenko } = useMemo(() => {
    // 1. Get all clock-in logs for today
    const todayLogs = attendanceLogs.filter(
      (log) => log.logDate === todayStr && Number(log.fingerFlag) === 1
    );

    // Map of driver ID to log
    const attendedDriverMap = new Map<string, AttendanceLogItem>();
    todayLogs.forEach((log) => {
      const code = String(log.userCode || '').trim().toUpperCase();
      if (code) attendedDriverMap.set(code, log);
    });

    // 2. Get all tenko examinations for today
    const todayExams = examinations.filter((exam) => exam.examinationDate === todayStr);
    const tenkoDriverSet = new Set(
      todayExams.map((exam) => String(exam.driverId || '').trim().toUpperCase())
    );

    // 3. Active drivers from master data
    const activeDrivers = drivers.filter(
      (d) => (d.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    );

    // List 1: Belum Absen Hari Ini (Driver / Kenek registered who have NO attendance in today)
    const belumAbsenList: Array<{
      driver: Driver;
      statusText: string;
    }> = [];

    activeDrivers.forEach((drv) => {
      const cleanId = String(drv.driverId || '').trim().toUpperCase();
      if (!attendedDriverMap.has(cleanId)) {
        belumAbsenList.push({
          driver: drv,
          statusText: 'Belum Clock In',
        });
      }
    });

    // List 2: Sudah Absen tapi Belum TENKO (Clocked in, but no TENKO record today)
    const sudahAbsenBelumTenkoList: Array<{
      driver?: Driver;
      userCode: string;
      driverName: string;
      logTime: string;
      siteName: string;
      phoneNumber?: string;
      position: string;
      driverGroup?: string;
    }> = [];

    attendedDriverMap.forEach((log, code) => {
      if (!tenkoDriverSet.has(code)) {
        // Find in master driver
        const master = activeDrivers.find(
          (d) => String(d.driverId || '').trim().toUpperCase() === code
        );

        let cleanName = log.driverName;
        if (cleanName.includes('-')) {
          const parts = cleanName.split('-');
          if (parts.length >= 2) cleanName = parts.slice(1).join('-').trim();
        }

        sudahAbsenBelumTenkoList.push({
          driver: master,
          userCode: code,
          driverName: master?.fullName || cleanName || log.driverName,
          logTime: log.logTime || '-',
          siteName: log.siteName || '-',
          phoneNumber: master?.phoneNumber,
          position: master?.position || 'DRIVER',
          driverGroup: master?.driverGroupId || '-',
        });
      }
    });

    return {
      driversBelumAbsenHariIni: belumAbsenList,
      driversSudahAbsenBelumTenko: sudahAbsenBelumTenkoList,
    };
  }, [attendanceLogs, examinations, drivers, todayStr]);

  // Filtered & Paginated Table 4 Data
  const filteredTableAbsen = useMemo(() => {
    const searchLower = tableAbsenSearch.trim().toLowerCase();

    if (tableAbsenTab === 'BELUM_ABSEN') {
      return driversBelumAbsenHariIni.filter(({ driver }) => {
        if (!searchLower) return true;
        const matchId = (driver.driverId || '').toLowerCase().includes(searchLower);
        const matchName = (driver.fullName || '').toLowerCase().includes(searchLower);
        const matchGroup = (driver.driverGroupId || '').toLowerCase().includes(searchLower);
        const matchPos = (driver.position || '').toLowerCase().includes(searchLower);
        return matchId || matchName || matchGroup || matchPos;
      });
    } else {
      return driversSudahAbsenBelumTenko.filter((item) => {
        if (!searchLower) return true;
        const matchId = item.userCode.toLowerCase().includes(searchLower);
        const matchName = item.driverName.toLowerCase().includes(searchLower);
        const matchGroup = (item.driverGroup || '').toLowerCase().includes(searchLower);
        const matchPos = item.position.toLowerCase().includes(searchLower);
        return matchId || matchName || matchGroup || matchPos;
      });
    }
  }, [driversBelumAbsenHariIni, driversSudahAbsenBelumTenko, tableAbsenTab, tableAbsenSearch]);

  const paginatedTableAbsen = useMemo(() => {
    const startIdx = (tableAbsenPage - 1) * tableAbsenPerPage;
    return filteredTableAbsen.slice(startIdx, startIdx + tableAbsenPerPage);
  }, [filteredTableAbsen, tableAbsenPage]);

  const totalTableAbsenPages = Math.max(1, Math.ceil(filteredTableAbsen.length / tableAbsenPerPage));

  // Quick stats for top KPI cards
  const statsToday = useMemo(() => {
    const todayExams = examinations.filter((e) => e.examinationDate === todayStr);
    const todayLogs = attendanceLogs.filter(
      (l) => l.logDate === todayStr && Number(l.fingerFlag) === 1
    );

    const attendedDriverIds = new Set(
      todayLogs.map((l) => String(l.userCode || '').trim().toUpperCase())
    );

    const totalAttended = attendedDriverIds.size;
    const totalTenko = todayExams.length;
    const totalBelumAbsen = driversBelumAbsenHariIni.length;
    const totalBelumTenko = driversSudahAbsenBelumTenko.length;

    const complianceRate =
      totalAttended > 0 ? Math.round((totalTenko / totalAttended) * 100) : 0;

    return {
      totalDrivers: drivers.length,
      totalAttended,
      totalTenko,
      totalBelumAbsen,
      totalBelumTenko,
      complianceRate,
    };
  }, [examinations, attendanceLogs, drivers, todayStr, driversBelumAbsenHariIni, driversSudahAbsenBelumTenko]);

  // Send WhatsApp Reminder
  const handleSendWhatsAppReminder = (phone?: string, name?: string, reason?: string) => {
    if (!phone) return;
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    }
    const message = encodeURIComponent(
      `Halo Sdr. ${name || 'Rekan Driver'},\n\nAnda terdata ${
        reason || 'belum melakukan absensi masuk / pemeriksaan kesehatan TENKO'
      } pada hari ini (${formattedToday}).\n\nMohon segera melapor ke Pos / Klinik TENKO Hub Operasional sebelum bertugas.\n\nTerima kasih atas kerja samanya.\n*Pancaran Logistics - Keselamatan Kerja Bersama*`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  // Export Dashboard Data to Excel
  const handleExportAllToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Hasil Tenko
    const examsExport = examinations.map((e, idx) => ({
      No: idx + 1,
      'ID TENKO': e.tenkoId,
      Tanggal: e.examinationDate,
      'Waktu Selesai': e.finishTime || e.createdAt,
      'NIK Driver': e.driverId,
      'Nama Driver': e.driverNameSnapshot,
      Posisi: e.positionSnapshot,
      'Grup Driver': e.driverGroupSnapshot || '-',
      Rekomendasi: e.recommendation,
      'Tensi Darah': e.bloodPressureResult || `${e.bloodPressureSystolic}/${e.bloodPressureDiastolic}`,
      'Detak Jantung': e.heartRate ? `${e.heartRate} bpm` : '-',
      Suhu: e.temperature ? `${e.temperature} °C` : '-',
      Alkohol: e.alcoholTest || '-',
      'Status Gerbang': e.securityGateStatus || (e.isUsed ? 'PASSED' : 'PENDING'),
      'Petugas Nakes': e.examinerName,
    }));
    const ws1 = XLSX.utils.json_to_sheet(examsExport);
    XLSX.utils.book_append_sheet(wb, ws1, 'Hasil_TENKO');

    // Sheet 2: Belum Absen
    const belumAbsenExport = driversBelumAbsenHariIni.map((item, idx) => ({
      No: idx + 1,
      'NIK Driver': item.driver.driverId,
      'Nama Lengkap': item.driver.fullName,
      Posisi: item.driver.position,
      Grup: item.driver.driverGroupId || '-',
      Telepon: item.driver.phoneNumber || '-',
      'Status Hari Ini': 'Belum Absen Masuk',
    }));
    const ws2 = XLSX.utils.json_to_sheet(belumAbsenExport);
    XLSX.utils.book_append_sheet(wb, ws2, 'Belum_Absen_Hari_Ini');

    XLSX.writeFile(wb, `Laporan_Dashboard_TENKO_${todayStr}.xlsx`);
  };

  return (
    <div id="dashboard-operasional-tenko" className="space-y-5 pb-10">
      {/* ================= HEADER SECTION ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              Dashboard Operasional TENKO
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {formattedToday} &middot; {currentHubLocation} &middot; Monitoring Terintegrasi Absensi &amp; Pemeriksaan
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="btn-dashboard-refresh"
            onClick={() => loadAllDashboardData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>{isRefreshing ? 'Sinkronisasi...' : 'Refresh Data'}</span>
          </button>

          <button
            type="button"
            id="btn-dashboard-unduh-excel"
            onClick={handleExportAllToExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unduh Laporan</span>
          </button>

          <button
            type="button"
            id="btn-dashboard-pemeriksaan-baru"
            onClick={() => onNavigate('new_examination')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B5FA5] hover:bg-[#094d87] text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm"
          >
            <ClipboardPlus className="w-3.5 h-3.5" />
            <span>Pemeriksaan Baru</span>
          </button>
        </div>
      </div>

      {/* ================= TOP 5 KPI SUMMARY CARDS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Driver Master */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Driver &amp; Kenek</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-bold text-2xl text-slate-900 mt-2">
            {statsToday.totalDrivers}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Master Driver Aktif</span>
        </div>

        {/* Card 2: Absensi Masuk Hari Ini */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Absensi Masuk Hari Ini</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-bold text-2xl text-emerald-700 mt-2">
            {statsToday.totalAttended}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Clock-in Pos / ERP</span>
        </div>

        {/* Card 3: Sudah TENKO Hari Ini */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pemeriksaan TENKO</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-bold text-2xl text-indigo-700 mt-2">
            {statsToday.totalTenko}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Selesai Diperiksa Nakes</span>
        </div>

        {/* Card 4: Belum Absen Hari Ini */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Belum Absen Hari Ini</span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <UserX className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-bold text-2xl text-rose-600 mt-2">
            {statsToday.totalBelumAbsen}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Driver Belum Clock-in</span>
        </div>

        {/* Card 5: Tingkat Kepatuhan (Compliance) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Kepatuhan TENKO</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-bold text-2xl text-slate-900 mt-2 flex items-baseline gap-1">
            <span>{statsToday.complianceRate}%</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {statsToday.totalBelumTenko} Driver Menunggu Tenko
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DUAL BARCHART ROW: 1. RESULT PER BULAN (LEFT) | 2. DAILY ATTENDANCE VS TENKO (RIGHT) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ================= CHART 1: BARCHART RESULT PER BULAN ================= */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h2 className="text-sm font-bold text-slate-900">
                  1. Hasil Pemeriksaan TENKO per Bulan
                </h2>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-0.5">
                Distribusi Fit to Work, Fit with Note, dan Unfit to Work
              </p>
            </div>

            {/* Filter Year */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <label htmlFor="select-chart-year" className="text-xs text-slate-500 font-medium">
                Tahun:
              </label>
              <select
                id="select-chart-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                aria-label="Pilih tahun untuk grafik hasil TENKO per bulan"
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Chart Container */}
          <div className="mt-4 w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderRadius: '10px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  }}
                  itemStyle={{ padding: '2px 0' }}
                  labelStyle={{ fontWeight: 'bold', color: '#93C5FD', marginBottom: '4px' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11.5px', paddingTop: '8px' }}
                  iconType="circle"
                />
                <Bar
                  dataKey="Fit to Work"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  name="Fit to Work"
                />
                <Bar
                  dataKey="Fit with Note"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                  name="Fit with Note"
                />
                <Bar
                  dataKey="Unfit to Work"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                  name="Unfit to Work"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Badges footer */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>Total Pemeriksaan {selectedYear}: <strong>{monthlyChartData.reduce((acc, curr) => acc + curr.total, 0)}</strong> sesi</span>
            <button
              type="button"
              onClick={() => onNavigate('assessment_report')}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Lihat Detail Laporan &rarr;
            </button>
          </div>
        </div>

        {/* ================= CHART 2: BARCHART DAILY (ATTENDANCE VS RESULT TENKO) ================= */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h2 className="text-sm font-bold text-slate-900">
                  2. Tren Harian: Absensi vs Hasil TENKO
                </h2>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-0.5">
                Perbandingan jumlah driver absen masuk dengan yang telah selesai diperiksa
              </p>
            </div>

            {/* Range Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg self-start sm:self-auto">
              {(['7', '14', '30'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDailyRangeOption(r)}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer ${
                    dailyRangeOption === r
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r} Hari
                </button>
              ))}
            </div>
          </div>

          {/* Chart Container */}
          <div className="mt-4 w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailyChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderRadius: '10px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  }}
                  labelStyle={{ fontWeight: 'bold', color: '#93C5FD', marginBottom: '4px' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11.5px', paddingTop: '8px' }}
                  iconType="circle"
                />
                <Bar
                  dataKey="Absensi Driver"
                  fill="#0B5FA5"
                  radius={[4, 4, 0, 0]}
                  name="Absensi Driver (Clock In)"
                />
                <Bar
                  dataKey="Hasil Tenko"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  name="Hasil Tenko (Selesai)"
                />
                <Bar
                  dataKey="Belum Tenko"
                  fill="#F97316"
                  radius={[4, 4, 0, 0]}
                  name="Belum Diperiksa (Gap)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Badges footer */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              Hari ini: <strong>{statsToday.totalAttended}</strong> Absen Masuk &middot; <strong>{statsToday.totalTenko}</strong> Selesai TENKO
            </span>
            <button
              type="button"
              onClick={() => onNavigate('attendance_log')}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Lihat Log Absensi &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DUAL TABLE ROW: 3. RESULT DATA TENKO (LEFT) | 4. DRIVER BELUM ABSEN (RIGHT) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ================= TABLE 3: DATABASE RESULT DATA TENKO ================= */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
          {/* Card Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h2 className="text-sm font-bold text-slate-900">
                    3. Tabel Database Hasil Pemeriksaan TENKO
                  </h2>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  Daftar hasil pemeriksaan kesehatan dan tanda vital pengemudi
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('data_tenko')}
                className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer self-start sm:self-auto shrink-0"
              >
                Buka Data TENKO &rarr;
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari ID TENKO, NIK, nama driver..."
                  value={tableResultSearch}
                  onChange={(e) => {
                    setTableResultSearch(e.target.value);
                    setTableResultPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Date Filter */}
              <select
                value={tableResultFilterDate}
                onChange={(e) => {
                  setTableResultFilterDate(e.target.value as any);
                  setTableResultPage(1);
                }}
                aria-label="Filter tanggal pemeriksaan TENKO"
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="TODAY">Hari Ini</option>
                <option value="MONTH">Bulan Ini</option>
                <option value="ALL">Semua Tanggal</option>
              </select>

              {/* Recommendation Filter */}
              <select
                value={tableResultFilterRec}
                onChange={(e) => {
                  setTableResultFilterRec(e.target.value);
                  setTableResultPage(1);
                }}
                aria-label="Filter status rekomendasi hasil TENKO"
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="FIT">Fit to Work</option>
                <option value="NOTE">Fit with Note</option>
                <option value="UNFIT">Unfit</option>
              </select>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto min-h-[340px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">No</th>
                  <th className="py-2.5 px-3">ID TENKO &amp; Waktu</th>
                  <th className="py-2.5 px-3">Driver / Kenek</th>
                  <th className="py-2.5 px-3">Tanda Vital</th>
                  <th className="py-2.5 px-3">Rekomendasi</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedResultTenko.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <ShieldCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600 text-xs">Belum ada data pemeriksaan</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {tableResultFilterDate === 'TODAY'
                          ? 'Belum ada pemeriksaan TENKO tercatat untuk hari ini'
                          : 'Tidak ada data yang cocok dengan pencarian / filter'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedResultTenko.map((exam, idx) => {
                    const rowNumber = (tableResultPage - 1) * tableResultPerPage + idx + 1;
                    const rec = (exam.recommendation || '').toUpperCase();

                    return (
                      <tr key={exam.tenkoDocumentId || exam.tenkoId} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {rowNumber}
                        </td>

                        {/* ID TENKO & Time */}
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-semibold text-blue-700 block">
                            {exam.tenkoId}
                          </span>
                          <span className="text-[10.5px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {exam.finishTime ? exam.finishTime.slice(11, 16) : exam.examinationDate}
                          </span>
                        </td>

                        {/* Driver Info */}
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900 block truncate max-w-[140px]">
                            {exam.driverNameSnapshot}
                          </span>
                          <div className="flex items-center gap-1 text-[10.5px] text-slate-500 mt-0.5">
                            <span className="font-mono">{exam.driverId}</span>
                            <span>&middot;</span>
                            <span className="px-1 py-0.2 bg-slate-100 rounded text-[9.5px] font-bold">
                              {exam.positionSnapshot || 'DRIVER'}
                            </span>
                          </div>
                        </td>

                        {/* Vital Signs (BP, Heart Rate, Temp) */}
                        <td className="py-2.5 px-3">
                          <div className="text-[11px] space-y-0.5">
                            <span className="block font-medium text-slate-800">
                              TD: {exam.bloodPressureResult || `${exam.bloodPressureSystolic}/${exam.bloodPressureDiastolic}`}
                            </span>
                            <span className="text-[10.5px] text-slate-500 block">
                              Suhu: {exam.temperature ? `${exam.temperature}°C` : '-'} &middot; HR: {exam.heartRate ? `${exam.heartRate} bpm` : '-'}
                            </span>
                          </div>
                        </td>

                        {/* Recommendation Badge */}
                        <td className="py-2.5 px-3">
                          {rec.includes('WITH NOTE') ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Fit w/ Note
                            </span>
                          ) : rec.includes('UNFIT') ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-2.5 h-2.5" />
                              Unfit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Fit to Work
                            </span>
                          )}

                          {/* Security Gate Badge */}
                          {exam.securityGateStatus === 'PASSED' || exam.isUsed ? (
                            <span className="block mt-1 text-[9.5px] font-semibold text-emerald-600">
                              ✓ Gate Passed
                            </span>
                          ) : (
                            <span className="block mt-1 text-[9.5px] font-medium text-slate-400">
                              Belum lewat pos
                            </span>
                          )}
                        </td>

                        {/* Action: Detail */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onSelectExamination && onSelectExamination(exam)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Lihat Detail Pemeriksaan"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer & Pagination */}
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span>
              Total: <strong>{filteredResultTenko.length}</strong> pemeriksaan
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTableResultPage((p) => Math.max(1, p - 1))}
                disabled={tableResultPage === 1}
                className="p-1 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-medium px-1">
                {tableResultPage} / {totalResultTenkoPages}
              </span>
              <button
                type="button"
                onClick={() => setTableResultPage((p) => Math.min(totalResultTenkoPages, p + 1))}
                disabled={tableResultPage >= totalResultTenkoPages}
                className="p-1 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                title="Halaman berikutnya"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ================= TABLE 4: ATTENDANCE LOG DRIVER / KENEK BELUM ABSEN ================= */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
          {/* Card Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <h2 className="text-sm font-bold text-slate-900">
                    4. Driver &amp; Kenek yang Belum Absen Hari Ini
                  </h2>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  Daftar personil pengemudi aktif yang belum tercatat clock-in pada hari ini
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('attendance_log')}
                className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer self-start sm:self-auto shrink-0"
              >
                Buka Log Absensi &rarr;
              </button>
            </div>

            {/* Tab switch between "Belum Absen Hari Ini" and "Sudah Absen tapi Belum TENKO" */}
            <div className="mt-3 flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => {
                  setTableAbsenTab('BELUM_ABSEN');
                  setTableAbsenPage(1);
                }}
                className={`text-xs font-bold pb-1 relative transition cursor-pointer ${
                  tableAbsenTab === 'BELUM_ABSEN'
                    ? 'text-rose-600 border-b-2 border-rose-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Belum Absen Hari Ini ({driversBelumAbsenHariIni.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setTableAbsenTab('SUDAH_ABSEN_BELUM_TENKO');
                  setTableAbsenPage(1);
                }}
                className={`text-xs font-bold pb-1 relative transition cursor-pointer ${
                  tableAbsenTab === 'SUDAH_ABSEN_BELUM_TENKO'
                    ? 'text-amber-600 border-b-2 border-amber-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sudah Absen, Belum TENKO ({driversSudahAbsenBelumTenko.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="mt-2.5 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  tableAbsenTab === 'BELUM_ABSEN'
                    ? 'Cari nama driver, NIK yang belum absen...'
                    : 'Cari driver sudah absen yang belum periksa tenko...'
                }
                value={tableAbsenSearch}
                onChange={(e) => {
                  setTableAbsenSearch(e.target.value);
                  setTableAbsenPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto min-h-[340px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">No</th>
                  <th className="py-2.5 px-3">NIK &amp; Nama Personil</th>
                  <th className="py-2.5 px-3">Posisi &amp; Grup</th>
                  <th className="py-2.5 px-3">Status Hari Ini</th>
                  <th className="py-2.5 px-3 text-center">Tindakan / Kontak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTableAbsen.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <UserCheck className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                      <p className="font-semibold text-slate-700 text-xs">
                        {tableAbsenTab === 'BELUM_ABSEN'
                          ? 'Semua driver telah melakukan absensi masuk!'
                          : 'Tidak ada driver tertunda pemeriksaan TENKO'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Kepatuhan operasional berjalan optimal di hub ini.
                      </p>
                    </td>
                  </tr>
                ) : tableAbsenTab === 'BELUM_ABSEN' ? (
                  // LIST 1: BELUM ABSEN HARI INI
                  (paginatedTableAbsen as Array<{ driver: Driver; statusText: string }>).map((item, idx) => {
                    const rowNumber = (tableAbsenPage - 1) * tableAbsenPerPage + idx + 1;
                    const drv = item.driver;

                    return (
                      <tr key={drv.driverDocumentId || drv.driverId} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {rowNumber}
                        </td>

                        {/* NIK & Full Name */}
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900 block truncate max-w-[150px]">
                            {drv.fullName}
                          </span>
                          <span className="font-mono text-[10.5px] text-slate-500 block mt-0.5">
                            {drv.driverId}
                          </span>
                        </td>

                        {/* Position & Group */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                              drv.position === 'KENEK'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {drv.position || 'DRIVER'}
                          </span>
                          <span className="text-[10.5px] text-slate-500 block mt-0.5">
                            {drv.driverGroupId || '-'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Clock className="w-2.5 h-2.5" />
                            Belum Absen
                          </span>
                        </td>

                        {/* Actions: WA Reminder & Start Tenko */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {drv.phoneNumber ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSendWhatsAppReminder(
                                    drv.phoneNumber,
                                    drv.fullName,
                                    'belum melakukan absensi masuk hari ini'
                                  )
                                }
                                className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                                title={`Ingatkan via WhatsApp (${drv.phoneNumber})`}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No WA -</span>
                            )}

                            {onStartExaminationWithDriver && (
                              <button
                                type="button"
                                onClick={() => onStartExaminationWithDriver(drv.driverId)}
                                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10.5px] font-semibold transition cursor-pointer"
                                title="Mulai Pemeriksaan TENKO langsung"
                              >
                                Mulai Tenko
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  // LIST 2: SUDAH ABSEN, BELUM TENKO
                  (paginatedTableAbsen as Array<{
                    driver?: Driver;
                    userCode: string;
                    driverName: string;
                    logTime: string;
                    siteName: string;
                    phoneNumber?: string;
                    position: string;
                    driverGroup?: string;
                  }>).map((item, idx) => {
                    const rowNumber = (tableAbsenPage - 1) * tableAbsenPerPage + idx + 1;

                    return (
                      <tr key={item.userCode + idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {rowNumber}
                        </td>

                        {/* NIK & Full Name */}
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900 block truncate max-w-[150px]">
                            {item.driverName}
                          </span>
                          <span className="font-mono text-[10.5px] text-slate-500 block mt-0.5">
                            {item.userCode}
                          </span>
                        </td>

                        {/* Position & Group */}
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700">
                            {item.position}
                          </span>
                          <span className="text-[10.5px] text-slate-500 block mt-0.5">
                            {item.driverGroup || '-'}
                          </span>
                        </td>

                        {/* Status: Clock In Time */}
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Menunggu Tenko
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Absen: {item.logTime}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.phoneNumber && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSendWhatsAppReminder(
                                    item.phoneNumber,
                                    item.driverName,
                                    'sudah absen masuk tetapi belum menjalani pemeriksaan TENKO'
                                  )
                                }
                                className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                                title="Ingatkan ke Pos TENKO via WA"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onStartExaminationWithDriver && (
                              <button
                                type="button"
                                onClick={() => onStartExaminationWithDriver(item.userCode)}
                                className="px-2 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-[10.5px] font-semibold transition cursor-pointer"
                                title="Periksa Tenko Sekarang"
                              >
                                Periksa
                              </button>
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

          {/* Table Footer & Pagination */}
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span>
              Total:{' '}
              <strong>
                {tableAbsenTab === 'BELUM_ABSEN'
                  ? driversBelumAbsenHariIni.length
                  : driversSudahAbsenBelumTenko.length}
              </strong>{' '}
              personil
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTableAbsenPage((p) => Math.max(1, p - 1))}
                disabled={tableAbsenPage === 1}
                className="p-1 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-medium px-1">
                {tableAbsenPage} / {totalTableAbsenPages}
              </span>
              <button
                type="button"
                onClick={() => setTableAbsenPage((p) => Math.min(totalTableAbsenPages, p + 1))}
                disabled={tableAbsenPage >= totalTableAbsenPages}
                className="p-1 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                title="Halaman berikutnya"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
