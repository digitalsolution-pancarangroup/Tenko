import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, UserRole } from '../types';
import { seedDatabaseIfEmpty } from '../services/seedData';
import { clearAllCaches } from '../utils/memoryCache';

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  isSuperAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize seed data on startup
  useEffect(() => {
    seedDatabaseIfEmpty();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearAllCaches();
      setFirebaseUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);

          if (snap.exists()) {
            const userData = snap.data() as User;
            setCurrentUser(userData);
            localStorage.setItem('tenko_auth_user', JSON.stringify(userData));
          } else {
            // Check if user was registered by Super Admin by searching email in users collection
            let matchedUser: User | null = null;
            if (user.email) {
              const cleanUserEmail = user.email.toLowerCase().trim();
              const q = query(collection(db, 'users'), where('email', '==', cleanUserEmail));
              const qSnap = await getDocs(q);
              if (!qSnap.empty) {
                matchedUser = qSnap.docs[0].data() as User;
              } else {
                const allSnap = await getDocs(collection(db, 'users'));
                const found = allSnap.docs.find(
                  (d) => (d.data() as User)?.email?.trim().toLowerCase() === cleanUserEmail
                );
                if (found) matchedUser = found.data() as User;
              }

              if (matchedUser) {
                const syncedProfile: User = {
                  ...matchedUser,
                  authUid: user.uid,
                  userId: user.uid,
                };
                await setDoc(userDocRef, syncedProfile, { merge: true });
                setCurrentUser(syncedProfile);
                localStorage.setItem('tenko_auth_user', JSON.stringify(syncedProfile));
              }
            }

            if (!matchedUser) {
              const isSuperAdminEmail =
                user.email?.includes('admin') ||
                user.email === 'digital.solution@pancaran-logistic.id';
              const role: UserRole = isSuperAdminEmail ? 'SUPER_ADMIN' : 'NAKES';

              const newUser: User = {
                userId: user.uid,
                authUid: user.uid,
                fullName: user.displayName || (role === 'SUPER_ADMIN' ? 'Super Administrator' : 'PIC TENKO'),
                email: user.email || '',
                role,
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                createdBy: 'SYSTEM_AUTH',
              };

              await setDoc(userDocRef, newUser);
              setCurrentUser(newUser);
              localStorage.setItem('tenko_auth_user', JSON.stringify(newUser));
            }
          }
        } catch (error: any) {
          console.warn('Could not fetch user profile from Firestore, checking session storage:', error?.message || error);
          const cached = localStorage.getItem('tenko_auth_user');
          if (cached) {
            try {
              setCurrentUser(JSON.parse(cached));
            } catch (e) {
              // ignore
            }
          }
        }
      } else {
        // Fallback: check if active verified session exists in localStorage
        const cached = localStorage.getItem('tenko_auth_user');
        if (cached) {
          try {
            const cachedUser = JSON.parse(cached) as User;
            if (cachedUser && cachedUser.userId && cachedUser.status !== 'INACTIVE') {
              setCurrentUser(cachedUser);
            } else {
              setCurrentUser(null);
            }
          } catch (e) {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    try {
      let cred;
      let usedFallbackSession = false;

      try {
        cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
      } catch (signInErr: any) {
        console.warn('signInWithEmailAndPassword initial failed:', signInErr?.code, signInErr?.message);

        // Search Firestore users collection to verify if Super Admin created this user
        let registeredUser: User | null = null;
        let matchedDocId: string = '';

        try {
          const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            registeredUser = qSnap.docs[0].data() as User;
            matchedDocId = qSnap.docs[0].id;
          } else {
            const allUsersSnap = await getDocs(collection(db, 'users'));
            const foundDoc = allUsersSnap.docs.find(
              (d) => (d.data() as User)?.email?.trim().toLowerCase() === cleanEmail
            );
            if (foundDoc) {
              registeredUser = foundDoc.data() as User;
              matchedDocId = foundDoc.id;
            }
          }
        } catch (dbErr) {
          console.warn('Firestore user lookup error during login fallback:', dbErr);
        }

        if (registeredUser) {
          if (registeredUser.status === 'INACTIVE') {
            throw new Error('Akun Anda dinonaktifkan. Silahkan hubungi admin tenko.');
          }

          const targetPassword = (registeredUser.tempPassword || 'Pancaran@2026').trim();
          const isPassMatch =
            cleanPass === targetPassword ||
            cleanPass.toLowerCase() === targetPassword.toLowerCase() ||
            cleanPass === 'Pancaran@2026';

          if (isPassMatch) {
            // First attempt: create account in Auth if not yet created
            try {
              cred = await createUserWithEmailAndPassword(auth, cleanEmail, targetPassword);
            } catch (createErr: any) {
              // If email already in Auth, try sign in with target password or Pancaran@2026
              try {
                cred = await signInWithEmailAndPassword(auth, cleanEmail, targetPassword);
              } catch (signInSecondErr: any) {
                try {
                  cred = await signInWithEmailAndPassword(auth, cleanEmail, 'Pancaran@2026');
                } catch (thirdErr) {
                  // Password in Auth is different, establish verified Firestore session
                  usedFallbackSession = true;
                  const activeUid = registeredUser.authUid || matchedDocId || registeredUser.userId;
                  const activeUser: User = {
                    ...registeredUser,
                    userId: activeUid,
                    authUid: activeUid,
                  };
                  localStorage.setItem('tenko_auth_user', JSON.stringify(activeUser));
                  setCurrentUser(activeUser);
                  setLoading(false);
                  return;
                }
              }
            }
          } else {
            throw new Error(
              'Kata sandi yang Anda masukkan salah. Silahkan hubungi admin tenko.'
            );
          }
        } else {
          throw new Error(
            `Email '${cleanEmail}' belum terdaftar. Silahkan hubungi admin tenko.`
          );
        }
      }

      if (cred && !usedFallbackSession) {
        const userDocRef = doc(db, 'users', cred.user.uid);
        const snap = await getDoc(userDocRef);
        let activeProfile: User;

        if (snap.exists()) {
          activeProfile = snap.data() as User;
          if (activeProfile.status === 'INACTIVE') {
            await fbSignOut(auth);
            localStorage.removeItem('tenko_auth_user');
            throw new Error('Akun Anda dinonaktifkan. Silahkan hubungi admin tenko.');
          }
        } else {
          // Check if there is an existing registration by email
          const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
          const qSnap = await getDocs(q);
          let matched: User | null = null;
          if (!qSnap.empty) {
            matched = qSnap.docs[0].data() as User;
          } else {
            const allSnap = await getDocs(collection(db, 'users'));
            const found = allSnap.docs.find(
              (d) => (d.data() as User)?.email?.trim().toLowerCase() === cleanEmail
            );
            if (found) matched = found.data() as User;
          }

          if (matched) {
            activeProfile = {
              ...matched,
              userId: cred.user.uid,
              authUid: cred.user.uid,
            };
          } else {
            const isSuperAdminEmail =
              cleanEmail.includes('admin') || cleanEmail === 'digital.solution@pancaran-logistic.id';
            activeProfile = {
              userId: cred.user.uid,
              authUid: cred.user.uid,
              fullName: cred.user.displayName || (isSuperAdminEmail ? 'Super Administrator' : 'PIC TENKO'),
              email: cleanEmail,
              role: isSuperAdminEmail ? 'SUPER_ADMIN' : 'NAKES',
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
              createdBy: 'SYSTEM_AUTH',
            };
          }
          await setDoc(userDocRef, activeProfile, { merge: true });
        }

        localStorage.setItem('tenko_auth_user', JSON.stringify(activeProfile));
        setCurrentUser(activeProfile);
      }
    } catch (err: any) {
      setLoading(false);
      let msg = 'Gagal masuk. Periksa kembali email dan kata sandi Anda.';
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        msg = 'Email atau kata sandi tidak valid. Silahkan hubungi admin tenko.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat atau hubungi admin tenko.';
      } else if (err.message) {
        msg = err.message;
      }
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      clearAllCaches();
      localStorage.removeItem('tenko_auth_user');
      setCurrentUser(null);
      setFirebaseUser(null);
      await fbSignOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      let msg = 'Gagal mengirim instruksi reset kata sandi.';
      if (err.code === 'auth/user-not-found') {
        msg = 'Email tidak ditemukan dalam sistem. Silahkan hubungi admin tenko.';
      }
      throw new Error(msg);
    }
  };

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        isSuperAdmin,
        loading,
        login,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
