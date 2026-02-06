/**
 * NewslettersPage Component
 * Main page for the newsletters module
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mail,
  FileText,
  Users,
  Settings,
  Plus,
  Smartphone,
  Monitor,
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
  | { type: 'sending'; issue: NewsletterIssue }
  | { type: 'preview'; issue: NewsletterIssue };

export const NewslettersPage: FC<NewslettersPageProps> = ({
  className,
}) => {
  const { t } = useTranslation();
  // Get groupId from route params and userPubkey from auth store
  const { groupId } = useParams<{ groupId: string }>();
  const currentIdentity = useAuthStore((state) => state.currentIdentity);
  const userPubkey = currentIdentity?.publicKey ?? '';

  // Guard: require groupId and auth
  if (!groupId || !userPubkey) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('newslettersPage.selectGroupLogin')}</p>
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
      toast.error(t('newslettersPage.enterName'));
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
    toast.success(t('newslettersPage.created'));
  };

  // Create issue handler
  const handleCreateIssue = () => {
    if (!currentNewsletter) return;

    const issue = createIssue({
      newsletterId: currentNewsletter.id,
      subject: t('newslettersPage.untitledIssue'),
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
      toast.success(t('newslettersPage.sent'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send newsletter');
    }
  };

  // Delete issue handler
  const handleDeleteIssue = (issueId: string) => {
    deleteIssue(issueId);
    setShowDeleteConfirm(null);
    toast.success(t('newslettersPage.deleted'));
  };

  // No newsletter yet
  if (!currentNewsletter) {
    return (
      <div className={`flex flex-col items-center justify-center h-full p-8 ${className}`}>
        <Mail className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">{t('newslettersPage.startNewsletter')}</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          {t('newslettersPage.startDescription')}
        </p>
        <Button onClick={() => setShowCreateNewsletter(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('newslettersPage.createNewsletter')}
        </Button>

        {/* Create Newsletter Dialog */}
        <Dialog open={showCreateNewsletter} onOpenChange={setShowCreateNewsletter}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('newslettersPage.createNewsletterTitle')}</DialogTitle>
              <DialogDescription>
                {t('newslettersPage.createDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">{t('newslettersPage.newsletterName')}</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('newslettersPage.namePlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="description">{t('newslettersPage.description')}</Label>
                <Textarea
                  id="description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t('newslettersPage.descriptionPlaceholder')}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateNewsletter(false)}>
                {t('newslettersPage.cancel')}
              </Button>
              <Button onClick={handleCreateNewsletter}>{t('newslettersPage.createNewsletter')}</Button>
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
          if (viewState.type === 'editor' && viewState.issue) {
            const latestIssue = useNewslettersStore.getState().getIssue(viewState.issue.id);
            if (latestIssue) {
              setViewState({ type: 'preview', issue: latestIssue });
            }
          }
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

  // Render preview view
  if (viewState.type === 'preview') {
    return <NewsletterPreview issue={viewState.issue} newsletter={currentNewsletter} onClose={() => setViewState({ type: 'editor', issue: viewState.issue })} className={className} />;
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
              {t('newslettersPage.settings')}
            </Button>
            <Button onClick={handleCreateIssue}>
              <Plus className="h-4 w-4 mr-2" />
              {t('newslettersPage.newIssue')}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('newslettersPage.stats.subscribers')}</CardDescription>
              <CardTitle className="text-3xl">{activeSubscribers.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('newslettersPage.stats.issuesSent')}</CardDescription>
              <CardTitle className="text-3xl">{sentCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('newslettersPage.stats.drafts')}</CardDescription>
              <CardTitle className="text-3xl">{draftCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('newslettersPage.stats.totalIssues')}</CardDescription>
              <CardTitle className="text-3xl">{issues.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="issues" className="space-y-6">
          <TabsList>
            <TabsTrigger value="issues">
              <FileText className="h-4 w-4 mr-2" />
              {t('newslettersPage.tabs.issues')}
            </TabsTrigger>
            <TabsTrigger value="subscribers">
              <Users className="h-4 w-4 mr-2" />
              {t('newslettersPage.tabs.subscribers')}
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
            <DialogTitle>{t('newslettersPage.deleteIssue')}</DialogTitle>
            <DialogDescription>
              {t('newslettersPage.deleteConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              {t('newslettersPage.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDeleteIssue(showDeleteConfirm)}
            >
              {t('newslettersPage.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/**
 * Newsletter Preview Component
 * Renders newsletter content in a preview frame with desktop/mobile toggles
 */
const NewsletterPreview: FC<{
  issue: NewsletterIssue;
  newsletter: Newsletter;
  onClose: () => void;
  className?: string;
}> = ({ issue, newsletter, onClose, className }) => {
  const { t } = useTranslation();
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  const renderedContent = useMemo(() => {
    const content = issue.content || '';
    if (issue.contentFormat === 'markdown') {
      // Basic markdown to HTML conversion for preview
      return content
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: ' + newsletter.theme.linkColor + '">$1</a>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>');
    }
    return content;
  }, [issue.content, issue.contentFormat, newsletter.theme.linkColor]);

  const previewHtml = `
    <div style="
      font-family: ${newsletter.theme.fontFamily === 'serif' ? 'Georgia, serif' : newsletter.theme.fontFamily === 'mono' ? '"Courier New", monospace' : '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'};
      background-color: ${newsletter.theme.backgroundColor};
      color: ${newsletter.theme.textColor};
      max-width: 600px;
      margin: 0 auto;
      padding: 24px;
    ">
      ${newsletter.headerImage ? `<img src="${newsletter.headerImage}" alt="" style="width: 100%; height: auto; margin-bottom: 24px; border-radius: 8px;" />` : ''}
      <h1 style="color: ${newsletter.theme.primaryColor}; margin-bottom: 8px;">${issue.subject}</h1>
      ${issue.previewText ? `<p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">${issue.previewText}</p>` : ''}
      <div style="line-height: 1.6;">
        <p>${renderedContent}</p>
      </div>
      ${newsletter.footerText ? `<hr style="margin: 32px 0; border-color: #e5e7eb;" /><p style="color: #9ca3af; font-size: 12px; text-align: center;">${newsletter.footerText}</p>` : ''}
    </div>
  `;

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Preview Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onClose}>
            ← {t('newslettersPage.backToEditor', 'Back to Editor')}
          </Button>
          <h2 className="text-lg font-semibold">{t('newslettersPage.preview', 'Preview')}</h2>
        </div>
        <div className="flex items-center gap-2 border rounded-md">
          <Button
            variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-r-none"
            onClick={() => setPreviewMode('desktop')}
          >
            <Monitor className="h-4 w-4 mr-1" />
            {t('newslettersPage.desktop', 'Desktop')}
          </Button>
          <Button
            variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-l-none"
            onClick={() => setPreviewMode('mobile')}
          >
            <Smartphone className="h-4 w-4 mr-1" />
            {t('newslettersPage.mobile', 'Mobile')}
          </Button>
        </div>
      </div>

      {/* Preview Content */}
      <ScrollArea className="flex-1 bg-muted/30">
        <div className="flex justify-center p-8">
          <div
            className={`bg-background border rounded-lg shadow-sm transition-all ${
              previewMode === 'mobile' ? 'w-[375px]' : 'w-full max-w-[700px]'
            }`}
          >
            <div
              className="p-6"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
