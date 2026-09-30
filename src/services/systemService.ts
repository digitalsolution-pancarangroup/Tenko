import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { logAuditAction } from './auditService';

export interface ClearDataOptions {
  clearTenkoExaminations?: boolean;
  clearAttendanceLogs?: boolean;
  clearDriverHealthRecords?: boolean;
  clearDriversMaster?: boolean;
  clearAuditLogs?: boolean;
  clearStockMovements?: boolean;
}

export interface ClearDataResult {
  tenkoExaminationsDeleted: number;
  attendanceLogsDeleted: number;
  driverHealthRecordsDeleted: number;
  driversMasterDeleted: number;
  auditLogsDeleted: number;
  stockMovementsDeleted: number;
  totalDeleted: number;
}

/**
 * Helper to delete all documents in a Firestore collection in batches of 200
 */
async function clearCollection(collectionName: string): Promise<number> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    if (snap.empty) return 0;

    const count = snap.size;
    const CHUNK_SIZE = 200;
    const docs = snap.docs;

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }

    return count;
  } catch (err) {
    console.error(`Error clearing collection ${collectionName}:`, err);
    return 0;
  }
}

/**
 * Clears selected transactional and master data from Firestore and local storage caches
 */
export async function clearAllSystemData(
  options: ClearDataOptions = {
    clearTenkoExaminations: true,
    clearAttendanceLogs: true,
    clearDriverHealthRecords: true,
    clearDriversMaster: true,
    clearAuditLogs: false,
    clearStockMovements: true,
  },
  currentUser?: { userId: string; fullName: string }
): Promise<ClearDataResult> {
  const result: ClearDataResult = {
    tenkoExaminationsDeleted: 0,
    attendanceLogsDeleted: 0,
    driverHealthRecordsDeleted: 0,
    driversMasterDeleted: 0,
    auditLogsDeleted: 0,
    stockMovementsDeleted: 0,
    totalDeleted: 0,
  };

  // 1. Clear Tenko Examinations
  if (options.clearTenkoExaminations) {
    result.tenkoExaminationsDeleted = await clearCollection('tenkoExaminations');
    try {
      localStorage.removeItem('tenko_examinations');
    } catch {}
  }

  // 2. Clear Attendance Logs
  if (options.clearAttendanceLogs) {
    result.attendanceLogsDeleted = await clearCollection('attendanceLogs');
    try {
      localStorage.removeItem('tenko_attendance_logs');
    } catch {}
  }

  // 3. Clear Driver Health Records
  if (options.clearDriverHealthRecords) {
    result.driverHealthRecordsDeleted = await clearCollection('driverHealthRecords');
    try {
      localStorage.removeItem('tenko_driver_health_records');
    } catch {}
  }

  // 4. Clear Drivers Master
  if (options.clearDriversMaster) {
    result.driversMasterDeleted = await clearCollection('drivers');
    try {
      localStorage.removeItem('tenko_drivers');
    } catch {}
  }

  // 5. Clear Stock Movements
  if (options.clearStockMovements) {
    result.stockMovementsDeleted = await clearCollection('stockMovements');
    try {
      localStorage.removeItem('tenko_stock_movements');
    } catch {}
  }

  // 6. Clear Audit Logs (Optional)
  if (options.clearAuditLogs) {
    result.auditLogsDeleted = await clearCollection('auditLogs');
    try {
      localStorage.removeItem('tenko_audit_logs');
    } catch {}
  }

  // Prevent automatic re-seeding of sample transactional drivers
  try {
    localStorage.setItem('tenko_sample_drivers_cleared', 'true');
    localStorage.setItem('tenko_seeded_done_tenko_db_v1', 'true');
  } catch {}

  result.totalDeleted =
    result.tenkoExaminationsDeleted +
    result.attendanceLogsDeleted +
    result.driverHealthRecordsDeleted +
    result.driversMasterDeleted +
    result.stockMovementsDeleted +
    result.auditLogsDeleted;

  if (currentUser) {
    await logAuditAction({
      module: 'Sistem Maintenance',
      recordId: `CLEAR-ALL-${Date.now()}`,
      action: 'CLEAR_DATABASE_DATA',
      newValue: {
        summary: 'Pembersihan data sistem atas permintaan user',
        ...result,
      },
      userId: currentUser.userId,
      userName: currentUser.fullName,
    });
  }

  return result;
}
