'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import SampleDataBadge from '@/components/SampleDataBadge';
import KrishiAssistantView from '@/components/krishi/KrishiAssistantView';
import HumanizedAssistantView from '@/components/HumanizedAssistantView';
import { AgentConfig, AgentDeployment, isValidAgentConfig } from '@/lib/types';
import { getDeploymentsMap, isMatchingAgentName } from '@/lib/sync';

const DEPLOYMENT_STORAGE_KEY = 'voiceforge:deployment';
const AGENT_STORAGE_KEY = 'voiceforge:agent';

const KRISHI_DEFAULT_CONFIG: AgentConfig = {
  name: 'Krishi Seva Kendra',
  persona: 'आप कृषि सेवा केंद्र के समर्पित, विनम्र और धैर्यवान सहायक हैं। आप किसानों को सरल, स्पष्ट और व्यावहारिक हिंदी में सलाह देते हैं।',
  goals: [
    'किसानों को मिट्टी की जाँच, मौसम और सरकारी योजनाओं की सही जानकारी देना',
    'कॉल करने वाले किसानों की समस्याओं को धैर्य से सुनना और समाधान सुझाना',
    'ज़रूरत पड़ने पर कॉल को तुरंत मानव कृषि अधिकारी को स्थानांतरित करना',
  ],
  flowSteps: [
    { title: 'स्वागत', instruction: 'नमस्ते! मैं कृषि सेवा केंद्र का AI सहायक हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?' },
    { title: 'समस्या की पहचान', instruction: 'किसान से उनकी फसल, ज़मीन या समस्या के बारे में विस्तार से पूछें।' },
    { title: 'मार्गदर्शन या समाधान', instruction: 'सटीक और सत्यापित कृषि सलाह दें।' },
    { title: 'समापन या अधिकारी ट्रांसफर', instruction: 'संतुष्टि पूछें और ज़रूरत होने पर कृषि अधिकारी से कनेक्ट करें।' },
  ],
  welcomeMessage: 'Namaste! Welcome to Krishi Seva Kendra. How can I help you with your farming or crops today?',
  welcomeMessageHindi: 'नमस्ते! मैं कृषि सेवा केंद्र का AI सहायक हूँ। खेती, मौसम या मिट्टी की जाँच से जुड़ी क्या जानकारी चाहिए?',
  languages: ['Hindi', 'English'],
  voiceSuggestion: 'Ritu Rathore — Natural Indian Hindi',
  voiceId: 'fTfuemKGBjYqG4ni4gw3',
  guardrails: [
    'यह हमेशा स्पष्ट करें कि आप एक AI सहायक हैं।',
    'कभी भी बिना सत्यापन वाली सरकारी योजनाओं या कीटनाशकों की गलत जानकारी न दें।',
    'गंभीर या आपातकालीन कृषि समस्याओं के लिए किसान को कृषि अधिकारी से संपर्क करने को कहें।',
  ],
  tools: [
    {
      name: 'मिट्टी जाँच अपॉइंटमेंट',
      purpose: 'Record and confirm soil testing requests for local agricultural laboratories.',
      status: 'Ready',
    },
    {
      name: 'कृषि अधिकारी संपर्क',
      purpose: 'Connect caller to human agricultural extension officer.',
      status: 'Ready',
    },
  ],
};


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

        if (storedAgent) {
          const parsedAgent = JSON.parse(storedAgent);
          if (isValidAgentConfig(parsedAgent)) {
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

      // 3. Fallback for Krishi Seva Kendra demo / direct routes
      if (
        agentId === 'krishi' ||
        agentId === 'krishi-seva-kendra' ||
        agentId === 'rural-helpline' ||
        agentId.toLowerCase().includes('krishi')
      ) {
        setConfig(KRISHI_DEFAULT_CONFIG);
        setDeployment({
          agentId: agentId || 'krishi-seva-kendra',
          name: 'Krishi Seva Kendra',
          createdAt: new Date().toISOString(),
          isSample: false,
        });
        setIsLoading(false);
        return;
      }

      // 4. Fallback to active localStorage draft agent if available
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

  const isKrishi =
    agentId === 'krishi' ||
    agentId === 'krishi-seva-kendra' ||
    agentId.toLowerCase().includes('krishi') ||
    (config?.name && (
      config.name.toLowerCase().includes('krishi') ||
      config.name.toLowerCase().includes('agricultural') ||
      config.name.toLowerCase().includes('kendra') ||
      config.name.toLowerCase().includes('kisan') ||
      config.name.toLowerCase().includes('rural')
    ));

  if (isKrishi) {
    return (
      <ConversationProvider>
        <KrishiAssistantView
          agentId={deployment?.agentId || agentId}
          config={config}
          deployment={deployment}
          isEmbed={isEmbed}
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
