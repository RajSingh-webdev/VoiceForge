'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VoiceItem, AgentDeployment } from '@/lib/types';
import { useAgentConfig } from '@/lib/useAgentConfig';
import { DEPLOYMENT_STORAGE_KEY, setSavedSyncState, computeConfigHash } from '@/lib/sync';

// Default voice Rachel ID in ElevenLabs
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
// Default verified Indian Hindi voice for dental clinic / front-desk
const DEFAULT_HINDI_VOICE_ID = 'fTfuemKGBjYqG4ni4gw3';

export function isHindiSupported(voice: VoiceItem): boolean {
  const supported = (voice.supportedLanguages || []).map((l) => l.toLowerCase());
  const labelLang = (voice.labels?.language || '').toLowerCase();
  const labelAccent = (voice.labels?.accent || '').toLowerCase();
  const desc = (voice.description || '').toLowerCase();
  const name = (voice.name || '').toLowerCase();

  return (
    supported.includes('hi') ||
    supported.includes('hin') ||
    supported.includes('hindi') ||
    labelLang.includes('hindi') ||
    labelLang.includes('hi') ||
    labelAccent.includes('indian') ||
    desc.includes('hindi') ||
    name.includes('hindi')
  );
}

export function isIndianAccent(voice: VoiceItem): boolean {
  const labelAccent = (voice.labels?.accent || '').toLowerCase();
  const labelLocale = ((voice.labels as any)?.locale || '').toLowerCase();
  const desc = (voice.description || '').toLowerCase();
  const name = (voice.name || '').toLowerCase();

  return (
    labelAccent.includes('indian') ||
    labelLocale.includes('in') ||
    desc.includes('indian') ||
    name.includes('indian') ||
    name.includes('ritu') ||
    name.includes('sandeep') ||
    name.includes('aditi') ||
    name.includes('rakesh')
  );
}

export function isEnglishSupported(voice: VoiceItem): boolean {
  const supported = (voice.supportedLanguages || []).map((l) => l.toLowerCase());
  const labelLang = (voice.labels?.language || '').toLowerCase();
  const labelAccent = (voice.labels?.accent || '').toLowerCase();

  if (supported.includes('en') || supported.includes('eng') || supported.includes('english')) {
    return true;
  }
  if (labelLang.includes('english') || labelLang.includes('en')) {
    return true;
  }
  if (
    labelAccent.includes('american') ||
    labelAccent.includes('british') ||
    labelAccent.includes('australian') ||
    labelAccent.includes('indian') ||
    labelAccent.includes('irish')
  ) {
    return true;
  }
  // Default premade voices in ElevenLabs are English-capable
  return voice.category === 'premade';
}

export default function VoicePicker() {
  const { config, setConfig } = useAgentConfig();
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSampleMode, setIsSampleMode] = useState<boolean>(false);

  // Deployed agent detection for direct live synchronization
  const [deployment, setDeployment] = useState<AgentDeployment | null>(null);
  const [handMadeAgentId, setHandMadeAgentId] = useState<string | null>(null);
  const [isApplyingLive, setIsApplyingLive] = useState<boolean>(false);
  const [liveSuccessMessage, setLiveSuccessMessage] = useState<string | null>(null);

  // Selection target: 'primary' (English/default) or 'hindi' (Language Preset)
  const [selectionTarget, setSelectionTarget] = useState<'primary' | 'hindi'>('primary');

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [useCaseFilter, setUseCaseFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');

  // Audio preview playback state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if assistant has Hindi configured
  const hasHindi = useMemo(() => {
    return (
      Array.isArray(config?.languages) &&
      config.languages.some(
        (l) => (l || '').toLowerCase().includes('hindi') || (l || '').toLowerCase() === 'hi'
      )
    );
  }, [config?.languages]);

  // Read deployment or hand-made agent on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const depRaw = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
        if (depRaw) {
          setDeployment(JSON.parse(depRaw));
        }
      } catch {}
    }
    async function checkAgent() {
      try {
        const res = await fetch('/api/voice/session');
        const data = await res.json();
        if (data.handMadeAgentId) {
          setHandMadeAgentId(data.handMadeAgentId);
        }
      } catch {}
    }
    checkAgent();
  }, []);

  const effectiveAgentId = deployment?.agentId || handMadeAgentId;

  // Load voices from /api/voices
  useEffect(() => {
    let isCancelled = false;
    async function fetchVoices() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch('/api/voices');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load voices from ElevenLabs.');
        }
        if (!isCancelled) {
          setVoices(Array.isArray(data.voices) ? data.voices : []);
          setIsSampleMode(data.isSample === true);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setErrorMessage(err.message || 'Unable to load voice library.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchVoices();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Extract available use case tags from voices for dynamic filter pills
  const availableUseCases = useMemo(() => {
    const set = new Set<string>();
    voices.forEach((v) => {
      const uc = (v.labels?.use_case || '').toLowerCase().trim();
      if (uc) {
        set.add(uc);
      }
    });
    return Array.from(set).sort();
  }, [voices]);

  // Active primary voice ID
  const activeVoiceId = config?.voiceId?.trim() || DEFAULT_VOICE_ID;
  const activeVoice = voices.find((v) => v.voiceId === activeVoiceId);
  const activeVoiceName = config?.voiceName || activeVoice?.name || 'Rachel (Default Voice)';

  // Active Hindi voice ID (for language preset)
  const activeHindiVoiceId = config?.voiceIdHindi?.trim() || DEFAULT_HINDI_VOICE_ID;
  const activeHindiVoice = voices.find((v) => v.voiceId === activeHindiVoiceId);
  const activeHindiVoiceName =
    config?.voiceNameHindi || activeHindiVoice?.name || 'Ritu Rathore (Natural Conversational Hindi)';

  // Handle Play/Stop Preview
  const handleTogglePreview = (voice: VoiceItem) => {
    if (!voice.previewUrl) return;

    if (playingVoiceId === voice.voiceId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    setPlayingVoiceId(voice.voiceId);

    audio.onended = () => {
      setPlayingVoiceId(null);
      audioRef.current = null;
    };

    audio.onerror = () => {
      setPlayingVoiceId(null);
      audioRef.current = null;
    };

    audio.play().catch(() => {
      setPlayingVoiceId(null);
      audioRef.current = null;
    });
  };

  // Set as Primary Voice
  const handleSetPrimaryVoice = (voice: VoiceItem) => {
    if (!config) return;
    setLiveSuccessMessage(null);
    setConfig({
      ...config,
      voiceId: voice.voiceId,
      voiceName: voice.name,
    });
  };

  // Set as Hindi Voice
  const handleSetHindiVoice = (voice: VoiceItem) => {
    if (!config) return;
    setLiveSuccessMessage(null);
    // Automatically ensure Hindi is in the language list if not already present
    const updatedLanguages = Array.isArray(config.languages) ? [...config.languages] : ['English'];
    if (!updatedLanguages.some((l) => l.toLowerCase().includes('hindi') || l.toLowerCase() === 'hi')) {
      updatedLanguages.push('Hindi');
    }

    setConfig({
      ...config,
      languages: updatedLanguages,
      voiceIdHindi: voice.voiceId,
      voiceNameHindi: voice.name,
    });
  };

  // Save and apply directly to Live ElevenLabs Agent with read-back verification
  const handleApplyToLiveAgent = async () => {
    if (!config || !effectiveAgentId || isApplyingLive) return;

    setIsApplyingLive(true);
    setErrorMessage(null);
    setLiveSuccessMessage(null);

    try {
      const res = await fetch('/api/agents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: effectiveAgentId,
          config,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply voice to live ElevenLabs agent.');
      }

      // Record sync state
      const newHash = computeConfigHash(config);
      const now = new Date().toISOString();
      setSavedSyncState(newHash, now, effectiveAgentId);

      setLiveSuccessMessage(
        `✓ Voice successfully applied & read-back verified! Primary voice: "${data.voiceId}"${
          data.voiceIdHindi ? ` · Hindi preset voice: "${data.voiceIdHindi}"` : ''
        }`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while updating live agent.');
    } finally {
      setIsApplyingLive(false);
    }
  };

  // Filtered voice list
  const filteredVoices = useMemo(() => {
    return voices.filter((voice) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = voice.name.toLowerCase().includes(q);
        const matchesAccent = (voice.labels?.accent || '').toLowerCase().includes(q);
        const matchesDesc = (voice.description || '').toLowerCase().includes(q);
        const matchesUseCase = (voice.labels?.use_case || '').toLowerCase().includes(q);
        if (!matchesName && !matchesAccent && !matchesDesc && !matchesUseCase) {
          return false;
        }
      }

      // 2. Use Case Filter
      if (useCaseFilter !== 'all') {
        const voiceUseCase = (voice.labels?.use_case || '').toLowerCase().trim();
        if (useCaseFilter === 'conversational') {
          if (!voiceUseCase.includes('conversational') && !voiceUseCase.includes('calm')) {
            return false;
          }
        } else if (voiceUseCase !== useCaseFilter) {
          return false;
        }
      }

      // 3. Language & Accent Filter
      if (languageFilter === 'hindi') {
        if (!isHindiSupported(voice)) return false;
      } else if (languageFilter === 'indian_accent') {
        if (!isIndianAccent(voice)) return false;
      } else if (languageFilter === 'english') {
        if (!isEnglishSupported(voice)) return false;
      }

      // 4. Gender Filter
      if (genderFilter !== 'all') {
        const g = (voice.labels?.gender || '').toLowerCase().trim();
        if (g !== genderFilter) {
          return false;
        }
      }

      return true;
    });
  }, [voices, searchQuery, useCaseFilter, languageFilter, genderFilter]);

  return (
    <section
      aria-label="Agent Voice Picker"
      className="bg-white p-6 rounded-2xl border border-[#1F8A84]/25 shadow-sm"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-[#0F3D3E]">
              Voice Picker &amp; Multilingual Quality
            </h2>
            {isSampleMode ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Sample Voice Catalog
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                Real ElevenLabs Catalog
              </span>
            )}
          </div>
          <p className="text-xs text-[#1F8A84] mt-0.5">
            Select authentic, natural conversational voices for both English calls and dedicated Indian Hindi responses.
          </p>
        </div>

        {/* Live Sync Button if Deployed or Configured in ELEVENLABS_AGENT_ID */}
        {effectiveAgentId && (
          <button
            type="button"
            id="apply-voice-live-btn"
            onClick={handleApplyToLiveAgent}
            disabled={isApplyingLive}
            className="px-4 py-2 rounded-xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs font-bold transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50 shrink-0"
          >
            {isApplyingLive ? (
              <>
                <span className="animate-spin text-sm">🔄</span>
                <span>Applying to Live Agent...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Apply to Live ElevenLabs Agent</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Target Selector Tabs (Primary Voice vs Hindi Language Preset) */}
      <div className="flex items-center space-x-2 border-b border-gray-200 pb-3 mb-5">
        <button
          type="button"
          onClick={() => setSelectionTarget('primary')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
            selectionTarget === 'primary'
              ? 'bg-[#0F3D3E] text-white shadow-xs'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <span>🎙️ Primary Voice (English / Default)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectionTarget('hindi');
            // Auto-filter for Hindi when Hindi tab selected for quick discovery
            if (languageFilter === 'all') {
              setLanguageFilter('hindi');
            }
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
            selectionTarget === 'hindi'
              ? 'bg-[#1F8A84] text-white shadow-xs'
              : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
          }`}
        >
          <span>🇮🇳 Hindi Response Voice (Language Preset)</span>
          {hasHindi && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
          )}
        </button>
      </div>

      {/* Currently Selected Voices Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {/* Card 1: Primary Voice */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            selectionTarget === 'primary'
              ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
              Primary Voice (Default &amp; English)
            </span>
            {selectionTarget === 'primary' && (
              <span className="text-[9px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                Selecting
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-[#0F3D3E] truncate">
            {activeVoiceName}
          </p>
          <p className="text-[11px] text-gray-500 truncate mt-0.5">
            Primary language voice
          </p>
        </div>

        {/* Card 2: Hindi Voice */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            selectionTarget === 'hindi'
              ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-400'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800">
              Hindi Response Voice (Language Preset)
            </span>
            {selectionTarget === 'hindi' && (
              <span className="text-[9px] font-bold bg-[#1F8A84] text-white px-1.5 py-0.5 rounded">
                Selecting
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-[#0F3D3E] truncate">
            {activeHindiVoiceName}
          </p>
          <p className="text-[11px] text-teal-700 font-medium truncate mt-0.5">
            Natural Indian Hindi accent
          </p>
        </div>
      </div>

      {/* Live Agent Update Success Banner */}
      {liveSuccessMessage && (
        <div
          role="status"
          className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-semibold flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center space-x-2">
            <span className="text-lg">✅</span>
            <span>{liveSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setLiveSuccessMessage(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error notification if failed to load */}
      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold text-red-800 hover:text-red-950"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="space-y-3 mb-5 p-4 bg-[#F7FAFA] rounded-xl border border-gray-100">
        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search voices by name, Indian accent (e.g. Ritu, Sandeep, Aditi), or style..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1F8A84] focus:border-transparent transition"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-xs">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Language & Accent filter */}
          <div>
            <label className="block text-[11px] font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
              Language &amp; Accent
            </label>
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1F8A84]"
            >
              <option value="all">All Voices</option>
              <option value="hindi">Hindi (Verified Support)</option>
              <option value="indian_accent">Indian Accent (🇮🇳 Verified)</option>
              <option value="english">English (Known Support)</option>
            </select>
          </div>

          {/* Use Case filter */}
          <div>
            <label className="block text-[11px] font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
              Conversational Style
            </label>
            <select
              value={useCaseFilter}
              onChange={(e) => setUseCaseFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1F8A84]"
            >
              <option value="all">All Styles</option>
              <option value="conversational">Conversational (Front-Desk / Clinic)</option>
              <option value="narration">Narration &amp; Storytelling</option>
              <option value="social_media">Social Media</option>
              {availableUseCases
                .filter((uc) => !['conversational', 'narration', 'social_media'].includes(uc))
                .map((uc) => (
                  <option key={uc} value={uc}>
                    {uc.charAt(0).toUpperCase() + uc.slice(1)}
                  </option>
                ))}
            </select>
          </div>

          {/* Gender filter */}
          <div>
            <label className="block text-[11px] font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
              Gender
            </label>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1F8A84]"
            >
              <option value="all">All Genders</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 text-center text-xs text-gray-500">
          <div className="inline-block animate-spin h-5 w-5 border-2 border-[#1F8A84] border-t-transparent rounded-full mb-2" />
          <p>Loading real voices from ElevenLabs...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredVoices.length === 0 && (
        <div className="py-8 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
          <p className="font-semibold text-gray-700">No voices match the selected filters</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setUseCaseFilter('all');
              setLanguageFilter('all');
              setGenderFilter('all');
            }}
            className="mt-2 text-xs font-bold text-[#0F3D3E] underline hover:text-[#1F8A84]"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Voices Grid */}
      {!isLoading && filteredVoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredVoices.map((voice) => {
            const isPrimarySelected = activeVoiceId === voice.voiceId;
            const isHindiSelected = activeHindiVoiceId === voice.voiceId;
            const isPlaying = playingVoiceId === voice.voiceId;
            const hindiSupported = isHindiSupported(voice);
            const indianAccent = isIndianAccent(voice);

            return (
              <div
                key={voice.voiceId}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isPrimarySelected || isHindiSelected
                    ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-[#1F8A84]/40 hover:shadow-xs'
                }`}
              >
                <div>
                  {/* Header: Name + Category badge */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <h3 className="text-sm font-bold text-[#0F3D3E] flex items-center space-x-1.5">
                        <span>{voice.name}</span>
                        {isPrimarySelected && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-emerald-500"
                            title="Primary Voice"
                          />
                        )}
                        {isHindiSelected && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-teal-500"
                            title="Hindi Voice"
                          />
                        )}
                      </h3>
                      <p className="text-[11px] font-mono text-gray-500">
                        {voice.voiceId}
                      </p>
                    </div>

                    {voice.category && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-700">
                        {voice.category}
                      </span>
                    )}
                  </div>

                  {/* Description if present */}
                  {voice.description && (
                    <p className="text-xs text-gray-600 mb-2.5 line-clamp-2">
                      {voice.description}
                    </p>
                  )}

                  {/* Metadata Labels & Hindi Support Tag */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {/* Indian Accent verified tag */}
                    {indianAccent && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        🇮🇳 Indian Accent (Verified)
                      </span>
                    )}

                    {/* Hindi Support Status */}
                    {hindiSupported ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300">
                        ✓ Supports Hindi
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        Hindi support unknown
                      </span>
                    )}

                    {voice.labels?.gender && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 capitalize">
                        {voice.labels.gender}
                      </span>
                    )}

                    {voice.labels?.age && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 capitalize">
                        {voice.labels.age.replace('_', ' ')}
                      </span>
                    )}

                    {voice.labels?.use_case && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 capitalize">
                        {voice.labels.use_case.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Controls: Preview & Assignment */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-2">
                  {/* Audio Preview Button */}
                  {voice.previewUrl ? (
                    <button
                      type="button"
                      onClick={() => handleTogglePreview(voice)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                        isPlaying
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{isPlaying ? '⏹ Pause' : '▶ Preview'}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-gray-400 italic">No audio sample</span>
                  )}

                  {/* Assignment Action Buttons */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetPrimaryVoice(voice)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        isPrimarySelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-[#0F3D3E] text-white hover:bg-[#1F8A84]'
                      }`}
                    >
                      {isPrimarySelected ? '✓ Primary Active' : 'Set as Primary'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetHindiVoice(voice)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        isHindiSelected
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-teal-50 text-teal-900 border border-teal-300 hover:bg-teal-100'
                      }`}
                    >
                      {isHindiSelected ? '✓ Hindi Active' : '🇮🇳 Set for Hindi'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
