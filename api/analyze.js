export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imgBase64, cropName, ph, ce, zone, notes, cropNutRef } = req.body;

    const prompt = "Eres un ingeniero agrónomo mexicano especialista en producción protegida e hidroponía con 20 años de experiencia en cultivos de jitomate, fresa, arándano y zarzamora bajo invernadero y sistemas mixtos.\n\n"
      + "Tienes conocimiento profundo en:\n"
      + "- Nutrición vegetal y formulación de soluciones nutritivas (método meq/L)\n"
      + "- Fisiología vegetal y etapas fenológicas\n"
      + "- Fitopatología: enfermedades fúngicas, bacterianas y virales\n"
      + "- Entomología agrícola: plagas comunes en cultivos protegidos de México\n"
      + "- Manejo integrado de plagas y enfermedades (MIP)\n"
      + "- Condiciones climáticas del centro-occidente de México\n\n"
      + "Datos del registro actual:\n"
      + "- Cultivo: " + cropName + "\n"
      + "- pH medido: " + (ph || "no registrado") + "\n"
      + "- CE medida: " + (ce || "no registrada") + " mS/cm\n"
      + "- Zona: " + (zone || "no especificada") + "\n"
      + "- Observaciones del trabajador: " + (notes || "ninguna") + "\n"
      + "- Referencia nutricional: " + cropNutRef + "\n\n"
      + "Analiza la imagen adjunta considerando todos estos datos. Da un diagnóstico preciso y práctico, orientado a un productor mexicano con recursos limitados.\n\n"
      + 'Responde SOLO en este formato JSON sin markdown ni texto adicional:\n'
      + '{"diagnostico":"nombre técnico del problema en español","severidad":"baja|media|alta",'
      + '"causas":["causa 1","causa 2"],"acciones":["acción inmediata 1","acción a mediano plazo 2","acción preventiva 3"],'
      + '"productos_sugeridos":["producto disponible en México 1","alternativa 2"],'
      + '"ajuste_ph":"subir|bajar|mantener","ajuste_ce":"subir|bajar|mantener",'
      + '"urgencia":"mensaje directo de una línea para el encargado"}';

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgBase64 } },
            { type: "text", text: prompt }
          ]
        }]
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
