// Serverless function: Usa Claude API con web search para investigar
// precios actuales de cultivos en Michoacán

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const apiKey = process.env.ANTHROPIC_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        success: false,
        message: "ANTHROPIC_KEY no configurada en Vercel",
        prices: {},
        timestamp: new Date().toISOString(),
      });
    }

    const fechaHoy = new Date().toLocaleDateString("es-MX", { day:"numeric", month:"long", year:"numeric" });

    const prompt = `Necesito los precios actuales de mercado para hoy ${fechaHoy} de estos 4 cultivos en Michoacán (preferentemente Morelia, sino estado completo, sino promedio nacional México):

1. Jitomate (saladette o bola)
2. Fresa
3. Arándano (blueberry)
4. Zarzamora

Busca en fuentes confiables: SNIIM, PROFECO, Central de Abastos, Mercado Juárez Toluca, Walmart, Soriana, reportes de noticias agrícolas recientes (última semana). Promedia precios de menudeo en $MXN por kilogramo.

Responde ÚNICAMENTE con un JSON válido en este formato exacto, sin texto adicional, sin markdown:

{
  "jitomate": { "min": 25.0, "prom": 35.0, "max": 50.0, "fuente": "descripción breve", "cobertura": "morelia|michoacan|nacional" },
  "fresa":    { "min": 40.0, "prom": 60.0, "max": 90.0, "fuente": "...", "cobertura": "..." },
  "arandano": { "min": 80.0, "prom": 120.0, "max": 180.0, "fuente": "...", "cobertura": "..." },
  "zarzamora":{ "min": 60.0, "prom": 90.0, "max": 130.0, "fuente": "...", "cobertura": "..." }
}

Si no encuentras un cultivo, omítelo del JSON (no inventes precios). Solo responde el JSON, nada más.`;

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      return res.status(200).json({
        success: false,
        message: "Error API Claude: " + claudeResp.status + " " + errText.slice(0,200),
        prices: {},
        timestamp: new Date().toISOString(),
      });
    }

    const data = await claudeResp.json();
    // Buscar el bloque de texto final en la respuesta de Claude
    let textoFinal = "";
    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "text") textoFinal += block.text;
      }
    }

    // Extraer JSON del texto (puede venir con texto antes/después)
    const jsonMatch = textoFinal.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({
        success: false,
        message: "Claude no devolvió JSON parseable. Respuesta: " + textoFinal.slice(0,300),
        prices: {},
        timestamp: new Date().toISOString(),
      });
    }

    let prices;
    try {
      prices = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(200).json({
        success: false,
        message: "JSON inválido de Claude: " + e.message,
        prices: {},
        timestamp: new Date().toISOString(),
      });
    }

    // Validar y limpiar precios
    const valid = {};
    for (const [k, v] of Object.entries(prices)) {
      if (v && typeof v === "object" && (v.min || v.prom || v.max)) {
        valid[k] = {
          min:  Number(parseFloat(v.min  || v.prom || 0).toFixed(2)),
          prom: Number(parseFloat(v.prom || (((v.min||0)+(v.max||0))/2)).toFixed(2)),
          max:  Number(parseFloat(v.max  || v.prom || 0).toFixed(2)),
          fuente: String(v.fuente || "IA").slice(0,200),
          cobertura: v.cobertura || "nacional",
        };
      }
    }

    if (!Object.keys(valid).length) {
      return res.status(200).json({
        success: false,
        message: "Claude no encontró precios verificables hoy",
        prices: {},
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      prices: valid,
      timestamp: new Date().toISOString(),
      source: "Claude AI + Web Search",
    });
  } catch (e) {
    return res.status(200).json({
      success: false,
      message: "Error: " + (e?.message || String(e)),
      prices: {},
      timestamp: new Date().toISOString(),
    });
  }
}
