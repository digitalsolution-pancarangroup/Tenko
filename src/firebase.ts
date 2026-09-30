import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

const firebaseConfig = {
  projectId: firebaseConfigJson.projectId,
  appId: firebaseConfigJson.appId,
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Helper function to create an Auth user without disrupting the current admin session
export async function createFirebaseAuthAccount(email: string, password: string): Promise<string> {
  const { createUserWithEmailAndPassword, signOut: secondarySignOut } = await import('firebase/auth');
  // Create or retrieve secondary app
  const secondaryAppName = 'SecondaryAuthApp';
  const existingApp = getApps().find((a) => a.name === secondaryAppName);
  const secondaryApp = existingApp || initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
    const uid = userCredential.user.uid;
    // Sign out from secondary auth immediately so it does not persist
    await secondarySignOut(secondaryAuth);
    return uid;
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      // Email is already registered in Firebase Auth, we can proceed
      return '';
    }
    throw err;
  }
}

// Initialize Firestore with auto-detect long polling and persistent local cache for sandbox resilience
function getInitializedFirestore() {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfigJson.firestoreDatabaseId || '(default)'
    );
  } catch (_e) {
    return firebaseConfigJson.firestoreDatabaseId
      ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
      : getFirestore(app);
  }
}

export const db = getInitializedFirestore();

// Test Firestore backend connection gracefully as per Firebase Integration skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client operating in resilient offline/cache mode.');
    }
  }
}
testConnection();

export default app;

