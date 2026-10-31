'use client';

import React, { useState, useRef } from 'react';
import { useConversation } from '@elevenlabs/react';
import { AgentConfig, AgentDeployment } from '@/lib/types';

interface EmbeddedWidgetViewProps {
  agentId: string;
  config: AgentConfig;
  deployment?: AgentDeployment | null;
}

export default function EmbeddedWidgetView({
  agentId,
  config,
  deployment,
}: EmbeddedWidgetViewProps) {
  const hasHindi = (config.languages || []).some(
    (l) => l.toLowerCase().includes('hindi') || l.toLowerCase().includes('hi')
  );

  const [lang, setLang] = useState<'en' | 'hi'>(hasHindi ? 'hi' : 'en');
  const [callActive, setCallActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{ role: 'caller' | 'agent'; text: string }[]>([]);

  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      const msg = typeof err === 'string' ? err : err?.message || 'Connection error';
      setCallError(msg);
      setCallActive(false);
      setIsStarting(false);
    },
    onMessage: (message: any) => {
      if (message.source === 'ai' && message.message) {
        setLiveTranscript((prev) => [...prev, { role: 'agent', text: message.message }]);
      } else if (message.source === 'user' && message.message) {
        setLiveTranscript((prev) => [...prev, { role: 'caller', text: message.message }]);
      }
    },
  });

  const handleStartCall = async () => {
    setIsStarting(true);
    setCallError(null);
    setLiveTranscript([]);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const activeAgentId = deployment?.agentId || agentId;
      const initialMsg =
        lang === 'hi' && config.welcomeMessageHindi
          ? config.welcomeMessageHindi
          : config.welcomeMessage;

      await conversation.startSession({
        agentId: activeAgentId,
        dynamicVariables: initialMsg ? { initial_message: initialMsg } : undefined,
      });
    } catch (err: any) {
      setCallError(err?.message || 'Could not access microphone or start audio session.');
      setIsStarting(false);
    }
  };

  const handleEndCall = async () => {
    try {
      await conversation.endSession();
    } finally {
      setCallActive(false);
      setIsStarting(false);
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div className="w-full h-screen max-h-screen bg-[#F8FAF9] flex flex-col justify-between font-sans text-[#0F3D3E] select-none p-4 overflow-hidden border border-[#1F8A84]/20 rounded-2xl">
      {/* Widget Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8F1EF] shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F3D3E] to-[#1F8A84] flex items-center justify-center text-white text-sm font-extrabold shadow-xs">
            🎙️
          </div>
          <div className="leading-tight">
            <h2 className="text-sm font-bold text-[#0F3D3E] truncate max-w-[170px]">
              {config.name}
            </h2>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${callActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-[10px] text-gray-500 font-medium">
                {callActive ? `Live (${formatDuration(callDuration)})` : 'Online Voice Assistant'}
              </span>
            </div>
          </div>
        </div>

        {/* Hindi / English Switcher */}
        {hasHindi && (
          <div className="flex items-center bg-[#E8F1EF] p-0.5 rounded-lg border border-[#1F8A84]/20 text-[11px] font-bold">
            <button
              onClick={() => setLang('hi')}
              className={`px-2 py-0.5 rounded-md transition-colors ${lang === 'hi' ? 'bg-[#0F3D3E] text-white shadow-2xs' : 'text-[#0F3D3E]'}`}
            >
              हिं
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-0.5 rounded-md transition-colors ${lang === 'en' ? 'bg-[#0F3D3E] text-white shadow-2xs' : 'text-[#0F3D3E]'}`}
            >
              EN
            </button>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="flex-1 flex flex-col justify-center items-center py-4 overflow-y-auto px-2 text-center">
        {callActive ? (
          <div className="w-full flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-[#1F8A84]/20 animate-ping opacity-75" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-[#0F3D3E] to-[#1F8A84] flex items-center justify-center text-white text-3xl shadow-lg">
                🎙️
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#1F8A84]">
                {conversation.isSpeaking ? 'Speaking...' : 'Listening to you...'}
              </p>
              <p className="text-sm font-semibold text-[#0F3D3E] mt-1">
                {formatDuration(callDuration)}
              </p>
            </div>

            {/* Recent Transcript Line */}
            {liveTranscript.length > 0 && (
              <div className="max-h-24 overflow-y-auto w-full p-2.5 rounded-xl bg-white border border-[#1F8A84]/20 text-xs text-left shadow-2xs">
                <span className="font-bold text-[#1F8A84]">
                  {liveTranscript[liveTranscript.length - 1].role === 'agent' ? 'Assistant: ' : 'You: '}
                </span>
                <span className="text-gray-700">
                  {liveTranscript[liveTranscript.length - 1].text}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-full bg-[#E8F1EF] text-[#0F3D3E] flex items-center justify-center text-2xl mx-auto shadow-inner">
              🤖
            </div>
            <div>
              <p className="text-xs font-bold text-[#0F3D3E]">
                {lang === 'hi' ? 'सीधे AI असिस्टेंट से बात करें' : 'Talk with AI Assistant'}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 max-w-[260px] mx-auto leading-relaxed">
                {lang === 'hi'
                  ? config.welcomeMessageHindi || config.welcomeMessage || 'नमस्ते! आप किसी भी सवाल के लिए सीधे बातचीत शुरू कर सकते हैं।'
                  : config.welcomeMessage || 'Speak naturally to ask questions, check timings, or learn about services.'}
              </p>
            </div>
          </div>
        )}

        {callError && (
          <div className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] max-w-[280px]">
            {callError}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="pt-3 border-t border-[#E8F1EF] shrink-0">
        {callActive ? (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleEndCall}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center space-x-1.5"
            >
              <span>✕</span>
              <span>{lang === 'hi' ? 'बातचीत समाप्त करें' : 'End Conversation'}</span>
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2.5 rounded-xl border border-gray-200 text-xs font-semibold ${isMuted ? 'bg-amber-100 text-amber-800' : 'bg-white text-gray-700'}`}
              title="Mute mic"
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartCall}
            disabled={isStarting}
            className="w-full py-2.5 rounded-xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer hover:scale-[1.01]"
          >
            <span>{isStarting ? '⏳' : '🎙️'}</span>
            <span>
              {isStarting
                ? (lang === 'hi' ? 'कनेक्ट हो रहा है...' : 'Connecting...')
                : (lang === 'hi' ? 'बोलकर बात शुरू करें' : 'Start Talking with AI')}
            </span>
          </button>
        )}
        <p className="text-[10px] text-gray-400 text-center mt-2">
          Powered by VoiceForge • Interactive AI Voice Assistant
        </p>
      </div>
    </div>
  );
}
