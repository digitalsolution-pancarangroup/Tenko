import React, { useState, useEffect, useMemo } from 'react';
import {
  TenkoExamination,
  Driver,
  Nakes,
  DriverGroup,
  Location,
  AttendanceLogItem,
} from '../../types';
import { getTenkoExaminations } from '../../services/tenkoService';
import { getDrivers } from '../../services/driverService';
import { getNakesList, getDriverGroups, getLocations } from '../../services/masterService';
import { getAttendanceLogs } from '../../services/attendanceService';
import { useAuth } from '../../context/AuthContext';
import { NavigationPage } from '../layout/Sidebar';
import * as XLSX from 'xlsx';

interface ExecutiveDashboardViewProps {
  onNavigate: (page: NavigationPage) => void;
  onSelectExamination?: (exam: TenkoExamination, printImmediate?: boolean) => void;
  onStartExaminationWithDriver?: (driverId: string) => void;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  onNavigate,
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

  // Formatted Current Date in Indonesian (e.g. "Sabtu, 26 September 2026")
  const formattedToday = useMemo(() => {
    const now = new Date();
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
  }, []);

  const currentHubLocation = useMemo(() => {
    return currentUser?.locationName || currentUser?.locationId || 'Hub Soekarno-Hatta';
  }, [currentUser]);

  useEffect(() => {
    loadAllDashboardData();
  }, []);

  const loadAllDashboardData = async () => {
    setLoading(true);
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
    }
  };

  // Export Dashboard Report
  const handleExportDashboardExcel = () => {
    const exportData = examinations.map((exam, idx) => ({
      No: idx + 1,
      'ID TENKO': exam.tenkoId,
      Tanggal: exam.examinationDate,
      'Waktu Selesai': exam.finishTime || exam.createdAt,
      'NIK / ID Driver': exam.driverId,
      'Nama Driver / Kenek': exam.driverNameSnapshot,
      Posisi: exam.positionSnapshot,
      'Group Driver': exam.driverGroupSnapshot || '-',
      'Nakes Pemeriksa': exam.examinerName,
      'Rekomendasi TENKO': exam.recommendation,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dashboard_Operasional');
    XLSX.writeFile(wb, `Laporan_Dashboard_Operasional.xlsx`);
  };

  // Top Routes Data
  const topRoutes = [
    { city: 'Surabaya', code: 'SUB', count: 482, percentage: 100 },
    { city: 'Medan', code: 'KNO', count: 364, percentage: 75.5 },
    { city: 'Balikpapan', code: 'BPN', count: 312, percentage: 64.7 },
    { city: 'Makassar', code: 'UPG', count: 289, percentage: 59.9 },
    { city: 'Banjarmasin', code: 'BDJ', count: 176, percentage: 36.5 },
  ];

  // Action Items ("Perlu ditindak hari ini")
  const actionItems = [
    {
      id: 'act-1',
      dotColor: 'bg-[#A55A00]',
      title: '38 resi belum masuk manifest',
      subtitle: 'Tujuan Surabaya, Medan, Balikpapan',
      actionText: 'Buat manifest',
      actionTarget: () => onNavigate('data_tenko'),
    },
    {
      id: 'act-2',
      dotColor: 'bg-[#DC2626]',
      title: '12 POD belum diunggah lebih dari 24 jam',
      subtitle: 'Kiriman sudah berstatus terkirim',
      actionText: 'Tinjau',
      actionTarget: () => onNavigate('attendance_log'),
    },
    {
      id: 'act-3',
      dotColor: 'bg-[#2563EB]',
      title: '5 penawaran kedaluwarsa minggu ini',
      subtitle: 'Belum ada keputusan dari pelanggan',
      actionText: 'Tindak lanjut',
      actionTarget: () => onNavigate('driver_health'),
    },
    {
      id: 'act-4',
      dotColor: 'bg-[#A55A00]',
      title: '4 kendaraan KIR jatuh tempo < 30 hari',
      subtitle: 'B 9821 WDS, B 9145 XKR, dan 2 lainnya',
      actionText: 'Jadwalkan',
      actionTarget: () => onNavigate('master_drivers'),
    },
  ];

  return (
    <div id="dashboard-operasional-view" className="space-y-[18px]">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            Dashboard Operasional
          </h1>
          <p className="text-xs text-[#5B6675] mt-0.5 font-medium">
            {formattedToday} &middot; {currentHubLocation}
          </p>
        </div>

        {/* Top Header Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="btn-download-report"
            onClick={handleExportDashboardExcel}
            className="px-4 py-2 bg-white border border-[#E2E6EB] hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Unduh laporan
          </button>

          <button
            type="button"
            id="btn-create-manifest-tenko"
            onClick={() => onNavigate('new_examination')}
            className="px-4 py-2 bg-[#0B5FA5] hover:bg-[#094d87] text-white text-xs font-semibold rounded-xl shadow-none transition cursor-pointer"
          >
            Buat resi baru
          </button>
        </div>
      </div>

      {/* ================= 1. EMPAT KARTU KPI ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[18px]">
        {/* Card 1: Pengiriman hari ini */}
        <div className="bg-white border border-[#E2E6EB] rounded-2xl p-5">
          <span className="text-[12px] font-semibold text-[#5B6675] block">
            Pengiriman hari ini
          </span>
          <div className="font-mono font-semibold text-[30px] leading-tight text-slate-900 mt-1.5">
            184
          </div>
          <span className="text-[11.5px] text-[#7A8798] mt-1.5 block">
            Udara 62 &middot; Laut 85 &middot; Darat 37
          </span>
        </div>

        {/* Card 2: Dalam perjalanan */}
        <div className="bg-white border border-[#E2E6EB] rounded-2xl p-5">
          <span className="text-[12px] font-semibold text-[#5B6675] block">
            Dalam perjalanan
          </span>
          <div className="font-mono font-semibold text-[30px] leading-tight text-slate-900 mt-1.5">
            1.248
          </div>
          <span className="text-[11.5px] text-[#7A8798] mt-1.5 block">
            Resi aktif antar pulau
          </span>
        </div>

        {/* Card 3: Terkirim hari ini */}
        <div className="bg-white border border-[#E2E6EB] rounded-2xl p-5">
          <span className="text-[12px] font-semibold text-[#5B6675] block">
            Terkirim hari ini
          </span>
          <div className="font-mono font-semibold text-[30px] leading-tight text-[#04705B] mt-1.5">
            142
          </div>
          <span className="text-[11.5px] text-[#7A8798] mt-1.5 block">
            POD sudah ditandatangani
          </span>
        </div>

        {/* Card 4: Menunggu manifest */}
        <div className="bg-white border border-[#E2E6EB] rounded-2xl p-5">
          <span className="text-[12px] font-semibold text-[#5B6675] block">
            Menunggu manifest
          </span>
          <div className="font-mono font-semibold text-[30px] leading-tight text-[#A55A00] mt-1.5">
            38
          </div>
          <span className="text-[11.5px] text-[#7A8798] mt-1.5 block">
            Belum dimuat ke armada
          </span>
        </div>
      </div>

      {/* ================= 2. BARIS ANGKA KEUANGAN ================= */}
      <div className="bg-white border border-[#E2E6EB] rounded-2xl p-4 sm:p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0">
          {/* Kolom 1: Pendapatan bulan ini */}
          <div className="md:pr-5">
            <span className="text-[11.5px] font-medium text-[#7A8798] block">
              Pendapatan September
            </span>
            <div className="font-mono font-semibold text-[16px] text-slate-900 mt-1">
              Rp 2,68 M
            </div>
          </div>

          {/* Kolom 2: Piutang berjalan */}
          <div className="md:border-l md:border-[#ECEFF3] md:px-5">
            <span className="text-[11.5px] font-medium text-[#7A8798] block">
              Piutang berjalan
            </span>
            <div className="font-mono font-semibold text-[16px] text-slate-900 mt-1">
              Rp 825,9 Jt
            </div>
          </div>

          {/* Kolom 3: Pelanggan aktif */}
          <div className="md:border-l md:border-[#ECEFF3] md:px-5">
            <span className="text-[11.5px] font-medium text-[#7A8798] block">
              Pelanggan aktif
            </span>
            <div className="font-mono font-semibold text-[16px] text-slate-900 mt-1">
              342
            </div>
          </div>

          {/* Kolom 4: Armada siap jalan */}
          <div className="md:border-l md:border-[#ECEFF3] md:pl-5">
            <span className="text-[11.5px] font-medium text-[#7A8798] block">
              Armada siap jalan
            </span>
            <div className="font-mono font-semibold text-[16px] text-slate-900 mt-1">
              48 / 52
            </div>
          </div>
        </div>
      </div>

      {/* ================= 3 & 4. ACTION ITEMS & RUTE TERAMAI ================= */}
      <div className="flex flex-col lg:flex-row gap-[18px] items-start">
        {/* === 3. BLOK "PERLU DITINDAK HARI INI" === */}
        <div className="flex-1 w-full bg-white border border-[#E2E6EB] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-[#ECEFF3]">
            <h2 className="text-[14px] font-bold text-slate-900">
              Perlu ditindak hari ini
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('data_tenko')}
              className="text-[12.5px] font-semibold text-[#0B5FA5] hover:underline cursor-pointer"
            >
              Lihat semua
            </button>
          </div>

          {/* List Items */}
          <div className="divide-y divide-[#ECEFF3]">
            {actionItems.map((item) => (
              <div
                key={item.id}
                className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {/* Dot 8px */}
                  <span className={`w-2 h-2 rounded-full ${item.dotColor} shrink-0 mt-1.5`} />
                  <div className="min-w-0">
                    <h3 className="text-[13.5px] font-semibold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-[12px] text-[#7A8798] mt-0.5 truncate">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                {/* Action Link on Right */}
                <button
                  type="button"
                  onClick={item.actionTarget}
                  className="text-[12.5px] font-semibold text-[#0B5FA5] hover:underline cursor-pointer shrink-0 whitespace-nowrap pl-2"
                >
                  {item.actionText}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* === 4. RUTE TERAMAI === */}
        <div className="w-full lg:w-[368px] shrink-0 bg-white border border-[#E2E6EB] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-slate-900">
            Rute teramai bulan ini
          </h2>
          <p className="text-[11.5px] text-[#7A8798] mt-0.5">
            Berangkat dari hub Jakarta
          </p>

          {/* Progress list */}
          <div className="space-y-4 mt-4">
            {topRoutes.map((route) => (
              <div key={route.code} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center">
                    <span className="font-semibold text-slate-800">{route.city}</span>
                    <span className="font-mono text-[11px] text-[#7A8798] font-medium ml-1.5">
                      {route.code}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-700">
                    {route.count} resi
                  </span>
                </div>

                {/* Progress bar height 5px, bg #EDF1F5, fill #0B5FA5 */}
                <div className="w-full h-[5px] bg-[#EDF1F5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0B5FA5] rounded-full transition-all duration-500"
                    style={{ width: `${route.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
