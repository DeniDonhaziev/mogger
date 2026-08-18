import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCsHTOrdTXeZFiZRYTqBucZuQZUiJ0NF6Q',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (typeof location !== 'undefined' && /mogger\.su$/i.test(location.hostname) ? 'mogger.su' : 'moggerai.web.app'),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'web99-a3eb7',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'web99-a3eb7.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '523711596432',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:523711596432:web:f479b9f661b0d7d2735515',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
