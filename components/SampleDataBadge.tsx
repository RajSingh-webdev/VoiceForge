import React from 'react';

export default function SampleDataBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-sm ${className}`}
      title="This screen displays mock data for hackathon demonstration."
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
      Sample data
    </span>
  );
}
