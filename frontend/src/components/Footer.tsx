import type React from "react";
import { Video, ExternalLink, Sparkles } from "lucide-react";
import { FluidGradientText } from "@/components/fluid-gradient-text";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface FooterProps {
  onNavigateToStudio?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateToStudio }) => {
  return (
    <div className="relative bg-[#0A0A0A] text-white">

      {/* 1. "Start videoQuerying" Section */}
      <section className="relative w-full py-16 sm:py-28 px-4 sm:px-6 flex flex-col items-center justify-center overflow-hidden border-b border-white/10">

        {/* Blurry Warm Backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(248,158,53,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,204,245,0.06),transparent_50%)]" />

        {/* Dotted Loop Path SVG Animation */}
        <div className="absolute inset-0 z-0 pointer-events-none hidden sm:block">
          <svg className="w-full h-full" viewBox="0 0 1440 600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              className="animate-dash-draw opacity-30 stroke-white"
              strokeWidth="2"
              d="M 100 450 C 400 450, 600 300, 800 200 C 1000 100, 1200 100, 1150 250 C 1100 400, 950 400, 1100 500 C 1250 600, 1400 450, 1550 400"
            />
          </svg>
        </div>

        {/* Content Container */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl w-full">
          {/* Main Title with dots */}
          <h2 className="font-['Baskervville',serif] text-3xl sm:text-5xl md:text-7xl font-normal text-[#FDFCF0] tracking-tight mb-4">
            Start summarizing<span className="opacity-45">......</span>
          </h2>

          {/* Subtitle */}
          <p className="text-zinc-400 text-xs sm:text-sm md:text-base tracking-wide font-medium mb-8 sm:mb-10 uppercase px-2">
            Effortless video transcription and interactive chat in your browser.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4 mb-8 w-full sm:w-auto">
            {/* Launch Video Studio */}
            <button
              onClick={onNavigateToStudio}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#E5D7FA] hover:bg-[#D9CCF5] text-[#1A1A1A] border border-black/10 px-6 sm:px-7 py-3.5 sm:py-4 text-xs sm:text-sm font-bold shadow-md transition-all hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Launch Video Studio</span>
            </button>

            {/* Explore Presets */}
            <button
              onClick={onNavigateToStudio}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#FDFCF0] hover:bg-white text-[#1A1A1A] border border-black/15 px-6 sm:px-7 py-3.5 sm:py-4 text-xs sm:text-sm font-bold shadow-md transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Explore Demo Presets</span>
            </button>
          </div>

          {/* Device Availability */}
          <p className="text-[11px] sm:text-xs text-zinc-500 font-medium tracking-wide mb-1 px-4 text-center">
            Supports YouTube links • Local MP4, MP3, WAV uploads • Hinglish translations
          </p>
          <p className="text-[10px] sm:text-[11px] text-emerald-400 font-bold uppercase tracking-widest">
            Open source & production ready.
          </p>
        </div>
      </section>

      {/* 2. Standard Legal/Footer Links */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E5D7FA] text-[#1A1A1A] flex items-center justify-center font-bold shrink-0">
              <Video className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-zinc-100"> Video Query</span>
              <p className="text-[10px] text-zinc-500">Transform media & docs into searchable knowledge.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-zinc-500">
            <a href="#tour" className="hover:text-white transition-colors">Product Tour</a>
            <a href="#features" className="hover:text-white transition-colors">Capabilities</a>
            <a
              href={`${API_BASE_URL}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#D9CCF5] transition-colors flex items-center gap-1"
            >
              FastAPI Docs <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="text-[10px] text-zinc-600 font-mono text-center md:text-right">
            © {new Date().getFullYear()} AI Video Agent • Made with ❤️ by UpadhyayJI
          </div>
        </div>
      </footer>

      {/* 3. Fluid Gradient Text Section */}
      <div className="relative w-full border-t border-white/10 pt-10 pb-6 text-foreground overflow-hidden bg-black/40">
        <FluidGradientText text="UpadhyayJI" />
      </div>
    </div>
  );
};
