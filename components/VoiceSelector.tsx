import React, { useState, useRef, useEffect } from 'react';
import { Mic, ChevronDown, Play, Square, Loader2 } from 'lucide-react';
import { VoiceOption } from '../types';
import { generateSpeech } from '../services/ttsService';
import { processAudioData } from '../utils/audioUtils';

interface VoiceSelectorProps {
  voices: VoiceOption[];
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
  languageCode: string; // Passed to ensure preview speaks roughly the right accent/language if needed
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ 
  voices, 
  selectedVoiceId, 
  onSelect,
  languageCode 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [previewState, setPreviewState] = useState<{
    status: 'idle' | 'loading' | 'playing';
    voiceId: string | null;
  }>({ status: 'idle', voiceId: null });
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedVoice = voices.find(v => v.id === selectedVoiceId) || voices[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePreview = async (e: React.MouseEvent, voice: VoiceOption) => {
    e.stopPropagation(); // Prevent selection when clicking preview

    // Stop current if playing
    if (previewState.status === 'playing' || previewState.status === 'loading') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (previewState.voiceId === voice.id) {
        setPreviewState({ status: 'idle', voiceId: null });
        return;
      }
    }

    setPreviewState({ status: 'loading', voiceId: voice.id });

    try {
      // Short preview text
      const text = `Hello, I am ${voice.name}.`;
      
      // We use the language code from config, or default to EN for the name introduction
      // (Though the prompt says "I am [Name]", usually fine in English for demo)
      const base64Audio = await generateSpeech(text, { 
        voiceId: voice.id, 
        language: 'en', // Force English for the name intro or use languageCode if preferred
        speed: 1.0 
      });

      const { audioUrl } = await processAudioData(base64Audio);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPreviewState({ status: 'idle', voiceId: null });
        URL.revokeObjectURL(audioUrl); // Cleanup
      };

      audio.onerror = () => {
        console.error("Audio playback failed");
        setPreviewState({ status: 'idle', voiceId: null });
      };

      await audio.play();
      setPreviewState({ status: 'playing', voiceId: voice.id });

    } catch (err) {
      console.error("Preview failed, falling back to local speech synthesis", err);
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(`Hello, I am ${voice.name}.`);
          utterance.rate = 1.0;
          
          const targetLang = languageCode || 'en';
          const voicesList = window.speechSynthesis.getVoices();
          const matched = voicesList.find(v => v.lang.startsWith(targetLang)) || 
                          voicesList.find(v => v.lang.startsWith('en'));
          if (matched) utterance.voice = matched;
          
          setPreviewState({ status: 'playing', voiceId: voice.id });
          utterance.onend = () => {
            setPreviewState({ status: 'idle', voiceId: null });
          };
          utterance.onerror = () => {
            setPreviewState({ status: 'idle', voiceId: null });
          };
          window.speechSynthesis.speak(utterance);
        } catch (synthErr) {
          console.error("Local speech synthesis failed", synthErr);
          setPreviewState({ status: 'idle', voiceId: null });
        }
      } else {
        setPreviewState({ status: 'idle', voiceId: null });
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none cursor-pointer flex items-center justify-between group hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-medium truncate">{selectedVoice.name}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal truncate hidden sm:inline">
            ({selectedVoice.gender}) - {selectedVoice.description}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
           <Mic size={14} className={isOpen ? 'text-brand-500' : ''}/>
           <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-80 overflow-y-auto scrollbar-thin">
          {voices.map((voice) => {
            const isPreviewing = previewState.voiceId === voice.id;
            const isSelected = selectedVoiceId === voice.id;

            return (
              <div 
                key={voice.id}
                onClick={() => {
                  onSelect(voice.id);
                  setIsOpen(false);
                }}
                className={`
                  p-3 flex items-center justify-between cursor-pointer border-b border-slate-50 dark:border-slate-800/50 last:border-0 transition-colors
                  ${isSelected ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
                `}
              >
                <div className="flex flex-col">
                  <span className={`text-sm font-medium ${isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200'}`}>
                    {voice.name}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {voice.gender} • {voice.description}
                  </span>
                </div>

                <button
                  onClick={(e) => handlePreview(e, voice)}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center transition-all ml-3 shrink-0
                    ${isPreviewing 
                      ? 'bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-slate-700 dark:hover:text-brand-400'}
                  `}
                  title="Preview Voice"
                >
                  {isPreviewing ? (
                    previewState.status === 'loading' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Square size={12} fill="currentColor" />
                    )
                  ) : (
                    <Play size={12} fill="currentColor" className="ml-0.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
