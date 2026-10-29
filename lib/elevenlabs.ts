import { Conversation, AgentConfig, VoiceItem, KnowledgeBaseDoc } from './types';

function ensureServerSide() {
  if (typeof window !== 'undefined') {
    throw new Error('ElevenLabs module can only be executed on the server.');
  }
}

export function isRealElevenLabsEnabled(): boolean {
  if (process.env.USE_MOCK_ELEVENLABS === 'true') {
    return false;
  }
  if (process.env.ELEVENLABS_REAL_AGENTS === 'true') {
    return true;
  }
  return (
    process.env.USE_MOCK_ELEVENLABS === 'false' &&
    Boolean(process.env.ELEVENLABS_API_KEY?.trim())
  );
}

export function isRealVoiceEnabled(): boolean {
  if (process.env.USE_MOCK_ELEVENLABS === 'true') {
    return false;
  }
  if (process.env.ELEVENLABS_REAL_VOICE === 'true') {
    return true;
  }
  return (
    process.env.USE_MOCK_ELEVENLABS === 'false' &&
    Boolean(process.env.ELEVENLABS_API_KEY?.trim())
  );
}

function checkMockMode() {
  ensureServerSide();
  const isMock = !isRealElevenLabsEnabled();
  if (!isMock) {
    throw new Error('Real ElevenLabs calls are not connected yet');
  }
}

function checkAiDisclosure(text: string): boolean {
  const lower = (text || '').toLowerCase();
  return (
    /\bai\b/.test(lower) ||
    lower.includes('artificial intelligence') ||
    lower.includes('virtual assistant') ||
    lower.includes('automated assistant') ||
    lower.includes('digital assistant') ||
    /\bbot\b/.test(lower)
  );
}

function enforceAiDisclosure(message: string, agentName: string): string {
  if (checkAiDisclosure(message)) {
    return message;
  }
  const prefix = agentName
    ? `Hi, I am the AI assistant for ${agentName}.`
    : 'Hi, I am an AI assistant.';
  return `${prefix} ${message || ''}`.trim();
}

export function checkHindiAiDisclosure(text: string): boolean {
  const lower = (text || '').toLowerCase();
  return (
    /\bai\b/.test(lower) ||
    lower.includes('एआई') ||
    lower.includes('आर्टिफिशियल इंटेलिजेंस') ||
    lower.includes('virtual assistant') ||
    lower.includes('सहायक') ||
    lower.includes('assistant') ||
    /\bbot\b/.test(lower) ||
    lower.includes('बॉट')
  );
}

export function enforceHindiAiDisclosure(message: string, agentName: string): string {
  const trimmed = (message || '').trim();
  if (trimmed && checkHindiAiDisclosure(trimmed)) {
    return trimmed;
  }
  const prefix = agentName
    ? `नमस्ते! मैं ${agentName} का AI सहायक हूँ।`
    : 'नमस्ते! मैं एक AI सहायक हूँ।';
  return trimmed ? `${prefix} ${trimmed}` : `${prefix} आज मैं आपकी क्या मदद कर सकता हूँ?`;
}

export function buildAgentSystemPrompt(config: AgentConfig): string {
  const sections: string[] = [];

  // 1. Identity & Persona
  sections.push(
    `### Persona & Role\n${config.persona || `You are an AI assistant for ${config.name}.`}`
  );

  // 2. Goals
  if (config.goals && config.goals.length > 0) {
    sections.push(`### Goals\n${config.goals.map((g) => `- ${g}`).join('\n')}`);
  }

  // 3. Conversation Flow Steps
  if (config.flowSteps && config.flowSteps.length > 0) {
    const stepsFormatted = config.flowSteps
      .map((s, idx) => `${idx + 1}. **${s.title}**: ${s.instruction}`)
      .join('\n');
    sections.push(`### Conversation Flow\n${stepsFormatted}`);
  }

  // 4. Guardrails
  if (config.guardrails && config.guardrails.length > 0) {
    sections.push(
      `### Guardrails & Policies\n${config.guardrails.map((gr) => `- ${gr}`).join('\n')}`
    );
  }

  // 5. Business Facts (from config.knowledge when present)
  if (config.knowledge) {
    const k = config.knowledge;
    const factsList: string[] = [];

    if (k.business_name) {
      factsList.push(`- **Business Name**: ${k.business_name}`);
    }
    if (k.business_type) {
      factsList.push(`- **Business Type**: ${k.business_type}`);
    }
    if (k.opening_hours) {
      factsList.push(`- **Opening Hours**: ${k.opening_hours}`);
    }
    if (k.contact) {
      factsList.push(`- **Contact Information**: ${k.contact}`);
    }
    if (k.services && k.services.length > 0) {
      factsList.push(
        `- **Services Offered**:\n${k.services.map((s) => `  * ${s}`).join('\n')}`
      );
    }
    if (k.prices && k.prices.length > 0) {
      factsList.push(
        `- **Pricing**:\n${k.prices.map((p) => `  * ${p.item}: ${p.price}`).join('\n')}`
      );
    }
    if (k.faqs && k.faqs.length > 0) {
      factsList.push(
        `- **Frequently Asked Questions**:\n${k.faqs
          .map((f) => `  * Q: ${f.question}\n    A: ${f.answer}`)
          .join('\n')}`
      );
    }

    if (factsList.length > 0) {
      sections.push(`### Business Facts\n${factsList.join('\n')}`);
    }
  }

  // 6. Mandatory Rules
  sections.push(`### Core Operating Rules
- You are an AI assistant. You must clearly say so at the start of the conversation.
- Use ONLY the verified business facts given above.
- NEVER invent prices, hours, services, or clinic policies.
- If you do not know an answer or the information is not in the business facts, say so honestly and offer a callback from front desk staff.
- Transfer to a human staff member immediately if the caller asks to speak to a person, mentions pain, or reports an emergency (explain verbally that you are routing them to a human team member).
- Appointment Booking: Collect the caller's full name, phone number, desired appointment date, and time. Never state an appointment is confirmed until the booking system tool confirms it. If the booking tool fails or is unavailable, take a message and inform the caller that clinic staff will call them back to confirm.
- Reply in the caller's language (fluent English or Hindi / Hinglish based on the language they speak).`);

  return sections.join('\n\n');
}

export const SAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-001',
    callerName: 'Sarah Jenkins',
    startTime: '2026-10-28T09:15:00Z',
    duration: 145,
    language: 'English',
    outcome: 'Booked',
    summary:
      'Caller requested a routine teeth cleaning and examination for next Tuesday morning. The assistant confirmed clinic availability, booked the 10:00 AM slot, and sent a confirmation SMS.',
    transcript: [
      {
        role: 'agent',
        text: "Hello! I am the AI receptionist for Smile Dental. How can I help you today?",
      },
      {
        role: 'caller',
        text: 'Hi there, I would like to schedule a routine dental cleaning and checkup for next week.',
      },
      {
        role: 'agent',
        text: 'I would be happy to help with that. We have Tuesday at 10:00 AM or Wednesday at 2:30 PM open. Which works better for you?',
      },
      {
        role: 'caller',
        text: 'Tuesday at 10:00 AM is perfect for me.',
      },
      {
        role: 'agent',
        text: 'Great! May I please have your full name and a mobile number for the booking confirmation?',
      },
      {
        role: 'caller',
        text: 'My name is Sarah Jenkins, and my number is 555-0143.',
      },
      {
        role: 'agent',
        text: "You are all set for Tuesday at 10:00 AM with Dr. Gupta, Sarah! We look forward to seeing you at Smile Dental.",
      },
    ],
  },
  {
    id: 'conv-002',
    callerName: 'Marcus Chen',
    startTime: '2026-10-28T09:42:00Z',
    duration: 110,
    language: 'English',
    outcome: 'Resolved',
    summary:
      'Caller enquired about the cost of professional teeth whitening and whether payment plans are available. The assistant provided the verified $250 rate and explained the flexible installment options.',
    transcript: [
      {
        role: 'agent',
        text: "Hello! I am the AI assistant for Smile Dental Clinic. How may I assist you today?",
      },
      {
        role: 'caller',
        text: 'Hi, can you tell me how much in-office teeth whitening costs at your clinic?',
      },
      {
        role: 'agent',
        text: 'Our in-office professional whitening treatment is $250. It includes a complete shade assessment and take-home touch-up gel.',
      },
      {
        role: 'caller',
        text: 'Do you offer any payment installment plans for cosmetic treatments?',
      },
      {
        role: 'agent',
        text: 'Yes, we provide interest-free monthly installment plans through our clinic partner. Would you like to book a consultation to get started?',
      },
      {
        role: 'caller',
        text: 'That sounds reasonable. I will discuss it with my spouse and call back to book. Thank you!',
      },
    ],
  },
  {
    id: 'conv-003',
    callerName: 'Rahul Mehta',
    startTime: '2026-10-28T10:05:00Z',
    duration: 180,
    language: 'Mixed',
    outcome: 'Booked',
    summary:
      'Caller enquired in Hinglish regarding Saturday appointment availability for a root canal assessment. The assistant responded fluently in mixed Hindi-English and booked a 2:00 PM slot.',
    transcript: [
      {
        role: 'agent',
        text: "Namaste! Main Smile Dental Clinic ka AI assistant hoon. Aaj main aapki kya madad kar sakta hoon?",
      },
      {
        role: 'caller',
        text: 'Hello, mujhe iss Saturday ko root canal checkup karwana hai. Kya Dr. Verma available hain?',
      },
      {
        role: 'agent',
        text: 'Ji haan, Dr. Verma Saturday afternoon ko available hain. Kya 2:00 PM ka time aapke liye comfortable rahega?',
      },
      {
        role: 'caller',
        text: 'Haan, 2:00 PM theek hai. Please book kar dijiye.',
      },
      {
        role: 'agent',
        text: 'Maine aapka appointment Saturday 2:00 PM confirm kar diya hai Rahul ji. Confirmation details aapke registered phone number par bhej di gayi hain.',
      },
      {
        role: 'caller',
        text: 'Bahut shukriya aapka, thank you so much!',
      },
    ],
  },
  {
    id: 'conv-004',
    callerName: 'Elena Rostova',
    startTime: '2026-10-28T10:30:00Z',
    duration: 85,
    language: 'English',
    outcome: 'Transferred to human',
    summary:
      'Caller reported acute, throbbing dental pain after an extraction yesterday and needed immediate medical attention. The assistant recognized the clinical urgency and promptly transferred the call to the emergency dentist.',
    transcript: [
      {
        role: 'agent',
        text: "Hi, I am the AI receptionist for Smile Dental. How can I help you today?",
      },
      {
        role: 'caller',
        text: 'I had an extraction yesterday and I am in unbearable, throbbing pain right now. Painkillers are not helping at all.',
      },
      {
        role: 'agent',
        text: 'I am so sorry you are experiencing such severe pain. Because this is an urgent dental matter, I am transferring your call immediately to our on-call dentist. Please hold.',
      },
      {
        role: 'caller',
        text: 'Yes please, thank you hurry.',
      },
    ],
  },
  {
    id: 'conv-005',
    callerName: 'David Miller',
    startTime: '2026-10-28T11:10:00Z',
    duration: 130,
    language: 'English',
    outcome: 'Flagged',
    summary:
      'Caller repeatedly enquired about parking facilities and whether validated underground parking is available. The assistant lacked parking information in its knowledge base and could not answer the enquiry.',
    transcript: [
      {
        role: 'agent',
        text: "Hello! I am the AI assistant for Smile Dental. How can I assist you with your visit today?",
      },
      {
        role: 'caller',
        text: 'Hi, I have an appointment this afternoon. Do you have dedicated patient parking or validated garage parking nearby?',
      },
      {
        role: 'agent',
        text: 'Smile Dental is located at 124 Main Street. However, I currently do not have specific parking or validation details in my knowledge base.',
      },
      {
        role: 'caller',
        text: 'Is there street parking or will I get ticketed? This is really important before I drive down.',
      },
      {
        role: 'agent',
        text: 'I apologize, but I do not have information about parking availability or street meters. I recommend calling our front desk team directly for parking guidance.',
      },
      {
        role: 'caller',
        text: 'That is frustrating. An office assistant should know where patients can park.',
      },
    ],
  },
  {
    id: 'conv-006',
    callerName: 'Priya Sharma',
    startTime: '2026-10-28T11:45:00Z',
    duration: 120,
    language: 'Hindi',
    outcome: 'Resolved',
    summary:
      'Caller enquired in Hindi regarding clinic timings and whether walk-in patients are accepted for consultations. The assistant provided verified clinic hours and recommended booking in advance.',
    transcript: [
      {
        role: 'agent',
        text: "Namaste! Main Smile Dental ka AI assistant hoon. Aaj main aapki kya seva kar sakta hoon?",
      },
      {
        role: 'caller',
        text: 'Namaste, kya aap bata sakte hain ki clinic aaj kitne baje tak open hai?',
      },
      {
        role: 'agent',
        text: 'Hum Monday se Friday subah 8 baje se shaam 6 baje tak khule hain. Saturday ko timings subah 9 se dopahar 2 baje tak hain.',
      },
      {
        role: 'caller',
        text: 'Kya bina appointment ke aane par doctor dekh lenge?',
      },
      {
        role: 'agent',
        text: 'Routine checkups ke liye hum pehle se appointment lene ki salah dete hain taaki aapko wait na karna pade. Kya main aapke liye koi slot reserve karun?',
      },
      {
        role: 'caller',
        text: 'Abhi nahi, main time check karke phone karti hoon. Dhanyavaad!',
      },
    ],
  },
  {
    id: 'conv-007',
    callerName: 'James Wilson',
    startTime: '2026-10-28T12:15:00Z',
    duration: 165,
    language: 'English',
    outcome: 'Booked',
    summary:
      'Caller wanted to book joint checkup appointments for both himself and his daughter on Thursday. The assistant scheduled consecutive slots starting at 3:00 PM and registered both patient profiles.',
    transcript: [
      {
        role: 'agent',
        text: "Hello! I am the AI assistant for Smile Dental. How can I help you today?",
      },
      {
        role: 'caller',
        text: 'Hi, I need to book two routine cleaning appointments back-to-back for myself and my daughter this Thursday.',
      },
      {
        role: 'agent',
        text: 'Certainly! On Thursday afternoon, we have consecutive slots available at 3:00 PM and 3:45 PM. Would that work well for both of you?',
      },
      {
        role: 'caller',
        text: 'That timing is ideal. Please book both.',
      },
      {
        role: 'agent',
        text: 'Wonderful. I have scheduled James Wilson for 3:00 PM and Emma Wilson for 3:45 PM this Thursday. Reminder messages have been sent to your mobile.',
      },
      {
        role: 'caller',
        text: 'Appreciate your quick help. Have a good day!',
      },
    ],
  },
  {
    id: 'conv-008',
    callerName: 'Kavita Patel',
    startTime: '2026-10-28T12:50:00Z',
    duration: 95,
    language: 'Mixed',
    outcome: 'Transferred to human',
    summary:
      'Caller had complicated questions regarding insurance co-pay pre-authorization for a dental bridge. The assistant recognized the specialized billing scenario and routed the call to the insurance coordinator.',
    transcript: [
      {
        role: 'agent',
        text: "Namaste! I am the AI receptionist for Smile Dental Clinic. How may I help you?",
      },
      {
        role: 'caller',
        text: 'Hello, mera insurance provider Delta Dental hai. Mujhe dental bridge ke pre-authorization claim ke baare mein specific questions hain.',
      },
      {
        role: 'agent',
        text: 'Insurance pre-authorizations involve detailed policy verification. Let me connect you directly with our clinic insurance and billing coordinator who can review your claim paperwork.',
      },
      {
        role: 'caller',
        text: 'Haan, please connect kar dijiye. Thank you.',
      },
    ],
  },
];

export interface MappedElevenLabsAgentPayload {
  payload: {
    name: string;
    conversation_config: {
      agent: {
        prompt: {
          prompt: string;
        };
        first_message: string;
        language: string;
      };
      tts: {
        model_id: string;
        voice_id: string;
      };
      asr?: {
        provider: string;
        quality: string;
        user_input_audio_format: string;
      };
      language_presets?: Record<string, any>;
    };
  };
  systemPrompt: string;
  welcomeMessage: string;
  welcomeMessageHindi?: string;
  hasHindi: boolean;
  primaryLanguage: string;
  languagePresets: Record<string, any>;
  chosenVoiceId: string;
  chosenHindiVoiceId?: string;
}

/**
 * Shared mapping from AgentConfig to the ElevenLabs agent payload.
 * Used by both createAgent and updateAgent so configuration and prompt logic cannot drift apart.
 */
export function mapConfigToElevenLabsPayload(config: AgentConfig): MappedElevenLabsAgentPayload {
  if (!config || !config.name) {
    throw new Error('Agent configuration must include a name.');
  }

  const systemPrompt = buildAgentSystemPrompt(config);
  const welcomeMessage = enforceAiDisclosure(config.welcomeMessage, config.name);
  const defaultVoiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  // Note: ElevenLabs requires English Agents (agent.language: 'en') to use 'eleven_flash_v2' or turbo for global TTS,
  // while language_presets.hi overrides tts.model_id to 'eleven_flash_v2_5' and tts.voice_id to the Indian Hindi voice.
  const ttsModelId = process.env.ELEVENLABS_TTS_MODEL || 'eleven_flash_v2';

  const hasHindi =
    Array.isArray(config.languages) &&
    config.languages.some(
      (l) => (l || '').toLowerCase().includes('hindi') || (l || '').toLowerCase() === 'hi'
    );

  let welcomeMessageHindi = '';
  const languagePresets: Record<string, any> = {};
  let chosenHindiVoiceId: string | undefined = undefined;

  if (hasHindi) {
    welcomeMessageHindi = enforceHindiAiDisclosure(
      config.welcomeMessageHindi ||
        (config.name
          ? `नमस्ते! मैं ${config.name} का AI सहायक हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?`
          : 'नमस्ते! मैं एक AI सहायक हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?'),
      config.name
    );

    // Requirement 6: Dedicated Indian Hindi voice for language preset
    chosenHindiVoiceId =
      config.voiceIdHindi?.trim() ||
      (config.voiceId && (config.voiceId === 'fTfuemKGBjYqG4ni4gw3' || config.voiceId === 'qdykssD3wAUvtIw9wG8N')
        ? config.voiceId.trim()
        : 'fTfuemKGBjYqG4ni4gw3'); // Ritu Rathore - Natural Conversational Hindi (verified reception voice)

    languagePresets['hi'] = {
      overrides: {
        agent: {
          first_message: welcomeMessageHindi,
          language: 'hi',
        },
        tts: {
          model_id: 'eleven_flash_v2_5',
          voice_id: chosenHindiVoiceId,
        },
      },
    };
  }

  const asrConfig = {
    provider: 'scribe_realtime',
    quality: 'high',
    user_input_audio_format: 'pcm_16000',
  };

  const chosenVoiceId =
    config?.voiceId && typeof config.voiceId === 'string' && config.voiceId.trim()
      ? config.voiceId.trim()
      : defaultVoiceId;

  const conversationConfig: any = {
    agent: {
      prompt: {
        prompt: systemPrompt,
      },
      first_message: welcomeMessage,
      language: 'en',
    },
    tts: {
      model_id: ttsModelId,
      voice_id: chosenVoiceId,
    },
    asr: asrConfig,
  };

  // Attach Knowledge Base documents if configured
  if (
    Array.isArray(config.knowledgeBaseDocuments) &&
    config.knowledgeBaseDocuments.length > 0
  ) {
    conversationConfig.agent.prompt.knowledge_base = config.knowledgeBaseDocuments.map(
      (doc) => ({
        type: doc.type || 'file',
        id: doc.id,
        name: doc.name,
        usage_mode: 'auto',
      })
    );
  }

  // Support expressive voice mode and voice settings
  if (config.expressiveMode || config.voiceSettings) {
    conversationConfig.tts.voice_settings = {
      stability: config.voiceSettings?.stability ?? (config.expressiveMode ? 0.35 : 0.65),
      similarity_boost: config.voiceSettings?.similarity_boost ?? 0.8,
    };
  }

  if (hasHindi && Object.keys(languagePresets).length > 0) {
    conversationConfig.language_presets = languagePresets;
  }

  // Connect real appointment booking tool if a public HTTPS URL is configured
  const appBaseUrl = (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  ).replace(/\/$/, '');

  if (appBaseUrl && appBaseUrl.startsWith('https://')) {
    const webhookSecret = process.env.BOOKING_WEBHOOK_SECRET?.trim();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (webhookSecret) {
      headers['x-webhook-secret'] = webhookSecret;
    }

    conversationConfig.agent.prompt.tools = [
      {
        type: 'webhook',
        name: 'book_appointment',
        description:
          'Record and confirm a patient appointment with the clinic. Call this tool when the patient provides their full name, phone number, preferred appointment date, and time.',
        api_schema: {
          url: `${appBaseUrl}/api/webhooks/booking`,
          method: 'POST',
          request_body_schema: {
            type: 'object',
            properties: {
              callerName: { type: 'string', description: 'Full name of the caller/patient' },
              callerPhone: { type: 'string', description: 'Contact phone number' },
              appointmentDate: { type: 'string', description: 'Requested appointment date (YYYY-MM-DD)' },
              appointmentTime: { type: 'string', description: 'Requested appointment time slot' },
              service: { type: 'string', description: 'Requested service or treatment' },
              notes: { type: 'string', description: 'Any symptoms or additional notes' },
            },
            required: ['callerName', 'callerPhone', 'appointmentDate', 'appointmentTime'],
          },
          request_headers: headers,
        },
      },
    ];
  }

  return {
    payload: {
      name: config.name,
      conversation_config: conversationConfig,
    },
    systemPrompt,
    welcomeMessage,
    welcomeMessageHindi: hasHindi ? welcomeMessageHindi : undefined,
    hasHindi,
    primaryLanguage: 'en',
    languagePresets,
    chosenVoiceId,
    chosenHindiVoiceId: hasHindi ? chosenHindiVoiceId : undefined,
  };
}

// In-memory mock store for consistent agent state in mock mode
const mockAgentStore = new Map<
  string,
  {
    name: string;
    conversation_config: any;
  }
>();

export async function createAgent(config: any): Promise<any> {
  ensureServerSide();
  const isRealAgents = isRealElevenLabsEnabled();

  if (!isRealAgents) {
    // Keep existing mock behaviour
    checkMockMode();
    const slug = config?.name
      ? config.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      : 'smile-dental';
    const sampleId = `sample-agent-${slug || 'smile-dental'}`;
    const mapped = mapConfigToElevenLabsPayload(config);
    mockAgentStore.set(sampleId, {
      name: config.name,
      conversation_config: mapped.payload.conversation_config,
    });
    return {
      agentId: sampleId,
      name: config?.name || 'Smile Dental AI Assistant',
      status: 'created (sample)',
      isSample: true,
      createdAt: new Date().toISOString(),
    };
  }

  // Real ElevenLabs agent creation
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Missing environment variable: ELEVENLABS_API_KEY');
  }

  if (!config || !config.name) {
    throw new Error('Agent configuration must include a name.');
  }

  const { payload } = mapConfigToElevenLabsPayload(config);

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey.trim(),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Invalid ElevenLabs API key. Please check your credentials.');
      }
      if (res.status === 400 || res.status === 402 || res.status === 403 || res.status === 422) {
        const errorData = await res.json().catch(() => null);
        const detail =
          errorData?.detail?.message || errorData?.detail || errorData?.message || '';
        const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
        const detailLower = detailStr.toLowerCase();
        if (
          detailLower.includes('tier') ||
          detailLower.includes('plan') ||
          detailLower.includes('library') ||
          detailLower.includes('upgrade') ||
          detailLower.includes('voice') ||
          detailLower.includes('payment_required') ||
          detailLower.includes('subscription')
        ) {
          throw new Error(
            'The selected voice is restricted on your current ElevenLabs plan. Please choose a default premade voice or upgrade your ElevenLabs subscription.'
          );
        }
        if (res.status === 403) {
          throw new Error(
            'Permission missing. Your ElevenLabs API key lacks Conversational AI agent creation permissions.'
          );
        }
        throw new Error(
          `ElevenLabs rejected configuration: ${detailStr || 'Invalid fields in agent configuration.'}`
        );
      }
      if (res.status === 429) {
        throw new Error('ElevenLabs quota limit reached or insufficient credits.');
      }
      throw new Error(`ElevenLabs returned HTTP ${res.status}.`);
    }

    const data = await res.json();
    if (!data || typeof data.agent_id !== 'string') {
      throw new Error('ElevenLabs did not return an agent ID.');
    }

    return {
      agentId: data.agent_id,
      name: config.name,
      status: 'created',
      isSample: false,
      createdAt: new Date().toISOString(),
    };
  } catch (err: any) {
    const sanitized = (err?.message || 'Failed to create agent in ElevenLabs')
      .replace(/sk_[a-zA-Z0-9_-]+/g, '[REDACTED]')
      .replace(/xi-api-key:[^\s]+/gi, 'xi-api-key: [REDACTED]');
    throw new Error(sanitized);
  }
}

export async function getAgent(agentId: string): Promise<any> {
  ensureServerSide();
  const cleanId = (agentId || '').trim();
  if (!cleanId) {
    throw new Error('Agent ID is required.');
  }

  const isReal = isRealElevenLabsEnabled() || isRealVoiceEnabled();

  if (!isReal) {
    const mockData = mockAgentStore.get(cleanId);
    return {
      agentId: cleanId,
      name: mockData?.name || 'Sample Agent',
      conversationConfig: mockData?.conversation_config || {
        agent: {
          prompt: { prompt: '' },
          first_message: '',
          language: 'en',
        },
        tts: {
          model_id: 'eleven_flash_v2',
          voice_id: '21m00Tcm4TlvDq8ikWAM',
        },
        language_presets: {},
      },
      isSample: true,
    };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Missing environment variable: ELEVENLABS_API_KEY');
  }

  try {
    const url = `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(cleanId)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey.trim(),
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`ElevenLabs agent not found: "${cleanId}" does not exist in this ElevenLabs workspace.`);
      }
      if (res.status === 401) {
        throw new Error('Invalid ElevenLabs API key. Please check your credentials.');
      }
      if (res.status === 403) {
        throw new Error('Permission missing to view this ElevenLabs agent.');
      }
      throw new Error(`ElevenLabs returned HTTP ${res.status} when looking up agent.`);
    }

    const data = await res.json();
    return {
      agentId: data.agent_id || cleanId,
      name: data.name || 'ElevenLabs Agent',
      conversationConfig: data.conversation_config,
      isSample: false,
    };
  } catch (err: any) {
    const sanitized = (err?.message || 'Failed to retrieve agent from ElevenLabs')
      .replace(/sk_[a-zA-Z0-9_-]+/g, '[REDACTED]')
      .replace(/xi-api-key:[^\s]+/gi, 'xi-api-key: [REDACTED]');
    throw new Error(sanitized);
  }
}

export async function updateAgent(agentId: string, config: any): Promise<any> {
  ensureServerSide();
  const cleanId = (agentId || '').trim();
  if (!cleanId) {
    throw new Error('Agent ID is required.');
  }

  if (!config || !config.name) {
    throw new Error('Agent configuration must include a name.');
  }

  const mapped = mapConfigToElevenLabsPayload(config);
  const isReal = isRealElevenLabsEnabled();

  if (!isReal) {
    checkMockMode();
    mockAgentStore.set(cleanId, {
      name: config.name,
      conversation_config: mapped.payload.conversation_config,
    });
    return {
      agentId: cleanId,
      name: config?.name || 'Smile Dental AI Assistant',
      status: 'updated (sample)',
      isSample: true,
      updatedAt: new Date().toISOString(),
    };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Missing environment variable: ELEVENLABS_API_KEY');
  }

  try {
    const url = `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(cleanId)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey.trim(),
      },
      body: JSON.stringify(mapped.payload),
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Invalid ElevenLabs API key. Please check your credentials.');
      }
      if (res.status === 404) {
        throw new Error(`ElevenLabs agent not found: "${cleanId}" does not exist in this ElevenLabs workspace.`);
      }
      if (res.status === 400 || res.status === 402 || res.status === 403 || res.status === 422) {
        const errorData = await res.json().catch(() => null);
        const detail =
          errorData?.detail?.message || errorData?.detail || errorData?.message || '';
        const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
        const detailLower = detailStr.toLowerCase();
        if (
          detailLower.includes('tier') ||
          detailLower.includes('plan') ||
          detailLower.includes('library') ||
          detailLower.includes('upgrade') ||
          detailLower.includes('voice') ||
          detailLower.includes('payment_required') ||
          detailLower.includes('subscription')
        ) {
          throw new Error(
            'The selected voice is restricted on your current ElevenLabs plan. Please choose a default premade voice or upgrade your ElevenLabs subscription.'
          );
        }
        if (res.status === 403) {
          throw new Error(
            'Permission missing. Your ElevenLabs API key lacks Conversational AI agent update permissions.'
          );
        }
        throw new Error(
          `ElevenLabs rejected update configuration: ${detailStr || 'Invalid fields in agent update configuration.'}`
        );
      }
      if (res.status === 429) {
        throw new Error('ElevenLabs quota limit reached or insufficient credits.');
      }
      throw new Error(`ElevenLabs returned HTTP ${res.status} when updating agent.`);
    }

    return {
      agentId: cleanId,
      name: config.name,
      status: 'updated',
      isSample: false,
      updatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    const sanitized = (err?.message || 'Failed to update agent in ElevenLabs')
      .replace(/sk_[a-zA-Z0-9_-]+/g, '[REDACTED]')
      .replace(/xi-api-key:[^\s]+/gi, 'xi-api-key: [REDACTED]');
    throw new Error(sanitized);
  }
}

export async function getSignedUrl(agentIdOverride?: string): Promise<{ signedUrl: string }> {
  ensureServerSide();

  const isRealVoice = isRealVoiceEnabled();

  if (!isRealVoice) {
    // Mock mode
    return {
      signedUrl: `wss://api.elevenlabs.io/v1/convai/conversation?mock=true&agent_id=${agentIdOverride || 'sample-agent'}`,
    };
  }

  // Real voice mode: Authenticate with ElevenLabs server-side
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Missing environment variable: ELEVENLABS_API_KEY');
  }

  const agentId = (agentIdOverride || process.env.ELEVENLABS_AGENT_ID || '').trim();
  if (!agentId) {
    throw new Error('Missing environment variable: ELEVENLABS_AGENT_ID');
  }

  try {
    const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url');
    url.searchParams.set('agent_id', agentId);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey.trim(),
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Invalid ElevenLabs API key. Please check your credentials.');
      }
      if (res.status === 403) {
        throw new Error('Permission missing. Your ElevenLabs API key lacks Conversational AI permissions.');
      }
      if (res.status === 404) {
        throw new Error('ElevenLabs agent not found. Please check your ELEVENLABS_AGENT_ID.');
      }
      if (res.status === 429) {
        throw new Error('ElevenLabs quota limit reached or insufficient credits.');
      }
      throw new Error(`ElevenLabs returned HTTP ${res.status}.`);
    }

    const data = await res.json();
    if (!data || typeof data.signed_url !== 'string') {
      throw new Error('ElevenLabs did not return a valid signed URL.');
    }

    return {
      signedUrl: data.signed_url,
    };
  } catch (err: any) {
    // Sanitize any potential token leakage in error text
    const sanitized = (err?.message || 'Failed to obtain signed URL from ElevenLabs')
      .replace(/sk_[a-zA-Z0-9_-]+/g, '[REDACTED]')
      .replace(/xi-api-key:[^\s]+/gi, 'xi-api-key: [REDACTED]');
    throw new Error(sanitized);
  }
}

export async function listVoices(): Promise<VoiceItem[]> {
  ensureServerSide();
  const isReal = isRealElevenLabsEnabled();

  if (!isReal) {
    checkMockMode();
    return [
      {
        voiceId: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel (Sample Voice)',
        category: 'conversational',
        description: 'Warm, friendly, clear female American voice for front-desk greetings.',
        labels: {
          gender: 'female',
          age: 'young',
          accent: 'american',
          use_case: 'conversational',
          description: 'calm',
        },
        supportedLanguages: ['en'],
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/previews/voices/21m00Tcm4TlvDq8ikWAM/american.mp3',
        isSample: true,
      },
      {
        voiceId: '29vD33N1CtxCmqQRPOHJ',
        name: 'Drew (Sample Voice)',
        category: 'conversational',
        description: 'Professional, articulate, reassuring male tone suited for medical practices.',
        labels: {
          gender: 'male',
          age: 'middle aged',
          accent: 'american',
          use_case: 'conversational',
          description: 'well-rounded',
        },
        supportedLanguages: ['en'],
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/previews/voices/29vD33N1CtxCmqQRPOHJ/american.mp3',
        isSample: true,
      },
      {
        voiceId: 'fTfuemKGBjYqG4ni4gw3',
        name: 'Ritu Rathore (Natural Conversational Hindi)',
        category: 'conversational',
        description: 'Warm, clear, natural conversational Indian Hindi female voice suitable for medical and dental reception.',
        labels: {
          gender: 'female',
          age: 'middle_aged',
          accent: 'indian',
          use_case: 'conversational',
          description: 'calm',
          language: 'hindi',
          locale: 'hi-IN',
        },
        supportedLanguages: ['hi', 'hindi', 'en'],
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/6a5ad105c93f46cfa7d9c324327d9ad0/voices/fTfuemKGBjYqG4ni4gw3/c2be593d-527a-4c18-af52-f9a01c901bd5.mp3',
        isSample: true,
      },
      {
        voiceId: 'qdykssD3wAUvtIw9wG8N',
        name: 'Sandeep (Natural Indian Hindi)',
        category: 'conversational',
        description: 'Clear, natural and expressive Indian male voice with a warm tone, smooth delivery, and excellent clarity.',
        labels: {
          gender: 'male',
          age: 'young',
          accent: 'indian',
          use_case: 'conversational',
          description: 'calm',
          language: 'hindi',
          locale: 'hi-IN',
        },
        supportedLanguages: ['hi', 'hindi', 'en'],
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/09532de36fbb49a7931b7f07f50c162a/voices/qdykssD3wAUvtIw9wG8N/d4f226b7-80ba-4dfd-8200-a4c272ea2dd8.mp3',
        isSample: true,
      },
      {
        voiceId: 'ThT5KcBeYPX3keUQqHPh',
        name: 'Aditi (Sample Voice)',
        category: 'multilingual',
        description: 'Natural bilingual Indian English and Hindi speaker with clean articulation.',
        labels: {
          gender: 'female',
          age: 'young',
          accent: 'indian',
          use_case: 'conversational',
          description: 'bilingual',
          language: 'hindi',
        },
        supportedLanguages: ['hi', 'en'],
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/previews/voices/ThT5KcBeYPX3keUQqHPh/american.mp3',
        isSample: true,
      },
      {
        voiceId: 'JBFqnCBsd6RMkjVDRZzb',
        name: 'George (Sample Voice)',
        category: 'narration',
        description: 'Warm, articulate British voice with mature authority.',
        labels: {
          gender: 'male',
          age: 'middle aged',
          accent: 'british',
          use_case: 'narration',
          description: 'warm',
        },
        supportedLanguages: ['en'],
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/previews/voices/JBFqnCBsd6RMkjVDRZzb/british.mp3',
        isSample: true,
      },
      {
        voiceId: '9BWtsMINqrJLrRacOk9x',
        name: 'Aria (Sample Voice)',
        category: 'expressive',
        description: 'Expressive and engaging female voice with dynamic intonation.',
        labels: {
          gender: 'female',
          age: 'middle aged',
          accent: 'american',
          use_case: 'characters',
          description: 'expressive',
        },
        supportedLanguages: ['en'],
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/previews/voices/9BWtsMINqrJLrRacOk9x/american.mp3',
        isSample: true,
      },
      {
        voiceId: 'sample-voice-silent',
        name: 'Silent Voice (No Preview Sample)',
        category: 'utility',
        description: 'Sample voice without a pre-recorded preview URL to verify UI fallback.',
        labels: {
          gender: 'neutral',
          age: 'young',
          accent: 'neutral',
          use_case: 'characters',
        },
        supportedLanguages: [],
        previewUrl: undefined,
        isSample: true,
      },
    ];
  }

  // Real ElevenLabs voices list
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Missing environment variable: ELEVENLABS_API_KEY');
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'xi-api-key': apiKey.trim(),
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Invalid ElevenLabs API key. Please check your credentials.');
      }
      if (res.status === 403) {
        throw new Error('Permission missing. Your ElevenLabs API key lacks permissions to list voices.');
      }
      if (res.status === 429) {
        throw new Error('ElevenLabs quota limit reached or insufficient credits.');
      }
      throw new Error(`ElevenLabs returned HTTP ${res.status} when fetching voices.`);
    }

    const data = await res.json();
    const rawVoices = Array.isArray(data?.voices) ? data.voices : [];

    const mappedVoices: VoiceItem[] = rawVoices.map((v: any) => {
      // Extract languages from verified_languages if present
      const langs = new Set<string>();
      if (Array.isArray(v.verified_languages)) {
        for (const item of v.verified_languages) {
          if (item?.language && typeof item.language === 'string') {
            langs.add(item.language.toLowerCase());
          }
        }
      }
      if (v.labels?.language && typeof v.labels.language === 'string') {
        langs.add(v.labels.language.toLowerCase());
      }
      const locale = (v.labels?.locale || '').toLowerCase();
      if (locale.includes('hi') || locale.includes('in')) {
        langs.add('hi');
        langs.add('hindi');
      }

      const rawAccent = (v.labels?.accent || '').toLowerCase();
      const isIndian =
        rawAccent.includes('indian') ||
        locale.includes('in') ||
        (v.name || '').toLowerCase().includes('indian') ||
        (v.name || '').toLowerCase().includes('hindi');
      const accent = isIndian ? 'indian' : (v.labels?.accent || '');

      const useCase =
        v.labels?.['use case'] ||
        v.labels?.use_case ||
        v.labels?.['use-case'] ||
        v.category ||
        'conversational';

      return {
        voiceId: v.voice_id || '',
        name: v.name || 'Unnamed Voice',
        category: v.category || 'premade',
        description: v.description || '',
        labels: {
          accent,
          age: v.labels?.age || '',
          gender: v.labels?.gender || '',
          use_case: useCase,
          description: v.labels?.description || '',
          language: v.labels?.language || '',
          locale: v.labels?.locale || '',
        },
        supportedLanguages: Array.from(langs),
        previewUrl: v.preview_url || undefined,
        isSample: false,
      };
    });

    return mappedVoices;
  } catch (err: any) {
    const sanitized = (err?.message || 'Failed to list voices from ElevenLabs')
      .replace(/sk_[a-zA-Z0-9_-]+/g, '[REDACTED]')
      .replace(/xi-api-key:[^\s]+/gi, 'xi-api-key: [REDACTED]');
    throw new Error(sanitized);
  }
}

export async function listConversations(options?: {
  agentId?: string;
  source?: 'real' | 'sample';
}): Promise<{ conversations: Conversation[]; isSample: boolean; totalReal: number }> {
  ensureServerSide();
  const isReal = isRealElevenLabsEnabled();

  if (!isReal || options?.source === 'sample') {
    return {
      conversations: SAMPLE_CONVERSATIONS.map((c) => ({ ...c, isSample: true })),
      isSample: true,
      totalReal: 0,
    };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return {
      conversations: SAMPLE_CONVERSATIONS.map((c) => ({ ...c, isSample: true })),
      isSample: true,
      totalReal: 0,
    };
  }

  try {
    const url = new URL('https://api.elevenlabs.io/v1/convai/conversations');
    if (options?.agentId) {
      url.searchParams.set('agent_id', options.agentId.trim());
    }
    url.searchParams.set('sort_direction', 'desc');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey.trim(),
      },
    });

    if (!res.ok) {
      return {
        conversations: SAMPLE_CONVERSATIONS.map((c) => ({ ...c, isSample: true })),
        isSample: true,
        totalReal: 0,
      };
    }

    const data = await res.json();
    const rawList = Array.isArray(data?.conversations) ? data.conversations : [];

    if (rawList.length === 0) {
      return {
        conversations: SAMPLE_CONVERSATIONS.map((c) => ({ ...c, isSample: true })),
        isSample: true,
        totalReal: 0,
      };
    }

    const mapped: Conversation[] = rawList.map((item: any) => {
      const durationSecs = item.metadata?.call_duration_secs || 0;
      const startTime = item.metadata?.start_time_unix_secs
        ? new Date(item.metadata.start_time_unix_secs * 1000).toISOString()
        : new Date().toISOString();

      let outcome: any = 'Resolved';
      if (item.metadata?.termination_reason === 'agent_hangup') {
        outcome = 'Resolved';
      } else if (item.status === 'failed') {
        outcome = 'Flagged';
      }

      return {
        id: item.conversation_id,
        callerName: item.metadata?.caller_name || `Caller (${item.conversation_id.slice(-6)})`,
        startTime,
        duration: durationSecs,
        language: 'English',
        outcome,
        summary: item.analysis?.call_summary || item.metadata?.termination_reason || 'Call recorded in ElevenLabs',
        transcript: [],
        isSample: false,
      };
    });

    return {
      conversations: mapped,
      isSample: false,
      totalReal: rawList.length,
    };
  } catch {
    return {
      conversations: SAMPLE_CONVERSATIONS.map((c) => ({ ...c, isSample: true })),
      isSample: true,
      totalReal: 0,
    };
  }
}

export async function getConversation(conversationId: string): Promise<Conversation> {
  ensureServerSide();
  const cleanId = (conversationId || '').trim();
  const sample = SAMPLE_CONVERSATIONS.find((c) => c.id === cleanId);
  if (sample) {
    return { ...sample, isSample: true };
  }

  const isReal = isRealElevenLabsEnabled();
  if (!isReal) {
    throw new Error(`Conversation "${cleanId}" not found.`);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Missing environment variable: ELEVENLABS_API_KEY');
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(cleanId)}`,
      {
        headers: { 'xi-api-key': apiKey.trim() },
      }
    );

    if (!res.ok) {
      throw new Error(`ElevenLabs returned HTTP ${res.status} when looking up conversation.`);
    }

    const data = await res.json();
    const transcript = Array.isArray(data.transcript)
      ? data.transcript.map((t: any) => ({
          role: t.role === 'user' ? 'caller' : 'agent',
          text: t.message || '',
        }))
      : [];

    return {
      id: data.conversation_id || cleanId,
      callerName: data.metadata?.caller_name || `Caller (${cleanId.slice(-6)})`,
      startTime: data.metadata?.start_time_unix_secs
        ? new Date(data.metadata.start_time_unix_secs * 1000).toISOString()
        : new Date().toISOString(),
      duration: data.metadata?.call_duration_secs || 0,
      language: 'English',
      outcome: data.status === 'failed' ? 'Flagged' : 'Resolved',
      summary:
        data.analysis?.call_summary ||
        data.metadata?.termination_reason ||
        'Call recorded in ElevenLabs',
      transcript,
      isSample: false,
    };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to retrieve conversation details.');
  }
}

export async function uploadKnowledgeBaseFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<KnowledgeBaseDoc> {
  ensureServerSide();
  const isReal = isRealElevenLabsEnabled();

  if (!isReal) {
    return {
      id: `kb-doc-mock-${Date.now()}`,
      name: fileName,
      type: 'file',
      size: fileBuffer.length,
      mimeType,
      createdAt: new Date().toISOString(),
    };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Missing environment variable: ELEVENLABS_API_KEY');
  }

  try {
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), fileName);
    formData.append('name', fileName);

    const res = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base/file', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey.trim(),
      },
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const detail =
        errorData?.detail?.message || errorData?.detail || errorData?.message || '';
      throw new Error(`Failed to upload document to ElevenLabs: ${detail || `HTTP ${res.status}`}`);
    }

    const data = await res.json();
    return {
      id: data.id || data.document_id,
      name: fileName,
      type: 'file',
      size: fileBuffer.length,
      mimeType,
      createdAt: new Date().toISOString(),
    };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to upload knowledge base document.');
  }
}

export async function deleteKnowledgeBaseDocument(documentId: string): Promise<boolean> {
  ensureServerSide();
  const isReal = isRealElevenLabsEnabled();
  if (!isReal) return true;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Missing environment variable: ELEVENLABS_API_KEY');
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/knowledge-base/${encodeURIComponent(documentId)}`,
      {
        method: 'DELETE',
        headers: {
          'xi-api-key': apiKey.trim(),
        },
      }
    );

    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete document from ElevenLabs: HTTP ${res.status}`);
    }
    return true;
  } catch (err: any) {
    throw new Error(err.message || 'Failed to delete knowledge base document.');
  }
}

export async function transcribeAudio(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ text: string; language_code?: string }> {
  ensureServerSide();
  const isReal = isRealElevenLabsEnabled() || isRealVoiceEnabled();

  if (!isReal) {
    return {
      text: 'Hello, this is a simulated transcription of the audio recording.',
      language_code: 'en',
    };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Missing environment variable: ELEVENLABS_API_KEY');
  }

  try {
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), fileName);
    formData.append('model_id', 'scribe_v1');

    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey.trim(),
      },
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const detail =
        errorData?.detail?.message || errorData?.detail || errorData?.message || '';
      throw new Error(`Failed to transcribe audio: ${detail || `HTTP ${res.status}`}`);
    }

    const data = await res.json();
    return {
      text: data.text || '',
      language_code: data.language_code || 'en',
    };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to transcribe audio file.');
  }
}
