import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { AgentConfig, FlowStep, ProposedTool, ExtractedFacts } from '@/lib/types';
import { enforceHindiAiDisclosure } from '@/lib/elevenlabs';
import { normalizeAgentTools } from '@/lib/tools';

export const maxDuration = 60;

function cleanJsonText(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return cleaned;
}

const FORBIDDEN_PLATFORM_TERMS = [
  'call analysis',
  'health check',
  'ssrf',
  'api monitoring',
  'application deployment',
  'database log',
  'server maintenance',
  'backend check',
  'developer tool',
  'deployment pipeline',
  'quota tracking',
  'latency metric',
];

function containsPlatformInternal(text: string): boolean {
  const lower = (text || '').toLowerCase();
  return FORBIDDEN_PLATFORM_TERMS.some((term) => lower.includes(term));
}

function hasAiDisclosure(text: string): boolean {
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
  if (hasAiDisclosure(message)) {
    return message;
  }
  const prefix = agentName ? `Hi, I am the AI assistant for ${agentName}.` : "Hi, I am an AI assistant.";
  return `${prefix} ${message}`.trim();
}

function validateAndNormalizeConfig(data: any, facts?: ExtractedFacts): AgentConfig {
  if (!data || typeof data !== 'object') {
    throw new Error('Generated output is not a valid JSON object');
  }

  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'AI Assistant';
  const persona = typeof data.persona === 'string' && data.persona.trim()
    ? data.persona.trim()
    : 'Helpful, courteous and professional';

  let goals: string[] = Array.isArray(data.goals)
    ? data.goals
        .filter((g: any) => typeof g === 'string' && g.trim() && !containsPlatformInternal(g))
        .map((g: string) => g.trim())
    : [];
  if (goals.length === 0) {
    goals.push('Understand customer inquiries and provide clear answers');
    goals.push('Escalate requests to human representatives when required');
  }

  const flowSteps: FlowStep[] = Array.isArray(data.flowSteps)
    ? data.flowSteps
        .filter((s: any) => s && typeof s === 'object' && !containsPlatformInternal(s.title || ''))
        .map((s: any, idx: number) => ({
          title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `Step ${idx + 1}`,
          instruction: typeof s.instruction === 'string' && s.instruction.trim()
            ? s.instruction.trim()
            : 'Greet the user and listen to their request.',
        }))
    : [];

  if (flowSteps.length === 0) {
    flowSteps.push(
      { title: 'Greeting', instruction: 'Introduce yourself as an AI assistant and ask how you can help.' },
      { title: 'Inquiry', instruction: 'Listen carefully to the customer and collect needed details.' },
      { title: 'Resolution or Handoff', instruction: 'Answer accurately or connect the caller to a team member.' },
      { title: 'Closing', instruction: 'Summarize the next steps and conclude politely.' }
    );
  }

  let welcomeMessage = typeof data.welcomeMessage === 'string' && data.welcomeMessage.trim()
    ? data.welcomeMessage.trim()
    : `Hi! I am the AI assistant for ${name}. How can I help you today?`;
  welcomeMessage = enforceAiDisclosure(welcomeMessage, name);

  let welcomeMessageHindi = typeof data.welcomeMessageHindi === 'string' && data.welcomeMessageHindi.trim()
    ? data.welcomeMessageHindi.trim()
    : `नमस्ते! मैं ${name} की AI सहायक हूँ। आज मैं आपकी क्या मदद कर सकती हूँ?`;
  welcomeMessageHindi = enforceHindiAiDisclosure(welcomeMessageHindi, name);

  let languages: string[] = Array.isArray(data.languages)
    ? data.languages.filter((l: any) => typeof l === 'string' && l.trim()).map((l: string) => l.trim())
    : [];

  const hasEnglish = languages.some((l) => l.toLowerCase() === 'english');
  const hasHindi = languages.some((l) => l.toLowerCase() === 'hindi');
  if (!hasEnglish) languages.unshift('English');
  if (!hasHindi) languages.push('Hindi');

  let voiceSuggestion = typeof data.voiceSuggestion === 'string' && data.voiceSuggestion.trim()
    ? data.voiceSuggestion.trim()
    : 'A clear, natural, and friendly conversational tone.';
  if (voiceSuggestion.toLowerCase().includes('scribe')) {
    voiceSuggestion = 'A clear, natural, and friendly conversational tone.';
  }

  let guardrails: string[] = Array.isArray(data.guardrails)
    ? data.guardrails
        .filter((g: any) => typeof g === 'string' && g.trim() && !containsPlatformInternal(g))
        .map((g: string) => g.trim())
    : [];
  if (guardrails.length === 0) {
    guardrails.push("Stay focused strictly on the assistant's defined responsibilities.");
    guardrails.push("Never fabricate prices, dates, or factual claims.");
    guardrails.push("Transfer the conversation to a human whenever requested.");
  }

  const rawTools: ProposedTool[] = Array.isArray(data.tools)
    ? data.tools
        .filter(
          (t: any) =>
            t &&
            typeof t === 'object' &&
            !containsPlatformInternal(t.name || '') &&
            !containsPlatformInternal(t.purpose || '')
        )
        .map((t: any, idx: number) => ({
          name: typeof t.name === 'string' && t.name.trim() ? t.name.trim() : `Proposed Tool ${idx + 1}`,
          purpose: typeof t.purpose === 'string' && t.purpose.trim()
            ? t.purpose.trim()
            : 'Assists with customer inquiries.',
          status: 'Proposed — integration not connected',
        }))
    : [];

  const config: AgentConfig = {
    name,
    persona,
    goals,
    flowSteps,
    welcomeMessage,
    welcomeMessageHindi,
    languages,
    voiceSuggestion,
    guardrails,
    tools: rawTools,
  };

  if (facts) {
    config.knowledge = facts;
  }

  // Normalize tools: course & fee info belongs in Knowledge Base; human handoff is behavioural; booking checks real URL
  return normalizeAgentTools(config);
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body. Please check your submission.' },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'Request body must be a JSON object containing a "description" field.' },
      { status: 400 }
    );
  }

  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!description) {
    return NextResponse.json(
      { error: 'Please enter a description for your AI assistant before generating.' },
      { status: 400 }
    );
  }

  if (description.length > 10000) {
    return NextResponse.json(
      {
        error: `Description is too long (${description.length} characters). Maximum allowed is 10,000 characters.`,
      },
      { status: 400 }
    );
  }

  let factsContext = '';
  if (body.facts && typeof body.facts === 'object') {
    const f = body.facts;
    factsContext = `\nConfirmed Business Facts from Website:
Business Name: ${f.business_name || 'Not specified'}
Business Type: ${f.business_type || 'Not specified'}
Services: ${Array.isArray(f.services) && f.services.length > 0 ? f.services.join(', ') : 'Not specified'}
Prices: ${Array.isArray(f.prices) && f.prices.length > 0 ? f.prices.map((p: any) => `${p.item}: ${p.price}`).join(', ') : 'None listed'}
Opening Hours: ${f.opening_hours || 'Not specified'}
Contact: ${f.contact || 'Not specified'}
FAQs: ${Array.isArray(f.faqs) && f.faqs.length > 0 ? f.faqs.map((faq: any) => `Q: ${faq.question} | A: ${faq.answer}`).join('; ') : 'None listed'}

Strict instructions regarding confirmed facts:
- Utilize these confirmed services, verified prices, opening hours, and FAQs in shaping the agent's goals, flow steps, and guardrails.
- Enforce in guardrails that the agent must ONLY quote the verified prices and opening hours listed above. Never invent unverified pricing.
`;
  }

  const prompt = `You are an expert Voice AI Agent architect. Analyze the user's description and generate a structured JSON agent configuration.

User Description:
"${description}"
${factsContext}
Strict Requirements:
1. Return ONLY valid JSON matching the schema below. No markdown backticks, no explanations.
2. The welcomeMessage MUST explicitly disclose that the assistant is an AI (e.g., "Hi, I am the AI assistant for...").
3. The languages array MUST include both "English" and "Hindi".
4. The flowSteps array must provide clear, ordered steps with "title" and "instruction".
5. TOOL RULES & CAPABILITY MAPPING:
   - Course and Fee information: Do NOT propose separate tools for static knowledge retrieval (such as "Course Catalog Lookup", "Fee Structure Database", "Catalog Lookup", "Price Database", or "FAQ Search"). Factual answers regarding courses, curriculum, fee schedules, services, and pricing are answered directly via the Knowledge Base (documents and verified facts).
   - Human hand-off: Do NOT create tools for transferring to a person (such as "Human Transfer Router"). Human hand-off must be defined as a behavioural instruction in flowSteps and guardrails (e.g. instructing the assistant verbally to take a message or offer callback), NEVER as an active telephone-transfer integration unless a real telephony PBX transfer mechanism exists.
   - Appointment booking: If the user requests appointment booking or scheduling, include "Appointment Booking Webhook" (purpose: "Record and confirm appointment bookings via inbound webhook").
   - Clearly distinguish proposed business capabilities from integrations actually configured: tools must accurately show connection status.
6. BUSINESS FOCUS & SCOPE:
   - Focus EXCLUSIVELY on customer-facing business capabilities described by the user (for example, answering clinic hours and verified pricing, booking appointments, routing calls to human staff).
   - NEVER invent clinic facts, unverified pricing, medical advice, or government schemes not provided in the description or verified facts.
   - NEVER include developer or platform internals (e.g. call analysis, health checks, SSRF protection, API monitoring, application deployment, database logs, server maintenance).
   - DO NOT suggest "Scribe" as a voice-generation model. Scribe is an audio transcription (speech-to-text) model, not a voice. Keep speech recognition and voice generation conceptually separate. Suggest natural voice traits (e.g. "Warm, friendly, clear conversational tone").
   - Clearly distinguish proposed business capabilities from integrations actually configured: all tools must have status set to "Proposed — integration not connected".

JSON Schema:
{
  "name": "string (name of the agent)",
  "persona": "string (tone and personality style)",
  "goals": ["string (primary goal 1)", "string (primary goal 2)"],
  "flowSteps": [
    {
      "title": "string (step title)",
      "instruction": "string (behavior instructions for this step)"
    }
  ],
  "welcomeMessage": "string (opening greeting clearly identifying as AI)",
  "welcomeMessageHindi": "string (warm Hindi greeting in Devanagari identifying as AI सहायक)",
  "languages": ["English", "Hindi"],
  "voiceSuggestion": "string (plain description of recommended vocal characteristics)",
  "guardrails": ["string (safety boundary or rule 1)", "string (rule 2)"],
  "tools": [
    {
      "name": "string (tool name)",
      "purpose": "string (what the tool assists with)",
      "status": "Proposed — integration not connected"
    }
  ]
}`;

  try {
    const rawResult = await callLLM(prompt, {
      responseMimeType: 'application/json',
    });

    const cleaned = cleanJsonText(rawResult);
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'The AI model returned an unreadable response format. Please try again.' },
        { status: 502 }
      );
    }

    const validatedConfig = validateAndNormalizeConfig(parsed, body.facts);

    return NextResponse.json({
      config: validatedConfig,
    });
  } catch (err: any) {
    const message = err?.message || 'An unexpected error occurred while generating the assistant configuration.';
    const status = message.toLowerCase().includes('rate limit') ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
