/**
 * Messaging Module Database Schema
 * Contains all database table definitions for the messaging module
 *
 * Note: Messages are stored in the core database (src/core/storage/db.ts)
 * This module schema is for messaging-specific data like threads, drafts, etc.
 */

import type { TableSchema } from '@/types/modules';

/**
 * Messaging module schema definition
 * Currently empty - messages are in core DB
 * Future: could add message drafts, thread metadata, etc.
 */
export const messagingSchema: TableSchema[] = [];
