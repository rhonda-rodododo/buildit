/**
 * Traffic Shaping: Message Batching & Padding
 *
 * Provides traffic analysis resistance through two mechanisms:
 *
 * 1. **Message Batching**: Instead of sending messages immediately, they are
 *    queued and sent at fixed intervals. This prevents timing-based correlation
 *    of message activity patterns.
 *
 * 2. **Message Padding**: All outgoing messages are padded to uniform sizes
 *    (nearest power of 2) using cryptographically random bytes. This prevents
 *    size-based traffic analysis.
 *
 * SECURITY NOTES:
 * - Batching interval is configurable (default 30s) to balance latency vs privacy
 * - Immediate flush on batch size > 10 or app close/background
 * - Users can disable batching for real-time needs (reduces privacy)
 * - Outer padding is applied BEFORE NIP-44 encryption (NIP-44 has its own inner padding)
 * - The receiver strips the outer padding envelope before processing
 *
 * This feature is OPT-IN via privacy settings.
 */

import { logger } from '@/lib/logger';

/**
 * Padding bucket sizes (power of 2)
 * Messages are padded to the smallest bucket that fits
 */
const PADDING_BUCKETS = [256, 512, 1024, 2048, 4096, 8192] as const;

/**
 * Outer padding envelope markers
 * Format: MARKER + 5-digit content length + content + random padding
 */
const OUTER_PAD_MARKER = '\x00OPAD\x00';
const OUTER_PAD_HEADER_SIZE = OUTER_PAD_MARKER.length + 5;

/**
 * Configuration for traffic shaping
 */
export interface TrafficShapingConfig {
  /** Whether batching is enabled (default: true) */
  batchingEnabled: boolean;
  /** Batch interval in milliseconds (default: 30000 = 30s) */
  batchIntervalMs: number;
  /** Maximum batch size before forced flush (default: 10) */
  maxBatchSize: number;
  /** Whether outer padding is enabled (default: true) */
  paddingEnabled: boolean;
}

/**
 * Default traffic shaping configuration
 */
export const DEFAULT_TRAFFIC_SHAPING_CONFIG: TrafficShapingConfig = {
  batchingEnabled: true,
  batchIntervalMs: 30_000,
  maxBatchSize: 10,
  paddingEnabled: true,
};

/**
 * A queued message waiting to be sent
 */
interface QueuedMessage {
  id: string;
  content: string;
  recipientPubkeys: string[];
  tags: string[][];
  conversationId: string;
  timestamp: number;
  resolve: (value: void) => void;
  reject: (reason: Error) => void;
}

/**
 * Callback type for sending a batch of messages
 */
export type BatchSendCallback = (messages: Array<{
  content: string;
  recipientPubkeys: string[];
  tags: string[][];
  conversationId: string;
}>) => Promise<void>;

/**
 * Traffic Shaping Manager
 * Handles message batching and padding
 */
class TrafficShapingManager {
  private config: TrafficShapingConfig = { ...DEFAULT_TRAFFIC_SHAPING_CONFIG };
  private messageQueue: QueuedMessage[] = [];
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private sendCallback: BatchSendCallback | null = null;
  private isRunning = false;
  private messageCounter = 0;

  /**
   * Start the traffic shaping manager
   * @param sendCallback - Function to call when a batch is ready to send
   * @param config - Optional configuration override
   */
  start(
    sendCallback: BatchSendCallback,
    config?: Partial<TrafficShapingConfig>
  ): void {
    if (this.isRunning) {
      this.stop();
    }

    this.sendCallback = sendCallback;

    if (config) {
      this.config = { ...DEFAULT_TRAFFIC_SHAPING_CONFIG, ...config };
    }

    this.isRunning = true;

    if (this.config.batchingEnabled) {
      this.startBatchTimer();
    }

    // Flush on visibility change (app going to background)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }

    logger.info('Traffic shaping manager started', {
      batching: this.config.batchingEnabled,
      interval: this.config.batchIntervalMs,
      padding: this.config.paddingEnabled,
    });
  }

  /**
   * Stop the traffic shaping manager
   * Flushes any remaining messages before stopping
   */
  async stop(): Promise<void> {
    // Flush remaining messages
    if (this.messageQueue.length > 0) {
      await this.flushBatch();
    }

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }

    this.isRunning = false;
    this.sendCallback = null;
    logger.info('Traffic shaping manager stopped');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TrafficShapingConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart batch timer if interval changed
    if (this.isRunning && this.config.batchingEnabled) {
      if (this.batchTimer) {
        clearInterval(this.batchTimer);
      }
      this.startBatchTimer();
    } else if (this.isRunning && !this.config.batchingEnabled) {
      if (this.batchTimer) {
        clearInterval(this.batchTimer);
        this.batchTimer = null;
      }
    }
  }

  /**
   * Queue a message for sending
   * If batching is disabled, sends immediately
   * Returns a promise that resolves when the message is actually sent
   */
  async queueMessage(
    content: string,
    recipientPubkeys: string[],
    tags: string[][],
    conversationId: string
  ): Promise<void> {
    // Apply outer padding if enabled
    const paddedContent = this.config.paddingEnabled
      ? addOuterPadding(content)
      : content;

    if (!this.config.batchingEnabled) {
      // Send immediately (no batching)
      if (this.sendCallback) {
        await this.sendCallback([{
          content: paddedContent,
          recipientPubkeys,
          tags,
          conversationId,
        }]);
      }
      return;
    }

    // Queue the message
    return new Promise<void>((resolve, reject) => {
      this.messageQueue.push({
        id: `batch-${++this.messageCounter}`,
        content: paddedContent,
        recipientPubkeys,
        tags,
        conversationId,
        timestamp: Date.now(),
        resolve,
        reject,
      });

      // Force flush if batch is full
      if (this.messageQueue.length >= this.config.maxBatchSize) {
        this.flushBatch().catch((err) => {
          logger.warn('Batch flush error:', err);
        });
      }
    });
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Get current configuration
   */
  getConfig(): TrafficShapingConfig {
    return { ...this.config };
  }

  /**
   * Flush all queued messages immediately
   */
  async flushBatch(): Promise<void> {
    if (this.messageQueue.length === 0 || !this.sendCallback) {
      return;
    }

    // Take all queued messages
    const batch = [...this.messageQueue];
    this.messageQueue = [];

    try {
      // Send the batch
      await this.sendCallback(
        batch.map((msg) => ({
          content: msg.content,
          recipientPubkeys: msg.recipientPubkeys,
          tags: msg.tags,
          conversationId: msg.conversationId,
        }))
      );

      // Resolve all promises
      batch.forEach((msg) => msg.resolve());

      logger.info(`Flushed batch of ${batch.length} messages`);
    } catch (err) {
      // Reject all promises
      const error = err instanceof Error ? err : new Error('Batch send failed');
      batch.forEach((msg) => msg.reject(error));
      logger.warn('Batch send failed:', err);
    }
  }

  // --- Private methods ---

  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      if (this.messageQueue.length > 0) {
        this.flushBatch().catch((err) => {
          logger.warn('Scheduled batch flush error:', err);
        });
      }
    }, this.config.batchIntervalMs);
  }

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden' && this.messageQueue.length > 0) {
      this.flushBatch().catch((err) => {
        logger.warn('Visibility change flush error:', err);
      });
    }
  };

  private handleBeforeUnload = (): void => {
    // Synchronous flush attempt - best effort
    if (this.messageQueue.length > 0 && this.sendCallback) {
      // We can't await here, but try to start the send
      this.flushBatch().catch(() => {
        // Can't do much during unload
      });
    }
  };
}

// --- Padding Functions ---

/**
 * Generate random padding string of specified length
 * Uses cryptographically secure randomness
 */
function generateRandomPadding(length: number): string {
  if (length <= 0) return '';

  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  // Convert to printable ASCII for safe transport
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let padding = '';
  for (let i = 0; i < length; i++) {
    padding += chars[randomBytes[i] % chars.length];
  }
  return padding;
}

/**
 * Find the smallest bucket size that fits the given total size
 */
function findPaddingBucket(totalSize: number): number {
  for (const bucket of PADDING_BUCKETS) {
    if (totalSize <= bucket) {
      return bucket;
    }
  }
  // If content exceeds largest bucket, use largest
  return PADDING_BUCKETS[PADDING_BUCKETS.length - 1];
}

/**
 * Add outer padding to a message
 *
 * This is applied BEFORE NIP-44 encryption as an additional layer.
 * NIP-44 has its own inner padding, but this outer layer provides
 * fixed bucket sizes that are harder to correlate.
 *
 * Format: MARKER + content_length (5 digits) + content + random_padding
 */
export function addOuterPadding(content: string): string {
  const totalContentSize = OUTER_PAD_HEADER_SIZE + content.length;
  const bucket = findPaddingBucket(totalContentSize);
  const paddingNeeded = bucket - totalContentSize;
  const padding = generateRandomPadding(paddingNeeded);

  return `${OUTER_PAD_MARKER}${content.length.toString().padStart(5, '0')}${content}${padding}`;
}

/**
 * Remove outer padding from a message
 *
 * Handles both padded (with OPAD marker) and unpadded messages gracefully.
 */
export function removeOuterPadding(paddedContent: string): string {
  if (!paddedContent.startsWith(OUTER_PAD_MARKER)) {
    return paddedContent; // Not padded, return as-is
  }

  const markerEnd = OUTER_PAD_MARKER.length;
  const contentLengthStr = paddedContent.slice(markerEnd, markerEnd + 5);
  const contentLength = parseInt(contentLengthStr, 10);

  if (isNaN(contentLength) || contentLength < 0 || contentLength > 65536) {
    logger.warn('Invalid outer padding content length');
    return paddedContent;
  }

  const contentStart = markerEnd + 5;
  return paddedContent.slice(contentStart, contentStart + contentLength);
}

/**
 * Singleton instance
 */
export const trafficShapingManager = new TrafficShapingManager();
