/**
 * Fundraising Module Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * The generated schema defines a simpler Campaign/Donation model (protocol-level).
 * The local types below represent the richer UI-side fundraising features
 * (crypto wallets, payment processing, templates, etc.).
 */

// Re-export generated Zod schemas and types
export {
  DonationTierSchema as ProtocolDonationTierSchema,
  type DonationTier as ProtocolDonationTier,
  CampaignUpdateSchema as ProtocolCampaignUpdateSchema,
  type CampaignUpdate as ProtocolCampaignUpdate,
  CampaignSchema,
  type Campaign as ProtocolCampaign,
  DonationSchema,
  type Donation as ProtocolDonation,
  ExpenseSchema,
  type Expense,
  FUNDRAISING_SCHEMA_VERSION,
} from '@/generated/validation/fundraising.zod';

// ── UI-Only Types (richer client-side fundraising model) ─────────

// ============================================================================
// Campaign Types
// ============================================================================

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'closed';
export type CampaignCategory = 'bail' | 'strike' | 'mutual-aid' | 'legal' | 'general' | 'emergency';

/**
 * Fundraising Campaign
 * Can optionally link to a database table for donor management
 * Can optionally link to a form for donation collection
 */
export interface Campaign {
  id: string;
  groupId: string;
  tableId?: string; // optional: database table to store donors in
  formId?: string; // optional: form for donation data collection

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
 * Supported cryptocurrency types
 */
export type CryptoType = 'bitcoin' | 'ethereum' | 'usdc' | 'dai';

/**
 * Crypto network type
 */
export type CryptoNetwork = 'mainnet' | 'testnet';

/**
 * Crypto transaction status
 */
export type CryptoTxStatus = 'pending' | 'confirming' | 'confirmed' | 'failed';

/**
 * Crypto Wallet for HD derivation
 */
export interface CryptoWallet {
  id: string;
  campaignId: string;
  cryptoType: CryptoType;
  network: CryptoNetwork;

  // HD wallet data (encrypted)
  derivationPath: string;
  addressIndex: number;

  // Current receiving address
  currentAddress: string;

  // Metadata
  createdAt: number;
  updatedAt: number;
}

/**
 * Crypto Transaction Record
 */
export interface CryptoTransaction {
  id: string;
  donationId: string; // links to Donation record
  campaignId: string;

  // Transaction details
  cryptoType: CryptoType;
  network: CryptoNetwork;
  txHash: string;
  fromAddress?: string;
  toAddress: string;

  // Amount
  amount: string; // in smallest unit (satoshis for BTC, wei for ETH)
  amountFormatted: string; // human readable
  amountUSD?: number; // USD equivalent at time of tx

  // Confirmations
  confirmations: number;
  requiredConfirmations: number;
  status: CryptoTxStatus;

  // Timestamps
  detectedAt: number;
  confirmedAt?: number;

  // Block info
  blockHeight?: number;
  blockHash?: string;
}

/**
 * Crypto Donation Request (pending payment)
 */
export interface CryptoDonationRequest {
  id: string;
  campaignId: string;

  // Requested amount
  cryptoType: CryptoType;
  requestedAmountUSD: number;
  estimatedCryptoAmount: string; // at time of request

  // Payment address
  paymentAddress: string;

  // Expiry
  expiresAt: number; // address valid until

  // Status
  status: 'pending' | 'paid' | 'expired' | 'cancelled';

  // Linked transaction when paid
  transactionId?: string;

  // Timestamps
  createdAt: number;
  paidAt?: number;
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
// Store State Types
// ============================================================================

export interface FundraisingState {
  // Campaigns
  campaigns: Map<string, Campaign>;
  campaignUpdates: Map<string, CampaignUpdate>;
  donations: Map<string, Donation>;
  donationTiers: Map<string, DonationTier>;

  // Loading state
  loading: boolean;
  error: string | null;
}
