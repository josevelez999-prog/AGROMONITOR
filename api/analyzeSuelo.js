// Análisis de suelo con IA
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const apiKey = process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(200).json({ error: "🔑 ANTHROPIC_KEY no configurada en Vercel." });
    if (!apiKey.startsWith("sk-ant-")) return res.status(200).json({ error: "🔑 ANTHROPIC_KEY inválida. Regenera en console.anthropic.com" });

    const { datos, cultivo } = req.body || {};
    if (!datos) return res.status(400).json({ error: "Falta 'datos' del análisis de suelo" });

    const prompt = `Eres un agrónomo experto en suelos. Analiza estos resultados de laboratorio para un cultivo de ${cultivo || "hortalizas"} y dime:

Datos del análisis:
${typeof datos === "string" ? datos : JSON.stringify(datos, null, 2)}

Responde con esta estructura:

📊 INTERPRETACIÓN GENERAL
[Resumen del estado del suelo]

⚠ PROBLEMAS DETECTADOS
• [Problema 1]
• [Problema 2]

✅ NUTRIENTES EN RANGO ÓPTIMO
• [Listado]

💡 RECOMENDACIONES ESPECÍFICAS
1. [Acción]
2. [Acción]
3. [Acción]

🌱 FERTILIZACIÓN SUGERIDA
[Plan de fertilización específico]

Sé práctico y orientado a acción.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role:"user", content: prompt }],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let msg = "Error API Claude " + resp.status;
      if (resp.status === 401) msg = "🔑 API Key inválida o expirada. Regenera en console.anthropic.com";
      else if (resp.status === 429) msg = "⏱ Demasiadas consultas. Espera 1 minuto.";
      else if (resp.status === 529) msg = "🔧 Anthropic sobrecargado. Intenta en 30s.";
      return res.status(200).json({ error: msg });
    }

    const data = await resp.json();
    let texto = "";
    if (Array.isArray(data.content)) {
      for (const b of data.content) if (b.type === "text") texto += b.text;
    }
    if (!texto) return res.status(200).json({ error: "Claude no devolvió respuesta. Intenta de nuevo." });
    return res.status(200).json({ response: texto, text: texto });
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") return res.status(200).json({ error: "⏱ Tardó demasiado, reintenta." });
    return res.status(200).json({ error: "Error: " + (e?.message || String(e)) });
  }
}
