// ─── WRAPPERS INTELIGENTES DE FIRESTORE (multi-CDT) ──────────────────────────
// Estos wrappers reemplazan a collection/onSnapshot/addDoc del SDK y aplican
// automáticamente el filtro por cdtId. Así, cambiando solo el import en cada
// archivo, todas las consultas y escrituras quedan aisladas por CDT.

import {
  collection as _collection,
  query as _query,
  where as _where,
  onSnapshot as _onSnapshot,
  addDoc as _addDoc,
  getDocs as _getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import { getCurrentCdtId, isSuperAdmin } from "./cdtContext";

// Colecciones que NO deben filtrarse por cdtId
// (config vive dentro de cada CDT como subcolección o docs con cdtId; cdts es global)
const NO_FILTRAR = new Set(["cdts"]);

// Colecciones que llevan cdtId y por lo tanto se filtran
const FILTRAR = new Set([
  "readings", "cosechas_trabajador", "ventas", "mermas", "siniestros",
  "validaciones_tratamiento", "lotes", "diagnosticos", "formulas_nutritivas",
  "tasks", "inventario", "inventario_movimientos", "aplicaciones",
  "aplicaciones_programadas", "analisis_suelo", "incidencias", "instrucciones",
  "usuarios", "config",
]);

// Extrae el nombre de colección de una referencia
const getColName = (ref) => {
  try {
    // Una CollectionReference tiene .id con el nombre; una Query tiene _query...
    if (ref && ref.type === "collection") return ref.id;
    if (ref && ref.path) return ref.path.split("/")[0];
    return null;
  } catch { return null; }
};

// collection() que recuerda el nombre para filtrado posterior
export const collection = (dbArg, name, ...rest) => {
  const ref = _collection(dbArg, name, ...rest);
  // Guardamos el nombre en el objeto para poder filtrarlo luego
  try { ref.__colName = name; } catch {}
  return ref;
};

// Aplica filtro de cdtId a una referencia de colección si corresponde
const withCdtFilter = (ref, extraConstraints = []) => {
  const name = ref?.__colName || getColName(ref);
  const cdtId = getCurrentCdtId();

  // Si es una colección que se filtra y hay un cdtId activo (y no es super_admin viendo todo)
  if (name && FILTRAR.has(name) && cdtId && cdtId !== "*") {
    return _query(ref, _where("cdtId", "==", cdtId), ...extraConstraints);
  }
  // Si hay constraints extra pero no filtro de CDT, igual construir el query
  if (extraConstraints.length) {
    return _query(ref, ...extraConstraints);
  }
  return ref;
};

// query() que inyecta el filtro de cdtId
export const query = (ref, ...constraints) => {
  const name = ref?.__colName || getColName(ref);
  const cdtId = getCurrentCdtId();

  if (name && FILTRAR.has(name) && cdtId && cdtId !== "*") {
    return _query(ref, _where("cdtId", "==", cdtId), ...constraints);
  }
  return _query(ref, ...constraints);
};

// onSnapshot() que aplica filtro automáticamente cuando recibe una colección cruda
export const onSnapshot = (refOrQuery, ...rest) => {
  // Si es una CollectionReference cruda (no un query ya construido), aplicar filtro
  const isRawCollection = refOrQuery && refOrQuery.type === "collection";
  const target = isRawCollection ? withCdtFilter(refOrQuery) : refOrQuery;
  return _onSnapshot(target, ...rest);
};

// getDocs() con el mismo filtrado
export const getDocs = (refOrQuery) => {
  const isRawCollection = refOrQuery && refOrQuery.type === "collection";
  const target = isRawCollection ? withCdtFilter(refOrQuery) : refOrQuery;
  return _getDocs(target);
};

// addDoc() que inyecta el cdtId automáticamente al guardar
export const addDoc = (ref, data) => {
  const name = ref?.__colName || getColName(ref);
  const cdtId = getCurrentCdtId();

  if (name && FILTRAR.has(name) && cdtId && cdtId !== "*") {
    return _addDoc(ref, { ...data, cdtId });
  }
  return _addDoc(ref, data);
};

// Re-exportar todo lo demás del SDK que no necesita modificación
export {
  doc, updateDoc, deleteDoc, getDoc, setDoc,
  where, orderBy, limit, writeBatch, serverTimestamp,
} from "firebase/firestore";

export { db } from "./firebase";
