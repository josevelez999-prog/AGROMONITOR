import { useState, useRef, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, onSnapshot, query, where, orderBy, updateDoc, doc } from "firebase/firestore";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";

const CROPS = {
  jitomate:  { name:"Jitomate",  emoji:"🍅", color:"#c0392b", ph:{min:5.5,max:6.5}, ce:{min:2.5,max:4.0} },
  fresa:     { name:"Fresa",     emoji:"🍓", color:"#e74c3c", ph:{min:5.5,max:6.5}, ce:{min:1.0,max:2.0} },
  arandano:  { name:"Arándano",  emoji:"🫐", color:"#2980b9", ph:{min:4.5,max:5.5}, ce:{min:1.0,max:2.0} },
  zarzamora: { name:"Zarzamora", emoji:"🫐", color:"#8e44ad", ph:{min:5.5,max:6.5}, ce:{min:1.5,max:2.5} },
};

const SYMPTOMS = {
  jitomate: [
    { name:"Hojas amarillas (clorosis)", icon:"🟡", cause:"Deficiencia de Fe o pH muy alto — bloquea absorción", action:"Bajar pH a 5.8–6.2, aplicar Fe quelado foliar", severity:"alta" },
    { name:"Punta de hoja café", icon:"🟤", cause:"Deficiencia de Ca o exceso de sales (CE alta)", action:"Bajar CE, revisar aireación de raíz", severity:"alta" },
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
    { name:"Insectos en brotes nuevos", icon:"🟢", cause:"Pulgones (áfidos)", action:"Aplicar jabón potásico, revisar ventilación", severity:"media" },
  ],
  arandano: [
    { name:"Toda la hoja amarilla", icon:"🟡", cause:"pH demasiado alto — bloquea todos los nutrientes", action:"Bajar pH a 4.5–5.5 urgente con H₂SO₄ o azufre", severity:"alta" },
    { name:"Quemadura en puntas", icon:"🔥", cause:"Exceso de sales, CE muy alta", action:"Renovar solución, bajar CE a rango correcto", severity:"media" },
    { name:"Crecimiento muy lento", icon:"🐌", cause:"Deficiencia de N o pH incorrecto", action:"Verificar pH y aumentar N amoniacal en fórmula", severity:"media" },
    { name:"Manchas rojas en hojas", icon:"🔴", cause:"Antracnosis o estrés por frío", action:"Aplicar fungicida cúprico, proteger de heladas", severity:"alta" },
  ],
  zarzamora: [
    { name:"Puntos naranjas en hojas", icon:"🟠", cause:"Roya (hongo)", action:"Aplicar fungicida sistémico, mejorar ventilación", severity:"alta" },
    { name:"Hojas pequeñas y amarillas", icon:"🟡", cause:"Deficiencia de Fe o Mn", action:"Revisar pH, aplicar quelatos foliares", severity:"media" },
    { name:"Frutos duros sin madurar", icon:"⚫", cause:"Deficiencia de K o Ca", action:"Aumentar K en fase de maduración", severity:"media" },
    { name:"Manchas oscuras en tallos", icon:"🟫", cause:"Botrytis o cancro bacteriano", action:"Podar partes afectadas, aplicar fungicida cúprico", severity:"alta" },
  ],
};

const SEV_COLOR = { alta:"#e74c3c", media:"#f39c12", baja:"#27ae60" };
const SEV_BG    = { alta:"#fdedec", media:"#fef9e7", baja:"#eafaf1" };

function getStatus(v, r) {
  if (v < r.min || v > r.max) return "danger";
  const m = (r.max - r.min) * 0.15;
  return (v < r.min + m || v > r.max - m) ? "warning" : "ok";
}

const inp = { width:"100%", padding:"12px 14px", border:"1px solid #e0e0e0", borderRadius:8, fontSize:16, boxSizing:"border-box", background:"#ffffff", color:"#222222", WebkitTextFillColor:"#222222" };
const lbl = { fontSize:11, color:"#888", marginBottom:4, display:"block", textTransform:"uppercase", letterSpacing:0.3, fontFamily:"'Courier New',monospace" };

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [name, setName] = useState("");
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f0faf5,#f4f5f7)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#fff",borderRadius:16,padding:32,maxWidth:360,width:"100%",boxShadow:"0 4px 24px #0001",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:8}}>🌿</div>
        <div style={{fontWeight:700,fontSize:24,color:"#27ae60",marginBottom:4}}>GreenLog</div>
        <div style={{fontSize:13,color:"#aaa",marginBottom:28}}>Portal de trabajadores</div>
        <label style={{...lbl,textAlign:"left"}}>Tu nombre</label>
        <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&onLogin(name.trim())} placeholder="Ej: Carlos García" style={{...inp,marginBottom:16,fontSize:15}}/>
        <button onClick={()=>name.trim()&&onLogin(name.trim())} disabled={!name.trim()} style={{width:"100%",padding:13,background:name.trim()?"#27ae60":"#d5e8d4",color:"#fff",border:"none",borderRadius:10,cursor:name.trim()?"pointer":"not-allowed",fontSize:15,fontWeight:700}}>
          Entrar
        </button>
      </div>
    </div>
  );
}

// ─── REGISTRO ──────────────────────────────────────────────────────────────────
function Registro({ worker }) {
  const [form, setForm] = useState({ crop:"jitomate", zone:"", ph:"", ce:"", notes:"" });
  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();
  const crop = CROPS[form.crop];

  const handleImage = e => {
    const file = e.target.files[0]; if (!file) return;
    setImgFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!form.zone || !form.ph || !form.ce) { alert("Llena zona, pH y CE."); return; }
    setSaving(true);
    let photoURL = "";
    try {
      if (imgFile) {
        const st = getStorage();
        const r = sRef(st, `photos/${Date.now()}_${imgFile.name}`);
        await uploadBytes(r, imgFile);
        photoURL = await getDownloadURL(r);
      }
      const now = new Date();
      await addDoc(collection(db,"readings"), {
        ...form, worker,
        ph:parseFloat(form.ph), ce:parseFloat(form.ce),
        date:now.toISOString().slice(0,10),
        time:now.toTimeString().slice(0,5),
        createdAt:now.toISOString(), photoURL,
      });
      setSaved(true);
      setForm({ crop:"jitomate", zone:"", ph:"", ce:"", notes:"" });
      setImgFile(null); setImgPreview(null);
      setTimeout(()=>setSaved(false),4000);
    } catch { alert("Error al guardar. Verifica tu conexión."); }
    setSaving(false);
  };

  return (
    <div>
      {saved&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:"12px",marginBottom:16,color:"#27ae60",fontWeight:600,textAlign:"center"}}>✓ Medición enviada al encargado</div>}
      <div style={{marginBottom:14}}>
        <label style={lbl}>Cultivo</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {Object.entries(CROPS).map(([k,c])=>(
            <button key={k} onClick={()=>setForm(p=>({...p,crop:k}))} style={{padding:"8px 14px",border:`1.5px solid ${form.crop===k?c.color:"#e0e0e0"}`,borderRadius:20,background:form.crop===k?c.color+"15":"transparent",color:form.crop===k?c.color:"#888",cursor:"pointer",fontSize:13,fontWeight:form.crop===k?700:400}}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>
      <div style={{background:"#f9fff9",borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:11,color:"#888",border:`1px solid ${crop.color}22`}}>
        pH ideal: <strong style={{color:crop.color}}>{crop.ph.min}–{crop.ph.max}</strong> · CE ideal: <strong style={{color:crop.color}}>{crop.ce.min}–{crop.ce.max} mS/cm</strong>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div style={{gridColumn:"1/-1"}}>
          <label style={lbl}>Zona / Área *</label>
          <input value={form.zone} onChange={e=>setForm(p=>({...p,zone:e.target.value}))} placeholder="Ej: Zona A" style={inp}/>
        </div>
        <div>
          <label style={lbl}>pH medido *</label>
          <input type="number" step="0.1" min="0" max="14" value={form.ph} onChange={e=>setForm(p=>({...p,ph:e.target.value}))} placeholder="6.2"
            style={{...inp,borderColor:form.ph?(getStatus(parseFloat(form.ph),crop.ph)==="danger"?"#e74c3c":getStatus(parseFloat(form.ph),crop.ph)==="warning"?"#f39c12":"#27ae60"):"#e0e0e0"}}/>
          {form.ph&&<div style={{fontSize:10,marginTop:3,color:getStatus(parseFloat(form.ph),crop.ph)==="danger"?"#e74c3c":getStatus(parseFloat(form.ph),crop.ph)==="warning"?"#f39c12":"#27ae60"}}>
            {getStatus(parseFloat(form.ph),crop.ph)==="danger"?"⚠ Fuera de rango — avisa al encargado":getStatus(parseFloat(form.ph),crop.ph)==="warning"?"⚠ Cerca del límite":"✓ Normal"}
          </div>}
        </div>
        <div>
          <label style={lbl}>CE mS/cm *</label>
          <input type="number" step="0.1" min="0" max="10" value={form.ce} onChange={e=>setForm(p=>({...p,ce:e.target.value}))} placeholder="2.8"
            style={{...inp,borderColor:form.ce?(getStatus(parseFloat(form.ce),crop.ce)==="danger"?"#e74c3c":getStatus(parseFloat(form.ce),crop.ce)==="warning"?"#f39c12":"#27ae60"):"#e0e0e0"}}/>
          {form.ce&&<div style={{fontSize:10,marginTop:3,color:getStatus(parseFloat(form.ce),crop.ce)==="danger"?"#e74c3c":getStatus(parseFloat(form.ce),crop.ce)==="warning"?"#f39c12":"#27ae60"}}>
            {getStatus(parseFloat(form.ce),crop.ce)==="danger"?"⚠ Fuera de rango":getStatus(parseFloat(form.ce),crop.ce)==="warning"?"⚠ Cerca del límite":"✓ Normal"}
          </div>}
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <label style={lbl}>Observaciones (opcional)</label>
          <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Hojas amarillas, planta decaída..." style={{...inp,minHeight:72,resize:"vertical"}}/>
        </div>
      </div>
      <div style={{marginBottom:16}}>
        <label style={lbl}>Foto de la planta (opcional)</label>
        <div onClick={()=>fileRef.current.click()} style={{border:"2px dashed #d5e8d4",borderRadius:10,padding:imgPreview?"0":"1.5rem",textAlign:"center",cursor:"pointer",overflow:"hidden",background:"#f9fff9"}}>
          {imgPreview
            ?<div style={{position:"relative"}}><img src={imgPreview} alt="" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:8,display:"block"}}/><div style={{position:"absolute",top:8,right:8,background:"#fff",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#27ae60",fontWeight:600}}>✓ Lista</div></div>
            :<div><div style={{fontSize:32,marginBottom:6}}>📸</div><div style={{color:"#aaa",fontSize:13}}>Toca para subir o tomar foto</div></div>}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleImage}/>
        </div>
        {imgPreview&&<button onClick={()=>{setImgFile(null);setImgPreview(null);}} style={{width:"100%",marginTop:6,padding:6,border:"1px solid #e0e0e0",borderRadius:8,background:"transparent",color:"#aaa",cursor:"pointer",fontSize:12}}>Quitar foto</button>}
      </div>
      <button onClick={submit} disabled={saving} style={{width:"100%",padding:14,background:saving?"#a8d5b5":"#27ae60",color:"#fff",border:"none",borderRadius:10,cursor:saving?"not-allowed":"pointer",fontSize:15,fontWeight:700}}>
        {saving?"Guardando...":"✓ Enviar medición"}
      </button>
    </div>
  );
}

// ─── MI HISTORIAL ─────────────────────────────────────────────────────────────
function MiHistorial({ worker }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    const q = query(collection(db,"readings"),where("worker","==",worker),orderBy("createdAt","desc"));
    const unsub = onSnapshot(q,snap=>{setReadings(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},()=>setLoading(false));
    return()=>unsub();
  },[worker]);
  if(loading) return <div style={{textAlign:"center",padding:"2rem",color:"#aaa"}}>Cargando...</div>;
  if(!readings.length) return <div style={{textAlign:"center",padding:"2rem",color:"#aaa"}}><div style={{fontSize:36,marginBottom:8}}>📋</div><div>Aún no tienes registros</div></div>;
  return (
    <div>
      <div style={{fontSize:13,color:"#888",marginBottom:12}}>Tus últimos <strong style={{color:"#333"}}>{readings.length}</strong> registros</div>
      {readings.map(r=>{
        const c=CROPS[r.crop]; if(!c) return null;
        const ps=getStatus(r.ph,c.ph),cs=getStatus(r.ce,c.ce);
        const status=ps==="danger"||cs==="danger"?"danger":ps==="warning"||cs==="warning"?"warning":"ok";
        const sC={danger:"#e74c3c",warning:"#f39c12",ok:"#27ae60"}[status];
        const sB={danger:"#fdedec",warning:"#fef9e7",ok:"#eafaf1"}[status];
        return (
          <div key={r.id} style={{background:"#fff",border:`1px solid ${sC}33`,borderLeft:`4px solid ${sC}`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:20}}>{c.emoji}</span>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:c.color}}>{c.name} — {r.zone}</div><div style={{fontSize:11,color:"#aaa"}}>{r.date} {r.time}</div></div>
              <div style={{background:sB,border:`1px solid ${sC}44`,borderRadius:8,padding:"6px 10px",textAlign:"center"}}>
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

// ─── TAREAS ────────────────────────────────────────────────────────────────────
function Tareas({ worker }) {
  const [tasks, setTasks] = useState([]);
  const today = new Date().toISOString().slice(0,10);
  useEffect(()=>{
    const q = query(collection(db,"tasks"),where("date","==",today));
    const unsub = onSnapshot(q,snap=>setTasks(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>unsub();
  },[today]);
  const myTasks = tasks.filter(t=>!t.assignedTo||t.assignedTo===worker||t.assignedTo==="todos");
  const done = myTasks.filter(t=>t.completedBy?.includes(worker));
  const pending = myTasks.filter(t=>!t.completedBy?.includes(worker));
  const markDone = async t => {
    const completed=[...(t.completedBy||[])];
    if(!completed.includes(worker)) completed.push(worker);
    await updateDoc(doc(db,"tasks",t.id),{completedBy:completed});
  };
  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <div style={{flex:1,background:"#eafaf1",borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:24,fontWeight:700,color:"#27ae60"}}>{done.length}</div><div style={{fontSize:11,color:"#aaa"}}>Completadas</div></div>
        <div style={{flex:1,background:"#fef9e7",borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:24,fontWeight:700,color:"#f39c12"}}>{pending.length}</div><div style={{fontSize:11,color:"#aaa"}}>Pendientes</div></div>
      </div>
      {!myTasks.length&&<div style={{textAlign:"center",padding:"2rem",color:"#aaa"}}><div style={{fontSize:36,marginBottom:8}}>✅</div><div>Sin tareas para hoy</div></div>}
      {pending.map(t=>(
        <div key={t.id} style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{t.title}</div>
            {t.description&&<div style={{fontSize:12,color:"#888"}}>{t.description}</div>}
            {t.zone&&<div style={{fontSize:11,color:"#aaa",marginTop:2}}>📍 {t.zone}</div>}
          </div>
          <button onClick={()=>markDone(t)} style={{padding:"8px 14px",background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:8,color:"#27ae60",cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0}}>✓ Listo</button>
        </div>
      ))}
      {done.map(t=>(
        <div key={t.id} style={{background:"#f9f9f9",border:"1px solid #e0e0e0",borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10,opacity:0.6}}>
          <span style={{color:"#27ae60",fontSize:18}}>✓</span>
          <div style={{fontWeight:500,fontSize:13,textDecoration:"line-through",color:"#888"}}>{t.title}</div>
        </div>
      ))}
    </div>
  );
}

// ─── GUÍA SÍNTOMAS ─────────────────────────────────────────────────────────────
function GuiaSintomas() {
  const [crop,setCrop]=useState("jitomate");
  const [sel,setSel]=useState(null);
  return (
    <div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {Object.entries(CROPS).map(([k,c])=>(
          <button key={k} onClick={()=>{setCrop(k);setSel(null);}} style={{padding:"8px 14px",border:`1.5px solid ${crop===k?c.color:"#e0e0e0"}`,borderRadius:20,background:crop===k?c.color+"15":"transparent",color:crop===k?c.color:"#888",cursor:"pointer",fontSize:13,fontWeight:crop===k?700:400}}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>
      {(SYMPTOMS[crop]||[]).map((s,i)=>(
        <div key={i} onClick={()=>setSel(sel===i?null:i)} style={{background:"#fff",border:`1px solid ${SEV_COLOR[s.severity]}44`,borderLeft:`4px solid ${SEV_COLOR[s.severity]}`,borderRadius:10,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:24}}>{s.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{s.name}</div>
              <span style={{background:SEV_BG[s.severity],color:SEV_COLOR[s.severity],borderRadius:10,padding:"1px 8px",fontSize:10,fontWeight:600}}>Severidad {s.severity}</span>
            </div>
            <span style={{fontSize:12,color:"#ccc"}}>{sel===i?"▲":"▼"}</span>
          </div>
          {sel===i&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #f0f0f0"}}>
              <div style={{marginBottom:8}}><div style={{fontSize:11,color:"#e74c3c",fontWeight:700,marginBottom:2}}>CAUSA PROBABLE</div><div style={{fontSize:13,color:"#555"}}>{s.cause}</div></div>
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
  const [form,setForm]=useState({type:"plaga",zone:"",description:"",crop:"jitomate"});
  const [imgFile,setImgFile]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const fileRef=useRef();
  const TYPES=[{id:"plaga",label:"🦗 Plaga"},{id:"enfermedad",label:"🍂 Enfermedad"},{id:"equipo",label:"⚙️ Equipo"},{id:"clima",label:"🌡️ Clima"},{id:"otro",label:"📋 Otro"}];
  const handleImage=e=>{const file=e.target.files[0];if(!file)return;setImgFile(file);const r=new FileReader();r.onload=ev=>setImgPreview(ev.target.result);r.readAsDataURL(file);};
  const submit=async()=>{
    if(!form.zone||!form.description){alert("Llena zona y descripción.");return;}
    setSaving(true);
    let photoURL="";
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
      {saved&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:12,marginBottom:16,color:"#27ae60",fontWeight:600,textAlign:"center"}}>✓ Incidencia reportada al encargado</div>}
      <div style={{marginBottom:14}}>
        <label style={lbl}>Tipo</label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {TYPES.map(t=>(
            <button key={t.id} onClick={()=>setForm(p=>({...p,type:t.id}))} style={{padding:"10px 8px",border:`1.5px solid ${form.type===t.id?"#27ae60":"#e0e0e0"}`,borderRadius:8,background:form.type===t.id?"#eafaf1":"transparent",color:form.type===t.id?"#27ae60":"#666",cursor:"pointer",fontSize:12,fontWeight:form.type===t.id?700:400,textAlign:"left"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={lbl}>Cultivo afectado</label>
        <select value={form.crop} onChange={e=>setForm(p=>({...p,crop:e.target.value}))} style={inp}>
          {Object.entries(CROPS).map(([k,c])=><option key={k} value={k}>{c.emoji} {c.name}</option>)}
        </select>
      </div>
      <div style={{marginBottom:12}}><label style={lbl}>Zona *</label><input value={form.zone} onChange={e=>setForm(p=>({...p,zone:e.target.value}))} placeholder="Zona A" style={inp}/></div>
      <div style={{marginBottom:14}}><label style={lbl}>Descripción *</label><textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Describe lo que ves con detalle..." style={{...inp,minHeight:90,resize:"vertical"}}/></div>
      <div style={{marginBottom:16}}>
        <label style={lbl}>Foto (muy recomendada)</label>
        <div onClick={()=>fileRef.current.click()} style={{border:"2px dashed #f39c1244",borderRadius:10,padding:imgPreview?"0":"1.5rem",textAlign:"center",cursor:"pointer",overflow:"hidden",background:"#fefdf9"}}>
          {imgPreview?<img src={imgPreview} alt="" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:8,display:"block"}}/>:<div><div style={{fontSize:32,marginBottom:6}}>📸</div><div style={{color:"#aaa",fontSize:13}}>Toca para tomar foto</div></div>}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleImage}/>
        </div>
      </div>
      <button onClick={submit} disabled={saving} style={{width:"100%",padding:14,background:saving?"#aaa":"#e74c3c",color:"#fff",border:"none",borderRadius:10,cursor:saving?"not-allowed":"pointer",fontSize:15,fontWeight:700}}>
        {saving?"Enviando...":"⚠ Reportar incidencia"}
      </button>
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
            <div>
              <div style={{fontWeight:700,fontSize:14}}>{inst.title}</div>
              <div style={{fontSize:11,color:"#aaa"}}>Para: {inst.zone||"Todas las zonas"} · Volumen: {inst.volume||"—"} L</div>
            </div>
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

// ─── MAIN WORKER ───────────────────────────────────────────────────────────────

// ─── REGISTRO DE COSECHA (trabajador) ────────────────────────────────────────
function RegistroCosecha({ worker }) {
  const [lotes, setLotes] = useState([]);
  const [form, setForm] = useState({ loteId:"", kgCosechados:"", calidad:"primera", notas:"" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const CALIDADES_W = [
    { id:"primera",  label:"Primera",  color:"#27ae60", icon:"⭐" },
    { id:"segunda",  label:"Segunda",  color:"#f39c12", icon:"⚡" },
    { id:"tercera",  label:"Tercera",  color:"#e67e22", icon:"▲"  },
    { id:"descarte", label:"Descarte", color:"#e74c3c", icon:"✕"  },
  ];

  const CROPS_W = {
    jitomate:{name:"Jitomate",emoji:"🍅",color:"#c0392b"},
    fresa:{name:"Fresa",emoji:"🍓",color:"#e74c3c"},
    arandano:{name:"Arándano",emoji:"🫐",color:"#2980b9"},
    zarzamora:{name:"Zarzamora",emoji:"🫐",color:"#8e44ad"},
  };

  useEffect(()=>{
    const q = query(collection(db,"lotes"),orderBy("createdAt","desc"));
    const unsub = onSnapshot(q,snap=>setLotes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>unsub();
  },[]);

  const loteSeleccionado = lotes.find(l=>l.id===form.loteId);

  const submit = async () => {
    if (!form.loteId || !form.kgCosechados) { alert("Selecciona lote y registra los kg"); return; }
    setSaving(true);
    try {
      const now = new Date();
      await addDoc(collection(db,"cosechas_trabajador"),{
        ...form,
        kgCosechados: parseFloat(form.kgCosechados),
        worker,
        date: now.toISOString().slice(0,10),
        time: now.toTimeString().slice(0,5),
        createdAt: now.toISOString(),
        loteName: loteSeleccionado?.nombre || "",
        crop: loteSeleccionado?.crop || "",
        tratamiento: loteSeleccionado?.tratamiento || "",
      });
      setSaved(true);
      setForm({ loteId:"", kgCosechados:"", calidad:"primera", notas:"" });
      setTimeout(()=>setSaved(false),4000);
    } catch { alert("Error al guardar"); }
    setSaving(false);
  };

  const inpW = { width:"100%", padding:"12px 14px", border:"1px solid #ddd", borderRadius:10, fontSize:16, boxSizing:"border-box", background:"#fff", color:"#222", WebkitTextFillColor:"#222" };

  return (
    <div style={{paddingBottom:16}}>
      {saved&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:12,marginBottom:16,color:"#27ae60",fontWeight:600,textAlign:"center"}}>✓ Cosecha registrada</div>}

      <div style={{marginBottom:14}}>
        <label style={{fontSize:11,color:"#888",marginBottom:6,display:"block",textTransform:"uppercase",letterSpacing:0.3,fontFamily:"'Courier New',monospace"}}>Lote de producción *</label>
        {!lotes.length ? (
          <div style={{background:"#f9f9f9",borderRadius:10,padding:14,textAlign:"center",color:"#aaa",fontSize:13}}>El encargado aún no ha creado lotes de producción</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {lotes.map(lote=>{
              const c = CROPS_W[lote.crop];
              const sel = form.loteId===lote.id;
              return (
                <button key={lote.id} onClick={()=>setForm(p=>({...p,loteId:lote.id}))}
                  style={{padding:"12px 14px",border:`2px solid ${sel?"#27ae60":"#e0e0e0"}`,borderRadius:12,background:sel?"#eafaf1":"#fff",cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:22}}>{c?.emoji||"🌱"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:14,color:sel?"#27ae60":"#333"}}>{lote.nombre}</div>
                      <div style={{fontSize:11,color:"#888"}}>{c?.name} · {lote.zona} · {lote.kgCosechados} kg cosechados</div>
                    </div>
                    {sel&&<span style={{color:"#27ae60",fontSize:18}}>✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {form.loteId && (
        <>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,color:"#888",marginBottom:6,display:"block",textTransform:"uppercase",letterSpacing:0.3,fontFamily:"'Courier New',monospace"}}>Kg cosechados hoy *</label>
            <input type="number" step="0.1" min="0" value={form.kgCosechados} onChange={e=>setForm(p=>({...p,kgCosechados:e.target.value}))} placeholder="Ej: 45.5" style={{...inpW,fontSize:22,fontWeight:700,textAlign:"center",fontFamily:"'Courier New',monospace"}}/>
          </div>

          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,color:"#888",marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.3,fontFamily:"'Courier New',monospace"}}>Calidad del producto</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {CALIDADES_W.map(c=>(
                <button key={c.id} onClick={()=>setForm(p=>({...p,calidad:c.id}))}
                  style={{padding:"12px",border:`2px solid ${form.calidad===c.id?c.color:"#e0e0e0"}`,borderRadius:12,background:form.calidad===c.id?c.color+"15":"#fff",cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:22,marginBottom:4}}>{c.icon}</div>
                  <div style={{fontWeight:600,fontSize:13,color:form.calidad===c.id?c.color:"#555"}}>{c.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:16}}>
            <label style={{fontSize:11,color:"#888",marginBottom:6,display:"block",textTransform:"uppercase",letterSpacing:0.3,fontFamily:"'Courier New',monospace"}}>Observaciones</label>
            <textarea value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} placeholder="Estado del producto, condiciones, etc." style={{...inpW,minHeight:70,resize:"vertical"}}/>
          </div>

          <button onClick={submit} disabled={saving} style={{width:"100%",padding:14,background:saving?"#a8d5b5":"#27ae60",color:"#fff",border:"none",borderRadius:12,cursor:saving?"not-allowed":"pointer",fontSize:16,fontWeight:700}}>
            {saving?"Guardando...":"🧺 Registrar cosecha"}
          </button>
        </>
      )}
    </div>
  );
}

const TABS=[
  {id:"registro",label:"Registrar",icon:"📊"},
  {id:"cosecha",label:"Cosecha",icon:"🧺"},
  {id:"tareas",label:"Tareas",icon:"✅"},
  {id:"asistente",label:"IA",icon:"🤖"},
  {id:"incidencias",label:"Incidencia",icon:"⚠️"},
  {id:"instrucciones",label:"Info",icon:"📋"},
];

export default function Worker() {
  const [worker,setWorker]=useState(()=>localStorage.getItem("gl_worker")||"");
  const [tab,setTab]=useState("registro");
  if(!worker) return <Login onLogin={n=>{localStorage.setItem("gl_worker",n);setWorker(n);}}/>;
  const CONTENT={registro:<Registro worker={worker}/>,historial:<MiHistorial worker={worker}/>,tareas:<Tareas worker={worker}/>,guia:<GuiaSintomas/>,cosecha:<RegistroCosecha worker={worker}/>,incidencias:<Incidencias worker={worker}/>,instrucciones:<InstruccionesDia/>};
  return (
    <div style={{minHeight:"100vh",background:"#f4f5f7",paddingBottom:76}}>
      <div style={{background:"#fff",borderBottom:"0.5px solid #e0e0e0",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:22}}>🌿</span>
          <div><div style={{fontWeight:700,color:"#27ae60",fontSize:16}}>GreenLog</div><div style={{fontSize:10,color:"#aaa",fontFamily:"'Courier New',monospace"}}>Hola, {worker}</div></div>
        </div>
        <button onClick={()=>{localStorage.removeItem("gl_worker");setWorker("");}} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:12}}>Salir</button>
      </div>
      <div style={{padding:"16px 16px 0"}}>{CONTENT[tab]}</div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"0.5px solid #e0e0e0",display:"flex",zIndex:10}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"8px 2px",border:"none",background:"transparent",color:tab===t.id?"#27ae60":"#bbb",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1,borderTop:tab===t.id?"2px solid #27ae60":"2px solid transparent"}}>
            <span style={{fontSize:16}}>{t.icon}</span>
            <span style={{fontSize:8,fontWeight:tab===t.id?700:400}}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
