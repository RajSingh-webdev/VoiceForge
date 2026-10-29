'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAgentConfig } from '@/lib/useAgentConfig';
import { Conversation } from '@/lib/types';

interface Contact {
  id: string;
  name: string;
  phone: string;
  details: string;
  status: 'queued' | 'calling' | 'completed' | 'failed';
  outcome?: string;
  duration?: number;
}

const SAMPLE_CONTACTS: Contact[] = [
  { id: '1', name: 'Rohan Sharma', phone: '+91 98201 12345', details: 'Dental Cleaning appointment on Nov 2', status: 'queued' },
  { id: '2', name: 'Ananya Verma', phone: '+91 98192 67890', details: 'Root Canal follow-up check', status: 'queued' },
  { id: '3', name: 'Vikram Mehta', phone: '+91 98334 54321', details: 'Annual Dental Checkup reminder', status: 'queued' },
  { id: '4', name: 'Priya Nair', phone: '+91 98765 43210', details: 'Teeth Whitening consultation', status: 'queued' },
  { id: '5', name: 'Sunil Patil', phone: '+91 98220 99887', details: 'Cavity filling appointment confirmation', status: 'queued' },
];

export default function BulkCampaignPanel() {
  const { config } = useAgentConfig();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [campaignFinished, setCampaignFinished] = useState<boolean>(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const handleLoadSample = () => {
    setContacts(SAMPLE_CONTACTS.map((c) => ({ ...c, status: 'queued', outcome: undefined })));
    setCampaignFinished(false);
    setCsvError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          throw new Error('CSV file is empty or only contains headers.');
        }

        const parsed: Contact[] = [];
        // Skip header if line 1 contains "name" or "phone"
        const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
          if (parts[0]) {
            parsed.push({
              id: `csv-${i}`,
              name: parts[0] || `Contact ${i}`,
              phone: parts[1] || '+1 (555) 000-0000',
              details: parts[2] || 'Appointment Reminder',
              status: 'queued',
            });
          }
        }

        if (parsed.length === 0) {
          throw new Error('No valid contacts could be read from this CSV.');
        }

        setContacts(parsed);
        setCampaignFinished(false);
      } catch (err: any) {
        setCsvError(err.message || 'Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleStartCampaign = async () => {
    if (contacts.length === 0 || isCalling) return;

    setIsCalling(true);
    setCampaignFinished(false);

    const updatedContacts = [...contacts];
    const generatedConversations: Conversation[] = [];

    for (let i = 0; i < updatedContacts.length; i++) {
      setCurrentIndex(i);
      updatedContacts[i].status = 'calling';
      setContacts([...updatedContacts]);

      try {
        const res = await fetch('/api/campaigns/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact: updatedContacts[i],
            config,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          updatedContacts[i].status = 'completed';
          updatedContacts[i].outcome = data.outcome || 'Confirmed';
          updatedContacts[i].duration = data.duration || 60;
          if (data.conversation) {
            generatedConversations.push(data.conversation);
          }
        } else {
          updatedContacts[i].status = 'failed';
        }
      } catch {
        updatedContacts[i].status = 'failed';
      }

      setContacts([...updatedContacts]);
      // Small natural pause between automated sequential calls
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    // Persist new conversations to localStorage so they immediately reflect in Observe
    if (typeof window !== 'undefined' && generatedConversations.length > 0) {
      try {
        const existing = window.localStorage.getItem('voiceforge:conversations');
        const parsed: Conversation[] = existing ? JSON.parse(existing) : [];
        window.localStorage.setItem(
          'voiceforge:conversations',
          JSON.stringify([...generatedConversations, ...parsed])
        );
      } catch {}
    }

    setIsCalling(false);
    setCurrentIndex(-1);
    setCampaignFinished(true);
  };

  const completedCount = contacts.filter((c) => c.status === 'completed').length;
  const progressPercent = contacts.length > 0 ? Math.round((completedCount / contacts.length) * 100) : 0;

  return (
    <details className="bg-white border border-[#1F8A84]/25 rounded-2xl shadow-sm text-left group">
      <summary className="p-5 cursor-pointer font-bold text-[#0F3D3E] hover:text-[#1F8A84] flex items-center justify-between select-none">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">📋</span>
          <div>
            <span className="text-sm sm:text-base font-extrabold text-[#0F3D3E] block">
              Bulk Outbound Calling Campaign (Optional)
            </span>
            <span className="text-xs text-[#1F8A84] font-normal">
              Upload a contact CSV and have your assistant call patients in sequence to confirm appointments.
            </span>
          </div>
        </div>
        <span className="text-xs text-[#1F8A84] font-semibold bg-[#E8F1EF] px-3 py-1 rounded-full border border-[#1F8A84]/20 shrink-0 ml-4">
          Show campaign dialer ▼
        </span>
      </summary>

      <div className="px-6 pb-6 pt-3 border-t border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer shadow-xs flex items-center space-x-1.5">
              <span>📁</span>
              <span>Upload CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleLoadSample}
              className="px-3 py-1.5 rounded-xl border border-[#1F8A84]/30 bg-[#E8F1EF] hover:bg-[#1F8A84]/15 text-xs font-bold text-[#0F3D3E] transition-all"
            >
              Load Sample Reminder List (5 Contacts)
            </button>
          </div>

          {contacts.length > 0 && (
            <button
              type="button"
              onClick={handleStartCampaign}
              disabled={isCalling}
              className="px-5 py-2.5 rounded-xl bg-[#0F3D3E] hover:bg-[#1F8A84] text-white text-xs font-bold transition-all shadow-sm flex items-center space-x-2 shrink-0 disabled:opacity-50"
            >
              {isCalling ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>
                    Calling #{currentIndex + 1} of {contacts.length}...
                  </span>
                </>
              ) : (
                <>
                  <span>📞</span>
                  <span>Start Outbound Campaign</span>
                </>
              )}
            </button>
          )}
        </div>

        {csvError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-300 text-xs text-red-900">
            ⚠️ {csvError}
          </div>
        )}

        {/* Live Progress Bar when running */}
        {contacts.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-[#0F3D3E]">
                Campaign Progress: {completedCount} of {contacts.length} calls finished ({progressPercent}%)
              </span>
              {campaignFinished && (
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ✓ Campaign Completed
                </span>
              )}
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1F8A84] transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Contacts Table */}
        {contacts.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#E8F1EF]/60 text-[#0F3D3E] font-bold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Contact Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Reminder Reason</th>
                  <th className="py-2.5 px-3 text-right">Call Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map((c, idx) => {
                  let badge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                      Queued
                    </span>
                  );
                  if (c.status === 'calling') {
                    badge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                        Calling...
                      </span>
                    );
                  } else if (c.status === 'completed') {
                    badge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                        ✓ {c.outcome || 'Confirmed'} ({c.duration}s)
                      </span>
                    );
                  } else if (c.status === 'failed') {
                    badge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900">
                        Failed
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={c.id}
                      className={idx === currentIndex ? 'bg-amber-50/50' : 'hover:bg-gray-50'}
                    >
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{c.name}</td>
                      <td className="py-2.5 px-3 font-mono text-gray-600">{c.phone}</td>
                      <td className="py-2.5 px-3 text-gray-600">{c.details}</td>
                      <td className="py-2.5 px-3 text-right">{badge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500">
            <span className="text-2xl block mb-1">📄</span>
            No contact list loaded yet. Upload a CSV file or click <strong>&ldquo;Load Sample Reminder List&rdquo;</strong> to test a sequential outbound campaign.
          </div>
        )}

        {campaignFinished && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between text-xs text-emerald-950 font-medium">
            <span>
              All campaign calls have completed and transcripts have been logged.
            </span>
            <Link
              href="/observe"
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs underline"
            >
              View in Observe Dashboard &rarr;
            </Link>
          </div>
        )}
      </div>
    </details>
  );
}
