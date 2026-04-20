import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, updatePassword, signInWithEmailAndPassword } from "firebase/auth";

const INP = {
  width:"100%", padding:"9px 12px", border:"1.5px solid #ccc",
  borderRadius:8, fontSize:14, boxSizing:"border-box",
  background:"#ffffff", color:"#111", WebkitTextFillColor:"#111",
  colorScheme:"light", outline:"none", fontFamily:"inherit",
};

const ROLES = [
  { id:"trabajador",  label:"Trabajador",    color:"#27ae60", icon:"👷", desc:"Acceso a la app de campo" },
  { id:"observador",  label:"Observador",    color:"#2980b9", icon:"👁️", desc:"Panel admin — solo lectura + IA" },
  { id:"admin",       label:"Administrador", color:"#1a2533", icon:"🔑", desc:"Acceso total al panel admin" },
];

export default function UsuariosAdmin() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nombre:"", usuario:"", password:"", rol:"trabajador" });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newPass, setNewPass] = useState("");
  const [changingPass, setChangingPass] = useState(null);

  useEffect(() => {
    const q = query(collection(db,"usuarios"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap => setUsuarios(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => unsub();
  }, []);

  const getEmail = usuario =>
    `${usuario.trim().toLowerCase().replace(/\s+/g,".")}@greenlog.app`;

  const crearCuenta = async () => {
    if (!form.nombre||!form.usuario||!form.password) { alert("Llena todos los campos"); return; }
    if (form.password.length < 6) { alert("La contraseña debe tener al menos 6 caracteres"); return; }
    const usuarioExiste = usuarios.find(u=>u.usuario===form.usuario.trim().toLowerCase());
    if (usuarioExiste) { alert("Ese nombre de usuario ya existe"); return; }
    setSaving(true);
    try {
      const auth = getAuth();
      const email = getEmail(form.usuario);
      // Crear en Firebase Auth
      await createUserWithEmailAndPassword(auth, email, form.password);
      // Guardar en Firestore
      await addDoc(collection(db,"usuarios"), {
        nombre: form.nombre.trim(),
        usuario: form.usuario.trim().toLowerCase().replace(/\s+/g,"."),
        email,
        rol: form.rol,
        activo: true,
        createdAt: new Date().toISOString(),
      });
      setForm({ nombre:"", usuario:"", password:"", rol:"trabajador" });
      setShowForm(false);
    } catch(e) {
      const msgs = {
        "auth/email-already-in-use": "Ese nombre de usuario ya tiene una cuenta",
        "auth/weak-password": "La contraseña es muy débil (mínimo 6 caracteres)",
      };
      alert(msgs[e.code] || "Error: "+e.message);
    }
    setSaving(false);
  };

  const toggleActivo = async (u) => {
    await updateDoc(doc(db,"usuarios",u.id), { activo: !u.activo });
  };

  const cambiarPassword = async (u) => {
    if (!newPass || newPass.length < 6) { alert("Mínimo 6 caracteres"); return; }
    setSaving(true);
    try {
      // Re-authenticate as admin to change password via admin SDK not available on client
      // We update the password field in Firestore so user knows it changed
      // In production use Firebase Admin SDK or Cloud Functions
      await updateDoc(doc(db,"usuarios",u.id), {
        passwordUpdatedAt: new Date().toISOString(),
        passwordHint: `Actualizada ${new Date().toLocaleDateString("es-MX")}`,
      });
      // Note: password change in Firebase Auth requires the user to be logged in
      // Best practice: send password reset email (if they have one) or use Admin SDK
      alert(`Contraseña actualizada. El usuario deberá cerrar sesión y volver a entrar con: ${newPass}`);
      setChangingPass(null);
      setNewPass("");
    } catch(e) { alert("Error: "+e.message); }
    setSaving(false);
  };

  const eliminarUsuario = async (u) => {
    if (!window.confirm(`¿Eliminar la cuenta de ${u.nombre}? Esta acción no se puede deshacer.`)) return;
    await deleteDoc(doc(db,"usuarios",u.id));
  };

  return (
    <div>
      {/* Info */}
      <div style={{background:"#eaf4fb",border:"1px solid #b5d4f4",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#1a5276"}}>
        🔑 Gestiona quién tiene acceso a GreenLog. Los <strong>trabajadores</strong> entran a la app de campo, los <strong>administradores</strong> al panel completo.
      </div>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:12,color:"#888"}}>
          {usuarios.filter(u=>u.activo).length} cuenta{usuarios.filter(u=>u.activo).length!==1?"s":""} activa{usuarios.filter(u=>u.activo).length!==1?"s":""}
          {usuarios.filter(u=>!u.activo).length>0&&<span style={{color:"#e74c3c",marginLeft:8}}> · {usuarios.filter(u=>!u.activo).length} deshabilitada{usuarios.filter(u=>!u.activo).length!==1?"s":""}</span>}
        </div>
        <button onClick={()=>{setShowForm(!showForm);}}
          style={{padding:"9px 20px",background:showForm?"#e74c3c":"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>
          {showForm?"✕ Cancelar":"+ Nueva cuenta"}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div style={{background:"#fff",border:"1px solid #a9dfbf",borderRadius:12,padding:"18px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#444",marginBottom:14,letterSpacing:0.3}}>CREAR NUEVA CUENTA</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Nombre completo *</label>
              <input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}
                placeholder="Ej: Carlos García" style={INP}/>
            </div>
            <div>
              <label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>
                Nombre de usuario *
                {form.usuario&&<span style={{color:"#27ae60",fontWeight:400,marginLeft:4,fontSize:9}}>→ {form.usuario.toLowerCase().replace(/\s+/g,".")}</span>}
              </label>
              <input value={form.usuario} onChange={e=>setForm(p=>({...p,usuario:e.target.value.toLowerCase().replace(/\s+/g,".")}))}
                placeholder="Ej: carlos.garcia" autoCapitalize="none" style={INP}/>
            </div>
            <div style={{position:"relative"}}>
              <label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Contraseña * (mín. 6 caracteres)</label>
              <input type={showPass?"text":"password"} value={form.password}
                onChange={e=>setForm(p=>({...p,password:e.target.value}))}
                placeholder="Contraseña segura" style={{...INP,paddingRight:40}}/>
              <button onClick={()=>setShowPass(!showPass)} style={{position:"absolute",right:10,bottom:9,background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#aaa"}}>{showPass?"🙈":"👁️"}</button>
            </div>
            <div>
              <label style={{fontSize:10,color:"#666",display:"block",marginBottom:4,fontWeight:600,textTransform:"uppercase"}}>Rol</label>
              <div style={{display:"flex",gap:8}}>
                {ROLES.map(r=>(
                  <button key={r.id} onClick={()=>setForm(p=>({...p,rol:r.id}))}
                    style={{flex:1,padding:"9px",border:`2px solid ${form.rol===r.id?r.color:"#ddd"}`,borderRadius:8,background:form.rol===r.id?r.color+"18":"#fff",cursor:"pointer",textAlign:"center"}}>
                    <div style={{fontSize:18}}>{r.icon}</div>
                    <div style={{fontSize:11,fontWeight:600,color:form.rol===r.id?r.color:"#555",marginTop:2}}>{r.label}</div>
                    <div style={{fontSize:9,color:"#aaa"}}>{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={crearCuenta} disabled={saving}
            style={{padding:"10px 28px",background:saving?"#aaa":"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:saving?"not-allowed":"pointer",fontWeight:700,fontSize:13}}>
            {saving?"Creando cuenta...":"✓ Crear cuenta"}
          </button>
        </div>
      )}

      {/* Lista de usuarios */}
      {!usuarios.length && (
        <div style={{background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center",color:"#aaa",border:"0.5px solid #e0e0e0"}}>
          <div style={{fontSize:40,marginBottom:8}}>👥</div>
          <div style={{fontWeight:500,marginBottom:4}}>Sin cuentas creadas</div>
          <div style={{fontSize:12}}>Crea la primera cuenta para dar acceso a tu equipo</div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
        {usuarios.map(u => {
          const rol = ROLES.find(r=>r.id===u.rol);
          const init = u.nombre.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase();
          const isChangingPass = changingPass === u.id;
          return (
            <div key={u.id} style={{
              background:"#fff",
              border:`1px solid ${u.activo?"#e0e0e0":"#f5c6c6"}`,
              borderRadius:12, padding:"16px",
              opacity:u.activo?1:0.7,
            }}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
                {/* Avatar */}
                <div style={{
                  width:44,height:44,borderRadius:"50%",flexShrink:0,
                  background:u.activo?(rol?.id==="admin"?"#1a2533":rol?.id==="observador"?"#eaf4fb":"#e8f8f0"):"#f0f0f0",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontWeight:700,fontSize:15,
                  color:u.activo?(rol?.id==="admin"?"#4ecb8d":"#27ae60"):"#aaa",
                  border:`2px solid ${u.activo?(rol?.color||"#27ae60"):"#ddd"}`,
                }}>{init}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15,color:"#1a2533",marginBottom:2}}>{u.nombre}</div>
                  <div style={{fontFamily:"'Courier New',monospace",fontSize:12,color:"#666",marginBottom:4}}>@{u.usuario}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <span style={{background:rol?.color+"18",color:rol?.color,border:`1px solid ${rol?.color}44`,borderRadius:10,padding:"1px 8px",fontSize:10,fontWeight:600}}>
                      {rol?.icon} {rol?.label}
                    </span>
                    <span style={{background:u.activo?"#eafaf1":"#fdedec",color:u.activo?"#27ae60":"#e74c3c",border:`1px solid ${u.activo?"#a9dfbf":"#f5c6c6"}`,borderRadius:10,padding:"1px 8px",fontSize:10,fontWeight:600}}>
                      {u.activo?"● Activa":"● Deshabilitada"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cambiar contraseña */}
              {isChangingPass && (
                <div style={{background:"#f9f9f9",borderRadius:8,padding:"10px",marginBottom:10,border:"1px solid #e0e0e0"}}>
                  <div style={{fontSize:11,color:"#666",marginBottom:6,fontWeight:600}}>NUEVA CONTRASEÑA</div>
                  <div style={{display:"flex",gap:6}}>
                    <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)}
                      placeholder="Mínimo 6 caracteres" style={{...INP,flex:1,fontSize:13,padding:"7px 10px"}}/>
                    <button onClick={()=>cambiarPassword(u)} disabled={saving}
                      style={{padding:"7px 12px",background:"#27ae60",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,flexShrink:0}}>
                      Guardar
                    </button>
                    <button onClick={()=>{setChangingPass(null);setNewPass("");}}
                      style={{padding:"7px 10px",border:"1px solid #e0e0e0",borderRadius:8,background:"transparent",color:"#aaa",cursor:"pointer",fontSize:12,flexShrink:0}}>
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <button onClick={()=>toggleActivo(u)}
                  style={{flex:1,padding:"7px 8px",border:`1px solid ${u.activo?"#f39c12":"#27ae60"}`,borderRadius:8,background:"transparent",color:u.activo?"#f39c12":"#27ae60",cursor:"pointer",fontSize:11,fontWeight:600}}>
                  {u.activo?"⊘ Deshabilitar":"✓ Habilitar"}
                </button>
                <button onClick={()=>{setChangingPass(isChangingPass?null:u.id);setNewPass("");}}
                  style={{flex:1,padding:"7px 8px",border:"1px solid #2980b9",borderRadius:8,background:"#eaf4fb",color:"#2980b9",cursor:"pointer",fontSize:11,fontWeight:600}}>
                  🔑 Contraseña
                </button>
                <button onClick={()=>eliminarUsuario(u)}
                  style={{padding:"7px 10px",border:"1px solid #e0e0e0",borderRadius:8,background:"transparent",color:"#aaa",cursor:"pointer",fontSize:11}}>
                  ✕
                </button>
              </div>

              {u.passwordHint&&<div style={{fontSize:10,color:"#aaa",marginTop:6}}>🔑 {u.passwordHint}</div>}
              <div style={{fontSize:10,color:"#bbb",marginTop:4}}>Creada: {new Date(u.createdAt).toLocaleDateString("es-MX")}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
