import { NextResponse } from 'next/server';
import { listVoices } from '@/lib/elevenlabs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const voices = await listVoices();
    return NextResponse.json({
      voices,
      isSample: voices.some((v) => v.isSample),
    });
  } catch (err: any) {
    const msg: string = (err?.message || 'Failed to list voices').replace(/sk_[a-zA-Z0-9_-]+/g, '[REDACTED]');
    const lower = msg.toLowerCase();

    if (lower.includes('missing environment variable')) {
      return NextResponse.json(
        { error: 'ElevenLabs is not configured. Missing ELEVENLABS_API_KEY on the server.' },
        { status: 500 }
      );
    }

    if (lower.includes('invalid elevenlabs api key') || lower.includes('invalid') && lower.includes('key')) {
      return NextResponse.json(
        { error: 'Invalid ElevenLabs API key. Please check your credentials.' },
        { status: 401 }
      );
    }

    if (lower.includes('permission missing') || lower.includes('403')) {
      return NextResponse.json(
        { error: 'Permission missing. Your ElevenLabs API key lacks permissions to list voices.' },
        { status: 403 }
      );
    }

    if (lower.includes('quota') || lower.includes('credit') || lower.includes('429')) {
      return NextResponse.json(
        { error: 'ElevenLabs quota limit reached or insufficient account credits to retrieve voices.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: msg || 'Failed to retrieve voice list from ElevenLabs.' },
      { status: 500 }
    );
  }
}
