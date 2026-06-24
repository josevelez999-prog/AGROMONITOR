import { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
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
    {id:"merma_venta",label:"Descarte ✕",color:"#e74c3c"},
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
  { id:"primera", label:"Primera", color:"#27ae60", icon:"⭐" },
  { id:"segunda", label:"Segunda", color:"#f39c12", icon:"⚡" },
  { id:"tercera", label:"Tercera", color:"#e67e22", icon:"▲"  },
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
  const [ventasLote, setVentasLote] = useState([]);
  const [cosechasLote, setCosechasLote] = useState([]);
  const [mermasLote, setMermasLote] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nombre:"", crop:"jitomate", zona:"", tratamiento:"convencional",
    fechaCosecha:new Date().toISOString().slice(0,10),
    kgCosechados:0, kgEstimados:0, costoCiclo:0, notas:""
  });
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    const q = query(collection(db,"lotes"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap => setLotes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2 = onSnapshot(query(collection(db,"ventas")), s=>setVentasLote(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u3 = onSnapshot(query(collection(db,"cosechas_trabajador")), s=>setCosechasLote(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u4 = onSnapshot(query(collection(db,"mermas")), s=>setMermasLote(s.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { unsub(); u2(); u3(); u4(); };
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
    setForm({ nombre:"", crop:"jitomate", zona:"", tratamiento:"convencional", fechaCosecha:new Date().toISOString().slice(0,10), kgCosechados:0, kgEstimados:0, costoCiclo:0, notas:"" });
    setShowForm(false);
  };

  const inp = INP;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:12,color:"#888"}}>Lotes registrados: <strong style={{color:"#333"}}>{lotes.length}</strong></div>
        <button onClick={()=>{setShowForm(!showForm);setEditing(null);}}
          style={{padding:"9px 20px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>
          {showForm?"✕ Cancelar":"+ Nuevo lote"}
        </button>
      </div>

      {showForm&&(
        <div style={{background:"#fff",border:"1px solid #a9dfbf",borderRadius:12,padding:18,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14,letterSpacing:0.3}}>{editing?"EDITAR LOTE":"NUEVO LOTE"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Nombre *</label><input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Bloque A-1" style={inp}/></div>
            <div><label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Zona *</label><input value={form.zona} onChange={e=>setForm(p=>({...p,zona:e.target.value}))} placeholder="Zona A" style={inp}/></div>
            <div>
              <label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Cultivo</label>
              <select value={form.crop} onChange={e=>setForm(p=>({...p,crop:e.target.value}))} style={inp}>
                {Object.entries(CROPS).map(([k,c])=><option key={k} value={k}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Tipo de producción</label>
              <select value={form.tratamiento} onChange={e=>setForm(p=>({...p,tratamiento:e.target.value}))} style={inp}>
                {TRATAMIENTOS.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div><label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Kg cosechados</label><input type="number" step="0.1" min="0" value={form.kgCosechados} onChange={e=>setForm(p=>({...p,kgCosechados:e.target.value}))} style={inp}/></div>
            <div><label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Kg estimados</label><input type="number" step="0.1" min="0" value={form.kgEstimados} onChange={e=>setForm(p=>({...p,kgEstimados:e.target.value}))} style={inp}/></div>
            <div><label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>💰 Costo del ciclo $</label><input type="number" step="0.01" min="0" value={form.costoCiclo||0} onChange={e=>setForm(p=>({...p,costoCiclo:e.target.value}))} placeholder="Costo total $" style={inp}/></div>
            <div><label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Fecha cosecha</label><input type="date" value={form.fechaCosecha} onChange={e=>setForm(p=>({...p,fechaCosecha:e.target.value}))} style={inp}/></div>
            <div><label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Notas</label><input value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} placeholder="Observaciones..." style={inp}/></div>
          </div>
          <button onClick={save} disabled={saving}
            style={{padding:"9px 24px",background:saving?"#aaa":"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:saving?"not-allowed":"pointer",fontWeight:600,fontSize:13}}>
            {saving?"Guardando...":(editing?"Guardar cambios":"+ Crear lote")}
          </button>
        </div>
      )}

      {!lotes.length&&(
        <div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa",border:"0.5px solid #e0e0e0"}}>
          <div style={{fontSize:40,marginBottom:8}}>📦</div>
          <div style={{fontWeight:500,marginBottom:4}}>Sin lotes de producción</div>
          <div style={{fontSize:12}}>Crea un lote para registrar cosechas y ventas</div>
        </div>
      )}

      {lotes.map(lote=>{
        const crop=CROPS[lote.crop];
        const trat=TRATAMIENTOS.find(t=>t.id===lote.tratamiento);
        const eficiencia=lote.kgEstimados>0?((lote.kgCosechados/lote.kgEstimados)*100).toFixed(1):null;
        const kgVend = (ventasLote||[]).filter(x=>x.loteId===lote.id).reduce((s,x)=>s+(parseFloat(x.kgVendidos)||0),0);
        const kgCosTrab = (cosechasLote||[]).filter(x=>x.loteId===lote.id).reduce((s,x)=>s+(parseFloat(x.kgCosechados)||0),0);
        const kgCos = kgCosTrab > 0 ? kgCosTrab : (parseFloat(lote.kgCosechados)||0);
        const kgMerm = (mermasLote||[]).filter(x=>x.loteId===lote.id).reduce((s,x)=>s+(parseFloat(x.kgMerma)||0),0);
        const kgDisp = Math.max(0, kgCos - kgVend);
        const pctVend = kgCos>0 ? Math.min((kgVend/kgCos)*100,100) : 0; // merma se muestra aparte
        return(
          <div key={lote.id} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderTop:`3px solid ${crop?.color||"#27ae60"}`,borderRadius:12,padding:"14px 18px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:24}}>{crop?.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:3}}>{lote.nombre}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{background:(trat?.color||"#888")+"18",color:trat?.color||"#888",border:`1px solid ${trat?.color||"#888"}44`,borderRadius:10,padding:"1px 8px",fontSize:11,fontWeight:600}}>{trat?.icon} {trat?.label}</span>
                  <span style={{fontSize:12,color:"#888"}}>📍 {lote.zona}</span>
                  <span style={{fontSize:12,color:"#888"}}>📅 {lote.fechaCosecha}</span>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                  <div style={{textAlign:"center",background:"#f0faf5",borderRadius:8,padding:"5px 10px"}}>
                    <div style={{fontFamily:"'Courier New',monospace",fontSize:13,fontWeight:700,color:"#27ae60"}}>{kgCos.toFixed(1)} kg</div>
                    <div style={{fontSize:9,color:"#aaa"}}>Cosechados</div>
                  </div>
                  <div style={{textAlign:"center",background:"#f5eef8",borderRadius:8,padding:"5px 10px",border:"1px solid #8e44ad33"}}>
                    <div style={{fontFamily:"'Courier New',monospace",fontSize:13,fontWeight:700,color:"#8e44ad"}}>{(kgCos+kgMerm).toFixed(1)} kg</div>
                    <div style={{fontSize:9,color:"#8e44ad",fontWeight:600}}>Producción Total</div>
                  </div>
                  <div style={{textAlign:"center",background:"#eaf4fb",borderRadius:8,padding:"5px 10px"}}>
                    <div style={{fontFamily:"'Courier New',monospace",fontSize:13,fontWeight:700,color:"#2980b9"}}>{kgVend.toFixed(1)} kg</div>
                    <div style={{fontSize:9,color:"#aaa"}}>Vendidos</div>
                  </div>
                  {kgMerm>0&&<div style={{textAlign:"center",background:"#fef9e7",borderRadius:8,padding:"5px 10px"}}>
                    <div style={{fontFamily:"'Courier New',monospace",fontSize:13,fontWeight:700,color:"#f39c12"}}>{kgMerm.toFixed(1)} kg</div>
                    <div style={{fontSize:9,color:"#aaa"}}>Merma</div>
                  </div>}
                  <div style={{textAlign:"center",background:kgDisp>0?"#fff3cd":"#eafaf1",border:`2px solid ${kgDisp>0?"#f39c12":"#a9dfbf"}`,borderRadius:8,padding:"5px 10px"}}>
                    <div style={{fontFamily:"'Courier New',monospace",fontSize:13,fontWeight:700,color:kgDisp>0?"#f39c12":"#27ae60"}}>{kgDisp.toFixed(2)} kg</div>
                    <div style={{fontSize:9,color:kgDisp>0?"#856404":"#27ae60",fontWeight:600}}>Por vender</div>
                  </div>
                </div>
                <div style={{background:"#e0e0e0",borderRadius:3,height:5,overflow:"hidden",marginBottom:3}}>
                  <div style={{width:`${pctVend}%`,height:"100%",background:CROPS[lote.crop]?.color||"#27ae60",borderRadius:3}}/>
                </div>
                <div style={{fontSize:10,color:"#aaa"}}>{pctVend.toFixed(1)}% comercializado</div>
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

  useEffect(()=>{
    const u1 = onSnapshot(query(collection(db,"ventas")), s=>setVentas(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u2 = onSnapshot(query(collection(db,"cosechas_trabajador")), s=>setCosechas(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u3 = onSnapshot(query(collection(db,"mermas")), s=>setMermas(s.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();};
  },[]);

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

// ─── INTELIGENCIA DE MERCADO (Claude AI + Web Search) ────────────────────────
function MonitorPrecios({ precioPromedioPropio = {} }) {
  const [iaData, setIaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manualPrices, setManualPrices] = useState({});
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "ia_prices"), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setIaData(data);
        setManualPrices(data.prices || {});
      }
    });
    return () => unsub();
  }, []);

  const fetchIA = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/preciosIA");
      const data = await resp.json();
      if (data.success && Object.keys(data.prices).length > 0) {
        await setDoc(doc(db, "config", "ia_prices"), {
          prices:  data.prices,
          fuentes: data.fuentes || [],
          resumen: data.resumen || "",
          timestamp: data.timestamp,
          source: data.source,
          updatedBy: "auto",
        });
        alert("✓ Inteligencia de Mercado actualizada");
      } else {
        alert(`⚠ ${data.message || "Sin datos hoy"}. Captura manualmente si lo deseas.`);
        setEditMode(true);
      }
    } catch (e) {
      alert("Error: " + e.message);
      setEditMode(true);
    }
    setLoading(false);
  };

  const saveManual = async () => {
    try {
      await setDoc(doc(db, "config", "ia_prices"), {
        prices: manualPrices,
        fuentes: iaData?.fuentes || [],
        resumen: iaData?.resumen || "",
        timestamp: new Date().toISOString(),
        source: "Captura manual",
        updatedBy: "admin",
      });
      setEditMode(false);
      alert("✓ Precios guardados");
    } catch (e) { alert("Error: " + e.message); }
  };

  const updateManual = (crop, field, val) => {
    const value = parseFloat(val) || 0;
    setManualPrices(p => ({
      ...p,
      [crop]: { ...(p[crop] || {}), [field]: value },
    }));
  };

  const prices = iaData?.prices || {};
  const fuentes = iaData?.fuentes || [];
  const resumen = iaData?.resumen || "";
  const lastUpdate = iaData?.timestamp;
  const isStale = lastUpdate && (Date.now() - new Date(lastUpdate).getTime()) > 2 * 86400000;

  const tipoIcon = { noticia:"📰", gobierno:"🏛", supermercado:"🛒", mercado:"🏪", reporte:"📊" };

  return (
    <div style={{marginBottom:16}}>
      <div style={{background:"#fff",border:"2px solid #8e44ad33",borderRadius:12,padding:"16px 18px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"#8e44ad"}}>📈 Inteligencia de Mercado</div>
            <div style={{fontSize:11,color:"#888",marginTop:2}}>
              {lastUpdate ? (
                <>Última consulta: {new Date(lastUpdate).toLocaleString("es-MX",{day:"2-digit",month:"short",year:"2-digit",hour:"2-digit",minute:"2-digit"})}
                {isStale && <span style={{color:"#e74c3c",fontWeight:600,marginLeft:8}}>⚠ Datos antiguos</span>}</>
              ) : (
                "Pulsa \"Actualizar\" para consultar precios actuales en Michoacán"
              )}
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={fetchIA} disabled={loading}
              style={{padding:"8px 16px",border:"1px solid #8e44ad",borderRadius:20,background:loading?"#f5eef8":"#8e44ad",color:loading?"#8e44ad":"#fff",cursor:loading?"wait":"pointer",fontSize:12,fontWeight:700}}>
              {loading ? "⏳ Consultando IA..." : "🔄 Actualizar"}
            </button>
            <button onClick={()=>setEditMode(!editMode)}
              style={{padding:"8px 14px",border:"1px solid #8e44ad",borderRadius:20,background:editMode?"#f5eef8":"transparent",color:"#8e44ad",cursor:"pointer",fontSize:12,fontWeight:600}}>
              {editMode ? "✓ Listo" : "✎"}
            </button>
            {editMode && <button onClick={saveManual}
              style={{padding:"8px 16px",border:"none",borderRadius:20,background:"#27ae60",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>💾 Guardar</button>}
          </div>
        </div>

        {/* Resumen */}
        {resumen && !editMode && (
          <div style={{background:"#f5eef8",border:"1px solid #d2b4de",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#5b2c6f",lineHeight:1.5}}>
            💬 <strong>Análisis:</strong> {resumen}
          </div>
        )}

        {/* Tarjetas de precios */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginBottom:12}}>
          {Object.entries(CROPS).map(([k,c]) => {
            const p = prices[k] || manualPrices[k] || {};
            const tiene = p.min || p.max || p.prom;
            const propio = precioPromedioPropio[k] || 0;
            const diff = propio && p.prom ? ((propio - p.prom) / p.prom) * 100 : null;

            return (
              <div key={k} style={{background:"#fafafa",borderRadius:10,padding:"12px 14px",border:`1px solid ${c.color}33`,borderLeft:`4px solid ${c.color}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:20}}>{c.emoji}</span>
                  <span style={{fontWeight:700,fontSize:14,color:c.color,flex:1}}>{c.name}</span>
                  {!editMode && p.cobertura && (
                    <span style={{fontSize:9,padding:"2px 6px",borderRadius:6,background:"#fff",color:"#888",fontWeight:600,textTransform:"uppercase"}}>{p.cobertura}</span>
                  )}
                </div>
                {editMode ? (
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                    {["min","prom","max"].map(field => (
                      <div key={field}>
                        <div style={{fontSize:9,color:"#888",marginBottom:2,textTransform:"uppercase",textAlign:"center"}}>{field}</div>
                        <input type="number" step="0.01" min="0"
                          value={manualPrices[k]?.[field] ?? ""}
                          onChange={e=>updateManual(k, field, e.target.value)}
                          placeholder="$/kg"
                          style={{width:"100%",padding:"5px 7px",border:"1px solid #ddd",borderRadius:6,fontSize:12,boxSizing:"border-box",background:"#fff",color:"#111",fontFamily:"'Courier New',monospace",textAlign:"center"}}/>
                      </div>
                    ))}
                  </div>
                ) : tiene ? (
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginBottom:6}}>
                      <div style={{textAlign:"center",background:"#fff",borderRadius:6,padding:"4px 2px"}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#27ae60",fontFamily:"'Courier New',monospace"}}>${(p.min||0).toFixed(2)}</div>
                        <div style={{fontSize:9,color:"#aaa"}}>Min</div>
                      </div>
                      <div style={{textAlign:"center",background:c.color+"15",borderRadius:6,padding:"4px 2px"}}>
                        <div style={{fontSize:14,fontWeight:700,color:c.color,fontFamily:"'Courier New',monospace"}}>${(p.prom||0).toFixed(2)}</div>
                        <div style={{fontSize:9,color:"#aaa"}}>Prom</div>
                      </div>
                      <div style={{textAlign:"center",background:"#fff",borderRadius:6,padding:"4px 2px"}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#e74c3c",fontFamily:"'Courier New',monospace"}}>${(p.max||0).toFixed(2)}</div>
                        <div style={{fontSize:9,color:"#aaa"}}>Max</div>
                      </div>
                    </div>
                    {propio > 0 && (
                      <div style={{paddingTop:6,borderTop:"1px dashed #ddd",fontSize:11,color:"#666",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span>Tu precio: <strong style={{color:"#222",fontFamily:"'Courier New',monospace"}}>${propio.toFixed(2)}</strong></span>
                        {diff !== null && (
                          <span style={{padding:"2px 8px",borderRadius:6,background:diff>=0?"#eafaf1":"#fdedec",color:diff>=0?"#27ae60":"#c0392b",fontWeight:700,fontSize:11}}>
                            {diff >= 0 ? "+" : ""}{diff.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{textAlign:"center",padding:"10px 0",color:"#aaa",fontSize:11}}>Sin datos</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Cuadro de fuentes consultadas */}
        {fuentes.length > 0 && !editMode && (
          <div style={{background:"#fafafa",border:"1px solid #e0e0e0",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#666",marginBottom:8,letterSpacing:0.3}}>
              🔎 FUENTES CONSULTADAS ({fuentes.length})
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:6}}>
              {fuentes.map((f, i) => (
                <div key={i} style={{background:"#fff",borderRadius:6,padding:"6px 10px",border:"1px solid #eee",fontSize:11,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14}}>{tipoIcon[f.tipo] || "🔗"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,color:"#222",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f.nombre}</div>
                    {f.fecha && <div style={{fontSize:9,color:"#888"}}>{f.fecha}</div>}
                  </div>
                  {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" style={{color:"#8e44ad",fontSize:10,fontWeight:600,textDecoration:"none",flexShrink:0}}>Ver →</a>}
                </div>
              ))}
            </div>
          </div>
        )}

        {!iaData && (
          <div style={{padding:"10px 14px",background:"#fef9e7",border:"1px solid #f9e79f",borderRadius:8,fontSize:11,color:"#856404"}}>
            💡 Pulsa <strong>🔄 Actualizar</strong> para que Claude consulte SNIIM, PROFECO, Central de Abastos y noticias agrícolas recientes. Sintetiza precios para Michoacán y muestra las fuentes que usó.
          </div>
        )}
      </div>
    </div>
  );
}

function ReportesVentas() {
  const [ventas, setVentas] = useState([]);
  const [cosechas, setCosechas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [mermasData, setMermasData] = useState([]);
  const [siniestrosData, setSiniestrosData] = useState([]);
  const [filterCrop, setFilterCrop] = useState("all");
  const [filterInv, setFilterInv] = useState("all");
  const [filterPeriodo, setFilterPeriodo] = useState("todo");

  useEffect(() => {
    const q1 = query(collection(db,"ventas"), orderBy("createdAt","desc"));
    const unsub1 = onSnapshot(q1, snap => setVentas(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const q2 = query(collection(db,"lotes"), orderBy("createdAt","desc"));
    const unsub2 = onSnapshot(q2, snap => setLotes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const q3 = query(collection(db,"cosechas_trabajador"), orderBy("createdAt","desc"));
    const unsubS = onSnapshot(query(collection(db,"siniestros")), s=>setSiniestrosData(s.docs.map(d=>({id:d.id,...d.data()}))));
    const unsub3 = onSnapshot(q3, snap => setCosechas(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const q4 = query(collection(db,"mermas"), orderBy("createdAt","desc"));
    const unsub4 = onSnapshot(q4, snap => setMermasData(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsubS(); };
  }, []);

  // Filtro por periodo
  const now = new Date();
  const filtrarPeriodo = (arr, campo="createdAt") => {
    if (filterPeriodo === "todo") return arr;
    const dias = filterPeriodo === "7d" ? 7 : filterPeriodo === "30d" ? 30 : 90;
    const desde = new Date(now - dias * 86400000).toISOString();
    return arr.filter(x => (x[campo]||"") >= desde);
  };

  // Lista dinámica de invernaderos según lotes existentes
  const invernaderosDisponibles = useMemo(()=>{
    const set = new Set();
    (lotes||[]).forEach(l => { if(l.zona) set.add(l.zona); });
    return ["all", ...Array.from(set).sort()];
  }, [lotes]);

  // Set de loteIds que coinciden con el invernadero filtrado
  const loteIdsFiltrados = useMemo(()=>{
    if(filterInv==="all") return null;
    return new Set((lotes||[]).filter(l=>l.zona===filterInv).map(l=>l.id));
  }, [lotes, filterInv]);

  const matchInv = (item) => {
    if(!loteIdsFiltrados) return true;
    // 1) Primero por loteId (más confiable)
    if(item.loteId && loteIdsFiltrados.has(item.loteId)) return true;
    // 2) Si el registro tiene zona o invernadero guardada, comparar directo (registros nuevos)
    if((item.zona && item.zona===filterInv) || (item.invernadero && item.invernadero===filterInv)) return true;
    return false;
  };

  const ventasFilt = filtrarPeriodo(ventas).filter(v => (filterCrop === "all" || v.crop === filterCrop) && matchInv(v));
  const cosechasFilt = filtrarPeriodo(cosechas).filter(c => (filterCrop === "all" || c.crop === filterCrop) && matchInv(c));
  const siniestrosFilt = filtrarPeriodo(siniestrosData).filter(s => (filterCrop === "all" || s.crop === filterCrop) && matchInv(s));

  // ── KPIs globales ──
  const totalIngresos = ventasFilt.reduce((s,v)=>s+(v.totalVenta||0),0) + siniestrosFilt.reduce((s,sn)=>s+(parseFloat(sn.montoSeguro)||0),0);
  const totalKgVendidos = ventasFilt.reduce((s,v)=>s+v.kgVendidos,0);
  const totalKgCosechados = useMemo(()=>{
    // Para cada lote filtrado: usar suma de cosechas trabajador si existen, sino lote.kgCosechados
    const lotesFiltrados = (lotes||[]).filter(l=>
      (filterCrop==="all"||l.crop===filterCrop) &&
      (filterInv==="all"||l.zona===filterInv)
    );
    let total = 0;
    const loteIdsConCosecha = new Set();
    // Sumar cosechas de trabajadores por lote (evita doble conteo)
    cosechasFilt.forEach(c=>{
      if(c.loteId && lotesFiltrados.find(l=>l.id===c.loteId)){
        total += parseFloat(c.kgCosechados)||0;
        loteIdsConCosecha.add(c.loteId);
      }
    });
    // Para lotes SIN cosecha de trabajador, usar el kg manual del lote
    lotesFiltrados.forEach(l=>{
      if(!loteIdsConCosecha.has(l.id)){
        total += parseFloat(l.kgCosechados)||0;
      }
    });
    return total;
  },[cosechasFilt,lotes,filterCrop,filterInv]);
  const totalMerma = filtrarPeriodo(mermasData).filter(m=>(filterCrop==="all"||m.crop===filterCrop)&&matchInv(m)).reduce((s,m)=>s+(parseFloat(m.kgMerma)||0),0);
  const totalSiniestro = siniestrosFilt.reduce((s,sn)=>s+(parseFloat(sn.kgSiniestro)||0),0);
  const totalMontoSeguro = siniestrosFilt.reduce((s,sn)=>s+(parseFloat(sn.montoSeguro)||0),0);
  const precioPromedio = totalKgVendidos > 0 ? totalIngresos/totalKgVendidos : 0;
  const eficiencia = totalKgCosechados > 0 ? Math.min((totalKgVendidos/totalKgCosechados)*100, 100) : 0;
  const kgStock = Math.max(0, totalKgCosechados - totalKgVendidos);
  const pctStock = totalKgCosechados > 0 ? (kgStock/totalKgCosechados)*100 : 0;

  // ── Por cultivo — ventas ──
  const porCultivoV = useMemo(() => {
    const map = {};
    ventasFilt.forEach(v => {
      if (!map[v.crop]) map[v.crop] = { kg:0, total:0, ventas:0 };
      map[v.crop].kg += v.kgVendidos;
      map[v.crop].total += v.totalVenta;
      map[v.crop].ventas++;
    });
    return map;
  }, [ventasFilt]);

  // ── Por cultivo — cosechas ──
  const porCultivoC = useMemo(() => {
    const map = {};
    // Primero acumula cosechas registradas por trabajadores
    cosechasFilt.forEach(c => {
      if (!map[c.crop]) map[c.crop] = { kg:0, registros:0 };
      map[c.crop].kg += parseFloat(c.kgCosechados)||0;
      map[c.crop].registros++;
    });
    // Si no hay cosechas registradas, usa kgCosechados de los lotes
    if(Object.keys(map).length===0) {
      (lotes||[]).forEach(lote => {
        if(!lote.crop||!lote.kgCosechados) return;
        if(!map[lote.crop]) map[lote.crop] = { kg:0, registros:0 };
        map[lote.crop].kg += parseFloat(lote.kgCosechados)||0;
        map[lote.crop].registros++;
      });
    }
    return map;
  }, [cosechasFilt, lotes]);

  // ── Comparativo cosecha vs venta por cultivo ──
  const comparativo = useMemo(() => {
    const crops = [...new Set([...Object.keys(porCultivoV), ...Object.keys(porCultivoC)])];
    return crops.map(k => ({
      name: CROPS[k]?.name || k,
      emoji: CROPS[k]?.emoji || "🌱",
      color: CROPS[k]?.color || "#27ae60",
      cropKey: k,
      cosechado: n(porCultivoC[k]?.kg || 0, 1),
      vendido: n(porCultivoV[k]?.kg || 0, 1),
      ingresos: n(porCultivoV[k]?.total || 0, 2),
    }));
  }, [porCultivoV, porCultivoC]);

  // ── RBC (Relación Beneficio/Costo) ──
  const rbcData = useMemo(() => {
    // Lotes filtrados respetan cultivo Y invernadero
    const lotesFilt = (lotes||[]).filter(l =>
      (filterCrop==="all" || l.crop===filterCrop) &&
      (filterInv==="all" || l.zona===filterInv)
    );
    const costoTotal = lotesFilt.reduce((s,l)=>s+(parseFloat(l.costoCiclo)||0),0);
    const ingresoTotal = totalIngresos; // ya filtrado por cultivo+inv
    const rbcGlobal = costoTotal>0?(ingresoTotal/costoTotal):0;
    const gNeta = ingresoTotal - costoTotal;
    // RBC por cultivo: solo cultivos que están en los lotes filtrados
    const porCultivo = {};
    lotesFilt.forEach(l => {
      if(!porCultivo[l.crop]) porCultivo[l.crop] = {costo:0,ingresos:0};
      porCultivo[l.crop].costo += parseFloat(l.costoCiclo)||0;
    });
    // Ingresos por cultivo: solo de cultivos en los lotes filtrados
    Object.keys(porCultivo).forEach(k => {
      porCultivo[k].ingresos = porCultivoV[k]?.total||0;
    });
    return { rbcGlobal, costoTotal, ingresoTotal, gNeta, porCultivo };
  }, [lotes, totalIngresos, porCultivoV, filterCrop, filterInv]);

  // ── Por canal ──
  const porCanal = useMemo(() => {
    const map = {};
    ventasFilt.forEach(v => {
      if (!map[v.canal]) map[v.canal] = { kg:0, total:0 };
      map[v.canal].kg += v.kgVendidos;
      map[v.canal].total += v.totalVenta;
    });
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  }, [ventasFilt]);

  // ── Por calidad ──
  const porCalidad = useMemo(() => {
    const map = {};
    ventasFilt.forEach(v => {
      if (!map[v.calidad]) map[v.calidad] = { kg:0, total:0 };
      map[v.calidad].kg += v.kgVendidos;
      map[v.calidad].total += v.totalVenta;
    });
    return map;
  }, [ventasFilt]);

  // ── Por tratamiento ──
  const porTratamiento = useMemo(() => {
    const map = {};
    ventasFilt.forEach(v => {
      const t = v.tratamiento || "convencional";
      if (!map[t]) map[t] = { kg:0, total:0 };
      map[t].kg += v.kgVendidos;
      map[t].total += v.totalVenta;
    });
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  }, [ventasFilt]);

  // ── Calidad cosechas ──
  const calCosecha = useMemo(() => {
    const map = {};
    cosechasFilt.forEach(c => {
      if (!map[c.calidad]) map[c.calidad] = { kg:0 };
      map[c.calidad].kg += c.kgCosechados;
    });
    return map;
  }, [cosechasFilt]);

  // ── Tendencia por fecha (últimas ventas agrupadas) ──
  const tendencia = useMemo(() => {
    const map = {};
    [...ventasFilt].sort((a,b)=>a.fecha?.localeCompare(b.fecha)).forEach(v => {
      const d = v.fecha?.slice(5) || "";
      if (!map[d]) map[d] = { fecha:d, ingresos:0, kg:0 };
      map[d].ingresos += Math.round(v.totalVenta);
      map[d].kg += Math.round(v.kgVendidos);
    });
    return Object.values(map).slice(-14);
  }, [ventasFilt]);

  const exportCSVVentas = () => {
    const lines = [];
    lines.push(["Fecha","Cultivo","Lote","Comprador","Canal","Calidad","Kg vendidos","$/kg","Total $","Folio","Notas"].join(","));
    [...ventasFilt].sort((a,b)=>b.fecha?.localeCompare(a.fecha)||b.createdAt?.localeCompare(a.createdAt)).forEach(venta => {
      const cal = CALIDADES.find(c=>c.id===venta.calidad);
      lines.push([venta.fecha||"",venta.cropName||"",venta.loteName||"",venta.comprador||"",venta.canal||"",cal?.label||"",venta.kgVendidos||0,venta.precioKg||0,venta.totalVenta||0,venta.factura||"",venta.notas||""].map(x=>`"${x}"`).join(","));
    });
    const blob = new Blob(["\uFEFF",lines.join("\n")],{type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`ventas_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const exportCSVCosechas = () => {
    const lines = [];
    lines.push(["TIPO","Fecha","Cultivo","Lote","Zona","Calidad/Causa","Kg","Monto $","Trabajador","Notas"].join(","));
    const cosechasFiltCSV = filtrarPeriodo(cosechas).filter(c => filterCrop==="all" || c.crop===filterCrop);
    [...cosechasFiltCSV].sort((a,b)=>b.date?.localeCompare(a.date)||b.createdAt?.localeCompare(a.createdAt)).forEach(c => {
      const crop = CROPS[c.crop];
      lines.push(["COSECHA",c.date||"",crop?.name||c.crop||"",c.loteName||"",c.zona||"",c.calidad||"",c.kgCosechados||0,"",c.worker||"",c.notas||""].map(x=>`"${x}"`).join(","));
    });
    const mermasFiltCSV = mermasData.filter(m => filterCrop==="all" || m.crop===filterCrop);
    [...mermasFiltCSV].sort((a,b)=>b.date?.localeCompare(a.date)||b.createdAt?.localeCompare(a.createdAt)).forEach(m => {
      const crop = CROPS[m.crop];
      lines.push(["MERMA",m.date||"",crop?.name||m.crop||"",m.loteName||"",m.zona||"",m.causa||"",m.kgMerma||0,"",m.worker||"",m.notas||""].map(x=>`"${x}"`).join(","));
    });
    [...siniestrosFilt].sort((a,b)=>b.date?.localeCompare(a.date)||b.createdAt?.localeCompare(a.createdAt)).forEach(s => {
      const crop = CROPS[s.crop];
      lines.push(["SINIESTRO",s.date||"",crop?.name||s.crop||"",s.loteName||"",s.zona||"",s.evento||"",s.kgSiniestro||0,s.montoSeguro||0,s.worker||"",s.notas||""].map(x=>`"${x}"`).join(","));
    });
    const blob = new Blob(["\uFEFF",lines.join("\n")],{type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`cosechas_mermas_siniestros_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const fmt = v => Number(v||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});

  // Precio promedio propio por cultivo para comparar con SNIIM
  const precioPromedioPorCultivo = useMemo(() => {
    const res = {};
    Object.entries(porCultivoV).forEach(([k, d]) => {
      if (d.kg > 0) res[k] = d.total / d.kg;
    });
    return res;
  }, [porCultivoV]);

  return (
    <div>
      <MonitorPrecios precioPromedioPropio={precioPromedioPorCultivo}/>
      {/* ── FILTROS ── */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <select value={filterCrop} onChange={e=>setFilterCrop(e.target.value)} style={{...INP,padding:"8px 14px",borderRadius:20,fontSize:12,width:"auto"}}>
          <option value="all">🌱 Todos los cultivos</option>
          {Object.entries(CROPS).map(([k,c])=><option key={k} value={k}>{c.emoji} {c.name}</option>)}
        </select>
        {invernaderosDisponibles.length>1&&(
          <select value={filterInv} onChange={e=>setFilterInv(e.target.value)} style={{...INP,padding:"8px 14px",borderRadius:20,fontSize:12,width:"auto",cursor:"pointer"}}>
            {invernaderosDisponibles.map(inv=>(
              <option key={inv} value={inv}>{inv==="all"?"🏠 Todos los invernaderos":`🏠 ${inv}`}</option>
            ))}
          </select>
        )}
        <select value={filterPeriodo} onChange={e=>setFilterPeriodo(e.target.value)} style={{...INP,padding:"8px 14px",borderRadius:20,fontSize:12,width:"auto"}}>
          <option value="todo">📅 Todo el tiempo</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
        </select>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button onClick={exportCSVVentas} style={{padding:"8px 16px",border:"1px solid #27ae60",borderRadius:20,background:"#eafaf1",color:"#27ae60",cursor:"pointer",fontSize:12,fontWeight:600}}>⬇ CSV Ventas</button>
          <button onClick={exportCSVCosechas} style={{padding:"8px 16px",border:"1px solid #8e44ad",borderRadius:20,background:"#f5eef8",color:"#8e44ad",cursor:"pointer",fontSize:12,fontWeight:600}}>⬇ CSV Cosechas+Mermas</button>
        </div>
      </div>

      {/* ── KPIs GLOBALES ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
        {[
          {icon:"💰",label:"Ingresos totales",v:`$${fmt(totalIngresos)}`,c:"#27ae60"},
          {icon:"⚖️",label:"Kg vendidos",v:`${fmt(totalKgVendidos)} kg`,c:"#2980b9"},
          {icon:"🧺",label:"Kg cosechados",v:`${fmt(totalKgCosechados)} kg`,c:"#8e44ad"},
          {icon:"📊",label:"Precio promedio/kg",v:`$${fmt(precioPromedio)}`,c:"#e67e22"},
          {icon:"🎯",label:"Eficiencia venta",v:`${eficiencia.toFixed(1)}%`,c:eficiencia>=80?"#27ae60":eficiencia>=60?"#f39c12":"#e74c3c"},
          {icon:"📬",label:"Kg por vender",v:`${fmt(kgStock)} kg`,c:kgStock>0?"#f39c12":"#27ae60"},
          {icon:"📦",label:"Producción Total",v:`${fmt(totalKgCosechados+totalMerma+totalSiniestro)} kg`,c:"#8e44ad"},
          {icon:"🏷️",label:"Transacciones",v:ventasFilt.length,c:"#7f8c8d"},
          {icon:"⚠️",label:"Kg merma",v:`${fmt(totalMerma)} kg`,c:totalMerma>0?"#f39c12":"#aaa"},
          {icon:"🌩",label:"Kg siniestro",v:`${fmt(totalSiniestro)} kg`,c:totalSiniestro>0?"#2980b9":"#aaa"},
          {icon:"💼",label:"Pago seguro",v:`$${totalMontoSeguro.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}`,c:totalMontoSeguro>0?"#2980b9":"#aaa"},
        ].map(k=>(
          <div key={k.label} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:20}}>{k.icon}</div>
            <div style={{fontSize:22,fontWeight:700,color:k.c,fontFamily:"'Courier New',monospace",lineHeight:1.1,marginTop:4}}>{k.v}</div>
            <div style={{fontSize:10,color:"#888",marginTop:2}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── RBC RELACIÓN BENEFICIO/COSTO ── */}
      {rbcData.costoTotal > 0 && (
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:"#444",textAlign:"center",marginBottom:14,letterSpacing:0.3}}>
            💼 RBC — RELACIÓN BENEFICIO / COSTO
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:14}}>
            <div style={{background:"#fef9e7",borderRadius:10,padding:"14px",textAlign:"center",border:"1px solid #f9e79f"}}>
              <div style={{fontSize:24,marginBottom:4}}>💰</div>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:18,fontWeight:700,color:"#b7950b"}}>${rbcData.costoTotal.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
              <div style={{fontSize:11,color:"#888",marginTop:2}}>Costos totales</div>
            </div>
            <div style={{background:"#eafaf1",borderRadius:10,padding:"14px",textAlign:"center",border:"1px solid #a9dfbf"}}>
              <div style={{fontSize:24,marginBottom:4}}>📈</div>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:18,fontWeight:700,color:"#27ae60"}}>${rbcData.ingresoTotal.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
              <div style={{fontSize:11,color:"#888",marginTop:2}}>Ingresos totales</div>
            </div>
            <div style={{background:rbcData.gNeta>=0?"#eafaf1":"#fdedec",borderRadius:10,padding:"14px",textAlign:"center",border:`1px solid ${rbcData.gNeta>=0?"#a9dfbf":"#f5b7b1"}`}}>
              <div style={{fontSize:24,marginBottom:4}}>{rbcData.gNeta>=0?"✅":"❌"}</div>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:18,fontWeight:700,color:rbcData.gNeta>=0?"#27ae60":"#c0392b"}}>${rbcData.gNeta.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
              <div style={{fontSize:11,color:rbcData.gNeta>=0?"#27ae60":"#c0392b",fontWeight:600,marginTop:2}}>Ganancia neta</div>
            </div>
            <div style={{background:rbcData.rbcGlobal>=1?"#eafaf1":"#fdedec",borderRadius:10,padding:"14px",textAlign:"center",border:`3px solid ${rbcData.rbcGlobal>=1?"#27ae60":"#e74c3c"}`}}>
              <div style={{fontSize:28,marginBottom:4,fontWeight:900,color:rbcData.rbcGlobal>=1?"#27ae60":"#c0392b"}}>{rbcData.rbcGlobal.toFixed(2)}</div>
              <div style={{fontSize:11,color:rbcData.rbcGlobal>=1?"#27ae60":"#c0392b",fontWeight:700,marginTop:2}}>RBC GLOBAL</div>
              <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{rbcData.rbcGlobal>=1?"Rentable":rbcData.rbcGlobal>0?"Pérdida":"Sin ventas"}</div>
            </div>
          </div>
          {Object.keys(rbcData.porCultivo).length>0 && (
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#aaa",marginBottom:8,letterSpacing:0.3}}>RBC POR CULTIVO</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
                {Object.entries(rbcData.porCultivo).filter(([k,d])=>d.costo>0||d.ingresos>0).map(([k,d])=>{
                  const crop = CROPS[k];
                  const rbc = d.costo>0?(d.ingresos/d.costo):0;
                  const neta = d.ingresos - d.costo;
                  return (
                    <div key={k} style={{background:"#fafafa",borderRadius:10,padding:"10px 12px",border:`1px solid ${rbc>=1?"#a9dfbf":"#f5b7b1"}`,borderLeft:`4px solid ${crop?.color||"#27ae60"}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,fontWeight:600,color:crop?.color}}>
                        <span style={{fontSize:16}}>{crop?.emoji}</span> {crop?.name||k}
                      </div>
                      <div style={{fontSize:11,color:"#888",marginBottom:2}}>Costo: <span style={{fontFamily:"'Courier New',monospace",color:"#b7950b"}}>${d.costo.toLocaleString("es-MX",{minimumFractionDigits:2})}</span></div>
                      <div style={{fontSize:11,color:"#888",marginBottom:2}}>Ingreso: <span style={{fontFamily:"'Courier New',monospace",color:"#27ae60"}}>${d.ingresos.toLocaleString("es-MX",{minimumFractionDigits:2})}</span></div>
                      <div style={{fontSize:11,color:"#888",marginBottom:6}}>Neta: <span style={{fontFamily:"'Courier New',monospace",color:neta>=0?"#27ae60":"#c0392b",fontWeight:700}}>${neta.toLocaleString("es-MX",{minimumFractionDigits:2})}</span></div>
                      <div style={{textAlign:"center",background:rbc>=1?"#eafaf1":"#fdedec",borderRadius:6,padding:"4px 8px",border:`1px solid ${rbc>=1?"#27ae60":"#e74c3c"}`}}>
                        <span style={{fontFamily:"'Courier New',monospace",fontSize:14,fontWeight:700,color:rbc>=1?"#27ae60":"#c0392b"}}>RBC {rbc.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DIFERENCIAL STOCK ── */}
      {totalKgCosechados > 0 && (
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14,letterSpacing:0.3}}>📦 DIFERENCIAL — COSECHA vs VENTA (Stock actual)</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
            <div style={{background:"#f0faf5",borderRadius:10,padding:"14px",textAlign:"center",border:"1px solid #a9dfbf"}}>
              <div style={{fontSize:28,marginBottom:4}}>🧺</div>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:22,fontWeight:700,color:"#27ae60"}}>{fmt(totalKgCosechados)}</div>
              <div style={{fontSize:11,color:"#888",marginTop:2}}>kg cosechados</div>
            </div>
            <div style={{background:"#f5eef8",borderRadius:10,padding:"14px",textAlign:"center",border:"2px solid #8e44ad44"}}>
              <div style={{fontSize:28,marginBottom:4}}>📦</div>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:22,fontWeight:700,color:"#8e44ad"}}>{fmt(totalKgCosechados+totalMerma+totalSiniestro)}</div>
              <div style={{fontSize:11,color:"#8e44ad",marginTop:2,fontWeight:600}}>Producción Total</div>
              <div style={{fontSize:10,color:"#aaa"}}>cosechado + merma</div>
            </div>
            <div style={{background:"#eaf4fb",borderRadius:10,padding:"14px",textAlign:"center",border:"1px solid #b5d4f4"}}>
              <div style={{fontSize:28,marginBottom:4}}>💰</div>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:22,fontWeight:700,color:"#2980b9"}}>{fmt(totalKgVendidos)}</div>
              <div style={{fontSize:11,color:"#888",marginTop:2}}>kg vendidos</div>
            </div>
            {totalMerma>0&&(
              <div style={{background:"#fef9e7",borderRadius:10,padding:"14px",textAlign:"center",border:"1px solid #f39c1244"}}>
                <div style={{fontSize:28,marginBottom:4}}>⚠️</div>
                <div style={{fontFamily:"'Courier New',monospace",fontSize:22,fontWeight:700,color:"#f39c12"}}>{fmt(totalMerma)}</div>
                <div style={{fontSize:11,color:"#888",marginTop:2}}>kg merma</div>
              </div>
            )}
            <div style={{background:kgStock>0?"#fff3cd":"#eafaf1",borderRadius:10,padding:"14px",textAlign:"center",border:`2px solid ${kgStock>0?"#f39c12":"#27ae60"}`,boxShadow:kgStock>0?"0 2px 8px #f39c1222":"none"}}>
              <div style={{fontSize:28,marginBottom:4}}>{kgStock>0?"📬":"✅"}</div>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:28,fontWeight:700,color:kgStock>0?"#f39c12":"#27ae60"}}>{fmt(kgStock)}</div>
              <div style={{fontSize:11,color:kgStock>0?"#856404":"#27ae60",marginTop:2,fontWeight:600}}>{kgStock>0?"kg por vender":"Todo vendido"}</div>
            </div>
          </div>
          {/* Barra de progreso */}
          <div style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888",marginBottom:4}}>
              <span>Progreso de comercialización</span>
              <span style={{fontWeight:700,color:eficiencia>=80?"#27ae60":eficiencia>=60?"#f39c12":"#e74c3c"}}>{eficiencia.toFixed(1)}%</span>
            </div>
            <div style={{background:"#e0e0e0",borderRadius:6,height:12,overflow:"hidden"}}>
              <div style={{display:"flex",height:"100%"}}>
                <div style={{width:`${Math.min(eficiencia,100)}%`,background:"#27ae60",transition:"width 0.5s",borderRadius:"6px 0 0 6px"}}/>
                {totalMerma>0&&<div style={{width:`${Math.min((totalMerma/totalKgCosechados)*100,100-eficiencia)}%`,background:"#f39c12"}}/>}
              </div>
            </div>
            <div style={{display:"flex",gap:12,marginTop:6,fontSize:10,color:"#888",flexWrap:"wrap"}}>
              <span><span style={{display:"inline-block",width:8,height:8,background:"#27ae60",borderRadius:2,marginRight:3}}/>Vendido {eficiencia.toFixed(1)}%</span>
              {totalMerma>0&&<span><span style={{display:"inline-block",width:8,height:8,background:"#f39c12",borderRadius:2,marginRight:3}}/>Merma {totalKgCosechados>0?((totalMerma/totalKgCosechados)*100).toFixed(1):0}%</span>}
              <span><span style={{display:"inline-block",width:8,height:8,background:"#e0e0e0",borderRadius:2,marginRight:3}}/>Stock {pctStock.toFixed(1)}%</span>
            </div>
          </div>
          {/* Desglose por cultivo */}
          {comparativo.length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#aaa",marginBottom:8,letterSpacing:0.3}}>POR CULTIVO</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>
                {comparativo.map(d=>{
                  const mermaCrop = filtrarPeriodo(mermasData).filter(m=>m.crop===Object.keys(CROPS).find(k=>CROPS[k].name===d.name)).reduce((s,m)=>s+(m.kgMerma||0),0);
                  const stockCrop = Math.max(0, d.cosechado - d.vendido);
                  const pctV = d.cosechado>0?Math.min((d.vendido/d.cosechado)*100,100):0;
                  return(
                    <div key={d.name} style={{background:"#f9f9f9",borderRadius:10,padding:"10px 12px",borderLeft:`4px solid ${d.color}`}}>
                      <div style={{fontWeight:700,color:d.color,fontSize:13,marginBottom:6}}>{d.emoji} {d.name}</div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
                        <span style={{color:"#888"}}>Cosechado</span>
                        <span style={{fontFamily:"'Courier New',monospace",fontWeight:600}}>{Number(d.cosechado).toFixed(2)} kg</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
                        <span style={{color:"#888"}}>Vendido</span>
                        <span style={{fontFamily:"'Courier New',monospace",fontWeight:600,color:"#2980b9"}}>{Number(d.vendido).toFixed(2)} kg</span>
                      </div>
                      {mermaCrop>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
                        <span style={{color:"#888"}}>Merma</span>
                        <span style={{fontFamily:"'Courier New',monospace",fontWeight:600,color:"#f39c12"}}>{mermaCrop.toFixed(2)} kg</span>
                      </div>}
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:4,paddingTop:4,borderTop:"1px solid #e0e0e0"}}>
                        <span style={{fontWeight:700,color:stockCrop>0?"#f39c12":"#27ae60"}}>📦 Por vender</span>
                        <span style={{fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:14,color:stockCrop>0?"#f39c12":"#27ae60"}}>{stockCrop.toFixed(2)} kg</span>
                      </div>
                      <div style={{background:"#e0e0e0",borderRadius:3,height:4,overflow:"hidden",marginTop:6}}>
                        <div style={{width:`${pctV}%`,height:"100%",background:d.color,borderRadius:3}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GRÁFICA TENDENCIA ── */}
      {tendencia.length >= 2 && (
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14,letterSpacing:0.3}}>📈 TENDENCIA DE INGRESOS</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={tendencia} margin={{top:5,right:20,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="fecha" tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false} width={50} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={(v,n)=>n==="Ingresos $"||n==="ingresos"?[`$${Number(v).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}`,"Ingresos $"]:[`${Number(v).toFixed(2)} kg`,"Kg vendidos"]} contentStyle={{fontSize:11,borderRadius:8,border:"1px solid #e0e0e0"}}/>
              <Legend wrapperStyle={{fontSize:11}}/>
              <Line type="monotone" dataKey="ingresos" name="Ingresos $" stroke="#27ae60" strokeWidth={2.5} dot={{r:3}} activeDot={{r:5}}/>
              <Line type="monotone" dataKey="kg" name="Kg vendidos" stroke="#2980b9" strokeWidth={2} dot={{r:3}} strokeDasharray="4 2"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── COSECHA VS VENTA POR CULTIVO ── */}
      {comparativo.length > 0 && (
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14,letterSpacing:0.3}}>🧺 COSECHA VS VENTA POR CULTIVO (kg)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={comparativo} margin={{top:5,right:20,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="name" tick={{fontSize:11,fill:"#555"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false} width={40}/>
              <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:"1px solid #e0e0e0"}}/>
              <Legend wrapperStyle={{fontSize:11}}/>
              <Bar dataKey="cosechado" name="Kg cosechados" radius={[4,4,0,0]}>
                {comparativo.map((d,i)=><Cell key={i} fill={d.color+"88"}/>)}
              </Bar>
              <Bar dataKey="vendido" name="Kg vendidos" radius={[4,4,0,0]}>
                {comparativo.map((d,i)=><Cell key={i} fill={d.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Tarjetas por cultivo */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginTop:14}}>
            {comparativo.map(d=>{
              const pct = d.cosechado > 0 ? Math.min((d.vendido/d.cosechado)*100,100) : 0;
              return (
                <div key={d.name} style={{background:"#f9f9f9",borderRadius:10,padding:"12px 14px",borderLeft:`4px solid ${d.color}`}}>
                  <div style={{fontWeight:700,color:d.color,marginBottom:6}}>{d.emoji} {d.name}</div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                    <span style={{color:"#888"}}>Cosechado</span>
                    <span style={{fontFamily:"'Courier New',monospace",fontWeight:700}}>{d.cosechado.toLocaleString()} kg</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                    <span style={{color:"#888"}}>Vendido</span>
                    <span style={{fontFamily:"'Courier New',monospace",fontWeight:700,color:d.color}}>{d.vendido.toLocaleString()} kg</span>
                  </div>
                  <div style={{background:"#e0e0e0",borderRadius:4,height:6,overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,height:"100%",background:d.color,borderRadius:4,transition:"width 0.5s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                    <span style={{fontSize:10,color:"#aaa"}}>{pct.toFixed(1)}% comercializado</span>
                    <span style={{fontSize:11,fontWeight:700,color:"#27ae60",fontFamily:"'Courier New',monospace"}}>${Math.round(d.ingresos).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4 GRÁFICAS ── */}
      {ventasFilt.length >= 2 && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>

          {/* Ingresos por cultivo */}
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>INGRESOS POR CULTIVO ($)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={Object.entries(porCultivoV).map(([k,d])=>({name:CROPS[k]?.name||k,ingresos:Math.round(d.total)}))} margin={{top:5,right:10,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="name" tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false} width={45} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={v=>[`$${v.toLocaleString("es-MX")}`,""]} contentStyle={{fontSize:11,borderRadius:8}}/>
                <Bar dataKey="ingresos" radius={[4,4,0,0]}>
                  {Object.entries(porCultivoV).map(([k],i)=><Cell key={i} fill={CROPS[k]?.color||"#27ae60"}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Calidad cosecha vs venta - donut */}
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:4,letterSpacing:0.3}}>CALIDAD — COSECHA VS VENTA</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
              {CALIDADES.map(c=>{
                const vc=calCosecha[c.id]?.kg||0;
                const vv=porCalidad[c.id]?.kg||0;
                return(
                  <div key={c.id} style={{background:c.color+"0d",borderRadius:8,padding:"6px 8px",textAlign:"center",border:`1px solid ${c.color}22`}}>
                    <div style={{fontSize:12,fontWeight:700,color:c.color}}>{c.label}</div>
                    <div style={{fontSize:10,color:"#888",marginTop:2}}>🧺 {vc} kg · 💰 {vv} kg</div>
                  </div>
                );
              })}
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={CALIDADES.map(c=>({name:c.label,cosecha:Math.round(calCosecha[c.id]?.kg||0),venta:Math.round(porCalidad[c.id]?.kg||0),color:c.color}))} margin={{top:0,right:10,left:0,bottom:0}}>
                <XAxis dataKey="name" tick={{fontSize:9,fill:"#aaa"}} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:8}}/>
                <Bar dataKey="cosecha" name="Cosechado" fill="#bbb" radius={[2,2,0,0]}/>
                <Bar dataKey="venta" name="Vendido" radius={[2,2,0,0]}>
                  {CALIDADES.map((c,i)=><Cell key={i} fill={c.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Por canal - horizontal */}
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>INGRESOS POR CANAL</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porCanal.slice(0,6).map(([c,d])=>({canal:c.length>14?c.slice(0,14)+"…":c,ingresos:Math.round(d.total)}))} layout="vertical" margin={{top:0,right:20,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:9,fill:"#aaa"}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <YAxis type="category" dataKey="canal" tick={{fontSize:10,fill:"#555"}} axisLine={false} tickLine={false} width={95}/>
                <Tooltip formatter={v=>[`$${v.toLocaleString("es-MX")}`,""]} contentStyle={{fontSize:11,borderRadius:8}}/>
                <Bar dataKey="ingresos" fill="#2980b9" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Por tipo de producción */}
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>TIPO DE PRODUCCIÓN</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porTratamiento.slice(0,5).map(([t,d])=>({tipo:(TRATAMIENTOS.find(x=>x.id===t)?.label||t).slice(0,12),ingresos:Math.round(d.total),color:TRATAMIENTOS.find(x=>x.id===t)?.color||"#27ae60"}))} margin={{top:5,right:10,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="tipo" tick={{fontSize:9,fill:"#aaa"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false} width={45} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={v=>[`$${v.toLocaleString("es-MX")}`,""]} contentStyle={{fontSize:11,borderRadius:8}}/>
                <Bar dataKey="ingresos" radius={[4,4,0,0]}>
                  {porTratamiento.slice(0,5).map(([t],i)=><Cell key={i} fill={TRATAMIENTOS.find(x=>x.id===t)?.color||"#27ae60"}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}

      {/* ── TABLA DETALLE COSECHAS ── */}
      <CosechasAdmin/>

      {/* ── TABLA RESUMEN TABULAR ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
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
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>TIPO DE PRODUCCIÓN</div>
          {porTratamiento.map(([tratId,data])=>{
            const trat=TRATAMIENTOS.find(t=>t.id===tratId);
            return(
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

      {/* ── BALANCE POR LOTE ── */}
      {lotes.length > 0 && (
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>BALANCE POR LOTE</div>
          {lotes.map(lote=>{
            const crop=CROPS[lote.crop];
            const trat=TRATAMIENTOS.find(t=>t.id===lote.tratamiento);
            const ventasLote=ventasFilt.filter(v=>v.loteId===lote.id);
            const kgVendido=ventasLote.reduce((s,v)=>s+v.kgVendidos,0);
            const ingresos=ventasLote.reduce((s,v)=>s+v.totalVenta,0);
            const kgDisp=Math.max(0,lote.kgCosechados-kgVendido);
            const pctV = lote.kgCosechados > 0 ? Math.min(kgVendido/lote.kgCosechados*100,100) : 0;
            return(
              <div key={lote.id} style={{padding:"10px 0",borderBottom:"1px solid #f5f5f5"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:6}}>
                  <span style={{fontSize:18}}>{crop?.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13}}>{lote.nombre}</div>
                    <div style={{fontSize:11,color:trat?.color,fontWeight:500}}>{trat?.icon} {trat?.label}</div>
                  </div>
                  <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                    <div style={{textAlign:"center"}}><div style={{fontFamily:"'Courier New',monospace",fontSize:13,fontWeight:700,color:"#27ae60"}}>{fmt(kgVendido)} kg</div><div style={{fontSize:9,color:"#aaa"}}>Vendido</div></div>
                    <div style={{textAlign:"center"}}><div style={{fontFamily:"'Courier New',monospace",fontSize:13,fontWeight:700,color:kgDisp>0?"#f39c12":"#aaa"}}>{fmt(kgDisp)} kg</div><div style={{fontSize:9,color:"#aaa"}}>Disponible</div></div>
                    <div style={{textAlign:"center"}}><div style={{fontFamily:"'Courier New',monospace",fontSize:13,fontWeight:700,color:"#2c3e50"}}>${fmt(ingresos)}</div><div style={{fontSize:9,color:"#aaa"}}>Ingresos</div></div>
                  </div>
                </div>
                <div style={{background:"#e0e0e0",borderRadius:4,height:5,overflow:"hidden"}}>
                  <div style={{width:`${pctV}%`,height:"100%",background:crop?.color||"#27ae60",borderRadius:4}}/>
                </div>
                <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{pctV.toFixed(1)}% comercializado</div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}


function CosechasAdmin() {
  const [cosechas, setCosechas] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const CROPS_C = {jitomate:{name:"Jitomate",emoji:"🍅"},fresa:{name:"Fresa",emoji:"🍓"},arandano:{name:"Arándano",emoji:"🫐"},zarzamora:{name:"Zarzamora",emoji:"🫐"}};
  const CALIDADES_C = [{id:"primera",label:"Primera",color:"#27ae60"},{id:"segunda",label:"Segunda",color:"#f39c12"},{id:"tercera",label:"Tercera",color:"#e67e22"},{id:"merma_venta",label:"Merma",color:"#e74c3c"}];
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


// ─── MERMAS ADMIN ─────────────────────────────────────────────────────────────
function MermasAdmin() {
  const [mermas, setMermas] = useState([]);
  const [filterCrop, setFilterCrop] = useState("all");

  useEffect(()=>{
    const q = query(collection(db,"mermas"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap=>setMermas(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>unsub();
  },[]);

  const filtered = filterCrop==="all" ? mermas : mermas.filter(m=>m.crop===filterCrop);
  const totalKg = filtered.reduce((s,m)=>s+(m.kgMerma||0),0);

  // Por causa
  const porCausa = {};
  filtered.forEach(m=>{
    const c = m.causa||"Sin especificar";
    if(!porCausa[c]) porCausa[c]={kg:0,count:0};
    porCausa[c].kg += m.kgMerma||0;
    porCausa[c].count++;
  });

  // Por cultivo
  const porCultivo = {};
  filtered.forEach(m=>{
    if(!porCultivo[m.crop]) porCultivo[m.crop]={kg:0,count:0};
    porCultivo[m.crop].kg += m.kgMerma||0;
    porCultivo[m.crop].count++;
  });

  const fmt = v => Number(v||0).toLocaleString("es-MX",{minimumFractionDigits:1,maximumFractionDigits:1});

  return (
    <div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:16}}>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:20}}>⚠️</div>
          <div style={{fontSize:24,fontWeight:700,color:"#f39c12",fontFamily:"'Courier New',monospace",marginTop:4}}>{fmt(totalKg)} kg</div>
          <div style={{fontSize:11,color:"#888",marginTop:2}}>Total merma</div>
        </div>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:20}}>📋</div>
          <div style={{fontSize:24,fontWeight:700,color:"#e74c3c",fontFamily:"'Courier New',monospace",marginTop:4}}>{filtered.length}</div>
          <div style={{fontSize:11,color:"#888",marginTop:2}}>Registros</div>
        </div>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:20}}>🔢</div>
          <div style={{fontSize:24,fontWeight:700,color:"#8e44ad",fontFamily:"'Courier New',monospace",marginTop:4}}>{Object.keys(porCausa).length}</div>
          <div style={{fontSize:11,color:"#888",marginTop:2}}>Causas distintas</div>
        </div>
      </div>

      {/* Filtro */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["all","Todos"],["jitomate","🍅 Jitomate"],["fresa","🍓 Fresa"],["arandano","🫐 Arándano"],["zarzamora","🫐 Zarzamora"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilterCrop(k)}
            style={{padding:"6px 14px",border:`1px solid ${filterCrop===k?"#f39c12":"#e0e0e0"}`,borderRadius:20,background:filterCrop===k?"#fef9e7":"#fff",color:filterCrop===k?"#f39c12":"#666",cursor:"pointer",fontSize:12,fontWeight:filterCrop===k?700:400}}>
            {l}
          </button>
        ))}
      </div>

      {/* Por causa y por cultivo */}
      {filtered.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>POR CAUSA</div>
            {Object.entries(porCausa).sort((a,b)=>b[1].kg-a[1].kg).map(([causa,data])=>(
              <div key={causa} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f5f5f5",alignItems:"center"}}>
                <span style={{fontSize:12,color:"#555"}}>{causa}</span>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:700,color:"#f39c12"}}>{fmt(data.kg)} kg</div>
                  <div style={{fontSize:10,color:"#aaa"}}>{data.count} registro{data.count!==1?"s":""}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12,letterSpacing:0.3}}>POR CULTIVO</div>
            {Object.entries(porCultivo).sort((a,b)=>b[1].kg-a[1].kg).map(([crop,data])=>{
              const c = CROPS[crop];
              return(
                <div key={crop} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f5f5f5",alignItems:"center"}}>
                  <span style={{fontSize:12,color:c?.color||"#555",fontWeight:500}}>{c?.emoji} {c?.name||crop}</span>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:700,color:"#f39c12"}}>{fmt(data.kg)} kg</div>
                    <div style={{fontSize:10,color:"#aaa"}}>{data.count} registro{data.count!==1?"s":""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista de mermas */}
      {!filtered.length&&(
        <div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa",border:"0.5px solid #e0e0e0"}}>
          <div style={{fontSize:40,marginBottom:8}}>✅</div>
          <div style={{fontWeight:500,marginBottom:4}}>Sin mermas registradas</div>
          <div style={{fontSize:12}}>Los trabajadores registran mermas desde su app</div>
        </div>
      )}
      {filtered.map(m=>{
        const crop=CROPS[m.crop];
        return(
          <div key={m.id} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderLeft:"4px solid #f39c12",borderRadius:12,padding:"12px 16px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:20}}>{crop?.emoji||"🌱"}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:2}}>
                  <span style={{fontWeight:600,fontSize:13,color:crop?.color||"#333"}}>{crop?.name||m.crop}</span>
                  <span style={{background:"#fef9e7",color:"#f39c12",border:"1px solid #f39c1244",borderRadius:8,padding:"1px 8px",fontSize:11,fontWeight:600}}>{m.causa||"Sin causa"}</span>
                </div>
                <div style={{fontSize:11,color:"#aaa"}}>{m.loteName||"Sin lote"} · {m.zona||""} · {m.worker} · {m.date}</div>
                {m.notas&&<div style={{fontSize:11,color:"#888",marginTop:2}}>📝 {m.notas}</div>}
              </div>
              <div style={{textAlign:"center",background:"#fef9e7",borderRadius:10,padding:"8px 14px",border:"1px solid #f39c1244"}}>
                <div style={{fontFamily:"'Courier New',monospace",fontSize:18,fontWeight:700,color:"#f39c12"}}>{fmt(m.kgMerma)} kg</div>
                <div style={{fontSize:9,color:"#aaa"}}>merma</div>
              </div>
              <button onClick={()=>{if(window.confirm("¿Eliminar este registro?"))deleteDoc(doc(db,"mermas",m.id));}}
                style={{background:"#fdedec",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#c0392b"}}>✕</button>
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
  { id:"mermas", label:"⚠️ Mermas" },
];

export default function Ventas({ readOnly=false }) {
  const tabsDisp = readOnly
    ? [{ id:"reportes", label:"📊 Reportes" },{ id:"lotes", label:"📦 Lotes" }]
    : SUBTABS;
  const [tab, setTab] = useState("reportes");
  return (
    <div className="ventas-module">
      {readOnly&&<div style={{background:"#eaf4fb",border:"1px solid #b5d4f4",borderRadius:10,padding:"8px 14px",marginBottom:10,fontSize:12,color:"#1a5276"}}>👁️ Modo observador — solo lectura</div>}
      <div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#2e7d5a"}}>
        📱 Los trabajadores registran ventas y cosechas desde su app · Tú ves los reportes aquí
      </div>
      <div style={{display:"flex",gap:4,marginBottom:16,background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:4}}>
        {tabsDisp.map(t=>(
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
      {tab==="mermas" && <MermasAdmin/>}
    </div>
  );
}
