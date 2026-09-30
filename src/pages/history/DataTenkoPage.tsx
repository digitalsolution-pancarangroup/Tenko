import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TenkoExamination, DriverGroup, Nakes, Driver, Location } from '../../types';
import { getTenkoExaminations, deleteAllTenkoExaminations } from '../../services/tenkoService';
import { getDriverGroups, getNakesList, getLocations } from '../../services/masterService';
import { getDrivers } from '../../services/driverService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ImportTenkoModal } from '../../components/tenko/ImportTenkoModal';
import { DigitalTenkoCardModal } from '../../components/tenko/DigitalTenkoCardModal';
import {
  Search,
  Filter,
  Download,
  Calendar,
  Eye,
  Printer,
  FileSpreadsheet,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  ClipboardPlus,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  SlidersHorizontal,
  Menu as MenuIcon,
  Sparkles,
  Building2,
  QrCode,
  Send,
  RefreshCw,
} from 'lucide-react';

interface DataTenkoPageProps {
  onSelectExamination: (exam: TenkoExamination, printImmediate?: boolean) => void;
  onNewExamination?: () => void;
}

export const DataTenkoPage: React.FC<DataTenkoPageProps> = ({
  onSelectExamination,
  onNewExamination,
}) => {
  const [examinations, setExaminations] = useState<TenkoExamination[]>([]);
  const [driverGroups, setDriverGroups] = useState<DriverGroup[]>([]);
  const [nakesList, setNakesList] = useState<Nakes[]>([]);
  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [locationsList, setLocationsList] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCardExam, setSelectedCardExam] = useState<TenkoExamination | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const { currentUser } = useAuth();
  const { showToast } = useToast();

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPosition, setFilterPosition] = useState('ALL');
  const [filterGroup, setFilterGroup] = useState('ALL');
  const [filterRecommendation, setFilterRecommendation] = useState('ALL');
  const [filterSummary, setFilterSummary] = useState('ALL');
  const [filterNakes, setFilterNakes] = useState('ALL');
  const [filterLocation, setFilterLocation] = useState<string>('ALL');
  const [filterSecurityStatus, setFilterSecurityStatus] = useState<string>('ALL');

  useEffect(() => {
    loadData(true);
  }, []);

  // Automatic real-time sync when tab is revisited or browser window is focused
  useEffect(() => {
    const handleSyncOnTabFocus = () => {
      if (document.visibilityState === 'visible') {
        loadData(false);
      }
    };
    window.addEventListener('focus', handleSyncOnTabFocus);
    document.addEventListener('visibilitychange', handleSyncOnTabFocus);
    return () => {
      window.removeEventListener('focus', handleSyncOnTabFocus);
      document.removeEventListener('visibilitychange', handleSyncOnTabFocus);
    };
  }, []);

  const loadData = async (showFullLoading = true) => {
    if (showFullLoading) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const [exams, grps, nakes, drvs, locs] = await Promise.all([
        getTenkoExaminations(),
        getDriverGroups(),
        getNakesList(),
        getDrivers(),
        getLocations(),
      ]);
      setExaminations(exams);
      setDriverGroups(grps);
      setNakesList(nakes);
      setDriversList(drvs);
      setLocationsList(locs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterPosition('ALL');
    setFilterGroup('ALL');
    setFilterRecommendation('ALL');
    setFilterSummary('ALL');
    setFilterNakes('ALL');
    setFilterLocation('ALL');
    setFilterSecurityStatus('ALL');
    setCurrentPage(1);
  };

  const filteredExams = useMemo(() => {
    return examinations.filter((exam) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (exam.tenkoId && exam.tenkoId.toLowerCase().includes(q)) ||
        (exam.driverId && exam.driverId.toLowerCase().includes(q)) ||
        (exam.driverNameSnapshot && exam.driverNameSnapshot.toLowerCase().includes(q)) ||
        (exam.driverGroupSnapshot && exam.driverGroupSnapshot.toLowerCase().includes(q)) ||
        (exam.locationNameSnapshot && exam.locationNameSnapshot.toLowerCase().includes(q)) ||
        (exam.locationId && exam.locationId.toLowerCase().includes(q)) ||
        (exam.securityOfficerName && exam.securityOfficerName.toLowerCase().includes(q)) ||
        (exam.vehiclePlateNumber && exam.vehiclePlateNumber.toLowerCase().includes(q));

      const examDate = exam.examinationDate || (exam.createdAt ? exam.createdAt.split('T')[0] : '');
      const matchStartDate = !filterStartDate || examDate >= filterStartDate;
      const matchEndDate = !filterEndDate || examDate <= filterEndDate;

      const matchPos = filterPosition === 'ALL' || exam.positionSnapshot === filterPosition;
      const matchGrp = filterGroup === 'ALL' || exam.driverGroupSnapshot === filterGroup;
      const matchRec = filterRecommendation === 'ALL' || exam.recommendation === filterRecommendation;
      const matchSum = filterSummary === 'ALL' || exam.summary === filterSummary;
      const matchNakes = filterNakes === 'ALL' || exam.examinerName === filterNakes;
      const matchLoc =
        filterLocation === 'ALL' ||
        (exam.locationNameSnapshot && exam.locationNameSnapshot.trim().toLowerCase() === filterLocation.trim().toLowerCase()) ||
        (exam.locationId && exam.locationId.trim().toLowerCase() === filterLocation.trim().toLowerCase());

      const isExamPassed = exam.securityGateStatus === 'PASSED' || exam.securityGateStatus === 'WARNING_PASSED' || (exam.isUsed && exam.securityGateStatus !== 'REJECTED');
      const isExamHeld = exam.securityGateStatus === 'REJECTED';
      const matchSecurity =
        filterSecurityStatus === 'ALL' ||
        (filterSecurityStatus === 'PASSED' && isExamPassed) ||
        (filterSecurityStatus === 'HOLD' && isExamHeld) ||
        (filterSecurityStatus === 'PENDING' && !isExamPassed && !isExamHeld);

      return (
        matchSearch &&
        matchStartDate &&
        matchEndDate &&
        matchPos &&
        matchGrp &&
        matchRec &&
        matchSum &&
        matchNakes &&
        matchLoc &&
        matchSecurity
      );
    });
  }, [
    examinations,
    searchQuery,
    filterStartDate,
    filterEndDate,
    filterPosition,
    filterGroup,
    filterRecommendation,
    filterSummary,
    filterNakes,
    filterLocation,
    filterSecurityStatus,
  ]);

  // Paginated records
  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredExams.length / pageSize) || 1;
  const paginatedExams = useMemo(() => {
    if (pageSize === -1) return filteredExams;
    const start = (currentPage - 1) * pageSize;
    return filteredExams.slice(start, start + pageSize);
  }, [filteredExams, currentPage, pageSize]);

  // Export to CSV (Full 35 columns matching schema)
  const handleExportCSV = () => {
    if (filteredExams.length === 0) return;

    const headers = [
      'NO TENKO',
      'ID TENKO',
      'DATE',
      'ID DRIVER',
      'DRIVER NAME',
      'POSITION',
      'DRIVER GROUP',
      'LOKASI / POOL',
      'RHA-JMP',
      'DOK JMP',
      'DAILY NON-WORKING HOURS',
      'OFF-DUTY SLEEP DURATION',
      'TEMP',
      'BLOOD PRESSURE (SISTOLIK)',
      'BLOOD PRESSURE (DIASTOLIK)',
      'BLOOD PRESURE RESULT',
      'HEARTRATE (BPM)',
      'ALCOHOL TEST (BAC)',
      'DRUG TEST',
      'APPEARANCE',
      'EYES',
      'FACE',
      'HAIR',
      'EMOTIONAL REGULATION',
      'PROBLEM SOLVING',
      'SELF-AWARENESS',
      'COMUNICATION',
      'DECISION MAKING',
      'BALANCE TEST',
      'INTERVIEW',
      'SUMMARY',
      'RECOMMENDATION',
      'NOTE',
      'FINISH TIME',
      'CREATED DATE',
      'CREATED BY',
    ];

    const rows = filteredExams.map((e, idx) => [
      `"${idx + 1}"`,
      `"${e.tenkoId || ''}"`,
      `"${e.examinationDate || ''}"`,
      `"${e.driverId || ''}"`,
      `"${(e.driverNameSnapshot || '').replace(/"/g, '""')}"`,
      `"${e.positionSnapshot || ''}"`,
      `"${(e.driverGroupSnapshot || '').replace(/"/g, '""')}"`,
      `"${(e.locationNameSnapshot || e.locationId || 'Pool Tanah Merdeka - Cilincing').replace(/"/g, '""')}"`,
      `"${e.rhaJmp || 'READY'}"`,
      `"${e.dokJmp || 'READY'}"`,
      `"${e.dailyNonWorkingHours || '>= 11 HOURS'}"`,
      `"${e.offDutySleepDuration ?? ''}"`,
      `"${e.temperature ?? ''}"`,
      `"${e.bloodPressureSystolic ?? ''}"`,
      `"${e.bloodPressureDiastolic ?? ''}"`,
      `"${e.bloodPressureResult || ''}"`,
      `"${e.heartRate ?? ''}"`,
      `"${e.alcoholTest || ''}"`,
      `"${e.drugTest || ''}"`,
      `"${e.appearance || 'NORMAL'}"`,
      `"${e.eyes || 'NORMAL'}"`,
      `"${e.face || 'NORMAL'}"`,
      `"${e.hair || 'NORMAL'}"`,
      `"${e.emotionalRegulation || 'NORMAL'}"`,
      `"${e.problemSolving || 'NORMAL'}"`,
      `"${e.selfAwareness || 'NORMAL'}"`,
      `"${e.communication || 'NORMAL'}"`,
      `"${e.decisionMaking || 'NORMAL'}"`,
      `"${e.balanceTest || 'NORMAL'}"`,
      `"${e.interview || 'NORMAL'}"`,
      `"${e.summary || ''}"`,
      `"${e.recommendation || ''}"`,
      `"${(e.note || '').replace(/"/g, '""')}"`,
      `"${e.finishTime ? new Date(e.finishTime).toLocaleString('id-ID') : ''}"`,
      `"${e.createdAt ? new Date(e.createdAt).toLocaleString('id-ID') : ''}"`,
      `"${(e.createdBy || e.examinerName || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TENKO_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAllRecords = async () => {
    setIsDeleting(true);
    try {
      const count = await deleteAllTenkoExaminations(
        currentUser ? { userId: currentUser.userId, fullName: currentUser.fullName } : undefined
      );
      showToast(`Berhasil menghapus ${count} data pemeriksaan TENKO. Database siap menerima data real.`, 'success');
      setIsDeleteModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus data pemeriksaan.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="data-tenko-view" className="space-y-6">
      {/* Header & Quick Action Menu */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Data TENKO
          </h1>
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold whitespace-nowrap">
            {examinations.length} Rekam Medis
          </span>
          <span className="text-xs text-slate-400 font-medium">
            (Menampilkan {filteredExams.length} hasil filter)
          </span>
        </div>

        {/* Top Actions: Refresh Data + Pemeriksaan Baru + Menu Tindakan */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <button
            id="btn-data-tenko-refresh"
            type="button"
            onClick={() => {
              loadData(false);
              showToast('Data TENKO berhasil disinkronkan.', 'success');
            }}
            disabled={isRefreshing}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-2xl border border-slate-200 transition-all cursor-pointer whitespace-nowrap"
            title="Sinkronkan data terbaru dari server"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Menyinkronkan...' : 'Refresh Data'}</span>
          </button>

          {onNewExamination && (
            <button
              id="btn-data-tenko-new-exam"
              type="button"
              onClick={onNewExamination}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-2xl shadow-md shadow-blue-600/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <ClipboardPlus className="w-4 h-4 shrink-0" />
              <span>+ Pemeriksaan Baru</span>
            </button>
          )}

          {/* Luxury Action Menu Dropdown */}
          <div className="relative w-full sm:w-auto" ref={actionMenuRef}>
            <button
              id="btn-data-tenko-action-menu"
              type="button"
              onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
              className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2.5 px-4 py-3 sm:py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold rounded-2xl shadow-md shadow-slate-900/10 border border-slate-700/60 transition-all cursor-pointer whitespace-nowrap"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
                <span>Menu Tindakan</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                  isActionMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Action Popover / Dropdown Menu */}
            {isActionMenuOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-72 min-w-[260px] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Menu Tindakan Data
                  </p>
                </div>

                {/* 1. Import Excel / CSV */}
                <button
                  id="menu-item-import-excel"
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    setIsImportModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50/80 text-left transition cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                      Import Excel / CSV
                    </p>
                    <p className="text-[10px] text-slate-400">Upload batch rekam medis pemeriksaan</p>
                  </div>
                </button>

                {/* 2. Export CSV */}
                <button
                  id="menu-item-export-csv"
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    handleExportCSV();
                  }}
                  disabled={filteredExams.length === 0}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 text-left transition cursor-pointer group disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-slate-700 group-hover:text-white transition">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-slate-900">
                      Export Data (CSV)
                    </p>
                    <p className="text-[10px] text-slate-400">Unduh data hasil pencarian/filter</p>
                  </div>
                </button>

                {/* 3. Delete All (if any records) */}
                {examinations.length > 0 && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      id="menu-item-delete-all"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setIsDeleteModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-50 text-left transition cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-rose-700">Hapus Semua Data</p>
                        <p className="text-[10px] text-rose-400">Kosongkan database rekam medis</p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comprehensive Filter Panel */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filter Data & Pencarian</span>
          </div>

          <button
            onClick={resetFilters}
            className="text-[11px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filter</span>
          </button>
        </div>

        {/* Search & Dates row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari ID TENKO, Driver ID, Nama..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => {
                setFilterStartDate(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Dari Tanggal"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => {
                setFilterEndDate(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Sampai Tanggal"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>
        </div>

        {/* Dropdown Filters row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Lokasi / Pool</label>
            <select
              value={filterLocation}
              onChange={(e) => {
                setFilterLocation(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none"
            >
              <option value="ALL">Semua Pool ({locationsList.length || 'Semua'})</option>
              {locationsList.map((loc) => (
                <option key={loc.locationId || loc.locationDocumentId} value={loc.locationName}>
                  {loc.locationName}
                </option>
              ))}
              {locationsList.every((l) => !l.locationName.includes('Tanah Merdeka')) && (
                <option value="Pool Tanah Merdeka - Cilincing">Pool Tanah Merdeka - Cilincing</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Posisi</label>
            <select
              value={filterPosition}
              onChange={(e) => {
                setFilterPosition(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none"
            >
              <option value="ALL">Semua Posisi</option>
              <option value="DRIVER">DRIVER</option>
              <option value="KENEK">KENEK</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver Group</label>
            <select
              value={filterGroup}
              onChange={(e) => {
                setFilterGroup(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none"
            >
              <option value="ALL">Semua Group ({driverGroups.length})</option>
              {driverGroups.map((g) => (
                <option key={g.groupId || g.groupDocumentId} value={g.groupName || g.groupId}>
                  {g.groupName || g.groupId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rekomendasi</label>
            <select
              value={filterRecommendation}
              onChange={(e) => {
                setFilterRecommendation(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none"
            >
              <option value="ALL">Semua Rekomendasi</option>
              <option value="FIT TO WORK">FIT TO WORK</option>
              <option value="FIT TO WORK WITH NOTE">FIT TO WORK WITH NOTE</option>
              <option value="UNFIT TO WORK">UNFIT TO WORK</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Summary</label>
            <select
              value={filterSummary}
              onChange={(e) => {
                setFilterSummary(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none"
            >
              <option value="ALL">Semua Summary</option>
              <option value="PASSED">LULUS (PASSED)</option>
              <option value="FAILED">TIDAK LULUS (FAILED)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Konfirmasi Security</label>
            <select
              value={filterSecurityStatus}
              onChange={(e) => {
                setFilterSecurityStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none"
            >
              <option value="ALL">Semua Status Security</option>
              <option value="PASSED">Terkonfirmasi: PASSED (Izin Keluar)</option>
              <option value="HOLD">Terkonfirmasi: HOLD (Ditahan)</option>
              <option value="PENDING">Belum Verifikasi Security</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nakes Pemeriksa</label>
            <select
              value={filterNakes}
              onChange={(e) => {
                setFilterNakes(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none"
            >
              <option value="ALL">Semua Nakes</option>
              {nakesList.map((n) => (
                <option key={n.nakesId || n.nakesDocumentId} value={n.fullName}>
                  {n.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Menampilkan {filteredExams.length} Catatan Pemeriksaan
          </span>

          {/* Page size selector */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700"
            >
              <option value={25}>25 per halaman</option>
              <option value={50}>50 per halaman</option>
              <option value={100}>100 per halaman</option>
              <option value={-1}>Semua Data</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Memuat data riwayat TENKO...</div>
        ) : filteredExams.length === 0 ? (
          <div className="py-12 text-center">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Tidak ada riwayat pemeriksaan ditemukan.</p>
            <p className="text-xs text-slate-400 mt-0.5">Silakan sesuaikan kriteria filter atau lakukan import Excel.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
            <table className="w-full min-w-[1200px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 pl-4 min-w-[160px]">ID TENKO</th>
                  <th className="py-3 px-3.5 min-w-[120px]">Tanggal / Jam</th>
                  <th className="py-3 px-3.5 min-w-[180px]">Driver / Kenek</th>
                  <th className="py-3 px-3.5 min-w-[100px]">Posisi</th>
                  <th className="py-3 px-3.5 min-w-[180px]">Lokasi / Pool</th>
                  <th className="py-3 px-3.5 min-w-[160px]">Group</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Tanda Vital (BP)</th>
                  <th className="py-3 px-3.5 min-w-[110px]">Summary</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Rekomendasi</th>
                  <th className="py-3 px-3.5 min-w-[170px]">Konfirmasi Security</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Pemeriksa</th>
                  <th className="py-3 px-3.5 pr-4 min-w-[80px] text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedExams.map((exam) => (
                  <tr key={exam.tenkoDocumentId || exam.tenkoId} className="hover:bg-blue-50/40 transition">
                    <td className="py-3.5 px-3.5 pl-4 font-mono font-bold text-blue-900 whitespace-nowrap">{exam.tenkoId}</td>
                    <td className="py-3.5 px-3.5 text-slate-600 whitespace-nowrap">
                      <span className="font-semibold block">{exam.examinationDate}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {exam.finishTime
                           ? new Date(exam.finishTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5">
                      <span className="font-bold text-slate-900 block">{exam.driverNameSnapshot}</span>
                      <span className="text-[11px] font-mono text-blue-700">{exam.driverId}</span>
                    </td>
                    <td className="py-3.5 px-3.5 font-medium whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                        exam.positionSnapshot === 'DRIVER'
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {exam.positionSnapshot || 'DRIVER'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5">
                      <span className="font-semibold text-slate-800 block truncate max-w-[170px]" title={exam.locationNameSnapshot || exam.locationId}>
                        {exam.locationNameSnapshot || exam.locationId || 'Pool Tanah Merdeka - Cilincing'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-700 max-w-[160px] truncate" title={exam.driverGroupSnapshot}>
                      {exam.driverGroupSnapshot}
                    </td>
                    <td className="py-3.5 px-3.5 font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {exam.bloodPressureResult}
                    </td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <StatusBadge type="summary" value={exam.summary} size="sm" />
                    </td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <StatusBadge type="recommendation" value={exam.recommendation} size="sm" />
                    </td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      {exam.securityGateStatus === 'PASSED' || exam.securityGateStatus === 'WARNING_PASSED' || (exam.isUsed && exam.securityGateStatus !== 'REJECTED') ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>TERKONFIRMASI • PASSED</span>
                          </span>
                          <div className="text-[11px] text-slate-600 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">Petugas:</span>
                              <strong className="text-slate-900 font-bold">{exam.securityOfficerName || 'Security'}</strong>
                            </div>
                            {exam.securityCheckedAt && (
                              <div className="font-mono text-[10px] text-slate-500">
                                {new Date(exam.securityCheckedAt).toLocaleDateString('id-ID')} {new Date(exam.securityCheckedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                              </div>
                            )}
                            {exam.vehiclePlateNumber && (
                              <div className="font-mono font-bold text-amber-700 text-[10px]">
                                Plat: {exam.vehiclePlateNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : exam.securityGateStatus === 'REJECTED' ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300 shadow-xs">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>TERKONFIRMASI • DITAHAN</span>
                          </span>
                          <div className="text-[11px] text-slate-600 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">Petugas:</span>
                              <strong className="text-slate-900 font-bold">{exam.securityOfficerName || 'Security'}</strong>
                            </div>
                            {exam.securityCheckedAt && (
                              <div className="font-mono text-[10px] text-slate-500">
                                {new Date(exam.securityCheckedAt).toLocaleDateString('id-ID')} {new Date(exam.securityCheckedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Belum Verifikasi Security</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-700 max-w-[140px] truncate" title={exam.examinerName}>
                      {exam.examinerName}
                    </td>
                    <td className="py-3.5 px-3.5 pr-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedCardExam(exam)}
                          className="p-1.5 text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Lihat Kartu Digital & WhatsApp"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectExamination(exam, false)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Lihat Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectExamination(exam, true)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Print Hasil"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pageSize !== -1 && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
            <p className="text-slate-500">
              Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> ({filteredExams.length} Total Data)
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>

              <span className="px-3 py-1 bg-slate-100 rounded-lg font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      <ImportTenkoModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setIsImportModalOpen(false);
          loadData();
        }}
        existingDrivers={driversList}
        existingGroups={driverGroups}
      />

      {/* Delete All Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Hapus Semua Data TENKO?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tindakan ini akan <strong>menghapus permanen seluruh {examinations.length} data riwayat pemeriksaan TENKO</strong> dari database Firestore agar Anda dapat mengunggah file Excel berisi data real.
                </p>
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl mt-3 border border-amber-200 text-left">
                  ⚠️ <strong>Catatan:</strong> Data Master Driver, Master Lokasi, dan Master Nakes <strong>tidak akan terhapus</strong>.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAllRecords}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <span>Menghapus...</span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Ya, Hapus Semua</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Digital Tenko Card Modal */}
      <DigitalTenkoCardModal
        isOpen={!!selectedCardExam}
        onClose={() => setSelectedCardExam(null)}
        examination={selectedCardExam}
        onPrint={() => {
          if (selectedCardExam) {
            onSelectExamination(selectedCardExam, true);
          }
        }}
      />
    </div>
  );
};

