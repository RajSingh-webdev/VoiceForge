'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import SampleDataBadge from '@/components/SampleDataBadge';
import { AgentConfig, AgentDeployment, isValidAgentConfig } from '@/lib/types';
import { getDeploymentsMap, isMatchingAgentName } from '@/lib/sync';

const DEPLOYMENT_STORAGE_KEY = 'voiceforge:deployment';
const AGENT_STORAGE_KEY = 'voiceforge:agent';

function PublicCallWidget({
  agentId,
  agentName,
  isSample,
}: {
  agentId: string;
  agentName: string;
  isSample: boolean;
}) {
  const [callActive, setCallActive] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      setCallActive(true);
      setIsStarting(false);
      setCallError(null);
      setCallDuration(0);
      durationTimerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    },
    onDisconnect: () => {
      setCallActive(false);
      setIsStarting(false);
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    },
    onError: (err: any) => {
      setIsStarting(false);
      setCallError(typeof err === 'string' ? err : err?.message || 'Voice connection error');
    },
  });

  const handleStartCall = async () => {
    setIsStarting(true);
    setCallError(null);

    try {
      // Obtain signed websocket URL from server
      const res = await fetch(`/api/voice/session?agent_id=${encodeURIComponent(agentId)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start voice call session.');
      }

      if (data.signedUrl) {
        await conversation.startSession({ signedUrl: data.signedUrl });
      } else {
        // Fallback or mock session simulation
        setCallActive(true);
        setIsStarting(false);
        setCallDuration(0);
        durationTimerRef.current = setInterval(() => {
          setCallDuration((d) => d + 1);
        }, 1000);
      }
    } catch (err: any) {
      setIsStarting(false);
      setCallError(err.message || 'Unable to connect call.');
    }
  };

  const handleEndCall = async () => {
    try {
      await conversation.endSession();
    } catch {
      // Fallback
    } finally {
      setCallActive(false);
      setIsStarting(false);
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="pt-2 text-center space-y-3">
      {callError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
          {callError}
        </div>
      )}

      {callActive ? (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Call in progress</span>
            </span>
            <span>{formatTimer(callDuration)}</span>
          </div>

          <div className="flex items-center justify-center space-x-2 py-2">
            <div
              className={`w-3 h-8 rounded-full ${
                conversation.isSpeaking ? 'bg-[#1F8A84] animate-bounce' : 'bg-gray-300'
              }`}
            ></div>
            <div
              className={`w-3 h-12 rounded-full ${
                conversation.isSpeaking ? 'bg-[#1F8A84] animate-pulse' : 'bg-gray-300'
              }`}
            ></div>
            <div
              className={`w-3 h-6 rounded-full ${
                conversation.isSpeaking ? 'bg-[#1F8A84] animate-bounce' : 'bg-gray-300'
              }`}
            ></div>
          </div>
          <p className="text-xs text-[#0F3D3E] font-medium">
            {conversation.isSpeaking ? `${agentName} is speaking...` : 'Listening to you...'}
          </p>

          <button
            type="button"
            onClick={handleEndCall}
            className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-2"
          >
            <span>📞</span>
            <span>End Call</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleStartCall}
          disabled={isStarting}
          className="w-full py-3.5 px-6 rounded-2xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white font-bold text-sm sm:text-base transition-colors flex items-center justify-center space-x-2 shadow-md disabled:opacity-50"
        >
          {isStarting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Connecting voice line...</span>
            </>
          ) : (
            <>
              <span>🎙️</span>
              <span>Talk to {agentName}</span>
            </>
          )}
        </button>
      )}

      {isSample && (
        <p className="text-[11px] text-gray-500">
          Sample agent preview mode. Microphones and browser audio supported.
        </p>
      )}
    </div>
  );
}

export default function PublicAgentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const isEmbed = searchParams?.get('embed') === 'true';
  const agentId = typeof params?.id === 'string' ? params.id : '';

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [deployment, setDeployment] = useState<AgentDeployment | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    async function loadAgent() {
      setIsLoading(true);
      setNotFound(false);

      // 1. Try local storage first
      try {
        const map = getDeploymentsMap();
        for (const dep of Object.values(map)) {
          if (dep && dep.agentId === agentId) {
            setDeployment(dep);
            break;
          }
        }

        const storedDeployment = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
        const storedAgent = window.localStorage.getItem(AGENT_STORAGE_KEY);

        if (storedDeployment && storedAgent) {
          const parsedDeployment: AgentDeployment = JSON.parse(storedDeployment);
          const parsedAgent = JSON.parse(storedAgent);

          if (
            parsedDeployment.agentId === agentId &&
            isValidAgentConfig(parsedAgent) &&
            isMatchingAgentName(parsedDeployment.name, parsedAgent.name)
          ) {
            setDeployment(parsedDeployment);
            setConfig(parsedAgent);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to cross-device fetch
      }

      // 2. Cross-device server fetch: query backend for agent configuration
      try {
        const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.found && data?.agent) {
            const rawAgent = data.agent;
            let reconstructedConfig: AgentConfig;

            if (rawAgent.config && isValidAgentConfig(rawAgent.config)) {
              reconstructedConfig = rawAgent.config;
            } else {
              const convConfig = rawAgent.conversationConfig || {};
              const agentPrompt = convConfig.agent?.prompt?.prompt || '';
              const welcomeMsg = convConfig.agent?.first_message || `Hello! I am ${rawAgent.name}.`;
              const primaryLang = convConfig.agent?.language === 'en' ? 'English' : convConfig.agent?.language || 'English';
              const languages = [primaryLang];
              if (convConfig.language_presets?.hi) {
                languages.push('Hindi');
              }

              reconstructedConfig = {
                name: rawAgent.name || 'Voice Assistant',
                persona: agentPrompt.slice(0, 150) || `AI Assistant for ${rawAgent.name}`,
                goals: ['Assist callers with verified business information', 'Answer inquiries and schedule appointments'],
                flowSteps: [],
                welcomeMessage: welcomeMsg,
                languages,
                voiceSuggestion: 'Professional AI Voice',
                voiceId: convConfig.tts?.voice_id,
                guardrails: ['Disclose AI identity', 'Route emergencies to human staff'],
                tools: [],
              };
            }

            const newDeployment: AgentDeployment = {
              agentId: rawAgent.agentId || agentId,
              name: rawAgent.name || 'Voice Assistant',
              createdAt: new Date().toISOString(),
              isSample: rawAgent.isSample === true,
            };

            setConfig(reconstructedConfig);
            setDeployment(newDeployment);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Fallback
      }

      // Not found
      setNotFound(true);
      setIsLoading(false);
    }

    loadAgent();
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
            Agent Not Found
          </h1>
          <p className="text-xs text-gray-600 mb-6 leading-relaxed">
            The requested voice assistant is unavailable or has been removed. Check the URL or launch your agent from the deployment dashboard.
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
    <ConversationProvider>
      <div
        className={`min-h-screen bg-[#F8FAF9] flex flex-col items-center justify-center ${
          isEmbed ? 'p-2' : 'py-10 px-4'
        }`}
      >
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

            {/* Real Voice Call Action */}
            <PublicCallWidget
              agentId={deployment?.agentId || agentId}
              agentName={config.name}
              isSample={deployment?.isSample === true}
            />

            {/* Back to builder link (omitted in embed mode) */}
            {!isEmbed && (
              <div className="text-center pt-2 border-t border-gray-100">
                <Link
                  href="/deploy"
                  className="text-xs font-bold text-[#1F8A84] hover:text-[#0F3D3E] underline"
                >
                  &larr; Back to VoiceForge Deployment
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </ConversationProvider>
  );
}
