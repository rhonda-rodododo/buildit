/**
 * EmailDeliverySettings Component
 *
 * Configuration panel for email delivery alongside Nostr DM delivery.
 * Part of Epic 53B: Newsletter Email Delivery.
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Mail,
  Globe,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { Newsletter, NewsletterSettings } from '../types';
import { toast } from 'sonner';

interface EmailDeliverySettingsProps {
  newsletter: Newsletter;
  onUpdate: (settings: Partial<NewsletterSettings>) => void;
  className?: string;
}

export const EmailDeliverySettings: FC<EmailDeliverySettingsProps> = ({
  newsletter,
  onUpdate,
  className,
}) => {
  const { t } = useTranslation();
  const { settings } = newsletter;

  const [backendUrl, setBackendUrl] = useState(settings.emailBackendUrl || '');
  const [fromName, setFromName] = useState(settings.fromName || '');
  const [fromEmail, setFromEmail] = useState(settings.fromEmail || '');
  const [replyToEmail, setReplyToEmail] = useState(settings.replyToEmail || '');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'success' | 'error'>('untested');

  const handleToggleEmail = (enabled: boolean) => {
    onUpdate({ emailDeliveryEnabled: enabled });
    if (!enabled) {
      setConnectionStatus('untested');
    }
  };

  const handleSaveSettings = () => {
    onUpdate({
      emailBackendUrl: backendUrl.replace(/\/$/, '') || undefined,
      fromName: fromName || undefined,
      fromEmail: fromEmail || undefined,
      replyToEmail: replyToEmail || undefined,
    });
    toast.success(t('emailDelivery.saved', 'Email delivery settings saved'));
  };

  const handleTestConnection = async () => {
    if (!backendUrl) {
      toast.error(t('emailDelivery.enterBackendUrl', 'Enter a backend URL first'));
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('untested');

    try {
      const response = await fetch(`${backendUrl.replace(/\/$/, '')}/health`);
      if (response.ok) {
        const health = await response.json() as { status: string; capabilities?: { email?: boolean } };
        if (health.capabilities?.email) {
          setConnectionStatus('success');
          toast.success(t('emailDelivery.connectionSuccess', 'Connected to backend worker. Email delivery available.'));
        } else {
          setConnectionStatus('error');
          toast.error(t('emailDelivery.noEmailCapability', 'Backend worker connected but email delivery is not configured. Set SENDGRID_API_KEY or MAILGUN_API_KEY.'));
        }
      } else {
        setConnectionStatus('error');
        toast.error(t('emailDelivery.connectionFailed', 'Failed to connect to backend worker'));
      }
    } catch {
      setConnectionStatus('error');
      toast.error(t('emailDelivery.connectionError', 'Could not reach backend worker. Check the URL and try again.'));
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">
                  {t('emailDelivery.title', 'Email Delivery')}
                </CardTitle>
                <CardDescription>
                  {t('emailDelivery.description', 'Send newsletters via email in addition to Nostr DMs')}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.emailDeliveryEnabled}
              onCheckedChange={handleToggleEmail}
            />
          </div>
        </CardHeader>

        {settings.emailDeliveryEnabled && (
          <CardContent className="space-y-6">
            {/* Backend URL */}
            <div className="space-y-2">
              <Label htmlFor="backendUrl">
                <Globe className="h-3.5 w-3.5 inline mr-1.5" />
                {t('emailDelivery.backendUrl', 'Backend Worker URL')}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="backendUrl"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder="https://backend.buildit.network"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || !backendUrl}
                >
                  {isTestingConnection
                    ? t('emailDelivery.testing', 'Testing...')
                    : t('emailDelivery.testConnection', 'Test')}
                </Button>
              </div>
              {connectionStatus === 'success' && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t('emailDelivery.connected', 'Connected and ready')}
                </p>
              )}
              {connectionStatus === 'error' && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t('emailDelivery.notConnected', 'Connection failed')}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t(
                  'emailDelivery.backendUrlHint',
                  'URL of a self-hosted BuildIt backend worker with email delivery configured'
                )}
              </p>
            </div>

            {/* Sender Information */}
            <div className="space-y-4 pt-2 border-t">
              <h4 className="text-sm font-medium">
                {t('emailDelivery.senderInfo', 'Sender Information')}
              </h4>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fromName">
                    {t('emailDelivery.fromName', 'From Name')}
                  </Label>
                  <Input
                    id="fromName"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    placeholder={newsletter.name}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromEmail">
                    {t('emailDelivery.fromEmail', 'From Email')}
                  </Label>
                  <Input
                    id="fromEmail"
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="newsletter@yourdomain.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="replyToEmail">
                  {t('emailDelivery.replyTo', 'Reply-To Email')}
                </Label>
                <Input
                  id="replyToEmail"
                  type="email"
                  value={replyToEmail}
                  onChange={(e) => setReplyToEmail(e.target.value)}
                  placeholder={t('emailDelivery.replyToPlaceholder', 'Optional — replies go to From Email by default')}
                />
              </div>
            </div>

            {/* Compliance Note */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p className="font-medium mb-1">
                {t('emailDelivery.complianceTitle', 'CAN-SPAM & GDPR Compliance')}
              </p>
              <p>
                {t(
                  'emailDelivery.complianceNote',
                  'All emails automatically include an unsubscribe link. Recipients can opt out at any time. The backend worker handles compliance requirements.'
                )}
              </p>
            </div>

            {/* Save Button */}
            <Button onClick={handleSaveSettings} className="w-full">
              {t('emailDelivery.saveSettings', 'Save Email Settings')}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
};
