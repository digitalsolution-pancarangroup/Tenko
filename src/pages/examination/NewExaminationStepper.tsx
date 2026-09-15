import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { Driver, DriverGroup, TenkoExamination, DriverPosition, Location, HealthIndication, VitaminItem, DriverHealthRecord } from '../../types';
import { getDrivers, searchDrivers } from '../../services/driverService';
import { getLocations } from '../../services/masterService';
import { createTenkoExamination } from '../../services/tenkoService';
import {
  getActiveHealthRecordForDriver,
  getHealthIndications,
  getVitamins,
  createDriverHealthRecord,
  solveDriverHealthRecord,
  updateDriverHealthRecord,
} from '../../services/healthService';
import { deductPoolStockForTenko, getPoolInventory } from '../../services/medicalInventoryService';
import { PoolInventoryItem } from '../../types';
import { QuickAddDriverModal } from '../../components/common/QuickAddDriverModal';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Search,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  User,
  ShieldCheck,
  Activity,
  Heart,
  Thermometer,
  Eye,
  FileCheck2,
  Calendar,
  Clock,
  Loader2,
  Truck,
  Building2,
  HeartPulse,
  Pill,
  Check,
} from 'lucide-react';

interface NewExaminationStepperProps {
  onSuccess: (createdExam: TenkoExamination) => void;
  onCancel: () => void;
}

export const NewExaminationStepper: React.FC<NewExaminationStepperProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Driver search state & Locations
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(
    currentUser?.locationName || currentUser?.locationId || 'Pool Tanah Merdeka - Cilincing'
  );
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Form State: STEP 1 - Driver
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // STEP 2 - Kesiapan Kerja
  const [rhaJmp, setRhaJmp] = useState<'READY' | 'NOT READY'>('READY');
  const [dokJmp, setDokJmp] = useState<'READY' | 'NOT READY'>('READY');
  const [dailyNonWorkingHours, setDailyNonWorkingHours] = useState<'< 11 HOURS' | '>= 11 HOURS'>('>= 11 HOURS');
  const [offDutySleepDuration, setOffDutySleepDuration] = useState<number>(8);

  // STEP 3 - Tanda Vital
  const [temperature, setTemperature] = useState<number>(36.5);
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState<number>(120);
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState<number>(80);
  const [heartRate, setHeartRate] = useState<number>(75);

  // STEP 4 - Screening
  const [alcoholTest, setAlcoholTest] = useState<'POSITIVE' | 'NEGATIVE' | 'NO TEST'>('NEGATIVE');
  const [drugTest, setDrugTest] = useState<'POSITIVE' | 'NEGATIVE' | 'NO TEST'>('NEGATIVE');

  // STEP 5 - Fisik & Perilaku (11 items)
  const [appearance, setAppearance] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [eyes, setEyes] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [face, setFace] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [hair, setHair] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [emotionalRegulation, setEmotionalRegulation] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [problemSolving, setProblemSolving] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [selfAwareness, setSelfAwareness] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [communication, setCommunication] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [decisionMaking, setDecisionMaking] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [balanceTest, setBalanceTest] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [interview, setInterview] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');

  // STEP 6 - Hasil Pemeriksaan
  const [summary, setSummary] = useState<'PASSED' | 'FAILED'>('PASSED');
  const [recommendation, setRecommendation] = useState<'FIT TO WORK' | 'FIT TO WORK WITH NOTE' | 'UNFIT TO WORK'>('FIT TO WORK');
  const [note, setNote] = useState<string>('');
  const [finishTime, setFinishTime] = useState<string>(() => {
    const now = new Date();
    // format as YYYY-MM-DDTHH:mm
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return localIso;
  });

  const [stepError, setStepError] = useState<string>('');

  // DRIVER HEALTH MODULE STATES
  const [previousActiveRecord, setPreviousActiveRecord] = useState<DriverHealthRecord | null>(null);
  const [previousEvaluationText, setPreviousEvaluationText] = useState<string>('');
  const [previousEvaluationStatus, setPreviousEvaluationStatus] = useState<'ACTIVE' | 'SOLVED'>('ACTIVE');
  const [checkingHealthRecord, setCheckingHealthRecord] = useState(false);

  // New Health Complaint for current examination (Step 6)
  const [hasNewHealthComplaint, setHasNewHealthComplaint] = useState(false);
  const [newIndication, setNewIndication] = useState<string>('');
  const [newAnalyze, setNewAnalyze] = useState<string>('');
  const [newMeasurement, setNewMeasurement] = useState<string>('');
  const [newSelectedVitamins, setNewSelectedVitamins] = useState<{ vitaminId: string; name: string; quantity: number; unit: string }[]>([]);

  // Master data for health & medical inventory
  const [masterIndications, setMasterIndications] = useState<HealthIndication[]>([]);
  const [masterVitamins, setMasterVitamins] = useState<VitaminItem[]>([]);
  const [poolInventoryList, setPoolInventoryList] = useState<PoolInventoryItem[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      getPoolInventory(selectedLocation)
        .then((inv) => setPoolInventoryList(inv))
        .catch(() => {});
    }
  }, [selectedLocation]);

  const loadInitialData = async () => {
    try {
      const [dList, locList, indList, vitList, initialPoolInv] = await Promise.all([
        getDrivers(),
        getLocations(),
        getHealthIndications(),
        getVitamins(),
        getPoolInventory(selectedLocation),
      ]);
      setAllDrivers(dList);
      setFilteredDrivers(dList.filter((d) => d.status === 'ACTIVE'));
      setAvailableLocations(locList.filter((l) => l.status === 'ACTIVE'));
      setMasterIndications(indList.filter((i) => i.status === 'ACTIVE'));
      setMasterVitamins(vitList.filter((v) => v.status === 'ACTIVE'));
      setPoolInventoryList(initialPoolInv);
      if (indList.length > 0) {
        setNewIndication(indList[0].name);
      }

      if (!currentUser?.locationName && !currentUser?.locationId && locList.length > 0) {
        const tanahMerdeka = locList.find((l) => l.locationName.toLowerCase().includes('tanah merdeka'));
        if (tanahMerdeka) {
          setSelectedLocation(tanahMerdeka.locationName);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchDriver = (queryText: string) => {
    setDriverSearchQuery(queryText);
    const q = queryText.trim().toLowerCase();
    if (!q) {
      setFilteredDrivers(allDrivers.filter((d) => d.status === 'ACTIVE'));
      return;
    }
    const filtered = allDrivers.filter(
      (d) =>
        d.status === 'ACTIVE' &&
        (d.driverId.toLowerCase().includes(q) ||
          d.fullName.toLowerCase().includes(q) ||
          d.driverGroupId.toLowerCase().includes(q))
    );
    setFilteredDrivers(filtered);
  };

  const handleSelectDriver = async (drv: Driver) => {
    setSelectedDriver(drv);
    setStepError('');
    setCheckingHealthRecord(true);
    try {
      const prevRec = await getActiveHealthRecordForDriver(drv.driverId);
      if (prevRec) {
        setPreviousActiveRecord(prevRec);
        setPreviousEvaluationText(prevRec.evaluation || '');
        setPreviousEvaluationStatus(prevRec.status || 'ACTIVE');
      } else {
        setPreviousActiveRecord(null);
        setPreviousEvaluationText('');
        setPreviousEvaluationStatus('ACTIVE');
      }
    } catch (e) {
      console.error('Error fetching driver active health record:', e);
      setPreviousActiveRecord(null);
    } finally {
      setCheckingHealthRecord(false);
    }
  };

  const handleQuickAddSuccess = (newDrv: Driver) => {
    setAllDrivers((prev) => [newDrv, ...prev]);
    setSelectedDriver(newDrv);
    setDriverSearchQuery(newDrv.driverId);
    showToast(`Driver ${newDrv.fullName} (${newDrv.driverId}) berhasil dipilih.`, 'success');
  };

  // Step Validations
  const validateCurrentStep = (): boolean => {
    setStepError('');
    if (currentStep === 1) {
      if (!selectedDriver) {
        setStepError('Silakan cari dan pilih Driver / Kenek terlebih dahulu.');
        return false;
      }
    } else if (currentStep === 2) {
      if (offDutySleepDuration <= 0) {
        setStepError('Durasi tidur off-duty harus lebih dari 0 jam.');
        return false;
      }
    } else if (currentStep === 3) {
      if (temperature < 34 || temperature > 42) {
        setStepError('Suhu tubuh di luar rentang fisiologis wajar (34 - 42 °C).');
        return false;
      }
      if (bloodPressureSystolic <= 0 || bloodPressureDiastolic <= 0) {
        setStepError('Tekanan darah sistolik dan diastolik wajib diisi dengan benar.');
        return false;
      }
      if (heartRate <= 0) {
        setStepError('Denyut nadi wajib diisi.');
        return false;
      }
    } else if (currentStep === 6) {
      const isNoteRequired =
        summary === 'FAILED' ||
        recommendation === 'FIT TO WORK WITH NOTE' ||
        recommendation === 'UNFIT TO WORK';
      if (isNoteRequired && !note.trim()) {
        setStepError('Catatan wajib diisi untuk hasil pemeriksaan ini.');
        return false;
      }
      if (hasNewHealthComplaint) {
        if (!newIndication) {
          setStepError('Silakan pilih Indikasi keluhan kesehatan driver.');
          return false;
        }
        if (!newAnalyze.trim()) {
          setStepError('Analisa nakes wajib diisi untuk keluhan kesehatan driver.');
          return false;
        }
        if (!newMeasurement.trim()) {
          setStepError('Tindakan nakes (Measurement) wajib diisi untuk keluhan kesehatan driver.');
          return false;
        }
      }
      if (!finishTime) {
        setStepError('Waktu selesai pemeriksaan wajib diisi.');
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      if (currentStep < 6) {
        setCurrentStep(currentStep + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setShowConfirmModal(true);
      }
    }
  };

  const handlePrevStep = () => {
    setStepError('');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinalSubmit = async () => {
    if (!selectedDriver) return;
    setLoading(true);
    try {
      const examDate = new Date().toISOString().split('T')[0];
      const created = await createTenkoExamination(
        {
          examinationDate: examDate,
          driverId: selectedDriver.driverId,
          driverNameSnapshot: selectedDriver.fullName,
          positionSnapshot: selectedDriver.position,
          driverGroupSnapshot: selectedDriver.driverGroupId,
          rhaJmp,
          dokJmp,
          dailyNonWorkingHours,
          offDutySleepDuration: Number(offDutySleepDuration),
          temperature: Number(temperature),
          bloodPressureSystolic: Number(bloodPressureSystolic),
          bloodPressureDiastolic: Number(bloodPressureDiastolic),
          heartRate: Number(heartRate),
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
          note: note.trim(),
          examinerUserId: currentUser?.userId || 'SYS_NAKES',
          examinerName: currentUser?.fullName || 'Ns. Ratna Sari, S.Kep',
          finishTime: new Date(finishTime).toISOString(),
          locationId: selectedLocation,
          locationNameSnapshot: selectedLocation,
        },
        {
          userId: currentUser?.userId || 'SYS_NAKES',
          fullName: currentUser?.fullName || 'Nakes Pemeriksa',
        }
      );

      // 1. If previous active health record was evaluated or solved during this examination
      if (previousActiveRecord && previousEvaluationText.trim()) {
        try {
          const docId = previousActiveRecord.recordDocumentId || previousActiveRecord.recordId;
          if (previousEvaluationStatus === 'SOLVED') {
            await solveDriverHealthRecord(
              docId,
              previousEvaluationText.trim(),
              created.tenkoId,
              {
                userId: currentUser?.userId || 'SYS_NAKES',
                fullName: currentUser?.fullName || 'Nakes Pemeriksa',
              }
            );
          } else {
            await updateDriverHealthRecord(
              docId,
              {
                evaluation: previousEvaluationText.trim(),
                status: 'ACTIVE',
              },
              {
                userId: currentUser?.userId || 'SYS_NAKES',
                fullName: currentUser?.fullName || 'Nakes Pemeriksa',
              }
            );
          }
        } catch (healthErr) {
          console.error('Error updating previous health record:', healthErr);
        }
      }

      // 2. If a new health complaint is registered in Step 6
      if (hasNewHealthComplaint && newIndication) {
        try {
          const vitaminSummary = newSelectedVitamins
            .map((v) => `${v.name} (${v.quantity} ${v.unit})`)
            .join(', ') || '-';

          await createDriverHealthRecord(
            {
              tenkoId: created.tenkoId,
              tenkoDocumentId: created.tenkoDocumentId,
              examinationDate: examDate,
              driverId: selectedDriver.driverId,
              driverName: selectedDriver.fullName,
              driverGroup: selectedDriver.driverGroupId,
              position: selectedDriver.position,
              tenkoResult: recommendation,
              indication: newIndication,
              analyze: newAnalyze.trim(),
              measurement: newMeasurement.trim(),
              vitamin: vitaminSummary,
              vitaminDetails: newSelectedVitamins,
              evaluation: '',
              status: 'ACTIVE',
              examinerName: currentUser?.fullName || 'Nakes Pemeriksa',
            },
            {
              userId: currentUser?.userId || 'SYS_NAKES',
              fullName: currentUser?.fullName || 'Nakes Pemeriksa',
            }
          );
        } catch (newHealthErr) {
          console.error('Error creating driver health record:', newHealthErr);
        }
      }

      // 3. Deduct medicine stock from the specific examination pool
      if (hasNewHealthComplaint && newSelectedVitamins.length > 0) {
        try {
          await deductPoolStockForTenko({
            locationName: selectedLocation,
            items: newSelectedVitamins,
            tenkoId: created.tenkoId,
            driverId: selectedDriver.driverId,
            driverName: selectedDriver.fullName,
            currentUser: {
              userId: currentUser?.userId || 'SYS_NAKES',
              fullName: currentUser?.fullName || 'Nakes Pemeriksa',
            },
          });
        } catch (stockDeductErr) {
          console.warn('Error deducting stock from pool inventory:', stockDeductErr);
        }
      }

      setShowConfirmModal(false);
      showToast('Pemeriksaan TENKO berhasil disimpan.', 'success');
      onSuccess(created);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Terjadi kesalahan saat menyimpan data. Silakan coba kembali.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const stepsList = [
    { num: 1, title: 'Data Driver / Kenek' },
    { num: 2, title: 'Kesiapan Kerja' },
    { num: 3, title: 'Tanda Vital' },
    { num: 4, title: 'Alcohol & Drug Test' },
    { num: 5, title: 'Fisik & Perilaku' },
    { num: 6, title: 'Hasil Pemeriksaan' },
  ];

  return (
    <div id="new-examination-stepper-container" className="max-w-4xl mx-auto space-y-6">
      {/* Top Header & Progress Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Formulir Pemeriksaan Pre-Shipment
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-1">Pemeriksaan Kesiapan TENKO</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Langkah {currentStep} dari 6</span>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
              {Math.round((currentStep / 6) * 100)}%
            </span>
          </div>
        </div>

        {/* Stepper Navigation Pills */}
        <div className="grid grid-cols-6 gap-1.5 md:gap-2">
          {stepsList.map((st) => (
            <div
              key={st.num}
              onClick={() => {
                if (st.num < currentStep || (st.num === currentStep + 1 && validateCurrentStep())) {
                  setCurrentStep(st.num);
                }
              }}
              className={`flex flex-col items-center text-center p-2 rounded-xl border transition cursor-pointer ${
                currentStep === st.num
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : currentStep > st.num
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
            >
              <span className="text-xs font-black leading-none mb-0.5">{st.num}</span>
              <span className="text-[10px] font-bold truncate max-w-full hidden md:inline">
                {st.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Error Banner */}
      {stepError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs md:text-sm font-semibold flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{stepError}</span>
        </div>
      )}

      {/* STEP CONTENT WRAPPERS */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs">
        {/* ================= STEP 1: DATA DRIVER / KENEK ================= */}
        {currentStep === 1 && (
          <div id="step-1-content" className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Langkah 1: Identifikasi Driver / Kenek & Lokasi Pool</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih lokasi pool pemeriksaan dan cari driver/kenek berdasarkan ID atau Nama Lengkap.
              </p>
            </div>

            {/* Field: Lokasi / Pool Pemeriksaan */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Lokasi / Pool Pemeriksaan TENKO</span>
                  <span className="text-rose-500">*</span>
                </label>
                {currentUser?.locationName && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                    Pool Petugas: {currentUser.locationName}
                  </span>
                )}
              </div>
              <select
                id="select-examination-location"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {availableLocations.length > 0 ? (
                  availableLocations.map((loc) => (
                    <option key={loc.locationId || loc.locationDocumentId} value={loc.locationName}>
                      {loc.locationName}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Pool Tanah Merdeka - Cilincing">Pool Tanah Merdeka - Cilincing</option>
                    <option value="Pool Marunda - Jakarta Utara">Pool Marunda - Jakarta Utara</option>
                    <option value="Pool Cikarang Central - Bekasi">Pool Cikarang Central - Bekasi</option>
                    <option value="Pool Tanjung Perak - Surabaya">Pool Tanjung Perak - Surabaya</option>
                    <option value="Pool Tanjung Emas - Semarang">Pool Tanjung Emas - Semarang</option>
                    <option value="Pool Belawan - Medan">Pool Belawan - Medan</option>
                  </>
                )}
              </select>
              <p className="text-[11px] text-slate-500">
                Pemeriksaan ini dicatat dan diarsipkan di bawah lokasi pool ini.
              </p>
            </div>

            {/* Selected Driver Banner if chosen */}
            {selectedDriver && (
              <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-300 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-200 text-blue-900">
                      {selectedDriver.position}
                    </span>
                    <h4 className="font-black text-slate-900 text-base mt-1">{selectedDriver.fullName}</h4>
                    <p className="text-xs font-mono font-bold text-blue-800">{selectedDriver.driverId} • {selectedDriver.driverGroupId}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDriver(null);
                    setPreviousActiveRecord(null);
                    setPreviousEvaluationText('');
                  }}
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline pt-1 cursor-pointer"
                >
                  Ganti Driver
                </button>
              </div>
            )}

            {/* Health Alert & Follow-up for previously active complaints */}
            {selectedDriver && checkingHealthRecord && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                <span>Memeriksa riwayat keluhan kesehatan driver...</span>
              </div>
            )}

            {selectedDriver && !checkingHealthRecord && previousActiveRecord && (
              <div className="p-5 rounded-2xl bg-amber-50/90 border-2 border-amber-300 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                    <HeartPulse className="w-4 h-4 text-amber-600 animate-pulse" />
                    <span>Driver Memiliki Catatan Keluhan Medis Aktif Sebelumnya</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                    STATUS: ACTIVE
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-amber-200 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Indikasi Keluhan:</span>
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-xs inline-block mt-0.5">
                      {previousActiveRecord.indication}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      Dicatat: {previousActiveRecord.examinationDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Vitamin Sebelumnya:</span>
                    <span className="font-bold text-emerald-800 flex items-center gap-1 mt-0.5">
                      <Pill className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {previousActiveRecord.vitamin || 'Tidak ada'}
                    </span>
                  </div>
                  <div className="md:col-span-2 pt-1 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Analisa & Tindakan Sebelumnya:</span>
                    <p className="text-slate-700 font-medium mt-0.5">
                      {previousActiveRecord.analyze} — <span className="italic">{previousActiveRecord.measurement}</span>
                    </p>
                  </div>
                </div>

                {/* Follow-up Evaluation Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Evaluation (Evaluasi Nakes pada TENKO Hari Ini)
                  </label>
                  <textarea
                    rows={2}
                    value={previousEvaluationText}
                    onChange={(e) => setPreviousEvaluationText(e.target.value)}
                    placeholder="Tanyakan keluhan driver hari ini: apakah pusing sudah hilang, tensi membaik, atau masih ada keluhan..."
                    className="w-full px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                {/* Status Decision: ACTIVE vs SOLVED */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <span className="text-xs font-bold text-slate-700">Hasil Evaluasi Hari Ini:</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviousEvaluationStatus('SOLVED')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        previousEvaluationStatus === 'SOLVED'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Sudah Pulih / Sembuh (SOLVED)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviousEvaluationStatus('ACTIVE')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        previousEvaluationStatus === 'ACTIVE'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Masih Ada Keluhan (ACTIVE)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Driver Search Input */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Cari Driver / Kenek
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  id="input-search-driver-exam"
                  type="text"
                  value={driverSearchQuery}
                  onChange={(e) => handleSearchDriver(e.target.value)}
                  placeholder="Ketik Driver ID (contoh: DRV-00125) atau Nama Driver..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm font-medium"
                />
              </div>
            </div>

            {/* Driver Search Results */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>Hasil Pencarian Driver ({filteredDrivers.length})</span>
                <button
                  type="button"
                  id="btn-open-quick-add-exam"
                  onClick={() => setIsQuickAddOpen(true)}
                  className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 normal-case"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  + Tambah Driver/Kenek Baru
                </button>
              </div>

              {filteredDrivers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-800">Data Driver/Kenek tidak ditemukan.</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Driver dengan ID atau Nama tersebut belum terdaftar dalam master data. Anda dapat langsung mendaftarkannya sekarang.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddOpen(true)}
                    className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                  >
                    + Tambah Driver/Kenek Sekarang
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {filteredDrivers.map((drv) => {
                    const isSelected = selectedDriver?.driverId === drv.driverId;
                    return (
                      <div
                        key={drv.driverDocumentId}
                        id={`driver-card-${drv.driverId}`}
                        onClick={() => handleSelectDriver(drv)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                              {drv.driverId}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {drv.position}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 text-sm truncate">{drv.fullName}</p>
                          <p className="text-xs text-slate-500 truncate">{drv.driverGroupId}</p>
                        </div>

                        <div className="shrink-0">
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5 text-blue-600" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-slate-300" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 2: KESIAPAN KERJA ================= */}
        {currentStep === 2 && (
          <div id="step-2-content" className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Langkah 2: Kesiapan Kerja & Waktu Istirahat</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluasi kesiapan regulasi RHA-JMP, DOK-JMP, dan durasi istirahat pra-tugas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Field 8: RHA-JMP */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  RHA - JMP <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRhaJmp('READY')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition ${
                      rhaJmp === 'READY'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    SIAP
                  </button>
                  <button
                    type="button"
                    onClick={() => setRhaJmp('NOT READY')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition ${
                      rhaJmp === 'NOT READY'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    TIDAK SIAP
                  </button>
                </div>
              </div>

              {/* Field 9: DOK JMP */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  DOK - JMP <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDokJmp('READY')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition ${
                      dokJmp === 'READY'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    SIAP
                  </button>
                  <button
                    type="button"
                    onClick={() => setDokJmp('NOT READY')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition ${
                      dokJmp === 'NOT READY'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    TIDAK SIAP
                  </button>
                </div>
              </div>

              {/* Field 10: Daily Non-Working Hours */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Daily Non-Working Hours <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDailyNonWorkingHours('< 11 HOURS')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition ${
                      dailyNonWorkingHours === '< 11 HOURS'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    &lt; 11 JAM
                  </button>
                  <button
                    type="button"
                    onClick={() => setDailyNonWorkingHours('>= 11 HOURS')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition ${
                      dailyNonWorkingHours === '>= 11 HOURS'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ≥ 11 JAM
                  </button>
                </div>
              </div>

              {/* Field 11: Off-Duty Sleep Duration */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Durasi Tidur Off-Duty (Jam) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="input-sleep-duration"
                    type="number"
                    step="0.5"
                    min="1"
                    max="24"
                    value={offDutySleepDuration}
                    onChange={(e) => setOffDutySleepDuration(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-bold text-sm bg-white"
                    required
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-semibold text-slate-400">Jam</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Standar ideal keselamatan: minimal 7-8 jam istirahat pulas.</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: TANDA VITAL ================= */}
        {currentStep === 3 && (
          <div id="step-3-content" className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Langkah 3: Pengukuran Tanda Vital</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Catat suhu tubuh, tensi darah, dan denyut nadi pengemudi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Field 12: Suhu Tubuh */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-blue-600" />
                    Suhu Tubuh (°C) <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    temperature >= 36.0 && temperature <= 37.5
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {temperature >= 36.0 && temperature <= 37.5 ? 'Normal' : 'Perhatian'}
                  </span>
                </div>
                <input
                  id="input-temperature"
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-bold text-sm bg-white"
                  required
                />
              </div>

              {/* Field 16: Denyut Nadi */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-600" />
                    Denyut Nadi (BPM) <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    heartRate >= 60 && heartRate <= 100
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {heartRate >= 60 && heartRate <= 100 ? 'Normal (60-100)' : 'Perlu Evaluasi'}
                  </span>
                </div>
                <input
                  id="input-heart-rate"
                  type="number"
                  value={heartRate}
                  onChange={(e) => setHeartRate(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-bold text-sm bg-white"
                  required
                />
              </div>
            </div>

            {/* Blood Pressure Fields with Auto Formula Result */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Tekanan Darah (Blood Pressure)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {/* Field 13: Systolic */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Sistolik (mmHg) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-bp-systolic"
                    type="number"
                    value={bloodPressureSystolic}
                    onChange={(e) => setBloodPressureSystolic(parseInt(e.target.value) || 0)}
                    placeholder="120"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 font-bold text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    required
                  />
                </div>

                {/* Field 14: Diastolic */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Diastolik (mmHg) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-bp-diastolic"
                    type="number"
                    value={bloodPressureDiastolic}
                    onChange={(e) => setBloodPressureDiastolic(parseInt(e.target.value) || 0)}
                    placeholder="80"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 font-bold text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    required
                  />
                </div>

                {/* Field 15: Hasil Tekanan Darah (Auto formula read-only) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Hasil Tekanan Darah (Auto Formula)
                  </label>
                  <div className="px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/70 font-mono font-black text-blue-900 text-sm flex items-center justify-between">
                    <span>{bloodPressureSystolic}/{bloodPressureDiastolic} mmHg</span>
                    <span className="text-[10px] text-blue-600 font-bold uppercase">Tercatat</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: ALCOHOL & DRUG TEST ================= */}
        {currentStep === 4 && (
          <div id="step-4-content" className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Langkah 4: Skrining Zat & Alkohol (BAC)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengujian kadar alkohol (breathalyzer BAC) dan rapid test narkoba/zat adiktif.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Field 17: Alcohol Test */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Alcohol Test (BAC) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAlcoholTest('NEGATIVE')}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition ${
                      alcoholTest === 'NEGATIVE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    NEGATIF
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlcoholTest('POSITIVE')}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition ${
                      alcoholTest === 'POSITIVE'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    POSITIF
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlcoholTest('NO TEST')}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition ${
                      alcoholTest === 'NO TEST'
                        ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    TIDAK DITES
                  </button>
                </div>
              </div>

              {/* Field 18: Drug Test */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Drug Test (Narkoba) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDrugTest('NEGATIVE')}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition ${
                      drugTest === 'NEGATIVE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    NEGATIF
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrugTest('POSITIVE')}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition ${
                      drugTest === 'POSITIVE'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    POSITIF
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrugTest('NO TEST')}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition ${
                      drugTest === 'NO TEST'
                        ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    TIDAK DITES
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 5: PEMERIKSAAN FISIK & PERILAKU (11 ITEMS) ================= */}
        {currentStep === 5 && (
          <div id="step-5-content" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Langkah 5: Observasi Fisik & Perilaku (11 Parameter)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lakukan inspeksi visual, evaluasi kognitif/perilaku, tes keseimbangan tubuh, dan wawancara interaktif.
                </p>
              </div>

              {/* Quick Set All Normal button */}
              <button
                type="button"
                onClick={() => {
                  setAppearance('NORMAL');
                  setEyes('NORMAL');
                  setFace('NORMAL');
                  setHair('NORMAL');
                  setEmotionalRegulation('NORMAL');
                  setProblemSolving('NORMAL');
                  setSelfAwareness('NORMAL');
                  setCommunication('NORMAL');
                  setDecisionMaking('NORMAL');
                  setBalanceTest('NORMAL');
                  setInterview('NORMAL');
                  showToast('Semua 11 parameter observasi diatur ke NORMAL.', 'info');
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition"
              >
                Set Semua NORMAL
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Item 1: Appearance */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">1. Penampilan (Appearance)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAppearance('NORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${appearance === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppearance('ABNORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${appearance === 'ABNORMAL' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'}`}
                  >
                    TIDAK NORMAL
                  </button>
                </div>
              </div>

              {/* Item 2: Eyes */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">2. Mata (Eyes)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEyes('NORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${eyes === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setEyes('ABNORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${eyes === 'ABNORMAL' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'}`}
                  >
                    TIDAK NORMAL
                  </button>
                </div>
              </div>

              {/* Item 3: Face */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">3. Wajah (Face)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFace('NORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${face === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setFace('ABNORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${face === 'ABNORMAL' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'}`}
                  >
                    TIDAK NORMAL
                  </button>
                </div>
              </div>

              {/* Item 4: Hair */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">4. Rambut (Hair)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHair('NORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${hair === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setHair('ABNORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${hair === 'ABNORMAL' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'}`}
                  >
                    TIDAK NORMAL
                  </button>
                </div>
              </div>

              {/* Item 5: Emotional Regulation */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">5. Regulasi Emosi (Emotional Reg.)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEmotionalRegulation('NORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${emotionalRegulation === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmotionalRegulation('ABNORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${emotionalRegulation === 'ABNORMAL' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'}`}
                  >
                    TIDAK NORMAL
                  </button>
                </div>
              </div>

              {/* Item 6: Problem Solving */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">6. Problem Solving</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setProblemSolving('NORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${problemSolving === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setProblemSolving('ABNORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${problemSolving === 'ABNORMAL' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'}`}
                  >
                    TIDAK NORMAL
                  </button>
                </div>
              </div>

              {/* Item 7: Self-Awareness */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">7. Kesadaran Diri (Self-Awareness)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelfAwareness('NORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${selfAwareness === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelfAwareness('ABNORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${selfAwareness === 'ABNORMAL' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'}`}
                  >
                    TIDAK NORMAL
                  </button>
                </div>
              </div>

              {/* Item 8: Communication */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">8. Komunikasi (Communication)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCommunication('NORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${communication === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommunication('ABNORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${communication === 'ABNORMAL' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'}`}
                  >
                    TIDAK NORMAL
                  </button>
                </div>
              </div>

              {/* Item 9: Decision Making */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">9. Pengambilan Keputusan (Decision Making)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDecisionMaking('NORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${decisionMaking === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionMaking('ABNORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${decisionMaking === 'ABNORMAL' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'}`}
                  >
                    TIDAK NORMAL
                  </button>
                </div>
              </div>

              {/* Item 10: Balance Test */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">10. Tes Keseimbangan (Balance Test)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBalanceTest('NORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${balanceTest === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceTest('ABNORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${balanceTest === 'ABNORMAL' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'}`}
                  >
                    TIDAK NORMAL
                  </button>
                </div>
              </div>

              {/* Item 11: Interview */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">11. Wawancara (Interview)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInterview('NORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${interview === 'NORMAL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    NORMAL
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterview('ABNORMAL')}
                    className={`py-2 text-xs font-bold rounded-lg border ${interview === 'ABNORMAL' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700'}`}
                  >
                    TIDAK NORMAL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 6: HASIL PEMERIKSAAN ================= */}
        {currentStep === 6 && (
          <div id="step-6-content" className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Langkah 6: Penetapan Hasil & Rekomendasi</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih status kesimpulan medis dan rekomendasi keberangkatan tugas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Field 28: Summary (LULUS / TIDAK LULUS) */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Summary Pemeriksaan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSummary('PASSED');
                      if (recommendation === 'UNFIT TO WORK') setRecommendation('FIT TO WORK');
                    }}
                    className={`py-3.5 px-4 rounded-xl text-xs font-black border flex items-center justify-center gap-2 transition ${
                      summary === 'PASSED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    LULUS (PASSED)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSummary('FAILED');
                      setRecommendation('UNFIT TO WORK');
                    }}
                    className={`py-3.5 px-4 rounded-xl text-xs font-black border flex items-center justify-center gap-2 transition ${
                      summary === 'FAILED'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    TIDAK LULUS (FAILED)
                  </button>
                </div>
              </div>

              {/* Field 29: Recommendation */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Rekomendasi Nakes <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select-recommendation"
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value as any)}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-300 font-bold text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                >
                  <option value="FIT TO WORK">FIT TO WORK</option>
                  <option value="FIT TO WORK WITH NOTE">FIT TO WORK WITH NOTE</option>
                  <option value="UNFIT TO WORK">UNFIT TO WORK</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  {recommendation === 'FIT TO WORK' && 'Pengemudi siap mengoperasikan armada secara penuh.'}
                  {recommendation === 'FIT TO WORK WITH NOTE' && 'Boleh bertugas dengan syarat pemantauan medis / istirahat berkala.'}
                  {recommendation === 'UNFIT TO WORK' && 'Pengemudi DILARANG menjalankan tugas pengiriman logistik.'}
                </p>
              </div>
            </div>

            {/* Field 30: Note (Catatan) with conditional requirement */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Catatan Pemeriksaan / Instruksi Medis
                  {(summary === 'FAILED' || recommendation !== 'FIT TO WORK') && (
                    <span className="text-rose-500"> * (Wajib Diisi)</span>
                  )}
                </label>
                {(summary === 'FAILED' || recommendation !== 'FIT TO WORK') && (
                  <span className="text-[11px] text-rose-600 font-semibold">
                    Wajib diisi karena status FAILED / Dengan Catatan / UNFIT
                  </span>
                )}
              </div>
              <textarea
                id="textarea-examination-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tuliskan catatan observasi, rekomendasi obat/vitamin, atau alasan penetapan status..."
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm"
              />
            </div>

            {/* Field 31: Finish Time (Waktu Selesai - Editable) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Waktu Selesai Pemeriksaan (Finish Time) <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-slate-500">Dapat disesuaikan jika pencatatan dilakukan pasca pemeriksaan fisik.</p>
              </div>

              <input
                id="input-finish-time"
                type="datetime-local"
                value={finishTime}
                onChange={(e) => setFinishTime(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                required
              />
            </div>

            {/* Field 32: DRIVER HEALTH COMPLAINT & VITAMIN SECTION */}
            <div className="p-5 rounded-2xl bg-rose-50/60 border-2 border-rose-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <HeartPulse className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Driver Health: Keluhan Medis & Vitamin
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Pencatatan keluhan driver untuk dipantau nakes pada menu Driver Health & TENKO berikutnya
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer bg-white px-3.5 py-2 rounded-xl border border-rose-200 shadow-2xs self-start sm:self-auto hover:bg-rose-50/50 transition">
                  <input
                    type="checkbox"
                    id="checkbox-has-health-complaint"
                    checked={hasNewHealthComplaint}
                    onChange={(e) => setHasNewHealthComplaint(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-rose-900 whitespace-nowrap">
                    Ada Keluhan / Beri Vitamin
                  </span>
                </label>
              </div>

              {hasNewHealthComplaint && (
                <div className="space-y-4 pt-3 border-t border-rose-200/70 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Indication Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Indication (Keluhan / Diagnosa) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="select-health-indication"
                        value={newIndication}
                        onChange={(e) => setNewIndication(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-rose-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
                        required
                      >
                        <option value="">-- Pilih Indikasi Keluhan --</option>
                        {masterIndications.map((ind) => (
                          <option key={ind.indicationId} value={ind.name}>
                            {ind.name} ({ind.note})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quick result hint */}
                    <div className="bg-white p-3 rounded-xl border border-rose-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Hasil TENKO:</span>
                        <span className="font-extrabold text-slate-900">{recommendation}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-900">
                        Status Awal: ACTIVE
                      </span>
                    </div>
                  </div>

                  {/* Analyze (freetext) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Analyze (Analisa Nakes) <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="input-health-analyze"
                      rows={2}
                      value={newAnalyze}
                      onChange={(e) => setNewAnalyze(e.target.value)}
                      placeholder="Contoh: Tekanan darah 145/95 mmHg, driver mengeluh pusing dan pegal leher..."
                      className="w-full px-3.5 py-2 bg-white border border-rose-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 resize-none"
                      required
                    />
                  </div>

                  {/* Measurement (freetext) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Measurement (Tindakan Medis / Penanganan Nakes) <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="input-health-measurement"
                      rows={2}
                      value={newMeasurement}
                      onChange={(e) => setNewMeasurement(e.target.value)}
                      placeholder="Contoh: Istirahat di klinik 30 menit, edukasi konsumsi air putih 2L, anjurkan tidur cukup..."
                      className="w-full px-3.5 py-2 bg-white border border-rose-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 resize-none"
                      required
                    />
                  </div>

                  {/* Vitamin Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Vitamin / Suplemen yang Diberikan</span>
                    </label>
                    <div className="bg-white border border-rose-200 rounded-xl p-3 space-y-2 max-h-44 overflow-y-auto">
                      {masterVitamins.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada master data vitamin aktif.</p>
                      ) : (
                        masterVitamins.map((vit) => {
                          const isSelected = newSelectedVitamins.some((v) => v.vitaminId === vit.vitaminId);
                          const selItem = newSelectedVitamins.find((v) => v.vitaminId === vit.vitaminId);
                          const poolItem = poolInventoryList.find(
                            (p) => p.vitaminId === vit.vitaminId || p.vitaminName.toLowerCase() === vit.name.toLowerCase()
                          );
                          const currentStock = poolItem ? poolItem.currentStock : undefined;

                          return (
                            <div
                              key={vit.vitaminId}
                              className={`flex items-center justify-between p-2 rounded-lg border transition ${
                                isSelected
                                  ? 'bg-emerald-50 border-emerald-300'
                                  : 'bg-slate-50/70 border-slate-200'
                              }`}
                            >
                              <label className="flex items-center gap-2 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setNewSelectedVitamins(newSelectedVitamins.filter((v) => v.vitaminId !== vit.vitaminId));
                                    } else {
                                      setNewSelectedVitamins([
                                        ...newSelectedVitamins,
                                        { vitaminId: vit.vitaminId, name: vit.name, quantity: 1, unit: vit.dosageUnit },
                                      ]);
                                    }
                                  }}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div>
                                  <span className="text-xs font-bold text-slate-900 block">{vit.name}</span>
                                  <span className="text-[10px] text-slate-500">
                                    {vit.category} • Satuan: {vit.dosageUnit}
                                    {currentStock !== undefined && (
                                      <span
                                        className={`ml-2 font-bold ${
                                          currentStock <= 0
                                            ? 'text-rose-600 font-black'
                                            : currentStock <= (poolItem?.minStockThreshold || 30)
                                            ? 'text-amber-600 font-black'
                                            : 'text-emerald-700'
                                        }`}
                                      >
                                        • Sisa Stok: {currentStock}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </label>

                              {isSelected && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-slate-500">Jumlah:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={selItem?.quantity || 1}
                                    onChange={(e) => {
                                      const qty = parseInt(e.target.value, 10) || 1;
                                      setNewSelectedVitamins(
                                        newSelectedVitamins.map((item) =>
                                          item.vitaminId === vit.vitaminId ? { ...item, quantity: Math.max(1, qty) } : item
                                        )
                                      );
                                    }}
                                    className="w-12 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs font-bold text-center"
                                  />
                                  <span className="text-[10px] text-slate-500">{vit.dosageUnit}</span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION ACTIONS */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
          {currentStep > 1 ? (
            <button
              type="button"
              id="btn-prev-step"
              onClick={handlePrevStep}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-medium text-xs transition"
            >
              Batal
            </button>
          )}

          <button
            type="button"
            id="btn-next-step"
            onClick={handleNextStep}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <span>{currentStep === 6 ? 'Review & Simpan' : 'Selanjutnya'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CONFIRMATION / REVIEW DIALOG */}
      {showConfirmModal && selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 md:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Konfirmasi Hasil Pemeriksaan</h3>
                <p className="text-xs text-slate-500">Periksa kembali ringkasan sebelum menyimpan data permanen ke database.</p>
              </div>
            </div>

            {/* Summary Highlights */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Lokasi / Pool:</span>
                <span className="font-bold text-blue-700">{selectedLocation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Driver / Kenek:</span>
                <span className="font-bold text-slate-900">{selectedDriver.fullName} ({selectedDriver.driverId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Posisi & Group:</span>
                <span className="font-medium text-slate-800">{selectedDriver.position} • {selectedDriver.driverGroupId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tanda Vital (BP / Suhu):</span>
                <span className="font-mono font-bold text-slate-900">{bloodPressureSystolic}/{bloodPressureDiastolic} mmHg • {temperature}°C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Summary Medis:</span>
                <span className={`font-bold ${summary === 'PASSED' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {summary === 'PASSED' ? 'LULUS (PASSED)' : 'TIDAK LULUS (FAILED)'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-700 font-bold uppercase">Rekomendasi Akhir:</span>
                <StatusBadge type="recommendation" value={recommendation} size="sm" />
              </div>
              {note && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">Catatan:</span>
                  <p className="italic text-slate-700 bg-white p-2 rounded border border-slate-200">{note}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition"
              >
                Kembali Edit
              </button>

              <button
                type="button"
                id="btn-confirm-save-examination"
                onClick={handleFinalSubmit}
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/25 flex items-center gap-2 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Firestore...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan Hasil Pemeriksaan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Driver Modal */}
      <QuickAddDriverModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={handleQuickAddSuccess}
        initialDriverId={driverSearchQuery.toUpperCase().startsWith('DRV') || driverSearchQuery.toUpperCase().startsWith('KNK') ? driverSearchQuery : ''}
        initialFullName={!driverSearchQuery.toUpperCase().startsWith('DRV') && !driverSearchQuery.toUpperCase().startsWith('KNK') ? driverSearchQuery : ''}
      />
    </div>
  );
};
