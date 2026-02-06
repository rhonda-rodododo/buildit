/**
 * Forms Module Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * The generated schema defines a simpler Form model (protocol-level).
 * The local types below represent the richer UI-side forms that extend
 * Database tables with conditional logic, multi-page support, etc.
 */

import type { CustomField } from '../custom-fields/types';
import type { JSONSchema7 } from 'json-schema';

// Re-export generated Zod schemas and types
export {
  FieldValidationSchema,
  type FieldValidation,
  ConditionalLogicSchema,
  type ConditionalLogic,
  FormFieldSchema,
  type FormField,
  FormSchema as ProtocolFormSchema,
  type Form as ProtocolForm,
  FormResponseSchema,
  type FormResponse,
  FORMS_SCHEMA_VERSION,
} from '@/generated/validation/forms.zod';

// ── UI-Only Types (richer client-side form model) ────────────────

// ============================================================================
// Form Configuration Types (extends Database tables)
// ============================================================================

/**
 * Form - Public interface for a database table
 * Allows external users to submit records without logging in
 *
 * Uses JSON Schema for form structure and validation
 */
export interface Form {
  id: string;
  groupId: string;
  tableId: string; // which database table this form submits to

  // Form metadata
  title: string;
  description?: string;

  // JSON Schema definition
  schema?: JSONSchema7; // form structure and validation
  uiSchema?: Record<string, unknown>; // UI hints for rendering (RJSF format)

  // Fields configuration (legacy, will be derived from schema)
  fields: FormFieldConfig[]; // subset of table fields, with form-specific config

  // Settings
  settings: FormSettings;

  // Status
  status: 'draft' | 'published' | 'closed';

  // Timestamps
  created: number;
  createdBy: string;
  updated: number;
  publishedAt?: number;
  closedAt?: number;
}

/**
 * Form Field Configuration
 * Wraps a database custom field with form-specific settings
 */
export interface FormFieldConfig {
  fieldId: string; // references CustomField.id from the table

  // Display overrides (optional)
  label?: string; // override field label
  placeholder?: string;
  helpText?: string;

  // Validation overrides
  required?: boolean; // override field required setting

  // Conditional logic
  conditionals?: FormFieldConditional[];

  // Display order
  order: number;

  // Multi-page forms
  page?: number; // which page this field appears on (1-indexed)
}

/**
 * Conditional Logic for Form Fields
 * Show/hide/require fields based on other field values
 */
export interface FormFieldConditional {
  fieldId: string; // which field to watch
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
  value?: string | number | boolean; // value to compare against (not needed for isEmpty/isNotEmpty)
  action: 'show' | 'hide' | 'require';
}

/**
 * Form Settings
 */
export interface FormSettings {
  // Access control
  allowAnonymous: boolean; // allow submissions without login
  requireEmail: boolean; // require email address even if anonymous

  // Multi-page
  multiPage: boolean;
  pageCount?: number;

  // Confirmation
  confirmationMessage: string;
  redirectUrl?: string; // redirect after submission

  // Notifications
  sendAutoResponse: boolean;
  autoResponseSubject?: string;
  autoResponseBody?: string;
  notifyOnSubmission: boolean;
  notificationEmails?: string[]; // who to notify on new submissions

  // Webhooks
  enableWebhook: boolean;
  webhookUrl?: string;
  webhookEvents?: ('submit' | 'update' | 'delete')[];

  // Limits
  limitSubmissions: boolean;
  maxSubmissions?: number; // total submissions allowed
  limitPerUser: boolean;
  maxPerUser?: number; // max submissions per email/user
  closeOnDate: boolean;
  closeDate?: number; // auto-close form at this timestamp

  // Anti-spam
  antiSpam: AntiSpamSettings;

  // Branding
  customCss?: string;
  hideBranding?: boolean; // hide "Powered by BuildIt Network"
}

/**
 * Anti-Spam Settings
 */
export interface AntiSpamSettings {
  enableHoneypot: boolean; // hidden field to catch bots
  enableRateLimit: boolean;
  rateLimitCount?: number; // max submissions per minute per IP
  enableCaptcha: boolean;
  captchaType?: 'hcaptcha' | 'recaptcha' | 'turnstile';
  captchaSiteKey?: string;
}

/**
 * Form Submission
 * When submitted, creates a DatabaseRecord in the linked table
 */
export interface FormSubmission {
  id: string; // same as DatabaseRecord.id it creates
  formId: string;
  tableId: string;
  groupId: string;
  recordId: string; // DatabaseRecord.id created from this submission

  // Submitter info
  submittedBy?: string; // pubkey if logged in
  submittedByEmail?: string; // email if provided
  submittedByName?: string; // name if provided
  submittedAt: number;

  // Metadata for spam detection
  userAgent?: string;
  ipAddressHash?: string; // hashed IP for privacy
  referrer?: string;

  // Status
  flaggedAsSpam: boolean;
  processed: boolean;
  processedAt?: number;
}

/**
 * Form Template
 * Pre-configured forms for common use cases
 */
export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: 'event' | 'volunteer' | 'contact' | 'survey' | 'membership' | 'feedback';

  // Template configuration
  fields: Omit<CustomField, 'id' | 'groupId' | 'created' | 'createdBy' | 'updated'>[]; // template fields
  formFieldConfigs: Omit<FormFieldConfig, 'fieldId'>[]; // field display config
  settings: Partial<FormSettings>;

  // Metadata
  isBuiltIn: boolean;
}

// ============================================================================
// Store State Types
// ============================================================================

export interface FormsState {
  // Forms
  forms: Map<string, Form>;
  submissions: Map<string, FormSubmission>;

  // Loading state
  loading: boolean;
  error: string | null;
}
