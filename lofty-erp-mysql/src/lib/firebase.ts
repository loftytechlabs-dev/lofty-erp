import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  onAuthStateChanged,
  connectAuthEmulator,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  Firestore,
} from 'firebase/firestore';
import {
  getFunctions,
  connectFunctionsEmulator,
  Functions,
} from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if valid Firebase credentials are provided
export const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your-api-key-here' &&
  firebaseConfig.projectId
);

export const isDemoMode = import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_DEMO_MODE === 'true' || !isConfigured;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;

if (isConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app);

    // Optional Emulator support
    if (import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true') {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectFunctionsEmulator(functions, 'localhost', 5001);
      console.info('🔌 Connected to local Firebase Emulators');
    }
  } catch (err) {
    console.warn('Firebase initialization error, defaulting to interactive sandbox mode:', err);
  }
}

export { app, auth, db, functions };

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle() {
  if (!auth) {
    throw new Error('Firebase Auth is not configured. Please use Demo Mode or set Firebase environment variables.');
  }
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err: any) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
      return await signInWithRedirect(auth, googleProvider);
    }
    throw err;
  }
}

export async function logoutUser() {
  if (auth) {
    await fbSignOut(auth);
  }
}

export { onAuthStateChanged };
