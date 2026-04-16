import { useState, useRef, useEffect } from "react";
import { db, auth } from "./firebase";
import { collection, addDoc, onSnapshot, query, where, orderBy, doc } from "firebase/firestore";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";

const CROPS = {
  jitomate:  { name:"Jitomate",  emoji:"🍅", color:"#c0392b", ph:{min:5.5,max:6.5}, ce:{min:2.5,max:4.0} },
  fresa:     { name:"Fresa",     emoji:"🍓", color:"#e74c3c", ph:{min:5.5,max:6.5}, ce:{min:1.0,max:2.0} },
  arandano:  { name:"Arándano",  emoji:"🫐", color:"#2980b9", ph:{min:4.5,max:5.5}, ce:{min:1.0,max:2.0} },
  zarzamora: { name:"Zarzamora", emoji:"🫐", color:"#8e44ad", ph:{min:5.5,max:6.5}, ce:{min:1.5,max:2.5} },
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
  { id:"primera",  label:"Primera",  color:"#27ae60", icon:"⭐" },
  { id:"segunda",  label:"Segunda",  color:"#f39c12", icon:"⚡" },
  { id:"tercera",  label:"Tercera",  color:"#e67e22", icon:"▲"  },
  { id:"descarte", label:"Descarte", color:"#e74c3c", icon:"✕"  },
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


// ─── REGISTRO pH/CE ────────────────────────────────────────────────────────────
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
        const compressed = canvas.toDataURL("image/jpeg",0.75);
        setImgPreview(compressed);
        canvas.toBlob(blob=>setImgFile(new File([blob],file.name,{type:"image/jpeg"})),"image/jpeg",0.75);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!form.zone||!form.ph||!form.ce) { alert("Llena zona, pH y CE."); return; }
    setSaving(true);
    let photoURL = "";
    try {
      if (imgFile) {
        const st = getStorage();
        const r = sRef(st,`photos/${Date.now()}_${imgFile.name}`);
        await uploadBytes(r,imgFile); photoURL = await getDownloadURL(r);
      }
      const now = new Date();
      await addDoc(collection(db,"readings"),{
        ...form,worker,ph:parseFloat(form.ph),ce:parseFloat(form.ce),
        date:now.toISOString().slice(0,10),time:now.toTimeString().slice(0,5),
        createdAt:now.toISOString(),photoURL,
      });
      setSaved(true);
      setForm({crop:"jitomate",zone:"",ph:"",ce:"",notes:""});
      setImgFile(null);setImgPreview(null);
      setTimeout(()=>setSaved(false),4000);
    } catch { alert("Error al guardar."); }
    setSaving(false);
  };

  return (
    <div>
      {saved&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:12,marginBottom:16,color:"#27ae60",fontWeight:600,textAlign:"center"}}>✓ Medición enviada</div>}
      <div style={{marginBottom:14}}>
        <label style={LBL}>Cultivo</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {Object.entries(CROPS).map(([k,c])=>(
            <button key={k} onClick={()=>setForm(p=>({...p,crop:k}))}
              style={{padding:"8px 14px",border:`1.5px solid ${form.crop===k?c.color:"#e0e0e0"}`,borderRadius:20,background:form.crop===k?c.color+"18":"transparent",color:form.crop===k?c.color:"#777",cursor:"pointer",fontSize:13,fontWeight:form.crop===k?700:400}}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>
      <div style={{background:"#f0faf5",borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12,color:"#555",border:`1px solid ${crop.color}33`}}>
        pH ideal: <strong style={{color:crop.color}}>{crop.ph.min}–{crop.ph.max}</strong> · CE ideal: <strong style={{color:crop.color}}>{crop.ce.min}–{crop.ce.max} mS/cm</strong>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div style={{gridColumn:"1/-1"}}><label style={LBL}>Zona *</label><input value={form.zone} onChange={e=>setForm(p=>({...p,zone:e.target.value}))} placeholder="Ej: Zona A" style={INP}/></div>
        <div>
          <label style={LBL}>pH medido *</label>
          <input type="number" step="0.1" min="0" max="14" value={form.ph} onChange={e=>setForm(p=>({...p,ph:e.target.value}))} placeholder="6.2"
            style={{...INP,borderColor:form.ph?(getStatus(parseFloat(form.ph),crop.ph)==="danger"?"#e74c3c":getStatus(parseFloat(form.ph),crop.ph)==="warning"?"#f39c12":"#27ae60"):"#ccc"}}/>
          {form.ph&&<div style={{fontSize:10,marginTop:3,color:getStatus(parseFloat(form.ph),crop.ph)==="danger"?"#e74c3c":getStatus(parseFloat(form.ph),crop.ph)==="warning"?"#f39c12":"#27ae60"}}>
            {getStatus(parseFloat(form.ph),crop.ph)==="danger"?"⚠ Fuera de rango":getStatus(parseFloat(form.ph),crop.ph)==="warning"?"⚠ Cerca del límite":"✓ Normal"}
          </div>}
        </div>
        <div>
          <label style={LBL}>CE mS/cm *</label>
          <input type="number" step="0.1" min="0" max="10" value={form.ce} onChange={e=>setForm(p=>({...p,ce:e.target.value}))} placeholder="2.8"
            style={{...INP,borderColor:form.ce?(getStatus(parseFloat(form.ce),crop.ce)==="danger"?"#e74c3c":getStatus(parseFloat(form.ce),crop.ce)==="warning"?"#f39c12":"#27ae60"):"#ccc"}}/>
        </div>
        <div style={{gridColumn:"1/-1"}}><label style={LBL}>Observaciones</label><textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Hojas amarillas, planta decaída..." style={{...INP,minHeight:72,resize:"vertical"}}/></div>
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
function RegistroCosecha({ worker }) {
  const [lotes, setLotes] = useState([]);
  const [preciosSugeridos, setPreciosSugeridos] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  const [formC, setFormC] = useState({ loteId:"", kgCosechados:"", calidad:"primera", notas:"" });
  const [formV, setFormV] = useState({ loteId:"", comprador:"", canal:"Mercado local", calidad:"primera", kgVendidos:"", precioKg:"", factura:"", notas:"", fecha:new Date().toISOString().slice(0,10) });
  const [formVL, setFormVL] = useState({ loteId:"", etiqueta:"", kgValidados:"", precioVenta:"", observaciones:"", fecha:new Date().toISOString().slice(0,10) });

  useEffect(()=>{
    const q = query(collection(db,"lotes"),orderBy("createdAt","desc"));
    const unsub = onSnapshot(q,snap=>setLotes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>unsub();
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
        : lotes.map(lote=>{
            const c=CROPS[lote.crop]; const sel=value===lote.id;
            return (
              <button key={lote.id} onClick={()=>onChange(lote.id)}
                style={{width:"100%",padding:"12px 14px",marginBottom:8,border:`2px solid ${sel?"#27ae60":"#ddd"}`,borderRadius:12,background:sel?"#eafaf1":"#fff",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:22}}>{c?.emoji||"🌱"}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,color:sel?"#27ae60":"#222"}}>{lote.nombre}</div>
                  <div style={{fontSize:11,color:"#888"}}>{c?.name} · {lote.zona}</div>
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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {CALIDADES.map(c=>(
          <button key={c.id} onClick={()=>onChange(c.id)}
            style={{padding:"12px 8px",border:`2px solid ${value===c.id?c.color:"#ddd"}`,borderRadius:12,background:value===c.id?c.color+"18":"#fff",cursor:"pointer",textAlign:"center"}}>
            <div style={{fontSize:22,marginBottom:3}}>{c.icon}</div>
            <div style={{fontWeight:600,fontSize:13,color:value===c.id?c.color:"#444"}}>{c.label}</div>
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
        createdAt:now.toISOString(),loteName:lote?.nombre||"",crop:lote?.crop||"",tratamiento:lote?.tratamiento||"",
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
    if (!formVL.loteId||!formVL.kgValidados||!formVL.etiqueta) { alert("Selecciona lote, escribe la etiqueta y los kg"); return; }
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

  return (
    <div>
      {saved==="cosecha"&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:12,marginBottom:12,color:"#27ae60",fontWeight:600,textAlign:"center"}}>🧺 Cosecha registrada — aparece en el panel del encargado</div>}
      {saved==="venta"&&<div style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:10,padding:12,marginBottom:12,color:"#27ae60",fontWeight:600,textAlign:"center"}}>💰 Venta registrada — aparece en el panel del encargado</div>}


      {/* ── COSECHA ── */}
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px",marginBottom:20}}>
        <div style={{fontSize:12,fontWeight:700,color:"#27ae60",marginBottom:14,letterSpacing:0.3,display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:16}}>🧺</span> REGISTRO DE COSECHA
        </div>
        <LoteSelector value={formC.loteId} onChange={v=>setFormC(p=>({...p,loteId:v}))}/>
        {formC.loteId&&(
          <>
            <div style={{marginBottom:16}}>
              <label style={LBL}>Kg cosechados hoy *</label>
              <input type="number" step="0.1" min="0" value={formC.kgCosechados}
                onChange={e=>setFormC(p=>({...p,kgCosechados:e.target.value}))}
                placeholder="Ej: 45.5"
                style={{...INP,fontSize:24,fontWeight:700,textAlign:"center",fontFamily:"'Courier New',monospace"}}/>
            </div>
            <CalidadSelector value={formC.calidad} onChange={v=>setFormC(p=>({...p,calidad:v}))}/>
            <div style={{marginBottom:16}}>
              <label style={LBL}>Observaciones</label>
              <textarea value={formC.notas} onChange={e=>setFormC(p=>({...p,notas:e.target.value}))}
                placeholder="Estado del producto, condiciones de la cosecha..."
                style={{...INP,minHeight:70,resize:"vertical"}}/>
            </div>
            <button onClick={submitCosecha} disabled={saving}
              style={{width:"100%",padding:14,background:saving?"#aaa":"#27ae60",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
              {saving?"Guardando...":"🧺 Registrar cosecha del día"}
            </button>
          </>
        )}
      </div>

      {/* Divisor */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <div style={{flex:1,height:1,background:"#e0e0e0"}}/>
        <span style={{fontSize:11,color:"#aaa",fontWeight:600,letterSpacing:0.5}}>REGISTRO DE VENTA</span>
        <div style={{flex:1,height:1,background:"#e0e0e0"}}/>
      </div>

      {/* ── VENTA ── */}
      <div>
          <LoteSelector value={formV.loteId} onChange={v=>setFormV(p=>({...p,loteId:v}))}/>
          <div style={{marginBottom:16}}>
            <label style={LBL}>Comprador / Cliente *</label>
            <input value={formV.comprador} onChange={e=>setFormV(p=>({...p,comprador:e.target.value}))}
              placeholder="Nombre del comprador" style={INP}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={LBL}>Canal de venta</label>
            <select value={formV.canal} onChange={e=>setFormV(p=>({...p,canal:e.target.value}))} style={INP}>
              {CANALES.map(c=><option key={c} value={c}>{c}</option>)}
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
                onChange={e=>setFormV(p=>({...p,kgVendidos:e.target.value}))}
                placeholder="0.0"
                style={{...INP,textAlign:"center",fontFamily:"'Courier New',monospace",fontWeight:700}}/>
            </div>
            <div>
              <label style={LBL}>
                Precio $/kg *
                {(()=>{
                  const lote=getLote(formV.loteId);
                  const sug=lote?getPrecio(lote.crop,formV.calidad):null;
                  return sug
                    ? <span style={{color:"#27ae60",fontWeight:700,fontSize:10,marginLeft:3,cursor:"pointer"}}
                        onClick={()=>setFormV(p=>({...p,precioKg:sug}))}>
                        · ${sug} sugerido ↵
                      </span>
                    : null;
                })()}
              </label>
              <input type="number" step="0.5" min="0" value={formV.precioKg}
                onChange={e=>setFormV(p=>({...p,precioKg:e.target.value}))}
                placeholder="0.00"
                style={{...INP,textAlign:"center",fontFamily:"'Courier New',monospace",fontWeight:700}}/>
            </div>
          </div>
          {/* Total en tiempo real */}
          {parseFloat(formV.kgVendidos)>0&&parseFloat(formV.precioKg)>0&&(
            <div style={{background:"#eafaf1",border:"2px solid #a9dfbf",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:14,color:"#2e7d5a",fontWeight:600}}>Total esta venta:</span>
              <span style={{fontFamily:"'Courier New',monospace",fontSize:22,fontWeight:700,color:"#27ae60"}}>
                ${(parseFloat(formV.kgVendidos)*parseFloat(formV.precioKg)).toFixed(2)}
              </span>
            </div>
          )}
          <div style={{marginBottom:16}}>
            <label style={LBL}>Fecha</label>
            <input type="date" value={formV.fecha} onChange={e=>setFormV(p=>({...p,fecha:e.target.value}))} style={INP}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={LBL}>Folio / Remisión</label>
            <input value={formV.factura} onChange={e=>setFormV(p=>({...p,factura:e.target.value}))}
              placeholder="Núm. de factura o remisión" style={INP}/>
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
  const mine=tasks.filter(t=>!t.assignedTo||t.assignedTo===worker||t.assignedTo==="todos");
  const done=mine.filter(t=>t.completedBy?.includes(worker));
  const pending=mine.filter(t=>!t.completedBy?.includes(worker));
  const mark=async t=>{
    const {updateDoc,doc:d}=await import("firebase/firestore");
    const completed=[...(t.completedBy||[])];
    if(!completed.includes(worker))completed.push(worker);
    await updateDoc(d(db,"tasks",t.id),{completedBy:completed});
  };
  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <div style={{flex:1,background:"#eafaf1",borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:24,fontWeight:700,color:"#27ae60"}}>{done.length}</div><div style={{fontSize:11,color:"#aaa"}}>Completadas</div></div>
        <div style={{flex:1,background:"#fef9e7",borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:24,fontWeight:700,color:"#f39c12"}}>{pending.length}</div><div style={{fontSize:11,color:"#aaa"}}>Pendientes</div></div>
      </div>
      {!mine.length&&<div style={{textAlign:"center",padding:"2rem",color:"#aaa"}}><div style={{fontSize:36,marginBottom:8}}>✅</div><div>Sin tareas para hoy</div></div>}
      {pending.map(t=>(
        <div key={t.id} style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{t.title}</div>{t.description&&<div style={{fontSize:12,color:"#888"}}>{t.description}</div>}{t.zone&&<div style={{fontSize:11,color:"#aaa",marginTop:2}}>📍 {t.zone}</div>}</div>
          <button onClick={()=>mark(t)} style={{padding:"8px 14px",background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:8,color:"#27ae60",cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0}}>✓ Listo</button>
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
  const [form,setForm]=useState({type:"plaga",zone:"",description:"",crop:"jitomate"});
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
      <div style={{marginBottom:12}}><label style={LBL}>Zona *</label><input value={form.zone} onChange={e=>setForm(p=>({...p,zone:e.target.value}))} placeholder="Zona A" style={INP}/></div>
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
  const [messages,setMessages]=useState([{role:"assistant",content:"¡Hola! Soy tu asistente agrónomo 🌿\n\nPuedo ayudarte con:\n• Dudas sobre tus cultivos\n• Diagnóstico de enfermedades o plagas\n• Interpretar análisis de suelo\n\nEscríbeme o sube una foto."}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [imgPreview,setImgPreview]=useState(null);
  const [imgBase64,setImgBase64]=useState(null);
  const [imgType,setImgType]=useState(null);
  const [mode,setMode]=useState("chat");
  const bottomRef=useRef(null);
  const fileRef=useRef(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);
  const handleFile=e=>{
    const file=e.target.files[0];if(!file)return;setImgType(file.type);
    const reader=new FileReader();
    reader.onload=ev=>{
      if(file.type.includes("image")){
        const img=new Image();
        img.onload=()=>{
          const canvas=document.createElement("canvas");const MAX=1024;let w=img.width,h=img.height;
          if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;}}
          canvas.width=w;canvas.height=h;canvas.getContext("2d").drawImage(img,0,0,w,h);
          setImgBase64(canvas.toDataURL("image/jpeg",0.8).split(",")[1]);
          setImgPreview(canvas.toDataURL("image/jpeg",0.8));setImgType("image/jpeg");
        };img.src=ev.target.result;
      }else{setImgBase64(ev.target.result.split(",")[1]);setImgPreview(null);}
    };reader.readAsDataURL(file);
  };
  const send=async text=>{
    const userMsg=text||input.trim();if(!userMsg&&!imgBase64)return;
    setInput("");setLoading(true);
    const newMsg={role:"user",content:userMsg||(mode==="planta"?"Analiza esta imagen de la planta":"Analiza este análisis de suelo")};
    const updated=[...messages,newMsg];setMessages(updated);
    try{
      const res=await fetch("/api/asistente",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:updated.slice(-8),imgBase64:imgBase64||null,imgType:imgType||null,mode:imgBase64?mode:"chat"})});
      const data=await res.json();if(data.error)throw new Error(data.error);
      setMessages(p=>[...p,{role:"assistant",content:data.text}]);
      setImgBase64(null);setImgPreview(null);setImgType(null);
    }catch(e){setMessages(p=>[...p,{role:"assistant",content:"❌ Error: "+e.message}]);}
    setLoading(false);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)"}}>
      <div style={{display:"flex",gap:6,paddingBottom:10}}>
        {[["chat","💬 Preguntar"],["planta","🌿 Foto planta"],["suelo","🌍 Análisis suelo"]].map(([m,l])=>(
          <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"7px 4px",border:`1.5px solid ${mode===m?"#27ae60":"#e0e0e0"}`,borderRadius:20,background:mode===m?"#eafaf1":"#fff",color:mode===m?"#27ae60":"#888",cursor:"pointer",fontSize:11,fontWeight:mode===m?700:400}}>{l}</button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingBottom:8}}>
        {messages.map((msg,i)=>(
          <div key={i} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"85%",background:msg.role==="user"?"#27ae60":"#fff",color:msg.role==="user"?"#fff":"#333",borderRadius:msg.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"10px 14px",fontSize:13,lineHeight:1.6,border:msg.role==="user"?"none":"1px solid #e0e0e0",whiteSpace:"pre-wrap"}}>
              {msg.role==="assistant"&&<span style={{fontSize:14,marginRight:4}}>🌿</span>}{msg.content}
            </div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{background:"#fff",borderRadius:"18px 18px 18px 4px",padding:"10px 16px",border:"1px solid #e0e0e0",color:"#27ae60",fontSize:13}}>🌿 Analizando...</div></div>}
        <div ref={bottomRef}/>
      </div>
      {messages.length<=1&&(<div style={{display:"flex",gap:6,flexWrap:"wrap",paddingBottom:8}}>{SUGERENCIAS.map((s,i)=>(<button key={i} onClick={()=>send(s)} style={{background:"#fff",border:"1px solid #d5e8d4",borderRadius:16,padding:"6px 12px",fontSize:11,color:"#27ae60",cursor:"pointer"}}>{s}</button>))}</div>)}
      {imgPreview&&<div style={{paddingBottom:6}}><img src={imgPreview} alt="" style={{height:60,borderRadius:8,border:"2px solid #27ae60"}}/><button onClick={()=>{setImgBase64(null);setImgPreview(null);}} style={{marginLeft:6,background:"#e74c3c",border:"none",borderRadius:"50%",color:"#fff",width:20,height:20,cursor:"pointer",fontSize:11}}>✕</button></div>}
      {imgBase64&&!imgPreview&&<div style={{paddingBottom:6}}><span style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:8,padding:"5px 12px",fontSize:12,color:"#27ae60",fontWeight:600}}>📄 PDF listo</span><button onClick={()=>{setImgBase64(null);}} style={{marginLeft:6,background:"none",border:"none",color:"#aaa",cursor:"pointer"}}>✕</button></div>}
      <div style={{background:"#fff",borderTop:"1px solid #e0e0e0",paddingTop:10}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <button onClick={()=>fileRef.current.click()} style={{width:42,height:42,borderRadius:12,background:"#f0faf5",border:"1px solid #a9dfbf",color:"#27ae60",cursor:"pointer",fontSize:18,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>📎</button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" capture={mode==="planta"?"environment":undefined} style={{display:"none"}} onChange={handleFile}/>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Escribe tu pregunta..." rows={1}
            style={{flex:1,padding:"10px 14px",border:"1px solid #e0e0e0",borderRadius:12,fontSize:14,resize:"none",outline:"none",background:"#fff",color:"#222",WebkitTextFillColor:"#222",colorScheme:"light",lineHeight:1.4,maxHeight:100,overflowY:"auto"}}/>
          <button onClick={()=>send()} disabled={loading||(!input.trim()&&!imgBase64)}
            style={{width:42,height:42,borderRadius:12,background:loading||(!input.trim()&&!imgBase64)?"#e0e0e0":"#27ae60",color:"#fff",border:"none",cursor:"pointer",fontSize:18,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {loading?"⏳":"➤"}
          </button>
        </div>
        {messages.length>2&&<button onClick={()=>setMessages([{role:"assistant",content:"¡Hola de nuevo! ¿En qué te puedo ayudar? 🌿"}])} style={{marginTop:6,width:"100%",padding:5,background:"transparent",border:"none",color:"#bbb",cursor:"pointer",fontSize:11}}>Limpiar conversación</button>}
      </div>
    </div>
  );
}

// ─── MAIN WORKER ──────────────────────────────────────────────────────────────
const TABS = [
  { id:"registro",     label:"Registrar", icon:"📊" },
  { id:"cosecha",      label:"Cosecha",   icon:"🧺" },
  { id:"tareas",       label:"Tareas",    icon:"✅" },
  { id:"asistente",    label:"IA",        icon:"🤖" },
  { id:"incidencias",  label:"Incidencia",icon:"⚠️" },
  { id:"instrucciones",label:"Info",      icon:"📋" },
];

export default function Worker({ user }) {
  const [tab, setTab] = useState("registro");
  // Nombre del trabajador desde Firebase Auth o Firestore
  const [workerName, setWorkerName] = useState("");

  useEffect(()=>{
    if(!user) return;
    // Extraer nombre del email: carlos.garcia@greenlog.app → Carlos Garcia
    const emailUser = user.email?.split("@")[0] || "trabajador";
    const nombre = user.displayName ||
      emailUser.split(".").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
    setWorkerName(nombre);
    // Buscar nombre real en Firestore
    import("firebase/firestore").then(({query:q,collection:col,where,getDocs})=>{
      getDocs(q(col(db,"usuarios"),where("email","==",user.email))).then(snap=>{
        if(!snap.empty) setWorkerName(snap.docs[0].data().nombre);
      }).catch(()=>{});
    });
  },[user]);

  const worker = workerName || user?.email?.split("@")[0] || "Trabajador";

  const CONTENT = {
    registro:      <Registro worker={worker}/>,
    cosecha:       <RegistroCosecha worker={worker}/>,
    tareas:        <Tareas worker={worker}/>,
    asistente:     <AsistenteIA/>,
    incidencias:   <Incidencias worker={worker}/>,
    instrucciones: <InstruccionesDia/>,
  };

  return (
    <div style={{minHeight:"100vh",background:"#f4f5f7",paddingBottom:76}}>
      <div style={{background:"#fff",borderBottom:"1px solid #e0e0e0",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:22}}>🌿</span>
          <div>
            <div style={{fontWeight:700,color:"#27ae60",fontSize:16}}>GreenLog</div>
            <div style={{fontSize:10,color:"#aaa",fontFamily:"'Courier New',monospace"}}>Hola, {worker}</div>
          </div>
        </div>
        <button onClick={()=>signOut(auth)}
          style={{background:"none",border:"1px solid #e0e0e0",borderRadius:8,color:"#aaa",cursor:"pointer",fontSize:12,padding:"4px 10px"}}>
          Salir
        </button>
      </div>
      <div style={{padding:"16px 16px 0"}}>{CONTENT[tab]}</div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"1px solid #e0e0e0",display:"flex",zIndex:10,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,padding:"8px 2px",border:"none",background:"transparent",color:tab===t.id?"#27ae60":"#bbb",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1,borderTop:tab===t.id?"2.5px solid #27ae60":"2.5px solid transparent"}}>
            <span style={{fontSize:17}}>{t.icon}</span>
            <span style={{fontSize:9,fontWeight:tab===t.id?700:400}}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
