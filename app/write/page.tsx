'use client';

import React, { useState } from 'react';
import { AgentConfig, FlowStep, ProposedTool, ExtractedFacts, ExtractedPrice, ExtractedFaq } from '@/lib/types';
import { useAgentConfig } from '@/lib/useAgentConfig';

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
];

const MAX_CHAR_COUNT = 1200;

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
        'Are you sure you want to start over? This will clear your current draft assistant configuration.'
      );
      if (confirmed) {
        clearConfig();
        setDescription('');
        setActiveTemplateId(null);
        setErrorMessage(null);
        setWebsiteUrl('');
        setExtractedFacts(null);
        setExtractError(null);
      }
    }
  };

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
  const updateConfigField = <K extends keyof AgentConfig>(field: K, value: AgentConfig[K]) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                <span>Generate my AI assistant</span>
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
          {/* Draft Notice Banner with Start Over button */}
          <div className="mb-6 p-4 rounded-xl bg-[#E8F1EF] border border-[#1F8A84]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase font-extrabold text-[#0F3D3E] tracking-wider">
                Draft configuration saved
              </p>
              <p className="text-sm text-[#0F3D3E] mt-0.5">
                Automatically saved to local storage. No voice agent has been published yet.
              </p>
            </div>
            <div className="flex items-center space-x-3 shrink-0">
              <span className="px-3 py-1 bg-white text-[#0F3D3E] border border-[#1F8A84]/30 rounded-full text-xs font-bold">
                Saved Locally
              </span>
              <button
                type="button"
                onClick={handleStartOver}
                className="px-3 py-1 bg-white text-rose-700 hover:bg-rose-50 border border-rose-300 rounded-full text-xs font-bold transition-colors"
                title="Clear current agent draft and start fresh"
              >
                Start over
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <h2 id="draft-config-heading" className="text-2xl font-extrabold text-[#0F3D3E]">
              Assistant Draft Configuration
            </h2>
            <span className="text-xs text-[#1F8A84]">Changes auto-save locally</span>
          </div>

          <div className="space-y-6">
            {/* 1. Basic Information */}
            <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#0F3D3E] mb-4">
                Basic Information
              </h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="config-agent-name" className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
                    Assistant Name
                  </label>
                  <input
                    id="config-agent-name"
                    type="text"
                    value={config.name}
                    onChange={(e) => updateConfigField('name', e.target.value)}
                    className="w-full p-3 rounded-lg border border-[#1F8A84]/30 text-sm font-semibold text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="config-agent-persona" className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
                    Personality & Tone
                  </label>
                  <textarea
                    id="config-agent-persona"
                    rows={2}
                    value={config.persona}
                    onChange={(e) => updateConfigField('persona', e.target.value)}
                    className="w-full p-3 rounded-lg border border-[#1F8A84]/30 text-sm text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                  />
                </div>

                {/* Goals - Fully Editable List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider">
                      Core Goals
                    </label>
                    <button
                      type="button"
                      onClick={addGoal}
                      className="px-2.5 py-1 text-xs font-bold bg-[#E8F1EF] text-[#0F3D3E] hover:bg-[#1F8A84] hover:text-white rounded border border-[#1F8A84]/30 transition-colors"
                    >
                      + Add Goal
                    </button>
                  </div>
                  <div className="space-y-2">
                    {config.goals.map((goal, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#1F8A84] w-5 text-right">{idx + 1}.</span>
                        <input
                          type="text"
                          value={goal}
                          onChange={(e) => updateGoal(idx, e.target.value)}
                          aria-label={`Goal ${idx + 1}`}
                          className="flex-1 p-2.5 rounded-lg border border-[#1F8A84]/30 text-sm text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => moveGoal(idx, 'up')}
                          disabled={idx === 0}
                          aria-label={`Move Goal ${idx + 1} up`}
                          className="p-1.5 px-2 rounded text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          &uarr;
                        </button>
                        <button
                          type="button"
                          onClick={() => moveGoal(idx, 'down')}
                          disabled={idx === config.goals.length - 1}
                          aria-label={`Move Goal ${idx + 1} down`}
                          className="p-1.5 px-2 rounded text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          &darr;
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGoal(idx)}
                          aria-label={`Remove Goal ${idx + 1}`}
                          className="p-1.5 px-2 rounded text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    {config.goals.length === 0 && (
                      <p className="text-xs text-gray-500 italic">No goals defined. Click &ldquo;+ Add Goal&rdquo; to add one.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Welcome Message */}
            <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <label htmlFor="config-welcome-message" className="text-xs font-bold text-[#0F3D3E] uppercase tracking-wider">
                  Welcome Message (First Greeting)
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
              <p className="text-xs text-[#1F8A84] mb-3">
                This is the first sentence the assistant speaks when answering a call. By policy, it must identify itself as AI.
              </p>
              <textarea
                id="config-welcome-message"
                rows={3}
                value={config.welcomeMessage}
                onChange={(e) => updateConfigField('welcomeMessage', e.target.value)}
                className="w-full p-3 rounded-lg border border-[#1F8A84]/30 text-sm text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
              />
            </div>

            {/* 2b. Hindi Welcome Message (when Hindi is enabled) */}
            {config.languages?.some(
              (l) => (l || '').toLowerCase().includes('hindi') || (l || '').toLowerCase() === 'hi'
            ) && (
              <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
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
                <p className="text-xs text-[#1F8A84] mb-3">
                  Spoken when the caller greets or speaks in Hindi. By policy, it must identify itself as an AI assistant.
                </p>
                <textarea
                  id="config-welcome-message-hindi"
                  rows={3}
                  value={config.welcomeMessageHindi || ''}
                  placeholder="नमस्ते! मैं Smile Dental का AI सहायक हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?"
                  onChange={(e) => updateConfigField('welcomeMessageHindi', e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#1F8A84]/30 text-sm text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                />
              </div>
            )}

            {/* 3. Conversation Flow - Fully Editable List */}
            <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-[#0F3D3E]">
                  Conversation Flow
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
                The ordered stages your assistant follows during a call. You can edit, reorder, or add steps.
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

            {/* 4. Languages & Voice Suggestion */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Languages */}
              <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-[#0F3D3E] uppercase tracking-wider mb-2">
                  Proposed Languages
                </h3>
                <p className="text-xs text-[#1F8A84] mb-3">
                  Proposed multilingual support. Voice interaction will be configured in later stages.
                </p>
                <div className="flex flex-wrap gap-2">
                  {config.languages.map((lang, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-lg bg-[#E8F1EF] text-[#0F3D3E] border border-[#1F8A84]/30 text-xs font-bold"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>

              {/* Voice Suggestion */}
              <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-[#0F3D3E] uppercase tracking-wider mb-2">
                  Voice Style Recommendation
                </h3>
                <p className="text-xs text-[#1F8A84] mb-3">
                  Stylistic vocal recommendation. No ElevenLabs voice ID is assigned yet.
                </p>
                <textarea
                  rows={2}
                  value={config.voiceSuggestion}
                  onChange={(e) => updateConfigField('voiceSuggestion', e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#1F8A84]/30 text-xs text-[#0F3D3E] focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                />
              </div>
            </div>

            {/* 5. Guardrails - Fully Editable List */}
            <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-[#0F3D3E]">
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

            {/* 6. Proposed Tools - Fully Editable List */}
            <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-[#0F3D3E]">
                  Proposed Tools
                </h3>
                <button
                  type="button"
                  onClick={addTool}
                  className="px-2.5 py-1 text-xs font-bold bg-[#E8F1EF] text-[#0F3D3E] hover:bg-[#1F8A84] hover:text-white rounded border border-[#1F8A84]/30 transition-colors"
                >
                  + Add Tool
                </button>
              </div>
              <p className="text-xs text-[#1F8A84] mb-4">
                Capabilities proposed for this assistant. These are drafts only and not connected to live external systems.
              </p>

              <div className="space-y-4">
                {config.tools.map((tool, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-[#E8F1EF]/30 border border-[#1F8A84]/20 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={tool.name}
                        onChange={(e) => updateTool(idx, 'name', e.target.value)}
                        aria-label={`Tool ${idx + 1} Name`}
                        className="font-bold text-sm text-[#0F3D3E] bg-white p-2 rounded-lg border border-[#1F8A84]/30 flex-1 focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => moveTool(idx, 'up')}
                        disabled={idx === 0}
                        aria-label={`Move Tool ${idx + 1} up`}
                        className="p-1.5 px-2 rounded text-xs bg-white hover:bg-gray-100 border border-[#1F8A84]/30 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        &uarr;
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTool(idx, 'down')}
                        disabled={idx === config.tools.length - 1}
                        aria-label={`Move Tool ${idx + 1} down`}
                        className="p-1.5 px-2 rounded text-xs bg-white hover:bg-gray-100 border border-[#1F8A84]/30 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        &darr;
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTool(idx)}
                        aria-label={`Remove Tool ${idx + 1}`}
                        className="p-1.5 px-2 rounded text-xs text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 font-bold"
                      >
                        &times;
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={tool.purpose}
                      onChange={(e) => updateTool(idx, 'purpose', e.target.value)}
                      aria-label={`Tool ${idx + 1} Purpose`}
                      className="w-full p-2.5 rounded-lg text-xs text-[#0F3D3E] bg-white border border-[#1F8A84]/30 focus:ring-2 focus:ring-[#1F8A84] focus:outline-none"
                    />
                    <div className="pt-1">
                      <span className="inline-block px-2.5 py-1 rounded bg-[#E8F1EF] text-[#0F3D3E] border border-[#1F8A84]/30 text-[11px] font-semibold">
                        {tool.status}
                      </span>
                    </div>
                  </div>
                ))}
                {config.tools.length === 0 && (
                  <p className="text-xs text-gray-500 italic">No tools proposed. Click &ldquo;+ Add Tool&rdquo; to add one.</p>
                )}
              </div>
            </div>

            {/* 7. Attached Knowledge (from website if present) */}
            {config.knowledge && (
              <div className="bg-white border border-[#1F8A84]/25 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-[#0F3D3E]">
                    Attached Website Knowledge
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                    Verified from website
                  </span>
                </div>
                <p className="text-xs text-[#1F8A84] mb-3">
                  These verified facts were used to formulate the assistant&apos;s guardrails and conversation steps, and are saved in the agent configuration.
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
          </div>
        </section>
      )}
    </div>
  );
}
