import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TenkoExamination, Driver, DriverHealthRecord } from '../../types';
import { getTenkoExaminations } from '../../services/tenkoService';
import { getDrivers } from '../../services/driverService';
import { getDriverHealthRecords } from '../../services/healthService';
import { StatusBadge } from '../../components/common/StatusBadge';
import { QuickAddDriverModal } from '../../components/common/QuickAddDriverModal';
import {
  ClipboardPlus,
  UserPlus,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Printer,
  Search,
  ArrowRight,
  Clock,
  User,
  Activity,
  Truck,
  HeartPulse,
  Pill,
} from 'lucide-react';
import { NavigationPage } from '../../components/layout/Sidebar';

interface NakesDashboardProps {
  onNavigate: (page: NavigationPage) => void;
  onSelectExamination: (exam: TenkoExamination, printImmediate?: boolean) => void;
}

export const NakesDashboard: React.FC<NakesDashboardProps> = ({
  onNavigate,
  onSelectExamination,
}) => {
  const { currentUser } = useAuth();
  const [examinations, setExaminations] = useState<TenkoExamination[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [healthRecords, setHealthRecords] = useState<DriverHealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [allExams, allDrivers, allHealth] = await Promise.all([
        getTenkoExaminations(),
        getDrivers(),
        getDriverHealthRecords(),
      ]);
      setExaminations(allExams);
      setDrivers(allDrivers);
      setHealthRecords(allHealth);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activeHealthRecords = healthRecords.filter((r) => r.status === 'ACTIVE');

  const todayStr = new Date().toISOString().split('T')[0];
  const todayExams = examinations.filter(
    (e) => e.examinationDate === todayStr || e.createdAt?.startsWith(todayStr)
  );

  const todayFit = todayExams.filter((e) => e.recommendation === 'FIT TO WORK').length;
  const todayFitNote = todayExams.filter((e) => e.recommendation === 'FIT TO WORK WITH NOTE').length;
  const todayUnfit = todayExams.filter((e) => e.recommendation === 'UNFIT TO WORK').length;

  return (
    <div id="nakes-dashboard-view" className="space-y-6">
      {/* Welcome & Primary Actions Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-900/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-100 text-xs font-semibold backdrop-blur-xs mb-3">
            <Activity className="w-3.5 h-3.5 text-blue-300" />
            <span>Pemeriksaan Medis & Keselamatan Operasional</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">
            Selamat Bertugas, {currentUser?.fullName || 'Nakes Pemeriksa'}
          </h2>
          <p className="text-xs md:text-sm text-blue-100/90 mt-1 max-w-xl">
            Lakukan pemeriksaan kesiapan pre-shipment pengemudi dan kenek secara teliti untuk menjamin keselamatan perjalanan logistik.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            id="btn-start-new-exam-main"
            onClick={() => onNavigate('new_examination')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-blue-800 hover:bg-blue-50 font-black text-sm rounded-2xl shadow-lg shadow-black/10 transition-transform active:scale-95 cursor-pointer"
          >
            <ClipboardPlus className="w-5 h-5 text-blue-700" />
            <span>+ Mulai Pemeriksaan Baru</span>
          </button>

          <button
            id="btn-quick-add-driver-dashboard"
            onClick={() => setIsQuickAddOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600/60 hover:bg-blue-600 border border-white/20 text-white font-bold text-sm rounded-2xl backdrop-blur-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Tambah Driver/Kenek</span>
          </button>
        </div>
      </div>

      {/* Daily KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Hari Ini */}
        <div id="kpi-today-total" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pemeriksaan Hari Ini</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{todayExams.length}</span>
            <span className="text-xs text-slate-500 font-medium">Orang diperiksa</span>
          </div>
        </div>

        {/* KPI 2: Fit to Work */}
        <div id="kpi-today-fit" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Fit to Work</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{todayFit}</span>
            <span className="text-xs text-slate-500 font-medium">Siap Berangkat</span>
          </div>
        </div>

        {/* KPI 3: Fit with Note */}
        <div id="kpi-today-note" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Fit with Note</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{todayFitNote}</span>
            <span className="text-xs text-slate-500 font-medium">Dengan Catatan</span>
          </div>
        </div>

        {/* KPI 4: Unfit to Work */}
        <div id="kpi-today-unfit" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Unfit to Work</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600">{todayUnfit}</span>
            <span className="text-xs text-slate-500 font-medium">Dilarang Jalan</span>
          </div>
        </div>
      </div>

      {/* Driver Health Monitoring Banner / Active Cases Widget */}
      <div className="bg-white rounded-3xl border border-rose-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold">
              <HeartPulse className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base">Driver Health — Kasus Keluhan Medis Aktif</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                  {activeHealthRecords.length} Kasus Aktif
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Daftar pengemudi dengan keluhan kesehatan yang memerlukan pemantauan & evaluasi berkala oleh Nakes
              </p>
            </div>
          </div>

          <button
            id="btn-goto-driver-health-dash"
            onClick={() => onNavigate('driver_health')}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition cursor-pointer self-start sm:self-auto"
          >
            <span>Buka Menu Driver Health</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeHealthRecords.length === 0 ? (
          <div className="py-6 px-4 rounded-2xl bg-slate-50/60 border border-slate-100 text-center">
            <p className="text-xs font-bold text-slate-600">Tidak ada pengemudi dengan keluhan medis aktif.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Semua pengemudi dalam kondisi sehat atau keluhan sebelumnya telah dinyatakan SOLVED.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {activeHealthRecords.slice(0, 6).map((rec) => (
              <div
                key={rec.recordDocumentId || rec.recordId}
                className="p-4 rounded-2xl bg-rose-50/30 border border-rose-100 hover:border-rose-300 transition space-y-2.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                        {rec.driverId} • {rec.driverGroup}
                      </span>
                      <h4 className="font-black text-slate-900 text-xs md:text-sm">{rec.driverName}</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">
                      {rec.indication}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-1.5">
                    <span className="font-semibold text-slate-700">Analisa:</span> {rec.analyze}
                  </p>
                </div>

                <div className="pt-2 border-t border-rose-100/80 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-800 font-semibold flex items-center gap-1 truncate max-w-[170px]" title={rec.vitamin}>
                    <Pill className="w-3 h-3 text-emerald-600 shrink-0" />
                    {rec.vitamin || 'Tidak ada vitamin'}
                  </span>

                  <button
                    onClick={() => onNavigate('driver_health')}
                    className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Evaluasi &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Operational Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Examination Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Pemeriksaan Terbaru Hari Ini</h3>
              <p className="text-xs text-slate-500">Daftar kesiapan pengemudi yang baru saja dilakukan clearance</p>
            </div>
            <button
              onClick={() => onNavigate('data_tenko')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Lihat Semua Data TENKO</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Memuat data pemeriksaan...</div>
          ) : examinations.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Belum ada pemeriksaan hari ini.</p>
              <p className="text-xs text-slate-500 mt-1">Mulai pemeriksaan kesiapan driver sebelum kendaraan berangkat.</p>
              <button
                onClick={() => onNavigate('new_examination')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700"
              >
                <ClipboardPlus className="w-4 h-4" />
                + Mulai Pemeriksaan
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
              <table className="w-full min-w-[550px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3.5 pl-4 min-w-[140px]">Waktu / ID</th>
                    <th className="py-3 px-3.5 min-w-[170px]">Driver / Kenek</th>
                    <th className="py-3 px-3.5 min-w-[100px]">Posisi</th>
                    <th className="py-3 px-3.5 min-w-[130px]">Rekomendasi</th>
                    <th className="py-3 px-3.5 pr-4 min-w-[80px] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {examinations.slice(0, 7).map((exam) => (
                    <tr key={exam.tenkoDocumentId || exam.tenkoId} className="hover:bg-blue-50/40 transition">
                      <td className="py-3.5 px-3.5 pl-4 whitespace-nowrap">
                        <span className="font-bold text-blue-900 font-mono block text-xs">{exam.tenkoId}</span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(exam.finishTime || exam.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
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
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <StatusBadge type="recommendation" value={exam.recommendation} size="sm" />
                      </td>
                      <td className="py-3.5 px-3.5 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectExamination(exam, false)}
                            title="Lihat Detail Pemeriksaan"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onSelectExamination(exam, true)}
                            title="Cetak Hasil TENKO"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
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
        </div>

        {/* Right Column: Driver/Kenek Master Fast List */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Driver Terdaftar</h3>
              <p className="text-xs text-slate-500">Master armada siap diperiksa</p>
            </div>
            <button
              onClick={() => onNavigate('master_drivers')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Kelola
            </button>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {drivers.slice(0, 6).map((drv) => (
              <div
                key={drv.driverDocumentId}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-xs truncate">{drv.fullName}</p>
                    <p className="text-[11px] font-mono text-slate-500">{drv.driverId} • {drv.position}</p>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('new_examination')}
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-white border border-blue-200 hover:bg-blue-600 hover:text-white rounded-lg transition"
                >
                  Periksa
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => setIsQuickAddOpen(true)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Daftarkan Driver/Kenek Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Driver Modal */}
      <QuickAddDriverModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={() => loadDashboardData()}
      />
    </div>
  );
};
