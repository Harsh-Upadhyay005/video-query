import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Clock,
  CheckCircle2,
  FileText,
  Video,
  Music,
  Youtube,
  Database,
  Cpu,
  Zap,
} from "lucide-react";

export interface AnalysisProgressBarProps {
  progress?: number;
  stage?: string;
  statusMessage?: string;
  mediaType?: "video" | "audio" | "pdf" | "url";
  fileName?: string;
  className?: string;
}

interface StepInfo {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const VIDEO_STEPS: StepInfo[] = [
  {
    id: "ingest",
    label: "Ingest & Extract",
    icon: Video,
    description: "Fetching stream & extracting audio tracks",
  },
  {
    id: "stt",
    label: "AI Transcription",
    icon: AudioWaveformIcon,
    description: "Transcribing with Whisper & timestamp alignment",
  },
  {
    id: "index",
    label: "Vector Store",
    icon: Database,
    description: "Chunking & indexing into ChromaDB",
  },
  {
    id: "analyze",
    label: "Synthesis & RAG",
    icon: Sparkles,
    description: "Mistral executive summary & Q&A readiness",
  },
];

const PDF_STEPS: StepInfo[] = [
  {
    id: "ingest",
    label: "Document Parse",
    icon: FileText,
    description: "Extracting text & formatting page hierarchy",
  },
  {
    id: "stt",
    label: "Content Analysis",
    icon: Cpu,
    description: "Segmenting structural chapters & metadata",
  },
  {
    id: "index",
    label: "Vector Store",
    icon: Database,
    description: "Generating semantic embeddings in ChromaDB",
  },
  {
    id: "analyze",
    label: "Knowledge Ready",
    icon: Sparkles,
    description: "Mistral document summary & instant Q&A",
  },
];

const TIPS = [
  "Timestamp sync enables jumping straight to relevant video moments.",
  "ChromaDB stores high-dimensional embeddings for sub-10ms semantic search.",
  "Whisper AI models provide punctuation and speaker-clean transcriptions.",
  "You can ask complex questions in both English and Hinglish once ready.",
  "Executive summaries highlight core takeaways and key discussion points.",
  "Your indexed knowledge base enables conversational follow-up questions.",
];

function AudioWaveformIcon({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 justify-center ${className || "w-4 h-4"}`}>
      {[40, 90, 60, 100, 50].map((h, i) => (
        <span
          key={i}
          className="w-0.5 bg-current rounded-full animate-pulse"
          style={{ height: `${h}%`, animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

export const AnalysisProgressBar: React.FC<AnalysisProgressBarProps> = ({
  progress = 0,
  stage = "",
  statusMessage = "",
  mediaType = "video",
  fileName,
  className = "",
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [simulatedProgress, setSimulatedProgress] = useState(progress);

  // Timer for elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Rotating tips
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 4500);
    return () => clearInterval(tipInterval);
  }, []);

  // Smooth progress auto-interpolation
  // When real progress arrives from SSE, smoothly jump or track it.
  // When waiting, gently advance so the user never feels the UI is frozen.
  useEffect(() => {
    if (progress > simulatedProgress) {
      setSimulatedProgress(progress);
    }
  }, [progress, simulatedProgress]);

  useEffect(() => {
    const tick = setInterval(() => {
      setSimulatedProgress((current) => {
        // If progress was given by server, stay close to it
        if (progress > 0) {
          if (current < progress) {
            return Math.min(progress, current + 1);
          }
          // Cap simulated creep at +8% beyond server report unless completed
          if (progress < 95 && current < progress + 5) {
            return current + 0.3;
          }
          return current;
        }

        // Fallback simulation when progress is 0 (initial download or upload)
        // Gently climbs up to 88% over ~45s
        if (current < 25) return current + 1.2;
        if (current < 65) return current + 0.6;
        if (current < 88) return current + 0.25;
        return current;
      });
    }, 400);

    return () => clearInterval(tick);
  }, [progress]);

  const displayProgress = Math.min(100, Math.max(0, Math.round(simulatedProgress)));

  const isPdf = mediaType === "pdf";
  const steps = isPdf ? PDF_STEPS : VIDEO_STEPS;

  // Determine current active step (0, 1, 2, or 3)
  const currentStepIndex = (() => {
    const s = stage.toLowerCase();
    if (s.includes("complete") || displayProgress >= 98) return 3;
    if (s.includes("analy") || s.includes("summar") || displayProgress >= 88) return 3;
    if (s.includes("vector") || s.includes("index") || s.includes("chroma") || displayProgress >= 70) return 2;
    if (s.includes("stt") || s.includes("transcrib") || s.includes("extract_text") || s.includes("pdf") || displayProgress >= 30) return 1;
    return 0;
  })();

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const getMediaBadge = () => {
    switch (mediaType) {
      case "url":
        return { label: "YouTube Video", icon: Youtube, bg: "bg-[#1A1A1A] text-white" };
      case "audio":
        return { label: "Audio Stream", icon: Music, bg: "bg-[#D9CCF5] text-[#1A1A1A]" };
      case "pdf":
        return { label: "PDF Document", icon: FileText, bg: "bg-[#1A1A1A] text-white" };
      default:
        return { label: "Media File", icon: Video, bg: "bg-[#D9CCF5] text-[#1A1A1A]" };
    }
  };

  const badge = getMediaBadge();
  const BadgeIcon = badge.icon;

  // Dynamic status text
  const activeMessage = (() => {
    if (statusMessage) return statusMessage;
    if (displayProgress < 20) {
      return mediaType === "url"
        ? "Fetching video stream & analyzing formats..."
        : isPdf
        ? "Reading document pages and structure..."
        : "Uploading file & preparing processing pipeline...";
    }
    if (displayProgress < 50) {
      return isPdf
        ? "Extracting textual paragraphs and headers..."
        : "Transcribing audio tracks with OpenAI Whisper...";
    }
    if (displayProgress < 85) {
      return "Building vector embeddings in ChromaDB for semantic search...";
    }
    return "Generating executive summary & final insights with Mistral AI...";
  })();

  return (
    <div
      className={`bg-white rounded-2xl sm:rounded-3xl border-2 border-[#1A1A1A] p-5 sm:p-7 shadow-[4px_4px_0px_0px_#1A1A1A] text-[#1A1A1A] transition-all ${className}`}
    >
      {/* Top Bar: Badge, Waveform & Stopwatch */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#1A1A1A]/10">
        <div className="flex items-center gap-2.5">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-[#1A1A1A] ${badge.bg}`}
          >
            <BadgeIcon className="w-3.5 h-3.5" />
            <span>{badge.label}</span>
          </div>

          {fileName && (
            <span className="text-xs text-[#8A8A8A] font-medium truncate max-w-[180px] sm:max-w-xs" title={fileName}>
              {fileName}
            </span>
          )}
        </div>

        {/* Live Audio Waves and Timer */}
        <div className="flex items-center gap-3">
          {/* Animated Mini Waveform */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FDFCF0] border border-[#1A1A1A]/15 h-7">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="flex items-center gap-0.5 h-3.5 px-1">
              {[0.4, 0.9, 0.6, 1.0, 0.5, 0.8, 0.3].map((scale, i) => (
                <motion.span
                  key={i}
                  className="w-0.5 bg-[#1A1A1A] rounded-full inline-block"
                  animate={{
                    height: ["30%", `${Math.round(scale * 100)}%`, "20%"],
                  }}
                  transition={{
                    duration: 0.6 + i * 0.08,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
            <span className="text-[11px] font-semibold text-[#1A1A1A] tracking-wider uppercase">Live</span>
          </div>

          {/* Stopwatch */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDFCF0] border border-[#1A1A1A]/15 text-xs font-mono font-medium text-[#1A1A1A]">
            <Clock className="w-3.5 h-3.5 text-[#8A8A8A]" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Main Progress Metric Section */}
      <div className="mt-5 sm:mt-6">
        <div className="flex items-end justify-between gap-4 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-['Baskervville',serif] text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1A1A1A] tracking-tight">
                {displayProgress}%
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8A8A8A]">
                Completed
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-[#1A1A1A] mt-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#1A1A1A] fill-[#D9CCF5]" />
              <span>{activeMessage}</span>
            </p>
          </div>

          <div className="hidden sm:block text-right">
            <span className="text-[11px] font-medium text-[#8A8A8A] uppercase tracking-wider">
              Current Stage
            </span>
            <div className="text-xs sm:text-sm font-bold text-[#1A1A1A]">
              {steps[currentStepIndex]?.label || "Processing"}
            </div>
          </div>
        </div>

        {/* Progress Bar Track with Project Theme */}
        <div className="relative w-full h-4 sm:h-5 rounded-full bg-[#1A1A1A]/10 border-2 border-[#1A1A1A] p-0.5 overflow-hidden shadow-inner">
          <motion.div
            className="h-full rounded-full bg-[#1A1A1A] relative overflow-hidden"
            initial={{ width: 0 }}
            animate={{ width: `${displayProgress}%` }}
            transition={{ ease: "easeOut", duration: 0.4 }}
          >
            {/* Shimmer Lavender Accent Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D9CCF5] to-[#D9CCF5]/40 opacity-80" />

            {/* Moving light beam */}
            <motion.div
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        </div>

        {/* Progress Helper Subtitle */}
        <div className="flex items-center justify-between text-[11px] text-[#8A8A8A] font-medium mt-1.5 px-0.5">
          <span>0% Ingest</span>
          <span>50% Transcribe</span>
          <span>100% Ready</span>
        </div>
      </div>

      {/* 4-Step Pipeline Stepper */}
      <div className="mt-6 sm:mt-7 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {steps.map((step, idx) => {
          const isDone = currentStepIndex > idx || displayProgress >= 100;
          const isCurrent = currentStepIndex === idx && displayProgress < 100;

          return (
            <div
              key={step.id}
              className={`rounded-xl p-3 border transition-all flex flex-col justify-between ${
                isCurrent
                  ? "border-[#1A1A1A] bg-[#D9CCF5]/30 shadow-xs ring-2 ring-[#D9CCF5]"
                  : isDone
                  ? "border-[#1A1A1A]/15 bg-[#FDFCF0]"
                  : "border-[#1A1A1A]/10 bg-white opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                    isCurrent
                      ? "bg-[#1A1A1A] text-[#D9CCF5]"
                      : isDone
                      ? "bg-[#D9CCF5] text-[#1A1A1A]"
                      : "bg-[#1A1A1A]/10 text-[#8A8A8A]"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-[#1A1A1A]" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <div className="text-[10px] font-bold uppercase tracking-wider">
                  {isCurrent ? (
                    <span className="text-[#1A1A1A] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A] animate-ping" />
                      Active
                    </span>
                  ) : isDone ? (
                    <span className="text-emerald-700 font-semibold">Done</span>
                  ) : (
                    <span className="text-[#8A8A8A]">Queued</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-[#1A1A1A] leading-tight">
                  {step.label}
                </div>
                <div className="text-[11px] text-[#8A8A8A] mt-0.5 line-clamp-2 leading-relaxed">
                  {step.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pro-Tip Rotator Banner */}
      <div className="mt-5 pt-4 border-t border-[#1A1A1A]/10 flex items-start gap-2.5">
        <div className="w-5 h-5 rounded-md bg-[#D9CCF5] text-[#1A1A1A] flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3 h-3" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A1A]">
            Did you know?
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={currentTipIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="text-xs text-[#8A8A8A] font-medium mt-0.5 leading-snug"
            >
              {TIPS[currentTipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AnalysisProgressBar;
