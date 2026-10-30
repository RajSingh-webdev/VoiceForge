'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AgentConfig,
  FlowStep,
  ProposedTool,
  ExtractedFacts,
  ExtractedPrice,
  ExtractedFaq,
} from '@/lib/types';
import { useAgentConfig } from '@/lib/useAgentConfig';
import {
  normalizeAgentTools,
  getBookingToolStatus,
  isHumanTransferTool,
  isAppointmentBookingTool,
} from '@/lib/tools';

interface Template {
  id: string;
  title: string;
  description: string;
  promptText: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'lead-generation',
    title: 'Lead Generation',
    description: 'Identify potential customers, understand their needs, and collect relevant contact details with consent.',
    promptText:
      'Create a friendly sales assistant for our software company. It introduces our products, asks qualifying questions to understand customer needs, collects their name and email for a demo with consent, and routes enterprise inquiries to human sales representatives.',
  },
  {
    id: 'appointments',
    title: 'Appointments',
    description: 'Help users with appointment enquiries, collect their preferred times, and explain the next steps.',
    promptText:
      'Create a helpful receptionist for our medical clinic. It answers questions about available services, checks preferred appointment dates and times, collects patient contact details, and explains what to bring to their visit.',
  },
  {
    id: 'support',
    title: 'Support',
    description: 'Answer customer questions using provided information and escalate unresolved issues.',
    promptText:
      'Create a patient customer support assistant for an e-commerce store. It answers common questions about order tracking, return policies, and shipping times, and connects callers to a human agent if an issue cannot be resolved.',
  },
  {
    id: 'negotiation',
    title: 'Negotiation',
    description: 'Help conduct structured negotiations within explicitly defined limits and escalate when necessary.',
    promptText:
      'Create a professional negotiation assistant for commercial equipment leases. It discusses standard contract options, offers approved discounts within pre-set limits, and transfers clients to a senior manager for customized terms.',
  },
  {
    id: 'collections',
    title: 'Collections',
    description: 'Handle payment-related enquiries respectfully, explain verified payment information, and direct users to an appropriate human when needed.',
    promptText:
      'Create a respectful billing assistant for accounts receivable. It verifies caller identity securely, explains outstanding balance details, shares verified payment options, and directs callers to a human financial counselor when needed.',
  },
  {
    id: 'rural-helpline',
    title: 'Rural Community Helpline (Hindi-First)',
    description: 'Provide verified agricultural center hours and local helpline guidance in clear Hindi and English, with human escalation.',
    promptText:
      'Create an accessible, Hindi-first rural community information assistant for the Krishi Seva Kendra (Agricultural Service Center). It warmly introduces itself in Hindi as an AI assistant (नमस्ते! मैं कृषि सेवा केंद्र का AI सहायक हूँ।), shares verified center hours (Monday to Saturday, 9am to 5pm) and contact details, assists callers with soil-testing appointment requests, and immediately connects urgent farming or weather inquiries to a human officer at the center. It never invents government schemes or unverified guidelines.',
  },
];

const MAX_CHAR_COUNT = 10000;

const WRITE_VOICE_OPTIONS = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Default)', label: 'Rachel — Warm & Friendly (Recommended)', isHindi: false },
  { id: 'fTfuemKGBjYqG4ni4gw3', name: 'Ritu Rathore — Natural Indian Hindi (Receptionist)', label: '🇮🇳 Ritu Rathore — Natural Indian Hindi (Receptionist)', isHindi: true },
  { id: 'qdykssD3wAUvtIw9wG8N', name: 'Sandeep — Natural Indian Hindi', label: '🇮🇳 Sandeep — Natural Indian Hindi', isHindi: true },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah — Professional & Calm', label: 'Sarah — Professional & Calm', isHindi: false },
  { id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew — Conversational & Clear', label: 'Drew — Conversational & Clear', isHindi: false },
];

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

function checkHindiAiDisclosure(text: string): boolean {
  const lower = (text || '').toLowerCase();
  return (
    /\bai\b/.test(lower) ||
    lower.includes('एआई') ||
    lower.includes('आर्टिफिशियल इंटेलिजेंस') ||
    lower.includes('virtual assistant') ||
    lower.includes('सहायक') ||
    lower.includes('assistant') ||
    /\bbot\b/.test(lower) ||
    lower.includes('बॉट')
  );
}

function moveItem<T>(arr: T[], index: number, direction: 'up' | 'down'): T[] {
  const newArr = [...arr];
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= newArr.length) return arr;
  const temp = newArr[index];
  newArr[index] = newArr[targetIndex];
  newArr[targetIndex] = temp;
  return newArr;
}

export default function WritePage() {
  const { config, setConfig, clearConfig, isLoaded } = useAgentConfig();
  const [description, setDescription] = useState<string>('');
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Website extraction state
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedFacts, setExtractedFacts] = useState<ExtractedFacts | null>(null);

  // Document upload state
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);



  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    setDocUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload document.');
      }

      if (data.document && config) {
        const currentDocs = config.knowledgeBaseDocuments || [];
        setConfig({
          ...config,
          knowledgeBaseDocuments: [...currentDocs, data.document],
        });
      }
    } catch (err: any) {
      setDocUploadError(err.message || 'Error uploading document.');
    } finally {
      setIsUploadingDoc(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveDoc = async (docId: string) => {
    if (!config) return;
    try {
      await fetch('/api/knowledge/upload?id=' + encodeURIComponent(docId), { method: 'DELETE' });
    } catch {
      // Fallback
    }
    const currentDocs = config.knowledgeBaseDocuments || [];
    setConfig({
      ...config,
      knowledgeBaseDocuments: currentDocs.filter((d) => d.id !== docId),
    });
  };

  const charCount = description.length;
  const isTooLong = charCount > MAX_CHAR_COUNT;
  const isEmpty = description.trim().length === 0;
  const isSubmitDisabled = isEmpty || isTooLong || isLoading;

  const handleSelectTemplate = (template: Template) => {
    setDescription(template.promptText);
    setActiveTemplateId(template.id);
    setErrorMessage(null);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    setActiveTemplateId(null);
    if (errorMessage) setErrorMessage(null);
  };

  // Website Extraction Handler
  const handleReadWebsite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = websiteUrl.trim();
    if (!cleanUrl || isExtracting) return;

    setIsExtracting(true);
    setExtractError(null);

    try {
      const res = await fetch('/api/site/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Rate limit reached. Please wait a few moments before trying again.');
        }
        throw new Error(data.error || 'Failed to read information from this website.');
      }

      if (!data.facts) {
        throw new Error('No facts could be extracted from this website.');
      }

      setExtractedFacts(data.facts);

      // Pre-populate description if empty
      if (!description.trim()) {
        const nameStr = data.facts.business_name || 'our business';
        const typeStr = data.facts.business_type ? ` (${data.facts.business_type})` : '';
        setDescription(`Create a helpful and professional voice assistant for ${nameStr}${typeStr} based on our verified website details.`);
      }
    } catch (err: any) {
      setExtractError(err.message || 'An error occurred while reading the website.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Generation Handler (supports optional confirmed facts)
  const handleGenerate = async (customFacts?: ExtractedFacts) => {
    const factsToUse = customFacts || extractedFacts || undefined;
    let desc = description.trim();

    // If description is empty but facts exist, create a baseline
    if (!desc && factsToUse) {
      const nameStr = factsToUse.business_name || 'our business';
      desc = `Create a helpful and professional voice assistant for ${nameStr} based on our website details.`;
      setDescription(desc);
    }

    if (!desc || desc.length > MAX_CHAR_COUNT || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: desc,
          facts: factsToUse,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Rate limit reached. Please wait a moment and try again.');
        }
        throw new Error(data.error || 'Failed to generate assistant configuration.');
      }

      if (!data.config) {
        throw new Error('No configuration was returned by the server.');
      }

      let generatedConfig = data.config;

      // When config includes Hindi, provide immediate AI-disclosed default so UI displays immediately
      if (
        generatedConfig.languages?.some(
          (l: string) => (l || '').toLowerCase().includes('hindi') || (l || '').toLowerCase() === 'hi'
        ) &&
        !generatedConfig.welcomeMessageHindi
      ) {
        generatedConfig = {
          ...generatedConfig,
          welcomeMessageHindi: `नमस्ते! मैं ${generatedConfig.name || 'क्लिनिक'} का AI सहायक हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?`,
        };
      }

      setConfig(generatedConfig);

      // Asynchronously refine the Hindi greeting using callLLM in background
      if (
        data.config.languages?.some(
          (l: string) => (l || '').toLowerCase().includes('hindi') || (l || '').toLowerCase() === 'hi'
        ) &&
        !data.config.welcomeMessageHindi
      ) {
        fetch('/api/agents/hindi-welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            welcomeMessage: data.config.welcomeMessage,
            name: data.config.name,
          }),
        })
          .then((r) => r.json())
          .then((hData) => {
            if (hData && typeof hData.welcomeMessageHindi === 'string' && hData.welcomeMessageHindi.trim()) {
              setConfig((prev) =>
                prev ? { ...prev, welcomeMessageHindi: hData.welcomeMessageHindi.trim() } : prev
              );
            }
          })
          .catch(() => {});
      }

      setTimeout(() => {
        const el = document.getElementById('generated-configuration-panel');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Are you sure you want to create a new assistant? This will clear your current draft configuration.'
      );
      if (confirmed) {
        clearConfig();
        setDescription('');
        setActiveTemplateId(null);
        setErrorMessage(null);
        setWebsiteUrl('');
        setExtractedFacts(null);
        setExtractError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };


  // Auto-normalize tools and capability mapping on load
  React.useEffect(() => {
    if (!isLoaded || !config) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const normalized = normalizeAgentTools(config, origin);
    const hasChanged =
      JSON.stringify(normalized.tools) !== JSON.stringify(config.tools) ||
      normalized.guardrails.length !== config.guardrails.length;
    if (hasChanged) {
      setConfig(normalized);
    }
  }, [isLoaded, config, setConfig]);

  // Updaters for extracted facts panel
  const updateFactField = <K extends keyof ExtractedFacts>(field: K, val: ExtractedFacts[K]) => {
    if (!extractedFacts) return;
    setExtractedFacts({ ...extractedFacts, [field]: val });
  };

  const addFactService = () => {
    if (!extractedFacts) return;
    setExtractedFacts({ ...extractedFacts, services: [...extractedFacts.services, ''] });
  };

  const removeFactService = (idx: number) => {
    if (!extractedFacts) return;
    setExtractedFacts({
      ...extractedFacts,
      services: extractedFacts.services.filter((_, i) => i !== idx),
    });
  };

  const updateFactService = (idx: number, val: string) => {
    if (!extractedFacts) return;
    const updated = [...extractedFacts.services];
    updated[idx] = val;
    setExtractedFacts({ ...extractedFacts, services: updated });
  };

  const addFactPrice = () => {
    if (!extractedFacts) return;
    setExtractedFacts({
      ...extractedFacts,
      prices: [...extractedFacts.prices, { item: '', price: '' }],
    });
  };

  const removeFactPrice = (idx: number) => {
    if (!extractedFacts) return;
    setExtractedFacts({
      ...extractedFacts,
      prices: extractedFacts.prices.filter((_, i) => i !== idx),
    });
  };

  const updateFactPrice = (idx: number, key: keyof ExtractedPrice, val: string) => {
    if (!extractedFacts) return;
    const updated = [...extractedFacts.prices];
    updated[idx] = { ...updated[idx], [key]: val };
    setExtractedFacts({ ...extractedFacts, prices: updated });
  };

  const addFactFaq = () => {
    if (!extractedFacts) return;
    setExtractedFacts({
      ...extractedFacts,
      faqs: [...extractedFacts.faqs, { question: '', answer: '' }],
    });
  };

  const removeFactFaq = (idx: number) => {
    if (!extractedFacts) return;
    setExtractedFacts({
      ...extractedFacts,
      faqs: extractedFacts.faqs.filter((_, i) => i !== idx),
    });
  };

  const updateFactFaq = (idx: number, key: keyof ExtractedFaq, val: string) => {
    if (!extractedFacts) return;
    const updated = [...extractedFacts.faqs];
    updated[idx] = { ...updated[idx], [key]: val };
    setExtractedFacts({ ...extractedFacts, faqs: updated });
  };

  // Updaters for generated config fields
  const updateConfigFields = (updates: Partial<AgentConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const updateConfigField = <K extends keyof AgentConfig>(field: K, value: AgentConfig[K]) => {
    setConfig((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  // Goals operations
  const updateGoal = (index: number, val: string) => {
    if (!config) return;
    const newGoals = [...config.goals];
    newGoals[index] = val;
    setConfig({ ...config, goals: newGoals });
  };

  const addGoal = () => {
    if (!config) return;
    setConfig({ ...config, goals: [...config.goals, ''] });
  };

  const removeGoal = (index: number) => {
    if (!config) return;
    setConfig({ ...config, goals: config.goals.filter((_, i) => i !== index) });
  };

  const moveGoal = (index: number, direction: 'up' | 'down') => {
    if (!config) return;
    setConfig({ ...config, goals: moveItem(config.goals, index, direction) });
  };

  // Flow steps operations
  const updateFlowStep = (index: number, key: keyof FlowStep, val: string) => {
    if (!config) return;
    const newSteps = [...config.flowSteps];
    newSteps[index] = { ...newSteps[index], [key]: val };
    setConfig({ ...config, flowSteps: newSteps });
  };

  const addFlowStep = () => {
    if (!config) return;
    setConfig({
      ...config,
      flowSteps: [
        ...config.flowSteps,
        {
          title: `Step ${config.flowSteps.length + 1}`,
          instruction: 'Describe what the assistant should do in this step.',
        },
      ],
    });
  };

  const removeFlowStep = (index: number) => {
    if (!config) return;
    setConfig({ ...config, flowSteps: config.flowSteps.filter((_, i) => i !== index) });
  };

  const moveFlowStep = (index: number, direction: 'up' | 'down') => {
    if (!config) return;
    setConfig({ ...config, flowSteps: moveItem(config.flowSteps, index, direction) });
  };

  // Guardrails operations
  const updateGuardrail = (index: number, val: string) => {
    if (!config) return;
    const newGuardrails = [...config.guardrails];
    newGuardrails[index] = val;
    setConfig({ ...config, guardrails: newGuardrails });
  };

  const addGuardrail = () => {
    if (!config) return;
    setConfig({ ...config, guardrails: [...config.guardrails, ''] });
  };

  const removeGuardrail = (index: number) => {
    if (!config) return;
    setConfig({ ...config, guardrails: config.guardrails.filter((_, i) => i !== index) });
  };

  const moveGuardrail = (index: number, direction: 'up' | 'down') => {
    if (!config) return;
    setConfig({ ...config, guardrails: moveItem(config.guardrails, index, direction) });
  };

  // Tools operations
  const updateTool = (index: number, key: keyof ProposedTool, val: string) => {
    if (!config) return;
    const newTools = [...config.tools];
    newTools[index] = { ...newTools[index], [key]: val };
    setConfig({ ...config, tools: newTools });
  };

  const addTool = () => {
    if (!config) return;
    setConfig({
      ...config,
      tools: [
        ...config.tools,
        {
          name: 'New Tool',
          purpose: 'Describe what this tool helps with.',
          status: 'Proposed — integration not connected',
        },
      ],
    });
  };

  const removeTool = (index: number) => {
    if (!config) return;
    const targetTool = config.tools[index];
    if (
      targetTool &&
      (isHumanTransferTool(targetTool.name, targetTool.purpose) ||
        isAppointmentBookingTool(targetTool.name, targetTool.purpose))
    ) {
      // Core built-in capabilities are permanent and cannot be removed
      return;
    }
    setConfig({ ...config, tools: config.tools.filter((_, i) => i !== index) });
  };

  const moveTool = (index: number, direction: 'up' | 'down') => {
    if (!config) return;
    setConfig({ ...config, tools: moveItem(config.tools, index, direction) });
  };

  return (
    <div className="w-full max-w-5xl mx-auto text-left py-6 px-4 sm:px-6">
      {/* Header section */}
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F3D3E] tracking-tight">
          Create your AI assistant
        </h1>
        <p className="mt-2 text-lg text-[#1F8A84] max-w-2xl leading-relaxed">
          Describe what you need in your own words, or provide your website to automatically extract verified business details.
        </p>

        {/* How it works info card */}
        <div className="mt-6 bg-[#E8F1EF] border border-[#1F8A84]/20 rounded-xl p-4 sm:p-5">
          <p className="text-sm font-semibold text-[#0F3D3E] uppercase tracking-wider mb-2">
            How it works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-[#0F3D3E]/90">
            <div className="flex items-start space-x-2">
              <span className="w-6 h-6 rounded-full bg-[#0F3D3E] text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <span><strong>Describe or Link:</strong> Write what you need or paste your website URL.</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-6 h-6 rounded-full bg-[#0F3D3E] text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <span><strong>Extract & Generate:</strong> Gemini creates flow steps, guardrails, and verified facts.</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-6 h-6 rounded-full bg-[#0F3D3E] text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <span><strong>Review:</strong> Customize every detail in your draft setup below.</span>
            </div>
          </div>
        </div>
      </header>

      {/* Website Input Section (Requirement 1) */}
      <section className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm mb-8">
        <h2 className="text-base font-bold text-[#0F3D3E] mb-1">
          Or paste your business website link
        </h2>
        <p className="text-xs text-[#1F8A84] mb-3">
          We&apos;ll securely read your public pages to extract real services, prices, hours, and FAQs.
        </p>
        <form onSubmit={handleReadWebsite} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => {
              setWebsiteUrl(e.target.value);
              if (extractError) setExtractError(null);
            }}
            placeholder="https://example.com"
            className="flex-1 p-3 rounded-xl border border-[#1F8A84]/40 text-sm text-[#0F3D3E] placeholder-[#1F8A84]/50 focus:outline-none focus:ring-2 focus:ring-[#1F8A84]"
            aria-label="Business website link"
          />
          <button
            type="submit"
            disabled={isExtracting || !websiteUrl.trim()}
            className={`px-5 py-3 rounded-xl font-bold text-sm tracking-wide transition-all shrink-0 flex items-center justify-center space-x-2 ${
              isExtracting || !websiteUrl.trim()
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-[#1F8A84] hover:bg-[#0F3D3E] text-white shadow-sm'
            }`}
          >
            {isExtracting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Reading website...</span>
              </>
            ) : (
              <span>Read my website</span>
            )}
          </button>
        </form>

        {/* Website Extraction Error */}
        {extractError && (
          <div
            role="alert"
            className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start justify-between gap-2"
          >
            <span>{extractError}</span>
            <button
              type="button"
              onClick={() => handleReadWebsite()}
              className="text-red-900 font-bold underline shrink-0 hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}
      </section>

      {/* Extracted Facts Editable Panel (Requirements 5 & 6) */}
      {extractedFacts && (
        <section className="bg-[#E8F1EF]/40 border-2 border-[#1F8A84] rounded-2xl p-6 sm:p-7 shadow-md mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-[#1F8A84]/20">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h2 className="text-lg font-extrabold text-[#0F3D3E]">
                  Confirmed Facts from Website
                </h2>
              </div>
              <p className="text-xs text-[#1F8A84] mt-0.5">
                Review and adjust facts extracted from your website before building your assistant.
              </p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setExtractedFacts(null)}
                className="px-3 py-1.5 bg-white text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg text-xs font-semibold"
              >
                Clear facts
              </button>
              <button
                type="button"
                onClick={() => handleGenerate(extractedFacts)}
                disabled={isLoading}
                className="px-4 py-2 bg-[#0F3D3E] hover:bg-[#1F8A84] text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
              >
                Use this to build my assistant &rarr;
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {/* Business Name & Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={extractedFacts.business_name || ''}
                  onChange={(e) => updateFactField('business_name', e.target.value)}
                  placeholder="e.g. Acme Dental"
                  className="w-full p-2.5 rounded-lg border border-[#1F8A84]/30 bg-white text-xs text-[#0F3D3E] font-semibold focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
                  Business Type
                </label>
                <input
                  type="text"
                  value={extractedFacts.business_type || ''}
                  onChange={(e) => updateFactField('business_type', e.target.value)}
                  placeholder="e.g. Dental Clinic"
                  className="w-full p-2.5 rounded-lg border border-[#1F8A84]/30 bg-white text-xs text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                />
              </div>
            </div>

            {/* Opening Hours & Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
                  Opening Hours
                </label>
                <input
                  type="text"
                  value={extractedFacts.opening_hours || ''}
                  onChange={(e) => updateFactField('opening_hours', e.target.value)}
                  placeholder="e.g. Mon-Fri 9am - 5pm"
                  className="w-full p-2.5 rounded-lg border border-[#1F8A84]/30 bg-white text-xs text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
                  Contact Information
                </label>
                <input
                  type="text"
                  value={extractedFacts.contact || ''}
                  onChange={(e) => updateFactField('contact', e.target.value)}
                  placeholder="e.g. (555) 019-2834"
                  className="w-full p-2.5 rounded-lg border border-[#1F8A84]/30 bg-white text-xs text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                />
              </div>
            </div>

            {/* Services List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider">
                  Services
                </label>
                <button
                  type="button"
                  onClick={addFactService}
                  className="px-2.5 py-1 text-xs font-bold bg-white text-[#0F3D3E] hover:bg-[#1F8A84] hover:text-white rounded border border-[#1F8A84]/30 transition-colors"
                >
                  + Add Service
                </button>
              </div>
              <div className="space-y-2">
                {extractedFacts.services.map((srv, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-[#1F8A84] w-5 text-right">{idx + 1}.</span>
                    <input
                      type="text"
                      value={srv}
                      onChange={(e) => updateFactService(idx, e.target.value)}
                      placeholder="Service name"
                      className="flex-1 p-2 rounded-lg border border-[#1F8A84]/30 bg-white text-xs text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeFactService(idx)}
                      aria-label={`Remove service ${idx + 1}`}
                      className="p-1.5 px-2 rounded text-xs text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 font-bold"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {extractedFacts.services.length === 0 && (
                  <p className="text-xs text-gray-500 italic">No services listed on page.</p>
                )}
              </div>
            </div>

            {/* Prices List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider">
                  Verified Prices
                </label>
                <button
                  type="button"
                  onClick={addFactPrice}
                  className="px-2.5 py-1 text-xs font-bold bg-white text-[#0F3D3E] hover:bg-[#1F8A84] hover:text-white rounded border border-[#1F8A84]/30 transition-colors"
                >
                  + Add Price
                </button>
              </div>
              <div className="space-y-2">
                {extractedFacts.prices.map((prc, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={prc.item}
                      onChange={(e) => updateFactPrice(idx, 'item', e.target.value)}
                      placeholder="Item or service"
                      className="flex-2 p-2 rounded-lg border border-[#1F8A84]/30 bg-white text-xs text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                    />
                    <input
                      type="text"
                      value={prc.price}
                      onChange={(e) => updateFactPrice(idx, 'price', e.target.value)}
                      placeholder="Price (e.g. $95)"
                      className="w-32 p-2 rounded-lg border border-[#1F8A84]/30 bg-white text-xs text-[#0F3D3E] font-semibold focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeFactPrice(idx)}
                      aria-label={`Remove price ${idx + 1}`}
                      className="p-1.5 px-2 rounded text-xs text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 font-bold"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {extractedFacts.prices.length === 0 && (
                  <p className="text-xs text-gray-500 italic">No pricing was found on the website.</p>
                )}
              </div>
            </div>

            {/* FAQs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider">
                  Questions & Answers (FAQs)
                </label>
                <button
                  type="button"
                  onClick={addFactFaq}
                  className="px-2.5 py-1 text-xs font-bold bg-white text-[#0F3D3E] hover:bg-[#1F8A84] hover:text-white rounded border border-[#1F8A84]/30 transition-colors"
                >
                  + Add FAQ
                </button>
              </div>
              <div className="space-y-3">
                {extractedFacts.faqs.map((faq, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-white border border-[#1F8A84]/30 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => updateFactFaq(idx, 'question', e.target.value)}
                        placeholder="Question"
                        className="flex-1 p-1.5 rounded border border-gray-200 text-xs font-bold text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeFactFaq(idx)}
                        aria-label={`Remove FAQ ${idx + 1}`}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={faq.answer}
                      onChange={(e) => updateFactFaq(idx, 'answer', e.target.value)}
                      placeholder="Answer"
                      className="w-full p-1.5 rounded border border-gray-200 text-xs text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                    />
                  </div>
                ))}
                {extractedFacts.faqs.length === 0 && (
                  <p className="text-xs text-gray-500 italic">No FAQs found on page.</p>
                )}
              </div>
            </div>

            {/* Not Found Note */}
            {extractedFacts.not_found && extractedFacts.not_found.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block mb-1">
                  Not found on the website:
                </span>
                <p className="text-xs text-amber-800">
                  {extractedFacts.not_found.join(', ')}. The assistant will not invent these details.
                </p>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="pt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleGenerate(extractedFacts)}
                disabled={isLoading}
                className="px-6 py-3 rounded-xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-sm font-bold shadow-md transition-all flex items-center space-x-2"
              >
                <span>Use this to build my assistant</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Starter Templates */}
      <section className="mb-8" aria-labelledby="templates-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="templates-heading" className="text-base font-bold text-[#0F3D3E]">
            Or start with a sample template:
          </h2>
          <span className="text-xs text-[#1F8A84]">Click to populate description</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map((tmpl) => {
            const isSelected = activeTemplateId === tmpl.id;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tmpl)}
                className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#0F3D3E] bg-[#E8F1EF] ring-2 ring-[#0F3D3E] shadow-sm'
                    : 'border-[#1F8A84]/30 bg-white hover:bg-[#E8F1EF]/50 hover:border-[#1F8A84]'
                }`}
              >
                <div>
                  <h3 className="text-sm font-bold text-[#0F3D3E]">{tmpl.title}</h3>
                  <p className="mt-1 text-xs text-[#1F8A84] leading-relaxed line-clamp-3">
                    {tmpl.description}
                  </p>
                </div>
                <span className="mt-3 text-[11px] font-semibold text-[#0F3D3E] underline decoration-[#1F8A84]">
                  {isSelected ? 'Selected' : 'Use template'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Description Form */}
      <section className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 sm:p-8 shadow-sm mb-10">
        <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} noValidate>
          <div className="mb-4">
            <label
              htmlFor="agent-description-input"
              className="block text-base font-bold text-[#0F3D3E] mb-2"
            >
              What would you like your AI assistant to do?
            </label>
            <textarea
              id="agent-description-input"
              rows={5}
              value={description}
              onChange={handleDescriptionChange}
              placeholder="Example: Create a friendly receptionist for my dental clinic who speaks English and Hindi, helps with appointment requests, answers questions about cleaning prices, and transfers patients to a human if they mention dental pain."
              className={`w-full p-4 rounded-xl border text-sm text-[#0F3D3E] placeholder-[#1F8A84]/50 focus:outline-none transition-colors resize-y min-h-[140px] ${
                isTooLong
                  ? 'border-red-500 focus:ring-2 focus:ring-red-400'
                  : 'border-[#1F8A84]/40 focus:ring-2 focus:ring-[#1F8A84] focus:border-[#1F8A84]'
              }`}
              aria-describedby="char-counter form-validation-msg"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div id="form-validation-msg" className="text-xs">
              {isTooLong && (
                <span className="text-red-600 font-medium">
                  Description exceeds maximum limit of {MAX_CHAR_COUNT} characters.
                </span>
              )}
              {isEmpty && description.length > 0 && (
                <span className="text-amber-700 font-medium">
                  Please enter more details before generating.
                </span>
              )}
            </div>

            <div
              id="char-counter"
              className={`text-xs font-mono self-end sm:self-auto ${
                isTooLong ? 'text-red-600 font-bold' : 'text-[#1F8A84]'
              }`}
            >
              {charCount} / {MAX_CHAR_COUNT} characters
            </div>
          </div>

          {/* Error display */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold">Generation encountered an error:</p>
                <p className="text-xs mt-0.5">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => handleGenerate()}
                className="shrink-0 px-3 py-1.5 bg-red-800 text-white rounded-lg text-xs font-semibold hover:bg-red-900 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`px-6 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center space-x-2 ${
                isSubmitDisabled
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-[#0F3D3E] hover:bg-[#1F8A84] text-white shadow-md hover:shadow-lg active:scale-[0.99]'
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
                  <span>Generating your assistant...</span>
                </>
              ) : (
                <span>Create my assistant</span>
              )}
            </button>

            {isLoading && (
              <p className="text-xs text-[#1F8A84] animate-pulse">
                Gemini is structuring your assistant flow and guardrails...
              </p>
            )}
          </div>
        </form>
      </section>

      {/* Generated Configuration Display */}
      {isLoaded && config && (
        <section
          id="generated-configuration-panel"
          className="border-t-2 border-[#1F8A84]/20 pt-8 mt-10"
          aria-labelledby="draft-config-heading"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 id="draft-config-heading" className="text-2xl font-extrabold text-[#0F3D3E]">
                Assistant Setup Summary
              </h2>
              <p className="text-xs text-[#1F8A84] mt-1">
                Review your assistant setup below. Key fields can be edited directly before testing.
              </p>
            </div>
            <div className="flex items-center space-x-3 shrink-0">
              <button
                type="button"
                onClick={handleStartOver}
                className="px-4 py-2 bg-[#E8F1EF] hover:bg-[#0F3D3E] text-[#0F3D3E] hover:text-white border border-[#1F8A84]/30 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-2xs"
                title="Start fresh and create a new assistant"
              >
                <span>↻ Create New Assistant</span>
              </button>
            </div>
          </div>

          {/* Clean Setup Summary Card */}
          <div className="bg-white border-2 border-[#1F8A84]/30 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 mb-8">
            {/* 1. Assistant Name & Core Capabilities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="config-agent-name"
                  className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider mb-1.5"
                >
                  Assistant Name
                </label>
                <input
                  id="config-agent-name"
                  type="text"
                  value={config.name}
                  onChange={(e) => updateConfigField('name', e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#1F8A84]/30 text-sm font-bold text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                  placeholder="e.g. Smile Dental Assistant"
                />
              </div>

              {/* What the assistant helps with */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider">
                    What this assistant will help with
                  </label>
                  <button
                    type="button"
                    onClick={addGoal}
                    className="text-[11px] font-bold text-[#1F8A84] hover:underline"
                  >
                    + Add goal
                  </button>
                </div>
                <div className="space-y-2">
                  {config.goals.map((goal, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-[#1F8A84] shrink-0">•</span>
                      <input
                        type="text"
                        value={goal}
                        onChange={(e) => updateGoal(idx, e.target.value)}
                        aria-label={`Goal ${idx + 1}`}
                        className="flex-1 p-2 rounded-lg border border-[#1F8A84]/30 text-xs text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                      />
                      {config.goals.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGoal(idx)}
                          aria-label={`Remove Goal ${idx + 1}`}
                          className="text-gray-400 hover:text-rose-600 text-xs px-1 font-bold"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                  {config.goals.length === 0 && (
                    <p className="text-xs text-gray-500 italic">No goals defined. Click &ldquo;+ Add goal&rdquo; to add one.</p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Welcome Message */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="config-welcome-message"
                  className="text-xs font-bold text-[#0F3D3E] uppercase tracking-wider"
                >
                  Welcome Message (First Spoken Greeting)
                </label>
                {checkAiDisclosure(config.welcomeMessage) ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                    ✓ Clearly discloses AI identity
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                    ⚠️ Must state the assistant is an AI
                  </span>
                )}
              </div>
              <textarea
                id="config-welcome-message"
                rows={2}
                value={config.welcomeMessage}
                onChange={(e) => updateConfigField('welcomeMessage', e.target.value)}
                className="w-full p-3 rounded-xl border border-[#1F8A84]/30 text-sm text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
              />
            </div>

            {/* 2b. Hindi Welcome Message (if Hindi is enabled) */}
            {config.languages?.some(
              (l) => (l || '').toLowerCase().includes('hindi') || (l || '').toLowerCase() === 'hi'
            ) && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="config-welcome-message-hindi"
                    className="text-xs font-bold text-[#0F3D3E] uppercase tracking-wider"
                  >
                    Hindi Welcome Message (पहला संदेश)
                  </label>
                  {checkHindiAiDisclosure(config.welcomeMessageHindi || '') ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                      ✓ AI identity confirmed (Hindi सहायक)
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                      ⚠️ Hindi greeting must identify as AI
                    </span>
                  )}
                </div>
                <textarea
                  id="config-welcome-message-hindi"
                  rows={2}
                  value={config.welcomeMessageHindi || ''}
                  placeholder="नमस्ते! मैं Smile Dental का AI सहायक हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?"
                  onChange={(e) => updateConfigField('welcomeMessageHindi', e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#1F8A84]/30 text-sm text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                />
              </div>
            )}

            {/* 3. Language & Voice Selection */}
            {(() => {
              const isHindiOpening = Boolean(
                (config.languages?.[0] || '').toLowerCase().includes('hindi') ||
                (config.languages?.[0] || '').toLowerCase() === 'hi'
              );

              // Determine active English voice option
              const activeEnglishVoice =
                WRITE_VOICE_OPTIONS.find((v) =>
                  !v.isHindi && (
                    v.id === config.voiceId ||
                    (config.voiceName && config.voiceName.toLowerCase().includes(v.name.split(' ')[0].toLowerCase()))
                  )
                ) || WRITE_VOICE_OPTIONS[0]; // Rachel (Default)

              // Determine active Hindi voice option
              const activeHindiVoice =
                WRITE_VOICE_OPTIONS.find((v) =>
                  v.isHindi && (
                    v.id === config.voiceIdHindi ||
                    (config.voiceId && (config.voiceId === 'fTfuemKGBjYqG4ni4gw3' || config.voiceId === 'qdykssD3wAUvtIw9wG8N') && v.id === config.voiceId) ||
                    (config.voiceNameHindi && config.voiceNameHindi.toLowerCase().includes(v.name.split(' ')[0].toLowerCase())) ||
                    (config.voiceName && config.voiceName.toLowerCase().includes(v.name.split(' ')[0].toLowerCase()))
                  )
                ) || WRITE_VOICE_OPTIONS[1]; // Ritu Rathore

              const activeOpeningVoice = isHindiOpening ? activeHindiVoice : activeEnglishVoice;

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Language Selection */}
                  <div className="p-4 rounded-xl bg-white border border-[#1F8A84]/25 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#0F3D3E] uppercase tracking-wider">
                          Opening Language
                        </span>
                        <span className="text-[10px] text-[#1F8A84] font-semibold bg-[#E8F1EF] px-2 py-0.5 rounded-full">
                          Auto-switches mid-call
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        Choose the language callers hear when the call starts.
                      </p>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                          type="button"
                          id="write-opening-english-btn"
                          onClick={() => {
                            updateConfigFields({
                              languages: ['English', 'Hindi'],
                              voiceId: activeEnglishVoice.id,
                              voiceName: activeEnglishVoice.name,
                            });
                          }}
                          className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                            !isHindiOpening
                              ? 'bg-[#0F3D3E] text-white shadow-xs'
                              : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <span>🇬🇧</span>
                          <span>English Primary</span>
                        </button>

                        <button
                          type="button"
                          id="write-opening-hindi-btn"
                          onClick={() => {
                            updateConfigFields({
                              languages: ['Hindi', 'English'],
                              voiceId: activeHindiVoice.id,
                              voiceName: activeHindiVoice.name,
                              voiceIdHindi: activeHindiVoice.id,
                              voiceNameHindi: activeHindiVoice.name,
                            });
                          }}
                          className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                            isHindiOpening
                              ? 'bg-[#0F3D3E] text-white shadow-xs'
                              : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <span>🇮🇳</span>
                          <span>Hindi Primary</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                      <span>Speaking First:</span>
                      <span className="font-bold text-[#0F3D3E]">
                        {isHindiOpening ? `🇮🇳 ${activeHindiVoice.name.split(' ')[0]}` : `🇬🇧 ${activeEnglishVoice.name.split(' ')[0]}`}
                      </span>
                    </div>
                  </div>

                  {/* Voice Selection */}
                  <div className="p-4 rounded-xl bg-white border border-[#1F8A84]/25 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="config-voice-select"
                          className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider"
                        >
                          Voice
                        </label>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {isHindiOpening ? '🇮🇳 Hindi voice' : '🇬🇧 English voice'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        Select the voice for your assistant.
                      </p>

                      <select
                        id="config-voice-select"
                        value={
                          config.voiceId ||
                          activeOpeningVoice.id
                        }
                        onChange={(e) => {
                          const chosenId = e.target.value;
                          const chosen = WRITE_VOICE_OPTIONS.find((v) => v.id === chosenId) || WRITE_VOICE_OPTIONS[0];
                          if (chosen.isHindi) {
                            updateConfigFields({
                              languages: ['Hindi', 'English'],
                              voiceId: chosen.id,
                              voiceName: chosen.name,
                              voiceIdHindi: chosen.id,
                              voiceNameHindi: chosen.name,
                            });
                          } else {
                            updateConfigFields({
                              languages: ['English', 'Hindi'],
                              voiceId: chosen.id,
                              voiceName: chosen.name,
                            });
                          }
                        }}
                        className="w-full p-2.5 rounded-lg border border-gray-300 text-xs font-bold text-[#0F3D3E] bg-white focus:ring-2 focus:ring-[#1F8A84] focus:border-[#1F8A84] outline-hidden mb-2 shadow-2xs"
                      >
                        {WRITE_VOICE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <p className="text-[11px] text-gray-500 truncate">
                        <span className="font-semibold text-gray-700">Tone:</span>{' '}
                        {config.voiceSuggestion || 'Warm, friendly, clear front-desk tone'}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                      <span>Paired Voice (on switch):</span>
                      <span className="font-bold text-[#0F3D3E]">
                        {isHindiOpening
                          ? `🇬🇧 ${activeEnglishVoice.name.split(' ')[0]}`
                          : `🇮🇳 ${activeHindiVoice.name.split(' ')[0]}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 4. Concise Conversation-Flow Preview */}
            <div className="pt-1">
              <span className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider mb-2">
                Conversation Flow Preview
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {config.flowSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#E8F1EF]/60 border border-[#1F8A84]/25 flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-[#1F8A84] uppercase tracking-wider block">
                        Stage {idx + 1}
                      </span>
                      <p className="text-xs font-bold text-[#0F3D3E] mt-0.5 truncate">
                        {step.title}
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-600 mt-2 block line-clamp-2 leading-tight">
                      {step.instruction}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Primary First-Time User CTA to Proceed to Next Stage */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#0F3D3E]">
                  Ready to test your assistant with real voice?
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Proceed to Step 2 to speak directly with your assistant using your microphone.
                </p>
              </div>
              <Link
                href="/test"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center space-x-2 shrink-0 hover:scale-[1.02]"
              >
                <span>Test your assistant</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </div>

          {/* Collapsible Advanced Settings Section */}
          <details
            open
            className="border border-[#1F8A84]/25 bg-[#F8FAF9] rounded-2xl p-6 transition-all group"
          >
            <summary className="cursor-pointer text-sm font-bold text-[#0F3D3E] hover:text-[#1F8A84] flex items-center justify-between select-none">
              <span className="flex items-center space-x-2">
                <span>⚙️</span>
                <span>Advanced Settings &amp; Detailed Customization</span>
                <span className="text-xs text-gray-500 font-normal hidden sm:inline">
                  (Custom flow steps, behavioural rules, proposed tools &amp; knowledge base files)
                </span>
              </span>
              <span className="text-xs font-bold text-[#1F8A84]">
                Collapse / Expand
              </span>
            </summary>

            <div className="mt-6 space-y-6 pt-4 border-t border-[#1F8A84]/15">
              {/* Personality & Tone */}
              <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-[#0F3D3E] uppercase tracking-wider mb-2">
                  Personality &amp; Tone Instructions
                </h3>
                <textarea
                  id="config-agent-persona"
                  rows={2}
                  value={config.persona}
                  onChange={(e) => updateConfigField('persona', e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#1F8A84]/30 text-sm text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                />
              </div>

              {/* Detailed Flow Step Editor */}
              <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-[#0F3D3E] uppercase tracking-wider">
                    Detailed Conversation Flow Steps
                  </h3>
                  <button
                    type="button"
                    onClick={addFlowStep}
                    className="px-2.5 py-1 text-xs font-bold bg-[#E8F1EF] text-[#0F3D3E] hover:bg-[#1F8A84] hover:text-white rounded border border-[#1F8A84]/30 transition-colors"
                  >
                    + Add Step
                  </button>
                </div>
                <p className="text-xs text-[#1F8A84] mb-4">
                  The ordered stages your assistant follows during a call. You can edit instructions, reorder, or add steps.
                </p>

                <div className="space-y-4">
                  {config.flowSteps.map((step, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-[#E8F1EF]/40 border border-[#1F8A84]/20 space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-[#0F3D3E] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) => updateFlowStep(idx, 'title', e.target.value)}
                          aria-label={`Step ${idx + 1} Title`}
                          className="flex-1 p-2 rounded-lg border border-[#1F8A84]/30 text-sm font-bold text-[#0F3D3E] bg-white focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => moveFlowStep(idx, 'up')}
                          disabled={idx === 0}
                          aria-label={`Move Step ${idx + 1} up`}
                          className="p-1.5 px-2 rounded text-xs bg-white hover:bg-gray-100 border border-[#1F8A84]/30 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          &uarr;
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFlowStep(idx, 'down')}
                          disabled={idx === config.flowSteps.length - 1}
                          aria-label={`Move Step ${idx + 1} down`}
                          className="p-1.5 px-2 rounded text-xs bg-white hover:bg-gray-100 border border-[#1F8A84]/30 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          &darr;
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFlowStep(idx)}
                          aria-label={`Remove Step ${idx + 1}`}
                          className="p-1.5 px-2 rounded text-xs text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 font-bold"
                        >
                          &times;
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={step.instruction}
                        onChange={(e) => updateFlowStep(idx, 'instruction', e.target.value)}
                        aria-label={`Step ${idx + 1} Instruction`}
                        className="w-full p-2.5 rounded-lg border border-[#1F8A84]/30 text-xs text-[#0F3D3E] bg-white focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                      />
                    </div>
                  ))}
                  {config.flowSteps.length === 0 && (
                    <p className="text-xs text-gray-500 italic">No flow steps defined. Click &ldquo;+ Add Step&rdquo; to add one.</p>
                  )}
                </div>
              </div>

              {/* Behavioural Guardrails */}
              <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-[#0F3D3E] uppercase tracking-wider">
                    Behavioural Guardrails
                  </h3>
                  <button
                    type="button"
                    onClick={addGuardrail}
                    className="px-2.5 py-1 text-xs font-bold bg-[#E8F1EF] text-[#0F3D3E] hover:bg-[#1F8A84] hover:text-white rounded border border-[#1F8A84]/30 transition-colors"
                  >
                    + Add Guardrail
                  </button>
                </div>
                <p className="text-xs text-[#1F8A84] mb-4">
                  Safety and compliance boundaries the assistant must respect on every call.
                </p>
                <div className="space-y-2">
                  {config.guardrails.map((rule, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-[#1F8A84] w-5 text-center">🛡️</span>
                      <input
                        type="text"
                        value={rule}
                        onChange={(e) => updateGuardrail(idx, e.target.value)}
                        aria-label={`Guardrail ${idx + 1}`}
                        className="flex-1 p-2.5 rounded-lg border border-[#1F8A84]/30 text-xs text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => moveGuardrail(idx, 'up')}
                        disabled={idx === 0}
                        aria-label={`Move Guardrail ${idx + 1} up`}
                        className="p-1.5 px-2 rounded text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        &uarr;
                      </button>
                      <button
                        type="button"
                        onClick={() => moveGuardrail(idx, 'down')}
                        disabled={idx === config.guardrails.length - 1}
                        aria-label={`Move Guardrail ${idx + 1} down`}
                        className="p-1.5 px-2 rounded text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        &darr;
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGuardrail(idx)}
                        aria-label={`Remove Guardrail ${idx + 1}`}
                        className="p-1.5 px-2 rounded text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  {config.guardrails.length === 0 && (
                    <p className="text-xs text-gray-500 italic">No guardrails defined. Click &ldquo;+ Add Guardrail&rdquo; to add one.</p>
                  )}
                </div>
              </div>

              {/* Proposed Tools */}
              <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F3D3E] uppercase tracking-wider">
                      Tools &amp; Integrations
                    </h3>
                    <p className="text-xs text-[#1F8A84] mt-0.5">
                      Operational call transfers and webhook tools connected to your voice assistant.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addTool}
                    className="px-2.5 py-1 text-xs font-bold bg-[#E8F1EF] text-[#0F3D3E] hover:bg-[#1F8A84] hover:text-white rounded-lg border border-[#1F8A84]/30 transition-colors"
                  >
                    + Add Tool
                  </button>
                </div>

                <div className="space-y-4 mt-4">
                  {/* Tool 1: Transfer Call to Person (Human Escalation) */}
                  <div className="p-5 rounded-2xl bg-[#E8F1EF]/30 border border-[#1F8A84]/25 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-[#0F3D3E] text-white flex items-center justify-center text-base font-bold shrink-0">
                          📞
                        </div>
                        <div>
                          <input
                            type="text"
                            value={
                              config.tools.find((t) => isHumanTransferTool(t.name, t.purpose))?.name ||
                              'Transfer Call to Person'
                            }
                            onChange={(e) => {
                              const idx = config.tools.findIndex((t) =>
                                isHumanTransferTool(t.name, t.purpose)
                              );
                              if (idx >= 0) updateTool(idx, 'name', e.target.value);
                            }}
                            aria-label="Human Escalation Tool Name"
                            className="font-bold text-sm text-[#0F3D3E] bg-white px-2 py-1 rounded-md border border-[#1F8A84]/30 focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                          />
                          <p className="text-xs text-gray-600 mt-1">
                            When the caller asks for a person, reports pain, or has an emergency, the assistant transfers the call directly to a live human.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#1F8A84]/15">
                      <label
                        htmlFor="staff-transfer-phone"
                        className="block text-xs font-bold text-[#0F3D3E] mb-1.5"
                      >
                        Staff Phone Number to Call:
                      </label>
                      <input
                        id="staff-transfer-phone"
                        type="tel"
                        value={
                          config.transferPhoneNumber ??
                          config.knowledge?.contact ??
                          '+91 6201228417'
                        }
                        onChange={(e) => updateConfigField('transferPhoneNumber', e.target.value)}
                        placeholder="+91 6201228417 or Owner Mobile Number"
                        aria-label="Staff Phone Number to Call"
                        className="w-full p-2.5 rounded-xl border border-[#1F8A84]/30 font-mono text-xs font-bold text-[#0F3D3E] bg-white focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Tool 2: Appointment Booking Webhook (Fixed Core Capability) */}
                  <div className="p-5 rounded-2xl bg-[#E8F1EF]/30 border border-[#1F8A84]/25 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-[#1F8A84] text-white flex items-center justify-center text-base font-bold shrink-0">
                          📅
                        </div>
                        <div>
                          <input
                            type="text"
                            value={
                              config.tools.find((t) =>
                                isAppointmentBookingTool(t.name, t.purpose)
                              )?.name || 'Appointment Booking Webhook'
                            }
                            onChange={(e) => {
                              const idx = config.tools.findIndex((t) =>
                                isAppointmentBookingTool(t.name, t.purpose)
                              );
                              if (idx >= 0) {
                                updateTool(idx, 'name', e.target.value);
                              } else {
                                setConfig({
                                  ...config,
                                  tools: [
                                    ...config.tools,
                                    {
                                      name: e.target.value,
                                      purpose: 'Record and confirm appointment or reservation bookings via inbound webhook.',
                                      status: 'Not connected — requires public HTTPS webhook URL (currently on localhost)',
                                    },
                                  ],
                                });
                              }
                            }}
                            aria-label="Booking Tool Name"
                            className="font-bold text-sm text-[#0F3D3E] bg-white px-2 py-1 rounded-md border border-[#1F8A84]/30 focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                          />
                          <p className="text-xs text-gray-600 mt-1">
                            Collects customer name, preferred date and time, and confirms appointment or reservation bookings into your calendar or CRM.
                          </p>
                        </div>
                      </div>
                      {config.bookingWebhookUrl && config.bookingWebhookUrl.trim().startsWith('https://') && (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shrink-0">
                          ✓ Live Webhook Connected
                        </span>
                      )}
                    </div>

                    {/* Zapier / Google Calendar / CRM Webhook Input */}
                    <div className="pt-2 border-t border-[#1F8A84]/15">
                      <label
                        htmlFor="booking-webhook-url"
                        className="block text-xs font-bold text-[#0F3D3E] mb-1.5"
                      >
                        Your Webhook URL (Zapier, Google Calendar, Make, or CRM):
                      </label>
                      <input
                        id="booking-webhook-url"
                        type="url"
                        value={config.bookingWebhookUrl ?? ''}
                        onChange={(e) => updateConfigField('bookingWebhookUrl', e.target.value)}
                        placeholder="https://hooks.zapier.com/hooks/catch/... or https://hook.eu1.make.com/..."
                        aria-label="Booking Webhook URL"
                        className="w-full p-2.5 rounded-xl border border-[#1F8A84]/30 font-mono text-xs text-[#0F3D3E] bg-white focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Paste your Zapier or Make webhook trigger. Every confirmed booking made during voice calls is delivered directly here so it automatically creates Google Calendar events, adds rows to Google Sheets, or logs leads in your CRM.
                      </p>
                    </div>
                  </div>

                  {/* Any Other Custom Tools */}
                  {config.tools.map((tool, toolIdx) => {
                    if (
                      isHumanTransferTool(tool.name, tool.purpose) ||
                      isAppointmentBookingTool(tool.name, tool.purpose)
                    ) {
                      return null;
                    }
                    return (
                      <div
                        key={toolIdx}
                        className="p-4 rounded-xl bg-white border border-[#1F8A84]/25 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={tool.name}
                            onChange={(e) => updateTool(toolIdx, 'name', e.target.value)}
                            aria-label={`Tool ${toolIdx + 1} Name`}
                            className="font-bold text-sm text-[#0F3D3E] bg-[#E8F1EF]/30 p-2 rounded-lg border border-[#1F8A84]/30 flex-1 focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeTool(toolIdx)}
                            aria-label={`Remove Tool ${toolIdx + 1}`}
                            className="p-1.5 px-2 rounded text-xs text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 font-bold"
                          >
                            &times;
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={tool.purpose}
                          onChange={(e) => updateTool(toolIdx, 'purpose', e.target.value)}
                          aria-label={`Tool ${toolIdx + 1} Purpose`}
                          className="w-full p-2 rounded-lg text-xs text-[#0F3D3E] bg-white border border-[#1F8A84]/30 focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                        />
                      </div>
                    );
                  })}

                  {config.tools.length === 0 && (
                    <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-300 text-xs text-gray-600 text-center">
                      No external tool integrations configured.
                    </div>
                  )}
                </div>
              </div>

              {/* Attached Website Knowledge */}
              {config.knowledge && (
                <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#0F3D3E] uppercase tracking-wider">
                      Attached Website Knowledge
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                      Verified from website
                    </span>
                  </div>
                  <p className="text-xs text-[#1F8A84] mb-3">
                    These verified facts were used to formulate the assistant&apos;s guardrails and conversation steps.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#E8F1EF]/30 p-4 rounded-xl border border-[#1F8A84]/20">
                    {config.knowledge.business_name && (
                      <div>
                        <strong className="text-[#0F3D3E]">Business:</strong> {config.knowledge.business_name}
                      </div>
                    )}
                    {config.knowledge.opening_hours && (
                      <div>
                        <strong className="text-[#0F3D3E]">Hours:</strong> {config.knowledge.opening_hours}
                      </div>
                    )}
                    {config.knowledge.prices && config.knowledge.prices.length > 0 && (
                      <div className="sm:col-span-2">
                        <strong className="text-[#0F3D3E]">Verified Prices:</strong>{' '}
                        {config.knowledge.prices.map((p) => `${p.item} (${p.price})`).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Knowledge Base Documents */}
              <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F3D3E] uppercase tracking-wider">
                      Knowledge Base Documents (PDF, TXT, DOCX)
                    </h3>
                    <p className="text-xs text-[#1F8A84]">
                      Upload course catalogs, fee schedules, clinic manuals, or policy documents directly to your agent. Course and fee questions are answered from these documents.
                    </p>
                  </div>
                  <label className="px-3.5 py-1.5 bg-[#0F3D3E] hover:bg-[#1F8A84] text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer inline-flex items-center space-x-1.5 shrink-0">
                    <span>📎 Upload Document</span>
                    <input
                      type="file"
                      accept=".pdf,.txt,.docx,.doc,.md"
                      onChange={handleDocumentUpload}
                      disabled={isUploadingDoc}
                      className="hidden"
                    />
                  </label>
                </div>

                {isUploadingDoc && (
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800 flex items-center space-x-2 mb-3">
                    <svg className="animate-spin h-4 w-4 text-teal-700" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Uploading document to ElevenLabs Knowledge Base...</span>
                  </div>
                )}

                {docUploadError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 mb-3 flex items-center justify-between">
                    <span>⚠️ {docUploadError}</span>
                    <button onClick={() => setDocUploadError(null)} className="font-bold">✕</button>
                  </div>
                )}

                <div className="space-y-2">
                  {Array.isArray(config.knowledgeBaseDocuments) &&
                    config.knowledgeBaseDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 rounded-xl bg-[#E8F1EF]/40 border border-[#1F8A84]/20 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="text-lg">📄</span>
                          <div>
                            <p className="text-xs font-bold text-[#0F3D3E]">{doc.name}</p>
                            <p className="text-[10px] text-gray-500">
                              {doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : 'Document'} · Synced with ElevenLabs Knowledge Base
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(doc.id)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded hover:bg-rose-50"
                          title="Remove document"
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                  {(!config.knowledgeBaseDocuments || config.knowledgeBaseDocuments.length === 0) && (
                    <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-xl">
                      <p className="text-xs text-gray-500">
                        No documents uploaded yet. Upload PDFs or policies to automatically power your agent with RAG.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Expressive Delivery Toggle */}
              <div className="p-4 rounded-xl bg-white border border-[#1F8A84]/25">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!config.expressiveMode}
                    onChange={(e) => updateConfigField('expressiveMode', e.target.checked)}
                    className="w-4 h-4 text-[#1F8A84] rounded border-gray-300 focus:ring-[#1F8A84]"
                  />
                  <span className="text-xs font-bold text-[#0F3D3E]">
                    Enable Expressive Voice Delivery
                  </span>
                </label>
                <p className="text-[11px] text-gray-500 mt-1 ml-6.5">
                  Modulates vocal delivery with enhanced expressiveness and natural pause dynamics.
                </p>
              </div>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
