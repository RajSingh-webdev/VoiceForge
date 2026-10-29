# VoiceForge — No-Code Voice AI Agent Builder

VoiceForge is a modern no-code platform that allows non-technical business owners to build, test, refine, deploy, and observe conversational Voice AI assistants powered by **Google Gemini** and **ElevenLabs**.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: Next.js App Router (React 18, TypeScript)
- **Styling**: Tailwind CSS
- **LLM Intelligence**: Google Gemini via official `@google/genai` SDK
- **Voice Engine**: ElevenLabs Conversational AI integration layer
- **Client Persistence**: Cross-tab synchronized local storage (`voiceforge:agent`, `voiceforge:deployment`, `voiceforge:fixes`)

---

## 🚀 The 5 Stages of VoiceForge

1. **Write (`/write`)**: Describe your business in plain English (or paste a business website link). Gemini extracts key facts and drafts a complete, editable assistant configuration (`AgentConfig`).
2. **Test (`/test`)**: Interactive test environment to validate conversation flow and tone.
3. **Refine (`/refine`)**: Natural language tuning interface with before/after diffs, live undo, and history tracking.
4. **Deploy (`/deploy`)**: Publish your assistant to web links, embeddable website widgets, and inbound phone lines.
5. **Observe (`/observe`)**: Call analytics dashboard with automatic AI-driven performance diagnosis and one-click fixes.

---

## 📡 Deployment & Telephony Architecture

The **Deploy** stage (`/deploy`) enables business owners to take their configured voice assistant live across multiple channels.

### Live vs Mock Capabilities

- **Real Agent Creation**: When `ELEVENLABS_REAL_AGENTS="true"` and `ELEVENLABS_API_KEY` is provided, clicking "Create agent" on `/deploy` provisions a live conversational agent in your ElevenLabs account (`POST https://api.elevenlabs.io/v1/convai/agents/create`) mapping your saved config, system prompt with business facts, and AI disclosure greeting. When not `"true"`, it returns a sample agent ID.
- **Live Agent Updates (Refine to Live)**: When `ELEVENLABS_REAL_AGENTS="true"`, revisions made on `/refine` can be synced directly to your live ElevenLabs agent (`PATCH https://api.elevenlabs.io/v1/convai/agents/{agent_id}`) with round-trip verification and sync state tracking in `voiceforge:sync`.
- **Website Embed Widget**: **SAMPLE DATA / NOT CONNECTED**. Provides a structured HTML snippet placeholder embedding the active agent ID. Real script source is not connected.
- **Phone**: **SAMPLE DATA / NOT CONNECTED**. Displays a sample placeholder phone number (`+1 (555) 019-8432`) clearly flagged as `"Sample, not a real number"`. The 3-step routing flow explains telephony architecture without pretend calling or simulated phone ringing.
- **Public Agent Preview (`/agent/[id]`)**: **SAMPLE DATA / NOT CONNECTED**. Share link loads from device-local storage.
- **Voice Test (`/test`)**: **REAL**. Connects to either the hand-made ElevenLabs agent (`ELEVENLABS_AGENT_ID`) or the newly created agent from `/deploy` via the official `@elevenlabs/react` SDK and server signed URLs.

---

## 📊 Project Status

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Write** | **REAL** | Generates structured `AgentConfig` from plain English descriptions using Gemini (`gemini-3.5-flash-lite`). |
| **Website Extraction** | **REAL** | SSRF-protected crawler fetches public web pages and Gemini extracts facts, prices, hours, and FAQs. |
| **Refine** | **REAL** | Plain language prompt revisions generate field diffs with AI-disclosure enforcement, English retention, and Undo. |
| **Refine to Live Agent** | **REAL** | Natural language changes can be pushed to the live ElevenLabs agent (`PATCH /v1/convai/agents/{agent_id}`) with round-trip verification, change detection, and sync status tracking. |
| **Apply Fix** | **REAL (saved setup only)** | Diagnoses call transcripts, enforces owner inputs for missing facts, and merges fixes directly into saved local config. |
| **Observe** | **SAMPLE DATA** | 8 sample clinic conversations with metrics, filters, transcripts, and quality diagnosis. |
| **Deploy** | **SAMPLE DATA / REAL AGENTS** | Creates real ElevenLabs agent when `ELEVENLABS_REAL_AGENTS="true"` (or sample ID in mock mode); widget snippet, simulated phone flow, and share link remain sample/not connected. |
| **Real Agent Creation** | **REAL** | Creates live ElevenLabs Conversational AI agents (`POST /v1/convai/agents/create`) from saved AgentConfig (system prompt with business facts, welcome greeting with AI disclosure, default voice; tools and knowledge-base documents not connected). |
| **Voice Test** | **REAL** | Connects to either the hand-made agent or the newly built agent via official `@elevenlabs/react` SDK and signed URL authentication. |
| **Share Page (`/agent/[id]`)** | **NOT CONNECTED** | Loads locally stored agent state only; disabled voice preview button with setup notice. |
| **Website Widget Snippet** | **NOT CONNECTED** | Embed code snippet placeholder; real script source not connected. |
| **Phone Inbound Routing** | **NOT CONNECTED** | Explanatory 3-step simulated diagram with sample placeholder number. |
| **Voice Picker** | **REAL** | Select voices from ElevenLabs (`GET /v1/voices`) with filters (use case, language with Hindi & English prioritized, gender), direct HTML5 audio previews, clear Hindi compatibility status, plan tier restriction protection, and live agent synchronization (`POST /v1/convai/agents/create`, `PATCH /v1/convai/agents/{agent_id}`). |
| **Knowledge Base Sync** | **NOT BUILT** | Facts stored in local configuration; external vector or document store synchronization not yet built. |
| **Booking Tool Integration** | **NOT BUILT** | Tool configurations are proposed definitions; real calendar webhook/API integrations not yet connected. |

### Known Limitations

1. **Browser-Only Storage**: Assistant configurations and deployments are stored in browser `localStorage`. Changes do not persist across different browsers or backend databases.
2. **Device-Isolated Share Link**: The public share link (`/agent/[id]`) only loads on the device that created the agent, as data is read locally.
3. **Gemini Free-Tier Rate Limits**: Rapid successive requests (generate, refine, extract, analyze) may temporarily encounter Google AI Studio free-tier rate limits (HTTP 429).

---

## 🌐 Languages (Bilingual English & Hindi Support)

VoiceForge conversational agents natively support fluid bilingual interactions across English and Hindi:
- **Primary Language**: English (`en`), configured in `conversation_config.agent.language`.
- **Additional Language**: Hindi (`hi`), configured via `conversation_config.language_presets.hi` with automatic language detection and real-time mid-call switching powered by `scribe_realtime` ASR.
- **TTS Model**: `eleven_flash_v2_5` (ElevenLabs' flagship ultra-low latency model with ~75ms inference latency, optimized specifically for real-time conversational agents across 32 languages including Hindi).
- **Default Voice**: `21m00Tcm4TlvDq8ikWAM` ("Rachel"), an expressive voice with native cross-lingual synthesis capabilities across English and Hindi.
- **Per-Language First Message**:
  - **English**: `welcomeMessage` (with verified AI disclosure, e.g. *"Hi, I am the AI assistant for Smile Dental..."*).
  - **Hindi**: `welcomeMessageHindi` (with verified AI disclosure, e.g. *"नमस्ते! मैं Smile Dental का AI सहायक हूँ..."*), mapped into `language_presets.hi.overrides.agent.first_message`.
- **What Has Been Tested**:
  - Deterministic generation of Hindi welcome greeting with Gemini (`callLLM`) adhering to zero-hallucination rules and strict AI identity disclosure.
  - Round-trip synchronization check in `/api/agents/update` verifying both primary language (`en`) and Hindi preset configuration (`hi`).
  - Bilingual conversational flows with natural code-switching (Hinglish/Hindi inquiries).

---

## 🔒 Security & Privacy

- **Zero Client API Key Leakage**: API keys (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`) reside strictly in server-side routes and utilities.
- **SSRF Defense**: The website crawler enforces strict DNS resolution checks, blocking loopback, link-local, private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x), and limits redirects and payload sizes.
- **Mandatory AI Disclosure**: Every agent greeting and public page explicitly discloses that the caller is speaking with an AI assistant.

---

## 🧪 Testing

VoiceForge includes a Playwright end-to-end testing suite divided into two distinct groups to protect API quotas:

### Group A: Smoke Tests (Zero AI Quota)
Group A intercepts all `/api/*` network calls that would otherwise query Gemini or ElevenLabs, returning deterministic mock payloads. It validates all pages, UI navigation, draft generation, character limits, flow step reordering, natural language refinement diffs, AI disclosure enforcement, call analytics metrics and filters, one-click fix application and undo, deployment links, and server-side SSRF security defenses.

To run Group A tests:
```bash
npm run test:e2e
```

### Group B: Live API Tests (Consumes Gemini Quota)
Group B verifies real API endpoints with live Google Gemini calls. It is capped at a maximum of 4 Gemini calls across the entire suite and does not make live ElevenLabs calls:
1. `GET /api/health` — Zero quota, verifies server health.
2. Generate stage — 1 call, validates real schema output and AI disclosure.
3. Refine stage — 2 calls, validates prompt refinement and enforced AI disclosure retention.
4. Call analysis — 1 call, validates diagnostic reasoning without hallucinating unverified business details.

To run Group B live tests:
```bash
npm run test:e2e:live
```

### Manual Voice Conversation Verification
Real bi-directional voice streaming, low-latency audio, microphone permissions, echo cancellation, barge-in interruptions, and multilingual comprehension cannot be tested reliably using synthetic browser mocking. Refer to the manual testing checklist:
- See [`tests/e2e/voice.manual.md`](./tests/e2e/voice.manual.md) for full step-by-step verification instructions.

