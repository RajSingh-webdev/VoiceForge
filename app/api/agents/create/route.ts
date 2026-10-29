import { NextRequest, NextResponse } from 'next/server';
import { createAgent } from '@/lib/elevenlabs';
import { isValidAgentConfig } from '@/lib/types';
import { isSupabaseConfigured, saveAgentToDb } from '@/lib/supabase';

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

    let cloudPersisted = false;
    if (isSupabaseConfigured()) {
      const dbRes = await saveAgentToDb({
        agent_id: deployment.agentId,
        name: config.name,
        persona: config.persona,
        welcome_message: config.welcomeMessage,
        welcome_message_hindi: config.welcomeMessageHindi,
        languages: config.languages,
        voice_id: config.voiceId,
        config,
        is_published: true,
        is_sample: deployment.isSample === true,
      });
      cloudPersisted = dbRes.success;
    }

    return NextResponse.json({
      agentId: deployment.agentId,
      createdAt: deployment.createdAt,
      isSample: deployment.isSample,
      name: deployment.name,
      status: deployment.status,
      cloudPersisted,
    });
  } catch (err: any) {
    const msg: string = (err?.message || '').toLowerCase();

    if (
      msg.includes('restricted') ||
      msg.includes('tier') ||
      msg.includes('plan') ||
      msg.includes('upgrade') ||
      msg.includes('library voices') ||
      msg.includes('subscription')
    ) {
      return NextResponse.json(
        {
          error:
            'The selected voice is restricted on your current ElevenLabs plan. Please choose a default premade voice or upgrade your ElevenLabs subscription.',
        },
        { status: 400 }
      );
    }

    if (msg.includes('missing environment variable')) {
      const varName = err.message.split(':')[1]?.trim() || 'configuration';
      return NextResponse.json(
        { error: `Missing server configuration: ${varName}. Please configure it in server environment.` },
        { status: 500 }
      );
    }

    if (msg.includes('invalid') && (msg.includes('api key') || msg.includes('401'))) {
      return NextResponse.json(
        { error: 'Invalid ElevenLabs API key. Please check your credentials.' },
        { status: 401 }
      );
    }

    if (msg.includes('permission') || msg.includes('403')) {
      return NextResponse.json(
        { error: 'Permission missing. Your ElevenLabs API key lacks Conversational AI agent creation permissions.' },
        { status: 403 }
      );
    }

    if (msg.includes('quota') || msg.includes('credit') || msg.includes('429')) {
      return NextResponse.json(
        { error: 'ElevenLabs quota limit reached or insufficient account credits to create an agent.' },
        { status: 429 }
      );
    }

    if (msg.includes('rejected') || msg.includes('invalid fields') || msg.includes('422')) {
      return NextResponse.json(
        { error: err?.message || 'ElevenLabs rejected the agent configuration.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create agent in ElevenLabs. Please try again.' },
      { status: 500 }
    );
  }
}
