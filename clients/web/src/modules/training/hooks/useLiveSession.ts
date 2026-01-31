/**
 * useLiveSession Hook
 * Manage live training sessions and integration with calling module
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTrainingStore } from '../trainingStore';
import type { Lesson, LiveSessionContent, LiveSessionRSVP } from '../types';

interface UseLiveSessionOptions {
  lessonId: string;
  autoJoin?: boolean;
}

interface UseLiveSessionReturn {
  // Session data
  lesson: Lesson | null;
  content: LiveSessionContent | null;
  isLoading: boolean;
  error: string | null;

  // Status
  isScheduled: boolean;
  isLive: boolean;
  isEnded: boolean;
  hasRecording: boolean;
  timeUntilStart: number | null; // milliseconds

  // RSVP
  rsvpStatus: LiveSessionRSVP['status'] | null;
  canRSVP: boolean;
  rsvp: (status: LiveSessionRSVP['status']) => Promise<void>;

  // Attendance
  isAttending: boolean;
  attendanceDuration: number; // seconds
  joinSession: () => Promise<string | null>; // Returns conference room ID
  leaveSession: () => Promise<void>;

  // Recording
  recordingUrl: string | null;
}

/**
 * Hook for managing live training sessions
 */
export function useLiveSession({ lessonId, autoJoin = false }: UseLiveSessionOptions): UseLiveSessionReturn {
  const {
    rsvpLiveSession,
    recordLiveAttendance,
  } = useTrainingStore();

  const [lesson] = useState<Lesson | null>(null);
  const [content] = useState<LiveSessionContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rsvpStatus, setRsvpStatus] = useState<LiveSessionRSVP['status'] | null>(null);
  const [isAttending, setIsAttending] = useState(false);
  const [attendanceDuration, setAttendanceDuration] = useState(0);

  const joinTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load lesson data
  useEffect(() => {
    // This would typically fetch the lesson from the store
    // For now, we'll use a placeholder
    setIsLoading(false);
  }, [lessonId]);

  // Calculate session status
  const now = Date.now();
  const isScheduled = content ? content.scheduledAt > now : false;
  const isLive = content
    ? content.scheduledAt <= now && now < content.scheduledAt + content.duration * 60 * 1000
    : false;
  const isEnded = content
    ? now >= content.scheduledAt + content.duration * 60 * 1000
    : false;
  const hasRecording = !!content?.recordingUrl;
  const timeUntilStart = content && isScheduled
    ? content.scheduledAt - now
    : null;

  // RSVP
  const canRSVP = isScheduled && content?.requiresRSVP === true;

  const rsvp = async (status: LiveSessionRSVP['status']) => {
    try {
      await rsvpLiveSession(lessonId, status);
      setRsvpStatus(status);
    } catch (err) {
      setError('Failed to update RSVP');
      throw err;
    }
  };

  // Join session
  const joinSession = useCallback(async (): Promise<string | null> => {
    if (!content?.conferenceRoomId) {
      setError('No conference room available');
      return null;
    }

    try {
      joinTimeRef.current = Date.now();
      setIsAttending(true);

      // Start tracking duration
      durationIntervalRef.current = setInterval(() => {
        if (joinTimeRef.current) {
          setAttendanceDuration(Math.floor((Date.now() - joinTimeRef.current) / 1000));
        }
      }, 1000);

      // Record attendance start
      await recordLiveAttendance(lessonId, joinTimeRef.current);

      return content.conferenceRoomId;
    } catch (err) {
      setError('Failed to join session');
      return null;
    }
  }, [content, lessonId, recordLiveAttendance]);

  // Leave session
  const leaveSession = useCallback(async () => {
    if (!isAttending || !joinTimeRef.current) return;

    try {
      // Stop duration tracking
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Record attendance end
      await recordLiveAttendance(lessonId, joinTimeRef.current, Date.now());

      setIsAttending(false);
      joinTimeRef.current = null;
    } catch (err) {
      setError('Failed to record attendance');
    }
  }, [isAttending, lessonId, recordLiveAttendance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      // Record final attendance if still attending
      if (isAttending && joinTimeRef.current) {
        recordLiveAttendance(lessonId, joinTimeRef.current, Date.now());
      }
    };
  }, [isAttending, lessonId, recordLiveAttendance]);

  // Auto-join if requested
  useEffect(() => {
    if (autoJoin && isLive && !isAttending) {
      joinSession();
    }
  }, [autoJoin, isLive, isAttending, joinSession]);

  return {
    lesson,
    content,
    isLoading,
    error,
    isScheduled,
    isLive,
    isEnded,
    hasRecording,
    timeUntilStart,
    rsvpStatus,
    canRSVP,
    rsvp,
    isAttending,
    attendanceDuration,
    joinSession,
    leaveSession,
    recordingUrl: content?.recordingUrl || null,
  };
}
