import {
  ReadinessStatus,
  NonWorkingHoursOption,
  ScreeningResult,
  PhysicalObservationStatus,
  ExaminationSummary,
  ExaminationRecommendation,
} from '../types';

export interface BloodPressureEvaluation {
  category: 'NORMAL' | 'PRE_HIPERTENSI' | 'HIPERTENSI_1' | 'HIPERTENSI_2' | 'HIPOTENSI';
  label: string;
  resultString: string;
  isAbnormal: boolean;
  isCritical: boolean;
}

/**
 * Evaluates Blood Pressure based on standard clinical TENKO guidelines.
 * Systolic & Diastolic thresholds:
 * - Hipotensi: Systolic < 90 OR Diastolic < 60
 * - Normal: Systolic 90-119 AND Diastolic 60-79
 * - Pre-Hipertensi: Systolic 120-139 OR Diastolic 80-89
 * - Hipertensi Tingkat 1: Systolic 140-159 OR Diastolic 90-99
 * - Hipertensi Tingkat 2 (Kritis): Systolic >= 160 OR Diastolic >= 100
 */
export function evaluateBloodPressure(
  systolic: number,
  diastolic: number
): BloodPressureEvaluation {
  const sys = Number(systolic) || 0;
  const dia = Number(diastolic) || 0;

  if (sys === 0 || dia === 0) {
    return {
      category: 'NORMAL',
      label: 'Belum Diukur',
      resultString: `${sys}/${dia} mmHg`,
      isAbnormal: false,
      isCritical: false,
    };
  }

  if (sys >= 160 || dia >= 100) {
    return {
      category: 'HIPERTENSI_2',
      label: 'Hipertensi Tk 2 (Kritis)',
      resultString: `${sys}/${dia} mmHg (Hipertensi Tk 2)`,
      isAbnormal: true,
      isCritical: true,
    };
  }

  if (sys >= 140 || dia >= 90) {
    return {
      category: 'HIPERTENSI_1',
      label: 'Hipertensi Tk 1',
      resultString: `${sys}/${dia} mmHg (Hipertensi Tk 1)`,
      isAbnormal: true,
      isCritical: false,
    };
  }

  if (sys >= 120 || dia >= 80) {
    return {
      category: 'PRE_HIPERTENSI',
      label: 'Pre-Hipertensi',
      resultString: `${sys}/${dia} mmHg (Pre-Hipertensi)`,
      isAbnormal: true,
      isCritical: false,
    };
  }

  if (sys < 90 || dia < 60) {
    return {
      category: 'HIPOTENSI',
      label: 'Hipotensi (Rendah)',
      resultString: `${sys}/${dia} mmHg (Hipotensi)`,
      isAbnormal: true,
      isCritical: sys < 85 || dia < 55,
    };
  }

  return {
    category: 'NORMAL',
    label: 'Normal',
    resultString: `${sys}/${dia} mmHg (Normal)`,
    isAbnormal: false,
    isCritical: false,
  };
}

export interface TenkoEvaluationInput {
  rhaJmp: ReadinessStatus;
  dokJmp: ReadinessStatus;
  dailyNonWorkingHours: NonWorkingHoursOption;
  offDutySleepDuration: number;
  temperature: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  alcoholTest: ScreeningResult;
  drugTest: ScreeningResult;
  appearance: PhysicalObservationStatus;
  eyes: PhysicalObservationStatus;
  face: PhysicalObservationStatus;
  hair: PhysicalObservationStatus;
  emotionalRegulation: PhysicalObservationStatus;
  problemSolving: PhysicalObservationStatus;
  communication: PhysicalObservationStatus;
  balanceTest: PhysicalObservationStatus;
  interview: PhysicalObservationStatus;
}

export interface AutoEvaluationResult {
  summary: ExaminationSummary;
  recommendation: ExaminationRecommendation;
  reasons: string[];
  requiresNote: boolean;
}

/**
 * Computes automated clinical decision for TENKO summary and recommendation.
 */
export function calculateAutoTenkoStatus(
  input: TenkoEvaluationInput
): AutoEvaluationResult {
  const reasons: string[] = [];
  let isUnfit = false;
  let isFitWithNote = false;

  // 1. Screening Substance Check (Zero Tolerance)
  if (input.alcoholTest === 'POSITIVE') {
    isUnfit = true;
    reasons.push('Hasil Alkohol Positif (Zero Tolerance)');
  }
  if (input.drugTest === 'POSITIVE') {
    isUnfit = true;
    reasons.push('Hasil Skrining Narkoba Positif');
  }

  // 2. Body Temperature
  if (input.temperature >= 37.5) {
    isUnfit = true;
    reasons.push(`Suhu tubuh demam (${input.temperature}°C >= 37.5°C)`);
  } else if (input.temperature > 0 && input.temperature < 35.0) {
    isUnfit = true;
    reasons.push(`Suhu tubuh hipotermia (${input.temperature}°C < 35.0°C)`);
  }

  // 3. Blood Pressure
  const bpEval = evaluateBloodPressure(
    input.bloodPressureSystolic,
    input.bloodPressureDiastolic
  );
  if (bpEval.category === 'HIPERTENSI_2') {
    isUnfit = true;
    reasons.push(`Tekanan darah tinggi kritis (${bpEval.resultString})`);
  } else if (bpEval.category === 'HIPOTENSI' && bpEval.isCritical) {
    isUnfit = true;
    reasons.push(`Tekanan darah terlalu rendah (${bpEval.resultString})`);
  } else if (bpEval.category === 'HIPERTENSI_1' || bpEval.category === 'PRE_HIPERTENSI' || bpEval.category === 'HIPOTENSI') {
    isFitWithNote = true;
    reasons.push(`Tekanan darah membutuhkan perhatian: ${bpEval.label}`);
  }

  // 4. Heart Rate
  if (input.heartRate > 115) {
    isUnfit = true;
    reasons.push(`Takikardia / Denyut Nadi sangat tinggi (${input.heartRate} BPM)`);
  } else if (input.heartRate > 0 && input.heartRate < 50) {
    isUnfit = true;
    reasons.push(`Bradikardia / Denyut Nadi terlalu lambat (${input.heartRate} BPM)`);
  } else if (input.heartRate > 100 || (input.heartRate > 0 && input.heartRate < 60)) {
    isFitWithNote = true;
    reasons.push(`Denyut nadi di luar batas normal ideal (${input.heartRate} BPM)`);
  }

  // 5. Work Readiness
  if (input.rhaJmp === 'NOT READY') {
    isUnfit = true;
    reasons.push('RHA - JMP dinyatakan TIDAK SIAP');
  }
  if (input.dokJmp === 'NOT READY') {
    isUnfit = true;
    reasons.push('DOK - JMP dinyatakan TIDAK SIAP');
  }

  // 6. Sleep Duration & Non-Working Hours
  if (input.offDutySleepDuration < 4) {
    isUnfit = true;
    reasons.push(`Durasi tidur sangat kurang (${input.offDutySleepDuration} Jam < 4 Jam)`);
  } else if (input.offDutySleepDuration < 6) {
    isFitWithNote = true;
    reasons.push(`Durasi tidur kurang dari 6 jam (${input.offDutySleepDuration} Jam)`);
  }

  if (input.dailyNonWorkingHours === '< 11 HOURS') {
    isFitWithNote = true;
    reasons.push('Daily non-working hours kurang dari 11 jam');
  }

  // 7. Physical & Behavioral Observations (Critical vs Non-Critical)
  if (input.balanceTest === 'ABNORMAL') {
    isUnfit = true;
    reasons.push('Tes Keseimbangan fisik ABNORMAL (berisiko hilang kendali kemudi)');
  }
  if (input.emotionalRegulation === 'ABNORMAL') {
    isUnfit = true;
    reasons.push('Regulasi emosi ABNORMAL (risiko temperamen saat mengemudi)');
  }
  if (input.communication === 'ABNORMAL') {
    isFitWithNote = true;
    reasons.push('Komunikasi terindikasi ABNORMAL');
  }
  if (input.eyes === 'ABNORMAL') {
    isFitWithNote = true;
    reasons.push('Observasi Mata ABNORMAL (mata merah/sayu)');
  }
  if (input.face === 'ABNORMAL') {
    isFitWithNote = true;
    reasons.push('Observasi Wajah ABNORMAL (pucat/tegang)');
  }
  if (input.appearance === 'ABNORMAL') {
    isFitWithNote = true;
    reasons.push('Penampilan ABNORMAL');
  }
  if (input.hair === 'ABNORMAL') {
    isFitWithNote = true;
    reasons.push('Kondisi Rambut ABNORMAL');
  }
  if (input.problemSolving === 'ABNORMAL') {
    isFitWithNote = true;
    reasons.push('Problem Solving ABNORMAL');
  }
  if (input.interview === 'ABNORMAL') {
    isFitWithNote = true;
    reasons.push('Hasil Wawancara Nakes ABNORMAL');
  }

  // Decision formulation
  if (isUnfit) {
    return {
      summary: 'FAILED',
      recommendation: 'UNFIT TO WORK',
      reasons,
      requiresNote: true,
    };
  }

  if (isFitWithNote) {
    return {
      summary: 'PASSED',
      recommendation: 'FIT TO WORK WITH NOTE',
      reasons,
      requiresNote: true,
    };
  }

  return {
    summary: 'PASSED',
    recommendation: 'FIT TO WORK',
    reasons: ['Seluruh 33 indikator pemeriksaan dalam batas normal dan memenuhi standar kesiapan kerja.'],
    requiresNote: false,
  };
}
