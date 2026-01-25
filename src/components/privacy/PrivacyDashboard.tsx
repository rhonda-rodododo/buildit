/**
 * Privacy Dashboard Component
 * Central control panel for privacy settings and covert supporter features
 * Critical for high-risk organizing contexts
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  UserX,
  Bell,
  MessageSquare,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react';

interface PrivacySettings {
  covertMode: boolean;
  anonymousVoting: boolean;
  anonymousReactions: boolean;
  hideFromDirectory: boolean;
  encryptedMessagesOnly: boolean;
  disableReadReceipts: boolean;
  hideActivityStatus: boolean;
  restrictProfileVisibility: boolean;
}

interface PrivacyDashboardProps {
  currentMode: 'normal' | 'covert';
  riskLevel: 'low' | 'medium' | 'high';
  className?: string;
}

export const PrivacyDashboard: FC<PrivacyDashboardProps> = ({
  currentMode,
  riskLevel,
  className
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'normal' | 'covert'>(currentMode);
  const [settings, setSettings] = useState<PrivacySettings>({
    covertMode: currentMode === 'covert',
    anonymousVoting: true,
    anonymousReactions: true,
    hideFromDirectory: currentMode === 'covert',
    encryptedMessagesOnly: true,
    disableReadReceipts: currentMode === 'covert',
    hideActivityStatus: currentMode === 'covert',
    restrictProfileVisibility: currentMode === 'covert'
  });

  const handleToggleCovertMode = () => {
    const newMode = mode === 'normal' ? 'covert' : 'normal';
    setMode(newMode);

    if (newMode === 'covert') {
      // Enable all privacy settings
      setSettings({
        covertMode: true,
        anonymousVoting: true,
        anonymousReactions: true,
        hideFromDirectory: true,
        encryptedMessagesOnly: true,
        disableReadReceipts: true,
        hideActivityStatus: true,
        restrictProfileVisibility: true
      });
    } else {
      // Reset to normal mode
      setSettings({
        covertMode: false,
        anonymousVoting: true,
        anonymousReactions: false,
        hideFromDirectory: false,
        encryptedMessagesOnly: true,
        disableReadReceipts: false,
        hideActivityStatus: false,
        restrictProfileVisibility: false
      });
    }
  };

  const toggleSetting = (key: keyof PrivacySettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getRiskLevelColor = (level: typeof riskLevel) => {
    switch (level) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-red-500';
    }
  };

  const getRiskLevelLabel = (level: typeof riskLevel) => {
    switch (level) {
      case 'low': return t('privacyDashboard.riskLow');
      case 'medium': return t('privacyDashboard.riskMedium');
      case 'high': return t('privacyDashboard.riskHigh');
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Covert Mode Toggle */}
      <Card className={`p-6 ${mode === 'covert' ? 'bg-purple-500/5 border-purple-500/20' : ''}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <UserX className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">{t('privacyDashboard.covertMode')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('privacyDashboard.covertModeDesc')}
              </p>
            </div>
          </div>

          <Switch
            checked={mode === 'covert'}
            onCheckedChange={handleToggleCovertMode}
          />
        </div>

        {mode === 'covert' && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                  {t('privacyDashboard.covertActive')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('privacyDashboard.covertActiveDesc')}
                </p>
              </div>
            </div>
          </div>
        )}

        {mode === 'normal' && riskLevel === 'high' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                  {t('privacyDashboard.highRiskDetected')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('privacyDashboard.highRiskAdvice')}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Risk Level */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <div>
              <div className="text-sm font-medium">{t('privacyDashboard.riskLevel')}</div>
              <div className="text-xs text-muted-foreground">{t('privacyDashboard.riskLevelDesc')}</div>
            </div>
          </div>

          <Badge className={`${getRiskLevelColor(riskLevel)} text-white`}>
            {getRiskLevelLabel(riskLevel)}
          </Badge>
        </div>
      </Card>

      {/* Privacy Settings */}
      <div>
        <h3 className="font-semibold mb-3">{t('privacyDashboard.privacyControls')}</h3>
        <div className="space-y-2">
          {/* Anonymous Voting */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{t('privacyDashboard.settings.anonymousVoting')}</div>
                  <div className="text-xs text-muted-foreground">{t('privacyDashboard.settings.anonymousVotingDesc')}</div>
                </div>
              </div>
              <Switch
                checked={settings.anonymousVoting}
                onCheckedChange={() => toggleSetting('anonymousVoting')}
              />
            </div>
          </Card>

          {/* Anonymous Reactions */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <EyeOff className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{t('privacyDashboard.settings.anonymousReactions')}</div>
                  <div className="text-xs text-muted-foreground">{t('privacyDashboard.settings.anonymousReactionsDesc')}</div>
                </div>
              </div>
              <Switch
                checked={settings.anonymousReactions}
                onCheckedChange={() => toggleSetting('anonymousReactions')}
              />
            </div>
          </Card>

          {/* Hide from Directory */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{t('privacyDashboard.settings.hideFromDirectory')}</div>
                  <div className="text-xs text-muted-foreground">{t('privacyDashboard.settings.hideFromDirectoryDesc')}</div>
                </div>
              </div>
              <Switch
                checked={settings.hideFromDirectory}
                onCheckedChange={() => toggleSetting('hideFromDirectory')}
                disabled={mode === 'covert'}
              />
            </div>
          </Card>

          {/* Encrypted Messages Only */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{t('privacyDashboard.settings.encryptedMessagesOnly')}</div>
                  <div className="text-xs text-muted-foreground">{t('privacyDashboard.settings.encryptedMessagesOnlyDesc')}</div>
                </div>
              </div>
              <Switch
                checked={settings.encryptedMessagesOnly}
                onCheckedChange={() => toggleSetting('encryptedMessagesOnly')}
              />
            </div>
          </Card>

          {/* Disable Read Receipts */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{t('privacyDashboard.settings.disableReadReceipts')}</div>
                  <div className="text-xs text-muted-foreground">{t('privacyDashboard.settings.disableReadReceiptsDesc')}</div>
                </div>
              </div>
              <Switch
                checked={settings.disableReadReceipts}
                onCheckedChange={() => toggleSetting('disableReadReceipts')}
                disabled={mode === 'covert'}
              />
            </div>
          </Card>

          {/* Hide Activity Status */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{t('privacyDashboard.settings.hideActivityStatus')}</div>
                  <div className="text-xs text-muted-foreground">{t('privacyDashboard.settings.hideActivityStatusDesc')}</div>
                </div>
              </div>
              <Switch
                checked={settings.hideActivityStatus}
                onCheckedChange={() => toggleSetting('hideActivityStatus')}
                disabled={mode === 'covert'}
              />
            </div>
          </Card>

          {/* Restrict Profile Visibility */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{t('privacyDashboard.settings.restrictProfileVisibility')}</div>
                  <div className="text-xs text-muted-foreground">{t('privacyDashboard.settings.restrictProfileVisibilityDesc')}</div>
                </div>
              </div>
              <Switch
                checked={settings.restrictProfileVisibility}
                onCheckedChange={() => toggleSetting('restrictProfileVisibility')}
                disabled={mode === 'covert'}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Info Box */}
      <Card className="p-4 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium mb-1">{t('privacyDashboard.aboutTitle')}</h4>
            <p className="text-xs text-muted-foreground mb-2">
              {t('privacyDashboard.aboutDesc')}
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• <strong>{t('privacyDashboard.aboutCovert')}</strong> {t('privacyDashboard.aboutCovertDesc')}</li>
              <li>• <strong>{t('privacyDashboard.aboutAnonymous')}</strong> {t('privacyDashboard.aboutAnonymousDesc')}</li>
              <li>• <strong>{t('privacyDashboard.aboutHidden')}</strong> {t('privacyDashboard.aboutHiddenDesc')}</li>
              <li>• <strong>{t('privacyDashboard.aboutEncryption')}</strong> {t('privacyDashboard.aboutEncryptionDesc')}</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};
