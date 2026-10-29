'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VoiceItem } from '@/lib/types';
import { useAgentConfig } from '@/lib/useAgentConfig';

// Default voice Rachel ID in ElevenLabs
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export function isHindiSupported(voice: VoiceItem): boolean {
  const supported = (voice.supportedLanguages || []).map((l) => l.toLowerCase());
  const labelLang = (voice.labels?.language || '').toLowerCase();
  const labelAccent = (voice.labels?.accent || '').toLowerCase();
  const desc = (voice.description || '').toLowerCase();

  return (
    supported.includes('hi') ||
    supported.includes('hin') ||
    supported.includes('hindi') ||
    labelLang.includes('hindi') ||
    labelLang.includes('hi') ||
    (labelAccent.includes('indian') && desc.includes('hindi'))
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

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [useCaseFilter, setUseCaseFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');

  // Audio preview playback state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Active voice ID
  const activeVoiceId = config?.voiceId?.trim() || DEFAULT_VOICE_ID;
  const activeVoice = voices.find((v) => v.voiceId === activeVoiceId);
  const activeVoiceName = config?.voiceName || activeVoice?.name || 'Rachel (Default Voice)';

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

  // Handle Select Voice
  const handleSelectVoice = (voice: VoiceItem) => {
    if (!config) return;
    setConfig({
      ...config,
      voiceId: voice.voiceId,
      voiceName: voice.name,
    });
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
        if (voiceUseCase !== useCaseFilter) {
          return false;
        }
      }

      // 3. Language Filter (Hindi and English first)
      if (languageFilter === 'hindi') {
        if (!isHindiSupported(voice)) return false;
      } else if (languageFilter === 'english') {
        if (!isEnglishSupported(voice)) return false;
      } else if (languageFilter === 'other') {
        if (isHindiSupported(voice) || isEnglishSupported(voice)) return false;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-[#0F3D3E]">
              Voice Picker
            </h2>
            {isSampleMode && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Sample Voice Catalog
              </span>
            )}
          </div>
          <p className="text-xs text-[#1F8A84] mt-0.5">
            Select an ElevenLabs voice for your conversational assistant. Changes apply to the live agent upon update.
          </p>
        </div>
      </div>

      {/* Currently Selected Voice Banner */}
      <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl mb-5">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
            🎙️
          </div>
          <div>
            <p className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider">
              Currently Selected Voice
            </p>
            <p className="text-sm font-bold text-emerald-950">
              {activeVoiceName}{' '}
              <span className="text-[11px] font-mono font-normal text-emerald-700 ml-1">
                ({activeVoiceId})
              </span>
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-600 text-white rounded-full">
          Active Voice
        </span>
      </div>

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
            placeholder="Search voices by name, accent (e.g. American, British, Indian), or style..."
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
          {/* Language filter (Hindi and English first) */}
          <div>
            <label className="block text-[11px] font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
              Language Support
            </label>
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1F8A84]"
            >
              <option value="all">All Languages</option>
              <option value="hindi">Hindi (Known Support)</option>
              <option value="english">English (Known Support)</option>
              <option value="other">Other Languages</option>
            </select>
          </div>

          {/* Use Case filter */}
          <div>
            <label className="block text-[11px] font-bold text-[#0F3D3E] uppercase tracking-wider mb-1">
              Use Case
            </label>
            <select
              value={useCaseFilter}
              onChange={(e) => setUseCaseFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1F8A84]"
            >
              <option value="all">All Use Cases</option>
              <option value="conversational">Conversational</option>
              <option value="narration">Narration</option>
              <option value="characters">Characters</option>
              {availableUseCases
                .filter((uc) => !['conversational', 'narration', 'characters'].includes(uc))
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
          <p>Loading voices from ElevenLabs...</p>
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
            const isSelected = activeVoiceId === voice.voiceId;
            const isPlaying = playingVoiceId === voice.voiceId;
            const hindiSupported = isHindiSupported(voice);

            return (
              <div
                key={voice.voiceId}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isSelected
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
                        {isSelected && (
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Selected" />
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
                    {/* Hindi Support Status Requirement 5 */}
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
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                        {voice.labels.gender}
                      </span>
                    )}
                    {voice.labels?.accent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                        {voice.labels.accent}
                      </span>
                    )}
                    {voice.labels?.age && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                        {voice.labels.age}
                      </span>
                    )}
                    {voice.labels?.use_case && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                        {voice.labels.use_case}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions: Preview Audio + Use This Voice */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 mt-2">
                  {/* Audio Preview Button (HTML5 audio, preserves credits) */}
                  {voice.previewUrl ? (
                    <button
                      type="button"
                      onClick={() => handleTogglePreview(voice)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                        isPlaying
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                      }`}
                      title={isPlaying ? 'Stop audio preview' : 'Listen to preview audio clip'}
                    >
                      <span>{isPlaying ? '⏹' : '▶'}</span>
                      <span>{isPlaying ? 'Stop' : 'Preview'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed"
                      title="Preview audio is not provided for this voice"
                    >
                      Preview not available
                    </button>
                  )}

                  {/* Use This Voice Button */}
                  {isSelected ? (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300">
                      ✓ Active Voice
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectVoice(voice)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#0F3D3E] bg-[#E8F1EF] hover:bg-[#1F8A84] hover:text-white transition"
                    >
                      Use this voice &rarr;
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
