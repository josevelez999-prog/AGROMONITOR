// Firebase con caché en memoria (estable, sin el bug INTERNAL ASSERTION del SDK)

import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  memoryLocalCache,
  CACHE_SIZE_UNLIMITED,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyCxoMQYwhTtGS9mQxIlRSKdq6tS9abXhXo",
  authDomain: "agromonitor-d389e.firebaseapp.com",
  projectId: "agromonitor-d389e",
  storageBucket: "agromonitor-d389e.firebasestorage.app",
  messagingSenderId: "301802649161",
  appId: "1:301802649161:web:eb351e8e47d14b79b4f198"
};

const app = initializeApp(firebaseConfig);

// El usuario puede activar el modo offline (persistencia en disco) manualmente.
// Por defecto usamos memoryLocalCache que es 100% estable y NO sufre el bug
// "INTERNAL ASSERTION FAILED" que afecta a persistentLocalCache en móviles.
let modoOffline = false;
try {
  modoOffline = localStorage.getItem("greenlog_offline_mode") === "1";
} catch {}

let cacheConfig;
if (modoOffline) {
  // Offline activado manualmente por el usuario
  cacheConfig = persistentLocalCache({
    tabManager: persistentSingleTabManager({ forceOwnership: true }),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  });
} else {
  // Modo por defecto: memoria. Estable, sin bug. Requiere internet para operar.
  cacheConfig = memoryLocalCache();
}

export const db = initializeFirestore(app, { localCache: cacheConfig });
export const auth = getAuth(app);
