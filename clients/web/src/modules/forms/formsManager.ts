/**
 * Forms Manager
 * Business logic for forms, campaigns, and public pages
 * Handles database persistence and integration with database module
 *
 * NOTE: This file contains legacy campaign and public page logic that should
 * be moved to fundraisingManager and publicManager. Keeping for backwards compatibility.
 */

import { dal } from '@/core/storage/dal';
import { generateEventId } from '@/core/nostr/nip01';
import type {
  Form,
  FormSubmission,
} from './types';
import type { Campaign, CampaignUpdate, Donation } from '../fundraising/types';
import type { PublicPage, Analytics } from '../public/types';
import type { DatabaseRecord, CustomFieldValues } from '../database/types';
import { databaseManager } from '../database/databaseManager';

/**
 * Forms Manager
 * Manages forms and their integration with database tables
 */
export class FormsManager {
  // ============================================================================
  // Form Management
  // ============================================================================

  /**
   * Create a new form for a database table
   */
  async createForm(
    tableId: string,
    groupId: string,
    creatorPubkey: string,
    formData: {
      title: string;
      description?: string;
      fieldIds: string[]; // which table fields to include
      settings: Form['settings'];
    }
  ): Promise<Form> {
    const now = Date.now();
    const formId = generateEventId();

    // Get table to validate fields exist
    const table = await dal.get<Record<string, unknown>>('databaseTables', tableId).catch(() => null);
    if (!table) {
      throw new Error('Table not found');
    }

    // Validate all fieldIds exist in table
    const tableFieldIds = (table.fields as Array<{ id: string }>)?.map((f) => f.id) ?? [];
    const invalidFields = formData.fieldIds.filter((id) => !tableFieldIds.includes(id));
    if (invalidFields.length > 0) {
      throw new Error(`Invalid field IDs: ${invalidFields.join(', ')}`);
    }

    // Create form field configs
    const fields = formData.fieldIds.map((fieldId, index) => ({
      fieldId,
      order: index,
    }));

    const form: Form = {
      id: formId,
      groupId,
      tableId,
      title: formData.title,
      description: formData.description,
      fields,
      settings: formData.settings,
      status: 'draft',
      created: now,
      createdBy: creatorPubkey,
      updated: now,
    };

    // Store in database
    try {
      await dal.add('forms', form);
    } catch {
      // Table might not exist yet
    }

    return form;
  }

  /**
   * Submit a form (creates a database record)
   */
  async submitForm(
    formId: string,
    data: CustomFieldValues,
    submitterInfo?: {
      pubkey?: string;
      email?: string;
      name?: string;
    }
  ): Promise<{ submission: FormSubmission; record: DatabaseRecord }> {
    const form = await dal.get<Form>('forms', formId).catch(() => null);
    if (!form) {
      throw new Error('Form not found');
    }

    if (form.status !== 'published') {
      throw new Error('Form is not published');
    }

    // Check submission limits
    if (form.settings.limitSubmissions && form.settings.maxSubmissions) {
      const submissions = await dal.query<FormSubmission>('formSubmissions', {
        whereClause: { formId },
      }).catch(() => []);
      if (submissions.length >= form.settings.maxSubmissions) {
        throw new Error('Form has reached maximum submissions');
      }
    }

    // Check per-user limit (by email if anonymous)
    if (form.settings.limitPerUser && form.settings.maxPerUser && submitterInfo?.email) {
      const userSubmissions = await dal.queryCustom<FormSubmission>({
        sql: 'SELECT * FROM form_submissions WHERE form_id = ?1 AND submitted_by_email = ?2',
        params: [formId, submitterInfo.email],
        dexieFallback: async (db) => {
          return db.formSubmissions
            ?.where({ formId, submittedByEmail: submitterInfo.email })
            .toArray() ?? [];
        },
      });
      if (userSubmissions.length >= form.settings.maxPerUser) {
        throw new Error('You have reached the maximum submissions allowed');
      }
    }

    const now = Date.now();
    const submissionId = generateEventId();

    // Create database record
    const record = await databaseManager.createRecord(
      form.tableId,
      form.groupId,
      submitterInfo?.pubkey || 'anonymous',
      data
    );

    // Create submission metadata
    const submission: FormSubmission = {
      id: submissionId,
      formId,
      tableId: form.tableId,
      groupId: form.groupId,
      recordId: record.id,
      submittedBy: submitterInfo?.pubkey,
      submittedByEmail: submitterInfo?.email,
      submittedByName: submitterInfo?.name,
      submittedAt: now,
      flaggedAsSpam: false,
      processed: false,
    };

    try {
      await dal.add('formSubmissions', submission);
    } catch {
      // Table might not exist yet
    }

    return { submission, record };
  }

  /**
   * Get form submissions
   */
  async getFormSubmissions(formId: string): Promise<FormSubmission[]> {
    try {
      const submissions = await dal.query<FormSubmission>('formSubmissions', {
        whereClause: { formId },
        orderBy: 'submittedAt',
        orderDir: 'desc',
      });
      return submissions;
    } catch {
      return [];
    }
  }

  // ============================================================================
  // Campaign Management
  // ============================================================================

  /**
   * Create a new campaign
   */
  async createCampaign(
    groupId: string,
    creatorPubkey: string,
    campaignData: {
      title: string;
      slug: string;
      description: string;
      category: Campaign['category'];
      goal: number;
      currency: string;
      tableId?: string; // optional donor database table
      settings: Campaign['settings'];
    }
  ): Promise<Campaign> {
    const now = Date.now();
    const campaignId = generateEventId();

    // Validate slug is unique within group
    const existingResults = await dal.queryCustom<Campaign>({
      sql: 'SELECT * FROM campaigns WHERE group_id = ?1 AND slug = ?2 LIMIT 1',
      params: [groupId, campaignData.slug],
      dexieFallback: async (db) => {
        const result = await db.campaigns
          ?.where({ groupId, slug: campaignData.slug })
          .first();
        return result ? [result] : [];
      },
    });
    if (existingResults[0]) {
      throw new Error('Campaign slug already exists in this group');
    }

    const campaign: Campaign = {
      id: campaignId,
      groupId,
      tableId: campaignData.tableId,
      title: campaignData.title,
      slug: campaignData.slug,
      description: campaignData.description,
      category: campaignData.category,
      goal: campaignData.goal,
      currentAmount: 0,
      currency: campaignData.currency,
      allowCustomAmount: true,
      allowRecurring: false,
      status: 'draft',
      created: now,
      createdBy: creatorPubkey,
      updated: now,
      updateCount: 0,
      settings: campaignData.settings,
    };

    try {
      await dal.add('campaigns', campaign);
    } catch {
      // Table might not exist yet
    }

    return campaign;
  }

  /**
   * Process a donation
   */
  async processDonation(
    campaignId: string,
    donationData: {
      amount: number;
      currency: string;
      tierId?: string;
      donorInfo?: {
        pubkey?: string;
        email?: string;
        name?: string;
        isAnonymous?: boolean;
      };
      message?: string;
      paymentMethod: Donation['paymentMethod'];
      transactionId?: string;
    }
  ): Promise<Donation> {
    const campaign = await dal.get<Campaign>('campaigns', campaignId).catch(() => null);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'active') {
      throw new Error('Campaign is not active');
    }

    // Check if campaign has ended
    if (campaign.endsAt && campaign.endsAt < Date.now()) {
      throw new Error('Campaign has ended');
    }

    // Check tier limits
    if (donationData.tierId) {
      const tier = await dal.get<Record<string, unknown>>('donationTiers', donationData.tierId).catch(() => null);
      if (tier && tier.limited && tier.maxCount) {
        if ((tier.currentCount as number) >= (tier.maxCount as number)) {
          throw new Error('This donation tier is sold out');
        }
      }
    }

    const now = Date.now();
    const donationId = generateEventId();

    // Create donor record in database table if configured
    let donorRecordId: string | undefined;
    if (campaign.tableId && donationData.donorInfo && !donationData.donorInfo.isAnonymous) {
      const donorRecord = await databaseManager.createRecord(
        campaign.tableId,
        campaign.groupId,
        donationData.donorInfo.pubkey || 'anonymous',
        {
          email: donationData.donorInfo.email,
          name: donationData.donorInfo.name,
          amount: donationData.amount,
          currency: donationData.currency,
          message: donationData.message,
          donatedAt: now,
        }
      );
      donorRecordId = donorRecord.id;
    }

    const donation: Donation = {
      id: donationId,
      campaignId,
      groupId: campaign.groupId,
      amount: donationData.amount,
      currency: donationData.currency,
      tierId: donationData.tierId,
      donorPubkey: donationData.donorInfo?.pubkey,
      donorRecordId,
      donorEmail: donationData.donorInfo?.email,
      donorName: donationData.donorInfo?.name,
      isAnonymous: donationData.donorInfo?.isAnonymous || false,
      message: donationData.message,
      isRecurring: false,
      status: 'pending',
      paymentMethod: donationData.paymentMethod,
      transactionId: donationData.transactionId,
      created: now,
    };

    try {
      await dal.add('donations', donation);
    } catch {
      // Table might not exist yet
    }

    return donation;
  }

  /**
   * Mark donation as completed
   */
  async completeDonation(donationId: string): Promise<void> {
    const donation = await dal.get<Donation>('donations', donationId).catch(() => null);
    if (!donation) {
      throw new Error('Donation not found');
    }

    const now = Date.now();

    // Update donation status
    await dal.update('donations', donationId, {
      status: 'completed',
      completedAt: now,
    });

    // Update campaign total
    const campaign = await dal.get<Campaign>('campaigns', donation.campaignId).catch(() => null);
    if (campaign) {
      await dal.update('campaigns', donation.campaignId, {
        currentAmount: campaign.currentAmount + donation.amount,
      });
    }

    // Increment tier count if applicable
    if (donation.tierId) {
      const tier = await dal.get<Record<string, unknown>>('donationTiers', donation.tierId).catch(() => null);
      if (tier) {
        await dal.update('donationTiers', donation.tierId, {
          currentCount: (tier.currentCount as number) + 1,
        });
      }
    }
  }

  /**
   * Create campaign update
   */
  async createCampaignUpdate(
    campaignId: string,
    creatorPubkey: string,
    updateData: {
      title: string;
      content: string;
    }
  ): Promise<CampaignUpdate> {
    const campaign = await dal.get<Campaign>('campaigns', campaignId).catch(() => null);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const now = Date.now();
    const updateId = generateEventId();

    const update: CampaignUpdate = {
      id: updateId,
      campaignId,
      groupId: campaign.groupId,
      title: updateData.title,
      content: updateData.content,
      created: now,
      createdBy: creatorPubkey,
      updated: now,
    };

    try {
      await dal.add('campaignUpdates', update);
    } catch {
      // Table might not exist yet
    }

    // Increment update count
    await dal.update('campaigns', campaignId, {
      updateCount: campaign.updateCount + 1,
    });

    return update;
  }

  // ============================================================================
  // Public Pages Management
  // ============================================================================

  /**
   * Create a public page
   */
  async createPublicPage(
    groupId: string,
    creatorPubkey: string,
    pageData: {
      slug: string;
      title: string;
      type: PublicPage['type'];
      content: string;
      seo: PublicPage['seo'];
    }
  ): Promise<PublicPage> {
    // Validate slug is unique within group
    const existingResults = await dal.queryCustom<PublicPage>({
      sql: 'SELECT * FROM public_pages WHERE group_id = ?1 AND slug = ?2 LIMIT 1',
      params: [groupId, pageData.slug],
      dexieFallback: async (db) => {
        const result = await db.publicPages
          ?.where({ groupId, slug: pageData.slug })
          .first();
        return result ? [result] : [];
      },
    });
    if (existingResults[0]) {
      throw new Error('Page slug already exists in this group');
    }

    const now = Date.now();
    const pageId = generateEventId();

    const page: PublicPage = {
      id: pageId,
      groupId,
      slug: pageData.slug,
      title: pageData.title,
      type: pageData.type,
      content: pageData.content,
      seo: pageData.seo,
      indexability: {
        isSearchIndexable: true,
        isAiIndexable: false,
      },
      status: 'draft',
      created: now,
      createdBy: creatorPubkey,
      updated: now,
    };

    try {
      await dal.add('publicPages', page);
    } catch {
      // Table might not exist yet
    }

    return page;
  }

  /**
   * Publish a public page
   */
  async publishPublicPage(pageId: string): Promise<void> {
    const now = Date.now();
    await dal.update('publicPages', pageId, {
      status: 'published',
      publishedAt: now,
    });
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  /**
   * Track analytics event
   */
  async trackEvent(
    groupId: string,
    event: Omit<Analytics, 'id' | 'groupId' | 'timestamp'>
  ): Promise<void> {
    const analyticsEvent: Analytics = {
      id: generateEventId(),
      groupId,
      ...event,
      timestamp: Date.now(),
    };

    try {
      await dal.add('analytics', analyticsEvent);
    } catch {
      // Table might not exist yet
    }
  }

  /**
   * Get analytics for a resource
   */
  async getAnalytics(
    resourceType: Analytics['resourceType'],
    resourceId: string,
    timeframe?: { start: number; end: number }
  ): Promise<Analytics[]> {
    try {
      const results = await dal.queryCustom<Analytics>({
        sql: timeframe
          ? 'SELECT * FROM analytics WHERE resource_type = ?1 AND resource_id = ?2 AND timestamp >= ?3 AND timestamp <= ?4'
          : 'SELECT * FROM analytics WHERE resource_type = ?1 AND resource_id = ?2',
        params: timeframe
          ? [resourceType, resourceId, timeframe.start, timeframe.end]
          : [resourceType, resourceId],
        dexieFallback: async (db) => {
          let query = db.analytics?.where({ resourceType, resourceId });
          if (timeframe) {
            query = query?.and((event: Analytics) =>
              event.timestamp >= timeframe.start && event.timestamp <= timeframe.end
            );
          }
          return await query?.toArray() ?? [];
        },
      });
      return results;
    } catch {
      return [];
    }
  }
}

// Singleton instance
export const formsManager = new FormsManager();
