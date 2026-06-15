// Serverless function: PROFECO Quién es Quién en los Precios
// Endpoint público: qqp.profeco.gob.mx busca productos y devuelve JSON
// Funciona hoy (a diferencia de SNIIM que está en mantenimiento)

const CROPS_PROFECO = {
  jitomate:  { keywords: ["jitomate","tomate saladette","tomate bola"] },
  fresa:     { keywords: ["fresa"] },
  arandano:  { keywords: ["arandano","arándano","blueberry"] },
  zarzamora: { keywords: ["zarzamora","mora"] },
};

const CIUDAD_MORELIA = "morelia";

async function buscarProducto(termino) {
  // PROFECO QQP usa endpoint REST que devuelve JSON
  const url = `https://qqp.profeco.gob.mx/api/qqp?keyword=${encodeURIComponent(termino)}`;
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 AgromonitorBot/1.0",
        "Accept": "application/json,text/html",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`PROFECO HTTP ${resp.status}`);
    const text = await resp.text();
    try { return JSON.parse(text); } catch { return text; }
  } catch (e) {
    throw new Error("PROFECO: " + e.message);
  }
}

function extraerPrecios(data, cropKey, ciudadFiltro) {
  if (!data) return null;
  const items = Array.isArray(data) ? data : (data.productos || data.items || data.data || []);
  if (!items.length) return null;

  const config = CROPS_PROFECO[cropKey];
  const precios = [];
  const tiendas = new Set();

  for (const item of items) {
    const nombre = (item.producto || item.nombre || item.descripcion || "").toLowerCase();
    const ciudad = (item.ciudad || item.localidad || item.estado || "").toLowerCase();
    const precio = parseFloat(item.precio || item.price || item.precio_promedio || 0);
    const tienda = item.cadena || item.establecimiento || item.tienda || "";

    if (!precio || precio <= 0) continue;
    if (ciudadFiltro && !ciudad.includes(ciudadFiltro)) continue;

    const matchKeyword = config.keywords.some(k => nombre.includes(k.toLowerCase()));
    if (!matchKeyword) continue;

    precios.push(precio);
    if (tienda) tiendas.add(tienda);
  }

  if (!precios.length) return null;

  return {
    min: Number(Math.min(...precios).toFixed(2)),
    max: Number(Math.max(...precios).toFixed(2)),
    prom: Number((precios.reduce((s,p)=>s+p,0) / precios.length).toFixed(2)),
    muestras: precios.length,
    tiendas: tiendas.size,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");

  try {
    const prices = {};
    for (const cropKey of Object.keys(CROPS_PROFECO)) {
      const config = CROPS_PROFECO[cropKey];
      let foundData = null;
      for (const keyword of config.keywords) {
        try {
          const data = await buscarProducto(keyword);
          const resultado = extraerPrecios(data, cropKey, CIUDAD_MORELIA);
          if (resultado) { foundData = resultado; break; }
        } catch (e) { continue; }
      }
      if (foundData) prices[cropKey] = foundData;
    }

    if (!Object.keys(prices).length) {
      return res.status(200).json({
        success: false,
        message: "PROFECO no devolvió datos para Morelia hoy. Captura manual disponible.",
        prices: {},
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      prices,
      timestamp: new Date().toISOString(),
      source: "PROFECO QQP - Morelia, Michoacán",
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
