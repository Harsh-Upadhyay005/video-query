import { useState } from 'react';
import type React from 'react';
import { Sparkles, Play, FileText, ChevronDown, ChevronUp, MessageSquare, Clock, Zap, Mic, Copy, Check, ExternalLink, Share2 } from 'lucide-react';
import type { AnalysisData, TranscriptSegment } from '../types/analysis';
import { ShareModal } from './ShareModal';

interface AnalysisResultCardProps {
  analysis: AnalysisData;
  onReset: () => void;
  onShare?: () => void;
}

const formatSeconds = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const AnalysisResultCard: React.FC<AnalysisResultCardProps> = ({ analysis, onReset, onShare }) => {
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'timestamped' | 'plain'>('timestamped');
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const isPdf = analysis.type === 'pdf';
  const hasSegments = Boolean(analysis.segments && analysis.segments.length > 0);
  const source = analysis.transcript_source || (isPdf ? 'document' : 'audio');

  const handleCopy = () => {
    const textToCopy = analysis.transcript || '';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderSourceBadge = () => {
    if (source === 'captions') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <Zap className="w-3 h-3 text-emerald-600" />
          <span>YouTube Captions (Instant)</span>
        </span>
      );
    }
    if (source === 'whisper') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <Mic className="w-3 h-3 text-blue-600" />
          <span>Whisper STT</span>
        </span>
      );
    }
    if (source === 'sarvam') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Mic className="w-3 h-3 text-amber-600" />
          <span>Sarvam AI (Hindi)</span>
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#1A1A1A]/10">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5D7FA] text-[#1A1A1A] text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#1A1A1A]" />
              <span>ANALYSIS COMPLETE</span>
            </div>
            {renderSourceBadge()}
          </div>
          <h2 className="font-['Baskervville',serif] text-2xl sm:text-3xl md:text-4xl text-[#1A1A1A] tracking-tight break-words">
            {analysis.title || 'Untitled Document'}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              if (onShare) onShare();
              setShareModalOpen(true);
            }}
            className="px-4 py-2 sm:py-2.5 rounded-xl border border-[#1A1A1A]/20 bg-white hover:bg-[#FDFCF0] text-xs sm:text-sm font-semibold text-[#1A1A1A] transition-all flex items-center gap-1.5 shadow-xs hover:border-[#1A1A1A]/40"
            title="Create public share link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>

          <button
            onClick={onReset}
            className="px-4 py-2 sm:py-2.5 rounded-xl border border-[#1A1A1A]/20 bg-white hover:bg-[#FDFCF0] text-xs sm:text-sm font-semibold text-[#1A1A1A] transition-all flex items-center gap-2 shadow-xs hover:border-[#1A1A1A]/40"
          >
            {isPdf ? (
              <>
                <FileText className="w-4 h-4 text-[#1A1A1A]" />
                <span>New Document</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-[#1A1A1A] fill-current" />
                <span>New Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Full Transcript / Document Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-[#FDFCF0] border border-[#1A1A1A]/10">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 sm:gap-2.5 text-xs sm:text-sm font-bold text-[#1A1A1A] hover:opacity-80 transition-opacity"
          >
            <FileText className="w-4 h-4 text-[#8A8A8A]" />
            <span className="tracking-wide">
              {isPdf ? 'FULL DOCUMENT TEXT' : 'FULL TRANSCRIPT'}
            </span>
            {hasSegments && (
              <span className="text-[11px] font-normal text-[#8A8A8A]">
                ({analysis.segments?.length} segments)
              </span>
            )}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-[#8A8A8A]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#8A8A8A]" />
            )}
          </button>

          <div className="flex items-center gap-2">
            {expanded && hasSegments && (
              <div className="inline-flex rounded-lg border border-[#1A1A1A]/10 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('timestamped')}
                  className={`px-2 py-1 rounded-md transition-colors ${
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
                  className={`px-2 py-1 rounded-md transition-colors ${
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
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg border border-[#1A1A1A]/10 bg-white hover:bg-[#FDFCF0] text-[#1A1A1A] text-xs transition-colors"
              title="Copy transcript"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="p-4 sm:p-5 rounded-xl bg-[#FDFCF0]/60 border border-[#1A1A1A]/10 max-h-96 overflow-y-auto text-xs sm:text-sm text-[#1A1A1A]/90 font-sans leading-relaxed animate-fade-in">
            {hasSegments && viewMode === 'timestamped' ? (
              <div className="space-y-2">
                {analysis.segments?.map((seg: TranscriptSegment, idx: number) => {
                  const youtubeLink = analysis.video_id
                    ? `https://www.youtube.com/watch?v=${analysis.video_id}&t=${Math.floor(seg.start)}`
                    : null;

                  return (
                    <div key={idx} className="flex items-start gap-2.5 py-1 hover:bg-[#1A1A1A]/5 rounded px-2 transition-colors">
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
            ) : (
              <div className="whitespace-pre-wrap">
                {analysis.transcript || 'No transcript text available.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Explore More Callout */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-[#F5EFFF] border border-[#D9CCF5] flex items-center justify-center gap-2 text-center">
        <MessageSquare className="w-4 h-4 text-[#6D5A9E] shrink-0" />
        <p className="text-xs sm:text-sm text-[#1A1A1A]">
          Ready to explore more?{' '}
          <span className="font-bold">Scroll down to the chat section</span> to ask questions about this content!
        </p>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        analysis={analysis}
      />
    </div>
  );
};
