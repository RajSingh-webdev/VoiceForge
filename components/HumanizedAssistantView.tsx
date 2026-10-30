'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useConversation } from '@elevenlabs/react';
import { AgentConfig, AgentDeployment } from '@/lib/types';
import SampleDataBadge from '@/components/SampleDataBadge';

interface HumanizedAssistantViewProps {
  agentId: string;
  config: AgentConfig;
  deployment?: AgentDeployment | null;
  isEmbed?: boolean;
}

export default function HumanizedAssistantView({
  agentId,
  config,
  deployment,
  isEmbed = false,
}: HumanizedAssistantViewProps) {
  // Bilingual detection: check if assistant supports Hindi
  const hasHindi = (config.languages || []).some(
    (l) => l.toLowerCase().includes('hindi') || l.toLowerCase().includes('hi')
  );

  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [callActive, setCallActive] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<Array<{ role: 'caller' | 'agent'; text: string }>>([]);
  const [activeTransfer, setActiveTransfer] = useState<{
    destination: string;
    reason: string;
    timestamp: string;
  } | null>(null);

  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      setCallActive(true);
      setIsStarting(false);
      setCallError(null);
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
      const msg = typeof err === 'string' ? err : err?.message || 'Connection error';
      if (msg.includes('microphone') || msg.includes('Permission')) {
        setCallError(
          lang === 'hi'
            ? 'माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया ब्राउज़र में माइक्रोफ़ोन की अनुमति दें।'
            : 'Microphone access was denied. Please allow microphone permissions in your browser settings.'
        );
      } else {
        setCallError(
          lang === 'hi'
            ? 'अभी जुड़ने में परेशानी हो रही है। कृपया दोबारा कोशिश करें।'
            : 'Unable to connect to the assistant right now. Please try again in a moment.'
        );
      }
    },
    onMessage: (payload: any) => {
      const text = payload.message || '';
      if (!text.trim()) return;
      const isCaller = payload.source === 'user' || payload.role === 'user';
      setLiveTranscript((prev) => [
        ...prev.slice(-3),
        { role: isCaller ? 'caller' : 'agent', text },
      ]);
    },
    clientTools: {
      transfer_to_number: async (props: any) => {
        const dest =
          config.transferPhoneNumber ||
          config.knowledge?.contact ||
          '+91 6201228417';
        const cleanPhone = dest.replace(/[^0-9+]/g, '');

        setActiveTransfer({
          destination: dest,
          reason: props?.reason || 'Caller requested human handoff',
          timestamp: new Date().toLocaleTimeString(),
        });

        // Notify escalation webhook
        try {
          fetch('/api/webhooks/escalate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callerName: 'Live Helpline Caller',
              callerPhone: 'Web Audio Session',
              transferPhone: dest,
              targetPhone: dest,
              reason: props?.reason || 'Customer requested to speak with staff',
              agentId,
            }),
          }).catch(() => {});
        } catch {}

        // Trigger native dialer on mobile devices
        if (typeof window !== 'undefined') {
          try {
            window.location.href = `tel:${cleanPhone}`;
          } catch {}
        }

        return `Connecting you directly to our human staff at ${dest} right now. Please stay on the line.`;
      },
      language_detection: async (props: any) => {
        const l = props?.language || 'en';
        setLang(l === 'hi' ? 'hi' : 'en');
        return `Language switched to ${l}`;
      },
    },
  });

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, []);

  const handleStartCall = async () => {
    setIsStarting(true);
    setCallError(null);

    try {
      // 1. Check microphone permission upfront
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setHasMicPermission(true);
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          setHasMicPermission(false);
          setIsStarting(false);
          setCallError(
            lang === 'hi'
              ? 'माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया ब्राउज़र में माइक्रोफ़ोन चालू करें।'
              : 'Microphone permission is required to start speaking.'
          );
          return;
        }
      }

      // 2. Request signed session URL
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
          ? 'अभी कॉल शुरू करने में समस्या आई। कृपया दोबारा प्रयास करें।'
          : err?.message || 'Unable to establish voice connection.'
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

  // Derive initial monogram for organization branding
  const orgInitials = (config.name || 'VA')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  // Extract humanized service highlights from goals or knowledge
  const serviceHighlights = (config.goals && config.goals.length > 0)
    ? config.goals.slice(0, 4)
    : (config.knowledge?.services && config.knowledge.services.length > 0)
    ? config.knowledge.services.slice(0, 4)
    : [
        'Answer general inquiries and business questions',
        'Help schedule appointments or bookings',
        'Provide verified operating hours and pricing',
        'Connect you directly with human staff when needed',
      ];

  // Dynamic sample questions for callers
  const sampleQuestions = (config.knowledge?.faqs && config.knowledge.faqs.length > 0)
    ? config.knowledge.faqs.slice(0, 4).map((f) => f.question)
    : [
        lang === 'hi' ? 'आपकी सेवाएँ और समय क्या हैं?' : 'What are your hours and services?',
        lang === 'hi' ? 'क्या मैं अपॉइंटमेंट ले सकता हूँ?' : 'Can I schedule an appointment?',
        lang === 'hi' ? 'क्या मुझे कीमतों की जानकारी मिल सकती है?' : 'What are your rates or pricing?',
        lang === 'hi' ? 'क्या मैं किसी मानव प्रतिनिधि से बात कर सकता हूँ?' : 'Can I speak with a human representative?',
      ];

  return (
    <div className={`min-h-screen bg-[#FAF9F6] text-[#25352C] ${isEmbed ? 'p-2 sm:p-4' : 'py-4 sm:py-8 px-3 sm:px-6'}`}>
      <div className="w-full max-w-2xl mx-auto space-y-6">

        {/* 1. COMPACT HUMANIZED HEADER */}
        <header className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0F3D3E] to-[#1F8A84] text-white flex items-center justify-center text-lg font-extrabold shadow-xs shrink-0 tracking-wider">
              {orgInitials || 'VF'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-[#0F3D3E] tracking-tight">
                  {config.name}
                </h1>
                {deployment?.isSample && <SampleDataBadge />}
              </div>
              <p className="text-xs text-[#5E7267] font-medium flex items-center space-x-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <span>
                  {lang === 'hi' ? 'आधिकारिक वॉइस हेल्पलाइन' : 'Official Voice Helpline'}
                </span>
                <span>•</span>
                <span>{config.voiceName || 'Voice Assistant'}</span>
              </p>
            </div>
          </div>

          {/* Bilingual Switcher (shown when agent supports Hindi) */}
          {hasHindi && (
            <div className="flex items-center bg-[#F1F5F3] p-1 rounded-xl border border-[#DFE6DC] shrink-0 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  lang === 'hi'
                    ? 'bg-white text-[#0F3D3E] shadow-2xs font-bold'
                    : 'text-[#667368] hover:text-[#0F3D3E]'
                }`}
              >
                Hindi
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  lang === 'en'
                    ? 'bg-white text-[#0F3D3E] shadow-2xs font-bold'
                    : 'text-[#667368] hover:text-[#0F3D3E]'
                }`}
              >
                English
              </button>
            </div>
          )}
        </header>

        {/* Direct Call Live Transfer Overlay Banner */}
        {activeTransfer && (
          <div className="bg-gradient-to-r from-emerald-600 via-[#1F8A84] to-[#0F3D3E] text-white p-5 rounded-3xl shadow-xl border-2 border-emerald-400/40 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5 text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shadow-inner shrink-0 animate-bounce">
                  📞
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white text-emerald-800 shadow-xs">
                      {lang === 'hi' ? 'कॉल ट्रांसफर सक्रिय' : 'Directing Call to Staff'}
                    </span>
                    <span className="text-xs text-white/80">{activeTransfer.timestamp}</span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight text-white mt-0.5">
                    {activeTransfer.destination}
                  </h3>
                  <p className="text-xs text-emerald-100/90">
                    {lang === 'hi'
                      ? 'AI सहायक द्वारा मानव प्रतिनिधि को कॉल ट्रांसफर किया जा रहा है।'
                      : 'Live human escalation active. Assistant initiated direct call routing.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5 shrink-0 w-full sm:w-auto">
                <a
                  href={`tel:${activeTransfer.destination.replace(/[^0-9+]/g, '')}`}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-white text-emerald-800 font-extrabold text-xs shadow-md hover:bg-emerald-50 active:scale-95 transition-all"
                >
                  <span>📞 {lang === 'hi' ? 'सीधे कॉल करें' : 'Call Directly'}</span>
                </a>
                <a
                  href={`https://wa.me/${activeTransfer.destination.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(lang === 'hi' ? 'नमस्ते! मैंने अभी आपकी AI हेल्पलाइन पर बात की और आपसे बात करना चाहता हूँ।' : 'Hello! I was just speaking with your AI helpline assistant and requested to speak with you.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/40 text-white font-bold text-xs border border-white/20 active:scale-95 transition-all"
                >
                  <span>💬 WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActiveTransfer(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs transition-colors"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. WELCOMING INTRODUCTION CARD */}
        <div className="bg-white rounded-3xl p-4 sm:p-7 border border-[#E2E8F0] shadow-xs text-center space-y-3">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E8F1EF] text-[#0F3D3E] border border-[#1F8A84]/20">
            <span>👋</span>
            <span>{lang === 'hi' ? 'नमस्ते एवं स्वागत है' : 'Welcome to our voice desk'}</span>
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F3D3E] tracking-tight">
            {lang === 'hi' ? `नमस्ते! ${config.name} में आपका स्वागत है` : `Hello! How can we help you today?`}
          </h2>

          <p className="text-sm sm:text-base text-[#4A5D52] max-w-lg mx-auto leading-relaxed">
            {lang === 'hi'
              ? (config.welcomeMessageHindi || config.welcomeMessage || 'हम आपकी सहायता के लिए तैयार हैं। बेझिझक अपनी बात कहें।')
              : (config.welcomeMessage || 'We are ready to assist with your questions, appointments, and inquiries.')}
          </p>

          {/* Transparent, friendly AI disclosure */}
          <div className="pt-2">
            <p className="text-xs text-[#6B7D72] bg-[#FAF9F6] border border-[#E8ECE9] py-2 px-3 rounded-xl max-w-md mx-auto inline-flex items-center space-x-2">
              <span className="text-[#1F8A84] font-bold">ℹ️</span>
              <span>
                {lang === 'hi'
                  ? 'यह एक AI वॉइस सहायक है। आवश्यकता होने पर आप मानव प्रतिनिधि से बात कर सकते हैं।'
                  : 'You are talking to an AI assistant.'}
              </span>
            </p>
          </div>
        </div>

        {/* 3. PRIMARY CALL INTERACTION CARD */}
        <div className="bg-white rounded-3xl p-4 sm:p-8 border-2 border-[#1F8A84]/30 shadow-sm text-center space-y-5 sm:space-y-6">
          <div className="flex items-center justify-between border-b border-[#F0F4F2] pb-4">
            <div className="text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1F8A84]">
                {callActive ? (lang === 'hi' ? 'कॉल जारी है' : 'Call in Progress') : (lang === 'hi' ? 'बातचीत शुरू करें' : 'Voice Interaction')}
              </span>
              <p className="text-xs text-[#6B7D72]">
                {callActive
                  ? (conversation.isSpeaking
                      ? (lang === 'hi' ? 'सहायक बोल रहा है...' : `${config.name} is speaking...`)
                      : (lang === 'hi' ? 'आपकी बात सुन रहे हैं...' : 'Listening to you...'))
                  : (lang === 'hi' ? 'सीधे ब्राउज़र में बोलकर सवाल पूछें' : 'Speak directly in your browser with no app needed')}
              </p>
            </div>

            {callActive && (
              <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full border border-emerald-300 font-mono text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>{formatTimer(callDuration)}</span>
              </div>
            )}
          </div>

          {/* Visual Waveform (Active during call) */}
          {callActive && (
            <div className="flex items-center justify-center space-x-2 py-4">
              <div
                className={`w-2.5 h-7 rounded-full transition-all duration-200 ${
                  conversation.isSpeaking ? 'bg-[#1F8A84] animate-bounce' : 'bg-emerald-300'
                }`}
              ></div>
              <div
                className={`w-2.5 h-12 rounded-full transition-all duration-200 ${
                  conversation.isSpeaking ? 'bg-[#0F3D3E] animate-pulse' : 'bg-emerald-400'
                }`}
              ></div>
              <div
                className={`w-2.5 h-16 rounded-full transition-all duration-200 ${
                  conversation.isSpeaking ? 'bg-[#1F8A84] animate-bounce' : 'bg-emerald-500'
                }`}
              ></div>
              <div
                className={`w-2.5 h-10 rounded-full transition-all duration-200 ${
                  conversation.isSpeaking ? 'bg-[#0F3D3E] animate-pulse' : 'bg-emerald-400'
                }`}
              ></div>
              <div
                className={`w-2.5 h-6 rounded-full transition-all duration-200 ${
                  conversation.isSpeaking ? 'bg-[#1F8A84] animate-bounce' : 'bg-emerald-300'
                }`}
              ></div>
            </div>
          )}

          {/* Live Transcript Snippet */}
          {callActive && liveTranscript.length > 0 && (
            <div className="bg-[#FAF9F6] border border-[#E2E8F0] p-4 rounded-2xl text-left space-y-2 max-w-lg mx-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7D72] block">
                {lang === 'hi' ? 'लाइव बातचीत' : 'Live Transcript'}
              </span>
              {liveTranscript.map((turn, i) => (
                <div key={i} className="text-xs leading-relaxed flex items-start space-x-2">
                  <span className="font-bold shrink-0 text-[#0F3D3E]">
                    {turn.role === 'caller' ? (lang === 'hi' ? 'आप:' : 'You:') : `${config.name}:`}
                  </span>
                  <span className="text-[#3F5045]">{turn.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Error Notice */}
          {callError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 font-medium text-left flex items-start space-x-2.5">
              <span className="text-base shrink-0">⚠️</span>
              <div className="flex-1">
                <p className="font-bold">{lang === 'hi' ? 'संपर्क में समस्या' : 'Call Notice'}</p>
                <p className="mt-0.5">{callError}</p>
              </div>
              <button
                type="button"
                onClick={() => setCallError(null)}
                className="text-red-700 hover:text-red-950 font-bold text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* DOMINANT TOUCH-FRIENDLY CALL BUTTON */}
          <div className="pt-2">
            {callActive ? (
              <button
                type="button"
                onClick={handleEndCall}
                className="w-full min-h-[62px] py-4 px-8 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-base sm:text-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-3 active:scale-[0.99]"
              >
                <span className="text-xl">📞</span>
                <span>{lang === 'hi' ? 'कॉल समाप्त करें' : 'End Call'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartCall}
                disabled={isStarting}
                className="w-full min-h-[64px] py-4 px-8 rounded-2xl bg-[#0F3D3E] hover:bg-[#194A35] active:bg-[#0F3D3E] text-white font-extrabold text-base sm:text-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-3 disabled:opacity-60 disabled:cursor-not-allowed group active:scale-[0.99]"
              >
                {isStarting ? (
                  <>
                    <svg
                      className="animate-spin h-6 w-6 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>{lang === 'hi' ? 'बस एक पल, जुड़ रहे हैं...' : 'Connecting to Assistant...'}</span>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-[#1F8A84] flex items-center justify-center text-lg shadow-inner group-hover:scale-105 transition-transform">
                      🎙️
                    </div>
                    <span>{lang === 'hi' ? 'बात करने के लिए दबाएँ' : 'Tap to Start Speaking'}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Microphone permission helper */}
          {hasMicPermission === null && !callActive && (
            <p className="text-xs text-[#6B7D72] flex items-center justify-center space-x-1.5">
              <span>🎤</span>
              <span>
                {lang === 'hi'
                  ? 'पहली बार इस्तेमाल कर रहे हैं? शुरू करने पर ब्राउज़र में माइक्रोफ़ोन की अनुमति दें।'
                  : 'First time here? Please allow microphone access in your browser when prompted.'}
              </span>
            </p>
          )}
        </div>

        {/* 4. "WHAT WE CAN HELP YOU WITH" (Clean, Humanized Cards, NO stock photos) */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-4 text-left">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#0F3D3E]">
                {lang === 'hi' ? 'हम आपकी किस प्रकार सहायता कर सकते हैं?' : 'How We Can Help You'}
              </h3>
              <p className="text-xs text-[#5E7267]">
                {lang === 'hi'
                  ? 'सहायक इन मुख्य विषयों पर आपकी पूरी सहायता कर सकता है'
                  : 'Ask our assistant about any of the following topics'}
              </p>
            </div>
            <span className="text-xs font-bold text-[#1F8A84] bg-[#E8F1EF] px-2.5 py-1 rounded-full">
              {serviceHighlights.length} {lang === 'hi' ? 'सेवाएँ' : 'Services'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {serviceHighlights.map((service, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E8ECE9] flex items-start space-x-3 hover:border-[#1F8A84]/40 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-white border border-[#DFE6DC] text-[#1F8A84] flex items-center justify-center text-sm font-bold shrink-0 shadow-2xs">
                  {idx === 0 ? '🗓️' : idx === 1 ? 'ℹ️' : idx === 2 ? '💬' : '📞'}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0F3D3E] leading-snug">
                    {service}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. "COMMON QUESTIONS YOU CAN ASK" */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-3 text-left">
          <h3 className="text-base sm:text-lg font-extrabold text-[#0F3D3E]">
            {lang === 'hi' ? 'आप क्या पूछ सकते हैं? (उदाहरण)' : 'Common Questions You Can Ask'}
          </h3>
          <p className="text-xs text-[#5E7267]">
            {lang === 'hi'
              ? 'कॉल शुरू करने के बाद आप सीधे ऐसे प्रश्न पूछ सकते हैं:'
              : 'Speak naturally to the assistant. Here are common questions callers ask:'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {sampleQuestions.map((q, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#F4F7F5] border border-[#E2E8F0] text-xs font-medium text-[#25352C] flex items-center space-x-2"
              >
                <span className="text-[#1F8A84] font-bold shrink-0">💬</span>
                <span>&ldquo;{q}&rdquo;</span>
              </div>
            ))}
          </div>
        </div>

        {/* 7. CLEAN PUBLIC FOOTER */}
        <footer className="text-center text-xs text-[#7A8A7F] pt-2 pb-6 space-y-1">
          <p>
            {config.name} • {lang === 'hi' ? 'सत्यापित वॉइस सेवा' : 'Verified Public Voice Service'}
          </p>
          <p className="text-[11px] text-[#9BA8A0]">
            Powered by VoiceForge • Secure browser voice calling
          </p>
        </footer>

      </div>
    </div>
  );
}
