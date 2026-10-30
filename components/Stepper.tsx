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
    <nav className="w-full bg-white border-b border-[#E8F1EF] py-4 px-6 shadow-sm">
      <div className="max-w-3xl mx-auto flex items-center justify-center space-x-2 sm:space-x-4">
        {steps.map((step, index) => {
          const isActive = pathname === step.path;
          return (
            <div key={step.path} className="flex items-center">
              <Link
                href={step.path}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0F3D3E] text-white'
                    : 'text-[#1F8A84] hover:bg-[#E8F1EF] hover:text-[#0F3D3E]'
                }`}
              >
                {step.name}
              </Link>
              {index < steps.length - 1 && (
                <span className="ml-2 sm:ml-4 text-[#1F8A84] font-semibold select-none">
                  &gt;
                </span>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
