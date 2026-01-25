/**
 * Anomaly Detection Component
 * Detects suspicious behavior patterns to identify potential infiltrators
 * Critical for high-security campaigns
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertTriangle,
  ShieldAlert,
  Eye,
  Users,
  FileText,
  Download,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface Anomaly {
  id: string;
  type: 'mass-access' | 'unusual-posting' | 'rapid-following' | 'honeypot-trigger' | 'data-export';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  userName: string;
  userInitials: string;
  description: string;
  details: string;
  timestamp: string;
  status: 'active' | 'investigating' | 'resolved' | 'false-positive';
  affectedResources?: number;
}

interface AnomalyDetectionProps {
  isAdmin?: boolean;
  className?: string;
}

// Create mock data outside component to avoid Date.now() during render
const createMockAnomalies = (): Anomaly[] => {
  const now = Date.now();
  return [
    {
      id: 'anomaly-1',
      type: 'mass-access',
      severity: 'critical',
      userId: 'user-suspicious-1',
      userName: 'New Account 47',
      userInitials: 'NA',
      description: 'Accessed 127 member profiles in 15 minutes',
      details: 'Rapid profile viewing pattern typical of data harvesting. User joined 2 days ago.',
      timestamp: new Date(now - 1000 * 60 * 30).toISOString(),
      status: 'active',
      affectedResources: 127
    },
    {
      id: 'anomaly-2',
      type: 'data-export',
      severity: 'high',
      userId: 'user-suspicious-2',
      userName: 'Reporter Mike',
      userInitials: 'RM',
      description: 'Exported contact list and event data',
      details: 'Bulk data export detected. User has low trust score (25) and no verification.',
      timestamp: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
      status: 'investigating',
      affectedResources: 342
    },
    {
      id: 'anomaly-3',
      type: 'rapid-following',
      severity: 'medium',
      userId: 'user-suspicious-3',
      userName: 'Jordan Smith',
      userInitials: 'JS',
      description: 'Followed 45 members in 10 minutes',
      details: 'Rapid social graphing behavior. Account created 1 day ago with minimal activity.',
      timestamp: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
      status: 'active',
      affectedResources: 45
    },
    {
      id: 'anomaly-4',
      type: 'honeypot-trigger',
      severity: 'critical',
      userId: 'user-suspicious-4',
      userName: 'Alex Thompson',
      userInitials: 'AT',
      description: 'Accessed honeypot document',
      details: 'Viewed hidden "sensitive plans" document that only infiltrators would access.',
      timestamp: new Date(now - 1000 * 60 * 60 * 8).toISOString(),
      status: 'active',
      affectedResources: 1
    },
    {
      id: 'anomaly-5',
      type: 'unusual-posting',
      severity: 'medium',
      userId: 'user-suspicious-5',
      userName: 'Taylor Davis',
      userInitials: 'TD',
      description: 'Posted 23 messages in various groups in 20 minutes',
      details: 'Spam-like posting behavior across multiple channels. Messages contain divisive content.',
      timestamp: new Date(now - 1000 * 60 * 60 * 12).toISOString(),
      status: 'investigating',
      affectedResources: 23
    },
    {
      id: 'anomaly-6',
      type: 'mass-access',
      severity: 'low',
      userId: 'user-normal-1',
      userName: 'Keisha Johnson',
      userInitials: 'KJ',
      description: 'Viewed 30 profiles during member directory review',
      details: 'Normal organizer behavior. User is verified admin reviewing new members.',
      timestamp: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
      status: 'false-positive',
      affectedResources: 30
    }
  ];
};

export const AnomalyDetection: FC<AnomalyDetectionProps> = ({
  isAdmin = false,
  className
}) => {
  const { t } = useTranslation();
  // useMemo ensures mock data is only created once per component instance
  const initialAnomalies = useMemo(() => createMockAnomalies(), []);
  const [anomalies, setAnomalies] = useState<Anomaly[]>(initialAnomalies);

  const handleUpdateStatus = (anomalyId: string, newStatus: Anomaly['status']) => {
    setAnomalies(prev => prev.map(a =>
      a.id === anomalyId ? { ...a, status: newStatus } : a
    ));
  };

  const getAnomalyTypeIcon = (type: Anomaly['type']) => {
    switch (type) {
      case 'mass-access': return <Eye className="w-5 h-5" />;
      case 'unusual-posting': return <FileText className="w-5 h-5" />;
      case 'rapid-following': return <Users className="w-5 h-5" />;
      case 'honeypot-trigger': return <ShieldAlert className="w-5 h-5" />;
      case 'data-export': return <Download className="w-5 h-5" />;
    }
  };

  const getAnomalyTypeLabel = (type: Anomaly['type']) => {
    switch (type) {
      case 'mass-access': return t('anomaly.types.massAccess');
      case 'unusual-posting': return t('anomaly.types.unusualPosting');
      case 'rapid-following': return t('anomaly.types.rapidFollowing');
      case 'honeypot-trigger': return t('anomaly.types.honeypotTrigger');
      case 'data-export': return t('anomaly.types.dataExport');
    }
  };

  const getSeverityColor = (severity: Anomaly['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
    }
  };

  const getSeverityBgColor = (severity: Anomaly['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/5 border-red-500/20';
      case 'high': return 'bg-orange-500/5 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/5 border-yellow-500/20';
      case 'low': return 'bg-blue-500/5 border-blue-500/20';
    }
  };

  const getStatusColor = (status: Anomaly['status']) => {
    switch (status) {
      case 'active': return 'destructive';
      case 'investigating': return 'default';
      case 'resolved': return 'outline';
      case 'false-positive': return 'secondary';
    }
  };

  const activeAnomalies = anomalies.filter(a => a.status === 'active');
  const criticalCount = anomalies.filter(a => a.severity === 'critical' && a.status === 'active').length;

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <ShieldAlert className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('anomaly.adminRequired')}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">{t('anomaly.title')}</h2>
        <p className="text-muted-foreground">
          {t('anomaly.description')}
        </p>
      </div>

      {/* Alert Summary */}
      {criticalCount > 0 && (
        <Card className="p-4 bg-red-500/5 border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                {t('anomaly.criticalDetected', { count: criticalCount })}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t('anomaly.immediateAction')}
              </p>
            </div>
            <Button size="sm" variant="destructive">
              {t('anomaly.reviewNow')}
            </Button>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <div className="text-2xl font-bold">{activeAnomalies.length}</div>
          </div>
          <div className="text-xs text-muted-foreground">{t('anomaly.activeAnomalies')}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <div className="text-2xl font-bold text-red-500">{criticalCount}</div>
          </div>
          <div className="text-xs text-muted-foreground">{t('anomaly.critical')}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div className="text-2xl font-bold">
              {anomalies.filter(a => a.status === 'investigating').length}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{t('anomaly.investigating')}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <div className="text-2xl font-bold">
              {anomalies.filter(a => a.status === 'resolved').length}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{t('anomaly.resolved')}</div>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="p-4 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium mb-1">{t('anomaly.detectionSystemsActive')}</h4>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• <strong>{t('anomaly.types.massAccess')}:</strong> {t('anomaly.typeDesc.massAccess')}</li>
              <li>• <strong>{t('anomaly.types.unusualPosting')}:</strong> {t('anomaly.typeDesc.unusualPosting')}</li>
              <li>• <strong>{t('anomaly.types.rapidFollowing')}:</strong> {t('anomaly.typeDesc.rapidFollowing')}</li>
              <li>• <strong>{t('anomaly.types.honeypotTrigger')}:</strong> {t('anomaly.typeDesc.honeypotTrigger')}</li>
              <li>• <strong>{t('anomaly.types.dataExport')}:</strong> {t('anomaly.typeDesc.dataExport')}</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Anomalies List */}
      <div>
        <h3 className="font-semibold mb-3">{t('anomaly.recentAnomalies')}</h3>
        <div className="space-y-3">
          {anomalies.map((anomaly) => (
            <Card
              key={anomaly.id}
              className={getSeverityBgColor(anomaly.severity)}
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${getSeverityBgColor(anomaly.severity)}`}>
                    {getAnomalyTypeIcon(anomaly.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{anomaly.description}</h4>
                      <Badge
                        variant={getStatusColor(anomaly.status)}
                        className="shrink-0"
                      >
                        {t(`anomaly.status.${anomaly.status === 'false-positive' ? 'falsePositive' : anomaly.status}`)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <Badge variant="outline" className="gap-1">
                        {getAnomalyTypeLabel(anomaly.type)}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${getSeverityColor(anomaly.severity)}`} />
                        <span className="capitalize">{t(`anomaly.severity.${anomaly.severity}`)}</span>
                      </div>
                      {anomaly.affectedResources && (
                        <>
                          <div>•</div>
                          <div>{t('anomaly.resourcesAffected', { count: anomaly.affectedResources })}</div>
                        </>
                      )}
                      <div>•</div>
                      <div>{formatDistanceToNow(new Date(anomaly.timestamp), { addSuffix: true })}</div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {anomaly.details}
                    </p>

                    {/* User Info */}
                    <div className="flex items-center gap-2 mb-3">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">{anomaly.userInitials}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{anomaly.userName}</span>
                      <Badge variant="outline" className="text-xs">{t('anomaly.userId')} {anomaly.userId}</Badge>
                    </div>

                    {/* Actions */}
                    {anomaly.status === 'active' && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(anomaly.id, 'investigating')}
                        >
                          {t('anomaly.startInvestigation')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(anomaly.id, 'false-positive')}
                        >
                          {t('anomaly.markFalsePositive')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                        >
                          {t('anomaly.suspendUser')}
                        </Button>
                      </div>
                    )}

                    {anomaly.status === 'investigating' && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(anomaly.id, 'resolved')}
                          className="gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          {t('anomaly.markResolved')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(anomaly.id, 'false-positive')}
                          className="gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          {t('anomaly.falsePositive')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Honeypot Info */}
      <Card className="p-4 bg-purple-500/5 border-purple-500/20">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium mb-1">{t('anomaly.honeypotTrapsActive')}</h4>
            <p className="text-xs text-muted-foreground mb-2">
              {t('anomaly.honeypotDesc')}
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• <strong>{t('anomaly.honeypotFakeDocs')}</strong> {t('anomaly.honeypotFakeDocsDesc')}</li>
              <li>• <strong>{t('anomaly.honeypotHiddenContacts')}</strong> {t('anomaly.honeypotHiddenContactsDesc')}</li>
              <li>• <strong>{t('anomaly.honeypotTrapQuestions')}</strong> {t('anomaly.honeypotTrapQuestionsDesc')}</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};
