/**
 * Bulk Operations Page
 * Demonstrates bulk selection, actions, and task management
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionsToolbar } from '@/components/bulk-operations/BulkActionsToolbar';
import { TaskManager } from '@/components/bulk-operations/TaskManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, ListTodo } from 'lucide-react';
import { getCurrentTime } from '@/lib/utils';

interface Contact {
  id: string;
  name: string;
  email: string;
  supportLevel: 'Neutral' | 'Passive Support' | 'Active Support' | 'Core Organizer';
  lastContact: number;
  tags: string[];
}

// Demo contacts
const DEMO_CONTACTS: Contact[] = [
  {
    id: 'contact-1',
    name: 'Sarah Chen',
    email: 'sarah.chen@email.com',
    supportLevel: 'Active Support',
    lastContact: Date.now() - 2 * 24 * 60 * 60 * 1000,
    tags: ['climate', 'outreach']
  },
  {
    id: 'contact-2',
    name: 'Marcus Johnson',
    email: 'marcus.j@email.com',
    supportLevel: 'Core Organizer',
    lastContact: Date.now() - 1 * 24 * 60 * 60 * 1000,
    tags: ['direct-action', 'legal']
  },
  {
    id: 'contact-3',
    name: 'Emma Rodriguez',
    email: 'emma.rodriguez@email.com',
    supportLevel: 'Active Support',
    lastContact: Date.now() - 5 * 24 * 60 * 60 * 1000,
    tags: ['mutual-aid', 'communications']
  },
  {
    id: 'contact-4',
    name: 'Jordan Kim',
    email: 'jordan.kim@email.com',
    supportLevel: 'Passive Support',
    lastContact: Date.now() - 10 * 24 * 60 * 60 * 1000,
    tags: ['climate', 'volunteer']
  },
  {
    id: 'contact-5',
    name: 'Alex Martinez',
    email: 'alex.m@email.com',
    supportLevel: 'Neutral',
    lastContact: Date.now() - 15 * 24 * 60 * 60 * 1000,
    tags: []
  }
];

export const BulkOperationsPage: FC = () => {
  const { t } = useTranslation();
  const [contacts] = useState<Contact[]>(DEMO_CONTACTS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('bulk-actions');
  // Capture time once on mount for computing "days ago" without impure Date.now()
  const [mountTime] = useState(getCurrentTime);

  const handleToggleSelect = (contactId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(contacts.map(c => c.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBulkMessage = () => {
    alert(t('bulkOperationsPage.alerts.sendingMessage', { count: selectedIds.size }));
  };

  const handleBulkAddTag = () => {
    alert(t('bulkOperationsPage.alerts.addingTag', { count: selectedIds.size }));
  };

  const handleBulkUpdateField = () => {
    alert(t('bulkOperationsPage.alerts.updatingField', { count: selectedIds.size }));
  };

  const handleBulkAssignTask = () => {
    alert(t('bulkOperationsPage.alerts.creatingTask', { count: selectedIds.size }));
  };

  const handleBulkExport = () => {
    alert(t('bulkOperationsPage.alerts.exportingCSV', { count: selectedIds.size }));
  };

  const handleBulkDelete = () => {
    if (confirm(t('bulkOperationsPage.alerts.confirmDelete', { count: selectedIds.size }))) {
      setSelectedIds(new Set());
    }
  };

  const getSupportLevelColor = (level: Contact['supportLevel']) => {
    switch (level) {
      case 'Core Organizer': return 'text-purple-500 bg-purple-500/10';
      case 'Active Support': return 'text-green-500 bg-green-500/10';
      case 'Passive Support': return 'text-blue-500 bg-blue-500/10';
      case 'Neutral': return 'text-gray-500 bg-gray-500/10';
    }
  };

  return (
    <div className="space-y-6">
      <PageMeta titleKey="crm.title" descriptionKey="meta.crm" path="/app/bulk-operations" />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">{t('bulkOperationsPage.title')}</h1>
        <p className="text-muted-foreground">
          {t('bulkOperationsPage.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bulk-actions" className="gap-2">
            <CheckSquare className="w-4 h-4" />
            {t('bulkOperationsPage.tabs.bulkActions')}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="w-4 h-4" />
            {t('bulkOperationsPage.tabs.taskManager')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bulk-actions" className="space-y-4 mt-6">
          {/* Bulk Actions Toolbar */}
          <BulkActionsToolbar
            selectedCount={selectedIds.size}
            totalCount={contacts.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onBulkMessage={handleBulkMessage}
            onBulkAddTag={handleBulkAddTag}
            onBulkUpdateField={handleBulkUpdateField}
            onBulkAssignTask={handleBulkAssignTask}
            onBulkExport={handleBulkExport}
            onBulkDelete={handleBulkDelete}
          />

          {/* Contacts List with Checkboxes */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">
                      <Checkbox
                        checked={selectedIds.size === contacts.length && contacts.length > 0}
                        onCheckedChange={() => {
                          if (selectedIds.size === contacts.length) {
                            handleDeselectAll();
                          } else {
                            handleSelectAll();
                          }
                        }}
                      />
                    </th>
                    <th className="text-left p-4 font-medium">{t('bulkOperationsPage.table.name')}</th>
                    <th className="text-left p-4 font-medium">{t('bulkOperationsPage.table.email')}</th>
                    <th className="text-left p-4 font-medium">{t('bulkOperationsPage.table.supportLevel')}</th>
                    <th className="text-left p-4 font-medium">{t('bulkOperationsPage.table.tags')}</th>
                    <th className="text-left p-4 font-medium">{t('bulkOperationsPage.table.lastContact')}</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className={`border-b hover:bg-muted/50 transition-colors ${
                        selectedIds.has(contact.id) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="p-4">
                        <Checkbox
                          checked={selectedIds.has(contact.id)}
                          onCheckedChange={() => handleToggleSelect(contact.id)}
                        />
                      </td>
                      <td className="p-4 font-medium">{contact.name}</td>
                      <td className="p-4 text-muted-foreground">{contact.email}</td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getSupportLevelColor(contact.supportLevel)}`}>
                          {contact.supportLevel}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1 flex-wrap">
                          {contact.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                          {contact.tags.length === 0 && (
                            <span className="text-xs text-muted-foreground">{t('bulkOperationsPage.table.noTags')}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {t('bulkOperationsPage.table.daysAgo', { count: Math.floor((mountTime - contact.lastContact) / (24 * 60 * 60 * 1000)) })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Info Box */}
          <Card className="p-4 bg-blue-500/5 border-blue-500/20">
            <h4 className="font-medium text-sm mb-2">{t('bulkOperationsPage.features.title')}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {t('bulkOperationsPage.features.selectMultiple')}</li>
              <li>• {t('bulkOperationsPage.features.sendBulk')}</li>
              <li>• {t('bulkOperationsPage.features.addTags')}</li>
              <li>• {t('bulkOperationsPage.features.updateFields')}</li>
              <li>• {t('bulkOperationsPage.features.assignTasks')}</li>
              <li>• {t('bulkOperationsPage.features.exportCSV')}</li>
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <TaskManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};
