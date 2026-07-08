import { useState, useEffect } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { db, firebaseConfig } from "./firebase";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from "./dbCdt";
import { ROLE_INFO } from "./permissions";

const INP = {
  width:"100%", padding:"9px 12px", border:"1.5px solid #ccc",
  borderRadius:8, fontSize:14, boxSizing:"border-box",
  background:"#ffffff", color:"#111", WebkitTextFillColor:"#111",
  colorScheme:"light", outline:"none", fontFamily:"inherit",
};
const LBL = {fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"};

const ROLES = [
  "trabajador",
  "observador",
  "admin",
  "observador_global",
  "super_admin",
].map(id => ({ id, ...ROLE_INFO[id] }));

const GLOBAL_ROLES = new Set(["super_admin", "observador_global", "observador_superadmin"]);

export default function UsuariosAdmin() {
  const [usuarios, setUsuarios] = useState([]);
  const [cdts, setCdts] = useState([]);
  const [form, setForm] = useState({ nombre:"", usuario:"", password:"", rol:"trabajador", cdtId:"" });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [changingPass, setChangingPass] = useState(null);
  const [newPass, setNewPass] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db,"usuarios"), snap => setUsuarios(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db,"cdts"), snap => {
      const rows = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.nombre||a.id).localeCompare(b.nombre||b.id));
      setCdts(rows);
      if(rows.length && !form.cdtId) setForm(p=>({...p,cdtId:rows[0].id}));
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getEmail = usuario => `${usuario.trim().toLowerCase().replace(/\s+/g,".")}@greenlog.app`;
  const cdtSeleccionado = cdts.find(c=>c.id===form.cdtId);

  const crearCuenta = async () => {
    if (!form.nombre || !form.usuario || !form.password) { alert("Llena nombre, usuario y contraseña"); return; }
    if (form.password.length < 6) { alert("La contraseña debe tener al menos 6 caracteres"); return; }
    if (!GLOBAL_ROLES.has(form.rol) && !form.cdtId) { alert("Selecciona el CDT del usuario"); return; }
    const usuarioNorm = form.usuario.trim().toLowerCase().replace(/\s+/g,".");
    if (usuarios.find(u=>u.usuario===usuarioNorm)) { alert("Ese nombre de usuario ya existe"); return; }

    setSaving(true);
    let secondaryApp = null;
    try {
      // Se usa una app secundaria para crear usuarios sin cerrar la sesión del administrador actual.
      secondaryApp = initializeApp(firebaseConfig, `greenlog-create-user-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const email = getEmail(usuarioNorm);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, form.password);

      const base = {
        uid: cred.user.uid,
        nombre: form.nombre.trim(),
        usuario: usuarioNorm,
        email,
        rol: form.rol,
        activo: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const cdtData = GLOBAL_ROLES.has(form.rol) ? {
        cdtId: null,
        cdtClave: "GLOBAL",
        cdtNombre: "Vista global",
      } : {
        cdtId: form.cdtId,
        cdtClave: (cdtSeleccionado?.clave || form.cdtId || "").toUpperCase(),
        cdtNombre: cdtSeleccionado?.nombre || form.cdtId,
      };

      await setDoc(doc(db,"usuarios",cred.user.uid), { ...base, ...cdtData });
      setForm({ nombre:"", usuario:"", password:"", rol:"trabajador", cdtId:cdts[0]?.id||"" });
      setShowForm(false);
      alert("Cuenta creada correctamente");
    } catch(e) {
      const msgs = {
        "auth/email-already-in-use": "Ese nombre de usuario ya tiene una cuenta",
        "auth/weak-password": "La contraseña es muy débil (mínimo 6 caracteres)",
      };
      alert(msgs[e.code] || "Error: "+e.message);
    } finally {
      try { if (secondaryApp) await deleteApp(secondaryApp); } catch {}
      setSaving(false);
    }
  };

  const toggleActivo = async (u) => {
    await updateDoc(doc(db,"usuarios",u.id), { activo: !u.activo, updatedAt:new Date().toISOString() });
  };

  const cambiarRol = async (u, rol) => {
    if(!window.confirm(`¿Cambiar rol de ${u.nombre} a ${ROLE_INFO[rol]?.label || rol}?`)) return;
    const data = { rol, updatedAt:new Date().toISOString() };
    if (GLOBAL_ROLES.has(rol)) {
      data.cdtId = null; data.cdtClave = "GLOBAL"; data.cdtNombre = "Vista global";
    }
    await updateDoc(doc(db,"usuarios",u.id), data);
  };

  const cambiarCdt = async (u, cdtId) => {
    const cdt = cdts.find(c=>c.id===cdtId);
    await updateDoc(doc(db,"usuarios",u.id), {
      cdtId,
      cdtClave: (cdt?.clave || cdtId || "").toUpperCase(),
      cdtNombre: cdt?.nombre || cdtId,
      updatedAt:new Date().toISOString(),
    });
  };

  const cambiarPassword = async (u) => {
    if (!newPass || newPass.length < 6) { alert("Mínimo 6 caracteres"); return; }
    await updateDoc(doc(db,"usuarios",u.id), {
      passwordUpdatedAt: new Date().toISOString(),
      passwordHint: `Solicitada ${new Date().toLocaleDateString("es-MX")}`,
    });
    alert("Nota: por seguridad, el cambio real de contraseña debe hacerse con la API Admin o con restablecimiento por correo. Ya quedó marcada la solicitud.");
    setChangingPass(null); setNewPass("");
  };

  const eliminarUsuario = async (u) => {
    if (!window.confirm(`¿Eliminar el perfil de ${u.nombre} en Firestore?\n\nLa cuenta de Auth puede requerir borrado desde Firebase Console.`)) return;
    await deleteDoc(doc(db,"usuarios",u.id));
  };

  return (
    <div>
      <div style={{background:"#eaf4fb",border:"1px solid #b5d4f4",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#1a5276"}}>
        🔑 Gestiona accesos por rol y CDT. <strong>Observador Super Admin</strong> puede ver todos los CDT en modo solo lectura y usar IA; no puede editar datos operativos.
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:12,color:"#888"}}>
          {usuarios.filter(u=>u.activo).length} cuenta{usuarios.filter(u=>u.activo).length!==1?"s":""} activa{usuarios.filter(u=>u.activo).length!==1?"s":""}
          {usuarios.filter(u=>!u.activo).length>0&&<span style={{color:"#e74c3c",marginLeft:8}}> · {usuarios.filter(u=>!u.activo).length} deshabilitada{usuarios.filter(u=>!u.activo).length!==1?"s":""}</span>}
        </div>
        <button onClick={()=>setShowForm(!showForm)}
          style={{padding:"9px 20px",background:showForm?"#e74c3c":"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>
          {showForm?"✕ Cancelar":"+ Nueva cuenta"}
        </button>
      </div>

      {showForm && (
        <div style={{background:"#fff",border:"1px solid #a9dfbf",borderRadius:12,padding:"18px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14,letterSpacing:0.3}}>CREAR NUEVA CUENTA</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12,marginBottom:12}}>
            <div>
              <label style={LBL}>Nombre completo *</label>
              <input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Carlos García" style={INP}/>
            </div>
            <div>
              <label style={LBL}>Nombre de usuario *</label>
              <input value={form.usuario} onChange={e=>setForm(p=>({...p,usuario:e.target.value.toLowerCase().replace(/\s+/g,".")}))} placeholder="Ej: carlos.garcia" autoCapitalize="none" style={INP}/>
              {form.usuario&&<div style={{fontSize:10,color:"#27ae60",marginTop:3}}>Entrará como: {getEmail(form.usuario)}</div>}
            </div>
            <div style={{position:"relative"}}>
              <label style={LBL}>Contraseña * mínimo 6</label>
              <input type={showPass?"text":"password"} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder="Contraseña segura" style={{...INP,paddingRight:40}}/>
              <button onClick={()=>setShowPass(!showPass)} style={{position:"absolute",right:10,bottom:9,background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#aaa"}}>{showPass?"🙈":"👁️"}</button>
            </div>
            <div>
              <label style={LBL}>CDT</label>
              <select value={form.cdtId} disabled={GLOBAL_ROLES.has(form.rol)} onChange={e=>setForm(p=>({...p,cdtId:e.target.value}))} style={{...INP,background:GLOBAL_ROLES.has(form.rol)?"#f0f0f0":"#fff"}}>
                {cdts.map(c=><option key={c.id} value={c.id}>{(c.clave||c.id).toUpperCase()} — {c.nombre||c.id}</option>)}
              </select>
              {GLOBAL_ROLES.has(form.rol)&&<div style={{fontSize:10,color:"#16a085",marginTop:3}}>Este rol tiene vista global; no se ata a un CDT.</div>}
            </div>
          </div>

          <div style={{marginBottom:14}}>
            <label style={LBL}>Rol</label>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
              {ROLES.map(r=>(
                <button key={r.id} onClick={()=>setForm(p=>({...p,rol:r.id}))}
                  style={{padding:"9px",border:`2px solid ${form.rol===r.id?r.color:"#ddd"}`,borderRadius:8,background:form.rol===r.id?r.color+"18":"#fff",cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:18}}>{r.icon}</div>
                  <div style={{fontSize:11,fontWeight:700,color:form.rol===r.id?r.color:"#555",marginTop:2}}>{r.label}</div>
                  <div style={{fontSize:9,color:"#aaa"}}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={crearCuenta} disabled={saving}
            style={{padding:"10px 28px",background:saving?"#aaa":"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:saving?"not-allowed":"pointer",fontWeight:700,fontSize:13}}>
            {saving?"Creando cuenta...":"✓ Crear cuenta"}
          </button>
        </div>
      )}

      {!usuarios.length && (
        <div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa",border:"0.5px solid #e0e0e0"}}>
          <div style={{fontSize:40,marginBottom:8}}>👥</div>
          <div style={{fontWeight:500,marginBottom:4}}>Sin cuentas creadas</div>
          <div style={{fontSize:12}}>Crea la primera cuenta para dar acceso a tu equipo</div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(330px,1fr))",gap:12}}>
        {usuarios.map(u => {
          const rol = ROLE_INFO[u.rol] || ROLE_INFO.trabajador;
          const init = (u.nombre||u.email||"U").split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase();
          const isChangingPass = changingPass === u.id;
          const isGlobal = GLOBAL_ROLES.has(u.rol);
          return (
            <div key={u.id} style={{background:"#fff",border:`1px solid ${u.activo?"#e0e0e0":"#f5c6c6"}`,borderRadius:12,padding:"16px",opacity:u.activo?1:0.7}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
                <div style={{width:44,height:44,borderRadius:"50%",flexShrink:0,background:u.activo?rol.color+"18":"#f0f0f0",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:15,color:u.activo?rol.color:"#aaa",border:`2px solid ${u.activo?rol.color:"#ddd"}`}}>{init}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15,color:"#1a2533",marginBottom:2}}>{u.nombre||"Sin nombre"}</div>
                  <div style={{fontFamily:"'Courier New',monospace",fontSize:12,color:"#666",marginBottom:4}}>@{u.usuario||u.email}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <span style={{background:rol.color+"18",color:rol.color,border:`1px solid ${rol.color}44`,borderRadius:10,padding:"1px 8px",fontSize:10,fontWeight:600}}>{rol.icon} {rol.label}</span>
                    <span style={{background:isGlobal?"#e8f8f5":"#eef2f5",color:isGlobal?"#16a085":"#556",border:"1px solid #e0e0e0",borderRadius:10,padding:"1px 8px",fontSize:10,fontWeight:600}}>
                      {isGlobal?"GLOBAL":`${(u.cdtClave||u.cdtId||"SIN CDT").toUpperCase()}${u.cdtNombre?` — ${u.cdtNombre}`:""}`}
                    </span>
                    <span style={{background:u.activo?"#eafaf1":"#fdedec",color:u.activo?"#27ae60":"#e74c3c",border:`1px solid ${u.activo?"#a9dfbf":"#f5c6c6"}`,borderRadius:10,padding:"1px 8px",fontSize:10,fontWeight:600}}>{u.activo?"● Activa":"● Deshabilitada"}</span>
                  </div>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                <div>
                  <label style={{...LBL,fontSize:9}}>Rol</label>
                  <select value={u.rol||"trabajador"} onChange={e=>cambiarRol(u,e.target.value)} style={{...INP,padding:"6px 8px",fontSize:12}}>
                    {ROLES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{...LBL,fontSize:9}}>CDT</label>
                  <select value={u.cdtId||""} disabled={isGlobal} onChange={e=>cambiarCdt(u,e.target.value)} style={{...INP,padding:"6px 8px",fontSize:12,background:isGlobal?"#f0f0f0":"#fff"}}>
                    <option value="">Sin CDT</option>
                    {cdts.map(c=><option key={c.id} value={c.id}>{(c.clave||c.id).toUpperCase()} — {c.nombre||c.id}</option>)}
                  </select>
                </div>
              </div>

              {isChangingPass && (
                <div style={{background:"#f9f9f9",borderRadius:8,padding:"10px",marginBottom:10,border:"1px solid #e0e0e0"}}>
                  <div style={{fontSize:11,color:"#666",marginBottom:6,fontWeight:600}}>NUEVA CONTRASEÑA</div>
                  <div style={{display:"flex",gap:6}}>
                    <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" style={{...INP,flex:1,fontSize:13,padding:"7px 10px"}}/>
                    <button onClick={()=>cambiarPassword(u)} disabled={saving} style={{padding:"7px 12px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,flexShrink:0}}>Guardar</button>
                    <button onClick={()=>{setChangingPass(null);setNewPass("");}} style={{padding:"7px 10px",border:"1px solid #e0e0e0",borderRadius:8,background:"transparent",color:"#aaa",cursor:"pointer",fontSize:12,flexShrink:0}}>✕</button>
                  </div>
                </div>
              )}

              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <button onClick={()=>toggleActivo(u)} style={{flex:1,padding:"7px 8px",border:`1px solid ${u.activo?"#f39c12":"#27ae60"}`,borderRadius:8,background:"transparent",color:u.activo?"#f39c12":"#27ae60",cursor:"pointer",fontSize:11,fontWeight:600}}>{u.activo?"⊘ Deshabilitar":"✓ Habilitar"}</button>
                <button onClick={()=>{setChangingPass(isChangingPass?null:u.id);setNewPass("");}} style={{flex:1,padding:"7px 8px",border:"1px solid #2980b9",borderRadius:8,background:"#eaf4fb",color:"#2980b9",cursor:"pointer",fontSize:11,fontWeight:600}}>🔑 Contraseña</button>
                <button onClick={()=>eliminarUsuario(u)} style={{padding:"7px 10px",border:"1px solid #e0e0e0",borderRadius:8,background:"transparent",color:"#aaa",cursor:"pointer",fontSize:11}}>✕</button>
              </div>

              {u.passwordHint&&<div style={{fontSize:10,color:"#aaa",marginTop:6}}>🔑 {u.passwordHint}</div>}
              <div style={{fontSize:10,color:"#bbb",marginTop:4}}>Creada: {u.createdAt ? new Date(u.createdAt).toLocaleDateString("es-MX") : "—"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
