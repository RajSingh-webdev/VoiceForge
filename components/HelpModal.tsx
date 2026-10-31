'use client';

import React, { useEffect } from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const stages = [
  {
    step: '1',
    title: 'Write',
    badge: 'Describe or Link',
    icon: '✍️',
    description:
      'Describe your business requirements in natural language or paste your website URL. Gemini automatically extracts verified facts, business hours, services, and conversation flow.',
  },
  {
    step: '2',
    title: 'Test',
    badge: 'Interactive Audio Call',
    icon: '🎙️',
    description:
      'Talk directly with your assistant using live real-time audio. Test bilingual Hindi/English switching, realistic business inquiries, and automatic human escalation handling.',
  },
  {
    step: '3',
    title: 'Refine',
    badge: 'Plain Language Tuning',
    icon: '🪄',
    description:
      'Tune your assistant in plain English or Hindi (e.g. "always greet callers formally"). Review side-by-side visual diffs before saving with one-click rollback anytime.',
  },
  {
    step: '4',
    title: 'Deploy',
    badge: 'Shareable Link & Widget',
    icon: '🚀',
    description:
      'Publish your assistant with an instant public shareable helpline link, custom landing page, or embeddable web call widget ready for customers.',
  },
  {
    step: '5',
    title: 'Observe',
    badge: 'Insights & One-Click Fixes',
    icon: '📊',
    description:
      'Analyze call recordings, transcripts, sentiment trends, and latency. One-click apply AI-recommended knowledge base or guardrail improvements.',
  },
];

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#1F8A84]/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E8F1EF] bg-linear-to-r from-[#E8F1EF]/60 to-white">
          <div className="flex items-center space-x-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#0F3D3E] text-white flex items-center justify-center text-sm font-bold shadow-xs">
              ℹ️
            </span>
            <div>
              <h2 id="help-modal-title" className="text-base sm:text-lg font-bold text-[#0F3D3E]">
                How VoiceForge Works
              </h2>
              <p className="text-xs text-[#1F8A84]">
                Complete 5-stage workflow guide for creating & managing your voice assistant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Help Modal"
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Stages Overview */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 no-scrollbar">
          {stages.map((stage) => (
            <div
              key={stage.step}
              className="p-3.5 sm:p-4 rounded-xl border border-[#1F8A84]/20 bg-[#F9FBFA] hover:bg-[#E8F1EF]/40 transition-colors flex items-start space-x-3.5"
            >
              <div className="flex flex-col items-center shrink-0">
                <span className="w-8 h-8 rounded-full bg-[#0F3D3E] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  {stage.step}
                </span>
                <span className="text-base mt-1.5">{stage.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1 mb-1">
                  <h3 className="text-sm font-bold text-[#0F3D3E]">
                    Stage {stage.step}: {stage.title}
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#1F8A84]/15 text-[#0F3D3E]">
                    {stage.badge}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#0F3D3E]/80 leading-relaxed">
                  {stage.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-[#E8F1EF] bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-[#1F8A84] font-medium hidden sm:inline">
            VoiceForge • Conversational AI Engine
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors ml-auto"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
