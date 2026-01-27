/**
 * Calling Services Index
 *
 * Exports all calling-related services for use throughout the application.
 * Services are organized by epic/feature area.
 */

// ============================================================================
// Epic 2-3: Core Call Services (1:1 Voice/Video)
// ============================================================================
export * from './webrtcAdapter';
export * from './signalingService';
export * from './e2eeTransforms';

// ============================================================================
// Epic 4: Group Call Services (Mesh Topology)
// ============================================================================
export * from './meshCallManager';
export * from './groupKeyManager';
export * from './audioMixer';

// ============================================================================
// Epic 5: Conference Services (SFU Infrastructure)
// ============================================================================
export * from './sfuConferenceManager';
export * from './mlsKeyManager';
export * from './conferenceFrameEncryptor';
export * from './simulcastManager';

// ============================================================================
// Epic 6: Conference Feature Services
// ============================================================================
export * from './waitingRoomManager';
export * from './hostControlsManager';
export * from './breakoutRoomManager';
export * from './handRaiseManager';
export * from './reactionManager';
export * from './pollManager';
export * from './localRecordingManager';
export * from './conferenceChatManager';

// ============================================================================
// Epic 7: Hotline Services
// ============================================================================
export * from './hotlineQueueManager';
export * from './hotlineCallController';
export * from './operatorStatusManager';

// ============================================================================
// Epic 9: Messaging Hotline Services
// ============================================================================
export * from './messagingQueueManager';
export * from './templateManager';
export * from './broadcastDeliveryManager';
export * from './channelEscalation';

// ============================================================================
// Epic 10: PTT Services
// ============================================================================
export * from './pttChannelManager';
export * from './pttAudioManager';

// ============================================================================
// Epic 8: PSTN Gateway Services
// ============================================================================
export * from './pstnCallManager';
export * from './pstnCreditsManager';
