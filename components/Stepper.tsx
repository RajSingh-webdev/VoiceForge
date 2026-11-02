'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import HelpModal from './HelpModal';

const steps = [
  { name: 'Write', path: '/write', icon: '✍️' },
  { name: 'Test', path: '/test', icon: '🎙️' },
  { name: 'Refine', path: '/refine', icon: '🪄' },
  { name: 'Deploy', path: '/deploy', icon: '🚀' },
  { name: 'Observe', path: '/observe', icon: '📊' },
];

export default function Stepper() {
  const pathname = usePathname();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  if (pathname === '/' || pathname.startsWith('/agent')) {
    return null;
  }

  return (
    <>
      <nav className="w-full bg-white/95 backdrop-blur-md border-b border-[#E8F1EF] py-2.5 sm:py-3 px-3 sm:px-8 shadow-2xs sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between relative">
          {/* Left: Brand Logo & Home indicator */}
          <div className="flex items-center space-x-3 shrink-0 z-10">
            <Link
              href="/"
              className="flex items-center space-x-2.5 text-[#0F3D3E] hover:opacity-90 transition-opacity group"
              id="brand-logo"
              title="Return to VoiceForge Home"
            >
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0F3D3E] to-[#1F8A84] flex items-center justify-center text-white font-extrabold text-sm shadow-xs group-hover:scale-105 transition-transform">
                🎙️
              </span>
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-[#0F3D3E]">
                Voice<span className="text-[#1F8A84]">Forge</span>
              </span>
            </Link>

            <span className="hidden sm:inline-block text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
              Studio
            </span>
          </div>

          {/* Stepper Navigation Steps (Segmented Pill) */}
          <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none">
            <div className="flex items-center p-1 bg-[#F4F7F5] rounded-xl border border-[#1F8A84]/20 pointer-events-auto shadow-2xs">
              {steps.map((step) => {
                const isActive = pathname === step.path;
                return (
                  <Link
                    key={step.path}
                    href={step.path}
                    className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#0F3D3E] text-white shadow-xs scale-[1.02]'
                        : 'text-[#0F3D3E]/70 hover:text-[#0F3D3E] hover:bg-white/60'
                    }`}
                  >
                    <span className="text-xs">{step.icon}</span>
                    <span>{step.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side: Help / How it works button */}
          <div className="flex items-center space-x-2 shrink-0 z-10">
            <button
              onClick={() => setIsHelpOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#0F3D3E] bg-[#E8F1EF] hover:bg-[#1F8A84]/20 border border-[#1F8A84]/30 transition-all cursor-pointer shadow-2xs"
              title="How VoiceForge works"
            >
              <span>ℹ️</span>
              <span className="hidden sm:inline">How It Works</span>
              <span className="sm:hidden">Help</span>
            </button>
          </div>
        </div>

        {/* Mobile-only horizontal scroll stepper */}
        <div className="md:hidden mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between overflow-x-auto no-scrollbar touch-scroll gap-1">
          {steps.map((step) => {
            const isActive = pathname === step.path;
            return (
              <Link
                key={step.path}
                href={step.path}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#0F3D3E] text-white shadow-2xs'
                    : 'text-[#1F8A84] hover:bg-[#E8F1EF]'
                }`}
              >
                <span>{step.icon}</span>
                <span>{step.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Unified Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
}
