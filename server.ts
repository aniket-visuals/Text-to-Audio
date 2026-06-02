import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Needed to parse JSON request bodies
  app.use(express.json({ limit: "50mb" }));

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceId, language } = req.body;
      if (!text || !text.trim()) {
        res.status(400).json({ error: "Text content is required" });
        return;
      }

      // language should be a string which is the full language name (e.g. English, French, Etc)
      // from the client we can just pass that directly
      const promptText = `Please read the following text in ${language}. Only generate the audio for the text itself, do not include the language instruction in the audio output. Text: "${text}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceId },
            },
          },
        },
      });

      const candidate = response.candidates?.[0];
      const audioPart = candidate?.content?.parts?.[0];

      if (!audioPart || !audioPart.inlineData || !audioPart.inlineData.data) {
        console.error("API Response structure:", JSON.stringify(response, null, 2));
        throw new Error("No audio data returned from the API.");
      }

      const audioBase64 = audioPart.inlineData.data;
      res.json({ audioBase64 });
    } catch (err: any) {
      console.error("TTS Generation Error:", err);
      const errStr = String(err.message || err);
      
      // Check if error is due to rate limits or quota exceeded
      if (
        errStr.includes("429") || 
        errStr.toLowerCase().includes("quota") || 
        errStr.includes("RESOURCE_EXHAUSTED") ||
        err.status === 429
      ) {
        res.status(429).json({ 
          error: "QUOTA_EXCEEDED", 
          message: "You have exceeded the Gemini text-to-speech API free tier quota (10 conversions/day). We suggest using the high-quality Local Device Speech fallback below!" 
        });
        return;
      }
      
      res.status(500).json({ error: err.message || "Failed to generate audio" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
