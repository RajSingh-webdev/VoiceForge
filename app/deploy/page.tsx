'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AgentSummaryCard from '@/components/AgentSummaryCard';
import SampleDataBadge from '@/components/SampleDataBadge';
import AgentSyncStatus from '@/components/AgentSyncStatus';
import VoicePicker from '@/components/VoicePicker';
import { useAgentConfig } from '@/lib/useAgentConfig';
import { AgentDeployment } from '@/lib/types';
import { computeConfigHash, setSavedSyncState } from '@/lib/sync';

const DEPLOYMENT_STORAGE_KEY = 'voiceforge:deployment';
const DEPLOY_COUNT_KEY = 'voiceforge:deploy_count';

export default function DeployPage() {
  const { config, isLoaded } = useAgentConfig();
  const [deployment, setDeployment] = useState<AgentDeployment | null>(null);
  const [createdCount, setCreatedCount] = useState<number>(0);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [origin, setOrigin] = useState<string>('');

  // Read stored deployment and creation count on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      try {
        const stored = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
        if (stored) {
          const parsed: AgentDeployment = JSON.parse(stored);
          if (parsed && typeof parsed.agentId === 'string') {
            setDeployment(parsed);
          }
        }

        const storedCount = window.localStorage.getItem(DEPLOY_COUNT_KEY);
        if (storedCount) {
          const parsedCount = parseInt(storedCount, 10);
          if (!isNaN(parsedCount)) {
            setCreatedCount(parsedCount);
          }
        } else if (stored) {
          setCreatedCount(1);
        }
      } catch {
        // Fallback
      }
    }
  }, []);

  const handleCreateAgent = async () => {
    if (!config) return;

    // Requirement 4: If an agent already exists, ask for confirmation before creating another one, and say how many have been created.
    if (deployment || createdCount > 0) {
      const count = createdCount > 0 ? createdCount : 1;
      const confirmed = window.confirm(
        `An agent already exists (${count} agent${count === 1 ? '' : 's'} created so far). Are you sure you want to create another one in ElevenLabs?`
      );
      if (!confirmed) return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/agents/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create agent in ElevenLabs.');
      }

      const newDeployment: AgentDeployment = {
        agentId: data.agentId,
        createdAt: data.createdAt || new Date().toISOString(),
        isSample: data.isSample === false ? false : true,
        name: data.name || config.name,
      };

      setDeployment(newDeployment);
      const nextCount = (createdCount || 0) + 1;
      setCreatedCount(nextCount);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DEPLOYMENT_STORAGE_KEY, JSON.stringify(newDeployment));
        window.localStorage.setItem(DEPLOY_COUNT_KEY, nextCount.toString());
        if (newDeployment.isSample === false) {
          setSavedSyncState(computeConfigHash(config), newDeployment.createdAt, newDeployment.agentId);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while deploying the agent.');
    } finally {
      setIsCreating(false);
    }
  };

  const shareUrl = deployment ? `${origin}/agent/${deployment.agentId}` : '';

  const widgetSnippet = deployment
    ? `<!-- VoiceForge Voice Assistant Widget (Not connected yet) -->\n<!-- Sample snippet. The real widget code will use your ElevenLabs agent ID once connected. -->\n<div id="voiceforge-agent" data-agent-id="${deployment.agentId}"></div>\n<!-- Official widget script will be provided upon ElevenLabs connection -->`
    : '';

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopySnippet = () => {
    if (!widgetSnippet) return;
    navigator.clipboard.writeText(widgetSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  return (
    <div className="w-full max-w-5xl mx-auto text-left py-6 px-4 sm:px-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F3D3E] tracking-tight">
                Deploy & Share
              </h1>
              {deployment?.isSample && <SampleDataBadge />}
            </div>
            <p className="mt-2 text-base text-[#1F8A84] leading-relaxed">
              Launch your voice assistant via direct shareable web links, website widgets, and inbound phone lines.
            </p>
          </div>
        </div>
      </header>

      {/* Saved Agent Summary Card (Stop if no agent) */}
      <section className="mb-8" aria-label="Current Agent">
        <AgentSummaryCard />
      </section>

      {/* If still loading hook state */}
      {!isLoaded && (
        <div className="p-8 text-center text-xs text-gray-500">
          Loading deployment configuration...
        </div>
      )}

      {/* Only continue if an agent exists */}
      {isLoaded && !config && (
        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          Please design and save an assistant configuration on the{' '}
          <Link href="/write" className="underline font-bold text-amber-950">
            Write page
          </Link>{' '}
          before proceeding to deployment.
        </div>
      )}

      {isLoaded && config && (
        <>
          {/* Action to create or redeploy agent */}
          <div className="mb-8 p-6 bg-white rounded-2xl border border-[#1F8A84]/25 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-[#0F3D3E]">
                  {deployment ? 'Assistant Deployed' : 'Publish Voice Assistant'}
                </h2>
                {deployment?.isSample && <SampleDataBadge />}
              </div>
              <p className="text-xs sm:text-sm text-[#1F8A84] mt-1">
                {deployment
                  ? `Active Agent ID: ${deployment.agentId} · Published ${new Date(deployment.createdAt).toLocaleDateString()}`
                  : 'Generate your deployment credentials to unlock your share link, embed widget, and simulated phone flow.'}
                {createdCount > 0 && (
                  <span className="block text-[11px] text-gray-500 mt-0.5">
                    Total created: {createdCount} agent{createdCount === 1 ? '' : 's'}
                  </span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCreateAgent}
              disabled={isCreating}
              className="px-6 py-3 bg-[#0F3D3E] hover:bg-[#1F8A84] text-white rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shrink-0"
            >
              {isCreating ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Connecting ElevenLabs...</span>
                </>
              ) : (
                <span>{deployment ? 'Re-create agent' : '🚀 Create agent'}</span>
              )}
            </button>
          </div>

          {/* Sync Status for Deployed Agent */}
          {deployment && (
            <div className="mb-8">
              <AgentSyncStatus config={config} />
            </div>
          )}

          {/* Voice Picker Section */}
          <div className="mb-8">
            <VoicePicker />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between">
              <span>⚠️ {errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-xs font-bold text-red-800 hover:text-red-950"
              >
                ✕
              </button>
            </div>
          )}

          {/* Deployed Channels (3 Cards) */}
          {deployment && (
            <div className="space-y-6 mb-8">
              <h2 className="text-lg font-bold text-[#0F3D3E]">
                Deployment Channels
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Share Link */}
                <div className="bg-white p-6 rounded-2xl border border-[#1F8A84]/25 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#E8F1EF] text-[#0F3D3E] flex items-center justify-center text-lg font-bold">
                        🔗
                      </div>
                      <span className="text-[11px] font-bold text-[#1F8A84] uppercase tracking-wider">
                        Web Link
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#0F3D3E] mb-1">
                      Direct Share Link
                    </h3>
                    <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                      Share this standalone link with patients or clients for quick browser-based interaction.
                    </p>

                    <div className="p-2.5 rounded-lg bg-[#E8F1EF]/40 border border-[#1F8A84]/20 font-mono text-[11px] text-[#0F3D3E] break-all mb-4 select-all">
                      {shareUrl}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="w-full py-2 px-3 rounded-lg bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <span>{copiedLink ? '✓ Copied to clipboard!' : '📋 Copy link'}</span>
                    </button>
                    <Link
                      href={`/agent/${deployment.agentId}`}
                      target="_blank"
                      className="w-full py-1.5 px-3 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold text-center block transition-colors"
                    >
                      Open public preview ↗
                    </Link>
                  </div>
                </div>

                {/* Card 2: Website Widget */}
                <div className="bg-white p-6 rounded-2xl border border-[#1F8A84]/25 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#E8F1EF] text-[#0F3D3E] flex items-center justify-center text-lg font-bold">
                        💻
                      </div>
                      <span className="text-[11px] font-bold text-[#1F8A84] uppercase tracking-wider">
                        Embed
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#0F3D3E] mb-1">
                      Website Widget
                    </h3>
                    <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                      Embed this assistant directly onto your business homepage.
                    </p>

                    {/* Notice required by specification: Clearly labelled as not connected yet */}
                    <div className="mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-tight">
                      <strong>Not connected yet.</strong> Sample snippet. The real widget code will use your ElevenLabs agent ID once connected.
                    </div>

                    <pre className="p-2.5 rounded-lg bg-gray-900 text-emerald-400 font-mono text-[10px] overflow-x-auto max-h-36 mb-4 whitespace-pre-wrap select-all">
                      {widgetSnippet}
                    </pre>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleCopySnippet}
                      className="w-full py-2 px-3 rounded-lg bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <span>{copiedSnippet ? '✓ Snippet copied!' : '📋 Copy widget code'}</span>
                    </button>
                  </div>
                </div>

                {/* Card 3: Phone (simulated flow) */}
                <div className="bg-white p-6 rounded-2xl border border-[#1F8A84]/25 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#E8F1EF] text-[#0F3D3E] flex items-center justify-center text-lg font-bold">
                        📞
                      </div>
                      <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                        Not connected yet (Simulated)
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#0F3D3E] mb-1">
                      Phone (simulated flow)
                    </h3>
                    <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                      Connect a dedicated telecom phone number for 24/7 inbound patient calls.
                    </p>

                    {/* Placeholder Number with Sample Badge */}
                    <div className="p-3 rounded-xl bg-[#E8F1EF]/60 border border-[#1F8A84]/25 text-center mb-4">
                      <div className="text-base font-extrabold text-[#0F3D3E] tracking-wider font-mono">
                        +1 (555) 019-8432
                      </div>
                      <span className="inline-block mt-1 text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                        Sample, not a real number
                      </span>
                    </div>

                    {/* 3 Short Steps */}
                    <div className="space-y-2 mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F8A84] block">
                        How inbound calls work:
                      </span>
                      <ol className="text-xs text-gray-700 space-y-1.5 pl-4 list-decimal">
                        <li>
                          <strong>Assign a phone number:</strong> Link a Twilio or ElevenLabs telecom line to your agent.
                        </li>
                        <li>
                          <strong>Route inbound audio:</strong> Inbound phone calls stream live voice audio directly to the ElevenLabs AI engine.
                        </li>
                        <li>
                          <strong>Automate &amp; transfer:</strong> The agent answers inquiries using saved facts and transfers complex cases to human staff.
                        </li>
                      </ol>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 text-center">
                    <p className="text-[10px] text-gray-500 italic">
                      Not connected yet — no pretend calling. Live telephony connects with carrier API keys.
                    </p>
                  </div>
                </div>
              </div>

              {/* Checklist Section */}
              <div className="mt-8 bg-white p-6 rounded-2xl border border-[#1F8A84]/25 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#0F3D3E]">
                      Deployment Readiness Checklist
                    </h3>
                    <p className="text-xs text-[#1F8A84]">
                      Current status of your assistant deployment across live vs. sample components.
                    </p>
                  </div>
                  {deployment.isSample && <SampleDataBadge />}
                </div>

                <div className="divide-y divide-gray-100">
                  {/* Item 1: Agent */}
                  <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start space-x-3">
                      <span className="text-emerald-600 font-bold text-base">✓</span>
                      <div>
                        <p className="text-xs font-bold text-[#0F3D3E]">
                          Agent Configuration &amp; Knowledge
                        </p>
                        <p className="text-[11px] text-gray-600">
                          {config.name} ({config.languages.join(', ')}) with AI disclosure and clinic guardrails.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      {deployment.isSample ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          Sample agent ID ({deployment.agentId})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Live ElevenLabs agent ({deployment.agentId})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Item 2: Web Preview Link */}
                  <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start space-x-3">
                      <span className="text-emerald-600 font-bold text-base">✓</span>
                      <div>
                        <p className="text-xs font-bold text-[#0F3D3E]">
                          Standalone Public Web Preview
                        </p>
                        <p className="text-[11px] text-gray-600">
                          Accessible on creating device via /agent/{deployment.agentId}.
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-900 border border-teal-300 shrink-0">
                      Device-local link
                    </span>
                  </div>

                  {/* Item 3: Embed Widget */}
                  <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start space-x-3">
                      <span className="text-gray-400 font-bold text-base">•</span>
                      <div>
                        <p className="text-xs font-bold text-[#0F3D3E]">
                          Website Embed Widget
                        </p>
                        <p className="text-[11px] text-gray-600">
                          Snippet placeholder generated with active agent ID. Not connected to CDN script yet.
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300 shrink-0">
                      Not connected yet
                    </span>
                  </div>

                  {/* Item 4: Phone */}
                  <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start space-x-3">
                      <span className="text-gray-400 font-bold text-base">•</span>
                      <div>
                        <p className="text-xs font-bold text-[#0F3D3E]">
                          Inbound Phone Line
                        </p>
                        <p className="text-[11px] text-gray-600">
                          Simulated workflow displayed. Real telecom SIP trunking is not connected.
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300 shrink-0">
                      Not connected yet
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
