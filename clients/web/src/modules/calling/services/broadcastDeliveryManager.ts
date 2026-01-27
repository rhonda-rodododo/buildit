/**
 * Broadcast Delivery Manager
 * Handles multi-channel message broadcasts with scheduling and analytics
 */

import { EventEmitter } from 'events';
import {
  BroadcastPriority,
  BroadcastStatus,
  type Broadcast,
  type BroadcastTargetType,
} from '../types';

export interface BroadcastRecipient {
  pubkey: string;
  name?: string;
  phone?: string;
  channel: 'buildit' | 'sms' | 'rcs';
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  deliveredAt?: number;
  readAt?: number;
  repliedAt?: number;
  failureReason?: string;
}

export interface BroadcastState extends Broadcast {
  recipients: BroadcastRecipient[];
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  failedCount: number;
  progress: number;
  estimatedCompletionTime?: number;
}

export interface ScheduledBroadcast {
  broadcast: BroadcastState;
  scheduledFor: number;
  timezone: string;
  repeatConfig?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    endDate?: number;
    daysOfWeek?: number[];
  };
}

// Rate limits
const BUILDIT_BATCH_SIZE = 50;
const SMS_RATE_LIMIT_MS = 1000; // 1 message per second

export class BroadcastDeliveryManager extends EventEmitter {
  private broadcasts: Map<string, BroadcastState> = new Map();
  private scheduledBroadcasts: Map<string, ScheduledBroadcast> = new Map();
  private schedulerInterval?: ReturnType<typeof setInterval>;
  private senderPubkey: string = '';

  constructor() {
    super();
  }

  /**
   * Initialize with sender context
   */
  initialize(senderPubkey: string): void {
    this.senderPubkey = senderPubkey;
    this.startScheduler();
  }

  /**
   * Create a new broadcast draft
   */
  createDraft(data: {
    title: string;
    content: string;
    targetType: BroadcastTargetType;
    targetId?: string;
    priority?: BroadcastPriority;
    recipientPubkeys?: string[];
    attachments?: string[];
    metadata?: Record<string, unknown>;
  }): BroadcastState {
    const broadcastId = crypto.randomUUID();
    const now = Date.now();

    const broadcast: BroadcastState = {
      _v: '1',
      broadcastId,
      hotlineId: data.targetId,
      title: data.title,
      content: data.content,
      targetType: data.targetType,
      targetId: data.targetId,
      priority: data.priority || BroadcastPriority.Normal,
      status: BroadcastStatus.Draft,
      senderPubkey: this.senderPubkey,
      createdBy: this.senderPubkey,
      createdAt: now,
      updatedAt: now,
      attachments: data.attachments,
      metadata: data.metadata,
      recipients: [],
      totalRecipients: data.recipientPubkeys?.length || 0,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      repliedCount: 0,
      failedCount: 0,
      progress: 0,
    };

    // Add recipients if provided
    if (data.recipientPubkeys) {
      broadcast.recipients = data.recipientPubkeys.map((pubkey) => ({
        pubkey,
        channel: 'buildit' as const,
        deliveryStatus: 'pending' as const,
      }));
    }

    this.broadcasts.set(broadcastId, broadcast);
    this.emit('broadcast-created', broadcast);

    return broadcast;
  }

  /**
   * Update a draft broadcast
   */
  updateDraft(
    broadcastId: string,
    updates: Partial<Pick<Broadcast, 'title' | 'content' | 'targetType' | 'priority' | 'attachments'>>
  ): BroadcastState | undefined {
    const broadcast = this.broadcasts.get(broadcastId);
    if (!broadcast || broadcast.status !== 'draft') {
      return undefined;
    }

    Object.assign(broadcast, updates, { updatedAt: Date.now() });
    this.emit('broadcast-updated', broadcast);

    return broadcast;
  }

  /**
   * Set recipients for a broadcast
   */
  setRecipients(
    broadcastId: string,
    recipients: Array<{
      pubkey: string;
      name?: string;
      phone?: string;
      channel?: 'buildit' | 'sms' | 'rcs';
    }>
  ): BroadcastState | undefined {
    const broadcast = this.broadcasts.get(broadcastId);
    if (!broadcast || broadcast.status !== 'draft') {
      return undefined;
    }

    broadcast.recipients = recipients.map((r) => ({
      ...r,
      channel: r.channel || 'buildit',
      deliveryStatus: 'pending' as const,
    }));
    broadcast.totalRecipients = recipients.length;
    broadcast.updatedAt = Date.now();

    this.emit('broadcast-updated', broadcast);
    return broadcast;
  }

  /**
   * Schedule a broadcast for future delivery
   */
  scheduleBroadcast(
    broadcastId: string,
    scheduledFor: number,
    timezone: string = 'UTC',
    repeatConfig?: ScheduledBroadcast['repeatConfig']
  ): ScheduledBroadcast | undefined {
    const broadcast = this.broadcasts.get(broadcastId);
    if (!broadcast || broadcast.status !== BroadcastStatus.Draft) {
      return undefined;
    }

    broadcast.status = BroadcastStatus.Scheduled;
    broadcast.scheduledAt = scheduledFor;
    broadcast.updatedAt = Date.now();

    const scheduled: ScheduledBroadcast = {
      broadcast,
      scheduledFor,
      timezone,
      repeatConfig,
    };

    this.scheduledBroadcasts.set(broadcastId, scheduled);
    this.emit('broadcast-scheduled', scheduled);

    return scheduled;
  }

  /**
   * Cancel a scheduled broadcast
   */
  cancelScheduled(broadcastId: string): boolean {
    const scheduled = this.scheduledBroadcasts.get(broadcastId);
    if (!scheduled) return false;

    scheduled.broadcast.status = BroadcastStatus.Draft;
    scheduled.broadcast.scheduledAt = undefined;
    scheduled.broadcast.updatedAt = Date.now();

    this.scheduledBroadcasts.delete(broadcastId);
    this.emit('broadcast-cancelled', scheduled.broadcast);

    return true;
  }

  /**
   * Send a broadcast immediately
   */
  async sendBroadcast(broadcastId: string): Promise<BroadcastState> {
    const broadcast = this.broadcasts.get(broadcastId);
    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
      throw new Error('Broadcast has already been sent or is in progress');
    }

    // Confirm emergency priority
    if (broadcast.priority === BroadcastPriority.Emergency) {
      // In real implementation, would require additional confirmation
      console.warn('Sending emergency broadcast - this bypasses DND settings');
    }

    broadcast.status = BroadcastStatus.Sending;
    broadcast.sentAt = Date.now();
    broadcast.updatedAt = Date.now();

    this.emit('broadcast-sending', broadcast);

    try {
      await this.deliverToRecipients(broadcast);

      broadcast.status = BroadcastStatus.Sent;
      broadcast.updatedAt = Date.now();
      broadcast.progress = 100;

      this.emit('broadcast-sent', broadcast);
    } catch (error) {
      broadcast.status = BroadcastStatus.Failed;
      broadcast.updatedAt = Date.now();
      broadcast.metadata = {
        ...broadcast.metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      this.emit('broadcast-failed', { broadcast, error });
      throw error;
    }

    return broadcast;
  }

  /**
   * Deliver messages to recipients based on channel
   */
  private async deliverToRecipients(broadcast: BroadcastState): Promise<void> {
    const builtItRecipients = broadcast.recipients.filter((r) => r.channel === 'buildit');
    const smsRecipients = broadcast.recipients.filter((r) => r.channel === 'sms');
    const rcsRecipients = broadcast.recipients.filter((r) => r.channel === 'rcs');

    // Send to BuildIt users in batches
    if (builtItRecipients.length > 0) {
      await this.sendToBuildIt(broadcast, builtItRecipients);
    }

    // Send to SMS recipients with rate limiting
    if (smsRecipients.length > 0) {
      await this.sendToSMS(broadcast, smsRecipients);
    }

    // Send to RCS recipients
    if (rcsRecipients.length > 0) {
      await this.sendToRCS(broadcast, rcsRecipients);
    }
  }

  /**
   * Send to BuildIt users via NIP-17 DMs
   */
  private async sendToBuildIt(
    broadcast: BroadcastState,
    recipients: BroadcastRecipient[]
  ): Promise<void> {
    const batches = this.chunk(recipients, BUILDIT_BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // In real implementation: send NIP-17 encrypted DMs
      await Promise.all(
        batch.map(async (recipient) => {
          try {
            // Simulate sending - actual implementation would:
            // 1. Create NIP-17 gift-wrapped message
            // 2. Send to recipient's preferred relays
            // 3. Handle delivery confirmation
            await this.simulateSend(recipient);

            recipient.deliveryStatus = 'sent';
            recipient.deliveredAt = Date.now();
            broadcast.sentCount++;
            broadcast.deliveredCount++;
          } catch (error) {
            recipient.deliveryStatus = 'failed';
            recipient.failureReason = error instanceof Error ? error.message : 'Unknown error';
            broadcast.failedCount++;
          }
        })
      );

      // Update progress
      broadcast.progress = Math.round(
        ((i + 1) * BUILDIT_BATCH_SIZE / recipients.length) * 100
      );
      this.emit('broadcast-progress', broadcast);
    }
  }

  /**
   * Send to SMS recipients with rate limiting
   */
  private async sendToSMS(
    broadcast: BroadcastState,
    recipients: BroadcastRecipient[]
  ): Promise<void> {
    for (const recipient of recipients) {
      if (!recipient.phone) {
        recipient.deliveryStatus = 'failed';
        recipient.failureReason = 'No phone number';
        broadcast.failedCount++;
        continue;
      }

      try {
        // In real implementation: send via Twilio/SMS gateway
        await this.simulateSend(recipient, SMS_RATE_LIMIT_MS);

        recipient.deliveryStatus = 'sent';
        recipient.deliveredAt = Date.now();
        broadcast.sentCount++;
        broadcast.deliveredCount++;
      } catch (error) {
        recipient.deliveryStatus = 'failed';
        recipient.failureReason = error instanceof Error ? error.message : 'Unknown error';
        broadcast.failedCount++;
      }

      this.emit('broadcast-progress', broadcast);
    }
  }

  /**
   * Send to RCS recipients
   */
  private async sendToRCS(
    broadcast: BroadcastState,
    recipients: BroadcastRecipient[]
  ): Promise<void> {
    // Similar to SMS but via RCS gateway
    for (const recipient of recipients) {
      try {
        await this.simulateSend(recipient, SMS_RATE_LIMIT_MS);

        recipient.deliveryStatus = 'sent';
        recipient.deliveredAt = Date.now();
        broadcast.sentCount++;
        broadcast.deliveredCount++;
      } catch (error) {
        recipient.deliveryStatus = 'failed';
        recipient.failureReason = error instanceof Error ? error.message : 'Unknown error';
        broadcast.failedCount++;
      }

      this.emit('broadcast-progress', broadcast);
    }
  }

  /**
   * Simulate sending a message (placeholder for actual implementation)
   */
  private async simulateSend(
    _recipient: BroadcastRecipient,
    delayMs: number = 0
  ): Promise<void> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    // In real implementation: actually send the message
  }

  /**
   * Handle delivery receipt
   */
  handleDeliveryReceipt(
    broadcastId: string,
    recipientPubkey: string,
    status: 'delivered' | 'read' | 'replied'
  ): void {
    const broadcast = this.broadcasts.get(broadcastId);
    if (!broadcast) return;

    const recipient = broadcast.recipients.find((r) => r.pubkey === recipientPubkey);
    if (!recipient) return;

    const now = Date.now();

    switch (status) {
      case 'delivered':
        if (recipient.deliveryStatus === 'sent') {
          recipient.deliveryStatus = 'delivered';
          recipient.deliveredAt = now;
          broadcast.deliveredCount++;
        }
        break;
      case 'read':
        if (!recipient.readAt) {
          recipient.readAt = now;
          broadcast.readCount++;
        }
        break;
      case 'replied':
        if (!recipient.repliedAt) {
          recipient.repliedAt = now;
          broadcast.repliedCount++;
        }
        break;
    }

    broadcast.updatedAt = now;
    this.emit('broadcast-receipt', { broadcast, recipient, status });
  }

  /**
   * Get broadcast by ID
   */
  get(broadcastId: string): BroadcastState | undefined {
    return this.broadcasts.get(broadcastId);
  }

  /**
   * Get all broadcasts
   */
  getAll(): BroadcastState[] {
    return Array.from(this.broadcasts.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }

  /**
   * Get broadcasts by status
   */
  getByStatus(status: BroadcastStatus): BroadcastState[] {
    return this.getAll().filter((b) => b.status === status);
  }

  /**
   * Get analytics for a broadcast
   */
  getAnalytics(broadcastId: string): {
    deliveryRate: number;
    readRate: number;
    replyRate: number;
    avgDeliveryTime: number;
    avgReadTime: number;
  } | undefined {
    const broadcast = this.broadcasts.get(broadcastId);
    if (!broadcast) return undefined;

    const deliveryRate = broadcast.totalRecipients > 0
      ? (broadcast.deliveredCount / broadcast.totalRecipients) * 100
      : 0;

    const readRate = broadcast.deliveredCount > 0
      ? (broadcast.readCount / broadcast.deliveredCount) * 100
      : 0;

    const replyRate = broadcast.deliveredCount > 0
      ? (broadcast.repliedCount / broadcast.deliveredCount) * 100
      : 0;

    // Calculate average delivery time
    const deliveryTimes = broadcast.recipients
      .filter((r) => r.deliveredAt && broadcast.sentAt)
      .map((r) => r.deliveredAt! - broadcast.sentAt!);
    const avgDeliveryTime = deliveryTimes.length
      ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
      : 0;

    // Calculate average read time
    const readTimes = broadcast.recipients
      .filter((r) => r.readAt && r.deliveredAt)
      .map((r) => r.readAt! - r.deliveredAt!);
    const avgReadTime = readTimes.length
      ? readTimes.reduce((a, b) => a + b, 0) / readTimes.length
      : 0;

    return {
      deliveryRate,
      readRate,
      replyRate,
      avgDeliveryTime,
      avgReadTime,
    };
  }

  /**
   * Delete a broadcast (only drafts)
   */
  delete(broadcastId: string): boolean {
    const broadcast = this.broadcasts.get(broadcastId);
    if (!broadcast || broadcast.status !== 'draft') {
      return false;
    }

    this.broadcasts.delete(broadcastId);
    this.scheduledBroadcasts.delete(broadcastId);
    this.emit('broadcast-deleted', broadcastId);

    return true;
  }

  /**
   * Start the scheduler for scheduled broadcasts
   */
  private startScheduler(): void {
    if (this.schedulerInterval) return;

    this.schedulerInterval = setInterval(() => {
      this.checkScheduledBroadcasts();
    }, 60000); // Check every minute
  }

  /**
   * Stop the scheduler
   */
  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }
  }

  /**
   * Check and send due scheduled broadcasts
   */
  private async checkScheduledBroadcasts(): Promise<void> {
    const now = Date.now();

    for (const [broadcastId, scheduled] of this.scheduledBroadcasts) {
      if (scheduled.scheduledFor <= now) {
        try {
          await this.sendBroadcast(broadcastId);

          // Handle repeat if configured
          if (scheduled.repeatConfig) {
            const nextTime = this.calculateNextScheduleTime(scheduled);
            if (nextTime) {
              scheduled.scheduledFor = nextTime;
              scheduled.broadcast.scheduledAt = nextTime;
              scheduled.broadcast.status = BroadcastStatus.Scheduled;
            } else {
              this.scheduledBroadcasts.delete(broadcastId);
            }
          } else {
            this.scheduledBroadcasts.delete(broadcastId);
          }
        } catch (error) {
          console.error(`Failed to send scheduled broadcast ${broadcastId}:`, error);
        }
      }
    }
  }

  /**
   * Calculate next schedule time for recurring broadcasts
   */
  private calculateNextScheduleTime(scheduled: ScheduledBroadcast): number | null {
    if (!scheduled.repeatConfig) return null;

    const { frequency, endDate, daysOfWeek } = scheduled.repeatConfig;
    const currentDate = new Date(scheduled.scheduledFor);
    let nextDate: Date;

    switch (frequency) {
      case 'daily':
        nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate = new Date(currentDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      default:
        return null;
    }

    // Handle specific days of week
    if (daysOfWeek && daysOfWeek.length > 0) {
      while (!daysOfWeek.includes(nextDate.getDay())) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
    }

    // Check end date
    if (endDate && nextDate.getTime() > endDate) {
      return null;
    }

    return nextDate.getTime();
  }

  /**
   * Utility: chunk array into batches
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Singleton instance
export const broadcastDeliveryManager = new BroadcastDeliveryManager();
