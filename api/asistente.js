// Asistente IA del trabajador - acepta texto, imagen y PDF automáticamente

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const apiKey = process.env.ANTHROPIC_KEY 
                || process.env.ANTHROPIC_API_KEY 
                || process.env.VITE_ANTHROPIC_API_KEY;
    
    if (!apiKey) return res.status(200).json({ error: "🔑 ANTHROPIC_KEY no configurada en Vercel." });
    if (!apiKey.startsWith("sk-ant-")) return res.status(200).json({ error: "🔑 ANTHROPIC_KEY inválida." });

    const body = req.body || {};
    let { messages, imgBase64, imgType, fileBase64, fileType, fileName, prompt, contexto } = body;

    // Retrocompatible: si viene formato viejo {prompt, contexto}, convertir a messages
    if (!Array.isArray(messages) && (prompt || contexto)) {
      const fullPrompt = contexto ? `${contexto}\n\nPregunta: ${prompt}` : prompt;
      messages = [{ role: "user", content: fullPrompt || "Hola" }];
    }

    // Detectar qué viene
    const hasText = Array.isArray(messages) && messages.length > 0;
    const hasImage = imgBase64 && (imgType || "").startsWith("image");
    const hasPdf = (fileBase64 && (fileType || "").includes("pdf")) || (imgBase64 && (imgType || "").includes("pdf"));
    
    if (!hasText && !hasImage && !hasPdf) {
      return res.status(200).json({ error: "Envía una pregunta, foto o PDF para analizar." });
    }

    // System prompt agrónomo
    const systemPrompt = `Eres un asistente agrónomo experto en cultivos hidropónicos en México (jitomate, fresa, arándano, zarzamora). Respondes siempre en español, de forma práctica y directa.

Si analizas una IMAGEN: diagnostica el estado de la planta (deficiencias, plagas, enfermedades, problemas de pH/CE). Da causas probables y acciones concretas.

Si analizas un PDF (análisis de suelo, ficha técnica): interpreta los datos y da recomendaciones específicas.

Si recibes una PREGUNTA: responde como experto agrónomo, breve y útil.

Estructura tus respuestas con saltos de línea claros. Usa emojis ocasionales (🌿🍅 etc.) cuando ayude. Sé conciso.`;

    // Construir mensajes para Claude
    const claudeMessages = [];
    
    if (hasText) {
      // Mapear historial (omitir mensaje inicial del asistente si es saludo)
      for (const m of messages) {
        if (m.role === "assistant" || m.role === "user") {
          claudeMessages.push({
            role: m.role,
            content: String(m.content || "").slice(0, 4000),
          });
        }
      }
    }

    // Si el último mensaje del usuario tiene imagen/pdf adjunto, agregarlo
    const lastUser = claudeMessages.filter(m => m.role === "user").pop();
    
    if ((hasImage || hasPdf) && lastUser) {
      // Reconstruir último mensaje del usuario con archivo + texto
      const content = [];
      
      if (hasImage) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: imgType || "image/jpeg",
            data: imgBase64,
          },
        });
      }
      if (hasPdf) {
        const pdfData = fileBase64 || imgBase64;
        content.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfData,
          },
        });
      }
      content.push({
        type: "text",
        text: lastUser.content || (hasImage ? "Analiza esta planta y dime qué problema tiene." : "Interpreta este documento."),
      });
      
      // Reemplazar último user con la versión multimodal
      const idx = claudeMessages.lastIndexOf(lastUser);
      claudeMessages[idx] = { role: "user", content };
    } else if ((hasImage || hasPdf) && !lastUser) {
      // Sin historial pero hay archivo
      const content = [];
      if (hasImage) {
        content.push({
          type: "image",
          source: { type:"base64", media_type:imgType||"image/jpeg", data:imgBase64 },
        });
      }
      if (hasPdf) {
        content.push({
          type: "document",
          source: { type:"base64", media_type:"application/pdf", data:(fileBase64||imgBase64) },
        });
      }
      content.push({
        type: "text",
        text: hasImage ? "Analiza esta planta y dime qué problema tiene." : "Interpreta este documento.",
      });
      claudeMessages.push({ role: "user", content });
    }

    if (!claudeMessages.length) {
      return res.status(200).json({ error: "No se pudo construir mensaje." });
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        messages: claudeMessages,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let msg = "Error API Claude " + resp.status;
      if (resp.status === 401) msg = "🔑 API Key inválida o expirada.";
      else if (resp.status === 429) msg = "⏱ Demasiadas consultas. Espera 1 minuto.";
      else if (resp.status === 529) msg = "🔧 Anthropic sobrecargado.";
      else if (resp.status === 400) msg = "📝 " + errText.slice(0,200);
      return res.status(200).json({ error: msg });
    }

    const data = await resp.json();
    let texto = "";
    if (Array.isArray(data.content)) {
      for (const b of data.content) if (b.type === "text") texto += b.text;
    }
    if (!texto) return res.status(200).json({ error: "Sin respuesta." });
    
    return res.status(200).json({ response: texto, text: texto });
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return res.status(200).json({ error: "⏱ Tardó demasiado. Reduce tamaño de la foto o documento." });
    }
    return res.status(200).json({ error: "Error: " + (e?.message || String(e)) });
  }
}
