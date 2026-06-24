// Diagnóstico visual de plantas (foto + datos)
// Mejorado con validación robusta de API key y mensajes claros

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo se acepta POST" });
  }

  try {
    const apiKey = process.env.ANTHROPIC_KEY 
                || process.env.ANTHROPIC_API_KEY
                || process.env.VITE_ANTHROPIC_API_KEY 
                || process.env.VITE_ANTHROPIC_KEY;
    
    if (!apiKey) {
      return res.status(200).json({
        error: "🔑 ANTHROPIC_KEY no configurada en Vercel. Ve a Settings → Environment Variables, agrega ANTHROPIC_KEY con tu clave de Anthropic, marca Sensitive y vuelve a hacer deploy."
      });
    }
    if (!apiKey.startsWith("sk-ant-")) {
      return res.status(200).json({
        error: "🔑 ANTHROPIC_KEY inválida (debe empezar con sk-ant-). Regenera la clave en console.anthropic.com/settings/keys"
      });
    }

    const { crop, zone, worker, ph, ce, notes, imageBase64, imageMediaType } = req.body || {};

    if (!crop) {
      return res.status(400).json({ error: "Falta el campo 'crop'" });
    }

    const fechaHoy = new Date().toLocaleDateString("es-MX", { day:"numeric", month:"long", year:"numeric" });

    const textoPrompt = `Eres un fitopatólogo experto en cultivos hidropónicos en México. Diagnóstica el estado de esta planta basándote en la foto (si la hay) y los datos:

📅 Fecha: ${fechaHoy}
🌱 Cultivo: ${crop}
${zone ? `📍 Zona: ${zone}` : ""}
${worker ? `👤 Trabajador: ${worker}` : ""}
${ph ? `🧪 pH: ${ph}` : ""}
${ce ? `⚡ CE: ${ce} mS/cm` : ""}
${notes ? `📝 Observaciones: ${notes}` : ""}

Analiza considerando deficiencias nutricionales, exceso de fertilización, plagas, enfermedades fúngicas/bacterianas/virales comunes en este cultivo, y problemas de pH/CE.

Responde con esta estructura:

🔍 DIAGNÓSTICO PRINCIPAL
[2-3 líneas con el problema más probable y su causa]

🎯 CAUSAS PROBABLES
• [Causa 1 con explicación breve]
• [Causa 2]
• [Causa 3]

💊 ACCIONES INMEDIATAS (próximas 24-48 horas)
1. [Acción concreta]
2. [Acción concreta]
3. [Acción concreta]

🛡 PREVENCIÓN A FUTURO
[2-3 líneas de prevención]

⚠ NIVEL DE URGENCIA: [Bajo | Medio | Alto | Crítico]

Sé directo, práctico y específico. Si la foto está borrosa o no muestra el problema, dilo.`;

    const content = [];
    if (imageBase64) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: imageMediaType || "image/jpeg",
          data: imageBase64,
        },
      });
    }
    content.push({ type: "text", text: textoPrompt });

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
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      let userMessage = "Error API Claude " + claudeResp.status;
      if (claudeResp.status === 401) userMessage = "🔑 API Key inválida o expirada. Regenera la clave en console.anthropic.com y actualiza ANTHROPIC_KEY en Vercel.";
      else if (claudeResp.status === 429) userMessage = "⏱ Demasiadas consultas. Espera 1 minuto e intenta de nuevo.";
      else if (claudeResp.status === 529) userMessage = "🔧 Anthropic está sobrecargado temporalmente. Intenta en 30 segundos.";
      else if (claudeResp.status === 500) userMessage = "🔧 Error interno de Anthropic. Reintentar más tarde.";
      else if (claudeResp.status === 400) {
        try {
          const j = JSON.parse(errText);
          userMessage = "📝 " + (j.error?.message || errText.slice(0,200));
        } catch {
          userMessage = "📝 Error en la petición: " + errText.slice(0,200);
        }
      }
      return res.status(200).json({ error: userMessage });
    }

    const data = await claudeResp.json();
    let textoFinal = "";
    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "text") textoFinal += block.text;
      }
    }
    
    if (!textoFinal) {
      return res.status(200).json({ error: "Claude no devolvió texto. Intenta de nuevo." });
    }

    return res.status(200).json({ 
      response: textoFinal,
      text: textoFinal,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return res.status(200).json({ error: "⏱ La consulta tardó demasiado. Intenta de nuevo o reduce el tamaño de la foto." });
    }
    return res.status(200).json({ error: "Error interno: " + (e?.message || String(e)) });
  }
}
