import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { enforceHindiAiDisclosure } from '@/lib/elevenlabs';

export const dynamic = 'force-dynamic';

function cleanResponseText(raw: string): string {
  let cleaned = (raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json|text)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON with welcomeMessage.' },
        { status: 400 }
      );
    }

    const welcomeMessage = typeof body.welcomeMessage === 'string' ? body.welcomeMessage.trim() : '';
    const agentName = typeof body.name === 'string' ? body.name.trim() : (typeof body.agentName === 'string' ? body.agentName.trim() : '');

    if (!welcomeMessage) {
      return NextResponse.json(
        { error: 'Missing or empty welcomeMessage.' },
        { status: 400 }
      );
    }

    const prompt = `You are an expert bilingual conversational Voice AI copywriter.
Translate the following English welcome greeting into a natural, warm, and professional Hindi greeting for an AI voice phone assistant.

English Greeting:
"${welcomeMessage}"

Assistant Name: "${agentName || 'AI Assistant'}"

Strict Rules:
1. The Hindi greeting MUST explicitly identify the speaker as an AI assistant (using "AI सहायक" or "AI assistant" or "AI रिसेप्शनिस्ट").
2. Faithfully translate the intent, greeting style, and tone of the English welcome message.
3. NEVER invent or hallucinate any business facts, prices, hours, or clinic policies not in the original greeting.
4. Output ONLY the translated Hindi greeting text in Devanagari script. Do not output markdown backticks, explanations, or quotes.`;

    try {
      const raw = await callLLM(prompt);
      const cleaned = cleanResponseText(raw);
      const finalized = enforceHindiAiDisclosure(cleaned, agentName);

      return NextResponse.json({
        welcomeMessageHindi: finalized,
      });
    } catch (llmErr: any) {
      // In case of LLM quota limit or error, generate a safe deterministic Hindi AI greeting
      const fallback = enforceHindiAiDisclosure(
        `नमस्ते! मैं ${agentName || 'क्लिनिक'} का AI सहायक हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?`,
        agentName
      );
      return NextResponse.json({
        welcomeMessageHindi: fallback,
        warning: 'Generated default greeting due to model service unavailability.',
      });
    }
  } catch (err: any) {
    const message = err?.message || 'Failed to generate Hindi welcome greeting.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
