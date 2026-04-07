export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imgBase64, imgType, cropName, zona, laboratorio, profundidad, fecha, parametros } = req.body;

    const paramStr = parametros
      ? Object.entries(parametros).filter(([, v]) => v).map(([k, v]) => k + ": " + v).join(", ")
      : "ninguno";

    const prompt = "Eres un edafólogo y agrónomo mexicano especialista en fertilidad de suelos con 20 años de experiencia en la región centro-occidente de México (Michoacán, Jalisco, Guanajuato).\n\n"
      + "Contexto del análisis:\n"
      + "- Cultivo a establecer: " + cropName + "\n"
      + "- Zona/parcela: " + (zona || "no especificada") + "\n"
      + "- Laboratorio: " + (laboratorio || "no especificado") + "\n"
      + "- Profundidad muestreada: " + (profundidad || "0-30") + " cm\n"
      + "- Fecha: " + (fecha || "") + "\n"
      + "- Parámetros ingresados: " + paramStr + "\n\n"
      + (imgBase64 ? "Analiza el documento/imagen de análisis de suelo adjunto." : "Basa tu análisis en los parámetros proporcionados.") + "\n\n"
      + "Proporciona un diagnóstico completo y recomendaciones de fertilización para este cultivo en suelo.\n\n"
      + 'Responde SOLO en formato JSON sin markdown:\n'
      + '{"diagnostico_general":"resumen del estado de fertilidad en 2-3 oraciones",'
      + '"problemas_principales":["problema 1","problema 2"],'
      + '"parametros_detectados":{"pH":null,"MO":null,"N":null,"P":null,"K":null,"Ca":null,"Mg":null,"textura":null},'
      + '"deficiencias":["nutriente 1"],"excesos":["nutriente si aplica"],'
      + '"recomendaciones_manejo":["practica 1","practica 2","practica 3"],'
      + '"formulacion_suelo":{"N_kg_ha":0,"P_kg_ha":0,"K_kg_ha":0,"notas":"notas sobre fertilización"},'
      + '"fertilizantes_recomendados":[{"nombre":"fertilizante","dosis":"kg/ha","momento":"presiembra|siembra|fertirriego"}],'
      + '"enmiendas":["enmienda si pH lo requiere"],'
      + '"siguiente_muestreo":"recomendación de cuándo tomar próximo análisis",'
      + '"semaforo":"verde|amarillo|rojo"}';

    const content = [];
    if (imgBase64) {
      const mediaType = imgType && imgType.includes("pdf") ? "application/pdf" : (imgType || "image/jpeg");
      if (!imgType || !imgType.includes("pdf")) {
        content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: imgBase64 } });
      }
    }
    content.push({ type: "text", text: prompt });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.VITE_ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content }]
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
