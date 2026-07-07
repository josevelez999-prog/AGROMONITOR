// ─── APLICACIONES ADMIN - Registro de aplicación de agroquímicos (FIRA F-13) ──
// Sub-pestañas: 📋 Registradas | 📅 Programar | 📄 Reporte FIRA

import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc,
  query, orderBy
} from "./dbCdt";

const CROPS_LIST = [
  { id: "jitomate", name: "Jitomate", emoji: "🍅", tipoUbicacion: "Invernadero", ubicaciones: ["INV 2", "INV 3", "INV 5", "INV 6"] },
  { id: "fresa",    name: "Fresa",    emoji: "🍓", tipoUbicacion: "Nave", ubicaciones: ["Nave 1", "Nave 2", "Nave 3"] },
  { id: "arandano", name: "Arándano", emoji: "🫐", tipoUbicacion: "Nave", ubicaciones: ["Nave 1", "Nave 2", "Nave 3"] },
  { id: "zarzamora",name: "Zarzamora",emoji: "🫐", tipoUbicacion: "Nave", ubicaciones: ["Nave 1", "Nave 2", "Nave 3"] },
];

const EQUIPOS = ["Mochila", "Parihuela", "Motor", "Manual"];

const fmt = (n, d = 2) => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (v) => parseFloat(v) || 0;
const INP = { padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 12, width: "100%", boxSizing: "border-box", background: "#fff", color: "#111" };
const LBL = { fontSize: 10, color: "#888", display: "block", marginBottom: 3, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" };

const loadSheetJS = () => new Promise((resolve, reject) => {
  if (window.XLSX) return resolve(window.XLSX);
  const script = document.createElement("script");
  script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
  script.onload = () => resolve(window.XLSX);
  script.onerror = reject;
  document.head.appendChild(script);
});

export default function AplicacionesAdmin() {
  const [subtab, setSubtab] = useState("registradas");
  const [aplicaciones, setAplicaciones] = useState([]);
  const [programadas, setProgramadas] = useState([]);
  const [insumos, setInsumos] = useState([]);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "aplicaciones"), orderBy("fecha", "desc")),
      snap => setAplicaciones(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("aplicaciones:", err));
    const u2 = onSnapshot(query(collection(db, "aplicaciones_programadas"), orderBy("fechaProgramada", "asc")),
      snap => setProgramadas(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("programadas:", err));
    const u3 = onSnapshot(collection(db, "inventario"),
      snap => setInsumos(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("inventario:", err));
    return () => { u1(); u2(); u3(); };
  }, []);

  const SUBTABS = [
    { id: "registradas", label: "📋 Registradas", color: "#27ae60" },
    { id: "programar",   label: "📅 Programar",   color: "#e67e22" },
    { id: "reporte",     label: "📄 Reporte", color: "#8e44ad" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: 4 }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSubtab(t.id)}
            style={{ flex: 1, padding: "10px 4px", border: "none", borderRadius: 10, background: subtab === t.id ? t.color : "transparent", color: subtab === t.id ? "#fff" : "#555", cursor: "pointer", fontSize: 12, fontWeight: subtab === t.id ? 700 : 500 }}>
            {t.label}
          </button>
        ))}
      </div>

      {subtab === "registradas" && <RegistradasTab aplicaciones={aplicaciones} insumos={insumos} />}
      {subtab === "programar"   && <ProgramarTab programadas={programadas} insumos={insumos} />}
      {subtab === "reporte"     && <ReporteTab aplicaciones={aplicaciones} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SUB-TAB 1: APLICACIONES REGISTRADAS
// ────────────────────────────────────────────────────────────────────────────
function RegistradasTab({ aplicaciones, insumos }) {
  const [filterCrop, setFilterCrop] = useState("all");
  const [filterMes, setFilterMes] = useState(new Date().toISOString().slice(0, 7));
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar esta aplicación?\n\nNo se devolverá el stock descontado automáticamente.")) return;
    try { await deleteDoc(doc(db, "aplicaciones", id)); }
    catch (e) { alert("Error: " + e.message); }
  };

  const saveEdit = async () => {
    try {
      await updateDoc(doc(db, "aplicaciones", editing), {
        ...editForm,
        dosisHa: num(editForm.dosisHa),
        dosisAplicada: num(editForm.dosisAplicada),
        updatedAt: new Date().toISOString(),
      });
      setEditing(null);
    } catch (e) { alert("Error: " + e.message); }
  };

  const filt = aplicaciones.filter(a => {
    if (filterCrop !== "all" && a.crop !== filterCrop) return false;
    if (filterMes && !(a.fecha || "").startsWith(filterMes)) return false;
    return true;
  });

  const card = { background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 18px" };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input type="month" value={filterMes} onChange={e => setFilterMes(e.target.value)} style={{ ...INP, maxWidth: 160 }} />
        <button onClick={() => setFilterCrop("all")} style={{ padding: "6px 12px", border: `1px solid ${filterCrop === "all" ? "#27ae60" : "#ddd"}`, borderRadius: 16, background: filterCrop === "all" ? "#eafaf1" : "#fff", cursor: "pointer", fontSize: 11, color: filterCrop === "all" ? "#27ae60" : "#666", fontWeight: filterCrop === "all" ? 700 : 500 }}>
          Todos ({aplicaciones.length})
        </button>
        {CROPS_LIST.map(c => (
          <button key={c.id} onClick={() => setFilterCrop(c.id)} style={{ padding: "6px 12px", border: `1px solid ${filterCrop === c.id ? "#27ae60" : "#ddd"}`, borderRadius: 16, background: filterCrop === c.id ? "#eafaf1" : "#fff", cursor: "pointer", fontSize: 11, color: filterCrop === c.id ? "#27ae60" : "#666", fontWeight: filterCrop === c.id ? 700 : 500 }}>
            {c.emoji} {c.name}
          </button>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>{filt.length} aplicaciones</div>
      </div>

      {!filt.length ? (
        <div style={{ ...card, textAlign: "center", color: "#aaa", padding: "40px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🧪</div>
          <div>Sin aplicaciones registradas en este filtro</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Los trabajadores las registran desde su app</div>
        </div>
      ) : (
        <div style={{ ...card, overflow: "auto", padding: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 1100 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                {["Fecha", "Cultivo", "Producto", "Ing. activo", "Dosis/Ha", "Aplicada", "Plaga/Enf.", "I.S.", "Reentr.", "Equipo", "Hora", "Sección", "Aplicador", ""].map(h => (
                  <th key={h} style={{ padding: "8px 6px", textAlign: "left", color: "#aaa", fontWeight: 500, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filt.map(a => {
                const crop = CROPS_LIST.find(c => c.id === a.crop);
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid #fafafa" }}>
                    <td style={{ padding: "8px 6px", fontFamily: "'Courier New',monospace", whiteSpace: "nowrap" }}>{a.fecha}</td>
                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{crop?.emoji} {crop?.name || a.crop}</td>
                    <td style={{ padding: "8px 6px", fontWeight: 600 }}>{a.nombreComercial}</td>
                    <td style={{ padding: "8px 6px", color: "#666" }}>{a.ingredienteActivo}</td>
                    <td style={{ padding: "8px 6px", fontFamily: "monospace" }}>{a.dosisHa} {a.unidadDosis}</td>
                    <td style={{ padding: "8px 6px", fontFamily: "monospace", fontWeight: 700, color: "#27ae60" }}>{a.dosisAplicada} {a.unidadDosis}</td>
                    <td style={{ padding: "8px 6px", color: "#666" }}>{a.plaga || "—"}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>{a.intervaloSeguridad || "—"}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>{a.tiempoReentrada || "—"}</td>
                    <td style={{ padding: "8px 6px" }}>{a.equipo || "—"}</td>
                    <td style={{ padding: "8px 6px", fontFamily: "monospace", fontSize: 10 }}>{a.horaInicio}{a.horaTermino ? `-${a.horaTermino}` : ""}</td>
                    <td style={{ padding: "8px 6px" }}>{a.seccion || "—"}</td>
                    <td style={{ padding: "8px 6px", color: "#666" }}>{a.aplicador || a.worker || "—"}</td>
                    <td style={{ padding: "8px 6px" }}>
                      <button onClick={() => eliminar(a.id)} style={{ background: "#fdedec", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: "#c0392b" }}>🗑</button>
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
// SUB-TAB 2: PROGRAMAR APLICACIONES
// ────────────────────────────────────────────────────────────────────────────
function ProgramarTab({ programadas, insumos }) {
  const today = new Date().toISOString().slice(0, 10);
  const initial = { crop: "jitomate", fechaProgramada: today, nombreComercial: "", ingredienteActivo: "", dosisHa: "", unidadDosis: "L", plaga: "", seccion: "", notas: "", insumoId: "" };
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(null);

  const agroquimicos = insumos.filter(i => i.categoria === "agroquimicos");

  const save = async () => {
    if (!form.nombreComercial) { alert("Falta el nombre del producto"); return; }
    const data = {
      crop: form.crop,
      fechaProgramada: form.fechaProgramada,
      nombreComercial: form.nombreComercial,
      ingredienteActivo: form.ingredienteActivo || "",
      dosisHa: num(form.dosisHa),
      unidadDosis: form.unidadDosis,
      plaga: form.plaga || "",
      seccion: form.seccion || "",
      notas: form.notas || "",
      insumoId: form.insumoId || "",
      estado: "pendiente",
      updatedAt: new Date().toISOString(),
    };
    try {
      if (editing) {
        await updateDoc(doc(db, "aplicaciones_programadas", editing), data);
        setEditing(null);
      } else {
        await addDoc(collection(db, "aplicaciones_programadas"), { ...data, createdAt: new Date().toISOString() });
      }
      setForm(initial);
    } catch (e) { alert("⚠ Error: " + e.message); }
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar esta programación?")) return;
    try { await deleteDoc(doc(db, "aplicaciones_programadas", id)); }
    catch (e) { alert("Error: " + e.message); }
  };

  const marcarHecha = async (id) => {
    try { await updateDoc(doc(db, "aplicaciones_programadas", id), { estado: "completada", completadaAt: new Date().toISOString() }); }
    catch (e) { alert("Error: " + e.message); }
  };

  // Auto-rellenar ingrediente activo al elegir un insumo del almacén
  const onSelectInsumo = (insumoId) => {
    const ins = agroquimicos.find(i => i.id === insumoId);
    if (ins) {
      setForm(p => ({ ...p, insumoId, nombreComercial: ins.name, unidadDosis: ins.presentacion || "L" }));
    } else {
      setForm(p => ({ ...p, insumoId }));
    }
  };

  const card = { background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 18px" };
  const pendientes = programadas.filter(p => p.estado !== "completada");
  const completadas = programadas.filter(p => p.estado === "completada");

  return (
    <div>
      <div style={{ ...card, borderLeft: "4px solid #e67e22", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e67e22", marginBottom: 12 }}>
          {editing ? "✎ EDITAR PROGRAMACIÓN" : "📅 PROGRAMAR NUEVA APLICACIÓN"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={LBL}>Cultivo *</label>
            <select value={form.crop} onChange={e => setForm(p => ({ ...p, crop: e.target.value }))} style={INP}>
              {CROPS_LIST.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LBL}>📅 Fecha programada *</label>
            <input type="date" value={form.fechaProgramada} onChange={e => setForm(p => ({ ...p, fechaProgramada: e.target.value }))} style={INP} />
          </div>
          <div style={{ gridColumn: "3 / 5" }}>
            <label style={LBL}>Producto del almacén (opcional)</label>
            <select value={form.insumoId} onChange={e => onSelectInsumo(e.target.value)} style={INP}>
              <option value="">— Escribir manual abajo —</option>
              {agroquimicos.map(i => <option key={i.id} value={i.id}>{i.tarjeta ? `[${i.tarjeta}] ` : ""}{i.name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / 3" }}>
            <label style={LBL}>Nombre comercial *</label>
            <input value={form.nombreComercial} onChange={e => setForm(p => ({ ...p, nombreComercial: e.target.value }))} placeholder="Ej: ACADIAN" style={INP} />
          </div>
          <div style={{ gridColumn: "3 / 5" }}>
            <label style={LBL}>Ingrediente activo</label>
            <input value={form.ingredienteActivo} onChange={e => setForm(p => ({ ...p, ingredienteActivo: e.target.value }))} placeholder="Ej: Extracto de algas" style={INP} />
          </div>
          <div>
            <label style={LBL}>Dosis / Ha</label>
            <input type="number" step="0.001" value={form.dosisHa} onChange={e => setForm(p => ({ ...p, dosisHa: e.target.value }))} style={INP} />
          </div>
          <div>
            <label style={LBL}>Unidad</label>
            <select value={form.unidadDosis} onChange={e => setForm(p => ({ ...p, unidadDosis: e.target.value }))} style={INP}>
              {["L", "ml", "Kg", "g", "PZA"].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={LBL}>Plaga / Enfermedad</label>
            <input value={form.plaga} onChange={e => setForm(p => ({ ...p, plaga: e.target.value }))} placeholder="Ej: Mosca blanca" style={INP} />
          </div>
          <div>
            <label style={LBL}>{CROPS_LIST.find(x => x.id === form.crop)?.tipoUbicacion || "Sección"}</label>
            <select value={form.seccion} onChange={e => setForm(p => ({ ...p, seccion: e.target.value }))} style={INP}>
              <option value="">— Selecciona —</option>
              {(CROPS_LIST.find(x => x.id === form.crop)?.ubicaciones || []).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LBL}>Notas / Instrucciones para el trabajador</label>
            <input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} style={INP} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} style={{ padding: "9px 22px", background: "#e67e22", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            {editing ? "Guardar cambios" : "📅 Programar"}
          </button>
          {editing && <button onClick={() => { setEditing(null); setForm(initial); }} style={{ padding: "9px 16px", border: "1px solid #ddd", borderRadius: 8, background: "transparent", color: "#888", cursor: "pointer", fontSize: 13 }}>Cancelar</button>}
        </div>
      </div>

      {/* Pendientes */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "#e67e22", marginBottom: 8 }}>⏳ Pendientes ({pendientes.length})</div>
      {!pendientes.length ? (
        <div style={{ ...card, textAlign: "center", color: "#aaa", padding: "24px", marginBottom: 16 }}>Sin aplicaciones programadas pendientes</div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {pendientes.map(p => {
            const crop = CROPS_LIST.find(c => c.id === p.crop);
            const vencida = p.fechaProgramada < today;
            return (
              <div key={p.id} style={{ ...card, borderLeft: `4px solid ${vencida ? "#e74c3c" : "#e67e22"}`, marginBottom: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 24 }}>{crop?.emoji}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nombreComercial} <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>· {crop?.name}</span></div>
                  <div style={{ fontSize: 11, color: "#666" }}>
                    📅 {p.fechaProgramada} {vencida && <span style={{ color: "#e74c3c", fontWeight: 700 }}>⚠ VENCIDA</span>}
                    {p.dosisHa ? ` · ${p.dosisHa} ${p.unidadDosis}/Ha` : ""}
                    {p.plaga ? ` · ${p.plaga}` : ""}
                    {p.seccion ? ` · ${p.seccion}` : ""}
                  </div>
                  {p.notas && <div style={{ fontSize: 11, color: "#999", marginTop: 2, fontStyle: "italic" }}>{p.notas}</div>}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => marcarHecha(p.id)} style={{ background: "#27ae60", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 11, color: "#fff", fontWeight: 700 }}>✓ Hecha</button>
                  <button onClick={() => { setEditing(p.id); setForm({ crop: p.crop, fechaProgramada: p.fechaProgramada, nombreComercial: p.nombreComercial, ingredienteActivo: p.ingredienteActivo || "", dosisHa: p.dosisHa || "", unidadDosis: p.unidadDosis || "L", plaga: p.plaga || "", seccion: p.seccion || "", notas: p.notas || "", insumoId: p.insumoId || "" }); window.scrollTo(0, 0); }} style={{ background: "#eaf4fb", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11, color: "#2980b9", fontWeight: 600 }}>✎</button>
                  <button onClick={() => eliminar(p.id)} style={{ background: "#fdedec", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11, color: "#c0392b" }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completadas */}
      {completadas.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#27ae60", marginBottom: 8 }}>✅ Completadas ({completadas.length})</div>
          {completadas.slice(0, 10).map(p => {
            const crop = CROPS_LIST.find(c => c.id === p.crop);
            return (
              <div key={p.id} style={{ ...card, borderLeft: "4px solid #27ae60", marginBottom: 6, display: "flex", alignItems: "center", gap: 12, opacity: 0.7 }}>
                <div style={{ fontSize: 20 }}>{crop?.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nombreComercial} <span style={{ fontSize: 10, color: "#888" }}>· {p.fechaProgramada}</span></div>
                </div>
                <span style={{ fontSize: 11, color: "#27ae60", fontWeight: 700 }}>✓ Hecha</span>
                <button onClick={() => eliminar(p.id)} style={{ background: "#fdedec", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#c0392b" }}>🗑</button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SUB-TAB 3: REPORTE FIRA (F-13-AASLL)
// ────────────────────────────────────────────────────────────────────────────
function ReporteTab({ aplicaciones }) {
  const hoyMes = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(hoyMes);
  const [filterCrop, setFilterCrop] = useState("jitomate");
  const [meta, setMeta] = useState(() => {
    try { return JSON.parse(localStorage.getItem("aplicaciones_meta") || "{}"); } catch { return {}; }
  });
  const [descargando, setDescargando] = useState(false);

  useEffect(() => { try { localStorage.setItem("aplicaciones_meta", JSON.stringify(meta)); } catch {} }, [meta]);

  const filt = useMemo(() => aplicaciones.filter(a => {
    if (filterCrop !== "all" && a.crop !== filterCrop) return false;
    if (mes && !(a.fecha || "").startsWith(mes)) return false;
    return true;
  }).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")), [aplicaciones, filterCrop, mes]);

  const descargar = async () => {
    setDescargando(true);
    try {
      const XLSX = await loadSheetJS();
      const wb = XLSX.utils.book_new();
      const rows = [];

      rows.push(["Registro de aplicación de agroquímicos"]);
      rows.push([]);
      rows.push([`Unidad de producción / Nave: ${meta.unidad || "—"}`, "", "", `Mes: ${mes}`]);
      rows.push([`Superficie (Has): ${meta.superficie || "—"}`, "", "", `Fecha de plantación: ${meta.fechaPlantacion || "—"}`]);
      rows.push([`Cultivo: ${CROPS_LIST.find(c => c.id === filterCrop)?.name || filterCrop}`, "", "", `Fecha estimada de cosecha: ${meta.fechaCosechaEst || "—"}`]);
      rows.push([`Variedad: ${meta.variedad || "—"}`, "", "", `Fecha real inicio de cosecha: ${meta.fechaCosechaReal || "—"}`]);
      rows.push([]);
      rows.push([
        "Fecha", "Nombre comercial", "Ingrediente activo", "Dosis / Ha", "Dosis aplicada",
        "Plaga y/o Enfermedad", "Intervalo de Seguridad (días)", "Tiempo de Reentrada (horas)",
        "Equipo de aplicación", "Hora inicio", "Hora término", "Sección", "Nombre Aplicador(es)"
      ]);

      filt.forEach(a => {
        rows.push([
          a.fecha, a.nombreComercial, a.ingredienteActivo || "",
          `${a.dosisHa || ""} ${a.unidadDosis || ""}`.trim(),
          `${a.dosisAplicada || ""} ${a.unidadDosis || ""}`.trim(),
          a.plaga || "", a.intervaloSeguridad || "", a.tiempoReentrada || "",
          a.equipo || "", a.horaInicio || "", a.horaTermino || "",
          a.seccion || "", a.aplicador || a.worker || "",
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 11 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 12 },
        { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Aplicaciones");
      XLSX.writeFile(wb, `Registro_Aplicaciones_${filterCrop}_${mes}.xlsx`);
    } catch (e) {
      alert("Error generando reporte: " + e.message);
    }
    setDescargando(false);
  };

  const card = { background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 18px" };

  return (
    <div>
      <div style={{ ...card, borderLeft: "4px solid #8e44ad", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#8e44ad", marginBottom: 12 }}>📄 REPORTE DE APLICACIONES DE AGROQUÍMICOS</div>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={LBL}>📅 Mes</label>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={INP} />
          </div>
          <div>
            <label style={LBL}>Cultivo</label>
            <select value={filterCrop} onChange={e => setFilterCrop(e.target.value)} style={INP}>
              <option value="all">Todos</option>
              {CROPS_LIST.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LBL}>Unidad / Nave</label>
            <input value={meta.unidad || ""} onChange={e => setMeta(p => ({ ...p, unidad: e.target.value }))} style={INP} />
          </div>
          <div>
            <label style={LBL}>Superficie (Has)</label>
            <input value={meta.superficie || ""} onChange={e => setMeta(p => ({ ...p, superficie: e.target.value }))} style={INP} />
          </div>
          <div>
            <label style={LBL}>Variedad</label>
            <input value={meta.variedad || ""} onChange={e => setMeta(p => ({ ...p, variedad: e.target.value }))} style={INP} />
          </div>
          <div>
            <label style={LBL}>Fecha plantación</label>
            <input type="date" value={meta.fechaPlantacion || ""} onChange={e => setMeta(p => ({ ...p, fechaPlantacion: e.target.value }))} style={INP} />
          </div>
          <div>
            <label style={LBL}>Fecha cosecha est.</label>
            <input type="date" value={meta.fechaCosechaEst || ""} onChange={e => setMeta(p => ({ ...p, fechaCosechaEst: e.target.value }))} style={INP} />
          </div>
          <div>
            <label style={LBL}>Fecha cosecha real</label>
            <input type="date" value={meta.fechaCosechaReal || ""} onChange={e => setMeta(p => ({ ...p, fechaCosechaReal: e.target.value }))} style={INP} />
          </div>
        </div>
        <button onClick={descargar} disabled={descargando || !filt.length} style={{ padding: "10px 24px", background: descargando || !filt.length ? "#aaa" : "#8e44ad", color: "#fff", border: "none", borderRadius: 8, cursor: descargando || !filt.length ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13 }}>
          {descargando ? "⏳ Generando..." : `📥 Descargar reporte XLSX (${filt.length})`}
        </button>
      </div>

      {/* Vista previa */}
      <div style={{ ...card, overflow: "auto" }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: "#555" }}>
          Vista previa · {filt.length} aplicaciones en {mes}
        </div>
        {!filt.length ? (
          <div style={{ textAlign: "center", color: "#aaa", padding: "30px" }}>Sin aplicaciones para este mes/cultivo</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, minWidth: 1000 }}>
            <thead style={{ background: "#f8f9fa" }}>
              <tr>
                {["Fecha", "Producto", "Ing. activo", "Dosis/Ha", "Aplicada", "Plaga", "I.S.", "Reentr.", "Equipo", "Hora", "Sección", "Aplicador"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", border: "1px solid #eee", fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filt.map(a => (
                <tr key={a.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0", fontFamily: "monospace" }}>{a.fecha}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0", fontWeight: 600 }}>{a.nombreComercial}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0" }}>{a.ingredienteActivo || "—"}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0", fontFamily: "monospace" }}>{a.dosisHa} {a.unidadDosis}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0", fontFamily: "monospace" }}>{a.dosisAplicada} {a.unidadDosis}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0" }}>{a.plaga || "—"}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0", textAlign: "center" }}>{a.intervaloSeguridad || "—"}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0", textAlign: "center" }}>{a.tiempoReentrada || "—"}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0" }}>{a.equipo || "—"}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0", fontFamily: "monospace", fontSize: 9.5 }}>{a.horaInicio}{a.horaTermino ? `-${a.horaTermino}` : ""}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0" }}>{a.seccion || "—"}</td>
                  <td style={{ padding: "5px 8px", border: "1px solid #f0f0f0" }}>{a.aplicador || a.worker || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
