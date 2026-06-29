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

// Detectar si en sesión previa hubo un error grave de IndexedDB
let useMemoryCache = false;
try {
  const failCount = parseInt(localStorage.getItem("firestore_fail_count") || "0", 10);
  if (failCount >= 2) {
    // Después de 2 fallos consecutivos, usar memoria sola (sin offline pero estable)
    console.warn("⚠ Firestore en modo memoria (sin offline) por errores previos");
    useMemoryCache = true;
  }
} catch {}

// Configuración del caché — usa persistentSingleTabManager (más estable que Multi)
const cacheConfig = useMemoryCache
  ? memoryLocalCache()  // Sin offline, pero sin bug INTERNAL ASSERTION
  : persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: true }),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    });

export const db = initializeFirestore(app, { localCache: cacheConfig });
export const auth = getAuth(app);

// ─── AUTO-RECOVERY GLOBAL ─────────────────────────────────────────────────────
// Captura errores no manejados del SDK y limpia el caché automáticamente
if (typeof window !== "undefined") {
  const handleFirestoreCrash = async (errorMsg) => {
    const isFirestoreBug = 
      errorMsg.includes("INTERNAL ASSERTION") ||
      errorMsg.includes("Unexpected state") ||
      errorMsg.includes("IndexedDB") && errorMsg.includes("Firestore");
    
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
    
    // Limpiar todas las BDs de Firestore
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
    
    // Recargar después de un momento
    setTimeout(() => window.location.reload(), 800);
  };

  // Errores síncronos no capturados
  window.addEventListener("error", (e) => {
    const msg = e?.error?.message || e?.message || "";
    handleFirestoreCrash(String(msg));
  });

  // Promesas rechazadas no manejadas
  window.addEventListener("unhandledrejection", (e) => {
    const msg = e?.reason?.message || String(e?.reason) || "";
    handleFirestoreCrash(String(msg));
  });

  // Si la app funcionó correctamente por 30 segundos, resetear contador de fallos
  setTimeout(() => {
    try { localStorage.setItem("firestore_fail_count", "0"); } catch {}
  }, 30000);
}
