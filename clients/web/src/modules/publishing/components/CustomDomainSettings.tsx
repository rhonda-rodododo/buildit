/**
 * CustomDomainSettings Component
 * Settings panel for custom domain configuration within publication settings
 */

import { FC, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

type DnsVerificationStatus = 'unverified' | 'pending' | 'verified' | 'failed';
type SslStatus = 'pending' | 'active' | 'error';

interface CustomDomainSettingsProps {
  publicationId: string;
  currentDomain?: string;
  onDomainChange: (domain: string | undefined) => void;
  className?: string;
}

export const CustomDomainSettings: FC<CustomDomainSettingsProps> = ({
  publicationId,
  currentDomain,
  onDomainChange,
  className,
}) => {
  const { t } = useTranslation();

  const [domain, setDomain] = useState(currentDomain || '');
  const [dnsStatus, setDnsStatus] = useState<DnsVerificationStatus>(
    currentDomain ? 'verified' : 'unverified'
  );
  const [sslStatus, setSslStatus] = useState<SslStatus>(
    currentDomain ? 'active' : 'pending'
  );
  const [isVerifying, setIsVerifying] = useState(false);

  // Generate the TXT verification value
  const verificationTxtValue = `buildit-verify=${publicationId}`;
  const cnameTarget = 'publish.buildit.network';

  // Validate domain format
  const isValidDomain = useCallback((d: string): boolean => {
    if (!d) return false;
    // Supports apex domains and subdomains
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(d);
  }, []);

  // Copy text to clipboard
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t('customDomain.copiedToClipboard', { label }));
    }).catch(() => {
      toast.error(t('customDomain.copyFailed'));
    });
  }, [t]);

  // Verify DNS records
  const handleVerifyDns = useCallback(async () => {
    if (!isValidDomain(domain)) {
      toast.error(t('customDomain.invalidDomain'));
      return;
    }

    setIsVerifying(true);
    setDnsStatus('pending');

    try {
      // In production, this would call the BuildIt API to verify DNS records
      // The API would check both the CNAME and TXT records via DNS lookup
      const response = await fetch(`/api/domains/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          publicationId,
          expectedTxt: verificationTxtValue,
          expectedCname: cnameTarget,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.verified) {
          setDnsStatus('verified');
          setSslStatus('active'); // Cloudflare handles SSL automatically
          onDomainChange(domain);
          toast.success(t('customDomain.verified'));
        } else {
          setDnsStatus('failed');
          toast.error(t('customDomain.verificationFailed', {
            reason: result.reason || 'DNS records not found',
          }));
        }
      } else {
        // For now, simulate verification for development
        // In a real deployment the API handles this
        setDnsStatus('failed');
        toast.error(t('customDomain.verificationApiUnavailable'));
      }
    } catch {
      // Fallback: simulate pending state for dev
      setDnsStatus('failed');
      toast.error(t('customDomain.verificationApiUnavailable'));
    } finally {
      setIsVerifying(false);
    }
  }, [domain, publicationId, verificationTxtValue, cnameTarget, isValidDomain, onDomainChange, t]);

  // Remove custom domain
  const handleRemoveDomain = useCallback(() => {
    setDomain('');
    setDnsStatus('unverified');
    setSslStatus('pending');
    onDomainChange(undefined);
    toast.success(t('customDomain.removed'));
  }, [onDomainChange, t]);

  const getStatusBadge = (status: DnsVerificationStatus) => {
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-green-500/20 text-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {t('customDomain.status.verified')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-600">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {t('customDomain.status.pending')}
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-500/20 text-red-600">
            <XCircle className="h-3 w-3 mr-1" />
            {t('customDomain.status.failed')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {t('customDomain.status.unverified')}
          </Badge>
        );
    }
  };

  const getSslBadge = (status: SslStatus) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-500/20 text-green-600">
            <Shield className="h-3 w-3 mr-1" />
            {t('customDomain.ssl.active')}
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-500/20 text-red-600">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {t('customDomain.ssl.error')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1" />
            {t('customDomain.ssl.pending')}
          </Badge>
        );
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          <CardTitle>{t('customDomain.title')}</CardTitle>
        </div>
        <CardDescription>
          {t('customDomain.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Domain Input */}
        <div className="space-y-2">
          <Label htmlFor="customDomain">{t('customDomain.domainLabel')}</Label>
          <div className="flex gap-2">
            <Input
              id="customDomain"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value.toLowerCase().trim());
                if (dnsStatus !== 'unverified') {
                  setDnsStatus('unverified');
                }
              }}
              placeholder="blog.yourorg.com"
              className="flex-1"
            />
            {domain && dnsStatus === 'verified' && (
              <Button variant="destructive" size="sm" onClick={handleRemoveDomain}>
                {t('customDomain.remove')}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('customDomain.domainHint')}
          </p>
        </div>

        {/* DNS Status */}
        {domain && isValidDomain(domain) && (
          <>
            <Separator />

            {/* Status Indicators */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t('customDomain.dnsStatus')}:</span>
                {getStatusBadge(dnsStatus)}
              </div>
              {dnsStatus === 'verified' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t('customDomain.sslStatus')}:</span>
                  {getSslBadge(sslStatus)}
                </div>
              )}
            </div>

            <Separator />

            {/* DNS Instructions */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">{t('customDomain.dnsInstructions')}</h4>

              {/* Step 1: CNAME Record */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('customDomain.step1Title')}</span>
                  <Badge variant="outline">CNAME</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('customDomain.step1Description', { domain })}
                </p>
                <div className="flex items-center gap-2 bg-muted rounded-md p-2">
                  <code className="text-sm flex-1 font-mono">
                    {domain} CNAME {cnameTarget}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(cnameTarget, 'CNAME target')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Step 2: TXT Record */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('customDomain.step2Title')}</span>
                  <Badge variant="outline">TXT</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('customDomain.step2Description')}
                </p>
                <div className="flex items-center gap-2 bg-muted rounded-md p-2">
                  <code className="text-sm flex-1 font-mono break-all">
                    {verificationTxtValue}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(verificationTxtValue, 'TXT value')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Step 3: SSL Note */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{t('customDomain.step3Title')}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('customDomain.step3Description')}
                </p>
              </div>
            </div>

            {/* Verify Button */}
            <Button
              onClick={handleVerifyDns}
              disabled={isVerifying || !isValidDomain(domain)}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('customDomain.verifying')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t('customDomain.verifyDns')}
                </>
              )}
            </Button>
          </>
        )}

        {/* Invalid domain warning */}
        {domain && !isValidDomain(domain) && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t('customDomain.invalidDomainFormat')}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
