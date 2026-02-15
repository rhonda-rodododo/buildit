/**
 * PayPal Payment Integration
 *
 * Creates PayPal orders for one-time donations.
 * Handles PayPal webhook events for payment confirmations.
 *
 * Uses PayPal REST API v2 for order creation and capture.
 */

import type { Env, PaymentIntent, PaymentResult } from '../types'

const PAYPAL_API_BASE = 'https://api-m.paypal.com'
const PAYPAL_SANDBOX_API_BASE = 'https://api-m.sandbox.paypal.com'

function getApiBase(env: Env): string {
  return env.ENVIRONMENT === 'production' ? PAYPAL_API_BASE : PAYPAL_SANDBOX_API_BASE
}

/**
 * Get PayPal access token using client credentials
 */
async function getAccessToken(env: Env): Promise<string> {
  const apiBase = getApiBase(env)
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)

  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  })

  const data = await response.json() as { access_token: string }
  return data.access_token
}

/**
 * Create a PayPal order for checkout
 */
export async function handlePayPalCheckout(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: 'PayPal not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const intent = await request.json() as PaymentIntent

  if (!intent.amount || !intent.currency || !intent.campaignId) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: amount, currency, campaignId' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  try {
    const accessToken = await getAccessToken(env)
    const apiBase = getApiBase(env)

    // Convert cents to decimal (PayPal uses decimal amounts)
    const decimalAmount = (intent.amount / 100).toFixed(2)

    const orderBody = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: intent.id,
        description: `Donation: ${intent.campaignName}`,
        custom_id: intent.campaignId,
        amount: {
          currency_code: intent.currency.toUpperCase(),
          value: decimalAmount
        }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: intent.successUrl || 'https://buildit.network/donation/success',
            cancel_url: intent.cancelUrl || 'https://buildit.network/donation/cancel',
            brand_name: 'BuildIt Network',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW'
          }
        }
      }
    }

    const response = await fetch(`${apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderBody)
    })

    const order = await response.json() as {
      id: string
      status: string
      links: Array<{ rel: string; href: string }>
      error?: string
    }

    if (!response.ok || order.error) {
      return new Response(
        JSON.stringify({ error: order.error || 'Failed to create PayPal order' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Find the approval URL
    const approvalLink = order.links?.find(l => l.rel === 'payer-action')?.href
      || order.links?.find(l => l.rel === 'approve')?.href

    const result: PaymentResult = {
      intentId: intent.id,
      status: 'pending',
      transactionId: order.id,
      checkoutUrl: approvalLink,
      timestamp: Date.now()
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `PayPal error: ${error instanceof Error ? error.message : String(error)}` }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
}

/**
 * Handle PayPal webhook events
 */
export async function handlePayPalWebhook(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const body = await request.text()

  try {
    const event = JSON.parse(body) as {
      event_type: string
      resource: Record<string, unknown>
    }

    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED': {
        console.log('PayPal order approved:', event.resource.id)
        // Auto-capture the payment
        await captureOrder(event.resource.id as string, env)
        break
      }

      case 'PAYMENT.CAPTURE.COMPLETED': {
        console.log('PayPal payment captured:', event.resource.id)
        // In production: publish receipt via NIP-17
        break
      }

      case 'PAYMENT.CAPTURE.DENIED': {
        console.log('PayPal payment denied:', event.resource.id)
        break
      }

      default:
        console.log(`Unhandled PayPal event: ${event.event_type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to process webhook' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
}

/**
 * Capture an approved PayPal order
 */
async function captureOrder(orderId: string, env: Env): Promise<void> {
  try {
    const accessToken = await getAccessToken(env)
    const apiBase = getApiBase(env)

    await fetch(`${apiBase}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    })
  } catch (error) {
    console.error('Failed to capture PayPal order:', error)
  }
}
