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

### What is currently simulated (Mock Mode)

While `USE_MOCK_ELEVENLABS="true"`:
- **Sample Agent ID**: The server route `/api/agents/create` generates a valid mock identifier (e.g. `sample-agent-smile-dental`) marked with a `Sample data` badge without requiring live ElevenLabs API credits.
- **Website Embed Widget**: Provides a structured HTML snippet placeholder embedding the active agent ID. The real script source is intentionally omitted until live credentials are configured, avoiding invented or broken URLs.
- **Phone (Simulated Flow)**: Displays a sample placeholder phone number (`+1 (555) 019-8432`) clearly flagged as `"Sample, not a real number"`. The 3-step routing flow explains telephony architecture without pretend calling or simulated phone ringing.
- **Public Agent Preview (`/agent/[id]`)**: A clean, shareable public landing page showing the assistant name, persona, AI disclosure notice, and welcome message. The voice button is cleanly disabled with notice: *"Voice conversation connects once ElevenLabs is set up"*, and notes that the draft preview is stored locally on the creating device.

### What will be real once ElevenLabs is connected

When `USE_MOCK_ELEVENLABS="false"` and live `ELEVENLABS_API_KEY` + `ELEVENLABS_AGENT_ID` are set:
1. **Live Agent Creation**: VoiceForge will invoke ElevenLabs' official Conversational AI API (`POST https://api.elevenlabs.io/v1/convai/agents/create`) to provision a persistent conversational agent with your custom voice, system prompt, knowledge base, and guardrails.
2. **Production Web Widget**: The embed card will output ElevenLabs' official `<elevenlabs-convai>` custom element and widget script tag for direct one-line copy-paste into WordPress, Webflow, Shopify, or static websites.
3. **Live Telecom / Twilio Inbound Numbers**: A live phone number claimed via Twilio or ElevenLabs telephony will route real telephone audio directly to the low-latency WebSocket endpoint (`wss://api.elevenlabs.io/v1/convai/conversation`), handling simultaneous inbound calls, answering customer queries with verified clinic knowledge, and escalating emergencies to human staff.

---

## 📊 Project Status

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Write** | **REAL** | Generates structured `AgentConfig` from plain English descriptions using Gemini (`gemini-3.5-flash-lite`). |
| **Website Extraction** | **REAL** | SSRF-protected crawler fetches public web pages and Gemini extracts facts, prices, hours, and FAQs. |
| **Refine** | **REAL** | Plain language prompt revisions generate field diffs with AI-disclosure enforcement, English retention, and Undo. |
| **Apply Fix** | **REAL (saved setup only)** | Diagnoses call transcripts, enforces owner inputs for missing facts, and merges fixes directly into saved local config. |
| **Observe** | **SAMPLE DATA** | 8 sample clinic conversations with metrics, filters, transcripts, and quality diagnosis. |
| **Deploy** | **SAMPLE DATA** | Creates mock agent ID (`sample-agent-...`), sample embed snippet, simulated phone flow, and device-only share link. |
| **Voice Test** | **NOT CONNECTED** | Test player UI is a placeholder; real two-way audio streaming requires active ElevenLabs credits. |
| **Real Agent Creation** | **NOT BUILT** | Mock agent creation implemented; production `POST /v1/convai/agents/create` calls are not yet wired. |
| **Voice Picker** | **NOT BUILT** | UI voice selector is a mockup; voice ID synthesis is not yet connected to live voice library. |
| **Knowledge Base Sync** | **NOT BUILT** | Facts stored in local configuration; external vector or document store synchronization not yet built. |
| **Booking Tool Integration** | **NOT BUILT** | Tool configurations are proposed definitions; real calendar webhook/API integrations not yet connected. |

### Known Limitations

1. **Browser-Only Storage**: Assistant configurations and deployments are stored in browser `localStorage`. Changes do not persist across different browsers or backend databases.
2. **Device-Isolated Share Link**: The public share link (`/agent/[id]`) only loads on the device that created the agent, as data is read locally.
3. **Gemini Free-Tier Rate Limits**: Rapid successive requests (generate, refine, extract, analyze) may temporarily encounter Google AI Studio free-tier rate limits (HTTP 429).

---

## 🔒 Security & Privacy

- **Zero Client API Key Leakage**: API keys (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`) reside strictly in server-side routes and utilities.
- **SSRF Defense**: The website crawler enforces strict DNS resolution checks, blocking loopback, link-local, private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x), and limits redirects and payload sizes.
- **Mandatory AI Disclosure**: Every agent greeting and public page explicitly discloses that the caller is speaking with an AI assistant.
