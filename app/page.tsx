'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ScrollProgress } from '@/components/core/scroll-progress';
import { Spotlight } from '@/components/core/spotlight';
import { AnimatedBackground } from '@/components/core/animated-background';
import { InView } from '@/components/core/in-view';
import { motion } from 'framer-motion';
import { TextRoll } from '@/components/core/text-roll';

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
  const [isFooterHovered, setIsFooterHovered] = useState(false);

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#1F8A84]/30 font-sans">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* SPOTLIGHT EFFECT & GRID PATTERN ACROSS LANDING PAGE           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Spotlight
        className="from-blue-600/70 via-teal-400/50 to-emerald-400/30 blur-xl z-0"
        size={90}
        visible={!isFooterHovered}
        springOptions={{
          stiffness: 900,
          damping: 35,
          mass: 0.05,
        }}
      />

      {/* Subtle background SVG grid */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-20">
        <svg className="h-full w-full">
          <defs>
            <pattern
              id="grid-pattern-hero"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern-hero)" />
        </svg>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. NAVBAR                                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="w-full bg-black/80 backdrop-blur-md border-b border-zinc-800/80 py-3.5 px-4 sm:px-8 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1F8A84] to-emerald-400 flex items-center justify-center text-black font-extrabold text-base shadow-sm group-hover:scale-105 transition-transform">
              🎙️
            </span>
            <span className="font-extrabold text-xl tracking-tight text-white">
              Voice<span className="text-[#1F8A84]">Forge</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-zinc-300">
            <a href="#how-it-works" className="hover:text-emerald-400 transition-colors">How It Works</a>
            <a href="#voices" className="hover:text-emerald-400 transition-colors">Voices &amp; Accents</a>
            <a href="#use-cases" className="hover:text-emerald-400 transition-colors">Use Cases</a>
          </nav>

          <div className="flex items-center space-x-3">
            <Link
              href="/write"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
            >
              Get Started Free &rarr;
            </Link>
          </div>
        </div>

        {/* Scroll Progress Bar along the bottom edge of Navbar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] pointer-events-none">
          <ScrollProgress
            className="h-full bg-gradient-to-r from-emerald-500 via-[#1F8A84] to-cyan-400 shadow-[0_1px_8px_rgba(31,138,132,0.8)]"
            springOptions={{
              stiffness: 280,
              damping: 18,
              mass: 0.3,
            }}
          />
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. HERO SECTION                                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-16 sm:pt-24 pb-20 sm:pb-28 overflow-hidden z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6 relative z-10">
          <InView
            viewOptions={{ margin: '0px 0px -50px 0px' }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.12 },
              },
            }}
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, scale: 0.9, filter: 'blur(8px)' },
                visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
              }}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/60 text-xs font-bold text-zinc-200 shadow-2xs backdrop-blur-sm"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Bilingual AI Voice Assistants for Businesses</span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: { opacity: 0, scale: 0.92, filter: 'blur(10px)' },
                visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
              }}
              className="mt-6 text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.15] max-w-4xl mx-auto"
            >
              Turn your business knowledge into a{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                speaking{' '}
              </span>
              <TextRoll
                className="text-emerald-400"
                getEnterDelay={(i) => 1.5 + i * 0.08}
                getExitDelay={(i) => 1.5 + i * 0.08 + 0.18}
                variants={{
                  enter: {
                    initial: { rotateX: 0, filter: 'blur(0px)' },
                    animate: { rotateX: 90, filter: 'blur(2px)' },
                  },
                  exit: {
                    initial: { rotateX: 90, filter: 'blur(2px)' },
                    animate: { rotateX: 0, filter: 'blur(0px)' },
                  },
                }}
              >
                AI voice agent.
              </TextRoll>
            </motion.h1>

            <motion.p
              variants={{
                hidden: { opacity: 0, scale: 0.95, filter: 'blur(8px)' },
                visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
              }}
              className="mt-4 text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed font-normal"
            >
              Create, test, and deploy interactive voice assistants that understand your customers, switch effortlessly between Hindi and English, and answer in real-time.
            </motion.p>

            <motion.div
              variants={{
                hidden: { opacity: 0, scale: 0.9, filter: 'blur(8px)' },
                visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
              }}
              className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 max-w-md mx-auto"
            >
              <Link
                href="/write"
                className="w-full sm:w-auto px-9 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-[#1F8A84] hover:from-emerald-400 hover:to-[#229a93] text-black font-extrabold text-base sm:text-lg shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] flex items-center justify-center space-x-2"
              >
                <span>Build Your Assistant Now</span>
                <span>&rarr;</span>
              </Link>
            </motion.div>
          </InView>

          {/* Quick Metrics Banner */}
          <InView
            viewOptions={{ margin: '0px 0px -100px 0px' }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1 },
              },
            }}
          >
            <div className="pt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto text-left">
              {[
                { val: 'Bilingual', sub: 'Native Hindi & English', color: 'text-white' },
                { val: '< 1s', sub: 'Ultra-low latency speech', color: 'text-emerald-400' },
                { val: '1-Click', sub: 'Embeddable web widget', color: 'text-white' },
                { val: '24 / 7', sub: 'Always active assistance', color: 'text-emerald-400' },
              ].map((metric, i) => (
                <motion.div
                  key={i}
                  variants={{
                    hidden: { opacity: 0, scale: 0.85, filter: 'blur(10px)' },
                    visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                  }}
                  className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm backdrop-blur-sm"
                >
                  <p className={`text-2xl font-black ${metric.color}`}>{metric.val}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{metric.sub}</p>
                </motion.div>
              ))}
            </div>
          </InView>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. HOW IT WORKS (3-STEP WORKFLOW)                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 sm:py-24 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-12">
          <InView
            viewOptions={{ margin: '0px 0px -100px 0px' }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1 },
              },
            }}
          >
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <motion.span
                variants={{
                  hidden: { opacity: 0, scale: 0.9, filter: 'blur(6px)' },
                  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                }}
                className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-400"
              >
                Workflow
              </motion.span>
              <motion.h2
                variants={{
                  hidden: { opacity: 0, scale: 0.92, filter: 'blur(8px)' },
                  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                }}
                className="text-3xl sm:text-4xl font-extrabold text-white"
              >
                From Business Website to Voice Agent in Minutes
              </motion.h2>
              <motion.p
                variants={{
                  hidden: { opacity: 0, scale: 0.95, filter: 'blur(6px)' },
                  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                }}
                className="text-sm sm:text-base text-zinc-400"
              >
                No complex machine learning training or coding required. VoiceForge handles everything end-to-end.
              </motion.p>
            </div>
          </InView>

          <InView
            viewOptions={{ margin: '0px 0px -150px 0px' }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.15 },
              },
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {workflowSteps.map((step) => (
                <motion.div
                  key={step.num}
                  variants={{
                    hidden: { opacity: 0, scale: 0.85, filter: 'blur(10px)' },
                    visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                  }}
                  className="p-6 sm:p-8 rounded-3xl bg-zinc-900/70 border border-zinc-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-500/50 transition-colors backdrop-blur-sm"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-2xl shadow-2xs">
                        {step.icon}
                      </span>
                      <span className="text-2xl font-black text-zinc-600">
                        {step.num}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </InView>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. VOICE SHOWCASE & AUTHENTIC ACCENT SELECTION                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="voices" className="py-16 sm:py-24 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
          <InView
            viewOptions={{ margin: '0px 0px -100px 0px' }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1 },
              },
            }}
          >
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <motion.span
                variants={{
                  hidden: { opacity: 0, scale: 0.9, filter: 'blur(6px)' },
                  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                }}
                className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-400"
              >
                Voice Quality
              </motion.span>
              <motion.h2
                variants={{
                  hidden: { opacity: 0, scale: 0.92, filter: 'blur(8px)' },
                  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                }}
                className="text-3xl sm:text-4xl font-extrabold text-white"
              >
                Authentic Native Voices &amp; Accents
              </motion.h2>
              <motion.p
                variants={{
                  hidden: { opacity: 0, scale: 0.95, filter: 'blur(6px)' },
                  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                }}
                className="text-sm sm:text-base text-zinc-400"
              >
                Powered by ElevenLabs Multilingual V2 for authentic native Hindi pronunciation and natural conversational English.
              </motion.p>
            </div>
          </InView>

          <InView
            viewOptions={{ margin: '0px 0px -150px 0px' }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.15 },
              },
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sampleVoices.map((voice, idx) => (
                <motion.div
                  key={voice.name}
                  variants={{
                    hidden: { opacity: 0, scale: 0.85, filter: 'blur(10px)' },
                    visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                  }}
                  onClick={() => setActiveVoiceIdx(idx)}
                  className={`p-6 rounded-3xl border transition-all cursor-pointer backdrop-blur-sm ${
                    activeVoiceIdx === idx
                      ? 'bg-zinc-900 border-emerald-500 shadow-lg shadow-emerald-500/10 scale-[1.02]'
                      : 'bg-zinc-950/60 border-zinc-800 hover:bg-zinc-900/80 hover:border-zinc-700 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {voice.tag}
                    </span>
                    <span className="text-xs text-zinc-500">Preview Voice</span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {voice.name}
                  </h3>
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                    {voice.role}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {voice.accent}
                  </p>
                  <div className="mt-4 p-3 rounded-xl bg-black/60 border border-zinc-800 text-xs italic text-zinc-300 leading-relaxed">
                    &ldquo;{voice.preview}&rdquo;
                  </div>
                </motion.div>
              ))}
            </div>
          </InView>

          <div className="text-center pt-2">
            <Link
              href="/write"
              className="inline-flex items-center space-x-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-4"
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
      <section id="use-cases" className="py-16 sm:py-24 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-12">
          <InView
            viewOptions={{ margin: '0px 0px -100px 0px' }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1 },
              },
            }}
          >
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <motion.span
                variants={{
                  hidden: { opacity: 0, scale: 0.9, filter: 'blur(6px)' },
                  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                }}
                className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-400"
              >
                Solutions
              </motion.span>
              <motion.h2
                variants={{
                  hidden: { opacity: 0, scale: 0.92, filter: 'blur(8px)' },
                  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                }}
                className="text-3xl sm:text-4xl font-extrabold text-white"
              >
                Built for Real-World Business Workflows
              </motion.h2>
              <motion.p
                variants={{
                  hidden: { opacity: 0, scale: 0.95, filter: 'blur(6px)' },
                  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                }}
                className="text-sm sm:text-base text-zinc-400"
              >
                Whether you run a local clinic, an e-commerce store, or an agricultural helpline, VoiceForge adapts to your domain.
              </motion.p>
            </div>
          </InView>

          <InView
            viewOptions={{ margin: '0px 0px -150px 0px' }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.12 },
              },
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {useCases.map((uc) => (
                <motion.div
                  key={uc.title}
                  variants={{
                    hidden: { opacity: 0, scale: 0.85, filter: 'blur(10px)' },
                    visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                  }}
                  className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800/80 shadow-xs space-y-3 hover:border-emerald-500/50 transition-colors backdrop-blur-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-2xl shadow-2xs">
                    {uc.icon}
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {uc.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    {uc.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </InView>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. CALL TO ACTION FOOTER BANNER                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 relative z-10">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Ready to give your business a voice?
          </h2>
          <p className="text-sm sm:text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Create your voice assistant in 5 simple steps. Paste your website, tune behavior, and embed on your site today.
          </p>
          <div className="pt-2">
            <Link
              href="/write"
              className="inline-block px-8 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-base shadow-xl shadow-emerald-500/20 hover:scale-105 transition-all"
            >
              Get Started with Studio &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 7. FOOTER                                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <footer
        onMouseEnter={() => setIsFooterHovered(true)}
        onMouseLeave={() => setIsFooterHovered(false)}
        className="w-full bg-black/60 backdrop-blur-md py-8 px-4 sm:px-8 relative z-10"
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center space-x-2.5">
            <span className="font-extrabold text-white text-sm">VoiceForge</span>
            <span>•</span>
            <span>Conversational AI Voice Platform</span>
          </div>

          {/* Animated Navigation Tabs on Hover */}
          <div className="flex items-center p-0.5">
            <AnimatedBackground
              className="rounded-lg bg-zinc-800/80"
              transition={{
                type: 'spring',
                bounce: 0.2,
                duration: 0.3,
              }}
              enableHover
            >
              {[
                { name: 'Write', href: '/write' },
                { name: 'Test', href: '/test' },
                { name: 'Refine', href: '/refine' },
                { name: 'Deploy', href: '/deploy' },
                { name: 'Observe', href: '/observe' },
              ].map((tab) => (
                <Link
                  key={tab.name}
                  data-id={tab.name}
                  href={tab.href}
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-400 transition-colors duration-200 hover:text-white"
                >
                  {tab.name}
                </Link>
              ))}
            </AnimatedBackground>
          </div>

          <div>
            <span>© {new Date().getFullYear()} VoiceForge. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
