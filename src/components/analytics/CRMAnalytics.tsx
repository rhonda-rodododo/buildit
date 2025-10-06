/**
 * CRM Analytics Component
 * Provides analytics for contact management and organizing metrics
 */

import { FC, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  TrendingUp,
  Activity,
  Target,
  Download,
  Calendar
} from 'lucide-react';

interface CRMAnalyticsProps {
  className?: string;
}

// Demo data - in real app, this would come from CRM database queries
const DEMO_DATA = {
  supportLevelDistribution: [
    { level: 'Neutral', count: 45, percentage: 15, color: 'bg-gray-500' },
    { level: 'Passive Support', count: 120, percentage: 40, color: 'bg-blue-500' },
    { level: 'Active Support', count: 90, percentage: 30, color: 'bg-green-500' },
    { level: 'Core Organizer', count: 45, percentage: 15, color: 'bg-purple-500' }
  ],
  contactRate: {
    thisWeek: 47,
    lastWeek: 38,
    trend: '+23.7%'
  },
  pipelineMovement: {
    neutralToPassive: 12,
    passiveToActive: 8,
    activeToCore: 3,
    avgDaysToMove: 21
  },
  organizerPerformance: [
    { name: 'Sarah Chen', contacts: 45, conversions: 12, rate: '26.7%' },
    { name: 'Marcus Johnson', contacts: 38, conversions: 9, rate: '23.7%' },
    { name: 'Emma Rodriguez', contacts: 52, conversions: 15, rate: '28.8%' },
    { name: 'Jordan Kim', contacts: 31, conversions: 7, rate: '22.6%' }
  ],
  departmentAnalysis: [
    { department: 'Outreach', members: 45, active: 38, rate: '84.4%' },
    { department: 'Direct Action', members: 23, active: 21, rate: '91.3%' },
    { department: 'Legal Support', members: 12, active: 10, rate: '83.3%' },
    { department: 'Communications', members: 18, active: 15, rate: '83.3%' }
  ]
};

export const CRMAnalytics: FC<CRMAnalyticsProps> = ({ className }) => {
  const totalContacts = useMemo(() => {
    return DEMO_DATA.supportLevelDistribution.reduce((sum, item) => sum + item.count, 0);
  }, []);

  const handleExportCSV = () => {
    // Generate CSV data
    const csvRows = [
      // Header
      ['Metric', 'Value'],
      ['Total Contacts', totalContacts.toString()],
      ['Contact Rate (per week)', '47'],
      ['Pipeline Conversions (this month)', '20'],
      ['Average Days to Convert', '21'],
      [''],
      ['Support Level', 'Count', 'Percentage'],
      ...DEMO_DATA.supportLevelDistribution.map(item => [
        item.level,
        item.count.toString(),
        item.percentage.toString()
      ]),
      [''],
      ['Movement Type', 'Count'],
      ...DEMO_DATA.pipelineMovement.map(item => [
        item.label,
        item.count.toString()
      ]),
      [''],
      ['Organizer', 'Contacts', 'Conversions', 'Conversion Rate'],
      ...DEMO_DATA.organizerPerformance.map(item => [
        item.name,
        item.contacts.toString(),
        item.conversions.toString(),
        item.conversionRate
      ])
    ];

    // Convert to CSV string
    const csvContent = csvRows.map(row => row.join(',')).join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `crm-analytics-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">CRM Analytics</h2>
          <p className="text-muted-foreground">
            Contact management and organizing metrics
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
              <p className="text-2xl font-bold">{totalContacts}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Activity className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contact Rate</p>
              <p className="text-2xl font-bold">{DEMO_DATA.contactRate.thisWeek}</p>
              <p className="text-xs text-green-500">{DEMO_DATA.contactRate.trend}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pipeline Conversions</p>
              <p className="text-2xl font-bold">{DEMO_DATA.pipelineMovement.neutralToPassive + DEMO_DATA.pipelineMovement.passiveToActive}</p>
              <p className="text-xs text-muted-foreground">This month</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Days to Convert</p>
              <p className="text-2xl font-bold">{DEMO_DATA.pipelineMovement.avgDaysToMove}</p>
              <p className="text-xs text-muted-foreground">Days</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Support Level Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Support Level Distribution
        </h3>

        <div className="space-y-4">
          {DEMO_DATA.supportLevelDistribution.map((item) => (
            <div key={item.level}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{item.level}</span>
                <span className="text-sm text-muted-foreground">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} transition-all duration-300`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="text-sm font-semibold mb-2">Pipeline Movement (This Month)</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-500">
                {DEMO_DATA.pipelineMovement.neutralToPassive}
              </p>
              <p className="text-xs text-muted-foreground">Neutral → Passive</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">
                {DEMO_DATA.pipelineMovement.passiveToActive}
              </p>
              <p className="text-xs text-muted-foreground">Passive → Active</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-500">
                {DEMO_DATA.pipelineMovement.activeToCore}
              </p>
              <p className="text-xs text-muted-foreground">Active → Core</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Organizer Performance */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Organizer Performance</h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">
                  Organizer
                </th>
                <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">
                  Contacts
                </th>
                <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">
                  Conversions
                </th>
                <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {DEMO_DATA.organizerPerformance.map((organizer) => (
                <tr key={organizer.name} className="border-b last:border-0">
                  <td className="py-3 px-2 font-medium">{organizer.name}</td>
                  <td className="py-3 px-2 text-right">{organizer.contacts}</td>
                  <td className="py-3 px-2 text-right">{organizer.conversions}</td>
                  <td className="py-3 px-2 text-right">
                    <span className="inline-flex items-center px-2 py-1 bg-green-500/10 text-green-500 rounded text-xs font-medium">
                      {organizer.rate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Department Analysis */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Department Analysis</h3>

        <div className="space-y-4">
          {DEMO_DATA.departmentAnalysis.map((dept) => (
            <div key={dept.department}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{dept.department}</span>
                <span className="text-sm text-muted-foreground">
                  {dept.active} / {dept.members} active ({dept.rate})
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: dept.rate }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
