import { AgentConfig, AgentDeployment, AgentSyncState } from './types';

export const SYNC_STORAGE_KEY = 'voiceforge:sync';
export const DEPLOYMENT_STORAGE_KEY = 'voiceforge:deployment';
export const DEPLOYMENTS_MAP_KEY = 'voiceforge:deployments_map';

/**
 * Normalizes an assistant name for matching.
 */
export function normalizeAgentName(name?: string): string {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if two assistant names match closely enough to refer to the same assistant,
 * preventing identity mismatch (e.g. Smile Dental vs Spark Digital).
 */
export function isMatchingAgentName(name1?: string, name2?: string): boolean {
  if (!name1 || !name2) return false;
  const n1 = normalizeAgentName(name1);
  const n2 = normalizeAgentName(name2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  // If one starts with or includes the other (min length 6 chars to avoid false positives)
  if (n1.length >= 6 && n2.length >= 6 && (n1.includes(n2) || n2.includes(n1))) {
    return true;
  }
  return false;
}

/**
 * Retrieves the registry map of deployed agents: { [normalizedName]: AgentDeployment }
 */
export function getDeploymentsMap(): Record<string, AgentDeployment> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DEPLOYMENTS_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, AgentDeployment>;
    }
  } catch {}
  return {};
}

/**
 * Saves a deployment both in the registry map under the assistant name
 * and in the active deployment slot if it matches.
 */
export function saveDeploymentForConfig(configName: string, deployment: AgentDeployment): void {
  if (typeof window === 'undefined') return;
  try {
    const map = getDeploymentsMap();
    const key = normalizeAgentName(configName);
    const enriched: AgentDeployment = {
      ...deployment,
      name: deployment.name || configName,
    };
    if (key) {
      map[key] = enriched;
      window.localStorage.setItem(DEPLOYMENTS_MAP_KEY, JSON.stringify(map));
    }
    window.localStorage.setItem(DEPLOYMENT_STORAGE_KEY, JSON.stringify(enriched));
  } catch {}
}

/**
 * Retrieves the deployment associated with a specific AgentConfig.
 * Never returns a deployment that belongs to a different assistant name.
 */
export function getDeploymentForConfig(config: AgentConfig | null | undefined): AgentDeployment | null {
  if (typeof window === 'undefined' || !config || !config.name) return null;
  const configName = config.name;
  const map = getDeploymentsMap();

  // 1. Direct match by agentId if config has one
  if (config.agentId) {
    for (const dep of Object.values(map)) {
      if (dep && dep.agentId === config.agentId) {
        return dep;
      }
    }
  }

  // 2. Direct key match in map
  const norm = normalizeAgentName(configName);
  if (norm && map[norm]) {
    return map[norm];
  }

  // 3. Match any entry in map by fuzzy name match
  for (const [key, dep] of Object.entries(map)) {
    if (isMatchingAgentName(key, configName) || isMatchingAgentName(dep?.name, configName)) {
      return dep;
    }
  }

  // 4. Check legacy DEPLOYMENT_STORAGE_KEY ONLY IF the name matches
  try {
    const raw = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
    if (raw) {
      const parsed: AgentDeployment = JSON.parse(raw);
      if (parsed && parsed.agentId) {
        if (parsed.name && isMatchingAgentName(parsed.name, configName)) {
          return parsed;
        }
      }
    }
  } catch {}

  return null;
}

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
    voiceIdHindi: config.voiceIdHindi || '',
    voiceNameHindi: config.voiceNameHindi || '',
    expressiveMode: !!config.expressiveMode,
    guardrails: Array.isArray(config.guardrails) ? [...config.guardrails] : [],
    knowledgeBaseDocuments: Array.isArray(config.knowledgeBaseDocuments)
      ? config.knowledgeBaseDocuments.map((d) => ({ id: d.id, name: d.name }))
      : [],
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
