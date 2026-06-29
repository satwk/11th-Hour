import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface BrainDumpProps {
  onAnalyze: (rawText: string) => Promise<void>;
  loading: boolean;
}

export const BrainDump: React.FC<BrainDumpProps> = ({ onAnalyze, loading }) => {
  console.log('🎙️ Brain Dump Input Component Rendered!');

  const [rawText, setRawText] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  const [isMicBlocked, setIsMicBlocked] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isExplicitlyStoppedRef = useRef(true);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API is not supported in this browser.");
      setIsMicBlocked(true); // Lockout immediately if unsupported
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; 
    recognition.lang = 'en-US';

    recognition.onstart = () => console.log("🎙️ Web Speech API: Hardware microphone connection opened.");
    recognition.onsoundstart = () => console.log("🔊 Web Speech API: Raw audio/sound detected.");
    recognition.onspeechstart = () => console.log("🗣️ Web Speech API: Voice frequency recognized.");

    recognition.onresult = (event: any) => {
      let finalAccumulated = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalAccumulated += event.results[i][0].transcript;
        }
      }
      if (finalAccumulated) {
        console.log("📝 Finalized Chunk:", finalAccumulated);
        setRawText((prev: string) => {
          const space = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
          return prev + space + finalAccumulated;
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error("❌ Speech API Error:", event.error);
      if (event.error === 'not-allowed' || event.error === 'network') {
        isExplicitlyStoppedRef.current = true;
        setIsListening(false);
        setIsMicBlocked(true); // TRIGGER THE UI LOCKOUT
        
        if (event.error === 'network') {
          alert("Voice dictation is blocked by your browser's privacy shields. Please switch to standard Chrome or Edge.");
        } else {
          alert("Microphone access was denied.");
        }
      }
    };

    recognition.onend = () => {
      console.log("🛑 Web Speech API: Session closed.");
      if (!isExplicitlyStoppedRef.current) {
        console.log("🔄 Keep-Alive triggered: Restarting pipeline.");
        try { recognition.start(); } catch (e) {}
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    return () => {
      isExplicitlyStoppedRef.current = true;
      recognition.abort();
    };
  }, []);

  const toggleVoiceInput = (e: React.MouseEvent) => {
    e.preventDefault(); // CRUCIAL: Blocks form submission and page reloads
    e.stopPropagation(); // Blocks parent element event triggers

    if (isMicBlocked) return;

    if (isListening) {
      isExplicitlyStoppedRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      isExplicitlyStoppedRef.current = false;
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error("Direct activation failure:", err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    await onAnalyze(rawText);
    setRawText(''); // clear on success
  };

  const isSpeechSupported = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return (
    <div className="bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md">
      <h2 className="text-lg font-medium text-[#f7f8f8] mb-2">Brain Dump</h2>
      <p className="text-sm text-[#d0d6e0] mb-4">
        Type whatever is on your mind. The AI will categorize them into Eisenhower quadrants, estimate durations, and assess cognitive loads.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="e.g., I need to finish slides for board meeting tomorrow. Also, should schedule doctor checkup next week."
            className="w-full bg-[#141516] text-[#f7f8f8] border border-[#222326] rounded-md p-3 pr-10 text-sm focus:outline-none focus:border-[#34343a] focus:ring-1 focus:ring-[#5e6ad2] placeholder-[#62666d] resize-none"
            disabled={loading}
          />
          {isSpeechSupported && (
            <button
              type="button"
              disabled={isMicBlocked}
              onClick={(e) => toggleVoiceInput(e)}
              title={isMicBlocked ? "Voice blocked by browser privacy settings" : "Voice Dictation"}
              className={`absolute right-3 bottom-3 p-1.5 rounded-full transition-all duration-300 ${
                isMicBlocked
                  ? 'text-gray-700 cursor-not-allowed opacity-50'
                  : isListening
                    ? 'text-rose-500 animate-pulse drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                    : 'text-gray-400 hover:text-white'
              }`}
            >
              {isMicBlocked ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}
          {!isSpeechSupported && (
            <button
              type="button"
              disabled
              title="Voice not supported on this browser"
              className="absolute right-3 bottom-3 p-1.5 rounded-full opacity-30 cursor-not-allowed text-gray-700"
            >
              <MicOff className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-[#8a8f98]">
            Gemini 3.1 Flash-Lite model handles parsing.
          </span>
          <button
            type="submit"
            disabled={loading || !rawText.trim()}
            className="bg-[#5e6ad2] hover:bg-[#828fff] text-white font-medium text-sm py-2 px-6 rounded-md transition-colors disabled:bg-[#141516] disabled:text-[#62666d] disabled:cursor-not-allowed shadow-sm cursor-pointer"
          >
            {loading ? 'Processing Dump...' : 'Extract Tasks'}
          </button>
        </div>
      </form>
    </div>
  );
};
