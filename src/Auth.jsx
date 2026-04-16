import { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const INP = {
  width:"100%", padding:"14px 16px", border:"1.5px solid #ddd",
  borderRadius:12, fontSize:16, boxSizing:"border-box",
  background:"#ffffff", color:"#111", WebkitTextFillColor:"#111",
  colorScheme:"light", outline:"none", fontFamily:"inherit",
  transition:"border-color 0.2s",
};

export default function LoginScreen() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const login = async () => {
    if (!usuario.trim() || !password) { setError("Ingresa usuario y contraseña"); return; }
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      // Firebase Auth usa email — internamente guardamos usuario@greenlog.app
      const email = usuario.trim().toLowerCase().includes("@")
        ? usuario.trim()
        : `${usuario.trim().toLowerCase().replace(/\s+/g,".")}@greenlog.app`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      const msgs = {
        "auth/user-not-found": "Usuario no encontrado",
        "auth/wrong-password": "Contraseña incorrecta",
        "auth/invalid-credential": "Usuario o contraseña incorrectos",
        "auth/too-many-requests": "Demasiados intentos. Espera un momento.",
        "auth/user-disabled": "Esta cuenta está deshabilitada",
      };
      setError(msgs[e.code] || "Error al iniciar sesión");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(160deg,#0f1e2e 0%,#1a3a2a 100%)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:24,
    }}>
      <div style={{
        background:"#fff", borderRadius:20, padding:36,
        maxWidth:380, width:"100%",
        boxShadow:"0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{
            width:72, height:72, borderRadius:20,
            background:"linear-gradient(135deg,#1a2533,#27ae60)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:32, margin:"0 auto 12px",
            boxShadow:"0 4px 16px rgba(39,174,96,0.3)"
          }}>🌿</div>
          <div style={{fontWeight:700,fontSize:26,color:"#1a2533",letterSpacing:-0.5}}>GreenLog</div>
          <div style={{fontSize:13,color:"#aaa",marginTop:2}}>Sistema de monitoreo agrícola</div>
        </div>

        {/* Form */}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,color:"#666",display:"block",marginBottom:6,fontWeight:600,letterSpacing:0.5,textTransform:"uppercase",fontFamily:"'Courier New',monospace"}}>
            Usuario
          </label>
          <input
            value={usuario}
            onChange={e=>{setUsuario(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&login()}
            placeholder="Ej: carlos.garcia"
            autoCapitalize="none"
            style={{...INP, borderColor:error?"#e74c3c":"#ddd"}}
          />
        </div>

        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,color:"#666",display:"block",marginBottom:6,fontWeight:600,letterSpacing:0.5,textTransform:"uppercase",fontFamily:"'Courier New',monospace"}}>
            Contraseña
          </label>
          <div style={{position:"relative"}}>
            <input
              type={showPass?"text":"password"}
              value={password}
              onChange={e=>{setPassword(e.target.value);setError("");}}
              onKeyDown={e=>e.key==="Enter"&&login()}
              placeholder="••••••••"
              style={{...INP, paddingRight:48, borderColor:error?"#e74c3c":"#ddd"}}
            />
            <button
              onClick={()=>setShowPass(!showPass)}
              style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#aaa",padding:4}}>
              {showPass?"🙈":"👁️"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{background:"#fdedec",border:"1px solid #f5c6c6",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#c0392b",display:"flex",alignItems:"center",gap:8}}>
            <span>⚠</span> {error}
          </div>
        )}

        <button
          onClick={login}
          disabled={loading||!usuario.trim()||!password}
          style={{
            width:"100%", padding:"14px",
            background:loading||!usuario.trim()||!password
              ? "#d5e8d4"
              : "linear-gradient(135deg,#27ae60,#1e8449)",
            color: loading||!usuario.trim()||!password ? "#aaa" : "#fff",
            border:"none", borderRadius:12,
            cursor:loading||!usuario.trim()||!password?"not-allowed":"pointer",
            fontSize:16, fontWeight:700,
            boxShadow: loading||!usuario.trim()||!password ? "none" : "0 4px 14px rgba(39,174,96,0.35)",
            transition:"all 0.2s",
          }}>
          {loading ? "Entrando..." : "Iniciar sesión"}
        </button>

        <div style={{textAlign:"center",marginTop:20,fontSize:12,color:"#bbb"}}>
          Si no tienes acceso, contacta al encargado
        </div>
      </div>
    </div>
  );
}
