/**
 * Fundraising Module Store
 * Zustand store for campaigns, donations, and donor management
 *
 * Can integrate with Forms module for donor data collection
 * Uses Public module for campaign pages and analytics
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Campaign,
  CampaignUpdate,
  Donation,
  DonationTier,
  FundraisingState,
} from './types';

interface FundraisingStoreState extends FundraisingState {
  // ============================================================================
  // Campaign Actions
  // ============================================================================

  // CRUD
  addCampaign: (campaign: Campaign) => void;
  updateCampaign: (campaignId: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (campaignId: string) => void;
  getCampaign: (campaignId: string) => Campaign | undefined;
  getCampaignBySlug: (slug: string) => Campaign | undefined;
  getCampaignsByGroup: (groupId: string) => Campaign[];
  getActiveCampaigns: (groupId: string) => Campaign[];

  // Updates
  addCampaignUpdate: (update: CampaignUpdate) => void;
  getCampaignUpdates: (campaignId: string) => CampaignUpdate[];

  // Donations
  addDonation: (donation: Donation) => void;
  getDonation: (donationId: string) => Donation | undefined;
  getDonationsByCampaign: (campaignId: string) => Donation[];
  getCompletedDonations: (campaignId: string) => Donation[];
  getTotalRaised: (campaignId: string) => number;
  getDonationProgress: (campaignId: string) => { current: number; goal: number; percentage: number };

  // Tiers
  addDonationTier: (tier: DonationTier) => void;
  updateDonationTier: (tierId: string, updates: Partial<DonationTier>) => void;
  deleteDonationTier: (tierId: string) => void;
  getDonationTiers: (campaignId: string) => DonationTier[];
  incrementTierCount: (tierId: string) => void;

  // ============================================================================
  // Utility Actions
  // ============================================================================

  clearAll: () => void;
  loadData: (data: Partial<FundraisingState>) => void;
}

export const useFundraisingStore = create<FundraisingStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      campaigns: new Map(),
      campaignUpdates: new Map(),
      donations: new Map(),
      donationTiers: new Map(),
      loading: false,
      error: null,

      // ========================================================================
      // Campaign Actions
      // ========================================================================

      addCampaign: (campaign) => set((state) => {
        const newCampaigns = new Map(state.campaigns);
        newCampaigns.set(campaign.id, campaign);
        return { campaigns: newCampaigns };
      }),

      updateCampaign: (campaignId, updates) => set((state) => {
        const newCampaigns = new Map(state.campaigns);
        const existing = newCampaigns.get(campaignId);
        if (existing) {
          newCampaigns.set(campaignId, { ...existing, ...updates, updated: Date.now() });
        }
        return { campaigns: newCampaigns };
      }),

      deleteCampaign: (campaignId) => set((state) => {
        const newCampaigns = new Map(state.campaigns);
        newCampaigns.delete(campaignId);

        // Delete related updates, donations, tiers
        const newUpdates = new Map(state.campaignUpdates);
        Array.from(newUpdates.values())
          .filter((u) => u.campaignId === campaignId)
          .forEach((u) => newUpdates.delete(u.id));

        const newDonations = new Map(state.donations);
        Array.from(newDonations.values())
          .filter((d) => d.campaignId === campaignId)
          .forEach((d) => newDonations.delete(d.id));

        const newTiers = new Map(state.donationTiers);
        Array.from(newTiers.values())
          .filter((t) => t.campaignId === campaignId)
          .forEach((t) => newTiers.delete(t.id));

        return {
          campaigns: newCampaigns,
          campaignUpdates: newUpdates,
          donations: newDonations,
          donationTiers: newTiers,
        };
      }),

      getCampaign: (campaignId) => {
        return get().campaigns.get(campaignId);
      },

      getCampaignBySlug: (slug) => {
        return Array.from(get().campaigns.values()).find((c) => c.slug === slug);
      },

      getCampaignsByGroup: (groupId) => {
        return Array.from(get().campaigns.values())
          .filter((c) => c.groupId === groupId)
          .sort((a, b) => b.created - a.created);
      },

      getActiveCampaigns: (groupId) => {
        const now = Date.now();
        return Array.from(get().campaigns.values())
          .filter(
            (c) =>
              c.groupId === groupId &&
              c.status === 'active' &&
              (!c.endsAt || c.endsAt > now)
          )
          .sort((a, b) => b.created - a.created);
      },

      // Campaign Updates

      addCampaignUpdate: (update) => set((state) => {
        const newUpdates = new Map(state.campaignUpdates);
        newUpdates.set(update.id, update);

        // Increment update count on campaign
        const newCampaigns = new Map(state.campaigns);
        const campaign = newCampaigns.get(update.campaignId);
        if (campaign) {
          newCampaigns.set(update.campaignId, {
            ...campaign,
            updateCount: campaign.updateCount + 1,
          });
        }

        return { campaignUpdates: newUpdates, campaigns: newCampaigns };
      }),

      getCampaignUpdates: (campaignId) => {
        return Array.from(get().campaignUpdates.values())
          .filter((u) => u.campaignId === campaignId)
          .sort((a, b) => b.created - a.created);
      },

      // Donations

      addDonation: (donation) => set((state) => {
        const newDonations = new Map(state.donations);
        newDonations.set(donation.id, donation);

        // Update campaign currentAmount if donation completed
        const newCampaigns = new Map(state.campaigns);
        if (donation.status === 'completed') {
          const campaign = newCampaigns.get(donation.campaignId);
          if (campaign) {
            newCampaigns.set(donation.campaignId, {
              ...campaign,
              currentAmount: campaign.currentAmount + donation.amount,
            });
          }

          // Increment tier count if applicable
          if (donation.tierId) {
            const newTiers = new Map(state.donationTiers);
            const tier = newTiers.get(donation.tierId);
            if (tier) {
              newTiers.set(donation.tierId, {
                ...tier,
                currentCount: tier.currentCount + 1,
              });
            }
            return { donations: newDonations, campaigns: newCampaigns, donationTiers: newTiers };
          }
        }

        return { donations: newDonations, campaigns: newCampaigns };
      }),

      getDonation: (donationId) => {
        return get().donations.get(donationId);
      },

      getDonationsByCampaign: (campaignId) => {
        return Array.from(get().donations.values())
          .filter((d) => d.campaignId === campaignId)
          .sort((a, b) => b.created - a.created);
      },

      getCompletedDonations: (campaignId) => {
        return Array.from(get().donations.values())
          .filter((d) => d.campaignId === campaignId && d.status === 'completed')
          .sort((a, b) => b.created - a.created);
      },

      getTotalRaised: (campaignId) => {
        return Array.from(get().donations.values())
          .filter((d) => d.campaignId === campaignId && d.status === 'completed')
          .reduce((sum, d) => sum + d.amount, 0);
      },

      getDonationProgress: (campaignId) => {
        const campaign = get().getCampaign(campaignId);
        if (!campaign) {
          return { current: 0, goal: 0, percentage: 0 };
        }
        const current = get().getTotalRaised(campaignId);
        const goal = campaign.goal;
        const percentage = goal > 0 ? Math.round((current / goal) * 100) : 0;
        return { current, goal, percentage };
      },

      // Donation Tiers

      addDonationTier: (tier) => set((state) => {
        const newTiers = new Map(state.donationTiers);
        newTiers.set(tier.id, tier);
        return { donationTiers: newTiers };
      }),

      updateDonationTier: (tierId, updates) => set((state) => {
        const newTiers = new Map(state.donationTiers);
        const existing = newTiers.get(tierId);
        if (existing) {
          newTiers.set(tierId, { ...existing, ...updates });
        }
        return { donationTiers: newTiers };
      }),

      deleteDonationTier: (tierId) => set((state) => {
        const newTiers = new Map(state.donationTiers);
        newTiers.delete(tierId);
        return { donationTiers: newTiers };
      }),

      getDonationTiers: (campaignId) => {
        return Array.from(get().donationTiers.values())
          .filter((t) => t.campaignId === campaignId)
          .sort((a, b) => a.order - b.order);
      },

      incrementTierCount: (tierId) => set((state) => {
        const newTiers = new Map(state.donationTiers);
        const existing = newTiers.get(tierId);
        if (existing) {
          newTiers.set(tierId, {
            ...existing,
            currentCount: existing.currentCount + 1,
          });
        }
        return { donationTiers: newTiers };
      }),

      // ========================================================================
      // Utility Actions
      // ========================================================================

      clearAll: () =>
        set({
          campaigns: new Map(),
          campaignUpdates: new Map(),
          donations: new Map(),
          donationTiers: new Map(),
          loading: false,
          error: null,
        }),

      loadData: (data) =>
        set((state) => ({
          ...state,
          ...data,
        })),
    }),
    {
      name: 'fundraising-storage',
      partialize: (state) => ({
        campaigns: state.campaigns,
        campaignUpdates: state.campaignUpdates,
        donations: state.donations,
        donationTiers: state.donationTiers,
      }),
    }
  )
);
