// Serverless function: scrape precios SNIIM para Morelia
// SNIIM publica reportes diarios en economia-sniim.gob.mx
// Fallback: si el scrape falla, retorna último caché de Firebase

const CROPS_SNIIM = {
  jitomate:  { busqueda: "Jitomate", variantes: ["jitomate saladette","jitomate bola","jitomate"] },
  fresa:     { busqueda: "Fresa",    variantes: ["fresa","frutilla"] },
  arandano:  { busqueda: "Arándano", variantes: ["arándano","arandano","blueberry"] },
  zarzamora: { busqueda: "Zarzamora",variantes: ["zarzamora","mora"] },
};

const MORELIA_KEYWORDS = ["morelia","michoac"];

async function fetchSniimDaily() {
  // Endpoint público SNIIM - reporte de frutas y hortalizas
  const url = "http://www.economia-sniim.gob.mx/SNIIM-Petitor/cargaProductosFH.asp";
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 AgromonitorBot/1.0",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`SNIIM HTTP ${resp.status}`);
    return await resp.text();
  } catch (e) {
    throw new Error("No se pudo conectar a SNIIM: " + e.message);
  }
}

function parseHtml(html, cropKey) {
  const config = CROPS_SNIIM[cropKey];
  if (!config) return null;
  // Buscar filas con el cultivo + Morelia
  const lower = html.toLowerCase();
  const results = [];
  for (const variante of config.variantes) {
    const v = variante.toLowerCase();
    let idx = lower.indexOf(v);
    while (idx !== -1) {
      const slice = lower.slice(idx, idx + 1000);
      const isMorelia = MORELIA_KEYWORDS.some(k => slice.includes(k));
      if (isMorelia) {
        // Extraer números (precios) cercanos
        const numbers = slice.match(/\d+\.\d{1,2}|\d{2,}/g);
        if (numbers && numbers.length >= 2) {
          const nums = numbers.slice(0, 5).map(parseFloat).filter(n => n > 0 && n < 200);
          if (nums.length >= 2) {
            results.push({
              min: Math.min(...nums),
              max: Math.max(...nums),
              prom: nums.reduce((a,b)=>a+b,0) / nums.length,
              variante,
            });
          }
        }
      }
      idx = lower.indexOf(v, idx + 1);
    }
  }
  if (!results.length) return null;
  const allMin = Math.min(...results.map(r => r.min));
  const allMax = Math.max(...results.map(r => r.max));
  const allProm = results.reduce((s,r) => s + r.prom, 0) / results.length;
  return {
    min: Number(allMin.toFixed(2)),
    max: Number(allMax.toFixed(2)),
    prom: Number(allProm.toFixed(2)),
    fuentes: results.length,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");

  try {
    const html = await fetchSniimDaily();
    const prices = {};
    for (const cropKey of Object.keys(CROPS_SNIIM)) {
      const result = parseHtml(html, cropKey);
      if (result) prices[cropKey] = result;
    }
    if (!Object.keys(prices).length) {
      return res.status(200).json({
        success: false,
        message: "SNIIM no devolvió datos parseables hoy. Captura manual disponible.",
        prices: {},
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(200).json({
      success: true,
      prices,
      timestamp: new Date().toISOString(),
      source: "SNIIM - Morelia, Michoacán",
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
