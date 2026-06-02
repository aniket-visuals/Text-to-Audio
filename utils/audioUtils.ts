/**
 * Decodes a base64 string into an AudioBuffer using the Web Audio API.
 */
export async function decodeAudioData(
  base64String: string,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Important: The Gemini API returns raw PCM in some contexts, but specifically for the REST API
  // properly formatted structure, it usually returns a base64 that decodes to a valid format or requires specific decoding.
  // The SDK instructions for `generateContent` with Modality.AUDIO imply we get raw data.
  // However, `decodeAudioData` usually expects a full file container (like WAV/MP3) OR we manually create buffer from PCM.
  // Based on the 'Generate Speech' guide, we treat it as raw PCM if it doesn't have a header, 
  // but standard usage often wraps it.
  
  // We will attempt standard decoding first. If that fails, we assume raw PCM (linear16).
  try {
    return await audioContext.decodeAudioData(bytes.buffer.slice(0));
  } catch (e) {
    // Fallback for Raw PCM if standard decode fails
    // Assuming 24kHz sample rate as per Gemini specs for some models, or 24000 default.
    return decodeRawPCM(bytes, audioContext);
  }
}

function decodeRawPCM(data: Uint8Array, ctx: AudioContext): AudioBuffer {
  const sampleRate = 24000; // Gemini default for TTS often
  const numChannels = 1;
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Converts an AudioBuffer to a WAV Blob for downloading.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new ArrayBuffer(length);
  const view = new DataView(out);
  const channels = [];
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (let i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(offset, sample, true); // write 16-bit sample
      offset += 2;
    }
    pos++;
  }

  return new Blob([out], { type: 'audio/wav' });

  function setUint16(data: any) {
    view.setUint16(offset, data, true);
    offset += 2;
  }

  function setUint32(data: any) {
    view.setUint32(offset, data, true);
    offset += 4;
  }
}

/**
 * Helper to process base64 audio data into a Blob URL and duration.
 * Handles the creation and cleanup of a temporary AudioContext if needed.
 */
export async function processAudioData(
  base64String: string, 
  existingContext?: AudioContext
): Promise<{ audioUrl: string; duration: number }> {
  let contextToUse = existingContext;
  let shouldCloseContext = false;

  if (!contextToUse) {
    contextToUse = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    shouldCloseContext = true;
  }

  try {
    const audioBuffer = await decodeAudioData(base64String, contextToUse);
    const wavBlob = audioBufferToWav(audioBuffer);
    const audioUrl = URL.createObjectURL(wavBlob);
    
    return {
      audioUrl,
      duration: audioBuffer.duration
    };
  } finally {
    if (shouldCloseContext && contextToUse) {
      contextToUse.close();
    }
  }
}
