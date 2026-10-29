import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { AgentConfig, FlowStep, ProposedTool, isValidAgentConfig } from '@/lib/types';
import { isKnowledgeLookupTool, isHumanTransferTool, isAppointmentBookingTool, getBookingToolStatus } from '@/lib/tools';

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

function validateAndFilterPartialConfig(data: any): Partial<AgentConfig> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('AI output is not a valid JSON object');
  }

  const result: Partial<AgentConfig> = {};

  if (typeof data.name === 'string' && data.name.trim()) {
    result.name = data.name.trim();
  }

  if (typeof data.persona === 'string' && data.persona.trim()) {
    result.persona = data.persona.trim();
  }

  if (Array.isArray(data.goals)) {
    const validGoals = data.goals
      .filter((g: any) => typeof g === 'string' && g.trim() && !containsPlatformInternal(g))
      .map((g: string) => g.trim());
    if (validGoals.length > 0) {
      result.goals = validGoals;
    }
  }

  if (Array.isArray(data.flowSteps)) {
    const validSteps = data.flowSteps
      .filter((s: any) => s && typeof s === 'object' && !containsPlatformInternal(s.title || ''))
      .map((s: any, idx: number) => ({
        title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `Step ${idx + 1}`,
        instruction: typeof s.instruction === 'string' && s.instruction.trim() ? s.instruction.trim() : '',
      }));
    if (validSteps.length > 0) {
      result.flowSteps = validSteps;
    }
  }

  if (typeof data.welcomeMessage === 'string' && data.welcomeMessage.trim()) {
    result.welcomeMessage = data.welcomeMessage.trim();
  }

  if (Array.isArray(data.languages)) {
    const validLangs = data.languages
      .filter((l: any) => typeof l === 'string' && l.trim())
      .map((l: string) => l.trim());
    if (validLangs.length > 0) {
      result.languages = validLangs;
    }
  }

  if (typeof data.voiceSuggestion === 'string' && data.voiceSuggestion.trim()) {
    let suggestion = data.voiceSuggestion.trim();
    if (suggestion.toLowerCase().includes('scribe')) {
      suggestion = 'A clear, natural, and friendly conversational tone.';
    }
    result.voiceSuggestion = suggestion;
  }

  if (Array.isArray(data.guardrails)) {
    const validGuardrails = data.guardrails
      .filter((g: any) => typeof g === 'string' && g.trim() && !containsPlatformInternal(g))
      .map((g: string) => g.trim());
    if (validGuardrails.length > 0) {
      result.guardrails = validGuardrails;
    }
  }

  if (Array.isArray(data.tools)) {
    const validTools: ProposedTool[] = data.tools
      .filter((t: any) => {
        if (!t || typeof t !== 'object') return false;
        const name = typeof t.name === 'string' ? t.name.trim() : '';
        const purpose = typeof t.purpose === 'string' ? t.purpose.trim() : '';
        if (containsPlatformInternal(name) || containsPlatformInternal(purpose)) return false;
        // Course and fee info belongs to Knowledge Base, not separate tools
        if (isKnowledgeLookupTool(name, purpose)) return false;
        // Human transfer is behavioural, not a connected telephone transfer
        if (isHumanTransferTool(name, purpose)) return false;
        return true;
      })
      .map((t: any, idx: number) => {
        const name = typeof t.name === 'string' && t.name.trim() ? t.name.trim() : `Proposed Tool ${idx + 1}`;
        const purpose = typeof t.purpose === 'string' && t.purpose.trim() ? t.purpose.trim() : '';
        let status = 'Proposed — integration not connected';
        if (isAppointmentBookingTool(name, purpose)) {
          const bookingStatus = getBookingToolStatus();
          status = bookingStatus.status;
        }
        return {
          name,
          purpose,
          status,
        };
      });
    if (validTools.length > 0) {
      result.tools = validTools;
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body.' },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'Request body must be a JSON object containing "config" and "request".' },
      { status: 400 }
    );
  }

  const { config, request } = body;

  if (!config || !isValidAgentConfig(config)) {
    return NextResponse.json(
      { error: 'A valid current agent configuration is required to refine.' },
      { status: 400 }
    );
  }

  const changeRequest = typeof request === 'string' ? request.trim() : '';

  if (!changeRequest) {
    return NextResponse.json(
      { error: 'Please enter a change request before submitting.' },
      { status: 400 }
    );
  }

  if (changeRequest.length > 500) {
    return NextResponse.json(
      { error: `Change request exceeds limit of 500 characters (${changeRequest.length} entered).` },
      { status: 400 }
    );
  }

  const prompt = `You are an expert Voice AI Agent architect. A user wants to modify an existing AI agent configuration.

Current Agent Configuration:
${JSON.stringify(config, null, 2)}

User's Change Request:
"${changeRequest}"

Instructions:
1. Determine strictly which fields in AgentConfig need to be changed based on the user's request.
2. Return ONLY a single raw JSON object containing ONLY the modified fields (a partial AgentConfig). Do NOT return unchanged fields. Do NOT use markdown code blocks (\`\`\`json). Do NOT provide explanations.
3. If welcomeMessage is modified, it MUST explicitly state that the assistant is an AI.
4. If languages is modified, ensure natural, recognized language names are used.
5. Focus strictly on business/customer capabilities. NEVER invent or introduce platform internals (e.g. call analysis, health checks, SSRF, API monitoring, application deployment). Never suggest Scribe as a voice model.
6. Allowed keys in the returned JSON object are ONLY:
   - "name": string
   - "persona": string
   - "goals": string[]
   - "flowSteps": array of {"title": string, "instruction": string}
   - "welcomeMessage": string
   - "languages": string[]
   - "voiceSuggestion": string
   - "guardrails": string[]
   - "tools": array of {"name": string, "purpose": string, "status": "Proposed — integration not connected"}
`;

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

    const partialConfig = validateAndFilterPartialConfig(parsed);

    if (Object.keys(partialConfig).length === 0) {
      return NextResponse.json(
        { error: 'The AI model could not determine any valid changes for this request. Please try rephrasing.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      changes: partialConfig,
    });
  } catch (err: any) {
    const message = err?.message || 'An unexpected error occurred while processing the refinement.';
    const status = message.toLowerCase().includes('rate limit') ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
