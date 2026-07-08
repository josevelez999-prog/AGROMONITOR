// ─── ESTADÍSTICAS ACUMULADAS POR CDT ─────────────────────────────────────────
// Mantiene contadores históricos (kg cosechados, vendidos, ingresos, mermas) en
// UN solo documento por CDT, actualizado con increment() atómico. Esto permite
// mostrar KPIs de todo el histórico leyendo 1 documento en vez de miles.

import { db } from "./firebase";
import { doc, setDoc, onSnapshot, increment } from "firebase/firestore";
import { getCurrentCdtId } from "./cdtContext";

// Actualiza los acumulados del CDT actual. Se llama al registrar cosecha/venta/merma.
// delta = objeto con los campos a sumar, ej: { kgCosechados: 50 }
export const acumular = async (delta) => {
  const cdtId = getCurrentCdtId();
  if (!cdtId || cdtId === "*") return;
  try {
    const payload = {};
    Object.entries(delta).forEach(([k, v]) => {
      const n = parseFloat(v) || 0;
      if (n !== 0) payload[k] = increment(n);
    });
    if (Object.keys(payload).length === 0) return;
    payload.cdtId = cdtId;
    payload.updatedAt = new Date().toISOString();
    await setDoc(doc(db, "estadisticas", cdtId), payload, { merge: true });
  } catch (e) {
    console.warn("No se pudo actualizar estadísticas:", e);
  }
};

// Suscripción a las estadísticas del CDT actual (1 solo documento = 1 lectura)
export const suscribirEstadisticas = (callback) => {
  const cdtId = getCurrentCdtId();
  if (!cdtId || cdtId === "*") { callback(null); return () => {}; }
  return onSnapshot(
    doc(db, "estadisticas", cdtId),
    (snap) => callback(snap.exists() ? snap.data() : {}),
    (err) => { console.warn("estadisticas:", err); callback(null); }
  );
};

// Al eliminar un registro, restar del acumulado (delta negativo)
export const revertir = async (delta) => {
  const negativo = {};
  Object.entries(delta).forEach(([k, v]) => { negativo[k] = -(parseFloat(v) || 0); });
  await acumular(negativo);
};
