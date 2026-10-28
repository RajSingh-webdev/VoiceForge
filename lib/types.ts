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

export interface AgentConfig {
  name: string;
  persona: string;
  goals: string[];
  flowSteps: FlowStep[];
  welcomeMessage: string;
  languages: string[];
  voiceSuggestion: string;
  guardrails: string[];
  tools: ProposedTool[];
  knowledge?: ExtractedFacts;
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
