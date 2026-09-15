import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
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

// Use specified firestoreDatabaseId if configured
export const db = firebaseConfigJson.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

// Test Firestore connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'system', 'connection'));
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client offline or connecting...');
    } else if (error?.message?.includes('Quota limit exceeded') || error?.message?.includes('quota')) {
      console.warn('Firestore daily read quota reached on this project.');
    }
  }
}

testConnection();

export default app;
