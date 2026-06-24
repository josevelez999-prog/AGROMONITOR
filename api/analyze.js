// Diagnóstico visual de plantas - devuelve JSON estructurado para la UI

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo POST" });
  }

  try {
    const apiKey = process.env.ANTHROPIC_KEY 
                || process.env.ANTHROPIC_API_KEY
                || process.env.VITE_ANTHROPIC_API_KEY 
                || process.env.VITE_ANTHROPIC_KEY;
    
    if (!apiKey) return res.status(200).json({ error: "🔑 ANTHROPIC_KEY no configurada en Vercel." });
    if (!apiKey.startsWith("sk-ant-")) return res.status(200).json({ error: "🔑 ANTHROPIC_KEY inválida. Regenera en console.anthropic.com" });

    const { crop, zone, worker, ph, ce, notes, imageBase64, imageMediaType } = req.body || {};

    if (!crop) return res.status(400).json({ error: "Falta el cultivo" });
    if (!imageBase64) return res.status(400).json({ error: "Falta la imagen" });

    const prompt = `Eres un fitopatólogo experto en cultivos hidropónicos en México. Analiza la foto de esta planta y responde con un diagnóstico estructurado.

Datos del registro:
- Cultivo: ${crop}
${zone ? `- Zona: ${zone}` : ""}
${worker ? `- Trabajador: ${worker}` : ""}
${ph ? `- pH: ${ph}` : ""}
${ce ? `- CE: ${ce} mS/cm` : ""}
${notes ? `- Observaciones: ${notes}` : ""}

Considera: deficiencias nutricionales, exceso de fertilización, plagas, enfermedades fúngicas/bacterianas/virales y problemas de pH/CE.

Responde ÚNICAMENTE con un JSON en este formato exacto, sin texto antes ni después, sin markdown, sin bloque de código:

{
  "diagnostico": "1-2 líneas con el problema principal detectado",
  "causas": ["Causa 1 específica", "Causa 2", "Causa 3"],
  "acciones": ["Acción inmediata 1 con detalle", "Acción 2", "Acción 3", "Acción 4"],
  "prevencion": "1-2 líneas de prevención a futuro",
  "urgencia": "Baja | Media | Alta | Crítica - con breve justificación"
}

Sé práctico y específico. Si la imagen no es clara o no muestra la planta, indícalo en el diagnóstico.`;

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            { type:"image", source:{ type:"base64", media_type:imageMediaType||"image/jpeg", data:imageBase64 } },
            { type:"text", text:prompt },
          ],
        }],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      let msg = "Error API Claude " + claudeResp.status;
      if (claudeResp.status === 401) msg = "🔑 API Key inválida o expirada. Regenera en console.anthropic.com";
      else if (claudeResp.status === 429) msg = "⏱ Demasiadas consultas. Espera 1 minuto.";
      else if (claudeResp.status === 529) msg = "🔧 Anthropic sobrecargado. Intenta en 30s.";
      else if (claudeResp.status === 400) msg = "📝 Error: " + errText.slice(0,200);
      return res.status(200).json({ error: msg });
    }

    const data = await claudeResp.json();
    let textoFinal = "";
    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "text") textoFinal += block.text;
      }
    }
    
    if (!textoFinal) return res.status(200).json({ error: "Claude no devolvió texto." });

    // Intentar parsear JSON
    const tryParse = (str) => { try { return JSON.parse(str); } catch { return null; } };
    const jsonMatch = textoFinal.match(/\{[\s\S]*\}/);
    let parsed = jsonMatch ? tryParse(jsonMatch[0]) : null;
    
    // Reparaciones
    if (!parsed && jsonMatch) {
      let r = jsonMatch[0]
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/,(\s*[\]}])/g, "$1");
      parsed = tryParse(r);
    }

    // Fallback: si JSON falla, construir desde texto plano usando secciones
    if (!parsed) {
      const extractSection = (label) => {
        const re = new RegExp(`${label}[\\s\\S]{0,500}?(?=\\n\\n|🔍|🎯|💊|🛡|⚠|$)`, "i");
        const m = textoFinal.match(re);
        return m ? m[0].replace(new RegExp(label, "i"), "").trim() : "";
      };
      parsed = {
        diagnostico: extractSection("diagnóstico|diagnostico").slice(0, 300) || textoFinal.slice(0, 200),
        causas: extractSection("causas").split(/\n|•|-|\d+\./).filter(s=>s.trim().length>5).slice(0,5),
        acciones: extractSection("acciones").split(/\n|\d+\./).filter(s=>s.trim().length>5).slice(0,5),
        prevencion: extractSection("prevención|prevencion").slice(0, 300),
        urgencia: extractSection("urgencia").slice(0, 200) || "Media",
      };
    }

    // Limpiar y normalizar
    const result = {
      diagnostico: String(parsed.diagnostico || parsed.diagnosis || "Sin diagnóstico").slice(0, 500),
      causas: Array.isArray(parsed.causas) ? parsed.causas.slice(0, 8).map(c => String(c).slice(0, 300)) : [],
      acciones: Array.isArray(parsed.acciones) ? parsed.acciones.slice(0, 8).map(a => String(a).slice(0, 400)) : [],
      prevencion: String(parsed.prevencion || parsed.prevention || "").slice(0, 500),
      urgencia: String(parsed.urgencia || parsed.urgency || "Media").slice(0, 200),
      raw: textoFinal,
    };

    return res.status(200).json(result);
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") return res.status(200).json({ error: "⏱ La consulta tardó demasiado. Reduce el tamaño de la foto e intenta de nuevo." });
    return res.status(200).json({ error: "Error interno: " + (e?.message || String(e)) });
  }
}
