import { useState, useEffect } from 'react';
import type React from 'react';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { isClerkConfigured } from '../lib/clerk';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface HeaderProps {
  onNavigateToStudio: () => void;
  onNavigateToHome: () => void;
  activeView: 'home' | 'studio';
}

const ClerkUserSection: React.FC = () => {
  return (
    <>
      <Show when="signed-out">
        <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-black/10">
          <SignInButton mode="modal">
            <button className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-[#1A1A1A] transition-colors hover:text-[#6D5A9E] whitespace-nowrap">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-full border border-black/10 bg-[#E5D7FA] px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-[#1A1A1A] shadow-xs transition-all hover:bg-[#D9CCF5] hover:scale-105 active:scale-95 whitespace-nowrap">
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </Show>
      <Show when="signed-in">
        <div className="flex items-center gap-2 pl-2 border-l border-black/10 shrink-0">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: 'w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-black/15 shadow-xs',
                userButtonPopoverCard: 'rounded-2xl border-2 border-[#1A1A1A]/10 shadow-xl bg-[#FDFCF0]',
              },
            }}
          />
        </div>
      </Show>
    </>
  );
};

export const Header: React.FC<HeaderProps> = ({
  onNavigateToStudio,
  onNavigateToHome,
  activeView,
}) => {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          setScrolled(prev => {
            // Hysteresis: only turn on if > 30, only turn off if < 10
            if (!prev && currentY > 30) return true;
            if (prev && currentY < 10) return false;
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
        setBackendOnline(res.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed top-2 sm:top-4 left-0 right-0 z-50 flex justify-center px-2 sm:px-4 pointer-events-none">
      <header
        className={`w-full max-w-5xl rounded-full border border-black/15 bg-[#FDFCF0]/90 py-1.5 sm:py-2.5 px-2.5 sm:pl-6 sm:pr-3 shadow-md backdrop-blur-md pointer-events-auto transition-[box-shadow,border-color,background-color] duration-200 ${
          scrolled ? 'shadow-lg border-black/25 bg-[#FDFCF0]/95' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Brand Logo */}
          <button
            onClick={onNavigateToHome}
            className="flex items-center gap-1.5 sm:gap-2 group focus:outline-none shrink-0"
          >
            {/* 3-bar animated soundwave logo */}
            <div className="flex items-end gap-0.5 h-4 w-4 sm:h-4.5 sm:w-5">
              <span className="w-0.75 bg-[#1A1A1A] rounded-full soundwave-bar" style={{ animationDelay: '0.1s', height: '100%' }} />
              <span className="w-0.75 bg-[#1A1A1A] rounded-full soundwave-bar" style={{ animationDelay: '0.3s', height: '60%' }} />
              <span className="w-0.75 bg-[#1A1A1A] rounded-full soundwave-bar" style={{ animationDelay: '0.2s', height: '80%' }} />
              <span className="w-0.75 bg-[#1A1A1A] rounded-full soundwave-bar" style={{ animationDelay: '0.4s', height: '50%' }} />
            </div>
            <span className="font-['Outfit',sans-serif] font-bold text-lg sm:text-xl text-[#1A1A1A] tracking-tight">
              videoQuery
            </span>
            {/* Tiny backend status dot */}
            <span
              className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full transition-colors ${
                backendOnline === null ? 'bg-amber-400' : backendOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'
              }`}
              title={backendOnline ? "Backend Connected (FastAPI)" : "Offline (Preset Mode)"}
            />
          </button>

          {/* Center Tabs */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-[#F4F3E8] p-0.5 sm:p-1 rounded-full border border-black/5 shrink-0">
            <button
              onClick={onNavigateToHome}
              className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide transition-all ${
                activeView === 'home'
                  ? 'bg-white text-[#1A1A1A] shadow-xs'
                  : 'text-[#8A8A8A] hover:text-[#1A1A1A]'
              }`}
            >
              Overview
            </button>
            <button
              onClick={onNavigateToStudio}
              className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide transition-all flex items-center gap-1 sm:gap-1.5 ${
                activeView === 'studio'
                  ? 'bg-white text-[#1A1A1A] shadow-xs'
                  : 'text-[#8A8A8A] hover:text-[#1A1A1A]'
              }`}
            >
              <span className="hidden xs:inline">Video</span> Studio
              <span className="text-[8px] sm:text-[9px] uppercase font-bold px-1 sm:px-1.5 py-0.5 rounded-full bg-[#D9CCF5] text-[#1a1a1a]">
                AI
              </span>
            </button>
          </div>

          {/* Right Links & CTA */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <nav className="hidden lg:flex items-center gap-5 text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/70">
              <a href="#tour" className="hover:text-[#1A1A1A] transition-colors">
                Product Tour
              </a>
              <a href="#features" className="hover:text-[#1A1A1A] transition-colors">
                Capabilities
              </a>
            </nav>

            {/* Hidden on mobile to avoid row overflow, accessible via Center Tab */}
            <button
              onClick={onNavigateToStudio}
              className="hidden md:flex items-center gap-2 rounded-full bg-[#E5D7FA] hover:bg-[#D9CCF5] border border-black/10 px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-[#1A1A1A] transition-all hover:scale-105 active:scale-95 shadow-xs whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5 text-[#1A1A1A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Launch Studio</span>
            </button>

            {isClerkConfigured && <ClerkUserSection />}
          </div>
        </div>
      </header>
    </div>
  );
};
