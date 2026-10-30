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
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
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

    // If an agent already exists, ask for confirmation before creating another one
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

  const widgetSnippet = deployment
    ? deployment.isSample
      ? `<!-- VoiceForge Voice Assistant Widget (Not connected yet) -->\n<!-- Sample snippet. The real widget code will use your ElevenLabs agent ID once connected. -->\n<div id="voiceforge-agent" data-agent-id="${deployment.agentId}"></div>\n<!-- Official widget script will be provided upon ElevenLabs connection -->`
      : `<!-- VoiceForge Live ElevenLabs Web Widget -->\n<elevenlabs-convai agent-id="${deployment.agentId}"></elevenlabs-convai>\n<script src="https://elevenlabs.io/convai-widget/index.js" async type="text/javascript"></script>\n\n<!-- Responsive Embed Iframe -->\n<iframe src="${origin}/agent/${deployment.agentId}?embed=true" width="100%" height="650" frameborder="0" allow="microphone"></iframe>`
    : '';

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
          service: 'General Service Consultation',
          notes: 'Test booking dispatched from VoiceForge Deploy console',
          targetWebhookUrl: config?.bookingWebhookUrl || undefined,
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

  const handleCopySnippet = () => {
    if (!widgetSnippet) return;
    navigator.clipboard.writeText(widgetSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  const initials = config?.name
    ? config.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('')
    : 'VF';

  return (
    <div className="w-full max-w-5xl mx-auto text-left py-6 px-4 sm:px-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F3D3E] tracking-tight">
                Deploy &amp; Share
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
                  {deployment ? 'Your AI assistant is ready!' : 'Ready to create your assistant?'}
                </h2>
                {deployment?.isSample && <SampleDataBadge />}
              </div>
              <p className="text-xs sm:text-sm text-[#1F8A84] mt-1">
                {deployment
                  ? 'Your assistant has been created and is ready to test.'
                  : 'Create your assistant to unlock your share link, website widget, and phone options.'}
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
              <div>
                <h2 className="text-xl font-extrabold text-[#0F3D3E] mb-4 tracking-tight">
                  Share Your Assistant
                </h2>

                {/* Primary Card with Assistant Identity, Details & Instant Link */}
                <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#1F8A84]/25 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0F3D3E] to-[#1F8A84] text-white flex items-center justify-center text-base font-extrabold shadow-2xs shrink-0 tracking-wider">
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base sm:text-lg font-bold text-[#0F3D3E]">
                            {config.name}
                          </h3>
                          <span className="text-[10px] font-bold text-[#1F8A84] uppercase tracking-wider bg-[#E8F1EF] px-2.5 py-0.5 rounded-full border border-[#1F8A84]/20 shrink-0">
                            Active Link
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Share this link with customers or clients for instant browser voice calls with {config.name}.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Assistant Spec Summary Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 mb-4 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                        Languages
                      </span>
                      <span className="font-semibold text-[#0F3D3E]">
                        {config.languages?.join(', ') || 'English, Hindi'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                        Assigned Voice
                      </span>
                      <span className="font-semibold text-[#0F3D3E]">
                        {config.voiceName || 'Rachel (Default)'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                        Target Service
                      </span>
                      <span
                        className="font-semibold text-[#0F3D3E] truncate block"
                        title={config.knowledge?.services?.[0] || config.knowledge?.business_type || config.goals?.[0] || 'General Services'}
                      >
                        {config.knowledge?.services?.[0] || config.knowledge?.business_type || config.goals?.[0] || 'General Services'}
                      </span>
                    </div>
                  </div>

                  {/* Public Link Box */}
                  <div className="flex items-center space-x-2 p-3 rounded-xl bg-gray-50 border border-gray-200 font-mono text-xs text-[#0F3D3E] break-all select-all mb-4">
                    <span className="text-gray-400">🔗</span>
                    <span>{shareUrl}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs font-bold transition-colors flex items-center justify-center space-x-2 shadow-xs"
                    >
                      <span>{copiedLink ? '✓ Link copied!' : '📋 Copy Link'}</span>
                    </button>
                    <Link
                      href={`/agent/${deployment.agentId}`}
                      target="_blank"
                      className="w-full sm:w-auto py-2.5 px-6 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold text-center block transition-colors shadow-2xs"
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

              {/* Deployment Channels (Website Widget & Telecom Phone Cards) */}
              <div>
                <h3 className="text-lg font-bold text-[#0F3D3E] mb-3">
                  Integration Channels &amp; Embed Options
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card 1: Website Embed Widget */}
                  <div className="bg-white p-6 rounded-2xl border border-[#1F8A84]/25 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#E8F1EF] text-[#0F3D3E] flex items-center justify-center text-lg font-bold">
                          💻
                        </div>
                        <span className="text-[11px] font-bold text-[#1F8A84] uppercase tracking-wider bg-[#E8F1EF] px-2.5 py-0.5 rounded-full border border-[#1F8A84]/20">
                          Embed Widget
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-[#0F3D3E] mb-1">
                        Website Embed Widget
                      </h4>
                      <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                        Embed this interactive voice assistant directly onto your business homepage or web app.
                      </p>

                      <div className="mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-tight">
                        <strong>Embed snippet:</strong> {deployment.isSample ? 'Sample snippet. The real widget code will use your ElevenLabs agent ID once connected.' : 'Live widget code ready for your website.'}
                      </div>

                      <pre className="p-2.5 rounded-lg bg-gray-900 text-emerald-400 font-mono text-[10px] overflow-x-auto max-h-36 mb-4 whitespace-pre-wrap select-all">
                        {widgetSnippet}
                      </pre>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={handleCopySnippet}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                      >
                        <span>{copiedSnippet ? '✓ Snippet copied!' : '📋 Copy widget code'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Telecom Phone Line Integration */}
                  <div className="bg-white p-6 rounded-2xl border border-[#1F8A84]/25 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#E8F1EF] text-[#0F3D3E] flex items-center justify-center text-lg font-bold">
                          📞
                        </div>
                        <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          Inbound Phone
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-[#0F3D3E] mb-1">
                        Phone Line Integration
                      </h4>
                      <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                        Connect a dedicated telecom phone number for 24/7 inbound voice phone calls.
                      </p>

                      <div className="p-3 rounded-xl bg-[#E8F1EF]/60 border border-[#1F8A84]/25 text-center mb-3">
                        <div className="text-base font-extrabold text-[#0F3D3E] tracking-wider font-mono">
                          +1 (555) 019-8432
                        </div>
                        <span className="inline-block mt-1 text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          Sample, not a real number
                        </span>
                      </div>

                      <div className="space-y-1.5 mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F8A84] block">
                          How inbound calls work:
                        </span>
                        <ol className="text-xs text-gray-700 space-y-1 pl-4 list-decimal">
                          <li>
                            <strong>Assign phone number:</strong> Link a Twilio or ElevenLabs telecom line.
                          </li>
                          <li>
                            <strong>Route audio:</strong> Inbound calls stream voice directly to the AI engine.
                          </li>
                          <li>
                            <strong>Automate &amp; transfer:</strong> Assistant resolves inquiries or transfers to staff.
                          </li>
                        </ol>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <div className="p-2 rounded-lg bg-[#E8F1EF] border border-[#1F8A84]/25 text-[11px] text-[#0F3D3E] font-medium text-center">
                        Live telephony connects via Twilio or SIP trunk credentials
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bulk Outbound Calling Campaign */}
              <div className="mt-8">
                <BulkCampaignPanel />
              </div>

              {/* Deployment Readiness Checklist */}
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
                          {config.name} ({config.languages?.join(', ') || 'English, Hindi'}) with AI disclosure and guardrails.
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
                          Snippet placeholder generated with active agent ID. Ready for embedding.
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300 shrink-0">
                      Snippet ready
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
                        Receive confirmed appointment bookings from your voice assistant into your calendar or CRM.
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
                        Active Webhook Target URL
                      </label>
                      <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 font-mono text-xs text-[#0F3D3E] break-all select-all">
                        {config.bookingWebhookUrl && config.bookingWebhookUrl.trim().startsWith('http')
                          ? config.bookingWebhookUrl.trim()
                          : `${origin}/api/webhooks/booking`}
                      </div>
                      {config.bookingWebhookUrl && (
                        <p className="text-[11px] text-emerald-800 mt-1 font-semibold">
                          ✓ Confirmed bookings forward directly to your Zapier / Google Calendar / CRM webhook.
                        </p>
                      )}
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
