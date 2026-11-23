import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { DriverPosition, ExaminationRecommendation, ExaminationSummary, Location, NonWorkingHoursOption, PhysicalObservationStatus, ReadinessStatus, ScreeningResult, TenkoExamination, User } from '../types';
import { logAuditAction } from './auditService';
import { getDrivers, getDriverByCustomId, updateDriver } from './driverService';
import { getLocations } from './masterService';
import { getUsers } from './userService';
import { generateTenkoExaminationId, generateDriverDocId } from '../utils/idGenerators';
import { getOrFetch, invalidateCachePrefix } from '../utils/memoryCache';

const TENKO_CACHE_TTL_MS = 90_000; // 90 seconds

export function isLocationIdOrIncomplete(val?: string | null): boolean {
  const trimmed = (val || '').trim();
  if (!trimmed) return true;
  if (/^LOC[-_]?$/i.test(trimmed)) return true;
  if (/^LOC[-_][A-Z0-9_-]+$/i.test(trimmed)) return true;
  return false;
}

function buildLocationLookupMaps(locations: Location[]) {
  const byIdUpper = new Map<string, string>();
  const byNameLower = new Map<string, string>();
  const idByNameLower = new Map<string, string>();

  locations.forEach((loc) => {
    const locName = (loc.locationName || '').trim();
    const locId = (loc.locationId || '').trim();
    const locDocId = (loc.locationDocumentId || '').trim();

    if (locName && !isLocationIdOrIncomplete(locName)) {
      byNameLower.set(locName.toLowerCase(), locName);
      if (locId) idByNameLower.set(locName.toLowerCase(), locId);
      if (locId) byIdUpper.set(locId.toUpperCase(), locName);
      if (locDocId) byIdUpper.set(locDocId.toUpperCase(), locName);
    }
  });

  return { byIdUpper, byNameLower, idByNameLower };
}

function getDefaultPoolName(locations: Location[]): string {
  const active = locations.filter((l) => l.status === 'ACTIVE' && l.locationName && !isLocationIdOrIncomplete(l.locationName));
  const poolList = active.length > 0 ? active : locations.filter((l) => l.locationName && !isLocationIdOrIncomplete(l.locationName));
  const tanahMerdeka = poolList.find((l) => l.locationName.toLowerCase().includes('tanah merdeka'));
  if (tanahMerdeka) return tanahMerdeka.locationName;
  if (poolList.length > 0) return poolList[0].locationName;
  return 'Pool Tanah Merdeka - Cilincing';
}

export function resolveExaminationLocationName(
  exam: Pick<TenkoExamination, 'locationNameSnapshot' | 'locationId' | 'examinerUserId' | 'examinerName' | 'securityLocationName'>,
  locations: Location[],
  users?: User[]
): string {
  const { byIdUpper, byNameLower } = buildLocationLookupMaps(locations);
  const snap = (exam.locationNameSnapshot || '').trim();
  const id = (exam.locationId || '').trim();

  if (snap) {
    const fromId = byIdUpper.get(snap.toUpperCase());
    if (fromId) return fromId;
    const fromName = byNameLower.get(snap.toLowerCase());
    if (fromName) return fromName;
    if (!isLocationIdOrIncomplete(snap)) return snap;
  }

  if (id) {
    const fromId = byIdUpper.get(id.toUpperCase());
    if (fromId) return fromId;
    const fromName = byNameLower.get(id.toLowerCase());
    if (fromName) return fromName;
    if (!isLocationIdOrIncomplete(id)) return id;
  }

  if (users && users.length > 0) {
    const exUid = (exam.examinerUserId || '').trim();
    const exName = (exam.examinerName || '').trim().toLowerCase();
    const matchedUser = users.find(
      (u) =>
        (exUid && (u.userId === exUid || u.authUid === exUid)) ||
        (exName && u.fullName && u.fullName.trim().toLowerCase() === exName)
    );
    if (matchedUser) {
      const uName = (matchedUser.locationName || '').trim();
      const uId = (matchedUser.locationId || '').trim();
      if (uName) {
        const mapped = byNameLower.get(uName.toLowerCase()) || byIdUpper.get(uName.toUpperCase());
        if (mapped) return mapped;
        if (!isLocationIdOrIncomplete(uName)) return uName;
      }
      if (uId) {
        const mapped = byIdUpper.get(uId.toUpperCase()) || byNameLower.get(uId.toLowerCase());
        if (mapped) return mapped;
        if (!isLocationIdOrIncomplete(uId)) return uId;
      }
    }
  }

  const secLoc = (exam.securityLocationName || '').trim();
  if (secLoc && secLoc.toLowerCase() !== 'gate utama') {
    const mapped = byNameLower.get(secLoc.toLowerCase()) || byIdUpper.get(secLoc.toUpperCase());
    if (mapped) return mapped;
  }

  return getDefaultPoolName(locations);
}

async function enrichExaminationsLocations(
  list: TenkoExamination[],
  forceRefresh: boolean = false
): Promise<TenkoExamination[]> {
  if (list.length === 0) return list;

  const locations = await getLocations(forceRefresh).catch(() => [] as Location[]);
  const { byIdUpper, byNameLower, idByNameLower } = buildLocationLookupMaps(locations);

  const hasDirectResolution = (exam: TenkoExamination): boolean => {
    const snap = (exam.locationNameSnapshot || '').trim();
    const id = (exam.locationId || '').trim();
    if (snap && (byIdUpper.has(snap.toUpperCase()) || byNameLower.has(snap.toLowerCase()) || !isLocationIdOrIncomplete(snap))) {
      return true;
    }
    if (id && (byIdUpper.has(id.toUpperCase()) || byNameLower.has(id.toLowerCase()) || !isLocationIdOrIncomplete(id))) {
      return true;
    }
    return false;
  };

  const needsUsers = list.some((exam) => !hasDirectResolution(exam));
  const users = needsUsers ? await getUsers().catch(() => [] as User[]) : undefined;

  return list.map((exam) => {
    const resolvedName = resolveExaminationLocationName(exam, locations, users);
    const resolvedId = idByNameLower.get(resolvedName.toLowerCase()) || exam.locationId || resolvedName;
    if (exam.locationNameSnapshot === resolvedName && exam.locationId === resolvedId) {
      return exam;
    }
    return {
      ...exam,
      locationNameSnapshot: resolvedName,
      locationId: isLocationIdOrIncomplete(exam.locationId) ? resolvedId : exam.locationId,
    };
  });
}

export interface TenkoImportRow {
  examinationDate: string; // YYYY-MM-DD
  finishTime?: string; // ISO string or time string
  driverId: string;
  driverName: string;
  position?: DriverPosition;
  driverGroup?: string;
  locationId?: string;
  locationName?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  bloodPressureResult?: string;
  temperature?: number;
  heartRate?: number;
  offDutySleepDuration?: number;
  dailyNonWorkingHours?: NonWorkingHoursOption;
  rhaJmp?: ReadinessStatus;
  dokJmp?: ReadinessStatus;
  alcoholTest?: ScreeningResult;
  drugTest?: ScreeningResult;
  appearance?: PhysicalObservationStatus;
  eyes?: PhysicalObservationStatus;
  face?: PhysicalObservationStatus;
  hair?: PhysicalObservationStatus;
  emotionalRegulation?: PhysicalObservationStatus;
  problemSolving?: PhysicalObservationStatus;
  selfAwareness?: PhysicalObservationStatus;
  communication?: PhysicalObservationStatus;
  decisionMaking?: PhysicalObservationStatus;
  balanceTest?: PhysicalObservationStatus;
  interview?: PhysicalObservationStatus;
  summary?: ExaminationSummary;
  recommendation?: ExaminationRecommendation;
  note?: string;
  examinerName?: string;
}

export interface TenkoImportResult {
  totalProcessed: number;
  importedCount: number;
  autoCreatedDriversCount: number;
  errors: string[];
}

function getTimestampMs(value?: string): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function compareExaminationsByExamDateDesc(a: TenkoExamination, b: TenkoExamination): number {
  const dateA = (a.examinationDate || a.createdAt || '').slice(0, 10);
  const dateB = (b.examinationDate || b.createdAt || '').slice(0, 10);
  if (dateA !== dateB) {
    return dateB.localeCompare(dateA);
  }

  const finishA = getTimestampMs(a.finishTime);
  const finishB = getTimestampMs(b.finishTime);
  if (finishA !== finishB) {
    return finishB - finishA;
  }

  return getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt);
}

export async function generateNextTenkoId(targetDateIso?: string): Promise<{ tenkoId: string; sequenceNumber: number }> {
  const now = new Date();
  let queryDateIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (targetDateIso && /^\d{4}-\d{2}-\d{2}$/.test(targetDateIso.trim())) {
    queryDateIso = targetDateIso.trim();
  }
  const datePrefix = queryDateIso.replace(/-/g, '');

  try {
    const q = query(
      collection(db, 'tenkoExaminations'),
      where('examinationDate', '==', queryDateIso)
    );
    const snap = await getDocs(q);
    const nextSeq = snap.size + 1;
    const formattedSeq = String(nextSeq).padStart(4, '0');
    return {
      tenkoId: `TENKO-${datePrefix}-${formattedSeq}`,
      sequenceNumber: nextSeq,
    };
  } catch (_err) {
    const fallbackSeq = Math.floor(1000 + Math.random() * 9000);
    return {
      tenkoId: `TENKO-${datePrefix}-${fallbackSeq}`,
      sequenceNumber: 1,
    };
  }
}

function mergeGateLogsIntoExams(list: TenkoExamination[], gateLogsSnap: any): TenkoExamination[] {
  if (!gateLogsSnap || gateLogsSnap.empty) return list;

  const logMap = new Map<string, any>();
  gateLogsSnap.docs.forEach((gd: any) => {
    const gData = gd.data();
    if (gData.tenkoId) logMap.set(gData.tenkoId.toLowerCase(), gData);
    if (gData.tenkoDocumentId) logMap.set(gData.tenkoDocumentId.toLowerCase(), gData);
    if (gData.driverId && gData.checkedAt) {
      const dateStr = gData.checkedAt.slice(0, 10);
      logMap.set(`${gData.driverId.toLowerCase()}_${dateStr}`, gData);
    }
  });

  list.forEach((exam) => {
    const tid = exam.tenkoId?.toLowerCase();
    const tdoc = exam.tenkoDocumentId?.toLowerCase();
    const examDate = (exam.examinationDate || exam.createdAt || '').slice(0, 10);
    const driverKey = exam.driverId ? `${exam.driverId.toLowerCase()}_${examDate}` : '';

    const matchedLog =
      (tdoc && logMap.get(tdoc)) ||
      (tid && logMap.get(tid)) ||
      (driverKey && logMap.get(driverKey));

    if (matchedLog && (!exam.securityGateStatus || !exam.securityOfficerName)) {
      exam.isUsed = true;
      exam.securityGateStatus = matchedLog.gateStatus;
      exam.securityOfficerName = matchedLog.securityOfficerName;
      exam.securityCheckedAt = matchedLog.checkedAt;
      exam.vehiclePlateNumber = exam.vehiclePlateNumber || matchedLog.vehiclePlateNumber;
    }
  });

  return list;
}

export async function getTenkoExaminations(
  locationFilter?: string,
  forceRefresh: boolean = false
): Promise<TenkoExamination[]> {
  let fetchedFromServer = false;

  const allList = await getOrFetch(
    'tenko:all',
    async () => {
      try {
        const q = query(collection(db, 'tenkoExaminations'), orderBy('createdAt', 'desc'));
        const [snap, gateLogsSnap] = await Promise.all([
          getDocs(q),
          getDocs(collection(db, 'securityGateLogs')).catch(() => null),
        ]);
        fetchedFromServer = true;

        const list = snap.docs.map((d) => ({
          ...d.data(),
          tenkoDocumentId: d.id,
        }) as TenkoExamination);

        list.sort(compareExaminationsByExamDateDesc);
        const withGateLogs = mergeGateLogsIntoExams(list, gateLogsSnap);
        return await enrichExaminationsLocations(withGateLogs, forceRefresh);
      } catch (_error) {
        try {
          const [snap, gateLogsSnap] = await Promise.all([
            getDocs(collection(db, 'tenkoExaminations')),
            getDocs(collection(db, 'securityGateLogs')).catch(() => null),
          ]);
          fetchedFromServer = true;

          const list = snap.docs.map((d) => ({
            ...d.data(),
            tenkoDocumentId: d.id,
          }) as TenkoExamination);

          const sorted = list.sort(compareExaminationsByExamDateDesc);
          const withGateLogs = mergeGateLogsIntoExams(sorted, gateLogsSnap);
          return await enrichExaminationsLocations(withGateLogs, forceRefresh);
        } catch (fallbackErr) {
          console.warn('Fallback to empty tenko examination list (Firestore quota/offline):', fallbackErr);
          return [];
        }
      }
    },
    TENKO_CACHE_TTL_MS,
    forceRefresh,
    () => fetchedFromServer
  );

  if (locationFilter && locationFilter !== 'ALL') {
    const filterNorm = locationFilter.trim().toLowerCase();
    return allList.filter(
      (e) =>
        (e.locationNameSnapshot && e.locationNameSnapshot.trim().toLowerCase() === filterNorm) ||
        (e.locationId && e.locationId.trim().toLowerCase() === filterNorm)
    );
  }
  return allList;
}

export async function getTenkoById(tenkoIdOrDocId: string): Promise<TenkoExamination | null> {
  if (!tenkoIdOrDocId) return null;
  const cleanTarget = tenkoIdOrDocId.trim();
  const lowerTarget = cleanTarget.toLowerCase();

  try {
    // 1. Try direct doc lookup
    const docRef = doc(db, 'tenkoExaminations', cleanTarget);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const [enriched] = await enrichExaminationsLocations([
        {
          ...data,
          tenkoDocumentId: snap.id,
        } as TenkoExamination,
      ]);
      return enriched;
    }

    // 2. Query by tenkoId
    const q = query(collection(db, 'tenkoExaminations'), where('tenkoId', '==', cleanTarget));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const bestDoc = querySnap.docs[0];
      const data = bestDoc.data();
      const [enriched] = await enrichExaminationsLocations([
        {
          ...data,
          tenkoDocumentId: bestDoc.id,
        } as TenkoExamination,
      ]);
      return enriched;
    }

    // 2b. Query by driverId directly (avoids full collection scan when scanning driver NIK)
    const driverQ = query(collection(db, 'tenkoExaminations'), where('driverId', '==', cleanTarget.toUpperCase()));
    const driverSnap = await getDocs(driverQ);
    if (!driverSnap.empty) {
      const driverDocs = driverSnap.docs.map((d) => ({
        ...d.data(),
        tenkoDocumentId: d.id,
      }) as TenkoExamination);
      driverDocs.sort(compareExaminationsByExamDateDesc);
      const [enriched] = await enrichExaminationsLocations([driverDocs[0]]);
      return enriched;
    }

    // 3. Fallback: Search cached examinations sorted newest examinationDate first
    const allDocs = [...(await getTenkoExaminations())];

    // Sort descending by examinationDate so if a driverId is entered, backdated entries never override today's exam
    allDocs.sort(compareExaminationsByExamDateDesc);

    const match = allDocs.find((data) => {
      return (
        data.tenkoDocumentId?.toLowerCase() === lowerTarget ||
        (data.tenkoId && data.tenkoId.toLowerCase() === lowerTarget) ||
        (data.driverId && data.driverId.toLowerCase() === lowerTarget)
      );
    });

    if (match) {
      return match;
    }
  } catch (err) {
    console.warn('getTenkoById error / quota fallback:', err);
  }

  return null;
}

/**
 * Updates the Tenko examination document with security clearance details.
 * Performs dual-lookup (by document ID and tenkoId) to guarantee the record is updated.
 */
export async function updateTenkoSecurityStatus(
  targetDocIdOrTenkoId: string,
  clearanceData: {
    isUsed: boolean;
    securityGateStatus: string;
    securityOfficerName: string;
    securityCheckedAt: string;
    vehiclePlateNumber?: string | null;
    securityNotes?: string | null;
    securityLocationName?: string | null;
  }
): Promise<boolean> {
  if (!targetDocIdOrTenkoId) return false;
  let updated = false;

  const sanitizedData: Record<string, any> = {
    isUsed: Boolean(clearanceData.isUsed),
    securityGateStatus: clearanceData.securityGateStatus || 'PASSED',
    securityOfficerName: (clearanceData.securityOfficerName || 'Security').trim(),
    securityCheckedAt: clearanceData.securityCheckedAt || new Date().toISOString(),
    vehiclePlateNumber: clearanceData.vehiclePlateNumber || null,
    securityNotes: clearanceData.securityNotes || null,
    securityLocationName: clearanceData.securityLocationName || null,
  };

  // 1. Try direct update by document ID
  try {
    const docRef = doc(db, 'tenkoExaminations', targetDocIdOrTenkoId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, sanitizedData);
      updated = true;
    }
  } catch (e) {
    console.warn('Direct doc update error:', e);
  }

  // 2. Query where tenkoId == targetDocIdOrTenkoId
  try {
    const q = query(
      collection(db, 'tenkoExaminations'),
      where('tenkoId', '==', targetDocIdOrTenkoId)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await updateDoc(d.ref, sanitizedData);
      updated = true;
    }
  } catch (e) {
    console.warn('Query by tenkoId update error:', e);
  }

  // 3. Query where tenkoDocumentId == targetDocIdOrTenkoId
  try {
    const qDoc = query(
      collection(db, 'tenkoExaminations'),
      where('tenkoDocumentId', '==', targetDocIdOrTenkoId)
    );
    const snapDoc = await getDocs(qDoc);
    for (const d of snapDoc.docs) {
      await updateDoc(d.ref, sanitizedData);
      updated = true;
    }
  } catch (e) {
    console.warn('Query by tenkoDocumentId update error:', e);
  }

  // 4. Fallback: Search all recent examinations if still not updated
  if (!updated) {
    try {
      const allSnap = await getDocs(collection(db, 'tenkoExaminations'));
      const targetLower = targetDocIdOrTenkoId.toLowerCase();
      for (const d of allSnap.docs) {
        const data = d.data();
        if (
          d.id.toLowerCase() === targetLower ||
          (data.tenkoId && data.tenkoId.toLowerCase() === targetLower) ||
          (data.tenkoDocumentId && data.tenkoDocumentId.toLowerCase() === targetLower)
        ) {
          await updateDoc(d.ref, sanitizedData);
          updated = true;
          break;
        }
      }
    } catch (e) {
      console.warn('Fallback search update error:', e);
    }
  }

  if (updated) {
    invalidateCachePrefix('tenko:');
  }

  return updated;
}

export async function createTenkoExamination(
  examData: Omit<TenkoExamination, 'tenkoDocumentId' | 'sequenceNumber' | 'tenkoId' | 'createdAt' | 'createdBy' | 'bloodPressureResult'>,
  currentUser: { userId: string; fullName: string }
): Promise<TenkoExamination> {
  const { sequenceNumber } = await generateNextTenkoId(examData.examinationDate);
  let idDate = new Date();
  if (examData.finishTime) {
    const parsedFinish = new Date(examData.finishTime);
    if (Number.isFinite(parsedFinish.getTime())) {
      idDate = parsedFinish;
    }
  } else if (examData.examinationDate && /^\d{4}-\d{2}-\d{2}$/.test(examData.examinationDate)) {
    const parsedExam = new Date(`${examData.examinationDate}T08:00:00`);
    if (Number.isFinite(parsedExam.getTime())) {
      idDate = parsedExam;
    }
  }
  // Ensure YYYYMMDD prefix in ID strictly matches selected examinationDate
  if (examData.examinationDate && /^\d{4}-\d{2}-\d{2}$/.test(examData.examinationDate)) {
    const [y, m, d] = examData.examinationDate.split('-').map(Number);
    idDate = new Date(y, m - 1, d, idDate.getHours(), idDate.getMinutes(), idDate.getSeconds());
  }
  const docId = generateTenkoExaminationId(examData.driverId || 'DRV', idDate);
  const tenkoId = docId;

  const bpResult = `${examData.bloodPressureSystolic}/${examData.bloodPressureDiastolic} mmHg`;
  const locations = await getLocations().catch(() => [] as Location[]);
  const { idByNameLower } = buildLocationLookupMaps(locations);
  const locSnapshot = resolveExaminationLocationName(
    {
      locationNameSnapshot: examData.locationNameSnapshot,
      locationId: examData.locationId,
      examinerUserId: currentUser.userId,
      examinerName: currentUser.fullName,
    },
    locations
  );
  const resolvedLocId = idByNameLower.get(locSnapshot.toLowerCase());
  const locId = resolvedLocId || (!isLocationIdOrIncomplete(examData.locationId) ? examData.locationId! : locSnapshot);

  const newExamination: TenkoExamination = {
    ...examData,
    locationId: locId,
    locationNameSnapshot: locSnapshot,
    tenkoDocumentId: docId,
    sequenceNumber,
    tenkoId,
    bloodPressureResult: bpResult,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.fullName,
    examinerUserId: currentUser.userId,
    examinerName: currentUser.fullName,
  };

  await setDoc(doc(db, 'tenkoExaminations', docId), newExamination);
  invalidateCachePrefix('tenko:');

  // Auto-sync / enrich phone number to Master Driver if provided and driver has no phone or changed
  if (newExamination.driverPhoneSnapshot && newExamination.driverPhoneSnapshot.trim() !== '') {
    try {
      const cleanPhone = newExamination.driverPhoneSnapshot.trim();
      const existingDriver = await getDriverByCustomId(newExamination.driverId);
      if (existingDriver && (!existingDriver.phoneNumber || existingDriver.phoneNumber.trim() !== cleanPhone)) {
        await updateDriver(
          existingDriver.driverDocumentId,
          { phoneNumber: cleanPhone },
          currentUser
        );
      }
    } catch (phoneSyncErr) {
      console.warn('Auto-sync driver phone to master error (non-fatal):', phoneSyncErr);
    }
  }

  await logAuditAction({
    module: 'Data TENKO',
    recordId: tenkoId,
    action: 'CREATE_TENKO_EXAMINATION',
    newValue: {
      tenkoId,
      driverId: newExamination.driverId,
      driverName: newExamination.driverNameSnapshot,
      location: locSnapshot,
      summary: newExamination.summary,
      recommendation: newExamination.recommendation,
    },
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return newExamination;
}

export async function importTenkoBatch(
  rows: TenkoImportRow[],
  currentUser: { userId: string; fullName: string }
): Promise<TenkoImportResult> {
  const result: TenkoImportResult = {
    totalProcessed: rows.length,
    importedCount: 0,
    autoCreatedDriversCount: 0,
    errors: [],
  };

  if (rows.length === 0) return result;

  try {
    const [existingDrivers, existingLocations] = await Promise.all([
      getDrivers(),
      getLocations().catch(() => [] as Location[]),
    ]);
    const { idByNameLower } = buildLocationLookupMaps(existingLocations);
    const driverMap = new Map<string, { name: string; group: string; pos: DriverPosition }>();
    existingDrivers.forEach((d) => {
      if (d.driverId) {
        driverMap.set(d.driverId.toUpperCase(), {
          name: d.fullName,
          group: d.driverGroupId || 'TETAP',
          pos: d.position || 'DRIVER',
        });
      }
    });

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}`;

    // Process in chunks of 200 for Firestore batch safety
    const CHUNK_SIZE = 200;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j];
        const overallIndex = i + j + 1;
        const cleanDriverId = (row.driverId || `DRV-IMP-${overallIndex}`).trim().toUpperCase();
        const tenkoId = `TNK_${datePrefix}_${cleanDriverId.replace(/[^A-Z0-9_-]/g, '_')}_${String(overallIndex).padStart(4, '0')}`;
        const docId = tenkoId;

        const existingDriverInfo = driverMap.get(cleanDriverId);

        const driverName = (row.driverName || existingDriverInfo?.name || `Driver ${cleanDriverId}`).trim();
        const position = row.position || existingDriverInfo?.pos || (cleanDriverId.startsWith('KNK') ? 'KENEK' : 'DRIVER');
        const driverGroup = row.driverGroup || existingDriverInfo?.group || 'TETAP';

        // Auto-register driver in map and driver collection if not exists
        if (!existingDriverInfo) {
          const driverDocId = generateDriverDocId(cleanDriverId);
          const driverRef = doc(db, 'drivers', driverDocId);
          batch.set(driverRef, {
            driverDocumentId: driverDocId,
            driverId: cleanDriverId,
            fullName: driverName,
            driverGroupId: driverGroup,
            position,
            status: 'ACTIVE',
            createdAt: now.toISOString(),
            createdBy: currentUser.fullName || 'Import TENKO',
          }, { merge: true });
          driverMap.set(cleanDriverId, { name: driverName, group: driverGroup, pos: position });
          result.autoCreatedDriversCount++;
        }

        const sys = Number(row.bloodPressureSystolic) || 120;
        const dia = Number(row.bloodPressureDiastolic) || 80;
        const bpResult = row.bloodPressureResult || `${sys}/${dia} mmHg`;
        const temp = Number(row.temperature) || 36.5;
        const hr = Number(row.heartRate) || 75;
        const sleepHours = Number(row.offDutySleepDuration) || 7;
        const alc = row.alcoholTest || 'NEGATIVE';
        const drug = row.drugTest || 'NO TEST';

        // Auto calculate summary & recommendation if not provided
        let summary: ExaminationSummary = row.summary || 'PASSED';
        let recommendation: ExaminationRecommendation = row.recommendation || 'FIT TO WORK';

        if (!row.summary || !row.recommendation) {
          const isHighBP = sys >= 140 || dia >= 90;
          const isLowBP = sys <= 90 || dia <= 60;
          const isFever = temp >= 37.5;
          const isHypo = temp <= 35.5;
          const isHighHR = hr >= 100 || hr <= 50;
          const isSleepDeprived = sleepHours < 6;
          const isAlcPos = alc === 'POSITIVE';
          const isDrugPos = drug === 'POSITIVE';

          if (isAlcPos || isDrugPos || sys >= 160 || dia >= 100 || temp >= 38.0) {
            summary = 'FAILED';
            recommendation = 'UNFIT TO WORK';
          } else if (isHighBP || isLowBP || isFever || isHypo || isHighHR || isSleepDeprived) {
            summary = 'PASSED';
            recommendation = 'FIT TO WORK WITH NOTE';
          } else {
            summary = 'PASSED';
            recommendation = 'FIT TO WORK';
          }
        }

        const examDoc: TenkoExamination = {
          tenkoDocumentId: docId,
          sequenceNumber: overallIndex,
          tenkoId,
          examinationDate: row.examinationDate || now.toISOString().split('T')[0],
          driverId: cleanDriverId,
          driverNameSnapshot: driverName,
          positionSnapshot: position,
          driverGroupSnapshot: driverGroup,
          rhaJmp: row.rhaJmp || 'READY',
          dokJmp: row.dokJmp || 'READY',
          dailyNonWorkingHours: row.dailyNonWorkingHours || (sleepHours >= 11 ? '>= 11 HOURS' : '< 11 HOURS'),
          offDutySleepDuration: sleepHours,
          temperature: temp,
          bloodPressureSystolic: sys,
          bloodPressureDiastolic: dia,
          bloodPressureResult: bpResult,
          heartRate: hr,
          alcoholTest: alc,
          drugTest: drug,
          appearance: row.appearance || 'NORMAL',
          eyes: row.eyes || 'NORMAL',
          face: row.face || 'NORMAL',
          hair: row.hair || 'NORMAL',
          emotionalRegulation: row.emotionalRegulation || 'NORMAL',
          problemSolving: row.problemSolving || 'NORMAL',
          selfAwareness: row.selfAwareness || 'NORMAL',
          communication: row.communication || 'NORMAL',
          decisionMaking: row.decisionMaking || 'NORMAL',
          balanceTest: row.balanceTest || 'NORMAL',
          interview: row.interview || 'NORMAL',
          summary,
          recommendation,
          note: row.note || 'Imported via Batch Excel',
          examinerUserId: currentUser.userId,
          examinerName: row.examinerName || currentUser.fullName,
          locationId: (() => {
            const resolvedName = resolveExaminationLocationName(
              { locationNameSnapshot: row.locationName, locationId: row.locationId, examinerUserId: currentUser.userId, examinerName: row.examinerName || currentUser.fullName },
              existingLocations
            );
            return idByNameLower.get(resolvedName.toLowerCase()) || row.locationId || resolvedName;
          })(),
          locationNameSnapshot: resolveExaminationLocationName(
            { locationNameSnapshot: row.locationName, locationId: row.locationId, examinerUserId: currentUser.userId, examinerName: row.examinerName || currentUser.fullName },
            existingLocations
          ),
          finishTime: row.finishTime || `${row.examinationDate || now.toISOString().split('T')[0]}T08:00:00.000Z`,
          createdAt: now.toISOString(),
          createdBy: currentUser.fullName || 'Import TENKO',
        };

        const examRef = doc(db, 'tenkoExaminations', docId);
        batch.set(examRef, examDoc);
        result.importedCount++;
      }

      await batch.commit();
    }

    invalidateCachePrefix('tenko:');
    if (result.autoCreatedDriversCount > 0) {
      invalidateCachePrefix('drivers:');
    }

    await logAuditAction({
      module: 'Data TENKO',
      recordId: `BATCH-IMPORT-${Date.now()}`,
      action: 'IMPORT_TENKO_BATCH',
      newValue: {
        totalProcessed: result.totalProcessed,
        importedCount: result.importedCount,
        autoCreatedDriversCount: result.autoCreatedDriversCount,
      },
      userId: currentUser.userId,
      userName: currentUser.fullName,
    });

    return result;
  } catch (err: any) {
    console.error('Batch import TENKO error:', err);
    result.errors.push(err.message || 'Gagal menyimpan data pemeriksaan ke database.');
    throw err;
  }
}

export async function deleteSelectedTenkoExaminations(
  docIds: string[],
  currentUser?: { userId: string; fullName: string }
): Promise<number> {
  const uniqueDocIds = Array.from(
    new Set(docIds.map((id) => (id || '').trim()).filter(Boolean))
  );
  if (uniqueDocIds.length === 0) return 0;

  try {
    const CHUNK_SIZE = 200;
    for (let i = 0; i < uniqueDocIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueDocIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((docId) => {
        batch.delete(doc(db, 'tenkoExaminations', docId));
      });
      await batch.commit();
    }

    invalidateCachePrefix('tenko:');

    if (currentUser) {
      await logAuditAction({
        module: 'Data TENKO',
        recordId: `DEL-BATCH-${Date.now()}`,
        action: 'DELETE_SELECTED_TENKO_EXAMINATIONS',
        newValue: {
          deletedCount: uniqueDocIds.length,
          sampleDocIds: uniqueDocIds.slice(0, 20),
        },
        userId: currentUser.userId,
        userName: currentUser.fullName,
      });
    }

    return uniqueDocIds.length;
  } catch (err: any) {
    console.error('Failed to delete selected TENKO examinations:', err);
    if (err?.code === 'permission-denied' || String(err?.message || '').toLowerCase().includes('permission')) {
      throw new Error('Akses ditolak: hanya Super Admin yang diizinkan menghapus data TENKO.');
    }
    throw err;
  }
}

export async function deleteAllTenkoExaminations(currentUser?: { userId: string; fullName: string }): Promise<number> {
  try {
    const snap = await getDocs(collection(db, 'tenkoExaminations'));
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

    invalidateCachePrefix('tenko:');

    if (currentUser) {
      await logAuditAction({
        module: 'Data TENKO',
        recordId: `PURGE-${Date.now()}`,
        action: 'DELETE_ALL_TENKO_EXAMINATIONS',
        newValue: { deletedCount: count },
        userId: currentUser.userId,
        userName: currentUser.fullName,
      });
    }

    return count;
  } catch (err) {
    console.error('Failed to delete all TENKO examinations:', err);
    throw err;
  }
}
