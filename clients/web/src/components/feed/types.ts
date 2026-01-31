/**
 * Feed Item Types
 * Unified type system for aggregating content from all modules in the activity feed
 */

import type { Post } from '@/modules/microblogging/types';
import type { DBEvent } from '@/modules/events/schema';
import type { DBMutualAidRequest } from '@/modules/mutual-aid/schema';
import type { DBProposal } from '@/modules/governance/schema';
import type { WikiPage } from '@/modules/wiki/types';

/**
 * Base feed item interface
 */
export interface BaseFeedItem {
  id: string;
  type: 'post' | 'event' | 'mutual-aid' | 'proposal' | 'wiki-update';
  timestamp: number; // Unix timestamp for sorting
  authorId: string;
  groupId?: string;
}

/**
 * Post feed item
 */
export interface PostFeedItem extends BaseFeedItem {
  type: 'post';
  data: Post;
}

/**
 * Event feed item
 */
export interface EventFeedItem extends BaseFeedItem {
  type: 'event';
  data: DBEvent;
}

/**
 * Mutual aid feed item
 */
export interface MutualAidFeedItem extends BaseFeedItem {
  type: 'mutual-aid';
  data: DBMutualAidRequest;
}

/**
 * Proposal feed item
 */
export interface ProposalFeedItem extends BaseFeedItem {
  type: 'proposal';
  data: DBProposal;
}

/**
 * Wiki update feed item
 */
export interface WikiUpdateFeedItem extends BaseFeedItem {
  type: 'wiki-update';
  data: WikiPage;
}

/**
 * Unified feed item type
 */
export type FeedItem =
  | PostFeedItem
  | EventFeedItem
  | MutualAidFeedItem
  | ProposalFeedItem
  | WikiUpdateFeedItem;

/**
 * Feed filter options
 */
export interface FeedFilterOptions {
  contentTypes?: FeedItem['type'][];
  groupIds?: string[];
  authorIds?: string[];
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}
