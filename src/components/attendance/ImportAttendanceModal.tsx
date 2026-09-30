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
  Info,
  Calendar,
  Building2,
  UserCheck,
} from 'lucide-react';
import { AttendanceLogItem } from '../../types';
import { importAttendanceLogsBatch, normalizeAttendanceDate } from '../../services/attendanceService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';

interface ImportAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportAttendanceModal: React.FC<ImportAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [previewRows, setPreviewRows] = useState<AttendanceLogItem[]>([]);
  const [parseError, setParseError] = useState<string>('');
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  // Format Excel serial date/time or string
  const formatExcelDateTime = (raw: any): string => {
    if (!raw) return '';
    if (raw instanceof Date) {
      return raw.toISOString().replace('T', ' ').substring(0, 19);
    }
    if (typeof raw === 'number') {
      // Excel serial date format
      const utcDays = Math.floor(raw - 25569);
      const utcValue = utcDays * 86400;
      const fractionalDay = raw - Math.floor(raw);
      const totalSeconds = Math.floor(fractionalDay * 86400);
      const dateInfo = new Date((utcValue + totalSeconds) * 1000);
      return dateInfo.toISOString().replace('T', ' ').substring(0, 16);
    }
    return String(raw).trim();
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'User Code': '201240370',
        'Driver Name': '201240370 - ANDRI SANTOSO',
        'Data Source': 'APP',
        'Driver': 'Y',
        'Finger Flag': 1,
        'Log Time': '03/03/2026 00:03',
        'Process to Attendance': 'N',
        'Site Name': 'Gudang AQUA Pandaan (TIV)',
      },
      {
        'User Code': '219130535',
        'Driver Name': '219130535 - SUHERMAN BIN SARTANAJAYA',
        'Data Source': 'APP',
        'Driver': 'Y',
        'Finger Flag': 1,
        'Log Time': '03/03/2026 00:00',
        'Process to Attendance': 'N',
        'Site Name': 'GENESIS MAERSK CIKARANG',
      },
      {
        'User Code': '219100245',
        'Driver Name': '219100245 - SAID BIN SAPIN',
        'Data Source': 'APP',
        'Driver': 'Y',
        'Finger Flag': 0,
        'Log Time': '03/03/2026 00:00',
        'Process to Attendance': 'N',
        'Site Name': 'GARASI MDL',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Absensi_ERP');
    XLSX.writeFile(wb, 'Template_Absensi_Driver_ERP.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setParsing(true);
    setParseError('');
    setPreviewRows([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('File Excel tidak memiliki lembar kerja (worksheet).');
      }

      // Find first non-empty worksheet
      let worksheet = workbook.Sheets[workbook.SheetNames[0]];
      let raw2D: any[][] = [];

      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const sheetRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
        if (sheetRows.length > 0) {
          worksheet = ws;
          raw2D = sheetRows;
          break;
        }
      }

      if (raw2D.length === 0) {
        throw new Error('File Excel kosong atau format tidak dapat dibaca.');
      }

      // 1. Smart Header Row Detection (look across first 20 rows for header keywords)
      const headerKeywords = [
        'user', 'code', 'nik', 'driver', 'nama', 'name', 'flag', 'finger',
        'time', 'waktu', 'jam', 'site', 'lokasi', 'pool', 'source', 'date', 'tanggal'
      ];

      let headerRowIdx = 0;
      let maxKeywordMatches = 0;

      for (let r = 0; r < Math.min(raw2D.length, 25); r++) {
        const rowCells = raw2D[r] || [];
        let matchCount = 0;
        for (const cell of rowCells) {
          const cleanCell = String(cell || '').toLowerCase().trim();
          if (cleanCell && headerKeywords.some((kw) => cleanCell.includes(kw))) {
            matchCount++;
          }
        }
        if (matchCount > maxKeywordMatches) {
          maxKeywordMatches = matchCount;
          headerRowIdx = r;
        }
      }

      // Extract raw header row & clean header names
      const headerRow = raw2D[headerRowIdx] || [];
      const headerNames = headerRow.map((h: any) => String(h || '').trim());
      const dataRows = raw2D.slice(headerRowIdx + 1);

      if (dataRows.length === 0) {
        throw new Error('File Excel hanya berisi baris judul/header tanpa baris data.');
      }

      // Helper for fuzzy case/space-stripped column matching
      const normalizeKey = (k: string) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const findColIdx = (aliases: string[]): number => {
        const normalizedAliases = aliases.map(normalizeKey);
        for (let i = 0; i < headerNames.length; i++) {
          const normHeader = normalizeKey(headerNames[i]);
          if (!normHeader) continue;
          if (normalizedAliases.some((alias) => normHeader === alias || normHeader.includes(alias) || alias.includes(normHeader))) {
            return i;
          }
        }
        return -1;
      };

      // Column Indexes
      const userCodeIdx = findColIdx([
        'usercode', 'user_code', 'user code', 'nik', 'driverid', 'id driver', 'driver id',
        'kodedriver', 'kodesupir', 'karyawanid', 'pin', 'badge', 'nrp', 'id', 'user'
      ]);

      const driverNameIdx = findColIdx([
        'drivername', 'driver_name', 'driver name', 'namadriver', 'namalengkap', 'namasupir',
        'nama', 'name', 'employeename', 'nama karyawan'
      ]);

      const fingerFlagIdx = findColIdx([
        'fingerflag', 'finger_flag', 'finger flag', 'flag', 'tipeflag', 'statusfinger',
        'inout', 'arah', 'tipe', 'masukkeluar', 'type', 'event'
      ]);

      const logTimeIdx = findColIdx([
        'logtime', 'log_time', 'log time', 'time', 'waktu', 'jam', 'datetime', 'date time',
        'timestamp', 'waktuabsen', 'waktuscan', 'tanggal', 'scandatetime', 'eventtime'
      ]);

      const siteNameIdx = findColIdx([
        'sitename', 'site_name', 'site name', 'site', 'lokasi', 'pool', 'garasi', 'branch',
        'cabang', 'unit', 'location', 'gudang', 'depot'
      ]);

      const dataSourceIdx = findColIdx([
        'datasource', 'data_source', 'data source', 'source', 'tipe', 'terminal', 'mesin', 'device', 'app'
      ]);

      const isDriverIdx = findColIdx([
        'driver', 'isdriver', 'is_driver', 'is driver', 'supir', 'jabatan', 'role', 'posisi'
      ]);

      const processToAttendanceIdx = findColIdx([
        'processtoattendance', 'process_to_attendance', 'process to attendance', 'process', 'proses'
      ]);

      const parsed: AttendanceLogItem[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.every((c: any) => c === '' || c === null || c === undefined)) {
          continue; // Skip blank rows
        }

        const getRaw = (idx: number): any => (idx >= 0 && row[idx] !== undefined ? row[idx] : '');

        let rawUserCode = String(getRaw(userCodeIdx)).trim();
        let rawDriverName = String(getRaw(driverNameIdx)).trim();
        const rawFlag = getRaw(fingerFlagIdx);
        const rawLogTime = getRaw(logTimeIdx);
        const rawSite = String(getRaw(siteNameIdx)).trim();
        const rawSource = String(getRaw(dataSourceIdx)).trim();
        const rawIsDriver = String(getRaw(isDriverIdx)).trim();
        const rawProcess = String(getRaw(processToAttendanceIdx)).trim();

        // Fallback: If userCode is empty, but driverName has "201240370 - ANDRI SANTOSO"
        if (!rawUserCode && rawDriverName) {
          const match = rawDriverName.match(/^([A-Za-z0-9_-]{3,25})\s*[-:]\s*(.+)$/);
          if (match) {
            rawUserCode = match[1].trim();
            rawDriverName = match[2].trim();
          } else {
            rawUserCode = rawDriverName;
          }
        }

        // Fallback: If driverName is empty, but userCode has name after dash
        if (rawUserCode && !rawDriverName) {
          if (rawUserCode.includes('-')) {
            const parts = rawUserCode.split('-');
            rawUserCode = parts[0].trim();
            rawDriverName = parts.slice(1).join('-').trim();
          } else {
            rawDriverName = rawUserCode;
          }
        }

        // Only process if we have a valid identifier
        if (rawUserCode) {
          // Parse Finger Flag: 1 (IN / MASUK), 0 (OUT / KELUAR)
          let fingerFlag = 1;
          const flagStr = String(rawFlag !== undefined && rawFlag !== '' ? rawFlag : '1').toUpperCase().trim();
          if (
            flagStr === '0' ||
            flagStr === 'OUT' ||
            flagStr === 'KELUAR' ||
            flagStr === 'PULANG' ||
            flagStr === 'CLOCK OUT' ||
            flagStr === 'CHECK OUT'
          ) {
            fingerFlag = 0;
          } else {
            fingerFlag = 1;
          }

          const formattedLogTime = formatExcelDateTime(rawLogTime);
          const logDate = normalizeAttendanceDate(formattedLogTime);

          parsed.push({
            userCode: rawUserCode.toUpperCase(),
            driverName: rawDriverName || rawUserCode.toUpperCase(),
            dataSource: rawSource || 'APP',
            isDriver: rawIsDriver || 'Y',
            fingerFlag,
            logTime: formattedLogTime || `${logDate} 00:00`,
            logDate,
            processToAttendance: rawProcess || 'N',
            siteName: rawSite || 'GARASI MDL',
          });
        }
      }

      if (parsed.length === 0) {
        const detectedHeadersDisplay = headerNames.filter(Boolean).slice(0, 8).join(', ');
        throw new Error(
          `Tidak ditemukan baris data yang valid. Kolom terdeteksi di baris #${headerRowIdx + 1}: [${detectedHeadersDisplay || 'Kosong'}]. ` +
          `Pastikan file Excel memuat kolom User Code/NIK/ID Driver dan Log Time.`
        );
      }

      setPreviewRows(parsed);
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || 'Gagal membaca file Excel.');
    } finally {
      setParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (previewRows.length === 0) return;
    setImporting(true);

    try {
      const result = await importAttendanceLogsBatch(previewRows, {
        email: currentUser?.email,
        fullName: currentUser?.fullName,
      });

      showToast(
        `Berhasil memproses import absensi! ${result.successCount} record tersimpan (${result.inCount} Tap Masuk, ${result.outCount} Tap Keluar). Data tidak akan dobel saat di-import ulang.`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal menyimpan data absensi ke database.', 'error');
    } finally {
      setImporting(false);
    }
  };

  // Summary counts
  const totalIn = previewRows.filter((r) => r.fingerFlag === 1).length;
  const totalOut = previewRows.filter((r) => r.fingerFlag === 0).length;
  const detectedDates = Array.from(new Set(previewRows.map((r) => r.logDate))).filter(Boolean);
  const detectedSites = Array.from(new Set(previewRows.map((r) => r.siteName))).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-linear-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <FileSpreadsheet className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Import Data Absensi Driver (ERP)</h2>
              <p className="text-xs text-blue-100/80">
                Unggah file Excel/CSV tarikan ERP untuk menghitung kepatuhan pemeriksaan TENKO
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Instructions and Download Template */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50 border border-blue-200/70 text-blue-950">
            <div className="flex items-start gap-3 text-xs leading-relaxed">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Format Kolom ERP:</span> Sistem otomatis membaca kolom{' '}
                <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">User Code</code>,{' '}
                <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">Driver Name</code>,{' '}
                <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">Finger Flag (1=Masuk)</code>,{' '}
                <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">Log Time</code>, dan{' '}
                <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">Site Name</code>.
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="shrink-0 flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 font-semibold rounded-xl text-xs shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Contoh Format (.xlsx)</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
              file
                ? 'border-emerald-400 bg-emerald-50/40'
                : 'border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs ${
              file ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
            }`}>
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                {file ? file.name : 'Klik atau Tarik File Excel Absensi ERP (.xlsx, .csv)'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {file ? `${(file.size / 1024).toFixed(1)} KB — Siap diproses` : 'Mendukung format tarikan asli sistem ERP logistik'}
              </p>
            </div>
          </div>

          {/* Parse Loading */}
          {parsing && (
            <div className="flex items-center justify-center gap-3 py-6 text-slate-600 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span>Membaca dan memvalidasi baris data absensi...</span>
            </div>
          )}

          {/* Parse Error */}
          {parseError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Gagal memproses file</p>
                <p>{parseError}</p>
              </div>
            </div>
          )}

          {/* Preview & Stats Section */}
          {previewRows.length > 0 && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Total Baris</p>
                  <p className="text-lg font-black text-slate-900 mt-0.5">{previewRows.length}</p>
                  <p className="text-[10px] text-slate-500">Record terbaca</p>
                </div>

                <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200">
                  <p className="text-[10px] font-bold uppercase text-emerald-600">Tap Masuk (IN)</p>
                  <p className="text-lg font-black text-emerald-700 mt-0.5">{totalIn}</p>
                  <p className="text-[10px] text-emerald-600">Driver Hadir Kerja</p>
                </div>

                <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200">
                  <p className="text-[10px] font-bold uppercase text-amber-600">Tap Keluar (OUT)</p>
                  <p className="text-lg font-black text-amber-700 mt-0.5">{totalOut}</p>
                  <p className="text-[10px] text-amber-600">Log Pulang/Selesai</p>
                </div>

                <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-200">
                  <p className="text-[10px] font-bold uppercase text-indigo-600">Site / Lokasi</p>
                  <p className="text-lg font-black text-indigo-700 mt-0.5">{detectedSites.length}</p>
                  <p className="text-[10px] text-indigo-600 truncate">{detectedSites.slice(0, 2).join(', ') || '-'}</p>
                </div>
              </div>

              {/* Detected Date Indicator */}
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100/80 px-3.5 py-2 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Tanggal Absensi Terdeteksi: </span>
                <span className="font-bold text-slate-900">{detectedDates.join(', ') || '-'}</span>
              </div>

              {/* Data Table Preview (First 50 rows) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-bold">
                  <span>Pratinjau Data ({previewRows.length} Baris)</span>
                  <span className="text-[11px] font-normal text-slate-500">Menampilkan 50 baris pertama</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">No</th>
                        <th className="px-3 py-2">User Code</th>
                        <th className="px-3 py-2">Driver Name</th>
                        <th className="px-3 py-2">Finger Flag</th>
                        <th className="px-3 py-2">Log Time</th>
                        <th className="px-3 py-2">Site Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-900">{row.userCode}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{row.driverName}</td>
                          <td className="px-3 py-2">
                            {row.fingerFlag === 1 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">
                                1 (MASUK)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">
                                0 (KELUAR)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{row.logTime}</td>
                          <td className="px-3 py-2 text-slate-600">{row.siteName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={previewRows.length === 0 || importing}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition ${
              previewRows.length === 0 || importing
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
            }`}
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan ke Database ({previewRows.length} Data)...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan & Proses Import ({previewRows.length} Data)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
