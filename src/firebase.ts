import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import appletConfig from '../firebase-applet-config.json';

// Configuration provided by user and provisioned for operio-662b8
export const firebaseConfig = {
  apiKey: appletConfig.apiKey || "AIzaSyBfxe94nMZiuSRnSpASK-icVyEofGdSSkI",
  authDomain: appletConfig.authDomain || "operio-662b8.firebaseapp.com",
  databaseURL: "https://operio-662b8-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: appletConfig.projectId || "operio-662b8",
  storageBucket: appletConfig.storageBucket || "operio-662b8.firebasestorage.app",
  messagingSenderId: appletConfig.messagingSenderId || "163166211281",
  appId: appletConfig.appId || "1:163166211281:web:27fab0dc619bcfaae349f0",
  measurementId: appletConfig.measurementId || "G-VPG49BR8YP",
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore targeting the applet database ID or default
let firestoreInstance: Firestore;
try {
  if (appletConfig.firestoreDatabaseId && appletConfig.firestoreDatabaseId !== '(default)') {
    firestoreInstance = getFirestore(app, appletConfig.firestoreDatabaseId);
  } else {
    firestoreInstance = getFirestore(app);
  }
} catch (e) {
  console.warn('Fallback to default Firestore database', e);
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
export const auth = getAuth(app);

// Connectivity check as recommended in Firebase skill
(async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is currently offline or connecting...');
    }
  }
})();
