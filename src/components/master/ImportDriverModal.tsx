import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Users,
  Truck,
  ArrowRight,
  Info,
} from 'lucide-react';
import { DriverImportRow, DriverImportResult, importDriversBatch } from '../../services/driverService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { Driver, DriverGroup } from '../../types';

interface ImportDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingDrivers: Driver[];
  existingGroups: DriverGroup[];
}

interface ParsedPreviewRow extends DriverImportRow {
  rowNumber: number;
  actionType: 'NEW' | 'UPDATE';
  isNewGroup: boolean;
  error?: string;
}

export const ImportDriverModal: React.FC<ImportDriverModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingDrivers,
  existingGroups,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [previewRows, setPreviewRows] = useState<ParsedPreviewRow[]>([]);
  const [parseError, setParseError] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'ALL' | 'NEW' | 'UPDATE' | 'INVALID'>('ALL');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<DriverImportResult | null>(null);

  if (!isOpen) return null;

  // Format Excel Date helper
  const formatExcelDate = (raw: any): string => {
    if (!raw) return '';
    if (raw instanceof Date) {
      return raw.toISOString().split('T')[0];
    }
    if (typeof raw === 'number') {
      // Excel serial date format
      const utcDays = Math.floor(raw - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      return dateInfo.toISOString().split('T')[0];
    }
    const str = String(raw).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        // could be MM/DD/YYYY or DD/MM/YYYY
        if (parts[2].length === 4) {
          const mOrD = parseInt(parts[0], 10);
          const dOrM = parseInt(parts[1], 10);
          const y = parts[2];
          if (mOrD > 12) {
            // DD/MM/YYYY
            return `${y}-${String(dOrM).padStart(2, '0')}-${String(mOrD).padStart(2, '0')}`;
          }
          // Default MM/DD/YYYY
          return `${y}-${String(mOrD).padStart(2, '0')}-${String(dOrM).padStart(2, '0')}`;
        }
      }
    }
    return str;
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'NO TENKO DRIVER': 1,
        'DRIVER ID': '301240143',
        'DRIVER NAME': 'ADAM',
        'DRIVER GROUP': 'ABPN1-Helper Reguler Balikpapan',
        'JOIN DATE': '11/11/2024',
        'TERMINATE DATE': '',
        'POSITION': 'DRIVER ASSISTANT',
        'CREATED DATE': '4/14/2025',
        'CREATED BY': currentUser?.fullName || 'GARINDRA',
      },
      {
        'NO TENKO DRIVER': 2,
        'DRIVER ID': '301240109',
        'DRIVER NAME': 'AHMAD DANI',
        'DRIVER GROUP': 'ABPN1-Helper Reguler Balikpapan',
        'JOIN DATE': '09/11/2024',
        'TERMINATE DATE': '',
        'POSITION': 'DRIVER ASSISTANT',
        'CREATED DATE': '4/14/2025',
        'CREATED BY': currentUser?.fullName || 'GARINDRA',
      },
      {
        'NO TENKO DRIVER': 3,
        'DRIVER ID': '301250022',
        'DRIVER NAME': 'ALFIN RANGGA SAPUTRA',
        'DRIVER GROUP': 'ABPN1-Helper Reguler Balikpapan',
        'JOIN DATE': '23/01/2025',
        'TERMINATE DATE': '',
        'POSITION': 'DRIVER ASSISTANT',
        'CREATED DATE': '4/14/2025',
        'CREATED BY': currentUser?.fullName || 'GARINDRA',
      },
      {
        'NO TENKO DRIVER': 4,
        'DRIVER ID': '301210045',
        'DRIVER NAME': 'BUDI SANTOSO',
        'DRIVER GROUP': 'Armada A - Wingbox',
        'JOIN DATE': '01/05/2023',
        'TERMINATE DATE': '',
        'POSITION': 'DRIVER',
        'CREATED DATE': '4/14/2025',
        'CREATED BY': currentUser?.fullName || 'GARINDRA',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    // Set column widths
    worksheet['!cols'] = [
      { wch: 18 }, // NO TENKO DRIVER
      { wch: 16 }, // DRIVER ID
      { wch: 28 }, // DRIVER NAME
      { wch: 34 }, // DRIVER GROUP
      { wch: 14 }, // JOIN DATE
      { wch: 16 }, // TERMINATE DATE
      { wch: 20 }, // POSITION
      { wch: 14 }, // CREATED DATE
      { wch: 18 }, // CREATED BY
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Driver');
    XLSX.writeFile(workbook, 'Template_Master_Driver_TENKO.xlsx');
    showToast('Template Excel Master Driver berhasil diunduh.', 'success');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      processFile(dropped);
    }
  };

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setParsing(true);
    setParseError('');
    setPreviewRows([]);
    setImportResult(null);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('File Excel tidak memiliki lembar kerja (worksheet).');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (rawJson.length === 0) {
        throw new Error('File Excel kosong atau tidak memiliki data.');
      }

      // Build lookups
      const existingDriverIdSet = new Set<string>();
      existingDrivers.forEach((d) => {
        if (d.driverId) existingDriverIdSet.add(d.driverId.trim().toUpperCase());
      });

      const existingGroupNameSet = new Set<string>();
      existingGroups.forEach((g) => {
        const name = g.groupName || g.driverGroupName || g.groupId;
        if (name) existingGroupNameSet.add(name.trim().toUpperCase());
      });

      const parsed: ParsedPreviewRow[] = [];

      rawJson.forEach((row, idx) => {
        // Find keys case-insensitively
        const keys = Object.keys(row);
        const getVal = (possibleKeys: string[]): any => {
          for (const pk of possibleKeys) {
            const foundKey = keys.find((k) => k.trim().toUpperCase() === pk.toUpperCase());
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
              return row[foundKey];
            }
          }
          return '';
        };

        const rawDriverNumber = getVal(['NO TENKO DRIVER', 'NO DRIVER', 'NO', 'NUMBER', 'URUT']);
        const rawDriverId = getVal(['DRIVER ID', 'ID DRIVER', 'DRIVER_ID', 'ID', 'NIK']);
        const rawDriverName = getVal(['DRIVER NAME', 'NAMA DRIVER', 'NAMA LENGKAP', 'DRIVER_NAME', 'NAME', 'NAMA']);
        const rawDriverGroup = getVal(['DRIVER GROUP', 'DRIVER_GROUP', 'GROUP', 'ARMADA', 'GRUP', 'UNIT']);
        const rawJoinDate = getVal(['JOIN DATE', 'JOIN_DATE', 'TGL GABUNG', 'TANGGAL GABUNG', 'TGL MASUK']);
        const rawTerminateDate = getVal(['TERMINATE DATE', 'TERMINATE_DATE', 'TGL BERHENTI', 'TANGGAL KELUAR', 'TGL KELUAR']);
        const rawPosition = getVal(['POSITION', 'POSISI', 'JABATAN', 'ROLE']);
        const rawCreatedDate = getVal(['CREATED DATE', 'CREATED_DATE', 'TGL DIBUAT']);
        const rawCreatedBy = getVal(['CREATED BY', 'CREATED_BY', 'DIBUAT OLEH']);

        const cleanDriverId = String(rawDriverId).trim().toUpperCase();
        const cleanName = String(rawDriverName).trim();
        const cleanGroup = String(rawDriverGroup).trim().toUpperCase() || 'TETAP';
        const cleanPositionRaw = String(rawPosition).trim().toUpperCase();

        // Position mapping
        let mappedPosition: 'DRIVER' | 'KENEK' = 'DRIVER';
        if (
          cleanPositionRaw.includes('ASSISTANT') ||
          cleanPositionRaw.includes('HELPER') ||
          cleanPositionRaw.includes('KENEK') ||
          cleanDriverId.startsWith('KNK')
        ) {
          mappedPosition = 'KENEK';
        } else {
          mappedPosition = 'DRIVER';
        }

        // Status mapping based on Terminate Date
        const parsedTerminate = formatExcelDate(rawTerminateDate);
        const parsedJoin = formatExcelDate(rawJoinDate);
        const mappedStatus: 'ACTIVE' | 'INACTIVE' = parsedTerminate ? 'INACTIVE' : 'ACTIVE';

        // Error checking
        let error: string | undefined = undefined;
        if (!cleanDriverId) {
          error = 'Driver ID kosong';
        } else if (!cleanName) {
          error = 'Nama Driver kosong';
        }

        const isExisting = cleanDriverId ? existingDriverIdSet.has(cleanDriverId) : false;
        const isNewGrp = cleanGroup ? !existingGroupNameSet.has(cleanGroup) : false;

        parsed.push({
          rowNumber: idx + 1,
          driverNumber: rawDriverNumber || idx + 1,
          driverId: cleanDriverId,
          fullName: cleanName,
          driverGroupId: cleanGroup,
          position: mappedPosition,
          joinDate: parsedJoin || new Date().toISOString().split('T')[0],
          terminateDate: parsedTerminate,
          status: mappedStatus,
          createdAt: formatExcelDate(rawCreatedDate) || new Date().toISOString(),
          createdBy: String(rawCreatedBy).trim() || currentUser?.fullName || 'Import Excel',
          actionType: isExisting ? 'UPDATE' : 'NEW',
          isNewGroup: isNewGrp,
          error,
        });
      });

      setPreviewRows(parsed);
      showToast(`Berhasil membaca ${parsed.length} baris data dari file.`, 'success');
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || 'Gagal memproses file Excel.');
      showToast('Gagal memproses file Excel.', 'error');
    } finally {
      setParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    const validRows = previewRows.filter((r) => !r.error);
    if (validRows.length === 0) {
      showToast('Tidak ada baris valid untuk diimpor.', 'error');
      return;
    }

    setImporting(true);
    try {
      const userPayload = {
        userId: currentUser?.userId || 'SYS_USER',
        fullName: currentUser?.fullName || 'Super Admin',
      };

      const result = await importDriversBatch(validRows, userPayload);
      setImportResult(result);
      showToast(
        `Import selesai! ${result.importedCount} driver baru ditambahkan, ${result.updatedCount} driver diperbarui.`,
        'success'
      );
      onSuccess();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Terjadi kesalahan saat mengimpor data.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const counts = {
    total: previewRows.length,
    newDrivers: previewRows.filter((r) => !r.error && r.actionType === 'NEW').length,
    updateDrivers: previewRows.filter((r) => !r.error && r.actionType === 'UPDATE').length,
    newGroups: Array.from(new Set(previewRows.filter((r) => r.isNewGroup && !r.error).map((r) => r.driverGroupId))).length,
    invalid: previewRows.filter((r) => !!r.error).length,
  };

  const filteredPreview = previewRows.filter((r) => {
    if (activeTab === 'NEW') return !r.error && r.actionType === 'NEW';
    if (activeTab === 'UPDATE') return !r.error && r.actionType === 'UPDATE';
    if (activeTab === 'INVALID') return !!r.error;
    return true;
  });

  return (
    <div
      id="import-driver-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base md:text-lg">Import Master Driver & Kenek via Excel</h3>
              <p className="text-xs text-slate-500">
                Unggah spreadsheet untuk memigrasikan data pengemudi dan kenek secara massal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
              title="Unduh Format Excel Standar"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Format Template (.xlsx)</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* SUCCESS RESULT SCREEN */}
          {importResult ? (
            <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-black text-emerald-950">Proses Import Berhasil!</h4>
                <p className="text-xs text-emerald-700 mt-1">Data master driver dan group armada telah tersimpan di sistem.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto pt-2">
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Total Baris</p>
                  <p className="text-xl font-black text-slate-900">{importResult.totalProcessed}</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Driver Baru</p>
                  <p className="text-xl font-black text-blue-600">+{importResult.importedCount}</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Driver Diperbarui</p>
                  <p className="text-xl font-black text-amber-600">{importResult.updatedCount}</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Group Otomatis Dibuat</p>
                  <p className="text-xl font-black text-emerald-600">+{importResult.createdGroupsCount}</p>
                </div>
              </div>

              {importResult.createdGroups.length > 0 && (
                <div className="p-3 bg-white rounded-2xl border border-emerald-200 text-xs text-left max-w-2xl mx-auto">
                  <span className="font-bold text-slate-800 block mb-1">Group Baru yang Otomatis Didaftarkan:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {importResult.createdGroups.map((grp, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        {grp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  Selesai & Tutup
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* UPLOAD DROPZONE */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition ${
                  file
                    ? 'bg-blue-50/50 border-blue-300'
                    : 'bg-slate-50/60 hover:bg-slate-50 border-slate-300 hover:border-blue-400'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 rounded-2xl bg-white shadow-xs text-blue-600 border border-slate-200">
                    <UploadCloud className="w-6 h-6" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {file ? file.name : 'Tarik & Letakkan file spreadsheet di sini, atau klik untuk memilih'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Mendukung format file <strong>.xlsx</strong>, <strong>.xls</strong>, dan <strong>.csv</strong>
                    </p>
                  </div>

                  {file && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mt-2">
                      <span>{(file.size / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span>Klik untuk ganti file</span>
                    </div>
                  )}
                </div>
              </div>

              {parseError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <p className="font-bold">Gagal membaca file</p>
                    <p className="mt-0.5">{parseError}</p>
                  </div>
                </div>
              )}

              {/* STATS SUMMARY & TAB FILTER */}
              {previewRows.length > 0 && (
                <div className="space-y-3">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Total Baris</span>
                      <p className="text-lg font-black text-slate-900">{counts.total}</p>
                    </div>
                    <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200">
                      <span className="text-[10px] font-bold text-blue-600 uppercase">Driver Baru (Insert)</span>
                      <p className="text-lg font-black text-blue-700">+{counts.newDrivers}</p>
                    </div>
                    <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200">
                      <span className="text-[10px] font-bold text-amber-600 uppercase">Driver Update</span>
                      <p className="text-lg font-black text-amber-700">{counts.updateDrivers}</p>
                    </div>
                    <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">Group Baru (Auto)</span>
                      <p className="text-lg font-black text-emerald-700">+{counts.newGroups}</p>
                    </div>
                  </div>

                  {counts.newGroups > 0 && (
                    <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
                      <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Auto-Create Driver Group: </span>
                        Sistem mendeteksi <strong>{counts.newGroups} Driver Group baru</strong> dari file. Group ini akan otomatis didaftarkan ke Master Driver Group tanpa perlu input manual.
                      </div>
                    </div>
                  )}

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('ALL')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                        activeTab === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Semua Data ({counts.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('NEW')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                        activeTab === 'NEW'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      Driver Baru ({counts.newDrivers})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('UPDATE')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                        activeTab === 'UPDATE'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      Update ({counts.updateDrivers})
                    </button>
                    {counts.invalid > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('INVALID')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                          activeTab === 'INVALID'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        Tidak Valid ({counts.invalid})
                      </button>
                    )}
                  </div>

                  {/* Preview Table */}
                  <div className="rounded-2xl border border-slate-200 overflow-x-auto max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">No</th>
                          <th className="py-2.5 px-3">Driver ID</th>
                          <th className="py-2.5 px-3">Nama Lengkap</th>
                          <th className="py-2.5 px-3">Posisi</th>
                          <th className="py-2.5 px-3">Driver Group</th>
                          <th className="py-2.5 px-3">Join Date</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredPreview.map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3 text-slate-400 font-mono">{row.driverNumber || row.rowNumber}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{row.driverId || '-'}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{row.fullName || '-'}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row.position === 'DRIVER'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {row.position}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-800 font-medium">{row.driverGroupId}</span>
                                {row.isNewGroup && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold">
                                    NEW GROUP
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{row.joinDate || '-'}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row.status === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {row.error ? (
                                <span className="text-rose-600 font-bold text-[10px] flex items-center justify-end gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {row.error}
                                </span>
                              ) : row.actionType === 'NEW' ? (
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                                  + INSERT
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                                  UPDATE
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!importResult && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={importing || previewRows.length === 0 || counts.total === counts.invalid}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengimpor ke Database...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Import ({counts.total - counts.invalid} Data Valid)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
