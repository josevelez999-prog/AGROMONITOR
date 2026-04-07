import { useState, useRef, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";

// ─── DATOS DE REFERENCIA ──────────────────────────────────────────────────────
const CROPS_SUELO = {
  jitomate:  { name:"Jitomate",  emoji:"🍅", color:"#c0392b" },
  fresa:     { name:"Fresa",     emoji:"🍓", color:"#e74c3c" },
  arandano:  { name:"Arándano",  emoji:"🫐", color:"#2980b9" },
  zarzamora: { name:"Zarzamora", emoji:"🫐", color:"#8e44ad" },
  maiz:      { name:"Maíz",      emoji:"🌽", color:"#f39c12" },
  chile:     { name:"Chile",     emoji:"🌶️", color:"#e74c3c" },
  pepino:    { name:"Pepino",    emoji:"🥒", color:"#27ae60" },
  otro:      { name:"Otro",      emoji:"🌱", color:"#7f8c8d" },
};

const PARAMETROS_SUELO = [
  { key:"pH",         label:"pH",              unit:"",        optMin:6.0,  optMax:7.0,  desc:"Acidez/alcalinidad" },
  { key:"MO",         label:"Mat. Orgánica",    unit:"%",       optMin:2,    optMax:5,    desc:"Porcentaje ideal ≥3%" },
  { key:"N",          label:"Nitrógeno (N)",    unit:"ppm",     optMin:30,   optMax:80,   desc:"N disponible" },
  { key:"P",          label:"Fósforo (P)",      unit:"ppm",     optMin:20,   optMax:60,   desc:"P extractable Olsen" },
  { key:"K",          label:"Potasio (K)",      unit:"meq/100g",optMin:0.2,  optMax:0.8,  desc:"K intercambiable" },
  { key:"Ca",         label:"Calcio (Ca)",      unit:"meq/100g",optMin:5,    optMax:15,   desc:"Ca intercambiable" },
  { key:"Mg",         label:"Magnesio (Mg)",    unit:"meq/100g",optMin:1,    optMax:4,    desc:"Mg intercambiable" },
  { key:"Na",         label:"Sodio (Na)",       unit:"meq/100g",optMin:0,    optMax:0.5,  desc:"Na intercambiable" },
  { key:"Fe",         label:"Hierro (Fe)",      unit:"ppm",     optMin:4,    optMax:20,   desc:"Fe disponible DTPA" },
  { key:"Zn",         label:"Zinc (Zn)",        unit:"ppm",     optMin:1,    optMax:5,    desc:"Zn disponible" },
  { key:"CE",         label:"CE",              unit:"dS/m",    optMin:0,    optMax:2,    desc:"Conductividad eléctrica" },
  { key:"textura",    label:"Textura",         unit:"",        optMin:null, optMax:null, desc:"Franco, arcilloso, arenoso..." },
];

// Fertilizantes para suelo
const FERTS_SUELO = [
  { id:"urea",      name:"Urea (46-0-0)",         NPK:"46-0-0",  N:46, P:0,   K:0,   precio:0, unidad:"kg/ha" },
  { id:"saf",       name:"Sulfato de amonio",      NPK:"21-0-0",  N:21, P:0,   K:0,   precio:0, unidad:"kg/ha" },
  { id:"map",       name:"MAP (11-52-0)",          NPK:"11-52-0", N:11, P:52,  K:0,   precio:0, unidad:"kg/ha" },
  { id:"dap",       name:"DAP (18-46-0)",          NPK:"18-46-0", N:18, P:46,  K:0,   precio:0, unidad:"kg/ha" },
  { id:"kcl",       name:"Cloruro de K (0-0-60)",  NPK:"0-0-60",  N:0,  P:0,   K:60,  precio:0, unidad:"kg/ha" },
  { id:"ksul",      name:"Sulfato de K (0-0-50)",  NPK:"0-0-50",  N:0,  P:0,   K:50,  precio:0, unidad:"kg/ha" },
  { id:"superf",    name:"Superfosfato simple",    NPK:"0-19-0",  N:0,  P:19,  K:0,   precio:0, unidad:"kg/ha" },
  { id:"superft",   name:"Superfosfato triple",    NPK:"0-46-0",  N:0,  P:46,  K:0,   precio:0, unidad:"kg/ha" },
  { id:"nitrato_k", name:"Nitrato de K (13-0-44)", NPK:"13-0-44", N:13, P:0,   K:44,  precio:0, unidad:"kg/ha" },
  { id:"sulfmg",    name:"Sulfato de Mg",          NPK:"0-0-0",   N:0,  P:0,   K:0,   precio:0, unidad:"kg/ha", Mg:9.6 },
  { id:"cal",       name:"Cal agrícola (CaCO₃)",   NPK:"—",       N:0,  P:0,   K:0,   precio:0, unidad:"ton/ha" },
  { id:"sulfato",   name:"Azufre elemental",       NPK:"—",       N:0,  P:0,   K:0,   precio:0, unidad:"kg/ha" },
  { id:"compostat", name:"Composta / vermicomposta",NPK:"variable",N:2,  P:1,   K:1,   precio:0, unidad:"ton/ha" },
];

const n = (v, d=2) => Number(parseFloat(v||0).toFixed(d));

function StatusPill({ value, min, max }) {
  if (min === null) return null;
  const v = parseFloat(value);
  if (isNaN(v)) return null;
  const low = v < min, high = v > max;
  const color = low || high ? (low ? "#e74c3c" : "#f39c12") : "#27ae60";
  const bg    = low || high ? (low ? "#fdedec" : "#fef9e7") : "#eafaf1";
  const label = low ? "Bajo" : high ? "Alto" : "Óptimo";
  return (
    <span style={{background:bg,color,border:`1px solid ${color}44`,borderRadius:10,padding:"1px 8px",fontSize:10,fontWeight:600}}>
      {label}
    </span>
  );
}

// ─── FORMULADOR DE SUELO ──────────────────────────────────────────────────────
function FormuladorSuelo({ analisis, recomendacion }) {
  const [crop, setCrop] = useState("jitomate");
  const [area, setArea] = useState(1);
  const [ferts, setFerts] = useState(FERTS_SUELO.map(f => ({ ...f, dosis: 0, activo: false })));
  const [saved, setSaved] = useState([]);
  const [saveName, setSaveName] = useState("");

  // Extraer NPK necesario de la recomendación IA si existe
  const rec = recomendacion?.formulacion_suelo || null;

  const totales = ferts.filter(f => f.activo && f.dosis > 0).reduce((acc, f) => {
    acc.N = n(acc.N + (f.N * f.dosis / 100));
    acc.P = n(acc.P + (f.P * f.dosis / 100));
    acc.K = n(acc.K + (f.K * f.dosis / 100));
    acc.costo = n(acc.costo + (f.dosis * f.precio * area));
    return acc;
  }, { N:0, P:0, K:0, costo:0 });

  const thS = { padding:"6px 10px", fontSize:11, fontWeight:500, color:"#aaa", textAlign:"left", borderBottom:"1px solid #f0f0f0", background:"#fafafa" };
  const tdS = { padding:"8px 10px", fontSize:13, borderBottom:"1px solid #fafafa" };

  return (
    <div>
      {/* Cabecera */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16,alignItems:"flex-end"}}>
        <div>
          <div style={{fontSize:11,color:"#aaa",marginBottom:6,fontFamily:"'Courier New',monospace"}}>CULTIVO</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Object.entries(CROPS_SUELO).map(([k,c])=>(
              <button key={k} onClick={()=>setCrop(k)} style={{padding:"7px 14px",border:`1px solid ${crop===k?c.color:"#e0e0e0"}`,borderRadius:20,background:crop===k?c.color+"18":"transparent",color:crop===k?c.color:"#666",cursor:"pointer",fontSize:12,fontWeight:crop===k?700:400}}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:11,color:"#aaa",marginBottom:6,fontFamily:"'Courier New',monospace"}}>SUPERFICIE (ha)</div>
          <input type="number" step="0.1" min="0.1" value={area} onChange={e=>setArea(parseFloat(e.target.value)||1)}
            style={{width:100,padding:"8px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:14,fontWeight:700,fontFamily:"'Courier New',monospace",textAlign:"center"}}/>
        </div>
      </div>

      {/* Recomendación IA si hay */}
      {rec && (
        <div style={{background:"#f0faf5",border:"1px solid #a9dfbf",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
          <div style={{fontSize:11,color:"#27ae60",fontWeight:700,marginBottom:6,letterSpacing:0.3}}>🤖 RECOMENDACIÓN IA PARA ESTE SUELO</div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {[["N",rec.N_kg_ha,"#3498db"],["P₂O₅",rec.P_kg_ha,"#e67e22"],["K₂O",rec.K_kg_ha,"#8e44ad"]].map(([label,val,color])=>(
              <div key={label} style={{textAlign:"center",background:"#fff",borderRadius:8,padding:"8px 16px",border:`1px solid ${color}22`}}>
                <div style={{fontSize:10,color:"#aaa",marginBottom:2}}>{label} kg/ha</div>
                <div style={{fontSize:22,fontWeight:700,color,fontFamily:"'Courier New',monospace"}}>{val||"—"}</div>
              </div>
            ))}
          </div>
          {rec.notas&&<div style={{fontSize:12,color:"#2e7d5a",marginTop:8}}>📝 {rec.notas}</div>}
        </div>
      )}

      {/* Tabla de fertilizantes */}
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:14,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:10,letterSpacing:0.3}}>FERTILIZANTES</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:550}}>
            <thead>
              <tr>
                <th style={{...thS,width:32}}></th>
                <th style={thS}>Fertilizante</th>
                <th style={{...thS,textAlign:"center"}}>NPK (%)</th>
                <th style={{...thS,textAlign:"center",minWidth:110}}>Dosis (kg o ton/ha)</th>
                <th style={{...thS,textAlign:"center"}}>$/unidad</th>
              </tr>
            </thead>
            <tbody>
              {ferts.map((f,i) => (
                <tr key={f.id} style={{opacity:f.activo?1:0.45}}>
                  <td style={tdS}><input type="checkbox" checked={f.activo} onChange={()=>setFerts(p=>p.map((x,j)=>j===i?{...x,activo:!x.activo}:x))} style={{cursor:"pointer"}}/></td>
                  <td style={{...tdS,fontWeight:f.activo?600:400}}>{f.name}</td>
                  <td style={{...tdS,textAlign:"center",fontFamily:"'Courier New',monospace",fontSize:12,color:"#666"}}>{f.NPK}</td>
                  <td style={{...tdS,textAlign:"center"}}>
                    {f.activo && (
                      <input type="number" step="1" min="0" value={f.dosis}
                        onChange={e=>setFerts(p=>p.map((x,j)=>j===i?{...x,dosis:parseFloat(e.target.value)||0}:x))}
                        style={{width:80,padding:"5px 8px",border:"1px solid #e0e0e0",borderRadius:6,fontSize:13,fontFamily:"'Courier New',monospace",textAlign:"center"}}/>
                    )}
                  </td>
                  <td style={{...tdS,textAlign:"center"}}>
                    {f.activo && (
                      <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}>
                        <span style={{fontSize:11,color:"#aaa"}}>$</span>
                        <input type="number" step="1" min="0" value={f.precio}
                          onChange={e=>setFerts(p=>p.map((x,j)=>j===i?{...x,precio:parseFloat(e.target.value)||0}:x))}
                          style={{width:70,padding:"5px 8px",border:"1px solid #e0e0e0",borderRadius:6,fontSize:12,fontFamily:"'Courier New',monospace",textAlign:"right"}}/>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totales */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:12}}>
        {[
          {label:`N total (${area} ha)`,  v:`${totales.N} kg`, color:"#3498db"},
          {label:`P₂O₅ total (${area} ha)`,v:`${totales.P} kg`, color:"#e67e22"},
          {label:`K₂O total (${area} ha)`, v:`${totales.K} kg`, color:"#8e44ad"},
          {label:"Costo estimado",          v:`$${totales.costo.toLocaleString()}`, color:"#27ae60"},
        ].map(s=>(
          <div key={s.label} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:"12px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:s.color,fontFamily:"'Courier New',monospace"}}>{s.v}</div>
            <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Guardar fórmula */}
      <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:"12px 14px",marginBottom:12,display:"flex",gap:10,flexWrap:"wrap"}}>
        <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder={`Fórmula ${CROPS_SUELO[crop].name} · ${new Date().toLocaleDateString("es-MX")}`}
          style={{flex:1,minWidth:200,padding:"8px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13}}/>
        <button onClick={()=>{if(saveName){setSaved(p=>[...p,{name:saveName,crop,area,ferts:ferts.filter(f=>f.activo&&f.dosis>0).map(f=>({id:f.id,name:f.name,dosis:f.dosis,precio:f.precio})),totales}]);setSaveName("");}}}
          style={{padding:"8px 20px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:12}}>
          Guardar fórmula
        </button>
      </div>

      {saved.map((f,i)=>(
        <div key={i} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{f.name}</div>
            <div style={{fontSize:11,color:"#aaa"}}>{CROPS_SUELO[f.crop]?.emoji} {CROPS_SUELO[f.crop]?.name} · {f.area} ha · N:{f.totales.N} P:{f.totales.P} K:{f.totales.K} kg/ha · ${f.totales.costo.toLocaleString()}</div>
          </div>
          <button onClick={()=>setSaved(p=>p.filter((_,j)=>j!==i))} style={{background:"#fdedec",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,color:"#c0392b"}}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── MÓDULO PRINCIPAL ─────────────────────────────────────────────────────────
export default function AnalisisSuelo() {
  const [tab, setTab] = useState("historial");
  const [analisis, setAnalisis] = useState([]);
  const [form, setForm] = useState({
    nombre: "", zona: "", fecha: new Date().toISOString().slice(0,10),
    crop: "jitomate", laboratorio: "", profundidad: "0-30"
  });
  const [parametros, setParametros] = useState(
    Object.fromEntries(PARAMETROS_SUELO.map(p => [p.key, ""]))
  );
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [fileBase64s, setFileBase64s] = useState([]);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selected, setSelected] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    const q = query(collection(db, "analisis_suelo"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => setAnalisis(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const handleFiles = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;
    const previews = [], base64s = [];
    for (const file of selectedFiles.slice(0, 4)) {
      const b64 = await new Promise(res => {
        const r = new FileReader();
        r.onload = ev => res(ev.target.result);
        r.readAsDataURL(file);
      });
      base64s.push({ data: b64.split(",")[1], type: file.type, name: file.name });
      previews.push({ url: b64, type: file.type, name: file.name });
    }
    setFiles(selectedFiles.slice(0, 4));
    setFilePreviews(previews);
    setFileBase64s(base64s);
  };

  const analyzeWithAI = async () => {
    if (!fileBase64s.length && !Object.values(parametros).some(v => v)) {
      alert("Sube el análisis de suelo (PDF o foto) o ingresa al menos algunos parámetros.");
      return;
    }
    setAnalyzing(true);
    try {
      // Use first file if available
      const firstFile = fileBase64s[0] || null;

      const res = await fetch("/api/analyzeSuelo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imgBase64: firstFile ? firstFile.data : null,
          imgType: firstFile ? firstFile.type : null,
          cropName: CROPS_SUELO[form.crop]?.name || form.crop,
          zona: form.zona,
          laboratorio: form.laboratorio,
          profundidad: form.profundidad,
          fecha: form.fecha,
          parametros,
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      // Pre-fill detected parameters
      if (result.parametros_detectados) {
        setParametros(prev => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(result.parametros_detectados)
              .filter(([, v]) => v && v !== "null")
              .map(([k, v]) => [k, v])
          )
        }));
      }

      // Upload files to Firebase Storage
      setSaving(true);
      let fileURLs = [];
      if (files.length > 0) {
        const storage = getStorage();
        for (const file of files) {
          const r = sRef(storage, `suelo/${Date.now()}_${file.name}`);
          await uploadBytes(r, file);
          fileURLs.push(await getDownloadURL(r));
        }
      }

      await addDoc(collection(db, "analisis_suelo"), {
        ...form,
        parametros: { ...parametros, ...(result.parametros_detectados || {}) },
        resultado: result,
        fileURLs,
        createdAt: new Date().toISOString(),
      });

      setTab("historial");
      setForm({ nombre:"", zona:"", fecha:new Date().toISOString().slice(0,10), crop:"jitomate", laboratorio:"", profundidad:"0-30" });
      setParametros(Object.fromEntries(PARAMETROS_SUELO.map(p => [p.key, ""])));
      setFiles([]); setFilePreviews([]); setFileBase64s([]);

    } catch(e) {
      console.error(e);
      alert("Error al analizar: " + e.message);
    }
    setAnalyzing(false);
    setSaving(false);
  };

  const getColorSemaforo = (s) => ({ verde:"#27ae60", amarillo:"#f39c12", rojo:"#e74c3c" }[s] || "#aaa");

  // ── HISTORIAL ──────────────────────────────────────────────────────────────
  const renderHistorial = () => (
    <div>
      {!analisis.length && (
        <div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa",border:"0.5px solid #e0e0e0"}}>
          <div style={{fontSize:48,marginBottom:8}}>🌍</div>
          <div style={{fontWeight:500,fontSize:15,marginBottom:6}}>Sin análisis de suelo registrados</div>
          <div style={{fontSize:12,marginBottom:16}}>Sube tu primer análisis de laboratorio para obtener recomendaciones personalizadas</div>
          <button onClick={()=>setTab("nuevo")} style={{padding:"10px 24px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>
            + Nuevo análisis
          </button>
        </div>
      )}
      {analisis.map(a => {
        const c = CROPS_SUELO[a.crop];
        const semaforoColor = getColorSemaforo(a.resultado?.semaforo);
        const open = selected === a.id;
        return (
          <div key={a.id} style={{background:"#fff",border:`1px solid ${semaforoColor}33`,borderLeft:`4px solid ${semaforoColor}`,borderRadius:12,padding:"14px 18px",marginBottom:10}}>
            <div onClick={()=>setSelected(open ? null : a.id)} style={{cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                <span style={{fontSize:28}}>🌍</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontWeight:700,fontSize:14}}>{a.nombre||`Análisis ${a.zona}`}</span>
                    <span style={{color:c?.color,fontSize:12,fontWeight:500}}>{c?.emoji} {c?.name}</span>
                    <span style={{background:semaforoColor+"18",color:semaforoColor,border:`1px solid ${semaforoColor}44`,borderRadius:10,padding:"1px 10px",fontSize:11,fontWeight:600}}>
                      {a.resultado?.semaforo==="verde"?"✓ Bueno":a.resultado?.semaforo==="amarillo"?"⚠ Regular":"✗ Crítico"}
                    </span>
                  </div>
                  <div style={{fontSize:12,color:"#888",marginBottom:2}}>{a.resultado?.diagnostico_general?.slice(0,100)}...</div>
                  <div style={{fontSize:11,color:"#bbb"}}>
                    {a.zona&&<span>📍 {a.zona} · </span>}
                    {a.laboratorio&&<span>🔬 {a.laboratorio} · </span>}
                    <span>📅 {a.fecha}</span>
                    {a.profundidad&&<span> · {a.profundidad} cm</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:12,color:"#ccc"}}>{open?"▲":"▼"}</span>
                  <button onClick={e=>{e.stopPropagation();if(window.confirm("¿Eliminar este análisis?"))deleteDoc(doc(db,"analisis_suelo",a.id));}}
                    style={{background:"#fdedec",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#c0392b"}}>✕</button>
                </div>
              </div>
            </div>

            {open && a.resultado && (
              <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #f0f0f0"}}>

                {/* Parámetros del suelo */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#2c3e50",marginBottom:8,letterSpacing:0.3}}>PARÁMETROS DETECTADOS</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
                    {PARAMETROS_SUELO.filter(p => a.parametros?.[p.key] && a.parametros[p.key] !== "null").map(p => (
                      <div key={p.key} style={{background:"#f9f9f9",borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:10,color:"#aaa",marginBottom:2}}>{p.label}</div>
                        <div style={{fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:14,color:"#333"}}>{a.parametros[p.key]} <span style={{fontSize:10,fontWeight:400}}>{p.unit}</span></div>
                        <StatusPill value={a.parametros[p.key]} min={p.optMin} max={p.optMax}/>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Problemas y deficiencias */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#e74c3c",marginBottom:6}}>PROBLEMAS PRINCIPALES</div>
                    {a.resultado.problemas_principales?.map((p,i)=>(
                      <div key={i} style={{display:"flex",gap:6,marginBottom:5,alignItems:"flex-start"}}>
                        <span style={{color:"#e74c3c",flexShrink:0}}>◆</span>
                        <span style={{fontSize:12,color:"#555"}}>{p}</span>
                      </div>
                    ))}
                    {a.resultado.deficiencias?.length>0&&(
                      <div style={{marginTop:8}}>
                        <div style={{fontSize:11,color:"#aaa",marginBottom:4}}>Deficiencias:</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {a.resultado.deficiencias.map((d,i)=>(
                            <span key={i} style={{background:"#fdedec",color:"#c0392b",border:"1px solid #f5c6c6",borderRadius:10,padding:"2px 10px",fontSize:11,fontWeight:600}}>{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#27ae60",marginBottom:6}}>ACCIONES RECOMENDADAS</div>
                    {a.resultado.recomendaciones_manejo?.map((r,i)=>(
                      <div key={i} style={{display:"flex",gap:6,marginBottom:5,alignItems:"flex-start"}}>
                        <span style={{color:"#27ae60",fontSize:12,fontWeight:700,flexShrink:0}}>{i+1}.</span>
                        <span style={{fontSize:12,color:"#333",background:"#f0faf5",borderRadius:6,padding:"4px 8px",flex:1}}>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fertilización recomendada */}
                {a.resultado.fertilizantes_recomendados?.length>0&&(
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#2c3e50",marginBottom:8,letterSpacing:0.3}}>FERTILIZANTES RECOMENDADOS</div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr style={{background:"#fafafa"}}>{["Fertilizante","Dosis","Momento de aplicación"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",color:"#aaa",fontWeight:500,fontSize:11,borderBottom:"1px solid #f0f0f0"}}>{h}</th>)}</tr></thead>
                        <tbody>{a.resultado.fertilizantes_recomendados.map((f,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid #fafafa"}}>
                            <td style={{padding:"8px 10px",fontWeight:600}}>{f.nombre}</td>
                            <td style={{padding:"8px 10px",fontFamily:"'Courier New',monospace",color:"#27ae60",fontWeight:700}}>{f.dosis}</td>
                            <td style={{padding:"8px 10px",color:"#888"}}><span style={{background:"#eaf4fb",color:"#1a5276",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>{f.momento}</span></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Enmiendas */}
                {a.resultado.enmiendas?.length>0&&(
                  <div style={{background:"#fef9e7",border:"1px solid #f39c1244",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#f39c12",marginBottom:6}}>ENMIENDAS NECESARIAS</div>
                    {a.resultado.enmiendas.map((e,i)=><div key={i} style={{fontSize:12,color:"#7d6608",marginBottom:2}}>• {e}</div>)}
                  </div>
                )}

                {/* NPK resumen y próximo muestreo */}
                {a.resultado.formulacion_suelo&&(
                  <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
                    <div style={{fontSize:12,color:"#aaa"}}>Nutrición recomendada:</div>
                    {[["N",a.resultado.formulacion_suelo.N_kg_ha,"#3498db"],["P₂O₅",a.resultado.formulacion_suelo.P_kg_ha,"#e67e22"],["K₂O",a.resultado.formulacion_suelo.K_kg_ha,"#8e44ad"]].map(([l,v,c])=>(
                      <span key={l} style={{background:c+"15",color:c,border:`1px solid ${c}33`,borderRadius:8,padding:"4px 12px",fontFamily:"'Courier New',monospace",fontSize:13,fontWeight:700}}>
                        {l}: {v||0} kg/ha
                      </span>
                    ))}
                  </div>
                )}

                {a.resultado.siguiente_muestreo&&(
                  <div style={{fontSize:12,color:"#888",background:"#f9f9f9",borderRadius:8,padding:"8px 12px",marginBottom:10}}>
                    📅 <strong>Próximo muestreo:</strong> {a.resultado.siguiente_muestreo}
                  </div>
                )}

                {/* Documentos subidos */}
                {a.fileURLs?.length>0&&(
                  <div>
                    <div style={{fontSize:11,color:"#aaa",marginBottom:6}}>DOCUMENTOS</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {a.fileURLs.map((url,i)=>(
                        <a key={i} href={url} target="_blank" rel="noreferrer"
                          style={{background:"#eaf4fb",border:"1px solid #b5d4f4",borderRadius:8,padding:"6px 14px",fontSize:12,color:"#1a5276",fontWeight:600,textDecoration:"none"}}>
                          📄 Ver documento {i+1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botón formulador */}
                <button onClick={()=>setTab("formulador_"+a.id)}
                  style={{marginTop:12,width:"100%",padding:"10px",background:"#1a2533",color:"#4ecb8d",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'Courier New',monospace"}}>
                  ⬡ Abrir formulador de suelo para este análisis
                </button>
              </div>
            )}

            {/* Formulador embebido */}
            {tab === "formulador_"+a.id && (
              <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #f0f0f0"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#444",letterSpacing:0.3}}>⬡ FORMULADOR DE SUELO</div>
                  <button onClick={()=>setTab("historial")} style={{background:"none",border:"none",color:"#aaa",cursor:"pointer",fontSize:12}}>Cerrar ✕</button>
                </div>
                <FormuladorSuelo analisis={a.parametros} recomendacion={a.resultado}/>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── NUEVO ANÁLISIS ─────────────────────────────────────────────────────────
  const renderNuevo = () => (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      {/* Columna izquierda: datos y parámetros */}
      <div>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:18,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14,letterSpacing:0.3}}>DATOS GENERALES</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:11,color:"#aaa",marginBottom:4,display:"block",fontFamily:"'Courier New',monospace"}}>NOMBRE / IDENTIFICADOR</label>
              <input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Lote Norte Temporada 2026" style={{width:"100%",padding:"9px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#aaa",marginBottom:4,display:"block",fontFamily:"'Courier New',monospace"}}>ZONA / PARCELA</label>
              <input value={form.zona} onChange={e=>setForm(p=>({...p,zona:e.target.value}))} placeholder="Zona A" style={{width:"100%",padding:"9px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#aaa",marginBottom:4,display:"block",fontFamily:"'Courier New',monospace"}}>FECHA MUESTREO</label>
              <input type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))} style={{width:"100%",padding:"9px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#aaa",marginBottom:4,display:"block",fontFamily:"'Courier New',monospace"}}>CULTIVO A ESTABLECER</label>
              <select value={form.crop} onChange={e=>setForm(p=>({...p,crop:e.target.value}))} style={{width:"100%",padding:"9px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13}}>
                {Object.entries(CROPS_SUELO).map(([k,c])=><option key={k} value={k}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:"#aaa",marginBottom:4,display:"block",fontFamily:"'Courier New',monospace"}}>LABORATORIO</label>
              <input value={form.laboratorio} onChange={e=>setForm(p=>({...p,laboratorio:e.target.value}))} placeholder="Nombre del lab" style={{width:"100%",padding:"9px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#aaa",marginBottom:4,display:"block",fontFamily:"'Courier New',monospace"}}>PROFUNDIDAD (cm)</label>
              <select value={form.profundidad} onChange={e=>setForm(p=>({...p,profundidad:e.target.value}))} style={{width:"100%",padding:"9px 12px",border:"1px solid #e0e0e0",borderRadius:8,fontSize:13}}>
                {["0-30","0-20","20-40","30-60","0-60"].map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Parámetros manuales */}
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:18}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:4,letterSpacing:0.3}}>PARÁMETROS DEL ANÁLISIS</div>
          <div style={{fontSize:11,color:"#aaa",marginBottom:12}}>Opcional — la IA los extrae del documento si los subes</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {PARAMETROS_SUELO.map(p => (
              <div key={p.key}>
                <label style={{fontSize:10,color:"#aaa",marginBottom:3,display:"block",fontFamily:"'Courier New',monospace"}}>
                  {p.label} {p.unit&&<span>({p.unit})</span>}
                </label>
                <input
                  value={parametros[p.key]} onChange={e=>setParametros(prev=>({...prev,[p.key]:e.target.value}))}
                  placeholder={p.key==="textura"?"Franco arcilloso...":"0.0"}
                  style={{width:"100%",padding:"7px 10px",border:"1px solid #e0e0e0",borderRadius:7,fontSize:12,boxSizing:"border-box",fontFamily:"'Courier New',monospace"}}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Columna derecha: upload y analizar */}
      <div>
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:18,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:4,letterSpacing:0.3}}>DOCUMENTO DEL ANÁLISIS</div>
          <div style={{fontSize:11,color:"#aaa",marginBottom:12}}>Sube el PDF o foto del reporte de laboratorio — la IA lo interpreta</div>

          <div onClick={()=>fileRef.current.click()}
            style={{border:"2px dashed #d5e8d4",borderRadius:10,padding:filePreviews.length?"12px":"2rem",textAlign:"center",cursor:"pointer",background:"#f9fff9",marginBottom:10}}>
            {filePreviews.length > 0 ? (
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
                {filePreviews.map((f,i)=>(
                  <div key={i} style={{background:"#eafaf1",border:"1px solid #a9dfbf",borderRadius:8,padding:"8px 14px",textAlign:"center"}}>
                    <div style={{fontSize:24,marginBottom:4}}>{f.type.includes("pdf")?"📄":"🖼️"}</div>
                    <div style={{fontSize:10,color:"#27ae60",fontWeight:600,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                  </div>
                ))}
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:60,color:"#aaa",fontSize:12}}>+ más</div>
              </div>
            ) : (
              <div>
                <div style={{fontSize:40,marginBottom:8}}>📄</div>
                <div style={{color:"#aaa",fontSize:13,fontWeight:500}}>Sube PDF o foto del análisis</div>
                <div style={{fontSize:11,color:"#ccc",marginTop:4}}>PDF, JPG, PNG — hasta 4 archivos</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{display:"none"}} onChange={handleFiles}/>
          </div>
          {filePreviews.length > 0 && (
            <button onClick={()=>{setFiles([]);setFilePreviews([]);setFileBase64s([]);}} style={{width:"100%",padding:6,border:"1px solid #e0e0e0",borderRadius:8,background:"transparent",color:"#aaa",cursor:"pointer",fontSize:12}}>
              Quitar archivos
            </button>
          )}
        </div>

        <div style={{background:"#f0faf5",border:"1px solid #a9dfbf",borderRadius:12,padding:16,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"#27ae60",marginBottom:6}}>🤖 Cómo funciona</div>
          <div style={{fontSize:12,color:"#2e7d5a",lineHeight:1.7}}>
            1. Sube el PDF o foto del análisis de tu laboratorio<br/>
            2. Opcionalmente ingresa los parámetros manualmente<br/>
            3. La IA extrae los valores, diagnostica la fertilidad y genera recomendaciones específicas para tu cultivo<br/>
            4. Usa el formulador para calcular dosis exactas por hectárea
          </div>
        </div>

        <button onClick={analyzeWithAI} disabled={analyzing||saving}
          style={{width:"100%",padding:14,background:analyzing||saving?"#a8d5b5":"#27ae60",color:"#fff",border:"none",borderRadius:10,cursor:analyzing||saving?"not-allowed":"pointer",fontSize:15,fontWeight:700,fontFamily:"'Courier New',monospace",letterSpacing:0.3}}>
          {analyzing?"🔬 Analizando con IA...":saving?"☁ Guardando...":"🔬 ANALIZAR CON IA"}
        </button>
        <div style={{fontSize:11,color:"#aaa",textAlign:"center",marginTop:8}}>
          El análisis queda guardado con todas las recomendaciones
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:4,width:"fit-content"}}>
        {[["historial",`🌍 Análisis guardados (${analisis.length})`],["nuevo","+ Nuevo análisis"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"9px 20px",border:"none",borderRadius:8,background:tab===k||tab.startsWith("formulador")&&k==="historial"?"#1a2533":"transparent",color:tab===k||tab.startsWith("formulador")&&k==="historial"?"#4ecb8d":"#888",cursor:"pointer",fontSize:13,fontWeight:700}}>
            {l}
          </button>
        ))}
      </div>

      {(tab==="historial"||tab.startsWith("formulador")) && renderHistorial()}
      {tab==="nuevo" && renderNuevo()}
    </div>
  );
}
