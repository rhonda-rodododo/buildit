/**
 * Payment Service
 *
 * Client-side service for creating payment sessions via the backend worker.
 * Supports Stripe and PayPal checkout flows.
 *
 * Flow:
 * 1. Client creates a PaymentIntent with campaign details
 * 2. Sends to backend worker via HTTP POST
 * 3. Backend creates Stripe/PayPal session, returns checkout URL
 * 4. Client redirects user to hosted checkout page
 * 5. Backend receives webhook on payment completion
 * 6. (Future) Backend publishes receipt via NIP-17 to donor's pubkey
 */

import { nanoid } from 'nanoid';

/**
 * Payment intent matching the backend worker's PaymentIntent type
 */
export interface PaymentIntent {
  id: string;
  provider: 'stripe' | 'paypal';
  amount: number;
  currency: string;
  campaignId: string;
  campaignName: string;
  donorPubkey: string;
  recurring?: boolean;
  recurringInterval?: 'monthly' | 'quarterly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

/**
 * Payment result from the backend worker
 */
export interface PaymentResult {
  intentId: string;
  status: 'success' | 'failed' | 'pending';
  transactionId?: string;
  checkoutUrl?: string;
  error?: string;
  timestamp: number;
}

/**
 * Options for creating a payment
 */
export interface CreatePaymentOptions {
  provider: 'stripe' | 'paypal';
  amount: number;
  currency: string;
  campaignId: string;
  campaignName: string;
  donorPubkey: string;
  recurring?: boolean;
  recurringInterval?: 'monthly' | 'quarterly' | 'yearly';
  backendUrl: string;
}

/**
 * Create a payment session and return the checkout URL
 *
 * @param options - Payment creation options
 * @returns PaymentResult with checkoutUrl for redirect
 */
export async function createPaymentSession(
  options: CreatePaymentOptions
): Promise<PaymentResult> {
  const { provider, backendUrl, ...rest } = options;

  const intent: PaymentIntent = {
    id: nanoid(),
    provider,
    ...rest,
    successUrl: `${window.location.origin}/donation/success?intent=${nanoid()}`,
    cancelUrl: `${window.location.origin}/donation/cancel`,
  };

  const endpoint =
    provider === 'stripe'
      ? `${backendUrl}/api/payments/stripe`
      : `${backendUrl}/api/payments/paypal`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(intent),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(
      (error as { error?: string }).error || `Payment creation failed (${response.status})`
    );
  }

  return response.json() as Promise<PaymentResult>;
}

/**
 * Redirect the user to the payment provider's hosted checkout page
 *
 * @param result - PaymentResult containing the checkout URL
 */
export function redirectToCheckout(result: PaymentResult): void {
  if (!result.checkoutUrl) {
    throw new Error('No checkout URL received from payment provider');
  }
  window.location.href = result.checkoutUrl;
}

/**
 * Create a payment session and immediately redirect to checkout
 *
 * Convenience function that combines createPaymentSession + redirectToCheckout.
 *
 * @param options - Payment creation options
 */
export async function initiateCheckout(
  options: CreatePaymentOptions
): Promise<void> {
  const result = await createPaymentSession(options);
  redirectToCheckout(result);
}
