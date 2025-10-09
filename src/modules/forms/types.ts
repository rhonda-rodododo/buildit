/**
 * Forms Module Types
 * Forms are public-facing data collection interfaces for Database tables
 * Similar to Airtable forms - they submit directly to database records
 */

import type { CustomField } from '../custom-fields/types';

// ============================================================================
// Form Configuration Types (extends Database tables)
// ============================================================================

/**
 * Form - Public interface for a database table
 * Allows external users to submit records without logging in
 */
export interface Form {
  id: string;
  groupId: string;
  tableId: string; // which database table this form submits to

  // Form metadata
  title: string;
  description?: string;

  // Fields configuration
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
// Fundraising Campaign Types
// ============================================================================

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'closed';
export type CampaignCategory = 'bail' | 'strike' | 'mutual-aid' | 'legal' | 'general' | 'emergency';

/**
 * Fundraising Campaign
 * Can optionally link to a database table for donor management
 */
export interface Campaign {
  id: string;
  groupId: string;
  tableId?: string; // optional: database table to store donors in

  // Campaign metadata
  title: string;
  slug: string; // URL-friendly identifier
  description: string; // rich text (HTML)
  category: CampaignCategory;

  // Goal
  goal: number; // in cents
  currentAmount: number; // in cents
  currency: string; // USD, EUR, etc. (ISO 4217)

  // Donation tiers
  tiers?: DonationTier[];
  allowCustomAmount: boolean;
  minAmount?: number; // minimum donation in cents
  maxAmount?: number; // maximum donation in cents

  // Recurring donations
  allowRecurring: boolean;
  recurringOptions?: ('monthly' | 'quarterly' | 'yearly')[];

  // Status
  status: CampaignStatus;

  // Timestamps
  created: number;
  createdBy: string;
  updated: number;
  publishedAt?: number;
  endsAt?: number;
  closedAt?: number;

  // Media
  imageUrl?: string;
  videoUrl?: string;

  // Updates
  updateCount: number; // count, actual updates stored separately

  // Settings
  settings: CampaignSettings;
}

/**
 * Donation Tier
 */
export interface DonationTier {
  id: string;
  campaignId: string;
  name: string;
  amount: number; // in cents
  description?: string;
  benefits?: string[]; // perks for this tier

  // Limits
  limited?: boolean;
  maxCount?: number;
  currentCount: number;

  // Display
  order: number;
  featured?: boolean; // highlight this tier
}

/**
 * Campaign Settings
 */
export interface CampaignSettings {
  // Donor wall
  showDonorWall: boolean;
  allowAnonymousDonors: boolean;
  showDonorNames: boolean;
  showDonorAmounts: boolean;
  showDonorMessages: boolean;

  // Thank you
  sendThankYouEmail: boolean;
  thankYouSubject?: string;
  thankYouBody?: string;

  // Tax receipts
  sendTaxReceipt: boolean;
  taxReceiptInfo?: TaxReceiptInfo;

  // Goal reached
  goalReachedMessage?: string;
  continueAfterGoal: boolean; // allow donations after goal reached

  // Notifications
  notifyOnDonation: boolean;
  notificationEmails?: string[];

  // Payment processors
  enabledProcessors: ('stripe' | 'paypal' | 'crypto')[];
  stripeAccountId?: string;
  paypalMerchantId?: string;
  cryptoAddresses?: CryptoAddresses;
}

/**
 * Tax Receipt Information
 */
export interface TaxReceiptInfo {
  orgName: string;
  orgAddress: string;
  taxId: string; // EIN or equivalent
  is501c3: boolean; // or equivalent charity status
  receiptMessage?: string;
}

/**
 * Crypto Addresses for Donations
 */
export interface CryptoAddresses {
  bitcoin?: string;
  ethereum?: string;
  lightning?: string; // Lightning Network address
  monero?: string;
}

/**
 * Campaign Update
 */
export interface CampaignUpdate {
  id: string;
  campaignId: string;
  groupId: string;
  title: string;
  content: string; // rich text (HTML)

  // Timestamps
  created: number;
  createdBy: string;
  updated: number;
}

/**
 * Donation Record
 */
export interface Donation {
  id: string;
  campaignId: string;
  groupId: string;

  // Amount
  amount: number; // in cents
  currency: string;

  // Tier
  tierId?: string; // if from a specific tier

  // Donor info
  donorPubkey?: string; // if logged in user
  donorRecordId?: string; // if stored in database table
  donorEmail?: string;
  donorName?: string;
  isAnonymous: boolean;
  message?: string; // optional message from donor

  // Recurring
  isRecurring: boolean;
  recurringInterval?: 'monthly' | 'quarterly' | 'yearly';
  recurringUntil?: number; // timestamp when recurring ends
  parentDonationId?: string; // if this is a recurring payment, reference to original

  // Payment
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  paymentMethod: 'stripe' | 'paypal' | 'crypto';
  paymentProcessor?: string;
  transactionId?: string;

  // Timestamps
  created: number;
  completedAt?: number;
  refundedAt?: number;

  // Metadata
  userAgent?: string;
  referrer?: string;
}

/**
 * Campaign Template
 */
export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: CampaignCategory;

  // Template configuration
  title: string;
  descriptionTemplate: string;
  defaultTiers?: Omit<DonationTier, 'id' | 'campaignId' | 'currentCount'>[];
  settings: Partial<CampaignSettings>;

  // Metadata
  isBuiltIn: boolean;
}

// ============================================================================
// Public Pages Types
// ============================================================================

export type PageType = 'landing' | 'about' | 'events' | 'contact' | 'custom';
export type PageStatus = 'draft' | 'published';

/**
 * Public Page
 * SEO-optimized public pages for groups
 */
export interface PublicPage {
  id: string;
  groupId: string;
  slug: string; // URL-friendly identifier (e.g., "about-us")
  title: string;
  type: PageType;
  content: string; // HTML content (from rich text editor)

  // SEO
  seo: SEOMetadata;

  // Status
  status: PageStatus;

  // Timestamps
  created: number;
  createdBy: string;
  updated: number;
  publishedAt?: number;
}

/**
 * SEO Metadata
 */
export interface SEOMetadata {
  title?: string; // page title (overrides PublicPage.title)
  description?: string;
  keywords?: string[];

  // Open Graph (Facebook, LinkedIn)
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string; // website, article, etc.

  // Twitter Card
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  twitterSite?: string; // @username
  twitterCreator?: string; // @username

  // Technical SEO
  canonicalUrl?: string;
  robots?: string; // e.g., "index, follow" or "noindex, nofollow"

  // Schema.org structured data
  schemaOrgType?: string; // Organization, Event, Article, etc.
  schemaOrgJson?: string; // JSON-LD string
}

// ============================================================================
// Analytics Types
// ============================================================================

export type AnalyticsEvent = 'view' | 'submit' | 'donate' | 'click' | 'share';
export type AnalyticsResource = 'form' | 'campaign' | 'page';

/**
 * Analytics Event
 * Privacy-preserving analytics without tracking individual users
 */
export interface Analytics {
  id: string;
  groupId: string;

  // Resource
  resourceType: AnalyticsResource;
  resourceId: string;

  // Event
  event: AnalyticsEvent;
  eventData?: Record<string, unknown>; // additional event data

  // Timestamp
  timestamp: number;

  // Privacy-preserving metadata (no user identification)
  sessionId: string; // random session ID (not tied to user)
  userAgent?: string;
  referrer?: string;
  country?: string; // from IP geolocation (no precise location)

  // No IP addresses, no cookies, no user IDs
}

/**
 * Analytics Summary
 * Aggregated stats for dashboards
 */
export interface AnalyticsSummary {
  resourceType: AnalyticsResource;
  resourceId: string;
  timeframe: 'day' | 'week' | 'month' | 'year' | 'all';

  // Metrics
  views: number;
  submissions?: number; // for forms
  donations?: number; // for campaigns
  totalRaised?: number; // for campaigns (in cents)
  clicks?: number;
  shares?: number;

  // Conversion rate (views → submissions/donations)
  conversionRate?: number; // percentage

  // Top referrers
  topReferrers?: Array<{ referrer: string; count: number }>;

  // Computed at
  computedAt: number;
}

// ============================================================================
// Store State Types
// ============================================================================

export interface FormsState {
  // Forms
  forms: Map<string, Form>;
  submissions: Map<string, FormSubmission>;

  // Campaigns
  campaigns: Map<string, Campaign>;
  campaignUpdates: Map<string, CampaignUpdate>;
  donations: Map<string, Donation>;
  donationTiers: Map<string, DonationTier>;

  // Public Pages
  publicPages: Map<string, PublicPage>;

  // Analytics
  analytics: Map<string, Analytics>;
  analyticsSummaries: Map<string, AnalyticsSummary>;

  // Loading state
  loading: boolean;
  error: string | null;
}
