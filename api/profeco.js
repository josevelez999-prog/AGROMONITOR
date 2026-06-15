// Serverless function: PROFECO Quién es Quién en los Precios
// Intenta múltiples endpoints conocidos de PROFECO y devuelve precios
// Fallback: precios nacionales cuando no hay datos para Morelia

const CROPS_PROFECO = {
  jitomate:  { keywords: ["jitomate","tomate saladette","tomate bola","tomate"] },
  fresa:     { keywords: ["fresa"] },
  arandano:  { keywords: ["arandano","arándano","blueberry","mora azul"] },
  zarzamora: { keywords: ["zarzamora","mora"] },
};

// Endpoints conocidos de PROFECO (algunos legacy, otros modernos)
const ENDPOINTS = [
  // Modern Vue/Angular SPA API
  (kw) => `https://qqp.profeco.gob.mx/api/v1/products?q=${encodeURIComponent(kw)}`,
  (kw) => `https://qqp.profeco.gob.mx/api/products?q=${encodeURIComponent(kw)}&city=0901`,
  // Legacy IP-based JSON
  (kw) => `http://200.53.148.112:82/jsonApps/qqp2.aspx?palabra=${encodeURIComponent(kw)}`,
  // Open data fallback search
  (kw) => `https://datos.profeco.gob.mx/datos_abiertos/buscar.php?q=${encodeURIComponent(kw)}`,
];

async function fetchEndpoint(url) {
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AgromonitorBot/1.0)",
        "Accept": "application/json,text/html,*/*",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    try { return { type:"json", data:JSON.parse(text), raw:text }; }
    catch { return { type:"text", data:null, raw:text }; }
  } catch (e) { return null; }
}

function extractPricesFromJSON(json, keywords, ciudadFiltro) {
  if (!json) return [];
  const items = Array.isArray(json) ? json
              : (json.productos || json.items || json.data || json.results || json.records || []);
  if (!Array.isArray(items) || !items.length) return [];

  const matches = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    // Extraer nombre - probar varios campos
    const nombre = String(item.producto || item.nombre || item.descripcion ||
                          item.product || item.name || item.PROD_DESC ||
                          item.descripcion_producto || "").toLowerCase();
    const ciudad = String(item.ciudad || item.localidad || item.estado ||
                          item.city || item.LOCALIDAD || item.CIUDAD || "").toLowerCase();
    const precio = parseFloat(item.precio || item.price || item.precio_promedio ||
                              item.PRECIO || item.PROD_PRECIO || 0);

    if (!precio || precio <= 0 || precio > 500) continue;
    if (!nombre) continue;

    const matchKeyword = keywords.some(k => nombre.includes(k.toLowerCase()));
    if (!matchKeyword) continue;

    matches.push({ nombre, ciudad, precio, esMorelia: ciudad.includes("morelia") || ciudad.includes("michoac") });
  }
  return matches;
}

function extractPricesFromHTML(html, keywords) {
  if (!html || typeof html !== 'string') return [];
  const matches = [];
  const lower = html.toLowerCase();

  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    let idx = lower.indexOf(kwLower);
    while (idx !== -1 && matches.length < 30) {
      // Buscar precio cerca del keyword (siguiente $X.XX o número decimal)
      const ventana = html.slice(Math.max(0,idx-100), idx+400);
      const precioMatch = ventana.match(/\$?\s*(\d{1,3}\.\d{1,2})/g);
      if (precioMatch) {
        for (const pm of precioMatch.slice(0, 3)) {
          const p = parseFloat(pm.replace(/[\$\s]/g,""));
          if (p > 5 && p < 200) {
            const isMorelia = ventana.toLowerCase().includes("morelia") || ventana.toLowerCase().includes("michoac");
            matches.push({ nombre:kw, ciudad:isMorelia?"morelia":"nacional", precio:p, esMorelia:isMorelia });
          }
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
  if (!filtrados.length) filtrados = matches; // fallback a nacional

  const precios = filtrados.map(m => m.precio).sort((a,b)=>a-b);
  // Quitar outliers: top y bottom 5%
  const start = Math.floor(precios.length * 0.05);
  const end = Math.ceil(precios.length * 0.95);
  const limpios = precios.slice(start, end);
  if (!limpios.length) return null;

  return {
    min: Number(Math.min(...limpios).toFixed(2)),
    max: Number(Math.max(...limpios).toFixed(2)),
    prom: Number((limpios.reduce((s,p)=>s+p,0) / limpios.length).toFixed(2)),
    muestras: limpios.length,
    cobertura: soloMorelia && filtrados.length === matches.length ? "nacional" : (soloMorelia ? "morelia" : "nacional"),
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");

  const debug = req.query?.debug === "1";
  const log = [];
  const prices = {};

  try {
    for (const cropKey of Object.keys(CROPS_PROFECO)) {
      const config = CROPS_PROFECO[cropKey];
      const allMatches = [];

      for (const keyword of config.keywords) {
        for (const endpointFn of ENDPOINTS) {
          const url = endpointFn(keyword);
          const result = await fetchEndpoint(url);
          if (!result) { log.push(`${cropKey}/${keyword}: ${url} → falló`); continue; }
          log.push(`${cropKey}/${keyword}: ${url} → ${result.type}`);

          let matches = [];
          if (result.type === "json") {
            matches = extractPricesFromJSON(result.data, [keyword]);
          } else if (result.type === "text" && result.raw) {
            matches = extractPricesFromHTML(result.raw, [keyword]);
          }
          if (matches.length) {
            allMatches.push(...matches);
            log.push(`  → ${matches.length} matches`);
            break; // si un endpoint funcionó, no necesitamos los otros para este keyword
          }
        }
      }

      if (allMatches.length) {
        // Intenta primero Morelia, sino usa nacional
        let stats = calcularEstadisticas(allMatches, true);
        if (!stats || stats.muestras < 2) stats = calcularEstadisticas(allMatches, false);
        if (stats) prices[cropKey] = stats;
      }
    }

    if (!Object.keys(prices).length) {
      return res.status(200).json({
        success: false,
        message: "PROFECO no devolvió datos parseables. Captura manualmente o intenta de nuevo más tarde.",
        prices: {},
        timestamp: new Date().toISOString(),
        ...(debug && { log }),
      });
    }

    return res.status(200).json({
      success: true,
      prices,
      timestamp: new Date().toISOString(),
      source: "PROFECO QQP",
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
