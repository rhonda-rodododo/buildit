/**
 * Security Demo Page
 * Demonstrates infiltration countermeasures
 * Epic 27: Member Verification, Anomaly Detection, Audit Logs
 */

import { FC } from 'react';
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
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageMeta title="Security Demo" descriptionKey="meta.security" />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Infiltration Countermeasures</h1>
        <p className="text-muted-foreground">
          Protect high-risk campaigns from infiltration and data harvesting
        </p>
      </div>

      {/* Overview Card */}
      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3 mb-4">
          <Shield className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold mb-2">Why Infiltration Countermeasures Matter</h3>
            <p className="text-sm text-muted-foreground mb-3">
              High-risk organizing campaigns face constant threats from infiltrators, bad actors, and surveillance.
              These security features help identify and prevent malicious activity while maintaining trust within
              the community.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium mb-1">Member Verification</h4>
              <p className="text-xs text-muted-foreground">
                In-person QR verification and trust scores prevent fake accounts and infiltrators
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium mb-1">Anomaly Detection</h4>
              <p className="text-xs text-muted-foreground">
                Automated detection of suspicious behavior patterns like mass data access
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <FileText className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium mb-1">Audit Logs</h4>
              <p className="text-xs text-muted-foreground">
                Complete tracking of sensitive actions for investigation and accountability
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
            Member Verification
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-2">
            <ShieldAlert className="w-4 h-4" />
            Anomaly Detection
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <FileText className="w-4 h-4" />
            Audit Logs
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
            <h4 className="text-sm font-medium mb-1">Real-World Use Cases</h4>
            <p className="text-xs text-muted-foreground mb-2">
              These security features are essential for:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• <strong>Union Organizing:</strong> Prevent employer infiltration during organizing drives</li>
              <li>• <strong>Direct Action Campaigns:</strong> Identify undercover law enforcement or informants</li>
              <li>• <strong>Tenant Unions:</strong> Detect landlord-sponsored bad actors attempting to disrupt organizing</li>
              <li>• <strong>Whistleblower Networks:</strong> Protect sources from corporate or government surveillance</li>
              <li>• <strong>Activist Coalitions:</strong> Prevent agent provocateurs from disrupting movement work</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Key Insight:</strong> Infiltration is not paranoia - it's a documented tactic used against organizing
              efforts throughout history. These tools provide systematic defense without creating a culture of suspicion.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
