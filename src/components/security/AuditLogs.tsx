/**
 * Audit Logs Component
 * Track all sensitive actions for security investigation
 * Admin-only view with filtering and export
 */

import { FC, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  FileText,
  Download,
  Search,
  Filter,
  Shield,
  UserPlus,
  Lock,
  Eye,
  Edit,
  Trash,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface AuditLog {
  id: string;
  action: string;
  actionType: 'create' | 'read' | 'update' | 'delete' | 'permission' | 'security' | 'export';
  userId: string;
  userName: string;
  userInitials: string;
  targetResource: string;
  targetResourceType: 'member' | 'group' | 'document' | 'event' | 'proposal' | 'setting';
  details: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  success: boolean;
}

interface AuditLogsProps {
  isAdmin?: boolean;
  className?: string;
}

export const AuditLogs: FC<AuditLogsProps> = ({
  isAdmin = false,
  className
}) => {
  const [logs, _setLogs] = useState<AuditLog[]>([
    {
      id: 'log-1',
      action: 'Suspended member account',
      actionType: 'permission',
      userId: 'admin-1',
      userName: 'Keisha Johnson',
      userInitials: 'KJ',
      targetResource: 'New Account 47',
      targetResourceType: 'member',
      details: 'Suspended due to mass data access anomaly',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      severity: 'high',
      success: true
    },
    {
      id: 'log-2',
      action: 'Exported contact list',
      actionType: 'export',
      userId: 'user-suspicious-2',
      userName: 'Reporter Mike',
      userInitials: 'RM',
      targetResource: 'Climate Justice Coalition',
      targetResourceType: 'group',
      details: 'Downloaded CSV with 342 contacts',
      ipAddress: '203.0.113.45',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      severity: 'critical',
      success: true
    },
    {
      id: 'log-3',
      action: 'Accessed member profiles',
      actionType: 'read',
      userId: 'user-suspicious-1',
      userName: 'New Account 47',
      userInitials: 'NA',
      targetResource: '127 member profiles',
      targetResourceType: 'member',
      details: 'Rapid sequential access pattern detected',
      ipAddress: '198.51.100.23',
      userAgent: 'Mozilla/5.0 (Linux; Android 10)',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      severity: 'critical',
      success: true
    },
    {
      id: 'log-4',
      action: 'Updated group permissions',
      actionType: 'permission',
      userId: 'admin-1',
      userName: 'Keisha Johnson',
      userInitials: 'KJ',
      targetResource: 'Direct Action Working Group',
      targetResourceType: 'group',
      details: 'Restricted access to verified members only',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      severity: 'medium',
      success: true
    },
    {
      id: 'log-5',
      action: 'Deleted sensitive document',
      actionType: 'delete',
      userId: 'organizer-2',
      userName: 'Marcus Chen',
      userInitials: 'MC',
      targetResource: 'Action Plan - Confidential',
      targetResourceType: 'document',
      details: 'Removed outdated tactical document',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      severity: 'high',
      success: true
    },
    {
      id: 'log-6',
      action: 'Attempted admin access',
      actionType: 'security',
      userId: 'user-suspicious-3',
      userName: 'Jordan Smith',
      userInitials: 'JS',
      targetResource: 'Admin Panel',
      targetResourceType: 'setting',
      details: 'Unauthorized access attempt blocked',
      ipAddress: '203.0.113.89',
      userAgent: 'curl/7.68.0',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      severity: 'critical',
      success: false
    },
    {
      id: 'log-7',
      action: 'Verified member in-person',
      actionType: 'security',
      userId: 'admin-1',
      userName: 'Keisha Johnson',
      userInitials: 'KJ',
      targetResource: 'Aisha Williams',
      targetResourceType: 'member',
      details: 'QR code verification completed',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      severity: 'low',
      success: true
    },
    {
      id: 'log-8',
      action: 'Created encryption keys',
      actionType: 'create',
      userId: 'member-5',
      userName: 'Taylor Davis',
      userInitials: 'TD',
      targetResource: 'User keypair',
      targetResourceType: 'setting',
      details: 'Generated new Nostr keypair for secure messaging',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      severity: 'low',
      success: true
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<AuditLog['actionType'] | 'all'>('all');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchQuery === '' ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.targetResource.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterType === 'all' || log.actionType === filterType;

    return matchesSearch && matchesFilter;
  });

  const handleExportLogs = () => {
    // In production, this would generate a CSV file
    console.log('Exporting audit logs...');
  };

  const getActionIcon = (actionType: AuditLog['actionType']) => {
    switch (actionType) {
      case 'create': return <UserPlus className="w-4 h-4" />;
      case 'read': return <Eye className="w-4 h-4" />;
      case 'update': return <Edit className="w-4 h-4" />;
      case 'delete': return <Trash className="w-4 h-4" />;
      case 'permission': return <Lock className="w-4 h-4" />;
      case 'security': return <Shield className="w-4 h-4" />;
      case 'export': return <Download className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: AuditLog['severity']) => {
    switch (severity) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
    }
  };

  const getSeverityBgColor = (severity: AuditLog['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/5 border-red-500/20';
      case 'high': return 'bg-orange-500/5 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/5 border-yellow-500/20';
      case 'low': return 'bg-blue-500/5 border-blue-500/20';
    }
  };

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Admin access required to view audit logs</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Audit Logs</h2>
          <p className="text-muted-foreground">
            Track all sensitive actions for security investigation
          </p>
        </div>
        <Button onClick={handleExportLogs} className="gap-2">
          <Download className="w-4 h-4" />
          Export Logs
        </Button>
      </div>

      {/* Info Card */}
      <Card className="p-4 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium mb-1">What Gets Logged</h4>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4">
              <li>• <strong>Security Actions:</strong> Verifications, suspensions, permission changes</li>
              <li>• <strong>Data Access:</strong> Profile views, document access, exports</li>
              <li>• <strong>Content Changes:</strong> Creates, updates, deletes of sensitive content</li>
              <li>• <strong>Failed Attempts:</strong> Unauthorized access, failed logins</li>
              <li>• <strong>Metadata:</strong> IP address, user agent, timestamp for investigation</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search logs by user, action, or resource..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter by action type */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as AuditLog['actionType'] | 'all')}
            className="px-3 py-2 border rounded-md text-sm bg-background"
          >
            <option value="all">All Types</option>
            <option value="create">Create</option>
            <option value="read">Read</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="permission">Permission</option>
            <option value="security">Security</option>
            <option value="export">Export</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Total Logs</div>
          <div className="text-2xl font-bold">{logs.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Critical</div>
          <div className="text-2xl font-bold text-red-500">
            {logs.filter(l => l.severity === 'critical').length}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Failed Actions</div>
          <div className="text-2xl font-bold text-orange-500">
            {logs.filter(l => !l.success).length}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Last 24h</div>
          <div className="text-2xl font-bold">
            {logs.filter(l => new Date(l.timestamp) > new Date(Date.now() - 1000 * 60 * 60 * 24)).length}
          </div>
        </Card>
      </div>

      {/* Logs List */}
      <div>
        <h3 className="font-semibold mb-3">
          Recent Activity ({filteredLogs.length} {filteredLogs.length === 1 ? 'log' : 'logs'})
        </h3>
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <Card
              key={log.id}
              className={`p-4 ${getSeverityBgColor(log.severity)}`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`p-2 rounded-lg ${getSeverityBgColor(log.severity)}`}>
                  {getActionIcon(log.actionType)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{log.action}</h4>
                    {log.success ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="text-xs">{log.userInitials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{log.userName}</span>
                    </div>
                    <div>•</div>
                    <Badge variant="outline" className="capitalize">
                      {log.actionType}
                    </Badge>
                    <div>•</div>
                    <Badge variant="outline" className="capitalize">
                      {log.targetResourceType}
                    </Badge>
                    <div>•</div>
                    <span className={getSeverityColor(log.severity)}>
                      {log.severity}
                    </span>
                    <div>•</div>
                    <div>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">
                    Target: <strong>{log.targetResource}</strong> - {log.details}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div>IP: {log.ipAddress}</div>
                    <div>•</div>
                    <div className="truncate max-w-xs" title={log.userAgent}>
                      {log.userAgent.split(' ')[0]}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {filteredLogs.length === 0 && (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No audit logs match your search criteria</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
