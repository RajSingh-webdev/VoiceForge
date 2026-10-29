/**
 * Supabase REST client and persistence helpers with graceful offline / unconfigured fallback.
 * Strictly uses server-side SUPABASE_SERVICE_ROLE_KEY for privileged operations with RLS.
 */

import { AgentConfig, BookingRecord } from './types';

export interface DbAgentRecord {
  id?: string;
  agent_id: string;
  name: string;
  persona: string;
  welcome_message: string;
  welcome_message_hindi?: string;
  languages?: string[];
  voice_id?: string;
  voice_name?: string;
  config: AgentConfig;
  is_published?: boolean;
  is_sample?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbKnowledgeDocRecord {
  id: string;
  agent_id: string;
  name: string;
  type: string;
  size_bytes: number;
  mime_type: string;
  created_at?: string;
}

export interface DbCallerMemoryRecord {
  id?: string;
  agent_id?: string;
  phone_hash: string;
  display_name: string;
  call_count: number;
  last_call_at: string;
  preferred_language: string;
  notes: string[];
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && key);
}

/**
 * Low-level REST query helper to Supabase PostgREST endpoint
 */
export async function querySupabase<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: 'Supabase is not configured in environment variables.' };
  }

  const baseUrl = process.env.SUPABASE_URL!.trim().replace(/\/$/, '');
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

  try {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const res = await fetch(`${baseUrl}/rest/v1/${cleanEndpoint}`, {
      ...options,
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: options?.method === 'POST' ? 'return=representation' : 'return=representation',
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown database error');
      return { data: null, error: `Supabase returned HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json().catch(() => null);
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Database connection error' };
  }
}

// ---------------------------------------------------------------------------
// Typed Entity Operations
// ---------------------------------------------------------------------------

export async function saveAgentToDb(
  agent: DbAgentRecord
): Promise<{ success: boolean; error?: string; agent?: DbAgentRecord }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Database unconfigured. Cloud persistence is unavailable.' };
  }

  const payload = {
    agent_id: agent.agent_id,
    name: agent.name,
    persona: agent.persona,
    welcome_message: agent.welcome_message,
    welcome_message_hindi: agent.welcome_message_hindi,
    languages: agent.languages || ['English'],
    voice_id: agent.voice_id,
    voice_name: agent.voice_name,
    config: agent.config,
    is_published: agent.is_published ?? true,
    is_sample: agent.is_sample ?? false,
    updated_at: new Date().toISOString(),
  };

  // Upsert on conflict agent_id
  const result = await querySupabase<DbAgentRecord[]>('agents?on_conflict=agent_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  });

  if (result.error || !result.data) {
    return { success: false, error: result.error || 'Failed to persist agent to database.' };
  }

  return { success: true, agent: result.data[0] };
}

export async function getAgentFromDb(
  agentId: string
): Promise<{ found: boolean; agent: DbAgentRecord | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { found: false, agent: null, error: 'Database unconfigured.' };
  }

  const cleanId = encodeURIComponent(agentId.trim());
  const result = await querySupabase<DbAgentRecord[]>(`agents?agent_id=eq.${cleanId}&select=*`, {
    method: 'GET',
  });

  if (result.error) {
    return { found: false, agent: null, error: result.error };
  }

  const match = result.data && result.data.length > 0 ? result.data[0] : null;
  return { found: !!match, agent: match };
}

export async function saveBookingToDb(
  booking: BookingRecord,
  agentId?: string
): Promise<{ success: boolean; error?: string; booking?: any }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Database unconfigured.' };
  }

  const payload = {
    id: booking.id,
    agent_id: agentId || null,
    caller_name: booking.callerName,
    caller_phone: booking.callerPhone,
    appointment_date: booking.appointmentDate,
    appointment_time: booking.appointmentTime,
    service: booking.service || 'General Consultation',
    notes: booking.notes || null,
    status: booking.status || 'confirmed',
    created_at: booking.createdAt || new Date().toISOString(),
  };

  const result = await querySupabase<any[]>('bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (result.error) {
    return { success: false, error: result.error };
  }

  return { success: true, booking: result.data?.[0] };
}

export async function getBookingsFromDb(
  agentId?: string
): Promise<{ bookings: any[]; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { bookings: [], error: 'Database unconfigured.' };
  }

  const endpoint = agentId
    ? `bookings?agent_id=eq.${encodeURIComponent(agentId)}&order=appointment_date.desc,appointment_time.asc`
    : 'bookings?order=appointment_date.desc,appointment_time.asc';

  const result = await querySupabase<any[]>(endpoint, { method: 'GET' });
  return { bookings: result.data || [], error: result.error || undefined };
}

export async function saveKnowledgeDocToDb(
  doc: DbKnowledgeDocRecord
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Database unconfigured.' };
  }

  const result = await querySupabase('knowledge_documents?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(doc),
  });

  return { success: !result.error, error: result.error || undefined };
}

export async function deleteKnowledgeDocFromDb(
  docId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Database unconfigured.' };
  }

  const result = await querySupabase(`knowledge_documents?id=eq.${encodeURIComponent(docId)}`, {
    method: 'DELETE',
  });

  return { success: !result.error, error: result.error || undefined };
}

export async function getCallerMemoryFromDb(
  agentId: string,
  phoneHash: string
): Promise<{ found: boolean; memory: DbCallerMemoryRecord | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { found: false, memory: null, error: 'Database unconfigured.' };
  }

  const endpoint = `caller_memory?agent_id=eq.${encodeURIComponent(agentId)}&phone_hash=eq.${encodeURIComponent(phoneHash)}&select=*`;
  const result = await querySupabase<DbCallerMemoryRecord[]>(endpoint, { method: 'GET' });

  if (result.error) {
    return { found: false, memory: null, error: result.error };
  }

  const match = result.data && result.data.length > 0 ? result.data[0] : null;
  return { found: !!match, memory: match };
}

export async function saveCallerMemoryToDb(
  memory: DbCallerMemoryRecord
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Database unconfigured.' };
  }

  const result = await querySupabase('caller_memory?on_conflict=agent_id,phone_hash', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      ...memory,
      updated_at: new Date().toISOString(),
    }),
  });

  return { success: !result.error, error: result.error || undefined };
}

export async function clearCallerMemoryFromDb(
  agentId: string,
  phoneHash: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Database unconfigured.' };
  }

  const endpoint = `caller_memory?agent_id=eq.${encodeURIComponent(agentId)}&phone_hash=eq.${encodeURIComponent(phoneHash)}`;
  const result = await querySupabase(endpoint, { method: 'DELETE' });

  return { success: !result.error, error: result.error || undefined };
}
