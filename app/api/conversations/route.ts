import { NextResponse } from 'next/server';
import { listConversations, getConversation } from '@/lib/elevenlabs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agent_id') || searchParams.get('agentId') || undefined;
    const source = (searchParams.get('source') as 'real' | 'sample') || undefined;
    const conversationId = searchParams.get('id') || undefined;

    if (conversationId) {
      const single = await getConversation(conversationId);
      return NextResponse.json({ conversation: single });
    }

    const result = await listConversations({ agentId, source });
    return NextResponse.json({
      conversations: result.conversations,
      isSample: result.isSample,
      totalReal: result.totalReal,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve conversations.' },
      { status: 500 }
    );
  }
}
