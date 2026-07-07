// ─── PANEL SUPER-ADMIN (gestión de todos los CDT) ────────────────────────────
import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, getDocs,
} from "firebase/firestore";
import { switchCdt, getCurrentCdtId, getSuperOverride, clearSuperOverride } from "./cdtContext";

const INP = { padding: "9px 12px", border: "1px solid #d5dae0", borderRadius: 8, fontSize: 13, width: "100%", boxSizing: "border-box", background: "#fff", color: "#111" };
const LBL = { fontSize: 11, color: "#8a94a0", display: "block", marginBottom: 4, fontWeight: 600 };
const card = { background: "#fff", border: "1px solid #e6e9ed", borderRadius: 12, padding: "18px 20px", marginBottom: 14 };

// Cultivos disponibles para asignar a un CDT
const CULTIVOS_CATALOGO = [
  { id: "jitomate", name: "Jitomate", emoji: "🍅" },
  { id: "fresa", name: "Fresa", emoji: "🍓" },
  { id: "arandano", name: "Arándano", emoji: "🫐" },
  { id: "zarzamora", name: "Zarzamora", emoji: "🫐" },
  { id: "pepino", name: "Pepino", emoji: "🥒" },
  { id: "cana", name: "Caña de azúcar", emoji: "🎋" },
  { id: "pimiento", name: "Pimiento", emoji: "🫑" },
  { id: "lechuga", name: "Lechuga", emoji: "🥬" },
  { id: "chile", name: "Chile", emoji: "🌶️" },
  { id: "frambuesa", name: "Frambuesa", emoji: "🫐" },
  { id: "maiz", name: "Maíz", emoji: "🌽" },
  { id: "aguacate", name: "Aguacate", emoji: "🥑" },
];

export default function SuperAdmin() {
  const [cdts, setCdts] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingCdt, setEditingCdt] = useState(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "cdts"),
      snap => { setCdts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err => { console.error("cdts:", err); setLoading(false); });
    return () => unsub();
  }, []);

  // Cargar métricas globales (conteo de docs por CDT)
  useEffect(() => {
    const cargarStats = async () => {
      const cols = ["readings", "ventas", "cosechas_trabajador", "aplicaciones", "usuarios"];
      const acc = {};
      for (const col of cols) {
        try {
          const snap = await getDocs(collection(db, col));
          snap.docs.forEach(d => {
            const cid = d.data().cdtId || "sin_cdt";
            acc[cid] = acc[cid] || {};
            acc[cid][col] = (acc[cid][col] || 0) + 1;
          });
        } catch (e) { console.warn(col, e); }
      }
      setStats(acc);
    };
    cargarStats();
  }, [cdts.length]);

  const overrideActivo = getSuperOverride();

  const entrarACdt = (cdtId) => {
    switchCdt(cdtId);
    window.location.reload();
  };

  const volverGlobal = () => {
    clearSuperOverride();
    window.location.reload();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>Cargando CDTs...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1a2533" }}>🏢 Centros de Desarrollo (CDT)</div>
          <div style={{ fontSize: 12, color: "#8a94a0", marginTop: 2 }}>{cdts.length} centros registrados · Vista global de super-administrador</div>
        </div>
        <button onClick={() => { setShowNew(true); setEditingCdt(null); }}
          style={{ padding: "10px 18px", background: "#27ae60", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          + Nuevo CDT
        </button>
      </div>

      {overrideActivo && (
        <div style={{ background: "#2980b9", color: "#fff", borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 13 }}>
            👁 Estás viendo los datos del CDT <strong style={{ fontFamily: "monospace" }}>{overrideActivo}</strong>. Todas las secciones (Resumen, Ventas, etc.) muestran datos de este centro.
          </div>
          <button onClick={volverGlobal} style={{ padding: "7px 16px", background: "#fff", color: "#2980b9", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            ← Volver a vista global
          </button>
        </div>
      )}

      {(showNew || editingCdt) && (
        <CdtForm
          cdt={editingCdt}
          onClose={() => { setShowNew(false); setEditingCdt(null); }}
        />
      )}

      {/* Lista de CDT */}
      {cdts.map(cdt => {
        const s = stats[cdt.id] || {};
        const cultivosCount = cdt.cultivos ? Object.keys(cdt.cultivos).length : 0;
        return (
          <div key={cdt.id} style={{ ...card, borderLeft: `4px solid ${cdt.activo === false ? "#e74c3c" : "#27ae60"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: "#1a2533" }}>{cdt.nombre}</span>
                  <span style={{ fontSize: 10, background: "#eef2f5", color: "#8a94a0", padding: "2px 8px", borderRadius: 10, fontFamily: "monospace" }}>{cdt.id}</span>
                  {cdt.activo === false && <span style={{ fontSize: 10, background: "#fdedec", color: "#e74c3c", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>INACTIVO</span>}
                </div>
                {cdt.direccion && <div style={{ fontSize: 12, color: "#8a94a0", marginTop: 4 }}>{cdt.direccion}</div>}
                <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                  <Metric label="Lecturas pH/CE" value={s.readings || 0} />
                  <Metric label="Ventas" value={s.ventas || 0} />
                  <Metric label="Cosechas" value={s.cosechas_trabajador || 0} />
                  <Metric label="Aplicaciones" value={s.aplicaciones || 0} />
                  <Metric label="Usuarios" value={s.usuarios || 0} />
                  <Metric label="Cultivos" value={cultivosCount || "—"} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {overrideActivo === cdt.id ? (
                  <button onClick={volverGlobal}
                    style={{ padding: "8px 16px", background: "#27ae60", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                    ✓ Viendo este CDT
                  </button>
                ) : (
                  <button onClick={() => entrarACdt(cdt.id)}
                    style={{ padding: "8px 16px", background: "#2980b9", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                    → Entrar a este CDT
                  </button>
                )}
                <button onClick={() => { setEditingCdt(cdt); setShowNew(false); window.scrollTo(0, 0); }}
                  style={{ padding: "7px 16px", background: "#eef2f5", color: "#556", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  ✎ Editar
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {!cdts.length && (
        <div style={{ ...card, textAlign: "center", color: "#aaa", padding: "40px" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🏢</div>
          <div>No hay centros registrados aún</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Crea el primero con el botón "+ Nuevo CDT"</div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1a2533", fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#8a94a0" }}>{label}</div>
    </div>
  );
}

// ─── FORMULARIO CREAR/EDITAR CDT ─────────────────────────────────────────────
function CdtForm({ cdt, onClose }) {
  const esEdicion = !!cdt;
  const [id, setId] = useState(cdt?.id || "");
  const [nombre, setNombre] = useState(cdt?.nombre || "");
  const [direccion, setDireccion] = useState(cdt?.direccion || "");
  const [activo, setActivo] = useState(cdt?.activo !== false);
  const [cultivos, setCultivos] = useState(() => {
    // cultivos guardado como objeto { id: {name, emoji, tipoUbicacion, ubicaciones:[]} }
    if (cdt?.cultivos) return cdt.cultivos;
    return {};
  });
  const [saving, setSaving] = useState(false);

  const toggleCultivo = (cat) => {
    setCultivos(prev => {
      const next = { ...prev };
      if (next[cat.id]) {
        delete next[cat.id];
      } else {
        next[cat.id] = { name: cat.name, emoji: cat.emoji, tipoUbicacion: "Nave", ubicaciones: [] };
      }
      return next;
    });
  };

  const setTipoUbicacion = (cropId, tipo) => {
    setCultivos(prev => ({ ...prev, [cropId]: { ...prev[cropId], tipoUbicacion: tipo } }));
  };

  const setUbicaciones = (cropId, texto) => {
    const lista = texto.split(",").map(s => s.trim()).filter(Boolean);
    setCultivos(prev => ({ ...prev, [cropId]: { ...prev[cropId], ubicaciones: lista } }));
  };

  const guardar = async () => {
    const cdtId = (id || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!cdtId) { alert("Falta el ID del CDT"); return; }
    if (!nombre.trim()) { alert("Falta el nombre del CDT"); return; }
    setSaving(true);
    try {
      const data = { nombre: nombre.trim(), direccion: direccion.trim(), activo, cultivos, updatedAt: new Date().toISOString() };
      if (!esEdicion) data.createdAt = new Date().toISOString();
      await setDoc(doc(db, "cdts", cdtId), data, { merge: true });
      alert(esEdicion ? "CDT actualizado" : `CDT "${nombre}" creado con ID "${cdtId}"`);
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ ...card, borderLeft: "4px solid #e67e22", background: "#fffdf9" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#e67e22", marginBottom: 14 }}>
        {esEdicion ? `✎ Editar ${cdt.nombre}` : "+ Nuevo Centro de Desarrollo"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={LBL}>ID corto *</label>
          <input value={id} onChange={e => setId(e.target.value)} disabled={esEdicion}
            placeholder="ej: salvador" style={{ ...INP, background: esEdicion ? "#f0f0f0" : "#fff", fontFamily: "monospace" }} />
          {esEdicion && <div style={{ fontSize: 10, color: "#aaa", marginTop: 3 }}>El ID no se puede cambiar</div>}
        </div>
        <div>
          <label style={LBL}>Nombre completo *</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="CDT Salvador Lira López" style={INP} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={LBL}>Dirección</label>
        <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección del centro" style={INP} />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} style={{ width: 16, height: 16 }} />
        CDT activo (los usuarios pueden operar)
      </label>

      {/* Cultivos */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "#556", marginBottom: 8 }}>Cultivos de este CDT</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {CULTIVOS_CATALOGO.map(cat => (
          <button key={cat.id} onClick={() => toggleCultivo(cat)}
            style={{ padding: "6px 12px", border: `1px solid ${cultivos[cat.id] ? "#27ae60" : "#d5dae0"}`, borderRadius: 16, background: cultivos[cat.id] ? "#eafaf1" : "#fff", cursor: "pointer", fontSize: 12, color: cultivos[cat.id] ? "#27ae60" : "#8a94a0", fontWeight: cultivos[cat.id] ? 700 : 500 }}>
            {cat.emoji} {cat.name} {cultivos[cat.id] ? "✓" : ""}
          </button>
        ))}
      </div>

      {/* Configuración de ubicaciones por cultivo seleccionado */}
      {Object.keys(cultivos).length > 0 && (
        <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#8a94a0", marginBottom: 10, fontWeight: 600 }}>Define las naves/invernaderos de cada cultivo (separados por coma):</div>
          {Object.entries(cultivos).map(([cropId, cropData]) => (
            <div key={cropId} style={{ display: "grid", gridTemplateColumns: "120px 130px 1fr", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{cropData.emoji} {cropData.name}</div>
              <select value={cropData.tipoUbicacion || "Nave"} onChange={e => setTipoUbicacion(cropId, e.target.value)} style={{ ...INP, padding: "6px 8px" }}>
                <option value="Nave">Nave</option>
                <option value="Invernadero">Invernadero</option>
                <option value="Túnel">Túnel</option>
                <option value="Macrotúnel">Macrotúnel</option>
                <option value="Lote">Lote</option>
              </select>
              <input defaultValue={(cropData.ubicaciones || []).join(", ")} onBlur={e => setUbicaciones(cropId, e.target.value)}
                placeholder="ej: Nave 1, Nave 2, Nave 3" style={{ ...INP, padding: "6px 8px" }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={guardar} disabled={saving}
          style={{ padding: "9px 22px", background: saving ? "#aaa" : "#27ae60", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "wait" : "pointer", fontWeight: 700, fontSize: 13 }}>
          {saving ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear CDT"}
        </button>
        <button onClick={onClose} style={{ padding: "9px 18px", background: "transparent", border: "1px solid #d5dae0", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#8a94a0" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
