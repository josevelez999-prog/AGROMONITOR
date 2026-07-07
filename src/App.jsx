import React, { useState, useMemo, useEffect } from "react";
import Worker from "./Worker";
import MobileDashboard from "./MobileDashboard";
import AlmacenAdmin from "./AlmacenAdmin";
import AplicacionesAdmin from "./AplicacionesAdmin";
import { setCdtContext, loadCdtData, getSuperOverride } from "./cdtContext";
import SuperAdmin from "./SuperAdmin";
import Ventas from "./Ventas";
import LoginScreen from "./Auth";
import UsuariosAdmin from "./UsuariosAdmin";
import { db, auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where, getDoc, setDoc } from "./dbCdt";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Legend, Cell } from "recharts";
import AnalisisSuelo from "./SueloAnalisis";

const CROPS = {
  jitomate:  { name:"Jitomate",  emoji:"🍅", color:"#c0392b",
    ph:{min:5.5,max:6.2}, ce:{min:2.5,max:4.0},
    entrada:{ph:{min:5.5,max:6.2},ce:{min:2.5,max:4.0}},
    salida: {ph:{min:5.8,max:6.5},ce:{min:3.5,max:6.0}},
    invernaderos:["INV 2","INV 3","INV 5","INV 6"],
    extraFields:[
      {key:"ca", label:"Calcio (Ca)",    unit:"mg/L", min:120, max:180, placeholder:"150"},
      {key:"no3",label:"Nitratos (NO₃)", unit:"mg/L", min:150, max:200, placeholder:"175"},
      {key:"k",  label:"Potasio (K)",    unit:"mg/L", min:200, max:300, placeholder:"250"},
      {key:"fe", label:"Hierro (Fe)",    unit:"mg/L", min:1.5, max:3.0, placeholder:"2.0"},
    ],
  },
  fresa:     { name:"Fresa",     emoji:"🍓", color:"#e74c3c",
    ph:{min:5.5,max:6.5}, ce:{min:1.0,max:2.0},
    entrada:{ph:{min:5.5,max:6.5},ce:{min:1.0,max:2.0}},
    salida: {ph:{min:5.8,max:6.8},ce:{min:1.5,max:2.5}},
    extraFields:[
      {key:"ca", label:"Calcio (Ca)",    unit:"mg/L", min:120, max:180, placeholder:"150"},
      {key:"no3",label:"Nitratos (NO₃)", unit:"mg/L", min:150, max:200, placeholder:"175"},
      {key:"k",  label:"Potasio (K)",    unit:"mg/L", min:200, max:300, placeholder:"250"},
      {key:"fe", label:"Hierro (Fe)",    unit:"mg/L", min:1.5, max:3.0, placeholder:"2.0"},
    ],
  },
  arandano:  { name:"Arándano",  emoji:"🫐", color:"#2980b9",
    ph:{min:4.5,max:5.5}, ce:{min:1.0,max:2.0},
    entrada:{ph:{min:4.5,max:5.5},ce:{min:1.0,max:2.0}},
    salida: {ph:{min:4.8,max:5.8},ce:{min:1.5,max:2.5}},
  },
  zarzamora: { name:"Zarzamora", emoji:"🫐", color:"#8e44ad",
    ph:{min:5.5,max:6.5}, ce:{min:1.5,max:2.5},
    entrada:{ph:{min:5.5,max:6.5},ce:{min:1.5,max:2.5}},
    salida: {ph:{min:5.8,max:6.8},ce:{min:2.0,max:3.5}},
    noDrenaje:true,
  },
};
const ETAPAS = ["Vegetativo","Floración","Fructificación","Post-cosecha"];
const ANIONS  = ["NO3","H2PO4","SO4","HCO3","Cl"];
const CATIONS = ["NH4","K","Ca","Mg","Na"];
const ALL_IONS = [...ANIONS,...CATIONS];
const ION_LABELS = {NO3:"NO₃⁻",H2PO4:"H₂PO₄⁻",SO4:"SO₄²⁻",HCO3:"HCO₃⁻",Cl:"Cl⁻",NH4:"NH₄⁺",K:"K⁺",Ca:"Ca²⁺",Mg:"Mg²⁺",Na:"Na⁺"};
const CROP_NUT = {
  jitomate: {NO3:11,H2PO4:1.5,SO4:8,HCO3:0,Cl:0,NH4:1,K:8.5,Ca:9,Mg:5,Na:0},
  fresa:    {NO3:7,H2PO4:1.5,SO4:3,HCO3:0,Cl:0,NH4:0.5,K:4.5,Ca:4,Mg:2,Na:0},
  arandano: {NO3:5,H2PO4:1,SO4:2,HCO3:0,Cl:0,NH4:0.5,K:3,Ca:2,Mg:1,Na:0},
  zarzamora:{NO3:7,H2PO4:1,SO4:3.5,HCO3:0,Cl:0,NH4:0.5,K:4,Ca:4,Mg:2,Na:0},
};
const DEF_WATER = {NO3:0,H2PO4:0,SO4:1.55,HCO3:2.25,Cl:0.5,NH4:0,K:0.2,Ca:1,Mg:1.23,Na:1.58};
const FERTS_INIT = [
  {id:"ca_no3",name:"Ca(NO₃)₂·4H₂O",ions:{NO3:1,Ca:1,NH4:0.074},Peq:118,type:"solid",meq:8,active:true,precio:0},
  {id:"kno3",name:"KNO₃",ions:{NO3:1,K:1},Peq:101,type:"solid",meq:3,active:true,precio:0},
  {id:"k2so4",name:"K₂SO₄",ions:{SO4:1,K:1},Peq:87,type:"solid",meq:3.8,active:true,precio:0},
  {id:"mgso4",name:"MgSO₄·7H₂O",ions:{SO4:1,Mg:1},Peq:123,type:"solid",meq:3.8,active:true,precio:0},
  {id:"kh2po4",name:"KH₂PO₄",ions:{H2PO4:1,K:1},Peq:136,type:"solid",meq:1.5,active:true,precio:0},
  {id:"h2so4",name:"H₂SO₄ (98%)",ions:{SO4:1},Peq:49,type:"liquid",meq:1.7,active:true,precio:0,density:1.85,richness:98},
  {id:"hno3",name:"HNO₃ (70%)",ions:{NO3:1},Peq:63,type:"liquid",meq:0,active:false,precio:0,density:1.42,richness:70},
  {id:"nh4no3",name:"NH₄NO₃",ions:{NO3:1,NH4:1},Peq:80,type:"solid",meq:0,active:false,precio:0},
  {id:"mgno3",name:"Mg(NO₃)₂·6H₂O",ions:{NO3:1,Mg:1},Peq:128,type:"solid",meq:0,active:false,precio:0},
  {id:"kcl",name:"KCl",ions:{K:1,Cl:1},Peq:74.56,type:"solid",meq:0,active:false,precio:0},
];

const n=(v,d=2)=>Number(parseFloat(v||0).toFixed(d));
const getStatus=(v,r)=>{if(v<r.min||v>r.max)return"danger";const m=(r.max-r.min)*0.15;return(v<r.min+m||v>r.max-m)?"warning":"ok";};
const getRangos=(crop,tipo,invernadero,weeklyRangos)=>{
  const c=CROPS[crop]; if(!c) return null;
  const defaultRng = tipo==="salida" ? (c.salida||{ph:c.ph,ce:c.ce}) : (c.entrada||{ph:c.ph,ce:c.ce});
  if(weeklyRangos){
    const inv=(invernadero||"").replace(" ","");
    const key=inv?`${crop}_${inv}_${tipo}`:`${crop}_${tipo}`;
    const wr=weeklyRangos[key];
    if(wr){
      // Permite rangos parciales: usa lo configurado y default para lo demás
      const phMin = wr.phMin!==undefined ? wr.phMin : defaultRng.ph.min;
      const phMax = wr.phMax!==undefined ? wr.phMax : defaultRng.ph.max;
      const ceMin = wr.ceMin!==undefined ? wr.ceMin : defaultRng.ce.min;
      const ceMax = wr.ceMax!==undefined ? wr.ceMax : defaultRng.ce.max;
      return {ph:{min:phMin,max:phMax},ce:{min:ceMin,max:ceMax}};
    }
  }
  return defaultRng;
};
const SC={ok:"#27ae60",warning:"#f39c12",danger:"#e74c3c"};
const LBL={fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:0.3};
const INP_ADMIN={padding:"8px 10px",border:"1px solid #ddd",borderRadius:8,fontSize:13,width:"100%",background:"#fff",color:"#111",WebkitTextFillColor:"#111",colorScheme:"light"};
const SB={ok:"#eafaf1",warning:"#fef9e7",danger:"#fdedec"};
const SL={ok:"OK",warning:"Alerta",danger:"Crítico"};

function Badge({status,small}){return <span style={{background:SB[status],color:SC[status],border:`1px solid ${SC[status]}44`,borderRadius:20,padding:small?"1px 7px":"3px 10px",fontSize:small?10:11,fontWeight:600,whiteSpace:"nowrap",fontFamily:"'Courier New',monospace"}}>{status==="danger"?"✗":status==="warning"?"⚠":"✓"} {SL[status]}</span>;}
function Sparkline({data,color}){if(!data||data.length<2)return null;const min=Math.min(...data),max=Math.max(...data),range=max-min||1,w=80,h=28;const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/range)*h}`).join(" ");return <svg width={w} height={h} style={{overflow:"visible"}}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round"/><circle cx={w} cy={h-((data[data.length-1]-min)/range)*h} r={2.5} fill={color}/></svg>;}
function exportCSV(readings){const h=["Fecha","Hora","Cultivo","Zona","pH","CE","Estado pH","Estado CE","Trabajador","Notas","Foto"];const rows=readings.map(r=>{const c=CROPS[r.crop];if(!c)return null;const ps=getStatus(r.ph,c.ph),cs=getStatus(r.ce,c.ce);return[r.date,r.time||"",c.name,r.zone,r.ph,r.ce,SL[ps],SL[cs],r.worker,r.notes||"",r.photoURL||""].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",");}).filter(Boolean);const blob=new Blob(["\uFEFF",[h.join(","),...rows].join("\n")],{type:"text/csv;charset=utf-8;"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`greenlog_${new Date().toISOString().slice(0,10)}.csv`;a.click();}

// ─── RESUMEN ──────────────────────────────────────────────────────────────────
function Resumen({readings,onDelete,weeklyRangos={}}){
  const alerts=readings.filter(r=>{if(r.resolved||r.dismissed||(r.tipo||"entrada")!=="entrada")return false;const c=CROPS[r.crop];if(!c)return false;const rng=getRangos(r.crop,"entrada",r.invernadero,{});return getStatus(r.ph,rng.ph)==="danger"||getStatus(r.ce,rng.ce)==="danger";});
  const warn=readings.filter(r=>{const c=CROPS[r.crop];if(!c)return false;const p=getStatus(r.ph,c.ph),cs=getStatus(r.ce,c.ce);return(p==="warning"||cs==="warning")&&p!=="danger"&&cs!=="danger";});
  const latest=Object.keys(CROPS).map(k=>{const recs=readings.filter(r=>r.crop===k).sort((a,b)=>b.date.localeCompare(a.date));return{key:k,...recs[0]};}).filter(r=>r.ph);
  const byW={};readings.forEach(r=>{byW[r.worker]=(byW[r.worker]||0)+1;});
  const rangosSnap = Object.keys(weeklyRangos||{}).length;
  return(
    <div>
      {rangosSnap>0&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#27ae60",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14}}>🎯</span>
        <span><strong>Rangos semanales activos</strong> — {rangosSnap} combinaciones configuradas. Los semáforos usan estos rangos.</span>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        {[{l:"Mediciones",v:readings.length,c:"#27ae60",i:"📊"},{l:"Alertas críticas",v:alerts.length,c:"#e74c3c",i:"🚨"},{l:"Advertencias",v:warn.length,c:"#f39c12",i:"⚠️"},{l:"Trabajadores",v:Object.keys(byW).length,c:"#2980b9",i:"👤"}].map(k=>(
          <div key={k.l} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px"}}>
            <div style={{fontSize:22}}>{k.i}</div>
            <div style={{fontSize:28,fontWeight:700,color:k.c,fontFamily:"'Courier New',monospace",lineHeight:1.1,marginTop:4}}>{k.v}</div>
            <div style={{fontSize:11,color:"#888",marginTop:2}}>{k.l}</div>
          </div>
        ))}
      </div>
      {!readings.length&&<div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa",border:"0.5px solid #e0e0e0"}}><div style={{fontSize:40,marginBottom:8}}>🌿</div><div style={{fontWeight:500,marginBottom:6}}>Sin registros aún</div><div style={{fontSize:12}}>Comparte la URL con tus trabajadores</div></div>}
      {alerts.length>0&&(
        <div style={{background:"#fff",border:"1px solid #f5c6c6",borderLeft:"4px solid #e74c3c",borderRadius:12,padding:"14px 18px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#c0392b",marginBottom:10,letterSpacing:0.5}}>🚨 ALERTAS CRÍTICAS</div>
          {alerts.slice(0,5).map(r=>{const c=CROPS[r.crop];return(
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #fdecea",flexWrap:"wrap"}}>
              <span style={{fontSize:18}}>{c.emoji}</span>
              <div style={{flex:1}}><span style={{fontWeight:600,color:c.color}}>{c.name}</span><span style={{color:"#888",fontSize:12,marginLeft:6}}>{r.zone} · {r.worker} · {r.date}</span></div>
              <span style={{fontFamily:"'Courier New',monospace",fontSize:12,color:"#e74c3c"}}>pH {r.ph} · CE {r.ce}</span>
              <Badge status="danger" small/>
              <button onClick={()=>onDelete(r.id)} style={{background:"#fdedec",border:"1px solid #f5c6c6",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#c0392b",fontWeight:600}}>✕ Resolver</button>
            </div>
          );})}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:16}}>
        {latest.map(r=>{const c=CROPS[r.key];const ps=getStatus(r.ph,c.ph),cs=getStatus(r.ce,c.ce);const ov=ps==="danger"||cs==="danger"?"danger":ps==="warning"||cs==="warning"?"warning":"ok";const hist=readings.filter(x=>x.crop===r.key).sort((a,b)=>a.date.localeCompare(b.date)).map(x=>x.ph);return(
          <div key={r.key} style={{background:"#fff",border:`1px solid ${SC[ov]}33`,borderTop:`3px solid ${c.color}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div><div style={{fontWeight:700,color:c.color,fontSize:14}}>{c.emoji} {c.name}</div><div style={{fontSize:10,color:"#999",marginTop:1}}>{r.zone||"—"} · {r.date||"—"}</div></div>
              <Badge status={ov} small/>
            </div>
            <div style={{display:"flex",gap:12,marginBottom:8}}>
              <div style={{textAlign:"center",flex:1}}><div style={{fontSize:10,color:"#aaa",fontFamily:"'Courier New',monospace"}}>pH</div><div style={{fontSize:22,fontWeight:700,color:SC[ps],fontFamily:"'Courier New',monospace",lineHeight:1}}>{r.ph}</div></div>
              <div style={{textAlign:"center",flex:1}}><div style={{fontSize:10,color:"#aaa",fontFamily:"'Courier New',monospace"}}>CE</div><div style={{fontSize:22,fontWeight:700,color:SC[cs],fontFamily:"'Courier New',monospace",lineHeight:1}}>{r.ce}</div></div>
              {hist.length>1&&<div style={{display:"flex",alignItems:"center"}}><Sparkline data={hist} color={c.color}/></div>}
            </div>
            {r.photoURL&&<img src={r.photoURL} alt="" style={{width:"100%",height:70,objectFit:"cover",borderRadius:6,marginBottom:6}}/>}
            <div style={{fontSize:10,color:"#bbb",fontFamily:"'Courier New',monospace"}}>Registró: {r.worker||"—"}</div>
          </div>
        );})}
      </div>
      {readings.length>0&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:12,fontWeight:700,color:"#444"}}>ACTIVIDAD RECIENTE</div>
            <button onClick={()=>exportCSV(readings)} style={{padding:"6px 14px",border:"1px solid #27ae60",borderRadius:8,background:"#eafaf1",color:"#27ae60",cursor:"pointer",fontSize:12,fontWeight:600}}>⬇ Descargar CSV</button>
          </div>
          {[...readings].slice(0,8).map(r=>{const c=CROPS[r.crop];if(!c)return null;const s=getStatus(r.ph,c.ph)==="danger"||getStatus(r.ce,c.ce)==="danger"?"danger":getStatus(r.ph,c.ph)==="warning"||getStatus(r.ce,c.ce)==="warning"?"warning":"ok";return(
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #f5f5f5",flexWrap:"wrap"}}>
              <span style={{fontSize:16}}>{c.emoji}</span>
              {r.photoURL&&<img src={r.photoURL} alt="" style={{width:30,height:30,borderRadius:5,objectFit:"cover",flexShrink:0}}/>}
              <div style={{flex:1,minWidth:100}}><span style={{fontSize:12,fontWeight:600}}>{r.worker}</span><span style={{fontSize:11,color:"#999",marginLeft:6}}>{c.name} · {r.zone}</span></div>
              <span style={{fontFamily:"'Courier New',monospace",fontSize:11,color:"#666"}}>pH {r.ph} · CE {r.ce}</span>
              <span style={{fontSize:11,color:"#bbb"}}>{r.date}</span>
              <Badge status={s} small/>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}

// ─── ALERTAS ──────────────────────────────────────────────────────────────────
function Alertas({readings, onDelete, weeklyRangos={}}) {
  const [filter, setFilter] = useState("all");
  const [working, setWorking] = useState(false);

  const all = readings
    .filter(r => !r.resolved && !r.dismissed && (r.tipo||"entrada")==="entrada")
    .map(r => {
      const c = CROPS[r.crop]; if(!c) return null;
      const rng = getRangos(r.crop,"entrada",r.invernadero,weeklyRangos);
      const ph = rng?rng.ph:c.ph; const ce = rng?rng.ce:c.ce;
      const ps = getStatus(r.ph,ph); const cs = getStatus(r.ce,ce);
      const s = ps==="danger"||cs==="danger"?"danger":ps==="warning"||cs==="warning"?"warning":null;
      return s?{...r,status:s,phStatus:ps,ceStatus:cs}:null;
    }).filter(Boolean)
    .sort((a,b)=>({danger:0,warning:1}[a.status]-({danger:0,warning:1}[b.status])||b.date?.localeCompare(a.date)));

  const filtered = filter==="all"?all:all.filter(r=>r.status===filter);
  const resolverOne = id => updateDoc(doc(db,"readings",id),{resolved:true,resolvedAt:new Date().toISOString()});
  const dismissOne  = id => updateDoc(doc(db,"readings",id),{dismissed:true});
  const resolverTodas = async()=>{
    if(!window.confirm(`¿Marcar ${filtered.length} alertas como resueltas? Los datos se conservan.`))return;
    setWorking(true);for(const r of filtered)await resolverOne(r.id).catch(()=>{});setWorking(false);
  };
  const descartarTodas = async()=>{
    if(!window.confirm(`¿Descartar todas las ${all.length} alertas? Los datos se conservan.`))return;
    setWorking(true);for(const r of all)await dismissOne(r.id).catch(()=>{});setWorking(false);
  };

  return(
    <div>
      <div style={{background:"#eaf4fb",border:"1px solid #b5d4f4",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#1a5276"}}>
        💡 <strong>Resolver</strong> oculta la alerta pero conserva el dato en Reportes y gráficas. Solo las mediciones de <strong>Entrada</strong> generan alertas.
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[["all","Todas","#555"],["danger","Críticas","#e74c3c"],["warning","Advertencias","#f39c12"]].map(([v,l,c])=>(
            <button key={v} onClick={()=>setFilter(v)} style={{padding:"7px 16px",border:`1px solid ${filter===v?c:"#e0e0e0"}`,borderRadius:20,background:filter===v?c+"18":"transparent",color:filter===v?c:"#666",cursor:"pointer",fontSize:12,fontWeight:500}}>
              {l} {v==="all"?all.length:all.filter(r=>r.status===v).length}
            </button>
          ))}
        </div>
        <button onClick={()=>exportCSV(readings)} style={{padding:"7px 14px",border:"1px solid #27ae60",borderRadius:20,background:"#eafaf1",color:"#27ae60",cursor:"pointer",fontSize:12,fontWeight:600}}>⬇ CSV</button>
      </div>
      {filtered.length>0&&(
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          <button onClick={resolverTodas} disabled={working} style={{padding:"7px 16px",border:"1px solid #27ae60",borderRadius:8,background:"#eafaf1",color:"#27ae60",cursor:"pointer",fontSize:12,fontWeight:600}}>✓ Resolver mostradas ({filtered.length})</button>
          <button onClick={descartarTodas} disabled={working} style={{padding:"7px 16px",border:"1px solid #f39c1244",borderRadius:8,background:"#fef9e7",color:"#f39c12",cursor:"pointer",fontSize:12,fontWeight:600}}>⊘ Descartar todas ({all.length})</button>
        </div>
      )}
      {!filtered.length&&(
        <div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa",border:"0.5px solid #e0e0e0"}}>
          <div style={{fontSize:40,marginBottom:8}}>✅</div>
          <div style={{fontWeight:500,marginBottom:4}}>Sin alertas activas</div>
          <div style={{fontSize:12}}>Todas las mediciones de entrada están dentro de rango</div>
        </div>
      )}
      {filtered.map(r=>{
        const c=CROPS[r.crop]; if(!c)return null;
        const rng=getRangos(r.crop,"entrada",r.invernadero,weeklyRangos);
        const ph=rng?rng.ph:c.ph; const ce=rng?rng.ce:c.ce;
        return(
          <div key={r.id} style={{background:"#fff",border:`1px solid ${SC[r.status]}33`,borderLeft:`4px solid ${SC[r.status]}`,borderRadius:10,padding:"12px 16px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:20,marginTop:2}}>{c.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,color:c.color,marginBottom:2}}>
                  {c.name}{r.invernadero?` — ${r.invernadero}`:""} · {r.zone}{r.bandeja?` · ${r.bandeja}`:""}
                </div>
                <div style={{fontSize:11,color:"#aaa",marginBottom:6}}>{r.date} {r.time} · {r.worker}</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <div style={{background:SB[r.phStatus],borderRadius:8,padding:"4px 10px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:14,color:SC[r.phStatus]}}>pH {r.ph}</div>
                    <div style={{fontSize:9,color:SC[r.phStatus]}}>Rango: {ph.min}–{ph.max}</div>
                  </div>
                  <div style={{background:SB[r.ceStatus],borderRadius:8,padding:"4px 10px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:14,color:SC[r.ceStatus]}}>CE {r.ce}</div>
                    <div style={{fontSize:9,color:SC[r.ceStatus]}}>Rango: {ce.min}–{ce.max}</div>
                  </div>
                  <span style={{background:(r.tipo||"entrada")==="salida"?"#eaf4fb":"#eafaf1",color:(r.tipo||"entrada")==="salida"?"#2980b9":"#27ae60",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:600,display:"flex",alignItems:"center"}}>
                    {(r.tipo||"entrada")==="salida"?"⬆ Salida":"⬇ Entrada"}
                  </span>
                </div>
                {r.notes&&<div style={{fontSize:12,color:"#e67e22",marginTop:6}}>📝 {r.notes}</div>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={()=>resolverOne(r.id)} style={{padding:"6px 12px",background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:8,color:"#27ae60",cursor:"pointer",fontSize:12,fontWeight:600}}>✓ Resolver</button>
                <button onClick={()=>dismissOne(r.id)} style={{padding:"6px 10px",background:"#f5f5f5",border:"none",borderRadius:8,color:"#aaa",cursor:"pointer",fontSize:12}}>✕</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DRENAJE DASHBOARD ────────────────────────────────────────────────────────
function DrenajeDashboard({readings, cropFilter, crop}) {
  const drR = readings.filter(r=>r.crop===cropFilter&&(r.tipo||"entrada")==="salida"&&r.drenaje>0);
  const entR = readings.filter(r=>r.crop===cropFilter&&(r.tipo||"entrada")==="entrada"&&r.volumenEntrada>0);
  const drVals = drR.map(r=>r.drenaje);
  const entVals = entR.map(r=>r.volumenEntrada);
  const drAvg = drVals.length?n(drVals.reduce((s,v)=>s+v,0)/drVals.length):null;
  const drMin = drVals.length?n(Math.min(...drVals)):null;
  const drMax = drVals.length?n(Math.max(...drVals)):null;
  const drTotal = n(drVals.reduce((s,v)=>s+v,0));
  const entAvg = entVals.length?n(entVals.reduce((s,v)=>s+v,0)/entVals.length):null;
  const entTotal = n(entVals.reduce((s,v)=>s+v,0));
  const byDate={};
  drR.forEach(r=>{const d=r.date.slice(5);if(!byDate[d])byDate[d]={date:d,drenaje:0,entrada:0};byDate[d].drenaje=n(byDate[d].drenaje+r.drenaje);});
  entR.forEach(r=>{const d=r.date.slice(5);if(!byDate[d])byDate[d]={date:d,drenaje:0,entrada:0};byDate[d].entrada=n(byDate[d].entrada+(r.volumenEntrada||0));});
  const chartData = Object.values(byDate).sort((a,b)=>a.date.localeCompare(b.date)).slice(-14).map(d=>({...d,pct:d.entrada>0?n((d.drenaje/d.entrada)*100,1):null}));
  if(!drR.length) return(
    <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"3rem",textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:8}}>💧</div>
      <div style={{fontWeight:600,color:"#555",marginBottom:4}}>Sin datos de drenaje</div>
      <div style={{fontSize:12,color:"#aaa"}}>Los trabajadores deben seleccionar tipo "Salida" y llenar el volumen de drenaje</div>
    </div>
  );
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:14}}>
        {[{l:"Promedio drenaje",v:drAvg!==null?`${drAvg}mL`:"—",c:"#2980b9"},{l:"Mínimo",v:drMin!==null?`${drMin}mL`:"—",c:"#27ae60"},{l:"Máximo",v:drMax!==null?`${drMax}mL`:"—",c:"#e74c3c"},{l:"Total drenaje",v:`${drTotal}mL`,c:"#8e44ad"},{l:"Promedio entrada",v:entAvg!==null?`${entAvg}mL`:"—",c:"#27ae60"},{l:"Total entrada",v:`${entTotal}mL`,c:"#27ae60"},{l:"Registros",v:drR.length,c:"#7f8c8d"}].map(k=>(
          <div key={k.l} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontFamily:"'Courier New',monospace",fontSize:18,fontWeight:700,color:k.c}}>{k.v}</div>
            <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{k.l}</div>
          </div>
        ))}
      </div>
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:4}}>💧 DRENAJE vs ENTRADA — {crop.emoji} {crop.name}</div>
        <div style={{fontSize:11,color:"#888",marginBottom:12}}>Rango recomendado: 20–35% del volumen de entrada</div>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={chartData} margin={{top:5,right:20,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="date" tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false} width={50} unit="mL"/>
            <Tooltip formatter={(v,name)=>[`${v}mL`,name]} contentStyle={{fontSize:11,borderRadius:8}}/>
            <Legend wrapperStyle={{fontSize:11}}/>
            <Bar dataKey="entrada" name="Entrada(mL)" fill="#a9dfb4" radius={[4,4,0,0]}/>
            <Bar dataKey="drenaje" name="Drenaje(mL)" fill="#2980b9" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {chartData.some(d=>d.pct!==null)&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12}}>📊 % DRENAJE / ENTRADA POR DÍA</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData.filter(d=>d.pct!==null)} margin={{top:5,right:30,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="date" tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false} width={35} unit="%"/>
              <Tooltip formatter={v=>[`${v}%`,"% drenaje"]} contentStyle={{fontSize:11,borderRadius:8}}/>
              <ReferenceLine y={20} stroke="#27ae60" strokeDasharray="4 2"/>
              <ReferenceLine y={35} stroke="#f39c12" strokeDasharray="4 2"/>
              <Bar dataKey="pct" name="% drenaje" radius={[4,4,0,0]}>
                {chartData.filter(d=>d.pct!==null).map((d,i)=>(<Cell key={i} fill={d.pct>=20&&d.pct<=35?"#27ae60":d.pct<20?"#e74c3c":"#f39c12"}/>))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:12,marginTop:6,fontSize:11,color:"#888"}}>
            <span><span style={{display:"inline-block",width:10,height:10,background:"#27ae60",borderRadius:2,marginRight:4}}/>20–35% óptimo</span>
            <span><span style={{display:"inline-block",width:10,height:10,background:"#f39c12",borderRadius:2,marginRight:4}}/>{">"} 35% exceso</span>
            <span><span style={{display:"inline-block",width:10,height:10,background:"#e74c3c",borderRadius:2,marginRight:4}}/>{"<"} 20% insuficiente</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HISTORIAL TABLE ─────────────────────────────────────────────────────────
function HistorialTable({cr, onDelete, weeklyRangos={}}) {
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const startEdit = r => { setEditId(r.id); setEditForm({ph:r.ph,ce:r.ce,volumenEntrada:r.volumenEntrada||"",drenaje:r.drenaje||"",notes:r.notes||"",zone:r.zone||"",bandeja:r.bandeja||"",ca:r.ca||"",no3:r.no3||"",k:r.k||"",fe:r.fe||""}); };
  const saveEdit = async()=>{
    setSaving(true);
    try{
      await updateDoc(doc(db,"readings",editId),{ph:parseFloat(editForm.ph)||0,ce:parseFloat(editForm.ce)||0,volumenEntrada:editForm.volumenEntrada?parseFloat(editForm.volumenEntrada):null,drenaje:editForm.drenaje?parseFloat(editForm.drenaje):null,notes:editForm.notes||"",zone:editForm.zone||"",bandeja:editForm.bandeja||"",ca:editForm.ca?parseFloat(editForm.ca):null,no3:editForm.no3?parseFloat(editForm.no3):null,k:editForm.k?parseFloat(editForm.k):null,fe:editForm.fe?parseFloat(editForm.fe):null});
      setEditId(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const IS = {padding:"4px 6px",border:"1px solid #ccc",borderRadius:6,fontSize:12,background:"#fff",color:"#111",WebkitTextFillColor:"#111",colorScheme:"light",fontFamily:"'Courier New',monospace"};
  return(
    <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
      {editId&&<div style={{background:"#fff3cd",border:"1px solid #ffc10744",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#856404",display:"flex",alignItems:"center",gap:10}}>✎ Editando registro — corrige y guarda<button onClick={()=>setEditId(null)} style={{marginLeft:"auto",background:"transparent",border:"none",cursor:"pointer",color:"#aaa",fontSize:14}}>✕</button></div>}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"1px solid #f0f0f0"}}>
            {["","Fecha","Tipo","Inv.","Zona","Tinaco","Bandeja","pH","CE","Vol.Ent","Drenaje","Ca","NO₃","K","Fe","Estado","Trabajador",""].map((h,i)=>(
              <th key={i} style={{padding:"7px 10px",textAlign:"left",color:"#aaa",fontWeight:500,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(cr.length>100?[...cr].slice(-100).reverse():[...cr].reverse()).map((r,i)=>{
              const c=CROPS[r.crop]; if(!c)return null;
              const rng=getRangos(r.crop,r.tipo||"entrada",r.invernadero||"",weeklyRangos||{});
              const ps=getStatus(r.ph,rng?rng.ph:c.ph); const cs=getStatus(r.ce,rng?rng.ce:c.ce);
              const s=ps==="danger"||cs==="danger"?"danger":ps==="warning"||cs==="warning"?"warning":"ok";
              const isE=editId===r.id;
              return(
                <tr key={r.id||i} style={{borderBottom:`1px solid ${isE?"#ffc10744":"#fafafa"}`,background:isE?"#fffdf0":"transparent"}}>
                  <td style={{padding:"6px 8px"}}>{r.photoURL&&<img src={r.photoURL} alt="" style={{width:26,height:26,borderRadius:4,objectFit:"cover"}}/>}</td>
                  <td style={{padding:"6px 8px",fontFamily:"'Courier New',monospace",fontSize:11,color:"#999",whiteSpace:"nowrap"}}>{r.date}</td>
                  <td style={{padding:"6px 8px"}}><span style={{background:(r.tipo||"entrada")==="salida"?"#eaf4fb":"#eafaf1",color:(r.tipo||"entrada")==="salida"?"#2980b9":"#27ae60",borderRadius:8,padding:"1px 6px",fontSize:10,fontWeight:600}}>{(r.tipo||"entrada")==="salida"?"⬆ Sal":"⬇ Ent"}</span></td>
                  <td style={{padding:"6px 8px",fontSize:11,color:"#c0392b",fontWeight:600}}>{r.invernadero||"—"}</td>
                  <td style={{padding:"6px 8px",minWidth:60}}>{isE?<input value={editForm.zone} onChange={e=>setEditForm(p=>({...p,zone:e.target.value}))} style={{...IS,width:65}}/>:r.zone}</td>
                  <td style={{padding:"6px 8px",minWidth:75,fontSize:11,color:"#2980b9",fontWeight:600}}>{r.tinaco||"—"}</td>
                  <td style={{padding:"6px 8px",minWidth:70}}>{isE?<input value={editForm.bandeja} onChange={e=>setEditForm(p=>({...p,bandeja:e.target.value}))} style={{...IS,width:70}}/>:r.bandeja||"—"}</td>
                  <td style={{padding:"6px 8px",minWidth:55}}>{isE?<input type="number" step="0.01" value={editForm.ph} onChange={e=>setEditForm(p=>({...p,ph:e.target.value}))} style={{...IS,width:55,fontWeight:700}}/>:<span style={{fontFamily:"'Courier New',monospace",fontWeight:700,color:SC[ps]}}>{r.ph}</span>}</td>
                  <td style={{padding:"6px 8px",minWidth:55}}>{isE?<input type="number" step="0.01" value={editForm.ce} onChange={e=>setEditForm(p=>({...p,ce:e.target.value}))} style={{...IS,width:55,fontWeight:700}}/>:<span style={{fontFamily:"'Courier New',monospace",fontWeight:700,color:SC[cs]}}>{r.ce}</span>}</td>
                  <td style={{padding:"6px 8px",minWidth:70}}>{isE?<input type="number" step="1" value={editForm.volumenEntrada} onChange={e=>setEditForm(p=>({...p,volumenEntrada:e.target.value}))} style={{...IS,width:65}} placeholder="mL"/>:<span style={{fontFamily:"'Courier New',monospace",fontSize:11,color:"#27ae60"}}>{r.volumenEntrada?`${r.volumenEntrada}mL`:"—"}</span>}</td>
                  <td style={{padding:"6px 8px",minWidth:70}}>{isE?<input type="number" step="1" value={editForm.drenaje} onChange={e=>setEditForm(p=>({...p,drenaje:e.target.value}))} style={{...IS,width:65}} placeholder="mL"/>:<span style={{fontFamily:"'Courier New',monospace",fontSize:11,color:"#2980b9"}}>{r.drenaje?`${r.drenaje}mL`:"—"}</span>}</td>
                  {(r.ca||r.no3||r.k||r.fe||isE)&&<>
                    <td style={{padding:"6px 8px",minWidth:55}}>{isE?<input type="number" step="0.1" value={editForm.ca} onChange={e=>setEditForm(p=>({...p,ca:e.target.value}))} style={{...IS,width:50}} placeholder="Ca"/>:<span style={{fontFamily:"'Courier New',monospace",fontSize:10,color:"#8e44ad"}}>{r.ca||"—"}</span>}</td>
                    <td style={{padding:"6px 8px",minWidth:55}}>{isE?<input type="number" step="0.1" value={editForm.no3} onChange={e=>setEditForm(p=>({...p,no3:e.target.value}))} style={{...IS,width:50}} placeholder="NO₃"/>:<span style={{fontFamily:"'Courier New',monospace",fontSize:10,color:"#8e44ad"}}>{r.no3||"—"}</span>}</td>
                    <td style={{padding:"6px 8px",minWidth:50}}>{isE?<input type="number" step="0.1" value={editForm.k} onChange={e=>setEditForm(p=>({...p,k:e.target.value}))} style={{...IS,width:45}} placeholder="K"/>:<span style={{fontFamily:"'Courier New',monospace",fontSize:10,color:"#8e44ad"}}>{r.k||"—"}</span>}</td>
                    <td style={{padding:"6px 8px",minWidth:50}}>{isE?<input type="number" step="0.01" value={editForm.fe} onChange={e=>setEditForm(p=>({...p,fe:e.target.value}))} style={{...IS,width:45}} placeholder="Fe"/>:<span style={{fontFamily:"'Courier New',monospace",fontSize:10,color:"#8e44ad"}}>{r.fe||"—"}</span>}</td>
                  </>}
                  <td style={{padding:"6px 8px"}}><Badge status={s} small/></td>
                  <td style={{padding:"6px 8px",color:"#888",whiteSpace:"nowrap"}}>{r.worker}</td>
                  <td style={{padding:"6px 8px"}}>
                    {isE?<div style={{display:"flex",gap:4}}><button onClick={saveEdit} disabled={saving} style={{background:"#27ae60",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>{saving?"...":"✓ Guardar"}</button><button onClick={()=>setEditId(null)} style={{background:"#f0f0f0",color:"#666",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11}}>✕</button></div>
                    :<div style={{display:"flex",gap:4}}><button onClick={()=>startEdit(r)} style={{background:"#eaf4fb",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#2980b9",fontWeight:600}}>✎</button><button onClick={()=>{if(window.confirm("¿Eliminar?"))onDelete(r.id);}} style={{background:"#fdedec",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#c0392b"}}>✕</button></div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── RANGOS SEMANALES ─────────────────────────────────────────────────────────
function RangosSemanales() {
  const [rangos, setRangos] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(()=>{
    const unsub=onSnapshot(doc(db,"config","rangos_semanales"),snap=>{if(snap.exists())setRangos(snap.data());});
    return()=>unsub();
  },[]);
  const filas=[];
  Object.entries(CROPS).forEach(([cropKey,crop])=>{
    const tipos=cropKey==="zarzamora"?["entrada"]:["entrada","salida"];
    const invernaderos=crop.invernaderos||[null];
    invernaderos.forEach(inv=>tipos.forEach(tipo=>{
      const key=inv?`${cropKey}_${inv.replace(" ","")}_${tipo}`:`${cropKey}_${tipo}`;
      const defRng=tipo==="entrada"?crop.entrada:crop.salida;
      filas.push({cropKey,crop,inv,tipo,key,defRng});
    }));
  });
  const getV=(key,field)=>rangos[key]?.[field]??"";
  const setV=(key,field,val)=>setRangos(p=>{
    const v = val===""?undefined:parseFloat(val);
    const newKey = {...(p[key]||{})};
    if(v===undefined||isNaN(v)) delete newKey[field];
    else newKey[field] = v;
    return {...p,[key]:newKey};
  });
  const guardar=async()=>{
    setSaving(true);
    try{
      // Filtrar solo entradas con datos válidos
      const clean = {};
      Object.entries(rangos).forEach(([k,obj])=>{
        const hasData = obj && (obj.phMin!==undefined||obj.phMax!==undefined||obj.ceMin!==undefined||obj.ceMax!==undefined);
        if(hasData) clean[k] = obj;
      });
      await setDoc(doc(db,"config","rangos_semanales"), clean);
      setSaved(true);
      setTimeout(()=>setSaved(false),4000);
    }catch(e){
      alert("⚠ Error al guardar: "+e.message);
    }
    setSaving(false);
  };
  const resetDefaults=async()=>{if(!window.confirm("¿Resetear a valores de literatura?"))return;const d={};filas.forEach(({key,defRng})=>{d[key]={phMin:defRng.ph.min,phMax:defRng.ph.max,ceMin:defRng.ce.min,ceMax:defRng.ce.max};});setRangos(d);await setDoc(doc(db,"config","rangos_semanales"),d);};
  const IS2={width:58,padding:"5px 6px",border:"1.5px solid #ddd",borderRadius:6,fontSize:12,textAlign:"center",background:"#fff",color:"#111",WebkitTextFillColor:"#111",colorScheme:"light",fontFamily:"'Courier New',monospace"};
  return(
    <div>
      {saved&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:"10px 14px",marginBottom:14,color:"#27ae60",fontWeight:600,fontSize:13}}>✓ Rangos guardados — se aplican inmediatamente en alertas y reportes</div>}
      <div style={{background:"#eaf4fb",border:"1px solid #b5d4f4",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#1a5276"}}>
        📋 Configura los rangos de pH y CE para <strong>esta semana</strong>. Si dejas vacío se usan los valores de literatura.
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:600}}>
          <thead>
            <tr style={{background:"#f9f9f9",borderBottom:"2px solid #e0e0e0"}}>
              <th style={{padding:"10px 12px",textAlign:"left",color:"#555",fontWeight:600,fontSize:11}}>Cultivo</th>
              <th style={{padding:"10px 12px",textAlign:"left",color:"#555",fontWeight:600,fontSize:11}}>Invernadero</th>
              <th style={{padding:"10px 12px",textAlign:"left",color:"#555",fontWeight:600,fontSize:11}}>Tipo</th>
              <th style={{padding:"10px 12px",textAlign:"center",color:"#27ae60",fontWeight:600,fontSize:11}} colSpan={2}>pH Min / Max</th>
              <th style={{padding:"10px 12px",textAlign:"center",color:"#2980b9",fontWeight:600,fontSize:11}} colSpan={2}>CE Min / Max</th>
              <th style={{padding:"10px 12px",color:"#aaa",fontWeight:400,fontSize:11}}>Literatura</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({cropKey,crop,inv,tipo,key,defRng})=>(
              <tr key={key} style={{borderBottom:"1px solid #f5f5f5"}}>
                <td style={{padding:"8px 12px"}}><span style={{color:crop.color,fontWeight:600}}>{crop.emoji} {crop.name}</span></td>
                <td style={{padding:"8px 12px",color:"#c0392b",fontWeight:600,fontSize:12}}>{inv||"—"}</td>
                <td style={{padding:"8px 12px"}}><span style={{background:tipo==="entrada"?"#eafaf1":"#eaf4fb",color:tipo==="entrada"?"#27ae60":"#2980b9",borderRadius:8,padding:"2px 8px",fontSize:11,fontWeight:600}}>{tipo==="entrada"?"⬇ Entrada":"⬆ Salida"}</span></td>
                <td style={{padding:"6px 8px",textAlign:"center"}}><input type="number" step="0.1" value={getV(key,"phMin")} onChange={e=>setV(key,"phMin",e.target.value)} placeholder={defRng.ph.min} style={{...IS2,borderColor:"#27ae6066"}}/></td>
                <td style={{padding:"6px 8px",textAlign:"center"}}><input type="number" step="0.1" value={getV(key,"phMax")} onChange={e=>setV(key,"phMax",e.target.value)} placeholder={defRng.ph.max} style={{...IS2,borderColor:"#27ae6066"}}/></td>
                <td style={{padding:"6px 8px",textAlign:"center"}}><input type="number" step="0.1" value={getV(key,"ceMin")} onChange={e=>setV(key,"ceMin",e.target.value)} placeholder={defRng.ce.min} style={{...IS2,borderColor:"#2980b966"}}/></td>
                <td style={{padding:"6px 8px",textAlign:"center"}}><input type="number" step="0.1" value={getV(key,"ceMax")} onChange={e=>setV(key,"ceMax",e.target.value)} placeholder={defRng.ce.max} style={{...IS2,borderColor:"#2980b966"}}/></td>
                <td style={{padding:"8px 12px",fontSize:11,color:"#aaa"}}>pH {defRng.ph.min}–{defRng.ph.max} · CE {defRng.ce.min}–{defRng.ce.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
        <button onClick={guardar} disabled={saving} style={{padding:"10px 28px",background:saving?"#aaa":"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:saving?"not-allowed":"pointer",fontWeight:700,fontSize:13}}>{saving?"Guardando...":"💾 Guardar rangos"}</button>
        <button onClick={resetDefaults} style={{padding:"10px 18px",border:"1px solid #e0e0e0",borderRadius:8,background:"#fff",color:"#888",cursor:"pointer",fontSize:13}}>🔄 Resetear a literatura</button>
      </div>
    </div>
  );
}


function Reportes({readings,onDelete,weeklyRangos={}}){
  const [showReset,setShowReset]=useState(false);
  const [resetting,setResetting]=useState(false);
  const resetReadings=async()=>{
    if(!window.confirm("⚠️ Eliminará PERMANENTEMENTE todas las mediciones. ¿Seguro?"))return;
    if(!window.confirm("Última confirmación — no se puede deshacer."))return;
    setResetting(true);
    try{const snap=await import("firebase/firestore").then(({getDocs,collection:col})=>getDocs(col(db,"readings")));for(const d of snap.docs)await import("firebase/firestore").then(({deleteDoc:del,doc:dc})=>del(dc(db,"readings",d.id)));setShowReset(false);}
    catch(e){alert("Error: "+e.message);}
    setResetting(false);
  };
  const [cropFilter,setCropFilter]=useState("jitomate");
  const [metric,setMetric]=useState("ph");
  const [sub,setSub]=useState("tendencia");
  const [invFilter,setInvFilter]=useState("all");
  const [zonaFilter,setZonaFilter]=useState("all");
  const [tipoFilter,setTipoFilter]=useState("all");
  const [tinacoFilter,setTinacoFilter]=useState("all");
  const crop=CROPS[cropFilter];
  const cr=readings.filter(r=>{
    if(r.crop!==cropFilter) return false;
    if(tipoFilter!=="all" && (r.tipo||"entrada")!==tipoFilter) return false;
    if(invFilter!=="all" && r.invernadero!==invFilter) return false;
    if(zonaFilter!=="all" && r.zone!==zonaFilter) return false;
    if(tinacoFilter!=="all" && r.tinaco!==tinacoFilter) return false;
    return true;
  });
  const chartData=useMemo(()=>{const g={};cr.sort((a,b)=>a.date.localeCompare(b.date)).forEach(r=>{if(!g[r.date])g[r.date]={date:r.date,phVals:[],ceVals:[]};g[r.date].phVals.push(r.ph);g[r.date].ceVals.push(r.ce);});return Object.values(g).map(d=>({date:d.date.slice(5),ph:n(d.phVals.reduce((s,v)=>s+v,0)/d.phVals.length),ce:n(d.ceVals.reduce((s,v)=>s+v,0)/d.ceVals.length)}));},[readings,cropFilter,tipoFilter,invFilter,zonaFilter,tinacoFilter]);
  const compareData=useMemo(()=>{const w={};cr.forEach(r=>{const d=new Date(r.date);const wk=`S${Math.ceil(d.getDate()/7)}-${d.getMonth()+1}`;if(!w[wk])w[wk]={week:wk,phVals:[],ceVals:[]};w[wk].phVals.push(r.ph);w[wk].ceVals.push(r.ce);});return Object.values(w).map(wk=>({week:wk.week,ph:n(wk.phVals.reduce((s,v)=>s+v,0)/wk.phVals.length),ce:n(wk.ceVals.reduce((s,v)=>s+v,0)/wk.ceVals.length),registros:wk.phVals.length}));},[readings,cropFilter,tipoFilter,invFilter,zonaFilter,tinacoFilter]);
  const stats=useMemo(()=>{const vals=cr.map(r=>r[metric]);if(!vals.length)return{avg:"—",min:"—",max:"—",out:0,total:0};return{avg:n(vals.reduce((s,v)=>s+v,0)/vals.length),min:n(Math.min(...vals)),max:n(Math.max(...vals)),out:vals.filter(v=>metric==="ph"?(v<crop.ph.min||v>crop.ph.max):(v<crop.ce.min||v>crop.ce.max)).length,total:vals.length};},[readings,cropFilter,metric,tipoFilter,invFilter,zonaFilter,tinacoFilter]);
  const yD=metric==="ph"?[3.5,8.5]:[0,6];
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(CROPS).map(([k,c])=>(<button key={k} onClick={()=>setCropFilter(k)} style={{padding:"7px 14px",border:`1px solid ${cropFilter===k?c.color:"#e0e0e0"}`,borderRadius:20,background:cropFilter===k?c.color+"18":"transparent",color:cropFilter===k?c.color:"#666",cursor:"pointer",fontSize:12,fontWeight:500}}>{c.emoji} {c.name}</button>))}</div>
        <button onClick={()=>exportCSV(cr)} style={{marginLeft:"auto",padding:"7px 14px",border:"1px solid #27ae60",borderRadius:20,background:"#eafaf1",color:"#27ae60",cursor:"pointer",fontSize:12,fontWeight:600}}>⬇ CSV</button>
          <button onClick={()=>setShowReset(s=>!s)} style={{padding:"7px 14px",border:"1px solid #e74c3c44",borderRadius:20,background:showReset?"#fdedec":"#fff",color:"#c0392b",cursor:"pointer",fontSize:12,fontWeight:600}}>🔄 Reset</button>
        </div>
      {showReset&&(
        <div style={{background:"#fdedec",border:"2px solid #e74c3c",borderRadius:12,padding:"14px 18px",marginBottom:14}}>
          <div style={{fontWeight:700,color:"#c0392b",marginBottom:6}}>⚠️ Reset de mediciones del ciclo</div>
          <div style={{fontSize:13,color:"#555",marginBottom:12}}>Elimina <strong>permanentemente</strong> todas las mediciones de pH/CE de Firebase. Las ventas, cosechas y mermas <strong>NO</strong> se borran.</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={resetReadings} disabled={resetting}
              style={{padding:"9px 20px",background:resetting?"#aaa":"#e74c3c",color:"#fff",border:"none",borderRadius:8,cursor:resetting?"not-allowed":"pointer",fontWeight:700,fontSize:13}}>
              {resetting?"Borrando...":"🗑 Confirmar reset total"}
            </button>
            <button onClick={()=>setShowReset(false)}
              style={{padding:"9px 16px",border:"1px solid #e0e0e0",borderRadius:8,background:"#fff",color:"#888",cursor:"pointer",fontSize:13}}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:4,marginBottom:12,background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:4}}>
        {[["tendencia","📈 Tendencia"],["comparar","⇅ Entrada vs Salida"],["invernaderos","🏠 Invernaderos"],["drenaje","💧 Drenaje"],["nutrientes","🔬 Nutrientes"],["semanas","📅 Semanas"],["historial","📋 Historial"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSub(k)}
            style={{padding:"7px 10px",border:"none",borderRadius:8,background:sub===k?"#27ae60":"transparent",color:sub===k?"#fff":"#888",cursor:"pointer",fontSize:11,fontWeight:sub===k?600:400,whiteSpace:"nowrap"}}>
            {l}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
        {[["all","Todos"],["entrada","⬇ Entrada"],["salida","⬆ Salida"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTipoFilter(v)} style={{padding:"5px 12px",border:`1px solid ${tipoFilter===v?"#555":"#e0e0e0"}`,borderRadius:20,background:tipoFilter===v?"#55555518":"transparent",color:tipoFilter===v?"#333":"#777",cursor:"pointer",fontSize:11,fontWeight:tipoFilter===v?700:400}}>{l}</button>
        ))}
      </div>
      {CROPS[cropFilter]?.invernaderos&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
          {["all",...CROPS[cropFilter].invernaderos].map(inv=>(
            <button key={inv} onClick={()=>setInvFilter(inv)} style={{padding:"5px 12px",border:`1px solid ${invFilter===inv?"#c0392b":"#e0e0e0"}`,borderRadius:20,background:invFilter===inv?"#c0392b18":"transparent",color:invFilter===inv?"#c0392b":"#777",cursor:"pointer",fontSize:11,fontWeight:invFilter===inv?700:400}}>
              {inv==="all"?"Todos":inv}
            </button>
          ))}
        </div>
      )}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
        {["all","Zona 1","Zona 2","Zona 3","Zona 4"].map(z=>(
          <button key={z} onClick={()=>setZonaFilter(z)} style={{padding:"5px 12px",border:`1px solid ${zonaFilter===z?"#333":"#e0e0e0"}`,borderRadius:20,background:zonaFilter===z?"#33333318":"transparent",color:zonaFilter===z?"#333":"#777",cursor:"pointer",fontSize:11,fontWeight:zonaFilter===z?700:400}}>
            {z==="all"?"Todas zonas":z}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
        {["all","Tinaco 1","Tinaco 2","Tinaco 3","Tinaco 4"].map(t=>(
          <button key={t} onClick={()=>setTinacoFilter(t)} style={{padding:"5px 12px",border:`1px solid ${tinacoFilter===t?"#2980b9":"#e0e0e0"}`,borderRadius:20,background:tinacoFilter===t?"#2980b918":"transparent",color:tinacoFilter===t?"#2980b9":"#777",cursor:"pointer",fontSize:11,fontWeight:tinacoFilter===t?700:400}}>
            {t==="all"?"Todos tinacos":`💧 ${t}`}
          </button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:16}}>
        {[{l:"Promedio",v:stats.avg,c:crop.color},{l:"Mínimo",v:stats.min,c:"#2980b9"},{l:"Máximo",v:stats.max,c:"#8e44ad"},{l:"Fuera rango",v:stats.out,c:"#e74c3c"},{l:"Total",v:stats.total,c:"#27ae60"}].map(s=>(<div key={s.l} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:"12px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:s.c,fontFamily:"'Courier New',monospace"}}>{s.v}</div><div style={{fontSize:10,color:"#aaa",marginTop:2}}>{s.l}</div></div>))}
      </div>
      {sub==="tendencia"&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:20,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:12,fontWeight:700,color:"#444"}}>TENDENCIA — {crop.emoji} {crop.name}</div>
            <div style={{display:"flex",gap:6}}>{[["ph","pH"],["ce","CE"]].map(([v,l])=>(<button key={v} onClick={()=>setMetric(v)} style={{padding:"5px 12px",border:`1px solid ${metric===v?"#2c3e50":"#e0e0e0"}`,borderRadius:16,background:metric===v?"#2c3e50":"transparent",color:metric===v?"#fff":"#666",cursor:"pointer",fontSize:11}}>{l}</button>))}</div>
          </div>
          {chartData.length<2?<div style={{textAlign:"center",padding:"2rem",color:"#aaa",fontSize:12}}>Necesitas al menos 2 registros para ver la gráfica</div>:(
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={chartData} margin={{top:5,right:20,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="date" tick={{fontSize:11,fill:"#aaa"}} axisLine={false} tickLine={false}/>
                <YAxis domain={yD} tick={{fontSize:11,fill:"#aaa"}} axisLine={false} tickLine={false} width={32}/>
                <Tooltip contentStyle={{fontSize:12,border:"1px solid #e0e0e0",borderRadius:8}} labelStyle={{fontWeight:700}}/>
                <ReferenceLine y={metric==="ph"?crop.ph.min:crop.ce.min} stroke="#f39c12" strokeDasharray="4 2"/>
                <ReferenceLine y={metric==="ph"?crop.ph.max:crop.ce.max} stroke="#f39c12" strokeDasharray="4 2"/>
                <Line type="monotone" dataKey={metric} stroke={crop.color} strokeWidth={2.5} dot={{r:4,fill:crop.color}} activeDot={{r:6}}/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
      {sub==="comparar"&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:20,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:16}}>COMPARAR SEMANAS — {crop.emoji} {crop.name}</div>
          {compareData.length<2?<div style={{textAlign:"center",padding:"2rem",color:"#aaa",fontSize:12}}>Necesitas registros de al menos 2 semanas distintas</div>:(
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={compareData} margin={{top:5,right:20,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="week" tick={{fontSize:11,fill:"#aaa"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:"#aaa"}} axisLine={false} tickLine={false} width={32}/>
                <Tooltip contentStyle={{fontSize:12,border:"1px solid #e0e0e0",borderRadius:8}}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="ph" name="pH prom." fill={crop.color} radius={[4,4,0,0]}/>
                <Bar dataKey="ce" name="CE prom." fill={crop.color+"88"} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
      {sub==="drenaje"&&<DrenajeDashboard readings={cr} cropFilter={cropFilter} crop={crop}/>}
      {/* ── INVERNADEROS ── */}
      {sub==="invernaderos"&&crop.invernaderos&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14,letterSpacing:0.3}}>🏠 COMPARACIÓN POR INVERNADERO — {crop.emoji} {crop.name}</div>
          {crop.invernaderos.map(inv=>{
            const invData=cr.filter(r=>r.invernadero===inv);
            if(!invData.length) return null;
            const phVals=invData.map(r=>r.ph).filter(Boolean);
            const ceVals=invData.map(r=>r.ce).filter(Boolean);
            const phAvg=phVals.length?n(phVals.reduce((s,v)=>s+v,0)/phVals.length):null;
            const ceAvg=ceVals.length?n(ceVals.reduce((s,v)=>s+v,0)/ceVals.length):null;
            const rng=getRangos(cropFilter,"entrada","",weeklyRangos||{});
            const ps=phAvg?getStatus(phAvg,rng?rng.ph:crop.ph):"ok";
            const cs=ceAvg?getStatus(ceAvg,rng?rng.ce:crop.ce):"ok";
            return(
              <div key={inv} style={{background:"#f9f9f9",borderRadius:10,padding:"12px 16px",marginBottom:10,border:`1px solid ${SC[ps]==="danger"||SC[cs]==="danger"?"#e74c3c33":"#e0e0e0"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#c0392b",minWidth:60}}>{inv}</div>
                  <div style={{fontSize:12,color:"#888"}}>{invData.length} mediciones</div>
                  <div style={{display:"flex",gap:10,marginLeft:"auto",flexWrap:"wrap"}}>
                    <div style={{textAlign:"center",background:SB[ps],borderRadius:8,padding:"6px 14px"}}>
                      <div style={{fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:16,color:SC[ps]}}>{phAvg??"-"}</div>
                      <div style={{fontSize:9,color:SC[ps]}}>pH prom</div>
                    </div>
                    <div style={{textAlign:"center",background:SB[cs],borderRadius:8,padding:"6px 14px"}}>
                      <div style={{fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:16,color:SC[cs]}}>{ceAvg??"-"}</div>
                      <div style={{fontSize:9,color:SC[cs]}}>CE prom</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {!crop.invernaderos&&<div style={{textAlign:"center",padding:"2rem",color:"#aaa",fontSize:12}}>Este cultivo no tiene invernaderos configurados</div>}
        </div>
      )}

      {/* ── NUTRIENTES ── */}
      {sub==="nutrientes"&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14}}>🔬 NUTRIENTES — {crop.emoji} {crop.name}</div>
          {(()=>{
            const nutReadings=cr.filter(r=>r.ca||r.no3||r.k||r.fe);
            if(!nutReadings.length) return <div style={{textAlign:"center",padding:"2rem",color:"#aaa",fontSize:12}}>Sin datos de nutrientes. Los trabajadores los registran al hacer mediciones de {crop.name}.</div>;
            const avg=field=>{ const vals=nutReadings.map(r=>r[field]).filter(v=>v>0); return vals.length?n(vals.reduce((s,v)=>s+v,0)/vals.length):null; };
            return(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
                  {[{l:"Calcio (Ca)",k:"ca",u:"mg/L",min:120,max:180},{l:"Nitratos",k:"no3",u:"mg/L",min:150,max:200},{l:"Potasio (K)",k:"k",u:"mg/L",min:200,max:300},{l:"Hierro (Fe)",k:"fe",u:"mg/L",min:1.5,max:3.0}].map(f=>{
                    const v=avg(f.k);
                    const st=v?getStatus(v,{min:f.min,max:f.max}):"ok";
                    return(
                      <div key={f.k} style={{background:SB[st],border:`1px solid ${SC[st]}33`,borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
                        <div style={{fontFamily:"'Courier New',monospace",fontSize:18,fontWeight:700,color:SC[st]}}>{v??"-"} {f.u}</div>
                        <div style={{fontSize:10,color:"#888",marginTop:2}}>{f.l}</div>
                        <div style={{fontSize:9,color:"#aaa"}}>Rango: {f.min}–{f.max}</div>
                      </div>
                    );
                  })}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={nutReadings.slice(-14).map(r=>({date:r.date.slice(5),ca:r.ca||0,no3:r.no3||0,k:r.k||0,fe:r.fe||0}))} margin={{top:5,right:20,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="date" tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false} width={40}/>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:8}}/>
                    <Legend wrapperStyle={{fontSize:11}}/>
                    <Bar dataKey="ca"  name="Ca"  fill="#e74c3c" radius={[3,3,0,0]}/>
                    <Bar dataKey="no3" name="NO₃" fill="#3498db" radius={[3,3,0,0]}/>
                    <Bar dataKey="k"   name="K"   fill="#f39c12" radius={[3,3,0,0]}/>
                    <Bar dataKey="fe"  name="Fe"  fill="#8e44ad" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── SEMANAS ── */}
      {sub==="semanas"&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14}}>📅 COMPARACIÓN SEMANAL — {crop.emoji} {crop.name}</div>
          {(()=>{
            const byWeek={};
            cr.forEach(r=>{
              const d=new Date(r.date);
              const week=`${d.getFullYear()}-W${String(Math.ceil((d.getDate()+new Date(d.getFullYear(),d.getMonth(),1).getDay())/7)).padStart(2,"0")}`;
              if(!byWeek[week])byWeek[week]={week,phVals:[],ceVals:[]};
              if(r.ph)byWeek[week].phVals.push(r.ph);
              if(r.ce)byWeek[week].ceVals.push(r.ce);
            });
            const weekData=Object.values(byWeek).sort((a,b)=>a.week.localeCompare(b.week)).slice(-8).map(w=>({
              week:w.week.slice(5),
              ph:w.phVals.length?n(w.phVals.reduce((s,v)=>s+v,0)/w.phVals.length):null,
              ce:w.ceVals.length?n(w.ceVals.reduce((s,v)=>s+v,0)/w.ceVals.length):null,
              n:w.phVals.length,
            }));
            if(!weekData.length) return <div style={{textAlign:"center",padding:"2rem",color:"#aaa",fontSize:12}}>Sin datos suficientes para comparar semanas</div>;
            return(
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weekData} margin={{top:5,right:20,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="week" tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:"#aaa"}} axisLine={false} tickLine={false} width={35}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8}}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  <Bar dataKey="ph" name="pH prom" fill="#27ae60" radius={[4,4,0,0]}/>
                  <Bar dataKey="ce" name="CE prom" fill="#2980b9" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      )}

      {sub==="historial"&&<HistorialTable cr={cr} onDelete={onDelete} weeklyRangos={weeklyRangos}/>}
    </div>
  );
}

// ─── DIAGNÓSTICO IA ───────────────────────────────────────────────────────────
function DiagnosticoIA(){
  const [diagnoses,setDiagnoses]=useState([]);
  const [form,setForm]=useState({crop:"jitomate",zone:"",worker:"",ph:"",ce:"",notes:""});
  const [imgPreview,setImgPreview]=useState(null);
  const [imgBase64,setImgBase64]=useState(null);
  const [loading,setLoading]=useState(false);
  const [sel,setSel]=useState(null);
  const [view,setView]=useState("historial");
  const fileRef=React.useRef();
  const handleImage=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>{setImgPreview(ev.target.result);setImgBase64(ev.target.result.split(",")[1]);};r.readAsDataURL(file);};
  const analyze=async()=>{
    if(!imgBase64)return;setLoading(true);
    const crop=CROPS[form.crop];
    const CROP_NUT_STR={jitomate:"N alto, K alto fructificación, Ca firmeza",fresa:"N bajo maduración, K alto, Ca y B calidad",arandano:"pH ácido crítico 4.5-5.5, N amoniacal",zarzamora:"N moderado, K alto maduración, Fe quelado"};
    try{
      const res=await fetch("/api/analyze",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({imageBase64:imgBase64,imageMediaType:"image/jpeg",crop:crop.name,worker:form.worker,ph:form.ph,ce:form.ce,zone:form.zone,notes:form.notes})
      });
      const result=await res.json();
      if(result.error) throw new Error(result.error);
      const id=Date.now();
      const diagData={...form,ph:parseFloat(form.ph)||0,ce:parseFloat(form.ce)||0,date:new Date().toISOString().slice(0,10),result,createdAt:new Date().toISOString()};
      try{ await addDoc(collection(db,"diagnosticos"),diagData); }catch(e){ console.warn("No se pudo guardar diagnóstico:",e.message); }
      setDiagnoses(p=>[{id,imgPreview,...diagData},...p]);
      setSel(id);setView("historial");setForm({crop:"jitomate",zone:"",worker:"",ph:"",ce:"",notes:""});setImgPreview(null);setImgBase64(null);
    }catch(e){
      const msg = e?.message || "Error desconocido";
      alert("Error al analizar:\n\n" + msg);
      console.error("DiagnosticoIA error:", e);
    }
    setLoading(false);
  };
  return(
    <div>
      <div style={{display:"flex",gap:4,marginBottom:16,background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:4,width:"fit-content"}}>
        {[["historial",`📋 Historial (${diagnoses.length})`],["nuevo","🔬 Nuevo diagnóstico"]].map(([k,l])=>(<button key={k} onClick={()=>setView(k)} style={{padding:"8px 18px",border:"none",borderRadius:8,background:view===k?"#1a2533":"transparent",color:view===k?"#4ecb8d":"#888",cursor:"pointer",fontSize:13,fontWeight:view===k?700:400}}>{l}</button>))}
      </div>
      {view==="historial"&&(
        <div>
          {!diagnoses.length&&<div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa"}}><div style={{fontSize:40,marginBottom:8}}>🌿</div><div>Sin diagnósticos.</div><button onClick={()=>setView("nuevo")} style={{marginTop:12,padding:"8px 18px",background:"#1a2533",color:"#4ecb8d",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600}}>Crear diagnóstico</button></div>}
          {diagnoses.map(d=>{const c=CROPS[d.crop];const sC={alta:"#e74c3c",media:"#f39c12",baja:"#27ae60"}[d.result?.severidad||"baja"];return(
            <div key={d.id} onClick={()=>setSel(sel===d.id?null:d.id)} style={{background:"#fff",border:`1px solid ${sel===d.id?"#2980b9":"#e0e0e0"}`,borderLeft:`4px solid ${sC}`,borderRadius:12,padding:"14px 18px",marginBottom:10,cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <span style={{fontSize:24}}>{c.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}><span style={{fontWeight:700,color:c.color,fontSize:13}}>{c.name}</span><span style={{color:"#aaa",fontSize:12}}>— {d.zone}</span><span style={{background:sC+"18",color:sC,border:`1px solid ${sC}44`,borderRadius:12,padding:"1px 8px",fontSize:10,fontWeight:700}}>{d.result?.severidad?.toUpperCase()}</span></div>
                  <div style={{fontSize:12,color:"#555",fontWeight:600,marginBottom:3}}>{d.result?.diagnostico}</div>
                  <div style={{fontSize:11,color:"#aaa"}}>{d.worker||"—"} · {d.date}</div>
                </div>
              </div>
              {sel===d.id&&d.result&&(
                <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #f0f0f0"}}>
                  {d.imgPreview&&<img src={d.imgPreview} alt="" style={{width:"100%",borderRadius:8,marginBottom:12,maxHeight:200,objectFit:"cover"}}/>}
                  {d.result.urgencia&&<div style={{background:sC+"11",border:`1px solid ${sC}33`,borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:12,color:"#333"}}><strong style={{color:sC}}>🔔 Encargado:</strong> {d.result.urgencia}</div>}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#e74c3c",marginBottom:6}}>CAUSAS</div>{d.result.causas?.map((c,i)=><div key={i} style={{fontSize:12,color:"#555",marginBottom:4,display:"flex",gap:6}}><span style={{color:"#e74c3c",flexShrink:0}}>◆</span>{c}</div>)}</div>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#27ae60",marginBottom:6}}>ACCIONES</div>{d.result.acciones?.map((a,i)=><div key={i} style={{fontSize:12,color:"#333",marginBottom:4,background:"#f0faf5",borderRadius:6,padding:"5px 8px"}}>{i+1}. {a}</div>)}</div>
                  </div>
                </div>
              )}
            </div>
          );})}
        </div>
      )}
      {view==="nuevo"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:18}}>
            <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14}}>DATOS DEL REGISTRO</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,color:"#aaa",marginBottom:4,display:"block"}}>CULTIVO</label><select value={form.crop} onChange={e=>setForm(p=>({...p,crop:e.target.value}))} style={{width:"100%",padding:"8px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13}}>{Object.entries(CROPS).map(([k,c])=><option key={k} value={k}>{c.emoji} {c.name}</option>)}</select></div>
              {[["zone","ZONA","Zona A"],["worker","TRABAJADOR","Nombre"],["ph","pH","6.2"],["ce","CE","2.8"]].map(([f,l,ph])=>(
                <div key={f}><label style={{fontSize:11,color:"#aaa",marginBottom:4,display:"block"}}>{l}</label><input type={f==="ph"||f==="ce"?"number":"text"} step="0.1" value={form[f]} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))} placeholder={ph} style={{width:"100%",padding:"8px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/></div>
              ))}
              <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,color:"#aaa",marginBottom:4,display:"block"}}>OBSERVACIONES</label><textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Síntomas..." style={{width:"100%",padding:"8px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,minHeight:60,resize:"vertical",boxSizing:"border-box"}}/></div>
            </div>
          </div>
          <div>
            <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:18,marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14}}>FOTO DE LA PLANTA</div>
              <div onClick={()=>fileRef.current.click()} style={{border:"2px dashed #e0e0e0",borderRadius:10,padding:imgPreview?"0":"2rem",textAlign:"center",cursor:"pointer",overflow:"hidden"}}>
                {imgPreview?<img src={imgPreview} alt="" style={{width:"100%",borderRadius:8,maxHeight:220,objectFit:"cover"}}/>:<div><div style={{fontSize:36,marginBottom:8}}>📸</div><div style={{color:"#aaa",fontSize:13}}>Clic para subir foto</div></div>}
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImage}/>
              </div>
            </div>
            <button onClick={analyze} disabled={loading||!imgBase64} style={{width:"100%",padding:14,background:loading||!imgBase64?"#f0f0f0":"#1a2533",color:loading||!imgBase64?"#aaa":"#4ecb8d",border:"none",borderRadius:10,cursor:loading||!imgBase64?"not-allowed":"pointer",fontSize:14,fontWeight:700,fontFamily:"'Courier New',monospace"}}>
              {loading?"⏳ Analizando...":!imgBase64?"📸 Sube una foto primero":"🔬 ANALIZAR CON IA"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── IA NUTRICIÓN ─────────────────────────────────────────────────────────────
function IaNutricion({cropName,etapa,target,water,aportes,fertilizando,ferts,volume,costoTotal,costoPorLitro}){
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [history,setHistory]=useState([]);
  const VCOL={"APROBADA":"#27ae60","MEJORABLE":"#f39c12","REFORMULAR":"#e74c3c"};
  const VBG={"APROBADA":"#eafaf1","MEJORABLE":"#fef9e7","REFORMULAR":"#fdedec"};
  const analyze=async()=>{
    setLoading(true);setResult(null);
    try{
      const res=await fetch("/api/analyzeNutricion",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({cropName,etapa,target,water,aportes,fertilizando,
          ferts:ferts.filter(f=>f.active&&f.meq>0),volume,costoTotal,costoPorLitro})
      });
      const data=await res.json();
      if(data.error)throw new Error(data.error);
      setResult(data);
      setHistory(p=>[{date:new Date().toLocaleDateString("es-MX"),cropName,etapa,...data},...p.slice(0,4)]);
    }catch(e){alert("Error: "+e.message);}
    setLoading(false);
  };
  return(
    <div>
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#444",marginBottom:3}}>Análisis IA de tu solución nutritiva</div>
            <div style={{fontSize:12,color:"#888"}}>Cultivo: <strong>{cropName}</strong> · Etapa: <strong>{etapa}</strong> · Vol: <strong>{(volume||0).toLocaleString()} L</strong></div>
          </div>
          <button onClick={analyze} disabled={loading} style={{padding:"10px 24px",background:loading?"#aaa":"#1a2533",color:loading?"#fff":"#4ecb8d",border:"none",borderRadius:8,cursor:loading?"not-allowed":"pointer",fontSize:13,fontWeight:700,fontFamily:"'Courier New',monospace"}}>
            {loading?"⏳ Analizando...":"🤖 ANALIZAR FÓRMULA"}
          </button>
        </div>
      </div>
      {result&&(
        <div>
          <div style={{background:VBG[result.veredicto]||"#f9f9f9",border:`2px solid ${VCOL[result.veredicto]||"#aaa"}`,borderRadius:12,padding:"16px 20px",marginBottom:12,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            <div style={{fontSize:36}}>{result.veredicto==="APROBADA"?"✅":result.veredicto==="MEJORABLE"?"⚠️":"❌"}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:16,color:VCOL[result.veredicto]||"#333",marginBottom:3}}>{result.veredicto}</div>
              <div style={{fontSize:13,color:"#555"}}>{result.evaluacion_general}</div>
            </div>
            {result.puntuacion&&<div style={{textAlign:"center",background:"#fff",borderRadius:10,padding:"8px 16px",border:`1px solid ${VCOL[result.veredicto]}44`}}>
              <div style={{fontSize:28,fontWeight:700,color:VCOL[result.veredicto],fontFamily:"'Courier New',monospace"}}>{result.puntuacion}</div>
              <div style={{fontSize:10,color:"#aaa"}}>/ 100</div>
            </div>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:12}}>
            {[{l:"Balance iónico",v:result.balance_ionico,c:{bueno:"#27ae60",aceptable:"#f39c12",deficiente:"#e74c3c"}[result.balance_ionico]},{l:"Adecuación etapa",v:result.adecuacion_etapa,c:{excelente:"#27ae60",buena:"#27ae60",regular:"#f39c12",inadecuada:"#e74c3c"}[result.adecuacion_etapa]},{l:"Eficiencia económica",v:result.eficiencia_economica,c:{buena:"#27ae60",regular:"#f39c12",cara:"#e74c3c"}[result.eficiencia_economica]}].map(m=>(
              <div key={m.l} style={{background:"#fff",border:`1px solid ${m.c||"#e0e0e0"}33`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:m.c||"#555",textTransform:"capitalize"}}>{m.v||"—"}</div>
                <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{m.l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            {result.problemas?.length>0&&<div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#e74c3c",marginBottom:8}}>PROBLEMAS DETECTADOS</div>
              {result.problemas.map((p,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:5}}><span style={{color:"#e74c3c",flexShrink:0}}>◆</span><span style={{fontSize:12,color:"#555"}}>{p}</span></div>)}
              {result.deficiencias_riesgo?.length>0&&<div style={{marginTop:8,display:"flex",gap:4,flexWrap:"wrap"}}>{result.deficiencias_riesgo.map((d,i)=><span key={i} style={{background:"#fdedec",color:"#c0392b",border:"1px solid #f5c6c6",borderRadius:8,padding:"2px 8px",fontSize:11,fontWeight:600}}>{d}</span>)}</div>}
            </div>}
            {result.recomendaciones_etapa?.length>0&&<div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"#27ae60",marginBottom:8}}>PARA ESTA ETAPA</div>
              {result.recomendaciones_etapa.map((r,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:5}}><span style={{color:"#27ae60",fontWeight:700,flexShrink:0}}>{i+1}.</span><span style={{fontSize:12,color:"#333",background:"#f0faf5",borderRadius:6,padding:"4px 8px",flex:1}}>{r}</span></div>)}
            </div>}
          </div>
          {result.ajustes_recomendados?.length>0&&(
            <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:14,marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:"#2c3e50",marginBottom:10}}>AJUSTES SUGERIDOS A LA FÓRMULA</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"#fafafa"}}>{["Ion","Acción","Cantidad","Razón"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",color:"#aaa",fontWeight:500,fontSize:11,borderBottom:"1px solid #f0f0f0"}}>{h}</th>)}</tr></thead>
                  <tbody>{result.ajustes_recomendados.map((a,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid #fafafa"}}>
                      <td style={{padding:"8px 10px",fontWeight:700,fontFamily:"'Courier New',monospace"}}>{a.ion}</td>
                      <td style={{padding:"8px 10px"}}><span style={{background:a.accion==="aumentar"?"#eafaf1":"#fdedec",color:a.accion==="aumentar"?"#27ae60":"#e74c3c",border:"1px solid",borderColor:a.accion==="aumentar"?"#a9dfbf":"#f5c6c6",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>{a.accion==="aumentar"?"↑ Aumentar":"↓ Reducir"}</span></td>
                      <td style={{padding:"8px 10px",fontFamily:"'Courier New',monospace",fontWeight:600}}>{a.cantidad}</td>
                      <td style={{padding:"8px 10px",color:"#888",fontSize:11}}>{a.razon}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
          {result.tip_economia&&<div style={{background:"#fef9e7",border:"1px solid #f39c1244",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#7d6608"}}>💡 <strong>Tip economía:</strong> {result.tip_economia}</div>}
        </div>
      )}
      {!result&&history.length>0&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#444",marginBottom:10}}>ANÁLISIS ANTERIORES (esta sesión)</div>
          {history.map((h,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f5f5f5",flexWrap:"wrap"}}>
              <div style={{flex:1}}><span style={{fontWeight:600,fontSize:12}}>{h.cropName} · {h.etapa}</span><span style={{fontSize:11,color:"#aaa",marginLeft:6}}>{h.date}</span></div>
              <span style={{background:VBG[h.veredicto]||"#f9f9f9",color:VCOL[h.veredicto]||"#aaa",border:`1px solid ${VCOL[h.veredicto]||"#e0e0e0"}44`,borderRadius:10,padding:"2px 10px",fontSize:11,fontWeight:600}}>{h.veredicto}</span>
              {h.puntuacion&&<span style={{fontFamily:"'Courier New',monospace",fontWeight:700,color:"#2c3e50",fontSize:13}}>{h.puntuacion}/100</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FORMULADOR ───────────────────────────────────────────────────────────────
function Formulador(){
  const [crop,setCrop]=useState("jitomate");
  const [target,setTarget]=useState({...CROP_NUT.jitomate});
  const [water,setWater]=useState({...DEF_WATER});
  const [ferts,setFerts]=useState(FERTS_INIT);
  const [volume,setVolume]=useState(1000);
  const [sub,setSub]=useState("tabla");
  const [savedFormulas,setSavedFormulas]=useState([]);
  const [saveName,setSaveName]=useState("");
  const [saveNotes,setSaveNotes]=useState("");
  const [etapa,setEtapa]=useState("Vegetativo");
  const [saving,setSaving]=useState(false);
  const [savedAlert,setSavedAlert]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [iaPrompt,setIaPrompt]=useState("");
  const [iaResp,setIaResp]=useState("");
  const [iaLoading,setIaLoading]=useState(false);

  // Cargar fórmulas guardadas desde Firebase
  useEffect(()=>{
    const q = collection(db,"formulas_nutritivas");
    const unsub = onSnapshot(q, snap=>setSavedFormulas(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>unsub();
  },[]);

  const aportes = useMemo(()=>Object.fromEntries(ALL_IONS.map(ion=>[ion,Math.max(0,n(target[ion]-water[ion]))])),[target,water]);
  const fert = useMemo(()=>{
    const t = Object.fromEntries(ALL_IONS.map(ion=>[ion,0]));
    ferts.filter(f=>f.active&&f.meq>0).forEach(f=>{
      Object.entries(f.ions).forEach(([ion,ratio])=>{
        if(t[ion]!==undefined) t[ion]=n(t[ion]+f.meq*ratio);
      });
    });
    return t;
  },[ferts]);

  const dosis = useMemo(()=>ferts.map(f=>{
    if(!f.active||f.meq===0) return{...f,grm3:0,mlm3:0,kgTotal:0,mlTotal:0,costoTotal:0};
    let grm3=0, mlm3=0;
    if(f.type==="solid") grm3=n(f.meq*f.Peq);
    else {
      mlm3=n(f.meq*f.Peq/((f.density||1)*(f.richness||100)/100));
      grm3=n(mlm3*(f.density||1));
    }
    const kgT=n(grm3*volume/1000000,3);
    const costoT=n(kgT*(f.precio||0),2);
    return{...f,grm3,mlm3,kgTotal:kgT,mlTotal:f.type==="liquid"?n(mlm3*volume/1000,2):0,costoTotal:costoT};
  }),[ferts,volume]);

  const costoTotal = dosis.filter(f=>f.active&&f.meq>0).reduce((s,f)=>s+f.costoTotal,0);
  const costoPorLitro = volume>0?n(costoTotal/volume,4):0;
  const costoPorM3 = volume>0?n(costoTotal*1000/volume,2):0;

  const balance = useMemo(()=>{
    const dif = {};
    ALL_IONS.forEach(ion=>{
      const objetivo = aportes[ion]||0;
      const aportado = fert[ion]||0;
      dif[ion] = {objetivo,aportado,delta:n(aportado-objetivo,2),pct:objetivo>0?n((aportado/objetivo)*100,1):0};
    });
    return dif;
  },[aportes,fert]);

  // Guardar fórmula en Firebase
  const guardarFormula = async()=>{
    if(!saveName.trim()){alert("Pon un nombre a la fórmula"); return;}
    setSaving(true);
    try{
      const data = {
        nombre: saveName.trim(),
        notas: saveNotes||"",
        crop, etapa, volume,
        target:Object.fromEntries(Object.entries(target).map(([k,v])=>[k,v||0])),
        water:Object.fromEntries(Object.entries(water).map(([k,v])=>[k,v||0])),
        ferts: ferts.map(f=>({id:f.id,name:f.name,type:f.type,active:!!f.active,meq:f.meq||0,Peq:f.Peq||0,density:f.density??null,richness:f.richness??null,precio:f.precio||0,ions:f.ions||{}})),
        costoTotal: n(costoTotal||0,2),
        costoPorLitro: costoPorLitro||0,
        updatedAt: new Date().toISOString(),
      };
      if(editingId){
        await updateDoc(doc(db,"formulas_nutritivas",editingId), data);
        setEditingId(null);
      } else {
        await addDoc(collection(db,"formulas_nutritivas"), {...data,createdAt:new Date().toISOString()});
      }
      setSaveName(""); setSaveNotes("");
      setSavedAlert(true); setTimeout(()=>setSavedAlert(false),3000);
    } catch(e){
      alert("⚠ Error al guardar: "+e.message);
    }
    setSaving(false);
  };

  // Cargar fórmula guardada
  const cargarFormula = (f) => {
    setCrop(f.crop||"jitomate");
    setEtapa(f.etapa||"Vegetativo");
    setVolume(f.volume||1000);
    setTarget(f.target||{...CROP_NUT.jitomate});
    setWater(f.water||{...DEF_WATER});
    if(f.ferts&&f.ferts.length) setFerts(f.ferts);
    setSaveName(f.nombre);
    setSaveNotes(f.notas||"");
    setEditingId(f.id);
    setSub("tabla");
    window.scrollTo(0,0);
  };

  // Eliminar fórmula
  const eliminarFormula = async (id) => {
    if(!window.confirm("¿Eliminar esta fórmula?")) return;
    await deleteDoc(doc(db,"formulas_nutritivas",id));
  };

  // Duplicar fórmula
  const duplicarFormula = (f) => {
    cargarFormula(f);
    setEditingId(null);
    setSaveName(f.nombre + " (copia)");
  };

  // IA Nutricional
  const consultarIA = async () => {
    if(!iaPrompt.trim()){alert("Escribe tu pregunta");return;}
    setIaLoading(true); setIaResp("");
    try {
      const contexto = `Cultivo: ${CROPS[crop]?.name}. Etapa: ${etapa}.
Volumen: ${volume}L. Costo total: $${n(costoTotal,2)}. Costo/litro: $${costoPorLitro}.
Objetivo iones (meq/L): ${JSON.stringify(target)}.
Agua riego: ${JSON.stringify(water)}.
Aportes a complementar: ${JSON.stringify(aportes)}.
Fertilizantes activos: ${ferts.filter(f=>f.active&&f.meq>0).map(f=>`${f.name}=${f.meq}meq`).join(", ")}.
Balance final: ${JSON.stringify(Object.fromEntries(ALL_IONS.map(i=>[i,balance[i]?.aportado])))}.

Pregunta del usuario: ${iaPrompt}`;
      const res = await fetch("/api/analyzeNutricion", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({prompt: contexto})
      });
      const r = await res.json();
      if(r.error) throw new Error(r.error);
      setIaResp(r.response||r.text||"Sin respuesta");
    } catch(e){
      setIaResp("⚠ Error: " + e.message);
    }
    setIaLoading(false);
  };

  const cancelEdit = () => {
    setEditingId(null); setSaveName(""); setSaveNotes("");
  };

  const thS={padding:"6px 8px",fontSize:11,fontWeight:500,color:"#aaa",textAlign:"center",borderBottom:"1px solid #f0f0f0",background:"#fafafa",whiteSpace:"nowrap"};
  const tdS={padding:"5px 7px",textAlign:"center",fontSize:12,borderBottom:"1px solid #fafafa"};
  const INP_F={padding:"6px 8px",border:"1px solid #ddd",borderRadius:6,fontSize:12,width:70,textAlign:"center",background:"#fff",color:"#111",WebkitTextFillColor:"#111",colorScheme:"light",fontFamily:"'Courier New',monospace"};

  return(
    <div>
      {savedAlert&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:"10px 14px",marginBottom:14,color:"#27ae60",fontWeight:600,fontSize:13}}>✓ Fórmula {editingId?"actualizada":"guardada"} en Firebase — accesible en pestaña Guardadas</div>}
      {editingId&&<div style={{background:"#fff3cd",border:"1px solid #ffc10744",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#856404",display:"flex",alignItems:"center",gap:10}}>✎ Editando fórmula existente<button onClick={cancelEdit} style={{marginLeft:"auto",background:"transparent",border:"none",cursor:"pointer",color:"#aaa",fontSize:14,fontWeight:600}}>✕ Cancelar</button></div>}

      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px",marginBottom:12}}>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div>
            <div style={{fontSize:11,color:"#aaa",marginBottom:6,fontFamily:"'Courier New',monospace"}}>CULTIVO</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {Object.entries(CROPS).map(([k,c])=>(
                <button key={k} onClick={()=>{setCrop(k);setTarget({...CROP_NUT[k]});}}
                  style={{padding:"7px 14px",border:`1px solid ${crop===k?c.color:"#e0e0e0"}`,borderRadius:20,background:crop===k?c.color+"18":"transparent",color:crop===k?c.color:"#666",cursor:"pointer",fontSize:12,fontWeight:crop===k?700:400}}>
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:"#aaa",marginBottom:6,fontFamily:"'Courier New',monospace"}}>ETAPA FENOLÓGICA</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {ETAPAS.map(e=>(
                <button key={e} onClick={()=>setEtapa(e)}
                  style={{padding:"7px 14px",border:`1px solid ${etapa===e?"#2c3e50":"#e0e0e0"}`,borderRadius:20,background:etapa===e?"#2c3e50":"transparent",color:etapa===e?"#fff":"#666",cursor:"pointer",fontSize:12,fontWeight:etapa===e?700:400}}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:"#aaa",marginBottom:6,fontFamily:"'Courier New',monospace"}}>VOLUMEN (L)</div>
            <input type="number" min="1" value={volume} onChange={e=>setVolume(parseFloat(e.target.value)||1000)} style={{...INP_F,width:100,fontSize:13}}/>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:12,background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:4,overflowX:"auto"}}>
        {[["tabla","🧪 Iones"],["dosis","⚖ Dosis"],["costos","💰 Costos"],["balance","📊 Balance"],["ia_nut","🤖 IA"],["guardadas",`💾 Guardadas (${savedFormulas.length})`]].map(([k,l])=>(
          <button key={k} onClick={()=>setSub(k)}
            style={{padding:"7px 12px",border:"none",borderRadius:8,background:sub===k?"#27ae60":"transparent",color:sub===k?"#fff":"#888",cursor:"pointer",fontSize:11,fontWeight:sub===k?700:400,whiteSpace:"nowrap"}}>{l}</button>
        ))}
      </div>

      {/* TABLA IONES */}
      {sub==="tabla"&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th style={{...thS,textAlign:"left",paddingLeft:12}}>Ion</th>
                  <th style={thS}>Objetivo</th>
                  <th style={thS}>Agua</th>
                  <th style={thS}>A aportar</th>
                </tr>
              </thead>
              <tbody>
                {ALL_IONS.map(ion=>(
                  <tr key={ion}>
                    <td style={{...tdS,textAlign:"left",paddingLeft:12,fontWeight:600,color:"#27ae60",fontFamily:"'Courier New',monospace"}}>{ion}</td>
                    <td style={tdS}><input type="number" step="0.1" value={target[ion]||0} onChange={e=>setTarget(p=>({...p,[ion]:parseFloat(e.target.value)||0}))} style={INP_F}/></td>
                    <td style={tdS}><input type="number" step="0.1" value={water[ion]||0} onChange={e=>setWater(p=>({...p,[ion]:parseFloat(e.target.value)||0}))} style={INP_F}/></td>
                    <td style={{...tdS,fontWeight:700,color:"#c0392b",fontFamily:"'Courier New',monospace"}}>{aportes[ion]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DOSIS */}
      {sub==="dosis"&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th style={{...thS,textAlign:"left"}}>Fertilizante</th>
                  <th style={thS}>Activo</th>
                  <th style={thS}>meq/L</th>
                  <th style={thS}>g/m³</th>
                  <th style={thS}>mL/m³</th>
                  <th style={thS}>kg Total</th>
                  <th style={thS}>mL Total</th>
                </tr>
              </thead>
              <tbody>
                {dosis.map((f,i)=>(
                  <tr key={i} style={{opacity:f.active?1:0.5}}>
                    <td style={{...tdS,textAlign:"left",fontWeight:500}}>{f.name}</td>
                    <td style={tdS}><input type="checkbox" checked={f.active} onChange={e=>setFerts(p=>p.map((x,j)=>j===i?{...x,active:e.target.checked}:x))}/></td>
                    <td style={tdS}><input type="number" step="0.1" min="0" value={f.meq} onChange={e=>setFerts(p=>p.map((x,j)=>j===i?{...x,meq:parseFloat(e.target.value)||0}:x))} style={INP_F}/></td>
                    <td style={{...tdS,fontFamily:"'Courier New',monospace",color:"#2980b9"}}>{f.grm3.toFixed(2)}</td>
                    <td style={{...tdS,fontFamily:"'Courier New',monospace",color:"#8e44ad"}}>{f.mlm3?f.mlm3.toFixed(2):"—"}</td>
                    <td style={{...tdS,fontFamily:"'Courier New',monospace",fontWeight:700,color:"#27ae60"}}>{f.kgTotal}</td>
                    <td style={{...tdS,fontFamily:"'Courier New',monospace",fontWeight:700,color:"#27ae60"}}>{f.mlTotal||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COSTOS */}
      {sub==="costos"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:14}}>
            <div style={{background:"#eafaf1",borderRadius:10,padding:14,textAlign:"center",border:"1px solid #a9dfbf"}}>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:22,fontWeight:700,color:"#27ae60"}}>${n(costoTotal,2)}</div>
              <div style={{fontSize:11,color:"#888",marginTop:2}}>Costo total {volume}L</div>
            </div>
            <div style={{background:"#eaf4fb",borderRadius:10,padding:14,textAlign:"center",border:"1px solid #b5d4f4"}}>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:22,fontWeight:700,color:"#2980b9"}}>${costoPorLitro}</div>
              <div style={{fontSize:11,color:"#888",marginTop:2}}>Costo / litro</div>
            </div>
            <div style={{background:"#f5eef8",borderRadius:10,padding:14,textAlign:"center",border:"1px solid #d2b4de"}}>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:22,fontWeight:700,color:"#8e44ad"}}>${costoPorM3}</div>
              <div style={{fontSize:11,color:"#888",marginTop:2}}>Costo / m³</div>
            </div>
          </div>
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th style={{...thS,textAlign:"left"}}>Fertilizante</th>
                  <th style={thS}>$/kg</th>
                  <th style={thS}>kg Total</th>
                  <th style={thS}>Costo</th>
                </tr>
              </thead>
              <tbody>
                {dosis.filter(f=>f.active&&f.meq>0).map((f,i)=>(
                  <tr key={i}>
                    <td style={{...tdS,textAlign:"left"}}>{f.name}</td>
                    <td style={tdS}><input type="number" step="0.01" min="0" value={f.precio||0} onChange={e=>setFerts(p=>p.map(x=>x.id===f.id?{...x,precio:parseFloat(e.target.value)||0}:x))} style={INP_F}/></td>
                    <td style={{...tdS,fontFamily:"'Courier New',monospace"}}>{f.kgTotal}</td>
                    <td style={{...tdS,fontFamily:"'Courier New',monospace",fontWeight:700,color:"#27ae60"}}>${f.costoTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BALANCE */}
      {sub==="balance"&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
          <div style={{fontSize:11,color:"#888",marginBottom:10}}>Verificación: comparación entre lo necesario y lo aportado por la fórmula.</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                <th style={{...thS,textAlign:"left"}}>Ion</th>
                <th style={thS}>Objetivo</th>
                <th style={thS}>Aportado</th>
                <th style={thS}>Diferencia</th>
                <th style={thS}>%</th>
              </tr>
            </thead>
            <tbody>
              {ALL_IONS.map(ion=>{
                const b = balance[ion];
                const ok = b.pct>=90&&b.pct<=110;
                const color = ok?"#27ae60":b.pct>110?"#f39c12":"#e74c3c";
                return(
                  <tr key={ion}>
                    <td style={{...tdS,textAlign:"left",fontWeight:600,color:"#27ae60",fontFamily:"'Courier New',monospace"}}>{ion}</td>
                    <td style={{...tdS,fontFamily:"'Courier New',monospace"}}>{b.objetivo.toFixed(2)}</td>
                    <td style={{...tdS,fontFamily:"'Courier New',monospace"}}>{b.aportado.toFixed(2)}</td>
                    <td style={{...tdS,fontFamily:"'Courier New',monospace",color}}>{b.delta>0?"+":""}{b.delta}</td>
                    <td style={{...tdS,fontFamily:"'Courier New',monospace",fontWeight:700,color}}>{b.pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* IA */}
      {sub==="ia_nut"&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
          <div style={{fontSize:12,color:"#888",marginBottom:10}}>Pregunta a la IA sobre esta fórmula. El sistema envía automáticamente todos los datos actuales (cultivo, etapa, objetivos, aportes, balance, costos).</div>
          <textarea value={iaPrompt} onChange={e=>setIaPrompt(e.target.value)} placeholder="Ej: ¿está balanceada para floración? ¿qué ajustaría para mejorar Ca?" style={{width:"100%",minHeight:80,padding:"10px 12px",border:"1px solid #ddd",borderRadius:8,fontSize:13,boxSizing:"border-box",resize:"vertical",fontFamily:"inherit",background:"#fff",color:"#111"}}/>
          <button onClick={consultarIA} disabled={iaLoading} style={{marginTop:10,padding:"10px 20px",background:iaLoading?"#aaa":"#8e44ad",color:"#fff",border:"none",borderRadius:8,cursor:iaLoading?"not-allowed":"pointer",fontWeight:700,fontSize:13}}>
            {iaLoading?"⏳ Analizando...":"🤖 Consultar IA"}
          </button>
          {iaResp&&<div style={{marginTop:14,background:"#f5eef8",border:"1px solid #d2b4de",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#444",whiteSpace:"pre-wrap",lineHeight:1.5}}>{iaResp}</div>}
        </div>
      )}

      {/* GUARDADAS */}
      {sub==="guardadas"&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 18px"}}>
          {savedFormulas.length===0 && <div style={{textAlign:"center",padding:"2rem",color:"#aaa",fontSize:13}}>No hay fórmulas guardadas. Crea una desde la sección de "Guardar" abajo.</div>}
          {savedFormulas.map(f=>{
            const c = CROPS[f.crop];
            return(
              <div key={f.id} style={{background:"#fafafa",border:"1px solid #e0e0e0",borderRadius:10,padding:"12px 16px",marginBottom:8,borderLeft:`4px solid ${c?.color||"#27ae60"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <span style={{fontSize:18}}>{c?.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#222"}}>{f.name}</div>
                    <div style={{fontSize:11,color:"#888"}}>{c?.name} · {f.etapa} · {f.volume}L · ${(f.costoTotal||0).toFixed(2)} total</div>
                  </div>
                  <button onClick={()=>cargarFormula(f)} style={{padding:"6px 12px",background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:6,color:"#27ae60",cursor:"pointer",fontSize:11,fontWeight:700}}>📂 Cargar</button>
                  <button onClick={()=>duplicarFormula(f)} style={{padding:"6px 10px",background:"#eaf4fb",border:"1px solid #b5d4f4",borderRadius:6,color:"#2980b9",cursor:"pointer",fontSize:11}}>📋 Duplicar</button>
                  <button onClick={()=>eliminarFormula(f.id)} style={{padding:"6px 10px",background:"#fdedec",border:"none",borderRadius:6,color:"#c0392b",cursor:"pointer",fontSize:11}}>✕</button>
                </div>
                {f.notas&&<div style={{fontSize:12,color:"#666",marginTop:6,padding:"6px 10px",background:"#fff",borderRadius:6,whiteSpace:"pre-wrap"}}>{f.notas}</div>}
                <div style={{fontSize:10,color:"#aaa",marginTop:6}}>Creada: {(f.createdAt||"").slice(0,10)} {f.updatedAt!==f.createdAt&&` · Actualizada: ${(f.updatedAt||"").slice(0,10)}`}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* SAVE BOX */}
      <div style={{background:"#fff",border:"2px solid #27ae6044",borderRadius:12,padding:"14px 18px",marginTop:14}}>
        <div style={{fontSize:12,fontWeight:700,color:"#27ae60",marginBottom:10}}>💾 GUARDAR FÓRMULA EN FIREBASE</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="Nombre de la fórmula *" style={{flex:"1 1 200px",padding:"8px 12px",border:"1px solid #ddd",borderRadius:8,fontSize:13,background:"#fff",color:"#111"}}/>
          <input value={saveNotes} onChange={e=>setSaveNotes(e.target.value)} placeholder="Notas (opcional)" style={{flex:"2 1 300px",padding:"8px 12px",border:"1px solid #ddd",borderRadius:8,fontSize:13,background:"#fff",color:"#111"}}/>
          <button onClick={guardarFormula} disabled={saving} style={{padding:"8px 20px",background:saving?"#aaa":"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:saving?"not-allowed":"pointer",fontWeight:700,fontSize:13}}>
            {saving?"Guardando...":(editingId?"✓ Actualizar":"💾 Guardar")}
          </button>
        </div>
        <div style={{fontSize:11,color:"#888",marginTop:6}}>Se guarda con: cultivo, etapa, objetivos iónicos, agua, fertilizantes activos y costos. Todo accesible desde la pestaña Guardadas.</div>
      </div>
    </div>
  );
}
function IncidenciasAdmin(){
  const [data,setData]=useState([]);
  const [filter,setFilter]=useState("pendiente");
  useEffect(()=>{const q=collection(db,"incidencias");const unsub=onSnapshot(q,snap=>setData(snap.docs.map(d=>({id:d.id,...d.data()}))));return()=>unsub();},[]);
  const filtered=filter==="all"?data:data.filter(i=>i.status===filter);
  const pending=data.filter(i=>i.status==="pendiente");
  const TLABELS={plaga:"🦗 Plaga",enfermedad:"🍂 Enfermedad",equipo:"⚙️ Equipo",clima:"🌡️ Clima",otro:"📋 Otro"};
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["pendiente","Pendientes","#f39c12"],["resuelto","Resueltas","#27ae60"],["all","Todas","#555"]].map(([v,l,c])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:"7px 16px",border:`1px solid ${filter===v?c:"#e0e0e0"}`,borderRadius:20,background:filter===v?c+"18":"transparent",color:filter===v?c:"#666",cursor:"pointer",fontSize:12,fontWeight:500}}>
            {l} {v==="all"?data.length:data.filter(i=>i.status===v).length}
          </button>
        ))}
      </div>
      {pending.length>0&&filter!=="resuelto"&&<div style={{background:"#fef9e7",border:"1px solid #f39c1244",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#856404"}}>⚠ {pending.length} incidencia{pending.length>1?"s":""} pendiente{pending.length>1?"s":""} de atender</div>}
      {!filtered.length&&<div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa"}}><div style={{fontSize:36,marginBottom:8}}>✅</div><div>Sin incidencias</div></div>}
      {filtered.map(inc=>{const c=CROPS[inc.crop];return(
        <div key={inc.id} style={{background:"#fff",border:`1px solid ${inc.status==="pendiente"?"#f39c1244":"#e0e0e0"}`,borderLeft:`4px solid ${inc.status==="pendiente"?"#f39c12":"#27ae60"}`,borderRadius:12,padding:"14px 18px",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:13}}>{TLABELS[inc.type]||"📋 Incidencia"}</span>
                {c&&<span style={{color:c.color,fontSize:12}}>{c.emoji} {c.name}</span>}
                <span style={{background:inc.status==="pendiente"?"#fef9e7":"#eafaf1",color:inc.status==="pendiente"?"#f39c12":"#27ae60",border:"1px solid",borderColor:inc.status==="pendiente"?"#f39c1244":"#a9dfbf",borderRadius:10,padding:"1px 8px",fontSize:10,fontWeight:600}}>{inc.status==="pendiente"?"Pendiente":"Resuelto"}</span>
              </div>
              <div style={{fontSize:13,color:"#333",marginBottom:4}}>{inc.description}</div>
              {inc.zone&&<div style={{fontSize:11,color:"#aaa"}}>📍 {inc.zone}</div>}
              {inc.photoURL&&<img src={inc.photoURL} alt="" style={{marginTop:8,width:"100%",maxHeight:150,objectFit:"cover",borderRadius:8}}/>}
              <div style={{fontSize:11,color:"#bbb",marginTop:6}}>Reportó: <strong style={{color:"#888"}}>{inc.worker}</strong> · {inc.date} {inc.time}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {inc.status==="pendiente"&&<button onClick={()=>updateDoc(doc(db,"incidencias",inc.id),{status:"resuelto",resolvedAt:new Date().toISOString()})} style={{padding:"7px 12px",border:"1px solid #27ae60",borderRadius:8,background:"#eafaf1",color:"#27ae60",cursor:"pointer",fontSize:12,fontWeight:600}}>✓ Resolver</button>}
              <button onClick={()=>{if(window.confirm("¿Eliminar incidencia?"))deleteDoc(doc(db,"incidencias",inc.id));}} style={{padding:"7px 12px",border:"1px solid #e0e0e0",borderRadius:8,background:"transparent",color:"#aaa",cursor:"pointer",fontSize:12}}>✕ Eliminar</button>
            </div>
          </div>
        </div>
      );})}
    </div>
  );
}

// ─── TAREAS ADMIN ─────────────────────────────────────────────────────────────
function TareasAdmin(){
  const [tasks,setTasks]=useState([]);
  const [usuarios,setUsuarios]=useState([]);
  const [form,setForm]=useState({
    title:"",description:"",zone:"",
    assignedTo:[],
    tipo:"tarea", priority:"normal",
    fechaCreacion:new Date().toISOString().slice(0,10),
    fechaLimite:"",
  });
  const [editing,setEditing]=useState(null);
  const [filterTipo,setFilterTipo]=useState("all");
  const [filterStatus,setFilterStatus]=useState("all");

  useEffect(()=>{
    const q=collection(db,"tasks");
    const unsub=onSnapshot(q,snap=>setTasks(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(query(collection(db,"usuarios")),s=>setUsuarios(s.docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.rol==="trabajador")));
    return()=>{unsub();u2();};
  },[]);

  const addTask=async()=>{
    if(!form.title){alert("El título es obligatorio");return;}
    const data={
      ...form,
      assignedTo: form.assignedTo.length===0?["todos"]:form.assignedTo,
      completedBy:[],
      updatedAt:new Date().toISOString(),
    };
    if(editing){
      await updateDoc(doc(db,"tasks",editing),data);
      setEditing(null);
    }else{
      await addDoc(collection(db,"tasks"),{...data,createdAt:new Date().toISOString()});
    }
    setForm({title:"",description:"",zone:"",assignedTo:[],tipo:"tarea",priority:"normal",fechaCreacion:new Date().toISOString().slice(0,10),fechaLimite:""});
  };

  const startEdit=t=>{
    setForm({
      title:t.title||"",description:t.description||"",zone:t.zone||"",
      assignedTo: Array.isArray(t.assignedTo) ? t.assignedTo : (t.assignedTo&&t.assignedTo!=="todos"?[t.assignedTo]:[]),
      tipo:t.tipo||"tarea", priority:t.priority||"normal",
      fechaCreacion:t.fechaCreacion||t.date||new Date().toISOString().slice(0,10),
      fechaLimite:t.fechaLimite||"",
    });
    setEditing(t.id); window.scrollTo(0,0);
  };

  const toggleWorker=name=>{
    setForm(p=>({...p,assignedTo: p.assignedTo.includes(name)? p.assignedTo.filter(x=>x!==name) : [...p.assignedTo,name]}));
  };

  const delTask=async id=>{
    if(!window.confirm("¿Eliminar registro?"))return;
    await deleteDoc(doc(db,"tasks",id));
  };

  const exportCSV=()=>{
    const lines=[];
    lines.push(["Tipo","Título","Descripción","Asignado a","Zona","Prioridad","Fecha origen","Fecha límite","Completado por"].join(","));
    [...tasks].sort((a,b)=>(b.fechaCreacion||b.date||"").localeCompare(a.fechaCreacion||a.date||"")).forEach(t=>{
      const asig = Array.isArray(t.assignedTo)?t.assignedTo.join(" / "):t.assignedTo;
      const comp = Array.isArray(t.completedBy)?t.completedBy.join(" / "):"";
      lines.push([t.tipo||"tarea",t.title,t.description||"",asig||"todos",t.zone||"",t.priority||"normal",t.fechaCreacion||t.date||"",t.fechaLimite||"",comp].map(x=>`"${(x+"").replace(/"/g,"\"\"")}"`).join(","));
    });
    const blob=new Blob(["\uFEFF",lines.join("\n")],{type:"text/csv;charset=utf-8;"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`bitacora_tareas_${new Date().toISOString().slice(0,10)}.csv`;a.click();
  };

  const inp2={padding:"8px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,width:"100%",boxSizing:"border-box",background:"#fff",color:"#111",WebkitTextFillColor:"#111",colorScheme:"light"};
  const today=new Date().toISOString().slice(0,10);
  const tasksFilt = tasks.filter(t=>{
    if(filterTipo!=="all" && (t.tipo||"tarea")!==filterTipo) return false;
    if(filterStatus==="vigente" && t.completedBy?.length>0) return false;
    if(filterStatus==="completadas" && !(t.completedBy?.length>0)) return false;
    return true;
  });

  return(
    <div>
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444"}}>{editing?"✎ EDITAR REGISTRO":"➕ NUEVO REGISTRO"}</div>
          {editing&&<button onClick={()=>{setEditing(null);setForm({title:"",description:"",zone:"",assignedTo:[],tipo:"tarea",priority:"normal",fechaCreacion:today,fechaLimite:""});}} style={{background:"#f5f5f5",border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#888"}}>Cancelar</button>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <label style={LBL}>Tipo *</label>
            <select value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))} style={inp2}>
              <option value="tarea">📋 Tarea</option>
              <option value="instruccion">📖 Instrucción</option>
              <option value="aviso">📢 Aviso</option>
            </select>
          </div>
          <div>
            <label style={LBL}>Prioridad</label>
            <select value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))} style={inp2}>
              <option value="normal">Normal</option>
              <option value="alta">🔴 Alta</option>
              <option value="baja">🟢 Baja</option>
            </select>
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <label style={LBL}>Título *</label>
          <input placeholder="Ej: Revisar pH Zona A" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} style={inp2}/>
        </div>
        <div style={{marginBottom:10}}>
          <label style={LBL}>Descripción / instrucciones detalladas</label>
          <textarea placeholder="Descripción completa que se mostrará al trabajador..." value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={{...inp2,minHeight:80,fontFamily:"inherit",resize:"vertical"}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <label style={LBL}>Zona</label>
            <input placeholder="Zona A" value={form.zone} onChange={e=>setForm(p=>({...p,zone:e.target.value}))} style={inp2}/>
          </div>
          <div>
            <label style={LBL}>📅 Fecha origen *</label>
            <input type="date" value={form.fechaCreacion} onChange={e=>setForm(p=>({...p,fechaCreacion:e.target.value}))} style={inp2}/>
          </div>
          <div>
            <label style={LBL}>⏰ Fecha límite</label>
            <input type="date" value={form.fechaLimite} onChange={e=>setForm(p=>({...p,fechaLimite:e.target.value}))} style={inp2}/>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={LBL}>👥 Asignar a (selección múltiple, vacío = todos)</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:8,background:"#f9f9f9",borderRadius:8,border:"1px solid #e0e0e0",minHeight:42}}>
            {!usuarios.length ? <div style={{fontSize:12,color:"#aaa",alignSelf:"center"}}>No hay trabajadores registrados</div>
            : usuarios.map(u=>{
                const sel = form.assignedTo.includes(u.nombre||u.email||"");
                const name = u.nombre||u.email||"";
                return(
                  <button key={u.id} onClick={()=>toggleWorker(name)} type="button"
                    style={{padding:"6px 12px",border:`2px solid ${sel?"#27ae60":"#ddd"}`,borderRadius:20,background:sel?"#eafaf1":"#fff",color:sel?"#27ae60":"#666",cursor:"pointer",fontSize:12,fontWeight:sel?700:500}}>
                    {sel?"✓ ":""}{name}
                  </button>
                );
              })
            }
          </div>
          {form.assignedTo.length===0 && <div style={{fontSize:11,color:"#888",marginTop:4}}>📢 Se notificará a todos los trabajadores</div>}
          {form.assignedTo.length>0 && <div style={{fontSize:11,color:"#27ae60",marginTop:4,fontWeight:600}}>✓ {form.assignedTo.length} trabajador(es) seleccionado(s)</div>}
        </div>
        <button onClick={addTask} style={{background:"#27ae60",color:"#fff",border:"none",borderRadius:8,padding:"10px 22px",cursor:"pointer",fontWeight:700,fontSize:13}}>
          {editing?"✓ Guardar cambios":"➕ Crear registro"}
        </button>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {[["all","Todos"],["tarea","📋 Tareas"],["instruccion","📖 Instrucciones"],["aviso","📢 Avisos"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilterTipo(v)} style={{padding:"6px 12px",border:`1px solid ${filterTipo===v?"#555":"#e0e0e0"}`,borderRadius:20,background:filterTipo===v?"#55555518":"transparent",color:filterTipo===v?"#333":"#777",cursor:"pointer",fontSize:11,fontWeight:filterTipo===v?700:400}}>{l}</button>
        ))}
        {[["all","Todas"],["vigente","Vigentes"],["completadas","Completadas"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilterStatus(v)} style={{padding:"6px 12px",border:`1px solid ${filterStatus===v?"#2980b9":"#e0e0e0"}`,borderRadius:20,background:filterStatus===v?"#2980b918":"transparent",color:filterStatus===v?"#2980b9":"#777",cursor:"pointer",fontSize:11,fontWeight:filterStatus===v?700:400}}>{l}</button>
        ))}
        <button onClick={exportCSV} style={{marginLeft:"auto",padding:"6px 14px",border:"1px solid #27ae60",borderRadius:20,background:"#eafaf1",color:"#27ae60",cursor:"pointer",fontSize:11,fontWeight:600}}>⬇ CSV Bitácora</button>
      </div>

      {!tasksFilt.length&&<div style={{textAlign:"center",padding:"2rem",color:"#aaa",background:"#fff",border:"1px solid #eee",borderRadius:12,fontSize:13}}>Sin registros</div>}
      {tasksFilt.map(t=>{
        const completos = Array.isArray(t.completedBy) ? t.completedBy : [];
        const asignados = Array.isArray(t.assignedTo) ? t.assignedTo : (t.assignedTo?[t.assignedTo]:["todos"]);
        const isOverdue = t.fechaLimite && t.fechaLimite < today && completos.length === 0;
        const tipoIcon = {tarea:"📋",instruccion:"📖",aviso:"📢"}[t.tipo||"tarea"];
        const priColor = {alta:"#e74c3c",baja:"#27ae60",normal:"#888"}[t.priority||"normal"];
        return(
          <div key={t.id} style={{background:"#fff",border:`1px solid ${isOverdue?"#e74c3c44":"#e0e0e0"}`,borderLeft:`4px solid ${priColor}`,borderRadius:10,padding:"12px 16px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:6}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:"#222",marginBottom:4}}>
                  {tipoIcon} {t.title}
                  {t.priority==="alta"&&<span style={{background:"#fdedec",color:"#c0392b",fontSize:10,padding:"2px 6px",borderRadius:8,marginLeft:8,fontWeight:700}}>ALTA</span>}
                  {isOverdue&&<span style={{background:"#fdedec",color:"#c0392b",fontSize:10,padding:"2px 6px",borderRadius:8,marginLeft:8,fontWeight:700}}>⏰ VENCIDA</span>}
                  {completos.length>0&&<span style={{background:"#eafaf1",color:"#27ae60",fontSize:10,padding:"2px 6px",borderRadius:8,marginLeft:8,fontWeight:700}}>✓ Completada</span>}
                </div>
                {t.description&&<div style={{fontSize:12,color:"#555",marginBottom:6,whiteSpace:"pre-wrap"}}>{t.description}</div>}
                <div style={{display:"flex",gap:12,fontSize:11,color:"#888",flexWrap:"wrap"}}>
                  {t.zone&&<span>📍 {t.zone}</span>}
                  <span>👥 {asignados.length>1?`${asignados.length} trabajadores`:asignados.join(", ")}</span>
                  <span>📅 Origen: {t.fechaCreacion||t.date||"—"}</span>
                  {t.fechaLimite&&<span style={{color:isOverdue?"#c0392b":"#888",fontWeight:isOverdue?700:400}}>⏰ Límite: {t.fechaLimite}</span>}
                </div>
                {completos.length>0&&<div style={{fontSize:11,color:"#27ae60",marginTop:6,fontWeight:600}}>✓ Completada por: {completos.join(", ")}</div>}
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                <button onClick={()=>startEdit(t)} style={{background:"#eaf4fb",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#2980b9",fontWeight:600}}>✎</button>
                <button onClick={()=>delTask(t.id)} style={{background:"#fdedec",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#c0392b"}}>✕</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function InstruccionesAdmin(){
  const [data,setData]=useState([]);
  const [form,setForm]=useState({crop:"jitomate",title:"",zone:"",volume:"",notes:"",date:new Date().toISOString().slice(0,10)});
  const [steps,setSteps]=useState([""]);
  useEffect(()=>{const q=collection(db,"instrucciones");const unsub=onSnapshot(q,snap=>setData(snap.docs.map(d=>({id:d.id,...d.data()}))));return()=>unsub();},[]);
  const publish=async()=>{if(!form.title){alert("Agrega título");return;}await addDoc(collection(db,"instrucciones"),{...form,steps:steps.filter(s=>s.trim()),createdAt:new Date().toISOString()});setForm(p=>({...p,title:"",zone:"",volume:"",notes:""}));setSteps([""]);};
  const inp2={padding:"9px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,width:"100%",boxSizing:"border-box"};
  return(
    <div>
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12}}>PUBLICAR INSTRUCCIONES</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>CULTIVO</label><select value={form.crop} onChange={e=>setForm(p=>({...p,crop:e.target.value}))} style={inp2}>{Object.entries(CROPS).map(([k,c])=><option key={k} value={k}>{c.emoji} {c.name}</option>)}</select></div>
          <div><label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>FECHA</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp2}/></div>
          <div style={{gridColumn:"1/-1"}}><label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>TÍTULO *</label><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Ej: Preparación solución vegetativa" style={inp2}/></div>
          <div><label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>ZONA</label><input value={form.zone} onChange={e=>setForm(p=>({...p,zone:e.target.value}))} placeholder="Zona A" style={inp2}/></div>
          <div><label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>VOLUMEN (L)</label><input type="number" value={form.volume} onChange={e=>setForm(p=>({...p,volume:e.target.value}))} placeholder="1000" style={inp2}/></div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <label style={{fontSize:10,color:"#aaa"}}>PASOS</label>
            <button onClick={()=>setSteps(p=>[...p,""])} style={{padding:"4px 12px",background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:6,color:"#27ae60",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Paso</button>
          </div>
          {steps.map((step,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:"#27ae60",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</div>
              <input value={step} onChange={e=>setSteps(p=>p.map((s,j)=>j===i?e.target.value:s))} placeholder={`Paso ${i+1}...`} style={{flex:1,padding:"8px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13}}/>
              {steps.length>1&&<button onClick={()=>setSteps(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#ddd",cursor:"pointer",fontSize:16}}>✕</button>}
            </div>
          ))}
        </div>
        <div style={{marginBottom:12}}><label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>NOTAS</label><textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Advertencias, orden de mezcla..." style={{...inp2,minHeight:60,resize:"vertical"}}/></div>
        <button onClick={publish} style={{padding:"9px 24px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>📢 Publicar instrucciones</button>
      </div>
      {data.map(inst=>(
        <div key={inst.id} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{CROPS[inst.crop]?.emoji} {inst.title}</div>
            <div style={{fontSize:11,color:"#aaa"}}>{inst.date} · {inst.zone||"Todas"} · {inst.volume||"—"} L · {inst.steps?.length||0} pasos</div>
          </div>
          <button onClick={()=>{if(window.confirm("¿Eliminar?"))deleteDoc(doc(db,"instrucciones",inst.id));}} style={{background:"none",border:"none",color:"#ddd",cursor:"pointer",fontSize:18}}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── INVENTARIO ───────────────────────────────────────────────────────────────
function Inventario(){
  const [items,setItems]=useState([]);
  const [form,setForm]=useState({name:"",unit:"kg",stock:0,minStock:0,precio:0});
  const [editing,setEditing]=useState(null);
  useEffect(()=>{const unsub=onSnapshot(collection(db,"inventario"),snap=>setItems(snap.docs.map(d=>({id:d.id,...d.data()}))));return()=>unsub();},[]);
  const save=async()=>{if(!form.name)return;const data={...form,stock:parseFloat(form.stock),minStock:parseFloat(form.minStock),precio:parseFloat(form.precio)};if(editing){await updateDoc(doc(db,"inventario",editing),data);setEditing(null);}else{await addDoc(collection(db,"inventario"),{...data,createdAt:new Date().toISOString()});}setForm({name:"",unit:"kg",stock:0,minStock:0,precio:0});};
  const upd=async(id,delta,cur)=>await updateDoc(doc(db,"inventario",id),{stock:Math.max(0,cur+delta)});
  const low=items.filter(i=>i.stock<=i.minStock);
  const inp2={padding:"8px 10px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:12,width:"100%",boxSizing:"border-box"};
  return(
    <div>
      {low.length>0&&<div style={{background:"#fef9e7",border:"1px solid #f39c1244",borderLeft:"4px solid #f39c12",borderRadius:12,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"#f39c12",marginBottom:6}}>⚠ STOCK BAJO — Requiere reposición</div>{low.map(i=><div key={i.id} style={{fontSize:12,color:"#856404"}}>• {i.name}: {i.stock} {i.unit} (mín: {i.minStock})</div>)}</div>}
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:12}}>{editing?"EDITAR":"AGREGAR"} INSUMO</div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:8,marginBottom:10,alignItems:"end"}}>
          <div><label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>NOMBRE</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Ca(NO₃)₂" style={inp2}/></div>
          <div><label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>UNIDAD</label><select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))} style={inp2}><option>kg</option><option>L</option><option>g</option><option>ml</option><option>bolsa</option></select></div>
          <div><label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>STOCK</label><input type="number" min="0" step="0.1" value={form.stock} onChange={e=>setForm(p=>({...p,stock:e.target.value}))} style={inp2}/></div>
          <div><label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>MÍNIMO</label><input type="number" min="0" step="0.1" value={form.minStock} onChange={e=>setForm(p=>({...p,minStock:e.target.value}))} style={inp2}/></div>
          <div><label style={{fontSize:10,color:"#aaa",display:"block",marginBottom:3}}>$/kg o L</label><input type="number" min="0" step="1" value={form.precio} onChange={e=>setForm(p=>({...p,precio:e.target.value}))} style={inp2}/></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={save} style={{padding:"8px 20px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:12}}>{editing?"Actualizar":"+ Agregar"}</button>
          {editing&&<button onClick={()=>{setEditing(null);setForm({name:"",unit:"kg",stock:0,minStock:0,precio:0});}} style={{padding:"8px 16px",border:"1px solid #e0e0e0",borderRadius:8,background:"transparent",color:"#888",cursor:"pointer",fontSize:12}}>Cancelar</button>}
        </div>
      </div>
      {!items.length&&<div style={{background:"#fff",borderRadius:12,padding:"2rem",textAlign:"center",color:"#aaa"}}>Sin insumos registrados</div>}
      {items.length>0&&(
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:14}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{borderBottom:"1px solid #f0f0f0"}}>{["Insumo","Stock","Mínimo","Estado","$/u","Total",""].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",color:"#aaa",fontWeight:500,fontSize:11}}>{h}</th>)}</tr></thead>
              <tbody>{items.map(item=>{
                const low=item.stock<=item.minStock;
                return(
                  <tr key={item.id} style={{borderBottom:"1px solid #fafafa",background:low?"#fefcf0":"transparent"}}>
                    <td style={{padding:"10px",fontWeight:600}}>{item.name}</td>
                    <td style={{padding:"10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <button onClick={()=>upd(item.id,-1,item.stock)} style={{width:24,height:24,border:"1px solid #e0e0e0",borderRadius:4,background:"#f5f5f5",cursor:"pointer",fontSize:14,lineHeight:1}}>−</button>
                        <span style={{fontFamily:"'Courier New',monospace",fontWeight:700,color:low?"#e74c3c":"#333",minWidth:50,textAlign:"center"}}>{item.stock} {item.unit}</span>
                        <button onClick={()=>upd(item.id,1,item.stock)} style={{width:24,height:24,border:"1px solid #e0e0e0",borderRadius:4,background:"#f5f5f5",cursor:"pointer",fontSize:14,lineHeight:1}}>+</button>
                      </div>
                    </td>
                    <td style={{padding:"10px",color:"#888",fontFamily:"'Courier New',monospace"}}>{item.minStock} {item.unit}</td>
                    <td style={{padding:"10px"}}><span style={{background:low?"#fef9e7":"#eafaf1",color:low?"#f39c12":"#27ae60",border:`1px solid ${low?"#f39c1244":"#a9dfbf"}`,borderRadius:10,padding:"2px 8px",fontSize:10,fontWeight:600}}>{low?"⚠ Bajo":"✓ OK"}</span></td>
                    <td style={{padding:"10px",color:"#888",fontFamily:"'Courier New',monospace"}}>${item.precio||0}</td>
                    <td style={{padding:"10px",fontFamily:"'Courier New',monospace",fontWeight:600,color:"#2c3e50"}}>${n(item.stock*(item.precio||0),2)}</td>
                    <td style={{padding:"10px"}}>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>{setEditing(item.id);setForm({name:item.name,unit:item.unit,stock:item.stock,minStock:item.minStock,precio:item.precio||0});}} style={{background:"#eaf4fb",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#2980b9"}}>✎</button>
                        <button onClick={()=>{if(window.confirm("¿Eliminar?"))deleteDoc(doc(db,"inventario",item.id));}} style={{background:"#fdedec",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#c0392b"}}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}</tbody>
              <tfoot><tr style={{borderTop:"2px solid #e0e0e0",background:"#f9f9f9"}}>
                <td style={{padding:"10px",fontWeight:700}} colSpan={5}>Total inventario</td>
                <td style={{padding:"10px",fontFamily:"'Courier New',monospace",fontWeight:700,color:"#27ae60"}}>${n(items.reduce((s,i)=>s+i.stock*(i.precio||0),0),2)}</td>
                <td></td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EQUIPO ───────────────────────────────────────────────────────────────────
function Trabajadores({readings}){
  const workers=useMemo(()=>{const map={};readings.forEach(r=>{if(!map[r.worker])map[r.worker]={name:r.worker,total:0,alerts:0,photos:0,lastDate:"",crops:new Set()};map[r.worker].total++;map[r.worker].crops.add(r.crop);if(r.photoURL)map[r.worker].photos++;if(r.date>map[r.worker].lastDate)map[r.worker].lastDate=r.date;const c=CROPS[r.crop];if(c&&(getStatus(r.ph,c.ph)==="danger"||getStatus(r.ce,c.ce)==="danger"))map[r.worker].alerts++;});return Object.values(map);},[readings]);
  if(!workers.length)return<div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa"}}><div style={{fontSize:40,marginBottom:8}}>👤</div><div>Sin trabajadores aún</div></div>;
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
      {workers.map(w=>{const init=w.name.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase();return(
        <div key={w.name} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px"}}>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:"#e8f0fe",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"#3c5a9a"}}>{init}</div>
            <div><div style={{fontWeight:700,fontSize:14}}>{w.name}</div><div style={{fontSize:11,color:"#aaa"}}>Último: {w.lastDate}</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{v:w.total,l:"Registros",c:"#27ae60"},{v:w.alerts,l:"Alertas",c:w.alerts>0?"#e74c3c":"#aaa"},{v:w.photos,l:"Fotos",c:"#2980b9"},{v:w.crops.size,l:"Cultivos",c:"#8e44ad"}].map(s=>(
              <div key={s.l} style={{textAlign:"center",background:"#f9f9f9",borderRadius:8,padding:"8px 4px"}}>
                <div style={{fontSize:18,fontWeight:700,color:s.c,fontFamily:"'Courier New',monospace"}}>{s.v}</div>
                <div style={{fontSize:10,color:"#aaa"}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:10,display:"flex",gap:4}}>{[...w.crops].map(k=><span key={k} style={{fontSize:16}}>{CROPS[k]?.emoji}</span>)}</div>
        </div>
      );})}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const NAV=[
  {id:"superadmin",label:"Centros CDT",icon:"🏢",soloSuper:true},
  {id:"resumen",label:"Resumen",icon:"◉"},
  {id:"alertas",label:"Alertas",icon:"⚠"},
  {id:"ia",label:"IA Diagnóstico",icon:"🔬"},
  {id:"reportes",label:"Reportes",icon:"↗"},
  {id:"formulador",label:"Formulador",icon:"⬡"},
  {id:"incidencias",label:"Incidencias",icon:"🚨"},
  {id:"tareas",label:"Tareas y avisos",icon:"📋"},
  {id:"inventario",label:"Almacén",icon:"📦"},
  {id:"aplicaciones",label:"Aplicaciones",icon:"🧪"},
  {id:"trabajadores",label:"Equipo",icon:"◎"},
  {id:"suelo", label:"Análisis de Suelo", icon:"🌍"},
  {id:"ventas", label:"Ventas", icon:"💰"},
  {id:"rangos", label:"Rangos", icon:"🎯"},
  {id:"usuarios", label:"Usuarios", icon:"👥"},
];
const TITLES={superadmin:"Gestión de Centros (CDT)",resumen:"Panel de control",alertas:"Centro de alertas",ia:"Diagnóstico con IA",reportes:"Reportes y análisis",formulador:"Formulador nutritivo",incidencias:"Incidencias",tareas:"Gestión de tareas",instrucciones:"Instrucciones del día",inventario:"Almacén de insumos",
    aplicaciones:"Aplicación de agroquímicos",trabajadores:"Equipo de campo",suelo: "Análisis de suelo",ventas:"Comercialización y ventas",rangos:"Rangos semanales pH/CE",usuarios:"Gestión de usuarios"};

// ─── BLOQUEADO ────────────────────────────────────────────────────────────────
function Bloqueado({nombre="esta sección"}) {
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"4rem 2rem",textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:16}}>🔒</div>
      <div style={{fontSize:18,fontWeight:700,color:"#555",marginBottom:8}}>Acceso restringido</div>
      <div style={{fontSize:13,color:"#aaa"}}>No tienes permiso para ver {nombre}.<br/>Contacta al administrador.</div>
    </div>
  );
}


export default function App(){
  const [page,setPage]=useState("resumen");
  const [readings,setReadings]=useState([]);
  const [weeklyRangos,setWeeklyRangos]=useState({});
  const [loading,setLoading]=useState(true);
  const [authLoading,setAuthLoading]=useState(true);
  const [currentUser,setCurrentUser]=useState(null);
  const [userRole,setUserRole]=useState(null);
  const [cdtId,setCdtId]=useState(null);
  const [cdtReady,setCdtReady]=useState(false);
  const esObservador = userRole==="observador";
  
  // Detectar móvil automáticamente
  const [isMobile, setIsMobile] = useState(()=>{
    try { return typeof window!=="undefined" && window.innerWidth < 768; } catch { return false; }
  });
  const [forceDesktop, setForceDesktop] = useState(()=>{
    try { return typeof window!=="undefined" && localStorage.getItem("forceDesktop")==="1"; } catch { return false; }
  });
  useEffect(()=>{
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async user => {
      if(user){
        setCurrentUser(user);
        try {
          let userData = null;
          const snap = await getDoc(doc(db,"usuarios",user.uid));
          if(snap.exists()){
            userData = snap.data();
          } else {
            // Buscar por email en usuarios
            const { query:q, collection:col, where, getDocs } = await import("firebase/firestore");
            const qs = await getDocs(q(col(db,"usuarios"),where("email","==",user.email)));
            if(!qs.empty) userData = qs.docs[0].data();
          }
          const rol = userData?.rol || "trabajador";
          const esSuper = rol === "super_admin";
          // El CDT del usuario. Si es super_admin y eligió "entrar" a otro CDT,
          // usamos ese override (persistido en localStorage).
          let userCdt = userData?.cdtId || null;
          if (esSuper) {
            const override = getSuperOverride();
            if (override) userCdt = override;
          }
          setUserRole(rol);
          setCdtId(userCdt);
          setCdtContext({ cdtId: userCdt, role: rol, isSuperAdmin: esSuper });
          // Cargar datos del CDT (cultivos, naves...)
          await loadCdtData(userCdt);
          setCdtReady(true);
        } catch {
          setUserRole("trabajador");
          setCdtId(null);
          setCdtContext({ cdtId: null, role: "trabajador", isSuperAdmin: false });
          setCdtReady(true);
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setCdtId(null);
        setCdtReady(false);
      }
      setAuthLoading(false);
    });
    return()=>unsub();
  },[]);

  useEffect(()=>{
    // Esperar a que el contexto de CDT esté listo antes de cargar,
    // para que el filtro por cdtId se aplique correctamente.
    if(!cdtReady) return;
    setReadings([]); // limpiar datos del CDT anterior al cambiar
    // Salvaguarda: si en 4s no llegó nada, quitar el "cargando"
    const safety=setTimeout(()=>setLoading(false),4000);
    const q=collection(db,"readings");
    const unsub=onSnapshot(q,snap=>{clearTimeout(safety);setReadings(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},()=>{clearTimeout(safety);setLoading(false);});
    const rangosUnsub=onSnapshot(doc(db,"config","rangos_semanales"),snap=>{if(snap.exists())setWeeklyRangos(snap.data());});
    return()=>{clearTimeout(safety);unsub();rangosUnsub();};
  },[cdtReady,cdtId]);

  const handleDelete=async id=>{try{await deleteDoc(doc(db,"readings",id));}catch{alert("Error al eliminar.");}};
  const alerts=readings.filter(r=>{if(r.resolved||r.dismissed||(r.tipo||"entrada")!=="entrada")return false;const c=CROPS[r.crop];if(!c)return false;const rng=getRangos(r.crop,"entrada",r.invernadero,{});return getStatus(r.ph,rng.ph)==="danger"||getStatus(r.ce,rng.ce)==="danger";});

  // Auth loading
  if(authLoading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(160deg,#0f1e2e,#1a3a2a)"}}><div style={{textAlign:"center",color:"#fff"}}><div style={{fontSize:40,marginBottom:12}}>🌿</div><div style={{fontWeight:700,fontSize:18}}>GreenLog</div><div style={{fontSize:12,color:"#4ecb8d",marginTop:4}}>Cargando...</div></div></div>;

  // Not logged in
  if(!currentUser) return <LoginScreen/>;

  // Logged in as worker
  if(userRole==="trabajador") return <Worker user={currentUser}/>;

  // Admin/observador en MÓVIL: vista compacta dashboard
  if((userRole==="admin"||userRole==="observador") && isMobile && !forceDesktop) {
    try {
      return <MobileDashboard 
        user={currentUser} 
        onLogout={()=>setCurrentUser(null)}
        onSwitchToDesktop={()=>{ try{ localStorage.setItem("forceDesktop","1"); }catch{} setForceDesktop(true); }}
      />;
    } catch(e) {
      return (
        <div style={{padding:20,margin:20,background:"#fff",border:"2px solid #e74c3c",borderRadius:12}}>
          <div style={{fontSize:18,fontWeight:700,color:"#c0392b",marginBottom:10}}>⚠ Error cargando vista móvil</div>
          <div style={{fontSize:12,marginBottom:14,fontFamily:"monospace",background:"#fdedec",padding:10,borderRadius:8,color:"#c0392b"}}>
            {String(e?.message || e)}
          </div>
          <button onClick={()=>{setForceDesktop(true);}} style={{padding:"10px 20px",background:"#2980b9",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,marginRight:8}}>
            🖥 Ver versión escritorio
          </button>
          <button onClick={()=>window.location.reload()} style={{padding:"10px 20px",background:"#888",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>
            ↻ Recargar
          </button>
        </div>
      );
    }
  }

  // Data loading for admin
  if(loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f4f5f7"}}><div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>🌿</div><div style={{fontWeight:700,color:"#27ae60",fontSize:18}}>GreenLog</div><div style={{fontSize:12,color:"#aaa",marginTop:4}}>Cargando...</div></div></div>;

  const SECTION={
    superadmin:  <SuperAdmin/>,
    suelo:       <AnalisisSuelo/>,
    resumen:     <Resumen readings={readings} onDelete={esObservador?()=>{}:handleDelete} weeklyRangos={weeklyRangos}/>,
    alertas:     <Alertas readings={readings} onDelete={esObservador?()=>{}:handleDelete} weeklyRangos={weeklyRangos}/>,
    ia:          <DiagnosticoIA/>,
    reportes:    <Reportes readings={readings} onDelete={esObservador?()=>{}:handleDelete} weeklyRangos={weeklyRangos}/>,
    formulador:  <Formulador/>,
    incidencias: <IncidenciasAdmin/>,
    tareas:      <TareasAdmin/>,
    
    inventario:  <AlmacenAdmin/>,
    aplicaciones: <AplicacionesAdmin/>,
    trabajadores:<Trabajadores readings={readings}/>,
    ventas:      <Ventas readOnly={esObservador}/>,
    rangos:      esObservador?<Bloqueado nombre="los rangos"/>:<RangosSemanales/>,
    usuarios:    esObservador?<Bloqueado nombre="la gestión de usuarios"/>:<UsuariosAdmin/>,
  };

  return(
    <div style={{display:"flex",minHeight:"100vh",background:"#f4f5f7",fontFamily:"'Georgia',serif"}}>
      <div style={{width:210,background:"#1a2533",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",flexShrink:0,overflowY:"auto"}}>
        <div style={{padding:"20px 18px 14px",borderBottom:"1px solid #243040"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:22}}>🌿</span>
            <div><div style={{color:"#4ecb8d",fontWeight:700,fontSize:16,letterSpacing:-0.3}}>GreenLog</div><div style={{color:"#3a5060",fontSize:10,fontFamily:"'Courier New',monospace",marginTop:1}}>ADMINISTRADOR</div></div>
          </div>
        </div>
        <nav style={{flex:1,padding:"8px 0"}}>
          {NAV.filter(item=>!item.soloSuper||userRole==="super_admin").map(item=>(
            <button key={item.id} onClick={()=>setPage(item.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 18px",border:"none",background:page===item.id?"#243a52":"transparent",color:page===item.id?"#4ecb8d":"#7a9ab0",cursor:"pointer",textAlign:"left",borderLeft:page===item.id?"3px solid #4ecb8d":"3px solid transparent",transition:"all 0.15s",fontSize:13,fontFamily:"'Georgia',serif"}}>
              <span style={{fontSize:14,width:16,textAlign:"center"}}>{item.icon}</span>
              <span>{item.label}</span>
              {item.id==="alertas"&&alerts.length>0&&<span style={{marginLeft:"auto",background:"#e74c3c",color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontFamily:"'Courier New',monospace"}}>{alerts.length}</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:"12px 18px",borderTop:"1px solid #243040",fontSize:10,color:"#3a5060",fontFamily:"'Courier New',monospace",lineHeight:1.6}}>
          <div>🔴 En vivo · Firebase</div>
          <div>{readings.length} registros</div>
        </div>
      </div>
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{background:"#fff",borderBottom:"0.5px solid #e0e0e0",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
          <h1 style={{margin:0,fontSize:18,fontWeight:700,color:"#1a2533"}}>{TITLES[page]}</h1>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {alerts.length>0&&<div style={{background:"#fdedec",border:"1px solid #f5c6c6",borderRadius:20,padding:"5px 12px",fontSize:12,color:"#c0392b",fontWeight:600,cursor:"pointer"}} onClick={()=>setPage("alertas")}>🚨 {alerts.length} alerta{alerts.length>1?"s":""}</div>}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:"#1a2533",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:"#4ecb8d",border:"2px solid #4ecb8d"}}>
                {currentUser?.email?.slice(0,2).toUpperCase()||"JL"}
              </div>
              {isMobile && forceDesktop && (userRole==="admin"||userRole==="observador") && (
                <button onClick={()=>{ try{ localStorage.removeItem("forceDesktop"); }catch{} setForceDesktop(false); }}
                  style={{padding:"5px 10px",border:"1px solid #4ecb8d",borderRadius:8,background:"#1a2533",color:"#4ecb8d",cursor:"pointer",fontSize:11,fontWeight:600}}>
                  📱 Vista móvil
                </button>
              )}
              <button onClick={()=>signOut(auth)} style={{padding:"5px 10px",border:"1px solid #3a5060",borderRadius:8,background:"transparent",color:"#7a9ab0",cursor:"pointer",fontSize:11}}>Salir</button>
            </div>
          </div>
        </div>
        <div style={{padding:"20px 24px",maxWidth:1000,margin:"0 auto"}}>{SECTION[page]}</div>
      </div>
    </div>
  );
}
