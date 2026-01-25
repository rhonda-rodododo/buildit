/**
 * Security Demo Page
 * Demonstrates infiltration countermeasures
 * Epic 27: Member Verification, Anomaly Detection, Audit Logs
 */

import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
import { MemberVerification } from '@/components/security/MemberVerification';
import { AnomalyDetection } from '@/components/security/AnomalyDetection';
import { AuditLogs } from '@/components/security/AuditLogs';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileText
} from 'lucide-react';

export const SecurityDemoPage: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageMeta title="Security Demo" descriptionKey="meta.security" />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">{t('securityDemo.title')}</h1>
        <p className="text-muted-foreground">
          {t('securityDemo.description')}
        </p>
      </div>

      {/* Overview Card */}
      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3 mb-4">
          <Shield className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold mb-2">{t('securityDemo.whyMatters')}</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {t('securityDemo.whyMattersDesc')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium mb-1">{t('securityDemo.memberVerification')}</h4>
              <p className="text-xs text-muted-foreground">
                {t('securityDemo.memberVerificationDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium mb-1">{t('securityDemo.anomalyDetection')}</h4>
              <p className="text-xs text-muted-foreground">
                {t('securityDemo.anomalyDetectionDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <FileText className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium mb-1">{t('securityDemo.auditLogs')}</h4>
              <p className="text-xs text-muted-foreground">
                {t('securityDemo.auditLogsDesc')}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="verification" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="verification" className="gap-2">
            <ShieldCheck className="w-4 h-4" />
            {t('securityDemo.tabs.verification')}
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-2">
            <ShieldAlert className="w-4 h-4" />
            {t('securityDemo.tabs.anomalies')}
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <FileText className="w-4 h-4" />
            {t('securityDemo.tabs.audit')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="verification" className="mt-6">
          <MemberVerification currentUserId="current-user" isAdmin={true} />
        </TabsContent>

        <TabsContent value="anomalies" className="mt-6">
          <AnomalyDetection isAdmin={true} />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogs isAdmin={true} />
        </TabsContent>
      </Tabs>

      {/* Use Cases */}
      <Card className="p-4 bg-purple-500/5 border-purple-500/20">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium mb-1">{t('securityDemo.useCases.title')}</h4>
            <p className="text-xs text-muted-foreground mb-2">
              {t('securityDemo.useCases.intro')}
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• <strong>{t('securityDemo.useCases.unionOrganizing')}</strong> {t('securityDemo.useCases.unionOrganizingDesc')}</li>
              <li>• <strong>{t('securityDemo.useCases.directAction')}</strong> {t('securityDemo.useCases.directActionDesc')}</li>
              <li>• <strong>{t('securityDemo.useCases.tenantUnions')}</strong> {t('securityDemo.useCases.tenantUnionsDesc')}</li>
              <li>• <strong>{t('securityDemo.useCases.whistleblower')}</strong> {t('securityDemo.useCases.whistleblowerDesc')}</li>
              <li>• <strong>{t('securityDemo.useCases.activist')}</strong> {t('securityDemo.useCases.activistDesc')}</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>{t('securityDemo.useCases.keyInsight')}</strong> {t('securityDemo.useCases.keyInsightDesc')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
