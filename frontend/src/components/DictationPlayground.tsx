import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Sparkles, Check, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SAMPLE_RAW_TEXTS = [
  {
    title: "Messy Dictation Memo",
    raw: "Umm, hope your week has started well… I was talking to Cheyene earlier but reception was really bad and I think their going to handle the first part of the project, but I'm not totally sure. Also, I told the team the new timeline should be ready by Friday, although it's probably going to slip. There's been a lot of back and forth and honestly the whole thing's been kind of chaotic, like nobody really knows what's going on so can you check in with them and see if the notes from yesterday's meeting were sent out, or if they're still waiting. I think Cheyene mentioned it but didn't confirm, and now I'm a little lost.",
    polished: {
      summary: "Cheyene is likely managing phase 1, but confirmation is needed alongside yesterday's meeting notes.",
      actionItems: [
        "Check in with team regarding yesterday's meeting notes dispatch.",
        "Confirm with Cheyene if phase 1 ownership is officially assigned.",
        "Update project schedule before potential Friday deadline slip."
      ],
      keyDecision: "Phase 1 work handed off to Cheyene; timeline review scheduled for Friday."
    }
  },
  {
    title: "Product Strategy Brainstorm",
    raw: "So yeah like basically we were thinking about adding like video transcription features to the landing page... like when users paste a link it should automatically download the audio and convert it to clean text with Whisper, and then use LLMs to extract action items, so like users don't have to manually take notes during 2 hour long Zoom meetings, you know what I mean?",
    polished: {
      summary: "Proposal to integrate automated Whisper audio transcription and LLM-powered action item extraction for long meeting videos.",
      actionItems: [
        "Implement automatic YouTube/Audio downloader pipeline.",
        "Integrate OpenAI Whisper engine for accurate speech-to-text.",
        "Generate key meeting takeaways and structured action lists via LLM."
      ],
      keyDecision: "Prioritize automated video summary feature to eliminate manual meeting note-taking."
    }
  }
];

// ──────────────────────────────────────────────────────
// Web Speech API helpers
// ──────────────────────────────────────────────────────
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const isSpeechSupported = !!SpeechRecognition;

// ──────────────────────────────────────────────────────
// AI cleanup via backend Mistral LLM
// ──────────────────────────────────────────────────────
async function cleanupWithAI(rawText: string): Promise<{
  summary: string;
  actionItems: string[];
  keyDecision: string;
}> {
  const prompt =
    `You are an expert executive assistant. Given the following raw, unedited speech dictation, produce a JSON object with exactly three fields:\n` +
    `1. "summary" — a single-sentence executive summary\n` +
    `2. "actionItems" — an array of 2-5 concise action item strings\n` +
    `3. "keyDecision" — a single sentence describing the primary decision or conclusion\n\n` +
    `Remove all filler words (umm, like, basically, you know, etc.), fix grammar, and distill the core message.\n\n` +
    `Raw dictation:\n"""${rawText}"""\n\n` +
    `Respond ONLY with the JSON object, no markdown fences, no explanation.`;

  const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: prompt }),
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  const data = await response.json();
  const answer: string = data.answer || data.text || '';

  // Try to parse JSON from the LLM response
  try {
    // Strip possible markdown fences
    const jsonStr = answer.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    return {
      summary: parsed.summary || 'Summary unavailable.',
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : ['No action items extracted.'],
      keyDecision: parsed.keyDecision || 'No key decision extracted.',
    };
  } catch {
    // Fallback: treat the whole response as a summary
    return {
      summary: answer.slice(0, 300),
      actionItems: ['Review the AI output for detailed action items.'],
      keyDecision: 'See summary above for the key conclusion.',
    };
  }
}

export const DictationPlayground: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customText, setCustomText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customResult, setCustomResult] = useState<any>(null);
  const [showPlayground, setShowPlayground] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // WPM Counter animation
  const [keyboardWpm, setKeyboardWpm] = useState(0);
  const [videoQueryWpm, setvideoQueryWpm] = useState(0);

  useEffect(() => {
    const duration = 1500; // 1.5s
    const steps = 60;
    const stepTime = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      setKeyboardWpm(Math.min(Math.floor((45 / steps) * step), 45));
      setvideoQueryWpm(Math.min(Math.floor((220 / steps) * step), 220));

      if (step >= steps) {
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, []);

  // ── Real Microphone Recording via Web Speech API ──
  const startRecording = useCallback(() => {
    setMicError(null);

    if (!isSpeechSupported) {
      setMicError("Your browser doesn't support speech recognition. Try Chrome or Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = '';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interim += transcript;
          }
        }
        const combined = (finalTranscript + interim).trim();
        setCustomText(combined);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicError("Microphone access denied. Please allow mic permission and try again.");
        } else if (event.error === 'no-speech') {
          setMicError("No speech detected. Please speak clearly and try again.");
        } else {
          setMicError(`Speech recognition error: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        // Finalize: commit whatever was collected
        if (finalTranscript.trim()) {
          setCustomText(finalTranscript.trim());
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      setCustomResult(null);
    } catch (err: any) {
      setMicError(`Failed to start recording: ${err.message}`);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // ── AI-powered cleanup (calls backend, falls back to simulation) ──
  const handleCleanUpCustom = async () => {
    const text = customText.trim() || SAMPLE_RAW_TEXTS[selectedIndex].raw;
    if (!text) return;
    
    setIsProcessing(true);
    setCleanupError(null);

    try {
      const result = await cleanupWithAI(text);
      setCustomResult(result);
    } catch (err: any) {
      console.warn("Backend AI cleanup failed, using local fallback:", err.message);
      setCleanupError("Backend unavailable — showing local AI simulation.");
      // Fallback: simple local cleanup simulation
      const words = text.split(/\s+/);
      const fillers = ['umm', 'um', 'uh', 'like', 'basically', 'so', 'yeah', 'you', 'know'];
      const cleaned = words.filter(w => !fillers.includes(w.toLowerCase().replace(/[,.!?]/g, ''))).join(' ');
      setCustomResult({
        summary: cleaned.length > 200 ? cleaned.slice(0, 200) + '...' : cleaned,
        actionItems: [
          "Review the cleaned transcript above.",
          "Start the backend server for full AI-powered cleanup."
        ],
        keyDecision: "Connect to the backend API for production-grade AI dictation cleanup."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const sample = SAMPLE_RAW_TEXTS[selectedIndex];
  const currentResult = customResult || sample.polished;

  const handleCopy = () => {
    const textToCopy = `Summary:\n${currentResult.summary}\n\nAction Items:\n${currentResult.actionItems.map((a: string) => `• ${a}`).join('\n')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="playground" className="py-16 sm:py-24 px-4 sm:px-6 md:px-8 bg-[#033E35] text-white overflow-hidden relative">
      {/* Decorative Wave BG */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#033E35] via-[#022f28] to-[#033E35] pointer-events-none z-0" />
      
      <div className="max-w-5xl mx-auto relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <h2 className="font-['Baskervville',serif] text-3xl sm:text-5xl md:text-6xl text-white tracking-tight leading-tight">
            120x faster <span className="italic font-light opacity-95 text-[#D9CCF5]">than watching</span>
          </h2>
          <p className="mt-4 sm:mt-6 text-emerald-100/80 text-sm sm:text-base md:text-lg leading-relaxed font-sans max-w-2xl mx-auto font-light">
            Why sit through a two-hour recording? Video Query ingests video streams in seconds, indexing the transcript for immediate, search-optimized answers.
          </p>
        </div>

        {/* Speed Comparison Layout - Redesigned */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch mb-8 sm:mb-12">
          
          {/* Manual Review Card - Improved Design */}
          <div className="lg:col-span-5 rounded-2xl sm:rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-emerald-900/20 to-emerald-950/40 p-6 sm:p-8 flex flex-col justify-between min-h-[200px] sm:min-h-[240px] backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-300">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400/90 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Manual Review
                </span>
                <span className="text-[10px] text-emerald-300/60 font-mono">Traditional Method</span>
              </div>
              
              <div className="font-['Baskervville',serif] text-5xl sm:text-6xl md:text-7xl font-bold mt-2 text-white">
                {keyboardWpm ? Math.round(keyboardWpm * 1.33) : 0}
                <span className="text-xl sm:text-2xl font-sans text-emerald-300 ml-2 font-normal">mins</span>
              </div>
              
              <div className="mt-4 flex items-center gap-2 text-emerald-200/50 text-xs">
                <div className="w-8 h-0.5 bg-emerald-500/30" />
                <span>Per 1-hour video</span>
              </div>
            </div>
            
            <div className="relative z-10 mt-6 p-4 rounded-xl bg-black/20 border border-emerald-500/10 backdrop-blur-sm">
              <p className="text-xs text-emerald-200/70 leading-relaxed font-mono">
                "Pause video, type bullet points, rewind to hear names, type action items..."
              </p>
            </div>
          </div>

          {/* Video Query Card - Enhanced Design */}
          <div className="lg:col-span-7 rounded-2xl sm:rounded-3xl overflow-hidden relative shadow-2xl min-h-[240px] sm:min-h-[280px] flex flex-col justify-between border-2 border-white/20 backdrop-blur-xl group hover:border-white/40 transition-all duration-300">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/60 via-indigo-900/50 to-teal-900/60" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(167,139,250,0.2),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(52,211,153,0.15),transparent_50%)]" />
            
            {/* Animated grid pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '50px 50px'
              }} />
            </div>
            
            <div className="relative z-10 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-200">
                      Video Query
                    </span>
                  </div>
                  
                  <div className="font-['Baskervville',serif] text-5xl sm:text-6xl md:text-7xl font-bold text-white">
                    {videoQueryWpm ? Math.round(videoQueryWpm * 0.136) : 0}
                    <span className="text-xl sm:text-2xl font-sans text-purple-200 ml-2 font-normal">secs</span>
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-white/90 font-semibold uppercase tracking-wider">
                        Vector Indexing Active
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 items-end">
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 backdrop-blur-sm">
                    <span className="text-xs font-bold text-emerald-300">120x Faster</span>
                  </div>
                  <div className="text-[10px] text-white/60 font-mono">Real-time processing</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/30 border border-white/10 backdrop-blur-md">
                <p className="text-xs text-white/80 leading-relaxed italic font-mono">
                  "Transcribing audio stream at 16kHz mono, computing text chunk embeddings, saving vector database..."
                </p>
              </div>
            </div>

            {/* Enhanced Soundwave Visualization */}
            <div className="relative z-10 flex justify-center pb-6 sm:pb-8">
              <div className="flex h-12 sm:h-14 w-40 sm:w-48 items-center justify-center gap-1.5 rounded-2xl border-2 border-white/30 bg-black/50 px-5 shadow-2xl backdrop-blur-xl">
                {[...Array(10)].map((_, i) => (
                  <span
                    key={i}
                    className="w-1 bg-gradient-to-t from-purple-400 to-white rounded-full soundwave-bar"
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      height: `${20 + Math.random() * 40}%`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Toggle to Interactive Dictation Playground */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <button
            onClick={() => setShowPlayground(!showPlayground)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all border border-white/10"
          >
            <span>{showPlayground ? "Hide Dictation Lab" : "Open Interactive Dictation Lab"}</span>
            {showPlayground ? <ChevronUp className="w-4 h-4 text-[#D9CCF5]" /> : <ChevronDown className="w-4 h-4 text-[#D9CCF5]" />}
          </button>
        </div>

        {/* Collapsible Interactive Lab */}
        <AnimatePresence>
          {showPlayground && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              className="overflow-hidden space-y-6 pt-2"
            >
              {/* Preset Selector Tabs */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {SAMPLE_RAW_TEXTS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedIndex(idx);
                      setCustomResult(null);
                      setCustomText("");
                      setCleanupError(null);
                    }}
                    className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                      selectedIndex === idx && !customResult
                        ? "bg-[#D9CCF5] text-[#0A0A0A] shadow-sm"
                        : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                    }`}
                  >
                    Preset {idx + 1}: {s.title}
                  </button>
                ))}
              </div>

              {/* Mic Error Alert */}
              {micError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{micError}</span>
                  <button onClick={() => setMicError(null)} className="ml-auto text-red-300 hover:text-white text-xs">✕</button>
                </div>
              )}

              {/* Cleanup Error Alert */}
              {cleanupError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cleanupError}</span>
                  <button onClick={() => setCleanupError(null)} className="ml-auto text-amber-300 hover:text-white text-xs">✕</button>
                </div>
              )}

              {/* Two-Column Comparison Card */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-stretch">
                {/* Left Column: Raw Input */}
                <div className="flex flex-col justify-between p-5 sm:p-8 rounded-3xl border border-white/15 bg-white/5 shadow-sm backdrop-blur-md">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-white/10 gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Raw Transcript
                      </span>
                      <div className="flex items-center gap-2">
                        {isRecording && (
                          <span className="flex items-center gap-1.5 text-[10px] text-red-300 bg-red-950/40 px-2 py-0.5 rounded border border-red-900 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            LIVE
                          </span>
                        )}
                        <span className="text-[10px] text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900 shrink-0">
                          {customText ? "Your Dictation" : "Filler Phrases Included"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <textarea
                        value={customText || sample.raw}
                        onChange={(e) => {
                          setCustomText(e.target.value);
                          setCustomResult(null);
                          setCleanupError(null);
                        }}
                        rows={6}
                        className="w-full bg-black/30 p-3.5 sm:p-4 rounded-2xl border border-white/10 text-xs leading-relaxed text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#D9CCF5] resize-none font-mono"
                        placeholder="Type raw dictation, speak into your mic, or select a preset..."
                        disabled={isRecording}
                      />
                    </div>
                  </div>

                  {/* Recording & Controls */}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                    <button
                      onClick={handleRecordToggle}
                      className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isRecording
                          ? "bg-red-600 text-white animate-pulse"
                          : "bg-white/10 hover:bg-white/15 text-white border border-white/10"
                      }`}
                    >
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-red-400" />}
                      <span>{isRecording ? "Stop Recording" : (isSpeechSupported ? "Record Mic" : "Mic Not Supported")}</span>
                    </button>

                    <button
                      onClick={handleCleanUpCustom}
                      disabled={isProcessing || isRecording}
                      className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-emerald-100 transition-all shadow-xs disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>{isProcessing ? "AI Processing..." : "AI Cleanup"}</span>
                    </button>
                  </div>
                </div>

                {/* Right Column: AI Output */}
                <div className="flex flex-col justify-between p-5 sm:p-8 rounded-3xl border border-[#D9CCF5]/30 bg-[#FDFCF0] text-[#0A0A0A] shadow-lg relative overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-black/10">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-purple-600" /> Clean Output
                      </span>
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-black/15 text-xs font-medium text-[#1A1A1A] hover:bg-[#F4F3E8] transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span>Copy</span>}
                      </button>
                    </div>

                    {/* Summary Box */}
                    <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-white border border-black/5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A8A] mb-1">Executive Summary</h4>
                      <p className="text-xs font-medium text-[#1A1A1A] leading-relaxed">
                        {currentResult.summary}
                      </p>
                    </div>

                    {/* Action Items */}
                    <div className="mt-3 p-3.5 sm:p-4 rounded-xl bg-white border border-black/5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A8A] mb-1.5">Action Items</h4>
                      <ul className="space-y-1.5">
                        {currentResult.actionItems.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-[#1A1A1A]">
                            <span className="w-4.5 h-4.5 rounded-full bg-[#E5D7FA] text-[#1A1A1A] flex items-center justify-center font-bold text-[9px] shrink-0">
                              {i + 1}
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Key Decision */}
                    {currentResult.keyDecision && (
                      <div className="mt-3 p-3.5 sm:p-4 rounded-xl bg-white border border-black/5">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A8A] mb-1">Key Decision</h4>
                        <p className="text-xs font-medium text-[#1A1A1A] leading-relaxed">
                          {currentResult.keyDecision}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-black/10 flex items-center justify-between text-[10px] text-[#8A8A8A]">
                    <span>{customResult ? "Powered by Mistral AI" : "Preset Example"}</span>
                    <span className="font-semibold text-emerald-600">{customResult ? "Live AI Result" : "Accuracy Optimized"}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </section>
  );
};
