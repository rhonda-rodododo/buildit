/**
 * Newsletter Module Schema
 * Database table definitions for newsletter management
 */

import type { TableSchema } from '@/types/modules';

/**
 * Newsletter tables for Dexie
 */
export const newslettersSchema: TableSchema[] = [
  {
    name: 'newsletters',
    schema:
      'id, groupId, publicationId, ownerPubkey, name, createdAt, updatedAt, [groupId+createdAt]',
    indexes: [
      'id',
      'groupId',
      'publicationId',
      'ownerPubkey',
      '[groupId+createdAt]',
    ],
  },
  {
    name: 'newsletterIssues',
    schema:
      'id, newsletterId, groupId, authorPubkey, status, scheduledAt, sentAt, createdAt, updatedAt, [newsletterId+status], [newsletterId+createdAt], [status+scheduledAt]',
    indexes: [
      'id',
      'newsletterId',
      'groupId',
      'authorPubkey',
      'status',
      'scheduledAt',
      '[newsletterId+status]',
      '[newsletterId+createdAt]',
      '[status+scheduledAt]',
    ],
  },
  {
    name: 'newsletterSubscribers',
    schema:
      'id, newsletterId, subscriberPubkey, status, subscribedAt, createdAt, [newsletterId+status], [newsletterId+subscriberPubkey]',
    indexes: [
      'id',
      'newsletterId',
      'subscriberPubkey',
      'status',
      '[newsletterId+status]',
      '[newsletterId+subscriberPubkey]',
    ],
  },
  {
    name: 'newsletterSends',
    schema:
      'id, issueId, newsletterId, subscriberPubkey, status, nostrEventId, sentAt, deliveredAt, createdAt, [issueId+status], [issueId+subscriberPubkey]',
    indexes: [
      'id',
      'issueId',
      'newsletterId',
      'subscriberPubkey',
      'status',
      'nostrEventId',
      '[issueId+status]',
      '[issueId+subscriberPubkey]',
    ],
  },
  {
    name: 'newsletterDeliveryQueue',
    schema:
      'id, issueId, subscriberPubkey, priority, scheduledFor, attempts, createdAt, [scheduledFor+priority]',
    indexes: [
      'id',
      'issueId',
      'subscriberPubkey',
      '[scheduledFor+priority]',
    ],
  },
];
