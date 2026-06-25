// Firebase con persistencia offline activada
// Las escrituras sin conexión se guardan en IndexedDB y se sincronizan al volver la red

import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCxoMQYwhTtGS9mQxIlRSKdq6tS9abXhXo",
  authDomain: "agromonitor-d389e.firebaseapp.com",
  projectId: "agromonitor-d389e",
  storageBucket: "agromonitor-d389e.firebasestorage.app",
  messagingSenderId: "301802649161",
  appId: "1:301802649161:web:eb351e8e47d14b79b4f198"
};

const app = initializeApp(firebaseConfig);

// Firestore con caché local persistente (IndexedDB) y soporte multi-pestaña
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  }),
});

export const auth = getAuth(app);
