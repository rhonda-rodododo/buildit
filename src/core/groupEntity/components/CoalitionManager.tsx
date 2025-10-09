/**
 * Coalition Manager
 * Create and manage multi-group coalitions
 */

import { useState } from 'react';
import { Users, Plus, Trash2, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useGroupEntityStore } from '../groupEntityStore';
import type { Coalition } from '../types';

interface CoalitionManagerProps {
  groupId?: string; // If provided, show coalitions for this group
}

export function CoalitionManager({ groupId }: CoalitionManagerProps) {
  const { coalitions, createCoalition, deleteCoalition } = useGroupEntityStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      await createCoalition({
        name: name.trim(),
        description: description.trim() || undefined,
        groupIds: selectedGroups,
      });

      setIsCreateOpen(false);
      setName('');
      setDescription('');
      setSelectedGroups([]);
    } catch (error) {
      console.error('[Coalition] Failed to create:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coalition?')) return;

    try {
      await deleteCoalition(id);
    } catch (error) {
      console.error('[Coalition] Failed to delete:', error);
    }
  };

  const filteredCoalitions = groupId
    ? coalitions.filter((c) => c.groupIds.includes(groupId))
    : coalitions;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Coalitions
            </CardTitle>
            <CardDescription>
              Multi-group chats for coordinating across organizations
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Coalition
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Coalition</DialogTitle>
                <DialogDescription>
                  Build a multi-group coalition for cross-organizational coordination
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Coalition Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Climate Justice Coalition"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this coalition working on?"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Participating Groups</Label>
                  <p className="text-sm text-muted-foreground">
                    Note: Group selection will be fully implemented in production.
                    For MVP, coalition is created with your current group.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={!name.trim()}>
                    Create Coalition
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {filteredCoalitions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No coalitions yet</p>
            <p className="text-sm mt-1">
              Create a coalition to coordinate with other organizations
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCoalitions.map((coalition) => (
              <CoalitionCard
                key={coalition.id}
                coalition={coalition}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CoalitionCardProps {
  coalition: Coalition;
  onDelete: (id: string) => void;
}

function CoalitionCard({ coalition, onDelete }: CoalitionCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium">{coalition.name}</h4>
          {coalition.description && (
            <p className="text-sm text-muted-foreground mt-1">{coalition.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">{coalition.groupIds.length} groups</Badge>
            {coalition.individualPubkeys.length > 0 && (
              <Badge variant="outline">
                {coalition.individualPubkeys.length} individuals
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(coalition.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
