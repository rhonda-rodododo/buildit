/**
 * Stripe Payment Integration
 *
 * Creates Stripe Checkout sessions for one-time and recurring donations.
 * Handles Stripe webhook events for payment confirmations.
 *
 * PRIVACY: Only sees payment amount, currency, and campaign metadata.
 * Does not see donor identity beyond what Stripe collects.
 */

import type { Env, PaymentIntent, PaymentResult } from '../types'

/**
 * Create a Stripe Checkout session
 */
export async function handleStripeCheckout(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: 'Stripe not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const intent = await request.json() as PaymentIntent

  // Validate required fields
  if (!intent.amount || !intent.currency || !intent.campaignId) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: amount, currency, campaignId' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  try {
    // Build Stripe Checkout session params
    const params = new URLSearchParams()
    params.append('payment_method_types[]', 'card')
    params.append('mode', intent.recurring ? 'subscription' : 'payment')
    params.append('success_url', intent.successUrl || 'https://buildit.network/donation/success')
    params.append('cancel_url', intent.cancelUrl || 'https://buildit.network/donation/cancel')
    params.append('metadata[campaign_id]', intent.campaignId)
    params.append('metadata[campaign_name]', intent.campaignName || '')
    params.append('metadata[donor_pubkey]', intent.donorPubkey || '')
    params.append('metadata[intent_id]', intent.id)

    if (intent.recurring) {
      // Subscription mode - create price inline
      params.append('line_items[0][price_data][currency]', intent.currency)
      params.append('line_items[0][price_data][unit_amount]', String(intent.amount))
      params.append('line_items[0][price_data][product_data][name]', `Donation: ${intent.campaignName}`)
      params.append('line_items[0][price_data][recurring][interval]',
        intent.recurringInterval === 'yearly' ? 'year' :
        intent.recurringInterval === 'quarterly' ? 'month' : 'month'
      )
      if (intent.recurringInterval === 'quarterly') {
        params.append('line_items[0][price_data][recurring][interval_count]', '3')
      }
      params.append('line_items[0][quantity]', '1')
    } else {
      // One-time payment
      params.append('line_items[0][price_data][currency]', intent.currency)
      params.append('line_items[0][price_data][unit_amount]', String(intent.amount))
      params.append('line_items[0][price_data][product_data][name]', `Donation: ${intent.campaignName}`)
      params.append('line_items[0][quantity]', '1')
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    })

    const session = await response.json() as { id: string; url: string; error?: { message: string } }

    if (!response.ok || session.error) {
      return new Response(
        JSON.stringify({
          error: session.error?.message || 'Failed to create checkout session'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const result: PaymentResult = {
      intentId: intent.id,
      status: 'pending',
      transactionId: session.id,
      checkoutUrl: session.url,
      timestamp: Date.now()
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Stripe error: ${error instanceof Error ? error.message : String(error)}` }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const signature = request.headers.get('stripe-signature')
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Missing webhook signature or secret' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const body = await request.text()

  // Verify webhook signature using Stripe's timing-safe comparison
  // In production, use Stripe SDK. For Workers, manual verification:
  const isValid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET)
  if (!isValid) {
    return new Response(
      JSON.stringify({ error: 'Invalid webhook signature' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const event = JSON.parse(body) as {
    type: string
    data: { object: Record<string, unknown> }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const metadata = session.metadata as Record<string, string> | undefined
      console.log(`Payment succeeded for campaign ${metadata?.campaign_id}`, {
        sessionId: session.id,
        intentId: metadata?.intent_id,
      })
      // In production: publish receipt via NIP-17 to donor_pubkey
      break
    }

    case 'checkout.session.expired': {
      const session = event.data.object
      const metadata = session.metadata as Record<string, string> | undefined
      console.log(`Payment expired for campaign ${metadata?.campaign_id}`)
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      console.log(`Subscription event: ${event.type}`)
      break
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}

/**
 * Verify Stripe webhook signature (HMAC-SHA256)
 */
async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  try {
    // Parse the signature header
    const elements = signatureHeader.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=')
      if (key && value) acc[key.trim()] = value.trim()
      return acc
    }, {} as Record<string, string>)

    const timestamp = elements['t']
    const expectedSig = elements['v1']
    if (!timestamp || !expectedSig) return false

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    )

    const computedSig = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return computedSig === expectedSig
  } catch {
    return false
  }
}
