export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  description: string;
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export interface AudioHistoryItem {
  id: string;
  text: string;
  voiceId: string;
  timestamp: number;
  audioUrl: string; // Blob URL
  duration?: number;
}

export interface TTSConfig {
  voiceId: string;
  language: string;
  speed: number;
}

export type LoadingState = 'idle' | 'generating' | 'playing' | 'error';
