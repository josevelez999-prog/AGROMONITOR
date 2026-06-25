// Vista móvil compacta para admin/observador
// Muestra KPIs, stock, RBC y tareas en cards optimizadas para teléfono

import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "./firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { signOut } from "firebase/auth";

const CROPS = {
  jitomate:  { name:"Jitomate",  emoji:"🍅", color:"#c0392b" },
  fresa:     { name:"Fresa",     emoji:"🍓", color:"#e91e63" },
  arandano:  { name:"Arándano",  emoji:"🫐", color:"#3f51b5" },
  zarzamora: { name:"Zarzamora", emoji:"🍇", color:"#7b1fa2" },
};

const n = (v, d=2) => Number((v||0).toFixed(d));
const fmt = (v) => Number(v||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtInt = (v) => Number(v||0).toLocaleString("es-MX");

class MobileErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={hasError:false,error:null}; }
  static getDerivedStateFromError(error){ return {hasError:true,error}; }
  componentDidCatch(error,info){ console.error("MobileDashboard error:",error,info); }
  render(){
    if(this.state.hasError){
      return (
        <div style={{padding:20,margin:20,background:"#fff",border:"2px solid #e74c3c",borderRadius:12}}>
          <div style={{fontSize:18,fontWeight:700,color:"#c0392b",marginBottom:10}}>⚠ Error en vista móvil</div>
          <div style={{fontSize:12,marginBottom:14,whiteSpace:"pre-wrap",fontFamily:"monospace",background:"#fdedec",padding:10,borderRadius:8,maxHeight:200,overflow:"auto",color:"#c0392b"}}>
            {String(this.state.error?.message||this.state.error||"Error desconocido")}
            {this.state.error?.stack ? "\n\n" + String(this.state.error.stack).slice(0,500) : ""}
          </div>
          <button onClick={()=>this.setState({hasError:false,error:null})}
            style={{padding:"10px 20px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,marginRight:8}}>
            🔄 Reintentar
          </button>
          <button onClick={()=>window.location.reload()}
            style={{padding:"10px 20px",background:"#888",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>
            ↻ Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MobileDashboardInner({ user, onLogout, onSwitchToDesktop }) {
  const [ventas, setVentas] = useState([]);
  const [cosechas, setCosechas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [mermas, setMermas] = useState([]);
  const [siniestros, setSiniestros] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState("kpis");
  const [filterCrop, setFilterCrop] = useState("all");

  useEffect(()=>{
    const subs = [
      onSnapshot(query(collection(db,"ventas"),    orderBy("createdAt","desc")), s => setVentas(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(query(collection(db,"cosechas_trabajador"), orderBy("createdAt","desc")), s => setCosechas(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(query(collection(db,"lotes"),     orderBy("createdAt","desc")), s => setLotes(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(query(collection(db,"mermas")),   s => setMermas(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(query(collection(db,"siniestros")), s => setSiniestros(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(query(collection(db,"tasks"), orderBy("fechaCreacion","desc")), s => setTasks(s.docs.map(d=>({id:d.id,...d.data()})))),
    ];
    return () => subs.forEach(u => u());
  },[]);

  // ─── DATOS CALCULADOS ──
  const data = useMemo(()=>{
    const ventasFilt    = ventas.filter(v => filterCrop==="all" || v.crop===filterCrop);
    const cosechasFilt  = cosechas.filter(c => filterCrop==="all" || c.crop===filterCrop);
    const mermasFilt    = mermas.filter(m => filterCrop==="all" || m.crop===filterCrop);
    const siniestrosF   = siniestros.filter(s => filterCrop==="all" || s.crop===filterCrop);
    const lotesFilt     = lotes.filter(l => filterCrop==="all" || l.crop===filterCrop);

    const totalIngresos = ventasFilt.reduce((s,v)=>s+(parseFloat(v.totalVenta)||0),0)
                       + siniestrosF.reduce((s,x)=>s+(parseFloat(x.montoSeguro)||0),0);
    const totalKgVendidos = ventasFilt.reduce((s,v)=>s+(parseFloat(v.kgVendidos)||0),0);
    const totalKgCosechados = (() => {
      let total = 0; const usados = new Set();
      cosechasFilt.forEach(c => {
        if (c.loteId && lotesFilt.find(l=>l.id===c.loteId)) {
          total += parseFloat(c.kgCosechados)||0;
          usados.add(c.loteId);
        }
      });
      lotesFilt.forEach(l => { if(!usados.has(l.id)) total += parseFloat(l.kgCosechados)||0; });
      return total;
    })();
    const totalMerma = mermasFilt.reduce((s,m)=>s+(parseFloat(m.kgMerma)||0),0);
    const totalSiniestro = siniestrosF.reduce((s,x)=>s+(parseFloat(x.kgSiniestro)||0),0);

    // Stock disponible por cultivo
    const stockPorCultivo = {};
    Object.keys(CROPS).forEach(k => stockPorCultivo[k] = { kgCos:0, kgVen:0, stock:0 });
    lotes.forEach(l => {
      if(!stockPorCultivo[l.crop]) return;
      const cosTrab = cosechas.filter(c=>c.loteId===l.id).reduce((s,c)=>s+(parseFloat(c.kgCosechados)||0),0);
      const kgCos = cosTrab > 0 ? cosTrab : (parseFloat(l.kgCosechados)||0);
      const kgVen = ventas.filter(v=>v.loteId===l.id).reduce((s,v)=>s+(parseFloat(v.kgVendidos)||0),0);
      stockPorCultivo[l.crop].kgCos += kgCos;
      stockPorCultivo[l.crop].kgVen += kgVen;
      stockPorCultivo[l.crop].stock += Math.max(0, kgCos - kgVen);
    });

    // RBC general y por cultivo
    const costoTotal = lotesFilt.reduce((s,l)=>s+(parseFloat(l.costoCiclo)||0),0);
    const rbcGlobal = costoTotal>0 ? totalIngresos/costoTotal : 0;
    const gNeta = totalIngresos - costoTotal;

    const rbcPorCultivo = {};
    lotesFilt.forEach(l => {
      if(!rbcPorCultivo[l.crop]) rbcPorCultivo[l.crop] = { costo:0, ingresos:0 };
      rbcPorCultivo[l.crop].costo += parseFloat(l.costoCiclo)||0;
    });
    Object.keys(rbcPorCultivo).forEach(k => {
      rbcPorCultivo[k].ingresos = ventasFilt.filter(v=>v.crop===k).reduce((s,v)=>s+(parseFloat(v.totalVenta)||0),0);
    });

    // Ventas de hoy
    const hoy = new Date().toISOString().slice(0,10);
    const ventasHoy = ventasFilt.filter(v => (v.fechaVenta||v.date||"").startsWith(hoy));
    const ingresosHoy = ventasHoy.reduce((s,v)=>s+(parseFloat(v.totalVenta)||0),0);

    // Tareas (todas)
    const today = new Date().toISOString().slice(0,10);
    const tareasPendientes = tasks.filter(t => !t.completedBy?.length);
    const tareasCompletadas = tasks.filter(t => t.completedBy?.length>0);
    const tareasVencidas = tasks.filter(t => t.fechaLimite && t.fechaLimite < today && !t.completedBy?.length);

    return {
      totalIngresos, totalKgVendidos, totalKgCosechados, totalMerma, totalSiniestro,
      costoTotal, rbcGlobal, gNeta, rbcPorCultivo, stockPorCultivo,
      ventasHoy: ventasHoy.length, ingresosHoy,
      tareasPendientes, tareasCompletadas, tareasVencidas,
    };
  },[ventas, cosechas, lotes, mermas, siniestros, tasks, filterCrop]);

  const TABS = [
    { id:"kpis",   emoji:"📊", label:"KPIs"   },
    { id:"stock",  emoji:"📦", label:"Stock"  },
    { id:"rbc",    emoji:"💼", label:"RBC"    },
    { id:"tareas", emoji:"✅", label:"Tareas" },
  ];

  const cardBase = { background:"#fff", borderRadius:14, padding:"14px 16px", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" };

  return (
    <div style={{minHeight:"100vh",background:"#f5f6f7",paddingBottom:80}}>
      {/* Header */}
      <div style={{background:"#fff",padding:"12px 16px",position:"sticky",top:0,zIndex:10,borderBottom:"1px solid #e0e0e0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:17,fontWeight:700,color:"#27ae60"}}>🌿 GreenLog</div>
          <div style={{fontSize:10,color:"#888"}}>{user?.nombre||user?.email||"Admin"} · {user?.rol==="observador"?"👁 Observador":"👤 Admin"}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {onSwitchToDesktop && (
            <button onClick={onSwitchToDesktop}
              style={{background:"#eaf4fb",border:"1px solid #b5d4f4",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:10,color:"#2980b9",fontWeight:600}}>
              🖥 Web
            </button>
          )}
          <button onClick={async()=>{ try{ await signOut(auth); onLogout?.(); }catch{} }}
            style={{background:"transparent",border:"1px solid #ddd",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:10,color:"#888"}}>
            Salir
          </button>
        </div>
      </div>

      {/* Filtro de cultivo */}
      <div style={{padding:"10px 12px",display:"flex",gap:5,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <button onClick={()=>setFilterCrop("all")} style={{padding:"6px 12px",border:`1px solid ${filterCrop==="all"?"#27ae60":"#ddd"}`,borderRadius:20,background:filterCrop==="all"?"#eafaf1":"#fff",color:filterCrop==="all"?"#27ae60":"#666",cursor:"pointer",fontSize:11,fontWeight:filterCrop==="all"?700:400,whiteSpace:"nowrap",flexShrink:0}}>
          🌱 Todos
        </button>
        {Object.entries(CROPS).map(([k,c])=>(
          <button key={k} onClick={()=>setFilterCrop(k)} style={{padding:"6px 12px",border:`1px solid ${filterCrop===k?c.color:"#ddd"}`,borderRadius:20,background:filterCrop===k?c.color+"18":"#fff",color:filterCrop===k?c.color:"#666",cursor:"pointer",fontSize:11,fontWeight:filterCrop===k?700:400,whiteSpace:"nowrap",flexShrink:0}}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      {/* CONTENIDO */}
      <div style={{padding:"0 12px",display:"flex",flexDirection:"column",gap:10}}>

        {tab==="kpis" && (
          <>
            {/* Ingresos totales - hero card */}
            <div style={{...cardBase,background:"linear-gradient(135deg,#27ae60,#2ecc71)",color:"#fff",padding:"20px 18px"}}>
              <div style={{fontSize:11,opacity:0.85,letterSpacing:0.5,textTransform:"uppercase",marginBottom:6}}>💰 Ingresos totales</div>
              <div style={{fontSize:30,fontWeight:700,fontFamily:"'Courier New',monospace"}}>${fmt(data.totalIngresos)}</div>
              <div style={{fontSize:11,opacity:0.85,marginTop:4}}>Incluye ventas + seguros pagados</div>
            </div>

            {/* Grid 2x2 KPIs principales */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{...cardBase}}>
                <div style={{fontSize:10,color:"#888",textTransform:"uppercase",marginBottom:4}}>🧺 Kg vendidos</div>
                <div style={{fontSize:20,fontWeight:700,color:"#2980b9",fontFamily:"'Courier New',monospace"}}>{fmtInt(data.totalKgVendidos)} kg</div>
              </div>
              <div style={{...cardBase}}>
                <div style={{fontSize:10,color:"#888",textTransform:"uppercase",marginBottom:4}}>🌾 Cosechado</div>
                <div style={{fontSize:20,fontWeight:700,color:"#8e44ad",fontFamily:"'Courier New',monospace"}}>{fmtInt(data.totalKgCosechados)} kg</div>
              </div>
              <div style={{...cardBase}}>
                <div style={{fontSize:10,color:"#888",textTransform:"uppercase",marginBottom:4}}>📅 Ventas hoy</div>
                <div style={{fontSize:20,fontWeight:700,color:"#f39c12",fontFamily:"'Courier New',monospace"}}>{data.ventasHoy}</div>
                <div style={{fontSize:10,color:"#aaa",marginTop:2,fontFamily:"'Courier New',monospace"}}>${fmt(data.ingresosHoy)}</div>
              </div>
              <div style={{...cardBase,border:`2px solid ${data.rbcGlobal>=1?"#27ae60":data.rbcGlobal>0?"#e74c3c":"#ddd"}`}}>
                <div style={{fontSize:10,color:"#888",textTransform:"uppercase",marginBottom:4}}>💼 RBC</div>
                <div style={{fontSize:22,fontWeight:900,color:data.rbcGlobal>=1?"#27ae60":data.rbcGlobal>0?"#c0392b":"#888",fontFamily:"'Courier New',monospace"}}>{data.rbcGlobal.toFixed(2)}</div>
                <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{data.rbcGlobal>=1?"Rentable ✓":data.rbcGlobal>0?"Pérdida ⚠":"Sin costos"}</div>
              </div>
            </div>

            {/* Pérdidas */}
            {(data.totalMerma>0 || data.totalSiniestro>0) && (
              <div style={{...cardBase}}>
                <div style={{fontSize:11,color:"#888",textTransform:"uppercase",marginBottom:10,fontWeight:600}}>⚠ Pérdidas registradas</div>
                <div style={{display:"flex",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,color:"#aaa"}}>Merma</div>
                    <div style={{fontSize:16,fontWeight:700,color:"#f39c12",fontFamily:"'Courier New',monospace"}}>{fmtInt(data.totalMerma)} kg</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,color:"#aaa"}}>Siniestro</div>
                    <div style={{fontSize:16,fontWeight:700,color:"#2980b9",fontFamily:"'Courier New',monospace"}}>{fmtInt(data.totalSiniestro)} kg</div>
                  </div>
                </div>
              </div>
            )}

            {/* Ganancia neta */}
            {data.costoTotal>0 && (
              <div style={{...cardBase,background:data.gNeta>=0?"#eafaf1":"#fdedec",border:`2px solid ${data.gNeta>=0?"#27ae60":"#e74c3c"}`}}>
                <div style={{fontSize:11,color:data.gNeta>=0?"#27ae60":"#c0392b",textTransform:"uppercase",fontWeight:700,marginBottom:6}}>
                  {data.gNeta>=0?"✅ Ganancia neta":"❌ Pérdida"}
                </div>
                <div style={{fontSize:24,fontWeight:700,color:data.gNeta>=0?"#27ae60":"#c0392b",fontFamily:"'Courier New',monospace"}}>${fmt(data.gNeta)}</div>
                <div style={{fontSize:10,color:"#888",marginTop:4}}>Costo invertido: <strong>${fmt(data.costoTotal)}</strong></div>
              </div>
            )}
          </>
        )}

        {tab==="stock" && (
          <>
            <div style={{fontSize:11,fontWeight:700,color:"#888",letterSpacing:0.3,padding:"4px 4px 0"}}>STOCK DISPONIBLE POR CULTIVO</div>
            {Object.entries(data.stockPorCultivo).filter(([k,d])=>d.kgCos>0).map(([k,d])=>{
              const c = CROPS[k];
              const pctVendido = d.kgCos>0 ? (d.kgVen/d.kgCos)*100 : 0;
              return (
                <div key={k} style={{...cardBase,borderLeft:`4px solid ${c.color}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{fontSize:22}}>{c.emoji}</span>
                    <span style={{fontSize:15,fontWeight:700,color:c.color,flex:1}}>{c.name}</span>
                    <span style={{fontSize:14,fontWeight:700,color:"#27ae60",fontFamily:"'Courier New',monospace"}}>{fmtInt(d.stock)} kg</span>
                  </div>
                  <div style={{display:"flex",gap:8,fontSize:10,color:"#888",marginBottom:8}}>
                    <span>Cosechado: <strong style={{color:"#8e44ad",fontFamily:"'Courier New',monospace"}}>{fmtInt(d.kgCos)}</strong></span>
                    <span>Vendido: <strong style={{color:"#2980b9",fontFamily:"'Courier New',monospace"}}>{fmtInt(d.kgVen)}</strong></span>
                  </div>
                  <div style={{height:6,background:"#f0f0f0",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pctVendido}%`,background:c.color,transition:"width 0.3s"}}/>
                  </div>
                  <div style={{fontSize:10,color:"#aaa",marginTop:4,textAlign:"right"}}>{pctVendido.toFixed(0)}% vendido</div>
                </div>
              );
            })}
            {!Object.entries(data.stockPorCultivo).some(([k,d])=>d.kgCos>0) && (
              <div style={{...cardBase,textAlign:"center",color:"#aaa",padding:"30px 16px"}}>
                <div style={{fontSize:36,marginBottom:8}}>📦</div>
                <div>Sin cosechas registradas</div>
              </div>
            )}
          </>
        )}

        {tab==="rbc" && (
          <>
            <div style={{fontSize:11,fontWeight:700,color:"#888",letterSpacing:0.3,padding:"4px 4px 0"}}>RBC POR CULTIVO</div>
            {Object.entries(data.rbcPorCultivo).filter(([k,d])=>d.costo>0||d.ingresos>0).map(([k,d])=>{
              const c = CROPS[k];
              const rbc = d.costo>0 ? d.ingresos/d.costo : 0;
              const neta = d.ingresos - d.costo;
              return (
                <div key={k} style={{...cardBase,borderLeft:`4px solid ${c.color}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{fontSize:22}}>{c.emoji}</span>
                    <span style={{fontSize:15,fontWeight:700,color:c.color,flex:1}}>{c.name}</span>
                    <div style={{background:rbc>=1?"#eafaf1":"#fdedec",border:`2px solid ${rbc>=1?"#27ae60":"#e74c3c"}`,borderRadius:8,padding:"4px 10px"}}>
                      <div style={{fontSize:14,fontWeight:700,color:rbc>=1?"#27ae60":"#c0392b",fontFamily:"'Courier New',monospace"}}>{rbc.toFixed(2)}</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                    <div style={{background:"#fef9e7",borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:"#888"}}>Costo</div>
                      <div style={{fontSize:12,fontWeight:700,color:"#b7950b",fontFamily:"'Courier New',monospace"}}>${fmt(d.costo)}</div>
                    </div>
                    <div style={{background:"#eafaf1",borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:"#888"}}>Ingreso</div>
                      <div style={{fontSize:12,fontWeight:700,color:"#27ae60",fontFamily:"'Courier New',monospace"}}>${fmt(d.ingresos)}</div>
                    </div>
                    <div style={{background:neta>=0?"#eafaf1":"#fdedec",borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:"#888"}}>Neta</div>
                      <div style={{fontSize:12,fontWeight:700,color:neta>=0?"#27ae60":"#c0392b",fontFamily:"'Courier New',monospace"}}>${fmt(neta)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!Object.entries(data.rbcPorCultivo).some(([k,d])=>d.costo>0||d.ingresos>0) && (
              <div style={{...cardBase,textAlign:"center",color:"#aaa",padding:"30px 16px"}}>
                <div style={{fontSize:36,marginBottom:8}}>💼</div>
                <div>Configura costos en los lotes para ver el RBC</div>
              </div>
            )}
          </>
        )}

        {tab==="tareas" && (
          <>
            {/* Resumen */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <div style={{...cardBase,background:"#fef9e7",border:"1px solid #f9e79f",textAlign:"center",padding:"12px 8px"}}>
                <div style={{fontSize:22,fontWeight:900,color:"#f39c12"}}>{data.tareasPendientes.length}</div>
                <div style={{fontSize:10,color:"#888",fontWeight:600}}>Pendientes</div>
              </div>
              <div style={{...cardBase,background:"#eafaf1",border:"1px solid #a9dfbf",textAlign:"center",padding:"12px 8px"}}>
                <div style={{fontSize:22,fontWeight:900,color:"#27ae60"}}>{data.tareasCompletadas.length}</div>
                <div style={{fontSize:10,color:"#888",fontWeight:600}}>Cumplidas</div>
              </div>
              <div style={{...cardBase,background:"#fdedec",border:"1px solid #f5b7b1",textAlign:"center",padding:"12px 8px"}}>
                <div style={{fontSize:22,fontWeight:900,color:"#c0392b"}}>{data.tareasVencidas.length}</div>
                <div style={{fontSize:10,color:"#888",fontWeight:600}}>Vencidas</div>
              </div>
            </div>

            {/* Lista de pendientes */}
            {data.tareasPendientes.length>0 && (
              <>
                <div style={{fontSize:11,fontWeight:700,color:"#888",letterSpacing:0.3,padding:"8px 4px 0"}}>⏳ PENDIENTES</div>
                {data.tareasPendientes.slice(0,15).map(t => {
                  const today = new Date().toISOString().slice(0,10);
                  const isOverdue = t.fechaLimite && t.fechaLimite < today;
                  const tipoIcon = {tarea:"📋",instruccion:"📖",aviso:"📢"}[t.tipo||"tarea"];
                  const priColor = {alta:"#e74c3c",baja:"#27ae60",normal:"#888"}[t.priority||"normal"];
                  const asignados = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
                  return (
                    <div key={t.id} style={{...cardBase,borderLeft:`3px solid ${priColor}`,padding:"10px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6,marginBottom:4}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#222",flex:1}}>
                          {tipoIcon} {t.title}
                        </div>
                        {isOverdue && <span style={{background:"#fdedec",color:"#c0392b",fontSize:9,padding:"2px 6px",borderRadius:5,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>VENCIDA</span>}
                      </div>
                      {t.description && <div style={{fontSize:11,color:"#666",marginBottom:6,whiteSpace:"pre-wrap"}}>{t.description.length>120?t.description.slice(0,120)+"...":t.description}</div>}
                      <div style={{display:"flex",gap:8,fontSize:10,color:"#888",flexWrap:"wrap"}}>
                        <span>👥 {asignados.length>1?`${asignados.length} trabajadores`:asignados.join(", ")||"todos"}</span>
                        {t.fechaLimite && <span style={{color:isOverdue?"#c0392b":"#888",fontWeight:isOverdue?700:400}}>⏰ {t.fechaLimite}</span>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Lista de cumplidas recientes */}
            {data.tareasCompletadas.length>0 && (
              <>
                <div style={{fontSize:11,fontWeight:700,color:"#888",letterSpacing:0.3,padding:"8px 4px 0"}}>✓ CUMPLIDAS RECIENTES</div>
                {data.tareasCompletadas.slice(0,8).map(t => {
                  const tipoIcon = {tarea:"📋",instruccion:"📖",aviso:"📢"}[t.tipo||"tarea"];
                  const completos = Array.isArray(t.completedBy) ? t.completedBy : [t.completedBy];
                  return (
                    <div key={t.id} style={{...cardBase,opacity:0.7,padding:"8px 14px"}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#27ae60",marginBottom:2}}>
                        ✓ {tipoIcon} {t.title}
                      </div>
                      <div style={{fontSize:10,color:"#888"}}>Por: {completos.join(", ")}</div>
                    </div>
                  );
                })}
              </>
            )}

            {!tasks.length && (
              <div style={{...cardBase,textAlign:"center",color:"#aaa",padding:"30px 16px"}}>
                <div style={{fontSize:36,marginBottom:8}}>✅</div>
                <div>Sin tareas registradas</div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"1px solid #e0e0e0",display:"flex",justifyContent:"space-around",padding:"6px 0",boxShadow:"0 -2px 8px rgba(0,0,0,0.05)",zIndex:10}}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,background:"transparent",border:"none",padding:"8px 2px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,color:tab===t.id?"#27ae60":"#888"}}>
            <span style={{fontSize:22}}>{t.emoji}</span>
            <span style={{fontSize:10,fontWeight:tab===t.id?700:500}}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


export default function MobileDashboard(props) {
  return <MobileErrorBoundary><MobileDashboardInner {...props}/></MobileErrorBoundary>;
}
