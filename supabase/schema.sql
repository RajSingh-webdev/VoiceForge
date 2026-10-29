-- ==============================================================================
-- VOICEFORGE — PRODUCTION SUPABASE DATABASE SCHEMA & ROW-LEVEL SECURITY
-- ==============================================================================

-- 1. Agents Table (Persistent Configurations & Publication State)
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  persona TEXT NOT NULL,
  welcome_message TEXT NOT NULL,
  welcome_message_hindi TEXT,
  languages TEXT[] DEFAULT ARRAY['English'],
  voice_id TEXT,
  voice_name TEXT,
  config JSONB NOT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  is_sample BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Index for rapid agent lookups and cross-device routing
CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON public.agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_published ON public.agents(is_published);

-- 2. Knowledge Documents Table
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES public.agents(agent_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'file',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_agent ON public.knowledge_documents(agent_id);

-- 3. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES public.agents(agent_id) ON DELETE SET NULL,
  caller_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'English',
  outcome TEXT NOT NULL CHECK (outcome IN ('Booked', 'Resolved', 'Flagged', 'Transferred to human')),
  summary TEXT NOT NULL,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_sample BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON public.conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_start_time ON public.conversations(start_time DESC);

-- 4. Bookings Table (Webhook & Integration Records)
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES public.agents(agent_id) ON DELETE SET NULL,
  caller_name TEXT NOT NULL,
  caller_phone TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TEXT NOT NULL,
  service TEXT NOT NULL DEFAULT 'General Consultation',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT uq_booking_dedup UNIQUE (caller_phone, appointment_date, appointment_time)
);

CREATE INDEX IF NOT EXISTS idx_bookings_phone ON public.bookings(caller_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(appointment_date);
CREATE INDEX IF NOT EXISTS idx_bookings_agent ON public.bookings(agent_id);

-- 5. Caller Memory Table (Privacy-Preserving Contact & History)
CREATE TABLE IF NOT EXISTS public.caller_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES public.agents(agent_id) ON DELETE CASCADE,
  phone_hash TEXT NOT NULL, -- SHA-256 salted hash of caller phone for privacy
  display_name TEXT NOT NULL,
  call_count INTEGER DEFAULT 1,
  last_call_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  preferred_language TEXT DEFAULT 'English',
  notes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT uq_caller_memory_agent_phone UNIQUE (agent_id, phone_hash)
);

CREATE INDEX IF NOT EXISTS idx_caller_memory_phone_hash ON public.caller_memory(phone_hash);
CREATE INDEX IF NOT EXISTS idx_caller_memory_agent ON public.caller_memory(agent_id);

-- 6. Row-Level Security (RLS) Policies
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caller_memory ENABLE ROW LEVEL SECURITY;

-- Agents: Anonymous public read access ONLY for published or sample agents on public share links (/agent/[id])
CREATE POLICY "Published agents are readable by anyone"
  ON public.agents FOR SELECT
  USING (is_published = true OR is_sample = true);

-- Agents: Service role manages all agent records
CREATE POLICY "Service role manages agents"
  ON public.agents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Knowledge Documents: Service role manages all knowledge documents
CREATE POLICY "Service role manages knowledge documents"
  ON public.knowledge_documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Conversations: Viewable only by service role (protects caller privacy and transcripts)
CREATE POLICY "Service role manages conversations"
  ON public.conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Bookings: Managed strictly by service role through backend webhook verification
CREATE POLICY "Service role manages bookings"
  ON public.bookings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Caller memory: Private to service role
CREATE POLICY "Service role manages caller memory"
  ON public.caller_memory FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
