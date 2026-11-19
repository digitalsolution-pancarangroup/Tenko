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
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { AttendanceLogItem, AttendanceComparisonItem, TenkoExamination, Driver } from '../types';
import { logAuditAction } from './auditService';
import { generateAttendanceDocId } from '../utils/idGenerators';
import { getOrFetch, invalidateCachePrefix } from '../utils/memoryCache';

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

const ATTENDANCE_CACHE_TTL_MS = 120_000; // 2 minutes

/**
 * Fetch attendance logs for a specific date (YYYY-MM-DD) or recent logs.
 * Uses single-field logDate query (no compound orderBy) so Firestore never fails on missing composite indexes
 * and never falls back to scanning the entire 84k+ collection.
 */
export async function getAttendanceLogs(
  filterDate?: string,
  forceRefresh: boolean = false
): Promise<AttendanceLogItem[]> {
  if (filterDate) {
    return getOrFetch(
      `attendance:date:${filterDate}`,
      async () => {
        try {
          const q = query(
            collection(db, 'attendanceLogs'),
            where('logDate', '==', filterDate)
          );
          const snap = await getDocs(q);
          const items = snap.docs.map((d) => ({
            ...(d.data() as Record<string, any>),
            logDocumentId: d.id,
          })) as AttendanceLogItem[];
          return items.sort((a, b) => (a.logTime || '').localeCompare(b.logTime || ''));
        } catch (e) {
          console.warn(`Attendance fetch for ${filterDate} failed:`, e);
          return [];
        }
      },
      ATTENDANCE_CACHE_TTL_MS,
      forceRefresh
    );
  }

  // Fallback when called without date: fetch latest 30 days instead of scanning entire history
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split('T')[0];
  return getAttendanceLogsByDateRange(startDate, undefined, forceRefresh);
}

/**
 * Fetch attendance logs within a date range (YYYY-MM-DD) using single-field logDate index.
 */
export async function getAttendanceLogsByDateRange(
  startDate: string,
  endDate?: string,
  forceRefresh: boolean = false
): Promise<AttendanceLogItem[]> {
  const cacheKey = `attendance:range:${startDate}_${endDate || 'OPEN'}`;
  return getOrFetch(
    cacheKey,
    async () => {
      try {
        const constraints = [where('logDate', '>=', startDate)];
        if (endDate) {
          constraints.push(where('logDate', '<=', endDate));
        }
        const q = query(collection(db, 'attendanceLogs'), ...constraints);
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({
          ...(d.data() as Record<string, any>),
          logDocumentId: d.id,
        })) as AttendanceLogItem[];

        return items.sort((a, b) => {
          const dateCmp = (b.logDate || '').localeCompare(a.logDate || '');
          if (dateCmp !== 0) return dateCmp;
          return (b.logTime || '').localeCompare(a.logTime || '');
        });
      } catch (e) {
        console.warn('Attendance date range fetch failed:', e);
        return [];
      }
    },
    ATTENDANCE_CACHE_TTL_MS,
    forceRefresh
  );
}

/**
 * Discover up to N most recent distinct logDate values with minimal reads (1 doc read per distinct date)
 * instead of downloading all 84k+ documents.
 */
export async function getRecentAttendanceDates(
  maxDates: number = 6,
  forceRefresh: boolean = false
): Promise<string[]> {
  return getOrFetch(
    `attendance:recentDates:${maxDates}`,
    async () => {
      const dates: string[] = [];
      let cursorDate: string | null = null;

      try {
        for (let i = 0; i < maxDates; i++) {
          const q = cursorDate
            ? query(
                collection(db, 'attendanceLogs'),
                where('logDate', '<', cursorDate),
                orderBy('logDate', 'desc'),
                limit(1)
              )
            : query(
                collection(db, 'attendanceLogs'),
                orderBy('logDate', 'desc'),
                limit(1)
              );

          const snap = await getDocs(q);
          if (snap.empty) break;

          const data = snap.docs[0].data() as Record<string, any>;
          const foundDate = String(data.logDate || '').trim();
          if (!foundDate || dates.includes(foundDate)) break;

          dates.push(foundDate);
          cursorDate = foundDate;
        }
      } catch (e) {
        console.warn('getRecentAttendanceDates failed:', e);
      }

      return dates;
    },
    ATTENDANCE_CACHE_TTL_MS,
    forceRefresh
  );
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
      driverGroup: String(item.driverGroup || '').trim(),
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

  invalidateCachePrefix('attendance:');

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

  invalidateCachePrefix('attendance:');

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
      driverGroup: (log.driverGroup && log.driverGroup.trim()) || master?.driverGroupId || tenkoRecord?.driverGroupSnapshot || 'REGULER',
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
