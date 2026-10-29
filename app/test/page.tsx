'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import AgentSummaryCard from '@/components/AgentSummaryCard';
import SampleDataBadge from '@/components/SampleDataBadge';
import SimulatedCallersPanel from '@/components/SimulatedCallersPanel';
import { AgentDeployment } from '@/lib/types';

interface TranscriptItem {
  id: string;
  role: 'caller' | 'agent';
  text: string;
  time: string;
}

interface EventItem {
  id: string;
  title: string;
  detail: string;
  time: string;
}

const DEPLOYMENT_STORAGE_KEY = 'voiceforge:deployment';

function TestConversationInner() {
  const [isRealVoiceConfigured, setIsRealVoiceConfigured] = useState<boolean | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [hasConnectedOnce, setHasConnectedOnce] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Requirement 5: Which Agent selector state
  const [handMadeAgentId, setHandMadeAgentId] = useState<string>('');
  const [deployedAgentId, setDeployedAgentId] = useState<string>('');
  const [selectedAgentSource, setSelectedAgentSource] = useState<'handmade' | 'deployed'>('handmade');

  const callerFinishedTimeRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const addEvent = useCallback((title: string, detail: string) => {
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setEvents((prev) => [
      { id: `${Date.now()}-${Math.random()}`, title, detail, time },
      ...prev.slice(0, 49),
    ]);
  }, []);

  // Check server voice connection capability & read deployed agent on mount
  useEffect(() => {
    let isMounted = true;

    // Read deployed agent from localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
        if (stored) {
          const parsed: AgentDeployment = JSON.parse(stored);
          if (parsed && typeof parsed.agentId === 'string' && parsed.agentId.trim()) {
            setDeployedAgentId(parsed.agentId.trim());
          }
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('source') === 'deployed' || params.get('agent') === 'deployed') {
          setSelectedAgentSource('deployed');
        }
      } catch {
        // Fallback
      }
    }

    async function checkVoiceMode() {
      try {
        const res = await fetch('/api/voice/session');
        const data = await res.json();
        if (isMounted) {
          setIsRealVoiceConfigured(data.realVoice === true);
          if (data.handMadeAgentId) {
            setHandMadeAgentId(data.handMadeAgentId);
          }
          if (data.realVoice !== true && data.message) {
            setSessionError(data.message);
          }
        }
      } catch {
        if (isMounted) {
          setIsRealVoiceConfigured(false);
          setSessionError('Could not verify ElevenLabs connection status.');
        }
      }
    }
    checkVoiceMode();
    return () => {
      isMounted = false;
    };
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      setHasConnectedOnce(true);
      setSessionError(null);
      setIsStarting(false);
      addEvent('Connected', 'Established real-time audio session with ElevenLabs agent');
    },
    onDisconnect: (details) => {
      setIsStarting(false);
      const reason =
        details && typeof details === 'object' && 'reason' in details
          ? String((details as any).reason)
          : 'Ended by caller/agent';
      addEvent('Disconnected', reason);
    },
    onError: (err: any) => {
      setIsStarting(false);
      const message = typeof err === 'string' ? err : err?.message || 'Voice session error';
      if (message.toLowerCase().includes('quota') || message.toLowerCase().includes('credit')) {
        setSessionError('ElevenLabs quota limit reached or insufficient account credits.');
      } else if (
        message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('websocket')
      ) {
        setSessionError('Network failure connecting to ElevenLabs audio server.');
      } else {
        setSessionError(message);
      }
      addEvent('Error', message);
    },
    onMessage: (payload) => {
      const time = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const isCaller = payload.source === 'user' || payload.role === 'user';
      const text = payload.message || '';

      if (!text.trim()) return;

      if (isCaller) {
        callerFinishedTimeRef.current = Date.now();
      }

      setTranscript((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          role: isCaller ? 'caller' : 'agent',
          text,
          time,
        },
      ]);
    },
    onModeChange: ({ mode }) => {
      if (mode === 'speaking' && callerFinishedTimeRef.current) {
        const deltaMs = Date.now() - callerFinishedTimeRef.current;
        if (deltaMs > 0 && deltaMs < 30000) {
          setLatencies((prev) => [...prev, deltaMs]);
        }
        callerFinishedTimeRef.current = null;
      }
      addEvent('Mode Change', `Agent mode: ${mode}`);
    },
    onInterruption: () => {
      addEvent('Interruption', 'Caller interrupted agent speech');
    },
    onAgentToolRequest: (props) => {
      const toolName = (props as any)?.tool_name || (props as any)?.name || 'Custom Tool';
      addEvent('Tool Call Requested', `Agent requested tool: ${toolName}`);
    },
    onAgentToolResponse: (props) => {
      const toolName = (props as any)?.tool_name || (props as any)?.name || 'Custom Tool';
      addEvent('Tool Response', `Received tool result for: ${toolName}`);
    },
    onUnhandledClientToolCall: (props) => {
      const toolName = (props as any)?.tool_name || (props as any)?.name || 'Client Tool';
      addEvent('Client Tool', `Client tool triggered: ${toolName}`);
    },
  });

  // End session when leaving page
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        conversation.endSession();
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      try {
        conversation.endSession();
      } catch {}
    };
  }, [conversation]);

  // Scroll transcript to bottom on new message
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Resolve active agent ID
  const activeAgentId =
    selectedAgentSource === 'handmade' ? handMadeAgentId : deployedAgentId;

  // Start conversation handler
  const handleToggleConversation = async () => {
    if (conversation.status === 'connected') {
      try {
        await conversation.endSession();
      } catch (err: any) {
        console.error('Error ending session:', err);
      }
      return;
    }

    if (!activeAgentId) {
      if (selectedAgentSource === 'deployed') {
        setSessionError(
          'No agent has been deployed yet from the Write page. Go to /deploy to create one first.'
        );
      } else {
        setSessionError('No hand-made agent ID configured in ELEVENLABS_AGENT_ID.');
      }
      return;
    }

    setSessionError(null);
    setIsStarting(true);

    // 1. Microphone access check
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        throw new Error('Microphone API is not supported in this browser environment.');
      }
    } catch (micErr: any) {
      setIsStarting(false);
      if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
        setSessionError(
          'Microphone permission denied. Please allow microphone access in your browser settings.'
        );
      } else if (micErr.name === 'NotFoundError' || micErr.name === 'DevicesNotFoundError') {
        setSessionError('No microphone found. Please connect an audio input device.');
      } else {
        setSessionError(`Could not access microphone: ${micErr.message || 'Microphone error'}`);
      }
      return;
    }

    // 2. Fetch authenticated signed URL from backend for the chosen agent
    let signedUrl = '';
    try {
      const res = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: activeAgentId }),
      });
      const data = await res.json();

      if (!res.ok || !data.signedUrl) {
        throw new Error(data.error || data.message || 'Failed to obtain session credentials.');
      }

      signedUrl = data.signedUrl;
    } catch (err: any) {
      setIsStarting(false);
      setSessionError(err.message || 'Network failure obtaining voice session token.');
      return;
    }

    // 3. Initiate ElevenLabs WebRTC / WebSocket session
    try {
      await conversation.startSession({
        signedUrl,
      });
    } catch (startErr: any) {
      setIsStarting(false);
      setSessionError(
        startErr.message || 'Session ended unexpectedly while connecting to ElevenLabs.'
      );
    }
  };

  const isConnected = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting' || isStarting;
  const isSpeaking = conversation.isSpeaking;

  // Determine current status line text
  let statusText = 'Ready to connect';
  let statusBadgeClass = 'bg-gray-100 text-gray-700 border-gray-300';

  if (sessionError) {
    statusText = 'Error';
    statusBadgeClass = 'bg-red-100 text-red-900 border-red-300 font-bold';
  } else if (isConnecting) {
    statusText = 'Connecting';
    statusBadgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-bold animate-pulse';
  } else if (isConnected) {
    if (isSpeaking) {
      statusText = 'Agent speaking';
      statusBadgeClass = 'bg-purple-100 text-purple-900 border-purple-300 font-bold';
    } else {
      statusText = 'Listening';
      statusBadgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold animate-pulse';
    }
  } else if (hasConnectedOnce) {
    statusText = 'Ended';
    statusBadgeClass = 'bg-gray-100 text-gray-800 border-gray-300 font-semibold';
  }

  // Response time calculation
  const latestLatency = latencies.length > 0 ? `${latencies[latencies.length - 1]} ms` : null;
  const avgLatency =
    latencies.length > 0
      ? `${Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)} ms`
      : null;

  return (
    <div className="space-y-6">
      {/* Requirement 5: Which agent? Selector */}
      <div className="bg-white p-5 rounded-2xl border border-[#1F8A84]/25 shadow-sm text-left">
        <label
          htmlFor="agent-selector-heading"
          id="agent-selector-heading"
          className="block text-xs font-bold text-[#0F3D3E] uppercase tracking-wider mb-2"
        >
          Which agent?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {/* Option 1: Hand-made agent */}
          <button
            type="button"
            id="select-handmade"
            onClick={() => setSelectedAgentSource('handmade')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              selectedAgentSource === 'handmade'
                ? 'border-[#0F3D3E] bg-[#E8F1EF] ring-2 ring-[#0F3D3E] shadow-sm'
                : 'border-gray-200 bg-white hover:bg-[#E8F1EF]/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#0F3D3E]">Hand-made agent</span>
              {selectedAgentSource === 'handmade' && (
                <span className="text-[10px] font-bold bg-[#0F3D3E] text-white px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-600 font-mono break-all">
              {handMadeAgentId ? handMadeAgentId : 'Configured in ELEVENLABS_AGENT_ID'}
            </p>
          </button>

          {/* Option 2: Agent built on the Write page */}
          <button
            type="button"
            id="select-deployed"
            onClick={() => {
              if (deployedAgentId) setSelectedAgentSource('deployed');
            }}
            disabled={!deployedAgentId}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              !deployedAgentId
                ? 'opacity-60 cursor-not-allowed border-gray-200 bg-gray-50'
                : selectedAgentSource === 'deployed'
                ? 'border-[#0F3D3E] bg-[#E8F1EF] ring-2 ring-[#0F3D3E] shadow-sm'
                : 'border-gray-200 bg-white hover:bg-[#E8F1EF]/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#0F3D3E]">
                Agent built on the Write page
              </span>
              {selectedAgentSource === 'deployed' && (
                <span className="text-[10px] font-bold bg-[#0F3D3E] text-white px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-600 font-mono break-all">
              {deployedAgentId ? deployedAgentId : 'Not deployed yet on /deploy'}
            </p>
          </button>
        </div>

        {/* Show which agent is active */}
        <div className="p-3 rounded-xl bg-[#E8F1EF]/70 border border-[#1F8A84]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-[#0F3D3E]">Active Agent:</span>
            <span className="text-[#1F8A84] font-semibold">
              {selectedAgentSource === 'handmade'
                ? `Hand-made agent (${handMadeAgentId || 'Workspace default'})`
                : `Agent built on the Write page (${deployedAgentId || 'None'})`}
            </span>
          </div>
          {activeAgentId && (
            <span className="font-mono text-[10px] text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200 self-start sm:self-auto">
              ID: {activeAgentId}
            </span>
          )}
        </div>
      </div>

      {/* Headphones Tip */}
      <div className="p-3 rounded-xl bg-[#E8F1EF] border border-[#1F8A84]/25 flex items-center justify-between text-xs text-[#0F3D3E]">
        <span className="font-medium">🎧 Tip: Use headphones to avoid echo.</span>
        <span className="text-[11px] text-[#1F8A84] font-semibold">
          Full-duplex interruptions supported
        </span>
      </div>

      {/* Main Voice Interaction Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#1F8A84]/25 shadow-sm text-center">
        {/* Status Line */}
        <div className="flex items-center justify-center space-x-2 mb-6">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Status:
          </span>
          <span className={`px-3 py-1 rounded-full text-xs border ${statusBadgeClass}`}>
            {statusText}
          </span>
        </div>

        {/* Big Mic Button */}
        <div className="mb-6 flex flex-col items-center">
          <button
            type="button"
            onClick={handleToggleConversation}
            disabled={isRealVoiceConfigured !== true || isConnecting}
            className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center transition-all shadow-md ${
              isRealVoiceConfigured !== true
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-4 border-gray-300'
                : isConnected
                ? 'bg-red-600 hover:bg-red-700 text-white ring-4 ring-red-200 shadow-red-200 animate-pulse'
                : isConnecting
                ? 'bg-amber-500 text-white cursor-wait ring-4 ring-amber-100'
                : 'bg-[#0F3D3E] hover:bg-[#1F8A84] text-white ring-4 ring-[#E8F1EF] hover:scale-105'
            }`}
            aria-label={isConnected ? 'End conversation' : 'Start conversation'}
          >
            <span className="text-3xl sm:text-4xl mb-1">
              {isConnected ? '🛑' : isConnecting ? '⏳' : '🎙️'}
            </span>
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider">
              {isConnected ? 'End Call' : isConnecting ? 'Connecting' : 'Start Call'}
            </span>
          </button>

          {/* If ELEVENLABS_REAL_VOICE is not "true" */}
          {isRealVoiceConfigured === false && (
            <p className="mt-4 text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300">
              Voice is not connected yet
            </p>
          )}

          {/* Clear Error Message */}
          {sessionError && (
            <div
              role="alert"
              className="mt-4 max-w-md w-full p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-medium text-left flex items-start space-x-2"
            >
              <span className="font-bold text-red-700">⚠️</span>
              <p className="leading-relaxed">{sessionError}</p>
            </div>
          )}
        </div>

        {/* Metrics Bar: Approximate Response Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto pt-4 border-t border-gray-100">
          <div className="p-3 bg-[#E8F1EF]/40 rounded-xl border border-[#1F8A84]/20 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F8A84] block mb-0.5">
              Latest Turn Delay (approximate)
            </span>
            <span className="text-sm font-extrabold text-[#0F3D3E]">
              {latestLatency || 'Awaiting turn'}
            </span>
          </div>

          <div className="p-3 bg-[#E8F1EF]/40 rounded-xl border border-[#1F8A84]/20 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F8A84] block mb-0.5">
              Average Turn Delay
            </span>
            <span className="text-sm font-extrabold text-[#0F3D3E]">
              {avgLatency || 'Awaiting turns'}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Streaming Transcript & Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Transcript Panel */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-[#1F8A84]/25 shadow-sm flex flex-col h-[400px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F3D3E]">
              Live Streaming Transcript
            </h3>
            <span className="text-[10px] text-[#1F8A84] font-medium">Full duplex</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {transcript.map((item) => {
              const isAgent = item.role === 'agent';
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl text-xs leading-relaxed ${
                    isAgent
                      ? 'bg-[#E8F1EF] text-[#0F3D3E] mr-4 border border-[#1F8A84]/20'
                      : 'bg-gray-100 text-gray-800 ml-4 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-[#0F3D3E]">
                      {isAgent ? '🤖 Voice Assistant' : '👤 You (Caller)'}
                    </span>
                    <span className="text-[10px] text-gray-400">{item.time}</span>
                  </div>
                  <p>{item.text}</p>
                </div>
              );
            })}

            {transcript.length === 0 && (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">
                {isConnected
                  ? 'Speak into your microphone to start the conversation...'
                  : 'Start the conversation to view live streaming transcript.'}
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Events Panel */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-[#1F8A84]/25 shadow-sm flex flex-col h-[400px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F3D3E]">
              SDK Events Panel
            </h3>
            <span className="text-[10px] text-gray-400">Tools, modes &amp; state</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-[11px] text-[#0F3D3E]">
                    {evt.title}
                  </span>
                  <span className="text-[10px] text-gray-400">{evt.time}</span>
                </div>
                <p className="text-[11px] text-gray-600 font-mono break-all leading-tight">
                  {evt.detail}
                </p>
              </div>
            ))}

            {events.length === 0 && (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">
                No events reported
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestPage() {
  return (
    <div className="w-full max-w-4xl mx-auto text-left py-6 px-4 sm:px-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F3D3E] tracking-tight">
                Live Voice Test
              </h1>
              <SampleDataBadge />
            </div>
            <p className="mt-2 text-base text-[#1F8A84] leading-relaxed">
              Real-time conversational voice test powered by the official ElevenLabs React SDK.
            </p>
          </div>
        </div>
      </header>

      {/* Saved Agent Summary Card */}
      <section className="mb-6" aria-label="Current Agent">
        <AgentSummaryCard />
      </section>

      {/* ElevenLabs Official Conversation Provider */}
      <ConversationProvider>
        <TestConversationInner />
      </ConversationProvider>

      {/* Simulated Callers & Stress Testing */}
      <SimulatedCallersPanel />
    </div>
  );
}
