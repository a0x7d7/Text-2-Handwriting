type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = { status: (code: number) => ApiResponse; json: (body: unknown) => void };

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return response.status(503).json({ error: "Correction Mode needs GEMINI_API_KEY configured in the Vercel project." });

  const image = (request.body as { image?: unknown } | undefined)?.image;
  if (typeof image !== "string" || image.length > 1_500_000) return response.status(400).json({ error: "The word image is invalid or too large." });
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match) return response.status(400).json({ error: "Expected a PNG word image." });

  try {
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: "Transcribe the single handwritten word in this image. Return only the word, with no explanation or quotation marks." },
          { inline_data: { mime_type: "image/png", data: match[1] } },
        ] }],
        generationConfig: { temperature: 0, maxOutputTokens: 20 },
      }),
    });
    const result = await upstream.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (!upstream.ok) return response.status(upstream.status === 429 ? 429 : 502).json({ error: result.error?.message || "Gemini could not check this word." });
    const text = result.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? "").join("").trim() ?? "";
    return response.status(200).json({ text });
  } catch {
    return response.status(502).json({ error: "Could not reach Gemini to check this word." });
  }
}
