import { AgentConfig, AgentSyncState } from './types';

export const SYNC_STORAGE_KEY = 'voiceforge:sync';
export const DEPLOYMENT_STORAGE_KEY = 'voiceforge:deployment';

/**
 * Computes a deterministic 64-bit-equivalent hexadecimal hash of the AgentConfig
 * to detect any modifications in persona, goals, flow steps, welcome message,
 * guardrails, languages, voice, or business facts knowledge base.
 */
export function computeConfigHash(config: AgentConfig | null | undefined): string {
  if (!config) return '';

  const normalized = {
    name: config.name || '',
    persona: config.persona || '',
    goals: Array.isArray(config.goals) ? [...config.goals] : [],
    flowSteps: Array.isArray(config.flowSteps)
      ? config.flowSteps.map((s) => ({ title: s.title || '', instruction: s.instruction || '' }))
      : [],
    welcomeMessage: config.welcomeMessage || '',
    welcomeMessageHindi: config.welcomeMessageHindi || '',
    languages: Array.isArray(config.languages) ? [...config.languages] : [],
    voiceSuggestion: config.voiceSuggestion || '',
    voiceId: config.voiceId || '',
    voiceName: config.voiceName || '',
    guardrails: Array.isArray(config.guardrails) ? [...config.guardrails] : [],
    knowledge: config.knowledge
      ? {
          business_name: config.knowledge.business_name || '',
          business_type: config.knowledge.business_type || '',
          opening_hours: config.knowledge.opening_hours || '',
          contact: config.knowledge.contact || '',
          services: Array.isArray(config.knowledge.services) ? [...config.knowledge.services] : [],
          prices: Array.isArray(config.knowledge.prices) ? [...config.knowledge.prices] : [],
          faqs: Array.isArray(config.knowledge.faqs) ? [...config.knowledge.faqs] : [],
        }
      : {},
  };

  const str = JSON.stringify(normalized);

  // Deterministic FNV-1a variant producing 12-char hex string
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(12, '0');
}

/**
 * Reads the current sync state from localStorage safely.
 */
export function getSavedSyncState(): AgentSyncState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SYNC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.hash === 'string') {
      return parsed as AgentSyncState;
    }
  } catch {
    // Return null on storage read/parse error
  }
  return null;
}

/**
 * Saves the sync state to localStorage.
 */
export function setSavedSyncState(hash: string, syncedAt: string, agentId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const state: AgentSyncState = { hash, syncedAt, agentId };
    window.localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage write error
  }
}
