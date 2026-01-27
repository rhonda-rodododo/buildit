/**
 * Audio Mixer and Active Speaker Detection
 * Handles audio mixing for group calls and detects who is speaking
 *
 * Features:
 * - Per-participant volume control
 * - Active speaker detection using audio levels
 * - Dominant speaker identification
 * - Audio level visualization data
 */

import { logger } from '@/lib/logger';

/** Speaking threshold in dB (typical speech is -30 to -10 dB) */
const SPEAKING_THRESHOLD_DB = -40;

/** Number of samples to keep for rolling average */
const ROLLING_WINDOW_SIZE = 10;

/** Minimum time to be considered speaking (ms) */
const MIN_SPEAKING_DURATION_MS = 300;

/** Debounce time for speaker changes (ms) */
const SPEAKER_DEBOUNCE_MS = 500;

interface ParticipantAudioState {
  gainNode: GainNode;
  analyser: AnalyserNode;
  sourceNode: MediaStreamAudioSourceNode;
  audioLevels: number[];
  lastSpeakingTime: number;
  isSpeaking: boolean;
}

/**
 * Audio Mixer class
 * Manages audio from multiple participants with individual volume controls
 */
export class AudioMixer {
  private audioContext: AudioContext;
  private participants: Map<string, ParticipantAudioState> = new Map();
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private masterGainNode: GainNode | null = null;

  constructor() {
    // Create audio context lazily on first use
    this.audioContext = new AudioContext();
  }

  /**
   * Resume audio context (needed for browser autoplay policy)
   */
  async resume(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Add a participant's audio stream
   */
  addParticipant(pubkey: string, stream: MediaStream): void {
    // Remove existing if any
    this.removeParticipant(pubkey);

    // Create audio nodes
    const sourceNode = this.audioContext.createMediaStreamSource(stream);
    const gainNode = this.audioContext.createGain();
    const analyser = this.audioContext.createAnalyser();

    // Configure analyser for level detection
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;

    // Connect nodes: source -> gain -> analyser -> destination
    sourceNode.connect(gainNode);
    gainNode.connect(analyser);

    // Connect to output if we have a destination
    if (this.destinationNode) {
      analyser.connect(this.destinationNode);
    } else {
      // Connect directly to speakers
      analyser.connect(this.audioContext.destination);
    }

    // Store state
    this.participants.set(pubkey, {
      gainNode,
      analyser,
      sourceNode,
      audioLevels: [],
      lastSpeakingTime: 0,
      isSpeaking: false,
    });

    logger.info('Added participant to audio mixer', { pubkey });
  }

  /**
   * Remove a participant's audio
   */
  removeParticipant(pubkey: string): void {
    const state = this.participants.get(pubkey);
    if (!state) return;

    try {
      state.sourceNode.disconnect();
      state.gainNode.disconnect();
      state.analyser.disconnect();
    } catch {
      // Already disconnected
    }

    this.participants.delete(pubkey);
    logger.info('Removed participant from audio mixer', { pubkey });
  }

  /**
   * Set volume for a specific participant (0.0 to 1.0)
   */
  setParticipantVolume(pubkey: string, volume: number): void {
    const state = this.participants.get(pubkey);
    if (!state) return;

    // Clamp volume
    const clampedVolume = Math.max(0, Math.min(1, volume));
    state.gainNode.gain.setValueAtTime(clampedVolume, this.audioContext.currentTime);
  }

  /**
   * Mute a specific participant
   */
  muteParticipant(pubkey: string): void {
    this.setParticipantVolume(pubkey, 0);
  }

  /**
   * Unmute a specific participant
   */
  unmuteParticipant(pubkey: string): void {
    this.setParticipantVolume(pubkey, 1);
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  setMasterVolume(volume: number): void {
    if (!this.masterGainNode) {
      this.masterGainNode = this.audioContext.createGain();
    }
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.masterGainNode.gain.setValueAtTime(clampedVolume, this.audioContext.currentTime);
  }

  /**
   * Get mixed audio stream (for recording or further processing)
   */
  getMixedStream(): MediaStream {
    if (!this.destinationNode) {
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // Reconnect all participants to the new destination
      for (const [pubkey, state] of this.participants) {
        try {
          state.analyser.disconnect();
          state.analyser.connect(this.destinationNode);
        } catch (error) {
          logger.warn('Failed to reconnect participant', { pubkey, error });
        }
      }
    }

    return this.destinationNode.stream;
  }

  /**
   * Get current audio level for a participant (0.0 to 1.0)
   */
  getAudioLevel(pubkey: string): number {
    const state = this.participants.get(pubkey);
    if (!state) return 0;

    const dataArray = new Uint8Array(state.analyser.frequencyBinCount);
    state.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // Normalize to 0-1 range
    return rms / 255;
  }

  /**
   * Get audio levels for all participants
   */
  getAllAudioLevels(): Map<string, number> {
    const levels = new Map<string, number>();
    for (const pubkey of this.participants.keys()) {
      levels.set(pubkey, this.getAudioLevel(pubkey));
    }
    return levels;
  }

  /**
   * Clean up all resources
   */
  close(): void {
    for (const pubkey of this.participants.keys()) {
      this.removeParticipant(pubkey);
    }

    if (this.destinationNode) {
      this.destinationNode.disconnect();
      this.destinationNode = null;
    }

    if (this.masterGainNode) {
      this.masterGainNode.disconnect();
      this.masterGainNode = null;
    }

    this.audioContext.close().catch(() => {
      // Already closed
    });

    logger.info('Audio mixer closed');
  }
}

/**
 * Active Speaker Detector
 * Detects who is currently speaking based on audio levels
 */
export class ActiveSpeakerDetector {
  private audioLevels: Map<string, number[]> = new Map();
  private speakingStates: Map<string, { isSpeaking: boolean; since: number }> = new Map();
  private dominantSpeaker: string | null = null;
  private lastDominantChange: number = 0;

  // Callbacks
  private onActiveSpeakersChange: ((speakers: string[]) => void) | null = null;
  private onDominantSpeakerChange: ((speaker: string | null) => void) | null = null;

  /**
   * Set callback for active speakers changes
   */
  setOnActiveSpeakersChange(cb: (speakers: string[]) => void): void {
    this.onActiveSpeakersChange = cb;
  }

  /**
   * Set callback for dominant speaker changes
   */
  setOnDominantSpeakerChange(cb: (speaker: string | null) => void): void {
    this.onDominantSpeakerChange = cb;
  }

  /**
   * Update audio level for a participant
   * @param pubkey Participant's public key
   * @param level Audio level (0.0 to 1.0)
   */
  updateLevel(pubkey: string, level: number): void {
    // Get or create level history
    let levels = this.audioLevels.get(pubkey);
    if (!levels) {
      levels = [];
      this.audioLevels.set(pubkey, levels);
    }

    // Add new level
    levels.push(level);

    // Keep rolling window
    if (levels.length > ROLLING_WINDOW_SIZE) {
      levels.shift();
    }

    // Check if speaking
    const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
    const levelDb = 20 * Math.log10(avgLevel + 0.001); // Add small value to avoid log(0)
    const isSpeaking = levelDb > SPEAKING_THRESHOLD_DB;

    // Update speaking state
    const currentState = this.speakingStates.get(pubkey);
    const now = Date.now();

    if (isSpeaking) {
      if (!currentState?.isSpeaking) {
        this.speakingStates.set(pubkey, { isSpeaking: true, since: now });
      }
    } else {
      if (currentState?.isSpeaking) {
        // Only stop speaking if we've been silent for a bit
        const speakingDuration = now - currentState.since;
        if (speakingDuration < MIN_SPEAKING_DURATION_MS) {
          // Too short, might be noise - keep as speaking
          return;
        }
        this.speakingStates.set(pubkey, { isSpeaking: false, since: now });
      }
    }

    // Update dominant speaker
    this.updateDominantSpeaker();
  }

  /**
   * Update dominant speaker calculation
   */
  private updateDominantSpeaker(): void {
    const now = Date.now();
    const activeSpeakers = this.getActiveSpeakers();

    // Debounce dominant speaker changes
    if (now - this.lastDominantChange < SPEAKER_DEBOUNCE_MS) {
      return;
    }

    // Find the loudest active speaker
    let loudestSpeaker: string | null = null;
    let loudestLevel = 0;

    for (const pubkey of activeSpeakers) {
      const levels = this.audioLevels.get(pubkey);
      if (!levels || levels.length === 0) continue;

      const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
      if (avgLevel > loudestLevel) {
        loudestLevel = avgLevel;
        loudestSpeaker = pubkey;
      }
    }

    // Update if changed
    if (loudestSpeaker !== this.dominantSpeaker) {
      this.dominantSpeaker = loudestSpeaker;
      this.lastDominantChange = now;

      if (this.onDominantSpeakerChange) {
        this.onDominantSpeakerChange(loudestSpeaker);
      }
    }

    // Notify active speakers change
    if (this.onActiveSpeakersChange) {
      this.onActiveSpeakersChange(activeSpeakers);
    }
  }

  /**
   * Get list of currently speaking participants
   */
  getActiveSpeakers(): string[] {
    const speakers: string[] = [];
    const now = Date.now();

    for (const [pubkey, state] of this.speakingStates) {
      if (state.isSpeaking) {
        // Must be speaking for minimum duration
        if (now - state.since >= MIN_SPEAKING_DURATION_MS) {
          speakers.push(pubkey);
        }
      }
    }

    return speakers;
  }

  /**
   * Get the dominant (loudest) speaker
   */
  getDominantSpeaker(): string | null {
    return this.dominantSpeaker;
  }

  /**
   * Check if a specific participant is speaking
   */
  isSpeaking(pubkey: string): boolean {
    const state = this.speakingStates.get(pubkey);
    if (!state) return false;

    if (state.isSpeaking) {
      const duration = Date.now() - state.since;
      return duration >= MIN_SPEAKING_DURATION_MS;
    }

    return false;
  }

  /**
   * Remove a participant
   */
  removeParticipant(pubkey: string): void {
    this.audioLevels.delete(pubkey);
    this.speakingStates.delete(pubkey);

    if (this.dominantSpeaker === pubkey) {
      this.dominantSpeaker = null;
      this.updateDominantSpeaker();
    }
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.audioLevels.clear();
    this.speakingStates.clear();
    this.dominantSpeaker = null;
    this.lastDominantChange = 0;
  }
}
