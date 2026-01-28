/**
 * PSTN Provider Settings
 * Configure BYOA (Bring Your Own Asterisk/Twilio/Plivo) provider for PSTN calling
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  Server,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  type PSTNProviderType,
  type PSTNProviderConfig,
  type TwilioCredentials,
  type PlivoCredentials,
  type TelnyxCredentials,
  type SIPConfig,
  type SIPTransport,
  type ProviderTestResult,
  createPSTNProvider,
  validateProviderConfig,
} from '../services/pstn';

interface PSTNProviderSettingsProps {
  groupId: string;
  initialConfig?: PSTNProviderConfig;
  onSave: (config: PSTNProviderConfig) => Promise<void>;
  onCancel?: () => void;
  workerUrl: string;
}

interface ProviderFormState {
  providerType: PSTNProviderType;
  twilioCredentials: Partial<TwilioCredentials>;
  plivoCredentials: Partial<PlivoCredentials>;
  telnyxCredentials: Partial<TelnyxCredentials>;
  sipConfig: Partial<SIPConfig>;
  fallbackToBuiltin: boolean;
}

const DEFAULT_SIP_CONFIG: Partial<SIPConfig> = {
  port: 5060,
  transport: 'udp',
};

export function PSTNProviderSettings({
  groupId,
  initialConfig,
  onSave,
  onCancel,
  workerUrl,
}: PSTNProviderSettingsProps) {
  const { t } = useTranslation('calling');

  // Form state
  const [formState, setFormState] = useState<ProviderFormState>({
    providerType: initialConfig?.providerType || 'builtin-credits',
    twilioCredentials: {},
    plivoCredentials: {},
    telnyxCredentials: {},
    sipConfig: { ...DEFAULT_SIP_CONFIG },
    fallbackToBuiltin: initialConfig?.fallbackToBuiltin ?? true,
  });

  // UI state
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);


  // Load initial config credentials if provided
  useEffect(() => {
    if (initialConfig?.credentials) {
      const creds = initialConfig.credentials;
      if (creds.type === 'twilio') {
        setFormState((prev) => ({
          ...prev,
          twilioCredentials: { ...creds.credentials },
        }));
      } else if (creds.type === 'plivo') {
        setFormState((prev) => ({
          ...prev,
          plivoCredentials: { ...creds.credentials },
        }));
      } else if (creds.type === 'telnyx') {
        setFormState((prev) => ({
          ...prev,
          telnyxCredentials: { ...creds.credentials },
        }));
      } else if (creds.type === 'asterisk' || creds.type === 'custom-sip') {
        setFormState((prev) => ({
          ...prev,
          sipConfig: { ...creds.config },
        }));
      }
    }
  }, [initialConfig]);

  // Build provider config from form state
  const buildConfig = useCallback((): PSTNProviderConfig => {
    const baseConfig: PSTNProviderConfig = {
      providerType: formState.providerType,
      groupId,
      builtinWorkerUrl: workerUrl,
      fallbackToBuiltin: formState.fallbackToBuiltin,
    };

    switch (formState.providerType) {
      case 'twilio':
        return {
          ...baseConfig,
          credentials: {
            type: 'twilio',
            credentials: formState.twilioCredentials as TwilioCredentials,
          },
        };

      case 'plivo':
        return {
          ...baseConfig,
          credentials: {
            type: 'plivo',
            credentials: formState.plivoCredentials as PlivoCredentials,
          },
        };

      case 'telnyx':
        return {
          ...baseConfig,
          credentials: {
            type: 'telnyx',
            credentials: formState.telnyxCredentials as TelnyxCredentials,
          },
        };

      case 'asterisk':
        return {
          ...baseConfig,
          credentials: {
            type: 'asterisk',
            config: formState.sipConfig as SIPConfig,
          },
        };

      case 'custom-sip':
        return {
          ...baseConfig,
          credentials: {
            type: 'custom-sip',
            config: formState.sipConfig as SIPConfig,
          },
        };

      default:
        return baseConfig;
    }
  }, [formState, groupId, workerUrl]);

  // Test connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const config = buildConfig();
      const validation = validateProviderConfig(config);

      if (!validation.valid) {
        setTestResult({
          success: false,
          error: validation.errors.join(', '),
        });
        return;
      }

      const provider = createPSTNProvider(config);
      const result = await provider.testConnection();
      setTestResult(result);
      await provider.destroy();
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save configuration
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const config = buildConfig();
      const validation = validateProviderConfig(config);

      if (!validation.valid) {
        setSaveError(validation.errors.join(', '));
        return;
      }

      await onSave(config);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Update form field
  const updateField = <K extends keyof ProviderFormState>(
    key: K,
    value: ProviderFormState[K]
  ) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
    setSaveError(null);
  };

  // Update nested credentials
  const updateCredentials = (
    type: 'twilio' | 'plivo' | 'telnyx' | 'sip',
    field: string,
    value: string | number
  ) => {
    if (type === 'twilio') {
      setFormState((prev) => ({
        ...prev,
        twilioCredentials: { ...prev.twilioCredentials, [field]: value },
      }));
    } else if (type === 'plivo') {
      setFormState((prev) => ({
        ...prev,
        plivoCredentials: { ...prev.plivoCredentials, [field]: value },
      }));
    } else if (type === 'telnyx') {
      setFormState((prev) => ({
        ...prev,
        telnyxCredentials: { ...prev.telnyxCredentials, [field]: value },
      }));
    } else if (type === 'sip') {
      setFormState((prev) => ({
        ...prev,
        sipConfig: { ...prev.sipConfig, [field]: value },
      }));
    }
    setTestResult(null);
    setSaveError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Phone className="h-5 w-5" />
          {t('pstnProviderSettings')}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {t('phoneProviderDescription')}
        </p>
      </div>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('phoneProvider')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={formState.providerType}
            onValueChange={(v) => updateField('providerType', v as PSTNProviderType)}
            className="space-y-4"
          >
            {/* Built-in Credits */}
            <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="builtin-credits" id="builtin" />
              <div className="flex-1">
                <Label htmlFor="builtin" className="font-medium cursor-pointer">
                  {t('builtinCreditsRecommended')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('builtinCreditsDesc')}
                </p>
              </div>
              <Badge variant="secondary">Recommended</Badge>
            </div>

            {/* Twilio */}
            <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="twilio" id="twilio" />
              <div className="flex-1">
                <Label htmlFor="twilio" className="font-medium cursor-pointer">
                  {t('twilio')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('twilioDesc')}
                </p>
              </div>
            </div>

            {/* Plivo */}
            <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="plivo" id="plivo" />
              <div className="flex-1">
                <Label htmlFor="plivo" className="font-medium cursor-pointer">
                  {t('plivo')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('plivoDesc')}
                </p>
              </div>
            </div>

            {/* Telnyx */}
            <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="telnyx" id="telnyx" />
              <div className="flex-1">
                <Label htmlFor="telnyx" className="font-medium cursor-pointer">
                  {t('telnyx')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('telnyxDesc')}
                </p>
              </div>
            </div>

            {/* Asterisk/FreePBX */}
            <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="asterisk" id="asterisk" />
              <div className="flex-1">
                <Label htmlFor="asterisk" className="font-medium cursor-pointer flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  {t('selfHosted')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('selfHostedDesc')}
                </p>
              </div>
            </div>

            {/* Custom SIP */}
            <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="custom-sip" id="custom-sip" />
              <div className="flex-1">
                <Label htmlFor="custom-sip" className="font-medium cursor-pointer">
                  {t('customSip')}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('customSipDesc')}
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Provider-specific configuration */}
      {formState.providerType === 'twilio' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Twilio Configuration</CardTitle>
            <CardDescription>
              <a
                href="https://console.twilio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Get credentials from Twilio Console
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="twilio-sid">{t('twilioAccountSid')}</Label>
              <Input
                id="twilio-sid"
                value={formState.twilioCredentials.accountSid || ''}
                onChange={(e) => updateCredentials('twilio', 'accountSid', e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-token">{t('twilioAuthToken')}</Label>
              <Input
                id="twilio-token"
                type="password"
                value={formState.twilioCredentials.authToken || ''}
                onChange={(e) => updateCredentials('twilio', 'authToken', e.target.value)}
                placeholder="Your Auth Token"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-phone">{t('twilioPhoneNumber')}</Label>
              <Input
                id="twilio-phone"
                value={formState.twilioCredentials.phoneNumber || ''}
                onChange={(e) => updateCredentials('twilio', 'phoneNumber', e.target.value)}
                placeholder="+1xxxxxxxxxx"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {formState.providerType === 'plivo' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plivo Configuration</CardTitle>
            <CardDescription>
              <a
                href="https://console.plivo.com/dashboard/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Get credentials from Plivo Console
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plivo-id">{t('plivoAuthId')}</Label>
              <Input
                id="plivo-id"
                value={formState.plivoCredentials.authId || ''}
                onChange={(e) => updateCredentials('plivo', 'authId', e.target.value)}
                placeholder="Your Auth ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plivo-token">{t('plivoAuthToken')}</Label>
              <Input
                id="plivo-token"
                type="password"
                value={formState.plivoCredentials.authToken || ''}
                onChange={(e) => updateCredentials('plivo', 'authToken', e.target.value)}
                placeholder="Your Auth Token"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plivo-phone">{t('plivoPhoneNumber')}</Label>
              <Input
                id="plivo-phone"
                value={formState.plivoCredentials.phoneNumber || ''}
                onChange={(e) => updateCredentials('plivo', 'phoneNumber', e.target.value)}
                placeholder="+1xxxxxxxxxx"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {formState.providerType === 'telnyx' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Telnyx Configuration</CardTitle>
            <CardDescription>
              <a
                href="https://portal.telnyx.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Get credentials from Telnyx Portal
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="telnyx-key">{t('telnyxApiKey')}</Label>
              <Input
                id="telnyx-key"
                type="password"
                value={formState.telnyxCredentials.apiKey || ''}
                onChange={(e) => updateCredentials('telnyx', 'apiKey', e.target.value)}
                placeholder="KEY..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telnyx-phone">{t('telnyxPhoneNumber')}</Label>
              <Input
                id="telnyx-phone"
                value={formState.telnyxCredentials.phoneNumber || ''}
                onChange={(e) => updateCredentials('telnyx', 'phoneNumber', e.target.value)}
                placeholder="+1xxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telnyx-conn">{t('telnyxConnectionId')}</Label>
              <Input
                id="telnyx-conn"
                value={formState.telnyxCredentials.connectionId || ''}
                onChange={(e) => updateCredentials('telnyx', 'connectionId', e.target.value)}
                placeholder="Connection ID (optional)"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {(formState.providerType === 'asterisk' || formState.providerType === 'custom-sip') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">SIP Configuration</CardTitle>
            <CardDescription>
              Configure connection to your SIP server
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sip-server">{t('sipServer')}</Label>
                <Input
                  id="sip-server"
                  value={formState.sipConfig.server || ''}
                  onChange={(e) => updateCredentials('sip', 'server', e.target.value)}
                  placeholder="sip.yourserver.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sip-port">{t('sipPort')}</Label>
                <Input
                  id="sip-port"
                  type="number"
                  value={formState.sipConfig.port || 5060}
                  onChange={(e) => updateCredentials('sip', 'port', parseInt(e.target.value))}
                  placeholder="5060"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sip-transport">{t('sipTransport')}</Label>
              <Select
                value={formState.sipConfig.transport || 'udp'}
                onValueChange={(v) => updateCredentials('sip', 'transport', v as SIPTransport)}
              >
                <SelectTrigger id="sip-transport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="udp">UDP</SelectItem>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="tls">TLS (Secure)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="sip-username">{t('sipUsername')}</Label>
              <Input
                id="sip-username"
                value={formState.sipConfig.username || ''}
                onChange={(e) => updateCredentials('sip', 'username', e.target.value)}
                placeholder="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sip-password">{t('sipPassword')}</Label>
              <Input
                id="sip-password"
                type="password"
                value={formState.sipConfig.password || ''}
                onChange={(e) => updateCredentials('sip', 'password', e.target.value)}
                placeholder="Password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sip-callerid">{t('callerId')}</Label>
              <Input
                id="sip-callerid"
                value={formState.sipConfig.callerId || ''}
                onChange={(e) => updateCredentials('sip', 'callerId', e.target.value)}
                placeholder="+1xxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">{t('callerIdDesc')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fallback option (for non-builtin providers) */}
      {formState.providerType !== 'builtin-credits' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Fallback Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="fallback">{t('fallbackToBuiltin')}</Label>
                <p className="text-sm text-muted-foreground">
                  Use built-in credits if your provider connection fails
                </p>
              </div>
              <Switch
                id="fallback"
                checked={formState.fallbackToBuiltin}
                onCheckedChange={(v) => updateField('fallbackToBuiltin', v)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credential Security Note */}
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertDescription>
          {t('credentialsNote')}
        </AlertDescription>
      </Alert>

      {/* Test Result */}
      {testResult && (
        <Alert variant={testResult.success ? 'default' : 'destructive'}>
          {testResult.success ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {testResult.success ? (
              <span className="text-green-600">
                {t('connectionSuccess')}
                {testResult.latencyMs && ` (${testResult.latencyMs}ms)`}
              </span>
            ) : (
              <span>{testResult.error || t('connectionFailed')}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Save Error */}
      {saveError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            {t('cancel')}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={isTesting || isSaving}
        >
          {isTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t('testConnection')}
        </Button>
        <Button onClick={handleSave} disabled={isSaving || isTesting}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isSaving ? t('saving') : t('saveSettings')}
        </Button>
      </div>
    </div>
  );
}
