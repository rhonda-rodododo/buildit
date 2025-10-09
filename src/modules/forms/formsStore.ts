/**
 * Forms Module Store
 * Zustand store for forms, campaigns, public pages, and analytics
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Form,
  FormSubmission,
  Campaign,
  CampaignUpdate,
  Donation,
  DonationTier,
  PublicPage,
  Analytics,
  AnalyticsSummary,
  FormsState,
} from './types';

interface FormsStoreState extends FormsState {
  // ============================================================================
  // Form Actions
  // ============================================================================

  // CRUD
  addForm: (form: Form) => void;
  updateForm: (formId: string, updates: Partial<Form>) => void;
  deleteForm: (formId: string) => void;
  getForm: (formId: string) => Form | undefined;
  getFormsByGroup: (groupId: string) => Form[];
  getFormsByTable: (tableId: string) => Form[];
  getPublishedForms: (groupId: string) => Form[];

  // Submissions
  addSubmission: (submission: FormSubmission) => void;
  getSubmission: (submissionId: string) => FormSubmission | undefined;
  getSubmissionsByForm: (formId: string) => FormSubmission[];
  getSubmissionsByTable: (tableId: string) => FormSubmission[];
  flagSubmissionAsSpam: (submissionId: string) => void;
  markSubmissionProcessed: (submissionId: string) => void;

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
  // Public Pages Actions
  // ============================================================================

  // CRUD
  addPublicPage: (page: PublicPage) => void;
  updatePublicPage: (pageId: string, updates: Partial<PublicPage>) => void;
  deletePublicPage: (pageId: string) => void;
  getPublicPage: (pageId: string) => PublicPage | undefined;
  getPublicPageBySlug: (groupId: string, slug: string) => PublicPage | undefined;
  getPublicPages: (groupId: string) => PublicPage[];
  getPublishedPages: (groupId: string) => PublicPage[];

  // ============================================================================
  // Analytics Actions
  // ============================================================================

  // Events
  addAnalyticsEvent: (event: Analytics) => void;
  getAnalyticsEvents: (resourceType: string, resourceId: string) => Analytics[];

  // Summaries
  updateAnalyticsSummary: (summary: AnalyticsSummary) => void;
  getAnalyticsSummary: (
    resourceType: string,
    resourceId: string,
    timeframe: AnalyticsSummary['timeframe']
  ) => AnalyticsSummary | undefined;

  // ============================================================================
  // Utility Actions
  // ============================================================================

  clearAll: () => void;
  loadData: (data: Partial<FormsState>) => void;
}

export const useFormsStore = create<FormsStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      forms: new Map(),
      submissions: new Map(),
      campaigns: new Map(),
      campaignUpdates: new Map(),
      donations: new Map(),
      donationTiers: new Map(),
      publicPages: new Map(),
      analytics: new Map(),
      analyticsSummaries: new Map(),
      loading: false,
      error: null,

      // ========================================================================
      // Form Actions
      // ========================================================================

      addForm: (form) => set((state) => {
        const newForms = new Map(state.forms);
        newForms.set(form.id, form);
        return { forms: newForms };
      }),

      updateForm: (formId, updates) => set((state) => {
        const newForms = new Map(state.forms);
        const existing = newForms.get(formId);
        if (existing) {
          newForms.set(formId, { ...existing, ...updates, updated: Date.now() });
        }
        return { forms: newForms };
      }),

      deleteForm: (formId) => set((state) => {
        const newForms = new Map(state.forms);
        newForms.delete(formId);

        // Also delete related submissions
        const newSubmissions = new Map(state.submissions);
        Array.from(newSubmissions.values())
          .filter((s) => s.formId === formId)
          .forEach((s) => newSubmissions.delete(s.id));

        return { forms: newForms, submissions: newSubmissions };
      }),

      getForm: (formId) => {
        return get().forms.get(formId);
      },

      getFormsByGroup: (groupId) => {
        return Array.from(get().forms.values()).filter((f) => f.groupId === groupId);
      },

      getFormsByTable: (tableId) => {
        return Array.from(get().forms.values()).filter((f) => f.tableId === tableId);
      },

      getPublishedForms: (groupId) => {
        return Array.from(get().forms.values())
          .filter((f) => f.groupId === groupId && f.status === 'published')
          .sort((a, b) => b.created - a.created);
      },

      // Submissions

      addSubmission: (submission) => set((state) => {
        const newSubmissions = new Map(state.submissions);
        newSubmissions.set(submission.id, submission);
        return { submissions: newSubmissions };
      }),

      getSubmission: (submissionId) => {
        return get().submissions.get(submissionId);
      },

      getSubmissionsByForm: (formId) => {
        return Array.from(get().submissions.values())
          .filter((s) => s.formId === formId)
          .sort((a, b) => b.submittedAt - a.submittedAt);
      },

      getSubmissionsByTable: (tableId) => {
        return Array.from(get().submissions.values())
          .filter((s) => s.tableId === tableId)
          .sort((a, b) => b.submittedAt - a.submittedAt);
      },

      flagSubmissionAsSpam: (submissionId) => set((state) => {
        const newSubmissions = new Map(state.submissions);
        const existing = newSubmissions.get(submissionId);
        if (existing) {
          newSubmissions.set(submissionId, { ...existing, flaggedAsSpam: true });
        }
        return { submissions: newSubmissions };
      }),

      markSubmissionProcessed: (submissionId) => set((state) => {
        const newSubmissions = new Map(state.submissions);
        const existing = newSubmissions.get(submissionId);
        if (existing) {
          newSubmissions.set(submissionId, {
            ...existing,
            processed: true,
            processedAt: Date.now(),
          });
        }
        return { submissions: newSubmissions };
      }),

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
      // Public Pages Actions
      // ========================================================================

      addPublicPage: (page) => set((state) => {
        const newPages = new Map(state.publicPages);
        newPages.set(page.id, page);
        return { publicPages: newPages };
      }),

      updatePublicPage: (pageId, updates) => set((state) => {
        const newPages = new Map(state.publicPages);
        const existing = newPages.get(pageId);
        if (existing) {
          newPages.set(pageId, { ...existing, ...updates, updated: Date.now() });
        }
        return { publicPages: newPages };
      }),

      deletePublicPage: (pageId) => set((state) => {
        const newPages = new Map(state.publicPages);
        newPages.delete(pageId);
        return { publicPages: newPages };
      }),

      getPublicPage: (pageId) => {
        return get().publicPages.get(pageId);
      },

      getPublicPageBySlug: (groupId, slug) => {
        return Array.from(get().publicPages.values()).find(
          (p) => p.groupId === groupId && p.slug === slug && p.status === 'published'
        );
      },

      getPublicPages: (groupId) => {
        return Array.from(get().publicPages.values())
          .filter((p) => p.groupId === groupId)
          .sort((a, b) => b.created - a.created);
      },

      getPublishedPages: (groupId) => {
        return Array.from(get().publicPages.values())
          .filter((p) => p.groupId === groupId && p.status === 'published')
          .sort((a, b) => b.created - a.created);
      },

      // ========================================================================
      // Analytics Actions
      // ========================================================================

      addAnalyticsEvent: (event) => set((state) => {
        const newAnalytics = new Map(state.analytics);
        newAnalytics.set(event.id, event);
        return { analytics: newAnalytics };
      }),

      getAnalyticsEvents: (resourceType, resourceId) => {
        return Array.from(get().analytics.values())
          .filter((e) => e.resourceType === resourceType && e.resourceId === resourceId)
          .sort((a, b) => b.timestamp - a.timestamp);
      },

      updateAnalyticsSummary: (summary) => set((state) => {
        const newSummaries = new Map(state.analyticsSummaries);
        const key = `${summary.resourceType}-${summary.resourceId}-${summary.timeframe}`;
        newSummaries.set(key, summary);
        return { analyticsSummaries: newSummaries };
      }),

      getAnalyticsSummary: (resourceType, resourceId, timeframe) => {
        const key = `${resourceType}-${resourceId}-${timeframe}`;
        return get().analyticsSummaries.get(key);
      },

      // ========================================================================
      // Utility Actions
      // ========================================================================

      clearAll: () =>
        set({
          forms: new Map(),
          submissions: new Map(),
          campaigns: new Map(),
          campaignUpdates: new Map(),
          donations: new Map(),
          donationTiers: new Map(),
          publicPages: new Map(),
          analytics: new Map(),
          analyticsSummaries: new Map(),
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
      name: 'forms-storage',
      // Only persist essential data, not analytics
      partialize: (state) => ({
        forms: state.forms,
        submissions: state.submissions,
        campaigns: state.campaigns,
        campaignUpdates: state.campaignUpdates,
        donations: state.donations,
        donationTiers: state.donationTiers,
        publicPages: state.publicPages,
      }),
    }
  )
);
