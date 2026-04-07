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
    const { messages, imgBase64, imgType, mode } = req.body;
    // mode: "chat" | "planta" | "suelo"

    const SYSTEM = "Eres un asistente agrónomo experto que ayuda a trabajadores agrícolas mexicanos en campo. "
      + "Tienes especialidad en producción protegida e hidroponía: jitomate, fresa, arándano y zarzamora. "
      + "Conoces muy bien fitopatología, nutrición vegetal, manejo de plagas, pH, CE y fertilidad de suelos. "
      + "Hablas de forma clara, sencilla y directa — como si hablaras con un trabajador de campo, no con un científico. "
      + "Tus respuestas son cortas, prácticas y orientadas a la acción. "
      + "Cuando detectes un problema grave, siempre di que avisen al encargado. "
      + "Usas el contexto del centro-occidente de México (Michoacán, Jalisco, Guanajuato).";

    const content = [];
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": process.env.VITE_ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    };

    if (imgBase64) {
      const isPDF = imgType && imgType.includes("pdf");
      const sizeOK = imgBase64.length < 5_000_000;

      if (isPDF && sizeOK) {
        headers["anthropic-beta"] = "pdfs-2024-09-25";
        content.push({ type:"document", source:{ type:"base64", media_type:"application/pdf", data:imgBase64 }});
      } else if (!isPDF && sizeOK) {
        let mt = "image/jpeg";
        if (imgType?.includes("png")) mt = "image/png";
        else if (imgType?.includes("webp")) mt = "image/webp";
        content.push({ type:"image", source:{ type:"base64", media_type:mt, data:imgBase64 }});
      }
    }

    // Add instruction based on mode
    if (mode === "planta" && imgBase64) {
      content.push({ type:"text", text:"Analiza esta imagen de la planta. Dime en español sencillo qué problema tiene, qué lo causó y qué debe hacer el trabajador ahora mismo. Sé breve y práctico." });
    } else if (mode === "suelo" && imgBase64) {
      content.push({ type:"text", text:"Analiza este análisis de suelo. Extrae los valores importantes, dime en qué está bien y en qué está mal el suelo, y qué fertilizantes necesita. Usa lenguaje sencillo para un trabajador de campo." });
    }

    // Build conversation messages
    const apiMessages = (messages || []).map(m => ({
      role: m.role,
      content: m.role === "user" && content.length > 0 && m === messages[messages.length - 1]
        ? [...content, { type:"text", text: m.content }]
        : m.content
    }));

    // If only image mode with no conversation
    if (!messages?.length && content.length > 0) {
      apiMessages.push({ role:"user", content });
    }

    if (!apiMessages.length) {
      return res.status(400).json({ error: "No hay mensaje ni imagen" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: SYSTEM,
        messages: apiMessages,
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      return res.status(400).json({ error: data.error?.message || "Error en la IA" });
    }

    const text = data.content?.find(b => b.type === "text")?.text || "";
    res.status(200).json({ text });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
