// Serverless function: Inteligencia de Mercado con Claude AI + Web Search
// Investiga precios actuales en Michoacán y devuelve precios + fuentes + resumen

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

Busca en fuentes confiables: SNIIM, PROFECO, Central de Abastos, Mercado Juárez Toluca, Walmart, Soriana, Bodega Aurrera, Chedraui, reportes de noticias agrícolas recientes (última semana). Promedia precios de menudeo en $MXN por kilogramo.

Responde ÚNICAMENTE con un JSON válido en este formato exacto, sin texto adicional, sin markdown, sin comentarios. Usa SOLO comillas dobles. No incluyas comas finales:

{"prices":{"jitomate":{"min":25.0,"prom":35.0,"max":50.0,"cobertura":"morelia"},"fresa":{"min":40.0,"prom":60.0,"max":90.0,"cobertura":"nacional"},"arandano":{"min":80.0,"prom":120.0,"max":180.0,"cobertura":"nacional"},"zarzamora":{"min":60.0,"prom":90.0,"max":130.0,"cobertura":"nacional"}},"fuentes":[{"nombre":"Nombre publicacion","url":"https://...","fecha":"DD-MM-YYYY","tipo":"noticia"}],"resumen":"Breve resumen 1-2 lineas"}

Si no encuentras un cultivo, omitelo del bloque prices (no inventes precios). Incluye TODAS las fuentes web reales que consultaste con su URL. Solo JSON, nada mas.`;

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(50000),
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
    let textoFinal = "";
    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "text") textoFinal += block.text;
      }
    }

    // Helper: intentar parsear JSON
    const tryParse = (str) => { try { return JSON.parse(str); } catch { return null; } };

    // Extraer JSON del texto
    const jsonMatch = textoFinal.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({
        success: false,
        message: "Claude no devolvio JSON. Respuesta: " + textoFinal.slice(0,300),
        prices: {},
        timestamp: new Date().toISOString(),
      });
    }

    let raw = jsonMatch[0];
    let parsed = tryParse(raw);

    // Reparaciones progresivas si el JSON está malformado
    if (!parsed) {
      // 1. Quitar comentarios
      let r = raw.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
      parsed = tryParse(r);
      // 2. Quitar comas finales
      if (!parsed) { r = r.replace(/,(\s*[\]}])/g, "$1"); parsed = tryParse(r); }
      // 3. Quitar saltos de línea dentro de strings (escape errado)
      if (!parsed) { r = r.replace(/\n\s*\"/g, " \""); parsed = tryParse(r); }
    }

    // Último recurso: extraer cultivos manualmente con regex
    if (!parsed) {
      const extracted = {};
      const cropPattern = /\"(jitomate|fresa|arandano|arándano|zarzamora)\"\s*:\s*\{[^{}]*?\"min\"\s*:\s*([\d.]+)[^{}]*?\"prom\"\s*:\s*([\d.]+)[^{}]*?\"max\"\s*:\s*([\d.]+)[^{}]*?(?:\"cobertura\"\s*:\s*\"([^\"]+)\")?/g;
      let m;
      while ((m = cropPattern.exec(raw)) !== null) {
        const key = m[1].replace("á","a");
        extracted[key] = {
          min: parseFloat(m[2]),
          prom: parseFloat(m[3]),
          max: parseFloat(m[4]),
          cobertura: m[5] || "nacional",
        };
      }
      if (Object.keys(extracted).length) {
        // Intentar extraer fuentes también con regex
        const fuentes = [];
        const fuentePattern = /\"nombre\"\s*:\s*\"([^\"]+)\"[^{}]*?\"url\"\s*:\s*\"([^\"]+)\"/g;
        let fm;
        while ((fm = fuentePattern.exec(raw)) !== null) {
          fuentes.push({ nombre: fm[1], url: fm[2], fecha: "", tipo: "noticia" });
        }
        parsed = { prices: extracted, fuentes, resumen: "Datos recuperados parcialmente" };
      }
    }

    if (!parsed) {
      return res.status(200).json({
        success: false,
        message: "JSON malformado no recuperable. Inicio: " + raw.slice(0,200),
        prices: {},
        timestamp: new Date().toISOString(),
      });
    }

    const pricesObj = parsed.prices || parsed;
    const fuentes   = Array.isArray(parsed.fuentes) ? parsed.fuentes : [];
    const resumen   = String(parsed.resumen || "").slice(0, 500);

    const valid = {};
    for (const [k, v] of Object.entries(pricesObj)) {
      if (v && typeof v === "object" && (v.min || v.prom || v.max)) {
        valid[k] = {
          min:  Number(parseFloat(v.min  || v.prom || 0).toFixed(2)),
          prom: Number(parseFloat(v.prom || (((v.min||0)+(v.max||0))/2)).toFixed(2)),
          max:  Number(parseFloat(v.max  || v.prom || 0).toFixed(2)),
          cobertura: v.cobertura || "nacional",
        };
      }
    }

    const fuentesLimpias = fuentes.slice(0, 10).map(f => ({
      nombre: String(f.nombre || f.name || "Fuente").slice(0,150),
      url:    String(f.url || "").slice(0,400),
      fecha:  String(f.fecha || f.date || "").slice(0,30),
      tipo:   String(f.tipo || f.type || "noticia").slice(0,30),
    })).filter(f => f.nombre);

    if (!Object.keys(valid).length) {
      return res.status(200).json({
        success: false,
        message: "Claude no encontró precios verificables hoy",
        prices: {},
        fuentes: fuentesLimpias,
        resumen,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      prices: valid,
      fuentes: fuentesLimpias,
      resumen,
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
