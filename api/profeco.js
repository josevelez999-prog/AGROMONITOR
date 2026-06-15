// PROFECO QQP — optimizado: paralelo, timeouts cortos, foco Michoacán
const CROPS = {
  jitomate:  ["jitomate","tomate"],
  fresa:     ["fresa"],
  arandano:  ["arandano","arándano","blueberry"],
  zarzamora: ["zarzamora","mora"],
};

// Michoacán + ciudades principales del estado
const MICHOACAN_KW = ["morelia","michoacan","michoacán","uruapan","zamora","jacona","apatzingan","lazaro cardenas","patzcuaro"];

// Códigos de ciudad PROFECO conocidos (Morelia: 0901, Uruapan: 0916, etc.)
const PROFECO_URLS = [
  "https://qqp.profeco.gob.mx/api/v1/products",
  "https://qqp.profeco.gob.mx/api/products",
  "http://200.53.148.112:82/jsonApps/qqp2.aspx",
];

async function tryFetch(url, timeoutMs=4000) {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":"Mozilla/5.0 AgromonitorBot/1.0",
        "Accept":"application/json,text/html,*/*",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    try { return JSON.parse(text); } catch { return { _html:text }; }
  } catch (e) { return null; }
}

function extractFromJSON(json, keywords) {
  if (!json || json._html) return [];
  const items = Array.isArray(json) ? json
              : (json.productos || json.items || json.data || json.results || []);
  if (!Array.isArray(items)) return [];

  const out = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const nombre = String(item.producto||item.nombre||item.descripcion||item.product||item.name||item.PROD_DESC||"").toLowerCase();
    const ciudad = String(item.ciudad||item.localidad||item.estado||item.city||item.CIUDAD||item.LOCALIDAD||"").toLowerCase();
    const precio = parseFloat(item.precio||item.price||item.PRECIO||item.PROD_PRECIO||0);

    if (!precio || precio < 5 || precio > 300 || !nombre) continue;
    if (!keywords.some(k => nombre.includes(k.toLowerCase()))) continue;

    const esMichoacan = MICHOACAN_KW.some(c => ciudad.includes(c));
    out.push({ precio, esMichoacan });
  }
  return out;
}

function extractFromHTML(html, keywords) {
  if (!html || typeof html !== "string") return [];
  const out = [];
  const lower = html.toLowerCase();
  for (const kw of keywords) {
    let idx = lower.indexOf(kw.toLowerCase());
    let attempts = 0;
    while (idx !== -1 && out.length < 40 && attempts < 20) {
      attempts++;
      const ventana = html.slice(Math.max(0,idx-150), idx+500);
      const lowerV = ventana.toLowerCase();
      const esMichoacan = MICHOACAN_KW.some(c => lowerV.includes(c));
      const precios = ventana.match(/\$?\s*(\d{1,3}\.\d{1,2})/g);
      if (precios) {
        for (const p of precios.slice(0,3)) {
          const num = parseFloat(p.replace(/[\$\s]/g,""));
          if (num > 5 && num < 300) out.push({ precio:num, esMichoacan });
        }
      }
      idx = lower.indexOf(kw.toLowerCase(), idx + kw.length);
    }
  }
  return out;
}

function calcStats(matches) {
  if (!matches.length) return null;
  // Preferir Michoacán; si no hay, usar nacional
  const mich = matches.filter(m => m.esMichoacan);
  const usar = mich.length >= 2 ? mich : matches;
  const precios = usar.map(m => m.precio).sort((a,b)=>a-b);
  // Quitar outliers 5%
  const s = Math.floor(precios.length*0.05), e = Math.ceil(precios.length*0.95);
  const clean = precios.slice(s,e);
  if (!clean.length) return null;
  return {
    min:  Number(Math.min(...clean).toFixed(2)),
    max:  Number(Math.max(...clean).toFixed(2)),
    prom: Number((clean.reduce((a,b)=>a+b,0)/clean.length).toFixed(2)),
    muestras: clean.length,
    cobertura: mich.length >= 2 ? "michoacan" : "nacional",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");

  try {
    const debug = req.query?.debug === "1";
    const log = [];

    // Hacer TODAS las peticiones en paralelo, máx 8s total
    const results = await Promise.all(PROFECO_URLS.map(async url => {
      const r = await tryFetch(url, 4000);
      log.push(`${url} → ${r ? (r._html ? "html" : "json") : "fail"}`);
      return r;
    }));

    const prices = {};
    for (const [cropKey, keywords] of Object.entries(CROPS)) {
      const allMatches = [];
      for (const r of results) {
        if (!r) continue;
        if (r._html) allMatches.push(...extractFromHTML(r._html, keywords));
        else allMatches.push(...extractFromJSON(r, keywords));
      }
      const stats = calcStats(allMatches);
      if (stats) prices[cropKey] = stats;
      log.push(`${cropKey}: ${allMatches.length} matches → ${stats?"OK":"sin precios"}`);
    }

    if (!Object.keys(prices).length) {
      return res.status(200).json({
        success: false,
        message: "PROFECO no devolvió datos parseables. Sus endpoints pueden estar caídos hoy.",
        prices: {},
        timestamp: new Date().toISOString(),
        ...(debug && { log }),
      });
    }

    return res.status(200).json({
      success: true,
      prices,
      timestamp: new Date().toISOString(),
      source: "PROFECO QQP - Michoacán",
      ...(debug && { log }),
    });
  } catch (e) {
    // SIEMPRE devolver JSON aún en error
    return res.status(200).json({
      success: false,
      message: "Error interno: " + (e?.message || String(e)),
      prices: {},
      timestamp: new Date().toISOString(),
    });
  }
}
