// ─── PANEL SUPER-ADMIN MÓVIL ─────────────────────────────────────────────────
// Muestra cada CDT como tarjeta expandible. Al tocar una, carga su resumen:
// cultivos, ventas/cosechas/RBC por cultivo y estatus de actividades.
import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { switchCdt, getSuperOverride, clearSuperOverride, getUserRole } from "./cdtContext";

const CROP_EMOJI = { jitomate:"🍅", fresa:"🍓", arandano:"🫐", zarzamora:"🫐", pepino:"🥒", cana:"🎋", pimiento:"🫑", lechuga:"🥬", chile:"🌶️", frambuesa:"🫐", maiz:"🌽", aguacate:"🥑" };
const fmtN = (n) => Number(n||0).toLocaleString("es-MX",{maximumFractionDigits:0});
const fmt$ = (n) => "$"+Number(n||0).toLocaleString("es-MX",{maximumFractionDigits:0});

export default function SuperAdminMobile() {
  const soloLectura = getUserRole() === "observador_global";
  const [cdts, setCdts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(null);
  const overrideActivo = getSuperOverride();

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "cdts"));
        setCdts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error("cdts:", e); }
      setLoading(false);
    })();
  }, []);

  const entrarACdt = (id) => { switchCdt(id); window.location.reload(); };
  const volverGlobal = () => { clearSuperOverride(); window.location.reload(); };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>Cargando centros...</div>;

  return (
    <div style={{ padding: "4px 2px 20px" }}>
      <div style={{ fontSize: 19, fontWeight: 700, color: "#1a2533", marginBottom: 2 }}>🏢 Centros CDT</div>
      <div style={{ fontSize: 12, color: "#8a94a0", marginBottom: 14 }}>{cdts.length} centros · toca uno para ver su resumen</div>

      {overrideActivo && (
        <div style={{ background: "#2980b9", color: "#fff", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
          👁 Viendo <strong>{overrideActivo}</strong>
          <button onClick={volverGlobal} style={{ marginLeft: 8, padding: "4px 10px", background: "#fff", color: "#2980b9", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Vista global</button>
        </div>
      )}

      {cdts.map(cdt => (
        <CdtCard key={cdt.id} cdt={cdt}
          abierto={expandido === cdt.id}
          onToggle={() => setExpandido(expandido === cdt.id ? null : cdt.id)}
          onEntrar={() => entrarACdt(cdt.id)}
          soloLectura={soloLectura}
        />
      ))}
    </div>
  );
}

function CdtCard({ cdt, abierto, onToggle, onEntrar, soloLectura }) {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);

  // Cargar el resumen del CDT solo cuando se expande (ahorra lecturas)
  useEffect(() => {
    if (!abierto || data) return;
    (async () => {
      setCargando(true);
      try {
        const cid = cdt.id;
        const q = (col) => getDocs(query(collection(db, col), where("cdtId", "==", cid)));
        const [lotesS, ventasS, cosechasS, mermasS] = await Promise.all([
          q("lotes"), q("ventas"), q("cosechas_trabajador"), q("mermas"),
        ]);
        const lotes = lotesS.docs.map(d => d.data());
        const ventas = ventasS.docs.map(d => d.data());
        const cosechas = cosechasS.docs.map(d => d.data());
        const mermas = mermasS.docs.map(d => d.data());

        // Por cultivo
        const cultivos = cdt.cultivos ? Object.keys(cdt.cultivos) : [];
        const porCultivo = {};
        const asegura = (c) => { if (!porCultivo[c]) porCultivo[c] = { kgCos:0, kgVen:0, ingresos:0, costo:0, merma:0, rbc:0 }; return porCultivo[c]; };

        lotes.forEach(l => {
          if (!l.crop) return;
          const p = asegura(l.crop);
          const cosTrab = cosechas.filter(c => c.loteId === l.id).reduce((s,c) => s+(parseFloat(c.kgCosechados)||0), 0);
          p.kgCos += cosTrab > 0 ? cosTrab : (parseFloat(l.kgCosechados)||0);
          p.costo += parseFloat(l.costoCiclo)||0;
        });
        ventas.forEach(v => {
          if (!v.crop) return;
          const p = asegura(v.crop);
          p.kgVen += parseFloat(v.kgVendidos)||0;
          p.ingresos += parseFloat(v.totalVenta) || ((parseFloat(v.kgVendidos)||0)*(parseFloat(v.precioKg)||0));
        });
        mermas.forEach(m => {
          if (!m.crop) return;
          asegura(m.crop).merma += parseFloat(m.kgMerma)||0;
        });
        Object.values(porCultivo).forEach(p => { p.rbc = p.costo > 0 ? p.ingresos/p.costo : 0; });

        // Totales
        const tot = { kgCos:0, kgVen:0, ingresos:0, merma:0, lotes: lotes.length, ventas: ventas.length };
        Object.values(porCultivo).forEach(p => { tot.kgCos+=p.kgCos; tot.kgVen+=p.kgVen; tot.ingresos+=p.ingresos; tot.merma+=p.merma; });

        setData({ porCultivo, tot, cultivos });
      } catch (e) { console.error("resumen cdt:", e); setData({ error: true }); }
      setCargando(false);
    })();
  }, [abierto]);

  const activo = cdt.activo !== false;
  const nCultivos = cdt.cultivos ? Object.keys(cdt.cultivos).length : 0;

  return (
    <div style={{ background: "#fff", borderRadius: 14, marginBottom: 12, overflow: "hidden", border: "1px solid #e6e9ed", borderLeft: `4px solid ${activo ? "#27ae60" : "#e74c3c"}` }}>
      {/* Cabecera tocable */}
      <div onClick={onToggle} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1a2533" }}>{cdt.nombre}</span>
            <span style={{ fontSize: 9, background: "#eef2f5", color: "#8a94a0", padding: "2px 7px", borderRadius: 8, fontFamily: "monospace", textTransform: "uppercase" }}>{cdt.id}</span>
          </div>
          <div style={{ fontSize: 11, color: "#8a94a0", marginTop: 3 }}>{nCultivos} cultivos {cdt.direccion ? `· ${cdt.direccion}` : ""}</div>
        </div>
        <span style={{ fontSize: 18, color: "#aaa", transform: abierto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
      </div>

      {/* Contenido expandible */}
      {abierto && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f0f0f0" }}>
          {cargando && <div style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 13 }}>Cargando resumen...</div>}
          {data && data.error && <div style={{ padding: 20, textAlign: "center", color: "#e74c3c", fontSize: 13 }}>No se pudo cargar (puede faltar índice)</div>}
          {data && !data.error && (
            <>
              {/* Totales del CDT */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "14px 0" }}>
                <KPIbox label="Kg cosechados" value={fmtN(data.tot.kgCos)} color="#27ae60" />
                <KPIbox label="Kg vendidos" value={fmtN(data.tot.kgVen)} color="#2980b9" />
                <KPIbox label="Ingresos" value={fmt$(data.tot.ingresos)} color="#e67e22" />
                <KPIbox label="Kg merma" value={fmtN(data.tot.merma)} color="#e74c3c" />
              </div>

              {/* Por cultivo */}
              <div style={{ fontSize: 11, color: "#8a94a0", fontWeight: 600, margin: "14px 0 8px" }}>POR CULTIVO</div>
              {data.cultivos.length === 0 && <div style={{ fontSize: 12, color: "#aaa" }}>Este CDT no tiene cultivos definidos.</div>}
              {data.cultivos.map(c => {
                const p = data.porCultivo[c] || { kgCos:0, kgVen:0, ingresos:0, merma:0, rbc:0 };
                const emoji = (cdt.cultivos?.[c]?.emoji) || CROP_EMOJI[c] || "🌱";
                const nombre = (cdt.cultivos?.[c]?.name) || c;
                const rbcColor = p.rbc >= 1.5 ? "#27ae60" : p.rbc >= 1 ? "#f39c12" : "#e74c3c";
                return (
                  <div key={c} style={{ background: "#f8f9fa", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2533" }}>{emoji} {nombre}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: rbcColor, background: rbcColor+"18", padding: "2px 8px", borderRadius: 8 }}>RBC {p.rbc.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#666", flexWrap: "wrap" }}>
                      <span>🌾 {fmtN(p.kgCos)} kg cos</span>
                      <span>💰 {fmtN(p.kgVen)} kg vend</span>
                      <span>💵 {fmt$(p.ingresos)}</span>
                      {p.merma > 0 && <span style={{ color: "#e74c3c" }}>⚠ {fmtN(p.merma)} kg</span>}
                    </div>
                  </div>
                );
              })}

              {/* Estatus */}
              <div style={{ fontSize: 11, color: "#8a94a0", marginTop: 10 }}>
                📋 {data.tot.lotes} lotes · {data.tot.ventas} ventas registradas
              </div>

              {/* Botón entrar */}
              <button onClick={onEntrar} style={{ width: "100%", marginTop: 14, padding: "12px", background: "#2980b9", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                → Entrar a {cdt.nombre}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function KPIbox({ label, value, color }) {
  return (
    <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#8a94a0" }}>{label}</div>
    </div>
  );
}
