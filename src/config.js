import { initializeApp } from 'firebase/app';
import { getFunctions } from 'firebase/functions';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace with your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBrqsXv4OTu3W7ItucpRttQInmDgJMaUt0",
    authDomain: "ascenixdoctool.firebaseapp.com",
    projectId: "ascenixdoctool",
    storageBucket: "ascenixdoctool.firebasestorage.app",
    messagingSenderId: "346093107146",
    appId: "1:346093107146:web:e595727afa01283c0e8133"
  };

export const app = initializeApp(firebaseConfig);
export const functions = getFunctions(app);
export const db = getFirestore(app);
export const storage = getStorage(app);