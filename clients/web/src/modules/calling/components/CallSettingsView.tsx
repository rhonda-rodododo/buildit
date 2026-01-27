/**
 * Call Settings View
 * Settings for voice/video calling preferences
 */

import { useTranslation } from 'react-i18next';
import {
  Settings,
  Mic,
  Camera,
  Shield,
  Video,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useCallingStore } from '../callingStore';
import { useMediaDevices } from '../hooks/useCalling';
import { getCallingManager } from '../callingManager';
import { CallType } from '../types';

export function CallSettingsView() {
  const { t } = useTranslation('calling');
  const { settings, setSettings } = useCallingStore();
  const {
    devices,
    selectedAudioInput,
    selectedAudioOutput,
    selectedVideoInput,
    setSelectedAudioInput,
    setSelectedAudioOutput,
    setSelectedVideoInput,
  } = useMediaDevices();

  // Save settings when they change
  const handleSettingChange = async (key: string, value: unknown) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await getCallingManager().saveSettings(newSettings);
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          {t('settings')}
        </h1>
        <p className="text-muted-foreground">
          {t('settingsDescription')}
        </p>
      </div>

      <div className="space-y-6">
        {/* Audio Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mic className="h-5 w-5" />
              {t('audioSettings')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Microphone */}
            <div className="space-y-2">
              <Label htmlFor="microphone">{t('microphone')}</Label>
              <Select
                value={selectedAudioInput ?? 'default'}
                onValueChange={(v) => setSelectedAudioInput(v === 'default' ? null : v)}
              >
                <SelectTrigger id="microphone">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t('systemDefault')}</SelectItem>
                  {devices.audioInputs.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Speaker */}
            <div className="space-y-2">
              <Label htmlFor="speaker">{t('speaker')}</Label>
              <Select
                value={selectedAudioOutput ?? 'default'}
                onValueChange={(v) => setSelectedAudioOutput(v === 'default' ? null : v)}
              >
                <SelectTrigger id="speaker">
                  <SelectValue placeholder="Select speaker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t('systemDefault')}</SelectItem>
                  {devices.audioOutputs.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Audio processing */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="echo">{t('echoCancellation')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('echoCancellationDesc')}
                </p>
              </div>
              <Switch
                id="echo"
                checked={settings?.echoCancellation ?? true}
                onCheckedChange={(v) => handleSettingChange('echoCancellation', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="noise">{t('noiseSuppression')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('noiseSuppressionDesc')}
                </p>
              </div>
              <Switch
                id="noise"
                checked={settings?.noiseSuppression ?? true}
                onCheckedChange={(v) => handleSettingChange('noiseSuppression', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="gain">{t('autoGainControl')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('autoGainControlDesc')}
                </p>
              </div>
              <Switch
                id="gain"
                checked={settings?.autoGainControl ?? true}
                onCheckedChange={(v) => handleSettingChange('autoGainControl', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Video Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {t('videoSettings')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Camera */}
            <div className="space-y-2">
              <Label htmlFor="camera">{t('camera')}</Label>
              <Select
                value={selectedVideoInput ?? 'default'}
                onValueChange={(v) => setSelectedVideoInput(v === 'default' ? null : v)}
              >
                <SelectTrigger id="camera">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t('systemDefault')}</SelectItem>
                  {devices.videoInputs.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default call type */}
            <div className="space-y-2">
              <Label htmlFor="defaultType">{t('defaultCallType')}</Label>
              <Select
                value={settings?.defaultCallType === CallType.Video ? 'video' : 'voice'}
                onValueChange={(v) =>
                  handleSettingChange(
                    'defaultCallType',
                    v === 'video' ? CallType.Video : CallType.Voice
                  )
                }
              >
                <SelectTrigger id="defaultType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voice">
                    <span className="flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      {t('voiceCall')}
                    </span>
                  </SelectItem>
                  <SelectItem value="video">
                    <span className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      {t('videoCall')}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('privacySettings')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="dnd">{t('doNotDisturb')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('doNotDisturbDesc')}
                </p>
              </div>
              <Switch
                id="dnd"
                checked={settings?.doNotDisturb ?? false}
                onCheckedChange={(v) => handleSettingChange('doNotDisturb', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="unknown">{t('allowUnknownCallers')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('allowUnknownCallersDesc')}
                </p>
              </div>
              <Switch
                id="unknown"
                checked={settings?.allowUnknownCallers ?? true}
                onCheckedChange={(v) => handleSettingChange('allowUnknownCallers', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="relay">{t('relayOnlyMode')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('relayOnlyModeDesc')}
                </p>
              </div>
              <Switch
                id="relay"
                checked={settings?.relayOnlyMode ?? false}
                onCheckedChange={(v) => handleSettingChange('relayOnlyMode', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto">{t('autoAnswer')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('autoAnswerDesc')}
                </p>
              </div>
              <Switch
                id="auto"
                checked={settings?.autoAnswer ?? false}
                onCheckedChange={(v) => handleSettingChange('autoAnswer', v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
