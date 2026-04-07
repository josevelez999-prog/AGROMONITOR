export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { cropName, etapa, target, water, aportes, fertilizando, ferts, volume, costoTotal, costoPorLitro } = req.body;

    const fertActivos = ferts.filter(f => f.active && f.meq > 0);

    const prompt = "Eres un ingeniero agrónomo e hidropónico mexicano especialista en nutrición vegetal con 20 años de experiencia en producción protegida de jitomate, fresa, arándano y zarzamora en Michoacán y Jalisco.\n\n"
      + "Analiza la siguiente solución nutritiva formulada y proporciona un diagnóstico técnico completo:\n\n"
      + "CULTIVO: " + cropName + "\n"
      + "ETAPA FENOLÓGICA: " + etapa + "\n"
      + "VOLUMEN: " + volume + " litros\n\n"
      + "OBJETIVO DE IONES (meq/L):\n"
      + "Aniones — NO3: " + target.NO3 + ", H2PO4: " + target.H2PO4 + ", SO4: " + target.SO4 + ", HCO3: " + target.HCO3 + ", Cl: " + target.Cl + "\n"
      + "Cationes — NH4: " + target.NH4 + ", K: " + target.K + ", Ca: " + target.Ca + ", Mg: " + target.Mg + ", Na: " + target.Na + "\n\n"
      + "IONES DEL AGUA (meq/L):\n"
      + "Aniones — NO3: " + water.NO3 + ", H2PO4: " + water.H2PO4 + ", SO4: " + water.SO4 + ", HCO3: " + water.HCO3 + ", Cl: " + water.Cl + "\n"
      + "Cationes — NH4: " + water.NH4 + ", K: " + water.K + ", Ca: " + water.Ca + ", Mg: " + water.Mg + ", Na: " + water.Na + "\n\n"
      + "LO QUE ESTÁ FERTILIZANDO (meq/L):\n"
      + "Aniones — NO3: " + fertilizando.NO3 + ", H2PO4: " + fertilizando.H2PO4 + ", SO4: " + fertilizando.SO4 + "\n"
      + "Cationes — NH4: " + fertilizando.NH4 + ", K: " + fertilizando.K + ", Ca: " + fertilizando.Ca + ", Mg: " + fertilizando.Mg + "\n\n"
      + "FERTILIZANTES ACTIVOS:\n"
      + fertActivos.map(f => "- " + f.name + ": " + f.meq + " meq/L").join("\n") + "\n\n"
      + "COSTO: $" + costoTotal + " MXN total / $" + costoPorLitro + " MXN por litro\n\n"
      + "Evalúa: balance iónico, relaciones entre nutrientes, adecuación a la etapa fenológica, eficiencia económica y posibles problemas nutricionales que podría causar esta fórmula en el cultivo.\n\n"
      + "Responde SOLO en JSON sin markdown:\n"
      + '{"evaluacion_general":"resumen en 2-3 oraciones del estado de la formula",'
      + '"puntuacion":85,'
      + '"balance_ionico":"bueno|aceptable|deficiente",'
      + '"problemas":["problema 1 si existe","problema 2"],'
      + '"deficiencias_riesgo":["ion en riesgo de deficiencia"],'
      + '"excesos_riesgo":["ion en riesgo de exceso"],'
      + '"ajustes_recomendados":[{"ion":"nombre del ion","accion":"aumentar|reducir","cantidad":"cantidad sugerida en meq/L","razon":"por qué"}],'
      + '"fertilizantes_sugeridos":["fertilizante que podría mejorar la formula"],'
      + '"adecuacion_etapa":"excelente|buena|regular|inadecuada",'
      + '"recomendaciones_etapa":["recomendacion especifica para esta etapa fenologica"],'
      + '"eficiencia_economica":"buena|regular|cara",'
      + '"tip_economia":"sugerencia para reducir costo si aplica",'
      + '"veredicto":"APROBADA|MEJORABLE|REFORMULAR"}';

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.VITE_ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }]
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const text = data.content?.find(b => b.type === "text")?.text || "";
    const result = JSON.parse(text.replace(/```json|```/g, "").trim());
    res.status(200).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
