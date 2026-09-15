import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, createFirebaseAuthAccount } from '../firebase';
import { User, UserRole, AccountStatus } from '../types';
import { logAuditAction } from './auditService';

export const INITIAL_USERS: User[] = [
  {
    userId: 'usr_admin_01',
    authUid: 'usr_admin_01',
    fullName: 'Super Administrator TENKO',
    email: 'admin@tenko.local',
    role: 'SUPER_ADMIN',
    phoneNumber: '0811-9988-7766',
    locationName: 'Pusat Logistik Jakarta',
    status: 'ACTIVE',
    tempPassword: 'Pancaran@2026',
    createdAt: new Date().toISOString(),
    createdBy: 'System Seed',
  },
  {
    userId: 'usr_nakes_01',
    authUid: 'usr_nakes_01',
    fullName: 'Ns. Ratna Sari, S.Kep',
    email: 'ratna.nakes@pancaran-logistic.id',
    role: 'NAKES',
    sipNumber: '503/SIP.042/SDK/2024',
    phoneNumber: '0812-3456-7890',
    locationName: 'Pool Marunda - Jakarta Utara',
    status: 'ACTIVE',
    tempPassword: 'Pancaran@2026',
    createdAt: new Date().toISOString(),
    createdBy: 'System Seed',
  },
  {
    userId: 'usr_sec_01',
    authUid: 'usr_sec_01',
    fullName: 'Suhartono (Posko Gate Out)',
    email: 'security.marunda@pancaran-logistic.id',
    role: 'SECURITY',
    phoneNumber: '0813-8877-6655',
    locationName: 'Pool Marunda - Jakarta Utara',
    status: 'ACTIVE',
    tempPassword: 'Pancaran@2026',
    createdAt: new Date().toISOString(),
    createdBy: 'System Seed',
  },
];

export async function getUsers(): Promise<User[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (!snap.empty) {
      const users = snap.docs.map((d) => {
        const data = d.data();
        return {
          userId: d.id,
          authUid: data.authUid || d.id,
          fullName: data.fullName || '',
          email: data.email || '',
          role: data.role || 'NAKES',
          phoneNumber: data.phoneNumber || '',
          sipNumber: data.sipNumber || '',
          locationId: data.locationId || '',
          locationName: data.locationName || '',
          status: data.status || 'ACTIVE',
          tempPassword: data.tempPassword || '',
          createdAt: data.createdAt || new Date().toISOString(),
          createdBy: data.createdBy || 'System',
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        } as User;
      });
      return users.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    return INITIAL_USERS;
  } catch (err) {
    console.warn('Fallback to local users (Firestore quota/offline):', err);
    return INITIAL_USERS;
  }
}

export async function createUser(
  userData: {
    fullName: string;
    email: string;
    role: UserRole;
    phoneNumber?: string;
    sipNumber?: string;
    locationId?: string;
    locationName?: string;
    tempPassword?: string;
    status: AccountStatus;
  },
  currentUser: { userId: string; fullName: string }
): Promise<User> {
  const targetEmail = userData.email.trim().toLowerCase();
  const rawPassword = userData.tempPassword?.trim() || 'Pancaran@2026';

  // Automatically provision the Firebase Auth account so the user can sign in immediately
  let authUid = '';
  try {
    authUid = await createFirebaseAuthAccount(targetEmail, rawPassword);
  } catch (authErr: any) {
    console.warn('Auth account creation note:', authErr?.message || authErr);
  }

  // Use the authUid if available, otherwise generate a structured ID
  const docId = authUid || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newUser: User = {
    userId: docId,
    authUid: authUid || docId,
    fullName: userData.fullName.trim(),
    email: targetEmail,
    role: userData.role,
    phoneNumber: userData.phoneNumber?.trim() || '',
    sipNumber: userData.sipNumber?.trim() || '',
    locationId: userData.locationId?.trim() || '',
    locationName: userData.locationName?.trim() || '',
    tempPassword: rawPassword,
    status: userData.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: currentUser.fullName,
  };

  await setDoc(doc(db, 'users', docId), newUser);

  // If role is NAKES, also ensure it syncs with nakes collection for medical certificates if desired
  if (userData.role === 'NAKES') {
    const nakesId = `NKS-${Date.now().toString().slice(-4)}`;
    await setDoc(doc(db, 'nakes', docId), {
      nakesDocumentId: docId,
      nakesId,
      fullName: userData.fullName.trim(),
      sipNumber: userData.sipNumber?.trim() || '',
      phoneNumber: userData.phoneNumber?.trim() || '',
      email: targetEmail,
      status: userData.status || 'ACTIVE',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.fullName,
    });
  }

  await logAuditAction({
    action: 'CREATE',
    entity: 'USER' as any,
    entityId: newUser.userId,
    newValue: {
      userId: newUser.userId,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
    },
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });

  return newUser;
}

export async function updateUser(
  userId: string,
  updatedFields: Partial<User>,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docRef = doc(db, 'users', userId);
  const snap = await getDoc(docRef);
  const prev = snap.exists() ? snap.data() : null;

  const payload: Record<string, any> = {
    ...updatedFields,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.fullName,
  };

  await updateDoc(docRef, payload);

  await logAuditAction({
    action: 'UPDATE',
    entity: 'USER' as any,
    entityId: userId,
    previousValue: prev,
    newValue: payload,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}

export async function deleteUser(
  userId: string,
  currentUser: { userId: string; fullName: string }
): Promise<void> {
  const docRef = doc(db, 'users', userId);
  const snap = await getDoc(docRef);
  const prev = snap.exists() ? snap.data() : null;

  await deleteDoc(docRef);

  await logAuditAction({
    action: 'DELETE',
    entity: 'USER' as any,
    entityId: userId,
    previousValue: prev,
    userId: currentUser.userId,
    userName: currentUser.fullName,
  });
}
