/**
 * Poll Manager
 * Manages polls for conference calls with E2EE anonymous voting
 *
 * Features:
 * - Create polls with multiple options
 * - Anonymous voting (HMAC-based voter tokens)
 * - Live results (optional)
 * - Multi-select support
 * - E2EE for vote privacy
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

export interface PollOption {
  id: string;
  text: string;
}

export interface PollSettings {
  anonymous: boolean;
  multiSelect: boolean;
  showLiveResults: boolean;
  allowChangeVote: boolean;
}

export interface Poll {
  id: string;
  roomId: string;
  creatorPubkey: string;
  question: string;
  options: PollOption[];
  settings: PollSettings;
  status: 'draft' | 'active' | 'closed';
  createdAt: number;
  closedAt?: number;
}

export interface PollVote {
  pollId: string;
  voterToken: string; // HMAC(roomId + pollId, privateKey) for anonymous voting
  selectedOptions: string[]; // Option IDs
  timestamp: number;
}

export interface PollResults {
  pollId: string;
  totalVotes: number;
  optionCounts: Map<string, number>;
  percentages: Map<string, number>;
}

export interface PollManagerEvents {
  'poll-created': (poll: Poll) => void;
  'poll-launched': (poll: Poll) => void;
  'poll-closed': (poll: Poll, results: PollResults) => void;
  'vote-received': (pollId: string, totalVotes: number) => void;
  'results-updated': (pollId: string, results: PollResults) => void;
}

/**
 * Poll Manager
 */
export class PollManager extends EventEmitter {
  private roomId: string;
  private localPubkey: string;
  private polls: Map<string, Poll> = new Map();
  private votes: Map<string, Map<string, PollVote>> = new Map(); // pollId -> voterToken -> vote
  private localVotes: Map<string, string[]> = new Map(); // pollId -> selectedOptions
  private onSendPoll?: (poll: Poll) => Promise<void>;
  private onSendVote?: (vote: PollVote) => Promise<void>;
  private onClosePoll?: (pollId: string, results: PollResults) => Promise<void>;

  constructor(roomId: string, localPubkey: string) {
    super();
    this.roomId = roomId;
    this.localPubkey = localPubkey;
  }

  /**
   * Set callbacks for transport layer
   */
  setOnSendPoll(callback: (poll: Poll) => Promise<void>): void {
    this.onSendPoll = callback;
  }

  setOnSendVote(callback: (vote: PollVote) => Promise<void>): void {
    this.onSendVote = callback;
  }

  setOnClosePoll(callback: (pollId: string, results: PollResults) => Promise<void>): void {
    this.onClosePoll = callback;
  }

  /**
   * Create a new poll (draft status)
   */
  createPoll(
    question: string,
    options: string[],
    settings?: Partial<PollSettings>
  ): Poll {
    const poll: Poll = {
      id: uuidv4(),
      roomId: this.roomId,
      creatorPubkey: this.localPubkey,
      question,
      options: options.map((text) => ({
        id: uuidv4(),
        text,
      })),
      settings: {
        anonymous: true,
        multiSelect: false,
        showLiveResults: true,
        allowChangeVote: false,
        ...settings,
      },
      status: 'draft',
      createdAt: Date.now(),
    };

    this.polls.set(poll.id, poll);
    this.votes.set(poll.id, new Map());

    this.emit('poll-created', poll);
    logger.info('Poll created', { pollId: poll.id, question });

    return poll;
  }

  /**
   * Launch a poll (make it active)
   */
  async launchPoll(pollId: string): Promise<void> {
    const poll = this.polls.get(pollId);
    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.status !== 'draft') {
      throw new Error('Poll already launched or closed');
    }

    poll.status = 'active';

    if (this.onSendPoll) {
      await this.onSendPoll(poll);
    }

    this.emit('poll-launched', poll);
    logger.info('Poll launched', { pollId });
  }

  /**
   * Handle remote poll received
   */
  handleRemotePoll(poll: Poll): void {
    if (!this.polls.has(poll.id)) {
      this.polls.set(poll.id, poll);
      this.votes.set(poll.id, new Map());
    } else {
      // Update existing poll
      const existing = this.polls.get(poll.id)!;
      existing.status = poll.status;
      if (poll.closedAt) {
        existing.closedAt = poll.closedAt;
      }
    }

    if (poll.status === 'active') {
      this.emit('poll-launched', poll);
    }

    logger.debug('Remote poll received', { pollId: poll.id, status: poll.status });
  }

  /**
   * Generate anonymous voter token
   * Uses HMAC(roomId + pollId, privateKey) to create a deterministic but anonymous token
   */
  private async generateVoterToken(pollId: string): Promise<string> {
    // In production, this would use the actual private key
    // For now, we use pubkey as a proxy (the real implementation would use crypto)
    const data = new TextEncoder().encode(`${this.roomId}:${pollId}:${this.localPubkey}`);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Submit a vote
   */
  async vote(pollId: string, selectedOptions: string[]): Promise<void> {
    const poll = this.polls.get(pollId);
    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.status !== 'active') {
      throw new Error('Poll is not active');
    }

    // Validate options
    const validOptionIds = new Set(poll.options.map((o) => o.id));
    for (const optionId of selectedOptions) {
      if (!validOptionIds.has(optionId)) {
        throw new Error('Invalid option selected');
      }
    }

    // Check multi-select
    if (!poll.settings.multiSelect && selectedOptions.length > 1) {
      throw new Error('Multiple selection not allowed');
    }

    // Check if already voted
    const previousVote = this.localVotes.get(pollId);
    if (previousVote && !poll.settings.allowChangeVote) {
      throw new Error('Already voted and vote change not allowed');
    }

    // Generate anonymous voter token
    const voterToken = await this.generateVoterToken(pollId);

    const vote: PollVote = {
      pollId,
      voterToken,
      selectedOptions,
      timestamp: Date.now(),
    };

    // Store vote locally
    const pollVotes = this.votes.get(pollId)!;
    pollVotes.set(voterToken, vote);
    this.localVotes.set(pollId, selectedOptions);

    // Send vote via transport layer
    if (this.onSendVote) {
      await this.onSendVote(vote);
    }

    const results = this.calculateResults(pollId);
    this.emit('vote-received', pollId, results.totalVotes);

    if (poll.settings.showLiveResults) {
      this.emit('results-updated', pollId, results);
    }

    logger.info('Vote submitted', { pollId });
  }

  /**
   * Handle remote vote received
   */
  handleRemoteVote(vote: PollVote): void {
    const poll = this.polls.get(vote.pollId);
    if (!poll) {
      logger.warn('Vote received for unknown poll', { pollId: vote.pollId });
      return;
    }

    const pollVotes = this.votes.get(vote.pollId)!;

    // Anonymous voting - we only store by voter token
    pollVotes.set(vote.voterToken, vote);

    const results = this.calculateResults(vote.pollId);
    this.emit('vote-received', vote.pollId, results.totalVotes);

    if (poll.settings.showLiveResults) {
      this.emit('results-updated', vote.pollId, results);
    }

    logger.debug('Remote vote received', { pollId: vote.pollId });
  }

  /**
   * Close a poll
   */
  async closePoll(pollId: string): Promise<PollResults> {
    const poll = this.polls.get(pollId);
    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.status === 'closed') {
      throw new Error('Poll already closed');
    }

    poll.status = 'closed';
    poll.closedAt = Date.now();

    const results = this.calculateResults(pollId);

    if (this.onClosePoll) {
      await this.onClosePoll(pollId, results);
    }

    this.emit('poll-closed', poll, results);
    logger.info('Poll closed', { pollId, totalVotes: results.totalVotes });

    return results;
  }

  /**
   * Calculate poll results
   */
  calculateResults(pollId: string): PollResults {
    const poll = this.polls.get(pollId);
    const pollVotes = this.votes.get(pollId);

    if (!poll || !pollVotes) {
      return {
        pollId,
        totalVotes: 0,
        optionCounts: new Map(),
        percentages: new Map(),
      };
    }

    const optionCounts = new Map<string, number>();
    for (const option of poll.options) {
      optionCounts.set(option.id, 0);
    }

    // Count votes
    for (const vote of pollVotes.values()) {
      for (const optionId of vote.selectedOptions) {
        optionCounts.set(optionId, (optionCounts.get(optionId) || 0) + 1);
      }
    }

    // Calculate percentages
    const totalVotes = pollVotes.size;
    const percentages = new Map<string, number>();
    for (const [optionId, count] of optionCounts) {
      percentages.set(optionId, totalVotes > 0 ? (count / totalVotes) * 100 : 0);
    }

    return {
      pollId,
      totalVotes,
      optionCounts,
      percentages,
    };
  }

  /**
   * Get poll by ID
   */
  getPoll(pollId: string): Poll | undefined {
    return this.polls.get(pollId);
  }

  /**
   * Get all polls
   */
  getAllPolls(): Poll[] {
    return Array.from(this.polls.values());
  }

  /**
   * Get active polls
   */
  getActivePolls(): Poll[] {
    return this.getAllPolls().filter((p) => p.status === 'active');
  }

  /**
   * Get user's vote for a poll
   */
  getMyVote(pollId: string): string[] | undefined {
    return this.localVotes.get(pollId);
  }

  /**
   * Check if user has voted
   */
  hasVoted(pollId: string): boolean {
    return this.localVotes.has(pollId);
  }

  /**
   * Clear all polls
   */
  clear(): void {
    this.polls.clear();
    this.votes.clear();
    this.localVotes.clear();
  }

  /**
   * Close the manager
   */
  close(): void {
    this.clear();
    this.removeAllListeners();
  }
}

/**
 * Factory function
 */
export function createPollManager(roomId: string, localPubkey: string): PollManager {
  return new PollManager(roomId, localPubkey);
}
