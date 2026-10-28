import { NextResponse } from 'next/server';
import { listConversations } from '@/lib/elevenlabs';

export async function GET() {
  try {
    const conversations = await listConversations();
    return NextResponse.json({ conversations });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve conversations.' },
      { status: 500 }
    );
  }
}
