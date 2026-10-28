'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SampleDataBadge from '@/components/SampleDataBadge';
import { AgentConfig, AgentDeployment, isValidAgentConfig } from '@/lib/types';

const DEPLOYMENT_STORAGE_KEY = 'voiceforge:deployment';
const AGENT_STORAGE_KEY = 'voiceforge:agent';

export default function PublicAgentPage() {
  const params = useParams();
  const agentId = typeof params?.id === 'string' ? params.id : '';

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [deployment, setDeployment] = useState<AgentDeployment | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedDeployment = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
      const storedAgent = window.localStorage.getItem(AGENT_STORAGE_KEY);

      if (!storedDeployment || !storedAgent) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      const parsedDeployment: AgentDeployment = JSON.parse(storedDeployment);
      const parsedAgent = JSON.parse(storedAgent);

      if (parsedDeployment.agentId !== agentId || !isValidAgentConfig(parsedAgent)) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setDeployment(parsedDeployment);
      setConfig(parsedAgent);
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-4">
        <div className="p-8 text-center">
          <svg
            className="animate-spin h-8 w-8 text-[#0F3D3E] mx-auto mb-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm font-semibold text-[#0F3D3E]">Loading voice assistant...</p>
        </div>
      </div>
    );
  }

  if (notFound || !config) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-200 shadow-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            ✕
          </div>
          <h1 className="text-xl font-extrabold text-[#0F3D3E] mb-2">
            This agent was not found on this device.
          </h1>
          <p className="text-xs text-gray-600 mb-6 leading-relaxed">
            This version only works on the device that created it because agent configurations are stored locally in the browser.
          </p>
          <div className="space-y-2">
            <Link
              href="/deploy"
              className="inline-block w-full py-2.5 px-4 bg-[#0F3D3E] text-white rounded-xl text-xs font-bold hover:bg-[#1F8A84] transition-colors"
            >
              Go to Deploy Stage &rarr;
            </Link>
            <Link
              href="/write"
              className="inline-block w-full py-2 px-4 text-xs font-bold text-[#1F8A84] hover:underline"
            >
              Create a new assistant on Write
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col items-center justify-center py-10 px-4">
      {/* Container */}
      <div className="w-full max-w-lg bg-white rounded-3xl border border-[#1F8A84]/25 shadow-lg overflow-hidden">
        {/* Top Banner */}
        <div className="bg-[#0F3D3E] text-white p-6 sm:p-8 text-center relative">
          {deployment?.isSample && (
            <div className="mb-3 flex justify-center">
              <SampleDataBadge />
            </div>
          )}
          <div className="w-20 h-20 rounded-full bg-[#1F8A84]/40 border-2 border-white/40 flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
            🎙️
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {config.name}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#E8F1EF] max-w-sm mx-auto leading-relaxed">
            {config.persona}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {config.languages.map((lang) => (
              <span
                key={lang}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 text-white border border-white/20"
              >
                🌐 {lang}
              </span>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* AI Disclosure Notice */}
          <div className="p-3.5 rounded-xl bg-[#E8F1EF] border border-[#1F8A84]/30 text-center">
            <p className="text-xs font-bold text-[#0F3D3E] flex items-center justify-center space-x-1.5">
              <span>🤖</span>
              <span>You are talking to an AI assistant.</span>
            </p>
          </div>

          {/* Welcome Message Card */}
          <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-gray-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F8A84] block mb-1">
              Opening Greeting
            </span>
            <p className="text-xs sm:text-sm text-gray-800 italic leading-relaxed">
              &ldquo;{config.welcomeMessage}&rdquo;
            </p>
          </div>

          {/* Goals / Capabilities */}
          {config.goals && config.goals.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F3D3E] block mb-2">
                What this assistant can do
              </span>
              <ul className="space-y-1.5">
                {config.goals.map((goal, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-gray-700 flex items-start space-x-2"
                  >
                    <span className="text-[#1F8A84] font-bold">✓</span>
                    <span>{goal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Disabled Voice Call Action */}
          <div className="pt-2 text-center space-y-2">
            <button
              type="button"
              disabled
              className="w-full py-3.5 px-6 rounded-2xl bg-gray-200 text-gray-500 font-bold text-sm sm:text-base cursor-not-allowed border border-gray-300 flex items-center justify-center space-x-2 shadow-inner"
              title="Voice conversation connects once ElevenLabs is set up."
            >
              <span>🎙️</span>
              <span>Talk to {config.name}</span>
            </button>
            <p className="text-xs text-amber-900 font-semibold bg-amber-50 py-1.5 px-3 rounded-lg border border-amber-200">
              Voice conversation connects once ElevenLabs is set up.
            </p>
          </div>

          {/* Local Device Note */}
          <div className="pt-4 border-t border-gray-200 text-center">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              ℹ️ <strong>Device notice:</strong> This version only works on the device that created it.
            </p>
          </div>

          {/* Back to builder link */}
          <div className="text-center pt-1">
            <Link
              href="/deploy"
              className="text-xs font-bold text-[#1F8A84] hover:text-[#0F3D3E] underline"
            >
              &larr; Back to VoiceForge Deployment
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
