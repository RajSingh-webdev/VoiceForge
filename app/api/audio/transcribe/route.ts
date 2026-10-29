import { NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/elevenlabs';

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = (formData.get('file') || formData.get('audio')) as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 });
    }

    if (file.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: 'Audio file exceeds 25MB limit.' },
        { status: 400 }
      );
    }

    const fileName = file.name || 'audio.mp3';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'audio/mpeg';

    const result = await transcribeAudio(buffer, fileName, mimeType);

    return NextResponse.json({
      success: true,
      text: result.text,
      language_code: result.language_code,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to transcribe audio.' },
      { status: 500 }
    );
  }
}
