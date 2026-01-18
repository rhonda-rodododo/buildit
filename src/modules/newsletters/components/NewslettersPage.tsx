/**
 * NewslettersPage Component
 * Main page for the newsletters module
 */

import { FC, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNewslettersStore } from '../newslettersStore';
import { useAuthStore } from '@/stores/authStore';
import { NewsletterEditor } from './NewsletterEditor';
import { IssuesList } from './IssuesList';
import { SubscriberManager } from './SubscriberManager';
import { DeliveryProgress } from './DeliveryProgress';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Mail,
  FileText,
  Users,
  Settings,
  Plus,
} from 'lucide-react';
import type { Newsletter, NewsletterIssue, CreateNewsletterInput, UpdateIssueInput } from '../types';
import { toast } from 'sonner';

interface NewslettersPageProps {
  className?: string;
}

type ViewState =
  | { type: 'dashboard' }
  | { type: 'editor'; issue?: NewsletterIssue }
  | { type: 'settings' }
  | { type: 'sending'; issue: NewsletterIssue };

export const NewslettersPage: FC<NewslettersPageProps> = ({
  className,
}) => {
  // Get groupId from route params and userPubkey from auth store
  const { groupId } = useParams<{ groupId: string }>();
  const currentIdentity = useAuthStore((state) => state.currentIdentity);
  const userPubkey = currentIdentity?.publicKey ?? '';

  // Guard: require groupId and auth
  if (!groupId || !userPubkey) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a group and log in to manage newsletters.</p>
      </div>
    );
  }
  const {
    createNewsletter,
    createIssue,
    updateIssue,
    deleteIssue,
    scheduleIssue,
    sendIssue,
    cancelDelivery,
    getGroupNewsletters,
    getNewsletterIssues,
    getActiveSubscribers,
    isDelivering,
    currentDeliveryProgress,
  } = useNewslettersStore();

  // State
  const [viewState, setViewState] = useState<ViewState>({ type: 'dashboard' });
  const [selectedNewsletterId, setSelectedNewsletterId] = useState<string | null>(null);
  const [showCreateNewsletter, setShowCreateNewsletter] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Derive current newsletter - defaults to first one if none selected
  const newsletters = getGroupNewsletters(groupId);
  const currentNewsletter = selectedNewsletterId
    ? newsletters.find((n) => n.id === selectedNewsletterId) ?? newsletters[0] ?? null
    : newsletters[0] ?? null;

  // Wrapper to update selection
  const setCurrentNewsletter = (newsletter: Newsletter | null) => {
    setSelectedNewsletterId(newsletter?.id ?? null);
  };

  // Create newsletter handler
  const handleCreateNewsletter = () => {
    if (!newName.trim()) {
      toast.error('Please enter a newsletter name');
      return;
    }

    const input: CreateNewsletterInput = {
      groupId,
      name: newName.trim(),
      description: newDescription.trim(),
    };

    const newsletter = createNewsletter(input);
    // Set owner pubkey
    useNewslettersStore.getState().updateNewsletter(newsletter.id, {});

    setCurrentNewsletter({ ...newsletter, ownerPubkey: userPubkey });
    setShowCreateNewsletter(false);
    setNewName('');
    setNewDescription('');
    toast.success('Newsletter created');
  };

  // Create issue handler
  const handleCreateIssue = () => {
    if (!currentNewsletter) return;

    const issue = createIssue({
      newsletterId: currentNewsletter.id,
      subject: 'Untitled Issue',
    });

    // Set author pubkey
    updateIssue(issue.id, {});

    setViewState({ type: 'editor', issue: { ...issue, authorPubkey: userPubkey } });
  };

  // Save issue handler
  const handleSaveIssue = (issueId: string, updates: UpdateIssueInput) => {
    updateIssue(issueId, updates);
  };

  // Send issue handler
  const handleSendIssue = async (issue: NewsletterIssue) => {
    setViewState({ type: 'sending', issue });

    try {
      await sendIssue(issue.id);
      toast.success('Newsletter sent successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send newsletter');
    }
  };

  // Delete issue handler
  const handleDeleteIssue = (issueId: string) => {
    deleteIssue(issueId);
    setShowDeleteConfirm(null);
    toast.success('Issue deleted');
  };

  // No newsletter yet
  if (!currentNewsletter) {
    return (
      <div className={`flex flex-col items-center justify-center h-full p-8 ${className}`}>
        <Mail className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Start a Newsletter</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Create a newsletter to send updates to your subscribers via encrypted Nostr DMs.
        </p>
        <Button onClick={() => setShowCreateNewsletter(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Newsletter
        </Button>

        {/* Create Newsletter Dialog */}
        <Dialog open={showCreateNewsletter} onOpenChange={setShowCreateNewsletter}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Newsletter</DialogTitle>
              <DialogDescription>
                Set up your newsletter to start sending updates.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Newsletter Name</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Awesome Newsletter"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What will you share with your subscribers?"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateNewsletter(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateNewsletter}>Create Newsletter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Get stats
  const issues = getNewsletterIssues(currentNewsletter.id);
  const activeSubscribers = getActiveSubscribers(currentNewsletter.id);
  const sentCount = issues.filter((i) => i.status === 'sent').length;
  const draftCount = issues.filter((i) => i.status === 'draft').length;

  // Render editor view
  if (viewState.type === 'editor') {
    return (
      <NewsletterEditor
        issue={viewState.issue}
        newsletter={currentNewsletter}
        onSave={(updates) => {
          if (viewState.issue) {
            handleSaveIssue(viewState.issue.id, updates);
          }
        }}
        onSend={() => {
          if (viewState.issue) {
            const latestIssue = useNewslettersStore.getState().getIssue(viewState.issue.id);
            if (latestIssue) {
              handleSendIssue(latestIssue);
            }
          }
        }}
        onSchedule={(scheduledAt) => {
          if (viewState.issue) {
            scheduleIssue(viewState.issue.id, scheduledAt);
            setViewState({ type: 'dashboard' });
          }
        }}
        onPreview={() => {
          toast.info('Preview coming soon');
        }}
        onClose={() => setViewState({ type: 'dashboard' })}
        className="h-full"
      />
    );
  }

  // Render sending view
  if (viewState.type === 'sending') {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <DeliveryProgress
          issue={viewState.issue}
          progress={currentDeliveryProgress}
          isDelivering={isDelivering}
          onCancel={() => cancelDelivery(viewState.issue.id)}
          onClose={() => setViewState({ type: 'dashboard' })}
          className="max-w-md w-full"
        />
      </div>
    );
  }

  // Main dashboard view
  return (
    <div className={`h-full overflow-y-auto ${className}`}>
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{currentNewsletter.name}</h1>
            <p className="text-muted-foreground">{currentNewsletter.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewState({ type: 'settings' })}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button onClick={handleCreateIssue}>
              <Plus className="h-4 w-4 mr-2" />
              New Issue
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Subscribers</CardDescription>
              <CardTitle className="text-3xl">{activeSubscribers.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Issues Sent</CardDescription>
              <CardTitle className="text-3xl">{sentCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Drafts</CardDescription>
              <CardTitle className="text-3xl">{draftCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Issues</CardDescription>
              <CardTitle className="text-3xl">{issues.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="issues" className="space-y-6">
          <TabsList>
            <TabsTrigger value="issues">
              <FileText className="h-4 w-4 mr-2" />
              Issues
            </TabsTrigger>
            <TabsTrigger value="subscribers">
              <Users className="h-4 w-4 mr-2" />
              Subscribers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issues">
            <IssuesList
              newsletterId={currentNewsletter.id}
              onCreateIssue={handleCreateIssue}
              onEditIssue={(issue) => setViewState({ type: 'editor', issue })}
              onSendIssue={handleSendIssue}
              onDeleteIssue={(id) => setShowDeleteConfirm(id)}
            />
          </TabsContent>

          <TabsContent value="subscribers">
            <SubscriberManager newsletterId={currentNewsletter.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Issue</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this issue? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDeleteIssue(showDeleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
