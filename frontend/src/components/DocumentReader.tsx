import { useState, useMemo, useEffect, useRef } from 'react';
import type React from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Search,
  Copy,
  Check,
  Type,
  AlignLeft,
  Clock,
  X,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DocumentPage } from '../utils/documentHelper';

interface DocumentReaderProps {
  pages: DocumentPage[];
  title?: string;
  totalPages: number;
  totalWords: number;
  readingTimeMinutes: number;
  className?: string;
}

type FontSize = 'sm' | 'base' | 'lg' | 'xl';
type FontFamily = 'serif' | 'sans';
type ReadingTheme = 'sepia' | 'paper' | 'white' | 'dark';

export const DocumentReader: React.FC<DocumentReaderProps> = ({
  pages,
  title = 'Document',
  totalPages,
  totalWords,
  readingTimeMinutes,
  className = '',
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);
  const [fontSize, setFontSize] = useState<FontSize>('base');
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');
  // Default to SEPIA as requested
  const [theme, setTheme] = useState<ReadingTheme>('sepia');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedPage, setCopiedPage] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const safePageIndex = Math.max(0, Math.min(currentPageIndex, pages.length - 1));
  const currentPage = pages[safePageIndex] || {
    pageNumber: 1,
    text: 'No content available',
    wordCount: 0,
  };

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setDirection(1);
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setDirection(-1);
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  // Keyboard navigation for page turning (ArrowRight / ArrowLeft / Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't turn pages if user is typing in a search input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, pages.length, isFullscreen]);

  const handleCopyPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentPage) return;
    navigator.clipboard.writeText(currentPage.text);
    setCopiedPage(true);
    setTimeout(() => setCopiedPage(false), 2000);
  };

  // Font size classes
  const fontSizeClasses: Record<FontSize, string> = {
    sm: 'text-sm leading-relaxed sm:leading-loose',
    base: 'text-base sm:text-lg leading-relaxed sm:leading-loose',
    lg: 'text-lg sm:text-xl leading-loose',
    xl: 'text-xl sm:text-2xl leading-loose',
  };

  // Font family classes
  const fontFamilyClasses: Record<FontFamily, string> = {
    serif: "font-['Baskervville',Georgia,serif]",
    sans: 'font-sans',
  };

  // Theme palettes (Sepia is warm, peaceful book tone)
  const themeStyles: Record<
    ReadingTheme,
    {
      outerBg: string;
      pageBg: string;
      pageBorder: string;
      textColor: string;
      subtleText: string;
      accentBg: string;
      accentText: string;
      pageShadow: string;
      headerBg: string;
    }
  > = {
    sepia: {
      outerBg: 'bg-[#F4ECE1]',
      pageBg: 'bg-[#FCF8F2]',
      pageBorder: 'border-[#E4D5C3]',
      textColor: 'text-[#2E2015]',
      subtleText: 'text-[#7D6652]',
      accentBg: 'bg-[#4A3423] text-[#FCF8F2]',
      accentText: 'text-[#4A3423]',
      pageShadow: 'shadow-[0_12px_36px_rgba(74,52,35,0.08)]',
      headerBg: 'bg-[#EFE5D7]/80 backdrop-blur-md border-[#E0D0BD]',
    },
    paper: {
      outerBg: 'bg-[#F6F4EB]',
      pageBg: 'bg-[#FDFCF7]',
      pageBorder: 'border-[#E3DEC3]',
      textColor: 'text-[#1F1F1F]',
      subtleText: 'text-[#6B685B]',
      accentBg: 'bg-[#1F1F1F] text-white',
      accentText: 'text-[#1F1F1F]',
      pageShadow: 'shadow-[0_12px_36px_rgba(0,0,0,0.06)]',
      headerBg: 'bg-[#EFECE0]/80 backdrop-blur-md border-[#DDD7BF]',
    },
    white: {
      outerBg: 'bg-[#F8F9FA]',
      pageBg: 'bg-white',
      pageBorder: 'border-gray-200',
      textColor: 'text-gray-900',
      subtleText: 'text-gray-500',
      accentBg: 'bg-gray-900 text-white',
      accentText: 'text-gray-900',
      pageShadow: 'shadow-[0_12px_36px_rgba(0,0,0,0.06)]',
      headerBg: 'bg-white/80 backdrop-blur-md border-gray-200',
    },
    dark: {
      outerBg: 'bg-[#151518]',
      pageBg: 'bg-[#1C1C22]',
      pageBorder: 'border-[#2E2E38]',
      textColor: 'text-[#EDEDED]',
      subtleText: 'text-[#8E8E9E]',
      accentBg: 'bg-white text-black',
      accentText: 'text-white',
      pageShadow: 'shadow-[0_12px_36px_rgba(0,0,0,0.35)]',
      headerBg: 'bg-[#19191F]/80 backdrop-blur-md border-[#2E2E38]',
    },
  };

  const current = themeStyles[theme];

  // Search filtering
  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return pages;
    const query = searchQuery.toLowerCase();
    return pages.filter((p) => p.text.toLowerCase().includes(query));
  }, [pages, searchQuery]);

  // Highlight search terms in text
  const renderHighlightedText = (text: string) => {
    if (!searchQuery.trim()) {
      return text;
    }
    const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-amber-300 text-black px-1 rounded-xs font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Progress percentage
  const progressPercent = Math.round(((currentPageIndex + 1) / totalPages) * 100);

  // Page turn 3D animation variants
  const pageVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 40 : -40,
      opacity: 0,
      rotateY: dir > 0 ? 8 : -8,
      scale: 0.985,
    }),
    center: {
      x: 0,
      opacity: 1,
      rotateY: 0,
      scale: 1,
      transition: {
        x: { type: 'spring', stiffness: 280, damping: 28 },
        opacity: { duration: 0.22 },
        rotateY: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
        scale: { duration: 0.25 },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -40 : 40,
      opacity: 0,
      rotateY: dir > 0 ? -8 : 8,
      scale: 0.985,
      transition: {
        x: { type: 'spring', stiffness: 280, damping: 28 },
        opacity: { duration: 0.18 },
        rotateY: { duration: 0.28, ease: 'easeIn' },
        scale: { duration: 0.2 },
      },
    }),
  };

  return (
    <div
      ref={containerRef}
      className={`rounded-2xl sm:rounded-3xl border transition-colors flex flex-col overflow-hidden ${
        current.outerBg
      } ${current.textColor} ${
        isFullscreen
          ? 'fixed inset-0 z-50 rounded-none border-none'
          : 'relative min-h-[580px] sm:min-h-[640px]'
      } ${className}`}
      style={{ perspective: '1200px' }}
    >
      {/* 1. CLEAN TOP HEADER */}
      <header
        className={`px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-3 shrink-0 ${current.headerBg}`}
      >
        {/* Book Title & Page Pill */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 opacity-75" />
          </div>
          <div className="min-w-0">
            <h3 className="font-['Baskervville',serif] font-bold text-xs sm:text-sm truncate">
              {title}
            </h3>
            <p className={`text-[11px] ${current.subtleText}`}>
              Page {currentPage.pageNumber} of {totalPages} • ~{readingTimeMinutes}m read
            </p>
          </div>
        </div>

        {/* Minimal Tool Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Search Toggle */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 sm:px-2 sm:py-1 rounded-lg border border-black/10 hover:bg-black/5 text-xs transition-colors flex items-center gap-1 ${
              showSearch ? 'bg-black/10 font-semibold' : ''
            }`}
            title="Search in document"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Search</span>
          </button>

          {/* Font Size Selector (A- / A+) */}
          <div className="inline-flex items-center rounded-lg border border-black/10 bg-black/5 p-0.5 text-xs">
            {(['sm', 'base', 'lg'] as FontSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setFontSize(size)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  fontSize === size ? current.accentBg : 'opacity-60 hover:opacity-100'
                }`}
                title={`Font size ${size}`}
              >
                {size === 'sm' ? 'A-' : size === 'base' ? 'A' : 'A+'}
              </button>
            ))}
          </div>

          {/* Font Family (Serif vs Sans) */}
          <button
            type="button"
            onClick={() => setFontFamily((prev) => (prev === 'serif' ? 'sans' : 'serif'))}
            className="hidden sm:inline-flex px-2 py-1 rounded-lg border border-black/10 bg-black/5 hover:bg-black/10 text-xs font-medium transition-colors items-center gap-1"
            title="Toggle Serif / Sans font"
          >
            <AlignLeft className="w-3 h-3" />
            <span>{fontFamily === 'serif' ? 'Serif' : 'Sans'}</span>
          </button>

          {/* Theme Palette Dots (Sepia default, Paper, White, Dark) */}
          <div className="flex items-center gap-1 border border-black/10 rounded-lg p-0.5 bg-black/5">
            <button
              type="button"
              onClick={() => setTheme('sepia')}
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border ${
                theme === 'sepia' ? 'ring-2 ring-amber-700 scale-110' : 'opacity-70'
              } bg-[#FCF8F2] border-[#D8C7B0]`}
              title="Warm Sepia (Default Book Paper)"
            />
            <button
              type="button"
              onClick={() => setTheme('paper')}
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border ${
                theme === 'paper' ? 'ring-2 ring-amber-700 scale-110' : 'opacity-70'
              } bg-[#FDFCF7] border-[#D8D2BC]`}
              title="Ivory Paper"
            />
            <button
              type="button"
              onClick={() => setTheme('white')}
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border ${
                theme === 'white' ? 'ring-2 ring-amber-700 scale-110' : 'opacity-70'
              } bg-white border-gray-300`}
              title="Clean White"
            />
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border ${
                theme === 'dark' ? 'ring-2 ring-amber-700 scale-110' : 'opacity-70'
              } bg-[#1C1C22] border-gray-700`}
              title="Night Mode"
            />
          </div>

          {/* Copy Page */}
          <button
            type="button"
            onClick={handleCopyPage}
            className="p-1.5 rounded-lg border border-black/10 hover:bg-black/5 transition-colors"
            title="Copy this page text"
          >
            {copiedPage ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 opacity-70" />
            )}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg border border-black/10 hover:bg-black/5 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Distraction-free read'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* SEARCH BAR ACCORDION */}
      {showSearch && (
        <div
          className={`px-4 sm:px-6 py-2.5 border-b flex items-center gap-2 animate-fade-in ${current.headerBg}`}
        >
          <Search className="w-3.5 h-3.5 opacity-60 shrink-0" />
          <input
            type="text"
            placeholder="Search keywords in this document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-xs sm:text-sm focus:outline-hidden placeholder:opacity-40"
          />
          {searchQuery && (
            <span className={`text-[11px] ${current.subtleText}`}>
              {filteredPages.length} {filteredPages.length === 1 ? 'match' : 'matches'}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setShowSearch(false);
            }}
            className="p-1 rounded-md hover:bg-black/10 opacity-70"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 2. THE BOOK READING AREA WITH REAL PAGE TURNING */}
      <div className="flex-1 relative flex items-center justify-center p-3 sm:p-6 md:p-8 overflow-hidden select-text">
        {/* Left Click Zone & Arrow to turn page back */}
        <button
          type="button"
          onClick={handlePrevPage}
          disabled={currentPageIndex === 0}
          className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 sm:w-12 h-16 sm:h-20 rounded-xl flex items-center justify-center transition-all opacity-0 hover:opacity-100 disabled:pointer-events-none group bg-black/5 hover:bg-black/10"
          title="Previous Page (or click left side / press Left Arrow)"
        >
          <ChevronLeft className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:-translate-x-0.5 transition-transform" />
        </button>

        {/* Right Click Zone & Arrow to turn page forward */}
        <button
          type="button"
          onClick={handleNextPage}
          disabled={currentPageIndex === pages.length - 1}
          className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 sm:w-12 h-16 sm:h-20 rounded-xl flex items-center justify-center transition-all opacity-0 hover:opacity-100 disabled:pointer-events-none group bg-black/5 hover:bg-black/10"
          title="Next Page (or click right side / press Right Arrow)"
        >
          <ChevronRight className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Animated Book Leaf / Page Container */}
        <div className="w-full max-w-3xl h-full flex flex-col justify-center">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={currentPageIndex}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className={`w-full rounded-2xl border ${current.pageBg} ${current.pageBorder} ${current.pageShadow} p-6 sm:p-12 md:p-16 flex flex-col justify-between min-h-[460px] sm:min-h-[520px] transition-colors relative`}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Subtle Book Spine Shadow Overlay */}
              <div
                className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none opacity-20 rounded-l-2xl"
                style={{
                  background:
                    'linear-gradient(to right, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 100%)',
                }}
              />

              {/* Page Top Stamp */}
              <div
                className={`flex items-center justify-between pb-4 border-b border-black/5 text-[11px] sm:text-xs ${current.subtleText} uppercase tracking-wider`}
              >
                <span className="truncate max-w-[220px] sm:max-w-md font-semibold">
                  {title}
                </span>
                <span className="font-mono font-bold">
                  {currentPage.pageNumber} / {totalPages}
                </span>
              </div>

              {/* Page Body Text */}
              <div
                className={`my-6 sm:my-8 flex-1 overflow-y-auto max-h-[55vh] pr-1.5 ${
                  fontSizeClasses[fontSize]
                } ${fontFamilyClasses[fontFamily]} whitespace-pre-wrap selection:bg-amber-200 selection:text-black`}
              >
                {renderHighlightedText(currentPage.text)}
              </div>

              {/* Page Bottom Footer with Quick Page Jump */}
              <div
                className={`pt-4 border-t border-black/5 flex items-center justify-between text-xs ${current.subtleText}`}
              >
                <span className="text-[11px]">
                  {currentPage.wordCount} words on this page
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] opacity-75 hidden sm:inline">Turn page</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevPage}
                      disabled={currentPageIndex === 0}
                      className="p-1 rounded-md hover:bg-black/10 disabled:opacity-25 transition-colors"
                      title="Previous Page (Left Arrow)"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono font-semibold px-1 text-xs">
                      {currentPage.pageNumber}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextPage}
                      disabled={currentPageIndex === pages.length - 1}
                      className="p-1 rounded-md hover:bg-black/10 disabled:opacity-25 transition-colors"
                      title="Next Page (Right Arrow)"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* 3. SIMPLE, CLEAN BOTTOM BAR */}
      <footer
        className={`px-4 sm:px-8 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 ${current.headerBg}`}
      >
        {/* Previous Button */}
        <button
          type="button"
          onClick={handlePrevPage}
          disabled={currentPageIndex === 0}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-black/15 hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none text-xs sm:text-sm font-semibold transition-all shadow-2xs"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Page</span>
        </button>

        {/* Center Progress & Jump Dropdown */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${current.subtleText}`}>Jump to:</span>
            <select
              value={currentPageIndex}
              onChange={(e) => {
                const target = parseInt(e.target.value, 10);
                setDirection(target > currentPageIndex ? 1 : -1);
                setCurrentPageIndex(target);
              }}
              className="bg-transparent border border-black/20 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-hidden cursor-pointer"
            >
              {pages.map((p, idx) => (
                <option key={idx} value={idx} className="bg-white text-black">
                  Page {p.pageNumber} of {totalPages}
                </option>
              ))}
            </select>
          </div>

          {/* Reading progress pill */}
          <div
            className={`hidden md:inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border border-black/10 bg-black/5 ${current.subtleText}`}
          >
            <span>{progressPercent}% read</span>
          </div>
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={handleNextPage}
          disabled={currentPageIndex === pages.length - 1}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs disabled:opacity-30 disabled:pointer-events-none ${current.accentBg}`}
        >
          <span>Next Page</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};
