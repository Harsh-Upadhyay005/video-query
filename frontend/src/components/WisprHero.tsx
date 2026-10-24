"use client";

import React, { useEffect } from "react";
import { motion } from "motion/react";
import { TextRoll } from "@/components/ui/text-roll";

const WAVE_BAR_COUNT = 32;

const LEFT_TEXT =
  "Umm, okay, so basically we're, like, building this video analyzer tool, and I think we should, you know, integrate Whisper for transcription and Mistral for summarizing. Wait, did we, like, configure ChromaDB for the vector database? Because we need to, like, search timestamps and, umm, answer queries in under ten milliseconds. Hopefully it works...";

const RIGHT_TEXT =
  "We are building a production-ready video analysis system that integrates OpenAI Whisper for transcription and Mistral AI for summarization. The application utilizes ChromaDB as a vector database, enabling users to perform semantic search, locate exact timestamps, and get instant RAG-based answers.";

function WaveformMarquee() {
  const bars = Array.from({ length: WAVE_BAR_COUNT }, (_, index) => index);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <motion.div
        className="flex h-full w-max items-center gap-1.5 px-3"
        animate={{ x: ["-50%", "0%"] }}
        transition={{ duration: 4, ease: "linear", repeat: Infinity }}
      >
        {[...bars, ...bars].map((index, key) => (
          <motion.span
            key={key}
            className="block w-1.5 shrink-0 rounded-full bg-black"
            animate={{
              height: ["20%", `${30 + (index % 8) * 7}%`, "50%", "20%"],
            }}
            transition={{
              duration: 0.35 + (index % 4) * 0.1,
              ease: "linear",
              repeat: Infinity,
              repeatType: "reverse",
              delay: index * 0.05,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}

interface ContentProps {
  onNavigateToStudio?: () => void;
}

function Content({ onNavigateToStudio }: ContentProps) {
  return (
    <div className="relative z-10 flex max-w-3xl flex-col items-center text-center px-4 sm:px-6">
      <h1 className="font-['Baskervville',serif] text-4xl sm:text-6xl md:text-7xl leading-[1.15] tracking-tight">
        <span className="text-[#8A8A8A]">Analyze video.</span>{" "}
        <span className="text-[#1A1A1A]">Ask anything.</span>
      </h1>

      <p className="mt-3 sm:mt-5 max-w-xl text-sm sm:text-base md:text-lg leading-relaxed text-[#1A1A1A]/80">
        Transform YouTube videos, MP3 audio files, and MP4 recordings into clean transcripts, executive summaries, and interactive RAG-powered Q&A. Upload any media file or paste a link—then chat with your content instantly.
      </p>

      <div className="mt-5 sm:mt-7 flex flex-col items-center gap-2.5 w-full max-w-md">
        <button
          onClick={onNavigateToStudio}
          className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-black bg-[#D9CCF5] px-6 py-3 text-sm sm:text-base font-semibold text-[#1A1A1A] transition-all hover:scale-105 active:scale-95 shadow-sm hover:bg-[#cbb8f0]"
        >
          <svg className="w-4 h-4 text-[#1A1A1A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <TextRoll>Launch Video Studio</TextRoll>
        </button>
        <p className="text-[11px] sm:text-xs text-[#8A8A8A] font-medium tracking-wide text-center">
          YouTube URLs • MP3/MP4/WAV Uploads • Drag & Drop • 12 Formats • Hinglish Support
        </p>
      </div>
    </div>
  );
}

function SVGAnimation() {
  const LEFT_TEXT_REPEATED = Array(3).fill(LEFT_TEXT).join("     •     ");
  const RIGHT_TEXT_REPEATED = Array(3).fill(RIGHT_TEXT).join("     •     ");

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[400px] w-full max-w-[100vw] -translate-x-1/2 -translate-y-1/2 overflow-visible hidden md:block"
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 1200 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left Curve: Starts off-screen left, ends at center of pill (600, 200) */}
        <path
          id="first-curve"
          className="fill-transparent stroke-white"
          strokeWidth="2"
          d="M -100 120 C 200 80, 400 200, 600 200"
        />
        <text className="text-[15px]">
          <textPath
            id="marquee-text-first"
            href="#first-curve"
            className="fill-[#1A1A1A] font-normal opacity-40"
            dominantBaseline="central"
          >
            {LEFT_TEXT_REPEATED}
          </textPath>
          <animate
            attributeName="x"
            dur="28s"
            values="-1200;0"
            repeatCount="indefinite"
          />
        </text>

        {/* Right Curve: Starts at center of pill (600, 200), ends off-screen right */}
        <path
          id="second-curve"
          className="stroke-[#1A1A1A]"
          strokeWidth="32"
          strokeLinecap="round"
          d="M 600 200 C 800 200, 1000 320, 1300 280"
        />
        <text className="text-[14px]">
          <textPath
            id="marquee-text-second"
            href="#second-curve"
            className="fill-white font-semibold"
            dominantBaseline="central"
          >
            {RIGHT_TEXT_REPEATED}
          </textPath>
          <animate
            attributeName="x"
            dur="28s"
            values="-1200;0"
            repeatCount="indefinite"
          />
        </text>
      </svg>
    </div>
  );
}

interface HeroProps {
  onNavigateToStudio?: () => void;
}

function Hero({ onNavigateToStudio }: HeroProps) {
  return (
    <section className="relative flex flex-col h-full w-full items-center justify-between overflow-hidden bg-[#FDFCF0] px-4 sm:px-6 pt-20 sm:pt-24 pb-6 sm:pb-8">
      {/* Centered content */}
      <div className="my-auto flex flex-col items-center w-full">
        <Content onNavigateToStudio={onNavigateToStudio} />
      </div>

      {/* Waveform pill at bottom */}
      <div className="relative z-30 flex flex-col items-center gap-2 shrink-0">
        <div className="relative w-24 sm:w-28 overflow-visible">
          <SVGAnimation />
          <div className="relative z-10 flex h-14 sm:h-18 w-full items-center overflow-hidden rounded-full border-2 border-black bg-white shadow-sm">
            <WaveformMarquee />
          </div>
        </div>
      </div>
    </section>
  );
}

interface WisprHeroProps {
  onStartAnalysis?: (source: string) => void;
  onExplorePresets?: () => void;
  onNavigateToStudio?: () => void;
}

export const WisprHero: React.FC<WisprHeroProps> = ({
  onNavigateToStudio
}) => {
  useEffect(() => {
    const id = "baskervville-font";

    if (document.getElementById(id)) {
      return;
    }

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Baskervville:ital@0;1&display=swap";
    document.head.appendChild(link);
  }, []);

  return (
    <div className="h-screen h-[100dvh] max-h-screen w-full overflow-hidden">
      <Hero onNavigateToStudio={onNavigateToStudio} />
    </div>
  );
};

export default function WisprVideoQueryAnimation() {
  useEffect(() => {
    const id = "baskervville-font";

    if (document.getElementById(id)) {
      return;
    }

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Baskervville:ital@0;1&display=swap";
    document.head.appendChild(link);
  }, []);

  return (
    <div className="h-screen h-[100dvh] max-h-screen w-full overflow-hidden">
      <Hero />
    </div>
  );
}
