'use client';

import React from 'react';
import Link from 'next/link';
import { useAgentConfig } from '@/lib/useAgentConfig';

export default function AgentSummaryCard() {
  const { config, isLoaded } = useAgentConfig();

  if (!isLoaded) {
    return null;
  }

  if (!config) {
    return (
      <div className="p-4 rounded-2xl bg-white border border-[#1F8A84]/20 shadow-xs flex items-center justify-between text-left">
        <div className="flex items-center space-x-3">
          <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-bold border border-amber-200">
            ⚠️
          </span>
          <div>
            <p className="text-xs font-bold text-[#0F3D3E]">
              No active draft assistant found
            </p>
            <p className="text-[11px] text-gray-500">
              Start on the Write page to describe or paste your website.
            </p>
          </div>
        </div>
        <Link
          href="/write"
          className="px-3.5 py-1.5 bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
        >
          Go to Write &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-white via-white to-[#F4F8F6] border border-[#1F8A84]/20 text-left shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F3D3E] to-[#1F8A84] text-white flex items-center justify-center text-base font-extrabold shadow-2xs shrink-0">
          🤖
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F8A84] bg-[#E8F1EF] px-2 py-0.5 rounded-full">
              Active Draft
            </span>
            <h3 className="text-sm font-extrabold text-[#0F3D3E] truncate max-w-[200px] sm:max-w-xs">
              {config.name}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
            <span>
              <strong className="text-gray-700">Voice:</strong> {config.voiceName || 'Rachel (Natural)'}
            </span>
            <span>•</span>
            <span>
              <strong className="text-gray-700">Languages:</strong> {config.languages.join(', ')}
            </span>
          </div>
        </div>
      </div>

      <Link
        href="/write"
        className="self-end sm:self-center text-xs font-bold text-[#1F8A84] hover:text-[#0F3D3E] px-3 py-1.5 rounded-xl hover:bg-[#E8F1EF] border border-[#1F8A84]/25 transition-all"
      >
        Edit Configuration ✍️
      </Link>
    </div>
  );
}
