/**
 * Anomaly Detection Component
 * Detects suspicious behavior patterns to identify potential infiltrators
 * Critical for high-security campaigns
 */

import { FC, useState } from 'react';
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

export const AnomalyDetection: FC<AnomalyDetectionProps> = ({
  isAdmin = false,
  className
}) => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([
    {
      id: 'anomaly-1',
      type: 'mass-access',
      severity: 'critical',
      userId: 'user-suspicious-1',
      userName: 'New Account 47',
      userInitials: 'NA',
      description: 'Accessed 127 member profiles in 15 minutes',
      details: 'Rapid profile viewing pattern typical of data harvesting. User joined 2 days ago.',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
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
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
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
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
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
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
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
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
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
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      status: 'false-positive',
      affectedResources: 30
    }
  ]);

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
      case 'mass-access': return 'Mass Data Access';
      case 'unusual-posting': return 'Unusual Posting';
      case 'rapid-following': return 'Rapid Following';
      case 'honeypot-trigger': return 'Honeypot Triggered';
      case 'data-export': return 'Data Export';
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
          <p>Admin access required to view security anomalies</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Anomaly Detection</h2>
        <p className="text-muted-foreground">
          Monitor suspicious behavior patterns to identify potential infiltrators
        </p>
      </div>

      {/* Alert Summary */}
      {criticalCount > 0 && (
        <Card className="p-4 bg-red-500/5 border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                {criticalCount} Critical {criticalCount === 1 ? 'Anomaly' : 'Anomalies'} Detected
              </h4>
              <p className="text-xs text-muted-foreground">
                Immediate investigation required. These patterns indicate potential infiltration or data harvesting.
              </p>
            </div>
            <Button size="sm" variant="destructive">
              Review Now
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
          <div className="text-xs text-muted-foreground">Active Anomalies</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <div className="text-2xl font-bold text-red-500">{criticalCount}</div>
          </div>
          <div className="text-xs text-muted-foreground">Critical</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div className="text-2xl font-bold">
              {anomalies.filter(a => a.status === 'investigating').length}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Investigating</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <div className="text-2xl font-bold">
              {anomalies.filter(a => a.status === 'resolved').length}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Resolved</div>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="p-4 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium mb-1">Detection Systems Active</h4>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• <strong>Mass Data Access:</strong> Detects rapid viewing of member profiles or documents</li>
              <li>• <strong>Unusual Posting:</strong> Identifies spam-like or divisive posting patterns</li>
              <li>• <strong>Rapid Following:</strong> Flags users building social graphs too quickly</li>
              <li>• <strong>Honeypot Triggers:</strong> Hidden sensitive documents that only infiltrators access</li>
              <li>• <strong>Data Export:</strong> Monitors bulk data downloads and exports</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Anomalies List */}
      <div>
        <h3 className="font-semibold mb-3">Recent Anomalies</h3>
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
                        {anomaly.status.replace('-', ' ')}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <Badge variant="outline" className="gap-1">
                        {getAnomalyTypeLabel(anomaly.type)}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${getSeverityColor(anomaly.severity)}`} />
                        <span className="capitalize">{anomaly.severity}</span>
                      </div>
                      {anomaly.affectedResources && (
                        <>
                          <div>•</div>
                          <div>{anomaly.affectedResources} resources affected</div>
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
                      <Badge variant="outline" className="text-xs">User ID: {anomaly.userId}</Badge>
                    </div>

                    {/* Actions */}
                    {anomaly.status === 'active' && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(anomaly.id, 'investigating')}
                        >
                          Start Investigation
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(anomaly.id, 'false-positive')}
                        >
                          Mark False Positive
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                        >
                          Suspend User
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
                          Mark Resolved
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(anomaly.id, 'false-positive')}
                          className="gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          False Positive
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
            <h4 className="text-sm font-medium mb-1">Honeypot Traps Active</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Honeypots are hidden documents or features that only infiltrators or bad actors would access.
              They appear as "sensitive" information to attract suspicious users.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• <strong>Fake Sensitive Documents:</strong> 3 active honeypots deployed</li>
              <li>• <strong>Hidden Contact Lists:</strong> Detect unauthorized data harvesting</li>
              <li>• <strong>Trap Questions:</strong> Survey questions that identify bad actors</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};
