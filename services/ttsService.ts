import { TTSConfig } from "../types";
import { LANGUAGES } from "../constants";

export async function generateSpeech(text: string, config: TTSConfig): Promise<string> {
  if (!text || !text.trim()) {
    throw new Error("Text content is required");
  }

  const selectedLang = LANGUAGES.find(l => l.code === config.language)?.name || 'English';
  
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        voiceId: config.voiceId,
        language: selectedLang
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate audio from server.");
    }

    if (!data.audioBase64) {
      throw new Error("No audio data returned from the server.");
    }

    return data.audioBase64;
  } catch (error) {
    console.error("TTS Generation API Error:", error);
    throw error;
  }
}
