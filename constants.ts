import { VoiceOption, LanguageOption } from './types';

export const VOICES: VoiceOption[] = [
  { id: 'Puck', name: 'Puck', gender: 'Male', description: 'Deep, resonant, assertive' },
  { id: 'Charon', name: 'Charon', gender: 'Male', description: 'Deep, calm, authoritative' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Male', description: 'Rough, intense, dramatic' },
  { id: 'Kore', name: 'Kore', gender: 'Female', description: 'Soft, soothing, gentle' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'Female', description: 'Clear, bright, energetic' },
];

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
];

export const DEFAULT_CONFIG = {
  voiceId: 'Kore',
  language: 'en',
  speed: 1.0,
};
