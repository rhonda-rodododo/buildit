/**
 * Governance Search Provider
 * Provides search indexing and formatting for the Governance module
 */

import type {
  ModuleSearchProvider,
  SearchDocument,
  SearchResult,
  FormattedSearchResult,
  FacetDefinition,
  ParsedQuery,
} from '../types';
import { getDB } from '@/core/storage/db';
import type { DBProposal } from '@/modules/governance/schema';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an excerpt from proposal description
 */
function createExcerpt(description: string | undefined, maxLength: number = 200): string {
  if (!description) return '';
  if (description.length <= maxLength) return description;
  return description.slice(0, maxLength).trim() + '...';
}

/**
 * Get status display label
 */
function getStatusLabel(status: DBProposal['status']): string {
  const labels: Record<DBProposal['status'], string> = {
    draft: 'Draft',
    discussion: 'Discussion',
    voting: 'Voting',
    passed: 'Passed',
    rejected: 'Rejected',
    expired: 'Expired',
    withdrawn: 'Withdrawn',
    implemented: 'Implemented',
  };
  return labels[status] || status;
}

// ============================================================================
// Governance Search Provider
// ============================================================================

export const governanceSearchProvider: ModuleSearchProvider = {
  moduleType: 'governance',

  /**
   * Index a proposal for search
   */
  indexEntity(entity: unknown, groupId: string): SearchDocument | null {
    const proposal = entity as DBProposal;
    if (!proposal || !proposal.id) return null;

    return {
      id: `governance:${proposal.id}`,
      moduleType: 'governance',
      entityId: proposal.id,
      groupId,
      title: proposal.title || 'Untitled Proposal',
      content: proposal.description || '',
      tags: proposal.tags || [],
      excerpt: createExcerpt(proposal.description, 200),
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt ?? proposal.createdAt,
      authorPubkey: proposal.createdBy,
      facets: {
        status: proposal.status,
        votingSystem: proposal.votingSystem,
        isActive: proposal.status === 'voting',
        isPassed: proposal.status === 'passed' || proposal.status === 'implemented',
        hasVotingPeriod: !!proposal.votingPeriod?.startsAt && !!proposal.votingPeriod?.endsAt,
        ...(proposal.quorum !== undefined && { hasQuorum: proposal.quorum.type !== 'none' }),
      },
      indexedAt: Date.now(),
    };
  },

  /**
   * Get facet definitions for governance
   */
  getFacetDefinitions(): FacetDefinition[] {
    return [
      {
        key: 'status',
        label: 'Status',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'votingSystem',
        label: 'Voting System',
        type: 'keyword',
        multiSelect: true,
      },
      {
        key: 'isActive',
        label: 'Active Voting',
        type: 'boolean',
        multiSelect: false,
      },
      {
        key: 'isPassed',
        label: 'Passed',
        type: 'boolean',
        multiSelect: false,
      },
    ];
  },

  /**
   * Format a governance search result for display
   */
  formatResult(result: SearchResult): FormattedSearchResult {
    const proposal = result.document;
    const status = proposal.facets?.status as DBProposal['status'];
    const votingSystem = proposal.facets?.votingSystem as string;

    const badges: FormattedSearchResult['badges'] = [];

    // Status badge
    if (status) {
      const statusVariant = status === 'voting' ? 'default' :
        status === 'passed' || status === 'implemented' ? 'secondary' : 'outline';
      badges.push({ label: getStatusLabel(status), variant: statusVariant });
    }

    // Voting system badge
    if (votingSystem && votingSystem !== 'simple-majority') {
      badges.push({ label: votingSystem, variant: 'outline' });
    }

    return {
      title: proposal.title || 'Untitled Proposal',
      subtitle: 'Proposal',
      icon: 'vote',
      path: `/groups/${proposal.groupId}/governance/${proposal.entityId}`,
      preview: result.highlightedExcerpt || proposal.excerpt,
      timestamp: proposal.updatedAt,
      badges,
    };
  },

  /**
   * Enhance query with governance-specific understanding
   */
  enhanceQuery(query: ParsedQuery): ParsedQuery {
    const govExpansions: Record<string, string[]> = {
      proposal: ['motion', 'vote', 'decision'],
      vote: ['ballot', 'poll', 'election'],
      motion: ['proposal', 'resolution', 'measure'],
      passed: ['approved', 'adopted', 'ratified'],
      rejected: ['failed', 'declined', 'denied'],
    };

    const enhancedTerms = [...query.expandedTerms];

    for (const keyword of query.keywords) {
      const expansion = govExpansions[keyword.toLowerCase()];
      if (expansion) {
        for (const term of expansion) {
          if (!enhancedTerms.includes(term)) {
            enhancedTerms.push(term);
          }
        }
      }
    }

    return {
      ...query,
      expandedTerms: enhancedTerms,
    };
  },

  /**
   * Get all proposals for indexing
   */
  async getIndexableEntities(groupId: string): Promise<unknown[]> {
    const db = getDB();
    if (!db.proposals) return [];

    try {
      const proposals = await db.proposals
        .where('groupId')
        .equals(groupId)
        .toArray();

      return proposals;
    } catch (error) {
      console.error('Failed to fetch proposals for indexing:', error);
      return [];
    }
  },
};

export default governanceSearchProvider;
