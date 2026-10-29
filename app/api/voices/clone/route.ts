import { NextResponse } from 'next/server';
import { cloneVoice } from '@/lib/elevenlabs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac']);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string || '').trim();
    const description = (formData.get('description') as string || '').trim();
    const consent = formData.get('consent');

    // 1. Mandatory consent check (Responsible AI / ElevenLabs Hackathon Rule)
    const hasConsent = consent === 'true' || consent === '1';
    if (!hasConsent) {
      return NextResponse.json(
        {
          error:
            'Explicit consent is required. You must confirm that you have documented permission or ownership to use this voice sample.',
        },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: 'Please provide an audio sample file.' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: 'Please enter a name for the custom voice.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Audio file exceeds the maximum allowed size of 10MB.' },
        { status: 400 }
      );
    }

    const fileName = file.name || 'sample.mp3';
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_AUDIO_EXTENSIONS.has(ext) && !file.type.startsWith('audio/')) {
      return NextResponse.json(
        { error: 'Invalid audio format. Please upload an MP3, WAV, M4A, or OGG file.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const voice = await cloneVoice(buffer, fileName, name, description);

    return NextResponse.json({
      success: true,
      voice,
    });
  } catch (err: any) {
    const msg = err?.message || 'Failed to clone voice.';
    let status = 500;
    if (msg.includes('consent') || msg.includes('format') || msg.includes('audio') || msg.includes('file')) {
      status = 400;
    } else if (msg.includes('API key') || msg.includes('credentials')) {
      status = 401;
    } else if (msg.includes('restricted') || msg.includes('plan')) {
      status = 403;
    } else if (msg.includes('quota') || msg.includes('credits')) {
      status = 429;
    }
    return NextResponse.json({ error: msg }, { status });
  }
}
