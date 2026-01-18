/**
 * Public Module Seed Data
 * Example public pages for demos/testing
 */

import type { ModuleSeed } from '@/types/modules';
import type { BuildItDB } from '@/core/storage/db';
import { generateEventId } from '@/core/nostr/nip01';
import type { PublicPage } from './types';

import { logger } from '@/lib/logger';
/**
 * Public Landing Page Seed
 */
export const publicLandingPageSeed: ModuleSeed = {
  name: 'Public Landing Page',
  description: 'SEO-optimized landing page for the group',
  data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
    const now = Date.now();

    const pageId = generateEventId();
    const page: PublicPage = {
      id: pageId,
      groupId,
      slug: 'home',
      title: 'Workers United - Fighting for Justice',
      type: 'landing',
      content: `# Workers United

## Fighting for Justice, Dignity, and Fair Wages

We are a grassroots union organizing workers across industries. Join us in the fight for:

- **Living Wages** - No one who works full-time should live in poverty
- **Safe Conditions** - Every worker deserves a safe workplace
- **Healthcare** - Universal healthcare is a human right
- **Dignity** - Respect and fair treatment on the job

### Get Involved

- [Join the Union](/join)
- [Upcoming Events](/events)
- [Support Striking Workers](/campaigns/strike-fund)
- [Volunteer](/volunteer)

### Recent Victories

✊ Won 25% wage increase at Metro Transit
✊ Secured paid sick leave at 50 workplaces
✊ Stopped 200 wrongful terminations

---

*Solidarity forever!*`,
      seo: {
        title: 'Workers United - Labor Union Fighting for Justice',
        description: 'Join Workers United in the fight for living wages, safe conditions, and worker dignity. Grassroots union organizing across all industries.',
        keywords: ['union', 'labor', 'workers rights', 'organizing', 'strike', 'solidarity'],
        ogTitle: 'Workers United - Fighting for Justice',
        ogDescription: 'Grassroots union organizing for living wages, safe conditions, and worker dignity',
        ogImage: '/images/workers-united-og.jpg',
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: 'Workers United',
        twitterDescription: 'Labor union fighting for justice and worker dignity',
        twitterImage: '/images/workers-united-twitter.jpg',
        canonicalUrl: 'https://workersunited.org',
      },
      status: 'published',
      publishedAt: now,
      created: now,
      createdBy: userPubkey,
      updated: now,
    };

    await db.publicPages?.add(page);
    logger.info('✅ Created public landing page seed');
  },
};

/**
 * About Page Seed
 */
export const aboutPageSeed: ModuleSeed = {
  name: 'About Page',
  description: 'Public about page for the organization',
  data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
    const now = Date.now();

    const pageId = generateEventId();
    const page: PublicPage = {
      id: pageId,
      groupId,
      slug: 'about',
      title: 'About Workers United',
      type: 'about',
      content: `# About Workers United

## Our Mission

Workers United is a grassroots labor union fighting for economic justice, workplace dignity, and the rights of all workers.

## Our History

Founded in 2020 by frontline workers during the pandemic, we've grown to represent over 10,000 workers across multiple industries.

## Our Values

- **Worker Power** - Workers should control their workplaces
- **Solidarity** - An injury to one is an injury to all
- **Democracy** - Democratic decision-making at all levels
- **Inclusion** - Fighting for all workers, regardless of background

## Get Involved

Want to join the movement? [Contact us](/contact) or [sign up to volunteer](/volunteer).`,
      seo: {
        title: 'About Workers United - Our Mission and History',
        description: 'Learn about Workers United, a grassroots labor union fighting for economic justice and workplace dignity since 2020.',
        keywords: ['labor union', 'workers rights', 'grassroots organizing', 'mission', 'values'],
      },
      status: 'published',
      publishedAt: now,
      created: now,
      createdBy: userPubkey,
      updated: now,
    };

    await db.publicPages?.add(page);
    logger.info('✅ Created about page seed');
  },
};

/**
 * All Public Module Seeds
 */
export const publicSeeds: ModuleSeed[] = [
  publicLandingPageSeed,
  aboutPageSeed,
];
