'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AgentSummaryCard from '@/components/AgentSummaryCard';
import SampleDataBadge from '@/components/SampleDataBadge';
import AgentSyncStatus from '@/components/AgentSyncStatus';
import VoicePicker from '@/components/VoicePicker';
import BulkCampaignPanel from '@/components/BulkCampaignPanel';
import { useAgentConfig } from '@/lib/useAgentConfig';
import { AgentDeployment } from '@/lib/types';
import { computeConfigHash, setSavedSyncState, getDeploymentForConfig, saveDeploymentForConfig } from '@/lib/sync';

const DEPLOYMENT_STORAGE_KEY = 'voiceforge:deployment';
const DEPLOY_COUNT_KEY = 'voiceforge:deploy_count';

export default function DeployPage() {
  const { config, setConfig, isLoaded } = useAgentConfig();
  const [deployment, setDeployment] = useState<AgentDeployment | null>(null);
  const [createdCount, setCreatedCount] = useState<number>(0);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [origin, setOrigin] = useState<string>('');

  // Booking Webhook state
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [webhookTestResult, setWebhookTestResult] = useState<any>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  // Read stored deployment for the active assistant configuration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      if (isLoaded) {
        const matched = getDeploymentForConfig(config);
        setDeployment(matched);
      }
      try {
        const storedCount = window.localStorage.getItem(DEPLOY_COUNT_KEY);
        if (storedCount) {
          const parsedCount = parseInt(storedCount, 10);
          if (!isNaN(parsedCount)) {
            setCreatedCount(parsedCount);
          }
        }
      } catch {
        // Fallback
      }
    }
  }, [config, isLoaded]);

  const handleCreateAgent = async () => {
    if (!config) return;

    // Requirement 4: If an agent already exists, ask for confirmation before creating another one, and say how many have been created.
    if (deployment || createdCount > 0) {
      const count = createdCount > 0 ? createdCount : 1;
      const confirmed = window.confirm(
        `An assistant already exists (${count} created so far). Are you sure you want to create another one in ElevenLabs?`
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
        saveDeploymentForConfig(config.name, newDeployment);
        window.localStorage.setItem(DEPLOY_COUNT_KEY, nextCount.toString());
        if (newDeployment.isSample === false) {
          setSavedSyncState(computeConfigHash(config), newDeployment.createdAt, newDeployment.agentId);
        }
      }

      // Also associate agentId directly with the draft config
      if (data.agentId) {
        setConfig((prev) => (prev ? { ...prev, agentId: data.agentId } : prev));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while deploying the agent.');
    } finally {
      setIsCreating(false);
    }
  };

  const shareUrl = deployment ? `${origin}/agent/${deployment.agentId}` : '';

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    setWebhookError(null);
    setWebhookTestResult(null);

    try {
      const res = await fetch('/api/webhooks/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerName: 'Sarah Jenkins (Test Caller)',
          callerPhone: '+1-555-0143',
          appointmentDate: '2026-11-05',
          appointmentTime: '10:00 AM',
          service: 'Routine Dental Cleaning',
          notes: 'Test booking dispatched from VoiceForge Deploy console',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch test booking webhook.');
      }
      setWebhookTestResult(data);
    } catch (err: any) {
      setWebhookError(err.message || 'Webhook test failed.');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
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
              Share your voice assistant directly with clients and patients via a simple web link.
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
                  {deployment ? 'Your AI assistant is ready!' : 'Ready to create your assistant?'}
                </h2>
                {deployment?.isSample && <SampleDataBadge />}
              </div>
              <p className="text-xs sm:text-sm text-[#1F8A84] mt-1">
                {deployment
                  ? 'Your assistant has been created and is ready to test.'
                  : 'Create your assistant to unlock your share link.'}
              </p>
              {deployment && (
                <details className="mt-2 text-xs text-gray-500">
                  <summary className="cursor-pointer text-[#1F8A84] font-medium hover:underline inline-block select-none">
                    Advanced details
                  </summary>
                  <div className="mt-1 p-2 rounded bg-gray-50 border border-gray-200 font-mono text-[11px] text-gray-600">
                    Assistant ID: {deployment.agentId} · Created {new Date(deployment.createdAt).toLocaleDateString()}
                    {createdCount > 0 && ` · Total created: ${createdCount}`}
                  </div>
                </details>
              )}
            </div>

            <button
              type="button"
              onClick={handleCreateAgent}
              disabled={isCreating}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shrink-0 ${
                deployment
                  ? 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                  : 'bg-[#0F3D3E] hover:bg-[#1F8A84] text-white'
              }`}
            >
              {isCreating ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-current"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Creating assistant...</span>
                </>
              ) : (
                <span>{deployment ? 'Create another assistant' : 'Create assistant'}</span>
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

          {/* Deployed Channels */}
          {deployment && (
            <div className="space-y-6 mb-8">
              {/* Share Your Assistant */}
              <div>
                <h2 className="text-lg font-bold text-[#0F3D3E] mb-3">
                  Share Your Assistant
                </h2>

                <div className="bg-white p-6 rounded-2xl border border-[#1F8A84]/25 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-[#E8F1EF] text-[#0F3D3E] flex items-center justify-center text-lg font-bold">
                        🔗
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#0F3D3E]">
                          Shareable Web Link
                        </h3>
                        <p className="text-xs text-gray-600">
                          Share this link with your customers or patients for instant voice calls in their browser.
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#1F8A84] uppercase tracking-wider bg-[#E8F1EF] px-2.5 py-1 rounded-full border border-[#1F8A84]/20 shrink-0">
                      Active Link
                    </span>
                  </div>

                  {(origin.includes('localhost') || origin.includes('127.0.0.1')) && (
                    <div className="mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-tight">
                      <strong>Local testing address:</strong> This link runs on your local computer ({origin}). When deployed to production, your public web domain will appear here for customers.
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-[#E8F1EF]/40 border border-[#1F8A84]/20 font-mono text-xs text-[#0F3D3E] break-all mb-4 select-all">
                    {shareUrl}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs font-bold transition-colors flex items-center justify-center space-x-2 shadow-xs"
                    >
                      <span>{copiedLink ? '✓ Link copied!' : '📋 Copy Link'}</span>
                    </button>
                    <Link
                      href={`/agent/${deployment.agentId}`}
                      target="_blank"
                      className="w-full sm:w-auto py-2.5 px-5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold text-center block transition-colors shadow-2xs"
                    >
                      Open Assistant ↗
                    </Link>
                  </div>
                </div>

                {/* Phone Deployment Note */}
                <div className="mt-4 p-4 rounded-xl bg-[#E8F1EF] border border-[#1F8A84]/25 flex items-center space-x-3 text-xs text-[#0F3D3E]">
                  <span className="text-lg shrink-0">📞</span>
                  <p className="leading-relaxed">
                    <strong>Phone deployment — Coming Soon.</strong> Your assistant currently works through its shareable web link.
                  </p>
                </div>
              </div>

              {/* Bulk Outbound Calling Campaign (Bonus Feature, Collapsed by Default) */}
              <div className="mt-8">
                <BulkCampaignPanel />
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
                </div>
              </div>

              {/* Optional Advanced Integration: Booking Webhook */}
              <details className="bg-white p-5 rounded-2xl border border-[#1F8A84]/25 shadow-sm group">
                <summary className="cursor-pointer select-none flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E8F1EF] text-[#0F3D3E] flex items-center justify-center text-lg font-bold">
                      📅
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0F3D3E]">
                        Advanced Integration: Inbound Booking Webhook
                      </h3>
                      <p className="text-xs text-[#1F8A84]">
                        Receive confirmed appointment bookings from your voice assistant into your clinic CRM or calendar.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-[#1F8A84] font-semibold bg-[#E8F1EF] px-2.5 py-1 rounded-lg">
                    Show / Hide Details
                  </span>
                </summary>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-end mb-4">
                    <button
                      type="button"
                      onClick={handleTestWebhook}
                      disabled={isTestingWebhook}
                      className="px-4 py-2 rounded-xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs font-bold transition-colors flex items-center space-x-1.5 shrink-0 disabled:opacity-50"
                    >
                      {isTestingWebhook ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Testing Webhook...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          <span>Send Test Booking</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
                        Webhook Target URL
                      </label>
                      <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 font-mono text-xs text-[#0F3D3E] break-all select-all">
                        {`${origin}/api/webhooks/booking`}
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-500">
                      Authenticate requests by passing your secret in the <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">x-webhook-secret</code> HTTP header.
                    </p>

                    {webhookError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                        ⚠️ {webhookError}
                      </div>
                    )}

                    {webhookTestResult && (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-900">
                          <span>✓</span>
                          <span>Webhook Response: Appointment Confirmed</span>
                        </div>
                        <pre className="p-2 rounded bg-white text-[10px] text-emerald-900 font-mono overflow-x-auto border border-emerald-200">
                          {JSON.stringify(webhookTestResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>
          )}
        </>
      )}
    </div>
  );
}
