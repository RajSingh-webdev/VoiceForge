# VoiceForge Manual Voice Testing Checklist (/test)

> **Why Manual Testing is Required for Real Voice Conversations:**
> Automated browser testing frameworks (such as Playwright with fake media streams or mocked WebSockets) cannot reliably validate end-to-end bi-directional voice streaming, low-latency conversational audio, acoustic echo cancellation, background noise filtering, spoken-language accent comprehension (e.g. Hindi/English code-switching), or natural barge-in / interruption responsiveness. Real audio input and output through ElevenLabs conversational WebSockets requires human verification with real microphones, real speakers, and human speech timing.

---

## Prerequisites

1. Set `ELEVENLABS_REAL_VOICE="true"` in `.env.local`.
2. Ensure valid `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` are configured in `.env.local`.
3. Verify that your microphone and audio output devices are functional and selected in OS settings.
4. Launch the application (`npm run dev`) and navigate to `http://localhost:3000/test`.

---

## Manual Verification Checklist

| Scenario | Steps to Execute | Expected Behavior | Observed Result (Pass / Fail) |
|---|---|---|---|
| **1. Session Start & Microphone Permission** | 1. Open `http://localhost:3000/test`.<br>2. Click **Start conversation**.<br>3. When prompted by the browser, allow microphone access. | Browser displays microphone permission prompt. Upon allowing, the status changes to "Connected" (or "Listening"), status indicator turns green/active, and the session timer begins. | |
| **2. Audible Agent Reply** | 1. Speak clearly into the microphone: *"Hello, what services do you offer?"*<br>2. Wait for the agent to finish. | The agent acknowledges speech, processes audio with low latency, and responds with a natural, clear voice through the system audio output. | |
| **3. Interruption (Barge-in)** | 1. Ask a question that produces an extended answer (e.g., *"Tell me all your working hours and doctors"*).<br>2. While the agent is actively speaking, speak aloud: *"Excuse me, can I book an appointment instead?"* | The agent immediately stops speaking mid-sentence upon detecting user speech, switches to listening mode, and answers the new inquiry without delay or audio buffer overlap. | |
| **4. Hindi Language / Multilingual Reply** | 1. Speak in Hindi: *"Kya aap kal subah appointment de sakte hain?"* (Can you give an appointment tomorrow morning?) | The agent understands the Hindi inquiry and replies in Hindi (or fluent Hinglish) appropriately. | |
| **5. Denied Microphone Permission** | 1. In browser site settings, block / deny microphone permissions for `http://localhost:3000`.<br>2. Reload `/test` and click **Start conversation**. | Connection is prevented; the UI displays a clear, helpful error message explaining that microphone access is required to talk to the agent. | |
| **6. Clean Session Termination** | 1. While in an active call, click **End session** (or disconnect). | The session terminates immediately, the audio stream disconnects cleanly, the microphone indicator turns off, and the UI resets to the disconnected state. | |
