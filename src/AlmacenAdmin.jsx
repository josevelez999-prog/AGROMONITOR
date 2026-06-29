// ─── ALMACEN ADMIN - Sistema completo de inventario tipo FIRA ─────────────────
// Sub-pestañas: 📦 Insumos | 📊 Movimientos | 📄 Reporte Mensual FIRA

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc,
  query, orderBy
} from "firebase/firestore";

// ─── Categorías oficiales FIRA ──────────────────────────────────────────────
const CATEGORIAS = [
  { id: "agroquimicos", label: "Agroquímicos",  color: "#27ae60", emoji: "🧪" },
  { id: "ferreteria",   label: "Ferretería",    color: "#7f8c8d", emoji: "🔧" },
  { id: "combustibles", label: "Combustibles",  color: "#e67e22", emoji: "⛽" },
  { id: "limpieza",     label: "Limpieza",      color: "#3498db", emoji: "🧹" },
  { id: "plasticos",    label: "Plásticos",     color: "#9b59b6", emoji: "🥤" },
  { id: "semillas",     label: "Semillas y material vegetativo", color: "#2ecc71", emoji: "🌱" },
];

const TIPOS_ADQUISICION = ["Compra", "Donación", "Transferencia"];
const PRESENTACIONES = ["L", "Kg", "g", "ml", "PZA", "KIT", "BOLSA", "SEMILLA", "PLANTULA"];

const fmt = (n, d = 2) => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtI = (n) => Number(n || 0).toLocaleString("es-MX");
const num = (v) => parseFloat(v) || 0;
const INP = { padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 12, width: "100%", boxSizing: "border-box", background: "#fff", color: "#111" };
const LBL = { fontSize: 10, color: "#888", display: "block", marginBottom: 3, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" };

// Carga SheetJS bajo demanda desde CDN
const loadSheetJS = () => new Promise((resolve, reject) => {
  if (window.XLSX) return resolve(window.XLSX);
  const script = document.createElement("script");
  script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
  script.onload = () => resolve(window.XLSX);
  script.onerror = reject;
  document.head.appendChild(script);
});

export default function AlmacenAdmin() {
  const [subtab, setSubtab] = useState("insumos");
  const [insumos, setInsumos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "inventario"), snap => {
      setInsumos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const u2 = onSnapshot(query(collection(db, "inventario_movimientos"), orderBy("fecha", "desc")), snap => {
      setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); };
  }, []);

  const SUBTABS = [
    { id: "insumos",      label: "📦 Insumos",         color: "#27ae60" },
    { id: "movimientos",  label: "📊 Movimientos",     color: "#2980b9" },
    { id: "reporte",      label: "📄 Reporte mensual", color: "#8e44ad" },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: 4 }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSubtab(t.id)}
            style={{ flex: 1, padding: "10px 4px", border: "none", borderRadius: 10, background: subtab === t.id ? t.color : "transparent", color: subtab === t.id ? "#fff" : "#555", cursor: "pointer", fontSize: 12, fontWeight: subtab === t.id ? 700 : 500 }}>
            {t.label}
          </button>
        ))}
      </div>

      {subtab === "insumos"     && <InsumosTab insumos={insumos} />}
      {subtab === "movimientos" && <MovimientosTab insumos={insumos} movimientos={movimientos} />}
      {subtab === "reporte"     && <ReporteTab insumos={insumos} movimientos={movimientos} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SUB-TAB 1: INSUMOS (lista maestra de insumos del almacén)
// ────────────────────────────────────────────────────────────────────────────
function InsumosTab({ insumos }) {
  const initial = { name: "", categoria: "agroquimicos", tarjeta: "", tipoAdquisicion: "Compra", presentacion: "Kg", precio: 0, stockInicial: 0, minStock: 0, notas: "" };
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(null);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");

  const save = async () => {
    if (!form.name) { alert("Falta el nombre del insumo"); return; }
    if (!form.tarjeta) { alert("Falta el número de tarjeta"); return; }
    const data = {
      name: form.name.trim().toUpperCase(),
      categoria: form.categoria,
      tarjeta: form.tarjeta.trim(),
      tipoAdquisicion: form.tipoAdquisicion,
      presentacion: form.presentacion,
      precio: num(form.precio),
      stockInicial: num(form.stockInicial),
      minStock: num(form.minStock),
      notas: form.notas || "",
      updatedAt: new Date().toISOString(),
    };
    try {
      if (editing) {
        await updateDoc(doc(db, "inventario", editing), data);
        setEditing(null);
      } else {
        await addDoc(collection(db, "inventario"), { ...data, createdAt: new Date().toISOString() });
      }
      setForm(initial);
    } catch (e) { alert("⚠ Error: " + e.message); }
  };

  const eliminar = async (id, name) => {
    if (!window.confirm(`¿Eliminar el insumo "${name}"?\n\nNo se eliminarán los movimientos históricos.`)) return;
    try { await deleteDoc(doc(db, "inventario", id)); }
    catch (e) { alert("Error: " + e.message); }
  };

  const insumosFilt = insumos.filter(i => {
    if (filterCat !== "all" && i.categoria !== filterCat) return false;
    if (search && !i.name?.toLowerCase().includes(search.toLowerCase()) && !i.tarjeta?.includes(search)) return false;
    return true;
  });

  const card = { background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 18px", marginBottom: 12 };

  return (
    <div>
      {/* Formulario alta/edición */}
      <div style={{ ...card, borderLeft: "4px solid #27ae60" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#27ae60", marginBottom: 12 }}>
          {editing ? "✎ EDITAR INSUMO" : "➕ AGREGAR INSUMO AL ALMACÉN"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 10 }}>
          <div style={{ gridColumn: "1 / 3" }}>
            <label style={LBL}>Nombre del insumo *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: ACIDO FOSFORICO" style={INP} />
          </div>
          <div>
            <label style={LBL}>No. Tarjeta *</label>
            <input value={form.tarjeta} onChange={e => setForm(p => ({ ...p, tarjeta: e.target.value }))} placeholder="Ej: 004" style={INP} />
          </div>
          <div>
            <label style={LBL}>Presentación</label>
            <select value={form.presentacion} onChange={e => setForm(p => ({ ...p, presentacion: e.target.value }))} style={INP}>
              {PRESENTACIONES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={LBL}>Categoría / Almacén *</label>
            <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} style={INP}>
              {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={LBL}>Tipo adquisición</label>
            <select value={form.tipoAdquisicion} onChange={e => setForm(p => ({ ...p, tipoAdquisicion: e.target.value }))} style={INP}>
              {TIPOS_ADQUISICION.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={LBL}>Costo unitario ($)</label>
            <input type="number" step="0.01" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} style={INP} />
          </div>
          <div>
            <label style={LBL}>Stock inicial</label>
            <input type="number" step="0.001" value={form.stockInicial} onChange={e => setForm(p => ({ ...p, stockInicial: e.target.value }))} style={INP} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LBL}>Notas (opcional)</label>
            <input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} style={INP} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} style={{ padding: "9px 22px", background: "#27ae60", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            {editing ? "Guardar cambios" : "+ Agregar"}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm(initial); }} style={{ padding: "9px 16px", border: "1px solid #ddd", borderRadius: 8, background: "transparent", color: "#888", cursor: "pointer", fontSize: 13 }}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar por nombre o tarjeta..." style={{ ...INP, maxWidth: 280 }} />
        <button onClick={() => setFilterCat("all")} style={{ padding: "6px 12px", border: `1px solid ${filterCat === "all" ? "#27ae60" : "#ddd"}`, borderRadius: 16, background: filterCat === "all" ? "#eafaf1" : "#fff", cursor: "pointer", fontSize: 11, color: filterCat === "all" ? "#27ae60" : "#666", fontWeight: filterCat === "all" ? 700 : 500 }}>
          Todas ({insumos.length})
        </button>
        {CATEGORIAS.map(c => {
          const count = insumos.filter(i => i.categoria === c.id).length;
          const active = filterCat === c.id;
          return (
            <button key={c.id} onClick={() => setFilterCat(c.id)} style={{ padding: "6px 12px", border: `1px solid ${active ? c.color : "#ddd"}`, borderRadius: 16, background: active ? c.color + "20" : "#fff", cursor: "pointer", fontSize: 11, color: active ? c.color : "#666", fontWeight: active ? 700 : 500 }}>
              {c.emoji} {c.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {!insumosFilt.length ? (
        <div style={{ ...card, textAlign: "center", color: "#aaa", padding: "40px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
          <div>{insumos.length === 0 ? "Sin insumos. Agrega el primero arriba." : "Sin resultados con esos filtros"}</div>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: 14, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                {["Tarjeta", "Nombre", "Categoría", "Presentación", "Adquisición", "$/u", "Stock inicial", "Mínimo", ""].map(h => (
                  <th key={h} style={{ padding: "10px 8px", textAlign: "left", color: "#aaa", fontWeight: 500, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {insumosFilt.map(i => {
                const cat = CATEGORIAS.find(c => c.id === i.categoria);
                return (
                  <tr key={i.id} style={{ borderBottom: "1px solid #fafafa" }}>
                    <td style={{ padding: "10px 8px", fontFamily: "'Courier New',monospace", fontWeight: 700, color: "#2980b9" }}>{i.tarjeta || "—"}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 600 }}>{i.name}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{ background: (cat?.color || "#888") + "20", color: cat?.color || "#888", borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>
                        {cat?.emoji} {cat?.label || i.categoria}
                      </span>
                    </td>
                    <td style={{ padding: "10px 8px", color: "#666" }}>{i.presentacion}</td>
                    <td style={{ padding: "10px 8px", color: "#666", fontSize: 11 }}>{i.tipoAdquisicion}</td>
                    <td style={{ padding: "10px 8px", fontFamily: "'Courier New',monospace" }}>${fmt(i.precio)}</td>
                    <td style={{ padding: "10px 8px", fontFamily: "'Courier New',monospace", color: "#27ae60", fontWeight: 600 }}>{fmt(i.stockInicial, 3)}</td>
                    <td style={{ padding: "10px 8px", fontFamily: "'Courier New',monospace", color: "#888" }}>{fmt(i.minStock, 1)}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { setEditing(i.id); setForm({ name: i.name, categoria: i.categoria || "agroquimicos", tarjeta: i.tarjeta || "", tipoAdquisicion: i.tipoAdquisicion || "Compra", presentacion: i.presentacion || "Kg", precio: i.precio || 0, stockInicial: i.stockInicial || 0, minStock: i.minStock || 0, notas: i.notas || "" }); window.scrollTo(0, 0); }} style={{ background: "#eaf4fb", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: "#2980b9", fontWeight: 600 }}>✎</button>
                        <button onClick={() => eliminar(i.id, i.name)} style={{ background: "#fdedec", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: "#c0392b" }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SUB-TAB 2: MOVIMIENTOS (entradas y salidas)
// ────────────────────────────────────────────────────────────────────────────
function MovimientosTab({ insumos, movimientos }) {
  const today = new Date().toISOString().slice(0, 10);
  const initial = { insumoId: "", tipo: "entrada", cantidad: 0, fecha: today, motivo: "", responsable: "" };
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(null);
  const [filterMes, setFilterMes] = useState(today.slice(0, 7));
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  const save = async () => {
    if (!form.insumoId) { alert("Selecciona el insumo"); return; }
    if (!form.cantidad || num(form.cantidad) <= 0) { alert("La cantidad debe ser mayor a 0"); return; }
    const data = {
      insumoId: form.insumoId,
      tipo: form.tipo,
      cantidad: num(form.cantidad),
      fecha: form.fecha,
      motivo: form.motivo || "",
      responsable: form.responsable || "",
      updatedAt: new Date().toISOString(),
    };
    try {
      if (editing) {
        await updateDoc(doc(db, "inventario_movimientos", editing), data);
        setEditing(null);
      } else {
        await addDoc(collection(db, "inventario_movimientos"), { ...data, createdAt: new Date().toISOString() });
      }
      setForm({ ...initial, fecha: today });
    } catch (e) { alert("⚠ Error: " + e.message); }
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar este movimiento?\n\nLos saldos se recalcularán.")) return;
    try { await deleteDoc(doc(db, "inventario_movimientos", id)); }
    catch (e) { alert("Error: " + e.message); }
  };

  const getInsumo = (id) => insumos.find(i => i.id === id);

  const movFilt = movimientos.filter(m => {
    if (filterMes && !(m.fecha || "").startsWith(filterMes)) return false;
    if (filterTipo !== "all" && m.tipo !== filterTipo) return false;
    if (filterCat !== "all") {
      const ins = getInsumo(m.insumoId);
      if (!ins || ins.categoria !== filterCat) return false;
    }
    return true;
  });

  const insumoSel = getInsumo(form.insumoId);

  return (
    <div>
      {/* Formulario nuevo movimiento */}
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderLeft: "4px solid #2980b9", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#2980b9", marginBottom: 12 }}>
          {editing ? "✎ EDITAR MOVIMIENTO" : "➕ REGISTRAR MOVIMIENTO"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={LBL}>Insumo *</label>
            <select value={form.insumoId} onChange={e => setForm(p => ({ ...p, insumoId: e.target.value }))} style={INP}>
              <option value="">— Selecciona —</option>
              {insumos.map(i => (
                <option key={i.id} value={i.id}>
                  {i.tarjeta ? `[${i.tarjeta}] ` : ""}{i.name} ({i.presentacion})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={LBL}>Tipo *</label>
            <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} style={INP}>
              <option value="entrada">📥 Entrada</option>
              <option value="salida">📤 Salida</option>
            </select>
          </div>
          <div>
            <label style={LBL}>Cantidad * {insumoSel ? `(${insumoSel.presentacion})` : ""}</label>
            <input type="number" step="0.001" min="0" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} style={INP} />
          </div>
          <div>
            <label style={LBL}>📅 Fecha *</label>
            <input type="date" max={today} value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} style={INP} />
          </div>
          <div style={{ gridColumn: "1 / 3" }}>
            <label style={LBL}>Motivo / Concepto</label>
            <input value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Ej: Aplicación en invernadero 2, Compra factura 123, Donación..." style={INP} />
          </div>
          <div style={{ gridColumn: "3 / 5" }}>
            <label style={LBL}>Responsable</label>
            <input value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} placeholder="Nombre de quien realizó" style={INP} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} style={{ padding: "9px 22px", background: form.tipo === "entrada" ? "#27ae60" : "#e67e22", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            {editing ? "Guardar" : `+ Registrar ${form.tipo}`}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm({ ...initial, fecha: today }); }} style={{ padding: "9px 16px", border: "1px solid #ddd", borderRadius: 8, background: "transparent", color: "#888", cursor: "pointer", fontSize: 13 }}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input type="month" value={filterMes} onChange={e => setFilterMes(e.target.value)} style={{ ...INP, maxWidth: 160 }} />
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={{ ...INP, maxWidth: 160 }}>
          <option value="all">Todos los tipos</option>
          <option value="entrada">📥 Entradas</option>
          <option value="salida">📤 Salidas</option>
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...INP, maxWidth: 200 }}>
          <option value="all">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
          {movFilt.length} movimientos · 📥 {movFilt.filter(m => m.tipo === "entrada").length} · 📤 {movFilt.filter(m => m.tipo === "salida").length}
        </div>
      </div>

      {/* Tabla */}
      {!movFilt.length ? (
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "40px 20px", textAlign: "center", color: "#aaa" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
          <div>Sin movimientos en este filtro</div>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: 14, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                {["Fecha", "Tipo", "Insumo", "Cantidad", "Valor", "Motivo", "Responsable", ""].map(h => (
                  <th key={h} style={{ padding: "10px 8px", textAlign: "left", color: "#aaa", fontWeight: 500, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movFilt.map(m => {
                const ins = getInsumo(m.insumoId);
                const valor = (ins?.precio || 0) * (m.cantidad || 0);
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid #fafafa" }}>
                    <td style={{ padding: "9px 8px", fontFamily: "'Courier New',monospace" }}>{m.fecha}</td>
                    <td style={{ padding: "9px 8px" }}>
                      <span style={{ background: m.tipo === "entrada" ? "#eafaf1" : "#fdeee7", color: m.tipo === "entrada" ? "#27ae60" : "#e67e22", borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                        {m.tipo === "entrada" ? "📥 ENTRADA" : "📤 SALIDA"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 8px" }}>
                      <div style={{ fontWeight: 600 }}>{ins?.name || "(eliminado)"}</div>
                      {ins?.tarjeta && <div style={{ fontSize: 10, color: "#888", fontFamily: "monospace" }}>Tarjeta: {ins.tarjeta}</div>}
                    </td>
                    <td style={{ padding: "9px 8px", fontFamily: "'Courier New',monospace", fontWeight: 700, color: m.tipo === "entrada" ? "#27ae60" : "#e67e22" }}>
                      {m.tipo === "entrada" ? "+" : "−"}{fmt(m.cantidad, 3)} {ins?.presentacion || ""}
                    </td>
                    <td style={{ padding: "9px 8px", fontFamily: "'Courier New',monospace" }}>${fmt(valor)}</td>
                    <td style={{ padding: "9px 8px", color: "#666", fontSize: 11 }}>{m.motivo || "—"}</td>
                    <td style={{ padding: "9px 8px", color: "#666", fontSize: 11 }}>{m.responsable || "—"}</td>
                    <td style={{ padding: "9px 8px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { setEditing(m.id); setForm({ insumoId: m.insumoId, tipo: m.tipo, cantidad: m.cantidad, fecha: m.fecha, motivo: m.motivo || "", responsable: m.responsable || "" }); window.scrollTo(0, 0); }} style={{ background: "#eaf4fb", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: "#2980b9", fontWeight: 600 }}>✎</button>
                        <button onClick={() => eliminar(m.id)} style={{ background: "#fdedec", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: "#c0392b" }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SUB-TAB 3: REPORTE MENSUAL FIRA con descarga XLSX
// ────────────────────────────────────────────────────────────────────────────
function ReporteTab({ insumos, movimientos }) {
  const hoyMes = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(hoyMes);
  const [centro, setCentro] = useState(() => {
    try { return localStorage.getItem("almacen_centro") || ""; } catch { return ""; }
  });
  const [unidad, setUnidad] = useState(() => {
    try { return localStorage.getItem("almacen_unidad") || "Capa., Hidro., forrajes verdes, esquejes y micropropagación, prod. plántula"; } catch { return ""; }
  });
  const [firmas, setFirmas] = useState(() => {
    try { return JSON.parse(localStorage.getItem("almacen_firmas") || "{}"); } catch { return {}; }
  });
  const [descargando, setDescargando] = useState(false);

  useEffect(() => { try { localStorage.setItem("almacen_centro", centro); } catch {} }, [centro]);
  useEffect(() => { try { localStorage.setItem("almacen_unidad", unidad); } catch {} }, [unidad]);
  useEffect(() => { try { localStorage.setItem("almacen_firmas", JSON.stringify(firmas)); } catch {} }, [firmas]);

  // Cálculo del reporte por categoría
  const reporteData = useMemo(() => {
    const [yyyy, mm] = mes.split("-").map(Number);
    // Primer día y último día del mes
    const firstDay = `${mes}-01`;
    const lastDay = new Date(yyyy, mm, 0).toISOString().slice(0, 10);

    const data = {};
    CATEGORIAS.forEach(cat => { data[cat.id] = { categoria: cat, items: [], totales: { saldoInicial: 0, debe: 0, haber: 0, saldoFinal: 0 } }; });

    insumos.forEach(ins => {
      // Movimientos del insumo
      const movsAntes = movimientos.filter(m => m.insumoId === ins.id && m.fecha < firstDay);
      const movsDelMes = movimientos.filter(m => m.insumoId === ins.id && m.fecha >= firstDay && m.fecha <= lastDay);

      // Saldo al inicio del mes = stockInicial + (entradas antes - salidas antes)
      const entradasAntes = movsAntes.filter(m => m.tipo === "entrada").reduce((s, m) => s + num(m.cantidad), 0);
      const salidasAntes = movsAntes.filter(m => m.tipo === "salida").reduce((s, m) => s + num(m.cantidad), 0);
      const saldoInicial = num(ins.stockInicial) + entradasAntes - salidasAntes;

      // Movimientos del mes
      const entradas = movsDelMes.filter(m => m.tipo === "entrada").reduce((s, m) => s + num(m.cantidad), 0);
      const salidas = movsDelMes.filter(m => m.tipo === "salida").reduce((s, m) => s + num(m.cantidad), 0);

      // Saldo final
      const existencia = saldoInicial + entradas - salidas;
      const debe = entradas * num(ins.precio);
      const haber = salidas * num(ins.precio);
      const saldoInicialImporte = saldoInicial * num(ins.precio);
      const saldoFinalImporte = existencia * num(ins.precio);

      const fila = {
        unidad: unidad || "—",
        tipoAdquisicion: ins.tipoAdquisicion || "Compra",
        tarjeta: ins.tarjeta || "",
        nombre: ins.name,
        presentacion: ins.presentacion,
        costoUnitario: num(ins.precio),
        saldoInicialUnidades: saldoInicial,
        saldoInicialImporte,
        entrada: entradas,
        salida: salidas,
        existencia,
        debe,
        haber,
        saldoFinal: saldoFinalImporte,
      };

      const cat = ins.categoria || "agroquimicos";
      if (data[cat]) {
        data[cat].items.push(fila);
        data[cat].totales.saldoInicial += saldoInicialImporte;
        data[cat].totales.debe += debe;
        data[cat].totales.haber += haber;
        data[cat].totales.saldoFinal += saldoFinalImporte;
      }
    });

    // Ordenar items por tarjeta
    Object.values(data).forEach(d => d.items.sort((a, b) => (a.tarjeta || "").localeCompare(b.tarjeta || "")));
    return { data, firstDay, lastDay };
  }, [mes, insumos, movimientos, unidad]);

  const totalGeneral = useMemo(() => {
    let saldoIni = 0, debe = 0, haber = 0, final = 0;
    Object.values(reporteData.data).forEach(d => {
      saldoIni += d.totales.saldoInicial;
      debe += d.totales.debe;
      haber += d.totales.haber;
      final += d.totales.saldoFinal;
    });
    return { saldoIni, debe, haber, final };
  }, [reporteData]);

  // Generar XLSX al estilo FIRA
  const descargar = async () => {
    setDescargando(true);
    try {
      const XLSX = await loadSheetJS();
      const wb = XLSX.utils.book_new();
      const ws_data = [];

      // Header oficial
      ws_data.push([null, "FIRA - Banco de México"]);
      ws_data.push([null, "Subdirección de Desarrollo de Capacidades y Mercados"]);
      ws_data.push([]);
      ws_data.push([null, '"Movimientos de Inventarios de Almacén"']);
      ws_data.push([]);
      ws_data.push([null, `Centro de Desarrollo: ${centro || "—"}`]);
      ws_data.push([]);
      ws_data.push([null, `Mes: ${mes} | Periodo: del ${reporteData.firstDay} al ${reporteData.lastDay}`]);
      ws_data.push([]);
      ws_data.push([]);
      ws_data.push([]);

      // Helper: añadir sección
      const addSection = (catData) => {
        if (!catData.items.length) return;
        // Header de columnas
        ws_data.push([
          "Unidad de producción", "Tipo de adquisición", "No.de Tarjeta", "Insumo o material",
          "Presentación", "Costo Unitario",
          `Saldos Iniciales al ${reporteData.firstDay}`, null,
          "Unidades (#)", null, null,
          "Valor ($)", null,
          `Saldo Final al ${reporteData.lastDay}`,
        ]);
        ws_data.push([null, null, null, null, null, null, "Unidades", "Importe", "Entrada", "Salida", "Existencia", "Debe", "Haber", null]);
        // Filas
        catData.items.forEach(f => {
          ws_data.push([
            f.unidad, f.tipoAdquisicion, f.tarjeta, f.nombre,
            f.presentacion, f.costoUnitario,
            f.saldoInicialUnidades, f.saldoInicialImporte,
            f.entrada || null, f.salida || null, f.existencia,
            f.debe || 0, f.haber || 0,
            f.saldoFinal,
          ]);
        });
        // Total de categoría
        ws_data.push([
          `Total almacén ${catData.categoria.label}`, null, null, null, null, null,
          null, catData.totales.saldoInicial,
          null, null, null,
          catData.totales.debe, catData.totales.haber,
          catData.totales.saldoFinal,
        ]);
        ws_data.push([]); // espacio
      };

      // Una sección por cada categoría
      CATEGORIAS.forEach(c => addSection(reporteData.data[c.id]));

      // Total general
      ws_data.push([]);
      ws_data.push([
        "TOTAL GENERAL ALMACÉN", null, null, null, null, null,
        null, totalGeneral.saldoIni,
        null, null, null,
        totalGeneral.debe, totalGeneral.haber,
        totalGeneral.final,
      ]);
      ws_data.push([]);
      ws_data.push([]);
      ws_data.push([null, "ELABORÓ", null, null, null, "RESPONSABLE", null, null, null, null, "Vo.Bo."]);
      ws_data.push([]);
      ws_data.push([]);
      ws_data.push([null, firmas.elaboro || "—", null, null, null, firmas.responsable || "—", null, null, null, null, firmas.vobo || "—"]);

      const ws = XLSX.utils.aoa_to_sheet(ws_data);

      // Ancho de columnas
      ws['!cols'] = [
        { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 14 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
      const fileName = `RG_MOVIMIENTOS_DE_ALMACEN_${mes}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      alert("Error generando reporte: " + e.message);
    }
    setDescargando(false);
  };

  // Etiqueta del mes
  const nombreMes = (() => {
    try {
      const [y, m] = mes.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" }).toUpperCase();
    } catch { return mes; }
  })();

  return (
    <div>
      {/* Configuración del reporte */}
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderLeft: "4px solid #8e44ad", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#8e44ad", marginBottom: 12 }}>📄 REPORTE MENSUAL DE MOVIMIENTOS - FORMATO FIRA</div>

        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={LBL}>📅 Mes a reportar</label>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={INP} />
          </div>
          <div>
            <label style={LBL}>Centro de Desarrollo</label>
            <input value={centro} onChange={e => setCentro(e.target.value)} placeholder="Ej: CDT Morelia" style={INP} />
          </div>
          <div>
            <label style={LBL}>Unidad de producción</label>
            <input value={unidad} onChange={e => setUnidad(e.target.value)} placeholder="Ej: Capa., Hidro., ..." style={INP} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={LBL}>ELABORÓ</label>
            <input value={firmas.elaboro || ""} onChange={e => setFirmas(p => ({ ...p, elaboro: e.target.value }))} placeholder="Nombre y cargo" style={INP} />
          </div>
          <div>
            <label style={LBL}>RESPONSABLE</label>
            <input value={firmas.responsable || ""} onChange={e => setFirmas(p => ({ ...p, responsable: e.target.value }))} placeholder="Nombre y cargo" style={INP} />
          </div>
          <div>
            <label style={LBL}>Vo.Bo.</label>
            <input value={firmas.vobo || ""} onChange={e => setFirmas(p => ({ ...p, vobo: e.target.value }))} placeholder="Nombre y cargo" style={INP} />
          </div>
        </div>

        <button onClick={descargar} disabled={descargando} style={{ padding: "10px 24px", background: descargando ? "#aaa" : "#8e44ad", color: "#fff", border: "none", borderRadius: 8, cursor: descargando ? "wait" : "pointer", fontWeight: 700, fontSize: 13 }}>
          {descargando ? "⏳ Generando..." : "📥 Descargar reporte XLSX"}
        </button>
      </div>

      {/* Vista previa */}
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "18px 22px" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#2c3e50" }}>FIRA - Banco de México</div>
          <div style={{ fontSize: 11, color: "#888" }}>Subdirección de Desarrollo de Capacidades y Mercados</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#27ae60", margin: "10px 0" }}>"Movimientos de Inventarios de Almacén"</div>
          <div style={{ fontSize: 12, color: "#555" }}>
            {centro ? `Centro: ${centro}` : "Centro: —"} | Mes: <strong>{nombreMes}</strong>
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            Periodo: del {reporteData.firstDay} al {reporteData.lastDay}
          </div>
        </div>

        {/* Una tabla por categoría */}
        {CATEGORIAS.map(cat => {
          const d = reporteData.data[cat.id];
          if (!d.items.length) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: cat.color, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${cat.color}30` }}>
                {cat.emoji} {cat.label.toUpperCase()} ({d.items.length} insumos)
              </div>
              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, minWidth: 900 }}>
                  <thead style={{ background: "#f8f9fa", fontWeight: 700 }}>
                    <tr>
                      <th rowSpan={2} style={th}>Tarjeta</th>
                      <th rowSpan={2} style={th}>Insumo</th>
                      <th rowSpan={2} style={th}>Pres.</th>
                      <th rowSpan={2} style={th}>$/U</th>
                      <th colSpan={2} style={thC}>Saldo inicial</th>
                      <th colSpan={3} style={thC}>Unidades (#)</th>
                      <th colSpan={2} style={thC}>Valor ($)</th>
                      <th rowSpan={2} style={th}>Saldo final</th>
                    </tr>
                    <tr>
                      <th style={th}>Unidades</th>
                      <th style={th}>Importe</th>
                      <th style={th}>Entrada</th>
                      <th style={th}>Salida</th>
                      <th style={th}>Existencia</th>
                      <th style={th}>Debe</th>
                      <th style={th}>Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((f, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                        <td style={{ ...td, fontFamily: "'Courier New',monospace", color: "#2980b9", fontWeight: 700 }}>{f.tarjeta || "—"}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{f.nombre}</td>
                        <td style={td}>{f.presentacion}</td>
                        <td style={tdN}>${fmt(f.costoUnitario)}</td>
                        <td style={tdN}>{fmt(f.saldoInicialUnidades, 3)}</td>
                        <td style={tdN}>${fmt(f.saldoInicialImporte)}</td>
                        <td style={{ ...tdN, color: f.entrada ? "#27ae60" : "#ccc", fontWeight: f.entrada ? 700 : 400 }}>{f.entrada ? fmt(f.entrada, 3) : "—"}</td>
                        <td style={{ ...tdN, color: f.salida ? "#e67e22" : "#ccc", fontWeight: f.salida ? 700 : 400 }}>{f.salida ? fmt(f.salida, 3) : "—"}</td>
                        <td style={{ ...tdN, fontWeight: 700 }}>{fmt(f.existencia, 3)}</td>
                        <td style={{ ...tdN, color: f.debe ? "#27ae60" : "#ccc" }}>{f.debe ? `$${fmt(f.debe)}` : "—"}</td>
                        <td style={{ ...tdN, color: f.haber ? "#e67e22" : "#ccc" }}>{f.haber ? `$${fmt(f.haber)}` : "—"}</td>
                        <td style={{ ...tdN, fontWeight: 700, color: "#2c3e50" }}>${fmt(f.saldoFinal)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: `2px solid ${cat.color}`, background: cat.color + "10", fontWeight: 700 }}>
                      <td colSpan={5} style={{ ...td, color: cat.color }}>Total almacén {cat.label}</td>
                      <td style={tdN}>${fmt(d.totales.saldoInicial)}</td>
                      <td colSpan={3}></td>
                      <td style={tdN}>${fmt(d.totales.debe)}</td>
                      <td style={tdN}>${fmt(d.totales.haber)}</td>
                      <td style={{ ...tdN, color: cat.color }}>${fmt(d.totales.saldoFinal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Total general */}
        <div style={{ background: "linear-gradient(135deg,#27ae60,#2ecc71)", color: "#fff", borderRadius: 10, padding: "16px 20px", marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>Saldo inicial total</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Courier New',monospace" }}>${fmt(totalGeneral.saldoIni)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>Total debe (entradas)</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Courier New',monospace" }}>${fmt(totalGeneral.debe)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>Total haber (salidas)</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Courier New',monospace" }}>${fmt(totalGeneral.haber)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>Saldo final total</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Courier New',monospace" }}>${fmt(totalGeneral.final)}</div>
          </div>
        </div>

        {/* Firmas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 30, paddingTop: 20, borderTop: "1px solid #eee" }}>
          {["elaboro", "responsable", "vobo"].map((k, i) => (
            <div key={k} style={{ textAlign: "center" }}>
              <div style={{ borderBottom: "1px solid #ccc", paddingBottom: 4, marginBottom: 6, minHeight: 28 }}>
                <strong>{firmas[k] || "—"}</strong>
              </div>
              <div style={{ fontSize: 10, color: "#888", letterSpacing: 0.5 }}>{["ELABORÓ", "RESPONSABLE", "Vo.Bo."][i]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const th  = { padding: "6px 8px", textAlign: "center", border: "1px solid #e8e8e8", fontSize: 10 };
const thC = { padding: "6px 8px", textAlign: "center", border: "1px solid #e8e8e8", fontSize: 10, background: "#fafafa" };
const td  = { padding: "5px 8px", border: "1px solid #f0f0f0", fontSize: 10.5 };
const tdN = { padding: "5px 8px", border: "1px solid #f0f0f0", fontSize: 10.5, textAlign: "right", fontFamily: "'Courier New',monospace" };
