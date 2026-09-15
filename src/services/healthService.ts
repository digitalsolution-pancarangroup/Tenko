import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { HealthIndication, VitaminItem, DriverHealthRecord, HealthCaseStatus } from '../types';
import { logAuditAction } from './auditService';
import { INITIAL_HEALTH_INDICATIONS, INITIAL_VITAMINS, INITIAL_DRIVER_HEALTH_RECORDS } from './seedData';
import { generateVitaminDocId, generateDriverHealthRecordDocId, sanitizeCode } from '../utils/idGenerators';

const LOCAL_STORAGE_INDICATIONS_KEY = 'tenko_health_indications';
const LOCAL_STORAGE_VITAMINS_KEY = 'tenko_vitamins';
const LOCAL_STORAGE_RECORDS_KEY = 'tenko_driver_health_records';

function cleanUpdatePayload(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// ================= MASTER HEALTH INDICATIONS =================
export async function getHealthIndications(): Promise<HealthIndication[]> {
  try {
    const snap = await getDocs(collection(db, 'healthIndications'));
    if (!snap.empty) {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          indicationDocumentId: d.id,
          indicationId: data.indicationId || d.id,
          name: data.name || '',
          note: data.note || '',
          status: data.status || 'ACTIVE',
          createdAt: data.createdAt || new Date().toISOString(),
          createdBy: data.createdBy,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        } as HealthIndication;
      });
      return items.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch (e) {
    console.warn('Firestore fallback to local health indications:', e);
  }

  // Local storage fallback
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_INDICATIONS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return INITIAL_HEALTH_INDICATIONS;
}

export async function createHealthIndication(
  item: { indicationId?: string; name: string; note: string; status: 'ACTIVE' | 'INACTIVE' },
  currentUser: { userId: string; fullName: string }
): Promise<HealthIndication> {
  const code = item.indicationId || `IND_${Date.now().toString().slice(-4)}`;
  const docId = sanitizeCode(code, 'IND');
  const newIndication: HealthIndication = {
    indicationDocumentId: docId,
    indicationId: code,
    name: item.name.trim(),
    note: item.note.trim(),
    status: item.status,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.fullName,
  };

  try {
    await setDoc(doc(db, 'healthIndications', docId), cleanUpdatePayload(newIndication));
  } catch (e) {
    console.warn('Firestore write failed, saving to local cache:', e);
  }

  // Update local storage
  try {
    const current = await getHealthIndications();
    const updated = [newIndication, ...current.filter((c) => c.indicationId !== code)];
    localStorage.setItem(LOCAL_STORAGE_INDICATIONS_KEY, JSON.stringify(updated));
  } catch {}

  await logAuditAction({
    module: 'Master Data',
    action: 'CREATE',
    entity: 'HEALTH_INDICATION',
    entityId: newIndication.indicationId,
    newValue: newIndication,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return newIndication;
}

export async function updateHealthIndication(
  docId: string,
  updates: Partial<HealthIndication>,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const cleanUpdates = cleanUpdatePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  });

  try {
    await updateDoc(doc(db, 'healthIndications', docId), cleanUpdates);
  } catch (e) {
    console.warn('Firestore update failed, updating local storage:', e);
  }

  try {
    const current = await getHealthIndications();
    const updated = current.map((item) =>
      item.indicationDocumentId === docId || item.indicationId === docId
        ? { ...item, ...cleanUpdates }
        : item
    );
    localStorage.setItem(LOCAL_STORAGE_INDICATIONS_KEY, JSON.stringify(updated));
  } catch {}

  await logAuditAction({
    module: 'Master Data',
    action: 'UPDATE',
    entity: 'HEALTH_INDICATION',
    entityId: docId,
    newValue: cleanUpdates,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

export async function deleteHealthIndication(
  docId: string,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'healthIndications', docId));
  } catch (e) {
    console.warn('Firestore delete failed:', e);
  }

  try {
    const current = await getHealthIndications();
    const updated = current.filter(
      (item) => item.indicationDocumentId !== docId && item.indicationId !== docId
    );
    localStorage.setItem(LOCAL_STORAGE_INDICATIONS_KEY, JSON.stringify(updated));
  } catch {}

  await logAuditAction({
    module: 'Master Data',
    action: 'DELETE',
    entity: 'HEALTH_INDICATION',
    entityId: docId,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

// ================= MASTER VITAMINS =================
export async function getVitamins(): Promise<VitaminItem[]> {
  try {
    const snap = await getDocs(collection(db, 'vitamins'));
    if (!snap.empty) {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          vitaminDocumentId: d.id,
          vitaminId: data.vitaminId || d.id,
          name: data.name || '',
          category: data.category || 'Umum',
          dosageUnit: data.dosageUnit || 'Tablet',
          description: data.description || '',
          status: data.status || 'ACTIVE',
          createdAt: data.createdAt || new Date().toISOString(),
          createdBy: data.createdBy,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        } as VitaminItem;
      });
      return items.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch (e) {
    console.warn('Firestore fallback to local vitamins:', e);
  }

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_VITAMINS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return INITIAL_VITAMINS;
}

export async function createVitamin(
  item: { vitaminId?: string; name: string; category?: string; dosageUnit: string; description?: string; status: 'ACTIVE' | 'INACTIVE' },
  currentUser: { userId: string; fullName: string }
): Promise<VitaminItem> {
  const code = item.vitaminId || `VTM_${Date.now().toString().slice(-4)}`;
  const docId = generateVitaminDocId(code);
  const newVitamin: VitaminItem = {
    vitaminDocumentId: docId,
    vitaminId: code,
    name: item.name.trim(),
    category: item.category?.trim() || 'Umum',
    dosageUnit: item.dosageUnit.trim() || 'Tablet',
    description: item.description?.trim() || '',
    status: item.status,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.fullName,
  };

  try {
    await setDoc(doc(db, 'vitamins', docId), cleanUpdatePayload(newVitamin));
  } catch (e) {
    console.warn('Firestore write failed, saving to local vitamins:', e);
  }

  try {
    const current = await getVitamins();
    const updated = [newVitamin, ...current.filter((c) => c.vitaminId !== code)];
    localStorage.setItem(LOCAL_STORAGE_VITAMINS_KEY, JSON.stringify(updated));
  } catch {}

  await logAuditAction({
    module: 'Master Data',
    action: 'CREATE',
    entity: 'VITAMIN',
    entityId: newVitamin.vitaminId,
    newValue: newVitamin,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return newVitamin;
}

export async function updateVitamin(
  docId: string,
  updates: Partial<VitaminItem>,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const cleanUpdates = cleanUpdatePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  });

  try {
    await updateDoc(doc(db, 'vitamins', docId), cleanUpdates);
  } catch (e) {
    console.warn('Firestore update failed:', e);
  }

  try {
    const current = await getVitamins();
    const updated = current.map((item) =>
      item.vitaminDocumentId === docId || item.vitaminId === docId
        ? { ...item, ...cleanUpdates }
        : item
    );
    localStorage.setItem(LOCAL_STORAGE_VITAMINS_KEY, JSON.stringify(updated));
  } catch {}

  await logAuditAction({
    module: 'Master Data',
    action: 'UPDATE',
    entity: 'VITAMIN',
    entityId: docId,
    newValue: cleanUpdates,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

export async function deleteVitamin(
  docId: string,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'vitamins', docId));
  } catch (e) {
    console.warn('Firestore delete failed:', e);
  }

  try {
    const current = await getVitamins();
    const updated = current.filter(
      (item) => item.vitaminDocumentId !== docId && item.vitaminId !== docId
    );
    localStorage.setItem(LOCAL_STORAGE_VITAMINS_KEY, JSON.stringify(updated));
  } catch {}

  await logAuditAction({
    module: 'Master Data',
    action: 'DELETE',
    entity: 'VITAMIN',
    entityId: docId,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

// ================= DRIVER HEALTH RECORDS =================
export async function getDriverHealthRecords(): Promise<DriverHealthRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'driverHealthRecords'));
    if (!snap.empty) {
      const records = snap.docs.map((d) => {
        const data = d.data();
        return {
          recordDocumentId: d.id,
          recordId: data.recordId || d.id,
          tenkoId: data.tenkoId || '',
          tenkoDocumentId: data.tenkoDocumentId,
          examinationDate: data.examinationDate || data.createdAt?.slice(0, 10) || '',
          driverId: data.driverId || '',
          driverName: data.driverName || '',
          driverGroup: data.driverGroup || '',
          position: data.position || 'DRIVER',
          tenkoResult: data.tenkoResult || 'FIT TO WORK',
          indication: data.indication || '',
          analyze: data.analyze || '',
          measurement: data.measurement || '',
          vitamin: data.vitamin || '',
          vitaminDetails: data.vitaminDetails || [],
          evaluation: data.evaluation || '',
          status: data.status || 'ACTIVE',
          solvedAt: data.solvedAt,
          solvedBy: data.solvedBy,
          solvedTenkoId: data.solvedTenkoId,
          createdAt: data.createdAt || new Date().toISOString(),
          createdBy: data.createdBy || '',
          examinerName: data.examinerName || '',
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        } as DriverHealthRecord;
      });
      return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (e) {
    console.warn('Firestore fallback to local health records:', e);
  }

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_RECORDS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return INITIAL_DRIVER_HEALTH_RECORDS;
}

export async function createDriverHealthRecord(
  recordData: Omit<DriverHealthRecord, 'recordDocumentId' | 'recordId' | 'createdAt' | 'createdBy'> & { createdBy?: string },
  currentUser: { userId: string; fullName: string }
): Promise<DriverHealthRecord> {
  const docId = generateDriverHealthRecordDocId(recordData.driverId);
  const recordId = docId;

  const newRecord: DriverHealthRecord = {
    ...recordData,
    recordDocumentId: docId,
    recordId,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.userId,
    examinerName: currentUser.fullName,
    status: recordData.status || 'ACTIVE',
  };

  try {
    await setDoc(doc(db, 'driverHealthRecords', docId), cleanUpdatePayload(newRecord));
  } catch (e) {
    console.warn('Firestore write failed, saving to local records:', e);
  }

  try {
    const current = await getDriverHealthRecords();
    const updated = [newRecord, ...current.filter((r) => r.recordId !== recordId)];
    localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(updated));
  } catch {}

  await logAuditAction({
    module: 'Driver Health',
    action: 'CREATE',
    entity: 'DRIVER_HEALTH',
    entityId: newRecord.recordId,
    newValue: newRecord,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return newRecord;
}

export async function updateDriverHealthRecord(
  docId: string,
  updates: Partial<DriverHealthRecord>,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const cleanUpdates = cleanUpdatePayload({
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  });

  try {
    await updateDoc(doc(db, 'driverHealthRecords', docId), cleanUpdates);
  } catch (e) {
    console.warn('Firestore update failed:', e);
  }

  try {
    const current = await getDriverHealthRecords();
    const updated = current.map((r) =>
      r.recordDocumentId === docId || r.recordId === docId
        ? { ...r, ...cleanUpdates }
        : r
    );
    localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(updated));
  } catch {}

  await logAuditAction({
    module: 'Driver Health',
    action: 'UPDATE',
    entity: 'DRIVER_HEALTH',
    entityId: docId,
    newValue: cleanUpdates,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

export async function solveDriverHealthRecord(
  recordId: string,
  evaluation: string,
  solvedTenkoId: string | undefined,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const now = new Date().toISOString();
  await updateDriverHealthRecord(
    recordId,
    {
      status: 'SOLVED',
      evaluation: evaluation.trim(),
      solvedAt: now,
      solvedBy: currentUser.fullName,
      solvedTenkoId,
    },
    currentUser
  );
}

export async function getActiveHealthRecordForDriver(driverId: string): Promise<DriverHealthRecord | null> {
  if (!driverId) return null;
  const records = await getDriverHealthRecords();
  const activeRecords = records.filter(
    (r) => r.driverId.toLowerCase() === driverId.toLowerCase() && r.status === 'ACTIVE'
  );
  return activeRecords.length > 0 ? activeRecords[0] : null;
}
