'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useConversation } from '@elevenlabs/react';
import { AgentConfig, AgentDeployment } from '@/lib/types';

interface KrishiAssistantViewProps {
  agentId: string;
  config: AgentConfig;
  deployment?: AgentDeployment | null;
  isEmbed?: boolean;
}

export default function KrishiAssistantView({
  agentId,
  config,
  deployment,
  isEmbed = false,
}: KrishiAssistantViewProps) {
  // 1. Language state: Hindi is default
  const [lang, setLang] = useState<'hi' | 'en'>('hi');

  // 2. Interactive topic / question state
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'officer' | 'privacy' | 'terms' | 'help' | null>(null);

  // 3. Voice conversation states
  const [callActive, setCallActive] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<{ role: 'caller' | 'agent'; text: string }[]>([]);

  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ElevenLabs Conversational AI hook
  const conversation = useConversation({
    onConnect: () => {
      setCallActive(true);
      setIsStarting(false);
      setCallError(null);
      setHasMicPermission(true);
      setCallDuration(0);
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    },
    onDisconnect: () => {
      setCallActive(false);
      setIsStarting(false);
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    },
    onError: (err: any) => {
      setIsStarting(false);
      const msg = typeof err === 'string' ? err : err?.message || 'Voice connection issue';
      console.error('[Krishi Voice Error]:', msg);

      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
        setHasMicPermission(false);
        setCallError(
          lang === 'hi'
            ? 'माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया अपने ब्राउज़र में माइक्रोफ़ोन चालू करें।'
            : 'Microphone permission denied. Please allow microphone access in your browser settings.'
        );
      } else {
        setCallError(
          lang === 'hi'
            ? 'अभी जुड़ने में परेशानी हो रही है। कृपया दोबारा कोशिश करें।'
            : 'Unable to connect to the assistant right now. Please try again.'
        );
      }
    },
    onMessage: (payload: any) => {
      const text = payload.message || '';
      if (!text.trim()) return;
      const isCaller = payload.source === 'user' || payload.role === 'user';
      setLiveTranscript((prev) => [
        ...prev.slice(-4), // keep last 5 turns clean
        { role: isCaller ? 'caller' : 'agent', text },
      ]);
    },
  });

  const handleStartCall = async () => {
    setIsStarting(true);
    setCallError(null);

    try {
      // 1. Request microphone permission upfront
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setHasMicPermission(true);
          // Release track immediately; conversation SDK will re-acquire
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          setHasMicPermission(false);
          setIsStarting(false);
          setCallError(
            lang === 'hi'
              ? 'माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया ब्राउज़र में माइक्रोफ़ोन की अनुमति दें।'
              : 'Microphone access is needed to speak with the assistant.'
          );
          return;
        }
      }

      // 2. Request signed session URL from backend
      const res = await fetch(`/api/voice/session?agent_id=${encodeURIComponent(agentId)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize voice session.');
      }

      if (data.signedUrl) {
        await conversation.startSession({ signedUrl: data.signedUrl });
      } else {
        // Fallback simulation session
        setCallActive(true);
        setIsStarting(false);
        setCallDuration(0);
        durationTimerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } catch (err: any) {
      setIsStarting(false);
      setCallError(
        lang === 'hi'
          ? 'अभी कॉल शुरू करने में समस्या आई। कृपया पुनः प्रयास करें।'
          : err?.message || 'Failed to start voice call.'
      );
    }
  };

  const handleEndCall = async () => {
    try {
      await conversation.endSession();
    } catch {
      // Fallback
    } finally {
      setCallActive(false);
      setIsStarting(false);
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectQuestion = (qText: string) => {
    setSelectedTopic(qText);
    if (!callActive && !isStarting) {
      handleStartCall();
    }
  };

  const handleSelectTopic = (topicKey: string) => {
    if (topicKey === 'officer') {
      setActiveModal('officer');
    } else {
      setSelectedTopic(topicKey);
      if (!callActive && !isStarting) {
        handleStartCall();
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F1] text-[#25352C] font-sans flex flex-col justify-between selection:bg-[#EAF3E8] selection:text-[#194A35]">
      {/* ─────────────────────────────────────────────────────────── */}
      {/* A. HEADER                                                   */}
      {/* ─────────────────────────────────────────────────────────── */}
      <header className="w-full bg-[#FAF8F1] border-b border-[#DFE6DC]/80 sticky top-0 z-40 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo & Service Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF3E8] text-[#245B3F] flex items-center justify-center text-xl shadow-2xs border border-[#DFE6DC]">
              🌱
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-[#194A35] tracking-tight">
                  Krishi Seva Kendra
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs text-[#667368] font-medium">
                {lang === 'hi' ? 'किसानों की सहायता के लिए' : 'Dedicated to Farmer Assistance'}
              </p>
            </div>
          </div>

          {/* Controls: Language Pill, Help, Back Link */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Language Switcher */}
            <div
              className="inline-flex items-center p-1 bg-white rounded-full border border-[#DFE6DC] shadow-2xs"
              role="radiogroup"
              aria-label="Language Selection"
            >
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  lang === 'hi'
                    ? 'bg-[#194A35] text-white shadow-xs'
                    : 'text-[#25352C] hover:text-[#194A35]'
                }`}
                aria-checked={lang === 'hi'}
                role="radio"
              >
                हिन्दी
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  lang === 'en'
                    ? 'bg-[#194A35] text-white shadow-xs'
                    : 'text-[#25352C] hover:text-[#194A35]'
                }`}
                aria-checked={lang === 'en'}
                role="radio"
              >
                English
              </button>
            </div>

            {/* Help Button */}
            <button
              type="button"
              onClick={() => setActiveModal('help')}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-[#DFE6DC] text-xs font-bold text-[#25352C] transition-colors shadow-2xs"
            >
              <span>📞</span>
              <span>{lang === 'hi' ? 'सहायता' : 'Help'}</span>
            </button>

            {/* Back to VoiceForge Deployment */}
            {!isEmbed && (
              <Link
                href="/deploy"
                className="hidden md:inline-flex items-center space-x-1 text-xs font-bold text-[#245B3F] hover:text-[#194A35] transition-colors px-2 py-1 rounded-lg hover:bg-[#EAF3E8]"
                title="Return to builder"
              >
                <span>&larr;</span>
                <span>{lang === 'hi' ? 'VoiceForge पर वापस जाएँ' : 'Back to VoiceForge'}</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MAIN CONTENT AREA                                           */}
      {/* ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* ───────────────────────────────────────────────────────── */}
        {/* B. HERO SECTION (Farmer + Voice Card + Example Questions) */}
        {/* ───────────────────────────────────────────────────────── */}
        <section
          className="rounded-3xl border border-[#DFE6DC] bg-gradient-to-br from-[#EAF3E8]/70 via-[#FAF8F1] to-[#FAF5E6]/80 p-5 sm:p-7 lg:p-8 shadow-xs relative overflow-hidden"
          aria-label="Assistant Voice Interaction"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Column: Greeting & Farmer Image */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-[#245B3F]/10 text-[#194A35] border border-[#245B3F]/20 mb-3">
                  🌾 {lang === 'hi' ? 'कृषि सेवा केंद्र' : 'Farmer Support Center'}
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#194A35] leading-tight tracking-tight">
                  {lang === 'hi' ? (
                    <>
                      नमस्ते!<br />
                      खेती से जुड़ी कोई<br />
                      मदद चाहिए?
                    </>
                  ) : (
                    <>
                      Namaste!<br />
                      Need any help<br />
                      with your farming?
                    </>
                  )}
                </h2>
                <p className="text-xs sm:text-sm text-[#4E5D52] mt-3 leading-relaxed max-w-sm">
                  {lang === 'hi'
                    ? 'मौसम, मिट्टी की जाँच, सरकारी योजनाओं और खेती से जुड़ी जानकारी के लिए हमसे बात करें।'
                    : 'Talk to us for soil testing guidance, local weather forecasts, farming subsidies, and agricultural advice.'}
                </p>
              </div>

              {/* Farmer photo card */}
              <div className="relative pt-2">
                <div className="w-full h-36 sm:h-44 rounded-2xl overflow-hidden relative border border-[#DFE6DC] shadow-xs">
                  <Image
                    src="/krishi/farmer.jpg"
                    alt={lang === 'hi' ? 'भारतीय किसान' : 'Indian Farmer'}
                    fill
                    sizes="(max-width: 768px) 100vw, 350px"
                    className="object-cover object-top"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end p-3">
                    <p className="text-white text-xs font-semibold drop-shadow-xs">
                      {lang === 'hi'
                        ? 'सरल भाषा में सीधी कृषि सलाह'
                        : 'Practical farming advice in simple language'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Center Column: Primary Voice Interaction Card */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-7 border border-[#DFE6DC] shadow-md flex flex-col justify-between relative text-center">
              {/* Card Header & AI Disclosure */}
              <div className="text-left">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">🌱</span>
                    <h3 className="text-base sm:text-lg font-extrabold text-[#194A35]">
                      {lang === 'hi' ? 'आपकी सहायता के लिए तैयार' : 'Ready to Help You'}
                    </h3>
                  </div>
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EAF3E8] text-[#245B3F] border border-[#245B3F]/25">
                    <span>✓</span>
                    <span>{lang === 'hi' ? 'सुरक्षित और सरल' : 'Safe & Simple'}</span>
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#667368] leading-relaxed">
                  {lang === 'hi'
                    ? 'यह एक AI सहायक है। ज़रूरत पड़ने पर आप मानव अधिकारी से मदद माँग सकते हैं।'
                    : 'This is an AI assistant. You can request help from a human officer when needed.'}
                </p>
              </div>

              {/* Voice Interaction Circle */}
              <div className="py-6 sm:py-8 flex flex-col items-center justify-center">
                <div className="relative flex items-center justify-center">
                  {/* Glowing / Pulsing Ring on Active State */}
                  {callActive && (
                    <div
                      className={`absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full transition-all duration-500 ${
                        conversation.isSpeaking
                          ? 'bg-[#245B3F]/15 animate-ping'
                          : 'bg-emerald-400/20 animate-pulse'
                      }`}
                    />
                  )}

                  {/* Outer Button Circle */}
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#EAF3E8] flex items-center justify-center border-4 border-white shadow-inner relative z-10">
                    <button
                      type="button"
                      onClick={callActive ? handleEndCall : handleStartCall}
                      disabled={isStarting}
                      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-white transition-all transform active:scale-95 shadow-md focus:outline-none focus:ring-4 focus:ring-[#245B3F]/30 ${
                        callActive
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-[#245B3F] hover:bg-[#194A35]'
                      }`}
                      aria-label={
                        callActive
                          ? lang === 'hi'
                            ? 'कॉल समाप्त करें'
                            : 'End call'
                          : lang === 'hi'
                          ? 'बातचीत शुरू करें'
                          : 'Start talking'
                      }
                    >
                      {isStarting ? (
                        <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : callActive ? (
                        <span className="text-3xl">⏹</span>
                      ) : (
                        <svg className="w-10 h-10 sm:w-11 sm:h-11" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* State Label & Timer */}
                <div className="mt-4 min-h-[32px]">
                  {isStarting ? (
                    <p className="text-xs font-bold text-[#194A35] animate-pulse">
                      {lang === 'hi' ? 'बस एक पल, जुड़ रहे हैं...' : 'Connecting, please wait...'}
                    </p>
                  ) : callActive ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-xs font-bold text-[#194A35]">
                          {conversation.isSpeaking
                            ? lang === 'hi'
                              ? 'सहायक बोल रहा है...'
                              : 'Assistant is speaking...'
                            : lang === 'hi'
                            ? 'जी, बताइए... हम सुन रहे हैं'
                            : 'Listening to you...'}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#667368]">
                          ({formatTimer(callDuration)})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-[#4E5D52]">
                      {lang === 'hi' ? 'जब चाहें, बात शुरू करें।' : 'Ready to start whenever you are.'}
                    </p>
                  )}
                </div>

                {/* Primary Action Button */}
                <div className="w-full mt-3">
                  <button
                    type="button"
                    onClick={callActive ? handleEndCall : handleStartCall}
                    disabled={isStarting}
                    className={`w-full py-4 px-6 rounded-2xl font-extrabold text-sm sm:text-base transition-all shadow-sm flex items-center justify-center space-x-2 min-h-[56px] focus:outline-none focus:ring-4 ${
                      callActive
                        ? 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-300'
                        : 'bg-[#194A35] hover:bg-[#245B3F] text-white focus:ring-[#245B3F]/30'
                    }`}
                  >
                    {isStarting ? (
                      <span>{lang === 'hi' ? 'कॉल कनेक्ट हो रही है...' : 'Connecting...'}</span>
                    ) : callActive ? (
                      <>
                        <span>📞</span>
                        <span>{lang === 'hi' ? 'बातचीत समाप्त करें' : 'End Conversation'}</span>
                      </>
                    ) : (
                      <>
                        <span>🎙️</span>
                        <span>{lang === 'hi' ? 'बात करने के लिए दबाएँ' : 'Tap to Start Talking'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error message banner */}
              {callError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold text-left">
                  ⚠️ {callError}
                </div>
              )}

              {/* Live conversation turns (if in call) */}
              {callActive && liveTranscript.length > 0 && (
                <div className="mb-3 p-3 rounded-xl bg-gray-50 border border-gray-200 text-left max-h-28 overflow-y-auto space-y-1.5 text-xs">
                  {liveTranscript.slice(-2).map((turn, i) => (
                    <p key={i} className="leading-snug">
                      <strong className={turn.role === 'agent' ? 'text-[#245B3F]' : 'text-gray-900'}>
                        {turn.role === 'agent' ? (lang === 'hi' ? 'सहायक: ' : 'Agent: ') : (lang === 'hi' ? 'आप: ' : 'You: ')}
                      </strong>
                      <span className="text-gray-700">{turn.text}</span>
                    </p>
                  ))}
                </div>
              )}

              {/* Helpful first-time microphone guidance */}
              <div className="p-2.5 rounded-xl bg-[#EAF3E8]/80 text-[#245B3F] border border-[#DFE6DC] text-[11px] font-medium flex items-center justify-center space-x-1.5">
                <span>ℹ️</span>
                <span>
                  {lang === 'hi'
                    ? 'पहली बार इस्तेमाल कर रहे हैं? अपने ब्राउज़र में माइक्रोफ़ोन की अनुमति दें।'
                    : 'First time here? Please allow microphone access in your browser.'}
                </span>
              </div>
            </div>

            {/* Right Column: Example Questions Panel */}
            <div className="lg:col-span-3 bg-[#EAF3E8]/60 rounded-3xl p-4 sm:p-5 border border-[#DFE6DC] flex flex-col justify-between">
              <div>
                {/* Wheat Header Graphic */}
                <div className="w-full h-16 rounded-xl overflow-hidden relative mb-3 border border-[#DFE6DC]/60">
                  <Image
                    src="/krishi/wheat-header.jpg"
                    alt="Wheat stalks"
                    fill
                    sizes="250px"
                    className="object-cover"
                  />
                </div>

                <h3 className="text-sm font-extrabold text-[#194A35] mb-3">
                  {lang === 'hi' ? 'कुछ उदाहरण प्रश्न' : 'Example Questions'}
                </h3>

                {/* Clickable Question Cards */}
                <div className="space-y-2">
                  {[
                    {
                      hi: 'मेरे खेत की मिट्टी की जाँच कैसे कराएँ?',
                      en: 'How can I get my soil tested?',
                    },
                    {
                      hi: 'आज मेरे क्षेत्र में मौसम कैसा रहेगा?',
                      en: 'What is the weather like today?',
                    },
                    {
                      hi: 'कौन-कौन सी सरकारी योजनाएँ हैं?',
                      en: 'Which farming schemes are available?',
                    },
                    {
                      hi: 'अगर मेरी फसल में समस्या है तो क्या करें?',
                      en: 'What should I do if my crops have issues?',
                    },
                  ].map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectQuestion(lang === 'hi' ? q.hi : q.en)}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between group shadow-2xs ${
                        selectedTopic === (lang === 'hi' ? q.hi : q.en)
                          ? 'bg-[#194A35] text-white border-[#194A35]'
                          : 'bg-white hover:bg-white/95 text-[#25352C] border-[#DFE6DC]'
                      }`}
                    >
                      <span className="leading-snug pr-1">{lang === 'hi' ? q.hi : q.en}</span>
                      <span className="text-[#245B3F] group-hover:translate-x-0.5 transition-transform text-sm shrink-0">
                        &rsaquo;
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTopic && (
                <div className="mt-3 p-2 rounded-lg bg-white border border-[#245B3F]/20 text-[11px] text-[#194A35] text-left">
                  <strong>{lang === 'hi' ? 'चुना हुआ विषय:' : 'Active Topic:'}</strong> {selectedTopic}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ───────────────────────────────────────────────────────── */}
        {/* D. QUICK HELP OPTIONS ("आप किस बारे में मदद चाहते हैं?")   */}
        {/* ───────────────────────────────────────────────────────── */}
        <section aria-labelledby="quick-help-heading" className="space-y-3">
          <div>
            <h2 id="quick-help-heading" className="text-xl sm:text-2xl font-extrabold text-[#194A35]">
              {lang === 'hi' ? 'आप किस बारे में मदद चाहते हैं?' : 'What would you like help with?'}
            </h2>
            <p className="text-xs sm:text-sm text-[#667368]">
              {lang === 'hi'
                ? 'नीचे दिए गए विषयों में से कोई एक चुनें या सीधे बात करना शुरू करें।'
                : 'Choose a topic below or tap the microphone to ask directly.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Soil Testing */}
            <div
              onClick={() => handleSelectTopic('soil')}
              className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer shadow-2xs hover:shadow-sm flex items-center space-x-3.5 group ${
                selectedTopic === 'soil' ? 'border-[#245B3F] ring-2 ring-[#245B3F]/20' : 'border-[#DFE6DC] hover:border-[#245B3F]'
              }`}
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 border border-gray-100 bg-[#EAF3E8]">
                <Image src="/krishi/soil-icon.jpg" alt="Soil icon" fill sizes="48px" className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-[#194A35] group-hover:text-[#245B3F] transition-colors truncate">
                  {lang === 'hi' ? 'मिट्टी की जाँच' : 'Soil Testing'}
                </h3>
                <p className="text-[11px] text-[#667368] leading-snug line-clamp-2 mt-0.5">
                  {lang === 'hi'
                    ? 'मिट्टी की जाँच की प्रक्रिया और उपलब्ध सुविधाओं के बारे में जानें।'
                    : 'Learn about soil sample testing process and local testing labs.'}
                </p>
              </div>
              <span className="text-[#245B3F] font-bold text-lg group-hover:translate-x-1 transition-transform shrink-0">
                &rsaquo;
              </span>
            </div>

            {/* Card 2: Weather */}
            <div
              onClick={() => handleSelectTopic('weather')}
              className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer shadow-2xs hover:shadow-sm flex items-center space-x-3.5 group ${
                selectedTopic === 'weather' ? 'border-[#245B3F] ring-2 ring-[#245B3F]/20' : 'border-[#DFE6DC] hover:border-[#245B3F]'
              }`}
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 border border-gray-100 bg-[#EAF3E8]">
                <Image src="/krishi/weather-icon.jpg" alt="Weather icon" fill sizes="48px" className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-[#194A35] group-hover:text-[#245B3F] transition-colors truncate">
                  {lang === 'hi' ? 'मौसम की जानकारी' : 'Weather Information'}
                </h3>
                <p className="text-[11px] text-[#667368] leading-snug line-clamp-2 mt-0.5">
                  {lang === 'hi'
                    ? 'आज और आने वाले दिनों के मौसम की जानकारी और खेती के सुझाव पूछें।'
                    : 'Get forecasts for coming days and seasonal agricultural tips.'}
                </p>
              </div>
              <span className="text-[#245B3F] font-bold text-lg group-hover:translate-x-1 transition-transform shrink-0">
                &rsaquo;
              </span>
            </div>

            {/* Card 3: Government Schemes */}
            <div
              onClick={() => handleSelectTopic('schemes')}
              className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer shadow-2xs hover:shadow-sm flex items-center space-x-3.5 group ${
                selectedTopic === 'schemes' ? 'border-[#245B3F] ring-2 ring-[#245B3F]/20' : 'border-[#DFE6DC] hover:border-[#245B3F]'
              }`}
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 border border-gray-100 bg-[#EAF3E8]">
                <Image src="/krishi/scheme-icon.jpg" alt="Schemes icon" fill sizes="48px" className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-[#194A35] group-hover:text-[#245B3F] transition-colors truncate">
                  {lang === 'hi' ? 'सरकारी कृषि योजनाएँ' : 'Government Schemes'}
                </h3>
                <p className="text-[11px] text-[#667368] leading-snug line-clamp-2 mt-0.5">
                  {lang === 'hi'
                    ? 'विभिन्न सरकारी योजनाओं और सहायता सेवाओं के बारे में जानकारी लें।'
                    : 'Explore government subsidies, crop insurance, and assistance.'}
                </p>
              </div>
              <span className="text-[#245B3F] font-bold text-lg group-hover:translate-x-1 transition-transform shrink-0">
                &rsaquo;
              </span>
            </div>

            {/* Card 4: Speak to an Officer (Human Handoff) */}
            <div
              onClick={() => handleSelectTopic('officer')}
              className="p-4 rounded-2xl bg-white border border-[#DFE6DC] hover:border-[#E8B85B] transition-all cursor-pointer shadow-2xs hover:shadow-sm flex items-center space-x-3.5 group"
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 border border-gray-100 bg-[#FAF5E6]">
                <Image src="/krishi/officer-icon.jpg" alt="Officer icon" fill sizes="48px" className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-[#194A35] group-hover:text-[#245B3F] transition-colors truncate">
                  {lang === 'hi' ? 'कृषि अधिकारी से बात करें' : 'Speak to an Officer'}
                </h3>
                <p className="text-[11px] text-[#667368] leading-snug line-clamp-2 mt-0.5">
                  {lang === 'hi'
                    ? 'ज़रूरत पड़ने पर मानव अधिकारी से सहायता के बारे में पूछें।'
                    : 'Request human assistance from local agricultural officers.'}
                </p>
              </div>
              <span className="text-[#E8B85B] font-bold text-lg group-hover:translate-x-1 transition-transform shrink-0">
                &rsaquo;
              </span>
            </div>
          </div>
        </section>

        {/* ───────────────────────────────────────────────────────── */}
        {/* E. WHAT THIS SERVICE CAN HELP WITH                        */}
        {/* ───────────────────────────────────────────────────────── */}
        <section aria-labelledby="service-features-heading" className="space-y-3">
          <div>
            <h2 id="service-features-heading" className="text-xl sm:text-2xl font-extrabold text-[#194A35]">
              {lang === 'hi' ? 'हम आपकी कैसे मदद कर सकते हैं?' : 'How we can help you'}
            </h2>
            <p className="text-xs sm:text-sm text-[#667368]">
              {lang === 'hi'
                ? 'कृषि से जुड़ी आम ज़रूरतों के लिए आप हमसे इन विषयों पर बात कर सकते हैं।'
                : 'You can speak with our assistant regarding these key agricultural services.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Service 1: Soil Testing */}
            <div className="p-4 rounded-2xl bg-white border border-[#DFE6DC] shadow-2xs flex items-start space-x-3.5">
              <div className="w-20 h-16 rounded-xl overflow-hidden relative shrink-0 border border-gray-100">
                <Image src="/krishi/soil-testing.jpg" alt="Soil Testing" fill sizes="80px" className="object-cover" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#194A35]">
                  {lang === 'hi' ? 'मिट्टी की जाँच' : 'Soil Testing'}
                </h3>
                <p className="text-[11px] text-[#667368] mt-1 leading-relaxed">
                  {lang === 'hi'
                    ? 'मिट्टी की जाँच की प्रक्रिया, नमूना कैसे लें, और उपलब्ध सुविधाओं के बारे में जानें।'
                    : 'Learn how to collect soil samples correctly and locate local testing centers.'}
                </p>
              </div>
            </div>

            {/* Service 2: Weather & Crops */}
            <div className="p-4 rounded-2xl bg-white border border-[#DFE6DC] shadow-2xs flex items-start space-x-3.5">
              <div className="w-20 h-16 rounded-xl overflow-hidden relative shrink-0 border border-gray-100">
                <Image src="/krishi/weather-farming.jpg" alt="Weather and Crops" fill sizes="80px" className="object-cover" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#194A35]">
                  {lang === 'hi' ? 'मौसम और खेती' : 'Weather and Crops'}
                </h3>
                <p className="text-[11px] text-[#667368] mt-1 leading-relaxed">
                  {lang === 'hi'
                    ? 'मौसम से जुड़ी जानकारी और खेती के लिए उपयोगी मार्गदर्शन पूछें।'
                    : 'Receive seasonal crop advisories and local rainfall forecasts.'}
                </p>
              </div>
            </div>

            {/* Service 3: Agricultural Assistance */}
            <div className="p-4 rounded-2xl bg-white border border-[#DFE6DC] shadow-2xs flex items-start space-x-3.5">
              <div className="w-20 h-16 rounded-xl overflow-hidden relative shrink-0 border border-gray-100">
                <Image src="/krishi/agriculture-support.jpg" alt="Agricultural Support" fill sizes="80px" className="object-cover" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#194A35]">
                  {lang === 'hi' ? 'कृषि सहायता' : 'Agricultural Support'}
                </h3>
                <p className="text-[11px] text-[#667368] mt-1 leading-relaxed">
                  {lang === 'hi'
                    ? 'उपलब्ध कृषि योजनाओं, सहायता सेवाओं और खेती से जुड़ी सामान्य जानकारी लें।'
                    : 'Get details on PM-Kisan, crop insurance (PMFBY), and verified guidelines.'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* F. FOOTER                                                   */}
      {/* ─────────────────────────────────────────────────────────── */}
      <footer className="w-full bg-[#FAF8F1] border-t border-[#DFE6DC] mt-10 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          {/* Service branding & note */}
          <div className="flex items-center space-x-2.5">
            <span className="text-lg">🌱</span>
            <div>
              <p className="text-xs font-extrabold text-[#194A35]">
                Krishi Seva Kendra
              </p>
              <p className="text-[11px] text-[#667368]">
                {lang === 'hi'
                  ? 'आपकी खेती से जुड़ी जानकारी के लिए एक डिजिटल सहायता सेवा।'
                  : 'A digital voice assistance service dedicated to Indian farmers.'}
              </p>
            </div>
          </div>

          {/* Policy & Help links */}
          <div className="flex items-center space-x-4 text-xs font-semibold text-[#667368]">
            <button
              type="button"
              onClick={() => setActiveModal('privacy')}
              className="hover:text-[#194A35] transition-colors underline"
            >
              {lang === 'hi' ? 'गोपनीयता नीति' : 'Privacy Policy'}
            </button>
            <span>&middot;</span>
            <button
              type="button"
              onClick={() => setActiveModal('terms')}
              className="hover:text-[#194A35] transition-colors underline"
            >
              {lang === 'hi' ? 'सेवा की शर्तें' : 'Terms of Service'}
            </button>
            <span>&middot;</span>
            <button
              type="button"
              onClick={() => setActiveModal('help')}
              className="hover:text-[#194A35] transition-colors underline"
            >
              {lang === 'hi' ? 'सहायता' : 'Help & Hours'}
            </button>
          </div>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODALS: Officer Contact, Privacy, Terms, Help               */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-[#DFE6DC] shadow-xl text-left space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {activeModal === 'officer' && (
              <>
                <div className="w-12 h-12 rounded-2xl bg-[#FAF5E6] text-2xl flex items-center justify-center">
                  👨‍🌾
                </div>
                <h3 className="text-lg font-extrabold text-[#194A35]">
                  {lang === 'hi' ? 'कृषि अधिकारी से सहायता' : 'Agricultural Officer Assistance'}
                </h3>
                <p className="text-xs text-[#4E5D52] leading-relaxed">
                  {lang === 'hi'
                    ? 'यदि आपको कीटनाशक, गंभीर फसल रोग या व्यक्तिगत ऋण संबंधी जटिल सहायता चाहिए, तो आप सीधे अपने स्थानीय केंद्र या राष्ट्रीय किसान कॉल सेंटर से संपर्क कर सकते हैं:'
                    : 'For pesticide prescriptions, complex crop diseases, or official scheme registrations, contact your local extension center or the National Kisan Call Center:'}
                </p>
                <div className="p-3.5 rounded-2xl bg-[#EAF3E8] border border-[#245B3F]/20 space-y-1.5">
                  <p className="text-xs font-bold text-[#194A35]">
                    📞 {lang === 'hi' ? 'किसान कॉल सेंटर (टोल-फ्री):' : 'Kisan Call Centre (Toll-Free):'}
                  </p>
                  <p className="text-base font-extrabold text-[#245B3F] font-mono">
                    1800-180-1551
                  </p>
                  <p className="text-[11px] text-[#667368]">
                    {lang === 'hi'
                      ? 'समय: सोमवार से शनिवार, सुबह 9:00 बजे से शाम 5:00 बजे तक'
                      : 'Timings: Monday to Saturday, 9:00 AM – 5:00 PM'}
                  </p>
                </div>
              </>
            )}

            {activeModal === 'help' && (
              <>
                <div className="w-12 h-12 rounded-2xl bg-[#EAF3E8] text-2xl flex items-center justify-center">
                  ℹ️
                </div>
                <h3 className="text-lg font-extrabold text-[#194A35]">
                  {lang === 'hi' ? 'कृषि सेवा केंद्र सहायता' : 'Help & Center Information'}
                </h3>
                <p className="text-xs text-[#4E5D52] leading-relaxed">
                  {lang === 'hi'
                    ? 'कृषि सेवा केंद्र का यह डिजिटल सहायक आपकी खेती, मिट्टी परीक्षण और मौसम के सवालों का जवाब देने के लिए बनाया गया है।'
                    : 'Krishi Seva Kendra digital assistant is designed to provide quick, verified information on soil testing, weather forecasts, and agricultural practices.'}
                </p>
                <ul className="text-xs text-[#4E5D52] space-y-1.5 list-disc list-inside">
                  <li>{lang === 'hi' ? 'माइक बटन दबाएँ और स्वाभाविक रूप से बोलें।' : 'Tap the microphone and speak naturally.'}</li>
                  <li>{lang === 'hi' ? 'हिन्दी या अंग्रेज़ी में बात कर सकते हैं।' : 'Speak in either Hindi or English.'}</li>
                  <li>{lang === 'hi' ? 'ज़रूरत पड़ने पर अधिकारी ट्रांसफर की माँग करें।' : 'Ask for human officer transfer whenever needed.'}</li>
                </ul>
              </>
            )}

            {activeModal === 'privacy' && (
              <>
                <div className="w-12 h-12 rounded-2xl bg-[#EAF3E8] text-2xl flex items-center justify-center">
                  🔒
                </div>
                <h3 className="text-lg font-extrabold text-[#194A35]">
                  {lang === 'hi' ? 'गोपनीयता नीति' : 'Privacy Notice'}
                </h3>
                <p className="text-xs text-[#4E5D52] leading-relaxed">
                  {lang === 'hi'
                    ? 'आपकी आवाज़ केवल प्रश्न का उत्तर देने के लिए प्रोसेस की जाती है। हम आपकी कोई भी व्यक्तिगत जानकारी किसी तीसरे पक्ष को नहीं बेचते हैं।'
                    : 'Your voice audio is processed solely to provide conversational assistance. We do not sell or share your personal information with third parties.'}
                </p>
              </>
            )}

            {activeModal === 'terms' && (
              <>
                <div className="w-12 h-12 rounded-2xl bg-[#EAF3E8] text-2xl flex items-center justify-center">
                  📜
                </div>
                <h3 className="text-lg font-extrabold text-[#194A35]">
                  {lang === 'hi' ? 'सेवा की शर्तें' : 'Terms of Service'}
                </h3>
                <p className="text-xs text-[#4E5D52] leading-relaxed">
                  {lang === 'hi'
                    ? 'यह सेवा केवल सामान्य कृषि मार्गदर्शन के लिए है। किसी भी रासायनिक कीटनाशक के सटीक छिड़काव से पहले स्थानीय कृषि अधिकारी की सलाह अवश्य लें।'
                    : 'This service provides general agricultural informational guidance. For critical chemical pesticide dosages, always consult an authorized agricultural extension officer.'}
                </p>
              </>
            )}

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#194A35] hover:bg-[#245B3F] text-white text-xs font-bold transition-colors"
            >
              {lang === 'hi' ? 'बंद करें' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
