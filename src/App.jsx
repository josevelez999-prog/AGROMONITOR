import { useState, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ─── DATA ─────────────────────────────────────────────────────────────────────
const CROPS = {
  jitomate:  { name:"Jitomate",  emoji:"🍅", color:"#c0392b", ph:{min:5.5,max:6.5}, ce:{min:2.5,max:4.0} },
  fresa:     { name:"Fresa",     emoji:"🍓", color:"#e74c3c", ph:{min:5.5,max:6.5}, ce:{min:1.0,max:2.0} },
  arandano:  { name:"Arándano",  emoji:"🫐", color:"#2980b9", ph:{min:4.5,max:5.5}, ce:{min:1.0,max:2.0} },
  zarzamora: { name:"Zarzamora", emoji:"🫐", color:"#8e44ad", ph:{min:5.5,max:6.5}, ce:{min:1.5,max:2.5} },
};
const CROP_NUTRIENTS = {
  jitomate:  "N alto, K alto en fructificación, Ca para firmeza. pH 5.5-6.5, CE 2.5-4.0 mS/cm",
  fresa:     "N bajo en maduración, K alto, Ca y B para calidad. pH 5.5-6.5, CE 1.0-2.0 mS/cm",
  arandano:  "pH ácido crítico (4.5-5.5), N amoniacal, S para acidificación. CE 1.0-2.0 mS/cm",
  zarzamora: "N moderado, K alto en maduración, Fe quelado. pH 5.5-6.5, CE 1.5-2.5 mS/cm",
};
const READINGS = [
  { id:1,  crop:"jitomate",  zone:"Zona A", ph:6.1, ce:3.2, date:"2026-03-24", worker:"Carlos" },
  { id:2,  crop:"fresa",     zone:"Zona B", ph:5.8, ce:1.6, date:"2026-03-24", worker:"María"  },
  { id:3,  crop:"arandano",  zone:"Zona C", ph:4.8, ce:1.4, date:"2026-03-24", worker:"Luis"   },
  { id:4,  crop:"zarzamora", zone:"Zona D", ph:6.0, ce:2.1, date:"2026-03-24", worker:"Carlos" },
  { id:5,  crop:"jitomate",  zone:"Zona A", ph:6.3, ce:3.5, date:"2026-03-25", worker:"María"  },
  { id:6,  crop:"fresa",     zone:"Zona B", ph:6.1, ce:1.8, date:"2026-03-25", worker:"Luis"   },
  { id:7,  crop:"arandano",  zone:"Zona C", ph:5.0, ce:1.5, date:"2026-03-25", worker:"Carlos" },
  { id:8,  crop:"jitomate",  zone:"Zona A", ph:7.2, ce:4.8, date:"2026-03-26", worker:"Luis",  notes:"Hojas amarillas" },
  { id:9,  crop:"fresa",     zone:"Zona B", ph:5.7, ce:1.5, date:"2026-03-26", worker:"María"  },
  { id:10, crop:"zarzamora", zone:"Zona D", ph:6.2, ce:2.3, date:"2026-03-26", worker:"Carlos" },
  { id:11, crop:"arandano",  zone:"Zona C", ph:5.9, ce:2.4, date:"2026-03-27", worker:"Luis"   },
  { id:12, crop:"jitomate",  zone:"Zona A", ph:6.4, ce:3.3, date:"2026-03-27", worker:"María"  },
  { id:13, crop:"fresa",     zone:"Zona B", ph:4.8, ce:0.8, date:"2026-03-28", worker:"Carlos", notes:"Raíz pálida" },
  { id:14, crop:"zarzamora", zone:"Zona D", ph:6.1, ce:2.0, date:"2026-03-28", worker:"Luis"   },
  { id:15, crop:"jitomate",  zone:"Zona A", ph:6.2, ce:3.1, date:"2026-03-29", worker:"Carlos" },
  { id:16, crop:"arandano",  zone:"Zona C", ph:5.1, ce:1.6, date:"2026-03-29", worker:"María"  },
  { id:17, crop:"fresa",     zone:"Zona B", ph:5.9, ce:1.7, date:"2026-03-29", worker:"Luis"   },
  { id:18, crop:"jitomate",  zone:"Zona A", ph:6.0, ce:3.0, date:"2026-03-30", worker:"Carlos" },
];

// ─── FORMULATOR ───────────────────────────────────────────────────────────────
const ANIONS   = ["NO3","H2PO4","SO4","HCO3","Cl"];
const CATIONS  = ["NH4","K","Ca","Mg","Na"];
const ALL_IONS = [...ANIONS,...CATIONS];
const ION_LABELS = { NO3:"NO₃⁻",H2PO4:"H₂PO₄⁻",SO4:"SO₄²⁻",HCO3:"HCO₃⁻",Cl:"Cl⁻",NH4:"NH₄⁺",K:"K⁺",Ca:"Ca²⁺",Mg:"Mg²⁺",Na:"Na⁺" };
const CROP_NUT = {
  jitomate:  {NO3:11,H2PO4:1.5,SO4:8,  HCO3:0,Cl:0,NH4:1,  K:8.5,Ca:9,Mg:5,Na:0},
  fresa:     {NO3:7, H2PO4:1.5,SO4:3,  HCO3:0,Cl:0,NH4:0.5,K:4.5,Ca:4,Mg:2,Na:0},
  arandano:  {NO3:5, H2PO4:1,  SO4:2,  HCO3:0,Cl:0,NH4:0.5,K:3,  Ca:2,Mg:1,Na:0},
  zarzamora: {NO3:7, H2PO4:1,  SO4:3.5,HCO3:0,Cl:0,NH4:0.5,K:4,  Ca:4,Mg:2,Na:0},
};
const DEF_WATER = {NO3:0,H2PO4:0,SO4:1.55,HCO3:2.25,Cl:0.5,NH4:0,K:0.2,Ca:1,Mg:1.23,Na:1.58};
const FERTS_INIT = [
  {id:"ca_no3", name:"Ca(NO₃)₂·4H₂O",ions:{NO3:1,Ca:1,NH4:0.074},Peq:118, type:"solid", meq:8,  active:true},
  {id:"kno3",   name:"KNO₃",          ions:{NO3:1,K:1},            Peq:101, type:"solid", meq:3,  active:true},
  {id:"k2so4",  name:"K₂SO₄",         ions:{SO4:1,K:1},            Peq:87,  type:"solid", meq:3.8,active:true},
  {id:"mgso4",  name:"MgSO₄·7H₂O",    ions:{SO4:1,Mg:1},           Peq:123, type:"solid", meq:3.8,active:true},
  {id:"kh2po4", name:"KH₂PO₄",        ions:{H2PO4:1,K:1},          Peq:136, type:"solid", meq:1.5,active:true},
  {id:"h2so4",  name:"H₂SO₄ (98%)",   ions:{SO4:1},                Peq:49,  type:"liquid",meq:1.7,active:true,density:1.85,richness:98},
  {id:"hno3",   name:"HNO₃ (70%)",    ions:{NO3:1},                Peq:63,  type:"liquid",meq:0,  active:false,density:1.42,richness:70},
  {id:"nh4no3", name:"NH₄NO₃",        ions:{NO3:1,NH4:1},          Peq:80,  type:"solid", meq:0,  active:false},
  {id:"mgno3",  name:"Mg(NO₃)₂·6H₂O", ions:{NO3:1,Mg:1},           Peq:128, type:"solid", meq:0,  active:false},
  {id:"kcl",    name:"KCl",            ions:{K:1,Cl:1},             Peq:74.56,type:"solid",meq:0,  active:false},
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const n = (v,d=2) => Number(parseFloat(v||0).toFixed(d));
const getStatus = (value, range) => {
  if (value < range.min || value > range.max) return "danger";
  const m = (range.max - range.min) * 0.15;
  return (value < range.min + m || value > range.max - m) ? "warning" : "ok";
};
const SC = { ok:"#27ae60", warning:"#f39c12", danger:"#e74c3c" };
const SB = { ok:"#eafaf1", warning:"#fef9e7", danger:"#fdedec" };
const SL = { ok:"OK", warning:"Alerta", danger:"Crítico" };

function Badge({ status, small }) {
  return (
    <span style={{background:SB[status],color:SC[status],border:`1px solid ${SC[status]}44`,borderRadius:20,
      padding:small?"1px 7px":"3px 10px",fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap",fontFamily:"'Courier New',monospace"}}>
      {status==="danger"?"✗":status==="warning"?"⚠":"✓"} {SL[status]}
    </span>
  );
}
function MiniSparkline({ data, color }) {
  if (!data||data.length<2) return null;
  const min=Math.min(...data),max=Math.max(...data),range=max-min||1,w=80,h=28;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/range)*h}`).join(" ");
  return (
    <svg width={w} height={h} style={{overflow:"visible"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round"/>
      <circle cx={w} cy={h-((data[data.length-1]-min)/range)*h} r={2.5} fill={color}/>
    </svg>
  );
}

// ─── SECTIONS ──────────────────────────────────────────────────────────────────
function Resumen({ readings }) {
  const alerts   = readings.filter(r=>{ const c=CROPS[r.crop]; return getStatus(r.ph,c.ph)==="danger"||getStatus(r.ce,c.ce)==="danger"; });
  const warnings = readings.filter(r=>{ const c=CROPS[r.crop]; const p=getStatus(r.ph,c.ph),cs=getStatus(r.ce,c.ce); return (p==="warning"||cs==="warning")&&p!=="danger"&&cs!=="danger"; });
  const latestByCrop = Object.keys(CROPS).map(k=>{ const recs=readings.filter(r=>r.crop===k).sort((a,b)=>b.date.localeCompare(a.date)); return {key:k,...recs[0]}; }).filter(r=>r.ph);
  const byWorker = {};
  readings.forEach(r=>{ byWorker[r.worker]=(byWorker[r.worker]||0)+1; });

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        {[{l:"Mediciones",v:readings.length,c:"#27ae60",i:"📊"},{l:"Alertas críticas",v:alerts.length,c:"#e74c3c",i:"🚨"},
          {l:"Advertencias",v:warnings.length,c:"#f39c12",i:"⚠️"},{l:"Trabajadores",v:Object.keys(byWorker).length,c:"#2980b9",i:"👤"}].map(k=>(
          <div key={k.l} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px"}}>
            <div style={{fontSize:22}}>{k.i}</div>
            <div style={{fontSize:28,fontWeight:700,color:k.c,fontFamily:"'Courier New',monospace",lineHeight:1.1,marginTop:4}}>{k.v}</div>
            <div style={{fontSize:11,color:"#888",marginTop:2}}>{k.l}</div>
          </div>
        ))}
      </div>
      {alerts.length>0&&(
        <div style={{background:"#fff",border:"1px solid #f5c6c6",borderLeft:"4px solid #e74c3c",borderRadius:12,padding:"14px 18px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#c0392b",marginBottom:10,letterSpacing:0.5}}>🚨 ALERTAS CRÍTICAS</div>
          {alerts.map(r=>{ const c=CROPS[r.crop]; return (
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #fdecea",flexWrap:"wrap"}}>
              <span style={{fontSize:18}}>{c.emoji}</span>
              <div style={{flex:1}}><span style={{fontWeight:600,color:c.color}}>{c.name}</span><span style={{color:"#888",fontSize:12,marginLeft:6}}>{r.zone} · {r.worker} · {r.date}</span></div>
              <span style={{fontFamily:"'Courier New',monospace",fontSize:12,color:"#e74c3c"}}>pH {r.ph} · CE {r.ce}</span>
              <Badge status="danger" small/>
            </div>
          ); })}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:16}}>
        {latestByCrop.map(r=>{ const c=CROPS[r.key]; const ps=getStatus(r.ph,c.ph),cs=getStatus(r.ce,c.ce); const ov=ps==="danger"||cs==="danger"?"danger":ps==="warning"||cs==="warning"?"warning":"ok"; const hist=readings.filter(x=>x.crop===r.key).sort((a,b)=>a.date.localeCompare(b.date)).map(x=>x.ph); return (
          <div key={r.key} style={{background:"#fff",border:`1px solid ${SC[ov]}33`,borderTop:`3px solid ${c.color}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div><div style={{fontWeight:700,color:c.color,fontSize:14}}>{c.emoji} {c.name}</div><div style={{fontSize:10,color:"#999",marginTop:1}}>{r.zone} · {r.date}</div></div>
              <Badge status={ov} small/>
            </div>
            <div style={{display:"flex",gap:12,marginBottom:8}}>
              <div style={{textAlign:"center",flex:1}}><div style={{fontSize:10,color:"#aaa",fontFamily:"'Courier New',monospace"}}>pH</div><div style={{fontSize:22,fontWeight:700,color:SC[ps],fontFamily:"'Courier New',monospace",lineHeight:1}}>{r.ph}</div></div>
              <div style={{textAlign:"center",flex:1}}><div style={{fontSize:10,color:"#aaa",fontFamily:"'Courier New',monospace"}}>CE mS/cm</div><div style={{fontSize:22,fontWeight:700,color:SC[cs],fontFamily:"'Courier New',monospace",lineHeight:1}}>{r.ce}</div></div>
              <div style={{display:"flex",alignItems:"center"}}><MiniSparkline data={hist} color={c.color}/></div>
            </div>
            <div style={{fontSize:10,color:"#bbb",fontFamily:"'Courier New',monospace"}}>Registró: {r.worker}</div>
          </div>
        ); })}
      </div>
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:10,letterSpacing:0.3}}>ACTIVIDAD RECIENTE</div>
        {[...readings].reverse().slice(0,6).map(r=>{ const c=CROPS[r.crop]; const s=getStatus(r.ph,c.ph)==="danger"||getStatus(r.ce,c.ce)==="danger"?"danger":getStatus(r.ph,c.ph)==="warning"||getStatus(r.ce,c.ce)==="warning"?"warning":"ok"; return (
          <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #f5f5f5",flexWrap:"wrap"}}>
            <span style={{fontSize:16}}>{c.emoji}</span>
            <div style={{flex:1,minWidth:100}}><span style={{fontSize:12,fontWeight:600}}>{r.worker}</span><span style={{fontSize:11,color:"#999",marginLeft:6}}>{c.name} · {r.zone}</span></div>
            <span style={{fontFamily:"'Courier New',monospace",fontSize:11,color:"#666"}}>pH {r.ph} · CE {r.ce}</span>
            <span style={{fontSize:11,color:"#bbb"}}>{r.date}</span><Badge status={s} small/>
          </div>
        ); })}
      </div>
    </div>
  );
}

function Alertas({ readings }) {
  const [filter,setFilter]=useState("all");
  const allAlerts=readings.map(r=>{ const c=CROPS[r.crop]; const ps=getStatus(r.ph,c.ph),cs=getStatus(r.ce,c.ce); const s=ps==="danger"||cs==="danger"?"danger":ps==="warning"||cs==="warning"?"warning":null; return s?{...r,status:s,phStatus:ps,ceStatus:cs}:null; }).filter(Boolean).sort((a,b)=>({danger:0,warning:1}[a.status]-({danger:0,warning:1}[b.status])||b.date.localeCompare(a.date)));
  const filtered=filter==="all"?allAlerts:allAlerts.filter(r=>r.status===filter);
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["all","Todas","#555"],["danger","Críticas","#e74c3c"],["warning","Advertencias","#f39c12"]].map(([val,label,color])=>(
          <button key={val} onClick={()=>setFilter(val)} style={{padding:"7px 16px",border:`1px solid ${filter===val?color:"#e0e0e0"}`,borderRadius:20,background:filter===val?color+"18":"transparent",color:filter===val?color:"#666",cursor:"pointer",fontSize:12,fontWeight:500}}>
            {label} {val==="all"?allAlerts.length:allAlerts.filter(r=>r.status===val).length}
          </button>
        ))}
      </div>
      {filtered.length===0?(<div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa"}}><div style={{fontSize:40,marginBottom:8}}>✅</div><div>Sin alertas en esta categoría</div></div>
      ):filtered.map(r=>{ const c=CROPS[r.crop]; return (
        <div key={r.id} style={{background:"#fff",border:`1px solid ${SC[r.status]}33`,borderLeft:`4px solid ${SC[r.status]}`,borderRadius:12,padding:"14px 18px",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:24}}>{c.emoji}</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}><span style={{fontWeight:700,color:c.color,fontSize:14}}>{c.name}</span><span style={{color:"#999",fontSize:12}}>— {r.zone}</span><Badge status={r.status} small/></div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:4}}>
                <span style={{fontFamily:"'Courier New',monospace",fontSize:13,color:SC[r.phStatus]}}>pH {r.ph} <span style={{fontSize:10,color:"#aaa"}}>(rango {c.ph.min}–{c.ph.max})</span></span>
                <span style={{fontFamily:"'Courier New',monospace",fontSize:13,color:SC[r.ceStatus]}}>CE {r.ce} mS/cm <span style={{fontSize:10,color:"#aaa"}}>(rango {c.ce.min}–{c.ce.max})</span></span>
              </div>
              {r.notes&&<div style={{fontSize:12,color:"#e67e22",marginTop:2}}>📝 {r.notes}</div>}
              <div style={{fontSize:11,color:"#bbb",marginTop:4}}>Registró: <strong style={{color:"#888"}}>{r.worker}</strong> · {r.date}</div>
            </div>
            <div style={{background:SB[r.status],borderRadius:8,padding:"8px 12px",fontSize:11,color:SC[r.status],maxWidth:180}}>
              <div style={{fontWeight:700,marginBottom:3}}>{r.status==="danger"?"Acción inmediata":"Monitorear"}</div>
              {r.status==="danger"&&r.phStatus==="danger"&&<div>• {r.ph>c.ph.max?"Bajar":"Subir"} pH con ajustador</div>}
              {r.status==="danger"&&r.ceStatus==="danger"&&<div>• {r.ce>c.ce.max?"Diluir solución":"Aumentar CE"}</div>}
              {r.status==="warning"&&<div>• Revisar próxima medición</div>}
            </div>
          </div>
        </div>
      ); })}
    </div>
  );
}

function Reportes({ readings }) {
  const [cropFilter,setCropFilter]=useState("jitomate");
  const [metric,setMetric]=useState("ph");
  const chartData=useMemo(()=>{ const byCrop=readings.filter(r=>r.crop===cropFilter).sort((a,b)=>a.date.localeCompare(b.date)); const grouped={}; byCrop.forEach(r=>{ if(!grouped[r.date]) grouped[r.date]={date:r.date,phVals:[],ceVals:[]}; grouped[r.date].phVals.push(r.ph); grouped[r.date].ceVals.push(r.ce); }); return Object.values(grouped).map(d=>({date:d.date.slice(5),ph:n(d.phVals.reduce((s,v)=>s+v,0)/d.phVals.length),ce:n(d.ceVals.reduce((s,v)=>s+v,0)/d.ceVals.length)})); },[readings,cropFilter]);
  const crop=CROPS[cropFilter]; const yDomain=metric==="ph"?[3.5,8.5]:[0,6]; const refMin=metric==="ph"?crop.ph.min:crop.ce.min; const refMax=metric==="ph"?crop.ph.max:crop.ce.max;
  const stats=useMemo(()=>{ const vals=readings.filter(r=>r.crop===cropFilter).map(r=>r[metric]); if(!vals.length) return {}; const avg=n(vals.reduce((s,v)=>s+v,0)/vals.length); const min=n(Math.min(...vals)),max=n(Math.max(...vals)); const out=vals.filter(v=>metric==="ph"?(v<crop.ph.min||v>crop.ph.max):(v<crop.ce.min||v>crop.ce.max)).length; return {avg,min,max,out,total:vals.length}; },[readings,cropFilter,metric]);
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(CROPS).map(([k,c])=>(<button key={k} onClick={()=>setCropFilter(k)} style={{padding:"7px 14px",border:`1px solid ${cropFilter===k?c.color:"#e0e0e0"}`,borderRadius:20,background:cropFilter===k?c.color+"18":"transparent",color:cropFilter===k?c.color:"#666",cursor:"pointer",fontSize:12,fontWeight:500}}>{c.emoji} {c.name}</button>))}</div>
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>{[["ph","pH"],["ce","CE"]].map(([v,l])=>(<button key={v} onClick={()=>setMetric(v)} style={{padding:"7px 14px",border:`1px solid ${metric===v?"#2c3e50":"#e0e0e0"}`,borderRadius:20,background:metric===v?"#2c3e50":"transparent",color:metric===v?"#fff":"#666",cursor:"pointer",fontSize:12,fontWeight:500}}>{l}</button>))}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {[{l:"Promedio",v:stats.avg,c:crop.color},{l:"Mínimo",v:stats.min,c:"#2980b9"},{l:"Máximo",v:stats.max,c:"#8e44ad"},{l:"Fuera rango",v:stats.out,c:"#e74c3c"},{l:"Total",v:stats.total,c:"#27ae60"}].map(s=>(<div key={s.l} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:"12px 14px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:s.c,fontFamily:"'Courier New',monospace"}}>{s.v}</div><div style={{fontSize:10,color:"#aaa",marginTop:2}}>{s.l}</div></div>))}
      </div>
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"20px",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:16,letterSpacing:0.3}}>TENDENCIA {metric.toUpperCase()} — {crop.emoji} {crop.name}</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{top:5,right:20,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="date" tick={{fontSize:11,fill:"#aaa"}} axisLine={false} tickLine={false}/>
            <YAxis domain={yDomain} tick={{fontSize:11,fill:"#aaa"}} axisLine={false} tickLine={false} width={32}/>
            <Tooltip contentStyle={{fontSize:12,border:"1px solid #e0e0e0",borderRadius:8}} labelStyle={{fontWeight:700}}/>
            <ReferenceLine y={refMin} stroke="#f39c12" strokeDasharray="4 2" label={{value:`Mín`,fill:"#f39c12",fontSize:10,position:"right"}}/>
            <ReferenceLine y={refMax} stroke="#f39c12" strokeDasharray="4 2" label={{value:`Máx`,fill:"#f39c12",fontSize:10,position:"right"}}/>
            <Line type="monotone" dataKey={metric} stroke={crop.color} strokeWidth={2.5} dot={{r:4,fill:crop.color}} activeDot={{r:6}}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:10,letterSpacing:0.3}}>HISTORIAL — {crop.emoji} {crop.name}</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{borderBottom:"1px solid #f0f0f0"}}>{["Fecha","Zona","pH","CE","Estado","Trabajador","Notas"].map(h=>(<th key={h} style={{padding:"7px 10px",textAlign:"left",color:"#aaa",fontWeight:500,whiteSpace:"nowrap",fontSize:11}}>{h}</th>))}</tr></thead>
            <tbody>{[...readings].filter(r=>r.crop===cropFilter).reverse().map(r=>{ const c=CROPS[r.crop]; const ps=getStatus(r.ph,c.ph),cs=getStatus(r.ce,c.ce); const s=ps==="danger"||cs==="danger"?"danger":ps==="warning"||cs==="warning"?"warning":"ok"; return (<tr key={r.id} style={{borderBottom:"1px solid #fafafa"}}><td style={{padding:"8px 10px",fontFamily:"'Courier New',monospace",fontSize:11,color:"#999"}}>{r.date}</td><td style={{padding:"8px 10px",color:"#888"}}>{r.zone}</td><td style={{padding:"8px 10px",fontFamily:"'Courier New',monospace",fontWeight:700,color:SC[ps]}}>{r.ph}</td><td style={{padding:"8px 10px",fontFamily:"'Courier New',monospace",fontWeight:700,color:SC[cs]}}>{r.ce}</td><td style={{padding:"8px 10px"}}><Badge status={s} small/></td><td style={{padding:"8px 10px",color:"#888"}}>{r.worker}</td><td style={{padding:"8px 10px",color:"#e67e22",fontSize:11}}>{r.notes||"—"}</td></tr>); })}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── AI DIAGNOSTICS ───────────────────────────────────────────────────────────
const DEMO_DIAGNOSES = [
  { id:1, crop:"jitomate", zone:"Zona A", worker:"Luis", date:"2026-03-26", ph:7.2, ce:4.8, notes:"Hojas amarillas", status:"done",
    result:{ diagnostico:"Clorosis por pH elevado / posible deficiencia de Fe", severidad:"alta",
      causas:["pH demasiado alto (7.2) bloquea absorción de Fe, Mn y Zn","CE elevada indica exceso de sales — posible toxicidad"],
      acciones:["Bajar pH a 6.0-6.2 con H₂SO₄ o HNO₃","Renovar parcialmente la solución nutritiva (30-40%)","Aplicar Fe quelado foliar como medida de rescate","Revisar sistema de dosificación de fertilizantes"],
      ajuste_ph:"bajar", ajuste_ce:"bajar", urgencia:"Zona A en riesgo alto — requiere ajuste hoy" }},
  { id:2, crop:"fresa", zone:"Zona B", worker:"Carlos", date:"2026-03-28", ph:4.8, ce:0.8, notes:"Raíz pálida",  status:"done",
    result:{ diagnostico:"Deficiencia nutricional generalizada + posible pudrición radicular", severidad:"alta",
      causas:["pH muy bajo (4.8) — fuera de rango óptimo para fresa","CE muy baja (0.8) indica falta severa de nutrientes","Raíces pálidas sugieren inicio de Pythium o Fusarium"],
      acciones:["Subir pH a 5.8-6.0 con KOH o Ca(OH)₂","Aumentar CE a 1.5 mS/cm con solución fresca","Aplicar fungicida preventivo (Fosetil-Al o Metalaxil)","Revisar sistema de drenaje y aireación"],
      ajuste_ph:"subir", ajuste_ce:"subir", urgencia:"Zona B crítica — posible pérdida de planta si no se actúa en 24h" }},
];

function DiagnosticoIA() {
  const fileRef = useRef();
  const [diagnoses, setDiagnoses] = useState(DEMO_DIAGNOSES);
  const [form, setForm] = useState({ crop:"jitomate", zone:"", worker:"", ph:"", ce:"", notes:"" });
  const [imgPreview, setImgPreview] = useState(null);
  const [imgBase64, setImgBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("historial"); // historial | nuevo

  const handleImage = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setImgPreview(ev.target.result); setImgBase64(ev.target.result.split(",")[1]); };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!imgBase64) return;
    setLoading(true);
    const crop = CROPS[form.crop];
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{ role:"user", content:[
            { type:"image", source:{ type:"base64", media_type:"image/jpeg", data:imgBase64 }},
            { type:"text", text:`Eres un agrónomo experto mexicano. Analiza esta imagen de ${crop.name}.
Datos del registro: pH=${form.ph||"no medido"}, CE=${form.ce||"no medida"} mS/cm.
Notas del trabajador: ${form.notes||"ninguna"}.
Nutrición de referencia: ${CROP_NUTRIENTS[form.crop]}.

Responde SOLO JSON sin markdown:
{"diagnostico":"string corto","severidad":"baja|media|alta","causas":["c1","c2"],"acciones":["a1","a2","a3"],"ajuste_ph":"subir|bajar|mantener","ajuste_ce":"subir|bajar|mantener","urgencia":"mensaje 1 línea para el encargado"}` }
          ]}]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b=>b.type==="text")?.text||"";
      const result = JSON.parse(text.replace(/```json|```/g,"").trim());
      const newDiag = { id:Date.now(), ...form, ph:parseFloat(form.ph)||0, ce:parseFloat(form.ce)||0, date:new Date().toISOString().slice(0,10), status:"done", imgPreview, result };
      setDiagnoses(prev=>[newDiag,...prev]);
      setSelected(newDiag.id);
      setView("historial");
      setForm({crop:"jitomate",zone:"",worker:"",ph:"",ce:"",notes:""});
      setImgPreview(null); setImgBase64(null);
    } catch(e) {
      alert("Error al analizar la imagen. Verifica la conexión.");
    }
    setLoading(false);
  };

  const thStyle = { padding:"7px 10px", textAlign:"left", color:"#aaa", fontWeight:500, fontSize:11, borderBottom:"1px solid #f0f0f0" };

  return (
    <div>
      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:4,width:"fit-content"}}>
        {[["historial",`📋 Historial (${diagnoses.length})`],["nuevo","🔬 Nuevo diagnóstico"]].map(([k,l])=>(
          <button key={k} onClick={()=>setView(k)} style={{padding:"8px 18px",border:"none",borderRadius:8,background:view===k?"#1a2533":"transparent",color:view===k?"#4ecb8d":"#888",cursor:"pointer",fontSize:13,fontWeight:view===k?700:400,transition:"all 0.15s"}}>{l}</button>
        ))}
      </div>

      {/* ── HISTORIAL ── */}
      {view==="historial"&&(
        <div style={{display:"grid",gridTemplateColumns:selected?"1fr 1fr":"1fr",gap:16}}>
          {/* Lista */}
          <div>
            {diagnoses.length===0&&(
              <div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa"}}>
                <div style={{fontSize:40,marginBottom:8}}>🌿</div>
                <div>No hay diagnósticos aún.</div>
                <button onClick={()=>setView("nuevo")} style={{marginTop:12,padding:"8px 18px",background:"#1a2533",color:"#4ecb8d",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600}}>Crear primer diagnóstico</button>
              </div>
            )}
            {diagnoses.map(d=>{ const c=CROPS[d.crop]; const sevColor={alta:"#e74c3c",media:"#f39c12",baja:"#27ae60"}[d.result?.severidad||"baja"]; return (
              <div key={d.id} onClick={()=>setSelected(selected===d.id?null:d.id)}
                style={{background:"#fff",border:`1px solid ${selected===d.id?"#2980b9":"#e0e0e0"}`,borderLeft:`4px solid ${sevColor}`,borderRadius:12,padding:"14px 18px",marginBottom:10,cursor:"pointer",transition:"border-color 0.15s"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <span style={{fontSize:24}}>{c.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,color:c.color,fontSize:13}}>{c.name}</span>
                      <span style={{color:"#aaa",fontSize:12}}>— {d.zone}</span>
                      <span style={{background:sevColor+"18",color:sevColor,border:`1px solid ${sevColor}44`,borderRadius:12,padding:"1px 8px",fontSize:10,fontWeight:700,fontFamily:"'Courier New',monospace"}}>
                        {d.result?.severidad?.toUpperCase()||"?"}
                      </span>
                    </div>
                    <div style={{fontSize:12,color:"#555",fontWeight:600,marginBottom:3}}>{d.result?.diagnostico||"Analizando..."}</div>
                    <div style={{fontSize:11,color:"#aaa"}}>
                      {d.worker} · {d.date}
                      {d.ph&&<span style={{marginLeft:8,fontFamily:"'Courier New',monospace",color:"#888"}}>pH {d.ph} · CE {d.ce}</span>}
                    </div>
                    {d.notes&&<div style={{fontSize:11,color:"#e67e22",marginTop:2}}>📝 {d.notes}</div>}
                  </div>
                  <span style={{fontSize:12,color:"#bbb"}}>{selected===d.id?"▲":"▼"}</span>
                </div>
              </div>
            ); })}
          </div>

          {/* Detalle */}
          {selected&&(()=>{ const d=diagnoses.find(x=>x.id===selected); if(!d||!d.result) return null; const c=CROPS[d.crop]; const sevColor={alta:"#e74c3c",media:"#f39c12",baja:"#27ae60"}[d.result.severidad]; return (
            <div style={{position:"sticky",top:80}}>
              <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"18px",maxHeight:"80vh",overflowY:"auto"}}>
                {/* Header */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,paddingBottom:12,borderBottom:"1px solid #f0f0f0"}}>
                  <span style={{fontSize:28}}>{c.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:16,color:sevColor}}>{d.result.diagnostico}</div>
                    <div style={{fontSize:11,color:"#aaa",marginTop:2}}>{c.name} · {d.zone} · {d.date}</div>
                  </div>
                  <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:18}}>×</button>
                </div>

                {/* Foto si hay */}
                {d.imgPreview&&<img src={d.imgPreview} alt="planta" style={{width:"100%",borderRadius:8,marginBottom:14,objectFit:"cover",maxHeight:180}}/>}

                {/* Urgencia */}
                {d.result.urgencia&&(
                  <div style={{background:sevColor+"11",border:`1px solid ${sevColor}33`,borderRadius:8,padding:"10px 12px",marginBottom:14}}>
                    <div style={{fontSize:10,color:sevColor,fontFamily:"'Courier New',monospace",fontWeight:700,marginBottom:3}}>🔔 MENSAJE PARA EL ENCARGADO</div>
                    <div style={{fontSize:12,color:"#333"}}>{d.result.urgencia}</div>
                  </div>
                )}

                {/* Datos */}
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  {[{l:"pH",v:d.ph,adj:d.result.ajuste_ph},{l:"CE mS/cm",v:d.ce,adj:d.result.ajuste_ce}].map(m=>{
                    const adjColor={subir:"#27ae60",bajar:"#e74c3c",mantener:"#f39c12"}[m.adj];
                    const adjIcon={subir:"↑",bajar:"↓",mantener:"→"}[m.adj];
                    return (<div key={m.l} style={{flex:1,background:"#f9f9f9",borderRadius:8,padding:"10px",textAlign:"center"}}>
                      <div style={{fontSize:10,color:"#aaa",fontFamily:"'Courier New',monospace"}}>{m.l}</div>
                      <div style={{fontSize:20,fontWeight:700,color:"#333",fontFamily:"'Courier New',monospace"}}>{m.v||"—"}</div>
                      <div style={{fontSize:12,color:adjColor,fontWeight:700}}>{adjIcon} {m.adj}</div>
                    </div>);
                  })}
                </div>

                {/* Causas */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#e74c3c",marginBottom:6,letterSpacing:0.3}}>POSIBLES CAUSAS</div>
                  {d.result.causas.map((c,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:5,alignItems:"flex-start"}}>
                      <span style={{color:"#e74c3c",fontSize:10,marginTop:3,flexShrink:0}}>◆</span>
                      <span style={{fontSize:12,color:"#555",lineHeight:1.5}}>{c}</span>
                    </div>
                  ))}
                </div>

                {/* Acciones */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#27ae60",marginBottom:6,letterSpacing:0.3}}>ACCIONES RECOMENDADAS</div>
                  {d.result.acciones.map((a,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"flex-start",background:"#f0faf5",borderRadius:6,padding:"6px 8px"}}>
                      <span style={{color:"#27ae60",fontSize:12,fontWeight:700,flexShrink:0}}>{i+1}.</span>
                      <span style={{fontSize:12,color:"#333",lineHeight:1.5}}>{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ); })()}
        </div>
      )}

      {/* ── NUEVO ── */}
      {view==="nuevo"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {/* Form */}
          <div>
            <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"18px",marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14,letterSpacing:0.3}}>DATOS DEL REGISTRO</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:4,fontFamily:"'Courier New',monospace"}}>CULTIVO</div>
                  <select value={form.crop} onChange={e=>setForm(p=>({...p,crop:e.target.value}))} style={{width:"100%",padding:"8px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13}}>
                    {Object.entries(CROPS).map(([k,c])=><option key={k} value={k}>{c.emoji} {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:4,fontFamily:"'Courier New',monospace"}}>ZONA</div>
                  <input value={form.zone} onChange={e=>setForm(p=>({...p,zone:e.target.value}))} placeholder="Zona A" style={{width:"100%",padding:"8px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:4,fontFamily:"'Courier New',monospace"}}>pH MEDIDO</div>
                  <input type="number" step="0.1" value={form.ph} onChange={e=>setForm(p=>({...p,ph:e.target.value}))} placeholder="6.2" style={{width:"100%",padding:"8px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:4,fontFamily:"'Courier New',monospace"}}>CE (mS/cm)</div>
                  <input type="number" step="0.1" value={form.ce} onChange={e=>setForm(p=>({...p,ce:e.target.value}))} placeholder="2.8" style={{width:"100%",padding:"8px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
                </div>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:4,fontFamily:"'Courier New',monospace"}}>TRABAJADOR</div>
                <input value={form.worker} onChange={e=>setForm(p=>({...p,worker:e.target.value}))} placeholder="Nombre" style={{width:"100%",padding:"8px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:"#aaa",marginBottom:4,fontFamily:"'Courier New',monospace"}}>OBSERVACIONES</div>
                <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Ej: hojas con manchas, planta decaída..." style={{width:"100%",padding:"8px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,minHeight:70,resize:"vertical",boxSizing:"border-box"}}/>
              </div>
            </div>
          </div>

          {/* Imagen + análisis */}
          <div>
            <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"18px",marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14,letterSpacing:0.3}}>FOTO DE LA PLANTA</div>
              <div onClick={()=>fileRef.current.click()} style={{border:"2px dashed #e0e0e0",borderRadius:10,padding:imgPreview?0:"2rem",textAlign:"center",cursor:"pointer",marginBottom:14,overflow:"hidden",background:imgPreview?"transparent":"#fafafa"}}>
                {imgPreview
                  ? <img src={imgPreview} alt="planta" style={{width:"100%",borderRadius:8,maxHeight:220,objectFit:"cover"}}/>
                  : <div><div style={{fontSize:36,marginBottom:8}}>📸</div><div style={{color:"#aaa",fontSize:13}}>Clic o toca para subir foto</div><div style={{fontSize:11,color:"#ccc",marginTop:4}}>JPG, PNG</div></div>}
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImage}/>
              </div>
              {imgPreview&&<button onClick={()=>{setImgPreview(null);setImgBase64(null);}} style={{width:"100%",padding:"7px",border:"1px solid #e0e0e0",borderRadius:8,background:"transparent",color:"#aaa",cursor:"pointer",fontSize:12,marginBottom:10}}>Cambiar imagen</button>}
            </div>

            <button onClick={analyze} disabled={loading||!imgBase64} style={{width:"100%",padding:"14px",background:loading||!imgBase64?"#f0f0f0":"#1a2533",color:loading||!imgBase64?"#aaa":"#4ecb8d",border:"none",borderRadius:10,cursor:loading||!imgBase64?"not-allowed":"pointer",fontSize:14,fontWeight:700,fontFamily:"'Courier New',monospace",letterSpacing:0.5,transition:"all 0.2s"}}>
              {loading?"⏳  Analizando con IA...":!imgBase64?"📸  Primero sube una foto":"🔬  ANALIZAR CON IA"}
            </button>
            {!imgBase64&&<div style={{fontSize:11,color:"#aaa",textAlign:"center",marginTop:8}}>La IA también usa los datos de pH, CE y observaciones para un diagnóstico más preciso.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Formulador() {
  const [crop,setCrop]=useState("jitomate");
  const [target,setTarget]=useState({...CROP_NUT.jitomate});
  const [water,setWater]=useState({...DEF_WATER});
  const [ferts,setFerts]=useState(FERTS_INIT);
  const [volume,setVolume]=useState(1000);
  const [subTab,setSubTab]=useState("tabla");
  const [saved,setSaved]=useState([]);
  const [saveName,setSaveName]=useState("");

  const aportes=useMemo(()=>Object.fromEntries(ALL_IONS.map(ion=>[ion,Math.max(0,n(target[ion]-water[ion]))])),[target,water]);
  const fertilizando=useMemo(()=>{ const t=Object.fromEntries(ALL_IONS.map(ion=>[ion,0])); ferts.filter(f=>f.active&&f.meq>0).forEach(f=>{ Object.entries(f.ions).forEach(([ion,ratio])=>{ if(t[ion]!==undefined) t[ion]=n(t[ion]+f.meq*ratio); }); }); return t; },[ferts]);
  const dosis=useMemo(()=>ferts.map(f=>{ if(!f.active||f.meq===0) return {...f,grm3:0,mlm3:0}; let grm3=0,mlm3=0; if(f.type==="solid") grm3=n(f.meq*f.Peq); else { mlm3=n(f.meq*f.Peq/((f.density||1)*(f.richness||100)/100)); grm3=n(mlm3*(f.density||1)); } return {...f,grm3,mlm3,kgTotal:n(grm3*volume/1000000,3),mlTotal:f.type==="liquid"?n(mlm3*volume/1000,2):0}; }),[ferts,volume]);

  const thS={padding:"6px 8px",fontSize:11,fontWeight:500,color:"#aaa",textAlign:"center",borderBottom:"1px solid #f0f0f0",background:"#fafafa",whiteSpace:"nowrap"};
  const tdS={padding:"5px 7px",textAlign:"center",fontSize:12,borderBottom:"1px solid #fafafa"};

  return (
    <div>
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px",marginBottom:12}}>
        <div style={{fontSize:11,color:"#aaa",marginBottom:8,letterSpacing:0.5,fontFamily:"'Courier New',monospace"}}>CULTIVO BASE</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {Object.entries(CROPS).map(([k,c])=>(<button key={k} onClick={()=>{setCrop(k);setTarget({...CROP_NUT[k]});}} style={{padding:"8px 16px",border:`1px solid ${crop===k?c.color:"#e0e0e0"}`,borderRadius:20,background:crop===k?c.color+"18":"transparent",color:crop===k?c.color:"#666",cursor:"pointer",fontSize:12,fontWeight:crop===k?700:400}}>{c.emoji} {c.name}</button>))}
        </div>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:12,background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:4}}>
        {[["tabla","📋 Iones y fertilizantes"],["dosis","⚖️ Dosis"],["balance","📊 Balance"],["guardadas",`📁 Guardadas (${saved.length})`]].map(([k,l])=>(<button key={k} onClick={()=>setSubTab(k)} style={{flex:1,padding:"7px 8px",border:"none",borderRadius:8,background:subTab===k?"#f0f4ff":"transparent",color:subTab===k?"#2c3e50":"#888",cursor:"pointer",fontSize:12,fontWeight:subTab===k?600:400}}>{l}</button>))}
      </div>

      {subTab==="tabla"&&(<>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px",marginBottom:12}}>
          <div style={{fontSize:11,color:"#aaa",marginBottom:10,letterSpacing:0.5,fontFamily:"'Courier New',monospace"}}>ANÁLISIS DE IONES (meq/L)</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
              <thead><tr><th style={{...thS,textAlign:"left",minWidth:100}}>Parámetro</th>{ANIONS.map(ion=><th key={ion} style={{...thS,color:"#2471a3"}}>{ION_LABELS[ion]}</th>)}{CATIONS.map(ion=><th key={ion} style={{...thS,color:"#1e8449"}}>{ION_LABELS[ion]}</th>)}<th style={thS}>Σ</th></tr></thead>
              <tbody>
                {[{label:"Agua",data:water,setter:setWater,color:"#2980b9"},{label:"Objetivo",data:target,setter:setTarget,color:CROPS[crop].color}].map(row=>(
                  <tr key={row.label}><td style={{...tdS,textAlign:"left",fontWeight:600,color:row.color}}>{row.label}</td>
                    {ALL_IONS.map(ion=>(<td key={ion} style={tdS}><input type="number" step="0.1" min="0" value={row.data[ion]} onChange={e=>row.setter(p=>({...p,[ion]:parseFloat(e.target.value)||0}))} style={{width:52,textAlign:"center",border:"1px solid #e8e8e8",borderRadius:5,padding:"3px",fontSize:11,fontFamily:"'Courier New',monospace"}}/></td>))}
                    <td style={{...tdS,fontFamily:"'Courier New',monospace",fontWeight:700,color:row.color}}>{n(ALL_IONS.reduce((s,i)=>s+(row.data[i]||0),0))}</td>
                  </tr>
                ))}
                <tr style={{background:"#f9f9f9"}}><td style={{...tdS,textAlign:"left",fontWeight:600,color:"#555"}}>Aportes netos</td>{ALL_IONS.map(ion=>(<td key={ion} style={{...tdS,fontFamily:"'Courier New',monospace",fontWeight:700,color:aportes[ion]>0?"#2c3e50":"#ccc"}}>{n(aportes[ion])}</td>))}<td style={{...tdS,fontFamily:"'Courier New',monospace",fontWeight:700}}>{n(ALL_IONS.reduce((s,i)=>s+(aportes[i]||0),0))}</td></tr>
                <tr style={{background:"#f0faf5"}}><td style={{...tdS,textAlign:"left",fontWeight:600,color:"#27ae60"}}>Fertilizando</td>{ALL_IONS.map(ion=>{ const have=fertilizando[ion],need=aportes[ion]; return <td key={ion} style={{...tdS,fontFamily:"'Courier New',monospace",fontWeight:700,color:have>need*1.05?"#e74c3c":have<need*0.95&&need>0?"#e67e22":have>0?"#27ae60":"#ccc"}}>{n(have)}{have>need*1.05?"↑":have<need*0.95&&need>0?"↓":""}</td>; })}<td style={{...tdS,fontFamily:"'Courier New',monospace",fontWeight:700,color:"#27ae60"}}>{n(ALL_IONS.reduce((s,i)=>s+(fertilizando[i]||0),0))}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px"}}>
          <div style={{fontSize:11,color:"#aaa",marginBottom:10,letterSpacing:0.5,fontFamily:"'Courier New',monospace"}}>FERTILIZANTES (meq/L)</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:420}}>
              <thead><tr><th style={{...thS,width:32}}></th><th style={{...thS,textAlign:"left"}}>Fertilizante</th><th style={{...thS,width:80}}>meq/L</th><th style={thS}>Aporta</th><th style={thS}>Tipo</th></tr></thead>
              <tbody>
                {ferts.map(f=>(<tr key={f.id} style={{opacity:f.active?1:0.4}}>
                  <td style={tdS}><input type="checkbox" checked={f.active} onChange={()=>setFerts(p=>p.map(x=>x.id===f.id?{...x,active:!x.active}:x))} style={{cursor:"pointer"}}/></td>
                  <td style={{...tdS,textAlign:"left",fontWeight:f.active?600:400,color:"#333"}}>{f.name}</td>
                  <td style={tdS}>{f.active&&<input type="number" step="0.1" min="0" value={f.meq} onChange={e=>setFerts(p=>p.map(x=>x.id===f.id?{...x,meq:parseFloat(e.target.value)||0}:x))} style={{width:60,textAlign:"center",border:"1px solid #e0e0e0",borderRadius:5,padding:"3px",fontSize:12,fontFamily:"'Courier New',monospace"}}/>}</td>
                  <td style={tdS}><div style={{display:"flex",gap:3,justifyContent:"center",flexWrap:"wrap"}}>{Object.entries(f.ions).map(([ion,r])=>(<span key={ion} style={{background:ANIONS.includes(ion)?"#eaf4fb":"#eafbf0",color:ANIONS.includes(ion)?"#1a5276":"#1a5733",padding:"1px 5px",borderRadius:4,fontSize:10,fontFamily:"'Courier New',monospace"}}>{ION_LABELS[ion]}{r!==1?` ×${r}`:""}</span>))}</div></td>
                  <td style={{...tdS,fontSize:11,color:f.type==="liquid"?"#8e44ad":"#aaa"}}>{f.type==="liquid"?"Líquido":"Sólido"}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {subTab==="dosis"&&(<>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px",marginBottom:12,display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <div><div style={{fontSize:11,color:"#aaa",marginBottom:4,fontFamily:"'Courier New',monospace"}}>VOLUMEN (L)</div><input type="number" step="100" min="100" value={volume} onChange={e=>setVolume(parseFloat(e.target.value)||1000)} style={{width:120,fontFamily:"'Courier New',monospace",fontSize:16,fontWeight:700,textAlign:"center",border:"1px solid #e0e0e0",borderRadius:8,padding:"8px"}}/></div>
          <div style={{fontSize:12,color:"#aaa"}}>Para preparar <strong style={{color:"#333"}}>{volume.toLocaleString()} litros</strong> de solución nutritiva.</div>
        </div>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:480}}>
              <thead><tr><th style={{...thS,textAlign:"left"}}>Fertilizante</th><th style={thS}>meq/L</th><th style={thS}>gr/m³</th><th style={thS}>ml/m³</th><th style={{...thS,color:"#333"}}>Para {volume.toLocaleString()} L</th><th style={thS}>Conc. ×100</th></tr></thead>
              <tbody>
                {dosis.filter(f=>f.active&&f.meq>0).map(f=>(<tr key={f.id}><td style={{...tdS,textAlign:"left",fontWeight:600}}>{f.name}</td><td style={{...tdS,fontFamily:"'Courier New',monospace"}}>{n(f.meq)}</td><td style={{...tdS,fontFamily:"'Courier New',monospace",color:"#aaa"}}>{f.type==="solid"?n(f.grm3):"—"}</td><td style={{...tdS,fontFamily:"'Courier New',monospace",color:"#8e44ad"}}>{f.type==="liquid"?n(f.mlm3):"—"}</td><td style={{...tdS,fontFamily:"'Courier New',monospace",fontWeight:700,color:"#2c3e50"}}>{f.type==="solid"?`${n(f.kgTotal*1000,0)} gr${f.kgTotal>=1?` (${n(f.kgTotal,2)} kg)`:""}`:`${n(f.mlTotal,1)} ml`}</td><td style={{...tdS,fontSize:11,color:"#aaa",fontFamily:"'Courier New',monospace"}}>{f.type==="solid"?`${n(f.grm3/10)} gr/L`:`${n(f.mlm3/10)} ml/L`}</td></tr>))}
                <tr style={{background:"#f9f9f9",borderTop:"2px solid #e0e0e0"}}><td style={{...tdS,textAlign:"left",fontWeight:700}}>Total sólidos</td><td colSpan={3} style={tdS}></td><td style={{...tdS,fontFamily:"'Courier New',monospace",fontWeight:700,color:"#27ae60"}}>{n(dosis.filter(f=>f.active&&f.type==="solid").reduce((s,f)=>s+f.kgTotal*1000,0),0)} gr</td><td style={tdS}></td></tr>
              </tbody>
            </table>
          </div>
          <div style={{marginTop:12,background:"#fefdf0",borderRadius:8,padding:"10px 14px",fontSize:11,color:"#7d6608",lineHeight:1.7,border:"1px solid #f9e79f"}}><strong>Orden de mezcla:</strong> Ca(NO₃)₂ → KNO₃ → K₂SO₄ → MgSO₄ → KH₂PO₄ → ácidos al final. <strong>Nunca mezcles Ca con SO₄ o PO₄ directamente.</strong></div>
        </div>
      </>)}

      {subTab==="balance"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[["Aniones",ANIONS,"#2471a3"],["Cationes",CATIONS,"#1e8449"]].map(([label,ions,color])=>(
            <div key={label} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px"}}>
              <div style={{fontSize:11,fontWeight:700,color,marginBottom:12,letterSpacing:0.5,fontFamily:"'Courier New',monospace"}}>{label.toUpperCase()}</div>
              {ions.map(ion=>{ const have=fertilizando[ion]||0,need=aportes[ion]||0,pct=need>0?Math.min(have/need,1.5):0,bc=have>need*1.05?"#e74c3c":have<need*0.95&&need>0?"#e67e22":"#27ae60"; return (<div key={ion} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{fontFamily:"'Courier New',monospace",color:"#666"}}>{ION_LABELS[ion]}</span><span style={{fontFamily:"'Courier New',monospace",color:bc,fontWeight:600}}>{n(have)}/{n(need)} {have>need*1.05?"↑":have<need*0.95&&need>0?"↓":"✓"}</span></div>
                <div style={{background:"#f0f0f0",borderRadius:3,height:6,overflow:"hidden"}}><div style={{width:`${Math.min(pct*100,100)}%`,height:"100%",background:bc,borderRadius:3,transition:"width 0.3s"}}/></div>
              </div>); })}
            </div>
          ))}
        </div>
      )}

      {subTab==="guardadas"&&(
        <div>
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px",marginBottom:12,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="Nombre de la fórmula" style={{flex:1,minWidth:200,padding:"8px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13}}/>
            <button onClick={()=>{if(saveName){setSaved(p=>[...p,{name:saveName,crop,target:{...target},water:{...water},ferts:ferts.map(f=>({id:f.id,meq:f.meq,active:f.active}))}]);setSaveName("")}}} style={{padding:"8px 20px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:12}}>Guardar fórmula actual</button>
          </div>
          {saved.length===0?(<div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa"}}><div style={{fontSize:36,marginBottom:8}}>📋</div><div>Sin fórmulas guardadas.</div></div>):saved.map((f,i)=>(
            <div key={i} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
              <div><div style={{fontWeight:700,marginBottom:2}}>{f.name}</div><div style={{fontSize:11,color:"#aaa"}}>{CROPS[f.crop]?.emoji} {CROPS[f.crop]?.name} · {f.ferts.filter(x=>x.active&&x.meq>0).length} fertilizantes</div></div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setCrop(f.crop);setTarget({...f.target});setWater({...f.water});setFerts(p=>p.map(x=>{const s=f.ferts.find(sf=>sf.id===x.id);return s?{...x,meq:s.meq,active:s.active}:x;}));setSubTab("tabla");}} style={{padding:"6px 14px",border:"1px solid #2980b9",borderRadius:8,background:"#eaf4fb",color:"#2980b9",cursor:"pointer",fontSize:12,fontWeight:600}}>Cargar</button>
                <button onClick={()=>setSaved(p=>p.filter((_,j)=>j!==i))} style={{padding:"6px 14px",border:"1px solid #e0e0e0",borderRadius:8,background:"transparent",color:"#aaa",cursor:"pointer",fontSize:12}}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Trabajadores({ readings }) {
  const workers=useMemo(()=>{ const map={}; readings.forEach(r=>{ if(!map[r.worker]) map[r.worker]={name:r.worker,total:0,alerts:0,lastDate:"",crops:new Set()}; map[r.worker].total++; map[r.worker].crops.add(r.crop); if(r.date>map[r.worker].lastDate) map[r.worker].lastDate=r.date; const c=CROPS[r.crop]; if(getStatus(r.ph,c.ph)==="danger"||getStatus(r.ce,c.ce)==="danger") map[r.worker].alerts++; }); return Object.values(map); },[readings]);
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
      {workers.map(w=>{ const initials=w.name.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase(); return (
        <div key={w.name} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px"}}>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:"#e8f0fe",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"#3c5a9a"}}>{initials}</div>
            <div><div style={{fontWeight:700,fontSize:14}}>{w.name}</div><div style={{fontSize:11,color:"#aaa"}}>Último: {w.lastDate}</div></div>
          </div>
          <div style={{display:"flex",gap:10}}>
            {[{v:w.total,l:"Registros",c:"#27ae60"},{v:w.alerts,l:"Alertas",c:w.alerts>0?"#e74c3c":"#aaa"},{v:w.crops.size,l:"Cultivos",c:"#2980b9"}].map(s=>(<div key={s.l} style={{flex:1,textAlign:"center",background:w.alerts>0&&s.l==="Alertas"?"#fdedec":"#f9f9f9",borderRadius:8,padding:"8px 0"}}><div style={{fontSize:20,fontWeight:700,color:s.c,fontFamily:"'Courier New',monospace"}}>{s.v}</div><div style={{fontSize:10,color:"#aaa"}}>{s.l}</div></div>))}
          </div>
          <div style={{marginTop:10,display:"flex",gap:4,flexWrap:"wrap"}}>{[...w.crops].map(k=><span key={k} style={{fontSize:16}}>{CROPS[k].emoji}</span>)}</div>
        </div>
      ); })}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const NAV = [
  { id:"resumen",      label:"Resumen",    icon:"◉" },
  { id:"alertas",      label:"Alertas",    icon:"⚠" },
  { id:"ia",           label:"IA Diagnóstico", icon:"🔬" },
  { id:"reportes",     label:"Reportes",   icon:"↗" },
  { id:"formulador",   label:"Formulador", icon:"⬡" },
  { id:"trabajadores", label:"Equipo",     icon:"◎" },
];

export default function AdminPanel() {
  const [page,setPage]=useState("resumen");
  const [readings]=useState(READINGS);
  const alerts=readings.filter(r=>{ const c=CROPS[r.crop]; return getStatus(r.ph,c.ph)==="danger"||getStatus(r.ce,c.ce)==="danger"; });
  const TITLES = { resumen:"Panel de control", alertas:"Centro de alertas", ia:"Diagnóstico con IA", reportes:"Reportes y análisis", formulador:"Formulador de solución nutritiva", trabajadores:"Equipo de campo" };
  const SECTION = { resumen:<Resumen readings={readings}/>, alertas:<Alertas readings={readings}/>, ia:<DiagnosticoIA/>, reportes:<Reportes readings={readings}/>, formulador:<Formulador/>, trabajadores:<Trabajadores readings={readings}/> };

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"#f4f5f7",fontFamily:"'Georgia',serif"}}>
      {/* Sidebar */}
      <div style={{width:200,background:"#1a2533",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",flexShrink:0}}>
        <div style={{padding:"20px 18px 14px",borderBottom:"1px solid #243040"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:22}}>🌿</span>
            <div><div style={{color:"#4ecb8d",fontWeight:700,fontSize:16,letterSpacing:-0.3}}>AgroMonitor</div><div style={{color:"#3a5060",fontSize:10,fontFamily:"'Courier New',monospace",marginTop:1}}>ADMINISTRADOR</div></div>
          </div>
        </div>
        <nav style={{flex:1,padding:"12px 0"}}>
          {NAV.map(item=>(
            <button key={item.id} onClick={()=>setPage(item.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 18px",border:"none",background:page===item.id?"#243a52":"transparent",color:page===item.id?"#4ecb8d":"#7a9ab0",cursor:"pointer",textAlign:"left",borderLeft:page===item.id?"3px solid #4ecb8d":"3px solid transparent",transition:"all 0.15s",fontSize:13,fontFamily:"'Georgia',serif"}}>
              <span style={{fontSize:14,width:16,textAlign:"center"}}>{item.icon}</span>
              <span>{item.label}</span>
              {item.id==="alertas"&&alerts.length>0&&<span style={{marginLeft:"auto",background:"#e74c3c",color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontFamily:"'Courier New',monospace"}}>{alerts.length}</span>}
              {item.id==="ia"&&<span style={{marginLeft:"auto",background:"#4ecb8d22",color:"#4ecb8d",borderRadius:10,padding:"1px 6px",fontSize:9,fontFamily:"'Courier New',monospace"}}>NEW</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:"14px 18px",borderTop:"1px solid #243040",fontSize:10,color:"#3a5060",fontFamily:"'Courier New',monospace",lineHeight:1.6}}><div>Lun 30 Mar 2026</div><div>{readings.length} registros totales</div></div>
      </div>

      {/* Main */}
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{background:"#fff",borderBottom:"0.5px solid #e0e0e0",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
          <h1 style={{margin:0,fontSize:18,fontWeight:700,color:"#1a2533"}}>{TITLES[page]}</h1>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {alerts.length>0&&<div style={{background:"#fdedec",border:"1px solid #f5c6c6",borderRadius:20,padding:"5px 12px",fontSize:12,color:"#c0392b",fontWeight:600,cursor:"pointer"}} onClick={()=>setPage("alertas")}>🚨 {alerts.length} alerta{alerts.length>1?"s":""}</div>}
            <div style={{width:34,height:34,borderRadius:"50%",background:"#1a2533",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:"#4ecb8d",border:"2px solid #4ecb8d"}}>JO</div>
          </div>
        </div>
        <div style={{padding:"20px 24px",maxWidth:980,margin:"0 auto"}}>{SECTION[page]}</div>
      </div>
    </div>
  );
}
