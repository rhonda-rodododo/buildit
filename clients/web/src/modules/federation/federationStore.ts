/**
 * Federation module Zustand store
 *
 * Manages federation configuration, status, and interactions.
 */

import { create } from 'zustand';
import type { FederationConfig, FederationIdentityStatus, FederationInteraction } from './types';

const FEDERATION_API_BASE = import.meta.env.VITE_FEDERATION_API_URL ?? 'https://buildit-federation.rikki-schulte.workers.dev';

interface FederationState {
  // State
  config: FederationConfig | null;
  interactions: FederationInteraction[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchStatus: (pubkey: string) => Promise<FederationIdentityStatus | null>;
  fetchInteractions: (pubkey: string) => Promise<void>;
  setConfig: (config: FederationConfig | null) => void;
  clearError: () => void;
}

export const useFederationStore = create<FederationState>((set) => ({
  config: null,
  interactions: [],
  loading: false,
  error: null,

  fetchStatus: async (pubkey: string) => {
    try {
      const res = await fetch(`${FEDERATION_API_BASE}/api/status/${pubkey}`);
      if (!res.ok) return null;
      return res.json() as Promise<FederationIdentityStatus>;
    } catch {
      return null;
    }
  },

  fetchInteractions: async (pubkey: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${FEDERATION_API_BASE}/api/interactions/${pubkey}?limit=50`);
      if (!res.ok) throw new Error('Failed to fetch interactions');
      const interactions = await res.json() as FederationInteraction[];
      set({ interactions, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  setConfig: (config) => set({ config }),
  clearError: () => set({ error: null }),
}));
