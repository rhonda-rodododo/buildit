/**
 * Fundraising Module Seed Data
 * Example campaigns for demos/testing
 */

import type { ModuleSeed } from '@/types/modules';
import type { BuildItDB } from '@/core/storage/db';
import { generateEventId } from '@/core/nostr/nip01';
import type { Campaign, DonationTier } from './types';

/**
 * Strike Fund Campaign Seed
 */
export const strikeFundCampaignSeed: ModuleSeed = {
  name: 'Strike Fund Campaign',
  description: 'Fundraising campaign for strike support',
  data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
    const now = Date.now();

    // Create donors table (optional for campaign)
    const tableId = generateEventId();
    const donorsTable = {
      id: tableId,
      groupId,
      name: 'Strike Fund Donors',
      description: 'Donor database for strike fund',
      icon: 'DollarSign',
      fields: [
        {
          id: generateEventId(),
          name: 'Name',
          type: 'text',
          required: true,
        },
        {
          id: generateEventId(),
          name: 'Email',
          type: 'text',
          required: true,
        },
        {
          id: generateEventId(),
          name: 'Amount',
          type: 'number',
          required: true,
        },
        {
          id: generateEventId(),
          name: 'Message',
          type: 'text',
          required: false,
        },
      ],
      created: now,
      createdBy: userPubkey,
      updated: now,
    };
    await db.databaseTables?.add(donorsTable);

    // Create strike fund campaign
    const campaignId = generateEventId();
    const campaign: Campaign = {
      id: campaignId,
      groupId,
      tableId: donorsTable.id,
      title: 'Worker Strike Support Fund',
      slug: 'strike-fund-2025',
      description: '**Support our striking workers!**\n\nOur members are on strike for fair wages, safe working conditions, and dignity on the job. Every dollar helps keep them strong on the picket line.\n\n- Strike pay for workers\n- Legal defense fund\n- Healthcare coverage\n- Emergency support for families',
      category: 'strike',
      goal: 5000000, // $50,000
      currentAmount: 0,
      currency: 'USD',
      allowCustomAmount: true,
      allowRecurring: true,
      status: 'active',
      created: now,
      createdBy: userPubkey,
      updated: now,
      updateCount: 0,
      endsAt: now + 90 * 24 * 60 * 60 * 1000, // 90 days from now
      imageUrl: '/images/strike-solidarity.jpg',
      settings: {
        showDonorWall: true,
        allowAnonymousDonors: true,
        showDonorNames: true,
        showDonorAmounts: false,
        showDonorMessages: true,
        sendThankYouEmail: true,
        thankYouSubject: 'Thank You for Supporting Our Strike!',
        thankYouBody: 'Your solidarity means everything to our striking workers. Together we are stronger!',
        sendTaxReceipt: false,
        continueAfterGoal: true,
        notifyOnDonation: true,
        enabledProcessors: ['stripe', 'paypal'],
      },
    };
    await db.campaigns?.add(campaign);

    // Create donation tiers
    const tiers: DonationTier[] = [
      {
        id: generateEventId(),
        campaignId,
        name: 'Solidarity Supporter',
        amount: 2500, // $25
        description: 'Helps provide a day of strike pay for one worker',
        benefits: ['Strike fund supporter badge', 'Updates from the picket line'],
        order: 0,
        limited: false,
        currentCount: 0,
      },
      {
        id: generateEventId(),
        campaignId,
        name: 'Picket Line Partner',
        amount: 10000, // $100
        description: 'Covers a week of healthcare for a striking family',
        benefits: [
          'All Solidarity Supporter benefits',
          'Invitation to strategy call with strike leadership',
          'Strike solidarity t-shirt',
        ],
        order: 1,
        limited: false,
        currentCount: 0,
      },
      {
        id: generateEventId(),
        campaignId,
        name: 'Union Champion',
        amount: 50000, // $500
        description: 'Provides emergency support for 5 striking families',
        benefits: [
          'All Picket Line Partner benefits',
          'Recognition in campaign updates',
          'Invitation to victory celebration',
        ],
        order: 2,
        limited: true,
        maxCount: 50,
        currentCount: 0,
      },
    ];

    for (const tier of tiers) {
      await db.donationTiers?.add(tier);
    }

    console.log('✅ Created strike fund campaign seed with 3 donation tiers');
  },
};

/**
 * Bail Fund Campaign Seed
 */
export const bailFundCampaignSeed: ModuleSeed = {
  name: 'Bail Fund Campaign',
  description: 'Emergency bail fund for protesters',
  data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
    const now = Date.now();

    // Create bail fund campaign (no donor table for privacy)
    const campaignId = generateEventId();
    const campaign: Campaign = {
      id: campaignId,
      groupId,
      // No tableId - anonymous donations only
      title: 'Emergency Bail Fund',
      slug: 'bail-fund',
      description: '**Free our protesters!**\n\nWhen our community members are arrested for exercising their rights, we stand ready to get them out. This fund provides immediate bail for protesters.\n\n100% of donations go directly to bail.',
      category: 'bail',
      goal: 10000000, // $100,000
      currentAmount: 0,
      currency: 'USD',
      allowCustomAmount: true,
      allowRecurring: false, // One-time donations only
      status: 'active',
      created: now,
      createdBy: userPubkey,
      updated: now,
      updateCount: 0,
      imageUrl: '/images/bail-solidarity.jpg',
      settings: {
        showDonorWall: false, // Privacy: no donor wall
        allowAnonymousDonors: true,
        showDonorNames: false,
        showDonorAmounts: false,
        showDonorMessages: false,
        sendThankYouEmail: false, // No emails for privacy
        sendTaxReceipt: false,
        continueAfterGoal: true,
        notifyOnDonation: true,
        enabledProcessors: ['crypto'], // Crypto only for privacy
        cryptoAddresses: {
          bitcoin: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          ethereum: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          monero: '4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Uhd',
        },
      },
    };
    await db.campaigns?.add(campaign);

    console.log('✅ Created bail fund campaign seed (privacy-focused)');
  },
};

/**
 * All Fundraising Module Seeds
 */
export const fundraisingSeeds: ModuleSeed[] = [
  strikeFundCampaignSeed,
  bailFundCampaignSeed,
];
