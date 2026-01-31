/**
 * Database Module Manager
 * Business logic for database operations
 */

import { dal } from '@/core/storage/dal';
import type {
  DatabaseTable,
  DatabaseView,
  DatabaseRecord,
  DatabaseRelationship,
  FilterRule,
  SortRule,
  RecordActivity,
  RecordActivityType,
  RecordActivityData,
  RecordComment,
  RecordAttachment,
  FieldChangeActivityData,
} from './types';
import type {
  DBTable,
  DBView,
  DBRecord,
  DBRelationship,
  DBRecordActivity,
  DBRecordComment,
  DBRecordAttachment,
} from './schema';
import { useDatabaseStore } from './databaseStore';
import type { CustomField } from '../custom-fields/types';
import { logger } from '@/lib/logger';

export class DatabaseManager {
  /**
   * Create a new table
   */
  async createTable(
    groupId: string,
    userPubkey: string,
    name: string,
    description?: string,
    icon?: string
  ): Promise<DatabaseTable> {
    const now = Date.now();
    const id = crypto.randomUUID();

    const table: DatabaseTable = {
      id,
      groupId,
      name,
      description,
      icon,
      fields: [],
      created: now,
      createdBy: userPubkey,
      updated: now,
    };

    // Save to DB
    const dbTable: DBTable = {
      id: table.id,
      groupId: table.groupId,
      name: table.name,
      description: table.description,
      icon: table.icon,
      createdBy: table.createdBy,
      created: table.created,
      updated: table.updated,
    };

    try {
      await dal.add<DBTable>('databaseTables', dbTable);
    } catch {
      // Table might not exist yet
    }

    // Add to store
    useDatabaseStore.getState().addTable(table);

    // Create default table view
    await this.createView(table.id, groupId, userPubkey, 'All Records', 'table');

    return table;
  }

  /**
   * Update a table
   */
  async updateTable(
    id: string,
    updates: Partial<Pick<DatabaseTable, 'name' | 'description' | 'icon' | 'formLayout' | 'detailConfig'>>
  ): Promise<void> {
    const now = Date.now();

    // Prepare DB updates - serialize JSON fields
    const dbUpdates: Record<string, unknown> = { updated: now };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    if (updates.formLayout !== undefined) {
      dbUpdates.formLayout = JSON.stringify(updates.formLayout);
    }
    if (updates.detailConfig !== undefined) {
      dbUpdates.detailConfig = JSON.stringify(updates.detailConfig);
    }

    await dal.update<DBTable>('databaseTables', id, dbUpdates);

    useDatabaseStore.getState().updateTable(id, { ...updates, updated: now });
  }

  /**
   * Delete a table
   */
  async deleteTable(id: string): Promise<void> {
    // Delete all records in this table
    const records = useDatabaseStore.getState().getRecordsByTable(id);
    for (const record of records) {
      await this.deleteRecord(record.id, id);
    }

    // Delete all views for this table
    const views = useDatabaseStore.getState().getViewsByTable(id);
    for (const view of views) {
      await this.deleteView(view.id);
    }

    // Delete all relationships involving this table
    const relationships = useDatabaseStore.getState().getRelationshipsByTable(id);
    for (const rel of relationships) {
      await this.deleteRelationship(rel.id);
    }

    // Delete the table
    await dal.delete('databaseTables', id);
    useDatabaseStore.getState().deleteTable(id);
  }

  /**
   * Add field to table
   */
  async addFieldToTable(tableId: string, field: CustomField): Promise<void> {
    const table = useDatabaseStore.getState().getTable(tableId);
    if (!table) throw new Error('Table not found');

    const updatedFields = [...table.fields, field];
    useDatabaseStore.getState().updateTable(tableId, { fields: updatedFields });
  }

  /**
   * Remove field from table
   */
  async removeFieldFromTable(tableId: string, fieldId: string): Promise<void> {
    const table = useDatabaseStore.getState().getTable(tableId);
    if (!table) throw new Error('Table not found');

    const updatedFields = table.fields.filter((f) => f.id !== fieldId);
    useDatabaseStore.getState().updateTable(tableId, { fields: updatedFields });

    // Remove field values from all records
    const records = useDatabaseStore.getState().getRecordsByTable(tableId);
    for (const record of records) {
      const updatedCustomFields = { ...record.customFields };
      delete updatedCustomFields[fieldId];
      await this.updateRecord(record.id, tableId, { customFields: updatedCustomFields });
    }
  }

  /**
   * Create a new view
   */
  async createView(
    tableId: string,
    groupId: string,
    userPubkey: string,
    name: string,
    type: DatabaseView['type']
  ): Promise<DatabaseView> {
    const now = Date.now();
    const id = crypto.randomUUID();

    // Get all existing views for this table to determine order
    const existingViews = useDatabaseStore.getState().getViewsByTable(tableId);
    const order = existingViews.length;

    const view: DatabaseView = {
      id,
      tableId,
      groupId,
      name,
      type,
      config: {},
      filters: [],
      sorts: [],
      groups: [],
      visibleFields: [],
      order,
      created: now,
      createdBy: userPubkey,
      updated: now,
    };

    // Save to DB
    const dbView: DBView = {
      id: view.id,
      tableId: view.tableId,
      groupId: view.groupId,
      name: view.name,
      type: view.type,
      config: JSON.stringify(view.config),
      filters: JSON.stringify(view.filters),
      sorts: JSON.stringify(view.sorts),
      groups: JSON.stringify(view.groups),
      visibleFields: JSON.stringify(view.visibleFields),
      order: view.order,
      created: view.created,
      createdBy: view.createdBy,
      updated: view.updated,
    };

    try {
      await dal.add<DBView>('databaseViews', dbView);
    } catch {
      // Table might not exist yet
    }
    useDatabaseStore.getState().addView(view);

    return view;
  }

  /**
   * Update a view
   */
  async updateView(id: string, updates: Partial<DatabaseView>): Promise<void> {
    const now = Date.now();

    const dbUpdates: Partial<DBView> = {
      ...updates,
      config: updates.config ? JSON.stringify(updates.config) : undefined,
      filters: updates.filters ? JSON.stringify(updates.filters) : undefined,
      sorts: updates.sorts ? JSON.stringify(updates.sorts) : undefined,
      groups: updates.groups ? JSON.stringify(updates.groups) : undefined,
      visibleFields: updates.visibleFields ? JSON.stringify(updates.visibleFields) : undefined,
      updated: now,
    };

    await dal.update<DBView>('databaseViews', id, dbUpdates);
    useDatabaseStore.getState().updateView(id, { ...updates, updated: now });
  }

  /**
   * Delete a view
   */
  async deleteView(id: string): Promise<void> {
    await dal.delete('databaseViews', id);
    useDatabaseStore.getState().deleteView(id);
  }

  /**
   * Create a new record
   */
  async createRecord(
    tableId: string,
    groupId: string,
    userPubkey: string,
    customFields: Record<string, unknown>
  ): Promise<DatabaseRecord> {
    const now = Date.now();
    const id = crypto.randomUUID();

    const record: DatabaseRecord = {
      id,
      tableId,
      groupId,
      customFields,
      created: now,
      createdBy: userPubkey,
      updated: now,
      updatedBy: userPubkey,
    };

    // Save to DB
    const dbRecord: DBRecord = {
      id: record.id,
      tableId: record.tableId,
      groupId: record.groupId,
      customFields: JSON.stringify(record.customFields),
      created: record.created,
      createdBy: record.createdBy,
      updated: record.updated,
      updatedBy: record.updatedBy,
    };

    try {
      await dal.add<DBRecord>('databaseRecords', dbRecord);
    } catch {
      // Table might not exist yet
    }
    useDatabaseStore.getState().addRecord(record);

    return record;
  }

  /**
   * Update a record
   */
  async updateRecord(
    id: string,
    tableId: string,
    updates: Partial<Pick<DatabaseRecord, 'customFields'>>
  ): Promise<void> {
    const now = Date.now();

    const dbUpdates = {
      customFields: updates.customFields ? JSON.stringify(updates.customFields) : undefined,
      updated: now,
    };

    await dal.update<DBRecord>('databaseRecords', id, dbUpdates);
    useDatabaseStore.getState().updateRecord(id, tableId, { ...updates, updated: now });
  }

  /**
   * Delete a record
   */
  async deleteRecord(id: string, tableId: string): Promise<void> {
    await dal.delete('databaseRecords', id);
    useDatabaseStore.getState().deleteRecord(id, tableId);
  }

  /**
   * Filter records based on filter rules
   */
  filterRecords(records: DatabaseRecord[], filters: FilterRule[]): DatabaseRecord[] {
    if (filters.length === 0) return records;

    return records.filter((record) => {
      return filters.every((filter) => {
        const value = record.customFields[filter.fieldName];

        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'not-equals':
            return value !== filter.value;
          case 'contains':
            return String(value).includes(String(filter.value));
          case 'not-contains':
            return !String(value).includes(String(filter.value));
          case 'starts-with':
            return String(value).startsWith(String(filter.value));
          case 'ends-with':
            return String(value).endsWith(String(filter.value));
          case 'is-empty':
            return value === null || value === undefined || value === '';
          case 'is-not-empty':
            return value !== null && value !== undefined && value !== '';
          case 'greater-than':
            return Number(value) > Number(filter.value);
          case 'less-than':
            return Number(value) < Number(filter.value);
          case 'greater-or-equal':
            return Number(value) >= Number(filter.value);
          case 'less-or-equal':
            return Number(value) <= Number(filter.value);
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value);
          case 'not-in':
            return Array.isArray(filter.value) && !filter.value.includes(value);
          default:
            return true;
        }
      });
    });
  }

  /**
   * Sort records based on sort rules
   */
  sortRecords(records: DatabaseRecord[], sorts: SortRule[]): DatabaseRecord[] {
    if (sorts.length === 0) return records;

    return [...records].sort((a, b) => {
      for (const sort of sorts) {
        const aValue = a.customFields[sort.fieldName];
        const bValue = b.customFields[sort.fieldName];

        const comparison =
          aValue === bValue ? 0 : (aValue as number | string) > (bValue as number | string) ? 1 : -1;

        if (comparison !== 0) {
          return sort.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Load tables for a group
   */
  async loadTablesForGroup(groupId: string): Promise<void> {
    const dbTables = await dal.query<DBTable>('databaseTables', {
      whereClause: { groupId },
    });

    for (const dbTable of dbTables) {
      const table: DatabaseTable = {
        id: dbTable.id,
        groupId: dbTable.groupId,
        name: dbTable.name,
        description: dbTable.description,
        icon: dbTable.icon,
        fields: [], // Will be populated from custom fields
        formLayout: dbTable.formLayout ? JSON.parse(dbTable.formLayout) : undefined,
        detailConfig: dbTable.detailConfig ? JSON.parse(dbTable.detailConfig) : undefined,
        created: dbTable.created,
        createdBy: dbTable.createdBy,
        updated: dbTable.updated,
      };

      useDatabaseStore.getState().addTable(table);
    }
  }

  /**
   * Load views for a table
   */
  async loadViewsForTable(tableId: string): Promise<void> {
    const dbViews = await dal.query<DBView>('databaseViews', {
      whereClause: { tableId },
    });

    for (const dbView of dbViews) {
      const view: DatabaseView = {
        id: dbView.id,
        tableId: dbView.tableId,
        groupId: dbView.groupId,
        name: dbView.name,
        type: dbView.type as DatabaseView['type'],
        config: JSON.parse(dbView.config),
        filters: JSON.parse(dbView.filters),
        sorts: JSON.parse(dbView.sorts),
        groups: JSON.parse(dbView.groups),
        visibleFields: JSON.parse(dbView.visibleFields),
        order: dbView.order,
        created: dbView.created,
        createdBy: dbView.createdBy,
        updated: dbView.updated,
      };

      useDatabaseStore.getState().addView(view);
    }
  }

  /**
   * Load records for a table
   */
  async loadRecordsForTable(tableId: string): Promise<void> {
    const dbRecords = await dal.query<DBRecord>('databaseRecords', {
      whereClause: { tableId },
    });

    for (const dbRecord of dbRecords) {
      const record: DatabaseRecord = {
        id: dbRecord.id,
        tableId: dbRecord.tableId,
        groupId: dbRecord.groupId,
        customFields: JSON.parse(dbRecord.customFields),
        created: dbRecord.created,
        createdBy: dbRecord.createdBy,
        updated: dbRecord.updated,
        updatedBy: dbRecord.updatedBy,
      };

      useDatabaseStore.getState().addRecord(record);
    }
  }

  /**
   * Create a relationship between tables
   */
  async createRelationship(
    groupId: string,
    userPubkey: string,
    sourceTableId: string,
    sourceFieldName: string,
    targetTableId: string,
    targetFieldName: string,
    type: DatabaseRelationship['type'],
    onDelete: DatabaseRelationship['onDelete']
  ): Promise<DatabaseRelationship> {
    const now = Date.now();
    const id = crypto.randomUUID();

    const relationship: DatabaseRelationship = {
      id,
      groupId,
      sourceTableId,
      sourceFieldName,
      targetTableId,
      targetFieldName,
      type,
      onDelete,
      created: now,
      createdBy: userPubkey,
    };

    // Save to DB
    const dbRelationship: DBRelationship = {
      id: relationship.id,
      groupId: relationship.groupId,
      sourceTableId: relationship.sourceTableId,
      sourceFieldName: relationship.sourceFieldName,
      targetTableId: relationship.targetTableId,
      targetFieldName: relationship.targetFieldName,
      type: relationship.type,
      onDelete: relationship.onDelete,
      created: relationship.created,
      createdBy: relationship.createdBy,
    };

    try {
      await dal.add<DBRelationship>('databaseRelationships', dbRelationship);
    } catch {
      // Table might not exist yet
    }
    useDatabaseStore.getState().addRelationship(relationship);

    return relationship;
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(id: string): Promise<void> {
    await dal.delete('databaseRelationships', id);
    useDatabaseStore.getState().deleteRelationship(id);
  }

  // ============================================
  // Activity/Timeline Methods
  // ============================================

  /**
   * Log an activity for a record
   */
  async logActivity(
    recordId: string,
    tableId: string,
    groupId: string,
    type: RecordActivityType,
    data: RecordActivityData,
    actorPubkey: string
  ): Promise<RecordActivity> {
    const now = Date.now();
    const id = crypto.randomUUID();

    const activity: RecordActivity = {
      id,
      recordId,
      tableId,
      groupId,
      type,
      actorPubkey,
      data,
      createdAt: now,
    };

    // Save to DB
    const dbActivity: DBRecordActivity = {
      id: activity.id,
      recordId: activity.recordId,
      tableId: activity.tableId,
      groupId: activity.groupId,
      type: activity.type,
      actorPubkey: activity.actorPubkey,
      data: JSON.stringify(activity.data),
      createdAt: activity.createdAt,
    };

    try {
      await dal.add<DBRecordActivity>('databaseRecordActivities', dbActivity);
      useDatabaseStore.getState().addActivity(activity);
    } catch (error) {
      logger.error('Failed to log activity:', error);
    }

    return activity;
  }

  /**
   * Get activities for a record
   */
  async getRecordActivities(
    recordId: string,
    tableId: string,
    limit?: number
  ): Promise<RecordActivity[]> {
    try {
      const dbActivities = await dal.queryCustom<DBRecordActivity>({
        sql: 'SELECT * FROM database_record_activities WHERE record_id = ?1 AND table_id = ?2 ORDER BY created_at DESC' + (limit ? ` LIMIT ${limit}` : ''),
        params: [recordId, tableId],
        dexieFallback: async (db) => {
          let query = db
            .table('databaseRecordActivities')
            .where('[recordId+tableId]')
            .equals([recordId, tableId])
            .reverse();

          if (limit) {
            query = query.limit(limit);
          }

          return query.toArray();
        },
      });

      const activities: RecordActivity[] = dbActivities.map((dbActivity: DBRecordActivity) => ({
        id: dbActivity.id,
        recordId: dbActivity.recordId,
        tableId: dbActivity.tableId,
        groupId: dbActivity.groupId,
        type: dbActivity.type as RecordActivityType,
        actorPubkey: dbActivity.actorPubkey,
        data: JSON.parse(dbActivity.data),
        createdAt: dbActivity.createdAt,
      }));

      return activities;
    } catch (error) {
      logger.error('Failed to get record activities:', error);
      return [];
    }
  }

  // ============================================
  // Comment Methods
  // ============================================

  /**
   * Add a comment to a record
   */
  async addRecordComment(
    recordId: string,
    tableId: string,
    groupId: string,
    content: string,
    authorPubkey: string,
    parentId?: string
  ): Promise<RecordComment | null> {
    const now = Date.now();
    const id = crypto.randomUUID();

    const comment: RecordComment = {
      id,
      recordId,
      tableId,
      groupId,
      authorPubkey,
      content,
      parentId,
      createdAt: now,
      updatedAt: now,
    };

    // Save to DB
    const dbComment: DBRecordComment = {
      id: comment.id,
      recordId: comment.recordId,
      tableId: comment.tableId,
      groupId: comment.groupId,
      authorPubkey: comment.authorPubkey,
      content: comment.content,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };

    try {
      await dal.add<DBRecordComment>('databaseRecordComments', dbComment);
      useDatabaseStore.getState().addComment(comment);

      // Log activity
      await this.logActivity(recordId, tableId, groupId, 'comment', {
        commentId: comment.id,
        contentPreview: content.substring(0, 100),
        isReply: !!parentId,
        parentCommentId: parentId,
      }, authorPubkey);

      return comment;
    } catch (error) {
      logger.error('Failed to add comment:', error);
      return null;
    }
  }

  /**
   * Update a comment
   */
  async updateRecordComment(
    commentId: string,
    content: string
  ): Promise<boolean> {
    const now = Date.now();

    try {
      await dal.update<DBRecordComment>('databaseRecordComments', commentId, {
        content,
        updatedAt: now,
      });
      useDatabaseStore.getState().updateComment(commentId, { content, updatedAt: now });
      return true;
    } catch (error) {
      logger.error('Failed to update comment:', error);
      return false;
    }
  }

  /**
   * Delete a comment
   */
  async deleteRecordComment(commentId: string): Promise<boolean> {
    try {
      await dal.delete('databaseRecordComments', commentId);
      useDatabaseStore.getState().deleteComment(commentId);
      return true;
    } catch (error) {
      logger.error('Failed to delete comment:', error);
      return false;
    }
  }

  /**
   * Get comments for a record
   */
  async getRecordComments(recordId: string, _tableId: string): Promise<RecordComment[]> {
    try {
      const dbComments = await dal.query<DBRecordComment>('databaseRecordComments', {
        whereClause: { recordId },
      });

      const comments: RecordComment[] = dbComments.map((dbComment: DBRecordComment) => ({
        id: dbComment.id,
        recordId: dbComment.recordId,
        tableId: dbComment.tableId,
        groupId: dbComment.groupId,
        authorPubkey: dbComment.authorPubkey,
        content: dbComment.content,
        parentId: dbComment.parentId,
        createdAt: dbComment.createdAt,
        updatedAt: dbComment.updatedAt,
      }));

      // Build threaded structure
      const rootComments: RecordComment[] = [];
      const commentMap = new Map<string, RecordComment>();

      // First pass: create map
      for (const comment of comments) {
        comment.replies = [];
        commentMap.set(comment.id, comment);
      }

      // Second pass: build tree
      for (const comment of comments) {
        if (comment.parentId && commentMap.has(comment.parentId)) {
          const parent = commentMap.get(comment.parentId)!;
          parent.replies = parent.replies || [];
          parent.replies.push(comment);
        } else {
          rootComments.push(comment);
        }
      }

      // Sort by created time (oldest first within each level)
      const sortByCreated = (a: RecordComment, b: RecordComment) => a.createdAt - b.createdAt;
      rootComments.sort(sortByCreated);
      for (const comment of commentMap.values()) {
        comment.replies?.sort(sortByCreated);
      }

      return rootComments;
    } catch (error) {
      logger.error('Failed to get record comments:', error);
      return [];
    }
  }

  // ============================================
  // Attachment Methods
  // ============================================

  /**
   * Attach a file to a record
   */
  async attachFileToRecord(
    recordId: string,
    tableId: string,
    groupId: string,
    fileId: string,
    userPubkey: string,
    fileInfo?: { fileName?: string; fileType?: string; fileSize?: number }
  ): Promise<RecordAttachment | null> {
    const now = Date.now();
    const id = crypto.randomUUID();

    const attachment: RecordAttachment = {
      id,
      recordId,
      tableId,
      groupId,
      fileId,
      fileName: fileInfo?.fileName,
      fileType: fileInfo?.fileType,
      fileSize: fileInfo?.fileSize,
      addedBy: userPubkey,
      addedAt: now,
    };

    // Save to DB
    const dbAttachment: DBRecordAttachment = {
      id: attachment.id,
      recordId: attachment.recordId,
      tableId: attachment.tableId,
      groupId: attachment.groupId,
      fileId: attachment.fileId,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      addedBy: attachment.addedBy,
      addedAt: attachment.addedAt,
    };

    try {
      await dal.add<DBRecordAttachment>('databaseRecordAttachments', dbAttachment);
      useDatabaseStore.getState().addAttachment(attachment);

      // Log activity
      await this.logActivity(recordId, tableId, groupId, 'attachment_added', {
        attachmentId: attachment.id,
        fileId,
        fileName: fileInfo?.fileName || 'Unknown file',
        fileType: fileInfo?.fileType,
        fileSize: fileInfo?.fileSize,
      }, userPubkey);

      return attachment;
    } catch (error) {
      logger.error('Failed to attach file:', error);
      return null;
    }
  }

  /**
   * Detach a file from a record
   */
  async detachFileFromRecord(
    attachmentId: string,
    recordId: string,
    tableId: string,
    groupId: string,
    userPubkey: string
  ): Promise<boolean> {
    try {
      // Get attachment info before deleting for activity log
      const attachment = useDatabaseStore.getState().getAttachment(attachmentId);

      await dal.delete('databaseRecordAttachments', attachmentId);
      useDatabaseStore.getState().deleteAttachment(attachmentId);

      // Log activity
      if (attachment) {
        await this.logActivity(recordId, tableId, groupId, 'attachment_removed', {
          attachmentId,
          fileId: attachment.fileId,
          fileName: attachment.fileName || 'Unknown file',
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
        }, userPubkey);
      }

      return true;
    } catch (error) {
      logger.error('Failed to detach file:', error);
      return false;
    }
  }

  /**
   * Get attachments for a record
   */
  async getRecordAttachments(recordId: string, _tableId: string): Promise<RecordAttachment[]> {
    try {
      const dbAttachments = await dal.query<DBRecordAttachment>('databaseRecordAttachments', {
        whereClause: { recordId },
      });

      const attachments: RecordAttachment[] = dbAttachments.map((dbAttachment: DBRecordAttachment) => ({
        id: dbAttachment.id,
        recordId: dbAttachment.recordId,
        tableId: dbAttachment.tableId,
        groupId: dbAttachment.groupId,
        fileId: dbAttachment.fileId,
        fileName: dbAttachment.fileName,
        fileType: dbAttachment.fileType,
        fileSize: dbAttachment.fileSize,
        addedBy: dbAttachment.addedBy,
        addedAt: dbAttachment.addedAt,
      }));

      return attachments;
    } catch (error) {
      logger.error('Failed to get record attachments:', error);
      return [];
    }
  }

  // ============================================
  // Enhanced Record Methods (with activity logging)
  // ============================================

  /**
   * Create a new record with activity logging
   */
  async createRecordWithActivity(
    tableId: string,
    groupId: string,
    userPubkey: string,
    customFields: Record<string, unknown>
  ): Promise<DatabaseRecord> {
    const record = await this.createRecord(tableId, groupId, userPubkey, customFields);

    // Log activity
    await this.logActivity(record.id, tableId, groupId, 'created', {
      fieldsSet: Object.keys(customFields),
    }, userPubkey);

    return record;
  }

  /**
   * Update a record with activity logging for field changes
   */
  async updateRecordWithActivity(
    id: string,
    tableId: string,
    groupId: string,
    updates: Partial<Pick<DatabaseRecord, 'customFields'>>,
    userPubkey: string,
    table?: DatabaseTable
  ): Promise<void> {
    const currentRecord = useDatabaseStore.getState().getRecord(id, tableId);
    if (!currentRecord) {
      throw new Error('Record not found');
    }

    // Detect field changes
    const fieldChanges: FieldChangeActivityData[] = [];
    if (updates.customFields) {
      for (const [fieldName, newValue] of Object.entries(updates.customFields)) {
        const oldValue = currentRecord.customFields[fieldName];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          const field = table?.fields.find((f) => f.name === fieldName);
          fieldChanges.push({
            fieldName,
            fieldLabel: field?.label,
            oldValue,
            newValue,
          });
        }
      }
    }

    // Update record
    await this.updateRecord(id, tableId, updates);

    // Log activities for field changes
    for (const change of fieldChanges) {
      await this.logActivity(id, tableId, groupId, 'field_changed', change, userPubkey);
    }

    // Also log a general update activity
    if (fieldChanges.length > 0) {
      await this.logActivity(id, tableId, groupId, 'updated', {
        fieldsChanged: fieldChanges.map((c) => c.fieldName),
      }, userPubkey);
    }
  }

  /**
   * Delete a record with all related data
   */
  async deleteRecordWithRelatedData(id: string, tableId: string): Promise<void> {
    // Delete all activities for this record
    try {
      const activities = await dal.query<DBRecordActivity>('databaseRecordActivities', {
        whereClause: { recordId: id },
      });
      for (const a of activities) {
        await dal.delete('databaseRecordActivities', a.id);
      }
    } catch {
      // Table might not exist yet
    }

    // Delete all comments for this record
    try {
      const comments = await dal.query<DBRecordComment>('databaseRecordComments', {
        whereClause: { recordId: id },
      });
      for (const c of comments) {
        await dal.delete('databaseRecordComments', c.id);
      }
    } catch {
      // Table might not exist yet
    }

    // Delete all attachments for this record
    try {
      const attachments = await dal.query<DBRecordAttachment>('databaseRecordAttachments', {
        whereClause: { recordId: id },
      });
      for (const a of attachments) {
        await dal.delete('databaseRecordAttachments', a.id);
      }
    } catch {
      // Table might not exist yet
    }

    // Delete the record itself
    await this.deleteRecord(id, tableId);
  }
}

export const databaseManager = new DatabaseManager();
