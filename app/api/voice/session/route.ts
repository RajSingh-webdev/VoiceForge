import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl, getAgent, isRealVoiceEnabled } from '@/lib/elevenlabs';

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const isRealVoice = isRealVoiceEnabled();
  const handMadeAgentId = (process.env.ELEVENLABS_AGENT_ID || '').trim();

  const requestedAgentId = (
    req.nextUrl.searchParams.get('agent_id') ||
    req.nextUrl.searchParams.get('agentId') ||
    ''
  ).trim();

  if (!requestedAgentId) {
    return NextResponse.json({
      realVoice: isRealVoice,
      handMadeAgentId: handMadeAgentId || null,
      message: isRealVoice ? undefined : 'Voice is not connected yet',
    });
  }

  if (!isRealVoice) {
    return NextResponse.json(
      {
        realVoice: false,
        message: 'Voice is not connected yet',
        signedUrl: `wss://api.elevenlabs.io/v1/convai/conversation?mock=true&agent_id=${requestedAgentId}`,
        activeAgentId: requestedAgentId,
      },
      { status: 200 }
    );
  }

  try {
    await getAgent(requestedAgentId);
    const { signedUrl } = await getSignedUrl(requestedAgentId);
    return NextResponse.json({
      signedUrl,
      realVoice: true,
      activeAgentId: requestedAgentId,
    });
  } catch (err: any) {
    const msg: string = (err?.message || '').toLowerCase();
    if (msg.includes('not found')) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: err?.message || 'Failed to create voice session.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const isRealVoice = isRealVoiceEnabled();

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is acceptable if falling back
  }

  const requestedAgentId = (
    body.agentId ||
    body.agent_id ||
    process.env.ELEVENLABS_AGENT_ID ||
    ''
  ).trim();

  if (!requestedAgentId) {
    return NextResponse.json(
      {
        error:
          'No agent ID provided. Please select an agent or configure ELEVENLABS_AGENT_ID.',
      },
      { status: 400 }
    );
  }

  if (!isRealVoice) {
    return NextResponse.json(
      {
        realVoice: false,
        message: 'Voice is not connected yet',
        signedUrl: `wss://api.elevenlabs.io/v1/convai/conversation?mock=true&agent_id=${requestedAgentId}`,
        activeAgentId: requestedAgentId,
      },
      { status: 200 }
    );
  }

  try {
    // Requirement 5: Verify the id exists in our ElevenLabs workspace with getAgent before creating a session, and refuse anything else.
    await getAgent(requestedAgentId);

    const { signedUrl } = await getSignedUrl(requestedAgentId);

    return NextResponse.json({
      signedUrl,
      realVoice: true,
      activeAgentId: requestedAgentId,
    });
  } catch (err: any) {
    const msg: string = (err?.message || '').toLowerCase();

    if (msg.includes('missing environment variable')) {
      const varName = err.message.split(':')[1]?.trim() || 'configuration';
      return NextResponse.json(
        {
          error: `Missing environment variable: ${varName}. Please configure it on the server.`,
          realVoice: true,
        },
        { status: 500 }
      );
    }

    if (msg.includes('not found') || msg.includes('404')) {
      return NextResponse.json(
        {
          error: `ElevenLabs agent "${requestedAgentId}" was not found in your ElevenLabs workspace.`,
          realVoice: true,
        },
        { status: 404 }
      );
    }

    if (msg.includes('invalid') || msg.includes('401')) {
      return NextResponse.json(
        {
          error: 'Invalid ElevenLabs API key. Please verify your credentials.',
          realVoice: true,
        },
        { status: 401 }
      );
    }

    if (msg.includes('permission') || msg.includes('403')) {
      return NextResponse.json(
        {
          error: 'Permission missing. Your ElevenLabs API key lacks Conversational AI access.',
          realVoice: true,
        },
        { status: 403 }
      );
    }

    if (msg.includes('quota') || msg.includes('credit') || msg.includes('429')) {
      return NextResponse.json(
        {
          error: 'ElevenLabs quota limit reached or insufficient account credits.',
          realVoice: true,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error:
          err?.message ||
          'Failed to establish voice session with ElevenLabs. Please try again.',
        realVoice: true,
      },
      { status: 500 }
    );
  }
}
