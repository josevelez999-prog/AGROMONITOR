// ─── PERMISOS Y ROLES GREENLOG ────────────────────────────────────────────────
// Este archivo centraliza la lógica de permisos. La UI lo usa para ocultar
// acciones, pero la seguridad real debe reforzarse también en Firestore Rules.

export const ROLE_INFO = {
  trabajador: {
    label: "Trabajador",
    short: "Trabajador",
    icon: "👷",
    color: "#27ae60",
    scope: "cdt",
    desc: "Captura datos en campo",
  },
  admin: {
    label: "Administrador CDT",
    short: "Admin CDT",
    icon: "🔑",
    color: "#1a2533",
    scope: "cdt",
    desc: "Administra su CDT",
  },
  observador: {
    label: "Observador CDT",
    short: "Observador CDT",
    icon: "👁️",
    color: "#2980b9",
    scope: "cdt",
    desc: "Solo lectura en su CDT + IA",
  },
  super_admin: {
    label: "Super Admin",
    short: "Super Admin",
    icon: "🛡️",
    color: "#8e44ad",
    scope: "global",
    desc: "Administra todos los CDT",
  },
  observador_global: {
    label: "Observador Super Admin",
    short: "Obs. Global",
    icon: "👁️‍🗨️",
    color: "#16a085",
    scope: "global",
    desc: "Vista global solo lectura + IA",
  },
  // Alias por si en algún documento se guarda con este nombre.
  observador_superadmin: {
    label: "Observador Super Admin",
    short: "Obs. Global",
    icon: "👁️‍🗨️",
    color: "#16a085",
    scope: "global",
    desc: "Vista global solo lectura + IA",
  },
};

export const OBSERVER_ROLES = ["observador", "observador_global", "observador_superadmin"];
export const GLOBAL_VIEW_ROLES = ["super_admin", "observador_global", "observador_superadmin"];
export const EDIT_ROLES = ["admin", "super_admin"];

export const normalizeRole = (role) => role || "trabajador";
export const getRoleInfo = (role) => ROLE_INFO[normalizeRole(role)] || ROLE_INFO.trabajador;
export const isObserverRole = (role) => OBSERVER_ROLES.includes(normalizeRole(role));
export const isGlobalViewerRole = (role) => GLOBAL_VIEW_ROLES.includes(normalizeRole(role));
export const canManageCdts = (role) => normalizeRole(role) === "super_admin";
export const canEditData = (role) => EDIT_ROLES.includes(normalizeRole(role));
export const canDeleteData = (role) => normalizeRole(role) === "super_admin";
export const canManageUsers = (role) => EDIT_ROLES.includes(normalizeRole(role));
export const canUseAI = (role) => [
  "admin", "super_admin", "observador", "observador_global", "observador_superadmin", "trabajador"
].includes(normalizeRole(role));
