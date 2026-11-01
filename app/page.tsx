'use client';

import React, { useState } from 'react';
import Link from 'next/link';

const sampleVoices = [
  {
    name: 'Ritu Rathore',
    accent: 'Indian Hindi & English',
    role: 'Warm Business Receptionist',
    tag: 'Bilingual',
    preview: 'नमस्ते! मैं आपकी किस प्रकार सहायता कर सकती हूँ? You can ask me any question about our services.',
  },
  {
    name: 'Rachel',
    accent: 'American English',
    role: 'Customer Support & Sales',
    tag: 'English (US)',
    preview: 'Hi there! Welcome to our store. I can help answer questions, check order status, or book a demo.',
  },
  {
    name: 'George',
    accent: 'British English',
    role: 'Consultant & Enterprise Support',
    tag: 'English (UK)',
    preview: 'Good day. I am here to assist you with technical inquiries, onboarding, and appointment scheduling.',
  },
];

const workflowSteps = [
  {
    num: '01',
    icon: '🌐',
    title: 'Input Website or Prompt',
    desc: 'Simply paste your website link or describe your business in plain words. Gemini extracts real operating hours, pricing, services, and FAQs.',
  },
  {
    num: '02',
    icon: '🎙️',
    title: 'Speak & Test in Real-Time',
    desc: 'Talk with your assistant directly in your browser. Seamlessly switch between Hindi and English with authentic native accents.',
  },
  {
    num: '03',
    icon: '🚀',
    title: 'Deploy Everywhere',
    desc: 'Share a public helpline link with your callers, or embed an interactive floating voice widget onto any website with a single snippet.',
  },
];

const useCases = [
  {
    icon: '🌾',
    title: 'Agriculture & Rural Helplines',
    desc: 'Deliver government scheme guidance, soil testing schedules, and weather updates in clear, native Hindi.',
  },
  {
    icon: '🏥',
    title: 'Clinics & Healthcare',
    desc: 'Automate appointment booking, doctor availability, visiting hours, and emergency routing 24/7.',
  },
  {
    icon: '💼',
    title: 'SaaS & Enterprise Sales',
    desc: 'Qualify inbound leads, answer product pricing questions, and route priority enterprise prospects.',
  },
  {
    icon: '🛍️',
    title: 'E-Commerce & Retail',
    desc: 'Handle order tracking, return queries, store timings, and promotional discounts over live audio.',
  },
];

export default function HomePage() {
  const [activeVoiceIdx, setActiveVoiceIdx] = useState(0);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0F3D3E] flex flex-col justify-between selection:bg-[#1F8A84]/20 font-sans">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. NAVBAR                                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-[#E8F1EF] py-3.5 px-4 sm:px-8 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0F3D3E] to-[#1F8A84] flex items-center justify-center text-white font-extrabold text-base shadow-sm group-hover:scale-105 transition-transform">
              🎙️
            </span>
            <span className="font-extrabold text-xl tracking-tight text-[#0F3D3E]">
              Voice<span className="text-[#1F8A84]">Forge</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-[#0F3D3E]/80">
            <a href="#how-it-works" className="hover:text-[#1F8A84] transition-colors">How It Works</a>
            <a href="#voices" className="hover:text-[#1F8A84] transition-colors">Voices &amp; Accents</a>
            <a href="#use-cases" className="hover:text-[#1F8A84] transition-colors">Use Cases</a>
          </nav>

          <div className="flex items-center space-x-3">
            <Link
              href="/write"
              className="px-5 py-2.5 rounded-xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs sm:text-sm font-bold shadow-sm transition-all hover:scale-[1.02]"
            >
              Get Started Free &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. HERO SECTION                                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 max-w-4xl h-80 bg-gradient-to-b from-[#1F8A84]/10 to-transparent blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#E8F1EF] border border-[#1F8A84]/25 text-xs font-bold text-[#0F3D3E] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Bilingual AI Voice Assistants for Businesses</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#0F3D3E] leading-[1.15] max-w-4xl mx-auto">
            Turn your business knowledge into a <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F3D3E] via-[#1F8A84] to-[#147a75]">speaking AI voice agent.</span>
          </h1>

          <p className="text-base sm:text-xl text-[#3F5045] max-w-2xl mx-auto leading-relaxed font-normal">
            Create, test, and deploy interactive voice assistants that understand your customers, switch effortlessly between Hindi and English, and answer in real-time.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 max-w-md mx-auto">
            <Link
              href="/write"
              className="w-full sm:w-auto px-9 py-4 rounded-2xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white font-bold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] flex items-center justify-center space-x-2"
            >
              <span>Build Your Assistant Now</span>
              <span>&rarr;</span>
            </Link>
          </div>

          {/* Quick Metrics Banner */}
          <div className="pt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-white border border-[#E8F1EF] shadow-2xs">
              <p className="text-2xl font-black text-[#0F3D3E]">Bilingual</p>
              <p className="text-xs text-gray-500 mt-0.5">Native Hindi &amp; English</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#E8F1EF] shadow-2xs">
              <p className="text-2xl font-black text-[#1F8A84]">&lt; 1s</p>
              <p className="text-xs text-gray-500 mt-0.5">Ultra-low latency speech</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#E8F1EF] shadow-2xs">
              <p className="text-2xl font-black text-[#0F3D3E]">1-Click</p>
              <p className="text-xs text-gray-500 mt-0.5">Embeddable web widget</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#E8F1EF] shadow-2xs">
              <p className="text-2xl font-black text-[#1F8A84]">24 / 7</p>
              <p className="text-xs text-gray-500 mt-0.5">Always active assistance</p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. HOW IT WORKS (3-STEP WORKFLOW)                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-white border-y border-[#E8F1EF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1F8A84]">
              Workflow
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F3D3E]">
              From Business Website to Voice Agent in Minutes
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              No complex machine learning training or coding required. VoiceForge handles everything end-to-end.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {workflowSteps.map((step) => (
              <div
                key={step.num}
                className="p-6 sm:p-8 rounded-3xl bg-[#FAF9F6] border border-[#1F8A84]/20 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#1F8A84]/50 transition-colors"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="w-12 h-12 rounded-2xl bg-white border border-[#1F8A84]/25 flex items-center justify-center text-2xl shadow-2xs">
                      {step.icon}
                    </span>
                    <span className="text-2xl font-black text-[#1F8A84]/40">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#0F3D3E]">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#4E5E54] leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. VOICE SHOWCASE & AUTHENTIC ACCENT SELECTION                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="voices" className="py-16 sm:py-24 bg-[#FAF9F6]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1F8A84]">
              Voice Quality
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F3D3E]">
              Authentic Native Voices &amp; Accents
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Powered by ElevenLabs Multilingual V2 for authentic native Hindi pronunciation and natural conversational English.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleVoices.map((voice, idx) => (
              <div
                key={voice.name}
                onClick={() => setActiveVoiceIdx(idx)}
                className={`p-6 rounded-3xl border transition-all cursor-pointer ${
                  activeVoiceIdx === idx
                    ? 'bg-white border-[#1F8A84] shadow-md scale-[1.02]'
                    : 'bg-white/70 border-gray-200 hover:bg-white hover:border-[#1F8A84]/30 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#E8F1EF] text-[#0F3D3E]">
                    {voice.tag}
                  </span>
                  <span className="text-xs text-gray-400">Preview Voice</span>
                </div>
                <h3 className="text-base font-bold text-[#0F3D3E]">
                  {voice.name}
                </h3>
                <p className="text-xs text-[#1F8A84] font-semibold mt-0.5">
                  {voice.role}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {voice.accent}
                </p>
                <div className="mt-4 p-3 rounded-xl bg-[#FAF9F6] border border-gray-100 text-xs italic text-gray-700 leading-relaxed">
                  &ldquo;{voice.preview}&rdquo;
                </div>
              </div>
            ))}
          </div>

          <div className="text-center pt-2">
            <Link
              href="/write"
              className="inline-flex items-center space-x-2 text-sm font-bold text-[#0F3D3E] hover:text-[#1F8A84] transition-colors underline underline-offset-4"
            >
              <span>Ready to try these voices? Build your assistant in Write</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. USE CASES                                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="use-cases" className="py-16 sm:py-24 bg-white border-t border-[#E8F1EF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1F8A84]">
              Solutions
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F3D3E]">
              Built for Real-World Business Workflows
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Whether you run a local clinic, an e-commerce store, or an agricultural helpline, VoiceForge adapts to your domain.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((uc) => (
              <div
                key={uc.title}
                className="p-6 rounded-3xl bg-[#FAF9F6] border border-[#1F8A84]/20 shadow-xs space-y-3 hover:border-[#1F8A84]/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-[#1F8A84]/20 flex items-center justify-center text-2xl shadow-2xs">
                  {uc.icon}
                </div>
                <h3 className="text-base font-bold text-[#0F3D3E]">
                  {uc.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#4E5E54] leading-relaxed">
                  {uc.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. CALL TO ACTION FOOTER BANNER                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-[#0F3D3E] to-[#1F8A84] text-white">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Ready to give your business a voice?
          </h2>
          <p className="text-sm sm:text-lg text-emerald-100 max-w-xl mx-auto leading-relaxed">
            Create your voice assistant in 5 simple steps. Paste your website, tune behavior, and embed on your site today.
          </p>
          <div className="pt-2">
            <Link
              href="/write"
              className="inline-block px-8 py-3.5 rounded-2xl bg-white text-[#0F3D3E] hover:bg-[#E8F1EF] font-bold text-base shadow-xl hover:scale-105 transition-all"
            >
              Get Started with Studio &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 7. FOOTER                                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <footer className="w-full bg-white border-t border-[#E8F1EF] py-8 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div className="flex items-center space-x-2.5">
            <span className="font-extrabold text-[#0F3D3E] text-sm">VoiceForge</span>
            <span>•</span>
            <span>Conversational AI Voice Platform</span>
          </div>
          <div className="flex items-center space-x-6 text-xs text-gray-600 font-semibold">
            <Link href="/write" className="hover:text-[#0F3D3E]">Write</Link>
            <Link href="/test" className="hover:text-[#0F3D3E]">Test</Link>
            <Link href="/refine" className="hover:text-[#0F3D3E]">Refine</Link>
            <Link href="/deploy" className="hover:text-[#0F3D3E]">Deploy</Link>
            <Link href="/observe" className="hover:text-[#0F3D3E]">Observe</Link>
          </div>
          <div>
            <span>© {new Date().getFullYear()} VoiceForge. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
