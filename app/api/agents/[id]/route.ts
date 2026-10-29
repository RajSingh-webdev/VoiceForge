import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/elevenlabs';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = (params?.id || '').trim();
    if (!agentId) {
      return NextResponse.json({ agent: null, found: false });
    }

    const agent = await getAgent(agentId);
    return NextResponse.json({ agent, found: true });
  } catch {
    return NextResponse.json({ agent: null, found: false });
  }
}
