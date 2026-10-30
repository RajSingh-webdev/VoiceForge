'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const steps = [
  { name: 'Write', path: '/write' },
  { name: 'Test', path: '/test' },
  { name: 'Refine', path: '/refine' },
  { name: 'Deploy', path: '/deploy' },
  { name: 'Observe', path: '/observe' },
];

export default function Stepper() {
  const pathname = usePathname();

  if (pathname.startsWith('/agent') || pathname.startsWith('/krishi')) {
    return null;
  }

  return (
    <nav className="w-full bg-white border-b border-[#E8F1EF] py-3.5 px-4 sm:px-8 shadow-xs sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0 relative">
        {/* Top Left: Project Name */}
        <div className="w-full md:w-auto flex items-center justify-between md:justify-start z-10">
          <Link
            href="/write"
            className="flex items-center space-x-2.5 text-[#0F3D3E] hover:opacity-90 transition-opacity"
            id="brand-logo"
          >
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F3D3E] to-[#1F8A84] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
              🎙️
            </span>
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-[#0F3D3E]">
              Voice<span className="text-[#1F8A84]">Forge</span>
            </span>
          </Link>
        </div>

        {/* Center: Stepper Navigation Steps */}
        <div className="w-full md:absolute md:inset-0 md:flex md:items-center md:justify-center pointer-events-none">
          <div className="flex items-center justify-center space-x-1.5 sm:space-x-3 overflow-x-auto max-w-full py-0.5 pointer-events-auto">
            {steps.map((step, index) => {
              const isActive = pathname === step.path;
              return (
                <div key={step.path} className="flex items-center shrink-0">
                  <Link
                    href={step.path}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#0F3D3E] text-white shadow-xs'
                        : 'text-[#1F8A84] hover:bg-[#E8F1EF] hover:text-[#0F3D3E]'
                    }`}
                  >
                    {step.name}
                  </Link>
                  {index < steps.length - 1 && (
                    <span className="ml-1.5 sm:ml-3 text-[#1F8A84]/50 font-semibold select-none text-xs sm:text-sm">
                      &gt;
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side spacer to keep flex layout balanced */}
        <div className="hidden md:block w-32 pointer-events-none" aria-hidden="true" />
      </div>
    </nav>
  );
}
