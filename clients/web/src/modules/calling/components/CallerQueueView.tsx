/**
 * Caller Queue View
 * View shown to callers waiting in the hotline queue
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  Clock,
  Volume2,
  VolumeX,
  PhoneOff,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CallerQueueViewProps {
  hotlineName: string;
  position: number;
  estimatedWaitTime: number; // seconds
  onLeaveQueue: () => void;
  isConnecting?: boolean;
  isConnected?: boolean;
  audioStream?: MediaStream;
}

export function CallerQueueView({
  hotlineName,
  position,
  estimatedWaitTime,
  onLeaveQueue,
  isConnecting = false,
  isConnected = false,
  audioStream,
}: CallerQueueViewProps) {
  const { t } = useTranslation('calling');
  const [waitTime, setWaitTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Track wait time
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setWaitTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Audio visualization
  useEffect(() => {
    if (!audioStream) return;

    const audioContext = new AudioContext();
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyzer);

    audioContextRef.current = audioContext;
    analyzerRef.current = analyzer;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    const updateLevel = () => {
      analyzer.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audioContext.close();
    };
  }, [audioStream]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatEstimate = (seconds: number) => {
    if (seconds < 60) return t('lessThanMinute');
    const mins = Math.ceil(seconds / 60);
    return t('aboutMinutes', { minutes: mins });
  };

  if (isConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-16 w-16 mx-auto mb-6 text-primary animate-spin" />
            <h2 className="text-xl font-semibold mb-2">{t('connecting')}</h2>
            <p className="text-muted-foreground">{t('pleaseWait')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-8 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-green-500/30 animate-pulse" />
              <div className="absolute inset-4 rounded-full bg-green-500 flex items-center justify-center">
                <Phone className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-green-600">
              {t('connected')}
            </h2>
            <p className="text-muted-foreground mb-6">{t('speakingWith')} {hotlineName}</p>

            {/* Call duration */}
            <div className="text-3xl font-mono mb-6">{formatTime(waitTime)}</div>

            {/* End call button */}
            <Button variant="destructive" onClick={onLeaveQueue} size="lg" className="w-full">
              <PhoneOff className="h-5 w-5 mr-2" />
              {t('endCall')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-8 text-center">
          {/* Phone icon with pulse */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-primary/20" />
            <div className="absolute inset-4 rounded-full bg-primary flex items-center justify-center">
              <Phone className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>

          {/* Hotline name */}
          <h2 className="text-lg font-semibold mb-1">{t('callingHotline')}</h2>
          <p className="text-xl font-bold text-primary mb-6">{hotlineName}</p>

          {/* Position in queue */}
          <div className="mb-6">
            <div className="text-6xl font-bold text-primary mb-2">{position}</div>
            <p className="text-muted-foreground">{t('positionInQueue', { position })}</p>
          </div>

          {/* Estimated wait */}
          <div className="mb-6 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-2 text-lg mb-1">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">{formatEstimate(estimatedWaitTime)}</span>
            </div>
            <p className="text-sm text-muted-foreground">{t('estimatedWait')}</p>
          </div>

          {/* Current wait time */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-1">{t('youHaveBeenWaiting')}</p>
            <p className="text-2xl font-mono">{formatTime(waitTime)}</p>
          </div>

          {/* Audio visualizer (hold music indicator) */}
          {audioStream && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-1 h-8">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-1 rounded-full bg-primary transition-all duration-75',
                      isMuted && 'bg-muted'
                    )}
                    style={{
                      height: `${Math.max(4, Math.sin((i / 20) * Math.PI) * audioLevel * 32)}px`,
                    }}
                  />
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMuted(!isMuted)}
                className="mt-2"
              >
                {isMuted ? (
                  <>
                    <VolumeX className="h-4 w-4 mr-2" />
                    {t('unmute')}
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    {t('mute')}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Leave queue button */}
          <Button
            variant="outline"
            onClick={onLeaveQueue}
            className="w-full"
          >
            <PhoneOff className="h-4 w-4 mr-2" />
            {t('leaveQueue')}
          </Button>

          {/* Info text */}
          <p className="text-xs text-muted-foreground mt-4">
            {t('queueInfoText')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default CallerQueueView;
