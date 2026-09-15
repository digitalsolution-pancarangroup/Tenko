export type UserRole = 'SUPER_ADMIN' | 'NAKES' | 'SECURITY';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';
export type MasterStatus = AccountStatus;
export type DriverPosition = 'DRIVER' | 'KENEK';

export type ReadinessStatus = 'READY' | 'NOT READY';
export type NonWorkingHoursOption = '< 11 HOURS' | '>= 11 HOURS';
export type ScreeningResult = 'POSITIVE' | 'NEGATIVE' | 'NO TEST';
export type PhysicalObservationStatus = 'NORMAL' | 'ABNORMAL';
export type ExaminationSummary = 'PASSED' | 'FAILED';
export type ExaminationRecommendation = 'FIT TO WORK' | 'FIT TO WORK WITH NOTE' | 'UNFIT TO WORK';

export interface User {
  userId: string;
  authUid?: string;
  fullName: string;
  email: string;
  role: UserRole;
  phoneNumber?: string;
  sipNumber?: string;
  locationId?: string;
  locationName?: string;
  status: AccountStatus;
  tempPassword?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Nakes {
  nakesDocumentId?: string;
  nakesId: string; // e.g. NKS-001
  userId?: string;
  fullName: string;
  email?: string;
  sipNumber: string;
  phoneNumber: string;
  locationId?: string;
  status: AccountStatus;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Driver {
  driverDocumentId: string;
  driverNumber?: string | number;
  driverId: string; // e.g. DRV-00125 or 301240143
  fullName: string;
  driverGroupId: string;
  joinDate?: string;
  terminateDate?: string;
  position: DriverPosition;
  status: AccountStatus;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface TenkoExamination {
  tenkoDocumentId: string;
  sequenceNumber?: number;
  tenkoId: string; // e.g. TENKO-20260828-0001
  examinationDate: string; // YYYY-MM-DD
  driverId: string;
  driverNameSnapshot: string;
  positionSnapshot: DriverPosition;
  driverGroupSnapshot: string;
  
  // Section B: Kesiapan Kerja
  rhaJmp: ReadinessStatus;
  dokJmp: ReadinessStatus;
  dailyNonWorkingHours: NonWorkingHoursOption;
  offDutySleepDuration: number; // in hours

  // Section C: Tanda Vital
  temperature: number; // in Celsius
  bloodPressureSystolic: number; // in mmHg
  bloodPressureDiastolic: number; // in mmHg
  bloodPressureResult: string; // e.g. "120/80 mmHg"
  heartRate: number; // BPM

  // Section D: Screening
  alcoholTest: ScreeningResult;
  drugTest: ScreeningResult;

  // Section E: Pemeriksaan Fisik & Perilaku (11 Items)
  appearance: PhysicalObservationStatus;
  eyes: PhysicalObservationStatus;
  face: PhysicalObservationStatus;
  hair: PhysicalObservationStatus;
  emotionalRegulation: PhysicalObservationStatus;
  problemSolving: PhysicalObservationStatus;
  selfAwareness: PhysicalObservationStatus;
  communication: PhysicalObservationStatus;
  decisionMaking: PhysicalObservationStatus;
  balanceTest: PhysicalObservationStatus;
  interview: PhysicalObservationStatus;

  // Section F: Hasil Pemeriksaan
  summary: ExaminationSummary;
  recommendation: ExaminationRecommendation;
  note: string;

  // Section G: Informasi Pemeriksaan & Nakes
  examinerUserId: string;
  examinerName: string;
  locationId?: string;
  locationNameSnapshot?: string;
  finishTime: string; // Editable Date & Time

  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface DriverGroup {
  groupDocumentId?: string;
  groupId: string; // e.g. GRP-TETAP
  groupName: string; // e.g. TETAP
  driverGroupId?: string;
  driverGroupName?: string;
  description?: string;
  status: AccountStatus;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Location {
  locationDocumentId?: string;
  locationId: string; // e.g. LOC-MRD
  locationName: string; // e.g. Pool Marunda - Jakarta Utara
  address?: string;
  status: AccountStatus;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type LocationMaster = Location;

export type HealthCaseStatus = 'ACTIVE' | 'SOLVED';

export interface HealthIndication {
  indicationDocumentId?: string;
  indicationId: string; // e.g. IND-01
  name: string; // e.g. "Hipertensi", "Rest Hours"
  note: string; // e.g. "Tekanan darah cenderung tinggi"
  status: AccountStatus;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface VitaminItem {
  vitaminDocumentId?: string;
  vitaminId: string; // e.g. VTM-01
  name: string; // e.g. "Vitamin C 500mg"
  category?: string; // e.g. "Suplemen Stamina", "Daya Tahan Tubuh"
  dosageUnit: string; // e.g. "Tablet", "Kapsul", "Strip", "Botol"
  description?: string;
  defaultMinStock?: number; // e.g. 30
  status: AccountStatus;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PoolInventoryItem {
  inventoryId: string; // docId: e.g. loc-01_vtm-01
  locationId?: string; // e.g. LOC-01
  locationName: string; // e.g. Pool Marunda - Jakarta Utara
  vitaminId: string;
  vitaminName: string;
  category?: string;
  dosageUnit: string;
  currentStock: number;
  minStockThreshold: number;
  lastRestockDate?: string;
  updatedAt: string;
  updatedBy?: string;
}

export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

export interface StockMovement {
  movementId: string; // e.g. MOV-202609-0001
  movementType: StockMovementType;
  locationId?: string;
  locationName: string;
  vitaminId: string;
  vitaminName: string;
  quantity: number;
  previousStock: number;
  finalStock: number;
  dosageUnit: string;
  referenceId?: string; // Tenko ID (e.g. TENKO-20260904-0001) or Surat Jalan / Bukti Terima (e.g. DROP-PO-092)
  driverId?: string;
  driverName?: string;
  notes?: string;
  performedBy: string;
  performedByName: string;
  timestamp: string;
}

export interface VitaminMasterWithStock extends VitaminItem {
  totalStockAllPools: number;
  poolBreakdown: {
    locationName: string;
    stock: number;
    minThreshold: number;
    status: 'SAFE' | 'LOW' | 'OUT';
  }[];
}

export interface DriverHealthRecord {
  recordDocumentId?: string;
  recordId: string; // e.g. DH-202609-0001
  tenkoId?: string; // ID Tenko terkait
  tenkoDocumentId?: string;
  examinationDate: string; // YYYY-MM-DD
  driverId: string;
  driverName: string;
  driverGroup: string;
  position: DriverPosition;
  tenkoResult: ExaminationRecommendation; // 'FIT TO WORK' | 'FIT TO WORK WITH NOTE' | 'UNFIT TO WORK'
  
  // Clinical follow-up data matching user format:
  // NO | ID DATA | ID DRIVER | NAMA DRIVER / KENEK | GROUP | RESULT TENKO | INDICATION | ANALYZE | Measurement | Vitamin | Evaluation
  indication: string; // Dropdown (from Master Indikasi / Unhealthy)
  analyze: string; // Freetext
  measurement: string; // Freetext
  vitamin: string; // Freetext / summary string, e.g. "Vitamin B Kompleks (1 Tab), Vitamin C (1 Tab)"
  vitaminDetails?: { vitaminId?: string; name: string; quantity: number; unit?: string }[];
  evaluation?: string; // Freetext (diisi ketika tenko berikutnya / follow up)
  
  status: HealthCaseStatus; // 'ACTIVE' | 'SOLVED'
  solvedAt?: string;
  solvedBy?: string;
  solvedTenkoId?: string;

  createdAt: string;
  createdBy: string;
  examinerName?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AuditLog {
  auditLogId?: string;
  logId?: string;
  module?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | string;
  entity: 'DRIVER' | 'TENKO_EXAMINATION' | 'DRIVER_GROUP' | 'LOCATION' | 'NAKES' | 'HEALTH_INDICATION' | 'VITAMIN' | 'DRIVER_HEALTH' | string;
  entityId: string;
  previousValue?: any;
  newValue?: any;
  details?: any;
  userId: string;
  userName: string;
  timestamp: string;
}
