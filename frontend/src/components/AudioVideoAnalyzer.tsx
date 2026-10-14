import { useState, useRef } from 'react';
import type React from 'react';
import { Youtube, Upload, Sparkles, FileAudio, X, Loader2, AlertCircle } from 'lucide-react';
import apiClient from '../api/client';
import type { AnalysisData } from '../types/analysis';

interface AudioVideoAnalyzerProps {
  onAnalysisComplete: (result: AnalysisData) => void;
  existingResult?: AnalysisData | null;
}

type InputMode = 'url' | 'file';
type Language = 'english' | 'hinglish';

function AudioVideoAnalyzer({ onAnalysisComplete }: AudioVideoAnalyzerProps) {
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState<Language>('english');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('=== AudioVideoAnalyzer: handleSubmit CALLED ===');
    
    if (inputMode === 'url' && !url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }
    if (inputMode === 'file' && !selectedFile) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      let data: AnalysisData;
      
      if (inputMode === 'url') {
        data = await apiClient.analyzeVideoAsync(url, language);
      } else {
        data = await apiClient.uploadAndAnalyze(selectedFile!, language, (progress) => {
          setUploadProgress(progress);
        });
      }

      const analysis: AnalysisData = {
        ...data,
        type: data.type === 'audio' ? 'audio' : 'video',
        job_id: data.job_id,
      };
      
      setUrl('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (onAnalysisComplete) {
        onAnalysisComplete(analysis);
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validExtensions = [
      '.mp3', '.mp4', '.wav', '.m4a', '.flac', '.ogg', '.aac', 
      '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'
    ];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExt)) {
      setError(`Unsupported file type: ${fileExt}`);
      return;
    }

    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 500MB`);
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div id="studio" className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-['Baskervville',serif] text-2xl sm:text-3xl md:text-4xl text-[#1A1A1A] mb-2">
          Audio / Video Analysis
        </h2>
        <p className="text-xs sm:text-sm text-[#8A8A8A] max-w-xl mx-auto">
          Paste a YouTube link or upload any audio/video file for AI transcription, executive takeaways, and vector search.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Mode Switcher */}
        <div className="flex flex-col sm:flex-row justify-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setInputMode('url');
              setSelectedFile(null);
              setError(null);
            }}
            disabled={loading}
            className={`flex-1 sm:flex-initial px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
              inputMode === 'url'
                ? 'bg-[#1A1A1A] text-white shadow-sm'
                : 'bg-[#FDFCF0] border-2 border-[#1A1A1A]/15 text-[#1A1A1A] hover:border-[#1A1A1A]/40'
            }`}
          >
            <Youtube className="w-4 h-4 text-red-500" />
            <span>YouTube URL</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setInputMode('file');
              setUrl('');
              setError(null);
            }}
            disabled={loading}
            className={`flex-1 sm:flex-initial px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
              inputMode === 'file'
                ? 'bg-[#1A1A1A] text-white shadow-sm'
                : 'bg-[#FDFCF0] border-2 border-[#1A1A1A]/15 text-[#1A1A1A] hover:border-[#1A1A1A]/40'
            }`}
          >
            <Upload className="w-4 h-4 text-purple-500" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {inputMode === 'url' ? (
            <div className="space-y-2">
              <label htmlFor="url" className="block text-xs sm:text-sm font-semibold text-[#1A1A1A]">
                YouTube URL
              </label>
              <input
                id="url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={loading}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 border-[#1A1A1A]/15 bg-[#FDFCF0] text-xs sm:text-sm text-[#1A1A1A] placeholder-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-[#D9CCF5] focus:border-transparent transition-all"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-semibold text-[#1A1A1A]">
                Upload Audio or Video File
              </label>
              
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative rounded-2xl border-2 border-dashed transition-all ${
                  dragActive
                    ? 'border-[#D9CCF5] bg-[#D9CCF5]/10'
                    : selectedFile
                    ? 'border-[#1A1A1A]/20 bg-[#FDFCF0]'
                    : 'border-[#1A1A1A]/15 bg-[#FDFCF0] hover:border-[#1A1A1A]/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.mp4,.wav,.m4a,.flac,.ogg,.aac,.avi,.mov,.mkv,.webm,.flv,.wmv"
                  onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
                  className="hidden"
                  disabled={loading}
                />
                
                {selectedFile ? (
                  <div className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#D9CCF5]/30 flex items-center justify-center shrink-0">
                      <FileAudio className="w-5 h-5 sm:w-6 sm:h-6 text-[#1A1A1A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs sm:text-sm text-[#1A1A1A] truncate">
                        {selectedFile.name}
                      </div>
                      <div className="text-[11px] sm:text-xs text-[#8A8A8A]">
                        {formatFileSize(selectedFile.size)}
                      </div>
                    </div>
                    {!loading && (
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="w-8 h-8 rounded-lg bg-[#1A1A1A]/10 hover:bg-[#1A1A1A]/20 flex items-center justify-center transition-colors shrink-0"
                      >
                        <X className="w-4 h-4 text-[#1A1A1A]" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-5 sm:p-8 text-center space-y-3 sm:space-y-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-full bg-[#D9CCF5]/20 flex items-center justify-center">
                      <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-[#1A1A1A]" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-[#1A1A1A] mb-1">
                        Drag and drop your file here
                      </p>
                      <p className="text-[11px] sm:text-xs text-[#8A8A8A]">or</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="px-5 sm:px-6 py-2 rounded-xl bg-[#1A1A1A] text-white text-xs sm:text-sm font-semibold hover:bg-black transition-all"
                    >
                      Browse Files
                    </button>
                    <p className="text-[10px] sm:text-xs text-[#8A8A8A] leading-relaxed">
                      <strong>Audio:</strong> MP3, WAV, M4A, FLAC, OGG, AAC
                      <br />
                      <strong>Video:</strong> MP4, AVI, MOV, MKV, WebM, FLV, WMV
                      <br />
                      Max size: 500MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Language Selector */}
          <div className="space-y-2">
            <label htmlFor="language" className="block text-xs sm:text-sm font-semibold text-[#1A1A1A]">
              Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              disabled={loading}
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 border-[#1A1A1A]/15 bg-[#FDFCF0] text-xs sm:text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#D9CCF5] focus:border-transparent transition-all"
            >
              <option value="english">English</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (inputMode === 'url' && !url.trim()) || (inputMode === 'file' && !selectedFile)}
            className="w-full px-6 py-3.5 sm:py-4 rounded-xl bg-[#1A1A1A] text-white font-semibold text-xs sm:text-sm hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span>
                  {uploadProgress > 0 && uploadProgress < 100
                    ? `Uploading... ${uploadProgress}%`
                    : 'Processing...'}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{inputMode === 'url' ? 'Analyze Video' : 'Analyze Media'}</span>
              </>
            )}
          </button>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="bg-[#D9CCF5]/20 rounded-2xl border border-[#D9CCF5]/40 p-4 sm:p-6 text-center space-y-3">
            <div className="flex justify-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center">
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#D9CCF5] animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-[#1A1A1A]">
                {uploadProgress > 0 && uploadProgress < 100
                  ? `Uploading file... ${uploadProgress}%`
                  : `Processing ${inputMode === 'url' ? 'video' : 'media'}...`}
              </p>
              <p className="text-[11px] sm:text-xs text-[#8A8A8A] mt-1 max-w-md mx-auto">
                This may take 2-10 minutes. We're {inputMode === 'url' && 'downloading, '}
                transcribing audio, and creating a searchable index.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 rounded-2xl border-2 border-red-200 p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-red-900 mb-1">
                  {error.toLowerCase().includes('youtube download failed') || error.toLowerCase().includes('blocking downloads')
                    ? 'YouTube Download Blocked'
                    : 'Error'}
                </h3>
                <p className="text-xs sm:text-sm text-red-700 break-words whitespace-pre-line">
                  {error.toLowerCase().includes('youtube download failed') || error.toLowerCase().includes('blocking downloads')
                    ? "YouTube is blocking downloads from the server's IP address. This is a YouTube restriction, not a code bug."
                    : error}
                </p>

                {(error.toLowerCase().includes('youtube download failed') || error.toLowerCase().includes('blocking downloads')) && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] sm:text-xs font-semibold text-red-800">What you can do:</p>
                    <ol className="text-[11px] sm:text-xs text-red-700 space-y-1.5 list-decimal list-inside">
                      <li>
                        <strong>Switch to File Upload</strong> — download the video with a browser tool like{' '}
                        <a href="https://cobalt.tools" target="_blank" rel="noopener noreferrer" className="underline">cobalt.tools</a>
                        {' '}or{' '}
                        <a href="https://yt-dlp.github.io/yt-dlp-web-ui" target="_blank" rel="noopener noreferrer" className="underline">yt-dlp web UI</a>
                        , save the MP3/MP4, then use the "Upload File" tab above.
                      </li>
                      <li>
                        <strong>Try a different video</strong> — videos with auto-generated captions work instantly without any download. Most English YouTube videos have them.
                      </li>
                    </ol>
                  </div>
                )}

                {!error.toLowerCase().includes('youtube download failed') && !error.toLowerCase().includes('blocking downloads') && (
                  <p className="text-[11px] sm:text-xs text-red-600 mt-1.5">
                    Make sure the backend is running and the {inputMode === 'url' ? 'URL is valid and the video is public' : 'file format is supported'}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AudioVideoAnalyzer;
