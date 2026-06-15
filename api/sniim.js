// SNIIM optimizado: paralelo, timeouts cortos, foco Michoacán
const CROPS = {
  jitomate:  ["jitomate","tomate saladette","tomate bola"],
  fresa:     ["fresa","frutilla"],
  arandano:  ["arándano","arandano","blueberry"],
  zarzamora: ["zarzamora","mora"],
};

const MICHOACAN_KW = ["morelia","michoacan","michoacán","uruapan","zamora","jacona","apatzingan","lazaro cardenas","patzcuaro"];

const SNIIM_URLS = [
  "http://www.economia-sniim.gob.mx/SNIIM-AN/Frutas/Frutas.asp",
  "http://www.economia-sniim.gob.mx/sniimtomate.asp",
  "http://www.economia-sniim.gob.mx/SNIIM-AN/jiss2.asp",
  "http://www.economia-sniim.gob.mx/Precios_de_Hortalizas_en_Mexico.htm",
];

async function tryFetch(url, timeoutMs=4000) {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent":"Mozilla/5.0 AgromonitorBot/1.0","Accept":"text/html,*/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch (e) { return null; }
}

function extractFromHTML(html, keywords) {
  if (!html || typeof html !== "string") return [];
  if (html.toLowerCase().includes("mantenimiento")) return [];
  const out = [];
  const lower = html.toLowerCase();
  for (const kw of keywords) {
    let idx = lower.indexOf(kw.toLowerCase());
    let attempts = 0;
    while (idx !== -1 && out.length < 40 && attempts < 20) {
      attempts++;
      const ventana = html.slice(Math.max(0,idx-200), idx+800);
      const lowerV = ventana.toLowerCase();
      const esMichoacan = MICHOACAN_KW.some(c => lowerV.includes(c));
      const precios = ventana.match(/\$?\s*(\d{1,3}\.\d{1,2})/g);
      if (precios) {
        for (const p of precios.slice(0,4)) {
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
  const mich = matches.filter(m => m.esMichoacan);
  const usar = mich.length >= 2 ? mich : matches;
  const precios = usar.map(m => m.precio).sort((a,b)=>a-b);
  const s = Math.floor(precios.length*0.1), e = Math.ceil(precios.length*0.9);
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

    const htmls = await Promise.all(SNIIM_URLS.map(async url => {
      const html = await tryFetch(url, 4000);
      if (!html) { log.push(`${url} → fail`); return null; }
      if (html.toLowerCase().includes("mantenimiento")) { log.push(`${url} → MANTENIMIENTO`); return null; }
      log.push(`${url} → ${html.length} bytes`);
      return html;
    }));

    const validos = htmls.filter(Boolean);
    if (!validos.length) {
      return res.status(200).json({
        success: false,
        message: "SNIIM en mantenimiento o sin respuesta. Captura manualmente o intenta más tarde.",
        prices: {},
        timestamp: new Date().toISOString(),
        ...(debug && { log }),
      });
    }

    const combined = validos.join("\n");
    const prices = {};
    for (const [cropKey, keywords] of Object.entries(CROPS)) {
      const matches = extractFromHTML(combined, keywords);
      const stats = calcStats(matches);
      if (stats) prices[cropKey] = stats;
      log.push(`${cropKey}: ${matches.length} matches → ${stats?"OK":"sin precios"}`);
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
      source: "SNIIM - Michoacán",
      ...(debug && { log }),
    });
  } catch (e) {
    return res.status(200).json({
      success: false,
      message: "Error interno: " + (e?.message || String(e)),
      prices: {},
      timestamp: new Date().toISOString(),
    });
  }
}
