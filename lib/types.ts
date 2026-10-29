export interface FlowStep {
  title: string;
  instruction: string;
}

export interface ProposedTool {
  name: string;
  purpose: string;
  status: string;
}

export interface ExtractedPrice {
  item: string;
  price: string;
}

export interface ExtractedFaq {
  question: string;
  answer: string;
}

export interface ExtractedFacts {
  business_name?: string;
  business_type?: string;
  services: string[];
  prices: ExtractedPrice[];
  opening_hours?: string;
  contact?: string;
  faqs: ExtractedFaq[];
  not_found: string[];
}

export interface KnowledgeBaseDoc {
  id: string;
  name: string;
  type?: 'file' | 'url' | 'text';
  size?: number;
  mimeType?: string;
  createdAt?: string;
}

export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface AgentConfig {
  agentId?: string;
  name: string;
  persona: string;
  goals: string[];
  flowSteps: FlowStep[];
  welcomeMessage: string;
  welcomeMessageHindi?: string;
  languages: string[];
  voiceSuggestion: string;
  voiceId?: string;
  voiceName?: string;
  voiceIdHindi?: string;
  voiceNameHindi?: string;
  voiceSettings?: VoiceSettings;
  expressiveMode?: boolean;
  guardrails: string[];
  tools: ProposedTool[];
  knowledge?: ExtractedFacts;
  knowledgeBaseDocuments?: KnowledgeBaseDoc[];
}

export type ConversationOutcome = 'Booked' | 'Resolved' | 'Flagged' | 'Transferred to human';

export interface ConversationTurn {
  role: 'agent' | 'caller';
  text: string;
}

export interface Conversation {
  id: string;
  callerName: string;
  startTime: string;
  duration: number; // in seconds
  language: 'English' | 'Hindi' | 'Mixed';
  outcome: ConversationOutcome;
  summary: string;
  transcript: ConversationTurn[];
  isSample?: boolean;
}

export type FixType = 'knowledge' | 'guardrail' | 'flow_step';

export interface CallAnalysisEvidence {
  turn: number;
  quote: string;
}

export interface CallAnalysisResult {
  issue_found: boolean;
  unanswered_question: string;
  evidence: CallAnalysisEvidence;
  fix_type: FixType;
  suggested_title: string;
  suggested_text: string;
  needs_owner_input: boolean;
  owner_question: string;
}

export interface FixHistoryItem {
  id: string;
  callId: string;
  callerName: string;
  timestamp: string;
  fixType: FixType;
  title: string;
  description: string;
  previousConfig: AgentConfig;
  appliedConfig: AgentConfig;
  diffSummary: {
    section: 'knowledge' | 'guardrail' | 'flow_step';
    before: string;
    after: string;
  };
}

export interface AgentDeployment {
  agentId: string;
  createdAt: string;
  isSample: boolean;
  name?: string;
}

export interface AgentSyncState {
  hash: string;
  syncedAt: string;
  agentId?: string;
}

export interface VoiceItem {
  voiceId: string;
  name: string;
  category?: string;
  description?: string;
  labels?: {
    accent?: string;
    age?: string;
    gender?: string;
    use_case?: string;
    description?: string;
    language?: string;
    [key: string]: string | undefined;
  };
  supportedLanguages?: string[];
  previewUrl?: string;
  isSample?: boolean;
}

export function isValidAgentConfig(data: any): data is AgentConfig {
  if (!data || typeof data !== 'object') return false;
  return (
    typeof data.name === 'string' &&
    typeof data.persona === 'string' &&
    Array.isArray(data.goals) &&
    Array.isArray(data.flowSteps) &&
    typeof data.welcomeMessage === 'string' &&
    Array.isArray(data.languages) &&
    typeof data.voiceSuggestion === 'string' &&
    Array.isArray(data.guardrails) &&
    Array.isArray(data.tools)
  );
}

export interface CallerProfile {
  id: string;
  phone?: string;
  name: string;
  callCount: number;
  lastCallDate: string;
  notes: string[];
  preferredLanguage?: string;
}

export interface BookingRecord {
  id: string;
  callerName: string;
  callerPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  service: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  createdAt: string;
  notes?: string;
}

export interface SimulatedCallerScenario {
  id: string;
  title: string;
  persona: string;
  callerGoal: string;
  stressFactor: 'anger' | 'confusion' | 'emergency' | 'jailbreak' | 'hindi_switch';
  description: string;
}

export interface SimulationTurn {
  role: 'caller' | 'agent';
  message: string;
}

export interface SimulationReport {
  scenarioId: string;
  scenarioTitle: string;
  passed: boolean;
  score: number; // 0 - 100
  aiDisclosed: boolean;
  guardrailsRespected: boolean;
  handledAppropriately: boolean;
  findings: string[];
  turns: SimulationTurn[];
}
