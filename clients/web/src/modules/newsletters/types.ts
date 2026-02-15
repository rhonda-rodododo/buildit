/**
 * Newsletter Module Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * The generated schema defines a simpler Newsletter/Campaign/Subscriber model (protocol-level).
 * The local types below represent the richer UI-side newsletter features
 * (Nostr DM delivery, themes, queue management, etc.).
 */

// Re-export generated Zod schemas and types
export {
  NewsletterSchema as ProtocolNewsletterSchema,
  type Newsletter as ProtocolNewsletter,
  CampaignSchema as ProtocolCampaignSchema,
  type Campaign as ProtocolCampaign,
  SubscriberSchema as ProtocolSubscriberSchema,
  type Subscriber as ProtocolSubscriber,
  TemplateSchema as ProtocolTemplateSchema,
  type Template as ProtocolTemplate,
  NEWSLETTERS_SCHEMA_VERSION,
} from '@/generated/validation/newsletters.zod';

// ── UI-Only Types (richer client-side newsletter model) ──────────

/**
 * Newsletter - a publication's newsletter configuration
 */
export interface Newsletter {
  id: string;
  publicationId?: string; // Optional link to publishing module
  groupId: string;
  ownerPubkey: string;

  // Basic info
  name: string;
  description: string;

  // Branding
  headerImage?: string;
  footerText?: string;
  theme: NewsletterTheme;

  // Schedule
  schedule: NewsletterSchedule;

  // Settings
  settings: NewsletterSettings;

  // Stats
  subscriberCount: number;
  totalIssuesSent: number;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * Newsletter theme configuration
 */
export interface NewsletterTheme {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  linkColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
}

/**
 * Newsletter schedule settings
 */
export interface NewsletterSchedule {
  type: 'manual' | 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly
  dayOfMonth?: number; // 1-31 for monthly
  timeOfDay?: string; // HH:MM format
  timezone?: string;
}

/**
 * Newsletter settings
 */
export interface NewsletterSettings {
  allowReplies: boolean; // Allow subscribers to reply via Nostr DM
  welcomeMessage?: string; // Sent to new subscribers
  confirmationRequired: boolean; // Require subscription confirmation
  maxRetriesOnFailure: number; // Max retry attempts for failed sends
  rateLimitPerMinute: number; // Rate limit for batch sends

  // Email delivery (Epic 53B)
  emailDeliveryEnabled: boolean; // Enable email delivery alongside Nostr DMs
  emailBackendUrl?: string; // Backend worker URL for email sending
  fromName?: string; // Display name for email sender
  fromEmail?: string; // Email address for sender
  replyToEmail?: string; // Reply-to address
}

/**
 * Newsletter issue status
 */
export type IssueStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

/**
 * Newsletter issue - an individual newsletter edition
 */
export interface NewsletterIssue {
  id: string;
  newsletterId: string;
  groupId: string;
  authorPubkey: string;

  // Content
  subject: string;
  previewText?: string; // First few lines shown in preview
  content: string; // HTML/Markdown content
  contentFormat: 'html' | 'markdown';

  // Status
  status: IssueStatus;

  // Scheduling
  scheduledAt?: number;
  sentAt?: number;

  // Delivery stats
  stats: IssueDeliveryStats;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * Issue delivery statistics
 */
export interface IssueDeliveryStats {
  totalRecipients: number;
  delivered: number;
  pending: number;
  failed: number;
  retrying: number;
}

/**
 * Subscription status
 */
export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed';

/**
 * Subscriber preferences
 */
export interface SubscriberPreferences {
  frequency: 'all' | 'weekly-digest' | 'monthly-digest';
  topics: string[]; // Tags/topics of interest
}

/**
 * Newsletter subscriber
 */
export interface NewsletterSubscriber {
  id: string;
  newsletterId: string;
  subscriberPubkey: string;

  // Status
  status: SubscriberStatus;

  // Metadata
  subscribedAt: number;
  confirmedAt?: number;
  unsubscribedAt?: number;

  // Preferences
  preferences: SubscriberPreferences;

  // Source
  source: 'manual' | 'import' | 'self-subscribe' | 'nostr-contact-list';

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * Send status
 */
export type SendStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'retrying';

/**
 * Newsletter send - tracking individual message sends
 */
export interface NewsletterSend {
  id: string;
  issueId: string;
  newsletterId: string;
  subscriberPubkey: string;

  // Status
  status: SendStatus;

  // Delivery details
  nostrEventId?: string; // Event ID once published
  relayConfirmations: string[]; // Relays that confirmed receipt

  // Error handling
  errorMessage?: string;
  retryCount: number;
  lastRetryAt?: number;

  // Timestamps
  createdAt: number;
  sentAt?: number;
  deliveredAt?: number;
}

/**
 * Delivery queue item - for batch processing
 */
export interface DeliveryQueueItem {
  id: string;
  issueId: string;
  subscriberPubkey: string;
  priority: number;
  scheduledFor: number;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
}

/**
 * Create newsletter input
 */
export interface CreateNewsletterInput {
  publicationId?: string;
  groupId: string;
  name: string;
  description: string;
  headerImage?: string;
  footerText?: string;
  theme?: Partial<NewsletterTheme>;
  schedule?: Partial<NewsletterSchedule>;
  settings?: Partial<NewsletterSettings>;
}

/**
 * Update newsletter input
 */
export interface UpdateNewsletterInput {
  name?: string;
  description?: string;
  headerImage?: string;
  footerText?: string;
  theme?: Partial<NewsletterTheme>;
  schedule?: Partial<NewsletterSchedule>;
  settings?: Partial<NewsletterSettings>;
}

/**
 * Create issue input
 */
export interface CreateIssueInput {
  newsletterId: string;
  subject: string;
  previewText?: string;
  content?: string;
  contentFormat?: 'html' | 'markdown';
}

/**
 * Update issue input
 */
export interface UpdateIssueInput {
  subject?: string;
  previewText?: string;
  content?: string;
  contentFormat?: 'html' | 'markdown';
}

/**
 * Add subscriber input
 */
export interface AddSubscriberInput {
  newsletterId: string;
  subscriberPubkey: string;
  source?: NewsletterSubscriber['source'];
  preferences?: Partial<SubscriberPreferences>;
  skipConfirmation?: boolean;
}

/**
 * Import subscribers input
 */
export interface ImportSubscribersInput {
  newsletterId: string;
  pubkeys: string[];
  source?: NewsletterSubscriber['source'];
  skipConfirmation?: boolean;
}

/**
 * Delivery progress event
 */
export interface DeliveryProgressEvent {
  issueId: string;
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  currentPubkey?: string;
  percentComplete: number;
}

/**
 * Default newsletter theme
 */
export const DEFAULT_NEWSLETTER_THEME: NewsletterTheme = {
  primaryColor: '#3b82f6',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  linkColor: '#2563eb',
  fontFamily: 'sans',
};

/**
 * Default newsletter settings
 */
export const DEFAULT_NEWSLETTER_SETTINGS: NewsletterSettings = {
  allowReplies: true,
  confirmationRequired: false,
  maxRetriesOnFailure: 3,
  rateLimitPerMinute: 30, // Conservative to avoid relay throttling
  emailDeliveryEnabled: false,
};

/**
 * Default newsletter schedule
 */
export const DEFAULT_NEWSLETTER_SCHEDULE: NewsletterSchedule = {
  type: 'manual',
};
