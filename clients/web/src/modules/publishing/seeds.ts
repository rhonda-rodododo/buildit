/**
 * Publishing Module Seed Data
 * Sample articles and publication for media collective template
 */

import type { ModuleSeed } from '@/types/modules';
import type { BuildItDB } from '@/core/storage/db';
import { generateEventId } from '@/core/nostr/nip01';
import type { Article, Publication } from './types';
import { DEFAULT_INDEXABILITY } from '@/types/indexability';

import { logger } from '@/lib/logger';

/**
 * Publishing demo seed for media collective template
 */
export const publishingDemoSeed: ModuleSeed = {
  name: 'publishing-demo',
  description: 'Sample publication with articles for media collective groups',
  data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const publicationId = generateEventId();

    // Create publication
    const publication: Publication = {
      id: publicationId,
      groupId,
      name: 'The Solidarity Press',
      description: 'Community journalism by and for the people. Covering labor, housing, and social justice.',
      slug: 'solidarity-press',
      ownerPubkey: userPubkey,
      status: 'active',
      theme: {
        primaryColor: '#DC2626',
        secondaryColor: '#1F2937',
        accentColor: '#F59E0B',
        fontFamily: 'serif',
        layout: 'default',
        darkMode: false,
      },
      navigation: [],
      settings: {
        defaultVisibility: 'public',
        allowComments: true,
        requireSubscription: false,
        enableRss: true,
        rssFullContent: false,
        enableEmailNotifications: true,
        enablePaidSubscriptions: false,
      },
      defaultSeo: {
        title: 'The Solidarity Press',
        description: 'Community journalism by and for the people',
      },
      createdAt: now - 90 * day,
      updatedAt: now - 1 * day,
    };

    await db.publications?.add(publication);

    // Create sample articles
    const articles: Article[] = [
      {
        id: generateEventId(),
        publicationId,
        groupId,
        title: 'Riverside Tenants Win Major Victory Against Rent Hikes',
        subtitle: 'After months of organizing, tenants secure rent stabilization agreement',
        slug: 'riverside-tenants-victory',
        content: `<h2>Riverside Tenants Win Major Victory</h2>
<p>After four months of sustained organizing, tenants at Riverside Apartments have secured a landmark rent stabilization agreement with property management company Greystone Holdings.</p>
<p>The agreement caps annual rent increases at 3% for the next five years and establishes a tenant advisory board with real decision-making power over building maintenance priorities.</p>
<p>"This proves that when tenants organize together, we have real power," said Patricia Nguyen, lead organizer for the building's tenant union. "They tried to raise our rents 40%. We said no."</p>
<h3>Key Terms of the Agreement</h3>
<ul>
<li>Annual rent increases capped at 3% (down from proposed 40%)</li>
<li>Tenant advisory board with quarterly meetings</li>
<li>$200,000 building maintenance fund</li>
<li>No-retaliation clause protecting organizing tenants</li>
</ul>
<p>The victory comes after tenants organized a rent strike that saw 85% participation across the 142-unit building.</p>`,
        excerpt: 'After four months of organizing and an 85% rent strike, Riverside tenants secure 3% cap on rent increases.',
        authorPubkey: userPubkey,
        authorName: 'Staff Reporter',
        tags: ['housing', 'tenant-organizing', 'victory', 'rent-strike'],
        status: 'published',
        visibility: 'public',
        publishedAt: now - 3 * day,
        seo: {
          title: 'Riverside Tenants Win Victory Against Rent Hikes',
          description: 'After months of organizing and an 85% rent strike, tenants at Riverside Apartments secure rent stabilization agreement.',
        },
        indexability: DEFAULT_INDEXABILITY,
        createdAt: now - 5 * day,
        updatedAt: now - 3 * day,
        readingTimeMinutes: 4,
        wordCount: 680,
        version: 1,
        lastSavedAt: now - 3 * day,
      },
      {
        id: generateEventId(),
        publicationId,
        groupId,
        title: 'Workers at Metro Warehouse Vote to Unionize',
        subtitle: 'Despite aggressive anti-union campaign, workers vote 67-33 in favor',
        slug: 'metro-warehouse-union-vote',
        content: `<h2>Metro Warehouse Workers Choose Union</h2>
<p>Workers at Metro Distribution Center voted overwhelmingly to join the Warehouse Workers Alliance, winning their NLRB election 67-33 despite months of anti-union pressure from management.</p>
<p>"They made us watch anti-union videos, held captive audience meetings, even brought in consultants," said shop steward Rosa Delgado. "But we knew our worth."</p>
<p>The newly organized unit of 100 workers will now begin contract negotiations, with priorities including wage increases, safety improvements, and scheduling predictability.</p>`,
        excerpt: 'Metro Distribution Center workers vote 67-33 to join Warehouse Workers Alliance.',
        authorPubkey: userPubkey,
        authorName: 'Labor Desk',
        tags: ['labor', 'union', 'organizing', 'warehouse-workers'],
        status: 'published',
        visibility: 'public',
        publishedAt: now - 10 * day,
        seo: {
          title: 'Metro Warehouse Workers Vote to Unionize',
          description: 'Workers at Metro Distribution Center vote 67-33 to join the Warehouse Workers Alliance.',
        },
        indexability: DEFAULT_INDEXABILITY,
        createdAt: now - 12 * day,
        updatedAt: now - 10 * day,
        readingTimeMinutes: 3,
        wordCount: 520,
        version: 1,
        lastSavedAt: now - 10 * day,
      },
      {
        id: generateEventId(),
        publicationId,
        groupId,
        title: 'Investigation: City Diverted $2M from Homeless Services to Police Overtime',
        subtitle: 'Budget documents reveal pattern of redirecting social service funding',
        slug: 'city-budget-diversion-investigation',
        content: `<h2>Draft - Under Review</h2>
<p><em>This article is currently undergoing editorial review. Key claims are being fact-checked against budget documents.</em></p>
<p>An analysis of city budget records obtained through public records requests reveals that the city has systematically diverted funds allocated for homeless services to cover police overtime costs over the past three fiscal years.</p>
<p>[EDITOR NOTE: Need second source for the $2M figure. Sarah is checking with the city controller's office.]</p>`,
        authorPubkey: userPubkey,
        authorName: 'Investigative Team',
        tags: ['investigation', 'budget', 'homelessness', 'police'],
        status: 'draft',
        visibility: 'subscribers',
        seo: {},
        indexability: DEFAULT_INDEXABILITY,
        createdAt: now - 7 * day,
        updatedAt: now - 1 * day,
        readingTimeMinutes: 8,
        wordCount: 1200,
        version: 3,
        lastSavedAt: now - 1 * day,
      },
    ];

    for (const article of articles) {
      await db.articles?.add(article);
    }

    logger.info(`Seeded publication "${publication.name}" with ${articles.length} articles for group ${groupId}`);
  },
};

/**
 * All Publishing Module Seeds
 */
export const publishingSeeds: ModuleSeed[] = [
  publishingDemoSeed,
];
