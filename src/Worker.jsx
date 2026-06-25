import { useState, useRef, useEffect } from "react";
import { db, auth } from "./firebase";
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, updateDoc } from "firebase/firestore";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";

const CROPS = {
  jitomate:  {
    name:"Jitomate", emoji:"🍅", color:"#c0392b",
    entrada: { ph:{min:5.5,max:6.2}, ce:{min:2.5,max:4.0} },
    salida:  { ph:{min:5.8,max:6.5}, ce:{min:3.5,max:6.0} },
    // backward compat
    ph:{min:5.5,max:6.2}, ce:{min:2.5,max:4.0},
    invernaderos: ["INV 2","INV 3","INV 5","INV 6"],
    extraFields: [
      { key:"ca",  label:"Calcio (Ca)",    unit:"mg/L", min:120, max:180, placeholder:"150" },
      { key:"no3", label:"Nitratos (NO₃)", unit:"mg/L", min:150, max:200, placeholder:"175" },
      { key:"k",   label:"Potasio (K)",    unit:"mg/L", min:200, max:300, placeholder:"250" },
      { key:"fe",  label:"Hierro (Fe)",    unit:"mg/L", min:1.5, max:3.0, placeholder:"2.0" },
    ],
  },
  fresa: {
    name:"Fresa", emoji:"🍓", color:"#e74c3c",
    entrada: { ph:{min:5.5,max:6.5}, ce:{min:1.0,max:2.0} },
    salida:  { ph:{min:5.8,max:6.8}, ce:{min:1.5,max:2.5} },
    ph:{min:5.5,max:6.5}, ce:{min:1.0,max:2.0},
    extraFields: [
      { key:"ca",  label:"Calcio (Ca)",   unit:"mg/L", min:120, max:180, placeholder:"150" },
      { key:"no3", label:"Nitratos (NO₃)",unit:"mg/L", min:150, max:200, placeholder:"175" },
      { key:"k",   label:"Potasio (K)",   unit:"mg/L", min:200, max:300, placeholder:"250" },
      { key:"fe",  label:"Hierro (Fe)",   unit:"mg/L", min:1.5, max:3.0, placeholder:"2.0" },
    ],
  },
  arandano: {
    name:"Arándano", emoji:"🫐", color:"#2980b9",
    entrada: { ph:{min:4.5,max:5.5}, ce:{min:1.0,max:2.0} },
    salida:  { ph:{min:4.8,max:5.8}, ce:{min:1.5,max:2.5} },
    ph:{min:4.5,max:5.5}, ce:{min:1.0,max:2.0},
  },
  zarzamora: {
    name:"Zarzamora", emoji:"🫐", color:"#8e44ad",
    entrada: { ph:{min:5.5,max:6.5}, ce:{min:1.5,max:2.5} },
    salida:  { ph:{min:5.8,max:6.8}, ce:{min:2.0,max:3.5} },
    ph:{min:5.5,max:6.5}, ce:{min:1.5,max:2.5},
    noDrenaje: true,
  },
};
const SYMPTOMS = {
  jitomate: [
    { name:"Hojas amarillas (clorosis)", icon:"🟡", cause:"Deficiencia de Fe o pH muy alto", action:"Bajar pH a 5.8–6.2, aplicar Fe quelado foliar", severity:"alta" },
    { name:"Punta de hoja café", icon:"🟤", cause:"Deficiencia de Ca o CE alta", action:"Bajar CE, revisar aireación de raíz", severity:"alta" },
    { name:"Manchas grises en hoja", icon:"⚪", cause:"Botrytis (hongo por humedad)", action:"Mejorar ventilación, aplicar fungicida preventivo", severity:"alta" },
    { name:"Hoja enrollada hacia arriba", icon:"🌀", cause:"Estrés hídrico o exceso de calor", action:"Revisar sistema de riego y temperatura", severity:"media" },
    { name:"Raíz café / podrida", icon:"🫚", cause:"Pythium — pudrición radicular", action:"Revisar CE y pH, aplicar Metalaxil, revisar drenaje", severity:"alta" },
    { name:"Mosca blanca en hojas", icon:"🪰", cause:"Plaga de mosca blanca", action:"Aplicar jabón potásico o insecticida sistémico", severity:"media" },
  ],
  fresa: [
    { name:"Borde de hojas rojo", icon:"🔴", cause:"Deficiencia de P o frío nocturno", action:"Revisar temperatura mínima y ajustar fórmula", severity:"baja" },
    { name:"Frutos deformados", icon:"🍓", cause:"Mala polinización o deficiencia de Boro", action:"Aplicar boro foliar, revisar humedad relativa", severity:"media" },
    { name:"Polvo blanco en hojas", icon:"⬜", cause:"Oidio (cenicilla)", action:"Aplicar azufre mojable o bicarbonato de potasio", severity:"alta" },
    { name:"Raíz café sin pelos", icon:"🫚", cause:"Phytophthora o saturación de agua", action:"Revisar drenaje, aplicar Fosetil-Al", severity:"alta" },
  ],
  arandano: [
    { name:"Toda la hoja amarilla", icon:"🟡", cause:"pH demasiado alto", action:"Bajar pH a 4.5–5.5 urgente", severity:"alta" },
    { name:"Quemadura en puntas", icon:"🔥", cause:"Exceso de sales, CE muy alta", action:"Renovar solución, bajar CE", severity:"media" },
    { name:"Manchas rojas en hojas", icon:"🔴", cause:"Antracnosis o estrés por frío", action:"Aplicar fungicida cúprico, proteger de heladas", severity:"alta" },
  ],
  zarzamora: [
    { name:"Puntos naranjas en hojas", icon:"🟠", cause:"Roya (hongo)", action:"Aplicar fungicida sistémico, mejorar ventilación", severity:"alta" },
    { name:"Hojas pequeñas y amarillas", icon:"🟡", cause:"Deficiencia de Fe o Mn", action:"Revisar pH, aplicar quelatos foliares", severity:"media" },
    { name:"Manchas oscuras en tallos", icon:"🟫", cause:"Botrytis o cancro bacteriano", action:"Podar partes afectadas, aplicar fungicida cúprico", severity:"alta" },
  ],
};
const CALIDADES = [
  { id:"primera", label:"Primera", color:"#27ae60", icon:"⭐" },
  { id:"segunda", label:"Segunda", color:"#f39c12", icon:"⚡" },
  { id:"tercera", label:"Tercera", color:"#e67e22", icon:"▲"  },
];
const CANALES = ["Mercado local","Central de abastos","Supermercado","Restaurante","Exportación","Venta directa","Agroindustria","Otro"];
const SEV_COLOR = { alta:"#e74c3c", media:"#f39c12", baja:"#27ae60" };
const SEV_BG    = { alta:"#fdedec", media:"#fef9e7", baja:"#eafaf1" };

function getStatus(v, r) {
  if (v < r.min || v > r.max) return "danger";
  const m = (r.max - r.min) * 0.15;
  return (v < r.min + m || v > r.max - m) ? "warning" : "ok";
}

// Estilos base — fondo blanco forzado para móvil en modo oscuro
const INP = {
  width:"100%", padding:"13px 14px", border:"1.5px solid #ccc",
  borderRadius:10, fontSize:16, boxSizing:"border-box",
  background:"#ffffff", backgroundColor:"#ffffff",
  color:"#111111", WebkitTextFillColor:"#111111",
  colorScheme:"light", outline:"none", fontFamily:"inherit",
};
const LBL = {
  fontSize:11, color:"#555", marginBottom:6, display:"block",
  textTransform:"uppercase", letterSpacing:0.4,
  fontFamily:"'Courier New',monospace", fontWeight:600,
};


// ─── MIS ALERTAS ACTIVAS ─────────────────────────────────────────────────────
function MisAlertasActivas({ worker }) {
  const [alertas, setAlertas] = useState([]);
  const [weeklyRangos, setWeeklyRangos] = useState({});
  useEffect(()=>{
    const rangosUnsub = onSnapshot(doc(db,"config","rangos_semanales"), snap=>{
      if(snap.exists()) setWeeklyRangos(snap.data());
    });
    const q = query(collection(db,"readings"), where("worker","==",worker), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap=>{
      const recent = snap.docs.slice(0,10).map(d=>({id:d.id,...d.data()}));
      const conAlerta = recent.filter(r=>{
        if(r.resolved||r.dismissed) return false;
        if((r.tipo||"entrada")!=="entrada") return false;
        const c = CROPS[r.crop]; if(!c) return false;
        const defPh = c.entrada?.ph||c.ph; const defCe = c.entrada?.ce||c.ce;
        if(!defPh||!defCe) return false;
        const invKey = (r.invernadero||"").replace(" ","");
        const key = invKey ? `${r.crop}_${invKey}_entrada` : `${r.crop}_entrada`;
        const wr = weeklyRangos?.[key] || {};
        const ph = {min: wr.phMin!==undefined?wr.phMin:defPh.min, max: wr.phMax!==undefined?wr.phMax:defPh.max};
        const ce = {min: wr.ceMin!==undefined?wr.ceMin:defCe.min, max: wr.ceMax!==undefined?wr.ceMax:defCe.max};
        const phOut = r.ph<ph.min||r.ph>ph.max;
        const ceOut = r.ce<ce.min||r.ce>ce.max;
        return phOut||ceOut;
      });
      setAlertas(conAlerta);
    });
    return()=>{unsub();rangosUnsub();};
  },[worker,weeklyRangos]);

  const resolver = async (id) => {
    if(!window.confirm("¿Marcar esta medición como resuelta? Se quitará la alerta del admin y de tu pantalla.")) return;
    setAlertas(prev => prev.filter(a => a.id !== id));
    try {
      await updateDoc(doc(db,"readings",id),{resolved:true,resolvedAt:new Date().toISOString(),resolvedBy:worker});
    } catch(e) {
      alert("⚠ Error al guardar: "+e.message);
    }
  };

  if(!alertas.length) return null;
  return(
    <div style={{background:"#fdedec",border:"1.5px solid #e74c3c",borderRadius:10,padding:"10px 14px",marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:"#c0392b",marginBottom:8}}>⚠ Tienes {alertas.length} medición(es) con alerta. Si ya las corregiste, márcalas como resueltas:</div>
      {alertas.map(r=>{
        const c = CROPS[r.crop];
        return(
          <div key={r.id} style={{background:"#fff",borderRadius:8,padding:"8px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>{c?.emoji}</span>
            <div style={{flex:1,fontSize:12}}>
              <div style={{fontWeight:600,color:"#222"}}>{c?.name} · {r.invernadero||"—"} · {r.zone||r.tinaco||"—"}</div>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:11,color:"#888"}}>pH {r.ph} · CE {r.ce} · {r.date} {r.time||""}</div>
            </div>
            <button onClick={()=>resolver(r.id)} style={{padding:"6px 12px",background:"#27ae60",border:"none",borderRadius:6,color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0,whiteSpace:"nowrap"}}>✓ Resuelto</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── REGISTRO pH/CE ────────────────────────────────────────────────────────────
function Registro({ worker }) {
  const [form, setForm] = useState({
    crop:"jitomate", zone:"Zona 1", invernadero:"INV 2",
    tipo:"entrada", bandeja:"Bandeja 1", tinaco:"Tinaco 1",
    modo:"bandeja",
    ph:"", ce:"", drenaje:"", volumenEntrada:"", notes:"",
    ca:"", no3:"", k:"", fe:"",
  });

  const [weeklyRangos, setWeeklyRangos] = useState({});
  useEffect(()=>{
    const unsub = onSnapshot(doc(db,"config","rangos_semanales"), snap=>{
      if(snap.exists()) setWeeklyRangos(snap.data());
    });
    return()=>unsub();
  },[]);
  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();
  const crop = CROPS[form.crop];
  const rangos = (()=>{
    const fallback = {ph:{min:0,max:14},ce:{min:0,max:10}};
    if(!crop) return fallback;
    const defRng = (form.tipo === "entrada" ? crop.entrada : crop.salida) || crop.entrada || fallback;
    if(!defRng?.ph || !defRng?.ce) return fallback;
    // Buscar rango semanal: cultivo_invernadero_tipo o cultivo_tipo
    const invKey = (form.invernadero||"").replace(" ","");
    const key = invKey ? `${form.crop}_${invKey}_${form.tipo}` : `${form.crop}_${form.tipo}`;
    const wr = weeklyRangos?.[key];
    if(wr){
      const phMin = wr.phMin!==undefined ? wr.phMin : defRng.ph.min;
      const phMax = wr.phMax!==undefined ? wr.phMax : defRng.ph.max;
      const ceMin = wr.ceMin!==undefined ? wr.ceMin : defRng.ce.min;
      const ceMax = wr.ceMax!==undefined ? wr.ceMax : defRng.ce.max;
      return {ph:{min:phMin,max:phMax},ce:{min:ceMin,max:ceMax},_custom:true};
    }
    return defRng;
  })();

  const handleImage = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1024;
        let w=img.width,h=img.height;
        if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;}}
        canvas.width=w;canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        setImgPreview(canvas.toDataURL("image/jpeg",0.75));
        canvas.toBlob(blob=>setImgFile(new File([blob],file.name,{type:"image/jpeg"})),"image/jpeg",0.75);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (form.modo==="tinaco") {
      if (!form.tinaco||!form.ph||!form.ce) { alert("Llena tinaco, pH y CE."); return; }
    } else {
      if (!form.zone||!form.ph||!form.ce) { alert("Llena zona, pH y CE."); return; }
    }
    const phVal = parseFloat(form.ph);
    const ceVal = parseFloat(form.ce);
    if (isNaN(phVal) || phVal < 0 || phVal > 14) { alert("⚠ pH debe estar entre 0 y 14. Verifica el valor."); return; }
    if (isNaN(ceVal) || ceVal < 0 || ceVal > 10) { alert("⚠ CE debe estar entre 0 y 10 mS/cm. Verifica el valor."); return; }
    setSaving(true);
    let photoURL = "";
    try {
      if (imgFile) {
        const st = getStorage();
        const r = sRef(st,`photos/${Date.now()}_${imgFile.name}`);
        await uploadBytes(r,imgFile); photoURL = await getDownloadURL(r);
      }
      const now = new Date();
      const esTinaco = form.modo==="tinaco";
      const data = {
        ...form, worker,
        ph:parseFloat(form.ph), ce:parseFloat(form.ce),
        bandeja: esTinaco ? "" : (form.bandeja||""),
        zone:    esTinaco ? "" : (form.zone||""),
        drenaje:        esTinaco ? null : (form.drenaje ? parseFloat(form.drenaje) : null),
        volumenEntrada: esTinaco ? null : (form.volumenEntrada ? parseFloat(form.volumenEntrada) : null),
        ca:  form.ca  ? parseFloat(form.ca)  : null,
        no3: form.no3 ? parseFloat(form.no3) : null,
        k:   form.k   ? parseFloat(form.k)   : null,
        fe:  form.fe  ? parseFloat(form.fe)  : null,
        date:now.toISOString().slice(0,10), time:now.toTimeString().slice(0,5),
        createdAt:now.toISOString(), photoURL,
      };
      Object.keys(data).forEach(k => data[k] === null && delete data[k]);
      await addDoc(collection(db,"readings"), data);
      setSaved(true);
      setForm(p=>({...p,zone:"Zona 1",bandeja:"Bandeja 1",tinaco:"Tinaco 1",ph:"",ce:"",drenaje:"",volumenEntrada:"",notes:"",ca:"",no3:"",k:"",fe:""}));
      setImgFile(null); setImgPreview(null);
      setTimeout(()=>setSaved(false),4000);
    } catch { alert("Error al guardar."); }
    setSaving(false);
  };

  const sBorder = (v, r) => {
    if (!v) return "#ccc";
    const val = parseFloat(v); if (isNaN(val)) return "#ccc";
    if (val<r.min||val>r.max) return "#e74c3c";
    const m=(r.max-r.min)*0.15;
    return (val<r.min+m||val>r.max-m)?"#f39c12":"#27ae60";
  };
  const sText = (v, r) => {
    if (!v) return null;
    const val = parseFloat(v); if (isNaN(val)) return null;
    if (val<r.min||val>r.max) return "⚠ Fuera de rango";
    const m=(r.max-r.min)*0.15;
    return (val<r.min+m||val>r.max-m)?"⚠ Cerca del límite":"✓ Normal";
  };

  return (
    <div>
      {saved&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:12,marginBottom:16,color:"#27ae60",fontWeight:600,textAlign:"center"}}>✓ Medición enviada</div>}
      <MisAlertasActivas worker={worker}/>

      <div style={{marginBottom:14}}>
        <label style={LBL}>Cultivo</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {Object.entries(CROPS).map(([k,c])=>(
            <button key={k} onClick={()=>setForm(p=>({...p,crop:k,invernadero:c.invernaderos?c.invernaderos[0]:""}))}
              style={{padding:"8px 14px",border:`1.5px solid ${form.crop===k?c.color:"#e0e0e0"}`,borderRadius:20,background:form.crop===k?c.color+"18":"transparent",color:form.crop===k?c.color:"#777",cursor:"pointer",fontSize:13,fontWeight:form.crop===k?700:400}}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <label style={LBL}>Tipo de medición</label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["entrada","⬇ Entrada","#27ae60","Solución que entra"],["salida","⬆ Salida / Drenaje","#2980b9","Solución que drena"]].map(([val,label,color,desc])=>(
            <button key={val} onClick={()=>setForm(p=>({...p,tipo:val}))}
              style={{padding:"12px 10px",border:`2px solid ${form.tipo===val?color:"#ddd"}`,borderRadius:12,background:form.tipo===val?color+"15":"#fff",cursor:"pointer",textAlign:"left"}}>
              <div style={{fontWeight:700,fontSize:14,color:form.tipo===val?color:"#333",marginBottom:2}}>{label}</div>
              <div style={{fontSize:11,color:"#888"}}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{background:"#f0faf5",borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12,color:"#555",border:`1px solid ${crop.color}33`}}>
        <strong style={{color:crop.color}}>{crop.emoji} {crop.name} — {form.tipo==="entrada"?"Entrada":"Salida"}</strong>
        <span style={{marginLeft:10}}>pH: <strong>{rangos.ph.min}–{rangos.ph.max}</strong>{rangos._custom&&<span style={{marginLeft:4,fontSize:9,padding:"1px 5px",borderRadius:5,background:"#8e44ad22",color:"#8e44ad",fontWeight:700}}>📋 ajuste semanal</span>}</span>
        <span style={{marginLeft:10}}>CE: <strong>{rangos.ce.min}–{rangos.ce.max} mS/cm</strong></span>
      </div>

      {crop.invernaderos&&(
        <div style={{marginBottom:14}}>
          <label style={LBL}>Invernadero</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {crop.invernaderos.map(inv=>(
              <button key={inv} onClick={()=>setForm(p=>({...p,invernadero:inv}))}
                style={{padding:"9px 16px",border:`2px solid ${form.invernadero===inv?crop.color:"#ddd"}`,borderRadius:10,background:form.invernadero===inv?crop.color+"18":"#fff",color:form.invernadero===inv?crop.color:"#555",cursor:"pointer",fontSize:14,fontWeight:form.invernadero===inv?700:500}}>
                {inv}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:12,padding:6,background:"#f5f5f5",borderRadius:10}}>
        {[["bandeja","📊 Bandeja","#27ae60"],["tinaco","💧 Tinaco","#2980b9"]].map(([v,l,c])=>(
          <button key={v} type="button" onClick={()=>setForm(p=>({...p,modo:v}))}
            style={{flex:1,padding:"10px 14px",border:"none",borderRadius:8,background:form.modo===v?c:"transparent",color:form.modo===v?"#fff":"#666",cursor:"pointer",fontWeight:form.modo===v?700:500,fontSize:13}}>
            {l}
          </button>
        ))}
      </div>
      {form.modo==="tinaco"&&(
        <div style={{background:"#eaf4fb",border:"1px solid #b5d4f4",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:"#1a5276"}}>
          💧 Modo Tinaco: solo registrarás cultivo, invernadero, tinaco y la medición. Zona/bandeja/volumen no aplican.
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        {form.modo!=="tinaco"&&<>
        <div>
          <label style={LBL}>Zona *</label>
          <select value={form.zone} onChange={e=>setForm(p=>({...p,zone:e.target.value}))} style={INP}>
            {["Zona 1","Zona 2","Zona 3","Zona 4"].map(z=><option key={z} value={z}>{z}</option>)}
          </select>
        </div>
        <div>
          <label style={LBL}>Bandeja *</label>
          <select value={form.bandeja} onChange={e=>setForm(p=>({...p,bandeja:e.target.value}))} style={INP}>
            {Array.from({length:14},(_,i)=>`Bandeja ${i+1}`).map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        </>}
        {form.modo==="tinaco"&&(
        <div style={{gridColumn:"1 / span 2"}}>
          <label style={LBL}>Tinaco *</label>
          <select value={form.tinaco||"Tinaco 1"} onChange={e=>setForm(p=>({...p,tinaco:e.target.value}))} style={INP}>
            {["Tinaco 1","Tinaco 2","Tinaco 3","Tinaco 4"].map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        )}

        {form.tipo==="entrada"&&form.modo!=="tinaco"&&(
          <div style={{gridColumn:"1/-1"}}>
            <label style={LBL}>Volumen de entrada (mL)</label>
            <input type="number" step="0.1" min="0" value={form.volumenEntrada}
              onChange={e=>setForm(p=>({...p,volumenEntrada:e.target.value}))} placeholder="Ej: 1500 mL" style={INP}/>
          </div>
        )}

        <div>
          <label style={LBL}>pH medido *</label>
          <input type="number" step="0.1" min="0" max="14" value={form.ph}
            onChange={e=>setForm(p=>({...p,ph:e.target.value}))} placeholder={`${rangos.ph.min}–${rangos.ph.max}`}
            style={{...INP,borderColor:sBorder(form.ph,rangos.ph)}}/>
          {form.ph&&<div style={{fontSize:10,marginTop:3,color:sBorder(form.ph,rangos.ph)}}>{sText(form.ph,rangos.ph)}</div>}
        </div>

        <div>
          <label style={LBL}>CE mS/cm *</label>
          <input type="number" step="0.1" min="0" max="10" value={form.ce}
            onChange={e=>setForm(p=>({...p,ce:e.target.value}))} placeholder={`${rangos.ce.min}–${rangos.ce.max}`}
            style={{...INP,borderColor:sBorder(form.ce,rangos.ce)}}/>
          {form.ce&&<div style={{fontSize:10,marginTop:3,color:sBorder(form.ce,rangos.ce)}}>{sText(form.ce,rangos.ce)}</div>}
        </div>

        {form.tipo==="salida"&&!crop.noDrenaje&&(
          <div style={{gridColumn:"1/-1"}}>
            <label style={LBL}>Volumen de drenaje (mL)</label>
            <input type="number" step="0.1" min="0" value={form.drenaje}
              onChange={e=>setForm(p=>({...p,drenaje:e.target.value}))} placeholder="Ej: 450 mL" style={INP}/>
          </div>
        )}

        {crop.extraFields&&crop.extraFields.map(f=>(
          <div key={f.key}>
            <label style={LBL}>{f.label} <span style={{color:"#bbb",fontWeight:400}}>(opcional)</span></label>
            <input type="number" step="0.1" min="0" value={form[f.key]}
              onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
              placeholder={`${f.placeholder} ${f.unit}`}
              style={{...INP,borderColor:form[f.key]?(parseFloat(form[f.key])<f.min||parseFloat(form[f.key])>f.max?"#f39c12":"#27ae60"):"#ccc"}}/>
            {form[f.key]&&<div style={{fontSize:10,marginTop:3,color:parseFloat(form[f.key])<f.min||parseFloat(form[f.key])>f.max?"#f39c12":"#27ae60"}}>
              Rango: {f.min}–{f.max} {f.unit}
            </div>}
          </div>
        ))}

        <div style={{gridColumn:"1/-1"}}>
          <label style={LBL}>Observaciones</label>
          <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
            placeholder="Hojas amarillas, planta decaída..." style={{...INP,minHeight:72,resize:"vertical"}}/>
        </div>
      </div>

      <div style={{marginBottom:16}}>
        <label style={LBL}>Foto (opcional)</label>
        <div onClick={()=>fileRef.current.click()} style={{border:"2px dashed #d5e8d4",borderRadius:10,padding:imgPreview?"0":"1.5rem",textAlign:"center",cursor:"pointer",overflow:"hidden",background:"#f9fff9"}}>
          {imgPreview
            ?<div style={{position:"relative"}}><img src={imgPreview} alt="" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:8,display:"block"}}/><div style={{position:"absolute",top:8,right:8,background:"#fff",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#27ae60",fontWeight:600}}>✓ Lista</div></div>
            :<div><div style={{fontSize:32,marginBottom:6}}>📸</div><div style={{color:"#aaa",fontSize:13}}>Toca para tomar foto</div></div>}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleImage}/>
        </div>
      </div>

      <button onClick={submit} disabled={saving}
        style={{width:"100%",padding:14,background:saving?"#a8d5b5":"#27ae60",color:"#fff",border:"none",borderRadius:10,cursor:saving?"not-allowed":"pointer",fontSize:15,fontWeight:700}}>
        {saving?"Guardando...":"✓ Enviar medición"}
      </button>
    </div>
  );
}

function MiHistorial({ worker }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    const q = query(collection(db,"readings"),where("worker","==",worker),orderBy("createdAt","desc"));
    const unsub = onSnapshot(q,snap=>{setReadings(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},()=>setLoading(false));
    return()=>{unsub();rangosUnsub();};
  },[worker,weeklyRangos]);
  if(loading) return <div style={{textAlign:"center",padding:"2rem",color:"#aaa"}}>Cargando...</div>;
  if(!readings.length) return <div style={{textAlign:"center",padding:"2rem",color:"#aaa"}}><div style={{fontSize:36,marginBottom:8}}>📋</div><div>Aún no tienes registros</div></div>;
  return (
    <div>
      <div style={{fontSize:13,color:"#777",marginBottom:12}}>Tus últimos <strong style={{color:"#333"}}>{readings.length}</strong> registros</div>
      {readings.map(r=>{
        const c=CROPS[r.crop]; if(!c) return null;
        const ps=getStatus(r.ph,c.ph),cs=getStatus(r.ce,c.ce);
        const status=ps==="danger"||cs==="danger"?"danger":ps==="warning"||cs==="warning"?"warning":"ok";
        const sC={danger:"#e74c3c",warning:"#f39c12",ok:"#27ae60"}[status];
        return (
          <div key={r.id} style={{background:"#fff",border:`1px solid ${sC}33`,borderLeft:`4px solid ${sC}`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:20}}>{c.emoji}</span>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:c.color}}>{c.name} — {r.zone}</div><div style={{fontSize:11,color:"#aaa"}}>{r.date} {r.time}</div></div>
              <div style={{background:{danger:"#fdedec",warning:"#fef9e7",ok:"#eafaf1"}[status],borderRadius:8,padding:"6px 10px",textAlign:"center"}}>
                <div style={{fontFamily:"'Courier New',monospace",fontSize:13,fontWeight:700,color:sC}}>pH {r.ph} · CE {r.ce}</div>
                <div style={{fontSize:10,color:sC}}>{status==="ok"?"✓ Normal":status==="warning"?"⚠ Alerta":"✗ Crítico"}</div>
              </div>
            </div>
            {r.notes&&<div style={{fontSize:12,color:"#e67e22",marginTop:6}}>📝 {r.notes}</div>}
            {r.photoURL&&<img src={r.photoURL} alt="" style={{width:"100%",maxHeight:140,objectFit:"cover",borderRadius:6,marginTop:8}}/>}
          </div>
        );
      })}
    </div>
  );
}

// ─── COSECHA / VENTA / VALIDACIÓN ─────────────────────────────────────────────
// ─── COSECHA / VENTA / VALIDACIÓN / MERMA ─────────────────────────────────────
function RegistroCosecha({ worker }) {
  const [subtab, setSubtab] = useState("cosecha");
  const [lotes, setLotes] = useState([]);
  const [ventasW, setVentasW] = useState([]);
  const [cosechasW, setCosechasW] = useState([]);
  const [preciosSugeridos, setPreciosSugeridos] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  const [formC, setFormC] = useState({ loteId:"", kgCosechados:"", calidad:"primera", notas:"" });
  const [formV, setFormV] = useState({ loteId:"", comprador:"", canal:"Mercado local", calidad:"primera", kgVendidos:"", precioKg:"", factura:"", notas:"", fecha:new Date().toISOString().slice(0,10) });
  const [formVL, setFormVL] = useState({ loteId:"", etiqueta:"", kgValidados:"", precioVenta:"", observaciones:"", fecha:new Date().toISOString().slice(0,10) });
  const [formSiniestro, setFormSiniestro] = useState({ loteId:"", kgSiniestro:"", montoSeguro:"", evento:"granizo", notas:"", fecha:new Date().toISOString().slice(0,10) });
  const [formMerma, setFormMerma] = useState({ loteId:"", kgMerma:"", causa:"", notas:"", fecha:new Date().toISOString().slice(0,10) });

  const CANALES_W = ["Mercado local","Central de abastos","Supermercado","Restaurante","Exportación","Venta directa","Agroindustria","Otro"];

  useEffect(()=>{
    const q = query(collection(db,"lotes"),orderBy("createdAt","desc"));
    const unsub = onSnapshot(q,snap=>setLotes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2 = onSnapshot(query(collection(db,"ventas")), s=>setVentasW(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u3 = onSnapshot(query(collection(db,"cosechas_trabajador")), s=>setCosechasW(s.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{ unsub(); u2(); u3(); };
  },[]);

  useEffect(()=>{
    const unsub = onSnapshot(doc(db,"config","precios"),snap=>{ if(snap.exists()) setPreciosSugeridos(snap.data()); });
    return()=>unsub();
  },[]);

  const getLote = id => lotes.find(l=>l.id===id);
  const getPrecio = (crop,calidad) => preciosSugeridos[crop]?.[calidad]||null;

  const LoteSelector = ({ value, onChange }) => (
    <div style={{marginBottom:16}}>
      <label style={LBL}>Lote de producción *</label>
      {!lotes.length
        ? <div style={{background:"#f5f5f5",borderRadius:10,padding:14,textAlign:"center",color:"#aaa",fontSize:13,border:"1px solid #eee"}}>El encargado aún no ha creado lotes</div>
        : lotes.map(lote => {
            const c=CROPS[lote.crop]; const sel=value===lote.id;
            return (
              <button key={lote.id} onClick={()=>onChange(lote.id)}
                style={{width:"100%",padding:"12px 14px",marginBottom:8,border:`2px solid ${sel?"#27ae60":"#ddd"}`,borderRadius:12,background:sel?"#eafaf1":"#fff",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:22}}>{c?.emoji||"🌱"}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,color:sel?"#27ae60":"#222"}}>{lote.nombre}</div>
                  <div style={{fontSize:11,color:"#888"}}>{c?.name} · {lote.zona}</div>
                  {(()=>{
                    const kgVen = (ventasW||[]).filter(x=>x.loteId===lote.id).reduce((s,x)=>s+(parseFloat(x.kgVendidos)||0),0);
                    const kgCosTrab = (cosechasW||[]).filter(x=>x.loteId===lote.id).reduce((s,x)=>s+(parseFloat(x.kgCosechados)||0),0);
                    const kgCos = kgCosTrab > 0 ? kgCosTrab : (parseFloat(lote.kgCosechados)||0);
                    const stock = Math.max(0, kgCos - kgVen);
                    return (
                      <div style={{display:"flex",gap:8,marginTop:4,fontSize:10,flexWrap:"wrap"}}>
                        <span style={{background:"#eafaf1",color:"#27ae60",padding:"2px 6px",borderRadius:6,fontWeight:600}}>📦 {stock.toFixed(1)} kg disp.</span>
                        <span style={{color:"#aaa"}}>Cos: {kgCos.toFixed(1)} kg · Vend: {kgVen.toFixed(1)} kg</span>
                      </div>
                    );
                  })()}
                </div>
                {sel&&<span style={{color:"#27ae60",fontSize:20,fontWeight:700}}>✓</span>}
              </button>
            );
          })
      }
    </div>
  );

  const CalidadSelector = ({ value, onChange }) => (
    <div style={{marginBottom:16}}>
      <label style={LBL}>Calidad del producto</label>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {CALIDADES.map(c=>(
          <button key={c.id} onClick={()=>onChange(c.id)}
            style={{padding:"10px 8px",border:`2px solid ${value===c.id?c.color:"#ddd"}`,borderRadius:12,background:value===c.id?c.color+"18":"#fff",cursor:"pointer",textAlign:"center"}}>
            <div style={{fontSize:20,marginBottom:3}}>{c.icon}</div>
            <div style={{fontWeight:600,fontSize:12,color:value===c.id?c.color:"#444"}}>{c.label}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const submitCosecha = async () => {
    if (!formC.loteId||!formC.kgCosechados) { alert("Selecciona lote y escribe los kg"); return; }
    setSaving(true);
    try {
      const lote=getLote(formC.loteId); const now=new Date();
      await addDoc(collection(db,"cosechas_trabajador"),{
        ...formC,kgCosechados:parseFloat(formC.kgCosechados),worker,
        date:now.toISOString().slice(0,10),time:now.toTimeString().slice(0,5),
        createdAt:now.toISOString(),loteName:lote?.nombre||"",crop:lote?.crop||"",
        zona:lote?.zona||"", invernadero:lote?.zona||"",
        tratamiento:lote?.tratamiento||"",
      });
      setSaved("cosecha"); setFormC({loteId:"",kgCosechados:"",calidad:"primera",notas:""});
      setTimeout(()=>setSaved(""),4000);
    } catch(e) { alert("Error: "+e.message); }
    setSaving(false);
  };

  const submitVenta = async () => {
    if (!formV.comprador||!formV.kgVendidos||!formV.precioKg) { alert("Llena comprador, kg y precio"); return; }
    setSaving(true);
    try {
      const lote=getLote(formV.loteId);
      const kg=parseFloat(formV.kgVendidos)||0;
      const precio=parseFloat(formV.precioKg)||0;
      const now=new Date();
      await addDoc(collection(db,"ventas"),{
        ...formV,kgVendidos:kg,precioKg:precio,totalVenta:parseFloat((kg*precio).toFixed(2)),
        worker,cropName:CROPS[lote?.crop||""]?.name||"",loteName:lote?.nombre||"",
        tratamiento:lote?.tratamiento||"",crop:lote?.crop||"",
        date:formV.fecha,createdAt:now.toISOString(),
      });
      setSaved("venta");
      setFormV({loteId:"",comprador:"",canal:"Mercado local",calidad:"primera",kgVendidos:"",precioKg:"",factura:"",notas:"",fecha:new Date().toISOString().slice(0,10)});
      setTimeout(()=>setSaved(""),4000);
    } catch(e) { alert("Error: "+e.message); }
    setSaving(false);
  };

  const submitValidacion = async () => {
    if (!formVL.loteId||!formVL.kgValidados||!formVL.etiqueta) { alert("Selecciona lote, etiqueta y kg"); return; }
    setSaving(true);
    try {
      const lote=getLote(formVL.loteId); const now=new Date();
      await addDoc(collection(db,"validaciones_tratamiento"),{
        ...formVL,kgValidados:parseFloat(formVL.kgValidados)||0,
        precioVenta:parseFloat(formVL.precioVenta)||0,
        etiquetaTratamiento:formVL.etiqueta,
        worker,date:now.toISOString().slice(0,10),time:now.toTimeString().slice(0,5),
        createdAt:now.toISOString(),loteName:lote?.nombre||"",
        crop:lote?.crop||"",tratamiento:lote?.tratamiento||"",zona:lote?.zona||"",
      });
      setSaved("validacion");
      setFormVL({loteId:"",etiqueta:"",kgValidados:"",precioVenta:"",observaciones:"",fecha:now.toISOString().slice(0,10)});
      setTimeout(()=>setSaved(""),4000);
    } catch(e) { alert("Error: "+e.message); }
    setSaving(false);
  };

  const submitMerma = async () => {
    if (!formMerma.loteId||!formMerma.kgMerma) { alert("Selecciona lote y escribe los kg de merma"); return; }
    setSaving(true);
    try {
      const lote=getLote(formMerma.loteId); const now=new Date();
      await addDoc(collection(db,"mermas"),{
        ...formMerma,kgMerma:parseFloat(formMerma.kgMerma)||0,
        worker,date:now.toISOString().slice(0,10),time:now.toTimeString().slice(0,5),
        createdAt:now.toISOString(),loteName:lote?.nombre||"",
        crop:lote?.crop||"",zona:lote?.zona||"",
      });
      setSaved("merma");
      setFormMerma({loteId:"",kgMerma:"",causa:"",notas:"",fecha:now.toISOString().slice(0,10)});
      setTimeout(()=>setSaved(""),4000);
    } catch(e) { alert("Error: "+e.message); }
    setSaving(false);
  };

  const submitSiniestro = async () => {
    if (!formSiniestro.loteId||!formSiniestro.kgSiniestro||!formSiniestro.montoSeguro) { alert("Llena lote, kg siniestrados y monto del seguro"); return; }
    setSaving(true);
    try {
      const lote=getLote(formSiniestro.loteId); const now=new Date();
      await addDoc(collection(db,"siniestros"),{
        ...formSiniestro,
        kgSiniestro:parseFloat(formSiniestro.kgSiniestro)||0,
        montoSeguro:parseFloat(formSiniestro.montoSeguro)||0,
        worker,date:now.toISOString().slice(0,10),time:now.toTimeString().slice(0,5),
        createdAt:now.toISOString(),loteName:lote?.nombre||"",
        crop:lote?.crop||"",zona:lote?.zona||"",
      });
      setSaved("siniestro");
      setFormSiniestro({loteId:"",kgSiniestro:"",montoSeguro:"",evento:"granizo",notas:"",fecha:now.toISOString().slice(0,10)});
      setTimeout(()=>setSaved(""),4000);
    } catch(e) { alert("Error: "+e.message); }
    setSaving(false);
  };

  return (
    <div>
      {saved==="cosecha"&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:12,marginBottom:12,color:"#27ae60",fontWeight:600,textAlign:"center"}}>🧺 Cosecha registrada</div>}
      {saved==="venta"&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:12,marginBottom:12,color:"#27ae60",fontWeight:600,textAlign:"center"}}>💰 Venta registrada</div>}
      {saved==="validacion"&&<div style={{background:"#eaf4fb",border:"1px solid #b5d4f4",borderRadius:10,padding:12,marginBottom:12,color:"#1a5276",fontWeight:600,textAlign:"center"}}>✓ Validación registrada</div>}
      {saved==="siniestro"&&<div style={{background:"#eaf4fb",border:"1px solid #5dade2",borderRadius:10,padding:12,marginBottom:16,color:"#1f618d",fontWeight:600,textAlign:"center"}}>🌩 Siniestro registrado — el seguro lo cubre</div>}
      {saved==="merma"&&<div style={{background:"#fef9e7",border:"1px solid #f39c1244",borderRadius:10,padding:12,marginBottom:12,color:"#f39c12",fontWeight:600,textAlign:"center"}}>⚠ Merma registrada</div>}

      <div style={{display:"flex",gap:4,marginBottom:16,background:"#ebebeb",borderRadius:12,padding:4}}>
        {[["cosecha","🧺 Cosecha"],["venta","💰 Venta"],["validacion","🏷️ Validar"],["merma","⚠ Merma"],["siniestro","🌩 Siniestro"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSubtab(k)}
            style={{flex:1,padding:"10px 4px",border:"none",borderRadius:10,background:subtab===k?"#27ae60":"transparent",color:subtab===k?"#fff":"#555",cursor:"pointer",fontSize:12,fontWeight:subtab===k?700:500}}>
            {l}
          </button>
        ))}
      </div>

      {subtab==="cosecha"&&(
        <div>
          <LoteSelector value={formC.loteId} onChange={v=>setFormC(p=>({...p,loteId:v}))}/>
          {formC.loteId&&(
            <>
              <div style={{marginBottom:16}}>
                <label style={LBL}>Kg cosechados hoy *</label>
                <input type="number" step="0.1" min="0" value={formC.kgCosechados}
                  onChange={e=>setFormC(p=>({...p,kgCosechados:e.target.value}))} placeholder="Ej: 45.5"
                  style={{...INP,fontSize:24,fontWeight:700,textAlign:"center",fontFamily:"'Courier New',monospace"}}/>
              </div>
              <CalidadSelector value={formC.calidad} onChange={v=>setFormC(p=>({...p,calidad:v}))}/>
              <div style={{marginBottom:16}}>
                <label style={LBL}>Observaciones</label>
                <textarea value={formC.notas} onChange={e=>setFormC(p=>({...p,notas:e.target.value}))}
                  placeholder="Estado del producto..." style={{...INP,minHeight:70,resize:"vertical"}}/>
              </div>
              <button onClick={submitCosecha} disabled={saving}
                style={{width:"100%",padding:14,background:saving?"#aaa":"#27ae60",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
                {saving?"Guardando...":"🧺 Registrar cosecha del día"}
              </button>
            </>
          )}
        </div>
      )}

      {subtab==="venta"&&(
        <div>
          <LoteSelector value={formV.loteId} onChange={v=>setFormV(p=>({...p,loteId:v}))}/>
          <div style={{marginBottom:16}}>
            <label style={LBL}>Comprador / Cliente *</label>
            <input value={formV.comprador} onChange={e=>setFormV(p=>({...p,comprador:e.target.value}))} placeholder="Nombre del comprador" style={INP}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={LBL}>Canal de venta</label>
            <select value={formV.canal} onChange={e=>setFormV(p=>({...p,canal:e.target.value}))} style={INP}>
              {CANALES_W.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <CalidadSelector value={formV.calidad} onChange={v=>{
            const lote=getLote(formV.loteId);
            const sug=lote?getPrecio(lote.crop,v):null;
            setFormV(p=>({...p,calidad:v,...(sug?{precioKg:sug}:{})}));
          }}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8}}>
            <div>
              <label style={LBL}>Kg vendidos *</label>
              <input type="number" step="0.1" min="0" value={formV.kgVendidos}
                onChange={e=>setFormV(p=>({...p,kgVendidos:e.target.value}))} placeholder="0.0"
                style={{...INP,textAlign:"center",fontFamily:"'Courier New',monospace",fontWeight:700}}/>
            </div>
            <div>
              <label style={LBL}>
                Precio $/kg *
                {(()=>{const lote=getLote(formV.loteId);const sug=lote?getPrecio(lote.crop,formV.calidad):null;return sug?<span style={{color:"#27ae60",fontWeight:700,fontSize:10,marginLeft:3,cursor:"pointer"}} onClick={()=>setFormV(p=>({...p,precioKg:sug}))}>· ${sug} sugerido ↵</span>:null;})()}
              </label>
              <input type="number" step="0.5" min="0" value={formV.precioKg}
                onChange={e=>setFormV(p=>({...p,precioKg:e.target.value}))} placeholder="0.00"
                style={{...INP,textAlign:"center",fontFamily:"'Courier New',monospace",fontWeight:700}}/>
            </div>
          </div>
          {parseFloat(formV.kgVendidos)>0&&parseFloat(formV.precioKg)>0&&(
            <div style={{background:"#eafaf1",border:"2px solid #a9dfbf",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:14,color:"#2e7d5a",fontWeight:600}}>Total esta venta:</span>
              <span style={{fontFamily:"'Courier New',monospace",fontSize:22,fontWeight:700,color:"#27ae60"}}>${(parseFloat(formV.kgVendidos)*parseFloat(formV.precioKg)).toFixed(2)}</span>
            </div>
          )}
          <div style={{marginBottom:16}}>
            <label style={LBL}>Fecha</label>
            <input type="date" value={formV.fecha} onChange={e=>setFormV(p=>({...p,fecha:e.target.value}))} style={INP}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={LBL}>Folio / Remisión</label>
            <input value={formV.factura} onChange={e=>setFormV(p=>({...p,factura:e.target.value}))} placeholder="Núm. de factura o remisión" style={INP}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={LBL}>Notas</label>
            <textarea value={formV.notas} onChange={e=>setFormV(p=>({...p,notas:e.target.value}))}
              placeholder="Condiciones, observaciones..." style={{...INP,minHeight:60,resize:"vertical"}}/>
          </div>
          <button onClick={submitVenta} disabled={saving}
            style={{width:"100%",padding:15,background:saving?"#aaa":"#27ae60",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
            {saving?"Guardando...":"💰 Registrar venta"}
          </button>
        </div>
      )}

      {subtab==="validacion"&&(
        <div>
          <div style={{background:"#eaf4fb",border:"1px solid #b5d4f4",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#1a5276"}}>
            🏷️ Confirma el tratamiento del producto antes de que salga de la unidad
          </div>
          <LoteSelector value={formVL.loteId} onChange={v=>setFormVL(p=>({...p,loteId:v}))}/>
          {formVL.loteId&&(()=>{
            const lote=getLote(formVL.loteId);
            const crop=CROPS[lote?.crop];
            if(!lote) return null;
            return (
              <>
                <div style={{background:"#fff",border:"2px solid #2980b9",borderRadius:12,padding:16,marginBottom:16,textAlign:"center"}}>
                  <div style={{fontSize:10,color:"#aaa",letterSpacing:1,marginBottom:4,fontFamily:"'Courier New',monospace"}}>ETIQUETA DEL PRODUCTO</div>
                  <div style={{fontSize:28,marginBottom:2}}>{crop?.emoji||"🌱"}</div>
                  <div style={{fontWeight:700,fontSize:16,color:crop?.color||"#333",marginBottom:2}}>{crop?.name||""}</div>
                  <div style={{fontSize:13,color:"#555",marginBottom:6}}>{lote?.zona}</div>
                  <div style={{display:"inline-block",background:"#2980b9",color:"#fff",borderRadius:20,padding:"4px 18px",fontWeight:700,fontSize:14,minWidth:100}}>
                    {formVL.etiqueta||"—"}
                  </div>
                  {formVL.kgValidados>0&&<div style={{fontSize:12,color:"#27ae60",fontWeight:700,marginTop:6}}>{formVL.kgValidados} kg</div>}
                </div>
                <div style={{marginBottom:16}}>
                  <label style={LBL}>Nombre del producto / tratamiento *</label>
                  <input value={formVL.etiqueta} onChange={e=>setFormVL(p=>({...p,etiqueta:e.target.value}))}
                    placeholder="Ej: Confidor 350 SC, Ridomil Gold..." style={INP}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                  <div>
                    <label style={LBL}>Kg validados *</label>
                    <input type="number" step="0.1" min="0" value={formVL.kgValidados}
                      onChange={e=>setFormVL(p=>({...p,kgValidados:e.target.value}))} placeholder="0.0"
                      style={{...INP,textAlign:"center",fontFamily:"'Courier New',monospace",fontWeight:700}}/>
                  </div>
                  <div>
                    <label style={LBL}>Precio venta $/kg</label>
                    <input type="number" step="0.5" min="0" value={formVL.precioVenta}
                      onChange={e=>setFormVL(p=>({...p,precioVenta:e.target.value}))} placeholder="0.00"
                      style={{...INP,textAlign:"center",fontFamily:"'Courier New',monospace",fontWeight:700}}/>
                  </div>
                </div>
                <div style={{marginBottom:16}}>
                  <label style={LBL}>Observaciones</label>
                  <textarea value={formVL.observaciones} onChange={e=>setFormVL(p=>({...p,observaciones:e.target.value}))}
                    placeholder="Estado del producto, destino..." style={{...INP,minHeight:60,resize:"vertical"}}/>
                </div>
                <button onClick={submitValidacion} disabled={saving}
                  style={{width:"100%",padding:15,background:saving?"#aaa":"#2980b9",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
                  {saving?"Guardando...":"🏷️ Confirmar validación"}
                </button>
              </>
            );
          })()}
        </div>
      )}

      {subtab==="merma"&&(
        <div>
          <div style={{background:"#fef9e7",border:"1px solid #f39c1244",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#856404"}}>
            ⚠ Registra el producto que no se puede vender — merma, desperdicio o pérdida del día
          </div>
          <LoteSelector value={formMerma.loteId} onChange={v=>setFormMerma(p=>({...p,loteId:v}))}/>
          {formMerma.loteId&&(
            <>
              <div style={{marginBottom:16}}>
                <label style={LBL}>Kg de merma *</label>
                <input type="number" step="0.1" min="0" value={formMerma.kgMerma}
                  onChange={e=>setFormMerma(p=>({...p,kgMerma:e.target.value}))} placeholder="Ej: 3.5 kg"
                  style={{...INP,fontSize:22,fontWeight:700,textAlign:"center",fontFamily:"'Courier New',monospace"}}/>
              </div>
              <div style={{marginBottom:16}}>
                <label style={LBL}>Causa de la merma</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {["Plaga o enfermedad","Daño mecánico","Sobremadurez","Calibre fuera","Pudrición","Otra causa"].map(causa=>(
                    <button key={causa} onClick={()=>setFormMerma(p=>({...p,causa}))}
                      style={{padding:"10px 8px",border:`1.5px solid ${formMerma.causa===causa?"#f39c12":"#ddd"}`,borderRadius:10,background:formMerma.causa===causa?"#fef9e7":"#fff",cursor:"pointer",fontSize:12,fontWeight:formMerma.causa===causa?700:400,color:formMerma.causa===causa?"#f39c12":"#555",textAlign:"left"}}>
                      {causa}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <label style={LBL}>Fecha</label>
                <input type="date" value={formMerma.fecha} onChange={e=>setFormMerma(p=>({...p,fecha:e.target.value}))} style={INP}/>
              </div>
              <div style={{marginBottom:16}}>
                <label style={LBL}>Notas adicionales</label>
                <textarea value={formMerma.notas} onChange={e=>setFormMerma(p=>({...p,notas:e.target.value}))}
                  placeholder="Descripción detallada..." style={{...INP,minHeight:60,resize:"vertical"}}/>
              </div>
              <button onClick={submitMerma} disabled={saving}
                style={{width:"100%",padding:15,background:saving?"#aaa":"#f39c12",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
                {saving?"Guardando...":"⚠ Registrar merma"}
              </button>
            </>
          )}
        </div>
      )}

      {subtab==="siniestro"&&(
        <div>
          <div style={{background:"#eaf4fb",border:"1px solid #5dade2",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#1f618d"}}>
            🌩 Registra producto siniestrado por granizo u otro evento climático que el seguro pagará. Estos kg <strong>sí cuentan</strong> como producción y el monto del seguro <strong>se suma a ingresos</strong>.
          </div>
          <LoteSelector value={formSiniestro.loteId} onChange={id=>setFormSiniestro(p=>({...p,loteId:id}))}/>
          {formSiniestro.loteId&&(()=>{
            const lote=getLote(formSiniestro.loteId);
            if(!lote) return null;
            return(
              <>
                <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:16,marginBottom:14}}>
                  <div style={{fontSize:11,color:"#888",marginBottom:4}}>Lote seleccionado</div>
                  <div style={{fontWeight:700,color:"#1f618d"}}>{lote.nombre}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                  <div>
                    <label style={LBL}>Kg siniestrados *</label>
                    <input type="number" step="0.1" min="0" value={formSiniestro.kgSiniestro}
                      onChange={e=>setFormSiniestro(p=>({...p,kgSiniestro:e.target.value}))}
                      placeholder="Ej: 45.5" style={{...INP,fontSize:18,fontWeight:700,color:"#1f618d"}}/>
                  </div>
                  <div>
                    <label style={LBL}>💰 Monto seguro $ *</label>
                    <input type="number" step="0.01" min="0" value={formSiniestro.montoSeguro}
                      onChange={e=>setFormSiniestro(p=>({...p,montoSeguro:e.target.value}))}
                      placeholder="Ej: 4500" style={{...INP,fontSize:18,fontWeight:700,color:"#27ae60"}}/>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={LBL}>Tipo de evento *</label>
                  <select value={formSiniestro.evento} onChange={e=>setFormSiniestro(p=>({...p,evento:e.target.value}))} style={INP}>
                    <option value="granizo">🌩 Granizo</option>
                    <option value="helada">❄️ Helada</option>
                    <option value="viento">💨 Viento fuerte</option>
                    <option value="inundacion">🌊 Inundación</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={LBL}>📅 Fecha del siniestro</label>
                  <input type="date" value={formSiniestro.fecha}
                    onChange={e=>setFormSiniestro(p=>({...p,fecha:e.target.value}))} style={INP}/>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={LBL}>Notas</label>
                  <textarea value={formSiniestro.notas} onChange={e=>setFormSiniestro(p=>({...p,notas:e.target.value}))}
                    placeholder="Folio de seguro, descripción del evento..."
                    style={{...INP,minHeight:60,fontFamily:"inherit",resize:"vertical"}}/>
                </div>
                <button onClick={submitSiniestro} disabled={saving}
                  style={{width:"100%",background:saving?"#aaa":"#2980b9",color:"#fff",border:"none",borderRadius:10,padding:"14px",fontSize:16,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
                  {saving?"Guardando...":"🌩 Registrar siniestro"}
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function Tareas({ worker }) {
  const [tasks, setTasks] = useState([]);
  const today = new Date().toISOString().slice(0,10);
  useEffect(()=>{
    const q = query(collection(db,"tasks"),orderBy("fechaCreacion","desc"));
    const unsub = onSnapshot(q,snap=>setTasks(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>unsub();
  },[]);

  const mine = tasks.filter(t=>{
    const asig = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
    if(asig.includes("todos")||asig.length===0) return true;
    return asig.includes(worker);
  });
  const done = mine.filter(t=>t.completedBy?.includes(worker));
  const pending = mine.filter(t=>!t.completedBy?.includes(worker));

  const mark = async t => {
    const completed = [...(t.completedBy||[])];
    if(!completed.includes(worker)) completed.push(worker);
    await updateDoc(doc(db,"tasks",t.id),{completedBy:completed,completedAt:new Date().toISOString()});
  };

  const renderTask = (t,isCompleted=false) => {
    const tipoIcon = {tarea:"📋",instruccion:"📖",aviso:"📢"}[t.tipo||"tarea"];
    const priColor = {alta:"#e74c3c",baja:"#27ae60",normal:"#888"}[t.priority||"normal"];
    const isOverdue = t.fechaLimite && t.fechaLimite < today && !isCompleted;
    return (
      <div key={t.id} style={{background:isCompleted?"#f9f9f9":"#fff",border:`1px solid ${isOverdue?"#e74c3c44":"#e0e0e0"}`,borderLeft:`4px solid ${priColor}`,borderRadius:10,padding:"12px 14px",marginBottom:10,opacity:isCompleted?0.7:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:"#222"}}>
              {tipoIcon} {t.title}
              {t.priority==="alta"&&<span style={{background:"#fdedec",color:"#c0392b",fontSize:9,padding:"2px 5px",borderRadius:6,marginLeft:6,fontWeight:700}}>ALTA</span>}
              {isOverdue&&<span style={{background:"#fdedec",color:"#c0392b",fontSize:9,padding:"2px 5px",borderRadius:6,marginLeft:6,fontWeight:700}}>⏰ VENCIDA</span>}
            </div>
            {t.description&&<div style={{fontSize:13,color:"#555",lineHeight:1.5,marginBottom:8,whiteSpace:"pre-wrap",padding:"8px 10px",background:"#fafafa",borderRadius:6,borderLeft:"2px solid #e0e0e0"}}>{t.description}</div>}
            <div style={{display:"flex",gap:10,fontSize:11,color:"#888",flexWrap:"wrap"}}>
              {t.zone&&<span>📍 {t.zone}</span>}
              <span>📅 {t.fechaCreacion||t.date||"—"}</span>
              {t.fechaLimite&&<span style={{color:isOverdue?"#c0392b":"#888",fontWeight:isOverdue?700:400}}>⏰ Límite: {t.fechaLimite}</span>}
            </div>
          </div>
        </div>
        {!isCompleted && <button onClick={()=>mark(t)} style={{width:"100%",padding:"10px 14px",background:"#27ae60",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>✓ Marcar como completada</button>}
        {isCompleted && <div style={{textAlign:"center",fontSize:11,color:"#27ae60",fontWeight:600}}>✓ Completada por ti</div>}
      </div>
    );
  };

  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <div style={{flex:1,background:"#fef9e7",borderRadius:10,padding:12,textAlign:"center"}}>
          <div style={{fontSize:24,fontWeight:700,color:"#f39c12"}}>{pending.length}</div>
          <div style={{fontSize:11,color:"#aaa"}}>Pendientes</div>
        </div>
        <div style={{flex:1,background:"#eafaf1",borderRadius:10,padding:12,textAlign:"center"}}>
          <div style={{fontSize:24,fontWeight:700,color:"#27ae60"}}>{done.length}</div>
          <div style={{fontSize:11,color:"#aaa"}}>Completadas</div>
        </div>
      </div>
      {!mine.length&&<div style={{textAlign:"center",padding:"2rem",color:"#aaa"}}><div style={{fontSize:36,marginBottom:8}}>✅</div><div>Sin tareas asignadas</div></div>}
      {pending.map(t=>renderTask(t,false))}
      {done.length>0&&<div style={{fontSize:11,color:"#aaa",margin:"16px 0 8px",letterSpacing:0.3}}>COMPLETADAS</div>}
      {done.map(t=>renderTask(t,true))}
    </div>
  );
}
function GuiaSintomas() {
  const [crop,setCrop]=useState("jitomate");
  const [sel,setSel]=useState(null);
  return (
    <div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {Object.entries(CROPS).map(([k,c])=>(
          <button key={k} onClick={()=>{setCrop(k);setSel(null);}} style={{padding:"8px 14px",border:`1.5px solid ${crop===k?c.color:"#e0e0e0"}`,borderRadius:20,background:crop===k?c.color+"18":"transparent",color:crop===k?c.color:"#888",cursor:"pointer",fontSize:13,fontWeight:crop===k?700:400}}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>
      {(SYMPTOMS[crop]||[]).map((s,i)=>(
        <div key={i} onClick={()=>setSel(sel===i?null:i)} style={{background:"#fff",border:`1px solid ${SEV_COLOR[s.severity]}44`,borderLeft:`4px solid ${SEV_COLOR[s.severity]}`,borderRadius:10,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:24}}>{s.icon}</span>
            <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{s.name}</div><span style={{background:SEV_BG[s.severity],color:SEV_COLOR[s.severity],borderRadius:10,padding:"1px 8px",fontSize:10,fontWeight:600}}>Severidad {s.severity}</span></div>
            <span style={{fontSize:12,color:"#ccc"}}>{sel===i?"▲":"▼"}</span>
          </div>
          {sel===i&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #f0f0f0"}}>
              <div style={{marginBottom:8}}><div style={{fontSize:11,color:"#e74c3c",fontWeight:700,marginBottom:2}}>CAUSA</div><div style={{fontSize:13,color:"#555"}}>{s.cause}</div></div>
              <div><div style={{fontSize:11,color:"#27ae60",fontWeight:700,marginBottom:2}}>QUÉ HACER</div><div style={{fontSize:13,color:"#333",background:"#f0faf5",borderRadius:6,padding:"8px 10px"}}>{s.action}</div></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── INCIDENCIAS ───────────────────────────────────────────────────────────────
function Incidencias({ worker }) {
  const [form,setForm]=useState({type:"plaga",zone:"Zona 1",description:"",crop:"jitomate"});
  const [imgFile,setImgFile]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const fileRef=useRef();
  const TYPES=[{id:"plaga",label:"🦗 Plaga"},{id:"enfermedad",label:"🍂 Enfermedad"},{id:"equipo",label:"⚙️ Equipo"},{id:"clima",label:"🌡️ Clima"},{id:"otro",label:"📋 Otro"}];
  const handleImage=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>setImgPreview(ev.target.result);r.readAsDataURL(file);setImgFile(file);};
  const submit=async()=>{
    if(!form.zone||!form.description){alert("Llena zona y descripción.");return;}
    setSaving(true); let photoURL="";
    try{
      if(imgFile){const st=getStorage();const r=sRef(st,`incidencias/${Date.now()}_${imgFile.name}`);await uploadBytes(r,imgFile);photoURL=await getDownloadURL(r);}
      const now=new Date();
      await addDoc(collection(db,"incidencias"),{...form,worker,date:now.toISOString().slice(0,10),time:now.toTimeString().slice(0,5),createdAt:now.toISOString(),status:"pendiente",photoURL});
      setSaved(true);setForm({type:"plaga",zone:"",description:"",crop:"jitomate"});setImgFile(null);setImgPreview(null);
      setTimeout(()=>setSaved(false),4000);
    }catch{alert("Error al enviar.");}
    setSaving(false);
  };
  return (
    <div>
      {saved&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:12,marginBottom:16,color:"#27ae60",fontWeight:600,textAlign:"center"}}>✓ Incidencia reportada</div>}
      <div style={{marginBottom:14}}>
        <label style={LBL}>Tipo</label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {TYPES.map(t=>(<button key={t.id} onClick={()=>setForm(p=>({...p,type:t.id}))} style={{padding:"10px 8px",border:`1.5px solid ${form.type===t.id?"#27ae60":"#e0e0e0"}`,borderRadius:8,background:form.type===t.id?"#eafaf1":"transparent",color:form.type===t.id?"#27ae60":"#666",cursor:"pointer",fontSize:12,fontWeight:form.type===t.id?700:400,textAlign:"left"}}>{t.label}</button>))}
        </div>
      </div>
      <div style={{marginBottom:12}}><label style={LBL}>Cultivo afectado</label><select value={form.crop} onChange={e=>setForm(p=>({...p,crop:e.target.value}))} style={INP}>{Object.entries(CROPS).map(([k,c])=><option key={k} value={k}>{c.emoji} {c.name}</option>)}</select></div>
      <div style={{marginBottom:12}}><label style={LBL}>Zona *</label>
          <select value={form.zone} onChange={e=>setForm(p=>({...p,zone:e.target.value}))} style={INP}>
            <option value="">Selecciona zona</option>
            {["Zona 1","Zona 2","Zona 3","Zona 4"].map(z=><option key={z} value={z}>{z}</option>)}
          </select></div>
      <div style={{marginBottom:14}}><label style={LBL}>Descripción *</label><textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Describe lo que ves..." style={{...INP,minHeight:90,resize:"vertical"}}/></div>
      <div style={{marginBottom:16}}>
        <label style={LBL}>Foto</label>
        <div onClick={()=>fileRef.current.click()} style={{border:"2px dashed #f39c1244",borderRadius:10,padding:imgPreview?"0":"1.5rem",textAlign:"center",cursor:"pointer",overflow:"hidden",background:"#fefdf9"}}>
          {imgPreview?<img src={imgPreview} alt="" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:8,display:"block"}}/>:<div><div style={{fontSize:32,marginBottom:6}}>📸</div><div style={{color:"#aaa",fontSize:13}}>Toca para tomar foto</div></div>}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleImage}/>
        </div>
      </div>
      <button onClick={submit} disabled={saving} style={{width:"100%",padding:14,background:saving?"#aaa":"#e74c3c",color:"#fff",border:"none",borderRadius:10,cursor:saving?"not-allowed":"pointer",fontSize:15,fontWeight:700}}>{saving?"Enviando...":"⚠ Reportar incidencia"}</button>
    </div>
  );
}

// ─── INSTRUCCIONES DEL DÍA ────────────────────────────────────────────────────
function InstruccionesDia() {
  const [data,setData]=useState([]);
  const today=new Date().toISOString().slice(0,10);
  useEffect(()=>{
    const q=query(collection(db,"instrucciones"),where("date","==",today));
    const unsub=onSnapshot(q,snap=>setData(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>unsub();
  },[today]);
  if(!data.length) return <div style={{textAlign:"center",padding:"3rem",color:"#aaa"}}><div style={{fontSize:40,marginBottom:8}}>📋</div><div style={{fontWeight:500,marginBottom:4}}>Sin instrucciones por hoy</div><div style={{fontSize:12}}>El encargado publicará las instrucciones aquí</div></div>;
  return (
    <div>
      {data.map(inst=>(
        <div key={inst.id} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:16,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:10,borderBottom:"1px solid #f0f0f0"}}>
            <span style={{fontSize:20}}>{CROPS[inst.crop]?.emoji||"🌿"}</span>
            <div><div style={{fontWeight:700,fontSize:14}}>{inst.title}</div><div style={{fontSize:11,color:"#aaa"}}>{inst.zone||"Todas"} · {inst.volume||"—"} L</div></div>
          </div>
          {inst.steps?.map((step,i)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:"#27ae60",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,fontSize:13,color:"#333",paddingTop:3}}>{step}</div>
            </div>
          ))}
          {inst.notes&&<div style={{marginTop:10,background:"#fefdf0",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#7d6608",border:"1px solid #f9e79f"}}>📝 {inst.notes}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── ASISTENTE IA ──────────────────────────────────────────────────────────────
const SUGERENCIAS = [
  "¿Por qué se ponen amarillas las hojas del jitomate?",
  "¿Qué hago si el pH está muy alto?",
  "¿Cómo identifico la mosca blanca?",
];

function AsistenteIA() {
  const [messages, setMessages] = useState([
    { role:"assistant", content:"¡Hola! Soy tu asistente agrónomo 🌿\n\nPuedo ayudarte con:\n• Diagnóstico de plantas (sube una foto 📸)\n• Análisis de suelo (sube un PDF 📄)\n• Cualquier duda sobre tus cultivos 💬\n\nEscríbeme o adjunta lo que quieras analizar." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState(null); // {base64, type, name, preview}
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, loading]);

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    
    if (file.type.startsWith("image/")) {
      // Imagen: redimensionar a max 1024px
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX = 1024;
          let nw = img.width, nh = img.height;
          if (nw > MAX || nh > MAX) {
            if (nw > nh) { nh = Math.round(nh * MAX / nw); nw = MAX; }
            else { nw = Math.round(nw * MAX / nh); nh = MAX; }
          }
          canvas.width = nw; canvas.height = nh;
          canvas.getContext("2d").drawImage(img, 0, 0, nw, nh);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          setAttachment({
            base64: dataUrl.split(",")[1],
            type: "image/jpeg",
            name: file.name,
            preview: dataUrl,
            kind: "image",
          });
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    } else if (file.type === "application/pdf") {
      reader.onload = ev => {
        setAttachment({
          base64: ev.target.result.split(",")[1],
          type: "application/pdf",
          name: file.name,
          preview: null,
          kind: "pdf",
        });
      };
      reader.readAsDataURL(file);
    } else {
      alert("Solo imágenes (JPG, PNG) o PDF son válidos.");
    }
    e.target.value = ""; // permitir re-seleccionar mismo archivo
  };

  const removeAttachment = () => setAttachment(null);

  const send = async () => {
    const userMsg = input.trim();
    if (!userMsg && !attachment) return;

    setInput(""); setLoading(true);
    
    // Texto descriptivo según lo que adjunte
    const descripcionAuto = attachment?.kind === "image"
      ? "Analiza esta foto de la planta y dime qué problema tiene."
      : attachment?.kind === "pdf"
        ? "Interpreta este documento (análisis de suelo, ficha técnica u otro) y dame recomendaciones."
        : "";

    const contenidoFinal = userMsg || descripcionAuto;
    const newMsg = { role:"user", content: contenidoFinal, _attachment: attachment };
    const updated = [...messages, newMsg];
    setMessages(updated);

    try {
      const body = {
        messages: updated.slice(-8).map(m => ({ role:m.role, content:m.content })),
      };
      if (attachment?.kind === "image") {
        body.imgBase64 = attachment.base64;
        body.imgType = attachment.type;
      } else if (attachment?.kind === "pdf") {
        body.fileBase64 = attachment.base64;
        body.fileType = attachment.type;
        body.fileName = attachment.name;
      }

      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setMessages(p => [...p, { role:"assistant", content: data.response || data.text || "Sin respuesta" }]);
      setAttachment(null);
    } catch (e) {
      setMessages(p => [...p, { role:"assistant", content: "❌ Error: " + e.message }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)"}}>
      {/* Mensajes */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingBottom:8}}>
        {messages.map((msg, i) => (
          <div key={i} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"85%",background:msg.role==="user"?"#27ae60":"#fff",color:msg.role==="user"?"#fff":"#333",borderRadius:msg.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"10px 14px",fontSize:13,lineHeight:1.5,whiteSpace:"pre-wrap",boxShadow:msg.role==="assistant"?"0 1px 2px rgba(0,0,0,0.05)":"none",border:msg.role==="assistant"?"1px solid #eee":"none"}}>
              {msg._attachment?.kind === "image" && msg._attachment.preview && (
                <img src={msg._attachment.preview} alt="" style={{maxWidth:"100%",borderRadius:10,marginBottom:6,maxHeight:200,objectFit:"cover"}}/>
              )}
              {msg._attachment?.kind === "pdf" && (
                <div style={{background:"#fff2",borderRadius:8,padding:"6px 10px",marginBottom:6,fontSize:11,display:"flex",alignItems:"center",gap:6}}>
                  📄 {msg._attachment.name}
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{display:"flex",justifyContent:"flex-start"}}>
            <div style={{background:"#fff",border:"1px solid #eee",borderRadius:"18px 18px 18px 4px",padding:"10px 14px",fontSize:13,color:"#888"}}>
              ⏳ Analizando...
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Preview del adjunto antes de enviar */}
      {attachment && (
        <div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:"8px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
          {attachment.kind === "image" ? (
            <img src={attachment.preview} alt="" style={{width:46,height:46,objectFit:"cover",borderRadius:6}}/>
          ) : (
            <div style={{width:46,height:46,background:"#fff",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>📄</div>
          )}
          <div style={{flex:1,fontSize:12,color:"#27ae60",fontWeight:600}}>
            {attachment.kind === "image" ? "📸 Foto lista para analizar" : `📄 ${attachment.name}`}
          </div>
          <button onClick={removeAttachment} style={{background:"transparent",border:"none",fontSize:18,cursor:"pointer",color:"#888"}}>✕</button>
        </div>
      )}

      {/* Input */}
      <div style={{display:"flex",gap:6,alignItems:"flex-end",padding:"8px 0",borderTop:"1px solid #eee"}}>
        <button onClick={()=>fileRef.current?.click()} disabled={loading}
          style={{padding:"10px 14px",border:"1.5px solid #27ae60",borderRadius:"50%",background:"#fff",cursor:loading?"wait":"pointer",fontSize:18,flexShrink:0,width:42,height:42,display:"flex",alignItems:"center",justifyContent:"center"}}
          title="Adjuntar foto o PDF">📎</button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" onChange={handleFile} style={{display:"none"}}/>
        
        <textarea
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={attachment ? "Pregunta algo sobre el archivo (opcional)..." : "Escribe tu pregunta o adjunta una foto/PDF..."}
          disabled={loading}
          style={{flex:1,padding:"10px 14px",border:"1.5px solid #ddd",borderRadius:20,fontSize:13,resize:"none",fontFamily:"inherit",maxHeight:100,minHeight:42,background:"#fff",color:"#111",WebkitTextFillColor:"#111",colorScheme:"light",outline:"none"}}/>
        
        <button onClick={send} disabled={loading || (!input.trim() && !attachment)}
          style={{padding:"10px 16px",border:"none",borderRadius:"50%",background:(loading||(!input.trim()&&!attachment))?"#aaa":"#27ae60",color:"#fff",cursor:(loading||(!input.trim()&&!attachment))?"not-allowed":"pointer",fontSize:18,flexShrink:0,width:42,height:42,display:"flex",alignItems:"center",justifyContent:"center"}}>➤</button>
      </div>
    </div>
  );
}


// ─── INDICADOR DE CONEXIÓN ───────────────────────────────────────────────────
function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const [showSyncToast, setShowSyncToast] = useState(false);

  useEffect(()=>{
    const handleOnline  = () => { 
      setIsOnline(true); 
      setShowSyncToast(true);
      setTimeout(()=>setShowSyncToast(false), 4000);
    };
    const handleOffline = () => { 
      setIsOnline(false); 
      setShowOfflineToast(true);
      setTimeout(()=>setShowOfflineToast(false), 5000);
    };
    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Solo mostrar el badge si está offline
  if(isOnline && !showSyncToast) return null;

  return (
    <>
      {/* Banner permanente cuando está offline */}
      {!isOnline && (
        <div style={{position:"fixed",top:0,left:0,right:0,background:"#f39c12",color:"#fff",textAlign:"center",padding:"6px 12px",fontSize:12,fontWeight:600,zIndex:1000,boxShadow:"0 2px 4px rgba(0,0,0,0.1)"}}>
          📴 Sin conexión — tus datos se guardarán y enviarán al recuperar señal
        </div>
      )}
      {/* Toast al volver online */}
      {showSyncToast && (
        <div style={{position:"fixed",top:10,right:10,background:"#27ae60",color:"#fff",padding:"10px 16px",borderRadius:10,fontSize:12,fontWeight:600,zIndex:1001,boxShadow:"0 2px 8px rgba(0,0,0,0.15)",animation:"fadeIn 0.3s"}}>
          ✓ Conexión restaurada — sincronizando...
        </div>
      )}
      {/* Toast inicial al perder conexión */}
      {showOfflineToast && isOnline === false && (
        <div style={{position:"fixed",top:40,right:10,background:"#e74c3c",color:"#fff",padding:"10px 16px",borderRadius:10,fontSize:12,fontWeight:600,zIndex:1001,boxShadow:"0 2px 8px rgba(0,0,0,0.15)",maxWidth:280}}>
          📴 Sin conexión detectada
        </div>
      )}
    </>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Worker({ user, onLogout }) {
  const workerName = user?.nombre || user?.email || "Trabajador";
  const [tab, setTab] = useState("registrar");

  const TABS = [
    { id:"registrar", label:"📊 Registrar", emoji:"📊" },
    { id:"cosecha",   label:"🧺 Cosecha",   emoji:"🧺" },
    { id:"tareas",    label:"✅ Tareas",    emoji:"✅" },
    { id:"ia",        label:"🤖 IA",        emoji:"🤖" },
    { id:"incidencia",label:"⚠️ Incidencia",emoji:"⚠️" },
    { id:"info",      label:"📋 Info",      emoji:"📋" },
  ];

  const renderTab = () => {
    switch(tab) {
      case "registrar":  return <Registro worker={workerName} />;
      case "cosecha":    return <RegistroCosecha worker={workerName} />;
      case "tareas":     return <Tareas worker={workerName} />;
      case "ia":         return <AsistenteIA />;
      case "incidencia": return <Incidencias worker={workerName} />;
      case "info":       return <InstruccionesDia />;
      default:           return <Registro worker={workerName} />;
    }
  };

  return (
    <div style={{minHeight:"100vh",background:"#fafafa",paddingBottom:80}}>
      <ConnectionStatus/>
      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid #e0e0e0",padding:"12px 16px",position:"sticky",top:0,zIndex:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:"#27ae60"}}>🌿 GreenLog</div>
          <div style={{fontSize:11,color:"#888"}}>👤 {workerName}</div>
        </div>
        <button onClick={async()=>{ try{ await signOut(auth); onLogout?.(); }catch(e){ console.error(e); } }}
          style={{background:"transparent",border:"1px solid #ddd",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,color:"#888"}}>
          Salir
        </button>
      </div>

      {/* Contenido */}
      <div style={{padding:"16px"}}>
        {renderTab()}
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"1px solid #e0e0e0",display:"flex",justifyContent:"space-around",padding:"6px 0",boxShadow:"0 -2px 8px rgba(0,0,0,0.05)",zIndex:10}}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,background:"transparent",border:"none",padding:"6px 2px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:tab===t.id?"#27ae60":"#888"}}>
            <span style={{fontSize:20}}>{t.emoji}</span>
            <span style={{fontSize:9,fontWeight:tab===t.id?700:400}}>{t.label.replace(t.emoji,"").trim()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
