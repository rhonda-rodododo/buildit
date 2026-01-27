/**
 * Recording Controls
 * Local recording controls for conference calls
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Radio,
  Square,
  Pause,
  Play,
  Download,
  ChevronDown,
  Users,
  User,
  Grid,
} from 'lucide-react';
import {
  createLocalRecordingManager,
  type LocalRecordingManager,
  type RecordingLayout,
} from '../services/localRecordingManager';

interface RecordingControlsProps {
  roomId: string;
  localPubkey?: string;
  isRecording: boolean;
  participants?: Map<string, { pubkey: string; stream?: MediaStream }>;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export function RecordingControls({
  roomId,
  localPubkey = '',
  isRecording: _externalIsRecording,
  participants,
  onRecordingStateChange,
}: RecordingControlsProps) {
  const { t } = useTranslation('calling');
  const [manager] = useState<LocalRecordingManager>(() => createLocalRecordingManager(roomId, localPubkey));
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [layout, setLayout] = useState<RecordingLayout>('gallery');
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  useEffect(() => {
    const handleConsentReceived = () => {
      // Update consent status
    };

    const handleRecordingStarted = () => {
      setIsRecording(true);
      setDuration(0);
      onRecordingStateChange?.(true);
    };

    const handleRecordingStopped = (blob: Blob) => {
      setIsRecording(false);
      setIsPaused(false);
      setRecordingBlob(blob);
      onRecordingStateChange?.(false);
    };

    manager.on('consent-received', handleConsentReceived);
    manager.on('recording-started', handleRecordingStarted);
    manager.on('recording-stopped', handleRecordingStopped);

    return () => {
      manager.off('consent-received', handleConsentReceived);
      manager.off('recording-started', handleRecordingStarted);
      manager.off('recording-stopped', handleRecordingStopped);
    };
  }, [manager, onRecordingStateChange]);

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    // Request consent from participants
    await manager.requestConsent();
    // Note: In production, we'd wait for consent responses and check hasAllConsent()
    // For now, proceed after requesting consent

    // Add participant streams
    if (participants) {
      for (const [pubkey, p] of participants) {
        if (p.stream) {
          const videoTrack = p.stream.getVideoTracks()[0];
          const audioTrack = p.stream.getAudioTracks()[0];
          manager.addParticipant(pubkey, videoTrack, audioTrack);
        }
      }
    }

    await manager.startRecording(layout);
  };

  const handleStopRecording = async () => {
    const blob = await manager.stopRecording();
    setRecordingBlob(blob);
  };

  const handlePauseResume = () => {
    if (isPaused) {
      manager.resumeRecording();
      setIsPaused(false);
    } else {
      manager.pauseRecording();
      setIsPaused(true);
    }
  };

  const handleDownload = () => {
    if (recordingBlob) {
      const url = URL.createObjectURL(recordingBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${roomId}-${new Date().toISOString().slice(0, 10)}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setRecordingBlob(null);
    }
  };

  const getLayoutIcon = (l: RecordingLayout) => {
    switch (l) {
      case 'speaker':
        return <User className="w-4 h-4" />;
      case 'gallery':
        return <Grid className="w-4 h-4" />;
      case 'side-by-side':
        return <Users className="w-4 h-4" />;
    }
  };

  return (
    <>
      {/* Main recording button */}
      <div className="flex items-center gap-1">
        {!isRecording ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="w-12 h-12 rounded-full"
                  onClick={handleStartRecording}
                >
                  <Radio className="w-5 h-5 text-red-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('startRecording')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="flex items-center gap-2 bg-red-500/20 rounded-full px-3 py-2">
            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
            <span className="text-red-500 font-mono text-sm">
              {formatDuration(duration)}
            </span>

            {/* Pause/Resume */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-red-500 hover:text-red-400"
                    onClick={handlePauseResume}
                  >
                    {isPaused ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isPaused ? t('resumeRecording') : t('pauseRecording')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Stop */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-red-500 hover:text-red-400"
                    onClick={handleStopRecording}
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('stopRecording')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Layout selector (when not recording) */}
        {!isRecording && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLayout('speaker')}>
                {getLayoutIcon('speaker')}
                <span className="ml-2">{t('speakerLayout')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLayout('gallery')}>
                {getLayoutIcon('gallery')}
                <span className="ml-2">{t('galleryLayout')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLayout('side-by-side')}>
                {getLayoutIcon('side-by-side')}
                <span className="ml-2">{t('sideBySideLayout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Download dialog */}
      {recordingBlob && (
        <Dialog open={!!recordingBlob} onOpenChange={() => setRecordingBlob(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('recordingComplete')}</DialogTitle>
              <DialogDescription>
                {t('recordingCompleteDescription')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRecordingBlob(null)}>
                {t('discard')}
              </Button>
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                {t('download')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Consent dialog */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('recordingConsent')}</DialogTitle>
            <DialogDescription>
              {t('recordingConsentDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConsentDialog(false)}>
              {t('decline')}
            </Button>
            <Button onClick={() => setShowConsentDialog(false)}>
              {t('consent')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RecordingControls;
