import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Mic, 
  Play, 
  Pause, 
  Download, 
  RotateCcw, 
  Copy, 
  Trash2, 
  Settings, 
  Moon, 
  Sun,
  History,
  Volume2,
  Check,
  AlertCircle,
  Twitter,
  Instagram,
  Send,
  Linkedin,
  ArrowUpRight,
  Facebook,
  Youtube
} from 'lucide-react';

import { VOICES, LANGUAGES, DEFAULT_CONFIG } from './constants';
import { TTSConfig, AudioHistoryItem, LoadingState } from './types';
import { generateSpeech } from './services/ttsService';
import { processAudioData } from './utils/audioUtils';
import { Tooltip } from './components/Tooltip';
import { VoiceSelector } from './components/VoiceSelector';

export default function App() {
  // State
  const [text, setText] = useState('');
  const [config, setConfig] = useState<TTSConfig>(DEFAULT_CONFIG);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<AudioHistoryItem[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [isDeviceSpeech, setIsDeviceSpeech] = useState(false);
  
  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Theme effect
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Cancel any active SpeechSynthesis on text/mode change
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, [text, isDeviceSpeech]);

  // Timer for simulating device speech playback progress
  useEffect(() => {
    let timer: any;
    if (isDeviceSpeech && isPlaying) {
      timer = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            clearInterval(timer);
            setIsPlaying(false);
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            return 0;
          }
          return Math.min(prev + 0.1, duration);
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isDeviceSpeech, isPlaying, duration]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (audioUrl && audioUrl !== 'device-speech') URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Audio Event Handlers
  const handleTimeUpdate = () => {
    if (audioRef.current && !isDeviceSpeech) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && !isDeviceSpeech) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    if (!isDeviceSpeech) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const togglePlayback = () => {
    if (isDeviceSpeech) {
      if (isPlaying) {
        if (window.speechSynthesis) window.speechSynthesis.pause();
        setIsPlaying(false);
      } else {
        if (window.speechSynthesis) {
          if (currentTime > 0 && window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
            setIsPlaying(true);
          } else {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = config.speed;
            
            const voices = window.speechSynthesis.getVoices();
            const matched = voices.find(v => v.lang.startsWith(config.language));
            if (matched) utterance.voice = matched;
            
            utterance.onend = () => {
              setIsPlaying(false);
              setCurrentTime(0);
            };
            
            utterance.onerror = () => {
              setIsPlaying(false);
              setCurrentTime(0);
            };
            
            window.speechSynthesis.speak(utterance);
            setIsPlaying(true);
          }
        }
      }
      return;
    }

    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (!isDeviceSpeech && audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // Speed Control Effect
  useEffect(() => {
    if (audioRef.current && !isDeviceSpeech) {
      audioRef.current.playbackRate = config.speed;
    }
  }, [config.speed, isDeviceSpeech]);


  // Core Logic: Generate Audio
  const handleConvert = async () => {
    if (!text.trim()) {
      setErrorMessage("Please enter some text to convert.");
      return;
    }

    if (isDeviceSpeech) {
      setLoadingState('generating');
      setErrorMessage(null);
      setIsPlaying(false);
      
      // Simulate quick generation
      setTimeout(() => {
        const words = text.split(/\s+/).filter(Boolean).length;
        const d = Math.max(1.5, words * (0.4 / config.speed));
        setDuration(d);
        setCurrentTime(0);
        setAudioUrl('device-speech');
        setLoadingState('idle');
        
        // Save to History
        const newItem: AudioHistoryItem = {
          id: Date.now().toString(),
          text: text.length > 60 ? text.substring(0, 60) + '...' : text,
          voiceId: 'Device Voice',
          timestamp: Date.now(),
          audioUrl: 'device-speech',
          duration: d
        };
        setHistory(prev => [newItem, ...prev].slice(0, 10)); // Keep last 10
      }, 500);
      return;
    }

    setLoadingState('generating');
    setErrorMessage(null);
    setIsPlaying(false);

    try {
      // 1. Get Base64 Data from Gemini
      const base64Audio = await generateSpeech(text, config);

      // 2. Setup Audio Context if needed for the main player logic
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      }

      // 3. Process Audio (Decode -> Wav -> Blob)
      const { audioUrl: url, duration: audioDuration } = await processAudioData(base64Audio, audioContextRef.current);

      setAudioUrl(url);
      setLoadingState('idle');

      // 4. Save to History
      const newItem: AudioHistoryItem = {
        id: Date.now().toString(),
        text: text.length > 60 ? text.substring(0, 60) + '...' : text,
        voiceId: config.voiceId,
        timestamp: Date.now(),
        audioUrl: url,
        duration: audioDuration
      };
      setHistory(prev => [newItem, ...prev].slice(0, 10)); // Keep last 10

    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes("QUOTA_EXCEEDED") || err.message.toLowerCase().includes("quota") || err.message.includes("429"))) {
        setErrorMessage("QUOTA_EXCEEDED");
      } else {
        setErrorMessage(err.message || "Failed to generate audio.");
      }
      setLoadingState('error');
    }
  };

  const loadFromHistory = (item: AudioHistoryItem) => {
    if (item.audioUrl === 'device-speech') {
      setIsDeviceSpeech(true);
      setAudioUrl('device-speech');
      setText(item.text);
      setDuration(item.duration || 5);
      setIsPlaying(false);
      setCurrentTime(0);
    } else {
      setIsDeviceSpeech(false);
      setAudioUrl(item.audioUrl);
      setText(item.text); 
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(text);
  };
  
  const clearText = () => {
      setText('');
      setAudioUrl(null);
      setIsPlaying(false);
  }

  // Derived UI State
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <div className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-300">
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="https://res.cloudinary.com/df5rgwdng/image/upload/v1773434133/looooo_y1n4b3.png" alt="Text to Speech Logo" className="w-8 h-8 object-contain rounded-md border border-white/30 shadow-md" referrerPolicy="no-referrer" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
              Text to Audio
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4">
        {/* Top Row: Input & Output */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[400px]">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Enter text to convert
                </div>
                <div className="flex gap-1">
                  <Tooltip content="Copy text">
                    <button onClick={copyText} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                      <Copy size={16} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Clear text">
                    <button onClick={clearText} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <textarea 
                className="flex-1 w-full p-6 bg-transparent border-none resize-none focus:ring-0 text-slate-800 dark:text-slate-200 text-lg leading-relaxed placeholder-slate-400 dark:placeholder-slate-600"
                placeholder="Type or paste your text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={5000}
              />
              <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs text-slate-400 font-medium">
                <span>{wordCount} words</span>
                <span>{charCount} / 5000 characters</span>
              </div>
            </div>
          </div>

          {/* Right Column: Player */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 p-6 relative overflow-hidden h-[400px] flex flex-col">
               <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Output</h2>
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                     <span className="text-[10px] font-bold px-2 text-slate-500 uppercase">Speed</span>
                     <input 
                      type="range" 
                      min="0.5" 
                      max="2.0" 
                      step="0.25" 
                      value={config.speed}
                      onChange={(e) => setConfig({...config, speed: parseFloat(e.target.value)})}
                      className="w-20 h-1 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-brand-500"
                     />
                     <span className="text-xs font-mono w-8 text-center text-slate-600 dark:text-slate-300">{config.speed}x</span>
                  </div>
                </div>

                <div className="flex-1 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 flex items-center justify-center relative overflow-hidden group min-h-0">
                  {loadingState === 'generating' ? (
                     <div className="flex items-center gap-1">
                        <div className="w-1.5 h-6 bg-brand-500 rounded-full animate-[bounce_1s_infinite_0ms]"></div>
                        <div className="w-1.5 h-10 bg-brand-500 rounded-full animate-[bounce_1s_infinite_100ms]"></div>
                        <div className="w-1.5 h-4 bg-brand-500 rounded-full animate-[bounce_1s_infinite_200ms]"></div>
                        <div className="w-1.5 h-8 bg-brand-500 rounded-full animate-[bounce_1s_infinite_150ms]"></div>
                        <div className="w-1.5 h-5 bg-brand-500 rounded-full animate-[bounce_1s_infinite_50ms]"></div>
                     </div>
                  ) : audioUrl ? (
                    <div className="w-full h-full flex items-end justify-center gap-1 px-8 pb-8">
                       {Array.from({ length: 20 }).map((_, i) => (
                         <div 
                           key={i} 
                           className={`w-1.5 bg-brand-500/40 rounded-t-sm transition-all duration-300 ${isPlaying ? 'animate-pulse' : ''}`}
                           style={{ height: `${20 + Math.random() * 60}%`, opacity: isPlaying ? 1 : 0.5 }}
                         ></div>
                       ))}
                    </div>
                  ) : (
                    <div className="text-center p-6">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                        <RotateCcw size={20} className="ml-0.5" />
                      </div>
                      <p className="text-sm text-slate-500">Ready to convert</p>
                    </div>
                  )}
                  
                  {errorMessage && (
                    <div className="absolute inset-0 bg-slate-50/95 dark:bg-slate-900/95 flex flex-col items-center justify-center text-center p-6 z-20">
                      {errorMessage === "QUOTA_EXCEEDED" ? (
                        <div className="max-w-sm flex flex-col items-center gap-3">
                          <AlertCircle className="text-amber-500 animate-pulse" size={32} />
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Gemini Limit Exceeded (429)</h4>
                          <p className="text-xs text-slate-500 leading-relaxed px-2">
                            The Gemini daily rate-limit is exceeded on this model. Don't worry, you can instantly convert with your system's built-in vocal engine!
                          </p>
                          <div className="flex flex-col gap-2 w-full mt-3">
                            <button
                              onClick={() => {
                                setIsDeviceSpeech(true);
                                setErrorMessage(null);
                                const words = text.split(/\s+/).filter(Boolean).length;
                                const d = Math.max(1.5, words * (0.4 / config.speed));
                                setDuration(d);
                                setAudioUrl('device-speech');
                                setLoadingState('idle');
                              }}
                              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs py-2 px-3 rounded-lg transition-colors shadow-sm"
                            >
                              Toggle System TTS Engine
                            </button>
                            <button
                              onClick={() => setErrorMessage(null)}
                              className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs py-2 px-3 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <AlertCircle className="text-red-500 mb-2" size={24} />
                          <p className="text-sm text-red-500 font-medium mb-3">{errorMessage}</p>
                          <button 
                            onClick={() => setErrorMessage(null)}
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs py-1.5 px-3 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4 mt-auto">
                   <div className="w-full flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-10 text-right">{formatTime(currentTime)}</span>
                      <input 
                        type="range" 
                        min="0" 
                        max={duration || 0} 
                        value={currentTime} 
                        onChange={handleSeek}
                        disabled={!audioUrl}
                        className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-brand-600 hover:accent-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className="text-xs font-mono text-slate-400 w-10">{formatTime(duration)}</span>
                   </div>

                   <div className="flex items-center justify-between mt-2">
                      <button 
                        onClick={handleConvert}
                        disabled={loadingState === 'generating' || !text.trim()}
                        className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                         {loadingState === 'generating' ? (
                           <>
                             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                             Generating...
                           </>
                         ) : (
                           <>
                             Generate Audio
                           </>
                         )}
                      </button>

                      <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 mx-4"></div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={togglePlayback}
                          disabled={!audioUrl}
                          className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1"/>}
                        </button>
                        
                        {isDeviceSpeech ? (
                          <Tooltip content="System voices are synthesised in real-time and cannot be saved to a file">
                            <div className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50">
                              <Download size={18} />
                            </div>
                          </Tooltip>
                        ) : (
                          <a 
                            href={audioUrl || '#'}
                            download={`voxgen-${Date.now()}.wav`}
                            className={`w-12 h-12 rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors ${!audioUrl ? 'opacity-50 pointer-events-none' : 'text-slate-600 dark:text-slate-300'}`}
                          >
                            <Download size={18} />
                          </a>
                        )}
                      </div>
                   </div>
                </div>
              </div>

              <audio 
                ref={audioRef} 
                src={audioUrl && audioUrl !== 'device-speech' ? audioUrl : undefined}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Bottom Row - Config & History */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-4 flex flex-col gap-4 items-start w-full">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-start w-full max-w-lg">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Speech Engine</label>
              <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
                <button 
                  onClick={() => {
                    setIsDeviceSpeech(false);
                    setAudioUrl(null);
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-md transition-all ${
                    !isDeviceSpeech 
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Gemini AI Cloud
                </button>
                <button 
                  onClick={() => {
                    setIsDeviceSpeech(true);
                    setErrorMessage(null);
                    const words = text.split(/\s+/).filter(Boolean).length;
                    const d = Math.max(1.5, words * (0.4 / config.speed));
                    setDuration(d);
                    setAudioUrl('device-speech');
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-md transition-all ${
                    isDeviceSpeech 
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Device Speech Local
                </button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-start w-full max-w-lg">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Language</label>
              <div className="relative">
                <select 
                  value={config.language}
                  onChange={(e) => setConfig({...config, language: e.target.value})}
                  className="w-full appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none cursor-pointer"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Settings size={14} />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-start w-full max-w-lg">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Voice Persona</label>
              {isDeviceSpeech ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed py-2">
                  Device Speech uses your local operating system's built-in voices matching the selected language ({LANGUAGES.find(v => v.code === config.language)?.name || config.language}).
                </div>
              ) : (
                <VoiceSelector 
                  voices={VOICES}
                  selectedVoiceId={config.voiceId}
                  onSelect={(id) => setConfig({...config, voiceId: id})}
                  languageCode={config.language}
                />
              )}
            </div>
          </div>

          <div className="lg:col-span-8 bg-slate-50 dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <History size={16} className="text-slate-400" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Recent History</h3>
            </div>
            <div className="p-2 overflow-y-auto flex-1 scrollbar-thin">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8">
                  <span className="text-sm">No conversions yet</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(item => (
                    <div key={item.id} className="group p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800 cursor-pointer" onClick={() => loadFromHistory(item)}>
                      <div className="flex justify-between items-start mb-1">
                         <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded">{item.voiceId}</span>
                         <span className="text-[10px] text-slate-400">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-2">
                        {item.text}
                      </p>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                           <Play size={10} /> Play
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full mt-auto">
        <div className="w-full bg-[#111111] dark:bg-[#111111] text-white py-16 px-8 md:px-16 flex flex-col md:flex-row justify-between gap-12 sm:gap-16">
          {/* Left section */}
          <div className="max-w-sm flex flex-col gap-6">
            <h2 className="text-xl font-semibold">Editors Raj</h2>
            <div className="text-sm text-slate-400 leading-relaxed flex flex-col gap-4">
              <p>Created by Aniket Visuals. All rights reserved.</p>
              <p>If this tool helped you, don't forget to follow our social media pages.</p>
            </div>
            <div className="flex gap-4 mt-2">
              <a href="https://www.instagram.com/aniket_visuals/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors">
                <Instagram size={18} />
              </a>
              <a href="https://www.linkedin.com/in/aniketvisuals/" className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors">
                <Linkedin size={18} className="fill-black text-black" />
              </a>
              <a href="https://x.com/Ankitxed" className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
              </a>
              <a href="https://www.youtube.com/@aniket_visuals" className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors">
                <Youtube size={18} />
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-16 md:gap-24">
            {/* Middle Section */}
            <div className="flex flex-col gap-5">
              <h3 className="font-medium mb-1 text-slate-200">Extra links</h3>
              <div className="flex flex-col gap-4">
                <a href="https://discord.com/invite/sxGeT4SCBD" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors">Discord</a>
                <a href="https://t.me/aniket_visuals" className="text-sm text-slate-400 hover:text-white transition-colors">Telegram</a>
                <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">About Us</a>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex flex-col gap-5">
              <h3 className="font-medium mb-1 text-slate-200">Contact</h3>
              <div className="flex flex-col gap-4">
                <a href="mailto:aniketrajcargal123@gmail.com" className="text-sm text-slate-400 hover:text-white transition-colors">aniketrajcargal123@gmail.com</a>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

// Helper to format seconds to MM:SS
function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
