'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAgentConfig } from '@/lib/useAgentConfig';
import { AgentConfig, FlowStep, ProposedTool, AgentDeployment } from '@/lib/types';
import AgentSummaryCard from '@/components/AgentSummaryCard';
import AgentSyncStatus from '@/components/AgentSyncStatus';

interface HistoryEntry {
  id: string;
  timestamp: string;
  request: string;
  previousConfig: AgentConfig;
}

const EXAMPLE_REQUESTS = [
  'Make the welcome message shorter and warmer',
  'Add Hindi',
  'Transfer to a human if the caller is angry',
  'Answer in simpler words',
];

const MAX_CHAR_COUNT = 500;
const HISTORY_STORAGE_KEY = 'voiceforge:refine_history';

function checkAiDisclosure(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\bai\b/.test(lower) ||
    lower.includes('artificial intelligence') ||
    lower.includes('virtual assistant') ||
    lower.includes('automated assistant') ||
    lower.includes('digital assistant') ||
    /\bbot\b/.test(lower)
  );
}

function enforceAiDisclosure(message: string, agentName: string): string {
  if (checkAiDisclosure(message)) {
    return message;
  }
  const prefix = agentName ? `Hi, I am the AI assistant for ${agentName}.` : 'Hi, I am an AI assistant.';
  return `${prefix} ${message}`.trim();
}

export default function RefinePage() {
  const { config, setConfig, isLoaded } = useAgentConfig();
  const [requestText, setRequestText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [proposedChanges, setProposedChanges] = useState<Partial<AgentConfig> | null>(null);
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [deployment, setDeployment] = useState<AgentDeployment | null>(null);

  // Load history & deployment from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setHistory(parsed);
          }
        }
      } catch {
        // Safe fallback
      }

      try {
        const storedDep = window.localStorage.getItem('voiceforge:deployment');
        if (storedDep) {
          setDeployment(JSON.parse(storedDep));
        }
      } catch {
        // Safe fallback
      }
    }
  }, []);

  const isRealAgent = Boolean(deployment && !deployment.isSample);

  // Save history to localStorage
  const saveHistory = (newHistory: HistoryEntry[]) => {
    setHistory(newHistory);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
      } catch {
        // Safe fallback
      }
    }
  };

  const charCount = requestText.length;
  const isTooLong = charCount > MAX_CHAR_COUNT;
  const isEmpty = requestText.trim().length === 0;
  const isSubmitDisabled = isEmpty || isTooLong || isLoading || !config;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitDisabled || !config) return;

    setIsLoading(true);
    setErrorMessage(null);
    setProposedChanges(null);

    const submittedText = requestText.trim();
    setLastSubmittedRequest(submittedText);

    try {
      const res = await fetch('/api/agents/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          request: submittedText,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Rate limit reached. Please wait a few moments before trying again.');
        }
        throw new Error(data.error || 'Failed to refine assistant configuration.');
      }

      if (!data.changes || Object.keys(data.changes).length === 0) {
        throw new Error('No modifications were proposed by the model for this request.');
      }

      setProposedChanges(data.changes);

      // Smooth scroll to proposed changes
      setTimeout(() => {
        const el = document.getElementById('proposed-change-panel');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!config || !proposedChanges) return;

    let merged: AgentConfig = {
      ...config,
      ...proposedChanges,
    };

    // Always keep AI disclosure in the welcome message
    if (proposedChanges.welcomeMessage) {
      merged.welcomeMessage = enforceAiDisclosure(merged.welcomeMessage, merged.name);
    }

    // Always keep English in the languages list
    if (proposedChanges.languages) {
      const hasEnglish = merged.languages.some((l) => l.toLowerCase() === 'english');
      if (!hasEnglish) {
        merged.languages = ['English', ...merged.languages];
      }
    }

    // Record into history
    const newEntry: HistoryEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      request: lastSubmittedRequest || 'Custom refinement',
      previousConfig: config,
    };
    saveHistory([newEntry, ...history]);

    // Apply to stored config
    setConfig(merged);
    setProposedChanges(null);
    setRequestText('');
  };

  const handleDiscard = () => {
    setProposedChanges(null);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const [latest, ...rest] = history;
    setConfig(latest.previousConfig);
    saveHistory(rest);
    setProposedChanges(null);
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto text-left py-6 px-4 sm:px-6">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F3D3E] tracking-tight">
          Refine your AI assistant
        </h1>
        <p className="mt-2 text-base sm:text-lg text-[#1F8A84] leading-relaxed">
          Fine-tune how your assistant speaks, its rules, and conversation behavior using natural language.
        </p>

        {/* Visible Note required by specification */}
        <div className="mt-4 p-4 rounded-xl bg-[#E8F1EF] border border-[#1F8A84]/30 flex items-start space-x-3">
          <span className="text-[#1F8A84] text-base font-bold shrink-0">ℹ️</span>
          <p className="text-xs sm:text-sm text-[#0F3D3E] font-medium leading-relaxed">
            {isRealAgent
              ? 'Changes reach the live agent when you click Publish changes.'
              : 'Changes update your saved setup. The live voice agent will be updated once ElevenLabs is connected.'}
          </p>
        </div>

        {/* Sync Status Banner */}
        {config && <AgentSyncStatus config={config} className="mt-4" />}
      </header>

      {/* 1. Saved Agent Summary Card */}
      <section className="mb-8" aria-label="Current Agent">
        <AgentSummaryCard />
      </section>

      {/* If there is no agent yet, stop here */}
      {!config ? null : (
        <>
          {/* 2. Chat-style Box for Change Request */}
          <section className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 sm:p-7 shadow-sm mb-8">
            <h2 className="text-base font-bold text-[#0F3D3E] mb-2">
              What would you like to change?
            </h2>
            <p className="text-xs text-[#1F8A84] mb-4">
              Type your instructions in plain language. We will draft the changes for you to review before applying.
            </p>

            {/* 4 Clickable Examples */}
            <div className="mb-4">
              <span className="text-xs font-bold text-[#0F3D3E] uppercase tracking-wider block mb-2">
                Click an example to try:
              </span>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_REQUESTS.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setRequestText(ex);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#E8F1EF] hover:bg-[#1F8A84] text-[#0F3D3E] hover:text-white border border-[#1F8A84]/30 text-xs font-medium transition-all text-left"
                  >
                    &ldquo;{ex}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            {/* Request Form */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="relative mb-3">
                <textarea
                  rows={3}
                  value={requestText}
                  onChange={(e) => {
                    setRequestText(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. Make the welcome message shorter and warmer, or add a guardrail to never quote pricing without a quote tool."
                  className={`w-full p-4 rounded-xl border text-sm text-[#0F3D3E] placeholder-[#1F8A84]/50 focus:outline-none transition-colors resize-y ${
                    isTooLong
                      ? 'border-red-500 focus:ring-2 focus:ring-red-400'
                      : 'border-[#1F8A84]/40 focus:ring-2 focus:ring-[#1F8A84]'
                  }`}
                  aria-describedby="refine-counter"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div className="text-xs">
                  {isTooLong && (
                    <span className="text-red-600 font-semibold">
                      Request exceeds maximum limit of {MAX_CHAR_COUNT} characters.
                    </span>
                  )}
                </div>
                <div
                  id="refine-counter"
                  className={`text-xs font-mono self-end sm:self-auto ${
                    isTooLong ? 'text-red-600 font-bold' : 'text-[#1F8A84]'
                  }`}
                >
                  {charCount} / {MAX_CHAR_COUNT} characters
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div
                  role="alert"
                  className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold">Unable to process request:</p>
                    <p className="text-xs mt-0.5">{errorMessage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="shrink-0 px-3 py-1.5 bg-red-800 text-white rounded-lg text-xs font-semibold hover:bg-red-900 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex items-center space-x-3">
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className={`px-5 py-3 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center space-x-2 ${
                    isSubmitDisabled
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-[#0F3D3E] hover:bg-[#1F8A84] text-white shadow-md active:scale-[0.99]'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      <span>Drafting changes...</span>
                    </>
                  ) : (
                    <span>Review proposed change &rarr;</span>
                  )}
                </button>

                {isLoading && (
                  <p className="text-xs text-[#1F8A84] animate-pulse">
                    Analyzing request and preparing before/after comparison...
                  </p>
                )}
              </div>
            </form>
          </section>

          {/* 4. Proposed Change Panel (Before & After) */}
          {proposedChanges && (
            <section
              id="proposed-change-panel"
              className="bg-white border-2 border-[#1F8A84] rounded-2xl p-6 sm:p-7 shadow-lg mb-8"
              aria-labelledby="proposed-heading"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-[#E8F1EF]">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h2 id="proposed-heading" className="text-lg font-extrabold text-[#0F3D3E]">
                      Proposed Changes
                    </h2>
                  </div>
                  <p className="text-xs text-[#1F8A84] mt-0.5">
                    Review the before and after comparison below before choosing to apply or discard.
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="px-4 py-2 bg-[#0F3D3E] hover:bg-[#1F8A84] text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                  >
                    ✓ Apply Changes
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </div>

              {/* Diffs */}
              <div className="space-y-5">
                {Object.entries(proposedChanges).map(([key, afterValue]) => {
                  const beforeValue = (config as any)[key];
                  const label = formatFieldLabel(key);

                  return (
                    <div key={key} className="rounded-xl border border-[#1F8A84]/20 p-4 bg-[#E8F1EF]/30">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D3E]">
                          {label}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#1F8A84] text-white">
                          Modified
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Before */}
                        <div className="p-3 bg-white rounded-lg border border-gray-200">
                          <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                            Before (Current)
                          </span>
                          <div className="text-xs text-gray-700 leading-relaxed">
                            {renderFieldValue(key, beforeValue)}
                          </div>
                        </div>

                        {/* After */}
                        <div className="p-3 bg-[#E8F1EF] rounded-lg border border-[#1F8A84]/40">
                          <span className="block text-[11px] font-bold text-[#0F3D3E] uppercase tracking-wider mb-1.5">
                            After (Proposed)
                          </span>
                          <div className="text-xs text-[#0F3D3E] font-medium leading-relaxed">
                            {renderFieldValue(key, afterValue)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Actions */}
              <div className="mt-6 pt-4 border-t border-[#E8F1EF] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-5 py-2.5 bg-[#0F3D3E] hover:bg-[#1F8A84] text-white rounded-lg text-xs font-bold transition-all shadow"
                >
                  ✓ Apply Changes
                </button>
              </div>
            </section>
          )}

          {/* 6. History List of Applied Changes */}
          <section className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 sm:p-7 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#0F3D3E]">
                  Change History
                </h2>
                <p className="text-xs text-[#1F8A84] mt-0.5">
                  Record of refinements applied during this session.
                </p>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="px-3.5 py-1.5 bg-[#E8F1EF] hover:bg-rose-50 text-[#0F3D3E] hover:text-rose-700 border border-[#1F8A84]/30 hover:border-rose-300 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1"
                >
                  <span>⤺</span>
                  <span>Undo last change</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-lg border border-gray-100">
                No refinements applied yet. Submit a change request above to customize your assistant.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-xl bg-[#E8F1EF]/40 border border-[#1F8A84]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-[#0F3D3E] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {history.length - idx}
                        </span>
                        <span className="text-xs font-bold text-[#0F3D3E]">
                          &ldquo;{entry.request}&rdquo;
                        </span>
                      </div>
                      <span className="text-[11px] text-[#1F8A84] ml-7">
                        Applied at {entry.timestamp}
                      </span>
                    </div>
                    {idx === 0 && (
                      <span className="self-start sm:self-auto px-2 py-0.5 bg-white text-[#0F3D3E] border border-[#1F8A84]/30 rounded text-[10px] font-bold">
                        Most recent
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function formatFieldLabel(key: string): string {
  switch (key) {
    case 'name':
      return 'Assistant Name';
    case 'persona':
      return 'Personality & Tone';
    case 'welcomeMessage':
      return 'Welcome Message';
    case 'languages':
      return 'Languages';
    case 'voiceSuggestion':
      return 'Voice Recommendation';
    case 'goals':
      return 'Core Goals';
    case 'flowSteps':
      return 'Conversation Flow';
    case 'guardrails':
      return 'Behavioural Guardrails';
    case 'tools':
      return 'Proposed Tools';
    default:
      return key;
  }
}

function renderFieldValue(key: string, value: any): React.ReactNode {
  if (value === undefined || value === null) {
    return <span className="italic text-gray-400">Not set</span>;
  }

  if (typeof value === 'string') {
    return <p className="whitespace-pre-wrap">{value}</p>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="italic text-gray-400">Empty list</span>;
    }

    if (key === 'languages' || key === 'goals' || key === 'guardrails') {
      return (
        <ul className="list-disc list-inside space-y-1">
          {value.map((item: string, i: number) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    }

    if (key === 'flowSteps') {
      return (
        <div className="space-y-2">
          {value.map((step: FlowStep, i: number) => (
            <div key={i} className="border-l-2 border-[#1F8A84] pl-2 py-0.5">
              <strong className="block">{step.title}</strong>
              <span className="text-[11px] text-gray-600">{step.instruction}</span>
            </div>
          ))}
        </div>
      );
    }

    if (key === 'tools') {
      return (
        <div className="space-y-2">
          {value.map((tool: ProposedTool, i: number) => (
            <div key={i} className="border-l-2 border-[#1F8A84] pl-2 py-0.5">
              <strong>{tool.name}</strong>
              <p className="text-[11px] text-gray-600">{tool.purpose}</p>
            </div>
          ))}
        </div>
      );
    }
  }

  return <span>{JSON.stringify(value)}</span>;
}
