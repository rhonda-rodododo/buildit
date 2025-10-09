/**
 * Forms Manager Tests
 * Tests for forms business logic
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { formsManager } from '@/modules/forms/formsManager';
import { initializeDatabase } from '@/core/storage/db';
import { db } from '@/core/storage/db';
import type { Form, Campaign } from '@/modules/forms/types';

describe('FormsManager', () => {
  const testGroupId = 'test-group-1';
  const testUserId = 'test-user-1';
  const testTableId = 'test-table-1';

  beforeAll(async () => {
    // Initialize database
    await initializeDatabase();
  });

  beforeEach(async () => {
    // Clear test data
    await db.forms?.clear();
    await db.formSubmissions?.clear();
    await db.campaigns?.clear();
    await db.donations?.clear();
    await db.donationTiers?.clear();
    await db.publicPages?.clear();

    // Create mock database table for testing
    await db.databaseTables?.put({
      id: testTableId,
      groupId: testGroupId,
      name: 'Test Table',
      description: 'Test database table',
      icon: 'Table',
      fields: [
        { id: 'field-1', name: 'Name', type: 'text', required: true },
        { id: 'field-2', name: 'Email', type: 'text', required: true },
      ],
      created: Date.now(),
      createdBy: testUserId,
      updated: Date.now(),
    });
  });

  describe('Form Management', () => {
    it('should create a new form', async () => {
      const form = await formsManager.createForm(
        testTableId,
        testGroupId,
        testUserId,
        {
          title: 'Test Form',
          description: 'Test form description',
          fieldIds: ['field-1', 'field-2'],
          settings: {
            allowAnonymous: true,
            requireEmail: true,
            multiPage: false,
            confirmationMessage: 'Thank you!',
            sendAutoResponse: false,
            notifyOnSubmission: false,
            enableWebhook: false,
            limitSubmissions: false,
            limitPerUser: false,
            closeOnDate: false,
            antiSpam: {
              enableHoneypot: true,
              enableRateLimit: false,
              enableCaptcha: false,
            },
          },
        }
      );

      expect(form).toBeDefined();
      expect(form.title).toBe('Test Form');
      expect(form.tableId).toBe(testTableId);
      expect(form.status).toBe('draft');
      expect(form.fields).toHaveLength(2);
    });

    it('should reject form with invalid field IDs', async () => {
      await expect(
        formsManager.createForm(
          testTableId,
          testGroupId,
          testUserId,
          {
            title: 'Test Form',
            fieldIds: ['invalid-field'],
            settings: {} as any,
          }
        )
      ).rejects.toThrow('Invalid field IDs');
    });

    it('should submit a form and create database record', async () => {
      const form = await formsManager.createForm(
        testTableId,
        testGroupId,
        testUserId,
        {
          title: 'Test Form',
          fieldIds: ['field-1', 'field-2'],
          settings: {
            allowAnonymous: true,
            requireEmail: false,
            multiPage: false,
            confirmationMessage: 'Thank you!',
            sendAutoResponse: false,
            notifyOnSubmission: false,
            enableWebhook: false,
            limitSubmissions: false,
            limitPerUser: false,
            closeOnDate: false,
            antiSpam: {
              enableHoneypot: false,
              enableRateLimit: false,
              enableCaptcha: false,
            },
          },
        }
      );

      // Publish the form
      await db.forms?.update(form.id, { status: 'published' });

      const result = await formsManager.submitForm(
        form.id,
        {
          'field-1': 'John Doe',
          'field-2': 'john@example.com',
        },
        {
          email: 'john@example.com',
          name: 'John Doe',
        }
      );

      expect(result.submission).toBeDefined();
      expect(result.record).toBeDefined();
      expect(result.submission.formId).toBe(form.id);
      expect(result.submission.submittedByEmail).toBe('john@example.com');
    });

    it('should enforce submission limits', async () => {
      const form = await formsManager.createForm(
        testTableId,
        testGroupId,
        testUserId,
        {
          title: 'Limited Form',
          fieldIds: ['field-1'],
          settings: {
            allowAnonymous: true,
            requireEmail: false,
            multiPage: false,
            confirmationMessage: 'Thanks',
            sendAutoResponse: false,
            notifyOnSubmission: false,
            enableWebhook: false,
            limitSubmissions: true,
            maxSubmissions: 1,
            limitPerUser: false,
            closeOnDate: false,
            antiSpam: {
              enableHoneypot: false,
              enableRateLimit: false,
              enableCaptcha: false,
            },
          },
        }
      );

      await db.forms?.update(form.id, { status: 'published' });

      // First submission should succeed
      await formsManager.submitForm(form.id, { 'field-1': 'Test' });

      // Second submission should fail
      await expect(
        formsManager.submitForm(form.id, { 'field-1': 'Test 2' })
      ).rejects.toThrow('maximum submissions');
    });
  });

  describe('Campaign Management', () => {
    it('should create a new campaign', async () => {
      const campaign = await formsManager.createCampaign(
        testGroupId,
        testUserId,
        {
          title: 'Test Campaign',
          slug: 'test-campaign',
          description: 'Test campaign description',
          category: 'general',
          goal: 100000, // $1000 in cents
          currency: 'USD',
          settings: {
            showDonorWall: true,
            allowAnonymousDonors: true,
            showDonorNames: true,
            showDonorAmounts: false,
            showDonorMessages: true,
            sendThankYouEmail: false,
            sendTaxReceipt: false,
            continueAfterGoal: true,
            notifyOnDonation: false,
            enabledProcessors: ['stripe'],
          },
        }
      );

      expect(campaign).toBeDefined();
      expect(campaign.title).toBe('Test Campaign');
      expect(campaign.slug).toBe('test-campaign');
      expect(campaign.status).toBe('draft');
      expect(campaign.currentAmount).toBe(0);
    });

    it('should process a donation', async () => {
      const campaign = await formsManager.createCampaign(
        testGroupId,
        testUserId,
        {
          title: 'Test Campaign',
          slug: 'test-campaign-2',
          description: 'Test',
          category: 'general',
          goal: 100000,
          currency: 'USD',
          settings: {} as any,
        }
      );

      await db.campaigns?.update(campaign.id, { status: 'active' });

      const donation = await formsManager.processDonation(campaign.id, {
        amount: 5000, // $50 in cents
        currency: 'USD',
        paymentMethod: 'stripe',
        donorInfo: {
          email: 'donor@example.com',
          name: 'Jane Donor',
        },
      });

      expect(donation).toBeDefined();
      expect(donation.amount).toBe(5000);
      expect(donation.status).toBe('pending');
    });

    it('should update campaign amount when donation completed', async () => {
      const campaign = await formsManager.createCampaign(
        testGroupId,
        testUserId,
        {
          title: 'Test Campaign',
          slug: 'test-campaign-3',
          description: 'Test',
          category: 'general',
          goal: 100000,
          currency: 'USD',
          settings: {} as any,
        }
      );

      await db.campaigns?.update(campaign.id, { status: 'active' });

      const donation = await formsManager.processDonation(campaign.id, {
        amount: 5000,
        currency: 'USD',
        paymentMethod: 'stripe',
      });

      await formsManager.completeDonation(donation.id);

      const updatedCampaign = await db.campaigns?.get(campaign.id);
      expect(updatedCampaign?.currentAmount).toBe(5000);
    });
  });

  describe('Public Pages', () => {
    it('should create a public page', async () => {
      const page = await formsManager.createPublicPage(
        testGroupId,
        testUserId,
        {
          slug: 'about',
          title: 'About Us',
          type: 'about',
          content: '<h1>About Us</h1><p>We are awesome.</p>',
          seo: {
            title: 'About Us',
            description: 'Learn about us',
          },
        }
      );

      expect(page).toBeDefined();
      expect(page.slug).toBe('about');
      expect(page.status).toBe('draft');
    });

    it('should publish a public page', async () => {
      const page = await formsManager.createPublicPage(
        testGroupId,
        testUserId,
        {
          slug: 'contact',
          title: 'Contact',
          type: 'contact',
          content: '<p>Contact us</p>',
          seo: {},
        }
      );

      await formsManager.publishPublicPage(page.id);

      const updated = await db.publicPages?.get(page.id);
      expect(updated?.status).toBe('published');
      expect(updated?.publishedAt).toBeDefined();
    });
  });
});
