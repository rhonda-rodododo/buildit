/**
 * Email Delivery Service
 *
 * Client-side service for sending newsletter emails via the backend worker.
 * Sends requests to the backend worker's /api/email/send endpoint.
 * The backend worker handles the actual email delivery via SendGrid/Mailgun.
 */

import type { Newsletter, NewsletterIssue } from './types';

/**
 * Email send request matching the backend worker's EmailSendRequest type
 */
interface EmailSendRequest {
  issueId: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  recipients: string[];
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  newsletterId: string;
  requesterPubkey: string;
}

/**
 * Email delivery stats returned from the backend worker
 */
export interface EmailDeliveryStats {
  issueId: string;
  sent: number;
  delivered: number;
  bounced: number;
  errors: string[];
  timestamp: number;
}

/**
 * Convert HTML content to plain text for email text/plain fallback
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n$1\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/?[ou]l[^>]*>/gi, '\n')
    .replace(/<(b|strong)[^>]*>(.*?)<\/(b|strong)>/gi, '$2')
    .replace(/<(i|em)[^>]*>(.*?)<\/(i|em)>/gi, '$2')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Wrap newsletter content in a styled HTML email template
 */
function wrapInEmailTemplate(
  issue: NewsletterIssue,
  newsletter: Newsletter
): string {
  const { theme } = newsletter;
  const fontFamily =
    theme.fontFamily === 'serif'
      ? 'Georgia, "Times New Roman", serif'
      : theme.fontFamily === 'mono'
        ? '"Courier New", Courier, monospace'
        : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${issue.subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: ${theme.backgroundColor}; border-radius: 8px; overflow: hidden;">
          ${newsletter.headerImage ? `<tr><td><img src="${newsletter.headerImage}" alt="" style="width: 100%; height: auto; display: block;" /></td></tr>` : ''}
          <tr>
            <td style="padding: 32px 24px; font-family: ${fontFamily}; color: ${theme.textColor}; font-size: 16px; line-height: 1.6;">
              <h1 style="color: ${theme.primaryColor}; margin: 0 0 8px 0; font-size: 24px;">${issue.subject}</h1>
              ${issue.previewText ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">${issue.previewText}</p>` : ''}
              <div>${issue.content}</div>
            </td>
          </tr>
          ${newsletter.footerText ? `<tr><td style="padding: 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; font-family: ${fontFamily};">${newsletter.footerText}</td></tr>` : ''}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a newsletter issue via email through the backend worker
 *
 * @param issue - The newsletter issue to send
 * @param newsletter - The parent newsletter (for settings and theme)
 * @param emailRecipients - Array of email addresses to send to
 * @param requesterPubkey - The sender's Nostr pubkey (for delivery stats)
 * @returns Email delivery statistics
 */
export async function sendNewsletterViaEmail(
  issue: NewsletterIssue,
  newsletter: Newsletter,
  emailRecipients: string[],
  requesterPubkey: string
): Promise<EmailDeliveryStats> {
  const backendUrl = newsletter.settings.emailBackendUrl;
  if (!backendUrl) {
    throw new Error('Email backend URL not configured');
  }

  if (!newsletter.settings.emailDeliveryEnabled) {
    throw new Error('Email delivery is not enabled for this newsletter');
  }

  if (emailRecipients.length === 0) {
    throw new Error('No email recipients provided');
  }

  const htmlContent = wrapInEmailTemplate(issue, newsletter);
  const textContent = htmlToPlainText(issue.content);

  const request: EmailSendRequest = {
    issueId: issue.id,
    subject: issue.subject,
    htmlContent,
    textContent,
    recipients: emailRecipients,
    fromName: newsletter.settings.fromName || newsletter.name,
    fromEmail: newsletter.settings.fromEmail || 'newsletter@buildit.network',
    replyTo: newsletter.settings.replyToEmail,
    newsletterId: newsletter.id,
    requesterPubkey,
  };

  const response = await fetch(`${backendUrl}/api/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((error as { error?: string }).error || `Email delivery failed (${response.status})`);
  }

  return response.json() as Promise<EmailDeliveryStats>;
}
