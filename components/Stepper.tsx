'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const steps = [
  { name: 'Write', path: '/write', stepNum: '1' },
  { name: 'Test', path: '/test', stepNum: '2' },
  { name: 'Refine', path: '/refine', stepNum: '3' },
  { name: 'Deploy', path: '/deploy', stepNum: '4' },
  { name: 'Observe', path: '/observe', stepNum: '5' },
];

export default function Stepper() {
  const pathname = usePathname();

  if (pathname.startsWith('/agent') || pathname.startsWith('/krishi')) {
    return null;
  }

  return (
    <nav className="w-full bg-white border-b border-[#E8F1EF] py-2 sm:py-3.5 px-3 sm:px-8 shadow-xs sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-3 md:gap-0 relative">
        {/* Top / Left: Brand Logo */}
        <div className="w-full md:w-auto flex items-center justify-between md:justify-start z-10 shrink-0">
          <Link
            href="/write"
            className="flex items-center space-x-2 text-[#0F3D3E] hover:opacity-90 transition-opacity"
            id="brand-logo"
          >
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-[#0F3D3E] to-[#1F8A84] flex items-center justify-center text-white font-extrabold text-xs sm:text-sm shadow-xs shrink-0">
              🎙️
            </span>
            <span className="font-extrabold text-base sm:text-xl tracking-tight text-[#0F3D3E]">
              Voice<span className="text-[#1F8A84]">Forge</span>
            </span>
          </Link>

          {/* Mobile Current Step Pill */}
          <span className="md:hidden text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E8F1EF] text-[#0F3D3E] border border-[#1F8A84]/20">
            {steps.find((s) => s.path === pathname)?.name || 'Step'}
          </span>
        </div>

        {/* Stepper Navigation Steps */}
        <div className="w-full md:absolute md:inset-0 md:flex md:items-center md:justify-center pointer-events-none overflow-hidden">
          <div className="flex items-center justify-start md:justify-center space-x-1 sm:space-x-2.5 overflow-x-auto no-scrollbar touch-scroll max-w-full py-0.5 px-1 pointer-events-auto">
            {steps.map((step, index) => {
              const isActive = pathname === step.path;
              return (
                <div key={step.path} className="flex items-center shrink-0">
                  <Link
                    href={step.path}
                    className={`px-2.5 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
                      isActive
                        ? 'bg-[#0F3D3E] text-white shadow-xs'
                        : 'text-[#1F8A84] hover:bg-[#E8F1EF] hover:text-[#0F3D3E]'
                    }`}
                  >
                    <span className={`text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-[#1F8A84]/15 text-[#0F3D3E]'
                    }`}>
                      {step.stepNum}
                    </span>
                    <span>{step.name}</span>
                  </Link>
                  {index < steps.length - 1 && (
                    <span className="ml-1 sm:ml-2.5 text-[#1F8A84]/40 font-bold select-none text-[10px] sm:text-xs">
                      &gt;
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side spacer to keep flex layout balanced on desktop */}
        <div className="hidden md:block w-32 pointer-events-none" aria-hidden="true" />
      </div>
    </nav>
  );
}
