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
  Users,
  HeartPulse,
  Info,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { TenkoImportRow, TenkoImportResult, importTenkoBatch } from '../../services/tenkoService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { Driver, DriverGroup, ExaminationRecommendation, ExaminationSummary, ScreeningResult } from '../../types';

interface ImportTenkoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingDrivers: Driver[];
  existingGroups: DriverGroup[];
}

interface ParsedTenkoPreviewRow extends TenkoImportRow {
  rowNumber: number;
  isAutoDriver: boolean;
  error?: string;
}

export const ImportTenkoModal: React.FC<ImportTenkoModalProps> = ({
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
  const [previewRows, setPreviewRows] = useState<ParsedTenkoPreviewRow[]>([]);
  const [parseError, setParseError] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'ALL' | 'FIT' | 'NOTE' | 'UNFIT' | 'INVALID'>('ALL');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<TenkoImportResult | null>(null);

  if (!isOpen) return null;

  // Helper date parser
  const formatExcelDate = (raw: any): string => {
    if (!raw) return '';
    if (raw instanceof Date) {
      return raw.toISOString().split('T')[0];
    }
    if (typeof raw === 'number') {
      const utcDays = Math.floor(raw - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      return dateInfo.toISOString().split('T')[0];
    }
    const str = String(raw).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          const mOrD = parseInt(parts[0], 10);
          const dOrM = parseInt(parts[1], 10);
          const y = parts[2];
          if (mOrD > 12) {
            // DD/MM/YYYY
            return `${y}-${String(dOrM).padStart(2, '0')}-${String(mOrD).padStart(2, '0')}`;
          }
          return `${y}-${String(mOrD).padStart(2, '0')}-${String(dOrM).padStart(2, '0')}`;
        }
      }
    }
    return str;
  };

  const handleDownloadTemplate = () => {
    const today = new Date().toISOString().split('T')[0];
    const templateData = [
      {
        'NO TENKO': 1,
        'DATE': `${today} 07:30`,
        'ID DRIVER': '301240143',
        'DRIVER NAME': 'ADAM',
        'POSITION': 'KENEK',
        'DRIVER GROUP': 'ABPN1-Helper Reguler Balikpapan',
        'RHA-JMP': 'READY',
        'DOK JMP': 'READY',
        'DAILY NON-WORKING HOURS': '> 11 HOURS',
        'OFF-DUTY SLEEP DURATION': 8,
        'TEMP': 36.5,
        'BLOOD PRESSURE (SISTOLIK)': 120,
        'BLOOD PRESSURE (DIASTOLIK)': 80,
        'BLOOD PRESURE RESULT': '120/80 mmHg',
        'HEARTRATE (BPM)': 75,
        'ALCOHOL TEST (BAC)': 'NEGATIVE',
        'DRUG TEST': 'NO TEST',
        'APPEARANCE': 'NORMAL',
        'EYES': 'NORMAL',
        'FACE': 'NORMAL',
        'HAIR': 'NORMAL',
        'EMOTIONAL REGULATION': 'NORMAL',
        'PROBLEM SOLVING': 'NORMAL',
        'SELF-AWARENESS': 'NORMAL',
        'COMUNICATION': 'NORMAL',
        'DECISION MAKING': 'NORMAL',
        'BALANCE TEST': 'NORMAL',
        'INTERVIEW': 'NORMAL',
        'SUMMARY': 'PASSED',
        'RECOMMENDATION': 'FIT TO WORK',
        'NOTE': 'Kondisi prima siap bertugas',
        'FINISH TIME': `${today} 07:45`,
        'CREATED DATE': `${today} 07:45`,
        'CREATED BY': currentUser?.fullName || 'Ns. Ratna Sari, S.Kep',
      },
      {
        'NO TENKO': 2,
        'DATE': `${today} 07:45`,
        'ID DRIVER': '301210045',
        'DRIVER NAME': 'BUDI SANTOSO',
        'POSITION': 'DRIVER',
        'DRIVER GROUP': 'Armada A - Wingbox',
        'RHA-JMP': 'READY',
        'DOK JMP': 'READY',
        'DAILY NON-WORKING HOURS': '> 11 HOURS',
        'OFF-DUTY SLEEP DURATION': 6,
        'TEMP': 36.8,
        'BLOOD PRESSURE (SISTOLIK)': 135,
        'BLOOD PRESSURE (DIASTOLIK)': 85,
        'BLOOD PRESURE RESULT': '135/85 mmHg',
        'HEARTRATE (BPM)': 82,
        'ALCOHOL TEST (BAC)': 'NEGATIVE',
        'DRUG TEST': 'NEGATIVE',
        'APPEARANCE': 'NORMAL',
        'EYES': 'NORMAL',
        'FACE': 'NORMAL',
        'HAIR': 'NORMAL',
        'EMOTIONAL REGULATION': 'NORMAL',
        'PROBLEM SOLVING': 'NORMAL',
        'SELF-AWARENESS': 'NORMAL',
        'COMUNICATION': 'NORMAL',
        'DECISION MAKING': 'NORMAL',
        'BALANCE TEST': 'NORMAL',
        'INTERVIEW': 'NORMAL',
        'SUMMARY': 'PASSED',
        'RECOMMENDATION': 'FIT TO WORK WITH NOTE',
        'NOTE': 'Tensi agak tinggi, disarankan banyak minum air putih',
        'FINISH TIME': `${today} 08:00`,
        'CREATED DATE': `${today} 08:00`,
        'CREATED BY': currentUser?.fullName || 'Ns. Ratna Sari, S.Kep',
      },
      {
        'NO TENKO': 3,
        'DATE': `${today} 08:15`,
        'ID DRIVER': '301240109',
        'DRIVER NAME': 'AHMAD DANI',
        'POSITION': 'DRIVER',
        'DRIVER GROUP': 'ABPN1-Helper Reguler Balikpapan',
        'RHA-JMP': 'READY',
        'DOK JMP': 'READY',
        'DAILY NON-WORKING HOURS': '< 11 HOURS',
        'OFF-DUTY SLEEP DURATION': 4,
        'TEMP': 37.8,
        'BLOOD PRESSURE (SISTOLIK)': 165,
        'BLOOD PRESSURE (DIASTOLIK)': 100,
        'BLOOD PRESURE RESULT': '165/100 mmHg',
        'HEARTRATE (BPM)': 96,
        'ALCOHOL TEST (BAC)': 'NEGATIVE',
        'DRUG TEST': 'NO TEST',
        'APPEARANCE': 'UBNORMAL',
        'EYES': 'UBNORMAL',
        'FACE': 'NORMAL',
        'HAIR': 'NORMAL',
        'EMOTIONAL REGULATION': 'NORMAL',
        'PROBLEM SOLVING': 'NORMAL',
        'SELF-AWARENESS': 'UBNORMAL',
        'COMUNICATION': 'NORMAL',
        'DECISION MAKING': 'UBNORMAL',
        'BALANCE TEST': 'UBNORMAL',
        'INTERVIEW': 'UBNORMAL',
        'SUMMARY': 'FAILED',
        'RECOMMENDATION': 'UNFIT TO WORK',
        'NOTE': 'Hipertensi stage 2 & kurang tidur, istirahat dan rujuk klinik',
        'FINISH TIME': `${today} 08:30`,
        'CREATED DATE': `${today} 08:30`,
        'CREATED BY': currentUser?.fullName || 'Ns. Ratna Sari, S.Kep',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 10 }, // NO TENKO
      { wch: 18 }, // DATE
      { wch: 15 }, // ID DRIVER
      { wch: 24 }, // DRIVER NAME
      { wch: 12 }, // POSITION
      { wch: 32 }, // DRIVER GROUP
      { wch: 12 }, // RHA-JMP
      { wch: 12 }, // DOK JMP
      { wch: 26 }, // DAILY NON-WORKING HOURS
      { wch: 24 }, // OFF-DUTY SLEEP DURATION
      { wch: 10 }, // TEMP
      { wch: 24 }, // BLOOD PRESSURE (SISTOLIK)
      { wch: 24 }, // BLOOD PRESSURE (DIASTOLIK)
      { wch: 22 }, // BLOOD PRESURE RESULT
      { wch: 16 }, // HEARTRATE (BPM)
      { wch: 18 }, // ALCOHOL TEST (BAC)
      { wch: 14 }, // DRUG TEST
      { wch: 14 }, // APPEARANCE
      { wch: 12 }, // EYES
      { wch: 12 }, // FACE
      { wch: 12 }, // HAIR
      { wch: 22 }, // EMOTIONAL REGULATION
      { wch: 18 }, // PROBLEM SOLVING
      { wch: 18 }, // SELF-AWARENESS
      { wch: 16 }, // COMUNICATION
      { wch: 18 }, // DECISION MAKING
      { wch: 16 }, // BALANCE TEST
      { wch: 14 }, // INTERVIEW
      { wch: 12 }, // SUMMARY
      { wch: 24 }, // RECOMMENDATION
      { wch: 36 }, // NOTE
      { wch: 18 }, // FINISH TIME
      { wch: 18 }, // CREATED DATE
      { wch: 24 }, // CREATED BY
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template TENKO');
    XLSX.writeFile(workbook, 'Template_Import_Data_TENKO.xlsx');
    showToast('Template Excel Hasil Pemeriksaan TENKO (34 Kolom) berhasil diunduh.', 'success');
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

      // Build driver lookup set
      const driverMap = new Map<string, Driver>();
      existingDrivers.forEach((d) => {
        if (d.driverId) driverMap.set(d.driverId.trim().toUpperCase(), d);
      });

      const parsed: ParsedTenkoPreviewRow[] = [];

      rawJson.forEach((row, idx) => {
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

        const rawDate = getVal(['DATE', 'TANGGAL PEMERIKSAAN', 'EXAMINATION DATE', 'TANGGAL', 'TGL']);
        const rawTime = getVal(['FINISH TIME', 'WAKTU', 'TIME', 'JAM', 'WAKTU PEMERIKSAAN', 'JAM PEMERIKSAAN']);
        const rawDriverId = getVal(['ID DRIVER', 'DRIVER ID', 'DRIVER_ID', 'ID', 'NIK']);
        const rawDriverName = getVal(['DRIVER NAME', 'NAMA DRIVER', 'NAMA LENGKAP', 'NAMA', 'DRIVER_NAME']);
        const rawPosition = getVal(['POSITION', 'POSISI', 'ROLE', 'JABATAN']);
        const rawGroup = getVal(['DRIVER GROUP', 'DRIVER_GROUP', 'GROUP', 'ARMADA', 'GRUP']);
        const rawPool = getVal(['POOL LOKASI', 'POOL', 'LOKASI', 'LOCATION', 'CABANG']);

        // Readiness
        const rawRha = getVal(['RHA-JMP', 'RHA JMP', 'RHA']);
        const rawDok = getVal(['DOK JMP', 'DOK-JMP', 'DOK']);
        const rawNonWorking = getVal(['DAILY NON-WORKING HOURS', 'NON WORKING HOURS', 'JAM ISTIRAHAT']);
        const rawSleep = getVal(['OFF-DUTY SLEEP DURATION', 'DURASI TIDUR (JAM)', 'DURASI TIDUR', 'JAM TIDUR', 'SLEEP DURATION', 'SLEEP']);

        // Vitals
        const rawSys = getVal(['BLOOD PRESSURE (SISTOLIK)', 'TEKANAN DARAH SISTOLIK', 'SISTOLIK', 'SYSTOLIC', 'TDS', 'SYS']);
        const rawDia = getVal(['BLOOD PRESSURE (DIASTOLIK)', 'TEKANAN DARAH DIASTOLIK', 'DIASTOLIK', 'DIASTOLIC', 'TDD', 'DIA']);
        const rawBP = getVal(['BLOOD PRESURE RESULT', 'BLOOD PRESSURE RESULT', 'TEKANAN DARAH', 'BLOOD PRESSURE', 'TENSI', 'BP']);
        const rawTemp = getVal(['TEMP', 'SUHU TUBUH', 'SUHU', 'TEMPERATURE']);
        const rawHR = getVal(['HEARTRATE (BPM)', 'HEARTRATE', 'DETAK JANTUNG', 'NADI', 'HEART RATE', 'HR', 'BPM']);

        // Screening
        const rawAlcohol = getVal(['ALCOHOL TEST (BAC)', 'ALCOHOL TEST', 'ALKOHOL', 'ALCOHOL', 'TES ALKOHOL']);
        const rawDrug = getVal(['DRUG TEST', 'NARKOBA', 'DRUG', 'TES NARKOBA', 'NAPZA']);

        // Observations (11 items)
        const parseObservation = (val: any): 'NORMAL' | 'ABNORMAL' => {
          const s = String(val).trim().toUpperCase();
          if (s.includes('UBNORMAL') || s.includes('ABNORMAL') || s.includes('TIDAK') || s === '1' || s === 'FALSE') {
            return 'ABNORMAL';
          }
          return 'NORMAL';
        };

        const appearance = parseObservation(getVal(['APPEARANCE', 'PENAMPILAN']));
        const eyes = parseObservation(getVal(['EYES', 'MATA']));
        const face = parseObservation(getVal(['FACE', 'WAJAH']));
        const hair = parseObservation(getVal(['HAIR', 'RAMBUT']));
        const emotionalRegulation = parseObservation(getVal(['EMOTIONAL REGULATION', 'REGULASI EMOSI', 'EMOSI']));
        const problemSolving = parseObservation(getVal(['PROBLEM SOLVING', 'PEMECAHAN MASALAH']));
        const selfAwareness = parseObservation(getVal(['SELF-AWARENESS', 'SELF AWARENESS', 'KESADARAN DIRI']));
        const communication = parseObservation(getVal(['COMUNICATION', 'COMMUNICATION', 'KOMUNIKASI']));
        const decisionMaking = parseObservation(getVal(['DECISION MAKING', 'PENGAMBILAN KEPUTUSAN']));
        const balanceTest = parseObservation(getVal(['BALANCE TEST', 'BALANCE', 'KESEIMBANGAN', 'TES KESEIMBANGAN']));
        const interview = parseObservation(getVal(['INTERVIEW', 'WAWANCARA', 'ANAMNESA']));

        // Result
        const rawSummary = getVal(['SUMMARY', 'HASIL', 'STATUS', 'KELULUSAN']);
        const rawRecommendation = getVal(['RECOMMENDATION', 'REKOMENDASI', 'REKOMENDASI MEDIS', 'STATUS KELAIKAN']);
        const rawNote = getVal(['NOTE', 'CATATAN', 'NOTES', 'KETERANGAN']);
        const rawExaminer = getVal(['CREATED BY', 'NAKES PEMERIKSA', 'PEMERIKSA', 'EXAMINER NAME', 'NAKES', 'PETUGAS']);

        const cleanDriverId = String(rawDriverId).trim().toUpperCase();
        const matchedDriver = driverMap.get(cleanDriverId);
        const cleanDriverName = String(rawDriverName).trim() || matchedDriver?.fullName || (cleanDriverId ? `Driver ${cleanDriverId}` : '');

        let cleanPos = String(rawPosition).trim().toUpperCase();
        let pos: 'DRIVER' | 'KENEK' = matchedDriver?.position || 'DRIVER';
        if (cleanPos.includes('KENEK') || cleanPos.includes('HELPER') || cleanPos.includes('ASSISTANT') || cleanDriverId.startsWith('KNK')) {
          pos = 'KENEK';
        } else if (cleanPos.includes('DRIVER')) {
          pos = 'DRIVER';
        }

        const cleanGroup = String(rawGroup).trim() || matchedDriver?.driverGroupId || 'TETAP';
        const parsedDate = formatExcelDate(rawDate) || new Date().toISOString().split('T')[0];

        // Parse BP
        let systolic = Number(rawSys);
        let diastolic = Number(rawDia);
        if ((!systolic || !diastolic) && rawBP) {
          const bpMatch = String(rawBP).match(/(\d+)\s*\/\s*(\d+)/);
          if (bpMatch) {
            systolic = parseInt(bpMatch[1], 10);
            diastolic = parseInt(bpMatch[2], 10);
          }
        }
        if (!systolic) systolic = 120;
        if (!diastolic) diastolic = 80;

        const temperature = Number(rawTemp) || 36.5;
        const heartRate = Number(rawHR) || 75;
        const sleepHours = Number(rawSleep) || 7;

        // Readiness options
        const rhaJmp = String(rawRha).toUpperCase().includes('NOT') ? 'NOT READY' : 'READY';
        const dokJmp = String(rawDok).toUpperCase().includes('NOT') ? 'NOT READY' : 'READY';
        const dailyNonWorkingHours = String(rawNonWorking).includes('<') ? '< 11 HOURS' : '>= 11 HOURS';

        // Alcohol & Drug
        let alcoholTest: ScreeningResult = 'NEGATIVE';
        const alcStr = String(rawAlcohol).trim().toUpperCase();
        if (alcStr.includes('POS') || alcStr === '1' || alcStr === 'TRUE') alcoholTest = 'POSITIVE';
        else if (alcStr.includes('NO') || alcStr === 'TIDAK DIUJI') alcoholTest = 'NO TEST';

        let drugTest: ScreeningResult = 'NO TEST';
        const drugStr = String(rawDrug).trim().toUpperCase();
        if (drugStr.includes('POS')) drugTest = 'POSITIVE';
        else if (drugStr.includes('NEG')) drugTest = 'NEGATIVE';

        // Auto determine Summary & Recommendation
        let summary: ExaminationSummary = 'PASSED';
        let recommendation: ExaminationRecommendation = 'FIT TO WORK';

        const rawSumUpper = String(rawSummary).trim().toUpperCase();
        const rawRecUpper = String(rawRecommendation).trim().toUpperCase();

        if (rawSumUpper.includes('FAIL') || rawSumUpper.includes('GAGAL') || rawSumUpper.includes('TIDAK')) {
          summary = 'FAILED';
        }
        if (rawRecUpper.includes('UNFIT') || rawRecUpper.includes('TIDAK LAIK')) {
          recommendation = 'UNFIT TO WORK';
          summary = 'FAILED';
        } else if (rawRecUpper.includes('NOTE') || rawRecUpper.includes('CATATAN')) {
          recommendation = 'FIT TO WORK WITH NOTE';
        } else if (rawRecUpper.includes('FIT')) {
          recommendation = 'FIT TO WORK';
        } else {
          // Automatic rule-based
          const hasAbnormal = [appearance, eyes, face, hair, emotionalRegulation, problemSolving, selfAwareness, communication, decisionMaking, balanceTest, interview].some(
            (o) => o === 'ABNORMAL'
          );

          if (alcoholTest === 'POSITIVE' || drugTest === 'POSITIVE' || systolic >= 160 || diastolic >= 100 || temperature >= 38.0 || rhaJmp === 'NOT READY' || dokJmp === 'NOT READY') {
            summary = 'FAILED';
            recommendation = 'UNFIT TO WORK';
          } else if (systolic >= 140 || diastolic >= 90 || temperature >= 37.5 || sleepHours < 6 || heartRate >= 100 || heartRate <= 50 || hasAbnormal) {
            summary = 'PASSED';
            recommendation = 'FIT TO WORK WITH NOTE';
          }
        }

        // Validation error
        let error: string | undefined = undefined;
        if (!cleanDriverId && !cleanDriverName) {
          error = 'Driver ID & Nama tidak boleh kosong';
        }

        parsed.push({
          rowNumber: idx + 1,
          examinationDate: parsedDate,
          finishTime: rawTime ? (String(rawTime).includes('T') ? String(rawTime) : `${parsedDate}T${String(rawTime).padStart(5, '0')}:00`) : undefined,
          driverId: cleanDriverId || `DRV-${idx + 1}`,
          driverName: cleanDriverName || `Driver ${idx + 1}`,
          position: pos,
          driverGroup: cleanGroup,
          locationName: String(rawPool).trim() || 'Pool Utama',
          rhaJmp,
          dokJmp,
          dailyNonWorkingHours,
          offDutySleepDuration: sleepHours,
          bloodPressureSystolic: systolic,
          bloodPressureDiastolic: diastolic,
          bloodPressureResult: `${systolic}/${diastolic} mmHg`,
          temperature,
          heartRate,
          alcoholTest,
          drugTest,
          appearance,
          eyes,
          face,
          hair,
          emotionalRegulation,
          problemSolving,
          selfAwareness,
          communication,
          decisionMaking,
          balanceTest,
          interview,
          summary,
          recommendation,
          note: String(rawNote).trim(),
          examinerName: String(rawExaminer).trim() || currentUser?.fullName || 'Nakes Pemeriksa',
          isAutoDriver: !matchedDriver,
          error,
        });
      });

      setPreviewRows(parsed);
      showToast(`Berhasil membaca ${parsed.length} baris data pemeriksaan TENKO.`, 'success');
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || 'Gagal membaca file spreadsheet.');
      showToast('Gagal memproses file.', 'error');
    } finally {
      setParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    const validRows = previewRows.filter((r) => !r.error);
    if (validRows.length === 0) {
      showToast('Tidak ada data valid untuk diimpor.', 'error');
      return;
    }

    setImporting(true);
    try {
      const userPayload = {
        userId: currentUser?.userId || 'SYS_USER',
        fullName: currentUser?.fullName || 'Super Admin',
      };

      const result = await importTenkoBatch(validRows, userPayload);
      setImportResult(result);
      showToast(
        `Import sukses! ${result.importedCount} data pemeriksaan TENKO berhasil dimasukkan ke database.`,
        'success'
      );
      onSuccess();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal mengimpor data TENKO.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const counts = {
    total: previewRows.length,
    fit: previewRows.filter((r) => !r.error && r.recommendation === 'FIT TO WORK').length,
    note: previewRows.filter((r) => !r.error && r.recommendation === 'FIT TO WORK WITH NOTE').length,
    unfit: previewRows.filter((r) => !r.error && r.recommendation === 'UNFIT TO WORK').length,
    autoDrivers: previewRows.filter((r) => !r.error && r.isAutoDriver).length,
    invalid: previewRows.filter((r) => !!r.error).length,
  };

  const filteredPreview = previewRows.filter((r) => {
    if (activeTab === 'FIT') return !r.error && r.recommendation === 'FIT TO WORK';
    if (activeTab === 'NOTE') return !r.error && r.recommendation === 'FIT TO WORK WITH NOTE';
    if (activeTab === 'UNFIT') return !r.error && r.recommendation === 'UNFIT TO WORK';
    if (activeTab === 'INVALID') return !!r.error;
    return true;
  });

  return (
    <div
      id="import-tenko-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base md:text-lg">
                Import Data Pemeriksaan TENKO via Excel / CSV
              </h3>
              <p className="text-xs text-slate-500">
                Unggah rekam medis dan riwayat fit-to-work pengemudi secara massal ke database
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer"
              title="Unduh Format Excel Standar TENKO"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Format Template (.xlsx)</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* SUCCESS RESULT SCREEN */}
          {importResult ? (
            <div className="p-6 rounded-3xl bg-blue-50 border border-blue-200 text-center space-y-4">
              <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-black text-blue-950">Import Data TENKO Berhasil!</h4>
                <p className="text-xs text-blue-700 mt-1">
                  Riwayat pemeriksaan kesiapan kerja dan rekam medis pengemudi telah tersimpan di Firebase Firestore.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-2">
                <div className="bg-white p-3.5 rounded-2xl border border-blue-200">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Total Baris</p>
                  <p className="text-xl font-black text-slate-900">{importResult.totalProcessed}</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-blue-200">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Data TENKO Masuk</p>
                  <p className="text-xl font-black text-emerald-600">+{importResult.importedCount}</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-blue-200">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Driver Baru Didaftarkan</p>
                  <p className="text-xl font-black text-blue-600">+{importResult.autoCreatedDriversCount}</p>
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  Selesai & Lihat Data
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
                      {file ? file.name : 'Tarik & Letakkan file Excel riwayat TENKO di sini, atau klik untuk memilih'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Mendukung file spreadsheet <strong>.xlsx</strong>, <strong>.xls</strong>, dan <strong>.csv</strong>
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
                    <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">FIT TO WORK</span>
                      <p className="text-lg font-black text-emerald-700">{counts.fit}</p>
                    </div>
                    <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200">
                      <span className="text-[10px] font-bold text-amber-600 uppercase">FIT WITH NOTE</span>
                      <p className="text-lg font-black text-amber-700">{counts.note}</p>
                    </div>
                    <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200">
                      <span className="text-[10px] font-bold text-rose-600 uppercase">UNFIT TO WORK</span>
                      <p className="text-lg font-black text-rose-700">{counts.unfit}</p>
                    </div>
                  </div>

                  {counts.autoDrivers > 0 && (
                    <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-start gap-2.5 text-xs text-blue-900">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Sinkronisasi Master Driver Otomatis: </span>
                        Terdapat <strong>{counts.autoDrivers} driver</strong> di dalam file yang belum ada di Master Driver. Sistem akan otomatis mendaftarkannya saat import.
                      </div>
                    </div>
                  )}

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('ALL')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                        activeTab === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Semua ({counts.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('FIT')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                        activeTab === 'FIT'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      Fit ({counts.fit})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('NOTE')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                        activeTab === 'NOTE'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      Fit Note ({counts.note})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('UNFIT')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                        activeTab === 'UNFIT'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      Unfit ({counts.unfit})
                    </button>
                    {counts.invalid > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('INVALID')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                          activeTab === 'INVALID'
                            ? 'bg-rose-700 text-white shadow-xs'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
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
                          <th className="py-2.5 px-3">Tanggal</th>
                          <th className="py-2.5 px-3">Driver ID</th>
                          <th className="py-2.5 px-3">Nama Driver</th>
                          <th className="py-2.5 px-3">Group</th>
                          <th className="py-2.5 px-3">Tensi (BP)</th>
                          <th className="py-2.5 px-3">Suhu</th>
                          <th className="py-2.5 px-3">Alkohol</th>
                          <th className="py-2.5 px-3">Rekomendasi</th>
                          <th className="py-2.5 px-3 text-right">Pemeriksa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredPreview.map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3 text-slate-400 font-mono">{row.rowNumber}</td>
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{row.examinationDate}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{row.driverId}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">{row.driverName}</span>
                              <span className="text-[10px] text-slate-400">{row.position}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 max-w-[140px] truncate">{row.driverGroup}</td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{row.bloodPressureResult}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">{row.temperature}°C</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  row.alcoholTest === 'POSITIVE'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {row.alcoholTest}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                                  row.recommendation === 'FIT TO WORK'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : row.recommendation === 'FIT TO WORK WITH NOTE'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {row.recommendation}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600 max-w-[120px] truncate">
                              {row.examinerName}
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
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
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
                  <span>Mengimpor ke Database Firebase...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Import ({counts.total - counts.invalid} Data TENKO)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
