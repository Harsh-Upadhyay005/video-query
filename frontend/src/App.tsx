import { useState, useEffect } from 'react';
import './index.css';
import { Header } from './components/Header';
import { WisprHero } from './components/WisprHero';
import { DictationPlayground } from './components/DictationPlayground';
import { FeatureShowcase } from './components/FeatureShowcase';
import { InteractiveChat } from './components/InteractiveChat';
import { Footer } from './components/Footer';
import PDFAnalyzer from './components/PDFAnalyzer';
import AudioVideoAnalyzer from './components/AudioVideoAnalyzer';
import { AnalysisResultCard } from './components/AnalysisResultCard';
import ErrorBoundary from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SharedAnalysisPage } from './pages/SharedAnalysisPage';
import type { AnalysisData } from './types/analysis';

type ViewType = 'home' | 'studio' | 'share';
type AnalyzerType = 'audio-video' | 'pdf';

function App() {
  const [activeView, setActiveView] = useState<ViewType>('home');
  const [, setStudioUrl] = useState<string>('');
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisData | null>(null);
  const [analyzerType, setAnalyzerType] = useState<AnalyzerType>('audio-video');
  const [shareSlug, setShareSlug] = useState<string | null>(null);

  useEffect(() => {
    const checkRoute = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/share/')) {
        const slug = hash.replace('#/share/', '').split('?')[0].split('/')[0];
        if (slug) {
          setShareSlug(slug);
          setActiveView('share');
          return;
        }
      }
      const pathname = window.location.pathname;
      if (pathname.startsWith('/share/')) {
        const slug = pathname.replace('/share/', '').split('?')[0].split('/')[0];
        if (slug) {
          setShareSlug(slug);
          setActiveView('share');
          return;
        }
      }
    };

    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('lastStudioAnalysis');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AnalysisData;
        setCurrentAnalysis(parsed);
        if (parsed.type === 'pdf') {
          setAnalyzerType('pdf');
        } else {
          setAnalyzerType('audio-video');
        }
      } catch (e) {
        console.error('Failed to parse cached analysis:', e);
        localStorage.removeItem('lastStudioAnalysis');
      }
    }
  }, []);

  const handleStartAnalysis = (url: string) => {
    setStudioUrl(url);
    setActiveView('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExplorePresets = () => {
    setActiveView('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnalysisReady = (result: AnalysisData) => {
    setCurrentAnalysis(result);
    if (result.type === 'pdf') {
      setAnalyzerType('pdf');
    } else {
      setAnalyzerType('audio-video');
    }
    try {
      localStorage.setItem('lastStudioAnalysis', JSON.stringify(result));
    } catch (e) {
      console.error('Failed to cache analysis to localStorage:', e);
    }
  };

  const handleResetAnalysis = () => {
    setCurrentAnalysis(null);
    try {
      localStorage.removeItem('lastStudioAnalysis');
    } catch (e) {
      console.error('Failed to remove cached analysis:', e);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#FDFCF0] text-[#1A1A1A] font-sans overflow-x-hidden">
        <Header
          activeView={activeView === 'share' ? 'home' : activeView}
          onNavigateToHome={() => {
            window.location.hash = '';
            setActiveView('home');
          }}
          onNavigateToStudio={() => {
            window.location.hash = '';
            setActiveView('studio');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {activeView === 'share' && shareSlug ? (
          <SharedAnalysisPage
            slug={shareSlug}
            onNavigateToStudio={() => {
              window.location.hash = '';
              setActiveView('studio');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigateToHome={() => {
              window.location.hash = '';
              setActiveView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : activeView === 'home' ? (
          <div className="animate-fade-in">
            <WisprHero
              onStartAnalysis={handleStartAnalysis}
              onExplorePresets={handleExplorePresets}
              onNavigateToStudio={() => setActiveView('studio')}
            />
            <DictationPlayground />
            <FeatureShowcase />
            <Footer onNavigateToStudio={() => {
              setActiveView('studio');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }} />
          </div>
        ) : (
          <ProtectedRoute onBackToHome={() => setActiveView('home')}>
            <div className="pt-16 sm:pt-20 bg-[#FDFCF0] min-h-screen flex flex-col animate-fade-in">

            <div className="flex-1 pb-12 sm:pb-16">
              <section className="py-6 sm:py-8 px-3 sm:px-6">
                <div className="max-w-6xl mx-auto">
                  {/* Analyzer Tabs */}
                  <div className="flex flex-col sm:flex-row justify-center gap-2.5 sm:gap-4 mb-6 sm:mb-8 max-w-md sm:max-w-none mx-auto">
                    <button
                      onClick={() => {
                        setAnalyzerType('audio-video');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 ${
                        analyzerType === 'audio-video'
                          ? 'bg-[#1A1A1A] text-white shadow-md'
                          : 'bg-white border-2 border-[#1A1A1A]/20 text-[#1A1A1A] hover:border-[#1A1A1A]'
                      }`}
                    >
                      <span>🎬</span>
                      <span>Audio / Video / YouTube</span>
                    </button>
                    <button
                      onClick={() => {
                        setAnalyzerType('pdf');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 ${
                        analyzerType === 'pdf'
                          ? 'bg-[#1A1A1A] text-white shadow-md'
                          : 'bg-white border-2 border-[#1A1A1A]/20 text-[#1A1A1A] hover:border-[#1A1A1A]'
                      }`}
                    >
                      <span>📄</span>
                      <span>PDF Documents</span>
                    </button>
                  </div>

                  <ErrorBoundary>
                    <div className="bg-white rounded-2xl sm:rounded-3xl border-2 border-[#1A1A1A] shadow-xl p-4 sm:p-6 md:p-8">
                      {analyzerType === 'audio-video' ? (
                        currentAnalysis && currentAnalysis.type !== 'pdf' ? (
                          <AnalysisResultCard
                            analysis={currentAnalysis}
                            onReset={handleResetAnalysis}
                          />
                        ) : (
                          <AudioVideoAnalyzer
                            onAnalysisComplete={handleAnalysisReady}
                          />
                        )
                      ) : (
                        currentAnalysis && currentAnalysis.type === 'pdf' ? (
                          <AnalysisResultCard
                            analysis={currentAnalysis}
                            onReset={handleResetAnalysis}
                          />
                        ) : (
                          <PDFAnalyzer
                            onAnalysisComplete={handleAnalysisReady}
                          />
                        )
                      )}
                    </div>
                  </ErrorBoundary>
                </div>
              </section>

              {currentAnalysis && (
                <ErrorBoundary>
                  <InteractiveChat currentAnalysis={currentAnalysis} />
                </ErrorBoundary>
              )}
            </div>

            <Footer onNavigateToStudio={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          </div>
          </ProtectedRoute>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
