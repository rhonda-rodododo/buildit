/**
 * Messaging Queue Manager
 * Manages text-based hotline intake with thread assignment and routing
 */

import { EventEmitter } from 'eventemitter3';
import {
  MessagingHotlineThreadStatus,
  HotlineCallStatePriority,
  type MessagingHotlineThread,
  type MessagingHotlineThreadContactType,
  type MessagingHotlineThreadPriority,
} from '../types';

export interface ThreadMessage {
  id: string;
  threadId: string;
  content: string;
  senderPubkey: string;
  senderType: 'caller' | 'operator' | 'system';
  timestamp: number;
  read: boolean;
  metadata?: Record<string, unknown>;
}

export interface MessagingThread extends MessagingHotlineThread {
  messages: ThreadMessage[];
  unreadCount: number;
  lastMessage?: ThreadMessage;
  lastActivityAt: number;
  waitTime: number;
  responseTime?: number;
  callerName?: string;
  callerPhone?: string;
}

export interface ThreadFilter {
  status?: MessagingHotlineThreadStatus[];
  assignedTo?: string;
  priority?: MessagingHotlineThreadPriority[];
  contactType?: MessagingHotlineThreadContactType[];
  hotlineId?: string;
  unassigned?: boolean;
  unread?: boolean;
}

export interface ThreadStats {
  total: number;
  unassigned: number;
  myThreads: number;
  waiting: number;
  active: number;
  avgResponseTime: number;
  avgResolutionTime: number;
}

export class MessagingQueueManager extends EventEmitter {
  private threads: Map<string, MessagingThread> = new Map();
  private operatorPubkey: string = '';
  private hotlineId: string = '';

  constructor() {
    super();
  }

  /**
   * Initialize the manager with operator context
   */
  initialize(operatorPubkey: string, hotlineId: string): void {
    this.operatorPubkey = operatorPubkey;
    this.hotlineId = hotlineId;
  }

  /**
   * Create a new incoming thread
   */
  async createThread(data: {
    callerPubkey: string;
    callerName?: string;
    callerPhone?: string;
    contactType: MessagingHotlineThreadContactType;
    initialMessage: string;
    priority?: MessagingHotlineThreadPriority;
    category?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MessagingThread> {
    const threadId = crypto.randomUUID();
    const now = Date.now();

    const initialMessage: ThreadMessage = {
      id: crypto.randomUUID(),
      threadId,
      content: data.initialMessage,
      senderPubkey: data.callerPubkey,
      senderType: 'caller',
      timestamp: now,
      read: false,
    };

    const thread: MessagingThread = {
      _v: '1',
      threadId,
      hotlineId: this.hotlineId,
      callerPubkey: data.callerPubkey,
      callerName: data.callerName,
      callerPhone: data.callerPhone,
      contactType: data.contactType,
      status: MessagingHotlineThreadStatus.Unassigned,
      priority: data.priority || HotlineCallStatePriority.Medium,
      category: data.category,
      createdAt: now,
      updatedAt: now,
      messages: [initialMessage],
      unreadCount: 1,
      lastMessage: initialMessage,
      lastActivityAt: now,
      waitTime: 0,
      metadata: data.metadata,
    };

    this.threads.set(threadId, thread);
    this.emit('thread-created', thread);
    this.emit('queue-updated', this.getStats());

    return thread;
  }

  /**
   * Claim a thread as the current operator
   */
  async claimThread(threadId: string): Promise<MessagingThread> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    if (thread.status !== 'unassigned') {
      throw new Error('Thread is already assigned');
    }

    const now = Date.now();
    thread.assignedTo = this.operatorPubkey;
    thread.assignedAt = now;
    thread.status = MessagingHotlineThreadStatus.Active;
    thread.updatedAt = now;
    thread.responseTime = now - thread.createdAt;

    // Add system message
    this.addSystemMessage(threadId, `Thread claimed by operator`);

    this.emit('thread-claimed', thread);
    this.emit('queue-updated', this.getStats());

    return thread;
  }

  /**
   * Auto-assign thread using round-robin
   */
  async assignThread(
    threadId: string,
    operatorPubkey?: string
  ): Promise<MessagingThread> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    const now = Date.now();
    thread.assignedTo = operatorPubkey || this.operatorPubkey;
    thread.assignedAt = now;
    thread.status = MessagingHotlineThreadStatus.Assigned;
    thread.updatedAt = now;

    this.addSystemMessage(threadId, `Thread assigned to operator`);

    this.emit('thread-assigned', thread);
    this.emit('queue-updated', this.getStats());

    return thread;
  }

  /**
   * Transfer thread to another operator
   */
  async transferThread(
    threadId: string,
    targetOperatorPubkey: string,
    reason?: string
  ): Promise<MessagingThread> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    const previousOperator = thread.assignedTo;
    const now = Date.now();

    thread.assignedTo = targetOperatorPubkey;
    thread.status = MessagingHotlineThreadStatus.Assigned;
    thread.updatedAt = now;

    const message = reason
      ? `Thread transferred: ${reason}`
      : 'Thread transferred to another operator';
    this.addSystemMessage(threadId, message);

    this.emit('thread-transferred', {
      thread,
      from: previousOperator,
      to: targetOperatorPubkey,
      reason,
    });
    this.emit('queue-updated', this.getStats());

    return thread;
  }

  /**
   * Mark thread as waiting for caller response
   */
  async setWaiting(threadId: string): Promise<MessagingThread> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    thread.status = MessagingHotlineThreadStatus.Waiting;
    thread.updatedAt = Date.now();

    this.emit('thread-updated', thread);
    this.emit('queue-updated', this.getStats());

    return thread;
  }

  /**
   * Resume an active thread
   */
  async setActive(threadId: string): Promise<MessagingThread> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    thread.status = MessagingHotlineThreadStatus.Active;
    thread.updatedAt = Date.now();

    this.emit('thread-updated', thread);
    this.emit('queue-updated', this.getStats());

    return thread;
  }

  /**
   * Resolve a thread
   */
  async resolveThread(
    threadId: string,
    summary?: string
  ): Promise<MessagingThread> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    const now = Date.now();
    thread.status = MessagingHotlineThreadStatus.Resolved;
    thread.resolvedAt = now;
    thread.updatedAt = now;

    if (summary) {
      thread.notes = summary;
    }

    this.addSystemMessage(threadId, 'Thread resolved');

    this.emit('thread-resolved', thread);
    this.emit('queue-updated', this.getStats());

    return thread;
  }

  /**
   * Archive a resolved thread
   */
  async archiveThread(threadId: string): Promise<void> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    if (thread.status !== 'resolved') {
      throw new Error('Can only archive resolved threads');
    }

    thread.status = MessagingHotlineThreadStatus.Archived;
    thread.archivedAt = Date.now();
    thread.updatedAt = Date.now();

    this.emit('thread-archived', thread);
    this.emit('queue-updated', this.getStats());
  }

  /**
   * Add a message to a thread
   */
  async addMessage(
    threadId: string,
    content: string,
    senderType: 'caller' | 'operator' = 'operator'
  ): Promise<ThreadMessage> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    const message: ThreadMessage = {
      id: crypto.randomUUID(),
      threadId,
      content,
      senderPubkey: senderType === 'operator' ? this.operatorPubkey : thread.callerPubkey || '',
      senderType,
      timestamp: Date.now(),
      read: senderType === 'operator',
    };

    thread.messages.push(message);
    thread.lastMessage = message;
    thread.lastActivityAt = message.timestamp;
    thread.updatedAt = message.timestamp;

    if (senderType === 'caller') {
      thread.unreadCount++;
      // Auto-reactivate if waiting
      if (thread.status === 'waiting') {
        thread.status = MessagingHotlineThreadStatus.Active;
      }
    }

    this.emit('message-added', { thread, message });

    return message;
  }

  /**
   * Mark messages as read
   */
  markAsRead(threadId: string): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;

    thread.messages.forEach((msg) => {
      if (!msg.read && msg.senderType === 'caller') {
        msg.read = true;
      }
    });
    thread.unreadCount = 0;

    this.emit('thread-updated', thread);
  }

  /**
   * Add a system message
   */
  private addSystemMessage(threadId: string, content: string): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;

    const message: ThreadMessage = {
      id: crypto.randomUUID(),
      threadId,
      content,
      senderPubkey: 'system',
      senderType: 'system',
      timestamp: Date.now(),
      read: true,
    };

    thread.messages.push(message);
    thread.lastActivityAt = message.timestamp;
  }

  /**
   * Update thread priority
   */
  setPriority(threadId: string, priority: MessagingHotlineThreadPriority): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;

    thread.priority = priority;
    thread.updatedAt = Date.now();

    this.emit('thread-updated', thread);
  }

  /**
   * Update thread category
   */
  setCategory(threadId: string, category: string): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;

    thread.category = category;
    thread.updatedAt = Date.now();

    this.emit('thread-updated', thread);
  }

  /**
   * Update thread notes
   */
  setNotes(threadId: string, notes: string): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;

    thread.notes = notes;
    thread.updatedAt = Date.now();

    this.emit('thread-updated', thread);
  }

  /**
   * Get a thread by ID
   */
  getThread(threadId: string): MessagingThread | undefined {
    return this.threads.get(threadId);
  }

  /**
   * Get threads with optional filtering
   */
  getThreads(filter?: ThreadFilter): MessagingThread[] {
    let threads = Array.from(this.threads.values());

    if (filter) {
      if (filter.status?.length) {
        threads = threads.filter((t) => filter.status!.includes(t.status));
      }
      if (filter.assignedTo) {
        threads = threads.filter((t) => t.assignedTo === filter.assignedTo);
      }
      if (filter.unassigned) {
        threads = threads.filter((t) => !t.assignedTo);
      }
      if (filter.priority?.length) {
        threads = threads.filter((t) => t.priority && filter.priority!.includes(t.priority));
      }
      if (filter.contactType?.length) {
        threads = threads.filter((t) => filter.contactType!.includes(t.contactType));
      }
      if (filter.hotlineId) {
        threads = threads.filter((t) => t.hotlineId === filter.hotlineId);
      }
      if (filter.unread) {
        threads = threads.filter((t) => t.unreadCount > 0);
      }
    }

    // Sort by priority weight then by last activity
    const priorityWeight: Record<MessagingHotlineThreadPriority, number> = {
      [HotlineCallStatePriority.Urgent]: 4,
      [HotlineCallStatePriority.High]: 3,
      [HotlineCallStatePriority.Medium]: 2,
      [HotlineCallStatePriority.Low]: 1,
    };

    threads.sort((a, b) => {
      const aPriority = a.priority ?? HotlineCallStatePriority.Medium;
      const bPriority = b.priority ?? HotlineCallStatePriority.Medium;
      const priorityDiff = priorityWeight[bPriority] - priorityWeight[aPriority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.lastActivityAt - a.lastActivityAt;
    });

    return threads;
  }

  /**
   * Get queue statistics
   */
  getStats(): ThreadStats {
    const threads = Array.from(this.threads.values());
    const activeThreads = threads.filter((t) =>
      t.status !== 'resolved' && t.status !== 'archived'
    );

    const responseTimes = threads
      .filter((t) => t.responseTime)
      .map((t) => t.responseTime!);
    const avgResponseTime = responseTimes.length
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const resolutionTimes = threads
      .filter((t) => t.resolvedAt && t.createdAt)
      .map((t) => t.resolvedAt! - t.createdAt);
    const avgResolutionTime = resolutionTimes.length
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

    return {
      total: activeThreads.length,
      unassigned: activeThreads.filter((t) => t.status === 'unassigned').length,
      myThreads: activeThreads.filter((t) => t.assignedTo === this.operatorPubkey).length,
      waiting: activeThreads.filter((t) => t.status === 'waiting').length,
      active: activeThreads.filter((t) => t.status === 'active').length,
      avgResponseTime,
      avgResolutionTime,
    };
  }

  /**
   * Clear all threads (for testing)
   */
  clear(): void {
    this.threads.clear();
    this.emit('queue-updated', this.getStats());
  }
}

// Singleton instance
export const messagingQueueManager = new MessagingQueueManager();
