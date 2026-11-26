import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
const firebaseConfig = {
  apiKey: "AIzaSyAg1ZJaP_qPazQqtfqqMr4krNBdZGXtrcM",
  authDomain: "nso-system.firebaseapp.com",
  projectId: "nso-system",
  storageBucket: "nso-system.firebasestorage.app",
  messagingSenderId: "261413404035",
  appId: "1:261413404035:web:f58b73ffaab34b2c538ab6"
};

const requiredFirebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  NEXT_PUBLIC_FIREBASE_APP_ID: firebaseConfig.appId
};

export const missingFirebaseEnv = Object.entries(requiredFirebaseEnv)
  .filter(([, value]) => !String(value ?? '').trim())
  .map(([key]) => key);

export const firebaseDiagnostics = {
  enabled: missingFirebaseEnv.length === 0,
  missingEnv: missingFirebaseEnv,
  projectId: firebaseConfig.projectId || '',
  authDomain: firebaseConfig.authDomain || '',
  storageBucket: firebaseConfig.storageBucket || '',
  hasApiKey: Boolean(firebaseConfig.apiKey),
  hasAppId: Boolean(firebaseConfig.appId),
  hasMessagingSenderId: Boolean(firebaseConfig.messagingSenderId)
};

export const firebaseEnabled = firebaseDiagnostics.enabled;

export const firebaseApp: FirebaseApp | null = firebaseEnabled
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;



export const firebaseDb: Firestore | null = firebaseApp 
  ? initializeFirestore(firebaseApp, { 
      experimentalForceLongPolling: true, 
      ignoreUndefinedProperties: true 
    }) 
  : null;

export const firebaseStorage: FirebaseStorage | null = firebaseApp && firebaseConfig.storageBucket ? getStorage(firebaseApp) : null;

export function isFirebaseConfigured() {
  return firebaseEnabled && Boolean(firebaseDb);
}
