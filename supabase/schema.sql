-- ==============================================================================
-- VOICEFORGE — SUPABASE DATABASE SCHEMA & ROW-LEVEL SECURITY
-- ==============================================================================

-- 1. Agents Table
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
  is_sample BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Index for rapid agent lookups
CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON public.agents(agent_id);

-- 2. Conversations Table
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

-- Index for listing conversations by agent and start time
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON public.conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_start_time ON public.conversations(start_time DESC);

-- 3. Bookings Table (Webhook & Integration)
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
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

-- 4. Caller Memory Table (Privacy-Preserving Contact & History)
CREATE TABLE IF NOT EXISTS public.caller_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash TEXT UNIQUE NOT NULL, -- SHA256 hashed phone number for privacy
  display_name TEXT NOT NULL,
  call_count INTEGER DEFAULT 1,
  last_call_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  preferred_language TEXT DEFAULT 'English',
  notes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_caller_memory_phone_hash ON public.caller_memory(phone_hash);

-- 5. Row-Level Security (RLS) Policies
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caller_memory ENABLE ROW LEVEL SECURITY;

-- Anonymous public read access for published agents on public links (/agent/[id])
CREATE POLICY "Public agents are readable by anyone"
  ON public.agents FOR SELECT
  USING (true);

-- Authenticated / Service Role can manage all agents
CREATE POLICY "Service role manages agents"
  ON public.agents FOR ALL
  TO service_role
  USING (true);

-- Conversations are viewable by service role and authenticated workspace members
CREATE POLICY "Service role manages conversations"
  ON public.conversations FOR ALL
  TO service_role
  USING (true);

-- Bookings can be created via webhook and read by service role
CREATE POLICY "Public booking webhook insert"
  ON public.bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role manages bookings"
  ON public.bookings FOR ALL
  TO service_role
  USING (true);

-- Caller memory is private to service role
CREATE POLICY "Service role manages caller memory"
  ON public.caller_memory FOR ALL
  TO service_role
  USING (true);
