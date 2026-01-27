/**
 * Simulcast Manager
 * Manages simulcast encoding for SFU conference calls
 *
 * Simulcast provides 3 quality layers:
 * - Low: 150kbps, 15fps, 1/4 resolution (for thumbnails, many participants)
 * - Medium: 500kbps, 30fps, 1/2 resolution (for small tiles)
 * - High: 1.5Mbps, 30fps, full resolution (for active speaker)
 *
 * SFU selects which layer to forward based on subscriber preferences
 */

import { logger } from '@/lib/logger';
import {
  type QualityLayer,
  type SimulcastConfig,
  DEFAULT_SIMULCAST_CONFIG,
  type ConferenceLayout,
} from '../types';

/** RTCRtpEncodingParameters with simulcast properties */
interface SimulcastEncodingParameters extends RTCRtpEncodingParameters {
  rid?: string;
  scaleResolutionDownBy?: number;
  scalabilityMode?: string;
}

/**
 * Simulcast Manager
 */
export class SimulcastManager {
  private config: SimulcastConfig;
  private qualityPreferences: Map<string, QualityLayer> = new Map();
  private connection: RTCPeerConnection | null = null;
  private videoSender: RTCRtpSender | null = null;

  constructor(config?: Partial<SimulcastConfig>) {
    this.config = { ...DEFAULT_SIMULCAST_CONFIG, ...config };
  }

  /**
   * Configure simulcast on a peer connection
   */
  configureConnection(connection: RTCPeerConnection): void {
    this.connection = connection;
    logger.info('Simulcast configured for connection');
  }

  /**
   * Add local stream with simulcast encoding
   */
  async addLocalStream(stream: MediaStream, connection: RTCPeerConnection): Promise<void> {
    this.connection = connection;

    // Add audio track normally
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      connection.addTrack(audioTrack, stream);
    }

    // Add video track with simulcast
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const transceiver = connection.addTransceiver(videoTrack, {
        direction: 'sendonly',
        streams: [stream],
        sendEncodings: this.getSimulcastEncodings(),
      });

      this.videoSender = transceiver.sender;
      logger.info('Added video track with simulcast encodings');
    }
  }

  /**
   * Get simulcast encoding parameters
   */
  private getSimulcastEncodings(): SimulcastEncodingParameters[] {
    return [
      {
        rid: 'low',
        active: true,
        maxBitrate: this.config.low.maxBitrate,
        maxFramerate: this.config.low.maxFramerate,
        scaleResolutionDownBy: this.config.low.scaleResolutionDownBy,
        scalabilityMode: 'L1T1',
      },
      {
        rid: 'medium',
        active: true,
        maxBitrate: this.config.medium.maxBitrate,
        maxFramerate: this.config.medium.maxFramerate,
        scaleResolutionDownBy: this.config.medium.scaleResolutionDownBy,
        scalabilityMode: 'L1T2',
      },
      {
        rid: 'high',
        active: true,
        maxBitrate: this.config.high.maxBitrate,
        maxFramerate: this.config.high.maxFramerate,
        scaleResolutionDownBy: this.config.high.scaleResolutionDownBy,
        scalabilityMode: 'L1T3',
      },
    ];
  }

  /**
   * Set quality preference for a participant
   */
  setParticipantQuality(pubkey: string, quality: QualityLayer): void {
    this.qualityPreferences.set(pubkey, quality);
    logger.debug('Set quality preference', { pubkey, quality });
  }

  /**
   * Get quality preference for a participant
   */
  getParticipantQuality(pubkey: string): QualityLayer {
    return this.qualityPreferences.get(pubkey) ?? 'medium';
  }

  /**
   * Calculate optimal quality based on context
   */
  calculateOptimalQuality(
    participantCount: number,
    layout: ConferenceLayout,
    isSpeaking: boolean
  ): QualityLayer {
    // In speaker view, active speaker gets high quality
    if (layout === 'speaker' && isSpeaking) {
      return 'high';
    }

    // In gallery view, calculate based on participant count
    if (layout === 'gallery') {
      if (participantCount <= 4) {
        return 'medium';
      } else if (participantCount <= 9) {
        return 'low';
      } else {
        return 'low';
      }
    }

    // Side-by-side: medium for both
    if (layout === 'side-by-side') {
      return 'medium';
    }

    // Default based on tile size
    if (participantCount <= 2) {
      return 'high';
    } else if (participantCount <= 6) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Calculate optimal quality based on tile dimensions
   */
  calculateQualityForTileSize(width: number, height: number): QualityLayer {
    const pixels = width * height;

    if (pixels >= 480000) {
      // >= ~800x600
      return 'high';
    } else if (pixels >= 120000) {
      // >= ~400x300
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Update encoding parameters dynamically
   */
  async updateEncodingParameters(updates: Partial<SimulcastConfig>): Promise<void> {
    if (!this.videoSender) return;

    this.config = { ...this.config, ...updates };

    const params = this.videoSender.getParameters();
    if (!params.encodings) return;

    const layerMap: Record<string, keyof SimulcastConfig> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
    };

    for (const encoding of params.encodings) {
      const rid = (encoding as SimulcastEncodingParameters).rid;
      if (rid && layerMap[rid]) {
        const layerConfig = this.config[layerMap[rid]];
        encoding.maxBitrate = layerConfig.maxBitrate;
        encoding.maxFramerate = layerConfig.maxFramerate;
        (encoding as SimulcastEncodingParameters).scaleResolutionDownBy =
          layerConfig.scaleResolutionDownBy;
      }
    }

    await this.videoSender.setParameters(params);
    logger.info('Updated simulcast encoding parameters');
  }

  /**
   * Enable or disable specific layers
   */
  async setLayerEnabled(layer: QualityLayer, enabled: boolean): Promise<void> {
    if (!this.videoSender) return;

    const params = this.videoSender.getParameters();
    if (!params.encodings) return;

    for (const encoding of params.encodings) {
      if ((encoding as SimulcastEncodingParameters).rid === layer) {
        encoding.active = enabled;
      }
    }

    await this.videoSender.setParameters(params);
    logger.info('Set layer enabled', { layer, enabled });
  }

  /**
   * Adapt quality based on network conditions
   */
  adaptToNetworkConditions(bandwidth: number): void {
    // Estimate available bandwidth and adjust encoding
    if (bandwidth < 200000) {
      // Very low bandwidth - only low layer
      this.setLayerEnabled('medium', false);
      this.setLayerEnabled('high', false);
    } else if (bandwidth < 700000) {
      // Medium bandwidth - low and medium
      this.setLayerEnabled('medium', true);
      this.setLayerEnabled('high', false);
    } else {
      // Good bandwidth - all layers
      this.setLayerEnabled('medium', true);
      this.setLayerEnabled('high', true);
    }
  }

  /**
   * Get current encoding stats
   */
  async getEncodingStats(): Promise<Map<QualityLayer, { bitrate: number; frameRate: number }>> {
    const stats = new Map<QualityLayer, { bitrate: number; frameRate: number }>();

    if (!this.connection) return stats;

    const rtcStats = await this.connection.getStats();
    for (const report of rtcStats.values()) {
      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        const rid = report.rid as QualityLayer | undefined;
        if (rid) {
          stats.set(rid, {
            bitrate: report.bytesSent ?? 0,
            frameRate: report.framesPerSecond ?? 0,
          });
        }
      }
    }

    return stats;
  }

  /**
   * Close the manager
   */
  close(): void {
    this.qualityPreferences.clear();
    this.connection = null;
    this.videoSender = null;
    logger.info('Simulcast manager closed');
  }
}

/**
 * Singleton instance
 */
let simulcastManagerInstance: SimulcastManager | null = null;

export function getSimulcastManager(): SimulcastManager {
  if (!simulcastManagerInstance) {
    simulcastManagerInstance = new SimulcastManager();
  }
  return simulcastManagerInstance;
}

export function closeSimulcastManager(): void {
  if (simulcastManagerInstance) {
    simulcastManagerInstance.close();
    simulcastManagerInstance = null;
  }
}
