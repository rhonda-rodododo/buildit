/**
 * BuildIt Backend Worker Types
 *
 * Environment bindings and shared type definitions.
 */

export interface Env {
  // Environment identification
  ENVIRONMENT: string
  SERVICE_NAME: string

  // Nostr identity for NIP-17 communication
  NOSTR_PRIVATE_KEY: string

  // Stripe payment processing
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string

  // PayPal payment processing
  PAYPAL_CLIENT_ID: string
  PAYPAL_CLIENT_SECRET: string

  // Email delivery (SendGrid or Mailgun)
  SENDGRID_API_KEY?: string
  MAILGUN_API_KEY?: string
  MAILGUN_DOMAIN?: string

  // Admin authentication
  ADMIN_TOKEN?: string
}

/**
 * Payment intent received from client via NIP-17
 */
export interface PaymentIntent {
  /** Unique payment ID */
  id: string
  /** Payment provider */
  provider: 'stripe' | 'paypal'
  /** Amount in smallest currency unit (cents) */
  amount: number
  /** ISO 4217 currency code */
  currency: string
  /** Campaign or fundraiser ID */
  campaignId: string
  /** Campaign name for display */
  campaignName: string
  /** Donor's Nostr pubkey (for receipt delivery) */
  donorPubkey: string
  /** Whether this is a recurring payment */
  recurring?: boolean
  /** Recurring interval */
  recurringInterval?: 'monthly' | 'quarterly' | 'yearly'
  /** Success redirect URL */
  successUrl: string
  /** Cancel redirect URL */
  cancelUrl: string
}

/**
 * Payment result published back to client via NIP-17
 */
export interface PaymentResult {
  /** Original payment intent ID */
  intentId: string
  /** Payment status */
  status: 'success' | 'failed' | 'pending'
  /** Provider-specific transaction ID */
  transactionId?: string
  /** Checkout URL (for redirect-based flows) */
  checkoutUrl?: string
  /** Error message if failed */
  error?: string
  /** Timestamp */
  timestamp: number
}

/**
 * Email send request from client via NIP-17
 */
export interface EmailSendRequest {
  /** Newsletter issue ID */
  issueId: string
  /** Email subject */
  subject: string
  /** HTML email content */
  htmlContent: string
  /** Plain text fallback */
  textContent: string
  /** Subscriber email addresses */
  recipients: string[]
  /** From name */
  fromName: string
  /** From email address */
  fromEmail: string
  /** Reply-to email */
  replyTo?: string
  /** Newsletter ID (for unsubscribe links) */
  newsletterId: string
  /** Requester's Nostr pubkey (for delivery stats) */
  requesterPubkey: string
}

/**
 * Email delivery stats published back via NIP-17
 */
export interface EmailDeliveryStats {
  /** Newsletter issue ID */
  issueId: string
  /** Total emails sent */
  sent: number
  /** Delivery successes */
  delivered: number
  /** Bounces */
  bounced: number
  /** Errors */
  errors: string[]
  /** Timestamp */
  timestamp: number
}

/**
 * Webhook event from Stripe or PayPal
 */
export interface WebhookEvent {
  provider: 'stripe' | 'paypal'
  eventType: string
  data: Record<string, unknown>
}
