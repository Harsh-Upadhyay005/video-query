import { useState, useEffect, useMemo } from 'react';
import type React from 'react';
import {
  Sparkles,
  Clock,
  Zap,
  Mic,
  Copy,
  Check,
  ExternalLink,
  Eye,
  Search,
  AlertCircle,
  Loader2,
  FileText,
  BookOpen,

  ListChecks,
  Compass,
  ArrowRight
} from 'lucide-react';
import apiClient from '../api/client';
import type { TranscriptSegment } from '../types/analysis';
import { processDocumentData } from '../utils/documentHelper';
import { DocumentReader } from '../components/DocumentReader';

interface SharedAnalysisPageProps {
  slug: string;
  onNavigateToStudio: () => void;
  onNavigateToHome: () => void;
}

const formatSeconds = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const SharedAnalysisPage: React.FC<SharedAnalysisPageProps> = ({
  slug,
  onNavigateToStudio,
  onNavigateToHome,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'timestamped' | 'plain'>('timestamped');
  const [docTab, setDocTab] = useState<'summary' | 'reader'>('summary');

  useEffect(() => {
    let isMounted = true;
    const fetchShared = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.getShare(slug);
        if (isMounted) {
          setData(res);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Shared analysis not found or has expired.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchShared();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  const docInfo = useMemo(() => processDocumentData(data), [data]);
  const isDocument = docInfo.isDocument;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyTranscript = () => {
    if (!data?.transcript) return;
    navigator.clipboard.writeText(data.transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFCF0] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#1A1A1A]" />
        <h2 className="font-['Baskervville',serif] text-2xl font-bold text-[#1A1A1A]">
          Loading Shared Analysis...
        </h2>
        <p className="text-xs text-[#1A1A1A]/60">Fetching document and insights</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FDFCF0] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 max-w-md space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
          <h2 className="font-['Baskervville',serif] text-2xl font-bold">Analysis Not Found</h2>
          <p className="text-xs text-amber-800/80">
            {error || 'This link may be invalid, private, or has been revoked by the creator.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToHome}
            className="px-4 py-2 rounded-xl border border-[#1A1A1A]/20 bg-white hover:bg-[#FDFCF0] text-xs font-semibold text-[#1A1A1A] transition-colors"
          >
            Go to Homepage
          </button>
          <button
            onClick={onNavigateToStudio}
            className="px-4 py-2 rounded-xl bg-[#1A1A1A] text-white hover:bg-black text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Analyze Your Own Content</span>
          </button>
        </div>
      </div>
    );
  }

  const segments: TranscriptSegment[] = data.segments || [];
  const filteredSegments = searchQuery.trim()
    ? segments.filter((s) => s.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : segments;

  return (
    <div className="min-h-screen bg-[#FDFCF0] text-[#1A1A1A] font-sans flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#1A1A1A]/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToHome}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-lg bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-xs">
              V
            </div>
            <span className="font-['Baskervville',serif] text-base sm:text-lg font-bold tracking-tight text-[#1A1A1A]">
              VideoQuery
            </span>
          </button>
          <span className="text-[#1A1A1A]/30">/</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/60">
            {isDocument ? 'Document Insight' : 'Shared Insight'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-lg border border-[#1A1A1A]/20 bg-white hover:bg-[#FDFCF0] text-xs font-medium text-[#1A1A1A] transition-colors flex items-center gap-1.5"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
          </button>

          <button
            onClick={onNavigateToStudio}
            className="px-3.5 py-1.5 rounded-lg bg-[#1A1A1A] text-white hover:bg-black text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Open Studio</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-8">
        {/* Title Header Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border-2 border-[#1A1A1A] p-6 sm:p-8 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1A1A1A]/10 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5D7FA] text-[#1A1A1A] text-[11px] font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isDocument ? 'DOCUMENT ANALYSIS' : 'SHARED ANALYSIS'}</span>
              </span>

              {isDocument ? (
                <>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <FileText className="w-3 h-3 text-indigo-600" />
                    <span>PDF Document</span>
                  </span>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#FDFCF0] text-[#1A1A1A]/80 border border-[#1A1A1A]/15">
                    <BookOpen className="w-3 h-3 opacity-60" />
                    <span>{docInfo.totalPages} Pages</span>
                  </span>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#FDFCF0] text-[#1A1A1A]/80 border border-[#1A1A1A]/15">
                    <Clock className="w-3 h-3 opacity-60" />
                    <span>~{docInfo.readingTimeMinutes} min read</span>
                  </span>
                </>
              ) : (
                <>
                  {data.transcript_source === 'captions' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Zap className="w-3 h-3 text-emerald-600" />
                      <span>YouTube Captions</span>
                    </span>
                  )}
                  {data.transcript_source === 'whisper' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                      <Mic className="w-3 h-3 text-blue-600" />
                      <span>Whisper STT</span>
                    </span>
                  )}
                  {data.transcript_source === 'sarvam' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      <Mic className="w-3 h-3 text-amber-600" />
                      <span>Sarvam AI (Hindi)</span>
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-[#1A1A1A]/60">
              <Eye className="w-3.5 h-3.5" />
              <span>{data.views_count || 1} views</span>
            </div>
          </div>

          <h1 className="font-['Baskervville',serif] text-2xl sm:text-4xl text-[#1A1A1A] tracking-tight leading-tight">
            {data.title || 'Untitled Document Analysis'}
          </h1>

          {data.video_id && (
            <a
              href={`https://www.youtube.com/watch?v=${data.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-900 font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Watch Original on YouTube</span>
            </a>
          )}
        </div>

        {/* FOR DOCUMENTS / PDFS: View Mode Tabs */}
        {isDocument && (
          <div className="flex items-center justify-between border-b border-[#1A1A1A]/10 pb-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setDocTab('summary')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  docTab === 'summary'
                    ? 'bg-[#1A1A1A] text-white shadow-md'
                    : 'bg-white text-[#1A1A1A]/70 hover:text-[#1A1A1A] border border-[#1A1A1A]/15 hover:bg-[#FDFCF0]'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${docTab === 'summary' ? 'text-amber-300' : ''}`} />
                <span>Executive Summary</span>
              </button>

              <button
                type="button"
                onClick={() => setDocTab('reader')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  docTab === 'reader'
                    ? 'bg-[#1A1A1A] text-white shadow-md'
                    : 'bg-white text-[#1A1A1A]/70 hover:text-[#1A1A1A] border border-[#1A1A1A]/15 hover:bg-[#FDFCF0]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Document Reader</span>
                <span className="text-[10px] opacity-75 font-mono">({docInfo.totalPages}p)</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-[#1A1A1A]/60">
              <span>{docInfo.totalWords.toLocaleString()} words</span>
            </div>
          </div>
        )}

        {/* DOCUMENT VIEW: SUMMARY TAB */}
        {isDocument && docTab === 'summary' && (
          <div className="space-y-6 animate-fade-in">
            {/* Main Summary Card */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border-2 border-[#1A1A1A] p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-[#1A1A1A]/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#E5D7FA] flex items-center justify-center text-[#1A1A1A]">
                    <Sparkles className="w-5 h-5 text-[#1A1A1A]" />
                  </div>
                  <div>
                    <h2 className="font-['Baskervville',serif] text-xl sm:text-2xl font-bold text-[#1A1A1A]">
                      Executive Document Summary
                    </h2>
                    <p className="text-xs text-[#1A1A1A]/60">
                      High-level synthesis and core takeaways for "{data.title || 'this document'}"
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDocTab('reader')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#1A1A1A]/20 bg-[#FDFCF0] hover:bg-[#1A1A1A]/5 text-xs font-semibold transition-colors"
                >
                  <span>Read Full Document</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Summary Text Content */}
              {data.summary ? (
                <div className="text-sm sm:text-base text-[#1A1A1A]/90 whitespace-pre-wrap leading-relaxed sm:leading-loose font-sans">
                  {data.summary}
                </div>
              ) : docInfo.extractedSummary ? (
                <div className="space-y-6">
                  {/* Overview */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#FDFCF0] border border-[#1A1A1A]/10 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A1A]/60">
                      Core Overview
                    </span>
                    <p className="text-xs sm:text-sm text-[#1A1A1A]/90 leading-relaxed font-sans">
                      {docInfo.extractedSummary.overview}
                    </p>
                  </div>

                  {/* Key Takeaways */}
                  {docInfo.extractedSummary.takeaways.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]">
                        <ListChecks className="w-4 h-4 text-emerald-600" />
                        <span>Key Insights & Core Principles</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        {docInfo.extractedSummary.takeaways.map((takeaway, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-[#1A1A1A]/10 hover:border-[#1A1A1A]/30 transition-colors shadow-2xs"
                          >
                            <span className="w-5 h-5 rounded-full bg-[#E5D7FA] text-[#1A1A1A] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <p className="text-xs sm:text-sm text-[#1A1A1A]/90 leading-relaxed">
                              {takeaway}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Core Themes */}
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[#1A1A1A]/60 flex items-center gap-1.5 mr-1">
                      <Compass className="w-3.5 h-3.5" />
                      <span>Themes:</span>
                    </span>
                    {docInfo.extractedSummary.coreThemes.map((theme, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-[#E5D7FA]/40 border border-[#D9CCF5] text-[11px] font-medium text-[#1A1A1A]"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  Document content extracted successfully. Use the Document Reader tab to read the complete pages.
                </div>
              )}
            </div>

            {/* Quick Transition Banner to Reader Mode */}
            <div className="rounded-2xl bg-white border border-[#1A1A1A]/15 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FDFCF0] border border-[#1A1A1A]/15 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-[#1A1A1A]" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-[#1A1A1A]">
                    Want to read the full document?
                  </h4>
                  <p className="text-xs text-[#1A1A1A]/60">
                    Switch to the interactive reader for page-by-page viewing, search, and customizable typography.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDocTab('reader')}
                className="px-4 py-2 rounded-xl bg-[#1A1A1A] text-white hover:bg-black text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
              >
                <span>Open Reader Mode</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* DOCUMENT VIEW: READER TAB */}
        {isDocument && docTab === 'reader' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="font-['Baskervville',serif] text-xl sm:text-2xl font-bold text-[#1A1A1A]">
                  Interactive Document Reader
                </h2>
                <p className="text-xs text-[#1A1A1A]/60">
                  Read page by page with adjustable text size, search, and warm paper themes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDocTab('summary')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#1A1A1A]/20 bg-white hover:bg-[#FDFCF0] text-xs font-medium text-[#1A1A1A] transition-colors"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>View Summary</span>
              </button>
            </div>

            <DocumentReader
              pages={docInfo.pages}
              title={data.title || 'Document'}
              totalPages={docInfo.totalPages}
              totalWords={docInfo.totalWords}
              readingTimeMinutes={docInfo.readingTimeMinutes}
            />
          </div>
        )}

        {/* FOR AUDIO / VIDEO: TRADITIONAL SUMMARY CARD */}
        {!isDocument && data.summary && (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#1A1A1A]/15 p-6 sm:p-8 shadow-sm space-y-3">
            <h2 className="font-['Baskervville',serif] text-xl sm:text-2xl font-bold text-[#1A1A1A]">
              Executive Summary
            </h2>
            <div className="text-xs sm:text-sm text-[#1A1A1A]/90 whitespace-pre-wrap leading-relaxed font-sans">
              {data.summary}
            </div>
          </div>
        )}

        {/* Action Items & Decisions (both video and docs if present) */}
        {(data.action_items || data.key_decisions) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.action_items && (
              <div className="bg-white rounded-2xl border border-[#1A1A1A]/15 p-5 sm:p-6 shadow-sm space-y-2.5">
                <h3 className="font-['Baskervville',serif] text-lg font-bold text-[#1A1A1A]">
                  Action Items
                </h3>
                <div className="text-xs sm:text-sm text-[#1A1A1A]/85 whitespace-pre-wrap leading-relaxed">
                  {typeof data.action_items === 'string'
                    ? data.action_items
                    : JSON.stringify(data.action_items, null, 2)}
                </div>
              </div>
            )}

            {data.key_decisions && (
              <div className="bg-white rounded-2xl border border-[#1A1A1A]/15 p-5 sm:p-6 shadow-sm space-y-2.5">
                <h3 className="font-['Baskervville',serif] text-lg font-bold text-[#1A1A1A]">
                  Key Decisions
                </h3>
                <div className="text-xs sm:text-sm text-[#1A1A1A]/85 whitespace-pre-wrap leading-relaxed">
                  {data.key_decisions}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FOR AUDIO / VIDEO ONLY: Transcript Section with Timestamps */}
        {!isDocument && (
          <div className="bg-white rounded-2xl sm:rounded-3xl border-2 border-[#1A1A1A] p-6 sm:p-8 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1A1A1A]/10">
              <div>
                <h2 className="font-['Baskervville',serif] text-xl sm:text-2xl font-bold text-[#1A1A1A]">
                  Full Transcript
                </h2>
                {segments.length > 0 && (
                  <p className="text-xs text-[#1A1A1A]/60">
                    {segments.length} timestamped segments — click timestamps to jump
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {segments.length > 0 && (
                  <div className="inline-flex rounded-lg border border-[#1A1A1A]/10 bg-[#FDFCF0] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setViewMode('timestamped')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        viewMode === 'timestamped'
                          ? 'bg-[#1A1A1A] text-white font-medium'
                          : 'text-[#1A1A1A]/70 hover:text-[#1A1A1A]'
                      }`}
                    >
                      Timestamps
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('plain')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        viewMode === 'plain'
                          ? 'bg-[#1A1A1A] text-white font-medium'
                          : 'text-[#1A1A1A]/70 hover:text-[#1A1A1A]'
                      }`}
                    >
                      Plain
                    </button>
                  </div>
                )}

                <button
                  onClick={handleCopyTranscript}
                  className="px-3 py-1.5 rounded-lg border border-[#1A1A1A]/20 bg-white hover:bg-[#FDFCF0] text-xs font-medium text-[#1A1A1A] transition-colors flex items-center gap-1.5"
                  title="Copy entire transcript"
                >
                  {copiedTranscript ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Search bar inside transcript */}
            {segments.length > 0 && viewMode === 'timestamped' && (
              <div className="relative">
                <Search className="w-4 h-4 text-[#8A8A8A] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search keywords in transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#1A1A1A]/15 bg-[#FDFCF0] text-xs sm:text-sm text-[#1A1A1A] focus:outline-hidden focus:border-[#1A1A1A]"
                />
              </div>
            )}

            {/* Transcript Content */}
            <div className="p-4 sm:p-5 rounded-xl bg-[#FDFCF0]/60 border border-[#1A1A1A]/10 max-h-128 overflow-y-auto text-xs sm:text-sm text-[#1A1A1A]/90 font-sans leading-relaxed">
              {segments.length > 0 && viewMode === 'timestamped' ? (
                filteredSegments.length === 0 ? (
                  <p className="text-center py-6 text-xs text-[#8A8A8A]">
                    No transcript segments match "{searchQuery}"
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredSegments.map((seg, idx) => {
                      const youtubeLink = data.video_id
                        ? `https://www.youtube.com/watch?v=${data.video_id}&t=${Math.floor(seg.start)}`
                        : null;

                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 py-1 hover:bg-[#1A1A1A]/5 rounded px-2 transition-colors"
                        >
                          {youtubeLink ? (
                            <a
                              href={youtubeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded shrink-0 transition-colors"
                              title="Open on YouTube at this timestamp"
                            >
                              <Clock className="w-3 h-3" />
                              <span>{formatSeconds(seg.start)}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                              <Clock className="w-3 h-3" />
                              <span>{formatSeconds(seg.start)}</span>
                            </span>
                          )}
                          <p className="text-[#1A1A1A]/90 leading-relaxed">{seg.text}</p>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="whitespace-pre-wrap">
                  {data.transcript || 'No transcript text available.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Call to action footer banner */}
        <div className="rounded-2xl sm:rounded-3xl bg-linear-to-r from-[#E5D7FA] to-[#FDFCF0] border-2 border-[#1A1A1A] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-lg">
          <div className="space-y-1">
            <h3 className="font-['Baskervville',serif] text-xl sm:text-2xl font-bold text-[#1A1A1A]">
              Analyze your own video or document
            </h3>
            <p className="text-xs text-[#1A1A1A]/70">
              Get instant summaries, intelligent document reading, and ask interactive questions with RAG.
            </p>
          </div>
          <button
            onClick={onNavigateToStudio}
            className="px-5 py-3 rounded-xl bg-[#1A1A1A] text-white hover:bg-black font-semibold text-xs sm:text-sm transition-all shadow-md shrink-0 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Try AI Video Agent Free</span>
          </button>
        </div>
      </main>
    </div>
  );
};
