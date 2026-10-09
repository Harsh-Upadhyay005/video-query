import { useState, useMemo } from 'react';
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
  Layers,
  Sparkles,
  X
} from 'lucide-react';
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
type ReadingTheme = 'paper' | 'white' | 'sepia' | 'dark';
type ViewMode = 'paginated' | 'continuous';

export const DocumentReader: React.FC<DocumentReaderProps> = ({
  pages,
  title = 'Document',
  totalPages,
  totalWords,
  readingTimeMinutes,
  className = '',
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('paginated');
  const [fontSize, setFontSize] = useState<FontSize>('base');
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');
  const [theme, setTheme] = useState<ReadingTheme>('paper');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedPage, setCopiedPage] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  const safePageIndex = Math.max(0, Math.min(currentPageIndex, pages.length - 1));
  const currentPage = pages[safePageIndex] || {
    pageNumber: 1,
    text: 'No content available',
    wordCount: 0,
  };

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  const handleCopyPage = () => {
    if (!currentPage) return;
    navigator.clipboard.writeText(currentPage.text);
    setCopiedPage(true);
    setTimeout(() => setCopiedPage(false), 2000);
  };

  const handleCopyAll = () => {
    const fullText = pages.map((p) => `[Page ${p.pageNumber}]\n\n${p.text}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Font size classes
  const fontSizeClasses: Record<FontSize, string> = {
    sm: 'text-xs sm:text-sm leading-relaxed',
    base: 'text-sm sm:text-base leading-relaxed sm:leading-loose',
    lg: 'text-base sm:text-lg leading-loose',
    xl: 'text-lg sm:text-xl leading-loose',
  };

  // Font family classes
  const fontFamilyClasses: Record<FontFamily, string> = {
    serif: "font-['Baskervville',Georgia,serif]",
    sans: 'font-sans',
  };

  // Theme styles
  const themeClasses: Record<ReadingTheme, { bg: string; text: string; border: string; accent: string }> = {
    paper: {
      bg: 'bg-[#FDFCF0]',
      text: 'text-[#1A1A1A]',
      border: 'border-[#1A1A1A]/15',
      accent: 'bg-[#1A1A1A] text-white',
    },
    white: {
      bg: 'bg-white',
      text: 'text-gray-900',
      border: 'border-gray-200',
      accent: 'bg-gray-900 text-white',
    },
    sepia: {
      bg: 'bg-[#FAF3E0]',
      text: 'text-[#3E2723]',
      border: 'border-[#D7CCC8]',
      accent: 'bg-[#4E342E] text-white',
    },
    dark: {
      bg: 'bg-[#1E1E24]',
      text: 'text-[#E8E8E8]',
      border: 'border-[#33333F]',
      accent: 'bg-white text-black',
    },
  };

  const currentTheme = themeClasses[theme];

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

  const readerContent = (
    <div
      className={`rounded-2xl sm:rounded-3xl border-2 transition-colors flex flex-col ${
        currentTheme.bg
      } ${currentTheme.border} ${currentTheme.text} ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none p-4 sm:p-8 overflow-y-auto' : ''
      } ${className}`}
    >
      {/* Top Reading Toolbar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b ${
          currentTheme.border
        } shrink-0`}
      >
        {/* Left: Document info & View mode */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-current/15 bg-current/5 text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>
              {totalPages} {totalPages === 1 ? 'Page' : 'Pages'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs opacity-75">
            <Clock className="w-3.5 h-3.5" />
            <span>~{readingTimeMinutes} min read</span>
            <span className="opacity-40">•</span>
            <span>{totalWords.toLocaleString()} words</span>
          </div>

          {/* Paginated vs Continuous toggle */}
          <div className="inline-flex rounded-lg border border-current/15 bg-current/5 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('paginated')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                viewMode === 'paginated' ? currentTheme.accent : 'opacity-70 hover:opacity-100'
              }`}
            >
              Page-by-Page
            </button>
            <button
              type="button"
              onClick={() => setViewMode('continuous')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                viewMode === 'continuous' ? currentTheme.accent : 'opacity-70 hover:opacity-100'
              }`}
            >
              Continuous
            </button>
          </div>
        </div>

        {/* Right: Customization controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Font size toggle */}
          <div className="inline-flex items-center rounded-lg border border-current/15 bg-current/5 p-0.5 text-xs">
            <span className="px-1.5 opacity-60 text-[10px]">
              <Type className="w-3 h-3" />
            </span>
            {(['sm', 'base', 'lg', 'xl'] as FontSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setFontSize(size)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                  fontSize === size ? currentTheme.accent : 'opacity-60 hover:opacity-100'
                }`}
                title={`Font size ${size}`}
              >
                {size === 'sm' ? 'S' : size === 'base' ? 'M' : size === 'lg' ? 'L' : 'XL'}
              </button>
            ))}
          </div>

          {/* Font family toggle */}
          <button
            type="button"
            onClick={() => setFontFamily((prev) => (prev === 'serif' ? 'sans' : 'serif'))}
            className="px-2.5 py-1 rounded-lg border border-current/15 bg-current/5 hover:bg-current/10 text-xs font-medium transition-colors flex items-center gap-1"
            title="Toggle Serif / Sans-serif"
          >
            <AlignLeft className="w-3 h-3" />
            <span>{fontFamily === 'serif' ? 'Serif' : 'Sans'}</span>
          </button>

          {/* Theme switcher */}
          <div className="flex items-center gap-1 border border-current/15 rounded-lg p-0.5 bg-current/5">
            <button
              type="button"
              onClick={() => setTheme('paper')}
              className={`w-5 h-5 rounded-full border ${
                theme === 'paper' ? 'ring-2 ring-indigo-500 scale-110' : 'opacity-70'
              } bg-[#FDFCF0] border-[#1A1A1A]/30`}
              title="Ivory Warm Paper"
            />
            <button
              type="button"
              onClick={() => setTheme('white')}
              className={`w-5 h-5 rounded-full border ${
                theme === 'white' ? 'ring-2 ring-indigo-500 scale-110' : 'opacity-70'
              } bg-white border-gray-300`}
              title="Clean White"
            />
            <button
              type="button"
              onClick={() => setTheme('sepia')}
              className={`w-5 h-5 rounded-full border ${
                theme === 'sepia' ? 'ring-2 ring-indigo-500 scale-110' : 'opacity-70'
              } bg-[#FAF3E0] border-[#D7CCC8]`}
              title="Sepia Book"
            />
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`w-5 h-5 rounded-full border ${
                theme === 'dark' ? 'ring-2 ring-indigo-500 scale-110' : 'opacity-70'
              } bg-[#1E1E24] border-gray-700`}
              title="Night Mode"
            />
          </div>

          {/* Copy actions */}
          <button
            type="button"
            onClick={viewMode === 'paginated' ? handleCopyPage : handleCopyAll}
            className="px-2.5 py-1 rounded-lg border border-current/15 bg-current/5 hover:bg-current/10 text-xs font-medium transition-colors flex items-center gap-1"
            title={viewMode === 'paginated' ? 'Copy current page' : 'Copy entire document'}
          >
            {copiedPage || copiedAll ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">
              {copiedPage || copiedAll ? 'Copied' : viewMode === 'paginated' ? 'Copy Page' : 'Copy All'}
            </span>
          </button>

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg border border-current/15 bg-current/5 hover:bg-current/10 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Read fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* In-Document Search Bar */}
      <div className={`px-4 sm:px-6 py-2.5 border-b ${currentTheme.border} flex items-center gap-2`}>
        <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
        <input
          type="text"
          placeholder="Search keywords in this document..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-xs sm:text-sm focus:outline-hidden placeholder:opacity-50"
        />
        {searchQuery && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] opacity-70">
              {filteredPages.length} {filteredPages.length === 1 ? 'page matches' : 'pages match'}
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-md hover:bg-current/10 opacity-70"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Paginated Navigation Bar */}
      {viewMode === 'paginated' && pages.length > 1 && (
        <div
          className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 border-b ${
            currentTheme.border
          } bg-current/2`}
        >
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPageIndex === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-current/15 hover:bg-current/10 disabled:opacity-30 disabled:pointer-events-none text-xs font-semibold transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous Page</span>
          </button>

          {/* Page Selector Dropdown / Info */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wide">Page</span>
            <select
              value={currentPageIndex}
              onChange={(e) => setCurrentPageIndex(parseInt(e.target.value, 10))}
              className="bg-transparent border border-current/20 rounded-lg px-2 py-1 text-xs font-bold focus:outline-hidden cursor-pointer"
            >
              {pages.map((p, idx) => (
                <option key={idx} value={idx} className="bg-white text-black">
                  {p.pageNumber} of {totalPages} ({p.wordCount} words)
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPageIndex === pages.length - 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-current/15 hover:bg-current/10 disabled:opacity-30 disabled:pointer-events-none text-xs font-semibold transition-colors"
          >
            <span>Next Page</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Reading Surface */}
      <div
        className={`p-6 sm:p-12 md:p-16 flex-1 overflow-y-auto ${
          isFullscreen ? 'max-w-4xl mx-auto w-full' : 'max-w-3xl mx-auto w-full'
        }`}
      >
        {viewMode === 'paginated' ? (
          /* Single Page View */
          <div className="space-y-6 animate-fade-in">
            {/* Page Header Header Stamp */}
            <div className="flex items-center justify-between pb-3 border-b border-current/10 text-xs opacity-60">
              <span className="font-semibold uppercase tracking-wider">
                {title} • Page {currentPage.pageNumber}
              </span>
              <span>{currentPage.wordCount} words</span>
            </div>

            {/* Formatted Text Content */}
            <div
              className={`${fontSizeClasses[fontSize]} ${fontFamilyClasses[fontFamily]} whitespace-pre-wrap selection:bg-amber-200 selection:text-black`}
            >
              {renderHighlightedText(currentPage.text)}
            </div>

            {/* Bottom Page Navigation Trigger */}
            {pages.length > 1 && (
              <div className="pt-8 border-t border-current/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPageIndex === 0}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline disabled:opacity-30"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous Page</span>
                </button>

                <span className="text-xs opacity-50 font-mono">
                  {currentPage.pageNumber} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPageIndex === pages.length - 1}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline disabled:opacity-30"
                >
                  <span>Next Page</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Continuous Scroll View */
          <div className="space-y-12">
            {filteredPages.map((page, idx) => (
              <div key={idx} className="space-y-4">
                {/* Clean Page Divider */}
                <div className="flex items-center gap-3 opacity-60 my-6">
                  <div className="h-px flex-1 bg-current/15" />
                  <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-current/15">
                    Page {page.pageNumber}
                  </span>
                  <div className="h-px flex-1 bg-current/15" />
                </div>

                {/* Page Content */}
                <div
                  className={`${fontSizeClasses[fontSize]} ${fontFamilyClasses[fontFamily]} whitespace-pre-wrap selection:bg-amber-200 selection:text-black`}
                >
                  {renderHighlightedText(page.text)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reader Footer Quick Stats */}
      <div
        className={`px-4 sm:px-6 py-3 border-t ${
          currentTheme.border
        } flex items-center justify-between text-xs opacity-60`}
      >
        <span className="truncate max-w-xs">{title}</span>
        <div className="flex items-center gap-3">
          <span>
            {viewMode === 'paginated'
              ? `Page ${currentPage.pageNumber} of ${totalPages}`
              : `Total ${totalPages} pages`}
          </span>
          {isFullscreen && (
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="hover:underline font-semibold"
            >
              Close Reader
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return readerContent;
};
