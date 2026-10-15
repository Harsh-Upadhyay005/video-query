import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  FileText,
  AudioLines,
  Bot,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
  Chrome,
  Play,
  Zap
} from "lucide-react";
import { TextRoll } from "@/components/ui/text-roll";

interface WorkflowPipelineProps {
  onNavigateToStudio?: () => void;
}

type TabType = "extension" | "video" | "audio" | "pdf";

interface WorkflowData {
  id: TabType;
  label: string;
  badge: string;
  icon: React.ElementType;
  tagline: string;
}

const TABS: WorkflowData[] = [
  {
    id: "extension",
    label: "Chrome Extension",
    badge: "In-Browser",
    icon: Chrome,
    tagline: "One-click AI side panel directly alongside any YouTube video without leaving your tab."
  },
  {
    id: "video",
    label: "Video Studio",
    badge: "Most Popular",
    icon: Video,
    tagline: "Turn hours of recorded lectures, podcasts, or YouTube guides into instant answers."
  },
  {
    id: "audio",
    label: "Audio & Hinglish",
    badge: "Dual-Engine",
    icon: AudioLines,
    tagline: "Transcribe voice memos, podcasts, and Hinglish calls with Faster-Whisper & Sarvam AI."
  },
  {
    id: "pdf",
    label: "PDF & Research Docs",
    badge: "Metadata-Aware",
    icon: FileText,
    tagline: "Interrogate complex multi-page documents, research papers, and technical manuals."
  }
];

export const WorkflowPipeline: React.FC<WorkflowPipelineProps> = ({ onNavigateToStudio }) => {
  const [activeTab, setActiveTab] = useState<TabType>("extension");

  return (
    <section
      id="tour"
      className="relative py-20 sm:py-28 px-4 sm:px-6 bg-[#073328] text-white overflow-hidden"
    >
      {/* Anchor alias for backward-compatible links */}
      <span id="workflow" className="absolute -top-20 opacity-0 pointer-events-none" />

      {/* Atmospheric Radial Gradients (Wispr Forest Green Theme) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.15),transparent_70%)]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-[radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_60%)]" />
        <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-[radial-gradient(circle_at_center,rgba(5,150,105,0.08),transparent_60%)]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#05261E] border border-emerald-500/30 text-emerald-300 text-[11px] sm:text-xs font-semibold uppercase tracking-wider mb-4 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Interactive Product Tour</span>
          </motion.div>

          {/* Wispr Flow Headline Style: Baskervville with Italic Contrast */}
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-['Baskervville',serif] text-4xl sm:text-6xl md:text-7xl font-normal text-[#FAF8F0] tracking-tight leading-[1.12]"
          >
            10x faster <span className="italic font-normal text-emerald-200">than scrubbing video</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="mt-4 sm:mt-6 text-emerald-100/80 text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed"
          >
            Knowledge that works right where you watch or listen. Whether via our native Chrome extension alongside YouTube or in the full studio, get exact timestamped answers in seconds.
          </motion.p>
        </div>

        {/* Side-by-Side Comparison Cards (Wispr Flow Aesthetic) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 mb-14 sm:mb-20">
          {/* Card 1: Manual Scrubbing (Muted) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="md:col-span-5 bg-[#0A392D]/70 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col justify-between backdrop-blur-sm"
          >
            <div>
              <span className="text-emerald-300/70 text-xs font-bold uppercase tracking-wider block mb-2">
                Traditional Manual Scrubbing
              </span>
              <div className="font-['Baskervville',serif] text-4xl sm:text-5xl text-[#FAF8F0] mb-3">
                15+ mins
              </div>
              <p className="text-xs sm:text-sm text-emerald-100/60 leading-relaxed">
                Dragging the YouTube scrubber back and forth, squinting at waveform segments, taking fragmented notes, and guessing when the speaker answered your question.
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300/50 mb-2">
                <span>00:00</span>
                <span className="text-rose-300/80">Searching...</span>
                <span>45:30</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="w-2/5 h-full bg-rose-400/50 rounded-full" />
              </div>
            </div>
          </motion.div>

          {/* Card 2: VideoQuery Flow (Featured, Glowing, Animated) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="md:col-span-7 relative bg-gradient-to-br from-[#0F4C3D] to-[#0A3628] border border-emerald-400/30 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between overflow-hidden"
          >
            {/* Ambient Corner Glow */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-emerald-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  VideoQuery Flow
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  Sub-10ms RAG
                </span>
              </div>

              <div className="font-['Baskervville',serif] text-4xl sm:text-5xl text-white mb-3">
                2 seconds
              </div>

              <p className="text-xs sm:text-sm text-emerald-50/90 leading-relaxed max-w-lg">
                Type or speak your question. Faster-Whisper transcripts and ChromaDB localized vectors pinpoint the exact second, cite the video segment, and ground Mistral’s answer.
              </p>
            </div>

            {/* Wispr Flow-style Waveform Marquee Pill */}
            <div className="mt-6 pt-5 border-t border-emerald-400/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Dark Pill with Animated Waveform Equalizer */}
                <div className="inline-flex items-center gap-2.5 bg-[#05261E] border border-emerald-400/30 rounded-full px-4 py-2 shadow-inner">
                  <div className="flex items-center gap-1 h-4">
                    {[0.6, 1, 0.4, 0.85, 0.5, 0.9, 0.3, 0.75, 1, 0.45].map((scale, i) => (
                      <motion.span
                        key={i}
                        className="w-1 bg-emerald-300 rounded-full"
                        animate={{
                          height: ["30%", `${scale * 100}%`, "30%"]
                        }}
                        transition={{
                          duration: 0.8 + (i % 3) * 0.2,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.08
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-mono font-medium text-emerald-200">
                    Live 16kHz Ingestion
                  </span>
                </div>
              </div>

              <button
                onClick={onNavigateToStudio}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#FAF8F0] hover:bg-white text-[#073328] font-bold text-xs transition-all hover:scale-105 active:scale-95 shadow-md shrink-0"
              >
                <TextRoll>Launch Studio</TextRoll>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Interactive Mode Tabs */}
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all border ${
                  isSelected
                    ? "bg-[#FAF8F0] text-[#073328] border-white shadow-lg scale-105"
                    : "bg-[#093C30]/80 text-emerald-100/80 border-emerald-500/20 hover:border-emerald-400/50 hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? "text-[#073328]" : "text-emerald-300"}`} />
                <TextRoll>{tab.label}</TextRoll>
                <span
                  className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full font-bold ${
                    isSelected
                      ? "bg-[#073328] text-emerald-200"
                      : "bg-[#05261E] text-emerald-300/80"
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display */}
        <AnimatePresence mode="wait">
          {activeTab === "extension" && (
            <motion.div
              key="extension"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="bg-[#093C30]/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-9 shadow-2xl backdrop-blur-md"
            >
              {/* Top Banner */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-emerald-500/20 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-300 uppercase tracking-wider mb-1">
                    <Chrome className="w-4 h-4 text-emerald-400" />
                    <span>VideoQuery Chrome Extension • Manifest V3</span>
                  </div>
                  <h3 className="font-['Baskervville',serif] text-2xl sm:text-3xl text-[#FAF8F0] font-normal">
                    Chat with YouTube without leaving the video
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-100/70 mt-1 max-w-xl">
                    A native companion that injects directly into YouTube. Click the button under any player to open a synchronized side panel.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/40 text-xs font-mono font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Active on youtube.com
                  </span>
                </div>
              </div>

              {/* Extension Visual Mockup */}
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Left: YouTube Player Mockup with Injected Button */}
                <div className="lg:col-span-7 bg-[#05261E] rounded-2xl border border-emerald-500/30 overflow-hidden flex flex-col justify-between">
                  {/* Fake Browser Top Bar */}
                  <div className="px-4 py-2.5 bg-[#031B15] border-b border-emerald-500/20 flex items-center justify-between text-xs text-emerald-200/60 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="truncate max-w-xs text-[11px]">
                      youtube.com/watch?v=lex-fridman-deep-learning
                    </span>
                    <span className="text-[10px] text-emerald-400">1080p HD</span>
                  </div>

                  {/* Video Screen Preview */}
                  <div className="relative aspect-video bg-gradient-to-br from-neutral-900 to-black flex items-center justify-center p-6 text-center">
                    <div className="space-y-2">
                      <div className="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center mx-auto shadow-lg">
                        <Play className="w-6 h-6 ml-1 fill-white" />
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-white max-w-md">
                        Deep Learning & Foundation Agents: State of the Art
                      </h4>
                      <p className="text-xs text-neutral-400 font-mono">
                        Playing at 14:22 / 1:28:40
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="absolute bottom-0 inset-x-0 h-1.5 bg-neutral-800">
                      <div className="w-[18%] h-full bg-rose-600" />
                    </div>
                  </div>

                  {/* YouTube Action Bar with Injected VideoQuery Button */}
                  <div className="p-4 bg-[#05261E] border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 text-white flex items-center justify-center text-xs font-bold">
                        AI
                      </div>
                      <div className="text-xs">
                        <div className="font-semibold text-white">AI Research Lab</div>
                        <div className="text-[10px] text-neutral-400">1.2M subscribers</div>
                      </div>
                    </div>

                    {/* Injected Button Highlight */}
                    <motion.div
                      animate={{ scale: [1, 1.03, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="flex items-center gap-2"
                    >
                      <button className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-[#073328] font-bold text-xs shadow-md transition-all">
                        <Sparkles className="w-3.5 h-3.5" />
                        <TextRoll>Analyze with VideoQuery</TextRoll>
                      </button>
                    </motion.div>
                  </div>
                </div>

                {/* Right: Native Chrome Side Panel Mockup */}
                <div className="lg:col-span-5 bg-[#073328] rounded-2xl border border-emerald-400/40 p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-xl">
                  {/* Side Panel Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-400 text-[#073328] flex items-center justify-center font-bold text-xs">
                        VQ
                      </div>
                      <span className="font-bold text-xs text-white">
                        VideoQuery Side Panel
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-300 bg-[#05261E] px-2 py-0.5 rounded border border-emerald-500/30">
                      Sync On
                    </span>
                  </div>

                  {/* Q&A Chat Stream */}
                  <div className="space-y-3">
                    <div className="bg-[#05261E] p-3 rounded-xl border border-emerald-500/20">
                      <span className="text-[10px] font-mono uppercase text-emerald-300/80 block mb-1">
                        You Asked
                      </span>
                      <p className="text-xs text-white font-medium">
                        What did they conclude about long context attention decay?
                      </p>
                    </div>

                    <div className="bg-[#0B4032] p-3.5 rounded-xl border border-emerald-400/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                          <Bot className="w-3 h-3" /> Mistral RAG Answer
                        </span>
                        <span className="text-[9px] font-mono text-emerald-200 bg-emerald-400/20 px-1.5 py-0.2 rounded">
                          98.6% match
                        </span>
                      </div>
                      <p className="text-xs text-emerald-50 leading-relaxed">
                        At 14:22, the speaker highlights that RoPE positional interpolation prevents attention sink degradation across 128k context windows.
                      </p>
                      <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#05261E] hover:bg-emerald-400 hover:text-[#073328] text-emerald-200 text-[10px] font-mono font-semibold transition-all border border-emerald-500/30">
                        <Clock className="w-3 h-3" />
                        <TextRoll>[14:22] Jump Video to Timestamp</TextRoll>
                      </button>
                    </div>
                  </div>

                  {/* Quick Feature Checklist */}
                  <div className="pt-3 border-t border-emerald-500/20 grid grid-cols-2 gap-2 text-[11px] text-emerald-100/80">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Zero Tab Switching</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Word-Level Timestamps</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "video" && (
            <motion.div
              key="video"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="bg-[#093C30]/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-9 shadow-2xl backdrop-blur-md"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-emerald-500/20 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-300 uppercase tracking-wider mb-1">
                    <Video className="w-4 h-4 text-emerald-400" />
                    <span>Video Knowledge Ingestion Engine</span>
                  </div>
                  <h3 className="font-['Baskervville',serif] text-2xl sm:text-3xl text-[#FAF8F0] font-normal">
                    Transform full lectures & recordings into searchable memory
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-100/70 mt-1 max-w-xl">
                    Paste any YouTube URL or drop MP4/MKV video files. Ingestion runs 100% LLM-free, streaming directly into ChromaDB.
                  </p>
                </div>

                <button
                  onClick={onNavigateToStudio}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#FAF8F0] hover:bg-white text-[#073328] font-bold text-xs transition-all hover:scale-105 active:scale-95 shadow-md shrink-0 self-start lg:self-auto"
                >
                  <TextRoll>Open in Studio</TextRoll>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 4 Execution Steps */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { title: "1. Media Extraction", desc: "Downloads 16kHz mono audio streams with zero GPU stalls.", tag: "Zero-LLM Cost" },
                  { title: "2. Faster-Whisper STT", desc: "Transcribes with millisecond word timestamps at 4-8x speed.", tag: "CTranslate2" },
                  { title: "3. ChromaDB Indexing", desc: "Maps text chunks into localized vector space for semantic retrieval.", tag: "Dense Vectors" },
                  { title: "4. Grounded RAG Chat", desc: "Mistral answers questions with verified second-level jump markers.", tag: "Sub-10ms" }
                ].map((s, idx) => (
                  <div key={idx} className="bg-[#05261E] p-4 rounded-2xl border border-emerald-500/20 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                          {s.tag}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-white mb-1">{s.title}</h4>
                      <p className="text-xs text-emerald-100/70 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sample Output Card */}
              <div className="mt-6 bg-[#05261E] p-5 sm:p-6 rounded-2xl border border-emerald-500/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-500/20">
                  <span className="font-bold text-sm text-white">Stanford CS229: Machine Learning Lecture (1h 14m)</span>
                  <span className="text-xs font-mono text-emerald-300">14,280 words • 38 Chunks</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-xs px-3 py-1.5 rounded-lg bg-[#093C30] text-emerald-200 border border-emerald-500/30 flex items-center gap-1.5 cursor-pointer hover:bg-emerald-400 hover:text-[#073328] transition-colors">
                    <Clock className="w-3 h-3" /> [04:12] Batch vs Stochastic Gradient Descent
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-lg bg-[#093C30] text-emerald-200 border border-emerald-500/30 flex items-center gap-1.5 cursor-pointer hover:bg-emerald-400 hover:text-[#073328] transition-colors">
                    <Clock className="w-3 h-3" /> [19:40] Learning Rate Decay Schedules
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-lg bg-[#093C30] text-emerald-200 border border-emerald-500/30 flex items-center gap-1.5 cursor-pointer hover:bg-emerald-400 hover:text-[#073328] transition-colors">
                    <Clock className="w-3 h-3" /> [42:05] Convexity & Saddle Points
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "audio" && (
            <motion.div
              key="audio"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="bg-[#093C30]/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-9 shadow-2xl backdrop-blur-md"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-emerald-500/20 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-300 uppercase tracking-wider mb-1">
                    <AudioLines className="w-4 h-4 text-emerald-400" />
                    <span>Dual-Engine Audio & Hinglish Architecture</span>
                  </div>
                  <h3 className="font-['Baskervville',serif] text-2xl sm:text-3xl text-[#FAF8F0] font-normal">
                    Precision STT for English and Hinglish Conversations
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-100/70 mt-1 max-w-xl">
                    Intelligently routes speech to Sarvam AI or Faster-Whisper, handling code-switching, technical jargon, and multi-speaker calls.
                  </p>
                </div>

                <button
                  onClick={onNavigateToStudio}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#FAF8F0] hover:bg-white text-[#073328] font-bold text-xs transition-all hover:scale-105 active:scale-95 shadow-md shrink-0 self-start lg:self-auto"
                >
                  <TextRoll>Analyze Audio</TextRoll>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#05261E] p-5 rounded-2xl border border-emerald-500/20 space-y-3">
                  <span className="text-[10px] font-mono uppercase text-emerald-300 font-bold">
                    Dual Speech Engines
                  </span>
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-[#073328] border border-emerald-500/20">
                      <div className="font-bold text-xs text-white">CTranslate2 Faster-Whisper</div>
                      <div className="text-[11px] text-emerald-100/70">Local GPU/CPU inference, 4-8x speedup, multi-language support.</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#073328] border border-emerald-500/20">
                      <div className="font-bold text-xs text-white">Sarvam AI Speech Engine</div>
                      <div className="text-[11px] text-emerald-100/70">Engineered specifically for Hindi & Hinglish natural code-switching.</div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#05261E] p-5 rounded-2xl border border-emerald-500/20 space-y-3">
                  <span className="text-[10px] font-mono uppercase text-emerald-300 font-bold">
                    Automated Executive Extraction
                  </span>
                  <p className="text-xs text-emerald-100/70">
                    Immediately breaks team calls into bulleted decisions, assigned owners, and unanswered open questions.
                  </p>
                  <div className="p-3 rounded-xl bg-[#073328] border border-emerald-500/20 text-xs text-white space-y-1">
                    <div className="text-emerald-300 font-mono text-[10px]">Sample Extracted Item:</div>
                    <div>&bull; Decision: ChromaDB finalized for sub-10ms local retrieval</div>
                    <div>&bull; Owner: Engineering team (launch scheduled for sprint 4)</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "pdf" && (
            <motion.div
              key="pdf"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="bg-[#093C30]/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-9 shadow-2xl backdrop-blur-md"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-emerald-500/20 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-300 uppercase tracking-wider mb-1">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Document & PDF Knowledge Ingestion</span>
                  </div>
                  <h3 className="font-['Baskervville',serif] text-2xl sm:text-3xl text-[#FAF8F0] font-normal">
                    Conversational RAG for Research Papers & Manuals
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-100/70 mt-1 max-w-xl">
                    Metadata-aware sliding window chunking preserves table context and paragraph boundaries for page-accurate citations.
                  </p>
                </div>

                <button
                  onClick={onNavigateToStudio}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#FAF8F0] hover:bg-white text-[#073328] font-bold text-xs transition-all hover:scale-105 active:scale-95 shadow-md shrink-0 self-start lg:self-auto"
                >
                  <TextRoll>Upload Document</TextRoll>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#05261E] p-4 rounded-2xl border border-emerald-500/20">
                  <h4 className="font-bold text-xs text-white mb-1">Metadata-Aware Parsing</h4>
                  <p className="text-[11px] text-emerald-100/70">Preserves headers, page numbers, and structural hierarchies across chapters.</p>
                </div>
                <div className="bg-[#05261E] p-4 rounded-2xl border border-emerald-500/20">
                  <h4 className="font-bold text-xs text-white mb-1">Hybrid BM25 + Vector</h4>
                  <p className="text-[11px] text-emerald-100/70">Combines dense semantic understanding with exact acronym and formula matching.</p>
                </div>
                <div className="bg-[#05261E] p-4 rounded-2xl border border-emerald-500/20">
                  <h4 className="font-bold text-xs text-white mb-1">Page-Accurate Grounding</h4>
                  <p className="text-[11px] text-emerald-100/70">Every response provides the exact page number and verbatim excerpt proof.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
