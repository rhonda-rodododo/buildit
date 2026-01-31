/**
 * Database Module Seed Data
 * Provides example tables, views, and records
 */

import type { ModuleSeed } from '@/types/modules';
import { dal } from '@/core/storage/dal';
import type { DBTable, DBView, DBRecord } from './schema';
import { v4 as uuid } from 'uuid';

import { logger } from '@/lib/logger';
/**
 * Seed data for database module
 */
export const databaseSeeds: ModuleSeed[] = [
  {
    name: 'sample-action-tracker',
    description: 'Action Tracker table with sample records',
    data: async (groupId, userPubkey) => {
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

      await dal.add('databaseTables', actionTrackerTable);

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

      await dal.bulkPut('customFields', tableFields);

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

      await dal.bulkPut('databaseViews', [tableView, boardView, calendarView]);

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

      await dal.bulkPut('databaseRecords', sampleRecords);

      logger.info(`Seeded Action Tracker database table with ${sampleRecords.length} records for group ${groupId}`);
    },
  },

  {
    name: 'sample-resource-library',
    description: 'Resource Library table for organizing materials',
    data: async (groupId, userPubkey) => {
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

      await dal.add('databaseTables', resourceTable);

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

      await dal.bulkPut('customFields', resourceFields);

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

      await dal.add('databaseViews', galleryView);

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

      await dal.bulkPut('databaseRecords', resources);

      logger.info(`Seeded Resource Library with ${resources.length} resources for group ${groupId}`);
    },
  },

  {
    name: 'database-editorial-calendar-demo',
    description: 'Editorial calendar database for media collective groups',
    data: async (groupId, userPubkey) => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      const calendarTable: DBTable = {
        id: `table-editorial-calendar-${groupId}`,
        groupId,
        name: 'Editorial Calendar',
        description: 'Track story assignments, deadlines, and publication schedule',
        icon: '📅',
        createdBy: userPubkey,
        created: now,
        updated: now,
      };

      await dal.add('databaseTables', calendarTable);

      const fields = [
        {
          id: `field-story-title-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: calendarTable.id,
          name: 'story_title',
          label: 'Story Title',
          schema: JSON.stringify({ type: 'string', minLength: 1, maxLength: 200 }),
          widget: JSON.stringify({ widget: 'text' }),
          order: 1,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-story-writer-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: calendarTable.id,
          name: 'assigned_writer',
          label: 'Writer',
          schema: JSON.stringify({ type: 'string' }),
          widget: JSON.stringify({ widget: 'text' }),
          order: 2,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-story-deadline-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: calendarTable.id,
          name: 'deadline',
          label: 'Deadline',
          schema: JSON.stringify({ type: 'string', format: 'date' }),
          widget: JSON.stringify({ widget: 'date' }),
          order: 3,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-story-status-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: calendarTable.id,
          name: 'status',
          label: 'Status',
          schema: JSON.stringify({
            type: 'string',
            enum: ['pitched', 'assigned', 'writing', 'editing', 'ready', 'published'],
          }),
          widget: JSON.stringify({
            widget: 'select',
            options: [
              { value: 'pitched', label: 'Pitched' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'writing', label: 'Writing' },
              { value: 'editing', label: 'In Editing' },
              { value: 'ready', label: 'Ready to Publish' },
              { value: 'published', label: 'Published' },
            ],
          }),
          order: 4,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
        {
          id: `field-story-beat-${groupId}`,
          groupId,
          entityType: 'database',
          entityId: calendarTable.id,
          name: 'beat',
          label: 'Beat',
          schema: JSON.stringify({
            type: 'string',
            enum: ['housing', 'labor', 'climate', 'police', 'immigration', 'mutual-aid', 'general'],
          }),
          widget: JSON.stringify({
            widget: 'select',
            options: [
              { value: 'housing', label: 'Housing' },
              { value: 'labor', label: 'Labor' },
              { value: 'climate', label: 'Climate' },
              { value: 'police', label: 'Police Accountability' },
              { value: 'immigration', label: 'Immigration' },
              { value: 'mutual-aid', label: 'Mutual Aid' },
              { value: 'general', label: 'General' },
            ],
          }),
          order: 5,
          created: now,
          createdBy: userPubkey,
          updated: now,
        },
      ];

      await dal.bulkPut('customFields', fields);

      // Board view grouped by status
      const boardView: DBView = {
        id: `view-editorial-board-${groupId}`,
        tableId: calendarTable.id,
        groupId,
        name: 'Pipeline',
        type: 'board',
        config: JSON.stringify({
          boardGroupBy: 'status',
          boardCardFields: ['story_title', 'assigned_writer', 'deadline', 'beat'],
        }),
        filters: JSON.stringify([]),
        sorts: JSON.stringify([{ fieldName: 'deadline', direction: 'asc' }]),
        groups: JSON.stringify([]),
        visibleFields: JSON.stringify(['story_title', 'assigned_writer', 'deadline', 'status', 'beat']),
        order: 1,
        created: now,
        createdBy: userPubkey,
        updated: now,
      };

      const calendarView: DBView = {
        id: `view-editorial-calendar-${groupId}`,
        tableId: calendarTable.id,
        groupId,
        name: 'Calendar',
        type: 'calendar',
        config: JSON.stringify({
          calendarDateField: 'deadline',
          calendarViewMode: 'month',
        }),
        filters: JSON.stringify([]),
        sorts: JSON.stringify([]),
        groups: JSON.stringify([]),
        visibleFields: JSON.stringify(['story_title', 'assigned_writer', 'deadline', 'status', 'beat']),
        order: 2,
        created: now,
        createdBy: userPubkey,
        updated: now,
      };

      await dal.bulkPut('databaseViews', [boardView, calendarView]);

      // Sample stories
      const stories: DBRecord[] = [
        {
          id: uuid(),
          tableId: calendarTable.id,
          groupId,
          customFields: JSON.stringify({
            story_title: 'Riverside Tenants: 6-Month Follow-Up',
            assigned_writer: 'Alex Martinez',
            deadline: new Date(now + 7 * day).toISOString().split('T')[0],
            status: 'writing',
            beat: 'housing',
          }),
          created: now - 3 * day,
          createdBy: userPubkey,
          updated: now - 1 * day,
          updatedBy: userPubkey,
        },
        {
          id: uuid(),
          tableId: calendarTable.id,
          groupId,
          customFields: JSON.stringify({
            story_title: 'City Budget Investigation (Part 1)',
            assigned_writer: 'Investigative Team',
            deadline: new Date(now + 14 * day).toISOString().split('T')[0],
            status: 'editing',
            beat: 'general',
          }),
          created: now - 14 * day,
          createdBy: userPubkey,
          updated: now - 2 * day,
          updatedBy: userPubkey,
        },
        {
          id: uuid(),
          tableId: calendarTable.id,
          groupId,
          customFields: JSON.stringify({
            story_title: 'Gig Workers Organizing in the App Economy',
            assigned_writer: 'Kim Nguyen',
            deadline: new Date(now + 21 * day).toISOString().split('T')[0],
            status: 'assigned',
            beat: 'labor',
          }),
          created: now - 1 * day,
          createdBy: userPubkey,
          updated: now - 1 * day,
          updatedBy: userPubkey,
        },
        {
          id: uuid(),
          tableId: calendarTable.id,
          groupId,
          customFields: JSON.stringify({
            story_title: 'Community Fridge Network Expanding',
            assigned_writer: 'Sarah Chen',
            deadline: new Date(now + 5 * day).toISOString().split('T')[0],
            status: 'ready',
            beat: 'mutual-aid',
          }),
          created: now - 7 * day,
          createdBy: userPubkey,
          updated: now,
          updatedBy: userPubkey,
        },
      ];

      await dal.bulkPut('databaseRecords', stories);

      logger.info(`Seeded Editorial Calendar with ${stories.length} stories for group ${groupId}`);
    },
  },
];
