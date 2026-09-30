import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { SecurityGatePassLog, TenkoExamination, GatePassStatus } from '../types';
import { logAuditAction } from './auditService';

const SAVED_SECURITY_NAME_KEY = 'tenko_security_officer_name';
const SAVED_SECURITY_LOCATION_KEY = 'tenko_security_gate_location';

/**
 * Gets the locally remembered security officer name.
 */
export function getSavedSecurityOfficerName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(SAVED_SECURITY_NAME_KEY) || '';
}

/**
 * Saves the security officer name for rapid consecutive scanning.
 */
export function saveSecurityOfficerName(name: string): void {
  if (typeof window === 'undefined') return;
  if (name && name.trim()) {
    localStorage.setItem(SAVED_SECURITY_NAME_KEY, name.trim());
  }
}

/**
 * Gets the locally remembered gate location.
 */
export function getSavedSecurityGateLocation(): string {
  if (typeof window === 'undefined') return 'Gate Utama - Pool Cilincing';
  return localStorage.getItem(SAVED_SECURITY_LOCATION_KEY) || 'Gate Utama - Pool Cilincing';
}

/**
 * Saves the gate location.
 */
export function saveSecurityGateLocation(location: string): void {
  if (typeof window === 'undefined') return;
  if (location && location.trim()) {
    localStorage.setItem(SAVED_SECURITY_LOCATION_KEY, location.trim());
  }
}

export interface TenkoValidityResult {
  isValid: boolean;
  isExpired: boolean;
  isUsed: boolean;
  isHeld: boolean;
  usedAt?: string;
  usedByOfficer?: string;
  usedStatus?: GatePassStatus;
  hoursRemaining: number;
  minutesRemaining: number;
  validUntil: Date;
  examinedAt: Date;
  statusText: string;
}

/**
 * Calculates Tenko validity (standard 8-hour shift expiration window, used status, and hold status).
 */
export function checkTenkoValidity(exam: TenkoExamination): TenkoValidityResult {
  const baseTimeStr = exam.finishTime || exam.createdAt || `${exam.examinationDate}T00:00:00`;
  const examinedAt = new Date(baseTimeStr);
  
  // 8 hours validity window (shift-based standard)
  const validUntil = new Date(examinedAt.getTime() + 8 * 60 * 60 * 1000);
  const now = new Date();

  const diffMs = validUntil.getTime() - now.getTime();
  const isExpired = diffMs <= 0;
  const isHeld = exam.securityGateStatus === 'REJECTED';
  const isUsed = Boolean(
    exam.isUsed ||
    exam.securityGateStatus === 'PASSED' ||
    exam.securityGateStatus === 'WARNING_PASSED' ||
    isHeld
  );
  const totalMinutes = Math.max(0, Math.floor(diffMs / (60 * 1000)));
  const hoursRemaining = Math.floor(totalMinutes / 60);
  const minutesRemaining = totalMinutes % 60;

  let statusText = 'VALID (Berlaku)';
  if (isHeld) {
    statusText = 'DITAHAN SECURITY GERBANG (HOLD)';
  } else if (isUsed) {
    statusText = 'SUDAH DIGUNAKAN (CHECK-OUT GERBANG SELESAI)';
  } else if (isExpired) {
    statusText = 'KADALUWARSA (EXPIRED > 8 Jam)';
  } else if (hoursRemaining < 1) {
    statusText = `Hampir Habis (Sisa ${hoursRemaining}j ${minutesRemaining}m)`;
  }

  return {
    isValid: !isExpired && !isUsed && !isHeld,
    isExpired,
    isUsed,
    isHeld,
    usedAt: exam.securityCheckedAt,
    usedByOfficer: exam.securityOfficerName,
    usedStatus: exam.securityGateStatus,
    hoursRemaining,
    minutesRemaining,
    validUntil,
    examinedAt,
    statusText,
  };
}

/**
 * Checks whether a specific tenko card has already been checked out by security.
 */
export async function checkIfTenkoAlreadyUsed(
  tenkoId: string,
  tenkoDocumentId?: string
): Promise<{ isUsed: boolean; previousLog?: SecurityGatePassLog }> {
  const targetId = tenkoId || tenkoDocumentId;
  if (!targetId) return { isUsed: false };

  try {
    // 1. Query security gate logs for this tenko ID
    const q = query(
      collection(db, 'securityGateLogs'),
      where('tenkoId', '==', targetId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const logs = snap.docs.map((d) => d.data() as SecurityGatePassLog);
      const foundLog = logs[0];
      if (foundLog) {
        return { isUsed: true, previousLog: foundLog };
      }
    }

    // 2. Also try querying by tenkoDocumentId if different
    if (tenkoDocumentId && tenkoDocumentId !== tenkoId) {
      const qDoc = query(
        collection(db, 'securityGateLogs'),
        where('tenkoDocumentId', '==', tenkoDocumentId)
      );
      const snapDoc = await getDocs(qDoc);
      if (!snapDoc.empty) {
        const logs = snapDoc.docs.map((d) => d.data() as SecurityGatePassLog);
        const foundLog = logs[0];
        if (foundLog) {
          return { isUsed: true, previousLog: foundLog };
        }
      }
    }

    // 3. Fallback: Search all recent logs case-insensitively
    const allLogsSnap = await getDocs(collection(db, 'securityGateLogs'));
    const targetLower = targetId.toLowerCase();
    for (const d of allLogsSnap.docs) {
      const log = d.data() as SecurityGatePassLog;
      if (
        (log.tenkoId && log.tenkoId.toLowerCase() === targetLower) ||
        (log.tenkoDocumentId && log.tenkoDocumentId.toLowerCase() === targetLower)
      ) {
        return { isUsed: true, previousLog: log };
      }
    }
  } catch (err) {
    console.warn('Error checking if tenko already used from Firestore:', err);
    // Local fallback check
    try {
      const localLogsStr = localStorage.getItem('tenko_local_gate_logs') || '[]';
      const localLogs: SecurityGatePassLog[] = JSON.parse(localLogsStr);
      const found = localLogs.find(
        (l) =>
          l.tenkoId === targetId || l.tenkoDocumentId === targetId
      );
      if (found) {
        return { isUsed: true, previousLog: found };
      }
    } catch {
      // ignore
    }
  }

  return { isUsed: false };
}

/**
 * Creates and logs a Gate Clearance event in Firestore and Local Audit.
 * Also updates the Tenko Examination record with isUsed and clearance details.
 */
export async function createGateClearanceLog(
  data: Omit<SecurityGatePassLog, 'gateLogId' | 'checkedAt'>
): Promise<SecurityGatePassLog> {
  const now = new Date();
  const timestamp = now.toISOString();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const gateLogId = `GATE-${yyyymmdd}-${randomSuffix}`;

  const cleanDriverId = data.driverId || '';
  const cleanDriverName = data.driverName || 'Driver';
  const cleanTenkoId = data.tenkoId || data.tenkoDocumentId || '';
  const cleanDocId = data.tenkoDocumentId || data.tenkoId || '';
  const cleanPlate = (data.vehiclePlateNumber && data.vehiclePlateNumber.trim()) ? data.vehiclePlateNumber.trim().toUpperCase() : null;
  const cleanNotes = (data.securityNotes && data.securityNotes.trim()) ? data.securityNotes.trim() : null;
  const cleanLocation = (data.locationName && data.locationName.trim()) ? data.locationName.trim() : 'Gate Utama';

  // Sanitize record to ensure NO 'undefined' fields reach Firestore
  const record: SecurityGatePassLog = {
    gateLogId,
    checkedAt: timestamp,
    tenkoId: cleanTenkoId,
    tenkoDocumentId: cleanDocId,
    driverId: cleanDriverId,
    driverName: cleanDriverName,
    driverGroup: data.driverGroup || 'Armada Logistik',
    position: data.position || 'DRIVER',
    vehiclePlateNumber: cleanPlate || undefined,
    recommendation: data.recommendation || 'FIT TO WORK',
    gateStatus: data.gateStatus,
    securityOfficerName: data.securityOfficerName.trim(),
    securityNotes: cleanNotes || undefined,
    locationName: cleanLocation,
    isExpired: Boolean(data.isExpired),
  };

  // Plain object for Firestore setDoc (zero undefined properties)
  const firestoreRecord: Record<string, any> = {
    gateLogId,
    checkedAt: timestamp,
    tenkoId: cleanTenkoId,
    tenkoDocumentId: cleanDocId,
    driverId: cleanDriverId,
    driverName: cleanDriverName,
    driverGroup: data.driverGroup || 'Armada Logistik',
    position: data.position || 'DRIVER',
    vehiclePlateNumber: cleanPlate,
    recommendation: data.recommendation || 'FIT TO WORK',
    gateStatus: data.gateStatus,
    securityOfficerName: data.securityOfficerName.trim(),
    securityNotes: cleanNotes,
    locationName: cleanLocation,
    isExpired: Boolean(data.isExpired),
  };

  try {
    // 1. Write to securityGateLogs collection
    await setDoc(doc(db, 'securityGateLogs', gateLogId), firestoreRecord);

    // 2. Direct, guaranteed update to the tenkoExaminations document
    const { updateTenkoSecurityStatus } = await import('./tenkoService');
    const clearancePayload = {
      isUsed: true,
      securityCheckedAt: timestamp,
      securityOfficerName: data.securityOfficerName.trim(),
      securityGateStatus: data.gateStatus,
      vehiclePlateNumber: cleanPlate,
      securityNotes: cleanNotes,
      securityLocationName: cleanLocation,
    };

    const targetIds = Array.from(new Set([cleanDocId, cleanTenkoId].filter(Boolean)));
    for (const targetId of targetIds) {
      await updateTenkoSecurityStatus(targetId, clearancePayload);
    }
  } catch (err) {
    console.warn('Failed to save gate log to Firestore, saving to localStorage:', err);
    // Local fallback
    try {
      const localLogsStr = localStorage.getItem('tenko_local_gate_logs') || '[]';
      const localLogs = JSON.parse(localLogsStr);
      localLogs.unshift(record);
      localStorage.setItem('tenko_local_gate_logs', JSON.stringify(localLogs.slice(0, 100)));
    } catch (e) {
      console.error(e);
    }
  }

  // Remember officer name
  if (data.securityOfficerName) {
    saveSecurityOfficerName(data.securityOfficerName);
  }
  if (data.locationName) {
    saveSecurityGateLocation(data.locationName);
  }

  // Audit
  await logAuditAction({
    module: 'Security Gate',
    recordId: gateLogId,
    action: 'SECURITY_GATE_CHECKOUT',
    newValue: {
      tenkoId: data.tenkoId,
      driverId: data.driverId,
      driverName: data.driverName,
      gateStatus: data.gateStatus,
      officer: data.securityOfficerName,
      vehiclePlate: data.vehiclePlateNumber || '-',
    },
    userId: 'SECURITY_GATE',
    userName: data.securityOfficerName || 'Petugas Security Gerbang',
  });

  return record;
}

/**
 * Retrieves recent gate clearance logs.
 */
export async function getRecentGateLogs(limitCount = 20): Promise<SecurityGatePassLog[]> {
  try {
    const q = query(collection(db, 'securityGateLogs'), orderBy('checkedAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as SecurityGatePassLog);
  } catch (err) {
    console.warn('Fallback getting gate logs from local storage:', err);
    try {
      const localLogsStr = localStorage.getItem('tenko_local_gate_logs') || '[]';
      return JSON.parse(localLogsStr);
    } catch {
      return [];
    }
  }
}
