// Serverless function: SNIIM - Sistema Nacional de Información de Mercados
// Múltiples endpoints conocidos y fallback nacional cuando Morelia no disponible

const CROPS_SNIIM = {
  jitomate:  { keywords: ["jitomate","tomate saladette","tomate bola"] },
  fresa:     { keywords: ["fresa","frutilla"] },
  arandano:  { keywords: ["arándano","arandano","blueberry"] },
  zarzamora: { keywords: ["zarzamora","mora"] },
};

const ENDPOINTS_SNIIM = [
  // Reportes diarios
  () => "http://www.economia-sniim.gob.mx/SNIIM-AN/Frutas/Frutas.asp",
  () => "http://www.economia-sniim.gob.mx/Sniim-anANT/e_SelFrutas.asp",
  () => "http://www.economia-sniim.gob.mx/sniimtomate.asp",
  () => "http://www.economia-sniim.gob.mx/SNIIM-AN/jiss2.asp",
  () => "http://www.economia-sniim.gob.mx/Precios_de_Hortalizas_en_Mexico.htm",
];

async function fetchEndpoint(url) {
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AgromonitorBot/1.0)",
        "Accept": "text/html,*/*",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch (e) { return null; }
}

function extractPrices(html, keywords) {
  if (!html || typeof html !== "string") return [];
  if (html.toLowerCase().includes("mantenimiento")) return [];

  const matches = [];
  const lower = html.toLowerCase();

  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    let idx = lower.indexOf(kwLower);
    while (idx !== -1 && matches.length < 50) {
      const ventana = html.slice(Math.max(0,idx-200), idx+800);
      const lowerVentana = ventana.toLowerCase();

      // Buscar precios (decimales realistas $5-$200/kg)
      const precioRegex = /\$?\s*(\d{1,3}\.\d{1,2})|\s(\d{2,3})\s/g;
      const allMatches = [...ventana.matchAll(precioRegex)];

      for (const m of allMatches.slice(0, 6)) {
        const numStr = m[1] || m[2];
        const p = parseFloat(numStr);
        if (p > 5 && p < 200) {
          const isMorelia = lowerVentana.includes("morelia") || lowerVentana.includes("michoac");
          matches.push({
            nombre: kw,
            ciudad: isMorelia ? "morelia" : "nacional",
            precio: p,
            esMorelia: isMorelia,
          });
        }
      }
      idx = lower.indexOf(kwLower, idx + kwLower.length);
    }
  }
  return matches;
}

function calcularEstadisticas(matches, soloMorelia=false) {
  let filtrados = matches;
  if (soloMorelia) filtrados = matches.filter(m => m.esMorelia);
  if (!filtrados.length) filtrados = matches;

  const precios = filtrados.map(m => m.precio).sort((a,b)=>a-b);
  // Quitar outliers
  const start = Math.floor(precios.length * 0.1);
  const end = Math.ceil(precios.length * 0.9);
  const limpios = precios.slice(start, end);
  if (!limpios.length) return null;

  return {
    min: Number(Math.min(...limpios).toFixed(2)),
    max: Number(Math.max(...limpios).toFixed(2)),
    prom: Number((limpios.reduce((s,p)=>s+p,0) / limpios.length).toFixed(2)),
    muestras: limpios.length,
    cobertura: soloMorelia && filtrados.length === matches.filter(m=>m.esMorelia).length ? "morelia" : "nacional",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");

  const debug = req.query?.debug === "1";
  const log = [];
  const prices = {};
  let inMaintenance = false;

  try {
    // Recolectar HTML de todos los endpoints
    const allHtml = [];
    for (const endpointFn of ENDPOINTS_SNIIM) {
      const url = endpointFn();
      const html = await fetchEndpoint(url);
      if (html) {
        if (html.toLowerCase().includes("mantenimiento")) {
          inMaintenance = true;
          log.push(`${url} → MANTENIMIENTO`);
        } else {
          allHtml.push(html);
          log.push(`${url} → ${html.length} bytes`);
        }
      } else {
        log.push(`${url} → falló`);
      }
    }

    if (!allHtml.length) {
      return res.status(200).json({
        success: false,
        message: inMaintenance
          ? "SNIIM está en mantenimiento. Intenta más tarde o captura manualmente."
          : "SNIIM no respondió. Captura manualmente.",
        prices: {},
        timestamp: new Date().toISOString(),
        ...(debug && { log }),
      });
    }

    const combinedHtml = allHtml.join("\n");
    for (const cropKey of Object.keys(CROPS_SNIIM)) {
      const config = CROPS_SNIIM[cropKey];
      const allMatches = extractPrices(combinedHtml, config.keywords);
      if (allMatches.length) {
        let stats = calcularEstadisticas(allMatches, true);
        if (!stats || stats.muestras < 2) stats = calcularEstadisticas(allMatches, false);
        if (stats) prices[cropKey] = stats;
      }
    }

    if (!Object.keys(prices).length) {
      return res.status(200).json({
        success: false,
        message: "SNIIM no devolvió precios parseables.",
        prices: {},
        timestamp: new Date().toISOString(),
        ...(debug && { log }),
      });
    }

    return res.status(200).json({
      success: true,
      prices,
      timestamp: new Date().toISOString(),
      source: "SNIIM - Sistema Nacional",
      ...(debug && { log }),
    });
  } catch (e) {
    return res.status(200).json({
      success: false,
      message: e.message,
      prices: {},
      timestamp: new Date().toISOString(),
    });
  }
}
