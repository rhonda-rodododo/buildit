/**
 * PTT Audio Manager
 * Handles audio broadcasting and receiving for push-to-talk
 */

import { EventEmitter } from 'events';

export interface PTTAudioConfig {
  sampleRate?: number;
  channelCount?: number;
  vadEnabled?: boolean;
  vadThreshold?: number; // dB, default -40
  vadSilenceTimeout?: number; // ms, default 2000
}

const DEFAULT_CONFIG: Required<PTTAudioConfig> = {
  sampleRate: 48000,
  channelCount: 1,
  vadEnabled: false,
  vadThreshold: -40,
  vadSilenceTimeout: 2000,
};

export class PTTAudioManager extends EventEmitter {
  private audioContext?: AudioContext;
  private localStream?: MediaStream;
  private analyser?: AnalyserNode;
  private gainNode?: GainNode;
  private processor?: ScriptProcessorNode;
  private config: Required<PTTAudioConfig>;
  private isRecording: boolean = false;
  private vadSilenceTimer?: ReturnType<typeof setTimeout>;
  private lastAudioLevel: number = -Infinity;

  constructor(config: PTTAudioConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize audio context and get microphone access
   */
  async initialize(): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new AudioContext({
      sampleRate: this.config.sampleRate,
    });

    // Request microphone access
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: this.config.channelCount,
          sampleRate: this.config.sampleRate,
        },
      });
    } catch (error) {
      throw new Error(`Failed to access microphone: ${error}`);
    }

    // Set up audio processing chain
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    this.gainNode = this.audioContext.createGain();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.3;

    // Connect: source -> gain -> analyser
    source.connect(this.gainNode);
    this.gainNode.connect(this.analyser);

    // Initially muted
    this.gainNode.gain.value = 0;

    // Set up audio processor for capturing data
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.analyser.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (event) => {
      if (!this.isRecording) return;

      const inputData = event.inputBuffer.getChannelData(0);

      // Check VAD if enabled
      if (this.config.vadEnabled) {
        this.checkVoiceActivity();
      }

      // Emit audio data
      this.emit('audio-data', this.encodeAudioData(inputData));
    };

    this.emit('initialized');
  }

  /**
   * Start broadcasting audio
   */
  async startBroadcasting(): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      await this.initialize();
    }

    if (this.isRecording) return;

    // Resume audio context if suspended
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Unmute
    this.gainNode!.gain.value = 1;
    this.isRecording = true;

    this.emit('broadcast-started');
  }

  /**
   * Stop broadcasting audio
   */
  stopBroadcasting(): void {
    if (!this.isRecording) return;

    // Mute
    if (this.gainNode) {
      this.gainNode.gain.value = 0;
    }
    this.isRecording = false;

    if (this.vadSilenceTimer) {
      clearTimeout(this.vadSilenceTimer);
      this.vadSilenceTimer = undefined;
    }

    this.emit('broadcast-stopped');
  }

  /**
   * Play received audio data
   */
  async playReceivedAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
      });
    }

    try {
      const audioBuffer = await this.decodeAudioData(audioData);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  }

  /**
   * Enable voice activity detection
   */
  enableVAD(threshold?: number): void {
    this.config.vadEnabled = true;
    if (threshold !== undefined) {
      this.config.vadThreshold = threshold;
    }
  }

  /**
   * Disable voice activity detection
   */
  disableVAD(): void {
    this.config.vadEnabled = false;
    if (this.vadSilenceTimer) {
      clearTimeout(this.vadSilenceTimer);
      this.vadSilenceTimer = undefined;
    }
  }

  /**
   * Check voice activity and emit events
   */
  private checkVoiceActivity(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average level in dB
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const avg = sum / dataArray.length;
    const level = 20 * Math.log10(avg / 255); // Convert to dB

    this.lastAudioLevel = level;

    if (level > this.config.vadThreshold) {
      // Voice detected - clear silence timer
      if (this.vadSilenceTimer) {
        clearTimeout(this.vadSilenceTimer);
        this.vadSilenceTimer = undefined;
      }
      this.emit('voice-activity', true);
    } else {
      // Silence detected - start timer
      if (!this.vadSilenceTimer) {
        this.vadSilenceTimer = setTimeout(() => {
          this.emit('voice-activity', false);
          this.emit('vad-silence');
        }, this.config.vadSilenceTimeout);
      }
    }
  }

  /**
   * Get current audio level in dB
   */
  getAudioLevel(): number {
    if (!this.analyser) return -Infinity;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    const sum = dataArray.reduce((a, b) => a + b, 0);
    const avg = sum / dataArray.length;
    return 20 * Math.log10(avg / 255);
  }

  /**
   * Encode audio data for transmission
   */
  private encodeAudioData(data: Float32Array): ArrayBuffer {
    // Convert Float32Array to Int16Array for more efficient transmission
    const int16Data = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Data.buffer;
  }

  /**
   * Decode received audio data
   */
  private async decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer> {
    // Convert Int16Array back to Float32Array
    const int16Data = new Int16Array(data);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7fff);
    }

    // Create audio buffer
    const audioBuffer = this.audioContext!.createBuffer(
      1,
      float32Data.length,
      this.config.sampleRate
    );
    audioBuffer.copyToChannel(float32Data, 0);

    return audioBuffer;
  }

  /**
   * Set microphone gain
   */
  setGain(value: number): void {
    if (this.gainNode && this.isRecording) {
      this.gainNode.gain.value = Math.max(0, Math.min(2, value));
    }
  }

  /**
   * Check if currently broadcasting
   */
  isBroadcasting(): boolean {
    return this.isRecording;
  }

  /**
   * Get available audio input devices
   */
  async getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }

  /**
   * Switch audio input device
   */
  async switchAudioInput(deviceId: string): Promise<void> {
    if (!this.audioContext) return;

    // Stop current stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }

    // Get new stream with specified device
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Reconnect audio processing chain
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    source.connect(this.gainNode!);

    this.emit('device-changed', deviceId);
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.stopBroadcasting();

    if (this.processor) {
      this.processor.disconnect();
      this.processor = undefined;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = undefined;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = undefined;
    }

    this.removeAllListeners();
  }
}

// Singleton instance
export const pttAudioManager = new PTTAudioManager();
