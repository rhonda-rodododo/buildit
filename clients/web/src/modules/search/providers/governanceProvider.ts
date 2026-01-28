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

// ============================================================================
// Types (Governance module types)
// ============================================================================

interface Proposal {
  id: string;
  groupId: string;
  title: string;
  description: string;
  proposerPubkey: string;
  status: 'draft' | 'active' | 'passed' | 'rejected' | 'withdrawn' | 'executed';
  votingMethod: 'simple' | 'ranked-choice' | 'quadratic' | 'consensus' | 'dhondt';
  createdAt: number;
  updatedAt: number;
  votingStart?: number;
  votingEnd?: number;
  tags?: string[];
  quorum?: number;
  passingThreshold?: number;
}

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
function getStatusLabel(status: Proposal['status']): string {
  const labels: Record<Proposal['status'], string> = {
    draft: 'Draft',
    active: 'Voting',
    passed: 'Passed',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
    executed: 'Executed',
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
    const proposal = entity as Proposal;
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
      updatedAt: proposal.updatedAt,
      authorPubkey: proposal.proposerPubkey,
      facets: {
        status: proposal.status,
        votingMethod: proposal.votingMethod,
        isActive: proposal.status === 'active',
        isPassed: proposal.status === 'passed' || proposal.status === 'executed',
        hasVotingPeriod: !!proposal.votingStart && !!proposal.votingEnd,
        ...(proposal.quorum !== undefined && { hasQuorum: proposal.quorum > 0 }),
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
        key: 'votingMethod',
        label: 'Voting Method',
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
    const status = proposal.facets?.status as Proposal['status'];
    const votingMethod = proposal.facets?.votingMethod as string;

    const badges: FormattedSearchResult['badges'] = [];

    // Status badge
    if (status) {
      const statusVariant = status === 'active' ? 'default' :
        status === 'passed' || status === 'executed' ? 'secondary' : 'outline';
      badges.push({ label: getStatusLabel(status), variant: statusVariant });
    }

    // Voting method badge
    if (votingMethod && votingMethod !== 'simple') {
      badges.push({ label: votingMethod, variant: 'outline' });
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
