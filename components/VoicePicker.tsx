'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VoiceItem } from '@/lib/types';
import { useAgentConfig } from '@/lib/useAgentConfig';

// Default voice Rachel ID in ElevenLabs
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
// Default verified Indian Hindi voice for dental clinic / front-desk
const DEFAULT_HINDI_VOICE_ID = 'fTfuemKGBjYqG4ni4gw3';

const FALLBACK_VOICES: VoiceItem[] = [
  {
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel (Default, Conversational Female)',
    category: 'premade',
    description: 'Calm, clear front-desk conversational voice',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6788f9-1ec9-4742-9d70-6927d34e94b2.mp3',
    labels: { gender: 'female', language: 'english', accent: 'american' },
  },
  {
    voiceId: 'qdykssD3wAUvtIw9wG8N',
    name: 'Sandeep (Indian Accent, Male)',
    category: 'premade',
    description: 'Natural Indian Hindi/English accent, warm and polite front-desk tone',
    labels: { gender: 'male', language: 'hindi', accent: 'indian' },
    supportedLanguages: ['hi', 'en'],
  },
  {
    voiceId: 'fTfuemKGBjYqG4ni4gw3',
    name: 'Ritu Rathore (Natural Conversational Hindi, Female)',
    category: 'premade',
    description: 'Natural conversational Hindi/English accent for reception and appointments',
    labels: { gender: 'female', language: 'hindi', accent: 'indian' },
    supportedLanguages: ['hi', 'en'],
  },
];

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
  return voice.category === 'premade';
}

export default function VoicePicker() {
  const { config, setConfig } = useAgentConfig();
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSampleMode, setIsSampleMode] = useState<boolean>(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  // Audio preview playback state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Voice Cloning Form State
  const [isCloningOpen, setIsCloningOpen] = useState<boolean>(false);
  const [cloneName, setCloneName] = useState<string>('');
  const [cloneDescription, setCloneDescription] = useState<string>('');
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneConsent, setCloneConsent] = useState<boolean>(false);
  const [isCloning, setIsCloning] = useState<boolean>(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState<string | null>(null);

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

  // Combined selectable voices (merging fallbacks if not already present)
  const allSelectableVoices = useMemo(() => {
    const list = [...voices];
    for (const fb of FALLBACK_VOICES) {
      if (!list.some((v) => v.voiceId === fb.voiceId)) {
        list.push(fb);
      }
    }
    return list;
  }, [voices]);

  // Active primary voice ID
  const activeVoiceId = config?.voiceId?.trim() || DEFAULT_VOICE_ID;
  const activeHindiVoiceId = config?.voiceIdHindi?.trim() || DEFAULT_HINDI_VOICE_ID;

  // Resolved voice objects for detail preview
  const currentEnglishVoice = useMemo(() => {
    return (
      allSelectableVoices.find((v) => v.voiceId === activeVoiceId) ||
      allSelectableVoices.find(
        (v) => config?.voiceName && v.name.toLowerCase().includes(config.voiceName.toLowerCase())
      ) ||
      allSelectableVoices[0] ||
      null
    );
  }, [allSelectableVoices, activeVoiceId, config?.voiceName]);

  const currentHindiVoice = useMemo(() => {
    return (
      allSelectableVoices.find((v) => v.voiceId === activeHindiVoiceId) ||
      allSelectableVoices.find(
        (v) => config?.voiceNameHindi && v.name.toLowerCase().includes(config.voiceNameHindi.toLowerCase())
      ) ||
      allSelectableVoices.find((v) => isIndianAccent(v) || isHindiSupported(v)) ||
      null
    );
  }, [allSelectableVoices, activeHindiVoiceId, config?.voiceNameHindi]);

  // Grouped voices for English dropdown
  const englishVoiceGroups = useMemo(() => {
    const indian = allSelectableVoices.filter((v) => isIndianAccent(v));
    const popular = allSelectableVoices.filter(
      (v) => !isIndianAccent(v) && (v.category === 'premade' || isEnglishSupported(v))
    );
    const others = allSelectableVoices.filter(
      (v) => !isIndianAccent(v) && v.category !== 'premade' && !isEnglishSupported(v)
    );
    return { indian, popular, others };
  }, [allSelectableVoices]);

  // Grouped voices for Hindi dropdown
  const hindiVoiceGroups = useMemo(() => {
    const recommended = allSelectableVoices.filter((v) => isHindiSupported(v) || isIndianAccent(v));
    const others = allSelectableVoices.filter((v) => !isHindiSupported(v) && !isIndianAccent(v));
    return { recommended, others };
  }, [allSelectableVoices]);

  // Play/Pause Audio Preview
  const handleTogglePreview = (voice: VoiceItem | null) => {
    if (!voice || !voice.previewUrl) return;

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

  // Set Primary Voice
  const handleSetPrimaryVoice = (voice: VoiceItem) => {
    if (!config) return;
    setConfig({
      ...config,
      voiceId: voice.voiceId,
      voiceName: voice.name,
    });
    setVoiceNotice(`Selected "${voice.name}" for English. Save your assistant to apply changes.`);
  };

  // Set Hindi Voice
  const handleSetHindiVoice = (voice: VoiceItem) => {
    if (!config) return;
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
    setVoiceNotice(`Selected "${voice.name}" for Hindi. Save your assistant to apply changes.`);
  };

  // Clone Custom Voice
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
      handleSetPrimaryVoice(newVoice);

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

  return (
    <section
      aria-label="Agent Voice Picker"
      className="bg-white p-6 rounded-2xl border border-[#1F8A84]/25 shadow-sm text-left"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-[#0F3D3E]">
              Choose how your assistant sounds
            </h2>
            {isSampleMode ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Sample Catalog
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                Live ElevenLabs Voices
              </span>
            )}
          </div>
          <p className="text-xs text-[#1F8A84] mt-0.5">
            Select the voice your assistant uses for English and Hindi callers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCloningOpen((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 border shrink-0 ${
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

      {/* Loading state indicator */}
      {isLoading && (
        <div className="py-6 text-center text-xs text-gray-500">
          <div className="inline-block animate-spin h-4 w-4 border-2 border-[#1F8A84] border-t-transparent rounded-full mb-1" />
          <p>Loading voices from ElevenLabs...</p>
        </div>
      )}

      {/* 2 Dropdown Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Voice for English */}
        <div className="p-5 rounded-2xl bg-[#F8FAF9] border border-[#1F8A84]/25 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F3D3E] flex items-center space-x-1.5">
                <span>🎙️</span>
                <span>Voice for English</span>
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                Primary Language
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              The main voice your assistant uses for English conversations.
            </p>

            {/* Dropdown Select */}
            <div className="mb-4">
              <label htmlFor="voice-dropdown-english" className="sr-only">
                Choose English Voice
              </label>
              <select
                id="voice-dropdown-english"
                value={activeVoiceId}
                onChange={(e) => {
                  const v = allSelectableVoices.find((item) => item.voiceId === e.target.value);
                  if (v) handleSetPrimaryVoice(v);
                }}
                className="w-full p-3 rounded-xl border border-[#1F8A84]/35 bg-white text-xs font-bold text-[#0F3D3E] shadow-xs focus:ring-2 focus:ring-[#1F8A84] focus:outline-hidden cursor-pointer"
              >
                {englishVoiceGroups.indian.length > 0 && (
                  <optgroup label="🇮🇳 Recommended Indian English Voices">
                    {englishVoiceGroups.indian.map((v) => (
                      <option key={v.voiceId} value={v.voiceId}>
                        {v.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {englishVoiceGroups.popular.length > 0 && (
                  <optgroup label="Popular Conversational Voices">
                    {englishVoiceGroups.popular.map((v) => (
                      <option key={v.voiceId} value={v.voiceId}>
                        {v.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {englishVoiceGroups.others.length > 0 && (
                  <optgroup label="All Other Voices">
                    {englishVoiceGroups.others.map((v) => (
                      <option key={v.voiceId} value={v.voiceId}>
                        {v.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Selected Voice Details */}
            {currentEnglishVoice && (
              <div className="p-3.5 rounded-xl bg-white border border-[#1F8A84]/15 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#0F3D3E]">
                    {currentEnglishVoice.name}
                  </span>
                  {currentEnglishVoice.category && (
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">
                      {currentEnglishVoice.category}
                    </span>
                  )}
                </div>

                {currentEnglishVoice.description && (
                  <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">
                    {currentEnglishVoice.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {isIndianAccent(currentEnglishVoice) && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                      🇮🇳 Indian Accent (Verified)
                    </span>
                  )}
                  {isHindiSupported(currentEnglishVoice) && (
                    <span className="text-[10px] font-bold bg-teal-100 text-teal-900 px-2 py-0.5 rounded-full border border-teal-300">
                      ✓ Supports Hindi
                    </span>
                  )}
                  {currentEnglishVoice.labels?.gender && (
                    <span className="text-[10px] font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full capitalize">
                      {currentEnglishVoice.labels.gender}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Audio Preview Action */}
          <div className="pt-3 mt-3 border-t border-gray-200/70">
            {currentEnglishVoice?.previewUrl ? (
              <button
                type="button"
                onClick={() => handleTogglePreview(currentEnglishVoice)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  playingVoiceId === currentEnglishVoice.voiceId
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                    : 'bg-white hover:bg-[#E8F1EF] text-[#0F3D3E] border border-[#1F8A84]/30 shadow-2xs'
                }`}
              >
                <span>{playingVoiceId === currentEnglishVoice.voiceId ? '⏹ Pause' : '▶ Listen to this voice'}</span>
              </button>
            ) : (
              <span className="text-[11px] text-gray-400 italic block text-center py-1">No audio sample available</span>
            )}
          </div>
        </div>

        {/* Card 2: Voice for Hindi */}
        <div className="p-5 rounded-2xl bg-[#F8FAF9] border border-[#1F8A84]/25 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F3D3E] flex items-center space-x-1.5">
                <span>🇮🇳</span>
                <span>Voice for Hindi</span>
              </span>
              <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200">
                Hindi Response Voice
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              The voice your assistant switches to when callers speak Hindi.
            </p>

            {/* Dropdown Select */}
            <div className="mb-4">
              <label htmlFor="voice-dropdown-hindi" className="sr-only">
                Choose Hindi Voice
              </label>
              <select
                id="voice-dropdown-hindi"
                value={activeHindiVoiceId}
                onChange={(e) => {
                  const v = allSelectableVoices.find((item) => item.voiceId === e.target.value);
                  if (v) handleSetHindiVoice(v);
                }}
                className="w-full p-3 rounded-xl border border-[#1F8A84]/35 bg-white text-xs font-bold text-[#0F3D3E] shadow-xs focus:ring-2 focus:ring-[#1F8A84] focus:outline-hidden cursor-pointer"
              >
                {hindiVoiceGroups.recommended.length > 0 && (
                  <optgroup label="🇮🇳 Verified Indian & Hindi Voices (Recommended)">
                    {hindiVoiceGroups.recommended.map((v) => (
                      <option key={v.voiceId} value={v.voiceId}>
                        {v.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {hindiVoiceGroups.others.length > 0 && (
                  <optgroup label="Other Multilingual Voices">
                    {hindiVoiceGroups.others.map((v) => (
                      <option key={v.voiceId} value={v.voiceId}>
                        {v.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Selected Hindi Voice Details */}
            {currentHindiVoice && (
              <div className="p-3.5 rounded-xl bg-white border border-[#1F8A84]/15 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#0F3D3E]">
                    {currentHindiVoice.name}
                  </span>
                  {currentHindiVoice.category && (
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">
                      {currentHindiVoice.category}
                    </span>
                  )}
                </div>

                {currentHindiVoice.description && (
                  <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">
                    {currentHindiVoice.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {isIndianAccent(currentHindiVoice) && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                      🇮🇳 Indian Accent (Verified)
                    </span>
                  )}
                  {isHindiSupported(currentHindiVoice) && (
                    <span className="text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300 px-2 py-0.5 rounded-full">
                      ✓ Supports Hindi
                    </span>
                  )}
                  {currentHindiVoice.labels?.gender && (
                    <span className="text-[10px] font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full capitalize">
                      {currentHindiVoice.labels.gender}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Audio Preview Action */}
          <div className="pt-3 mt-3 border-t border-gray-200/70">
            {currentHindiVoice?.previewUrl ? (
              <button
                type="button"
                onClick={() => handleTogglePreview(currentHindiVoice)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  playingVoiceId === currentHindiVoice.voiceId
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                    : 'bg-white hover:bg-[#E8F1EF] text-[#0F3D3E] border border-[#1F8A84]/30 shadow-2xs'
                }`}
              >
                <span>{playingVoiceId === currentHindiVoice.voiceId ? '⏹ Pause' : '▶ Listen to this voice'}</span>
              </button>
            ) : (
              <span className="text-[11px] text-gray-400 italic block text-center py-1">No audio sample available</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
