'use client';

import React from 'react';
import AgentSummaryCard from '@/components/AgentSummaryCard';
import SampleDataBadge from '@/components/SampleDataBadge';

export default function TestPage() {
  return (
    <div className="w-full max-w-2xl mx-auto text-left py-6 px-4 sm:px-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F3D3E] tracking-tight">
                Test Assistant
              </h1>
              <SampleDataBadge />
            </div>
            <p className="mt-2 text-base text-[#1F8A84] leading-relaxed">
              Preview and test conversational voice interactions with your saved assistant.
            </p>
          </div>
        </div>

        {/* Required Banner: Unmistakable Placeholder */}
        <div className="mt-4 p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-start space-x-3 shadow-xs">
          <span className="text-amber-800 text-lg font-bold shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-bold text-amber-950">
              Placeholder. Real voice is not connected yet.
            </p>
            <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
              This screen is a visual preview. Two-way low-latency audio conversations will connect directly once production ElevenLabs API credits and agent IDs are linked.
            </p>
          </div>
        </div>
      </header>

      {/* Saved Agent Summary */}
      <section className="mb-8" aria-label="Current Agent">
        <AgentSummaryCard />
      </section>

      {/* Mock Player Placeholder */}
      <div className="bg-white p-8 rounded-2xl border border-[#1F8A84]/25 shadow-sm text-center">
        <div className="w-20 h-20 rounded-full bg-[#E8F1EF] text-[#0F3D3E] flex items-center justify-center mx-auto mb-4 text-3xl border border-[#1F8A84]/20">
          🎙️
        </div>
        <h2 className="text-lg font-bold text-[#0F3D3E] mb-2">
          Voice Conversation Player
        </h2>
        <p className="text-xs text-gray-600 max-w-md mx-auto mb-6 leading-relaxed">
          The interactive web microphone and speech synthesis engine are held in mock mode until live ElevenLabs streaming credentials are enabled.
        </p>

        <button
          type="button"
          disabled
          className="px-6 py-3 rounded-xl bg-gray-200 text-gray-500 font-bold text-xs sm:text-sm cursor-not-allowed border border-gray-300 inline-flex items-center space-x-2"
        >
          <span>🎙️</span>
          <span>Start Voice Test (Disabled)</span>
        </button>

        <p className="text-[11px] text-gray-400 mt-4">
          Status: Simulated environment · No audio data transmitted
        </p>
      </div>
    </div>
  );
}
