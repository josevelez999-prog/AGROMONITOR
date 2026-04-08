import { useState, useMemo, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";

// ─── DATA ─────────────────────────────────────────────────────────────────────

// ─── PRECIOS POR CALIDAD ──────────────────────────────────────────────────────
export function usePreciosCalidad() {
  const [precios, setPrecios] = useState({});
  useEffect(()=>{
    const unsub = onSnapshot(doc(db,"config","precios"), snap=>{
      if(snap.exists()) setPrecios(snap.data());
    });
    return()=>unsub();
  },[]);
  return precios;
}

function PreciosCalidad() {
  const [precios, setPrecios] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(()=>{
    const unsub = onSnapshot(doc(db,"config","precios"), snap=>{
      if(snap.exists()) setPrecios(snap.data());
    });
    return()=>unsub();
  },[]);

  const updatePrecio = (crop, calidad, value) => {
    setPrecios(p => ({
      ...p,
      [crop]: { ...(p[crop]||{}), [calidad]: parseFloat(value)||0 }
    }));
  };

  const savePrecios = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db,"config","precios"), precios);
      setSaved(true);
      setTimeout(()=>setSaved(false), 3000);
    } catch(e) { alert("Error: "+e.message); }
    setSaving(false);
  };

  const CALIDADES_P = [
    {id:"primera",label:"Primera ⭐",color:"#27ae60"},
    {id:"segunda",label:"Segunda ⚡",color:"#f39c12"},
    {id:"tercera",label:"Tercera ▲",color:"#e67e22"},
    {id:"descarte",label:"Descarte ✕",color:"#e74c3c"},
  ];

  return (
    <div>
      {saved&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:8,padding:"10px 14px",marginBottom:12,color:"#27ae60",fontWeight:600,fontSize:13}}>✓ Precios guardados — los trabajadores ya los pueden ver</div>}
      <div style={{background:"#fff3cd",border:"1px solid #ffc10744",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#856404"}}>
        💡 Los precios que configures aquí aparecen como sugerencia en la app de los trabajadores al registrar una venta
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead>
            <tr style={{background:"#fafafa"}}>
              <th style={{padding:"10px 12px",textAlign:"left",color:"#888",fontWeight:500,fontSize:11,borderBottom:"1px solid #f0f0f0"}}>Cultivo</th>
              {CALIDADES_P.map(c=>(
                <th key={c.id} style={{padding:"10px 12px",textAlign:"center",color:c.color,fontWeight:600,fontSize:11,borderBottom:"1px solid #f0f0f0",minWidth:100}}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(CROPS).map(([k,crop])=>(
              <tr key={k} style={{borderBottom:"1px solid #f5f5f5"}}>
                <td style={{padding:"10px 12px",fontWeight:600}}>
                  <span style={{color:crop.color}}>{crop.emoji} {crop.name}</span>
                </td>
                {CALIDADES_P.map(c=>(
                  <td key={c.id} style={{padding:"8px 10px",textAlign:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}>
                      <span style={{fontSize:12,color:"#aaa",fontWeight:500}}>$</span>
                      <input
                        type="number" step="0.5" min="0"
                        value={precios[k]?.[c.id]||""}
                        onChange={e=>updatePrecio(k, c.id, e.target.value)}
                        placeholder="0.00"
                        style={{...INP,width:80,textAlign:"center",fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:14,padding:"6px 8px",border:`1.5px solid ${c.color}44`}}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{marginTop:14,display:"flex",justifyContent:"flex-end"}}>
        <button onClick={savePrecios} disabled={saving}
          style={{padding:"10px 28px",background:saving?"#aaa":"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:saving?"not-allowed":"pointer",fontWeight:700,fontSize:13}}>
          {saving?"Guardando...":"💾 Guardar precios"}
        </button>
      </div>
    </div>
  );
}

// Fuerza inputs en modo claro sin importar el tema del SO
const INP = {
  width:"100%", padding:"10px 12px", border:"1.5px solid #bbb",
  borderRadius:8, fontSize:14, boxSizing:"border-box",
  color:"#111111 !important", WebkitTextFillColor:"#111111",
  background:"#ffffff", backgroundColor:"#ffffff",
  colorScheme:"light",
  outline:"none", fontFamily:"inherit",
};

const CROPS = {
  jitomate:  { name:"Jitomate",  emoji:"🍅", color:"#c0392b", unidad:"kg" },
  fresa:     { name:"Fresa",     emoji:"🍓", color:"#e74c3c", unidad:"kg" },
  arandano:  { name:"Arándano",  emoji:"🫐", color:"#2980b9", unidad:"kg" },
  zarzamora: { name:"Zarzamora", emoji:"🫐", color:"#8e44ad", unidad:"kg" },
};

const TRATAMIENTOS = [
  { id:"convencional",  label:"Convencional",        color:"#7f8c8d", icon:"🌱" },
  { id:"organico",      label:"Orgánico",             color:"#27ae60", icon:"🍃" },
  { id:"bpa",           label:"BPA (Buenas Prácticas)",color:"#2980b9", icon:"✅" },
  { id:"sin_quimicos",  label:"Sin químicos",          color:"#8e44ad", icon:"🌿" },
  { id:"premium",       label:"Premium / Selección",   color:"#f39c12", icon:"⭐" },
  { id:"exportacion",   label:"Para exportación",      color:"#e74c3c", icon:"✈️" },
];

const CANALES = [
  "Mercado local","Central de abastos","Supermercado","Restaurante",
  "Exportación","Venta directa","Agroindustria","Mercado orgánico","Otro"
];

const CALIDADES = [
  { id:"primera",  label:"Primera",  color:"#27ae60", icon:"⭐" },
  { id:"segunda",  label:"Segunda",  color:"#f39c12", icon:"⚡" },
  { id:"tercera",  label:"Tercera",  color:"#e67e22", icon:"▲" },
  { id:"descarte", label:"Descarte", color:"#e74c3c", icon:"✕" },
];

const n = (v, d=2) => Number(parseFloat(v||0).toFixed(d));
const fmt = (v) => Number(v||0).toLocaleString("es-MX", { minimumFractionDigits:2, maximumFractionDigits:2 });

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px"}}>
      <div style={{fontSize:22}}>{icon}</div>
      <div style={{fontSize:26,fontWeight:700,color:color||"#2c3e50",fontFamily:"'Courier New',monospace",lineHeight:1.1,marginTop:4}}>{value}</div>
      <div style={{fontSize:11,color:"#888",marginTop:2}}>{label}</div>
      {sub&&<div style={{fontSize:10,color:"#aaa",marginTop:1}}>{sub}</div>}
    </div>
  );
}

// ─── LOTES ────────────────────────────────────────────────────────────────────
function GestionLotes() {
  const [lotes, setLotes] = useState([]);
  const [form, setForm] = useState({
    nombre:"", crop:"jitomate", zona:"", tratamiento:"convencional",
    fechaCosecha:new Date().toISOString().slice(0,10),
    kgCosechados:0, kgEstimados:0, notas:""
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (editing) {
      setForm({
        loteId: editing.loteId||"",
        crop: editing.crop||"jitomate",
        comprador: editing.comprador||"",
        canal: editing.canal||"Mercado local",
        calidad: editing.calidad||"primera",
        kgVendidos: editing.kgVendidos||0,
        precioKg: editing.precioKg||0,
        fecha: editing.fecha||new Date().toISOString().slice(0,10),
        notas: editing.notas||"",
        factura: editing.factura||"",
      });
    }
  }, [editing]);

  useEffect(() => {
    const q = query(collection(db,"lotes"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap => setLotes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => unsub();
  }, []);

  const save = async () => {
    if (!form.nombre || !form.zona) { alert("Llena nombre y zona"); return; }
    const data = { ...form, kgCosechados:parseFloat(form.kgCosechados)||0, kgEstimados:parseFloat(form.kgEstimados)||0, createdAt:new Date().toISOString() };
    if (editing) {
      await updateDoc(doc(db,"lotes",editing), data);
      setEditing(null);
    } else {
      await addDoc(collection(db,"lotes"), data);
    }
    setForm({ nombre:"", crop:"jitomate", zona:"", tratamiento:"convencional", fechaCosecha:new Date().toISOString().slice(0,10), kgCosechados:0, kgEstimados:0, notas:"" });
    setShowForm(false);
  };

  const inp = INP;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:12,color:"#888"}}>Lotes registrados: <strong style={{color:"#333"}}>{lotes.length}</strong></div>
        <button onClick={()=>{setShowForm(!showForm);setEditing(null);}} style={{padding:"9px 20px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>
          {showForm?"Cancelar":"+ Nuevo lote"}
        </button>
      </div>

      {showForm && (
        <div style={{background:"#fff",border:"1px solid #a9dfbf",borderRadius:12,padding:"18px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14,letterSpacing:0.3}}>{editing?"EDITAR LOTE":"NUEVO LOTE DE PRODUCCIÓN"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>NOMBRE DEL LOTE *</label>
              <input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Jitomate Lote A — Mar 2026" style={inp}/>
            </div>
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>CULTIVO</label>
              <select value={form.crop} onChange={e=>setForm(p=>({...p,crop:e.target.value}))} style={inp}>
                {Object.entries(CROPS).map(([k,c])=><option key={k} value={k}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>ZONA / PARCELA</label>
              <input value={form.zona} onChange={e=>setForm(p=>({...p,zona:e.target.value}))} placeholder="Zona A" style={inp}/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:6}}>TRATAMIENTO / SEGMENTACIÓN</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {TRATAMIENTOS.map(t=>(
                  <button key={t.id} onClick={()=>setForm(p=>({...p,tratamiento:t.id}))}
                    style={{padding:"7px 12px",border:`1.5px solid ${form.tratamiento===t.id?t.color:"#e0e0e0"}`,borderRadius:20,background:form.tratamiento===t.id?t.color+"18":"transparent",color:form.tratamiento===t.id?t.color:"#666",cursor:"pointer",fontSize:12,fontWeight:form.tratamiento===t.id?700:400}}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>FECHA DE COSECHA</label>
              <input type="date" value={form.fechaCosecha} onChange={e=>setForm(p=>({...p,fechaCosecha:e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>KG ESTIMADOS</label>
              <input type="number" step="1" min="0" value={form.kgEstimados} onChange={e=>setForm(p=>({...p,kgEstimados:e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>KG COSECHADOS REALES</label>
              <input type="number" step="0.1" min="0" value={form.kgCosechados} onChange={e=>setForm(p=>({...p,kgCosechados:e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>NOTAS</label>
              <input value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} placeholder="Observaciones del lote" style={inp}/>
            </div>
          </div>
          <button onClick={save} style={{padding:"9px 24px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>
            {editing?"Actualizar lote":"Crear lote"}
          </button>
        </div>
      )}

      {!lotes.length && (
        <div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa",border:"0.5px solid #e0e0e0"}}>
          <div style={{fontSize:40,marginBottom:8}}>📦</div>
          <div style={{fontWeight:500,marginBottom:4}}>Sin lotes de producción</div>
          <div style={{fontSize:12}}>Crea un lote para registrar cosechas y ventas</div>
        </div>
      )}

      {lotes.map(lote => {
        const crop = CROPS[lote.crop];
        const trat = TRATAMIENTOS.find(t=>t.id===lote.tratamiento);
        const eficiencia = lote.kgEstimados > 0 ? n(lote.kgCosechados/lote.kgEstimados*100, 1) : null;
        return (
          <div key={lote.id} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderTop:`3px solid ${crop?.color}`,borderRadius:12,padding:"14px 18px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:24}}>{crop?.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:3}}>{lote.nombre}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{background:trat?.color+"18",color:trat?.color,border:`1px solid ${trat?.color}44`,borderRadius:10,padding:"1px 8px",fontSize:11,fontWeight:600}}>{trat?.icon} {trat?.label}</span>
                  <span style={{fontSize:12,color:"#888"}}>📍 {lote.zona}</span>
                  <span style={{fontSize:12,color:"#888"}}>📅 {lote.fechaCosecha}</span>
                </div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'Courier New',monospace",fontSize:13,color:"#27ae60",fontWeight:700}}>{lote.kgCosechados} kg cosechados</span>
                  {lote.kgEstimados>0&&<span style={{fontFamily:"'Courier New',monospace",fontSize:12,color:"#aaa"}}>{lote.kgEstimados} kg estimados</span>}
                  {eficiencia&&<span style={{fontFamily:"'Courier New',monospace",fontSize:12,color:eficiencia>=90?"#27ae60":eficiencia>=70?"#f39c12":"#e74c3c",fontWeight:600}}>{eficiencia}% eficiencia</span>}
                </div>
                {lote.notas&&<div style={{fontSize:11,color:"#aaa",marginTop:4}}>📝 {lote.notas}</div>}
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setForm({...lote});setEditing(lote.id);setShowForm(true);}} style={{background:"#eaf4fb",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,color:"#2980b9"}}>✎ Editar</button>
                <button onClick={()=>{if(window.confirm("¿Eliminar este lote?"))deleteDoc(doc(db,"lotes",lote.id));}} style={{background:"#fdedec",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,color:"#c0392b"}}>✕</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── REGISTRO DE VENTAS ───────────────────────────────────────────────────────
function RegistroVentas() {
  const [ventas, setVentas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [form, setForm] = useState({
    loteId:"", crop:"jitomate", comprador:"", canal:"Mercado local",
    calidad:"primera", kgVendidos:0, precioKg:0,
    fecha:new Date().toISOString().slice(0,10), notas:"", factura:""
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const q = query(collection(db,"ventas"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap => setVentas(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db,"lotes"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap => setLotes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => unsub();
  }, []);

  const save = async () => {
    if (!form.comprador || !form.kgVendidos || !form.precioKg) { alert("Llena comprador, kg y precio"); return; }
    const kg = parseFloat(form.kgVendidos)||0;
    const precio = parseFloat(form.precioKg)||0;
    const total = n(kg * precio);
    const lote = lotes.find(l=>l.id===form.loteId);
    const data = {
      ...form, kgVendidos:kg, precioKg:precio, totalVenta:total,
      cropName: lote ? CROPS[lote.crop]?.name : CROPS[form.crop]?.name,
      loteName: lote?.nombre || "",
      tratamiento: lote?.tratamiento || "",
    };
    if (editing) {
      await updateDoc(doc(db,"ventas",editing.id), {...data, updatedAt:new Date().toISOString()});
      setEditing(null);
    } else {
      await addDoc(collection(db,"ventas"), {...data, createdAt:new Date().toISOString()});
    }
    setForm({ loteId:"", crop:"jitomate", comprador:"", canal:"Mercado local", calidad:"primera", kgVendidos:0, precioKg:0, fecha:new Date().toISOString().slice(0,10), notas:"", factura:"" });
    setShowForm(false);
  };

  const totalVendido = ventas.reduce((s,v)=>s+v.totalVenta,0);
  const totalKg = ventas.reduce((s,v)=>s+v.kgVendidos,0);
  const precioPromedio = totalKg>0 ? n(totalVendido/totalKg) : 0;

  const inp = INP;

  return (
    <div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:16}}>
        <StatCard icon="💰" label="Ingresos totales" value={`$${fmt(totalVendido)}`} color="#27ae60"/>
        <StatCard icon="⚖️" label="Kg vendidos" value={`${fmt(totalKg)} kg`} color="#2980b9"/>
        <StatCard icon="📊" label="Precio promedio/kg" value={`$${fmt(precioPromedio)}`} color="#8e44ad"/>
        <StatCard icon="📋" label="Transacciones" value={ventas.length} color="#e67e22"/>
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:12,color:"#888"}}>{ventas.length} ventas registradas</div>
        <button onClick={()=>{setShowForm(!showForm);if(showForm)setEditing(null);}} style={{padding:"9px 20px",background:showForm?"#e74c3c":"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>
          {showForm?"✕ Cancelar":"+ Registrar venta"}
        </button>
      </div>

      {showForm && (
        <div style={{background:"#fff",border:"1px solid #a9dfbf",borderRadius:12,padding:"18px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"#444",letterSpacing:0.3}}>{editing?"✎ EDITAR VENTA":"+ NUEVA VENTA"}</div>
            {editing&&<span style={{fontSize:11,color:"#f39c12",background:"#fef9e7",border:"1px solid #f39c1244",borderRadius:6,padding:"2px 8px"}}>Editando registro del {editing.fecha}</span>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>LOTE DE PRODUCCIÓN (opcional)</label>
              <select value={form.loteId} onChange={e=>{const l=lotes.find(x=>x.id===e.target.value);setForm(p=>({...p,loteId:e.target.value,crop:l?.crop||p.crop}));}} style={inp}>
                <option value="">— Sin lote asignado —</option>
                {lotes.map(l=>{const c=CROPS[l.crop];const t=TRATAMIENTOS.find(x=>x.id===l.tratamiento);return <option key={l.id} value={l.id}>{c?.emoji} {l.nombre} · {t?.label}</option>;})}
              </select>
            </div>
            {!form.loteId && (
              <div>
                <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>CULTIVO</label>
                <select value={form.crop} onChange={e=>setForm(p=>({...p,crop:e.target.value}))} style={inp}>
                  {Object.entries(CROPS).map(([k,c])=><option key={k} value={k}>{c.emoji} {c.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>COMPRADOR / CLIENTE *</label>
              <input value={form.comprador} onChange={e=>setForm(p=>({...p,comprador:e.target.value}))} placeholder="Nombre del comprador" style={inp}/>
            </div>
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>CANAL DE VENTA</label>
              <select value={form.canal} onChange={e=>setForm(p=>({...p,canal:e.target.value}))} style={inp}>
                {CANALES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:6}}>CALIDAD</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {CALIDADES.map(c=>(
                  <button key={c.id} onClick={()=>setForm(p=>({...p,calidad:c.id}))}
                    style={{padding:"7px 14px",border:`1.5px solid ${form.calidad===c.id?c.color:"#e0e0e0"}`,borderRadius:20,background:form.calidad===c.id?c.color+"18":"transparent",color:form.calidad===c.id?c.color:"#666",cursor:"pointer",fontSize:12,fontWeight:form.calidad===c.id?700:400}}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>KG VENDIDOS *</label>
              <input type="number" step="0.1" min="0" value={form.kgVendidos} onChange={e=>setForm(p=>({...p,kgVendidos:e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>PRECIO POR KG ($) *</label>
              <input type="number" step="0.1" min="0" value={form.precioKg} onChange={e=>setForm(p=>({...p,precioKg:e.target.value}))} style={inp}/>
            </div>
            {form.kgVendidos>0&&form.precioKg>0&&(
              <div style={{gridColumn:"1/-1",background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:13,color:"#2e7d5a"}}>Total de esta venta:</span>
                <span style={{fontFamily:"'Courier New',monospace",fontSize:18,fontWeight:700,color:"#27ae60"}}>${fmt(parseFloat(form.kgVendidos)*parseFloat(form.precioKg))}</span>
              </div>
            )}
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>FECHA</label>
              <input type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>FOLIO / FACTURA</label>
              <input value={form.factura} onChange={e=>setForm(p=>({...p,factura:e.target.value}))} placeholder="Núm. factura o remisión" style={inp}/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>NOTAS</label>
              <input value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} placeholder="Condiciones de pago, observaciones..." style={inp}/>
            </div>
          </div>
          <button onClick={save} style={{padding:"9px 24px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>Guardar venta</button>
        </div>
      )}

      {!ventas.length&&(
        <div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa",border:"0.5px solid #e0e0e0"}}>
          <div style={{fontSize:40,marginBottom:8}}>💰</div>
          <div style={{fontWeight:500,marginBottom:4}}>Sin ventas registradas</div>
          <div style={{fontSize:12}}>Registra tu primera venta para ver el resumen comercial</div>
        </div>
      )}

      {/* Tabla de ventas */}
      {ventas.length>0&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{borderBottom:"1px solid #f0f0f0"}}>
                  {["Fecha","Cultivo","Lote / Tratamiento","Comprador","Canal","Calidad","Kg","$/kg","Total","Folio",""].map(h=>(
                    <th key={h} style={{padding:"7px 10px",textAlign:"left",color:"#aaa",fontWeight:500,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ventas.map(v=>{
                  const crop = CROPS[v.crop];
                  const cal = CALIDADES.find(c=>c.id===v.calidad);
                  const trat = TRATAMIENTOS.find(t=>t.id===v.tratamiento);
                  return (
                    <tr key={v.id} style={{borderBottom:"1px solid #fafafa"}}>
                      <td style={{padding:"8px 10px",fontFamily:"'Courier New',monospace",fontSize:11,color:"#999"}}>{v.fecha}</td>
                      <td style={{padding:"8px 10px"}}><span style={{color:crop?.color,fontWeight:600}}>{crop?.emoji} {v.cropName||crop?.name}</span></td>
                      <td style={{padding:"8px 10px",fontSize:11}}>
                        {v.loteName&&<div style={{fontWeight:500,color:"#555"}}>{v.loteName}</div>}
                        {trat&&<span style={{background:trat.color+"18",color:trat.color,borderRadius:8,padding:"1px 6px",fontSize:10,fontWeight:600}}>{trat.icon} {trat.label}</span>}
                      </td>
                      <td style={{padding:"8px 10px",fontWeight:500}}>{v.comprador}</td>
                      <td style={{padding:"8px 10px",color:"#888",fontSize:11}}>{v.canal}</td>
                      <td style={{padding:"8px 10px"}}><span style={{background:cal?.color+"18",color:cal?.color,borderRadius:8,padding:"1px 6px",fontSize:10,fontWeight:600}}>{cal?.icon} {cal?.label}</span></td>
                      <td style={{padding:"8px 10px",fontFamily:"'Courier New',monospace",fontWeight:700,color:"#2c3e50"}}>{v.kgVendidos}</td>
                      <td style={{padding:"8px 10px",fontFamily:"'Courier New',monospace",color:"#888"}}>${fmt(v.precioKg)}</td>
                      <td style={{padding:"8px 10px",fontFamily:"'Courier New',monospace",fontWeight:700,color:"#27ae60"}}>${fmt(v.totalVenta)}</td>
                      <td style={{padding:"8px 10px",fontSize:11,color:"#aaa"}}>{v.factura||"—"}</td>
                      <td style={{padding:"8px 10px"}}>
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={()=>{setEditing(v);setShowForm(true);window.scrollTo(0,0);}} style={{background:"#eaf4fb",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#2980b9",fontWeight:600}}>✎</button>
                          <button onClick={()=>{if(window.confirm("¿Eliminar esta venta?"))deleteDoc(doc(db,"ventas",v.id));}} style={{background:"#fdedec",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#c0392b"}}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{borderTop:"2px solid #e0e0e0",background:"#f9f9f9"}}>
                  <td colSpan={6} style={{padding:"10px",fontWeight:700,fontSize:12}}>TOTALES</td>
                  <td style={{padding:"10px",fontFamily:"'Courier New',monospace",fontWeight:700}}>{fmt(totalKg)} kg</td>
                  <td style={{padding:"10px",fontFamily:"'Courier New',monospace",color:"#888"}}>${fmt(precioPromedio)} prom.</td>
                  <td style={{padding:"10px",fontFamily:"'Courier New',monospace",fontWeight:700,color:"#27ae60",fontSize:14}}>${fmt(totalVendido)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── REPORTES DE VENTAS ───────────────────────────────────────────────────────
function ReportesVentas() {
  const [ventas, setVentas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [filterCrop, setFilterCrop] = useState("all");
  const [filterCanal, setFilterCanal] = useState("all");

  useEffect(() => {
    const q1 = query(collection(db,"ventas"), orderBy("createdAt","desc"));
    const unsub1 = onSnapshot(q1, snap => setVentas(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const q2 = query(collection(db,"lotes"), orderBy("createdAt","desc"));
    const unsub2 = onSnapshot(q2, snap => setLotes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { unsub1(); unsub2(); };
  }, []);

  const filtered = ventas.filter(v => {
    if (filterCrop !== "all" && v.crop !== filterCrop) return false;
    if (filterCanal !== "all" && v.canal !== filterCanal) return false;
    return true;
  });

  // Por cultivo
  const porCultivo = useMemo(() => {
    const map = {};
    ventas.forEach(v => {
      if (!map[v.crop]) map[v.crop] = { kg:0, total:0, ventas:0 };
      map[v.crop].kg += v.kgVendidos;
      map[v.crop].total += v.totalVenta;
      map[v.crop].ventas += 1;
    });
    return map;
  }, [ventas]);

  // Por canal
  const porCanal = useMemo(() => {
    const map = {};
    ventas.forEach(v => {
      if (!map[v.canal]) map[v.canal] = { kg:0, total:0 };
      map[v.canal].kg += v.kgVendidos;
      map[v.canal].total += v.totalVenta;
    });
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  }, [ventas]);

  // Por tratamiento
  const porTratamiento = useMemo(() => {
    const map = {};
    ventas.forEach(v => {
      const t = v.tratamiento || "sin_datos";
      if (!map[t]) map[t] = { kg:0, total:0 };
      map[t].kg += v.kgVendidos;
      map[t].total += v.totalVenta;
    });
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  }, [ventas]);

  // Por calidad
  const porCalidad = useMemo(() => {
    const map = {};
    ventas.forEach(v => {
      if (!map[v.calidad]) map[v.calidad] = { kg:0, total:0 };
      map[v.calidad].kg += v.kgVendidos;
      map[v.calidad].total += v.totalVenta;
    });
    return map;
  }, [ventas]);

  const totalGeneral = ventas.reduce((s,v)=>s+v.totalVenta,0);

  // Exportar CSV
  const exportCSV = () => {
    const h = ["Fecha","Cultivo","Lote","Tratamiento","Comprador","Canal","Calidad","Kg","$/kg","Total","Folio"];
    const rows = filtered.map(v => {
      const trat = TRATAMIENTOS.find(t=>t.id===v.tratamiento);
      const cal = CALIDADES.find(c=>c.id===v.calidad);
      return [v.fecha,v.cropName||"",v.loteName||"",trat?.label||"",v.comprador,v.canal,cal?.label||"",v.kgVendidos,v.precioKg,v.totalVenta,v.factura||""].map(x=>`"${x}"`).join(",");
    });
    const blob = new Blob(["\uFEFF",[h.join(","),...rows].join("\n")],{type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`ventas_greenlog_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <select value={filterCrop} onChange={e=>setFilterCrop(e.target.value)} style={{padding:"7px 12px",border:"1px solid #e0e0e0",borderRadius:20,fontSize:12,color:"#555",background:"#fff"}}>
          <option value="all">Todos los cultivos</option>
          {Object.entries(CROPS).map(([k,c])=><option key={k} value={k}>{c.emoji} {c.name}</option>)}
        </select>
        <select value={filterCanal} onChange={e=>setFilterCanal(e.target.value)} style={{padding:"7px 12px",border:"1px solid #e0e0e0",borderRadius:20,fontSize:12,color:"#555",background:"#fff"}}>
          <option value="all">Todos los canales</option>
          {CANALES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={exportCSV} style={{marginLeft:"auto",padding:"7px 16px",border:"1px solid #27ae60",borderRadius:20,background:"#eafaf1",color:"#27ae60",cursor:"pointer",fontSize:12,fontWeight:600}}>⬇ Exportar CSV</button>
      </div>

      {/* Por cultivo */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:16}}>
        {Object.entries(porCultivo).map(([k,data])=>{
          const crop = CROPS[k];
          const pct = totalGeneral>0 ? n(data.total/totalGeneral*100,1) : 0;
          return (
            <div key={k} style={{background:"#fff",border:`1px solid ${crop?.color}33`,borderTop:`3px solid ${crop?.color}`,borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontWeight:700,color:crop?.color,fontSize:14,marginBottom:10}}>{crop?.emoji} {crop?.name}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div style={{textAlign:"center",background:"#f9f9f9",borderRadius:8,padding:"8px"}}><div style={{fontSize:16,fontWeight:700,color:"#27ae60",fontFamily:"'Courier New',monospace"}}>${fmt(data.total)}</div><div style={{fontSize:9,color:"#aaa"}}>Ingresos</div></div>
                <div style={{textAlign:"center",background:"#f9f9f9",borderRadius:8,padding:"8px"}}><div style={{fontSize:16,fontWeight:700,color:"#2980b9",fontFamily:"'Courier New',monospace"}}>{fmt(data.kg)} kg</div><div style={{fontSize:9,color:"#aaa"}}>Volumen</div></div>
              </div>
              <div style={{marginTop:8,background:"#f0f0f0",borderRadius:3,height:5,overflow:"hidden"}}>
                <div style={{width:`${pct}%`,height:"100%",background:crop?.color,borderRadius:3}}/>
              </div>
              <div style={{fontSize:10,color:"#aaa",marginTop:3,textAlign:"right"}}>{pct}% del total</div>
            </div>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        {/* Por canal */}
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>CANAL DE VENTA</div>
          {porCanal.map(([canal,data])=>(
            <div key={canal} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f5f5f5",alignItems:"center"}}>
              <span style={{fontSize:12,color:"#555"}}>{canal}</span>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:700,color:"#27ae60"}}>${fmt(data.total)}</div>
                <div style={{fontSize:10,color:"#aaa"}}>{fmt(data.kg)} kg</div>
              </div>
            </div>
          ))}
          {!porCanal.length&&<div style={{color:"#aaa",fontSize:12,textAlign:"center",padding:"1rem"}}>Sin datos</div>}
        </div>

        {/* Por tratamiento */}
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>TIPO DE PRODUCCIÓN</div>
          {porTratamiento.map(([tratId,data])=>{
            const trat = TRATAMIENTOS.find(t=>t.id===tratId);
            return (
              <div key={tratId} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f5f5f5",alignItems:"center"}}>
                <span style={{fontSize:12,color:trat?.color||"#555",fontWeight:500}}>{trat?.icon} {trat?.label||tratId}</span>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:700,color:"#27ae60"}}>${fmt(data.total)}</div>
                  <div style={{fontSize:10,color:"#aaa"}}>{fmt(data.kg)} kg</div>
                </div>
              </div>
            );
          })}
          {!porTratamiento.length&&<div style={{color:"#aaa",fontSize:12,textAlign:"center",padding:"1rem"}}>Sin datos</div>}
        </div>
      </div>

      {/* Por calidad */}
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>DISTRIBUCIÓN POR CALIDAD</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
          {CALIDADES.map(cal=>{
            const data = porCalidad[cal.id] || {kg:0,total:0};
            const pct = ventas.reduce((s,v)=>s+v.kgVendidos,0)>0 ? n(data.kg/ventas.reduce((s,v)=>s+v.kgVendidos,0)*100,1) : 0;
            return (
              <div key={cal.id} style={{background:cal.color+"0d",border:`1px solid ${cal.color}33`,borderRadius:10,padding:"10px",textAlign:"center"}}>
                <div style={{fontSize:18}}>{cal.icon}</div>
                <div style={{fontWeight:700,fontSize:13,color:cal.color}}>{cal.label}</div>
                <div style={{fontFamily:"'Courier New',monospace",fontSize:14,fontWeight:700,color:"#2c3e50",marginTop:4}}>{fmt(data.kg)} kg</div>
                <div style={{fontSize:11,color:"#27ae60",fontWeight:600}}>${fmt(data.total)}</div>
                <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{pct}% del volumen</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lotes con balance */}
      {lotes.length>0&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>BALANCE POR LOTE</div>
          {lotes.map(lote=>{
            const crop=CROPS[lote.crop];
            const trat=TRATAMIENTOS.find(t=>t.id===lote.tratamiento);
            const ventasLote=ventas.filter(v=>v.loteId===lote.id);
            const kgVendido=ventasLote.reduce((s,v)=>s+v.kgVendidos,0);
            const ingresos=ventasLote.reduce((s,v)=>s+v.totalVenta,0);
            const kgDisp=lote.kgCosechados-kgVendido;
            return(
              <div key={lote.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #f5f5f5",flexWrap:"wrap"}}>
                <span style={{fontSize:18}}>{crop?.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13}}>{lote.nombre}</div>
                  <div style={{fontSize:11,color:trat?.color,fontWeight:500}}>{trat?.icon} {trat?.label}</div>
                </div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                  <div style={{textAlign:"center"}}><div style={{fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:700,color:"#27ae60"}}>{fmt(kgVendido)} kg</div><div style={{fontSize:9,color:"#aaa"}}>Vendido</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:700,color:kgDisp>0?"#f39c12":"#aaa"}}>{fmt(kgDisp)} kg</div><div style={{fontSize:9,color:"#aaa"}}>Disponible</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:700,color:"#2c3e50"}}>${fmt(ingresos)}</div><div style={{fontSize:9,color:"#aaa"}}>Ingresos</div></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cosechas registradas por trabajadores */}
      <CosechasAdmin/>
    </div>
  );
}

// ─── COSECHAS ADMIN ──────────────────────────────────────────────────────────
function CosechasAdmin() {
  const [cosechas, setCosechas] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const CROPS_C = {jitomate:{name:"Jitomate",emoji:"🍅"},fresa:{name:"Fresa",emoji:"🍓"},arandano:{name:"Arándano",emoji:"🫐"},zarzamora:{name:"Zarzamora",emoji:"🫐"}};
  const CALIDADES_C = [{id:"primera",label:"Primera",color:"#27ae60"},{id:"segunda",label:"Segunda",color:"#f39c12"},{id:"tercera",label:"Tercera",color:"#e67e22"},{id:"descarte",label:"Descarte",color:"#e74c3c"}];
  const inp = INP;

  useEffect(()=>{
    const q = query(collection(db,"cosechas_trabajador"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap=>setCosechas(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>unsub();
  },[]);

  const saveEdit = async () => {
    await updateDoc(doc(db,"cosechas_trabajador",editing), {
      kgCosechados: parseFloat(editForm.kgCosechados)||0,
      calidad: editForm.calidad,
      notas: editForm.notas||"",
      updatedAt: new Date().toISOString(),
    });
    setEditing(null);
  };

  if (!cosechas.length) return null;

  return (
    <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px",marginTop:12}}>
      <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>COSECHAS REGISTRADAS POR TRABAJADORES</div>
      {cosechas.map(c=>{
        const crop=CROPS_C[c.crop];
        const cal=CALIDADES_C.find(x=>x.id===c.calidad);
        const isEdit=editing===c.id;
        return (
          <div key={c.id} style={{borderBottom:"1px solid #f5f5f5",padding:"10px 0"}}>
            {!isEdit?(
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span style={{fontSize:18}}>{crop?.emoji||"🌱"}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13}}>{c.loteName||"Sin lote"} <span style={{color:"#888",fontWeight:400,fontSize:11}}>· {c.worker}</span></div>
                  <div style={{fontSize:11,color:"#aaa"}}>{c.date} {c.time}</div>
                </div>
                <span style={{fontFamily:"'Courier New',monospace",fontWeight:700,color:"#27ae60",fontSize:14}}>{c.kgCosechados} kg</span>
                <span style={{background:cal?.color+"18",color:cal?.color,border:`1px solid ${cal?.color}44`,borderRadius:8,padding:"1px 8px",fontSize:11,fontWeight:600}}>{cal?.label}</span>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{setEditing(c.id);setEditForm({kgCosechados:c.kgCosechados,calidad:c.calidad,notas:c.notas||""});}} style={{background:"#eaf4fb",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#2980b9",fontWeight:600}}>✎</button>
                  <button onClick={()=>{if(window.confirm("¿Eliminar este registro?"))deleteDoc(doc(db,"cosechas_trabajador",c.id));}} style={{background:"#fdedec",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#c0392b"}}>✕</button>
                </div>
              </div>
            ):(
              <div style={{background:"#f9fff9",border:"1px solid #a9dfbf",borderRadius:10,padding:"12px"}}>
                <div style={{fontSize:11,color:"#27ae60",fontWeight:700,marginBottom:8}}>✎ Editando cosecha de {c.worker} — {c.date}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>KG COSECHADOS</label>
                    <input type="number" step="0.1" min="0" value={editForm.kgCosechados} onChange={e=>setEditForm(p=>({...p,kgCosechados:e.target.value}))} style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>CALIDAD</label>
                    <select value={editForm.calidad} onChange={e=>setEditForm(p=>({...p,calidad:e.target.value}))} style={inp}>
                      {CALIDADES_C.map(q=><option key={q.id} value={q.id}>{q.label}</option>)}
                    </select>
                  </div>
                  <div style={{gridColumn:"1/-1"}}>
                    <label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>NOTAS</label>
                    <input value={editForm.notas} onChange={e=>setEditForm(p=>({...p,notas:e.target.value}))} style={inp}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveEdit} style={{padding:"7px 18px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:12}}>Guardar</button>
                  <button onClick={()=>setEditing(null)} style={{padding:"7px 14px",border:"1px solid #e0e0e0",borderRadius:8,background:"transparent",color:"#888",cursor:"pointer",fontSize:12}}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ─── VALIDACIONES ADMIN ───────────────────────────────────────────────────────
function ValidacionesAdmin() {
  const [validaciones, setValidaciones] = useState([]);
  const [filterCrop, setFilterCrop] = useState("all");

  useEffect(()=>{
    const q = query(collection(db,"validaciones_tratamiento"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap=>setValidaciones(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>unsub();
  },[]);

  const filtered = filterCrop==="all" ? validaciones : validaciones.filter(v=>v.crop===filterCrop);
  const totalKg = filtered.reduce((s,v)=>s+(v.kgValidados||0),0);
  const totalValor = filtered.reduce((s,v)=>s+((v.kgValidados||0)*(v.precioVenta||0)),0);

  return (
    <div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:16}}>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:20}}>🏷️</div>
          <div style={{fontSize:24,fontWeight:700,color:"#2980b9",fontFamily:"'Courier New',monospace",marginTop:4}}>{filtered.length}</div>
          <div style={{fontSize:11,color:"#888",marginTop:2}}>Validaciones</div>
        </div>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:20}}>⚖️</div>
          <div style={{fontSize:24,fontWeight:700,color:"#27ae60",fontFamily:"'Courier New',monospace",marginTop:4}}>{totalKg.toFixed(1)} kg</div>
          <div style={{fontSize:11,color:"#888",marginTop:2}}>Kg validados</div>
        </div>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:20}}>💰</div>
          <div style={{fontSize:24,fontWeight:700,color:"#8e44ad",fontFamily:"'Courier New',monospace",marginTop:4}}>${totalValor.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div style={{fontSize:11,color:"#888",marginTop:2}}>Valor estimado</div>
        </div>
      </div>

      {/* Filtro */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["all","Todos"],["jitomate","🍅 Jitomate"],["fresa","🍓 Fresa"],["arandano","🫐 Arándano"],["zarzamora","🫐 Zarzamora"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilterCrop(k)}
            style={{padding:"6px 14px",border:`1px solid ${filterCrop===k?"#2980b9":"#e0e0e0"}`,borderRadius:20,background:filterCrop===k?"#eaf4fb":"#fff",color:filterCrop===k?"#2980b9":"#666",cursor:"pointer",fontSize:12,fontWeight:filterCrop===k?700:400}}>
            {l}
          </button>
        ))}
      </div>

      {!filtered.length&&(
        <div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa",border:"0.5px solid #e0e0e0"}}>
          <div style={{fontSize:40,marginBottom:8}}>🏷️</div>
          <div style={{fontWeight:500,marginBottom:4}}>Sin validaciones aún</div>
          <div style={{fontSize:12}}>Los trabajadores confirman tratamientos desde su app</div>
        </div>
      )}

      {/* Tarjetas de validación */}
      {filtered.map(v=>{
        const crop = CROPS[v.crop];
        return (
          <div key={v.id} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderLeft:"4px solid #2980b9",borderRadius:12,padding:"14px 18px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              {/* Etiqueta visual */}
              <div style={{background:"#eaf4fb",border:"2px solid #2980b9",borderRadius:10,padding:"10px 14px",textAlign:"center",minWidth:110,flexShrink:0}}>
                <div style={{fontSize:22}}>{crop?.emoji||"🌱"}</div>
                <div style={{fontWeight:700,fontSize:12,color:crop?.color||"#333",marginBottom:3}}>{crop?.name||v.crop}</div>
                <div style={{background:"#2980b9",color:"#fff",borderRadius:12,padding:"2px 10px",fontWeight:700,fontSize:11}}>{v.etiquetaTratamiento||"—"}</div>
              </div>

              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,fontSize:14}}>{v.loteName||"Sin lote"}</span>
                  {v.tratamientoBase&&<span style={{background:"#f0f0f0",color:"#666",borderRadius:8,padding:"1px 8px",fontSize:11}}>{v.tratamientoBase}</span>}
                </div>

                <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:4}}>
                  <div style={{textAlign:"center",background:"#f9f9f9",borderRadius:8,padding:"6px 12px"}}>
                    <div style={{fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:16,color:"#27ae60"}}>{v.kgValidados} kg</div>
                    <div style={{fontSize:9,color:"#aaa"}}>Kg validados</div>
                  </div>
                  {v.precioVenta>0&&(
                    <div style={{textAlign:"center",background:"#f9f9f9",borderRadius:8,padding:"6px 12px"}}>
                      <div style={{fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:16,color:"#8e44ad"}}>${v.precioVenta}/kg</div>
                      <div style={{fontSize:9,color:"#aaa"}}>Precio venta</div>
                    </div>
                  )}
                  {v.kgValidados>0&&v.precioVenta>0&&(
                    <div style={{textAlign:"center",background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:8,padding:"6px 12px"}}>
                      <div style={{fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:16,color:"#27ae60"}}>${(v.kgValidados*v.precioVenta).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                      <div style={{fontSize:9,color:"#aaa"}}>Total</div>
                    </div>
                  )}
                </div>

                {v.observaciones&&<div style={{fontSize:12,color:"#888",marginBottom:3}}>📝 {v.observaciones}</div>}
                <div style={{fontSize:11,color:"#bbb"}}>
                  <span>📍 {v.zona||"—"}</span>
                  <span style={{marginLeft:10}}>👤 {v.worker}</span>
                  <span style={{marginLeft:10}}>📅 {v.date} {v.time}</span>
                </div>
              </div>

              <button onClick={()=>{if(window.confirm("¿Eliminar esta validación?"))deleteDoc(doc(db,"validaciones_tratamiento",v.id));}}
                style={{background:"#fdedec",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#c0392b",flexShrink:0}}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const SUBTABS = [
  { id:"reportes", label:"📊 Reportes"  },
  { id:"lotes",    label:"📦 Lotes"     },
  { id:"ventas",   label:"📋 Historial" },
  { id:"precios",  label:"🏷️ Precios"   },
  { id:"validaciones", label:"✅ Validaciones" },
];

export default function Ventas() {
  const [tab, setTab] = useState("reportes");
  return (
    <div className="ventas-module">
      {/* Force light mode on all inputs in this module */}
      <style>{`
        .ventas-module input,
        .ventas-module select,
        .ventas-module textarea {
          color: #111 !important;
          background-color: #ffffff !important;
          -webkit-text-fill-color: #111 !important;
          color-scheme: light !important;
          border-color: #ccc !important;
        }
        .ventas-module input::placeholder,
        .ventas-module textarea::placeholder {
          color: #aaa !important;
          -webkit-text-fill-color: #aaa !important;
        }
      `}</style>
      <div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#2e7d5a"}}>
        📱 Los trabajadores registran ventas y cosechas desde su app · Tú ves los reportes aquí
      </div>
      <div style={{display:"flex",gap:4,marginBottom:16,background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:4}}>
        {SUBTABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"9px 8px",border:"none",borderRadius:8,background:tab===t.id?"#1a2533":"transparent",color:tab===t.id?"#4ecb8d":"#888",cursor:"pointer",fontSize:13,fontWeight:tab===t.id?700:400,transition:"all 0.15s"}}>
            {t.label}
          </button>
        ))}
      </div>
      {tab==="reportes" && <ReportesVentas/>}
      {tab==="lotes"    && <GestionLotes/>}
      {tab==="ventas"   && <RegistroVentas/>}
      {tab==="precios"  && <PreciosCalidad/>}
      {tab==="validaciones" && <ValidacionesAdmin/>}
    </div>
  );
}
