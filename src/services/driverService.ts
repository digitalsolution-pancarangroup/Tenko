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
import { Driver } from '../types';
import { logAuditAction } from './auditService';
import { INITIAL_DRIVERS } from './seedData';
import { generateDriverDocId } from '../utils/idGenerators';

export async function getDrivers(): Promise<Driver[]> {
  try {
    const q = query(collection(db, 'drivers'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => d.data() as Driver);
    }
    return INITIAL_DRIVERS;
  } catch (error) {
    try {
      const snap = await getDocs(collection(db, 'drivers'));
      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as Driver);
      }
      return INITIAL_DRIVERS;
    } catch (e) {
      console.warn('Fallback to local drivers (Firestore quota/offline):', e);
      return INITIAL_DRIVERS;
    }
  }
}

export async function getDriverByCustomId(driverId: string): Promise<Driver | null> {
  if (!driverId) return null;
  const structuredDocId = generateDriverDocId(driverId);
  try {
    const directSnap = await getDoc(doc(db, 'drivers', structuredDocId));
    if (directSnap.exists()) {
      return directSnap.data() as Driver;
    }
    const q = query(collection(db, 'drivers'), where('driverId', '==', driverId.trim()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as Driver;
    }
  } catch (e) {
    console.warn('Fallback to local driver search (Firestore quota/offline):', e);
  }
  const localMatch = INITIAL_DRIVERS.find(
    (d) => d.driverId.toUpperCase() === driverId.trim().toUpperCase()
  );
  return localMatch || null;
}

export async function searchDrivers(searchTerm: string): Promise<Driver[]> {
  const all = await getDrivers();
  const term = searchTerm.trim().toLowerCase();
  if (!term) return all;
  return all.filter(
    (d) =>
      d.driverId.toLowerCase().includes(term) ||
      d.fullName.toLowerCase().includes(term) ||
      d.driverGroupId.toLowerCase().includes(term)
  );
}

export async function createDriver(
  driverData: Omit<Driver, 'driverDocumentId' | 'createdAt' | 'driverNumber' | 'createdBy'>,
  currentUser: { userId: string; fullName: string }
): Promise<Driver> {
  const existing = await getDriverByCustomId(driverData.driverId);
  if (existing) {
    throw new Error('Driver ID sudah terdaftar.');
  }

  const allDrivers = await getDrivers();
  const newNumber = (allDrivers.length + 1).toString();
  const docId = generateDriverDocId(driverData.driverId);

  const newDriver: Driver = {
    ...driverData,
    driverDocumentId: docId,
    driverNumber: newNumber,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.fullName,
    status: driverData.status || 'ACTIVE',
  };

  await setDoc(doc(db, 'drivers', docId), newDriver);

  await logAuditAction({
    module: 'Master Driver/Kenek',
    recordId: newDriver.driverId,
    action: 'CREATE_DRIVER',
    newValue: newDriver,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return newDriver;
}

export async function updateDriver(
  driverDocId: string,
  updatedFields: Partial<Driver>,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docRef = doc(db, 'drivers', driverDocId);
  const snap = await getDoc(docRef);
  const prevData = snap.exists() ? snap.data() : null;

  const rawUpdate = {
    ...updatedFields,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  };

  const dataToUpdate: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawUpdate)) {
    if (value !== undefined) {
      dataToUpdate[key] = value;
    }
  }

  await updateDoc(docRef, dataToUpdate);

  await logAuditAction({
    module: 'Master Driver/Kenek',
    recordId: prevData?.driverId || driverDocId,
    action: 'UPDATE_DRIVER',
    previousValue: prevData,
    newValue: dataToUpdate,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

export async function toggleDriverStatus(
  driverDocId: string,
  newStatus: 'ACTIVE' | 'INACTIVE',
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  await updateDriver(driverDocId, { status: newStatus }, currentUser);
}

export async function deleteDriver(
  driverDocId: string,
  driverId: string,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docRef = doc(db, 'drivers', driverDocId);
  const snap = await getDoc(docRef);
  const prevData = snap.exists() ? snap.data() : null;

  // Import deleteDoc dynamically if needed or from firestore
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(docRef);

  await logAuditAction({
    module: 'Master Driver/Kenek',
    recordId: driverId,
    action: 'DELETE_DRIVER',
    previousValue: prevData,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

export async function deleteAllDrivers(
  currentUser: { userId: string; fullName: string }
): Promise<number> {
  const snap = await getDocs(collection(db, 'drivers'));
  if (snap.empty) return 0;

  const count = snap.size;
  const docs = snap.docs;
  const CHUNK_SIZE = 200;

  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  try {
    localStorage.removeItem('tenko_drivers');
    localStorage.setItem('tenko_sample_drivers_cleared', 'true');
  } catch {}

  await logAuditAction({
    module: 'Master Driver/Kenek',
    recordId: `CLEAR_ALL_DRIVERS_${Date.now()}`,
    action: 'DELETE_ALL_DRIVERS',
    newValue: { count },
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return count;
}

export interface DriverImportRow {
  driverNumber?: string | number;
  driverId: string;
  fullName: string;
  phoneNumber?: string;
  driverGroupId: string;
  position: 'DRIVER' | 'KENEK';
  joinDate?: string;
  terminateDate?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  createdBy?: string;
}

export interface DriverImportResult {
  totalProcessed: number;
  importedCount: number;
  updatedCount: number;
  createdGroupsCount: number;
  createdGroups: string[];
  errors: string[];
}

export async function importDriversBatch(
  rows: DriverImportRow[],
  currentUser: { userId: string; fullName: string }
): Promise<DriverImportResult> {
  const result: DriverImportResult = {
    totalProcessed: rows.length,
    importedCount: 0,
    updatedCount: 0,
    createdGroupsCount: 0,
    createdGroups: [],
    errors: [],
  };

  if (rows.length === 0) return result;

  try {
    // 1. Fetch existing drivers and driver groups
    const { getDriverGroups, createDriverGroup } = await import('./masterService');
    const [existingDrivers, existingGroups] = await Promise.all([
      getDrivers(),
      getDriverGroups(),
    ]);

    const driverMapByCustomId = new Map<string, Driver>();
    existingDrivers.forEach((d) => {
      if (d.driverId) {
        driverMapByCustomId.set(d.driverId.trim().toUpperCase(), d);
      }
    });

    const groupMapByName = new Map<string, string>();
    existingGroups.forEach((g) => {
      const name = g.groupName || g.driverGroupName || g.groupId;
      groupMapByName.set(name.trim().toUpperCase(), name);
    });

    // 2. Identify missing driver groups and create them automatically
    const uniqueGroupsInFile = new Set<string>();
    rows.forEach((r) => {
      if (r.driverGroupId && r.driverGroupId.trim()) {
        uniqueGroupsInFile.add(r.driverGroupId.trim());
      }
    });

    for (const groupName of uniqueGroupsInFile) {
      const upperName = groupName.toUpperCase();
      if (!groupMapByName.has(upperName)) {
        try {
          const autoCode = 'GRP-' + upperName.replace(/[^A-Z0-9]/g, '').substring(0, 10);
          await createDriverGroup(
            {
              groupId: autoCode || 'GRP-AUTO',
              groupName: groupName.toUpperCase(),
              description: 'Dibuat otomatis dari Import Excel Master Driver',
              status: 'ACTIVE',
            },
            currentUser
          );
          groupMapByName.set(upperName, groupName.toUpperCase());
          result.createdGroupsCount += 1;
          result.createdGroups.push(groupName.toUpperCase());
        } catch (e: any) {
          console.warn(`Gagal auto-create group ${groupName}:`, e);
        }
      }
    }

    // 3. Process Drivers (Insert or Update) using Firestore writeBatch in chunks of 250 for speed and atomicity
    const BATCH_CHUNK_SIZE = 250;
    
    // Prepare all operations
    const operations: { type: 'UPDATE' | 'SET'; docRef: any; payload: any }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cleanId = (row.driverId || '').toString().trim().toUpperCase();
      const cleanName = (row.fullName || '').toString().trim();

      if (!cleanId || !cleanName) {
        result.errors.push(`Baris #${i + 1}: Driver ID atau Nama kosong.`);
        continue;
      }

      const existing = driverMapByCustomId.get(cleanId);
      const groupNameMapped = row.driverGroupId ? row.driverGroupId.trim().toUpperCase() : 'TETAP';

      if (existing) {
        // Update existing driver without overwriting existing phone number if new phone is empty
        const docRef = doc(db, 'drivers', existing.driverDocumentId);
        const updatePayload: Partial<Driver> = {
          fullName: cleanName,
          position: row.position || existing.position,
          driverGroupId: groupNameMapped || existing.driverGroupId,
          status: row.status || existing.status,
          joinDate: row.joinDate || existing.joinDate,
          terminateDate: row.terminateDate !== undefined ? row.terminateDate : existing.terminateDate,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.fullName,
        };

        // Only update phone number if a non-empty phone is explicitly provided in the import file
        if (row.phoneNumber && row.phoneNumber.trim() !== '') {
          updatePayload.phoneNumber = row.phoneNumber.trim();
        }

        if (row.driverNumber) {
          updatePayload.driverNumber = row.driverNumber;
        }

        operations.push({ type: 'UPDATE', docRef, payload: updatePayload });
        result.updatedCount += 1;
      } else {
        // Create new driver
        const docId = 'drv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + '_' + i;
        const newDriver: Driver = {
          driverDocumentId: docId,
          driverNumber: row.driverNumber || (existingDrivers.length + result.importedCount + 1).toString(),
          driverId: cleanId,
          fullName: cleanName,
          phoneNumber: (row.phoneNumber && row.phoneNumber.trim()) || '',
          position: row.position || (cleanId.startsWith('KNK') ? 'KENEK' : 'DRIVER'),
          driverGroupId: groupNameMapped,
          joinDate: row.joinDate || new Date().toISOString().split('T')[0],
          terminateDate: row.terminateDate || '',
          status: row.status || (row.terminateDate ? 'INACTIVE' : 'ACTIVE'),
          createdAt: row.createdAt || new Date().toISOString(),
          createdBy: row.createdBy || currentUser.fullName,
        };

        const docRef = doc(db, 'drivers', docId);
        operations.push({ type: 'SET', docRef, payload: newDriver });
        driverMapByCustomId.set(cleanId, newDriver);
        result.importedCount += 1;
      }
    }

    // Execute operations in chunks of writeBatch
    for (let c = 0; c < operations.length; c += BATCH_CHUNK_SIZE) {
      const chunk = operations.slice(c, c + BATCH_CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const op of chunk) {
        if (op.type === 'UPDATE') {
          batch.update(op.docRef, op.payload);
        } else {
          batch.set(op.docRef, op.payload);
        }
      }
      await batch.commit();
    }

    // 4. Log overall audit
    await logAuditAction({
      module: 'Master Driver/Kenek',
      recordId: `BATCH_IMPORT_${Date.now()}`,
      action: 'IMPORT_EXCEL_DRIVERS',
      newValue: {
        totalRows: rows.length,
        importedCount: result.importedCount,
        updatedCount: result.updatedCount,
        createdGroups: result.createdGroups,
      },
      userId: currentUser.userId,
      userName: currentUser.fullName,
    });

    return result;
  } catch (error: any) {
    console.error('Error importing drivers batch:', error);
    result.errors.push(error.message || 'Terjadi kegagalan saat memproses import.');
    return result;
  }
}


