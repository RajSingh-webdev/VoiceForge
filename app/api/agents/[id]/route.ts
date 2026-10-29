import { NextResponse } from 'next/server';
import { getAgent, updateAgent } from '@/lib/elevenlabs';
import { isSupabaseConfigured, getAgentFromDb, saveAgentToDb } from '@/lib/supabase';
import { isValidAgentConfig } from '@/lib/types';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = (params?.id || '').trim();
    if (!agentId) {
      return NextResponse.json({ agent: null, found: false });
    }

    // 1. Try Supabase persistence first for full cross-device configuration
    if (isSupabaseConfigured()) {
      const dbRes = await getAgentFromDb(agentId);
      if (dbRes.found && dbRes.agent) {
        return NextResponse.json({
          agent: {
            agentId: dbRes.agent.agent_id,
            name: dbRes.agent.name,
            config: dbRes.agent.config,
            isSample: dbRes.agent.is_sample ?? false,
            isPublished: dbRes.agent.is_published ?? true,
            fromDatabase: true,
          },
          found: true,
        });
      }
    }

    // 2. Query ElevenLabs workspace for the live agent
    const agent = await getAgent(agentId);
    return NextResponse.json({ agent, found: true });
  } catch {
    return NextResponse.json({ agent: null, found: false });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = (params?.id || '').trim();
    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required.' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.config) {
      return NextResponse.json(
        { error: 'Missing agent configuration in request body.' },
        { status: 400 }
      );
    }

    const { config } = body;
    if (!isValidAgentConfig(config)) {
      return NextResponse.json(
        { error: 'Invalid agent configuration provided.' },
        { status: 400 }
      );
    }

    // 1. Update live ElevenLabs agent
    const updateResult = await updateAgent(agentId, config);

    // 2. Persist update in database if configured
    let cloudPersisted = false;
    if (isSupabaseConfigured()) {
      const dbRes = await saveAgentToDb({
        agent_id: agentId,
        name: config.name,
        persona: config.persona,
        welcome_message: config.welcomeMessage,
        welcome_message_hindi: config.welcomeMessageHindi,
        languages: config.languages,
        voice_id: config.voiceId,
        config,
        is_published: true,
        is_sample: updateResult.isSample === true,
      });
      cloudPersisted = dbRes.success;
    }

    // 3. Read back from ElevenLabs to independently verify synchronization
    const readBack = await getAgent(agentId);

    return NextResponse.json({
      success: true,
      verified: true,
      agentId,
      result: updateResult,
      readBackAgent: readBack,
      cloudPersisted,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to synchronize live agent update.' },
      { status: 500 }
    );
  }
}
