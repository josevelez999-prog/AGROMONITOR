export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } }
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imgBase64, imgType, cropName, zona, laboratorio, profundidad, fecha, parametros } = req.body;

    const paramStr = parametros
      ? Object.entries(parametros).filter(([, v]) => v && v !== "null").map(([k, v]) => k + ": " + v).join(", ")
      : "ninguno";

    const prompt = "Eres un edafólogo y agrónomo mexicano especialista en fertilidad de suelos con 20 años de experiencia en la región centro-occidente de México (Michoacán, Jalisco, Guanajuato).\n\n"
      + "Contexto del análisis:\n"
      + "- Cultivo a establecer: " + cropName + "\n"
      + "- Zona/parcela: " + (zona || "no especificada") + "\n"
      + "- Laboratorio: " + (laboratorio || "no especificado") + "\n"
      + "- Profundidad muestreada: " + (profundidad || "0-30") + " cm\n"
      + "- Fecha: " + (fecha || "") + "\n"
      + "- Parámetros ingresados manualmente: " + paramStr + "\n\n"
      + (imgBase64 ? "Analiza el documento adjunto y extrae todos los valores del análisis de suelo." : "Basa tu análisis en los parámetros proporcionados manualmente.") + "\n\n"
      + "Proporciona un diagnóstico completo y recomendaciones de fertilización para este cultivo.\n\n"
      + "Responde SOLO en JSON sin markdown:\n"
      + '{"diagnostico_general":"resumen fertilidad en 2-3 oraciones",'
      + '"problemas_principales":["problema 1","problema 2"],'
      + '"parametros_detectados":{"pH":null,"MO":null,"N":null,"P":null,"K":null,"Ca":null,"Mg":null,"textura":null},'
      + '"deficiencias":["nutriente 1"],'
      + '"excesos":["exceso si aplica"],'
      + '"recomendaciones_manejo":["practica 1","practica 2","practica 3"],'
      + '"formulacion_suelo":{"N_kg_ha":0,"P_kg_ha":0,"K_kg_ha":0,"notas":"notas fertilizacion"},'
      + '"fertilizantes_recomendados":[{"nombre":"fertilizante","dosis":"kg/ha","momento":"presiembra|siembra|fertirriego"}],'
      + '"enmiendas":["enmienda si pH lo requiere"],'
      + '"siguiente_muestreo":"cuando tomar proximo analisis",'
      + '"semaforo":"verde|amarillo|rojo"}';

    const content = [];
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": process.env.VITE_ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    };

    if (imgBase64) {
      const isPDF = imgType && (imgType.includes("pdf") || imgType === "application/pdf");
      const isImage = imgType && imgType.includes("image");

      // Check size — base64 of 4MB file = ~5.3MB string
      const sizeOK = imgBase64.length < 5_000_000;

      if (isPDF && sizeOK) {
        // PDF needs beta header
        headers["anthropic-beta"] = "pdfs-2024-09-25";
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: imgBase64 }
        });
      } else if (isImage && sizeOK) {
        let mediaType = "image/jpeg";
        if (imgType.includes("png")) mediaType = "image/png";
        else if (imgType.includes("webp")) mediaType = "image/webp";
        content.push({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: imgBase64 }
        });
      } else if (!sizeOK) {
        console.log("File too large, analyzing with parameters only");
      }
    }

    content.push({ type: "text", text: prompt });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content }]
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const msg = data.error?.message || JSON.stringify(data);
      console.error("Anthropic error:", msg);
      return res.status(400).json({ error: "Error Anthropic: " + msg });
    }

    const text = data.content?.find(b => b.type === "text")?.text || "";
    if (!text) return res.status(500).json({ error: "La IA no devolvió respuesta. Intenta de nuevo." });

    const result = JSON.parse(text.replace(/```json|```/g, "").trim());
    res.status(200).json(result);

  } catch (e) {
    console.error("Server error:", e);
    res.status(500).json({ error: e.message || "Error interno del servidor" });
  }
}
