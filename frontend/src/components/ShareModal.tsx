import { useState, useEffect } from 'react';
import type React from 'react';
import { X, Copy, Check, ExternalLink, Share2, Loader2, Globe } from 'lucide-react';
import apiClient from '../api/client';
import type { AnalysisData } from '../types/analysis';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: AnalysisData;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, analysis }) => {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !shareUrl) {
      handleGenerateLink();
    }
  }, [isOpen]);

  const handleGenerateLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.createShare({
        job_id: analysis.job_id,
        title: analysis.title,
        summary: analysis.summary,
        action_items: analysis.action_items,
        key_decisions: analysis.key_decisions,
        open_questions: analysis.open_questions,
        transcript: analysis.transcript,
        segments: analysis.segments,
        transcript_source: analysis.transcript_source,
        source_type: analysis.type,
        video_id: analysis.video_id,
      });

      // Prefer hash-based share route for client-side single page app
      const origin = window.location.origin;
      const url = `${origin}/#/share/${res.slug}`;
      setShareUrl(url);
    } catch (err: any) {
      console.error('Failed to create share link:', err);
      setError(err?.message || 'Failed to generate share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl border-2 border-[#1A1A1A] shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#E5D7FA] text-[#1A1A1A]">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Baskervville',serif] text-xl sm:text-2xl font-bold text-[#1A1A1A]">
                Share Analysis
              </h3>
              <p className="text-xs text-[#1A1A1A]/60">
                Anyone with this link can view the transcript and summary.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[#1A1A1A]/10 hover:bg-[#FDFCF0] text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#1A1A1A]" />
            <p className="text-xs font-medium text-[#1A1A1A]/70">Generating share link...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs space-y-2">
            <p className="font-semibold">Failed to generate link</p>
            <p>{error}</p>
            <button
              onClick={handleGenerateLink}
              className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/70">
                Public Share Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#1A1A1A]/20 bg-[#FDFCF0] text-xs sm:text-sm font-mono text-[#1A1A1A] focus:outline-hidden"
                />
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 shrink-0 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#1A1A1A] text-white hover:bg-black'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1A1A1A]/20 bg-white hover:bg-[#FDFCF0] text-xs font-medium text-[#1A1A1A] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Tab</span>
              </a>

              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `Check out this video analysis of "${analysis.title}": ${shareUrl}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1A1A1A]/20 bg-white hover:bg-[#FDFCF0] text-xs font-medium text-[#1A1A1A] transition-colors"
              >
                <span>Share on X / Twitter</span>
              </a>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F5EFFF] border border-[#D9CCF5] text-xs text-[#1A1A1A]/80 flex items-start gap-2.5">
              <Globe className="w-4 h-4 text-[#6D5A9E] shrink-0 mt-0.5" />
              <p>
                This link includes the full transcript, timestamps, and summary. Viewers don't need an account to read it.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#1A1A1A]/20 hover:bg-[#FDFCF0] text-xs font-semibold text-[#1A1A1A] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
