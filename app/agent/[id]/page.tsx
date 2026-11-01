'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ConversationProvider } from '@elevenlabs/react';
import HumanizedAssistantView from '@/components/HumanizedAssistantView';
import EmbeddedWidgetView from '@/components/EmbeddedWidgetView';
import { AgentConfig, AgentDeployment, isValidAgentConfig } from '@/lib/types';
import { isMatchingAgentName } from '@/lib/sync';

const DEPLOYMENT_STORAGE_KEY = 'voiceforge:deployment';
const AGENT_STORAGE_KEY = 'voiceforge:agent';

export default function PublicAgentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const isEmbed = searchParams?.get('embed') === 'true';
  const agentId = typeof params?.id === 'string' ? params.id : '';

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [deployment, setDeployment] = useState<AgentDeployment | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    async function loadAgent() {
      if (!agentId) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      // 1. Try local storage for fast instant load
      try {
        if (typeof window !== 'undefined') {
          const storedAgent = window.localStorage.getItem(AGENT_STORAGE_KEY);
          if (storedAgent) {
            const parsedAgent = JSON.parse(storedAgent);
            const storedDeployment = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
            let parsedDeployment: AgentDeployment | null = null;
            if (storedDeployment) {
              try {
                parsedDeployment = JSON.parse(storedDeployment);
              } catch {}
            }

            // Match if agentId matches deployment or config, or URL is generic/active
            const isMatch =
              (parsedDeployment && parsedDeployment.agentId === agentId) ||
              (parsedAgent.agentId && parsedAgent.agentId === agentId) ||
              agentId === 'latest' ||
              agentId === 'current' ||
              agentId === 'preview' ||
              (parsedDeployment && isMatchingAgentName(parsedDeployment.name, parsedAgent.name));

            if (isMatch) {
              setDeployment(
                parsedDeployment || {
                  agentId,
                  name: parsedAgent.name,
                  createdAt: new Date().toISOString(),
                  isSample: false,
                }
              );
              setConfig(parsedAgent);
              setIsLoading(false);
              return;
            }
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

      // 3. Fallback to active localStorage draft agent if available
      try {
        const storedAgent = window.localStorage.getItem(AGENT_STORAGE_KEY);
        if (storedAgent) {
          const parsed = JSON.parse(storedAgent);
          if (isValidAgentConfig(parsed)) {
            setConfig(parsed);
            setDeployment({
              agentId: agentId || 'assistant',
              name: parsed.name,
              createdAt: new Date().toISOString(),
              isSample: false,
            });
            setIsLoading(false);
            return;
          }
        }
      } catch {}

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

  if (isEmbed) {
    return (
      <ConversationProvider>
        <EmbeddedWidgetView
          agentId={deployment?.agentId || agentId}
          config={config}
          deployment={deployment}
        />
      </ConversationProvider>
    );
  }

  return (
    <ConversationProvider>
      <HumanizedAssistantView
        agentId={deployment?.agentId || agentId}
        config={config}
        deployment={deployment}
        isEmbed={isEmbed}
      />
    </ConversationProvider>
  );
}
