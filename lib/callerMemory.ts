/**
 * Privacy-preserving caller memory helper.
 * Uses SHA-256 HMAC hashing so raw phone numbers are never stored in caller records.
 * Securely persists to Supabase when configured, or cleanly disables memory when unconfigured.
 */

import crypto from 'crypto';
import {
  isSupabaseConfigured,
  getCallerMemoryFromDb,
  saveCallerMemoryToDb,
  clearCallerMemoryFromDb,
  DbCallerMemoryRecord,
} from './supabase';

function getMemorySalt(): string {
  return (
    process.env.CALLER_MEMORY_SALT ||
    process.env.BOOKING_WEBHOOK_SECRET ||
    'voiceforge-caller-privacy-salt-2026'
  );
}

/**
 * Creates a one-way pseudonymous identifier for caller phone numbers.
 * The salt prevents rainbow table lookup of standard phone formats.
 */
export function hashCallerPhone(phone: string): string {
  const normalized = phone.replace(/[^0-9+]/g, '');
  return crypto.createHmac('sha256', getMemorySalt()).update(normalized).digest('hex');
}

export interface CallerMemoryStatus {
  available: boolean;
  reason?: string;
  memory?: {
    displayName: string;
    callCount: number;
    lastCallAt: string;
    preferredLanguage: string;
    notes: string[];
  } | null;
}

/**
 * Retrieve caller memory for an active call.
 * Returns { available: false } when Supabase is unconfigured, preventing false claims of cloud persistence.
 */
export async function getCallerMemory(
  agentId: string,
  callerPhone: string
): Promise<CallerMemoryStatus> {
  if (!isSupabaseConfigured()) {
    return {
      available: false,
      reason: 'Persistent memory requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      memory: null,
    };
  }

  const phoneHash = hashCallerPhone(callerPhone);
  const result = await getCallerMemoryFromDb(agentId, phoneHash);

  if (result.error || !result.found || !result.memory) {
    return {
      available: true,
      memory: null,
    };
  }

  return {
    available: true,
    memory: {
      displayName: result.memory.display_name,
      callCount: result.memory.call_count,
      lastCallAt: result.memory.last_call_at,
      preferredLanguage: result.memory.preferred_language,
      notes: Array.isArray(result.memory.notes) ? result.memory.notes : [],
    },
  };
}

/**
 * Record or update safe, privacy-preserving caller information.
 */
export async function updateCallerMemory(
  agentId: string,
  callerPhone: string,
  data: {
    displayName?: string;
    preferredLanguage?: string;
    note?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase credentials are not configured on the server. Caller memory remains disabled.',
    };
  }

  const phoneHash = hashCallerPhone(callerPhone);
  const existing = await getCallerMemoryFromDb(agentId, phoneHash);

  const callCount = existing.memory ? existing.memory.call_count + 1 : 1;
  const displayName = data.displayName || existing.memory?.display_name || 'Caller';
  const preferredLanguage = data.preferredLanguage || existing.memory?.preferred_language || 'English';

  const existingNotes: string[] = Array.isArray(existing.memory?.notes)
    ? existing.memory!.notes
    : [];
  const updatedNotes = data.note
    ? [...existingNotes.slice(-4), data.note.trim()].slice(-5) // limit to 5 safe brief context tags
    : existingNotes;

  const record: DbCallerMemoryRecord = {
    agent_id: agentId,
    phone_hash: phoneHash,
    display_name: displayName,
    call_count: callCount,
    last_call_at: new Date().toISOString(),
    preferred_language: preferredLanguage,
    notes: updatedNotes,
  };

  return await saveCallerMemoryToDb(record);
}

/**
 * Erase all memory for a caller upon request.
 */
export async function clearCallerMemory(
  agentId: string,
  callerPhone: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Database unconfigured.',
    };
  }

  const phoneHash = hashCallerPhone(callerPhone);
  return await clearCallerMemoryFromDb(agentId, phoneHash);
}
