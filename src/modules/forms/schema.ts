/**
 * Forms Module Database Schema
 * Contains all database table definitions for the forms module
 */

import type { TableSchema } from '@/types/modules';
import type {
  Form,
  FormSubmission,
} from './types';

// ============================================================================
// Database Table Interfaces (exported for Dexie)
// ============================================================================

/**
 * Forms table
 * Public-facing interfaces for database tables
 */
export interface DBForm extends Form {}

/**
 * Form Submissions table
 * Metadata about form submissions (actual data goes to database records)
 */
export interface DBFormSubmission extends FormSubmission {}

// ============================================================================
// Module Schema Definition
// ============================================================================

/**
 * Forms module schema definition for Dexie
 * All tables with indexes for efficient querying
 */
export const formsSchema: TableSchema[] = [
  // Forms
  {
    name: 'forms',
    schema: 'id, groupId, tableId, status, created',
    indexes: ['id', 'groupId', 'tableId', 'status', 'created'],
  },
  {
    name: 'formSubmissions',
    schema: 'id, formId, tableId, groupId, recordId, submittedAt, flaggedAsSpam',
    indexes: ['id', 'formId', 'tableId', 'groupId', 'recordId', 'submittedAt', 'flaggedAsSpam'],
  },
];

// Export type-safe table names
export const FORMS_TABLES = {
  FORMS: 'forms',
  FORM_SUBMISSIONS: 'formSubmissions',
} as const;
