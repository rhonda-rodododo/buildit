/**
 * Database Module Seed Data
 * Provides example tables, views, and records
 */

import type { ModuleSeed } from '@/types/modules';
import type { DBTable, DBView, DBRecord } from './schema';
import { v4 as uuid } from 'uuid';

/**
 * Seed data for database module
 */
export const databaseSeeds: ModuleSeed[] = [
  {
    name: 'sample-action-tracker',
    description: 'Action Tracker table with sample records',
    data: async (db, groupId, userPubkey) => {
      const now = Date.now();

      // Create Action Tracker table
      const actionTrackerTable: DBTable = {
        id: `table-action-tracker-${groupId}`,
        groupId,
        name: 'Action Tracker',
        description: 'Track direct actions, protests, and campaign activities',
        icon: '✊',
        createdBy: userPubkey,
        created: now,
        updated: now,
      };

      await db.databaseTables?.add(actionTrackerTable);

      // Create custom fields for this table
      const tableFields = [
        {
          id: `field-action-name-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: actionTrackerTable.id,
          name: 'action_name',
          label: 'Action Name',
          schema: JSON.stringify({
            type: 'string',
            title: 'Action Name',
            minLength: 1,
            maxLength: 200,
          }),
          widget: JSON.stringify({
            widget: 'text',
          }),
          order: 1,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-action-date-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: actionTrackerTable.id,
          name: 'action_date',
          label: 'Action Date',
          schema: JSON.stringify({
            type: 'string',
            format: 'date',
            title: 'Action Date',
          }),
          widget: JSON.stringify({
            widget: 'date',
          }),
          order: 2,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-action-type-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: actionTrackerTable.id,
          name: 'action_type',
          label: 'Action Type',
          schema: JSON.stringify({
            type: 'string',
            enum: ['protest', 'direct-action', 'march', 'sit-in', 'blockade', 'strike', 'boycott'],
          }),
          widget: JSON.stringify({
            widget: 'select',
            options: [
              { value: 'protest', label: 'Protest' },
              { value: 'direct-action', label: 'Direct Action' },
              { value: 'march', label: 'March' },
              { value: 'sit-in', label: 'Sit-In' },
              { value: 'blockade', label: 'Blockade' },
              { value: 'strike', label: 'Strike' },
              { value: 'boycott', label: 'Boycott' },
            ],
          }),
          order: 3,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-action-status-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: actionTrackerTable.id,
          name: 'status',
          label: 'Status',
          schema: JSON.stringify({
            type: 'string',
            enum: ['planning', 'confirmed', 'in-progress', 'completed', 'cancelled'],
          }),
          widget: JSON.stringify({
            widget: 'select',
            options: [
              { value: 'planning', label: 'Planning' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'in-progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          }),
          order: 4,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-action-participants-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: actionTrackerTable.id,
          name: 'estimated_participants',
          label: 'Estimated Participants',
          schema: JSON.stringify({
            type: 'number',
            minimum: 0,
          }),
          widget: JSON.stringify({
            widget: 'number',
          }),
          order: 5,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-action-notes-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: actionTrackerTable.id,
          name: 'notes',
          label: 'Notes',
          schema: JSON.stringify({
            type: 'string',
            title: 'Notes',
          }),
          widget: JSON.stringify({
            widget: 'textarea',
          }),
          order: 6,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
      ];

      await db.customFields?.bulkAdd(tableFields);

      // Create views
      const tableView: DBView = {
        id: `view-table-${groupId}`,
        tableId: actionTrackerTable.id,
        groupId,
        name: 'All Actions',
        type: 'table',
        config: JSON.stringify({
          columnWidths: { action_name: 200, action_date: 120, action_type: 150, status: 120 },
          columnOrder: ['action_name', 'action_date', 'action_type', 'status', 'estimated_participants', 'notes'],
        }),
        filters: JSON.stringify([]),
        sorts: JSON.stringify([{ fieldName: 'action_date', direction: 'asc' }]),
        groups: JSON.stringify([]),
        visibleFields: JSON.stringify(['action_name', 'action_date', 'action_type', 'status', 'estimated_participants', 'notes']),
        order: 1,
        created: now,
        createdBy: userPubkey,
        updated: now,
      };

      const boardView: DBView = {
        id: `view-board-${groupId}`,
        tableId: actionTrackerTable.id,
        groupId,
        name: 'Status Board',
        type: 'board',
        config: JSON.stringify({
          boardGroupBy: 'status',
          boardCardFields: ['action_name', 'action_date', 'action_type', 'estimated_participants'],
        }),
        filters: JSON.stringify([]),
        sorts: JSON.stringify([{ fieldName: 'action_date', direction: 'asc' }]),
        groups: JSON.stringify([]),
        visibleFields: JSON.stringify(['action_name', 'action_date', 'action_type', 'status', 'estimated_participants']),
        order: 2,
        created: now,
        createdBy: userPubkey,
        updated: now,
      };

      const calendarView: DBView = {
        id: `view-calendar-${groupId}`,
        tableId: actionTrackerTable.id,
        groupId,
        name: 'Calendar View',
        type: 'calendar',
        config: JSON.stringify({
          calendarDateField: 'action_date',
          calendarViewMode: 'month',
        }),
        filters: JSON.stringify([]),
        sorts: JSON.stringify([]),
        groups: JSON.stringify([]),
        visibleFields: JSON.stringify(['action_name', 'action_date', 'action_type', 'status']),
        order: 3,
        created: now,
        createdBy: userPubkey,
        updated: now,
      };

      await db.databaseViews?.bulkAdd([tableView, boardView, calendarView]);

      // Create sample records
      const sampleRecords: DBRecord[] = [
        {
          id: uuid(),
          tableId: actionTrackerTable.id,
          groupId,
          customFields: JSON.stringify({
            action_name: 'Housing Rights Rally',
            action_date: new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            action_type: 'protest',
            status: 'confirmed',
            estimated_participants: 200,
            notes: 'Rally at City Hall to demand rent control and tenant protections',
          }),
          created: now,
          createdBy: userPubkey,
          updated: now,
          updatedBy: userPubkey,
        },
        {
          id: uuid(),
          tableId: actionTrackerTable.id,
          groupId,
          customFields: JSON.stringify({
            action_name: 'Eviction Defense Direct Action',
            action_date: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            action_type: 'direct-action',
            status: 'planning',
            estimated_participants: 50,
            notes: 'Prevent eviction of single mother with 3 kids. Legal support and jail support on standby.',
          }),
          created: now,
          createdBy: userPubkey,
          updated: now,
          updatedBy: userPubkey,
        },
        {
          id: uuid(),
          tableId: actionTrackerTable.id,
          groupId,
          customFields: JSON.stringify({
            action_name: 'Climate Justice March',
            action_date: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            action_type: 'march',
            status: 'completed',
            estimated_participants: 500,
            notes: 'Successful march with 500+ participants. Good media coverage.',
          }),
          created: now - 30 * 24 * 60 * 60 * 1000,
          createdBy: userPubkey,
          updated: now - 30 * 24 * 60 * 60 * 1000,
          updatedBy: userPubkey,
        },
      ];

      await db.databaseRecords?.bulkAdd(sampleRecords);

      console.log(`Seeded Action Tracker database table with ${sampleRecords.length} records for group ${groupId}`);
    },
  },

  {
    name: 'sample-resource-library',
    description: 'Resource Library table for organizing materials',
    data: async (db, groupId, userPubkey) => {
      const now = Date.now();

      // Create Resource Library table
      const resourceTable: DBTable = {
        id: `table-resources-${groupId}`,
        groupId,
        name: 'Resource Library',
        description: 'Collection of organizing resources, guides, and materials',
        icon: '📚',
        createdBy: userPubkey,
        created: now,
        updated: now,
      };

      await db.databaseTables?.add(resourceTable);

      // Create custom fields
      const resourceFields = [
        {
          id: `field-resource-title-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: resourceTable.id,
          name: 'title',
          label: 'Resource Title',
          schema: JSON.stringify({
            type: 'string',
            minLength: 1,
            maxLength: 200,
          }),
          widget: JSON.stringify({ widget: 'text' }),
          order: 1,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-resource-type-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: resourceTable.id,
          name: 'resource_type',
          label: 'Type',
          schema: JSON.stringify({
            type: 'string',
            enum: ['guide', 'template', 'article', 'video', 'book', 'toolkit'],
          }),
          widget: JSON.stringify({
            widget: 'select',
            options: [
              { value: 'guide', label: 'Guide' },
              { value: 'template', label: 'Template' },
              { value: 'article', label: 'Article' },
              { value: 'video', label: 'Video' },
              { value: 'book', label: 'Book' },
              { value: 'toolkit', label: 'Toolkit' },
            ],
          }),
          order: 2,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-resource-category-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: resourceTable.id,
          name: 'category',
          label: 'Category',
          schema: JSON.stringify({
            type: 'array',
            items: { type: 'string' },
          }),
          widget: JSON.stringify({
            widget: 'multi-select',
            options: [
              { value: 'organizing', label: 'Organizing' },
              { value: 'legal', label: 'Legal' },
              { value: 'security', label: 'Security' },
              { value: 'media', label: 'Media' },
              { value: 'fundraising', label: 'Fundraising' },
              { value: 'coalition', label: 'Coalition Building' },
            ],
          }),
          order: 3,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-resource-link-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: resourceTable.id,
          name: 'link',
          label: 'Link',
          schema: JSON.stringify({
            type: 'string',
            format: 'uri',
          }),
          widget: JSON.stringify({ widget: 'url' }),
          order: 4,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-resource-description-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: resourceTable.id,
          name: 'description',
          label: 'Description',
          schema: JSON.stringify({
            type: 'string',
          }),
          widget: JSON.stringify({ widget: 'textarea' }),
          order: 5,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
      ];

      await db.customFields?.bulkAdd(resourceFields);

      // Create gallery view for resources
      const galleryView: DBView = {
        id: `view-resource-gallery-${groupId}`,
        tableId: resourceTable.id,
        groupId,
        name: 'Resource Gallery',
        type: 'gallery',
        config: JSON.stringify({
          galleryTitleField: 'title',
          galleryDescriptionField: 'description',
          galleryColumns: 3,
        }),
        filters: JSON.stringify([]),
        sorts: JSON.stringify([]),
        groups: JSON.stringify([]),
        visibleFields: JSON.stringify(['title', 'resource_type', 'category', 'link', 'description']),
        order: 1,
        created: now,
        createdBy: userPubkey,
        updated: now,
      };

      await db.databaseViews?.add(galleryView);

      // Sample resource records
      const resources: DBRecord[] = [
        {
          id: uuid(),
          tableId: resourceTable.id,
          groupId,
          customFields: JSON.stringify({
            title: 'Know Your Rights Guide',
            resource_type: 'guide',
            category: ['legal', 'organizing'],
            link: 'https://nlg.org',
            description: 'Comprehensive guide on legal rights for activists and protesters',
          }),
          created: now,
          createdBy: userPubkey,
          updated: now,
          updatedBy: userPubkey,
        },
        {
          id: uuid(),
          tableId: resourceTable.id,
          groupId,
          customFields: JSON.stringify({
            title: 'Digital Security Toolkit',
            resource_type: 'toolkit',
            category: ['security', 'organizing'],
            link: 'https://ssd.eff.org',
            description: 'EFF\'s surveillance self-defense guide for activists',
          }),
          created: now,
          createdBy: userPubkey,
          updated: now,
          updatedBy: userPubkey,
        },
        {
          id: uuid(),
          tableId: resourceTable.id,
          groupId,
          customFields: JSON.stringify({
            title: 'Rules for Radicals',
            resource_type: 'book',
            category: ['organizing'],
            link: '',
            description: 'Classic organizing manual by Saul Alinsky',
          }),
          created: now,
          createdBy: userPubkey,
          updated: now,
          updatedBy: userPubkey,
        },
      ];

      await db.databaseRecords?.bulkAdd(resources);

      console.log(`Seeded Resource Library with ${resources.length} resources for group ${groupId}`);
    },
  },
];
