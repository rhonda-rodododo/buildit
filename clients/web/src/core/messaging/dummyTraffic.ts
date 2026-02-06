/**
 * Dummy Traffic Generator
 *
 * Generates fake Nostr events at configurable intervals to provide
 * traffic analysis resistance. Dummy messages are NIP-17 gift-wrapped
 * to the user themselves, making them indistinguishable from real
 * traffic at the relay level.
 *
 * SECURITY:
 * - Dummy events use the same NIP-17 gift wrap flow as real messages
 * - Events are wrapped with ephemeral keys (relays see identical structure)
 * - A special flag inside the encrypted envelope identifies dummy messages
 * - Only the recipient (self) can distinguish dummy from real traffic
 * - Battery-aware: reduces or pauses on low battery
 * - Configurable volume levels: off, low, medium, high
 *
 * This feature is OPT-IN via privacy settings.
 */

import { createPrivateDM } from '@/core/crypto/nip17';
import { getNostrClient } from '@/core/nostr/client';
import { getCurrentPrivateKey } from '@/stores/authStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/lib/logger';

/**
 * Dummy traffic volume levels
 */
export type DummyTrafficLevel = 'off' | 'low' | 'medium' | 'high';

/**
 * Interval mappings for each level (in milliseconds)
 */
const LEVEL_INTERVALS: Record<Exclude<DummyTrafficLevel, 'off'>, number> = {
  low: 10 * 60 * 1000,    // 1 dummy message per 10 minutes
  medium: 5 * 60 * 1000,  // 1 per 5 minutes
  high: 60 * 1000,        // 1 per minute
};

/**
 * Battery threshold for reducing dummy traffic
 * When battery drops below this level, traffic is reduced by half
 */
const LOW_BATTERY_THRESHOLD = 0.2; // 20%

/**
 * Critical battery threshold - stop dummy traffic entirely
 */
const CRITICAL_BATTERY_THRESHOLD = 0.1; // 10%

/**
 * Dummy message content marker (inside encrypted envelope)
 * This is placed in the message content so the receiver can identify
 * and discard dummy messages. The marker is inside the NIP-44 encrypted
 * payload, so it's invisible to relays.
 */
const DUMMY_MARKER = '\x00BUILDIT_DUMMY\x00';

/**
 * Pool of fake message patterns for realistic appearance
 * These are never seen by anyone - they just need to produce
 * realistic-looking encrypted payload sizes
 */
const FAKE_CONTENT_POOL = [
  'Hey, are you free tomorrow?',
  'Thanks for the update!',
  'Can you send me that file?',
  'Sounds good, let me know.',
  'I\'ll be there at 3pm.',
  'Did you see the latest news?',
  'Let\'s catch up this week.',
  'Working on it now.',
  'Almost done with the project.',
  'Can you review this when you get a chance?',
  'I agree with the proposal.',
  'Let me check and get back to you.',
  'Great idea! Let\'s discuss more.',
  'I\'ll send the details later.',
  'Meeting rescheduled to Friday.',
];

/**
 * Dummy Traffic Generator Service
 */
export class DummyTrafficGenerator {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private level: DummyTrafficLevel = 'off';
  private isRunning = false;
  private batteryLevel: number = 1.0;
  private isCharging: boolean = true;
  private batteryManager: BatteryManager | null = null;

  /**
   * Start generating dummy traffic at the specified level
   */
  async start(level: DummyTrafficLevel): Promise<void> {
    this.stop(); // Stop any existing generation
    this.level = level;

    if (level === 'off') {
      return;
    }

    this.isRunning = true;

    // Initialize battery monitoring
    await this.initBatteryMonitoring();

    // Schedule first dummy message with jitter
    this.scheduleNext();

    logger.info(`Dummy traffic generator started: level=${level}`);
  }

  /**
   * Stop generating dummy traffic
   */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.level = 'off';
    logger.info('Dummy traffic generator stopped');
  }

  /**
   * Update the traffic level
   */
  async setLevel(level: DummyTrafficLevel): Promise<void> {
    if (level === this.level) return;

    if (level === 'off') {
      this.stop();
      return;
    }

    if (!this.isRunning) {
      await this.start(level);
    } else {
      this.level = level;
      // Reschedule with new interval
      if (this.timer) {
        clearTimeout(this.timer);
      }
      this.scheduleNext();
    }
  }

  /**
   * Get current level
   */
  getLevel(): DummyTrafficLevel {
    return this.level;
  }

  /**
   * Check if dummy traffic is actively generating
   */
  isActive(): boolean {
    return this.isRunning && this.level !== 'off';
  }

  /**
   * Check if a received message is a dummy message
   * Called by the message receiver to discard dummy messages
   */
  static isDummyMessage(content: string): boolean {
    return content.includes(DUMMY_MARKER);
  }

  // --- Private methods ---

  /**
   * Schedule the next dummy message with random jitter
   * Jitter prevents fixed-interval pattern detection
   */
  private scheduleNext(): void {
    if (!this.isRunning || this.level === 'off') return;

    let interval = LEVEL_INTERVALS[this.level];

    // Apply battery-aware adjustments
    interval = this.adjustForBattery(interval);

    // Add random jitter: +/- 30% of the interval
    const jitter = interval * 0.3;
    const randomJitter = (Math.random() * 2 - 1) * jitter;
    const finalInterval = Math.max(10_000, interval + randomJitter); // Minimum 10s

    this.timer = setTimeout(() => {
      this.generateDummyMessage().then(() => {
        if (this.isRunning) {
          this.scheduleNext();
        }
      }).catch((err) => {
        logger.warn('Failed to generate dummy message:', err);
        if (this.isRunning) {
          this.scheduleNext();
        }
      });
    }, finalInterval);
  }

  /**
   * Adjust interval based on battery level
   */
  private adjustForBattery(interval: number): number {
    if (this.isCharging) {
      return interval; // No adjustment when charging
    }

    if (this.batteryLevel <= CRITICAL_BATTERY_THRESHOLD) {
      // Critical battery - effectively stop by using very long interval
      return interval * 100; // ~100x longer
    }

    if (this.batteryLevel <= LOW_BATTERY_THRESHOLD) {
      // Low battery - halve the frequency
      return interval * 2;
    }

    return interval;
  }

  /**
   * Generate and publish a dummy message
   */
  private async generateDummyMessage(): Promise<void> {
    const privateKey = getCurrentPrivateKey();
    const identity = useAuthStore.getState().currentIdentity;

    if (!privateKey || !identity) {
      logger.warn('Cannot generate dummy traffic: not authenticated');
      return;
    }

    // Generate realistic-looking fake content
    const fakeContent = this.generateFakeContent();

    // Wrap the dummy content with the marker
    // The marker is inside the encrypted payload, invisible to relays
    const dummyContent = `${DUMMY_MARKER}${fakeContent}`;

    try {
      // Create a NIP-17 gift-wrapped message to SELF
      // This looks identical to real messages from the relay's perspective
      const giftWrap = createPrivateDM(
        dummyContent,
        privateKey,
        identity.publicKey, // Send to self
        [['dummy', 'true']] // Tag inside encrypted envelope (invisible to relay)
      );

      // Publish to relay
      const client = getNostrClient();
      await client.publish(giftWrap);

      logger.info('Dummy traffic event published');
    } catch (err) {
      logger.warn('Failed to publish dummy traffic:', err);
    }
  }

  /**
   * Generate fake message content with random selection and padding
   */
  private generateFakeContent(): string {
    // Pick a random message from the pool
    const randomBytes = new Uint8Array(2);
    crypto.getRandomValues(randomBytes);
    const index = (randomBytes[0] * 256 + randomBytes[1]) % FAKE_CONTENT_POOL.length;
    const baseContent = FAKE_CONTENT_POOL[index];

    // Add random padding to vary the size
    const extraPadding = randomBytes[0] % 100; // 0-99 extra chars
    const padding = Array.from(
      crypto.getRandomValues(new Uint8Array(extraPadding)),
      (b) => String.fromCharCode(97 + (b % 26))
    ).join('');

    return baseContent + (padding ? ' ' + padding : '');
  }

  /**
   * Initialize Battery API monitoring if available
   */
  private async initBatteryMonitoring(): Promise<void> {
    try {
      if ('getBattery' in navigator) {
        this.batteryManager = await (navigator as NavigatorWithBattery).getBattery();

        this.batteryLevel = this.batteryManager.level;
        this.isCharging = this.batteryManager.charging;

        // Listen for battery changes
        this.batteryManager.addEventListener('levelchange', () => {
          if (this.batteryManager) {
            this.batteryLevel = this.batteryManager.level;
          }
        });

        this.batteryManager.addEventListener('chargingchange', () => {
          if (this.batteryManager) {
            this.isCharging = this.batteryManager.charging;
          }
        });

        logger.info(`Battery monitoring initialized: ${Math.round(this.batteryLevel * 100)}%, charging: ${this.isCharging}`);
      }
    } catch {
      // Battery API not available - assume plugged in
      logger.info('Battery API not available, dummy traffic will run at full rate');
    }
  }
}

/**
 * Battery Manager interface (not in all TypeScript lib definitions)
 */
interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  addEventListener(type: 'levelchange' | 'chargingchange', listener: () => void): void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery(): Promise<BatteryManager>;
}

/**
 * Singleton instance
 */
export const dummyTrafficGenerator = new DummyTrafficGenerator();
