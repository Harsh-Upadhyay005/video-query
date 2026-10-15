import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  Zap,
  Coins,
  Search,
  FileVideo,
  Share2,
  Sparkles,
  Check,
  ShieldCheck,
  Volume2
} from "lucide-react";
import { TextRoll } from "@/components/ui/text-roll";

type EngineTab = "whisper" | "sarvam";

export const FeatureShowcase: React.FC = () => {
  const [selectedEngine, setSelectedEngine] = useState<EngineTab>("whisper");

  return (
    <section
      id="features"
      className="py-20 sm:py-28 px-4 sm:px-6 bg-[#FDFCF0] border-t border-[#1A1A1A]/10 text-[#1A1A1A] overflow-hidden"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1A1A1A] text-[#FDFCF0] text-[11px] sm:text-xs font-semibold uppercase tracking-wider mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#D9CCF5]" />
            <span>Deep Architectural Capabilities</span>
          </div>

          <h2 className="font-['Baskervville',serif] text-4xl sm:text-5xl md:text-6xl text-[#1A1A1A] tracking-tight leading-[1.12]">
            Built for serious scale. <br className="hidden sm:inline" />
            <span className="italic font-normal text-[#8A8A8A]">Engineered for zero waste.</span>
          </h2>

          <p className="mt-4 sm:mt-5 text-[#1A1A1A]/80 text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed">
            From zero-LLM ingestion costs to sub-10ms localized vector lookups, explore the deep-tech foundations powering VideoQuery.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-7">
          {/* Bento Card 1: Dual-Engine Transcription Matrix (Span 7) */}
          <div className="md:col-span-12 lg:col-span-7 bg-white rounded-3xl border border-[#1A1A1A]/15 p-6 sm:p-8 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
            <div>
              {/* Header with Metric */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#D9CCF5] text-[#1A1A1A] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Cpu className="w-6 h-6 stroke-[1.75]" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] block">
                      Speech Architecture
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-[#1A1A1A]">
                      Dual-Engine Speech Recognition
                    </h3>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#F4F3E8] border border-[#1A1A1A]/10 text-[#1A1A1A]">
                  4-8x Faster Inference
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#1A1A1A]/75 leading-relaxed mb-6">
                Intelligently switches between local CTranslate2 Faster-Whisper and Sarvam AI dialect processing to deliver flawless English and Hinglish recognition.
              </p>

              {/* Interactive Engine Switcher */}
              <div className="bg-[#FAF9F0] p-1.5 rounded-2xl border border-[#1A1A1A]/10 flex items-center gap-1.5 mb-5">
                <button
                  onClick={() => setSelectedEngine("whisper")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    selectedEngine === "whisper"
                      ? "bg-[#1A1A1A] text-white shadow-sm"
                      : "text-[#1A1A1A]/70 hover:text-[#1A1A1A]"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-[#D9CCF5]" />
                  <TextRoll>Faster-Whisper (Local)</TextRoll>
                </button>
                <button
                  onClick={() => setSelectedEngine("sarvam")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    selectedEngine === "sarvam"
                      ? "bg-[#1A1A1A] text-white shadow-sm"
                      : "text-[#1A1A1A]/70 hover:text-[#1A1A1A]"
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                  <TextRoll>Sarvam AI (Hinglish)</TextRoll>
                </button>
              </div>

              {/* Dynamic Engine Spec Box */}
              <AnimatePresence mode="wait">
                {selectedEngine === "whisper" ? (
                  <motion.div
                    key="whisper-spec"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="p-4 rounded-2xl bg-[#FDFCF0] border border-[#1A1A1A]/10 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-[#1A1A1A]">CTranslate2 INT8 Engine</span>
                      <span className="font-mono text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        Zero Cloud Latency
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-[#1A1A1A]/80">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Word-level millisecond alignment</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>16kHz mono audio normalization</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Low-VRAM & CPU compatible</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Whisper large-v3 precision</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="sarvam-spec"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="p-4 rounded-2xl bg-[#FDFCF0] border border-[#1A1A1A]/10 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-[#1A1A1A]">Sarvam Multi-Dialect Pipeline</span>
                      <span className="font-mono text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        Hinglish Code-Switching
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-[#1A1A1A]/80">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Natural Hindi-English switching</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Colloquial slang understanding</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Devanagari & Latin script outputs</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Technical acronym retention</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bento Card 2: Zero-LLM Ingestion Architecture (Span 5) */}
          <div className="md:col-span-12 lg:col-span-5 bg-white rounded-3xl border border-[#1A1A1A]/15 p-6 sm:p-8 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#E5D7FA] text-[#1A1A1A] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Coins className="w-6 h-6 stroke-[1.75]" />
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  0 Ingestion Tokens
                </span>
              </div>

              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] block mb-1">
                Cost & Latency Optimization
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-[#1A1A1A] mb-3">
                Zero-LLM Cost Ingestion
              </h3>
              <p className="text-xs sm:text-sm text-[#1A1A1A]/75 leading-relaxed mb-6">
                Traditional video bots burn expensive LLM tokens summarizing hours of raw transcripts. VideoQuery ingests and indexes directly into ChromaDB vectors with <strong>zero token burn</strong>.
              </p>
            </div>

            {/* Visual Token Comparison Metric */}
            <div className="p-4 rounded-2xl bg-[#FAF9F0] border border-[#1A1A1A]/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8A8A8A] font-medium">Traditional AI Ingestion</span>
                <span className="text-rose-600 font-mono font-bold">~120k Tokens ($$$)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-rose-100 overflow-hidden">
                <div className="w-4/5 h-full bg-rose-400 rounded-full" />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[#1A1A1A] font-bold">VideoQuery Pipeline</span>
                <span className="text-emerald-700 font-mono font-bold">0 Tokens ($0.00)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-emerald-100 overflow-hidden">
                <div className="w-1/12 h-full bg-emerald-500 rounded-full" />
              </div>

              <p className="text-[11px] text-[#8A8A8A] pt-1">
                The LLM is only queried on-demand when you ask a question.
              </p>
            </div>
          </div>

          {/* Bento Card 3: Sub-10ms Hybrid RAG Retrieval (Span 4) */}
          <div className="md:col-span-12 lg:col-span-4 bg-white rounded-3xl border border-[#1A1A1A]/15 p-6 sm:p-7 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-2xl bg-[#D9CCF5] text-[#1A1A1A] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Search className="w-5 h-5 stroke-[1.75]" />
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#F4F3E8] border border-[#1A1A1A]/10 text-[#1A1A1A]">
                  &lt; 10ms Latency
                </span>
              </div>

              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] block mb-1">
                Vector Retrieval
              </span>
              <h3 className="text-base sm:text-lg font-bold text-[#1A1A1A] mb-2.5">
                Sub-10ms Hybrid RAG
              </h3>
              <p className="text-xs sm:text-sm text-[#1A1A1A]/70 leading-relaxed mb-4">
                Dense ChromaDB embeddings paired with sparse BM25 keyword matching retrieve accurate context segments in single-digit milliseconds.
              </p>
            </div>

            <div className="pt-4 border-t border-[#1A1A1A]/10 space-y-2 text-xs text-[#1A1A1A]/80">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Mistral 7B grounded responses</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Verified second-level timestamp citations</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Dynamic confidence score calculation</span>
              </div>
            </div>
          </div>

          {/* Bento Card 4: Universal 12+ Formats & PDF (Span 4) */}
          <div className="md:col-span-12 lg:col-span-4 bg-white rounded-3xl border border-[#1A1A1A]/15 p-6 sm:p-7 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-2xl bg-[#E5D7FA] text-[#1A1A1A] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileVideo className="w-5 h-5 stroke-[1.75]" />
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#F4F3E8] border border-[#1A1A1A]/10 text-[#1A1A1A]">
                  12+ Formats
                </span>
              </div>

              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] block mb-1">
                Input Pipeline
              </span>
              <h3 className="text-base sm:text-lg font-bold text-[#1A1A1A] mb-2.5">
                Universal Media & PDF Support
              </h3>
              <p className="text-xs sm:text-sm text-[#1A1A1A]/70 leading-relaxed mb-4">
                Drag and drop virtually any media or document format. Auto-converts video streams, extracts audio, and indexes PDF tables.
              </p>
            </div>

            {/* Format Chips Grid */}
            <div className="pt-4 border-t border-[#1A1A1A]/10">
              <div className="flex flex-wrap gap-1.5">
                {["YouTube", "MP4", "MKV", "MP3", "WAV", "PDF", "FLAC", "AAC", "M4A"].map((fmt, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-[#FAF9F0] border border-[#1A1A1A]/10 text-[10px] font-mono font-semibold text-[#1A1A1A]"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bento Card 5: Subtitles & Collaboration Export (Span 4) */}
          <div className="md:col-span-12 lg:col-span-4 bg-white rounded-3xl border border-[#1A1A1A]/15 p-6 sm:p-7 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-2xl bg-[#D9CCF5] text-[#1A1A1A] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Share2 className="w-5 h-5 stroke-[1.75]" />
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#F4F3E8] border border-[#1A1A1A]/10 text-[#1A1A1A]">
                  SRT • VTT • Share
                </span>
              </div>

              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A8A8A] block mb-1">
                Collaboration & Export
              </span>
              <h3 className="text-base sm:text-lg font-bold text-[#1A1A1A] mb-2.5">
                Instant Subtitles & Public Links
              </h3>
              <p className="text-xs sm:text-sm text-[#1A1A1A]/70 leading-relaxed mb-4">
                Export synchronized subtitle files for video editors, generate markdown reports, or create shareable public links for team members.
              </p>
            </div>

            <div className="pt-4 border-t border-[#1A1A1A]/10 space-y-2 text-xs text-[#1A1A1A]/80">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>One-click SRT & VTT subtitle downloads</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Structured action item markdown export</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Public standalone reader pages</span>
              </div>
            </div>
          </div>
        </div>

        {/* Architecture Specs & Privacy Trust Banner */}
        <div className="mt-12 sm:mt-16 p-6 sm:p-8 rounded-3xl bg-[#FAF9F0] border border-[#1A1A1A]/15 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center lg:text-left">
            <div className="w-12 h-12 rounded-2xl bg-[#1A1A1A] text-white flex items-center justify-center shrink-0 mx-auto lg:mx-0">
              <ShieldCheck className="w-6 h-6 text-[#D9CCF5]" />
            </div>
            <div>
              <h4 className="font-bold text-sm sm:text-base text-[#1A1A1A]">
                100% Privacy & Local Store Execution
              </h4>
              <p className="text-xs sm:text-sm text-[#8A8A8A]">
                Audio files and vector indices remain strictly inside your environment. Zero training on user data.
              </p>
            </div>
          </div>

          {/* Stack Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
            {["FastAPI", "Faster-Whisper", "ChromaDB", "Mistral AI", "Chrome V3"].map((tech, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-full bg-white border border-[#1A1A1A]/10 text-xs font-mono font-semibold text-[#1A1A1A] shadow-xs flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
