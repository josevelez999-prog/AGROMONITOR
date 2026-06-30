// Firebase con persistencia offline + auto-recovery del bug INTERNAL ASSERTION

import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  memoryLocalCache,
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

// ─── Detectar fallos previos y elegir modo de cache ─────────────────────────
let useMemoryCache = false;
try {
  const failCount = parseInt(localStorage.getItem("firestore_fail_count") || "0", 10);
  if (failCount >= 2) {
    console.warn("⚠ Firestore en modo memoria (sin offline) por errores previos");
    useMemoryCache = true;
  }
} catch {}

// persistentSingleTabManager (más estable que Multi para móviles)
// Si ya hubo 2+ fallos, usa memoryLocalCache (sin bug pero sin offline)
const cacheConfig = useMemoryCache
  ? memoryLocalCache()
  : persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: true }),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    });

export const db = initializeFirestore(app, { localCache: cacheConfig });
export const auth = getAuth(app);

// ─── AUTO-RECOVERY GLOBAL ─────────────────────────────────────────────────────
if (typeof window !== "undefined") {
  const handleFirestoreCrash = async (errorMsg) => {
    const isFirestoreBug =
      errorMsg.includes("INTERNAL ASSERTION") ||
      errorMsg.includes("Unexpected state") ||
      (errorMsg.includes("IndexedDB") && errorMsg.includes("Firestore"));

    if (!isFirestoreBug) return;

    // Incrementar contador de fallos
    try {
      const c = parseInt(localStorage.getItem("firestore_fail_count") || "0", 10);
      localStorage.setItem("firestore_fail_count", String(c + 1));
    } catch {}

    // Evitar bucle infinito de recargas
    const lastReload = parseInt(sessionStorage.getItem("firestore_last_reload") || "0", 10);
    const now = Date.now();
    if (now - lastReload < 10000) {
      console.error("⚠ Firestore sigue fallando después de recarga reciente");
      return;
    }
    sessionStorage.setItem("firestore_last_reload", String(now));

    console.warn("🔧 Auto-recuperación: limpiando IndexedDB de Firestore...");

    try {
      if ("databases" in indexedDB) {
        const dbs = await indexedDB.databases();
        await Promise.all(
          dbs.filter(d => d.name?.includes("firestore"))
             .map(d => new Promise((res) => {
                const req = indexedDB.deleteDatabase(d.name);
                req.onsuccess = req.onerror = req.onblocked = () => res();
             }))
        );
      }
    } catch (e) {
      console.error("Error limpiando IndexedDB:", e);
    }

    setTimeout(() => window.location.reload(), 800);
  };

  window.addEventListener("error", (e) => {
    const msg = e?.error?.message || e?.message || "";
    handleFirestoreCrash(String(msg));
  });

  window.addEventListener("unhandledrejection", (e) => {
    const msg = e?.reason?.message || String(e?.reason) || "";
    handleFirestoreCrash(String(msg));
  });

  // Si la app funcionó correctamente por 30 segundos, resetear contador
  setTimeout(() => {
    try {
      const c = parseInt(localStorage.getItem("firestore_fail_count") || "0", 10);
      if (c > 0) {
        localStorage.setItem("firestore_fail_count", "0");
        console.log("✓ Contador de fallos Firestore reseteado");
      }
    } catch {}
  }, 30000);
}
