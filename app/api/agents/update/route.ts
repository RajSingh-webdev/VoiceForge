import { NextRequest, NextResponse } from 'next/server';
import { getAgent, updateAgent, mapConfigToElevenLabsPayload } from '@/lib/elevenlabs';
import { AgentConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON with agentId and config.' },
        { status: 400 }
      );
    }

    const { agentId, config } = body as { agentId?: string; config?: AgentConfig };

    if (!agentId || typeof agentId !== 'string' || !agentId.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid agentId.' },
        { status: 400 }
      );
    }

    const cleanAgentId = agentId.trim();

    if (!config || typeof config !== 'object' || !config.name || typeof config.name !== 'string') {
      return NextResponse.json(
        { error: 'Invalid assistant configuration. Agent name is required.' },
        { status: 400 }
      );
    }

    // 1. Verify agent exists in our workspace
    let existingAgent: any;
    try {
      existingAgent = await getAgent(cleanAgentId);
    } catch (err: any) {
      const msg = err?.message || 'Agent not found in workspace';
      if (msg.includes('not found')) {
        return NextResponse.json({ error: msg }, { status: 404 });
      }
      if (msg.includes('Invalid ElevenLabs API key')) {
        return NextResponse.json({ error: msg }, { status: 401 });
      }
      if (msg.includes('Permission missing')) {
        return NextResponse.json({ error: msg }, { status: 403 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!existingAgent) {
      return NextResponse.json(
        { error: `ElevenLabs agent "${cleanAgentId}" does not exist in this workspace.` },
        { status: 404 }
      );
    }

    // 2. Prepare expected payload
    const mapped = mapConfigToElevenLabsPayload(config);
    const { systemPrompt, welcomeMessage, welcomeMessageHindi, hasHindi, primaryLanguage, chosenVoiceId } = mapped;

    // 3. Send update to ElevenLabs (or mock store)
    try {
      await updateAgent(cleanAgentId, config);
    } catch (err: any) {
      const msg = err?.message || 'Failed to update agent in ElevenLabs.';
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
      if (msg.includes('Invalid ElevenLabs API key')) {
        return NextResponse.json({ error: msg }, { status: 401 });
      }
      if (msg.includes('Permission missing')) {
        return NextResponse.json({ error: msg }, { status: 403 });
      }
      if (msg.includes('quota limit')) {
        return NextResponse.json({ error: msg }, { status: 429 });
      }
      if (msg.includes('rejected')) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // 4. Allow a brief moment for database consistency before readback
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 5. Read the agent back with getAgent
    let readBackAgent: any;
    try {
      readBackAgent = await getAgent(cleanAgentId);
    } catch (err: any) {
      return NextResponse.json(
        { error: `Update was sent but failed to verify agent state: ${err?.message || 'Verification read failed'}` },
        { status: 502 }
      );
    }

    // 6. Compare the first message, system prompt, language settings, and voice ID with what we sent
    const actualFirstMessage = (readBackAgent?.conversationConfig?.agent?.first_message || '').trim();
    const actualSystemPrompt = (readBackAgent?.conversationConfig?.agent?.prompt?.prompt || '').trim();
    const actualLanguage = (readBackAgent?.conversationConfig?.agent?.language || '').trim().toLowerCase();
    const actualVoiceId = (readBackAgent?.conversationConfig?.tts?.voice_id || '').trim();

    const expectedFirstMessage = welcomeMessage.trim();
    const expectedSystemPrompt = systemPrompt.trim();
    const expectedLanguage = (primaryLanguage || 'en').trim().toLowerCase();
    const expectedVoiceId = (chosenVoiceId || '').trim();

    const firstMessageMatches = actualFirstMessage === expectedFirstMessage;
    const promptMatches = actualSystemPrompt === expectedSystemPrompt;
    const languageMatches = actualLanguage === expectedLanguage;
    const voiceIdMatches = !expectedVoiceId || actualVoiceId === expectedVoiceId;

    // Check language preset for Hindi when enabled
    let languagePresetsMatch = true;
    let hindiPresetDiff = '';
    if (hasHindi) {
      const readBackPresets = readBackAgent?.conversationConfig?.language_presets;
      const hindiPreset = readBackPresets?.hi;
      if (!hindiPreset) {
        languagePresetsMatch = false;
        hindiPresetDiff = 'missing Hindi language preset';
      } else if (welcomeMessageHindi) {
        const actualHindiGreeting = (
          hindiPreset.overrides?.agent?.first_message ||
          hindiPreset.first_message ||
          ''
        ).trim();
        if (actualHindiGreeting && actualHindiGreeting !== welcomeMessageHindi.trim()) {
          languagePresetsMatch = false;
          hindiPresetDiff = 'Hindi welcome message differed from expected';
        } else if (hindiPreset.overrides?.tts?.model_id && hindiPreset.overrides.tts.model_id !== 'eleven_flash_v2_5') {
          languagePresetsMatch = false;
          hindiPresetDiff = 'Hindi TTS model override differed from expected';
        }
      }
    }

    if (!firstMessageMatches || !promptMatches || !languageMatches || !languagePresetsMatch || !voiceIdMatches) {
      const differences: string[] = [];
      if (!firstMessageMatches) {
        differences.push('first message (welcome greeting)');
      }
      if (!promptMatches) {
        differences.push('system prompt (persona, flow steps, guardrails, or business facts)');
      }
      if (!languageMatches) {
        differences.push(`primary language (expected "${expectedLanguage}", received "${actualLanguage || 'none'}")`);
      }
      if (!languagePresetsMatch) {
        differences.push(`Hindi language settings (${hindiPresetDiff || 'preset did not match'})`);
      }
      if (!voiceIdMatches) {
        differences.push(`voice ID (expected "${expectedVoiceId}", received "${actualVoiceId || 'none'}")`);
      }

      return NextResponse.json(
        {
          error: `Update did not take effect: ${differences.join(' and ')} did not match the expected configuration.`,
          differences: {
            firstMessageMatches,
            promptMatches,
            languageMatches,
            languagePresetsMatch,
            voiceIdMatches,
          },
        },
        { status: 502 }
      );
    }

    // 7. Success
    return NextResponse.json({
      success: true,
      agentId: cleanAgentId,
      name: config.name,
      isSample: existingAgent.isSample === true,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    const sanitized = (err?.message || 'Internal server error while updating agent')
      .replace(/sk_[a-zA-Z0-9_-]+/g, '[REDACTED]')
      .replace(/xi-api-key:[^\s]+/gi, 'xi-api-key: [REDACTED]');

    return NextResponse.json(
      { error: sanitized },
      { status: 500 }
    );
  }
}
