/**
 * CRM Dashboard Component
 * Template selector and database table wrapper
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { databaseManager } from '@/modules/database/databaseManager';
import { CRM_TEMPLATES, type CRMTemplate } from '../templates';
import { useDatabaseStore } from '@/modules/database/databaseStore';
import { DatabaseDashboard } from '@/modules/database/components/DatabaseDashboard';

interface CRMDashboardProps {
  groupId: string;
  userPubkey: string;
}

export function CRMDashboard({ groupId, userPubkey }: CRMDashboardProps) {
  const { tables } = useDatabaseStore();
  const [showTemplates, setShowTemplates] = React.useState(true);

  // Check if user has already created CRM tables
  const groupTables = Array.from(tables.values()).filter((t) => t.groupId === groupId);
  const hasCRMTables = groupTables.length > 0;

  const handleApplyTemplate = async (template: CRMTemplate) => {
    const table = await databaseManager.createTable(
      groupId,
      userPubkey,
      template.name,
      template.description,
      template.icon
    );

    // Add fields from template
    for (const fieldTemplate of template.fields) {
      const fieldId = crypto.randomUUID();
      const field = {
        id: fieldId,
        groupId,
        entityType: 'database-record' as const,
        name: fieldTemplate.name!,
        label: fieldTemplate.label!,
        schema: fieldTemplate.schema!,
        widget: fieldTemplate.widget!,
        order: fieldTemplate.order!,
        created: Date.now(),
        createdBy: userPubkey,
        updated: Date.now(),
      };
      await databaseManager.addFieldToTable(table.id, field);
    }

    // Create views from template
    for (const viewTemplate of template.defaultViews) {
      await databaseManager.createView(
        table.id,
        groupId,
        userPubkey,
        viewTemplate.name,
        viewTemplate.type
      );
    }

    setShowTemplates(false);
  };

  if (!showTemplates && hasCRMTables) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">CRM</h2>
          <Button variant="outline" onClick={() => setShowTemplates(true)}>
            Browse Templates
          </Button>
        </div>
        <DatabaseDashboard groupId={groupId} userPubkey={userPubkey} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">CRM Templates</h2>
        <p className="text-muted-foreground mt-2">
          Choose a template to get started with contact management
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CRM_TEMPLATES.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">{template.icon}</span>
                {template.name}
              </CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <div className="font-medium">Includes:</div>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>{template.fields.length} custom fields</li>
                  <li>{template.defaultViews.length} pre-configured views</li>
                </ul>
              </div>
              <Button className="w-full" onClick={() => handleApplyTemplate(template)}>
                Use Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasCRMTables && (
        <div className="mt-8">
          <Button onClick={() => setShowTemplates(false)}>
            View My CRM Tables
          </Button>
        </div>
      )}
    </div>
  );
}
