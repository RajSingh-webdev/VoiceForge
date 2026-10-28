import { Conversation } from './types';

function ensureServerSide() {
  if (typeof window !== 'undefined') {
    throw new Error('ElevenLabs module can only be executed on the server.');
  }
}

function checkMockMode() {
  ensureServerSide();
  const isMock = process.env.USE_MOCK_ELEVENLABS === 'true';
  if (!isMock) {
    throw new Error('Real ElevenLabs calls are not connected yet');
  }
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

export async function createAgent(config: any): Promise<any> {
  checkMockMode();
  const slug = config?.name
    ? config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    : 'smile-dental';
  return {
    agentId: `sample-agent-${slug || 'smile-dental'}`,
    name: config?.name || 'Smile Dental AI Assistant',
    status: 'created (sample)',
    isSample: true,
    createdAt: new Date().toISOString(),
  };
}

export async function updateAgent(agentId: string, config: any): Promise<any> {
  checkMockMode();
  return {
    agentId,
    name: config?.name || 'Smile Dental AI Assistant',
    status: 'updated (sample)',
    isSample: true,
    updatedAt: new Date().toISOString(),
  };
}

export async function getSignedUrl(agentId?: string): Promise<{ signedUrl: string }> {
  checkMockMode();
  return {
    signedUrl: `wss://api.elevenlabs.io/v1/convai/conversation?mock=true&agent_id=${agentId || 'sample-agent'}`,
  };
}

export async function listVoices(): Promise<
  Array<{ voiceId: string; name: string; category: string; description: string }>
> {
  checkMockMode();
  return [
    {
      voiceId: 'mock-voice-rachel',
      name: 'Rachel (Sample Voice)',
      category: 'conversational',
      description: 'Warm, friendly, clear female American voice for front-desk greetings.',
    },
    {
      voiceId: 'mock-voice-drew',
      name: 'Drew (Sample Voice)',
      category: 'conversational',
      description: 'Professional, articulate, reassuring male tone suited for medical practices.',
    },
    {
      voiceId: 'mock-voice-aditi',
      name: 'Aditi (Sample Voice)',
      category: 'multilingual',
      description: 'Natural bilingual Indian English and Hindi speaker with clean articulation.',
    },
  ];
}

export async function listConversations(): Promise<Conversation[]> {
  checkMockMode();
  return SAMPLE_CONVERSATIONS;
}
