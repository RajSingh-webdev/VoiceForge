'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AgentSummaryCard from '@/components/AgentSummaryCard';
import SampleDataBadge from '@/components/SampleDataBadge';
import { useAgentConfig } from '@/lib/useAgentConfig';
import {
  Conversation,
  ConversationOutcome,
  AgentConfig,
  CallAnalysisResult,
  FixHistoryItem,
} from '@/lib/types';

const FIXES_STORAGE_KEY = 'voiceforge:fixes';
const FIX_HISTORY_STORAGE_KEY = 'voiceforge:fix_history';

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const remainingSecs = sec % 60;
  if (mins === 0) return `${remainingSecs}s`;
  return `${mins}m ${remainingSecs}s`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  } catch {
    return iso;
  }
}

function getOutcomeBadgeClass(outcome: ConversationOutcome): string {
  switch (outcome) {
    case 'Flagged':
      return 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
    case 'Booked':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold';
    case 'Resolved':
      return 'bg-teal-50 text-teal-900 border-teal-300 font-semibold';
    case 'Transferred to human':
      return 'bg-purple-100 text-purple-900 border-purple-300 font-semibold';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

function checkAiDisclosure(text: string): boolean {
  const lower = (text || '').toLowerCase();
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
  const prefix = agentName
    ? `Hi, I am the AI assistant for ${agentName}.`
    : 'Hi, I am an AI assistant.';
  return `${prefix} ${message || ''}`.trim();
}

export default function ObservePage() {
  const { config, setConfig, isLoaded: isConfigLoaded } = useAgentConfig();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedCall, setSelectedCall] = useState<Conversation | null>(null);
  const [filter, setFilter] = useState<string>('All');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSampleData, setIsSampleData] = useState<boolean>(true);
  const [totalRealCalls, setTotalRealCalls] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<CallAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [ownerAnswer, setOwnerAnswer] = useState<string>('');

  // Fixes persistence and history
  const [appliedFixes, setAppliedFixes] = useState<string[]>([]);
  const [fixHistory, setFixHistory] = useState<FixHistoryItem[]>([]);
  const [lastAppliedFix, setLastAppliedFix] = useState<FixHistoryItem | null>(null);
  const [undoSuccessMessage, setUndoSuccessMessage] = useState<string | null>(null);

  // Load applied fixes and history from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedFixes = window.localStorage.getItem(FIXES_STORAGE_KEY);
        if (storedFixes) {
          const parsed = JSON.parse(storedFixes);
          if (Array.isArray(parsed)) {
            setAppliedFixes(parsed);
          }
        }
      } catch {
        // Fallback
      }

      try {
        const storedHistory = window.localStorage.getItem(FIX_HISTORY_STORAGE_KEY);
        if (storedHistory) {
          const parsed = JSON.parse(storedHistory);
          if (Array.isArray(parsed)) {
            setFixHistory(parsed);
          }
        }
      } catch {
        // Fallback
      }
    }
  }, []);

  const fetchConversations = async (sourceOverride?: 'real' | 'sample') => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const url = sourceOverride ? `/api/conversations?source=${sourceOverride}` : '/api/conversations';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load call conversations.');
      }
      setConversations(data.conversations || []);
      setIsSampleData(data.isSample !== false);
      setTotalRealCalls(typeof data.totalReal === 'number' ? data.totalReal : 0);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while fetching calls.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Reset analysis when selected call changes & fetch full transcript if missing
  const handleSelectCall = async (call: Conversation) => {
    setSelectedCall(call);
    setAnalysisResult(null);
    setAnalysisError(null);
    setOwnerAnswer('');
    // If there's an existing fix for this call in history, find the most recent
    const matchingFix = fixHistory.find((f) => f.callId === call.id);
    setLastAppliedFix(matchingFix || null);

    // If call has empty transcript (e.g. real ElevenLabs conversation), fetch details
    if (!call.transcript || call.transcript.length === 0) {
      try {
        const res = await fetch(`/api/conversations?id=${encodeURIComponent(call.id)}`);
        const data = await res.json();
        if (data?.conversation?.transcript) {
          setSelectedCall((prev) =>
            prev && prev.id === call.id
              ? { ...prev, transcript: data.conversation.transcript }
              : prev
          );
          setConversations((prev) =>
            prev.map((c) =>
              c.id === call.id ? { ...c, transcript: data.conversation.transcript } : c
            )
          );
        }
      } catch {
        // Fallback
      }
    }
  };

  // Analyze the selected call
  const handleAnalyzeCall = async () => {
    if (!selectedCall) return;

    if (!config) {
      setAnalysisError(
        'Please create and save an assistant configuration on the Write page first before analyzing calls.'
      );
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setOwnerAnswer('');

    try {
      const res = await fetch('/api/calls/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: selectedCall.transcript,
          config,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Rate limit reached, try again shortly.');
        }
        throw new Error(data.error || 'Failed to analyze call performance.');
      }

      if (!data.analysis) {
        throw new Error('No analysis data received from the server.');
      }

      setAnalysisResult(data.analysis);
    } catch (err: any) {
      setAnalysisError(err.message || 'An unexpected error occurred while analyzing the call.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply the proposed fix
  const handleApplyFix = () => {
    if (!config || !analysisResult || !selectedCall) return;

    const previousConfig: AgentConfig = JSON.parse(JSON.stringify(config));
    let updatedConfig: AgentConfig = JSON.parse(JSON.stringify(config));

    const fixType = analysisResult.fix_type;
    let diffSection: 'knowledge' | 'guardrail' | 'flow_step' = fixType;
    let beforeText = '';
    let afterText = '';

    if (fixType === 'knowledge') {
      const question = (
        analysisResult.suggested_title ||
        analysisResult.unanswered_question ||
        'Customer Inquiry'
      ).trim();
      const answer = (
        analysisResult.needs_owner_input
          ? ownerAnswer
          : analysisResult.suggested_text || ownerAnswer
      ).trim();

      if (!answer) {
        setAnalysisError('Please enter an answer to the business question before applying.');
        return;
      }

      const baseKnowledge = updatedConfig.knowledge || {
        business_name: updatedConfig.name,
        business_type: updatedConfig.persona,
        services: [],
        prices: [],
        faqs: [],
        not_found: [],
      };
      const currentFaqs = baseKnowledge.faqs || [];
      beforeText = `${currentFaqs.length} existing FAQ${currentFaqs.length === 1 ? '' : 's'} in knowledge base`;

      const updatedFaqs = [...currentFaqs, { question, answer }];
      updatedConfig.knowledge = {
        ...baseKnowledge,
        faqs: updatedFaqs,
      };
      afterText = `Added FAQ #${updatedFaqs.length}:\nQ: ${question}\nA: ${answer}`;
    } else if (fixType === 'guardrail') {
      const newGuardrail = (
        analysisResult.needs_owner_input && ownerAnswer.trim()
          ? `${analysisResult.suggested_title ? analysisResult.suggested_title + ': ' : ''}${ownerAnswer.trim()}`
          : analysisResult.suggested_text || analysisResult.suggested_title
      ).trim();

      if (!newGuardrail) {
        setAnalysisError('Guardrail content is required.');
        return;
      }

      beforeText = `${updatedConfig.guardrails.length} existing guardrail${updatedConfig.guardrails.length === 1 ? '' : 's'}`;
      updatedConfig.guardrails = [...updatedConfig.guardrails, newGuardrail];
      afterText = `Added Guardrail #${updatedConfig.guardrails.length}:\n"${newGuardrail}"`;
    } else if (fixType === 'flow_step') {
      const stepTitle = (
        analysisResult.suggested_title || `Step ${updatedConfig.flowSteps.length + 1}`
      ).trim();
      const stepInstruction = (
        analysisResult.needs_owner_input && ownerAnswer.trim()
          ? ownerAnswer.trim()
          : analysisResult.suggested_text || 'Follow clinic escalation protocol.'
      ).trim();

      beforeText = `${updatedConfig.flowSteps.length} existing flow step${updatedConfig.flowSteps.length === 1 ? '' : 's'}`;
      updatedConfig.flowSteps = [
        ...updatedConfig.flowSteps,
        { title: stepTitle, instruction: stepInstruction },
      ];
      afterText = `Added Flow Step #${updatedConfig.flowSteps.length}:\n"${stepTitle}": ${stepInstruction}`;
    }

    // Always keep AI disclosure in welcomeMessage and English in languages
    updatedConfig.welcomeMessage = enforceAiDisclosure(
      updatedConfig.welcomeMessage,
      updatedConfig.name
    );
    if (!updatedConfig.languages.some((l) => l.toLowerCase() === 'english')) {
      updatedConfig.languages = ['English', ...updatedConfig.languages];
    }

    // Save updated config using shared hook
    setConfig(updatedConfig);

    // Mark call as "Fix applied" in localStorage
    const nextFixes = Array.from(new Set([...appliedFixes, selectedCall.id]));
    setAppliedFixes(nextFixes);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(FIXES_STORAGE_KEY, JSON.stringify(nextFixes));
      } catch {
        // Fallback
      }
    }

    // Record in fix history
    const historyItem: FixHistoryItem = {
      id: Date.now().toString(),
      callId: selectedCall.id,
      callerName: selectedCall.callerName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fixType,
      title: analysisResult.suggested_title || analysisResult.unanswered_question,
      description: analysisResult.unanswered_question,
      previousConfig,
      appliedConfig: updatedConfig,
      diffSummary: {
        section: diffSection,
        before: beforeText,
        after: afterText,
      },
    };

    const nextHistory = [historyItem, ...fixHistory];
    setFixHistory(nextHistory);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(FIX_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
      } catch {
        // Fallback
      }
    }

    setLastAppliedFix(historyItem);
    setAnalysisResult(null);
    setOwnerAnswer('');
  };

  // Undo the most recent fix
  const handleUndoLastFix = () => {
    if (fixHistory.length === 0) return;

    const [lastFix, ...remainingHistory] = fixHistory;

    // Restore previous configuration
    setConfig(lastFix.previousConfig);
    setFixHistory(remainingHistory);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(FIX_HISTORY_STORAGE_KEY, JSON.stringify(remainingHistory));
      } catch {
        // Fallback
      }
    }

    // Check if undone call has any other active fixes in history
    const hasOtherFix = remainingHistory.some((h) => h.callId === lastFix.callId);
    if (!hasOtherFix) {
      const nextFixes = appliedFixes.filter((id) => id !== lastFix.callId);
      setAppliedFixes(nextFixes);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(FIXES_STORAGE_KEY, JSON.stringify(nextFixes));
        } catch {
          // Fallback
        }
      }
    }

    if (lastAppliedFix?.id === lastFix.id) {
      setLastAppliedFix(remainingHistory[0] || null);
    }

    setUndoSuccessMessage(`Fix for "${lastFix.callerName}" undone. Assistant configuration restored.`);
    setTimeout(() => {
      setUndoSuccessMessage(null);
    }, 4000);
  };

  // Dismiss analysis panel
  const handleDismissAnalysis = () => {
    setAnalysisResult(null);
    setAnalysisError(null);
    setOwnerAnswer('');
  };

  // Metrics
  const totalCalls = conversations.length;
  const avgDurationSeconds =
    totalCalls > 0
      ? Math.round(conversations.reduce((acc, c) => acc + c.duration, 0) / totalCalls)
      : 0;
  const bookedCount = conversations.filter((c) => c.outcome === 'Booked').length;
  const resolvedCount = conversations.filter((c) => c.outcome === 'Resolved').length;
  const flaggedCount = conversations.filter((c) => c.outcome === 'Flagged').length;
  const transferredCount = conversations.filter((c) => c.outcome === 'Transferred to human').length;

  const filteredCalls =
    filter === 'All'
      ? conversations
      : conversations.filter((c) => c.outcome === filter);

  return (
    <div className="w-full max-w-5xl mx-auto text-left py-6 px-4 sm:px-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F3D3E] tracking-tight">
                Observe & Analytics
              </h1>
              {isSampleData ? (
                <SampleDataBadge />
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Live ElevenLabs Calls</span>
                </span>
              )}
            </div>
            <p className="mt-2 text-base text-[#1F8A84] leading-relaxed">
              Review conversation outcomes, customer inquiries, AI performance, and apply one-click fixes.
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchConversations(isSampleData ? 'real' : 'sample')}
              className="text-xs px-3 py-2 rounded-lg border border-[#1F8A84]/30 bg-white text-[#0F3D3E] font-semibold hover:bg-[#E8F1EF] transition-colors shadow-sm"
            >
              {isSampleData ? 'Switch to Live Calls' : 'Switch to Demo Calls (Apply Fix)'}
            </button>
          </div>
        </div>

        {/* Status Note */}
        {isSampleData ? (
          <div className="mt-4 p-4 rounded-xl bg-[#E8F1EF] border border-[#1F8A84]/30 flex items-start space-x-3">
            <span className="text-[#1F8A84] text-base font-bold shrink-0">ℹ️</span>
            <p className="text-xs sm:text-sm text-[#0F3D3E] font-medium leading-relaxed">
              Sample data. Real calls will appear here once ElevenLabs is connected.
            </p>
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex items-start space-x-3">
            <span className="text-emerald-700 text-base font-bold shrink-0">✓</span>
            <p className="text-xs sm:text-sm text-emerald-900 font-medium leading-relaxed">
              Showing live calls directly from your ElevenLabs workspace.
            </p>
          </div>
        )}
      </header>

      {/* Undo confirmation banner */}
      {undoSuccessMessage && (
        <div
          role="status"
          className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <span className="text-emerald-700 font-bold">✓</span>
            <span className="text-xs sm:text-sm font-semibold">{undoSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setUndoSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Saved Agent Summary Card */}
      <section className="mb-8" aria-label="Current Agent">
        <AgentSummaryCard />
      </section>

      {/* Loading state */}
      {isLoading && (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#1F8A84]/25 shadow-sm mb-8">
          <svg
            className="animate-spin h-8 w-8 text-[#0F3D3E] mx-auto mb-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm font-semibold text-[#0F3D3E]">Loading conversation analytics...</p>
        </div>
      )}

      {/* Error state */}
      {errorMessage && !isLoading && (
        <div
          role="alert"
          className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-900 mb-8 flex items-center justify-between"
        >
          <div>
            <p className="font-bold text-sm">Failed to load analytics</p>
            <p className="text-xs text-red-700 mt-0.5">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchConversations()}
            className="px-3 py-1.5 bg-red-800 text-white rounded-lg text-xs font-semibold hover:bg-red-900 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !errorMessage && (
        <>
          {/* Metric Cards */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8" aria-label="Call Metrics">
            <div className="bg-white p-4 rounded-xl border border-[#1F8A84]/25 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F8A84] block">
                Total Calls
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-[#0F3D3E] mt-1 block">
                {totalCalls}
              </span>
              <span className="text-[10px] text-gray-500 mt-0.5 block">Smile Dental</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#1F8A84]/25 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F8A84] block">
                Avg Duration
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-[#0F3D3E] mt-1 block">
                {formatDuration(avgDurationSeconds)}
              </span>
              <span className="text-[10px] text-gray-500 mt-0.5 block">Across all calls</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                Booked
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-900 mt-1 block">
                {bookedCount}
              </span>
              <span className="text-[10px] text-emerald-700 mt-0.5 block">Appointments confirmed</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-teal-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block">
                Resolved
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-teal-900 mt-1 block">
                {resolvedCount}
              </span>
              <span className="text-[10px] text-teal-700 mt-0.5 block">Inquiries handled</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-300 shadow-sm bg-amber-50/30">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                Flagged
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-900 mt-1 block">
                {flaggedCount}
              </span>
              <span className="text-[10px] text-amber-700 mt-0.5 block">Needs knowledge update</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 block">
                Transferred
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-purple-900 mt-1 block">
                {transferredCount}
              </span>
              <span className="text-[10px] text-purple-700 mt-0.5 block">Escalated to staff</span>
            </div>
          </section>

          {/* Main Layout: Call List + Detail View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Call List Column */}
            <div className={`${selectedCall ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-4`}>
              <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h2 className="text-base font-bold text-[#0F3D3E]">
                    Call Records
                  </h2>
                  <span className="text-xs text-[#1F8A84]">
                    {filteredCalls.length} call{filteredCalls.length === 1 ? '' : 's'} shown
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-1.5 mb-4 border-b border-[#E8F1EF] pb-3">
                  {['All', 'Booked', 'Resolved', 'Flagged', 'Transferred to human'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFilter(tag)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        filter === tag
                          ? 'bg-[#0F3D3E] text-white shadow-sm'
                          : 'bg-[#E8F1EF] text-[#0F3D3E] hover:bg-[#1F8A84] hover:text-white'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                {/* Call List Items */}
                <div className="space-y-2.5">
                  {filteredCalls.map((call) => {
                    const isSelected = selectedCall?.id === call.id;
                    const isFixApplied = appliedFixes.includes(call.id);

                    return (
                      <button
                        key={call.id}
                        type="button"
                        onClick={() => handleSelectCall(call)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-[#0F3D3E] bg-[#E8F1EF] ring-2 ring-[#0F3D3E] shadow-sm'
                            : 'border-gray-200 bg-white hover:bg-[#E8F1EF]/40 hover:border-[#1F8A84]/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-[#0F3D3E]">
                              {call.callerName}
                            </span>
                            {isFixApplied && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span>✓</span> Fix applied
                              </span>
                            )}
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] border ${getOutcomeBadgeClass(
                              call.outcome
                            )}`}
                          >
                            {call.outcome}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-[11px] text-[#1F8A84]">
                          <span>⏱ {formatDuration(call.duration)}</span>
                          <span>🌐 {call.language}</span>
                          <span>📅 {formatTime(call.startTime)}</span>
                        </div>
                        <p className="mt-1.5 text-xs text-gray-600 line-clamp-2">
                          {call.summary}
                        </p>
                      </button>
                    );
                  })}

                  {filteredCalls.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-500 italic">
                      No calls matching filter &ldquo;{filter}&rdquo;.
                    </div>
                  )}
                </div>
              </div>

              {/* Fix History Card */}
              {fixHistory.length > 0 && (
                <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#0F3D3E] flex items-center space-x-2">
                      <span>🛠️ Fix History</span>
                      <span className="text-xs bg-[#E8F1EF] text-[#0F3D3E] px-2 py-0.5 rounded-full font-semibold">
                        {fixHistory.length}
                      </span>
                    </h3>
                    <button
                      type="button"
                      onClick={handleUndoLastFix}
                      className="text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      <span>↩ Undo last fix</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#1F8A84] mb-3">
                    Applied updates to your assistant configuration from call observations.
                  </p>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {fixHistory.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg border border-[#1F8A84]/20 bg-[#E8F1EF]/30 text-xs"
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-[#0F3D3E]">{item.callerName}</span>
                          <span className="text-gray-500">{item.timestamp}</span>
                        </div>
                        <div className="text-[11px] text-gray-700 line-clamp-1">
                          <span className="font-semibold capitalize text-[#1F8A84]">[{item.fixType}]: </span>
                          {item.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Detail View Column */}
            {selectedCall && (
              <div className="lg:col-span-7 bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-md sticky top-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-[#E8F1EF]">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-bold text-[#0F3D3E]">
                        {selectedCall.callerName}
                      </h3>
                      <SampleDataBadge />
                      {appliedFixes.includes(selectedCall.id) && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Fix applied
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-[#1F8A84]">
                      <span>{formatTime(selectedCall.startTime)}</span>
                      <span>·</span>
                      <span>Duration: {formatDuration(selectedCall.duration)}</span>
                      <span>·</span>
                      <span>Language: {selectedCall.language}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs border ${getOutcomeBadgeClass(
                        selectedCall.outcome
                      )}`}
                    >
                      {selectedCall.outcome}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedCall(null)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 font-bold"
                      aria-label="Close detail view"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* 2-Sentence Summary Box */}
                <div className="mb-5 p-4 rounded-xl bg-[#E8F1EF]/60 border border-[#1F8A84]/20">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F3D3E] block mb-1">
                    Call Summary
                  </span>
                  <p className="text-xs sm:text-sm text-[#0F3D3E] leading-relaxed">
                    {selectedCall.summary}
                  </p>
                </div>

                {/* Action Bar: Analyse this call */}
                <div className="mb-6 p-4 rounded-xl bg-white border border-[#1F8A84]/30 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-[#0F3D3E]">
                        AI Call Quality & Tuning
                      </h4>
                      <p className="text-xs text-[#1F8A84] mt-0.5">
                        Detect unanswered questions or behavioral gaps and generate a 1-click fix.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAnalyzeCall}
                      disabled={isAnalyzing}
                      className="px-4 py-2 bg-[#0F3D3E] hover:bg-[#1F8A84] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shrink-0"
                    >
                      {isAnalyzing ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 text-white"
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
                          <span>Analyzing transcript...</span>
                        </>
                      ) : (
                        <>
                          <span>🔍 Analyse this call</span>
                        </>
                      )}
                    </button>
                  </div>

                  {!config && isConfigLoaded && (
                    <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      No saved assistant configuration found.{' '}
                      <Link href="/write" className="underline font-bold text-amber-950">
                        Create an assistant on the Write page
                      </Link>{' '}
                      to enable automated tuning.
                    </div>
                  )}

                  {/* Analysis Error */}
                  {analysisError && (
                    <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold">⚠️</span>
                        <span>{analysisError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAnalyzeCall}
                        className="px-2.5 py-1 bg-red-800 text-white rounded-lg text-xs font-semibold hover:bg-red-900 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>

                {/* Analysis Result: No Problem Found */}
                {analysisResult && !analysisResult.issue_found && (
                  <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 animate-fadeIn">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start space-x-2.5">
                        <span className="text-base">✅</span>
                        <div>
                          <h5 className="font-bold text-sm text-emerald-950">
                            No problem found in this call.
                          </h5>
                          <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                            The assistant answered questions accurately, followed all configured guidelines, and achieved the intended call outcome successfully.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDismissAnalysis}
                        className="text-xs font-bold text-emerald-800 hover:text-emerald-950 px-2 py-1 rounded"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {/* Analysis Result: Issue Found Panel */}
                {analysisResult && analysisResult.issue_found && (
                  <div
                    id="issue-found-panel"
                    className="mb-6 p-5 rounded-2xl bg-amber-50/70 border-2 border-amber-300 text-amber-950 shadow-sm animate-fadeIn"
                  >
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-amber-200/80 mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-amber-800 text-lg">⚠️</span>
                        <h5 className="font-extrabold text-sm sm:text-base text-amber-950">
                          Issue Found
                        </h5>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 border border-amber-300">
                          Fix Type: {analysisResult.fix_type.replace('_', ' ')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleDismissAnalysis}
                        className="text-xs font-bold text-amber-800 hover:text-amber-950 p-1"
                        aria-label="Dismiss issue"
                      >
                        ✕
                      </button>
                    </div>

                    {/* What went wrong */}
                    <div className="mb-3.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                        What went wrong
                      </span>
                      <p className="text-xs sm:text-sm text-amber-950 font-medium leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-200">
                        {analysisResult.unanswered_question}
                      </p>
                    </div>

                    {/* Quoted evidence */}
                    {analysisResult.evidence && analysisResult.evidence.quote && (
                      <div className="mb-3.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                          Evidence (Turn {analysisResult.evidence.turn || 'Agent Turn'})
                        </span>
                        <blockquote className="text-xs text-gray-800 italic bg-amber-100/60 p-3 rounded-xl border-l-4 border-amber-500">
                          &ldquo;{analysisResult.evidence.quote}&rdquo;
                        </blockquote>
                      </div>
                    )}

                    {/* Suggested Fix */}
                    <div className="mb-3.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                        Suggested Fix
                      </span>
                      <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 text-xs space-y-1.5">
                        {analysisResult.suggested_title && (
                          <div className="font-bold text-[#0F3D3E]">
                            {analysisResult.suggested_title}
                          </div>
                        )}
                        {analysisResult.suggested_text && (
                          <div className="text-gray-700 leading-relaxed">
                            {analysisResult.suggested_text}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Owner Input Required */}
                    {analysisResult.needs_owner_input && (
                      <div className="mb-4 p-4 rounded-xl bg-white border-2 border-[#1F8A84] shadow-xs">
                        <div className="flex items-start space-x-2 mb-2">
                          <span className="text-[#1F8A84] font-bold text-base">✏️</span>
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F3D3E] block">
                              Business Information Needed
                            </span>
                            <p className="text-xs sm:text-sm font-semibold text-[#0F3D3E] mt-0.5">
                              {analysisResult.owner_question}
                            </p>
                          </div>
                        </div>

                        <textarea
                          rows={3}
                          value={ownerAnswer}
                          onChange={(e) => setOwnerAnswer(e.target.value)}
                          placeholder="Type your official answer here (e.g. Free 2-hour parking is provided in the building garage with validation at reception)..."
                          className="w-full text-xs p-3 rounded-lg border border-[#1F8A84]/40 focus:outline-none focus:ring-2 focus:ring-[#0F3D3E] bg-[#E8F1EF]/20 text-gray-900"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                          This fact will be saved to your assistant&apos;s knowledge base so it can answer subsequent callers accurately.
                        </p>
                      </div>
                    )}

                    {/* Notice required by specification */}
                    <div className="mb-4 p-3 rounded-xl bg-[#E8F1EF] border border-[#1F8A84]/30 flex items-start space-x-2.5">
                      <span className="text-[#1F8A84] font-bold text-sm shrink-0">ℹ️</span>
                      <p className="text-xs text-[#0F3D3E] font-medium leading-relaxed">
                        This updates your saved setup. The live voice agent will be updated once ElevenLabs is connected.
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end space-x-3 pt-2 border-t border-amber-200">
                      <button
                        type="button"
                        onClick={handleDismissAnalysis}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 transition-colors"
                      >
                        Dismiss
                      </button>

                      <button
                        type="button"
                        onClick={handleApplyFix}
                        disabled={analysisResult.needs_owner_input && !ownerAnswer.trim()}
                        className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#0F3D3E] hover:bg-[#1F8A84] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
                      >
                        <span>✓ Apply fix</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Before / After View of Applied Fix */}
                {lastAppliedFix && lastAppliedFix.callId === selectedCall.id && (
                  <div className="mb-6 p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-300 shadow-sm animate-fadeIn">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-200">
                      <div className="flex items-center space-x-2">
                        <span className="text-emerald-700 font-bold text-base">✓</span>
                        <h5 className="font-extrabold text-sm sm:text-base text-emerald-950">
                          Fix Applied to Saved Assistant
                        </h5>
                      </div>
                      <button
                        type="button"
                        onClick={handleUndoLastFix}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors"
                      >
                        ↩ Undo last fix
                      </button>
                    </div>

                    {/* Diff Preview */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {/* Before */}
                      <div className="p-3 bg-white/90 rounded-xl border border-emerald-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                          Before ({lastAppliedFix.diffSummary.section.replace('_', ' ')})
                        </span>
                        <p className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                          {lastAppliedFix.diffSummary.before}
                        </p>
                      </div>

                      {/* After */}
                      <div className="p-3 bg-emerald-100/60 rounded-xl border border-emerald-300">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block mb-1">
                          After (Updated)
                        </span>
                        <p className="text-xs text-emerald-950 font-mono font-medium whitespace-pre-wrap">
                          {lastAppliedFix.diffSummary.after}
                        </p>
                      </div>
                    </div>

                    {/* Notice required by specification */}
                    <div className="p-3 rounded-xl bg-[#E8F1EF] border border-[#1F8A84]/30 flex items-start space-x-2.5">
                      <span className="text-[#1F8A84] font-bold text-sm shrink-0">ℹ️</span>
                      <p className="text-xs text-[#0F3D3E] font-medium leading-relaxed">
                        This updates your saved setup. The live voice agent will be updated once ElevenLabs is connected.
                      </p>
                    </div>
                  </div>
                )}

                {/* Full Transcript */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F3D3E]">
                      Conversation Transcript ({selectedCall.transcript.length} turns)
                    </h4>
                    <span className="text-[11px] text-[#1F8A84]">Agent started first</span>
                  </div>

                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {selectedCall.transcript.map((turn, idx) => {
                      const isAgent = turn.role === 'agent';
                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                            isAgent
                              ? 'bg-[#E8F1EF] border border-[#1F8A84]/25 text-[#0F3D3E] mr-4'
                              : 'bg-white border border-gray-200 text-gray-800 ml-4 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-[11px] uppercase tracking-wider text-[#0F3D3E]">
                              {isAgent ? '🤖 Smile Dental AI' : `👤 ${selectedCall.callerName}`}
                            </span>
                            <span className="text-[10px] text-gray-400">Turn {idx + 1}</span>
                          </div>
                          <p>{turn.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
