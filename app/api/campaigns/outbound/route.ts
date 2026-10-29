import { NextResponse } from 'next/server';
import { AgentConfig, Conversation } from '@/lib/types';
import { callLLM } from '@/lib/llm';

export interface CampaignContact {
  id: string;
  name: string;
  phone: string;
  details?: string;
  status: 'queued' | 'calling' | 'completed' | 'failed';
  outcome?: string;
  duration?: number;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.contact) {
      return NextResponse.json(
        { error: 'Missing contact in request body.' },
        { status: 400 }
      );
    }

    const { contact, config } = body as {
      contact: CampaignContact;
      config?: AgentConfig;
    };

    const businessName = config?.name || 'Clinic';
    const contactName = contact.name || 'Caller';
    const reason = contact.details || 'Appointment confirmation';

    // Generate realistic outbound reminder dialogue using fast LLM or fallback
    let outcome: 'Booked' | 'Resolved' = 'Resolved';
    let duration = Math.floor(Math.random() * 40) + 45; // 45-85 seconds
    let summary = `Outbound call to ${contactName} for ${reason}. Contact confirmed details with assistant.`;
    let transcriptTurns = [
      {
        role: 'agent' as const,
        text: `Hello ${contactName}! This is the AI assistant calling from ${businessName} regarding your ${reason}. Am I speaking with ${contactName}?`,
      },
      {
        role: 'caller' as const,
        text: `Yes, hello! That's me.`,
      },
      {
        role: 'agent' as const,
        text: `Great! We are calling to confirm everything is set and answer any questions you might have before your visit.`,
      },
      {
        role: 'caller' as const,
        text: `Everything looks good, thank you so much for checking in!`,
      },
      {
        role: 'agent' as const,
        text: `You are very welcome! We look forward to seeing you. Have a wonderful day!`,
      },
    ];

    try {
      const prompt = `You are a Voice AI outbound telephone simulator.
Simulate a brief 3-turn outbound phone call from "${businessName}" calling "${contactName}" for "${reason}".
Output JSON only:
{
  "summary": "1-sentence summary",
  "outcome": "Resolved",
  "turns": [
    {"role": "agent", "text": "greeting"},
    {"role": "caller", "text": "response"},
    {"role": "agent", "text": "confirmation"},
    {"role": "caller", "text": "thanks"},
    {"role": "agent", "text": "closing"}
  ]
}`;
      const llmRes = await callLLM(prompt, { temperature: 0.3, maxOutputTokens: 500 });
      const cleaned = llmRes.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed.turns) && parsed.turns.length > 0) {
        transcriptTurns = parsed.turns;
        if (parsed.summary) summary = parsed.summary;
      }
    } catch {
      // Use fallback template
    }

    const conversationRecord: Conversation = {
      id: `call-outbound-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      callerName: contactName,
      startTime: new Date().toISOString(),
      duration,
      language: 'English',
      outcome,
      summary,
      transcript: transcriptTurns,
      isSample: false,
    };

    return NextResponse.json({
      success: true,
      contactId: contact.id,
      outcome: 'Confirmed',
      duration,
      conversation: conversationRecord,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Outbound campaign call execution failed.' },
      { status: 500 }
    );
  }
}
