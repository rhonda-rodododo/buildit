/**
 * Publishing Module Database Schema
 * Contains all database table definitions for long-form publishing
 */

import type { TableSchema } from '@/types/modules';
import type {
  Article,
  ArticleDraft,
  Publication,
  Subscription,
  ArticleView,
} from './types';

// ============================================================================
// Database Table Interfaces (exported for Dexie)
// ============================================================================

/**
 * Articles table
 * Long-form content entries
 */
export interface DBArticle extends Article {}

/**
 * Article Drafts table
 * Auto-saved drafts for articles
 */
export interface DBArticleDraft extends ArticleDraft {}

/**
 * Publications table
 * Blog/newsletter publications
 */
export interface DBPublication extends Publication {}

/**
 * Subscriptions table
 * Reader subscriptions to publications
 */
export interface DBSubscription extends Subscription {}

/**
 * Article Views table
 * Privacy-preserving view tracking
 */
export interface DBArticleView extends ArticleView {}

// ============================================================================
// Module Schema Definition
// ============================================================================

/**
 * Publishing module schema definition for Dexie
 * All tables with indexes for efficient querying
 */
export const publishingSchema: TableSchema[] = [
  // Articles
  {
    name: 'articles',
    schema: 'id, publicationId, groupId, slug, status, visibility, authorPubkey, publishedAt, createdAt, updatedAt, [publicationId+status], [publicationId+publishedAt]',
    indexes: [
      'id',
      'publicationId',
      'groupId',
      'slug',
      'status',
      'visibility',
      'authorPubkey',
      'publishedAt',
      'createdAt',
      'updatedAt',
      '[publicationId+status]',
      '[publicationId+publishedAt]',
    ],
  },
  // Article Drafts
  {
    name: 'articleDrafts',
    schema: 'id, articleId, publicationId, groupId, authorPubkey, savedAt',
    indexes: ['id', 'articleId', 'publicationId', 'groupId', 'authorPubkey', 'savedAt'],
  },
  // Publications
  {
    name: 'publications',
    schema: 'id, groupId, slug, status, ownerPubkey, createdAt',
    indexes: ['id', 'groupId', 'slug', 'status', 'ownerPubkey', 'createdAt'],
  },
  // Subscriptions
  {
    name: 'subscriptions',
    schema: 'id, publicationId, groupId, subscriberPubkey, tier, status, subscribedAt, [publicationId+status]',
    indexes: [
      'id',
      'publicationId',
      'groupId',
      'subscriberPubkey',
      'tier',
      'status',
      'subscribedAt',
      '[publicationId+status]',
    ],
  },
  // Article Views (privacy-preserving analytics)
  {
    name: 'articleViews',
    schema: 'id, articleId, publicationId, sessionId, viewedAt, [articleId+viewedAt]',
    indexes: ['id', 'articleId', 'publicationId', 'sessionId', 'viewedAt', '[articleId+viewedAt]'],
  },
];

// Export type-safe table names
export const PUBLISHING_TABLES = {
  ARTICLES: 'articles',
  ARTICLE_DRAFTS: 'articleDrafts',
  PUBLICATIONS: 'publications',
  SUBSCRIPTIONS: 'subscriptions',
  ARTICLE_VIEWS: 'articleViews',
} as const;
