// Asistente general AI
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const apiKey = process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(200).json({ error: "🔑 ANTHROPIC_KEY no configurada en Vercel." });
    if (!apiKey.startsWith("sk-ant-")) return res.status(200).json({ error: "🔑 ANTHROPIC_KEY inválida." });

    const { prompt, contexto } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Falta 'prompt'" });

    const fullPrompt = `Eres un asistente agronómico experto. Responde en español de forma clara y práctica.
${contexto ? `\nContexto: ${contexto}\n` : ""}
Pregunta del usuario: ${prompt}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role:"user", content: fullPrompt }],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!resp.ok) {
      let msg = "Error API Claude " + resp.status;
      if (resp.status === 401) msg = "🔑 API Key inválida o expirada.";
      else if (resp.status === 429) msg = "⏱ Demasiadas consultas.";
      else if (resp.status === 529) msg = "🔧 Anthropic sobrecargado.";
      return res.status(200).json({ error: msg });
    }

    const data = await resp.json();
    let texto = "";
    if (Array.isArray(data.content)) for (const b of data.content) if (b.type === "text") texto += b.text;
    if (!texto) return res.status(200).json({ error: "Sin respuesta." });
    return res.status(200).json({ response: texto, text: texto });
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") return res.status(200).json({ error: "⏱ Tardó demasiado." });
    return res.status(200).json({ error: "Error: " + (e?.message || String(e)) });
  }
}
