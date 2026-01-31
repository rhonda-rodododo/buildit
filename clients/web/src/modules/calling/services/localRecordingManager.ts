/**
 * Local Recording Manager
 * Manages local (client-side) recording for conference calls
 *
 * Features:
 * - Client-side only (preserves E2EE)
 * - Consent required from all participants
 * - Canvas compositing for multi-participant layout
 * - WebAudio API for audio mixing
 * - WebM output (VP9 + Opus)
 *
 * Security notes:
 * - Recording happens entirely on the client
 * - No media is sent to servers
 * - All participants must consent
 * - Recording indicator cannot be hidden
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

export type RecordingLayout = 'speaker' | 'gallery' | 'side-by-side';

export interface RecordingParticipant {
  pubkey: string;
  videoTrack?: MediaStreamTrack;
  audioTrack?: MediaStreamTrack;
  element?: HTMLVideoElement;
}

export interface RecordingConsent {
  pubkey: string;
  consented: boolean;
  timestamp: number;
}

export interface RecordingSession {
  id: string;
  roomId: string;
  startedAt: number;
  stoppedAt?: number;
  duration: number;
  layout: RecordingLayout;
  status: 'pending' | 'recording' | 'paused' | 'stopped';
}

export interface LocalRecordingManagerEvents {
  'consent-requested': () => void;
  'consent-received': (consent: RecordingConsent) => void;
  'consent-complete': (allConsented: boolean) => void;
  'recording-started': (session: RecordingSession) => void;
  'recording-paused': (session: RecordingSession) => void;
  'recording-resumed': (session: RecordingSession) => void;
  'recording-stopped': (session: RecordingSession, blob: Blob) => void;
  'recording-error': (error: Error) => void;
}

/** Recording video settings */
const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const VIDEO_FRAMERATE = 30;
const VIDEO_BITRATE = 5_000_000; // 5 Mbps

/** Recording audio settings */
const AUDIO_SAMPLE_RATE = 48000;

/**
 * Local Recording Manager
 */
export class LocalRecordingManager extends EventEmitter {
  private roomId: string;
  private localPubkey: string;
  private participants: Map<string, RecordingParticipant> = new Map();
  private consentStatus: Map<string, RecordingConsent> = new Map();
  private session: RecordingSession | null = null;

  // Recording infrastructure
  private canvas: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;
  private audioSources: Map<string, MediaStreamAudioSourceNode> = new Map();
  private animationFrameId: number | null = null;

  // Callbacks for transport
  private onRequestConsent?: () => Promise<void>;
  private onSendConsent?: (consented: boolean) => Promise<void>;

  constructor(roomId: string, localPubkey: string) {
    super();
    this.roomId = roomId;
    this.localPubkey = localPubkey;
  }

  /**
   * Set callbacks for transport layer
   */
  setOnRequestConsent(callback: () => Promise<void>): void {
    this.onRequestConsent = callback;
  }

  setOnSendConsent(callback: (consented: boolean) => Promise<void>): void {
    this.onSendConsent = callback;
  }

  /**
   * Add participant to recording
   */
  addParticipant(
    pubkey: string,
    videoTrack?: MediaStreamTrack,
    audioTrack?: MediaStreamTrack
  ): void {
    const participant: RecordingParticipant = {
      pubkey,
      videoTrack,
      audioTrack,
    };

    // Create video element for the participant
    if (videoTrack) {
      const video = document.createElement('video');
      video.srcObject = new MediaStream([videoTrack]);
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      participant.element = video;
      video.play().catch((e) => logger.warn('Video play failed', e));
    }

    // Add audio to mixer
    if (audioTrack && this.audioContext && this.audioDestination) {
      const stream = new MediaStream([audioTrack]);
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.audioDestination);
      this.audioSources.set(pubkey, source);
    }

    this.participants.set(pubkey, participant);
    logger.debug('Participant added to recording', { pubkey });
  }

  /**
   * Remove participant from recording
   */
  removeParticipant(pubkey: string): void {
    const participant = this.participants.get(pubkey);
    if (participant?.element) {
      participant.element.srcObject = null;
    }

    // Disconnect audio source
    const audioSource = this.audioSources.get(pubkey);
    if (audioSource) {
      audioSource.disconnect();
      this.audioSources.delete(pubkey);
    }

    this.participants.delete(pubkey);
    this.consentStatus.delete(pubkey);
    logger.debug('Participant removed from recording', { pubkey });
  }

  /**
   * Request consent from all participants
   */
  async requestConsent(): Promise<void> {
    // Clear previous consent status
    this.consentStatus.clear();

    // Add local user as pending
    for (const pubkey of this.participants.keys()) {
      this.consentStatus.set(pubkey, {
        pubkey,
        consented: false,
        timestamp: 0,
      });
    }

    // Send consent request via transport
    if (this.onRequestConsent) {
      await this.onRequestConsent();
    }

    this.emit('consent-requested');
    logger.info('Recording consent requested');
  }

  /**
   * Handle local consent response
   */
  async respondToConsent(consented: boolean): Promise<void> {
    this.consentStatus.set(this.localPubkey, {
      pubkey: this.localPubkey,
      consented,
      timestamp: Date.now(),
    });

    if (this.onSendConsent) {
      await this.onSendConsent(consented);
    }

    this.emit('consent-received', this.consentStatus.get(this.localPubkey)!);
    this.checkConsentComplete();

    logger.info('Local consent response', { consented });
  }

  /**
   * Handle remote consent response
   */
  handleRemoteConsent(pubkey: string, consented: boolean): void {
    this.consentStatus.set(pubkey, {
      pubkey,
      consented,
      timestamp: Date.now(),
    });

    this.emit('consent-received', this.consentStatus.get(pubkey)!);
    this.checkConsentComplete();

    logger.debug('Remote consent received', { pubkey, consented });
  }

  /**
   * Check if all consents are received
   */
  private checkConsentComplete(): void {
    const participants = Array.from(this.participants.keys());
    const allResponded = participants.every((p) => {
      const consent = this.consentStatus.get(p);
      return consent && consent.timestamp > 0;
    });

    if (allResponded) {
      const allConsented = participants.every((p) => this.consentStatus.get(p)?.consented);
      this.emit('consent-complete', allConsented);
    }
  }

  /**
   * Check if all participants consented
   */
  hasAllConsent(): boolean {
    const participants = Array.from(this.participants.keys());
    return participants.every((p) => this.consentStatus.get(p)?.consented);
  }

  /**
   * Start recording
   */
  async startRecording(layout: RecordingLayout = 'gallery'): Promise<void> {
    if (!this.hasAllConsent()) {
      throw new Error('Not all participants have consented to recording');
    }

    if (this.session?.status === 'recording') {
      throw new Error('Recording already in progress');
    }

    // Initialize canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = VIDEO_WIDTH;
    this.canvas.height = VIDEO_HEIGHT;
    this.canvasContext = this.canvas.getContext('2d')!;

    // Initialize audio context and mixer
    this.audioContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
    this.audioDestination = this.audioContext.createMediaStreamDestination();

    // Reconnect all audio sources
    for (const [pubkey, participant] of this.participants) {
      if (participant.audioTrack) {
        const stream = new MediaStream([participant.audioTrack]);
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.audioDestination);
        this.audioSources.set(pubkey, source);
      }
    }

    // Create combined stream (canvas video + mixed audio)
    const videoStream = this.canvas.captureStream(VIDEO_FRAMERATE);
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...this.audioDestination.stream.getAudioTracks(),
    ]);

    // Initialize MediaRecorder
    const mimeType = this.getSupportedMimeType();
    this.mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITRATE,
    });

    this.recordedChunks = [];
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onerror = (event) => {
      const error = new Error('MediaRecorder error');
      logger.error('Recording error', event);
      this.emit('recording-error', error);
    };

    // Create session
    this.session = {
      id: uuidv4(),
      roomId: this.roomId,
      startedAt: Date.now(),
      duration: 0,
      layout,
      status: 'recording',
    };

    // Start recording
    this.mediaRecorder.start(1000); // Collect data every second

    // Start canvas rendering loop
    this.startRenderLoop(layout);

    this.emit('recording-started', this.session);
    logger.info('Recording started', { sessionId: this.session.id, layout });
  }

  /**
   * Get supported MIME type for recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    throw new Error('No supported recording format found');
  }

  /**
   * Start canvas rendering loop
   */
  private startRenderLoop(layout: RecordingLayout): void {
    const render = () => {
      if (this.session?.status !== 'recording') {
        return;
      }

      this.compositeFrame(layout);
      this.animationFrameId = requestAnimationFrame(render);
    };

    render();
  }

  /**
   * Composite all video streams to canvas
   */
  private compositeFrame(layout: RecordingLayout): void {
    if (!this.canvasContext) return;

    const ctx = this.canvasContext;
    const width = VIDEO_WIDTH;
    const height = VIDEO_HEIGHT;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    const participantList = Array.from(this.participants.values()).filter(
      (p) => p.element
    );

    if (participantList.length === 0) return;

    switch (layout) {
      case 'speaker':
        this.renderSpeakerLayout(ctx, participantList, width, height);
        break;
      case 'side-by-side':
        this.renderSideBySideLayout(ctx, participantList, width, height);
        break;
      case 'gallery':
      default:
        this.renderGalleryLayout(ctx, participantList, width, height);
        break;
    }
  }

  /**
   * Render speaker layout (one large + others small)
   */
  private renderSpeakerLayout(
    ctx: CanvasRenderingContext2D,
    participants: RecordingParticipant[],
    width: number,
    height: number
  ): void {
    if (participants.length === 0) return;

    // First participant is the speaker (in production, this would be the active speaker)
    const speaker = participants[0];
    const others = participants.slice(1);

    // Draw speaker large
    if (speaker.element) {
      const speakerHeight = others.length > 0 ? height * 0.75 : height;
      this.drawVideoToCanvas(ctx, speaker.element, 0, 0, width, speakerHeight);
    }

    // Draw others in filmstrip at bottom
    if (others.length > 0) {
      const filmstripHeight = height * 0.25;
      const filmstripY = height - filmstripHeight;
      const tileWidth = width / Math.min(others.length, 5);

      others.slice(0, 5).forEach((p, i) => {
        if (p.element) {
          this.drawVideoToCanvas(
            ctx,
            p.element,
            i * tileWidth,
            filmstripY,
            tileWidth,
            filmstripHeight
          );
        }
      });
    }
  }

  /**
   * Render side-by-side layout (two equal tiles)
   */
  private renderSideBySideLayout(
    ctx: CanvasRenderingContext2D,
    participants: RecordingParticipant[],
    width: number,
    height: number
  ): void {
    const first = participants[0];
    const second = participants[1];

    if (first?.element) {
      this.drawVideoToCanvas(ctx, first.element, 0, 0, width / 2, height);
    }

    if (second?.element) {
      this.drawVideoToCanvas(ctx, second.element, width / 2, 0, width / 2, height);
    }
  }

  /**
   * Render gallery layout (grid)
   */
  private renderGalleryLayout(
    ctx: CanvasRenderingContext2D,
    participants: RecordingParticipant[],
    width: number,
    height: number
  ): void {
    const count = participants.length;
    let cols: number;
    let rows: number;

    // Calculate grid dimensions
    if (count === 1) {
      cols = 1;
      rows = 1;
    } else if (count === 2) {
      cols = 2;
      rows = 1;
    } else if (count <= 4) {
      cols = 2;
      rows = 2;
    } else if (count <= 6) {
      cols = 3;
      rows = 2;
    } else if (count <= 9) {
      cols = 3;
      rows = 3;
    } else {
      cols = 4;
      rows = Math.ceil(count / 4);
    }

    const tileWidth = width / cols;
    const tileHeight = height / rows;

    participants.forEach((p, i) => {
      if (p.element) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        this.drawVideoToCanvas(
          ctx,
          p.element,
          col * tileWidth,
          row * tileHeight,
          tileWidth,
          tileHeight
        );
      }
    });
  }

  /**
   * Draw video element to canvas with aspect ratio preservation
   */
  private drawVideoToCanvas(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const videoAspect = video.videoWidth / video.videoHeight || 16 / 9;
    const targetAspect = w / h;

    let drawWidth = w;
    let drawHeight = h;
    let offsetX = 0;
    let offsetY = 0;

    if (videoAspect > targetAspect) {
      // Video is wider - fit to height
      drawWidth = h * videoAspect;
      offsetX = (w - drawWidth) / 2;
    } else {
      // Video is taller - fit to width
      drawHeight = w / videoAspect;
      offsetY = (h - drawHeight) / 2;
    }

    // Draw background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x, y, w, h);

    // Draw video
    try {
      ctx.drawImage(video, x + offsetX, y + offsetY, drawWidth, drawHeight);
    } catch {
      // Video not ready yet
    }

    // Draw border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (!this.session || this.session.status !== 'recording') {
      throw new Error('Not recording');
    }

    this.mediaRecorder?.pause();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.session.status = 'paused';
    this.session.duration += Date.now() - this.session.startedAt;

    this.emit('recording-paused', this.session);
    logger.info('Recording paused');
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (!this.session || this.session.status !== 'paused') {
      throw new Error('Not paused');
    }

    this.mediaRecorder?.resume();
    this.session.status = 'recording';
    this.session.startedAt = Date.now();

    // Restart render loop
    this.startRenderLoop(this.session.layout);

    this.emit('recording-resumed', this.session);
    logger.info('Recording resumed');
  }

  /**
   * Stop recording and return the recorded blob
   */
  async stopRecording(): Promise<Blob> {
    if (!this.session || !this.mediaRecorder) {
      throw new Error('Not recording');
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No media recorder'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });

          this.session!.stoppedAt = Date.now();
          if (this.session!.status === 'recording') {
            this.session!.duration += Date.now() - this.session!.startedAt;
          }
          this.session!.status = 'stopped';

          this.emit('recording-stopped', this.session!, blob);
          logger.info('Recording stopped', {
            sessionId: this.session!.id,
            duration: this.session!.duration,
            size: blob.size,
          });

          // Cleanup
          this.cleanup();

          resolve(blob);
        } catch (error) {
          reject(error);
        }
      };

      // Stop render loop
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      this.mediaRecorder.stop();
    });
  }

  /**
   * Get current session
   */
  getSession(): RecordingSession | null {
    return this.session;
  }

  /**
   * Check if recording is active
   */
  isRecording(): boolean {
    return this.session?.status === 'recording' || this.session?.status === 'paused';
  }

  /**
   * Get recording duration in milliseconds
   */
  getDuration(): number {
    if (!this.session) return 0;

    if (this.session.status === 'recording') {
      return this.session.duration + (Date.now() - this.session.startedAt);
    }

    return this.session.duration;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    for (const source of this.audioSources.values()) {
      source.disconnect();
    }
    this.audioSources.clear();

    this.audioContext?.close();
    this.audioContext = null;
    this.audioDestination = null;

    this.canvas = null;
    this.canvasContext = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  /**
   * Close the manager
   */
  close(): void {
    if (this.isRecording()) {
      this.stopRecording().catch((e) => logger.error('Error stopping recording', e));
    }

    this.cleanup();

    for (const participant of this.participants.values()) {
      if (participant.element) {
        participant.element.srcObject = null;
      }
    }

    this.participants.clear();
    this.consentStatus.clear();
    this.session = null;
    this.removeAllListeners();
  }
}

/**
 * Factory function
 */
export function createLocalRecordingManager(
  roomId: string,
  localPubkey: string
): LocalRecordingManager {
  return new LocalRecordingManager(roomId, localPubkey);
}
