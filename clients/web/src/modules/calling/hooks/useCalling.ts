/**
 * Calling Hook
 * React hook for accessing calling functionality
 */

import { useCallback, useEffect, useRef } from 'react';
import { useCallingStore } from '../callingStore';
import { getCallingManager } from '../callingManager';
import { CallType, HangupReason } from '../types';
import { useAuthStore } from '@/stores/authStore';

/**
 * Main calling hook
 */
export function useCalling() {
  const store = useCallingStore();
  const { currentIdentity } = useAuthStore();
  const managerRef = useRef(getCallingManager());

  // Initialize on mount
  useEffect(() => {
    if (currentIdentity) {
      managerRef.current.initialize().catch(console.error);
    }

    return () => {
      // Don't close on unmount - manager is singleton
    };
  }, [currentIdentity?.publicKey]);

  // Start a call
  const startCall = useCallback(async (
    remotePubkey: string,
    callType: CallType,
    options?: {
      remoteName?: string;
      groupId?: string;
      hotlineId?: string;
    }
  ) => {
    return managerRef.current.startCall(remotePubkey, callType, options);
  }, []);

  // Answer incoming call
  const answerCall = useCallback(async () => {
    if (store.incomingCall) {
      await managerRef.current.answerCall(store.incomingCall.callId);
    }
  }, [store.incomingCall]);

  // Decline incoming call
  const declineCall = useCallback(async () => {
    if (store.incomingCall) {
      await managerRef.current.declineCall(store.incomingCall.callId);
    }
  }, [store.incomingCall]);

  // End current call
  const endCall = useCallback(async (reason: HangupReason = HangupReason.Completed) => {
    await managerRef.current.endCall(reason);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    managerRef.current.toggleMute();
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    managerRef.current.toggleVideo();
  }, []);

  // Start screen share
  const startScreenShare = useCallback(async () => {
    await managerRef.current.startScreenShare();
  }, []);

  // Stop screen share
  const stopScreenShare = useCallback(async () => {
    await managerRef.current.stopScreenShare();
  }, []);

  // Switch camera
  const switchCamera = useCallback(async () => {
    await managerRef.current.switchCamera();
  }, []);

  // Clear call history
  const clearCallHistory = useCallback(async () => {
    await managerRef.current.clearCallHistory();
  }, []);

  // Refresh media devices
  const refreshDevices = useCallback(async () => {
    await managerRef.current.getMediaDevices();
  }, []);

  return {
    // State
    activeCall: store.activeCall,
    incomingCall: store.incomingCall,
    callHistory: store.callHistory,
    settings: store.settings,
    devices: store.devices,
    isInCall: store.isInCall(),
    showIncomingCallDialog: store.showIncomingCallDialog,

    // Actions
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    switchCamera,
    clearCallHistory,
    refreshDevices,

    // UI actions
    setCallMinimized: store.setCallMinimized,
    setShowIncomingCallDialog: store.setShowIncomingCallDialog,
  };
}

/**
 * Hook for call quality monitoring
 */
export function useCallQuality() {
  const store = useCallingStore();
  const managerRef = useRef(getCallingManager());

  useEffect(() => {
    if (!store.activeCall) return;

    // Poll quality stats every 2 seconds
    const interval = setInterval(async () => {
      await managerRef.current.getQualityStats();
    }, 2000);

    return () => clearInterval(interval);
  }, [store.activeCall?.callId]);

  return store.activeCall?.quality ?? null;
}

/**
 * Hook for media device selection
 */
export function useMediaDevices() {
  const store = useCallingStore();
  const managerRef = useRef(getCallingManager());

  // Load devices on mount
  useEffect(() => {
    managerRef.current.getMediaDevices().catch(console.error);

    // Listen for device changes
    const handleDeviceChange = async () => {
      await managerRef.current.getMediaDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  return {
    devices: store.devices,
    selectedAudioInput: store.selectedAudioInput,
    selectedAudioOutput: store.selectedAudioOutput,
    selectedVideoInput: store.selectedVideoInput,
    setSelectedAudioInput: store.setSelectedAudioInput,
    setSelectedAudioOutput: store.setSelectedAudioOutput,
    setSelectedVideoInput: store.setSelectedVideoInput,
  };
}

/**
 * Hook for incoming call notifications
 */
export function useIncomingCallNotification() {
  const store = useCallingStore();

  useEffect(() => {
    const incomingCall = store.incomingCall;
    if (!incomingCall) return;

    // Show browser notification if permitted
    if (Notification.permission === 'granted') {
      const notification = new Notification('Incoming Call', {
        body: `${incomingCall.remoteName ?? 'Unknown'} is calling...`,
        icon: '/icons/phone.png',
        requireInteraction: true,
        tag: `call-${incomingCall.callId}`,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return () => {
        notification.close();
      };
    }

    return undefined;
  }, [store.incomingCall?.callId]);
}
