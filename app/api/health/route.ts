import { NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';

export async function GET() {
  try {
    const reply = await callLLM('Reply with the single word OK');
    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to call LLM' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const reply = await callLLM('Reply with the single word OK');
    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to call LLM' },
      { status: 500 }
    );
  }
}
