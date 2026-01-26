/**
 * HomePage Component
 * Main page with activity feed and post composer
 *
 * Note: Seed posts are loaded in App.tsx to avoid race conditions.
 * This component only loads seeds for other modules (events, mutual aid, etc.)
 */

import { FC, useEffect } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { ActivityFeed } from '@/modules/microblogging/components/ActivityFeed';
import { useEventsStore } from '@/modules/events/eventsStore';
import { useMutualAidStore } from '@/modules/mutual-aid/mutualAidStore';
import { useGovernanceStore } from '@/modules/governance/governanceStore';
import { useWikiStore } from '@/modules/wiki/wikiStore';
import { useAuthStore } from '@/stores/authStore';
import { DEFAULT_INDEXABILITY } from '@/types/indexability';

export const HomePage: FC = () => {
  const { events, addEvent } = useEventsStore();
  const { aidItems, addAidItem } = useMutualAidStore();
  const { proposals, addProposal } = useGovernanceStore();
  const { pages, addPage } = useWikiStore();
  const { currentIdentity } = useAuthStore();

  useEffect(() => {
    // Load seed data if collections are empty (demo data)
    // Note: Posts seeds are loaded in App.tsx with localStorage deduplication
    const loadSeedData = async () => {
      const userPubkey = currentIdentity?.publicKey || 'demo-user';
      const now = Date.now();

      // Load seed events
      if (events.length === 0) {
        const seedEvents = [
          {
            id: 'event-1',
            title: 'Community Organizing Workshop',
            description: 'Learn the fundamentals of grassroots organizing, power mapping, and building coalitions. Perfect for new organizers!',
            location: 'Community Center, 123 Main St',
            startTime: now + 7 * 24 * 60 * 60 * 1000, // 1 week from now
            endTime: now + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000, // 2 hours later
            privacy: 'public' as const,
            capacity: 50,
            createdBy: userPubkey,
            createdAt: now - 2 * 24 * 60 * 60 * 1000, // 2 days ago
            updatedAt: now - 2 * 24 * 60 * 60 * 1000,
            tags: ['workshop', 'organizing', 'training'],
            coHosts: [],
          },
          {
            id: 'event-2',
            title: 'Climate Justice Rally',
            description: 'Join us for a peaceful rally demanding climate action now! Bring signs, friends, and your voice.',
            location: 'City Hall Plaza',
            startTime: now + 3 * 24 * 60 * 60 * 1000, // 3 days from now
            privacy: 'public' as const,
            createdBy: userPubkey,
            createdAt: now - 5 * 24 * 60 * 60 * 1000,
            updatedAt: now - 5 * 24 * 60 * 60 * 1000,
            tags: ['climate', 'rally', 'direct-action'],
            coHosts: [],
          },
          {
            id: 'event-3',
            title: 'Solidarity Network Meeting',
            description: 'Monthly meeting for mutual aid coordinators. Discuss ongoing projects, share resources, and plan for next month.',
            startTime: now + 10 * 24 * 60 * 60 * 1000, // 10 days from now
            privacy: 'group' as const,
            groupId: 'solidarity-network',
            createdBy: userPubkey,
            createdAt: now - 1 * 24 * 60 * 60 * 1000,
            updatedAt: now - 1 * 24 * 60 * 60 * 1000,
            tags: ['mutual-aid', 'meeting'],
            coHosts: [],
          },
        ];

        for (const event of seedEvents) {
          addEvent(event);
        }
      }

      // Load seed mutual aid requests
      if (aidItems.length === 0) {
        const seedAidItems = [
          {
            id: 'aid-1',
            groupId: 'mutual-aid-network',
            type: 'request' as const,
            category: 'food',
            title: 'Food assistance for family of 4',
            description: 'Lost job last week, need groceries for my family until I start new position next month. Any help appreciated!',
            status: 'open' as const,
            location: 'East Side',
            createdBy: userPubkey,
            createdAt: now - 3 * 60 * 60 * 1000, // 3 hours ago
            updatedAt: now - 3 * 60 * 60 * 1000,
            expiresAt: now + 14 * 24 * 60 * 60 * 1000, // 2 weeks from now
            customFields: {},
          },
          {
            id: 'aid-2',
            groupId: 'mutual-aid-network',
            type: 'offer' as const,
            category: 'transport',
            title: 'Rides to medical appointments',
            description: 'Have a car and flexible schedule. Happy to provide rides to doctor appointments, pharmacy pickups, etc.',
            status: 'open' as const,
            location: 'Downtown area',
            createdBy: userPubkey,
            createdAt: now - 2 * 24 * 60 * 60 * 1000,
            updatedAt: now - 2 * 24 * 60 * 60 * 1000,
            customFields: {},
          },
          {
            id: 'aid-3',
            groupId: 'mutual-aid-network',
            type: 'request' as const,
            category: 'housing',
            title: 'Temporary housing needed',
            description: 'Evicted from apartment, need temporary place to stay while I find new housing. Clean, quiet, can help with chores.',
            status: 'open' as const,
            createdBy: userPubkey,
            createdAt: now - 12 * 60 * 60 * 1000, // 12 hours ago
            updatedAt: now - 12 * 60 * 60 * 1000,
            expiresAt: now + 7 * 24 * 60 * 60 * 1000,
            customFields: {},
          },
        ];

        for (const item of seedAidItems) {
          addAidItem(item as any); // Seed data has slightly different shape, cast for compatibility
        }
      }

      // Load seed proposals
      if (Object.keys(proposals).length === 0) {
        const seedProposals = [
          {
            id: 'proposal-1',
            groupId: 'tenant-union',
            title: 'Rent Strike Resolution',
            description: 'Proposal to organize a coordinated rent strike in response to landlord refusing to make critical repairs. Includes legal support fund and media strategy.',
            status: 'voting' as const,
            votingMethod: 'consensus' as const,
            votingDeadline: now + 5 * 24 * 60 * 60 * 1000, // 5 days from now
            authorPubkey: userPubkey, // Fixed: use 'authorPubkey' not 'createdBy'
            created: now - 3 * 24 * 60 * 60 * 1000, // Fixed: use 'created' not 'createdAt'
            updated: now - 3 * 24 * 60 * 60 * 1000, // Fixed: use 'updated' not 'updatedAt'
          },
          {
            id: 'proposal-2',
            groupId: 'worker-coop',
            title: 'Profit Sharing Amendment',
            description: 'Amend our bylaws to increase profit sharing from 40% to 60% for worker-owners. Remaining 40% for growth fund and community reinvestment.',
            status: 'discussion' as const,
            votingMethod: 'simple' as const,
            authorPubkey: userPubkey, // Fixed: use 'authorPubkey' not 'createdBy'
            created: now - 6 * 24 * 60 * 60 * 1000, // Fixed: use 'created' not 'createdAt'
            updated: now - 6 * 24 * 60 * 60 * 1000, // Fixed: use 'updated' not 'updatedAt'
          },
          {
            id: 'proposal-3',
            groupId: 'community-land-trust',
            title: 'Purchase Community Garden Plot',
            description: 'Proposal to purchase the vacant lot at 456 Elm St for a community garden. Total cost $15,000. Seeking approval and fundraising plan.',
            status: 'decided' as const,
            votingMethod: 'quadratic' as const,
            authorPubkey: userPubkey, // Fixed: use 'authorPubkey' not 'createdBy'
            created: now - 15 * 24 * 60 * 60 * 1000, // Fixed: use 'created' not 'createdAt'
            updated: now - 8 * 24 * 60 * 60 * 1000, // Fixed: use 'updated' not 'updatedAt'
          },
        ];

        for (const proposal of seedProposals) {
          addProposal(proposal);
        }
      }

      // Load seed wiki pages
      if (Object.keys(pages).length === 0) {
        const seedPages = [
          {
            _v: '1.0.0',
            id: 'wiki-1',
            groupId: 'organizing-collective',
            title: 'Security Best Practices',
            slug: 'security-best-practices',
            content: '# Security Culture for Activists\n\n## Digital Security\n- Use encrypted messaging (Signal, Wire)\n- Enable 2FA on all accounts\n- Use VPN when organizing online\n\n## Operational Security\n- Need-to-know information sharing\n- Secure meeting locations\n- Counter-surveillance awareness\n\n## Legal Know Your Rights\n- Right to remain silent\n- Right to legal representation\n- Do not consent to searches',
            categoryId: 'security',
            tags: ['security', 'opsec', 'digital-security', 'legal'],
            status: 'published' as const,
            visibility: 'group' as const,
            version: 3,
            createdAt: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
            createdBy: userPubkey,
            updatedAt: now - 1 * 24 * 60 * 60 * 1000, // updated yesterday
            lastEditedBy: userPubkey,
            indexability: DEFAULT_INDEXABILITY,
          },
          {
            _v: '1.0.0',
            id: 'wiki-2',
            groupId: 'organizing-collective',
            title: 'Power Mapping Guide',
            slug: 'power-mapping-guide',
            content: '# How to Power Map\n\nPower mapping helps identify targets, allies, and opponents in campaigns.\n\n## Steps:\n1. Identify decision-makers\n2. Map relationships and influence\n3. Find pressure points\n4. Build coalition of allies\n5. Design escalating tactics',
            categoryId: 'strategy',
            tags: ['organizing', 'strategy', 'power-mapping'],
            status: 'published' as const,
            visibility: 'group' as const,
            version: 1,
            createdAt: now - 7 * 24 * 60 * 60 * 1000,
            createdBy: userPubkey,
            updatedAt: now - 7 * 24 * 60 * 60 * 1000,
            indexability: DEFAULT_INDEXABILITY,
          },
          {
            _v: '1.0.0',
            id: 'wiki-3',
            groupId: 'organizing-collective',
            title: 'Consensus Decision Making',
            slug: 'consensus-decision-making',
            content: '# Consensus Process\n\n## Overview\nConsensus is a decision-making process that seeks agreement from all participants.\n\n## Process\n1. **Proposal**: Present idea clearly\n2. **Clarifying Questions**: Ensure understanding\n3. **Discussion**: Concerns and amendments\n4. **Temperature Check**: Gauge support\n5. **Call for Consensus**: Test for agreement\n6. **Blocks**: Address fundamental objections',
            categoryId: 'governance',
            tags: ['consensus', 'governance', 'decision-making'],
            status: 'published' as const,
            visibility: 'group' as const,
            version: 2,
            createdAt: now - 20 * 24 * 60 * 60 * 1000,
            createdBy: userPubkey,
            updatedAt: now - 4 * 24 * 60 * 60 * 1000,
            lastEditedBy: userPubkey,
            indexability: DEFAULT_INDEXABILITY,
          },
        ];

        for (const page of seedPages) {
          addPage(page);
        }
      }
    };

    loadSeedData();
  }, []);

  return (
    <div className="h-full flex flex-col">
      <PageMeta titleKey="app.name" descriptionKey="meta.home" path="/app" />
      {/* Activity Feed - centered for readability */}
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-4">
        <ActivityFeed showComposer={true} />
      </div>
    </div>
  );
};
