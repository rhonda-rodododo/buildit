/**
 * Virtual Event Configuration Component
 * Form for configuring virtual attendance options for hybrid/virtual events
 */

import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Info, Video, Users, Shield, Mic } from 'lucide-react';
import type { EventVirtualConfig, EventAttendanceType, BreakoutRoomConfig } from '../types';
import { getEventCallingIntegration } from '../integrations/callingIntegration';

interface VirtualEventConfigProps {
  value: EventVirtualConfig | undefined;
  attendanceType: EventAttendanceType;
  onChange: (config: EventVirtualConfig | undefined) => void;
  onAttendanceTypeChange: (type: EventAttendanceType) => void;
  disabled?: boolean;
}

const DEFAULT_CONFIG: EventVirtualConfig = {
  _v: '1.0.0',
  enabled: false,
  autoStartMinutes: 15,
  waitingRoomEnabled: true,
  recordingEnabled: false,
  recordingConsentRequired: true,
  breakoutRoomsEnabled: false,
  e2eeRequired: true,
};

export const VirtualEventConfig: FC<VirtualEventConfigProps> = ({
  value,
  attendanceType,
  onChange,
  onAttendanceTypeChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [callingAvailable, setCallingAvailable] = useState<boolean | null>(null);

  // Check if calling module is available
  useEffect(() => {
    getEventCallingIntegration()
      .isCallingModuleAvailable()
      .then(setCallingAvailable);
  }, []);

  const config = value || DEFAULT_CONFIG;

  const updateConfig = (updates: Partial<EventVirtualConfig>) => {
    const newConfig = { ...config, ...updates };
    onChange(newConfig.enabled ? newConfig : undefined);
  };

  const updateBreakoutConfig = (updates: Partial<BreakoutRoomConfig>) => {
    const defaultBreakoutConfig: BreakoutRoomConfig = {
      _v: '1.0.0',
      enabled: false,
      autoAssign: true,
      allowSelfSelect: false,
    };
    const newBreakoutConfig: BreakoutRoomConfig = {
      ...defaultBreakoutConfig,
      ...config.breakoutConfig,
      ...updates,
    };
    updateConfig({ breakoutConfig: newBreakoutConfig });
  };

  // Don't show if calling module is not available
  if (callingAvailable === false) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>{t('events.virtualConfig.callingNotAvailable')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4" />
              {t('events.virtualConfig.title')}
            </CardTitle>
            <CardDescription>
              {t('events.virtualConfig.description')}
            </CardDescription>
          </div>
          <Badge variant={attendanceType === 'in-person' ? 'outline' : 'default'}>
            {t(`events.virtualConfig.attendanceTypes.${attendanceType}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Attendance Type Selection */}
        <div className="space-y-2">
          <Label>{t('events.virtualConfig.attendanceTypeLabel')}</Label>
          <Select
            value={attendanceType}
            onValueChange={(v) => {
              onAttendanceTypeChange(v as EventAttendanceType);
              if (v === 'in-person') {
                updateConfig({ enabled: false });
              } else {
                updateConfig({ enabled: true });
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in-person">
                {t('events.virtualConfig.attendanceTypes.in-person')}
              </SelectItem>
              <SelectItem value="virtual">
                {t('events.virtualConfig.attendanceTypes.virtual')}
              </SelectItem>
              <SelectItem value="hybrid">
                {t('events.virtualConfig.attendanceTypes.hybrid')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Virtual Settings - only show if virtual or hybrid */}
        {(attendanceType === 'virtual' || attendanceType === 'hybrid') && (
          <>
            <Separator />

            {/* Auto-start Conference */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('events.virtualConfig.autoStartLabel')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('events.virtualConfig.autoStartDescription')}
                </p>
              </div>
              <Select
                value={config.autoStartMinutes.toString()}
                onValueChange={(v) => updateConfig({ autoStartMinutes: parseInt(v, 10) })}
                disabled={disabled}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="10">10 min</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max Virtual Attendees */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  {t('events.virtualConfig.maxAttendeesLabel')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('events.virtualConfig.maxAttendeesDescription')}
                </p>
              </div>
              <Input
                type="number"
                min={1}
                max={1000}
                value={config.maxVirtualAttendees || ''}
                onChange={(e) => updateConfig({
                  maxVirtualAttendees: e.target.value ? parseInt(e.target.value, 10) : undefined
                })}
                placeholder="Unlimited"
                className="w-24"
                disabled={disabled}
              />
            </div>

            <Separator />

            {/* Waiting Room */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('events.virtualConfig.waitingRoomLabel')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('events.virtualConfig.waitingRoomDescription')}
                </p>
              </div>
              <Switch
                checked={config.waitingRoomEnabled}
                onCheckedChange={(checked) => updateConfig({ waitingRoomEnabled: checked })}
                disabled={disabled}
              />
            </div>

            {/* E2EE Required */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Shield className="h-3 w-3" />
                  {t('events.virtualConfig.e2eeLabel')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('events.virtualConfig.e2eeDescription')}
                </p>
              </div>
              <Switch
                checked={config.e2eeRequired}
                onCheckedChange={(checked) => updateConfig({ e2eeRequired: checked })}
                disabled={disabled}
              />
            </div>

            <Separator />

            {/* Recording Settings */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Mic className="h-3 w-3" />
                  {t('events.virtualConfig.recordingLabel')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('events.virtualConfig.recordingDescription')}
                </p>
              </div>
              <Switch
                checked={config.recordingEnabled}
                onCheckedChange={(checked) => updateConfig({ recordingEnabled: checked })}
                disabled={disabled}
              />
            </div>

            {config.recordingEnabled && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-muted">
                <div className="space-y-0.5">
                  <Label>{t('events.virtualConfig.recordingConsentLabel')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('events.virtualConfig.recordingConsentDescription')}
                  </p>
                </div>
                <Switch
                  checked={config.recordingConsentRequired}
                  onCheckedChange={(checked) => updateConfig({ recordingConsentRequired: checked })}
                  disabled={disabled}
                />
              </div>
            )}

            <Separator />

            {/* Breakout Rooms */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('events.virtualConfig.breakoutLabel')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('events.virtualConfig.breakoutDescription')}
                </p>
              </div>
              <Switch
                checked={config.breakoutRoomsEnabled}
                onCheckedChange={(checked) => updateConfig({ breakoutRoomsEnabled: checked })}
                disabled={disabled}
              />
            </div>

            {config.breakoutRoomsEnabled && (
              <div className="space-y-3 pl-4 border-l-2 border-muted">
                <div className="flex items-center justify-between">
                  <Label>{t('events.virtualConfig.breakoutRoomCountLabel')}</Label>
                  <Input
                    type="number"
                    min={2}
                    max={50}
                    value={config.breakoutConfig?.roomCount || 4}
                    onChange={(e) => updateBreakoutConfig({
                      roomCount: parseInt(e.target.value, 10)
                    })}
                    className="w-20"
                    disabled={disabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('events.virtualConfig.breakoutAutoAssignLabel')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('events.virtualConfig.breakoutAutoAssignDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={config.breakoutConfig?.autoAssign ?? true}
                    onCheckedChange={(checked) => updateBreakoutConfig({ autoAssign: checked })}
                    disabled={disabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('events.virtualConfig.breakoutSelfSelectLabel')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('events.virtualConfig.breakoutSelfSelectDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={config.breakoutConfig?.allowSelfSelect ?? false}
                    onCheckedChange={(checked) => updateBreakoutConfig({ allowSelfSelect: checked })}
                    disabled={disabled}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default VirtualEventConfig;
