import { SimplePool, type Event as NostrEvent, type Filter, mergeFilters } from 'nostr-tools'
import type { SubCloser } from 'nostr-tools/abstract-pool'
import type { RelayConfig, RelayStatus, Subscription, PublishResult } from '@/types/nostr'
import { secureRandomString, secureRandomInt } from '@/lib/utils'

/**
 * Message priority levels for the queue
 * - high: Time-sensitive messages (bypass queue delay, but still use relay mixing)
 * - normal: Standard messages (full queue delay + relay mixing)
 * - low: Background messages (longer delays acceptable)
 */
export type MessagePriority = 'high' | 'normal' | 'low'

/**
 * Configuration for relay mixing and timing obfuscation
 */
export interface RelayMixingConfig {
  /** Number of relays to select per message (default: 3) */
  relaySelectionCount: number
  /** Minimum relays for critical messages like DMs (default: 2) */
  minRelaysForCritical: number
  /** Enable relay mixing (default: true) */
  enabled: boolean
}

/**
 * Configuration for message timing obfuscation
 */
export interface TimingObfuscationConfig {
  /** Minimum delay between relay sends in ms (default: 100) */
  minRelayDelay: number
  /** Maximum delay between relay sends in ms (default: 500) */
  maxRelayDelay: number
  /** Minimum queue delay before publishing in ms (default: 1000) */
  minQueueDelay: number
  /** Maximum queue delay before publishing in ms (default: 30000) */
  maxQueueDelay: number
  /** Minimum delay between processing queued messages in ms (default: 500) */
  minInterMessageDelay: number
  /** Maximum delay between processing queued messages in ms (default: 2000) */
  maxInterMessageDelay: number
  /** Enable timing obfuscation (default: true) */
  enabled: boolean
}

/**
 * Configuration for subscription filter obfuscation
 * Protects against social graph analysis via subscription patterns
 */
export interface SubscriptionObfuscationConfig {
  /** Enable subscription obfuscation (default: true) */
  enabled: boolean
  /** Use broad filters and filter locally (default: true) */
  broadFilteringEnabled: boolean
  /** Send different filter subsets to different relays (default: true) */
  filterDiffusionEnabled: boolean
  /** Add dummy subscriptions to obscure real interests (default: true) */
  dummySubscriptionsEnabled: boolean
  /** Number of dummy pubkeys to add to author filters (default: 5) */
  dummyPubkeyCount: number
  /** Number of dummy event IDs to add to ID filters (default: 3) */
  dummyEventIdCount: number
  /** Percentage of real filter elements to send per relay (default: 0.6 = 60%) */
  filterDiffusionRatio: number
  /** Minimum relays to receive each real filter element (default: 2) */
  minRelaysPerElement: number
}

/**
 * Configuration for the privacy-enhanced publishing system
 */
export interface PrivacyPublishConfig {
  relayMixing: RelayMixingConfig
  timing: TimingObfuscationConfig
  subscriptionObfuscation: SubscriptionObfuscationConfig
}

/**
 * Options for privacy-enhanced publishing
 */
export interface PublishOptions {
  /** Specific relays to publish to (overrides random selection) */
  relays?: string[]
  /** Message priority (affects timing behavior) */
  priority?: MessagePriority
  /** Whether this is a critical message requiring minimum relay count */
  isCritical?: boolean
  /** Bypass the message queue for immediate publication */
  immediate?: boolean
}

/**
 * A message queued for privacy-preserving publication
 */
export interface QueuedMessage {
  /** The Nostr event to publish */
  event: NostrEvent
  /** Optional specific relays to use (overrides random selection) */
  relays?: string[]
  /** Priority level affects timing behavior */
  priority: MessagePriority
  /** Whether this is a critical message (DM, etc.) requiring minimum relay count */
  isCritical?: boolean
  /** Timestamp when message was queued */
  queuedAt: number
  /** Resolve function for the publish promise */
  resolve: (results: PublishResult[]) => void
  /** Reject function for the publish promise */
  reject: (error: Error) => void
}

/**
 * Default configuration for privacy-enhanced publishing
 */
export const DEFAULT_PRIVACY_CONFIG: PrivacyPublishConfig = {
  relayMixing: {
    relaySelectionCount: 3,
    minRelaysForCritical: 2,
    enabled: true,
  },
  timing: {
    minRelayDelay: 100,
    maxRelayDelay: 500,
    minQueueDelay: 1000,
    maxQueueDelay: 30000,
    minInterMessageDelay: 500,
    maxInterMessageDelay: 2000,
    enabled: true,
  },
  subscriptionObfuscation: {
    enabled: true,
    broadFilteringEnabled: true,
    filterDiffusionEnabled: true,
    dummySubscriptionsEnabled: true,
    dummyPubkeyCount: 5,
    dummyEventIdCount: 3,
    filterDiffusionRatio: 0.6,
    minRelaysPerElement: 2,
  },
}

/**
 * Generate a cryptographically secure random delay within a range
 * Uses crypto.getRandomValues() for security
 */
function secureRandomDelay(minMs: number, maxMs: number): number {
  const range = maxMs - minMs
  return minMs + secureRandomInt(range + 1)
}

/**
 * Fisher-Yates shuffle using cryptographically secure randomness
 */
function secureShuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate a random hex string (for dummy pubkeys/event IDs)
 */
function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length / 2)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Distribute array elements across multiple buckets with overlap
 * Ensures each element appears in at least minBuckets buckets
 */
function distributeWithOverlap<T>(
  elements: T[],
  bucketCount: number,
  ratio: number,
  minBucketsPerElement: number
): T[][] {
  if (elements.length === 0 || bucketCount === 0) {
    return Array(bucketCount).fill([])
  }

  // Track which buckets each element is assigned to
  const elementBuckets = new Map<number, Set<number>>()
  elements.forEach((_, i) => elementBuckets.set(i, new Set()))

  // First pass: randomly assign elements to buckets
  const buckets: T[][] = Array(bucketCount).fill(null).map(() => [])
  const elementsPerBucket = Math.ceil(elements.length * ratio)

  for (let bucketIdx = 0; bucketIdx < bucketCount; bucketIdx++) {
    // Shuffle elements and take a subset
    const shuffled = secureShuffleArray([...elements.keys()])
    const selected = shuffled.slice(0, Math.min(elementsPerBucket, elements.length))

    selected.forEach(elementIdx => {
      buckets[bucketIdx].push(elements[elementIdx])
      elementBuckets.get(elementIdx)!.add(bucketIdx)
    })
  }

  // Second pass: ensure minimum bucket coverage for each element
  elements.forEach((element, elementIdx) => {
    const assignedBuckets = elementBuckets.get(elementIdx)!
    while (assignedBuckets.size < Math.min(minBucketsPerElement, bucketCount)) {
      // Find a bucket that doesn't have this element yet
      const availableBuckets = Array.from({ length: bucketCount }, (_, i) => i)
        .filter(b => !assignedBuckets.has(b))

      if (availableBuckets.length === 0) break

      const randomBucket = availableBuckets[secureRandomInt(availableBuckets.length)]
      buckets[randomBucket].push(element)
      assignedBuckets.add(randomBucket)
    }
  })

  return buckets
}

/**
 * Internal tracking for obfuscated subscriptions
 */
interface ObfuscatedSubscription {
  /** Original subscription ID returned to caller */
  publicId: string
  /** Original filters (for local filtering) */
  originalFilters: Filter[]
  /** Mapping of relay URL to internal subscription ID */
  relaySubscriptions: Map<string, string>
  /** Set of dummy pubkeys added for obfuscation */
  dummyPubkeys: Set<string>
  /** Set of dummy event IDs added for obfuscation */
  dummyEventIds: Set<string>
  /** Original event callback */
  onEvent: (event: NostrEvent) => void
  /** Original EOSE callback */
  onEose?: () => void
  /** Count of relays that have sent EOSE */
  eoseCount: number
  /** Total relays subscribed to */
  relayCount: number
}

/**
 * Message queue for privacy-preserving publication
 * Implements random delays and batching to prevent timing correlation attacks
 */
export class MessageQueue {
  private queue: QueuedMessage[] = []
  private processing: boolean = false
  private config: TimingObfuscationConfig
  private publishFn: (event: NostrEvent, relays: string[]) => Promise<PublishResult[]>

  constructor(
    config: TimingObfuscationConfig,
    publishFn: (event: NostrEvent, relays: string[]) => Promise<PublishResult[]>
  ) {
    this.config = config
    this.publishFn = publishFn
  }

  /**
   * Enqueue a message for privacy-preserving publication
   * Returns a promise that resolves when the message is published
   */
  async enqueue(
    event: NostrEvent,
    relays: string[],
    priority: MessagePriority = 'normal',
    isCritical?: boolean
  ): Promise<PublishResult[]> {
    return new Promise((resolve, reject) => {
      const message: QueuedMessage = {
        event,
        relays,
        priority,
        isCritical,
        queuedAt: Date.now(),
        resolve,
        reject,
      }

      // High priority messages go to the front of the queue
      if (priority === 'high') {
        this.queue.unshift(message)
      } else {
        this.queue.push(message)
      }

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue()
      }
    })
  }

  /**
   * Process messages in the queue with random delays
   */
  async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      const message = this.queue.shift()
      if (!message) continue

      try {
        // Apply queue delay based on priority (high priority skips)
        if (this.config.enabled && message.priority !== 'high') {
          const delay = secureRandomDelay(
            this.config.minQueueDelay,
            message.priority === 'low'
              ? this.config.maxQueueDelay
              : this.config.maxQueueDelay / 2
          )
          await sleep(delay)
        }

        // Publish the message
        const results = await this.publishFn(message.event, message.relays || [])
        message.resolve(results)

        // Apply inter-message delay if there are more messages
        if (this.config.enabled && this.queue.length > 0) {
          const interDelay = secureRandomDelay(
            this.config.minInterMessageDelay,
            this.config.maxInterMessageDelay
          )
          await sleep(interDelay)
        }
      } catch (error) {
        message.reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    this.processing = false
  }

  /**
   * Get the current queue length
   */
  get length(): number {
    return this.queue.length
  }

  /**
   * Check if the queue is currently processing
   */
  get isProcessing(): boolean {
    return this.processing
  }

  /**
   * Clear all pending messages from the queue
   * Note: Does not stop in-progress publications
   */
  clear(): void {
    const pending = this.queue.splice(0, this.queue.length)
    pending.forEach(msg => {
      msg.reject(new Error('Queue cleared'))
    })
  }

  /**
   * Update the timing configuration
   */
  updateConfig(config: Partial<TimingObfuscationConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

export class NostrClient {
  private pool: SimplePool
  private relays: Map<string, RelayConfig>
  private relayStatus: Map<string, RelayStatus>
  private subscriptions: Map<string, Subscription>
  private obfuscatedSubscriptions: Map<string, ObfuscatedSubscription>
  private subClosers: Map<string, SubCloser[]>
  private eventHandlers: Map<string, Set<(event: NostrEvent) => void>>
  private privacyConfig: PrivacyPublishConfig
  private messageQueue: MessageQueue

  constructor(relays: RelayConfig[] = [], privacyConfig?: Partial<PrivacyPublishConfig>) {
    this.pool = new SimplePool()
    this.relays = new Map()
    this.relayStatus = new Map()
    this.subscriptions = new Map()
    this.obfuscatedSubscriptions = new Map()
    this.subClosers = new Map()
    this.eventHandlers = new Map()

    // Merge provided config with defaults
    this.privacyConfig = {
      relayMixing: {
        ...DEFAULT_PRIVACY_CONFIG.relayMixing,
        ...privacyConfig?.relayMixing,
      },
      timing: {
        ...DEFAULT_PRIVACY_CONFIG.timing,
        ...privacyConfig?.timing,
      },
      subscriptionObfuscation: {
        ...DEFAULT_PRIVACY_CONFIG.subscriptionObfuscation,
        ...privacyConfig?.subscriptionObfuscation,
      },
    }

    // Initialize message queue with internal publish function
    this.messageQueue = new MessageQueue(
      this.privacyConfig.timing,
      this.publishToRelaysInternal.bind(this)
    )

    relays.forEach(relay => this.addRelay(relay))
  }

  /**
   * Add a relay to the client
   */
  addRelay(config: RelayConfig): void {
    this.relays.set(config.url, config)
    this.relayStatus.set(config.url, {
      _v: '1.0.0',
      url: config.url,
      connected: false,
      connecting: false,
      error: null,
      lastConnected: null,
      messagesSent: 0,
      messagesReceived: 0,
    })
  }

  /**
   * Remove a relay from the client
   */
  removeRelay(url: string): void {
    this.relays.delete(url)
    this.relayStatus.delete(url)
    // Note: SimplePool handles relay cleanup automatically
  }

  /**
   * Get all relay URLs for read operations
   */
  private getReadRelays(): string[] {
    return Array.from(this.relays.values())
      .filter(r => r.read)
      .map(r => r.url)
  }

  /**
   * Get all relay URLs for write operations
   */
  private getWriteRelays(): string[] {
    return Array.from(this.relays.values())
      .filter(r => r.write)
      .map(r => r.url)
  }

  /**
   * Select a random subset of write relays for privacy-preserving publication
   * Uses cryptographically secure randomness for relay selection
   *
   * @param count - Number of relays to select
   * @param minCount - Minimum relays required (for critical messages)
   * @param specificRelays - Optional specific relays to use instead
   * @returns Array of selected relay URLs
   */
  private selectRelaysForPublish(
    count: number,
    minCount: number = 1,
    specificRelays?: string[]
  ): string[] {
    // If specific relays are provided, use them
    if (specificRelays && specificRelays.length > 0) {
      return specificRelays
    }

    const writeRelays = this.getWriteRelays()

    // If relay mixing is disabled, return all write relays
    if (!this.privacyConfig.relayMixing.enabled) {
      return writeRelays
    }

    // If we have fewer relays than requested, return all of them
    if (writeRelays.length <= count) {
      return writeRelays
    }

    // Shuffle relays and select the requested count
    const shuffled = secureShuffleArray(writeRelays)
    const selected = shuffled.slice(0, Math.max(count, minCount))

    return selected
  }

  /**
   * Internal publish function that sends to specified relays with jittered delays
   * This is called by the message queue after applying queue delays
   */
  private async publishToRelaysInternal(
    event: NostrEvent,
    relays: string[]
  ): Promise<PublishResult[]> {
    const targetRelays = relays.length > 0 ? relays : this.getWriteRelays()
    const results: PublishResult[] = []

    // Apply jittered delays between sends if timing obfuscation is enabled
    const useJitter = this.privacyConfig.timing.enabled

    for (let i = 0; i < targetRelays.length; i++) {
      const relayUrl = targetRelays[i]

      // Add jittered delay between relay sends (not before the first one)
      if (useJitter && i > 0) {
        const delay = secureRandomDelay(
          this.privacyConfig.timing.minRelayDelay,
          this.privacyConfig.timing.maxRelayDelay
        )
        await sleep(delay)
      }

      try {
        await this.pool.publish([relayUrl], event)

        // Track messages sent
        const status = this.relayStatus.get(relayUrl)
        if (status) {
          status.messagesSent = (status.messagesSent ?? 0) + 1
          status.connected = true
          status.lastConnected = Date.now()
        }

        results.push({
          _v: '1.0.0',
          relay: relayUrl,
          success: true,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'

        // Update relay status
        const status = this.relayStatus.get(relayUrl)
        if (status) {
          status.error = errorMsg
          status.connected = false
        }

        results.push({
          _v: '1.0.0',
          relay: relayUrl,
          success: false,
          error: errorMsg,
        })
      }
    }

    return results
  }

  /**
   * Get relay status for all relays
   */
  getRelayStatuses(): RelayStatus[] {
    return Array.from(this.relayStatus.values())
  }

  /**
   * Subscribe to events matching filters with privacy obfuscation
   *
   * When obfuscation is enabled, this method:
   * 1. Adds dummy pubkeys/event IDs to obscure real interests
   * 2. Distributes filter elements across relays (diffusion)
   * 3. Filters results locally to match original intent
   *
   * This prevents relays from learning the user's full social graph
   * through subscription pattern analysis.
   */
  subscribe(
    filters: Filter[],
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void
  ): string {
    const subId = `sub_${Date.now()}_${secureRandomString(9)}`
    const config = this.privacyConfig.subscriptionObfuscation
    const relayUrls = this.getReadRelays()

    // If obfuscation is disabled, use simple subscription
    if (!config.enabled) {
      return this.subscribeSimple(filters, onEvent, onEose)
    }

    // Create obfuscated subscription tracking
    const obfuscatedSub: ObfuscatedSubscription = {
      publicId: subId,
      originalFilters: filters,
      relaySubscriptions: new Map(),
      dummyPubkeys: new Set(),
      dummyEventIds: new Set(),
      onEvent,
      onEose,
      eoseCount: 0,
      relayCount: relayUrls.length,
    }

    // Generate dummy data for obfuscation
    if (config.dummySubscriptionsEnabled) {
      for (let i = 0; i < config.dummyPubkeyCount; i++) {
        obfuscatedSub.dummyPubkeys.add(generateRandomHex(64))
      }
      for (let i = 0; i < config.dummyEventIdCount; i++) {
        obfuscatedSub.dummyEventIds.add(generateRandomHex(64))
      }
    }

    // Process each filter for obfuscation
    const obfuscatedFiltersPerRelay = this.createObfuscatedFilters(
      filters,
      relayUrls,
      obfuscatedSub,
      config
    )

    // Subscribe to each relay with its specific filter set
    const closers: SubCloser[] = []
    relayUrls.forEach((relayUrl, index) => {
      const relayFilters = obfuscatedFiltersPerRelay[index]
      if (relayFilters.length === 0) return

      const relaySubId = `${subId}_${index}`
      obfuscatedSub.relaySubscriptions.set(relayUrl, relaySubId)

      const mergedFilter = relayFilters.length === 1
        ? relayFilters[0]
        : mergeFilters(...relayFilters)

      const closer = this.pool.subscribeMany(
        [relayUrl],
        mergedFilter,
        {
          onevent: (event: NostrEvent) => {
            // Filter out dummy data and events that don't match original filters
            if (this.eventMatchesOriginalFilters(event, obfuscatedSub)) {
              onEvent(event)
            }

            // Track messages received
            const status = this.relayStatus.get(relayUrl)
            if (status) {
              status.messagesReceived = (status.messagesReceived ?? 0) + 1
            }
          },
          oneose: () => {
            obfuscatedSub.eoseCount++
            // Only call onEose when all relays have responded
            if (obfuscatedSub.eoseCount >= obfuscatedSub.relayCount && onEose) {
              onEose()
            }
          },
        }
      )
      closers.push(closer)
    })

    this.subClosers.set(subId, closers)

    this.obfuscatedSubscriptions.set(subId, obfuscatedSub)

    // Also store in regular subscriptions for compatibility
    const subscription: Subscription = {
      id: subId,
      filters,
      onEvent,
      onEose,
    }
    this.subscriptions.set(subId, subscription)

    return subId
  }

  /**
   * Simple subscription without obfuscation (internal use)
   */
  private subscribeSimple(
    filters: Filter[],
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void
  ): string {
    const subId = `sub_${Date.now()}_${secureRandomString(9)}`

    const subscription: Subscription = {
      id: subId,
      filters,
      onEvent,
      onEose,
    }

    this.subscriptions.set(subId, subscription)

    const relayUrls = this.getReadRelays()
    const mergedFilter = filters.length === 1 ? filters[0] : mergeFilters(...filters)

    const closer = this.pool.subscribeMany(
      relayUrls,
      mergedFilter,
      {
        onevent: (event: NostrEvent) => {
          onEvent(event)
          relayUrls.forEach(url => {
            const status = this.relayStatus.get(url)
            if (status) {
              status.messagesReceived = (status.messagesReceived ?? 0) + 1
            }
          })
        },
        oneose: () => {
          onEose?.()
        },
      }
    )

    this.subClosers.set(subId, [closer])

    return subId
  }

  /**
   * Create obfuscated filters for each relay
   * Implements filter diffusion and dummy injection
   */
  private createObfuscatedFilters(
    originalFilters: Filter[],
    relayUrls: string[],
    obfuscatedSub: ObfuscatedSubscription,
    config: SubscriptionObfuscationConfig
  ): Filter[][] {
    const result: Filter[][] = relayUrls.map(() => [])

    for (const filter of originalFilters) {
      // Handle author-based filters (protect social graph)
      if (filter.authors && filter.authors.length > 0) {
        const authorsWithDummies = [
          ...filter.authors,
          ...(config.dummySubscriptionsEnabled ? Array.from(obfuscatedSub.dummyPubkeys) : []),
        ]

        if (config.filterDiffusionEnabled && relayUrls.length > 1) {
          // Distribute authors across relays
          const distributed = distributeWithOverlap(
            authorsWithDummies,
            relayUrls.length,
            config.filterDiffusionRatio,
            config.minRelaysPerElement
          )

          distributed.forEach((authors, relayIndex) => {
            if (authors.length > 0) {
              result[relayIndex].push({
                ...filter,
                authors,
              })
            }
          })
        } else {
          // Send all authors (with dummies) to all relays
          relayUrls.forEach((_, index) => {
            result[index].push({
              ...filter,
              authors: authorsWithDummies,
            })
          })
        }
      }
      // Handle ID-based filters
      else if (filter.ids && filter.ids.length > 0) {
        const idsWithDummies = [
          ...filter.ids,
          ...(config.dummySubscriptionsEnabled ? Array.from(obfuscatedSub.dummyEventIds) : []),
        ]

        if (config.filterDiffusionEnabled && relayUrls.length > 1) {
          const distributed = distributeWithOverlap(
            idsWithDummies,
            relayUrls.length,
            config.filterDiffusionRatio,
            config.minRelaysPerElement
          )

          distributed.forEach((ids, relayIndex) => {
            if (ids.length > 0) {
              result[relayIndex].push({
                ...filter,
                ids,
              })
            }
          })
        } else {
          relayUrls.forEach((_, index) => {
            result[index].push({
              ...filter,
              ids: idsWithDummies,
            })
          })
        }
      }
      // Handle #p tag filters (protect who we're following)
      else if (filter['#p'] && (filter['#p'] as string[]).length > 0) {
        const pTags = filter['#p'] as string[]
        const pTagsWithDummies = [
          ...pTags,
          ...(config.dummySubscriptionsEnabled ? Array.from(obfuscatedSub.dummyPubkeys) : []),
        ]

        if (config.filterDiffusionEnabled && relayUrls.length > 1) {
          const distributed = distributeWithOverlap(
            pTagsWithDummies,
            relayUrls.length,
            config.filterDiffusionRatio,
            config.minRelaysPerElement
          )

          distributed.forEach((pTagList, relayIndex) => {
            if (pTagList.length > 0) {
              result[relayIndex].push({
                ...filter,
                '#p': pTagList,
              })
            }
          })
        } else {
          relayUrls.forEach((_, index) => {
            result[index].push({
              ...filter,
              '#p': pTagsWithDummies,
            })
          })
        }
      }
      // Other filters (kinds, timestamps, etc.) - send to all relays as-is
      else {
        relayUrls.forEach((_, index) => {
          result[index].push(filter)
        })
      }
    }

    return result
  }

  /**
   * Check if an event matches the original (non-obfuscated) filters
   * Used to filter out dummy data from results
   */
  private eventMatchesOriginalFilters(
    event: NostrEvent,
    obfuscatedSub: ObfuscatedSubscription
  ): boolean {
    // Check if this is from a dummy pubkey
    if (obfuscatedSub.dummyPubkeys.has(event.pubkey)) {
      return false
    }

    // Check if this is a dummy event ID
    if (obfuscatedSub.dummyEventIds.has(event.id)) {
      return false
    }

    // Check if event matches any original filter
    for (const filter of obfuscatedSub.originalFilters) {
      if (this.eventMatchesFilter(event, filter)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if an event matches a filter
   */
  private eventMatchesFilter(event: NostrEvent, filter: Filter): boolean {
    // Check IDs
    if (filter.ids && filter.ids.length > 0) {
      if (!filter.ids.includes(event.id)) {
        return false
      }
    }

    // Check authors
    if (filter.authors && filter.authors.length > 0) {
      if (!filter.authors.includes(event.pubkey)) {
        return false
      }
    }

    // Check kinds
    if (filter.kinds && filter.kinds.length > 0) {
      if (!filter.kinds.includes(event.kind)) {
        return false
      }
    }

    // Check since
    if (filter.since !== undefined && event.created_at < filter.since) {
      return false
    }

    // Check until
    if (filter.until !== undefined && event.created_at > filter.until) {
      return false
    }

    // Check #e tags
    if (filter['#e'] && (filter['#e'] as string[]).length > 0) {
      const eTags = filter['#e'] as string[]
      const eventETags = event.tags.filter(t => t[0] === 'e').map(t => t[1])
      if (!eTags.some(e => eventETags.includes(e))) {
        return false
      }
    }

    // Check #p tags
    if (filter['#p'] && (filter['#p'] as string[]).length > 0) {
      const pTags = filter['#p'] as string[]
      const eventPTags = event.tags.filter(t => t[0] === 'p').map(t => t[1])
      if (!pTags.some(p => eventPTags.includes(p))) {
        return false
      }
    }

    return true
  }

  /**
   * Unsubscribe from a subscription
   */
  unsubscribe(subId: string): void {
    // Close subscription handles (NOT the relay connections)
    const closers = this.subClosers.get(subId)
    if (closers) {
      closers.forEach(closer => closer.close())
      this.subClosers.delete(subId)
    }

    this.obfuscatedSubscriptions.delete(subId)
    this.subscriptions.delete(subId)
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    // Close all subscription handles
    this.subClosers.forEach(closers => {
      closers.forEach(closer => closer.close())
    })
    this.subClosers.clear()
    this.obfuscatedSubscriptions.clear()
    this.subscriptions.clear()
  }

  /**
   * Publish an event to write relays (legacy method for backward compatibility)
   * Uses privacy-preserving publication with relay mixing and timing obfuscation
   *
   * For more control, use publishWithPrivacy() instead
   */
  async publish(event: NostrEvent): Promise<PublishResult[]> {
    return this.publishWithPrivacy(event)
  }

  /**
   * Publish an event with privacy-preserving features
   *
   * Privacy features:
   * - Relay mixing: Send to a random subset of relays instead of all
   * - Jittered delays: Random delays between sending to each relay
   * - Message queue: Random delays before publishing
   *
   * @param event - The Nostr event to publish
   * @param options - Publishing options
   * @returns Promise resolving to array of publish results
   */
  async publishWithPrivacy(
    event: NostrEvent,
    options: {
      /** Specific relays to publish to (overrides random selection) */
      relays?: string[]
      /** Message priority (affects timing behavior) */
      priority?: MessagePriority
      /** Whether this is a critical message requiring minimum relay count */
      isCritical?: boolean
      /** Bypass the message queue for immediate publication */
      immediate?: boolean
    } = {}
  ): Promise<PublishResult[]> {
    const {
      relays: specificRelays,
      priority = 'normal',
      isCritical = false,
      immediate = false,
    } = options

    // Select relays for this message
    const minRelays = isCritical
      ? this.privacyConfig.relayMixing.minRelaysForCritical
      : 1
    const selectedRelays = this.selectRelaysForPublish(
      this.privacyConfig.relayMixing.relaySelectionCount,
      minRelays,
      specificRelays
    )

    // If immediate or timing obfuscation is disabled, publish directly
    if (immediate || !this.privacyConfig.timing.enabled) {
      return this.publishToRelaysInternal(event, selectedRelays)
    }

    // Otherwise, use the message queue for timing obfuscation
    return this.messageQueue.enqueue(event, selectedRelays, priority, isCritical)
  }

  /**
   * Publish a direct message (DM) with enhanced privacy guarantees
   * DMs are treated as critical messages with:
   * - Minimum 2 relays (configurable)
   * - Normal priority (uses queue delays)
   */
  async publishDirectMessage(event: NostrEvent): Promise<PublishResult[]> {
    return this.publishWithPrivacy(event, {
      priority: 'normal',
      isCritical: true,
    })
  }

  /**
   * Publish an urgent/time-sensitive message
   * Bypasses queue delay but still uses relay mixing
   */
  async publishUrgent(event: NostrEvent): Promise<PublishResult[]> {
    return this.publishWithPrivacy(event, {
      priority: 'high',
      immediate: false, // Still goes through queue but at front
    })
  }

  /**
   * Publish immediately without any privacy delays
   * WARNING: This may leak timing information. Use only when necessary.
   */
  async publishImmediate(
    event: NostrEvent,
    relays?: string[]
  ): Promise<PublishResult[]> {
    return this.publishToRelaysInternal(event, relays || this.getWriteRelays())
  }

  /**
   * Query for events (one-time query, not a subscription)
   */
  async query(filters: Filter[], timeout = 5000): Promise<NostrEvent[]> {
    const relays = this.getReadRelays()

    return new Promise((resolve) => {
      const events: NostrEvent[] = []
      const timer = setTimeout(() => {
        closer.close()
        resolve(events)
      }, timeout)

      // Combine filters into a single filter for nostr-tools pool
      const combinedFilter = filters.length === 1 ? filters[0] : filters[0]

      const closer = this.pool.subscribeMany(
        relays,
        combinedFilter,
        {
          onevent: (event: NostrEvent) => {
            events.push(event)
          },
          oneose: () => {
            clearTimeout(timer)
            closer.close()
            resolve(events)
          },
        }
      )
    })
  }

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: string, timeout = 5000): Promise<NostrEvent | null> {
    const events = await this.query([{ ids: [eventId] }], timeout)
    return events[0] || null
  }

  /**
   * Get the current privacy configuration
   */
  getPrivacyConfig(): PrivacyPublishConfig {
    return { ...this.privacyConfig }
  }

  /**
   * Update the privacy configuration
   */
  updatePrivacyConfig(config: Partial<PrivacyPublishConfig>): void {
    if (config.relayMixing) {
      this.privacyConfig.relayMixing = {
        ...this.privacyConfig.relayMixing,
        ...config.relayMixing,
      }
    }
    if (config.timing) {
      this.privacyConfig.timing = {
        ...this.privacyConfig.timing,
        ...config.timing,
      }
      this.messageQueue.updateConfig(this.privacyConfig.timing)
    }
    if (config.subscriptionObfuscation) {
      this.privacyConfig.subscriptionObfuscation = {
        ...this.privacyConfig.subscriptionObfuscation,
        ...config.subscriptionObfuscation,
      }
    }
  }

  /**
   * Enable or disable relay mixing
   */
  setRelayMixingEnabled(enabled: boolean): void {
    this.privacyConfig.relayMixing.enabled = enabled
  }

  /**
   * Enable or disable timing obfuscation
   */
  setTimingObfuscationEnabled(enabled: boolean): void {
    this.privacyConfig.timing.enabled = enabled
    this.messageQueue.updateConfig(this.privacyConfig.timing)
  }

  /**
   * Enable or disable subscription filter obfuscation
   */
  setSubscriptionObfuscationEnabled(enabled: boolean): void {
    this.privacyConfig.subscriptionObfuscation.enabled = enabled
  }

  /**
   * Update subscription obfuscation configuration
   */
  updateSubscriptionObfuscationConfig(
    config: Partial<SubscriptionObfuscationConfig>
  ): void {
    this.privacyConfig.subscriptionObfuscation = {
      ...this.privacyConfig.subscriptionObfuscation,
      ...config,
    }
  }

  /**
   * Get subscription obfuscation configuration
   */
  getSubscriptionObfuscationConfig(): SubscriptionObfuscationConfig {
    return { ...this.privacyConfig.subscriptionObfuscation }
  }

  /**
   * Get the current message queue length
   */
  getQueueLength(): number {
    return this.messageQueue.length
  }

  /**
   * Check if the message queue is currently processing
   */
  isQueueProcessing(): boolean {
    return this.messageQueue.isProcessing
  }

  /**
   * Clear all pending messages from the queue
   */
  clearQueue(): void {
    this.messageQueue.clear()
  }

  /**
   * Close all connections and cleanup
   */
  close(): void {
    // Close all subscription handles first
    this.subClosers.forEach(closers => {
      closers.forEach(closer => closer.close())
    })
    this.subClosers.clear()
    this.messageQueue.clear()
    // Close relay connections
    const allRelays = Array.from(this.relays.keys())
    this.pool.close(allRelays)
    this.subscriptions.clear()
    this.obfuscatedSubscriptions.clear()
    this.eventHandlers.clear()
  }

  /**
   * Alias for close() to match common disconnect naming
   */
  disconnect(): void {
    this.close()
  }
}

// Singleton instance (optional, can be created per-component if needed)
let clientInstance: NostrClient | null = null

export function getNostrClient(relays?: RelayConfig[]): NostrClient {
  if (!clientInstance) {
    const defaultRelays: RelayConfig[] = relays || [
      { _v: '1.0.0', url: 'wss://relay.damus.io', read: true, write: true },
      { _v: '1.0.0', url: 'wss://relay.primal.net', read: true, write: true },
      { _v: '1.0.0', url: 'wss://relay.snort.social', read: true, write: true },
      { _v: '1.0.0', url: 'wss://nos.lol', read: true, write: true },
    ]
    clientInstance = new NostrClient(defaultRelays)
  }
  return clientInstance
}

export function resetNostrClient(): void {
  if (clientInstance) {
    clientInstance.close()
    clientInstance = null
  }
}
