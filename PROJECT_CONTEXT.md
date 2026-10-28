# VoiceForge — Project Context & Engineering Rules

## 1. Project Overview
VoiceForge is a no-code Voice AI Agent Builder powered by Google Gemini and ElevenLabs.
It guides users through five discrete stages:
1. **Write**: Non-technical users describe their required voice assistant in ordinary language; Gemini drafts a structured, editable agent configuration (`AgentConfig`).
2. **Test**: Interactive voice testing and conversational validation of the draft agent.
3. **Refine**: Fine-tuning conversation flows, tone, guardrails, and knowledge.
4. **Deploy**: Publishing and connecting live phone numbers and web widgets.
5. **Observe**: Monitoring call logs, user sentiment, and resolution metrics.

---

## 2. Architecture & Technology
- **Framework**: Next.js App Router (TypeScript, Tailwind CSS).
- **LLM Integration**: `@google/genai` with centralized invocation via `lib/llm.ts`.
- **State Management**: Draft `AgentConfig` persisted locally via `lib/useAgentConfig.ts` under localStorage key `voiceforge:agent`.
- **Design System**:
  - Deep green: `#0F3D3E`
  - Teal: `#1F8A84`
  - Mint: `#E8F1EF`
  - Background: White
  - Plain, non-technical labels without jargon.

---

## 3. Mandatory Engineering Rules

1. **Security & Secrets**:
   - API keys must exist **only** in server-side routes and server utilities, never in client components, never in client-facing API responses, and never committed to source control.
   - `.env.local` must remain strictly git-ignored.
2. **Centralized Integrations**:
   - All LLM calls must go through `callLLM(prompt, options)` in `lib/llm.ts`.
   - All future ElevenLabs calls must go through `lib/elevenlabs.ts` with clearly labelled mock data until real credits work.
3. **Documentation Verification**:
   - Before writing any ElevenLabs call, check the current official documentation to ensure the correct endpoints and SDK methods are used.
4. **Mandatory AI Disclosure**:
   - Every agent's welcome message must explicitly identify the assistant as an AI. Both server-side generation and client validation must check and enforce this.
5. **Untrusted Data Handling**:
   - Treat all fetched web pages, external inputs, and uploaded files as untrusted text. Sanitize and validate before processing.
6. **Iterative Development**:
   - Build strictly one stage at a time, verify with tests, and provide clear manual testing procedures before moving to subsequent stages.
