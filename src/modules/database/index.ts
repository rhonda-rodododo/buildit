/**
 * Database Module
 * Airtable-like database with custom tables, views, and relationships
 */

import type { ModulePlugin } from '@/types/modules';
import { databaseSchema } from './schema';
import { databaseSeeds } from './seeds';
import type { BuildItDB } from '@/core/storage/db';
import { Database } from 'lucide-react';
import { EditableTableView } from './components/EditableTableView';

/**
 * Database Module Plugin
 */
export const databaseModule: ModulePlugin = {
  metadata: {
    id: 'database',
    type: 'documents',
    name: 'Database',
    description: 'Airtable-like database with custom tables, views, and relationships',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: Database,
    capabilities: [
      {
        id: 'table-management',
        name: 'Table Management',
        description: 'Create and manage custom database tables',
        requiresPermission: ['admin', 'moderator'],
      },
      {
        id: 'record-management',
        name: 'Record Management',
        description: 'Create, edit, and delete records',
        requiresPermission: ['member', 'all'],
      },
      {
        id: 'view-management',
        name: 'View Management',
        description: 'Create and customize views',
        requiresPermission: ['member', 'all'],
      },
    ],
    configSchema: [
      {
        key: 'maxTablesPerGroup',
        label: 'Max Tables Per Group',
        type: 'number',
        defaultValue: 50,
        description: 'Maximum number of tables per group',
      },
      {
        key: 'maxRecordsPerTable',
        label: 'Max Records Per Table',
        type: 'number',
        defaultValue: 10000,
        description: 'Maximum number of records per table',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onRegister: async () => {
      console.log('Database module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.log(`Database module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.log(`Database module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'database',
      component: EditableTableView,
      scope: 'group',
      requiresEnabled: true,
      label: 'Database',
    },
  ],

  schema: databaseSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial database schema',
      migrate: async (_db: BuildItDB) => {
        console.log('Database migration v1: Initial schema');
      },
    },
  ],

  seeds: databaseSeeds,

  getDefaultConfig: () => ({
    maxTablesPerGroup: 50,
    maxRecordsPerTable: 10000,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.maxTablesPerGroup !== 'number') return false;
    if (typeof config.maxRecordsPerTable !== 'number') return false;
    if (config.maxTablesPerGroup < 1 || config.maxTablesPerGroup > 100) return false;
    if (config.maxRecordsPerTable < 1 || config.maxRecordsPerTable > 100000) return false;
    return true;
  },
};

export default databaseModule;
