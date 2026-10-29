'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VoiceItem } from '@/lib/types';
import { useAgentConfig } from '@/lib/useAgentConfig';

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

  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  // Selection target: 'primary' (English/default) or 'hindi' (Language Preset)
  const [selectionTarget, setSelectionTarget] = useState<'primary' | 'hindi'>('primary');

  // Voice Cloning Modal/Form State
  const [isCloningOpen, setIsCloningOpen] = useState<boolean>(false);
  const [cloneName, setCloneName] = useState<string>('');
  const [cloneDescription, setCloneDescription] = useState<string>('');
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneConsent, setCloneConsent] = useState<boolean>(false);
  const [isCloning, setIsCloning] = useState<boolean>(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState<string | null>(null);

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
    setConfig({
      ...config,
      voiceId: voice.voiceId,
      voiceName: voice.name,
    });
    setVoiceNotice(`Selected "${voice.name}" for English. Click "Save and update assistant" above to apply your changes.`);
  };

  // Set as Hindi Voice
  const handleSetHindiVoice = (voice: VoiceItem) => {
    if (!config) return;
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
    setVoiceNotice(`Selected "${voice.name}" for Hindi. Click "Save and update assistant" above to apply your changes.`);
  };

  // Clone Custom Voice Handler
  const handleCloneVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneFile || !cloneName.trim() || !cloneConsent) return;

    setIsCloning(true);
    setCloneError(null);
    setCloneSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', cloneFile);
      formData.append('name', cloneName.trim());
      if (cloneDescription.trim()) {
        formData.append('description', cloneDescription.trim());
      }
      formData.append('consent', 'true');

      const res = await fetch('/api/voices/clone', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to clone voice with ElevenLabs.');
      }

      const newVoice: VoiceItem = data.voice;
      setVoices((prev) => [newVoice, ...prev]);

      if (selectionTarget === 'hindi') {
        handleSetHindiVoice(newVoice);
      } else {
        handleSetPrimaryVoice(newVoice);
      }

      setCloneSuccess(`Custom voice "${newVoice.name}" created and selected!`);
      setCloneName('');
      setCloneDescription('');
      setCloneFile(null);
      setCloneConsent(false);
      setTimeout(() => {
        setIsCloningOpen(false);
        setCloneSuccess(null);
      }, 2000);
    } catch (err: any) {
      setCloneError(err.message || 'Error occurred while cloning voice.');
    } finally {
      setIsCloning(false);
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
              Choose how your assistant sounds
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
            You can choose different voices for English and Hindi so your assistant sounds natural to all callers.
          </p>
        </div>
      </div>

      {/* Target Selector Tabs (Voice for English vs Voice for Hindi + Clone Custom Voice) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3 mb-5">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setSelectionTarget('primary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              selectionTarget === 'primary'
                ? 'bg-[#0F3D3E] text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>🎙️ Voice for English</span>
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
            <span>🇮🇳 Voice for Hindi</span>
            {hasHindi && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsCloningOpen((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 border ${
            isCloningOpen
              ? 'bg-purple-100 text-purple-950 border-purple-300'
              : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200'
          }`}
        >
          <span>✨</span>
          <span>{isCloningOpen ? 'Close Voice Cloner' : 'Clone your own voice'}</span>
        </button>
      </div>

      {/* Voice Cloning Panel */}
      {isCloningOpen && (
        <form
          onSubmit={handleCloneVoice}
          className="p-5 mb-5 rounded-2xl bg-gradient-to-br from-purple-50/70 to-[#E8F1EF]/60 border-2 border-purple-200 shadow-xs"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-xl">🎙️</span>
              <h3 className="text-sm font-extrabold text-[#0F3D3E]">
                Clone a brand or staff voice with ElevenLabs
              </h3>
            </div>
            <span className="text-[10px] font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-300">
              Instant Voice Cloning
            </span>
          </div>

          <p className="text-xs text-gray-600 mb-4 leading-relaxed">
            Upload an audio sample of yourself or your receptionist. ElevenLabs creates a natural, matching voice clone for your assistant.
          </p>

          {cloneError && (
            <div className="p-3 mb-3 rounded-xl bg-red-50 border border-red-300 text-xs text-red-900 flex items-center justify-between">
              <span>⚠️ {cloneError}</span>
              <button type="button" onClick={() => setCloneError(null)} className="font-bold">✕</button>
            </div>
          )}

          {cloneSuccess && (
            <div className="p-3 mb-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 font-bold">
              ✓ {cloneSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[11px] font-bold text-[#0F3D3E] block mb-1">
                Voice Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Dr. Meera Clinic Voice"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1F8A84] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#0F3D3E] block mb-1">
                Audio Sample (.mp3, .wav, .m4a) *
              </label>
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a"
                onChange={(e) => setCloneFile(e.target.files?.[0] || null)}
                required
                className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0F3D3E] file:text-white hover:file:bg-[#1F8A84]"
              />
            </div>
          </div>

          {/* Mandatory Responsible AI Consent Checkbox (PDF Requirement) */}
          <div className="p-3 bg-white/90 border border-gray-200 rounded-xl mb-4">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={cloneConsent}
                onChange={(e) => setCloneConsent(e.target.checked)}
                required
                className="mt-0.5 rounded text-[#1F8A84] focus:ring-[#1F8A84]"
              />
              <span className="text-[11px] text-gray-700 leading-snug">
                <strong>Legal &amp; Ethical Consent:</strong> I confirm that I own this voice or have explicit documented consent from the speaker to clone and use their voice, in strict accordance with ElevenLabs safety policies and hackathon rules.
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsCloningOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCloning || !cloneName.trim() || !cloneFile || !cloneConsent}
              className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50"
            >
              {isCloning ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Cloning Voice...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Create Voice Clone</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Currently Selected Voices Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {/* Card 1: Voice for English */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            selectionTarget === 'primary'
              ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
              Voice for English
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

        {/* Card 2: Voice for Hindi */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            selectionTarget === 'hindi'
              ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-400'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800">
              Voice for Hindi
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

      {/* Voice Selection Notice */}
      {voiceNotice && (
        <div
          role="status"
          className="mb-5 p-3.5 rounded-xl bg-teal-50 border border-teal-300 text-teal-950 text-xs font-semibold flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center space-x-2">
            <span className="text-base">🎙️</span>
            <span>{voiceNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setVoiceNotice(null)}
            className="text-xs text-teal-700 hover:text-teal-900 font-bold ml-2"
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
                      <span>{isPlaying ? '⏹ Pause' : '▶ Listen to this voice'}</span>
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
                      {isPrimarySelected ? '✓ Active for English' : 'Use for English'}
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
                      {isHindiSelected ? '✓ Active for Hindi' : '🇮🇳 Use for Hindi'}
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
