'use client';

import { useState, useEffect, useCallback } from 'react';
import { AgentConfig, isValidAgentConfig } from './types';

export const STORAGE_KEY = 'voiceforge:agent';
const AGENT_UPDATED_EVENT = 'voiceforge:agent:updated';

export { isValidAgentConfig };

export function useAgentConfig() {
  const [config, setConfigState] = useState<AgentConfig | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const loadFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setConfigState(null);
        return;
      }
      const parsed = JSON.parse(stored);
      if (isValidAgentConfig(parsed)) {
        setConfigState(parsed);
      } else {
        console.warn('Corrupt or outdated agent config in storage, clearing.');
        window.localStorage.removeItem(STORAGE_KEY);
        setConfigState(null);
      }
    } catch {
      console.warn('Could not parse agent config from storage, clearing.');
      window.localStorage.removeItem(STORAGE_KEY);
      setConfigState(null);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadFromStorage();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadFromStorage();
      }
    };

    const handleCustomUpdate = () => {
      loadFromStorage();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(AGENT_UPDATED_EVENT, handleCustomUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(AGENT_UPDATED_EVENT, handleCustomUpdate);
    };
  }, [loadFromStorage]);

  const setConfig = useCallback(
    (newConfig: AgentConfig | null | ((prev: AgentConfig | null) => AgentConfig | null)) => {
      setConfigState((prev) => {
        const resolved = typeof newConfig === 'function' ? newConfig(prev) : newConfig;
        if (typeof window !== 'undefined') {
          if (resolved && isValidAgentConfig(resolved)) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
          } else {
            window.localStorage.removeItem(STORAGE_KEY);
          }
          window.dispatchEvent(new Event(AGENT_UPDATED_EVENT));
        }
        return resolved;
      });
    },
    []
  );

  const clearConfig = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event(AGENT_UPDATED_EVENT));
    }
    setConfigState(null);
  }, []);

  return {
    config,
    setConfig,
    clearConfig,
    isLoaded,
  };
}
