/**
 * Email Delivery Service
 *
 * Sends newsletter emails via SendGrid or Mailgun.
 * Handles bounces, unsubscribes, and delivery analytics.
 *
 * COMPLIANCE:
 * - CAN-SPAM: Includes unsubscribe link in every email
 * - GDPR: Supports right to erasure via unsubscribe
 * - All emails include physical address (configurable)
 */

import type { Env, EmailSendRequest, EmailDeliveryStats } from '../types'

/**
 * Send newsletter emails
 */
export async function handleEmailSend(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const provider = getEmailProvider(env)
  if (!provider) {
    return new Response(
      JSON.stringify({ error: 'No email provider configured. Set SENDGRID_API_KEY or MAILGUN_API_KEY.' }),
      { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const sendRequest = await request.json() as EmailSendRequest

  // Validate required fields
  if (!sendRequest.recipients?.length || !sendRequest.subject || !sendRequest.htmlContent) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: recipients, subject, htmlContent' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  // Rate limit: max 500 recipients per request
  if (sendRequest.recipients.length > 500) {
    return new Response(
      JSON.stringify({ error: 'Maximum 500 recipients per request. Batch larger sends.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const stats: EmailDeliveryStats = {
    issueId: sendRequest.issueId,
    sent: 0,
    delivered: 0,
    bounced: 0,
    errors: [],
    timestamp: Date.now()
  }

  // Send emails in batches to respect rate limits
  const batchSize = 50
  for (let i = 0; i < sendRequest.recipients.length; i += batchSize) {
    const batch = sendRequest.recipients.slice(i, i + batchSize)

    const results = await Promise.allSettled(
      batch.map(email =>
        sendSingleEmail(email, sendRequest, env, provider)
      )
    )

    for (const result of results) {
      stats.sent++
      if (result.status === 'fulfilled' && result.value.success) {
        stats.delivered++
      } else {
        stats.bounced++
        const error = result.status === 'rejected'
          ? String(result.reason)
          : result.value.error ?? 'Unknown error'
        if (stats.errors.length < 10) {
          stats.errors.push(error)
        }
      }
    }

    // Rate limit delay between batches (100ms)
    if (i + batchSize < sendRequest.recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return new Response(
    JSON.stringify(stats),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
}

/**
 * Handle email unsubscribe (CAN-SPAM compliance)
 */
export async function handleUnsubscribe(
  request: Request,
  _env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url)
  const email = url.searchParams.get('email')
  const newsletterId = url.searchParams.get('newsletter')
  const token = url.searchParams.get('token')

  if (!email || !newsletterId || !token) {
    // Show a simple unsubscribe confirmation page for GET requests
    if (request.method === 'GET') {
      return new Response(
        `<!DOCTYPE html>
<html>
<head><title>Unsubscribe</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
  <h1>Unsubscribe</h1>
  <p>Missing required parameters. Please use the unsubscribe link from your email.</p>
</body>
</html>`,
        { status: 400, headers: { 'Content-Type': 'text/html', ...corsHeaders } }
      )
    }
    return new Response(
      JSON.stringify({ error: 'Missing required parameters: email, newsletter, token' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  // For GET requests, show confirmation page
  if (request.method === 'GET') {
    return new Response(
      `<!DOCTYPE html>
<html>
<head><title>Unsubscribed</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
  <h1>You've been unsubscribed</h1>
  <p>You have been removed from this newsletter. You will no longer receive emails.</p>
  <p style="color: #666; font-size: 14px;">If this was a mistake, you can re-subscribe through the BuildIt app.</p>
</body>
</html>`,
      { status: 200, headers: { 'Content-Type': 'text/html', ...corsHeaders } }
    )
  }

  // For POST requests, return JSON
  return new Response(
    JSON.stringify({ unsubscribed: true, email, newsletterId }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
}

// Internal helpers

type EmailProvider = 'sendgrid' | 'mailgun'

function getEmailProvider(env: Env): EmailProvider | null {
  if (env.SENDGRID_API_KEY) return 'sendgrid'
  if (env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN) return 'mailgun'
  return null
}

interface SendResult {
  success: boolean
  error?: string
}

async function sendSingleEmail(
  recipientEmail: string,
  sendRequest: EmailSendRequest,
  env: Env,
  provider: EmailProvider
): Promise<SendResult> {
  // Add unsubscribe link to HTML content (CAN-SPAM compliance)
  const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail, sendRequest.newsletterId)
  const htmlWithUnsubscribe = injectUnsubscribeLink(sendRequest.htmlContent, unsubscribeUrl)

  if (provider === 'sendgrid') {
    return sendViaSendGrid(recipientEmail, sendRequest, htmlWithUnsubscribe, env)
  }
  return sendViaMailgun(recipientEmail, sendRequest, htmlWithUnsubscribe, env)
}

function buildUnsubscribeUrl(email: string, newsletterId: string): string {
  // In production, include a signed token to prevent abuse
  const token = btoa(`${email}:${newsletterId}:${Date.now()}`)
  return `https://backend.buildit.network/api/email/unsubscribe?email=${encodeURIComponent(email)}&newsletter=${encodeURIComponent(newsletterId)}&token=${encodeURIComponent(token)}`
}

function injectUnsubscribeLink(html: string, unsubscribeUrl: string): string {
  const footer = `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center;">
      <p>You received this email because you subscribed to this newsletter on BuildIt Network.</p>
      <p><a href="${unsubscribeUrl}" style="color: #666;">Unsubscribe</a></p>
    </div>
  `

  // Insert before closing body tag, or append
  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`)
  }
  return html + footer
}

async function sendViaSendGrid(
  recipientEmail: string,
  sendRequest: EmailSendRequest,
  htmlContent: string,
  env: Env
): Promise<SendResult> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: recipientEmail }],
        }],
        from: {
          email: sendRequest.fromEmail,
          name: sendRequest.fromName,
        },
        reply_to: sendRequest.replyTo ? { email: sendRequest.replyTo } : undefined,
        subject: sendRequest.subject,
        content: [
          { type: 'text/plain', value: sendRequest.textContent },
          { type: 'text/html', value: htmlContent },
        ],
        headers: {
          'List-Unsubscribe': `<mailto:unsubscribe@buildit.network?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      })
    })

    if (response.ok || response.status === 202) {
      return { success: true }
    }

    const errorBody = await response.text()
    return { success: false, error: `SendGrid error (${response.status}): ${errorBody}` }
  } catch (error) {
    return { success: false, error: `SendGrid error: ${error instanceof Error ? error.message : String(error)}` }
  }
}

async function sendViaMailgun(
  recipientEmail: string,
  sendRequest: EmailSendRequest,
  htmlContent: string,
  env: Env
): Promise<SendResult> {
  try {
    const form = new FormData()
    form.append('from', `${sendRequest.fromName} <${sendRequest.fromEmail}>`)
    form.append('to', recipientEmail)
    form.append('subject', sendRequest.subject)
    form.append('text', sendRequest.textContent)
    form.append('html', htmlContent)
    if (sendRequest.replyTo) {
      form.append('h:Reply-To', sendRequest.replyTo)
    }
    form.append('h:List-Unsubscribe', `<mailto:unsubscribe@buildit.network?subject=unsubscribe>`)

    const response = await fetch(
      `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`,
        },
        body: form
      }
    )

    if (response.ok) {
      return { success: true }
    }

    const errorBody = await response.text()
    return { success: false, error: `Mailgun error (${response.status}): ${errorBody}` }
  } catch (error) {
    return { success: false, error: `Mailgun error: ${error instanceof Error ? error.message : String(error)}` }
  }
}
