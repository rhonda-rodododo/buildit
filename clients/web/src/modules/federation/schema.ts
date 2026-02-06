/**
 * Federation module Dexie schema
 *
 * Caches federation status and interactions locally for fast UI rendering.
 */

import type { TableSchema, ModuleMigration } from '@/types/modules';

export const federationSchema: TableSchema[] = [
  {
    name: 'federationConfigs',
    schema: 'nostrPubkey, username, apEnabled, atEnabled',
    indexes: ['username'],
  },
  {
    name: 'federationStatuses',
    schema: 'nostrEventId, apFederated, atFederated',
    indexes: [],
  },
  {
    name: 'federationInteractions',
    schema: '++id, targetNostrEventId, sourceProtocol, interactionType, receivedAt',
    indexes: ['targetNostrEventId', 'receivedAt'],
  },
];

export const federationMigrations: ModuleMigration[] = [];
