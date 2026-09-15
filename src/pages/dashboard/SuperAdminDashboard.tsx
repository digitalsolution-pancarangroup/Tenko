import React, { useState, useEffect, useMemo } from 'react';
import { TenkoExamination, Driver, Nakes, User } from '../../types';
import { getTenkoExaminations } from '../../services/tenkoService';
import { getDrivers } from '../../services/driverService';
import { getNakesList } from '../../services/masterService';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Users,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Stethoscope,
  TrendingUp,
  PieChart,
  BarChart3,
  Filter,
  Download,
  Truck,
  Building2,
  Clock,
  Printer,
  Eye,
} from 'lucide-react';
import { NavigationPage } from '../../components/layout/Sidebar';

interface SuperAdminDashboardProps {
  onNavigate: (page: NavigationPage) => void;
  onSelectExamination: (exam: TenkoExamination, printImmediate?: boolean) => void;
}

type DateFilterType = 'today' | 'yesterday' | '7days' | 'thisMonth' | 'all';

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onNavigate,
  onSelectExamination,
}) => {
  const [examinations, setExaminations] = useState<TenkoExamination[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [nakesList, setNakesList] = useState<Nakes[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allExams, allDrivers, allNakes] = await Promise.all([
        getTenkoExaminations(),
        getDrivers(),
        getNakesList(),
      ]);
      setExaminations(allExams);
      setDrivers(allDrivers);
      setNakesList(allNakes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter examinations based on date filter
  const filteredExams = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return examinations.filter((exam) => {
      const examDate = new Date(exam.examinationDate || exam.createdAt);
      const examDateStr = exam.examinationDate || exam.createdAt.split('T')[0];

      if (dateFilter === 'today') return examDateStr === todayStr;
      if (dateFilter === 'yesterday') return examDateStr === yesterdayStr;
      if (dateFilter === '7days') return examDate >= sevenDaysAgo;
      if (dateFilter === 'thisMonth') return examDate >= firstDayOfMonth;
      return true;
    });
  }, [examinations, dateFilter]);

  // Aggregate Metrics
  const activeDrivers = drivers.filter((d) => d.status === 'ACTIVE').length;
  const activeNakes = nakesList.filter((n) => n.status === 'ACTIVE').length;

  const countFit = filteredExams.filter((e) => e.recommendation === 'FIT TO WORK').length;
  const countFitNote = filteredExams.filter((e) => e.recommendation === 'FIT TO WORK WITH NOTE').length;
  const countUnfit = filteredExams.filter((e) => e.recommendation === 'UNFIT TO WORK').length;

  // Driver vs Kenek
  const countDriver = filteredExams.filter((e) => e.positionSnapshot === 'DRIVER').length;
  const countKenek = filteredExams.filter((e) => e.positionSnapshot === 'KENEK').length;

  // By Driver Group
  const groupStats = useMemo(() => {
    const map: { [grp: string]: number } = {};
    filteredExams.forEach((e) => {
      const grp = e.driverGroupSnapshot || 'Tanpa Group';
      map[grp] = (map[grp] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExams]);

  // By Nakes Examiner
  const nakesStats = useMemo(() => {
    const map: { [name: string]: number } = {};
    filteredExams.forEach((e) => {
      const name = e.examinerName || 'Nakes';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExams]);

  // By Location
  const locationStats = useMemo(() => {
    const map: { [loc: string]: number } = {};
    filteredExams.forEach((e) => {
      const loc = e.locationNameSnapshot || e.locationId || 'Pool Marunda - Jakarta Utara';
      map[loc] = (map[loc] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExams]);

  return (
    <div id="superadmin-dashboard-view" className="space-y-6">
      {/* Top Header Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Executive Health Clearance Monitoring</h2>
          <p className="text-xs text-slate-500 mt-0.5">Analisis kesiapan fisik, tes skrining zat, dan status rekomendasi pengemudi</p>
        </div>

        {/* Global Date Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 text-xs font-semibold">
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 rounded-xl transition ${
              dateFilter === 'today' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hari Ini
          </button>
          <button
            onClick={() => setDateFilter('yesterday')}
            className={`px-3 py-1.5 rounded-xl transition ${
              dateFilter === 'yesterday' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kemarin
          </button>
          <button
            onClick={() => setDateFilter('7days')}
            className={`px-3 py-1.5 rounded-xl transition ${
              dateFilter === '7days' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 Hari
          </button>
          <button
            onClick={() => setDateFilter('thisMonth')}
            className={`px-3 py-1.5 rounded-xl transition ${
              dateFilter === 'thisMonth' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bulan Ini
          </button>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition ${
              dateFilter === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua
          </button>
        </div>
      </div>

      {/* 6 TOP KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver Aktif</span>
          <span className="text-2xl font-black text-slate-900">{activeDrivers}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Armada terdaftar</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pemeriksaan</span>
          <span className="text-2xl font-black text-blue-600">{filteredExams.length}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Sesi selesai</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">Fit to Work</span>
          <span className="text-2xl font-black text-emerald-600">{countFit}</span>
          <span className="text-[10px] text-emerald-700 block mt-1">
            {filteredExams.length ? Math.round((countFit / filteredExams.length) * 100) : 0}% clearance
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-1">Fit with Note</span>
          <span className="text-2xl font-black text-amber-600">{countFitNote}</span>
          <span className="text-[10px] text-amber-700 block mt-1">Pengawasan</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block mb-1">Unfit to Work</span>
          <span className="text-2xl font-black text-rose-600">{countUnfit}</span>
          <span className="text-[10px] text-rose-700 block mt-1">Dibatalkan</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nakes Aktif</span>
          <span className="text-2xl font-black text-slate-900">{activeNakes || 2}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Petugas SIP aktif</span>
        </div>
      </div>

      {/* ANALYTICS GRIDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHART 2: Recommendation Distribution Breakdown */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm">Distribusi Rekomendasi</h3>
            <PieChart className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-emerald-700">FIT TO WORK</span>
                <span className="text-slate-800">{countFit} ({filteredExams.length ? Math.round((countFit / filteredExams.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${filteredExams.length ? (countFit / filteredExams.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-amber-700">FIT TO WORK WITH NOTE</span>
                <span className="text-slate-800">{countFitNote} ({filteredExams.length ? Math.round((countFitNote / filteredExams.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${filteredExams.length ? (countFitNote / filteredExams.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-rose-700">UNFIT TO WORK</span>
                <span className="text-slate-800">{countUnfit} ({filteredExams.length ? Math.round((countUnfit / filteredExams.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${filteredExams.length ? (countUnfit / filteredExams.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Rasio DRIVER vs KENEK:</span>
            <span className="font-bold text-slate-800">{countDriver} Pengemudi / {countKenek} Helper</span>
          </div>
        </div>

        {/* CHART 3: Pemeriksaan Berdasarkan Driver Group */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm">Pemeriksaan per Driver Group</h3>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3 pt-1">
            {groupStats.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Belum ada data untuk periode ini.</p>
            ) : (
              groupStats.map(([grpName, count]) => (
                <div key={grpName}>
                  <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700">
                    <span className="truncate max-w-[200px]">{grpName}</span>
                    <span className="font-bold text-slate-900">{count} Sesi</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${filteredExams.length ? (count / filteredExams.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CHART 5: Pemeriksaan Berdasarkan Pool Location */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm">Pemeriksaan per Pool Lokasi</h3>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3 pt-1">
            {locationStats.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Belum ada data untuk periode ini.</p>
            ) : (
              locationStats.map(([locName, count]) => (
                <div key={locName}>
                  <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700">
                    <span className="truncate max-w-[200px]">{locName}</span>
                    <span className="font-bold text-slate-900">{count} Sesi</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${filteredExams.length ? (count / filteredExams.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RECENT TENKO LOG TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Rekam Data Pemeriksaan Terakhir</h3>
            <p className="text-xs text-slate-500">Seluruh catatan clearance real-time dari seluruh pool</p>
          </div>
          <button
            onClick={() => onNavigate('data_tenko')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            Lihat Semua di Data TENKO &rarr;
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
          <table className="w-full min-w-[950px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 pl-4 min-w-[150px]">ID TENKO</th>
                <th className="py-3 px-3.5 min-w-[120px]">Tanggal / Waktu</th>
                <th className="py-3 px-3.5 min-w-[180px]">Driver / Kenek</th>
                <th className="py-3 px-3.5 min-w-[100px]">Posisi</th>
                <th className="py-3 px-3.5 min-w-[140px]">Nakes Pemeriksa</th>
                <th className="py-3 px-3.5 min-w-[130px]">Tanda Vital (BP)</th>
                <th className="py-3 px-3.5 min-w-[130px]">Rekomendasi</th>
                <th className="py-3 px-3.5 pr-4 min-w-[80px] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredExams.slice(0, 10).map((exam) => (
                <tr key={exam.tenkoDocumentId || exam.tenkoId} className="hover:bg-blue-50/40 transition">
                  <td className="py-3.5 px-3.5 pl-4 font-mono font-bold text-blue-900 whitespace-nowrap">{exam.tenkoId}</td>
                  <td className="py-3.5 px-3.5 text-slate-600 whitespace-nowrap">
                    <span className="font-semibold block">{exam.examinationDate}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{new Date(exam.finishTime || exam.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="py-3.5 px-3.5">
                    <span className="font-bold text-slate-900 block">{exam.driverNameSnapshot}</span>
                    <span className="text-[11px] font-mono text-blue-700">{exam.driverId}</span>
                  </td>
                  <td className="py-3.5 px-3.5 whitespace-nowrap">
                    <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                      exam.positionSnapshot === 'DRIVER'
                        ? 'bg-blue-50 text-blue-700 border border-blue-100'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {exam.positionSnapshot || 'DRIVER'}
                    </span>
                  </td>
                  <td className="py-3.5 px-3.5 text-slate-700 font-medium truncate max-w-[140px]">{exam.examinerName}</td>
                  <td className="py-3.5 px-3.5 font-mono font-semibold text-slate-700 whitespace-nowrap">{exam.bloodPressureResult}</td>
                  <td className="py-3.5 px-3.5 whitespace-nowrap">
                    <StatusBadge type="recommendation" value={exam.recommendation} size="sm" />
                  </td>
                  <td className="py-3.5 px-3.5 pr-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onSelectExamination(exam, false)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        title="Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onSelectExamination(exam, true)}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                        title="Print"
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
      </div>
    </div>
  );
};
