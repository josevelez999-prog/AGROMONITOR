// ─── CONTEXTO CDT (multi-tenant) ─────────────────────────────────────────────
// Este módulo centraliza la lógica de "a qué CDT pertenece el usuario actual"
// y provee helpers para leer/escribir datos filtrados por CDT.

import { db } from "./firebase";
import {
  collection, query, where, onSnapshot, addDoc, doc, getDoc, getDocs,
} from "firebase/firestore";

// El CDT actual se guarda en memoria durante la sesión.
// super_admin puede cambiarlo para "entrar" a un CDT específico.
let _currentCdtId = null;
let _userRole = null;
let _isSuperAdmin = false;

export const setCdtContext = ({ cdtId, role, isSuperAdmin }) => {
  _currentCdtId = cdtId;
  _userRole = role;
  _isSuperAdmin = !!isSuperAdmin;
};

export const getCurrentCdtId = () => _currentCdtId;
export const getUserRole = () => _userRole;
export const isSuperAdmin = () => _isSuperAdmin;

// Para super_admin que "entra" a un CDT (cambia el CDT activo sin cambiar de sesión)
export const switchCdt = (cdtId) => {
  _currentCdtId = cdtId;
  // Guardar para que sobreviva a la recarga (solo super_admin usa esto)
  try {
    if (cdtId) localStorage.setItem("super_cdt_override", cdtId);
    else localStorage.removeItem("super_cdt_override");
  } catch {}
};

// Lee el CDT que el super_admin eligió ver (persiste tras recarga)
export const getSuperOverride = () => {
  try { return localStorage.getItem("super_cdt_override"); } catch { return null; }
};

// Limpia el override (volver a la vista propia)
export const clearSuperOverride = () => {
  try { localStorage.removeItem("super_cdt_override"); } catch {}
};

// ─── Helpers de datos filtrados por CDT ──────────────────────────────────────

// Devuelve un query de una colección filtrada por el CDT actual.
// Si es super_admin viendo "todos" (cdtId null), devuelve la colección completa.
export const cdtQuery = (colName, ...extraConstraints) => {
  const col = collection(db, colName);
  if (_currentCdtId && _currentCdtId !== "*") {
    return query(col, where("cdtId", "==", _currentCdtId), ...extraConstraints);
  }
  return query(col, ...extraConstraints);
};

// Suscripción a una colección filtrada por CDT
export const cdtOnSnapshot = (colName, callback, errorCallback) => {
  return onSnapshot(cdtQuery(colName), callback, errorCallback || (e => console.error(`${colName}:`, e)));
};

// Agrega automáticamente el cdtId al guardar un documento
export const cdtAddDoc = (colName, data) => {
  const withCdt = { ...data, cdtId: _currentCdtId };
  return addDoc(collection(db, colName), withCdt);
};

// ─── Carga de la info del CDT (cultivos, naves, etc.) ────────────────────────

let _cdtData = null; // cache del CDT actual

export const loadCdtData = async (cdtId) => {
  if (!cdtId) return null;
  try {
    const snap = await getDoc(doc(db, "cdts", cdtId));
    if (snap.exists()) {
      _cdtData = { id: snap.id, ...snap.data() };
      return _cdtData;
    }
  } catch (e) { console.error("loadCdtData:", e); }
  return null;
};

export const getCdtData = () => _cdtData;

// Lista todos los CDT (solo super_admin)
export const listCdts = async () => {
  try {
    const snap = await getDocs(collection(db, "cdts"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("listCdts:", e); return []; }
};

// ─── Cultivos por defecto (fallback si un CDT no definió los suyos) ──────────
export const CULTIVOS_DEFAULT = {
  jitomate:  { name: "Jitomate",  emoji: "🍅", color: "#c0392b", tipoUbicacion: "Invernadero", ubicaciones: ["INV 2", "INV 3", "INV 5", "INV 6"] },
  fresa:     { name: "Fresa",     emoji: "🍓", color: "#e74c3c", tipoUbicacion: "Nave", ubicaciones: ["Nave 1", "Nave 2", "Nave 3"] },
  arandano:  { name: "Arándano",  emoji: "🫐", color: "#2980b9", tipoUbicacion: "Nave", ubicaciones: ["Nave 1", "Nave 2", "Nave 3"] },
  zarzamora: { name: "Zarzamora", emoji: "🫐", color: "#8e44ad", tipoUbicacion: "Nave", ubicaciones: ["Nave 1", "Nave 2", "Nave 3"] },
};

// Devuelve los cultivos del CDT actual, o los default si no tiene definidos
export const getCultivos = () => {
  if (_cdtData && _cdtData.cultivos && Object.keys(_cdtData.cultivos).length) {
    return _cdtData.cultivos;
  }
  return CULTIVOS_DEFAULT;
};
