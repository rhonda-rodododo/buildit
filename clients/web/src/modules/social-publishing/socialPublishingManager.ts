/**
 * Social Publishing Manager
 *
 * Business logic for scheduling content, creating share links,
 * managing cross-posting, and coordinating with the federation worker.
 *
 * Privacy design:
 * - Pre-signs Nostr events client-side (server never has private keys)
 * - Share link QR codes generated client-side (no external QR services)
 * - No third-party tracking scripts or SDKs
 * - Analytics are session-based, no user identification
 */

import { nanoid } from 'nanoid';
import { logger } from '@/lib/logger';
import { useSocialPublishingStore } from './socialPublishingStore';
import type {
  ScheduledContent,
  ShareLink,
  ContentCalendarEntry,
  ScheduleContentInput,
  CreateShareLinkInput,
} from './types';
import { SOCIAL_PUBLISHING_SCHEMA_VERSION } from './types';

const FEDERATION_WORKER_URL = 'https://buildit-federation.workers.dev';

/**
 * Social Publishing Manager
 * Handles business logic for scheduling, sharing, and cross-posting
 */
export class SocialPublishingManager {
  private static instance: SocialPublishingManager | null = null;

  static getInstance(): SocialPublishingManager {
    if (!this.instance) {
      this.instance = new SocialPublishingManager();
    }
    return this.instance;
  }

  // ── Scheduling ──────────────────────────────────────────────────

  /**
   * Schedule content for future publishing.
   * Pre-signs the Nostr event client-side, then sends to server-side scheduler.
   */
  async scheduleContent(
    input: ScheduleContentInput,
    creatorPubkey: string,
    signedEventJson?: string,
  ): Promise<ScheduledContent> {
    const store = useSocialPublishingStore.getState();
    const now = Math.floor(Date.now() / 1000);
    const scheduledAtUnix = Math.floor(input.scheduledAt.getTime() / 1000);

    const scheduledContent: ScheduledContent = {
      _v: SOCIAL_PUBLISHING_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      sourceModule: input.sourceModule,
      sourceContentId: input.sourceContentId,
      scheduledAt: scheduledAtUnix,
      status: 'pending',
      crossPostConfig: {
        _v: SOCIAL_PUBLISHING_SCHEMA_VERSION,
        platforms: input.platforms.map((p) => ({
          _v: SOCIAL_PUBLISHING_SCHEMA_VERSION,
          platform: p.platform,
          enabled: p.enabled,
          customContent: p.customContent,
          status: 'pending' as const,
        })),
      },
      ...(signedEventJson && { signedEvent: signedEventJson }),
      ...(input.recurrence && {
        recurrence: {
          frequency: input.recurrence.frequency,
          interval: input.recurrence.interval ?? 1,
          count: input.recurrence.count,
          ...(input.recurrence.until && {
            until: Math.floor(input.recurrence.until.getTime() / 1000),
          }),
          byDay: input.recurrence.byDay,
        },
      }),
      retryCount: 0,
      createdBy: creatorPubkey,
      createdAt: now,
    };

    // Store locally
    store.addScheduledContent(scheduledContent);

    // Also add to calendar
    const calendarEntry: ContentCalendarEntry = {
      _v: SOCIAL_PUBLISHING_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      sourceModule: input.sourceModule,
      sourceContentId: input.sourceContentId,
      title: input.sourceContentId, // Will be enriched by integrations
      scheduledAt: scheduledAtUnix,
      status: 'pending',
      platforms: input.platforms
        .filter((p) => p.enabled)
        .map((p) => p.platform),
    };
    store.addCalendarEntry(calendarEntry);

    // Send to server-side scheduler if online
    if (signedEventJson) {
      try {
        await this.sendToServerScheduler(scheduledContent);
      } catch (error) {
        logger.warn('Failed to send to server scheduler, will retry', { error });
        // Content remains in local store for offline-first fallback
      }
    }

    logger.info('Content scheduled', {
      id: scheduledContent.id,
      sourceModule: input.sourceModule,
      scheduledAt: new Date(scheduledAtUnix * 1000).toISOString(),
    });

    return scheduledContent;
  }

  /**
   * Cancel a scheduled content item.
   */
  async cancelSchedule(id: string): Promise<void> {
    const store = useSocialPublishingStore.getState();
    store.updateScheduledContent(id, { status: 'cancelled' });

    // Also cancel on server
    try {
      await fetch(`${FEDERATION_WORKER_URL}/api/schedule/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      logger.warn('Failed to cancel on server', { error });
    }

    logger.info('Scheduled content cancelled', { id });
  }

  /**
   * Send scheduled content to the server-side scheduler.
   * The server stores the pre-signed event and wakes up at the right time.
   */
  private async sendToServerScheduler(content: ScheduledContent): Promise<void> {
    const hasCrossPostAP = content.crossPostConfig?.platforms.some(
      (p) => p.platform === 'activitypub' && p.enabled
    );
    const hasCrossPostAT = content.crossPostConfig?.platforms.some(
      (p) => p.platform === 'atproto' && p.enabled
    );

    const response = await fetch(`${FEDERATION_WORKER_URL}/api/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: content.id,
        nostrPubkey: content.createdBy,
        scheduledAt: content.scheduledAt,
        signedEvent: content.signedEvent,
        crossPostAP: hasCrossPostAP ? 1 : 0,
        crossPostAT: hasCrossPostAT ? 1 : 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server scheduler returned ${response.status}`);
    }
  }

  // ── Share Links ─────────────────────────────────────────────────

  /**
   * Create a share link for content.
   * Slugs are generated client-side with nanoid (no external services).
   */
  async createShareLink(
    input: CreateShareLinkInput,
    creatorPubkey: string,
  ): Promise<ShareLink> {
    const store = useSocialPublishingStore.getState();
    const now = Math.floor(Date.now() / 1000);

    const slug = input.customSlug || nanoid(8);

    const shareLink: ShareLink = {
      _v: SOCIAL_PUBLISHING_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      slug,
      sourceModule: input.sourceModule,
      sourceContentId: input.sourceContentId,
      targetUrl: `https://buildit.network/${input.sourceModule}/${input.sourceContentId}`,
      trackClicks: input.trackClicks ?? true,
      clickCount: 0,
      isActive: true,
      createdBy: creatorPubkey,
      createdAt: now,
      ...(input.expiresAt && {
        expiresAt: Math.floor(input.expiresAt.getTime() / 1000),
      }),
      ...(input.seoOverrides && {
        seoOverrides: {
          _v: SOCIAL_PUBLISHING_SCHEMA_VERSION,
          ...input.seoOverrides,
        },
      }),
    };

    // Note: password hashing would happen via Tauri crypto commands
    // (Argon2id via the Rust backend). Omitted here for now.

    store.addShareLink(shareLink);

    logger.info('Share link created', {
      slug,
      sourceModule: input.sourceModule,
    });

    return shareLink;
  }

  /**
   * Deactivate a share link.
   */
  deactivateShareLink(id: string): void {
    const store = useSocialPublishingStore.getState();
    store.updateShareLink(id, { isActive: false });
  }

  /**
   * Get the full share URL for a link.
   */
  getShareUrl(slug: string): string {
    return `https://buildit.network/s/${slug}`;
  }

  /**
   * Generate a QR code data URL client-side.
   * Uses a simple SVG-based QR generation — no external services.
   */
  async generateQRCode(url: string): Promise<string> {
    // Use dynamic import to keep bundle small
    try {
      const QRCode = await import('qrcode');
      return await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
    } catch {
      // Fallback: return a simple SVG placeholder
      logger.warn('QR code generation failed, using placeholder');
      return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
          <rect width="256" height="256" fill="white"/>
          <text x="128" y="128" text-anchor="middle" fill="#64748b" font-size="14">QR Code</text>
          <text x="128" y="148" text-anchor="middle" fill="#94a3b8" font-size="10">${url}</text>
        </svg>`
      )}`;
    }
  }

  // ── Platform Share URLs ──────────────────────────────────────────
  // These are plain URL-based share links. No third-party SDKs,
  // no tracking scripts, no widgets. Just window.open() with a URL.

  /**
   * Get share URL for Mastodon (user's instance).
   * Opens the native compose dialog — no SDK or tracking.
   */
  getMastodonShareUrl(text: string, url: string): string {
    // Mastodon share intent — user enters their own instance
    return `https://mastodonshare.com/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  }

  /**
   * Get share URL for Bluesky.
   * Opens native compose — no SDK or tracking.
   */
  getBlueskyShareUrl(text: string, url: string): string {
    return `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text}\n${url}`)}`;
  }

  /**
   * Get mailto: link for email sharing.
   * Opens the user's email client — no external service.
   */
  getEmailShareUrl(subject: string, body: string, url: string): string {
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\n${url}`)}`;
  }

  /**
   * Copy URL to clipboard.
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        return true;
      } catch {
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  // ── Calendar ────────────────────────────────────────────────────

  /**
   * Get calendar entries for a date range, aggregating from all modules.
   */
  getCalendarEntries(startDate: Date, endDate: Date): ContentCalendarEntry[] {
    const store = useSocialPublishingStore.getState();
    const startUnix = Math.floor(startDate.getTime() / 1000);
    const endUnix = Math.floor(endDate.getTime() / 1000);
    return store.getCalendarEntriesInRange(startUnix, endUnix);
  }

  /**
   * Reschedule a calendar entry by updating the scheduledAt timestamp.
   */
  rescheduleEntry(id: string, newDate: Date): void {
    const store = useSocialPublishingStore.getState();
    const newScheduledAt = Math.floor(newDate.getTime() / 1000);
    store.updateCalendarEntry(id, { scheduledAt: newScheduledAt });

    // Also update the corresponding scheduled content
    const entry = store.calendarEntries.find((e) => e.id === id);
    if (entry) {
      const scheduled = store.scheduledContent.find(
        (s) => s.sourceModule === entry.sourceModule && s.sourceContentId === entry.sourceContentId
      );
      if (scheduled) {
        store.updateScheduledContent(scheduled.id, { scheduledAt: newScheduledAt });
      }
    }
  }
}

/**
 * Get the social publishing manager instance.
 */
export function getSocialPublishingManager(): SocialPublishingManager {
  return SocialPublishingManager.getInstance();
}
