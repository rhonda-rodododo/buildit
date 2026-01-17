/**
 * Bulk Operations Page
 * Demonstrates bulk selection, actions, and task management
 */

import { FC, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionsToolbar } from '@/components/bulk-operations/BulkActionsToolbar';
import { TaskManager } from '@/components/bulk-operations/TaskManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, ListTodo } from 'lucide-react';

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
  const [contacts] = useState<Contact[]>(DEMO_CONTACTS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('bulk-actions');

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
    console.info('Sending message to:', Array.from(selectedIds));
    alert(`Sending message to ${selectedIds.size} contacts`);
  };

  const handleBulkAddTag = () => {
    console.info('Adding tag to:', Array.from(selectedIds));
    alert(`Adding tag to ${selectedIds.size} contacts`);
  };

  const handleBulkUpdateField = () => {
    console.info('Updating field for:', Array.from(selectedIds));
    alert(`Updating field for ${selectedIds.size} contacts`);
  };

  const handleBulkAssignTask = () => {
    console.info('Assigning task for:', Array.from(selectedIds));
    alert(`Creating task for ${selectedIds.size} contacts`);
  };

  const handleBulkExport = () => {
    console.info('Exporting:', Array.from(selectedIds));
    alert(`Exporting ${selectedIds.size} contacts to CSV`);
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedIds.size} contacts? This cannot be undone.`)) {
      console.info('Deleting:', Array.from(selectedIds));
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Bulk Operations</h1>
        <p className="text-muted-foreground">
          Scale your organizing with bulk actions, multi-select, and automated task management
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bulk-actions" className="gap-2">
            <CheckSquare className="w-4 h-4" />
            Bulk Actions
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="w-4 h-4" />
            Task Manager
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
                    <th className="text-left p-4 font-medium">Name</th>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Support Level</th>
                    <th className="text-left p-4 font-medium">Tags</th>
                    <th className="text-left p-4 font-medium">Last Contact</th>
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
                            <span className="text-xs text-muted-foreground">No tags</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {Math.floor((Date.now() - contact.lastContact) / (24 * 60 * 60 * 1000))} days ago
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Info Box */}
          <Card className="p-4 bg-blue-500/5 border-blue-500/20">
            <h4 className="font-medium text-sm mb-2">Bulk Operations Features</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Select multiple contacts with checkboxes</li>
              <li>• Send bulk messages to selected contacts</li>
              <li>• Add tags to multiple contacts at once</li>
              <li>• Update custom fields in bulk</li>
              <li>• Assign tasks to organizers for follow-ups</li>
              <li>• Export selected contacts to CSV</li>
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
