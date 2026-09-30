import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  User,
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Clock,
  HeartPulse,
  Thermometer,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  X,
  FileText,
  Activity,
  Eye,
} from 'lucide-react';
import { TenkoExamination, Driver, DriverGroup, Location } from '../../types';
import { getTenkoExaminations } from '../../services/tenkoService';
import { getDrivers } from '../../services/driverService';
import { getDriverGroups, getLocations } from '../../services/masterService';
import { useToast } from '../../components/common/Toast';

interface AssessmentReportPageProps {
  onSelectExamination?: (exam: TenkoExamination) => void;
}

export const AssessmentReportPage: React.FC<AssessmentReportPageProps> = ({
  onSelectExamination,
}) => {
  const { showToast } = useToast();

  const [examinations, setExaminations] = useState<TenkoExamination[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverGroups, setDriverGroups] = useState<DriverGroup[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter Modes: 'DRIVER' (Individual) | 'GROUP' | 'ALL'
  const [reportMode, setReportMode] = useState<'DRIVER' | 'GROUP' | 'ALL'>('DRIVER');

  // Filter States: From Date - To Date Range & Recommendation
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfYear = `${new Date().getFullYear()}-01-01`;
  const [startDate, setStartDate] = useState<string>(firstDayOfYear);
  const [endDate, setEndDate] = useState<string>(today);
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedRecommendation, setSelectedRecommendation] = useState<string>('ALL');

  // Driver ID search & Autocomplete
  const [driverIdInput, setDriverIdInput] = useState<string>('');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const driverInputContainerRef = useRef<HTMLDivElement>(null);

  // Print Mode State
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Handle outside click for driver autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        driverInputContainerRef.current &&
        !driverInputContainerRef.current.contains(e.target as Node)
      ) {
        setShowDriverDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [examsData, driversData, groupsData, locsData] = await Promise.all([
        getTenkoExaminations(),
        getDrivers(),
        getDriverGroups(),
        getLocations(),
      ]);

      setExaminations(examsData);
      setDrivers(driversData);
      setDriverGroups(groupsData);
      setLocations(locsData);

      // Default select the first driver if available and in DRIVER mode
      if (driversData.length > 0 && !selectedDriver) {
        // Find driver with most examinations if possible
        const countMap = new Map<string, number>();
        examsData.forEach((e) => {
          countMap.set(e.driverId, (countMap.get(e.driverId) || 0) + 1);
        });

        let topDriver = driversData[0];
        let maxCount = -1;
        for (const drv of driversData) {
          const count = countMap.get(drv.driverId) || 0;
          if (count > maxCount) {
            maxCount = count;
            topDriver = drv;
          }
        }

        setSelectedDriver(topDriver);
        setDriverIdInput(topDriver.driverId);
      }
    } catch (err: any) {
      console.error(err);
      showToast('Gagal memuat data report TENKO.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Quick preset helper
  const handleSetPreset = (preset: 'ALL' | 'THIS_MONTH' | 'THIS_YEAR' | 'TODAY') => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curDay = String(now.getDate()).padStart(2, '0');

    if (preset === 'TODAY') {
      setStartDate(`${curYear}-${curMonth}-${curDay}`);
      setEndDate(`${curYear}-${curMonth}-${curDay}`);
    } else if (preset === 'THIS_MONTH') {
      setStartDate(`${curYear}-${curMonth}-01`);
      setEndDate(`${curYear}-${curMonth}-${curDay}`);
    } else if (preset === 'THIS_YEAR') {
      setStartDate(`${curYear}-01-01`);
      setEndDate(`${curYear}-${curMonth}-${curDay}`);
    } else if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Filtered driver autocomplete list
  const filteredDriverOptions = useMemo(() => {
    if (!driverIdInput.trim()) return drivers.slice(0, 15);
    const q = driverIdInput.toLowerCase().trim();
    return drivers
      .filter(
        (d) =>
          d.driverId.toLowerCase().includes(q) ||
          d.fullName.toLowerCase().includes(q) ||
          (d.driverGroupId && d.driverGroupId.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [drivers, driverIdInput]);

  const handleSelectDriverOption = (driver: Driver) => {
    setSelectedDriver(driver);
    setDriverIdInput(driver.driverId);
    setShowDriverDropdown(false);
  };

  const handleClearDriver = () => {
    setSelectedDriver(null);
    setDriverIdInput('');
    setShowDriverDropdown(true);
  };

  // Format date helper: YYYY-MM-DD -> DD/MM/YYYY
  const formatDateDMY = (dateStr?: string): string => {
    if (!dateStr) return '-';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Filtered Examinations based on all active criteria
  const filteredExaminations = useMemo(() => {
    return examinations.filter((exam) => {
      // 1. Driver Mode Filter
      if (reportMode === 'DRIVER') {
        if (!selectedDriver) return false;
        const examDrvId = (exam.driverId || '').trim().toUpperCase();
        const targetDrvId = selectedDriver.driverId.trim().toUpperCase();
        if (examDrvId !== targetDrvId) return false;
      }

      // 2. Group Mode Filter
      if (reportMode === 'GROUP') {
        if (selectedGroup !== 'ALL') {
          const examGrp = (exam.driverGroupSnapshot || '').trim().toUpperCase();
          const targetGrp = selectedGroup.trim().toUpperCase();
          if (examGrp !== targetGrp) return false;
        }
      }

      // 3. Date Range Filter (From Date - To Date)
      if (exam.examinationDate) {
        if (startDate && exam.examinationDate < startDate) return false;
        if (endDate && exam.examinationDate > endDate) return false;
      }

      // 4. Recommendation Filter
      if (selectedRecommendation !== 'ALL') {
        if (exam.recommendation !== selectedRecommendation) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort chronologically ascending for timeline reports
      return new Date(a.examinationDate).getTime() - new Date(b.examinationDate).getTime();
    });
  }, [
    examinations,
    reportMode,
    selectedDriver,
    selectedGroup,
    startDate,
    endDate,
    selectedRecommendation,
  ]);

  // Statistics calculation for the filtered results
  const reportStats = useMemo(() => {
    const total = filteredExaminations.length;
    if (total === 0) {
      return {
        total: 0,
        fitCount: 0,
        fitPercentage: 0,
        passedCount: 0,
        avgSys: 0,
        avgDia: 0,
        avgRest: 0,
      };
    }

    let fit = 0;
    let passed = 0;
    let totalSys = 0;
    let totalDia = 0;
    let totalRest = 0;

    filteredExaminations.forEach((e) => {
      if (e.recommendation === 'FIT TO WORK') fit++;
      if (e.summary === 'PASSED') passed++;
      totalSys += Number(e.bloodPressureSystolic) || 120;
      totalDia += Number(e.bloodPressureDiastolic) || 80;
      totalRest += Number(e.offDutySleepDuration) || 0;
    });

    return {
      total,
      fitCount: fit,
      fitPercentage: Math.round((fit / total) * 100),
      passedCount: passed,
      avgSys: Math.round(totalSys / total),
      avgDia: Math.round(totalDia / total),
      avgRest: (totalRest / total).toFixed(1),
    };
  }, [filteredExaminations]);

  // Export to Excel exactly matching the uploaded template layout
  const handleExportExcel = () => {
    if (filteredExaminations.length === 0) {
      showToast('Tidak ada data pemeriksaan untuk diekspor.', 'error');
      return;
    }

    const driverIdText =
      reportMode === 'DRIVER' ? (selectedDriver?.driverId || '-') : 'ALL DRIVERS';
    const driverNameText =
      reportMode === 'DRIVER'
        ? (selectedDriver?.fullName || '-')
        : `SEMUA DRIVER (${reportMode === 'GROUP' ? selectedGroup : 'ALL'})`;
    const driverGroupText =
      reportMode === 'DRIVER'
        ? (selectedDriver?.driverGroupId || '---')
        : (selectedGroup !== 'ALL' ? selectedGroup : 'ALL GROUPS');

    const periodText =
      startDate && endDate
        ? `${formatDateDMY(startDate)} s/d ${formatDateDMY(endDate)}`
        : startDate
        ? `Sejak ${formatDateDMY(startDate)}`
        : endDate
        ? `Sampai ${formatDateDMY(endDate)}`
        : 'Semua Periode';

    // Build 2D array representation matching the screenshot
    const sheetData: any[][] = [
      ['Result Tenko Assessment', '', '', '', '', '', '', '', '', ''],
      ['Operator & Partner Control Section', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
      ['No. ID', driverIdText, '', '', '', '', '', 'Periode :', periodText],
      ['Name', driverNameText, '', '', '', '', '', 'Rekomendasi :', selectedRecommendation],
      ['Group', driverGroupText, '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
      ['Tenko Assessment Result :', '', '', '', '', '', '', '', '', ''],
      [
        'Date',
        'Inspection Item',
        '',
        '',
        '',
        '',
        '',
        'Summary',
        'Recommendation',
        'Inspector',
      ],
      [
        '',
        'Rest DWH',
        'Rest Of Duty',
        'Blood Pressure',
        'Alcohol Test',
        'Temperature',
        'Balance Test',
        '',
        '',
        '',
      ],
    ];

    // Append examination rows
    filteredExaminations.forEach((exam) => {
      const dateFormatted = formatDateDMY(exam.examinationDate);
      const restDwh = exam.dailyNonWorkingHours || '> 11 HOURS';
      const restOfDuty = exam.offDutySleepDuration ?? 6;
      const bp = exam.bloodPressureResult || `${exam.bloodPressureSystolic} / ${exam.bloodPressureDiastolic} mmHg`;
      const alcohol = exam.alcoholTest || 'NEGATIVE';
      const temp = exam.temperature ?? 36.5;
      const balance = exam.balanceTest || 'NORMAL';
      const summary = exam.summary || 'PASSED';
      const recommendation = exam.recommendation || 'FIT TO WORK';
      const inspector = exam.examinerName || 'Inspector';

      sheetData.push([
        dateFormatted,
        restDwh,
        restOfDuty,
        bp,
        alcohol,
        temp,
        balance,
        summary,
        recommendation,
        inspector,
      ]);
    });

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set merged cells for title & headers
    ws['!merges'] = [
      // Inspection Item header span (columns 1 to 6)
      { s: { r: 8, c: 1 }, e: { r: 8, c: 6 } },
      // Date row span
      { s: { r: 8, c: 0 }, e: { r: 9, c: 0 } },
      // Summary row span
      { s: { r: 8, c: 7 }, e: { r: 9, c: 7 } },
      // Recommendation row span
      { s: { r: 8, c: 8 }, e: { r: 9, c: 8 } },
      // Inspector row span
      { s: { r: 8, c: 9 }, e: { r: 9, c: 9 } },
    ];

    // Column widths
    ws['!cols'] = [
      { wch: 14 }, // Date
      { wch: 16 }, // Rest DWH
      { wch: 14 }, // Rest Of Duty
      { wch: 18 }, // Blood Pressure
      { wch: 15 }, // Alcohol Test
      { wch: 14 }, // Temperature
      { wch: 15 }, // Balance Test
      { wch: 14 }, // Summary
      { wch: 22 }, // Recommendation
      { wch: 18 }, // Inspector
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tenko_Assessment_Result');

    const fileName =
      reportMode === 'DRIVER' && selectedDriver
        ? `Result_Tenko_Assessment_${selectedDriver.driverId}_${startDate || 'All'}_sd_${endDate || 'All'}.xlsx`
        : `Result_Tenko_Assessment_${reportMode}_${startDate || 'All'}_sd_${endDate || 'All'}.xlsx`;

    XLSX.writeFile(wb, fileName);
    showToast('Laporan Result Tenko Assessment berhasil diekspor ke Excel.', 'success');
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  return (
    <div id="assessment-report-page" className="space-y-6">
      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-2 bg-slate-100/90 p-1.5 rounded-2xl w-fit border border-slate-200">
        <button
          type="button"
          onClick={() => setReportMode('DRIVER')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            reportMode === 'DRIVER'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Per Supir / Kenek (Individual)</span>
        </button>

        <button
          type="button"
          onClick={() => setReportMode('GROUP')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            reportMode === 'GROUP'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Per Grup Armada</span>
        </button>

        <button
          type="button"
          onClick={() => setReportMode('ALL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            reportMode === 'ALL'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Semua Driver (Per Periode)</span>
        </button>
      </div>

      {/* Main Filter & Assessment Header Form */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Single Main Header Banner */}
        <div className="bg-linear-to-r from-slate-900 via-blue-950 to-indigo-950 p-5 sm:p-6 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Assessment Report
            </h1>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-2xl text-xs backdrop-blur-xs border border-white/15 transition cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-2xl text-xs backdrop-blur-xs border border-white/20 shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-950/40 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Filter Bar Grid */}
        <div className="p-6 bg-slate-50/70 border-b border-slate-200 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Left Column: Driver Information / Selector (7 Cols) */}
            <div className="md:col-span-7 space-y-3.5">
              {reportMode === 'DRIVER' ? (
                <>
                  {/* Row 1: No. ID Driver */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <label className="text-xs font-bold text-slate-800 w-20 shrink-0">
                      No. ID
                    </label>
                    <div ref={driverInputContainerRef} className="relative flex-1">
                      <div className="flex items-center">
                        <input
                          type="text"
                          placeholder="Masukkan No. ID Driver / NIK..."
                          value={driverIdInput}
                          onChange={(e) => {
                            setDriverIdInput(e.target.value);
                            setShowDriverDropdown(true);
                            // Also try exact match
                            const found = drivers.find(
                              (d) =>
                                d.driverId.toUpperCase() === e.target.value.trim().toUpperCase()
                            );
                            if (found) setSelectedDriver(found);
                          }}
                          onFocus={() => setShowDriverDropdown(true)}
                          className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
                        />
                        {driverIdInput && (
                          <button
                            type="button"
                            onClick={handleClearDriver}
                            className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Helper Tag */}
                      <span className="text-[11px] italic font-semibold text-rose-600 ml-1 mt-1 block">
                        &lt;&lt;&lt; silahkan masukan No. ID Driver
                      </span>

                      {/* Driver Autocomplete Popup */}
                      {showDriverDropdown && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                          {filteredDriverOptions.length === 0 ? (
                            <div className="p-3 text-xs text-slate-500 text-center">
                              Tidak ada driver dengan ID / Nama tersebut
                            </div>
                          ) : (
                            filteredDriverOptions.map((d) => (
                              <button
                                key={d.driverId}
                                type="button"
                                onClick={() => handleSelectDriverOption(d)}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 flex items-center justify-between text-xs transition"
                              >
                                <div>
                                  <span className="font-mono font-bold text-blue-700">
                                    {d.driverId}
                                  </span>
                                  <span className="mx-2 text-slate-300">|</span>
                                  <span className="font-semibold text-slate-800">
                                    {d.fullName}
                                  </span>
                                </div>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                                  {d.driverGroupId || 'REGULER'}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Name */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <label className="text-xs font-bold text-slate-800 w-20 shrink-0">
                      Name
                    </label>
                    <div className="flex-1 px-3.5 py-2 bg-slate-100/90 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 uppercase">
                      {selectedDriver ? selectedDriver.fullName : '--- (PILIH NO. ID DRIVER) ---'}
                    </div>
                  </div>

                  {/* Row 3: Group */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <label className="text-xs font-bold text-slate-800 w-20 shrink-0">
                      Group
                    </label>
                    <div className="flex-1 px-3.5 py-2 bg-slate-100/90 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
                      {selectedDriver?.driverGroupId || '---'}
                    </div>
                  </div>
                </>
              ) : reportMode === 'GROUP' ? (
                /* Group Mode Selection */
                <div className="space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <label className="text-xs font-bold text-slate-800 w-20 shrink-0">
                      Group Armada
                    </label>
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
                    >
                      <option value="ALL">Semua Group Armada ({driverGroups.length})</option>
                      {driverGroups.map((g) => (
                        <option key={g.groupId} value={g.groupName || g.groupId}>
                          {g.groupName || g.groupId}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="p-3 bg-blue-50/60 rounded-xl text-xs text-blue-900 border border-blue-200">
                    Menampilkan seluruh pemeriksaan TENKO dari armada dalam group{' '}
                    <strong>{selectedGroup === 'ALL' ? 'Semua Group' : selectedGroup}</strong>.
                  </div>
                </div>
              ) : (
                /* All Drivers Mode */
                <div className="p-3 bg-indigo-50/60 rounded-xl text-xs text-indigo-900 border border-indigo-200">
                  Mode <strong>Semua Driver (Per Periode)</strong>: Menampilkan rekapitulasi penilaian TENKO seluruh driver & kenek logistik.
                </div>
              )}
            </div>

            {/* Right Column: Date Range (From - To) & Recommendation Filter (5 Cols) */}
            <div className="md:col-span-5 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              {/* Date Range: From - To */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Periode Tanggal (From - To) :
                  </label>
                  {/* Presets */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSetPreset('TODAY')}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 font-semibold"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPreset('THIS_MONTH')}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 font-semibold"
                    >
                      Bulan Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPreset('THIS_YEAR')}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 font-semibold"
                    >
                      Tahun Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPreset('ALL')}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 font-semibold"
                    >
                      Semua
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                      Dari Tanggal (From)
                    </span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                      Sampai Tanggal (To)
                    </span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Filter by Recommendation */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Status Rekomendasi :
                </label>
                <select
                  value={selectedRecommendation}
                  onChange={(e) => setSelectedRecommendation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="ALL">Semua Rekomendasi</option>
                  <option value="FIT TO WORK">FIT TO WORK</option>
                  <option value="FIT TO WORK WITH NOTE">FIT TO WORK WITH NOTE</option>
                  <option value="UNFIT TO WORK">UNFIT TO WORK</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section Title */}
        <div className="px-6 py-3 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Tenko Assessment Result :
          </span>
          <span className="text-xs font-semibold text-slate-500">
            {filteredExaminations.length} Data Penilaian Terpilih
          </span>
        </div>

        {/* Assessment Result Table (Formatted to match the user's uploaded image exactly) */}
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs text-slate-700 border-collapse">
            {/* Table Header with Nested "Inspection Item" Structure */}
            <thead>
              {/* Row 1 of Table Header: Deep Blue Header Background */}
              <tr className="bg-[#12427a] text-white text-[11px] font-bold border-b border-blue-900">
                <th
                  rowSpan={2}
                  className="px-3.5 py-3 border-r border-blue-800/60 text-center w-24 sticky left-0 bg-[#12427a]"
                >
                  Date
                </th>
                {reportMode !== 'DRIVER' && (
                  <th
                    rowSpan={2}
                    className="px-3.5 py-3 border-r border-blue-800/60 text-left min-w-[160px]"
                  >
                    Driver / Kenek
                  </th>
                )}
                {/* Spanning Header: Inspection Item */}
                <th
                  colSpan={6}
                  className="px-4 py-2 border-r border-blue-800/60 text-center uppercase tracking-wider bg-[#0f3663]"
                >
                  Inspection Item
                </th>
                <th
                  rowSpan={2}
                  className="px-3.5 py-3 border-r border-blue-800/60 text-center min-w-[100px]"
                >
                  Summary
                </th>
                <th
                  rowSpan={2}
                  className="px-3.5 py-3 border-r border-blue-800/60 text-center min-w-[140px]"
                >
                  Recommendation
                </th>
                <th
                  rowSpan={2}
                  className="px-3.5 py-3 text-center min-w-[120px]"
                >
                  Inspector
                </th>
              </tr>

              {/* Row 2 of Table Header: Sub-columns under Inspection Item */}
              <tr className="bg-[#184e8f] text-white text-[10px] font-bold border-b border-slate-300 uppercase">
                <th className="px-3 py-2 border-r border-blue-700/60">Rest DWH</th>
                <th className="px-3 py-2 border-r border-blue-700/60">Rest Of Duty</th>
                <th className="px-3 py-2 border-r border-blue-700/60">Blood Pressure</th>
                <th className="px-3 py-2 border-r border-blue-700/60">Alcohol Test</th>
                <th className="px-3 py-2 border-r border-blue-700/60">Temperature</th>
                <th className="px-3 py-2 border-r border-blue-700/60">Balance Test</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat hasil asesmen TENKO...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredExaminations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <FileText className="w-10 h-10 text-slate-300" />
                      <p className="font-bold text-slate-700 text-sm">
                        Tidak ada data penilaian TENKO
                      </p>
                      <p className="text-xs text-slate-400">
                        Pastikan No. ID Driver dan filter periode (Tahun & Bulan) sudah sesuai.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExaminations.map((exam, idx) => {
                  const dateStr = formatDateDMY(exam.examinationDate);
                  const isPassed = exam.summary === 'PASSED';
                  const isFit = exam.recommendation === 'FIT TO WORK';
                  const isFitNote = exam.recommendation === 'FIT TO WORK WITH NOTE';
                  const isUnfit = exam.recommendation === 'UNFIT TO WORK';

                  return (
                    <tr
                      key={exam.tenkoId || idx}
                      onClick={() => onSelectExamination && onSelectExamination(exam)}
                      className="hover:bg-blue-50/40 transition cursor-pointer"
                    >
                      {/* Date */}
                      <td className="px-3.5 py-3 border-r border-slate-200 font-mono text-slate-900 font-medium sticky left-0 bg-white hover:bg-blue-50/40">
                        {dateStr}
                      </td>

                      {/* Driver Name & ID (in Group/All mode) */}
                      {reportMode !== 'DRIVER' && (
                        <td className="px-3.5 py-3 border-r border-slate-200 text-left">
                          <div className="font-bold text-slate-900">
                            {exam.driverNameSnapshot}
                          </div>
                          <div className="font-mono text-[10px] text-blue-700 font-semibold">
                            {exam.driverId}
                          </div>
                        </td>
                      )}

                      {/* Rest DWH */}
                      <td className="px-3 py-3 border-r border-slate-200 font-mono font-medium text-slate-800">
                        {exam.dailyNonWorkingHours || '> 11 HOURS'}
                      </td>

                      {/* Rest Of Duty */}
                      <td className="px-3 py-3 border-r border-slate-200 font-mono font-bold text-slate-900">
                        {exam.offDutySleepDuration ?? 6}
                      </td>

                      {/* Blood Pressure */}
                      <td className="px-3 py-3 border-r border-slate-200 font-mono font-semibold text-slate-900">
                        {exam.bloodPressureResult ||
                          `${exam.bloodPressureSystolic} / ${exam.bloodPressureDiastolic} mmHg`}
                      </td>

                      {/* Alcohol Test */}
                      <td className="px-3 py-3 border-r border-slate-200 font-mono font-bold text-slate-800">
                        <span
                          className={
                            exam.alcoholTest === 'POSITIVE'
                              ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded'
                              : 'text-slate-800'
                          }
                        >
                          {exam.alcoholTest || 'NEGATIVE'}
                        </span>
                      </td>

                      {/* Temperature */}
                      <td className="px-3 py-3 border-r border-slate-200 font-mono text-slate-800">
                        {exam.temperature ? exam.temperature.toFixed(1) : '36.5'}
                      </td>

                      {/* Balance Test */}
                      <td className="px-3 py-3 border-r border-slate-200 font-mono font-medium text-slate-800">
                        <span
                          className={
                            exam.balanceTest === 'ABNORMAL'
                              ? 'text-rose-600 font-bold'
                              : 'text-slate-800'
                          }
                        >
                          {exam.balanceTest || 'NORMAL'}
                        </span>
                      </td>

                      {/* Summary */}
                      <td className="px-3.5 py-3 border-r border-slate-200 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-black ${
                            isPassed
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {exam.summary || 'PASSED'}
                        </span>
                      </td>

                      {/* Recommendation */}
                      <td className="px-3.5 py-3 border-r border-slate-200 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-black tracking-tight ${
                            isFit
                              ? 'bg-emerald-100 text-emerald-800'
                              : isFitNote
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {exam.recommendation || 'FIT TO WORK'}
                        </span>
                      </td>

                      {/* Inspector */}
                      <td className="px-3.5 py-3 font-semibold text-slate-800">
                        {exam.examinerName || 'Inspector'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary / Disclaimer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Standar Evaluasi TENKO: <strong>K3 Logistik & Transport Safety Policy</strong>
          </span>
          <span>
            Total Record: <strong>{filteredExaminations.length} asesmen</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
