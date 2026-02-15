/**
 * BuildIt Backend Worker
 *
 * Optional backend service for payment processing and email delivery.
 * Stateless, self-hostable, communicates with clients via Nostr (NIP-17).
 *
 * PRIVACY: This worker never sees private keys. It handles:
 * - Payment intents (creates Stripe/PayPal checkout sessions)
 * - Email delivery (sends newsletters via SendGrid/Mailgun)
 * - Webhook processing (payment confirmations, bounces)
 *
 * All sensitive communication uses NIP-17 encrypted Nostr messages.
 */

import type { Env } from './types'
import { handleStripeCheckout, handleStripeWebhook } from './payments/stripe'
import { handlePayPalCheckout, handlePayPalWebhook } from './payments/paypal'
import { handleEmailSend, handleUnsubscribe } from './email/sender'

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const corsHeaders = getCorsHeaders(request)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
      // Health check
      if (url.pathname === '/health') {
        return jsonResponse({
          status: 'ok',
          service: env.SERVICE_NAME,
          environment: env.ENVIRONMENT,
          timestamp: new Date().toISOString(),
          capabilities: {
            stripe: !!env.STRIPE_SECRET_KEY,
            paypal: !!env.PAYPAL_CLIENT_ID,
            sendgrid: !!env.SENDGRID_API_KEY,
            mailgun: !!env.MAILGUN_API_KEY,
          }
        }, 200, corsHeaders)
      }

      // Payment endpoints
      if (url.pathname === '/api/payments/stripe' && request.method === 'POST') {
        return handleStripeCheckout(request, env, corsHeaders)
      }

      if (url.pathname === '/api/payments/paypal' && request.method === 'POST') {
        return handlePayPalCheckout(request, env, corsHeaders)
      }

      if (url.pathname === '/api/payments/webhook' && request.method === 'POST') {
        const provider = url.searchParams.get('provider')
        if (provider === 'stripe') {
          return handleStripeWebhook(request, env, corsHeaders)
        }
        if (provider === 'paypal') {
          return handlePayPalWebhook(request, env, corsHeaders)
        }
        return jsonResponse({ error: 'Unknown payment provider' }, 400, corsHeaders)
      }

      // Email endpoints
      if (url.pathname === '/api/email/send' && request.method === 'POST') {
        return handleEmailSend(request, env, corsHeaders)
      }

      if (url.pathname === '/api/email/unsubscribe') {
        return handleUnsubscribe(request, env, corsHeaders)
      }

      // 404
      return jsonResponse({ error: 'Not found' }, 404, corsHeaders)
    } catch (error) {
      console.error('Worker error:', error)
      return jsonResponse(
        { error: 'Internal server error' },
        500,
        corsHeaders
      )
    }
  }
}

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function jsonResponse(
  data: unknown,
  status: number,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    }
  })
}
