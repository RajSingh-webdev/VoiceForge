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
      <div className="mt-6 p-4 rounded-xl bg-white border border-[#1F8A84]/25 text-center">
        <p className="text-sm text-[#0F3D3E] font-medium mb-3">
          No agent yet, start on the Write page
        </p>
        <Link
          href="/write"
          className="inline-block px-4 py-2 bg-[#0F3D3E] text-white text-xs font-bold rounded-lg hover:bg-[#1F8A84] transition-colors"
        >
          Go to Write page &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 p-5 rounded-xl bg-white border border-[#1F8A84]/25 text-left shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F8A84]">
          Current Draft Agent
        </span>
        <Link
          href="/write"
          className="text-xs font-bold text-[#0F3D3E] hover:text-[#1F8A84] underline"
        >
          &larr; Back to Write
        </Link>
      </div>
      <h3 className="text-base font-bold text-[#0F3D3E]">{config.name}</h3>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#1F8A84] mt-1">
        <p>
          <strong>Languages:</strong> {config.languages.join(', ')}
        </p>
        <p>
          <strong>Voice:</strong> {config.voiceName || 'Rachel (Default)'}
        </p>
      </div>
    </div>
  );
}
