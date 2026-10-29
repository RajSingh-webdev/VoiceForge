'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import AgentSummaryCard from '@/components/AgentSummaryCard';
import SampleDataBadge from '@/components/SampleDataBadge';
import SimulatedCallersPanel from '@/components/SimulatedCallersPanel';
import { AgentDeployment, AgentConfig } from '@/lib/types';

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
const AGENT_STORAGE_KEY = 'voiceforge:agent';

function TestConversationInner() {
  const [isRealVoiceConfigured, setIsRealVoiceConfigured] = useState<boolean | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [hasConnectedOnce, setHasConnectedOnce] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Which Agent selector state
  const [handMadeAgentId, setHandMadeAgentId] = useState<string>('');
  const [deployedAgentId, setDeployedAgentId] = useState<string>('');
  const [selectedAgentSource, setSelectedAgentSource] = useState<'handmade' | 'deployed'>('deployed');
  const [draftConfig, setDraftConfig] = useState<AgentConfig | null>(null);

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

  // Check server voice connection capability & read stored agents on mount
  useEffect(() => {
    let isMounted = true;
    let hasDeployed = false;

    // Read stored deployment and draft agent from localStorage
    if (typeof window !== 'undefined') {
      try {
        const storedDeployment = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
        if (storedDeployment) {
          const parsed: AgentDeployment = JSON.parse(storedDeployment);
          if (parsed && typeof parsed.agentId === 'string' && parsed.agentId.trim()) {
            setDeployedAgentId(parsed.agentId.trim());
            hasDeployed = true;
          }
        }

        const storedAgent = window.localStorage.getItem(AGENT_STORAGE_KEY);
        if (storedAgent) {
          const parsedAgent = JSON.parse(storedAgent);
          if (parsedAgent && typeof parsedAgent === 'object') {
            setDraftConfig(parsedAgent);
          }
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('source') === 'handmade' || params.get('agent') === 'handmade') {
          setSelectedAgentSource('handmade');
        } else {
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
            if (!hasDeployed) {
              setSelectedAgentSource('handmade');
            }
          } else {
            setSelectedAgentSource('deployed');
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
    onConnect: ({ conversationId }: any) => {
      setHasConnectedOnce(true);
      setSessionError(null);
      setIsStarting(false);
      addEvent('Connected', `Established real-time audio session with ElevenLabs agent (ID: ${conversationId || 'live'})`);
    },
    onDisconnect: (details: any) => {
      setIsStarting(false);
      const reason =
        details && typeof details === 'object' && 'reason' in details
          ? String((details as any).reason)
          : typeof details === 'string'
          ? details
          : 'Ended by caller/agent';
      addEvent('Disconnected', reason);
      if (!hasConnectedOnce && reason && reason !== 'Ended by caller/agent' && !reason.includes('normal')) {
        setSessionError(`Connection closed before establishing audio: ${reason}`);
      }
    },
    onError: (err: any) => {
      setIsStarting(false);
      const message = typeof err === 'string' ? err : err?.message || 'Voice session error';
      console.error('[VoiceForge Live Voice Error]:', message);
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
    onStatusChange: ({ status }: any) => {
      addEvent('Status Change', `Agent status: ${status}`);
      if (status === 'connected') {
        setIsStarting(false);
        setHasConnectedOnce(true);
        setSessionError(null);
      } else if (status === 'disconnected') {
        setIsStarting(false);
      }
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

  const conversationRef = useRef(conversation);
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // End session ONLY when unmounting component, preventing premature disconnect on reactive status updates
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        conversationRef.current?.endSession();
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      try {
        conversationRef.current?.endSession();
      } catch {}
    };
  }, []); // Empty dependency array ensures cleanup only runs on actual unmount

  // Scroll transcript to bottom on new message
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Resolve active agent ID: prefer currently selected source, falling back gracefully
  const activeAgentId =
    selectedAgentSource === 'deployed'
      ? (deployedAgentId || handMadeAgentId)
      : (handMadeAgentId || deployedAgentId);

  // Compute whether Hindi is the primary opening language
  const isHindiPrimary = Boolean(
    draftConfig?.languages?.some(
      (l) => (l || '').toLowerCase().includes('hindi') || (l || '').toLowerCase() === 'hi'
    ) &&
    (draftConfig?.languages?.length === 1 ||
      (draftConfig?.languages?.[0] || '').toLowerCase().includes('hindi') ||
      (draftConfig?.languages?.[0] || '').toLowerCase() === 'hi' ||
      draftConfig?.voiceId === 'fTfuemKGBjYqG4ni4gw3' ||
      draftConfig?.voiceId === 'qdykssD3wAUvtIw9wG8N' ||
      (draftConfig?.voiceName || '').toLowerCase().includes('ritu') ||
      (draftConfig?.voiceName || '').toLowerCase().includes('sandeep') ||
      (draftConfig?.voiceName || '').toLowerCase().includes('hindi'))
  );

  const activeGreetingEnglish =
    draftConfig?.welcomeMessage ||
    'Hello, thank you for calling Smile Dental Clinic. I am an AI assistant. How may I help you today?';
  const activeGreetingHindi =
    draftConfig?.welcomeMessageHindi ||
    'नमस्ते! मैं स्माइल डेंटल क्लिनिक की AI रिसेप्शनिस्ट हूँ। आज मैं आपकी क्या मदद कर सकती हूँ?';

  const handleSetLanguagePrimary = (lang: 'hi' | 'en') => {
    if (!draftConfig) return;
    let updated: AgentConfig;
    if (lang === 'hi') {
      updated = {
        ...draftConfig,
        languages: ['Hindi', 'English'],
        voiceId: 'fTfuemKGBjYqG4ni4gw3',
        voiceName: 'Ritu Rathore — Natural Indian Hindi (Receptionist)',
        voiceIdHindi: 'fTfuemKGBjYqG4ni4gw3',
        voiceNameHindi: 'Ritu Rathore — Natural Indian Hindi (Receptionist)',
      };
      addEvent('Language Mode', 'Set call opening language to Hindi (Ritu Rathore)');
    } else {
      updated = {
        ...draftConfig,
        languages: ['English', 'Hindi'],
        voiceId: '21m00Tcm4TlvDq8ikWAM',
        voiceName: 'Rachel (Default)',
        voiceIdHindi: 'fTfuemKGBjYqG4ni4gw3',
        voiceNameHindi: 'Ritu Rathore — Natural Indian Hindi (Receptionist)',
      };
      addEvent('Language Mode', 'Set call opening language to English (Rachel)');
    }
    setDraftConfig(updated);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
    }
  };

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

    setSessionError(null);

    let agentIdToUse = activeAgentId;

    // Check if handMadeAgentId can be recovered from server
    if (!agentIdToUse) {
      try {
        const sessionCheck = await fetch('/api/voice/session');
        const sessionData = await sessionCheck.json();
        if (sessionData?.handMadeAgentId) {
          agentIdToUse = sessionData.handMadeAgentId;
          setHandMadeAgentId(sessionData.handMadeAgentId);
        }
      } catch {}
    }

    // If no agent ID exists yet, but user has a draft config from the Write page:
    if (!agentIdToUse && draftConfig) {
      try {
        setIsStarting(true);
        addEvent('Connecting Agent', `Preparing voice session for "${draftConfig.name || 'Assistant'}"...`);
        const createRes = await fetch('/api/agents/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: draftConfig }),
        });
        const createData = await createRes.json();
        if (createRes.ok && createData.agentId) {
          agentIdToUse = createData.agentId;
          setDeployedAgentId(createData.agentId);
          setSelectedAgentSource('deployed');
          try {
            window.localStorage.setItem(
              DEPLOYMENT_STORAGE_KEY,
              JSON.stringify({
                agentId: createData.agentId,
                name: createData.name || draftConfig.name,
                createdAt: createData.createdAt || new Date().toISOString(),
                isSample: createData.isSample,
                status: createData.status,
              })
            );
          } catch {}
          addEvent('Agent Ready', `Voice agent active: ${createData.agentId}`);
        } else {
          throw new Error(createData.error || 'Failed to prepare voice agent for testing.');
        }
      } catch (err: any) {
        setIsStarting(false);
        setSessionError(err.message || 'Failed to prepare voice agent for testing.');
        return;
      }
    }

    if (!agentIdToUse) {
      setSessionError(
        'No voice assistant found. Please go to the Write page to describe and generate your assistant first.'
      );
      return;
    }

    // Synchronize latest configuration with live ElevenLabs agent before connecting
    if (draftConfig && agentIdToUse) {
      try {
        addEvent(
          'Syncing Live Agent',
          `Applying latest settings (${isHindiPrimary ? 'Hindi / Ritu Rathore' : 'English / Rachel'}) to ElevenLabs agent...`
        );
        const updateRes = await fetch('/api/agents/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agentIdToUse,
            config: draftConfig,
          }),
        });
        const updateData = await updateRes.json();
        if (updateRes.ok) {
          addEvent(
            'Agent Synchronized',
            `Confirmed on ElevenLabs: voice "${updateData.voiceId}" (${updateData.primaryLanguage === 'hi' ? 'Hindi primary' : 'English primary'})`
          );
        }
      } catch (syncErr: any) {
        console.warn('[Test] Auto-sync non-fatal warning:', syncErr);
      }
    }

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
        body: JSON.stringify({ agentId: agentIdToUse }),
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
        connectionType: 'websocket',
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

  const effectiveError =
    sessionError ||
    (conversation.status === 'error'
      ? (conversation as any).message || 'Voice session error'
      : null);

  // Determine current status line text
  let statusText = 'Ready to connect';
  let statusBadgeClass = 'bg-gray-100 text-gray-700 border-gray-300';

  if (effectiveError) {
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
      {/* Plain Language Voice & Language Banner */}
      <div className="p-4 rounded-2xl bg-white border border-[#1F8A84]/25 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#0F3D3E]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-[#E8F1EF] text-[#0F3D3E] font-bold border border-[#1F8A84]/30 flex items-center space-x-1">
            <span>🎙️</span>
            <span>
              {isHindiPrimary
                ? (draftConfig?.voiceNameHindi || 'Ritu Rathore (Natural Indian Hindi Receptionist)')
                : (draftConfig?.voiceName || 'Rachel (Natural English Voice)')}
            </span>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-[#E8F1EF] text-[#0F3D3E] font-bold border border-[#1F8A84]/30 flex items-center space-x-1">
            <span>🌐</span>
            <span>
              {isHindiPrimary
                ? 'Primary: Hindi (Automatic English switching enabled)'
                : 'Primary: English (Automatic Hindi switching enabled)'}
            </span>
          </span>
        </div>
        <span className="text-[11px] text-[#1F8A84] font-medium flex items-center space-x-1">
          <span>🎧</span>
          <span>Use headphones to avoid acoustic echo</span>
        </span>
      </div>

      {/* Main Voice Interaction Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-[#1F8A84]/30 shadow-sm text-center">
        {/* Status Line with Animated Voice State */}
        <div className="flex flex-col items-center justify-center space-y-2 mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Voice State:
            </span>
            <span className={`px-3 py-1 rounded-full text-xs border ${statusBadgeClass}`}>
              {statusText}
            </span>
          </div>

          {/* Real-time conversational state explanation */}
          {isConnected && (
            <div className="flex items-center space-x-2 text-xs font-medium mt-1">
              {isSpeaking ? (
                <div className="flex items-center space-x-2 text-purple-800 bg-purple-50 px-3 py-1 rounded-full border border-purple-200 animate-pulse">
                  <span className="flex space-x-0.5">
                    <span className="w-1 h-3 bg-purple-600 rounded animate-bounce"></span>
                    <span className="w-1 h-4 bg-purple-600 rounded animate-bounce [animation-delay:0.1s]"></span>
                    <span className="w-1 h-2 bg-purple-600 rounded animate-bounce [animation-delay:0.2s]"></span>
                  </span>
                  <span>Assistant is speaking... You can speak at any time to interrupt.</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Listening to you... Speak naturally in English or Hindi.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Test Call Opening Language Mode Selector */}
        <div className="mb-6 max-w-md w-full mx-auto p-4 rounded-2xl bg-[#E8F1EF]/60 border border-[#1F8A84]/25 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#0F3D3E] uppercase tracking-wider flex items-center space-x-1">
              <span>🌐</span>
              <span>Call Opening Mode</span>
            </span>
            <span className="text-[11px] font-semibold text-[#1F8A84]">
              {isHindiPrimary ? '🇮🇳 Hindi Opening' : '🇬🇧 English Opening'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              id="test-mode-hindi-btn"
              onClick={() => handleSetLanguagePrimary('hi')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                isHindiPrimary
                  ? 'bg-[#0F3D3E] text-white border-[#0F3D3E] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>🇮🇳</span>
              <span>Start in Hindi</span>
            </button>
            <button
              type="button"
              id="test-mode-english-btn"
              onClick={() => handleSetLanguagePrimary('en')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                !isHindiPrimary
                  ? 'bg-[#0F3D3E] text-white border-[#0F3D3E] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>🇬🇧</span>
              <span>Start in English</span>
            </button>
          </div>

          <div className="p-3 bg-white rounded-xl border border-gray-200 text-xs">
            <div className="flex items-center justify-between text-gray-500 text-[11px] mb-1">
              <span className="font-semibold text-[#0F3D3E]">
                Voice: {isHindiPrimary ? (draftConfig?.voiceNameHindi || 'Ritu Rathore (Natural Indian Hindi)') : (draftConfig?.voiceName || 'Rachel (Natural English)')}
              </span>
              <span className="text-emerald-700 font-medium">Bilingual duplex active</span>
            </div>
            <p className="text-gray-700 italic leading-snug">
              &ldquo;{isHindiPrimary ? activeGreetingHindi : activeGreetingEnglish}&rdquo;
            </p>
          </div>
        </div>

        {/* Clear Start / End Conversation Button */}
        <div className="mb-6 flex flex-col items-center">
          <button
            type="button"
            onClick={handleToggleConversation}
            disabled={isRealVoiceConfigured !== true || isConnecting}
            className={`relative min-w-[220px] py-4 px-8 rounded-2xl flex items-center justify-center space-x-3 transition-all shadow-md ${
              isRealVoiceConfigured !== true
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                : isConnected
                ? 'bg-red-600 hover:bg-red-700 text-white ring-4 ring-red-100 shadow-red-200 animate-pulse'
                : isConnecting
                ? 'bg-amber-500 text-white cursor-wait ring-4 ring-amber-100'
                : 'bg-[#0F3D3E] hover:bg-[#1F8A84] text-white ring-4 ring-[#E8F1EF] hover:scale-[1.02] active:scale-[0.99]'
            }`}
            aria-label={isConnected ? 'End conversation' : 'Start conversation'}
          >
            <span className="text-2xl">
              {isConnected ? '🛑' : isConnecting ? '⏳' : '🎙️'}
            </span>
            <div className="text-left">
              <span className="block text-sm font-extrabold uppercase tracking-wider">
                {isConnected ? 'End conversation' : isConnecting ? 'Connecting...' : 'Start conversation'}
              </span>
              <span className="block text-[11px] opacity-80 font-normal">
                {isConnected
                  ? 'Click to hang up call'
                  : isConnecting
                  ? 'Establishing secure audio stream'
                  : 'Click to speak with assistant'}
              </span>
            </div>
          </button>

          {/* If ELEVENLABS_REAL_VOICE is not "true" */}
          {isRealVoiceConfigured === false && (
            <p className="mt-4 text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300">
              Voice is not connected yet
            </p>
          )}

          {/* Clear Error Messages with actionable guidance */}
          {effectiveError && (
            <div
              role="alert"
              className="mt-4 max-w-lg w-full p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-medium text-left flex items-start space-x-3 shadow-sm"
            >
              <span className="text-lg shrink-0">⚠️</span>
              <div>
                <p className="font-bold text-red-950">Conversation Notice</p>
                <p className="mt-0.5 leading-relaxed">{effectiveError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Metrics Bar: Response Time & Turn Delays */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto pt-4 border-t border-gray-100">
          <div className="p-3 bg-[#E8F1EF]/40 rounded-xl border border-[#1F8A84]/20 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F8A84] block mb-0.5">
              Latest Turn Delay
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

      {/* Advanced Agent Selection (Kept accessible but out of the primary flow) */}
      <details className="bg-white p-4 rounded-2xl border border-gray-200 text-left text-xs group">
        <summary className="cursor-pointer font-bold text-[#0F3D3E] hover:text-[#1F8A84] flex items-center justify-between select-none">
          <span className="flex items-center space-x-2">
            <span>⚙️</span>
            <span>Advanced: Choose Agent Target</span>
            <span className="text-gray-400 font-normal">
              ({selectedAgentSource === 'handmade' ? 'Using hand-made agent' : 'Using agent built on Write page'})
            </span>
          </span>
          <span className="text-xs text-[#1F8A84] font-medium">Configure</span>
        </summary>
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Option 1: Hand-made agent */}
            <button
              type="button"
              id="select-handmade"
              onClick={() => setSelectedAgentSource('handmade')}
              className={`p-3 rounded-xl border text-left transition-all ${
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
                setSelectedAgentSource('deployed');
              }}
              disabled={!deployedAgentId && !draftConfig}
              className={`p-3 rounded-xl border text-left transition-all ${
                !deployedAgentId && !draftConfig
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
                {deployedAgentId
                  ? deployedAgentId
                  : draftConfig
                  ? `Ready from Write draft (${draftConfig.name || 'Assistant'})`
                  : 'No draft assistant found on Write page'}
              </p>
            </button>
          </div>
          {activeAgentId && (
            <div className="text-[11px] text-gray-500 font-mono">
              Active Agent Target ID: {activeAgentId}
            </div>
          )}
        </div>
      </details>

      {/* Real-time Streaming Transcript & Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Transcript Panel */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-[#1F8A84]/25 shadow-sm flex flex-col h-[420px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F3D3E]">
                Live Streaming Conversation Transcript
              </h3>
              <p className="text-[10px] text-[#1F8A84]">Real-time speech transcription &amp; agent replies</p>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
              Full duplex
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {transcript.map((item) => {
              const isAgent = item.role === 'agent';
              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    isAgent
                      ? 'bg-[#E8F1EF] text-[#0F3D3E] mr-6 border border-[#1F8A84]/30'
                      : 'bg-gray-100 text-gray-900 ml-6 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-[10px] uppercase tracking-wider text-[#0F3D3E]">
                      {isAgent ? '🤖 Assistant (AI)' : '👤 You (Caller)'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{item.time}</span>
                  </div>
                  <p className="text-xs font-normal">{item.text}</p>
                </div>
              );
            })}

            {transcript.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-xs text-gray-400 text-center px-4">
                <span className="text-2xl mb-2">💬</span>
                <p>
                  {isConnected
                    ? 'Speak into your microphone to talk to the assistant...'
                    : 'Click "Start conversation" to test your assistant live.'}
                </p>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Events Panel */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-[#1F8A84]/25 shadow-sm flex flex-col h-[420px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F3D3E]">
                SDK Audio Events &amp; Tools
              </h3>
              <p className="text-[10px] text-gray-400">Interruption, mode changes &amp; tool requests</p>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">ElevenLabs SDK</span>
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
                  <span className="text-[10px] text-gray-400 font-mono">{evt.time}</span>
                </div>
                <p className="text-[11px] text-gray-600 font-mono break-all leading-tight">
                  {evt.detail}
                </p>
              </div>
            ))}

            {events.length === 0 && (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">
                No events reported yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestPage() {
  const [isRealVoice, setIsRealVoice] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/voice/session')
      .then((r) => r.json())
      .then((d) => {
        if (isMounted) {
          setIsRealVoice(d.realVoice === true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsRealVoice(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

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
              {isRealVoice === false ? (
                <SampleDataBadge />
              ) : isRealVoice === true ? (
                <span
                  id="live-voice-badge"
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-sm"
                  title="Connected to ElevenLabs conversational AI audio service."
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                  Live ElevenLabs Voice
                </span>
              ) : null}
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
