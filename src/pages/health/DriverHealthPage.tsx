import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { DriverHealthRecord, HealthIndication, VitaminItem, HealthCaseStatus } from '../../types';
import {
  getDriverHealthRecords,
  createDriverHealthRecord,
  updateDriverHealthRecord,
  solveDriverHealthRecord,
  getHealthIndications,
  getVitamins,
} from '../../services/healthService';
import { getDrivers } from '../../services/driverService';
import { Driver } from '../../types';
import {
  HeartPulse,
  Search,
  Filter,
  Download,
  Plus,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Pill,
  X,
  Loader2,
  Eye,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface DriverHealthPageProps {
  onNavigateToTenko?: () => void;
}

export const DriverHealthPage: React.FC<DriverHealthPageProps> = ({ onNavigateToTenko }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [records, setRecords] = useState<DriverHealthRecord[]>([]);
  const [indications, setIndications] = useState<HealthIndication[]>([]);
  const [vitamins, setVitamins] = useState<VitaminItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'SOLVED'>('ALL');
  const [filterIndication, setFilterIndication] = useState<string>('ALL');

  // Modal State: View / Follow-up / Solve
  const [selectedRecord, setSelectedRecord] = useState<DriverHealthRecord | null>(null);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [evalText, setEvalText] = useState('');
  const [evalStatus, setEvalStatus] = useState<HealthCaseStatus>('ACTIVE');
  const [savingEvaluation, setSavingEvaluation] = useState(false);

  // Modal State: Create New Record
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDriverId, setCreateDriverId] = useState('');
  const [createDriverObj, setCreateDriverObj] = useState<Driver | null>(null);
  const [createIndication, setCreateIndication] = useState('');
  const [createAnalyze, setCreateAnalyze] = useState('');
  const [createMeasurement, setCreateMeasurement] = useState('');
  const [selectedVitamins, setSelectedVitamins] = useState<{ vitaminId: string; name: string; quantity: number; unit: string }[]>([]);
  const [createTenkoResult, setCreateTenkoResult] = useState<'FIT TO WORK' | 'FIT TO WORK WITH NOTE' | 'UNFIT TO WORK'>('FIT TO WORK WITH NOTE');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [recData, indData, vitData, drvData] = await Promise.all([
        getDriverHealthRecords(),
        getHealthIndications(),
        getVitamins(),
        getDrivers(),
      ]);
      setRecords(recData);
      setIndications(indData.filter((i) => i.status === 'ACTIVE'));
      setVitamins(vitData.filter((v) => v.status === 'ACTIVE'));
      setDrivers(drvData);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data Driver Health.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const query = searchQuery.toLowerCase();
      const matchSearch =
        rec.recordId.toLowerCase().includes(query) ||
        rec.driverId.toLowerCase().includes(query) ||
        rec.driverName.toLowerCase().includes(query) ||
        (rec.driverGroup || '').toLowerCase().includes(query) ||
        (rec.indication || '').toLowerCase().includes(query) ||
        (rec.analyze || '').toLowerCase().includes(query) ||
        (rec.measurement || '').toLowerCase().includes(query) ||
        (rec.vitamin || '').toLowerCase().includes(query) ||
        (rec.evaluation || '').toLowerCase().includes(query);

      const matchStatus = filterStatus === 'ALL' || rec.status === filterStatus;
      const matchIndication = filterIndication === 'ALL' || rec.indication === filterIndication;

      return matchSearch && matchStatus && matchIndication;
    });
  }, [records, searchQuery, filterStatus, filterIndication]);

  const activeCount = useMemo(() => records.filter((r) => r.status === 'ACTIVE').length, [records]);
  const solvedCount = useMemo(() => records.filter((r) => r.status === 'SOLVED').length, [records]);

  // Open Evaluation Modal
  const openEvaluationModal = (rec: DriverHealthRecord) => {
    setSelectedRecord(rec);
    setEvalText(rec.evaluation || '');
    setEvalStatus(rec.status);
    setIsEvaluationModalOpen(true);
  };

  const handleSaveEvaluation = async () => {
    if (!selectedRecord) return;
    setSavingEvaluation(true);
    try {
      const isMarkingSolved = evalStatus === 'SOLVED';
      const docId = selectedRecord.recordDocumentId || selectedRecord.recordId;

      if (isMarkingSolved) {
        await solveDriverHealthRecord(
          docId,
          evalText,
          selectedRecord.tenkoId,
          {
            userId: currentUser?.userId || 'SYS',
            fullName: currentUser?.fullName || 'Nakes',
          }
        );
        showToast(`Kasus kesehatan ${selectedRecord.driverName} dinyatakan SOLVED (Selesai).`, 'success');
      } else {
        await updateDriverHealthRecord(
          docId,
          {
            evaluation: evalText.trim(),
            status: 'ACTIVE',
          },
          {
            userId: currentUser?.userId || 'SYS',
            fullName: currentUser?.fullName || 'Nakes',
          }
        );
        showToast('Catatan evaluasi perkembangan kesehatan berhasil diperbarui.', 'success');
      }

      setIsEvaluationModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan evaluasi.', 'error');
    } finally {
      setSavingEvaluation(false);
    }
  };

  // Create Direct Health Record
  const openCreateModal = () => {
    setCreateDriverId('');
    setCreateDriverObj(null);
    setCreateIndication(indications[0]?.name || '');
    setCreateAnalyze('');
    setCreateMeasurement('');
    setSelectedVitamins([]);
    setCreateTenkoResult('FIT TO WORK WITH NOTE');
    setIsCreateModalOpen(true);
  };

  const handleSelectDriver = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const drvId = e.target.value;
    setCreateDriverId(drvId);
    const found = drivers.find((d) => d.driverId === drvId);
    setCreateDriverObj(found || null);
  };

  const toggleVitaminSelection = (v: VitaminItem) => {
    const exists = selectedVitamins.find((item) => item.vitaminId === v.vitaminId);
    if (exists) {
      setSelectedVitamins(selectedVitamins.filter((item) => item.vitaminId !== v.vitaminId));
    } else {
      setSelectedVitamins([
        ...selectedVitamins,
        { vitaminId: v.vitaminId, name: v.name, quantity: 1, unit: v.dosageUnit },
      ]);
    }
  };

  const updateVitaminQty = (vId: string, qty: number) => {
    if (qty < 1) return;
    setSelectedVitamins(
      selectedVitamins.map((item) => (item.vitaminId === vId ? { ...item, quantity: qty } : item))
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createDriverObj) {
      showToast('Pilih driver / kenek terlebih dahulu.', 'error');
      return;
    }
    if (!createIndication) {
      showToast('Pilih indikasi keluhan kesehatan.', 'error');
      return;
    }

    setCreateSubmitting(true);
    try {
      const vitaminSummary = selectedVitamins
        .map((v) => `${v.name} (${v.quantity} ${v.unit})`)
        .join(', ') || '-';

      await createDriverHealthRecord(
        {
          examinationDate: new Date().toISOString().slice(0, 10),
          driverId: createDriverObj.driverId,
          driverName: createDriverObj.fullName,
          driverGroup: createDriverObj.driverGroupId,
          position: createDriverObj.position,
          tenkoResult: createTenkoResult,
          indication: createIndication,
          analyze: createAnalyze.trim() || 'Pemeriksaan keluhan kesehatan rutin oleh nakes.',
          measurement: createMeasurement.trim() || 'Pemberian vitamin dan edukasi istirahat cukup.',
          vitamin: vitaminSummary,
          vitaminDetails: selectedVitamins,
          status: 'ACTIVE',
        },
        {
          userId: currentUser?.userId || 'SYS',
          fullName: currentUser?.fullName || 'Nakes',
        }
      );

      showToast('Pencatatan Driver Health berhasil ditambahkan.', 'success');
      setIsCreateModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat catatan Driver Health.', 'error');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      showToast('Tidak ada data untuk diekspor.', 'warning');
      return;
    }

    const headers = [
      'NO',
      'ID DATA',
      'ID DRIVER',
      'NAMA DRIVER / KENEK',
      'GROUP',
      'RESULT TENKO',
      'INDICATION',
      'ANALYZE',
      'MEASUREMENT',
      'VITAMIN',
      'EVALUATION',
      'STATUS',
      'TANGGAL',
      'NAKES',
    ];

    const rows = filteredRecords.map((r, i) => [
      i + 1,
      r.recordId,
      r.driverId,
      `"${r.driverName.replace(/"/g, '""')}"`,
      `"${(r.driverGroup || '').replace(/"/g, '""')}"`,
      r.tenkoResult,
      `"${(r.indication || '').replace(/"/g, '""')}"`,
      `"${(r.analyze || '').replace(/"/g, '""')}"`,
      `"${(r.measurement || '').replace(/"/g, '""')}"`,
      `"${(r.vitamin || '').replace(/"/g, '""')}"`,
      `"${(r.evaluation || '').replace(/"/g, '""')}"`,
      r.status,
      r.examinationDate,
      `"${(r.examinerName || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver-health-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File CSV berhasil diunduh.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20 shrink-0">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Driver Health Monitoring</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                Kesehatan Driver
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Pencatatan keluhan klinis nakes, analisa, tindakan, pemberian vitamin, serta pemantauan evaluasi harian berkelanjutan hingga driver pulih total (*Solved*).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            id="btn-export-health-csv"
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Ekspor CSV</span>
          </button>

          <button
            id="btn-add-driver-health"
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Keluhan Medis</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterStatus('ALL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'ALL'
              ? 'bg-blue-50/70 border-blue-200 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Kasus Tercatat</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              <HeartPulse className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{records.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Semua riwayat keluhan kesehatan driver</p>
        </div>

        <div
          onClick={() => setFilterStatus('ACTIVE')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'ACTIVE'
              ? 'bg-amber-50/70 border-amber-200 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700">Kasus Aktif (Pemantauan)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">{activeCount}</div>
          <p className="text-[11px] text-amber-600/80 mt-0.5">Memerlukan evaluasi pada TENKO berikutnya</p>
        </div>

        <div
          onClick={() => setFilterStatus('SOLVED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'SOLVED'
              ? 'bg-emerald-50/70 border-emerald-200 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">Kasus Selesai (Solved)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">{solvedCount}</div>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">Driver telah pulih & fit bertugas normal</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-health"
            type="text"
            placeholder="Cari ID Driver, Nama, Group, Indikasi (Hipertensi, Rest Hours), atau Analisa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 transition"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Indikasi:</label>
            <select
              id="filter-indication"
              value={filterIndication}
              onChange={(e) => setFilterIndication(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
            >
              <option value="ALL">Semua Indikasi</option>
              {indications.map((ind) => (
                <option key={ind.indicationId} value={ind.name}>
                  {ind.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Status:</label>
            <select
              id="filter-status-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Active (Dalam Pemantauan)</option>
              <option value="SOLVED">Solved (Pulih)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterStatus('ALL');
              setFilterIndication('ALL');
            }}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
            title="Reset Filter"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table: User-specified format */}
      {/* NO | ID DATA | ID DRIVER | NAMA DRIVER / KENEK | GROUP | RESULT TENKO | INDICATION | ANALYZE | MEASUREMENT | VITAMIN | EVALUATION */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-rose-600" />
            <p className="text-xs font-medium">Memuat data monitoring Driver Health...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <HeartPulse className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">Tidak ada data keluhan kesehatan</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Keluhan driver yang dicatat saat pemeriksaan TENKO atau melalui tombol "Catat Keluhan Medis" akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3 text-center w-10">NO</th>
                  <th className="py-3 px-3 w-32">ID DATA</th>
                  <th className="py-3 px-3 w-28">ID DRIVER</th>
                  <th className="py-3 px-3 w-44">NAMA DRIVER / KENEK</th>
                  <th className="py-3 px-3 w-40">GROUP</th>
                  <th className="py-3 px-3 w-32 text-center">RESULT TENKO</th>
                  <th className="py-3 px-3 w-36">INDICATION</th>
                  <th className="py-3 px-3 min-w-[160px]">ANALYZE</th>
                  <th className="py-3 px-3 min-w-[160px]">MEASUREMENT</th>
                  <th className="py-3 px-3 min-w-[150px]">VITAMIN</th>
                  <th className="py-3 px-3 min-w-[180px]">EVALUATION</th>
                  <th className="py-3 px-3 text-center w-24">STATUS</th>
                  <th className="py-3 px-3 text-right w-24">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r, idx) => {
                  const isActive = r.status === 'ACTIVE';
                  return (
                    <tr
                      key={r.recordId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isActive ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* NO */}
                      <td className="py-3 px-3 text-center font-bold text-slate-400">{idx + 1}</td>

                      {/* ID DATA */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-700 text-[11px] whitespace-nowrap">
                        {r.recordId}
                      </td>

                      {/* ID DRIVER */}
                      <td className="py-3 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {r.driverId}
                      </td>

                      {/* NAMA DRIVER / KENEK */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-xs">{r.driverName}</div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">
                          {r.position}
                        </span>
                      </td>

                      {/* GROUP */}
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        <span className="line-clamp-2">{r.driverGroup || '-'}</span>
                      </td>

                      {/* RESULT TENKO */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            r.tenkoResult === 'FIT TO WORK'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.tenkoResult === 'FIT TO WORK WITH NOTE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.tenkoResult}
                        </span>
                      </td>

                      {/* INDICATION */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200/60 text-[11px]">
                          <HeartPulse className="w-3 h-3 shrink-0" />
                          {r.indication}
                        </span>
                      </td>

                      {/* ANALYZE */}
                      <td className="py-3 px-3 text-slate-700 font-medium leading-relaxed">
                        <p className="text-xs line-clamp-2">{r.analyze || '-'}</p>
                      </td>

                      {/* MEASUREMENT */}
                      <td className="py-3 px-3 text-slate-700 font-medium leading-relaxed">
                        <p className="text-xs line-clamp-2">{r.measurement || '-'}</p>
                      </td>

                      {/* VITAMIN */}
                      <td className="py-3 px-3">
                        {r.vitamin ? (
                          <div className="flex items-start gap-1 text-slate-800 font-semibold text-[11px]">
                            <Pill className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{r.vitamin}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* EVALUATION */}
                      <td className="py-3 px-3">
                        {r.evaluation ? (
                          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 text-slate-800 font-medium text-[11px] leading-relaxed">
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">
                              Evaluasi Nakes:
                            </span>
                            {r.evaluation}
                          </div>
                        ) : isActive ? (
                          <span className="text-amber-600 font-semibold italic text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            Menunggu TENKO berikutnya
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${
                            isActive
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <Clock className="w-3 h-3 shrink-0" />
                              ACTIVE
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3 shrink-0" />
                              SOLVED
                            </>
                          )}
                        </span>
                      </td>

                      {/* AKSI */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEvaluationModal(r)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isActive
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                          title="Evaluasi & Update Kasus"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{isActive ? 'Evaluasi' : 'Detail'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Evaluation & Solve */}
      {isEvaluationModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HeartPulse className="w-5 h-5 text-rose-600" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Evaluasi Perkembangan Kesehatan Driver
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {selectedRecord.recordId} • {selectedRecord.driverName} ({selectedRecord.driverId})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEvaluationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Snapshot Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Driver & Posisi</span>
                  <span className="font-bold text-slate-900">{selectedRecord.driverName}</span>
                  <span className="text-slate-500 block text-[11px]">({selectedRecord.position} - {selectedRecord.driverGroup})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Hasil TENKO Sebelumnya</span>
                  <span className="font-bold text-slate-800">{selectedRecord.tenkoResult}</span>
                  <span className="text-slate-500 block text-[11px]">Tgl: {selectedRecord.examinationDate}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Indikasi Keluhan Awal</span>
                  <span className="inline-block bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-xs mt-0.5">
                    {selectedRecord.indication}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Analisa Nakes</span>
                  <p className="text-slate-700 font-medium mt-0.5">{selectedRecord.analyze || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Measurement / Tindakan</span>
                  <p className="text-slate-700 font-medium mt-0.5">{selectedRecord.measurement || '-'}</p>
                </div>
                <div className="col-span-2 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200/70 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Vitamin Diberikan:</span>
                    <span className="font-bold text-slate-900 text-xs">{selectedRecord.vitamin || 'Tidak ada'}</span>
                  </div>
                </div>
              </div>

              {/* Evaluation Form Input */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">
                  Evaluation (Diisi ketika TENKO berikutnya / tindak lanjut) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Contoh: Keluhan pusing sudah hilang setelah istirahat dan konsumsi vitamin B kompleks, tensi normal 120/80 mmHg, driver siap melanjutkan perjalanan."
                  value={evalText}
                  onChange={(e) => setEvalText(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition resize-none"
                />
              </div>

              {/* Status Decision Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">Status Penanganan Medis</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEvalStatus('ACTIVE')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                      evalStatus === 'ACTIVE'
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${evalStatus === 'ACTIVE' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Masih Ada Keluhan (ACTIVE)</div>
                      <div className="text-[10px] text-slate-500">Perlu dipantau di TENKO hari berikutnya</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEvalStatus('SOLVED')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                      evalStatus === 'SOLVED'
                        ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${evalStatus === 'SOLVED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-emerald-900">Sudah Pulih (SOLVED)</div>
                      <div className="text-[10px] text-emerald-700">Kasus selesai & keluhan telah tertangani</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEvaluationModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={savingEvaluation}
                onClick={handleSaveEvaluation}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingEvaluation && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Simpan Evaluasi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Direct Record */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <HeartPulse className="w-5 h-5 text-rose-600" />
                <h2 className="text-sm font-bold text-slate-900">Catat Keluhan Medis Driver Baru</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Driver / Kenek <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={createDriverId}
                  onChange={handleSelectDriver}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 cursor-pointer"
                >
                  <option value="">-- Pilih Driver / Kenek Terdaftar --</option>
                  {drivers.map((d) => (
                    <option key={d.driverId} value={d.driverId}>
                      {d.driverId} - {d.fullName} ({d.position} • {d.driverGroupId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Indication (Unhealthy) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={createIndication}
                    onChange={(e) => setCreateIndication(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 cursor-pointer"
                  >
                    <option value="">-- Pilih Indikasi --</option>
                    {indications.map((ind) => (
                      <option key={ind.indicationId} value={ind.name}>
                        {ind.name} ({ind.note})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status TENKO</label>
                  <select
                    value={createTenkoResult}
                    onChange={(e) => setCreateTenkoResult(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 cursor-pointer"
                  >
                    <option value="FIT TO WORK WITH NOTE">FIT TO WORK WITH NOTE</option>
                    <option value="UNFIT TO WORK">UNFIT TO WORK</option>
                    <option value="FIT TO WORK">FIT TO WORK</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Analyze (Analisa Nakes) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Contoh: Driver mengeluh pusing dan pegal leher, tensi 145/95 mmHg..."
                  value={createAnalyze}
                  onChange={(e) => setCreateAnalyze(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Measurement (Tindakan Medis) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Contoh: Istirahat di klinik 30 menit, kompres hangat, edukasi konsumsi air..."
                  value={createMeasurement}
                  onChange={(e) => setCreateMeasurement(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 resize-none"
                />
              </div>

              {/* Vitamin Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pemberian Vitamin / Obat Nakes
                </label>
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 max-h-48 overflow-y-auto">
                  {vitamins.map((v) => {
                    const isSelected = selectedVitamins.some((item) => item.vitaminId === v.vitaminId);
                    const selectedItem = selectedVitamins.find((item) => item.vitaminId === v.vitaminId);

                    return (
                      <div
                        key={v.vitaminId}
                        className={`flex items-center justify-between p-2 rounded-lg border transition ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-white border-slate-200 hover:bg-slate-100/60'
                        }`}
                      >
                        <div
                          className="flex items-center gap-2 cursor-pointer flex-1"
                          onClick={() => toggleVitaminSelection(v)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{v.name}</span>
                            <span className="text-[10px] text-slate-500">
                              {v.category} • Satuan: {v.dosageUnit}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-500">Jumlah:</span>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={selectedItem?.quantity || 1}
                              onChange={(e) =>
                                updateVitaminQty(v.vitaminId, parseInt(e.target.value, 10) || 1)
                              }
                              className="w-14 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-center"
                            />
                            <span className="text-[10px] text-slate-500">{v.dosageUnit}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {createSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Catatan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
