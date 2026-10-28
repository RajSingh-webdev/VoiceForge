import { NextRequest, NextResponse } from 'next/server';
import { createAgent } from '@/lib/elevenlabs';
import { isValidAgentConfig } from '@/lib/types';

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
      { error: 'Request body must be a JSON object containing "config".' },
      { status: 400 }
    );
  }

  const { config } = body;

  if (!config || !isValidAgentConfig(config)) {
    return NextResponse.json(
      { error: 'A valid saved agent configuration is required to create an agent.' },
      { status: 400 }
    );
  }

  try {
    const deployment = await createAgent(config);
    return NextResponse.json({
      agentId: deployment.agentId,
      createdAt: deployment.createdAt,
      isSample: deployment.isSample,
      name: deployment.name,
      status: deployment.status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to create agent in ElevenLabs.' },
      { status: 500 }
    );
  }
}
