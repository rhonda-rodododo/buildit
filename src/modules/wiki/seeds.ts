/**
 * Wiki Module Seed Data
 * Provides example/template data for the wiki module
 */

import type { ModuleSeed } from '@/types/modules';
import type { DBWikiPage } from './schema';

/**
 * Seed data for wiki module
 */
export const wikiSeeds: ModuleSeed[] = [
  {
    name: 'example-wiki-pages',
    description: 'Example wiki pages for demonstration',
    data: async (db, groupId, userPubkey) => {
      const examplePages: DBWikiPage[] = [
        {
          id: `example-page-1-${groupId}`,
          groupId,
          title: 'Welcome to the Wiki',
          content: `# Welcome to the Wiki

This is a collaborative knowledge base for our group. Feel free to create new pages, edit existing ones, and share your knowledge!

## How to Use

- Browse pages by category or tags
- Use the search function to find specific information
- Click "Edit" to make changes to any page
- View the version history to see past changes

## Getting Started

Check out these pages to learn more about our group and how we work together.`,
          category: 'Getting Started',
          tags: ['welcome', 'documentation'],
          version: 1,
          created: Date.now(),
          updated: Date.now(),
          updatedBy: userPubkey,
        },
        {
          id: `example-page-2-${groupId}`,
          groupId,
          title: 'Code of Conduct',
          content: `# Code of Conduct

Our community is dedicated to providing a harassment-free experience for everyone.

## Our Standards

- Be respectful and inclusive
- Welcome diverse perspectives
- Focus on what is best for the community
- Show empathy towards others

## Enforcement

Violations of this code of conduct may result in removal from the group.`,
          category: 'Community',
          tags: ['code-of-conduct', 'community', 'guidelines'],
          version: 1,
          created: Date.now(),
          updated: Date.now(),
          updatedBy: userPubkey,
        },
      ];

      await db.wikiPages.bulkAdd(examplePages);
      console.log(`Seeded ${examplePages.length} example wiki pages for group ${groupId}`);
    },
  },
];
