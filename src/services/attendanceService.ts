import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { AttendanceLogItem, AttendanceComparisonItem, TenkoExamination, Driver } from '../types';
import { logAuditAction } from './auditService';
import { generateAttendanceDocId } from '../utils/idGenerators';

/**
 * Format date string to YYYY-MM-DD
 */
export function normalizeAttendanceDate(rawDateStr: string): string {
  if (!rawDateStr) return new Date().toISOString().split('T')[0];

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(rawDateStr)) {
    return rawDateStr.substring(0, 10);
  }

  // If DD/MM/YYYY or MM/DD/YYYY
  if (rawDateStr.includes('/')) {
    const parts = rawDateStr.split(' ')[0].split('/');
    if (parts.length === 3) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      const y = parts[2].length === 4 ? parts[2] : `20${parts[2]}`;

      // If p1 > 12, it is definitely DD/MM/YYYY
      if (p1 > 12) {
        return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
      // If p2 > 12, it is MM/DD/YYYY
      if (p2 > 12) {
        return `${y}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
      }
      // Standard Indonesian/European format default: DD/MM/YYYY
      return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
  }

  try {
    const d = new Date(rawDateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // fallback
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Fetch all attendance logs, optionally filtered by date (YYYY-MM-DD)
 */
export async function getAttendanceLogs(filterDate?: string): Promise<AttendanceLogItem[]> {
  try {
    let q;
    if (filterDate) {
      q = query(
        collection(db, 'attendanceLogs'),
        where('logDate', '==', filterDate),
        orderBy('logTime', 'asc')
      );
    } else {
      q = query(collection(db, 'attendanceLogs'), orderBy('logDate', 'desc'), orderBy('logTime', 'desc'));
    }

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...(d.data() as Record<string, any>),
      logDocumentId: d.id,
    })) as AttendanceLogItem[];
  } catch (error) {
    try {
      // Fallback query without compound order
      const fallbackSnap = await getDocs(collection(db, 'attendanceLogs'));
      const items = fallbackSnap.docs.map((d) => ({
        ...(d.data() as Record<string, any>),
        logDocumentId: d.id,
      })) as AttendanceLogItem[];

      if (filterDate) {
        return items.filter((item) => item.logDate === filterDate);
      }
      return items;
    } catch (e) {
      console.warn('Fallback attendance fetch:', e);
      return [];
    }
  }
}

export interface AttendanceImportResult {
  totalProcessed: number;
  successCount: number;
  inCount: number;
  outCount: number;
  batchId: string;
}

/**
 * Batch import attendance logs into Firestore with Smart Idempotent Key (ID Driver + Finger Flag + Log Time)
 */
export async function importAttendanceLogsBatch(
  items: AttendanceLogItem[],
  currentUser: { email?: string; fullName?: string }
): Promise<AttendanceImportResult> {
  if (!items || items.length === 0) {
    return {
      totalProcessed: 0,
      successCount: 0,
      inCount: 0,
      outCount: 0,
      batchId: '',
    };
  }

  const batchId = `BATCH-ATT-${Date.now()}`;
  const now = new Date().toISOString();
  const userName = currentUser.fullName || currentUser.email || 'Admin';

  let inCount = 0;
  let outCount = 0;

  // Deduplicate records in memory first if identical docId appears multiple times within the same import file
  const docMap = new Map<string, AttendanceLogItem>();

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const cleanUserCode = String(item.userCode || '').trim();
    if (!cleanUserCode) continue;

    const fingerFlag = Number(item.fingerFlag) === 1 ? 1 : 0;
    if (fingerFlag === 1) inCount++;
    else outCount++;

    const rawLogTime = String(item.logTime || '').trim();
    const logDate = normalizeAttendanceDate(rawLogTime || item.logDate);
    
    // Deterministic unique ID: att_[DriverID]_[FingerFlag]_[LogTime]
    const docId = generateAttendanceDocId(cleanUserCode, fingerFlag, rawLogTime, logDate);

    const record: AttendanceLogItem = {
      ...item,
      logDocumentId: docId,
      userCode: cleanUserCode,
      driverName: String(item.driverName || '').trim(),
      dataSource: String(item.dataSource || 'APP').trim(),
      isDriver: String(item.isDriver || 'Y').trim(),
      fingerFlag,
      logTime: rawLogTime || `${logDate} 00:00`,
      logDate,
      processToAttendance: String(item.processToAttendance || 'N').trim(),
      siteName: String(item.siteName || '-').trim(),
      importBatchId: batchId,
      importedAt: now,
      importedBy: userName,
    };

    docMap.set(docId, record);
  }

  const uniqueItems = Array.from(docMap.values());

  // Batch commit in chunks of 400
  const CHUNK_SIZE = 400;
  for (let i = 0; i < uniqueItems.length; i += CHUNK_SIZE) {
    const chunk = uniqueItems.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const docRef = doc(db, 'attendanceLogs', item.logDocumentId!);
      batch.set(docRef, item, { merge: true });
    }

    await batch.commit();
  }

  // Audit log
  await logAuditAction({
    action: 'CREATE',
    entity: 'ATTENDANCE_LOG',
    entityId: batchId,
    details: {
      totalProcessed: items.length,
      uniqueImported: uniqueItems.length,
      inCount,
      outCount,
      sampleSites: Array.from(new Set(uniqueItems.map((i) => i.siteName))).slice(0, 5),
    },
    userId: currentUser.email || 'SYSTEM',
    userName: userName,
  });

  return {
    totalProcessed: items.length,
    successCount: uniqueItems.length,
    inCount,
    outCount,
    batchId,
  };
}

/**
 * Delete attendance records by date
 */
export async function deleteAttendanceLogsByDate(
  dateStr: string,
  currentUser: { email?: string; fullName?: string }
): Promise<number> {
  const q = query(collection(db, 'attendanceLogs'), where('logDate', '==', dateStr));
  const snap = await getDocs(q);
  if (snap.empty) return 0;

  const CHUNK_SIZE = 400;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }

  await logAuditAction({
    action: 'DELETE',
    entity: 'ATTENDANCE_LOG',
    entityId: `DATE-${dateStr}`,
    details: { deletedCount: docs.length, date: dateStr },
    userId: currentUser.email || 'SYSTEM',
    userName: currentUser.fullName || currentUser.email || 'Admin',
  });

  return docs.length;
}

export interface AttendanceComparisonResult {
  comparisonList: AttendanceComparisonItem[];
  totalLogs: number;
  totalDriversAttendedIn: number;
  totalDriversAttendedOut: number;
  totalTenkoDone: number;
  totalPendingTenko: number;
  complianceRate: number;
}

/**
 * Compare attendance entries with TENKO records on a given date (supporting both IN and OUT logs)
 */
export function computeAttendanceTenkoComparison(
  attendanceLogs: AttendanceLogItem[],
  tenkoExaminations: TenkoExamination[],
  driversMaster: Driver[],
  targetDate: string
): AttendanceComparisonResult {
  // 1. Filter all attendance logs for targetDate
  const dailyLogs = attendanceLogs.filter((log) => log.logDate === targetDate);

  // Sort logs by logTime descending
  const sortedLogs = [...dailyLogs].sort((a, b) => {
    return (b.logTime || '').localeCompare(a.logTime || '');
  });

  // Track distinct drivers who clocked IN and OUT
  const inDriversSet = new Set<string>();
  const outDriversSet = new Set<string>();

  dailyLogs.forEach((log) => {
    const code = log.userCode.trim().toUpperCase();
    if (log.fingerFlag === 1) {
      inDriversSet.add(code);
    } else {
      outDriversSet.add(code);
    }
  });

  // 2. Filter TENKO examinations conducted on targetDate
  const dailyTenkoList = tenkoExaminations.filter(
    (exam) => exam.examinationDate === targetDate
  );

  const tenkoMapByDriverId = new Map<string, TenkoExamination>();
  for (const exam of dailyTenkoList) {
    const cleanId = exam.driverId.trim().toUpperCase();
    tenkoMapByDriverId.set(cleanId, exam);
  }

  // 3. Driver master lookup map for phone numbers and groups
  const masterDriverMap = new Map<string, Driver>();
  for (const drv of driversMaster) {
    masterDriverMap.set(drv.driverId.trim().toUpperCase(), drv);
  }

  // 4. Build comparison list for all logs (both IN and OUT)
  const comparisonList: AttendanceComparisonItem[] = [];
  let totalDoneForInDrivers = 0;

  // Track which IN drivers already counted for TENKO done
  const countedInDrivers = new Set<string>();

  for (const log of sortedLogs) {
    const userCode = log.userCode.trim().toUpperCase();
    const tenkoRecord = tenkoMapByDriverId.get(userCode);
    const hasTenko = !!tenkoRecord;

    if (log.fingerFlag === 1 && hasTenko && !countedInDrivers.has(userCode)) {
      totalDoneForInDrivers++;
      countedInDrivers.add(userCode);
    }

    const master = masterDriverMap.get(userCode);

    // Clean driver name if formatted as "201240370 - ANDRI SANTOSO"
    let cleanName = log.driverName;
    if (cleanName.includes('-')) {
      const parts = cleanName.split('-');
      if (parts.length >= 2) {
        cleanName = parts.slice(1).join('-').trim();
      }
    }

    comparisonList.push({
      logDocumentId: log.logDocumentId,
      userCode: log.userCode,
      driverName: cleanName || master?.fullName || log.driverName,
      siteName: log.siteName,
      dataSource: log.dataSource,
      fingerFlag: log.fingerFlag,
      logTime: log.logTime,
      inLogTime: log.logTime,
      logDate: log.logDate,
      hasTenko,
      tenkoRecord,
      tenkoRecommendation: tenkoRecord?.recommendation,
      tenkoTime: tenkoRecord?.finishTime || tenkoRecord?.createdAt,
      phoneNumber: master?.phoneNumber,
      driverGroup: master?.driverGroupId || tenkoRecord?.driverGroupSnapshot,
    });
  }

  const totalDriversAttendedIn = inDriversSet.size;
  const totalDriversAttendedOut = outDriversSet.size;
  const totalPendingTenko = Math.max(0, totalDriversAttendedIn - totalDoneForInDrivers);
  const complianceRate =
    totalDriversAttendedIn > 0
      ? Math.round((totalDoneForInDrivers / totalDriversAttendedIn) * 100)
      : 0;

  return {
    comparisonList,
    totalLogs: sortedLogs.length,
    totalDriversAttendedIn,
    totalDriversAttendedOut,
    totalTenkoDone: totalDoneForInDrivers,
    totalPendingTenko,
    complianceRate,
  };
}
