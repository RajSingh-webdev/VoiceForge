'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AgentConfig, AgentDeployment, AgentSyncState } from '@/lib/types';
import {
  computeConfigHash,
  getSavedSyncState,
  setSavedSyncState,
  DEPLOYMENT_STORAGE_KEY,
  SYNC_STORAGE_KEY,
} from '@/lib/sync';
import SampleDataBadge from './SampleDataBadge';

interface AgentSyncStatusProps {
  config: AgentConfig | null;
  onSyncSuccess?: () => void;
  className?: string;
}

export default function AgentSyncStatus({
  config,
  onSyncSuccess,
  className = '',
}: AgentSyncStatusProps) {
  const [deployment, setDeployment] = useState<AgentDeployment | null>(null);
  const [syncState, setSyncState] = useState<AgentSyncState | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ time: string } | null>(null);

  // Read deployment & sync state from localStorage
  const refreshStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const depRaw = window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
      if (depRaw) {
        setDeployment(JSON.parse(depRaw));
      } else {
        setDeployment(null);
      }

      const sync = getSavedSyncState();
      setSyncState(sync);
    } catch {
      // Ignore parse errors
    }
  }, []);

  useEffect(() => {
    refreshStorage();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === DEPLOYMENT_STORAGE_KEY || e.key === SYNC_STORAGE_KEY) {
        refreshStorage();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshStorage]);

  // If no deployment exists at all, do not render sync bar
  if (!deployment) {
    return null;
  }

  // Sample agent status
  if (deployment.isSample) {
    return (
      <div
        className={`p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-gray-700 ${className}`}
        data-testid="sync-status-sample"
      >
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
          <span className="font-semibold text-gray-800">Sample agent: nothing to update</span>
          <SampleDataBadge />
        </div>
        <p className="text-xs text-gray-500">
          Agent ID: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">{deployment.agentId}</code>
        </p>
      </div>
    );
  }

  // Real Agent
  const currentHash = computeConfigHash(config);
  const isInSync = Boolean(syncState && syncState.hash === currentHash);
  const lastSyncedTime = successInfo?.time || (syncState?.syncedAt ? new Date(syncState.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null);

  const handleUpdateLiveAgent = async () => {
    if (!config || !deployment || isUpdating) return;

    // Prevent updating the wrong agent if names do not match
    if (
      deployment.name &&
      config.name &&
      deployment.name.trim().toLowerCase() !== config.name.trim().toLowerCase()
    ) {
      const confirmedMismatch = window.confirm(
        `Warning: Your current draft configuration is for "${config.name}", but the live agent is "${deployment.name}" (${deployment.agentId}).\n\nDo you want to overwrite "${deployment.name}" with your changes for "${config.name}"?`
      );
      if (!confirmedMismatch) return;
    } else {
      const confirmed = window.confirm(
        'Publish your latest saved edits to the live ElevenLabs assistant?'
      );
      if (!confirmed) return;
    }

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/agents/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: deployment.agentId,
          config,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update live ElevenLabs agent.');
      }

      const syncTime = data.updatedAt || new Date().toISOString();
      setSavedSyncState(currentHash, syncTime, deployment.agentId);
      setSyncState({
        hash: currentHash,
        syncedAt: syncTime,
        agentId: deployment.agentId,
      });

      const formattedTime = new Date(syncTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setSuccessInfo({ time: formattedTime });

      if (onSyncSuccess) {
        onSyncSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while updating the live agent.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isInSync
          ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
          : 'bg-amber-50/80 border-amber-300 text-amber-950'
      } ${className}`}
      data-testid="sync-status-real"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center space-x-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full mt-1 sm:mt-0 shrink-0 ${
              isInSync ? 'bg-emerald-600' : 'bg-amber-600 animate-pulse'
            }`}
          ></span>
          <div>
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="font-bold text-sm">
                {isInSync
                  ? 'Published — your assistant is up to date.'
                  : "Unpublished changes — your recent edits aren't live yet."}
              </span>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/70 border border-current opacity-80">
                {deployment.agentId}
              </span>
            </div>
            <p className="text-xs opacity-80 mt-0.5">
              {isInSync
                ? lastSyncedTime
                  ? `Last published at ${lastSyncedTime}. Your live assistant in ElevenLabs matches the saved setup.`
                  : 'Your live assistant in ElevenLabs matches the saved setup.'
                : 'Modifications made in VoiceForge have not been sent to your ElevenLabs assistant yet.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
          {isInSync && (
            <Link
              href="/test?source=deployed"
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline flex items-center space-x-1"
            >
              <span>Test it</span>
              <span>&rarr;</span>
            </Link>
          )}

          <button
            type="button"
            onClick={handleUpdateLiveAgent}
            disabled={isUpdating}
            id="update-live-agent-btn"
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
              isInSync
                ? 'bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-[#0F3D3E] hover:bg-[#1F8A84] text-white'
            }`}
          >
            {isUpdating ? (
              <>
                <svg
                  className="animate-spin h-3.5 w-3.5 text-current"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  ></path>
                </svg>
                <span>Publishing changes…</span>
              </>
            ) : (
              <span>Publish changes</span>
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
          <span className="font-bold shrink-0">⚠️</span>
          <div>
            <p className="font-bold">Couldn&apos;t publish changes. Please try again.</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Success details */}
      {successInfo && (
        <div className="mt-3 p-2.5 rounded-lg bg-emerald-100/60 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>✅</span>
            <span>Successfully published changes to live assistant at {successInfo.time}.</span>
          </div>
          <Link
            href="/test?source=deployed"
            className="font-bold underline text-emerald-950 ml-2 hover:opacity-80"
          >
            Test it &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
