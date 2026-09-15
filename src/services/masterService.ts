import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { DriverGroup, Location, Nakes, User } from '../types';
import { logAuditAction } from './auditService';
import { INITIAL_DRIVER_GROUPS, INITIAL_LOCATIONS, INITIAL_NAKES } from './seedData';
import { generateLocationDocId, sanitizeCode } from '../utils/idGenerators';

function cleanUpdatePayload(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// ================= DRIVER GROUPS =================
export async function getDriverGroups(): Promise<DriverGroup[]> {
  try {
    const snap = await getDocs(collection(db, 'driverGroups'));
    if (!snap.empty) {
      const groups = snap.docs.map((d) => {
        const data = d.data();
        return {
          groupDocumentId: d.id,
          groupId: data.groupId || d.id,
          groupName: data.groupName || data.driverGroupName || d.id,
          description: data.description || '',
          status: data.status || 'ACTIVE',
          createdAt: data.createdAt || new Date().toISOString(),
          createdBy: data.createdBy || 'System',
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        } as DriverGroup;
      });
      return groups.sort((a, b) => a.groupName.localeCompare(b.groupName, undefined, { numeric: true, sensitivity: 'base' }));
    }
    return INITIAL_DRIVER_GROUPS;
  } catch (e) {
    console.warn('Fallback to local driver groups (Firestore quota/offline):', e);
    return INITIAL_DRIVER_GROUPS;
  }
}

export async function createDriverGroup(
  groupData: { groupId: string; groupName: string; description?: string; status: 'ACTIVE' | 'INACTIVE' },
  currentUser: { userId: string; fullName: string }
): Promise<DriverGroup> {
  const docId = groupData.groupId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const newGroup: DriverGroup = {
    groupDocumentId: docId,
    groupId: groupData.groupId.trim().toUpperCase(),
    groupName: groupData.groupName.trim().toUpperCase(),
    description: groupData.description?.trim() || '',
    status: groupData.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: currentUser.fullName,
  };

  await setDoc(doc(db, 'driverGroups', docId), newGroup);

  await logAuditAction({
    action: 'CREATE',
    entity: 'DRIVER_GROUP',
    entityId: newGroup.groupId,
    newValue: newGroup,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return newGroup;
}

export async function updateDriverGroup(
  groupDocumentId: string | undefined,
  updatedFields: Partial<DriverGroup>,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docId = groupDocumentId || updatedFields.groupId || 'grp_unknown';
  const docRef = doc(db, 'driverGroups', docId);
  const snap = await getDoc(docRef);
  const prev = snap.exists() ? snap.data() : null;

  const dataToUpdate = cleanUpdatePayload({
    ...updatedFields,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  });

  await updateDoc(docRef, dataToUpdate);

  await logAuditAction({
    action: 'UPDATE',
    entity: 'DRIVER_GROUP',
    entityId: prev?.groupId || docId,
    previousValue: prev,
    newValue: dataToUpdate,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

export async function deleteDriverGroup(
  groupDocumentId: string | undefined,
  groupId: string,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docId = groupDocumentId || groupId;
  const docRef = doc(db, 'driverGroups', docId);
  const snap = await getDoc(docRef);
  const prev = snap.exists() ? snap.data() : null;

  await deleteDoc(docRef);

  await logAuditAction({
    action: 'DELETE',
    entity: 'DRIVER_GROUP',
    entityId: groupId,
    previousValue: prev,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

// ================= LOCATIONS =================
export async function getLocations(): Promise<Location[]> {
  try {
    const snap = await getDocs(collection(db, 'locations'));
    if (!snap.empty) {
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          locationDocumentId: d.id,
          locationId: data.locationId || d.id,
          locationName: data.locationName || d.id,
          address: data.address || '',
          status: data.status || 'ACTIVE',
          createdAt: data.createdAt || new Date().toISOString(),
          createdBy: data.createdBy || 'System',
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        } as Location;
      });
    }
    return INITIAL_LOCATIONS;
  } catch (e) {
    console.warn('Fallback to local locations (Firestore quota/offline):', e);
    return INITIAL_LOCATIONS;
  }
}

export async function createLocation(
  locData: { locationId: string; locationName: string; address?: string; status: 'ACTIVE' | 'INACTIVE' },
  currentUser: { userId: string; fullName: string }
): Promise<Location> {
  const docId = generateLocationDocId(locData.locationId || locData.locationName);
  const newLoc: Location = {
    locationDocumentId: docId,
    locationId: locData.locationId.trim().toUpperCase(),
    locationName: locData.locationName.trim(),
    address: locData.address?.trim() || '',
    status: locData.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: currentUser.fullName,
  };

  await setDoc(doc(db, 'locations', docId), newLoc);

  await logAuditAction({
    action: 'CREATE',
    entity: 'LOCATION',
    entityId: newLoc.locationId,
    newValue: newLoc,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return newLoc;
}

export async function updateLocation(
  locationDocumentId: string | undefined,
  updatedFields: Partial<Location>,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docId = locationDocumentId || updatedFields.locationId || 'loc_unknown';
  const docRef = doc(db, 'locations', docId);
  const snap = await getDoc(docRef);
  const prev = snap.exists() ? snap.data() : null;

  const dataToUpdate = cleanUpdatePayload({
    ...updatedFields,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  });

  await updateDoc(docRef, dataToUpdate);

  await logAuditAction({
    action: 'UPDATE',
    entity: 'LOCATION',
    entityId: prev?.locationId || docId,
    previousValue: prev,
    newValue: dataToUpdate,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

export async function deleteLocation(
  locationDocumentId: string | undefined,
  locationId: string,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docId = locationDocumentId || locationId;
  const docRef = doc(db, 'locations', docId);
  const snap = await getDoc(docRef);
  const prev = snap.exists() ? snap.data() : null;

  await deleteDoc(docRef);

  await logAuditAction({
    action: 'DELETE',
    entity: 'LOCATION',
    entityId: locationId,
    previousValue: prev,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

// ================= NAKES =================
export async function getNakesList(): Promise<Nakes[]> {
  try {
    const snap = await getDocs(collection(db, 'nakes'));
    if (!snap.empty) {
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          nakesDocumentId: d.id,
          nakesId: data.nakesId || d.id,
          fullName: data.fullName || '',
          sipNumber: data.sipNumber || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          status: data.status || 'ACTIVE',
          createdAt: data.createdAt || new Date().toISOString(),
          createdBy: data.createdBy || 'System',
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        } as Nakes;
      });
    }
    return INITIAL_NAKES;
  } catch (e) {
    console.warn('Fallback to local nakes (Firestore quota/offline):', e);
    return INITIAL_NAKES;
  }
}

export async function createNakes(
  nakesData: { nakesId: string; fullName: string; sipNumber?: string; phoneNumber?: string; status: 'ACTIVE' | 'INACTIVE' },
  currentUser: { userId: string; fullName: string }
): Promise<Nakes> {
  const cleanNks = sanitizeCode(nakesData.nakesId, 'NKS');
  const docId = cleanNks.startsWith('NKS_') ? cleanNks : `NKS_${cleanNks}`;
  const newNakes: Nakes = {
    nakesDocumentId: docId,
    nakesId: nakesData.nakesId.trim().toUpperCase(),
    fullName: nakesData.fullName.trim(),
    sipNumber: nakesData.sipNumber?.trim() || '',
    phoneNumber: nakesData.phoneNumber?.trim() || '',
    status: nakesData.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: currentUser.fullName,
  };

  await setDoc(doc(db, 'nakes', docId), newNakes);

  await logAuditAction({
    action: 'CREATE',
    entity: 'NAKES',
    entityId: newNakes.nakesId,
    newValue: newNakes,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return newNakes;
}

export async function updateNakes(
  nakesDocumentId: string | undefined,
  updatedFields: Partial<Nakes>,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docId = nakesDocumentId || updatedFields.nakesId || 'nks_unknown';
  const docRef = doc(db, 'nakes', docId);
  const snap = await getDoc(docRef);
  const prev = snap.exists() ? snap.data() : null;

  const dataToUpdate = cleanUpdatePayload({
    ...updatedFields,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  });

  await updateDoc(docRef, dataToUpdate);

  await logAuditAction({
    action: 'UPDATE',
    entity: 'NAKES',
    entityId: prev?.nakesId || docId,
    previousValue: prev,
    newValue: dataToUpdate,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

export async function deleteNakes(
  nakesDocumentId: string | undefined,
  nakesId: string,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docId = nakesDocumentId || nakesId;
  const docRef = doc(db, 'nakes', docId);
  const snap = await getDoc(docRef);
  const prev = snap.exists() ? snap.data() : null;

  await deleteDoc(docRef);

  await logAuditAction({
    action: 'DELETE',
    entity: 'NAKES',
    entityId: nakesId,
    previousValue: prev,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

// ================= USERS =================
export async function getUsers(): Promise<User[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as User);
  } catch (e) {
    return [];
  }
}
