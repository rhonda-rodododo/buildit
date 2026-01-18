/**
 * PublishingPage Component
 * Main page for the publishing module
 */

import { FC, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublishingStore } from '../publishingStore';
import { useAuthStore } from '@/stores/authStore';
import { ArticleList } from './ArticleList';
import { ArticleEditor } from './ArticleEditor';
import { ArticleView } from './ArticleView';
import { PublicationSettings } from './PublicationSettings';
import { SubscriberList } from './SubscriberList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  BookOpen,
  FileText,
  Users,
  Settings,
  BarChart3,
  Plus,
  Rss,
} from 'lucide-react';
import type { Article, Publication, CreatePublicationInput, UpdateArticleInput } from '../types';
import { toast } from 'sonner';

interface PublishingPageProps {
  className?: string;
}

type ViewState =
  | { type: 'dashboard' }
  | { type: 'articles' }
  | { type: 'editor'; article?: Article }
  | { type: 'preview'; article: Article }
  | { type: 'settings' }
  | { type: 'subscribers' }
  | { type: 'analytics' };

export const PublishingPage: FC<PublishingPageProps> = ({
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
        <p className="text-muted-foreground">Please select a group and log in to manage publications.</p>
      </div>
    );
  }
  const {
    createPublication,
    createArticle,
    updateArticle,
    deleteArticle,
    publishArticle,
    scheduleArticle,
    getGroupPublications,
    getPublicationArticles,
    getPublicationSubscriptions,
    recordView,
  } = usePublishingStore();

  // State
  const [viewState, setViewState] = useState<ViewState>({ type: 'dashboard' });
  const [selectedPublicationId, setSelectedPublicationId] = useState<string | null>(null);
  const [showCreatePublication, setShowCreatePublication] = useState(false);
  const [newPubName, setNewPubName] = useState('');
  const [newPubDescription, setNewPubDescription] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Derive current publication - defaults to first one if none selected
  const publications = getGroupPublications(groupId);
  const currentPublication = selectedPublicationId
    ? publications.find((p) => p.id === selectedPublicationId) ?? publications[0] ?? null
    : publications[0] ?? null;

  // Wrapper to update selection
  const setCurrentPublication = (publication: Publication | null) => {
    setSelectedPublicationId(publication?.id ?? null);
  };

  // Create publication handler
  const handleCreatePublication = () => {
    if (!newPubName.trim()) {
      toast.error('Please enter a publication name');
      return;
    }

    const input: CreatePublicationInput = {
      groupId,
      name: newPubName.trim(),
      description: newPubDescription.trim(),
    };

    const publication = createPublication(input);
    // Set owner pubkey
    usePublishingStore.getState().updatePublication(publication.id, {});

    setCurrentPublication({ ...publication, ownerPubkey: userPubkey });
    setShowCreatePublication(false);
    setNewPubName('');
    setNewPubDescription('');
    toast.success('Publication created');
  };

  // Create article handler
  const handleCreateArticle = () => {
    if (!currentPublication) return;

    const article = createArticle({
      publicationId: currentPublication.id,
      groupId,
      title: 'Untitled Article',
    });

    // Set author pubkey
    updateArticle(article.id, {});

    setViewState({ type: 'editor', article: { ...article, authorPubkey: userPubkey } });
  };

  // Article save handler
  const handleSaveArticle = (articleId: string, updates: UpdateArticleInput) => {
    updateArticle(articleId, updates);
  };

  // Delete article handler
  const handleDeleteArticle = (articleId: string) => {
    deleteArticle(articleId);
    setShowDeleteConfirm(null);
    toast.success('Article deleted');
  };

  // No publication yet
  if (!currentPublication) {
    return (
      <div className={`flex flex-col items-center justify-center h-full p-8 ${className}`}>
        <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Start Publishing</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Create your first publication to start writing and sharing long-form content
          with your audience.
        </p>
        <Button onClick={() => setShowCreatePublication(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Publication
        </Button>

        {/* Create Publication Dialog */}
        <Dialog open={showCreatePublication} onOpenChange={setShowCreatePublication}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Publication</DialogTitle>
              <DialogDescription>
                Set up your publication to start writing articles.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="pubName">Publication Name</Label>
                <Input
                  id="pubName"
                  value={newPubName}
                  onChange={(e) => setNewPubName(e.target.value)}
                  placeholder="My Awesome Publication"
                />
              </div>
              <div>
                <Label htmlFor="pubDesc">Description</Label>
                <Textarea
                  id="pubDesc"
                  value={newPubDescription}
                  onChange={(e) => setNewPubDescription(e.target.value)}
                  placeholder="What will you write about?"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreatePublication(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePublication}>Create Publication</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Get stats
  const pubArticles = getPublicationArticles(currentPublication.id);
  const pubSubscribers = getPublicationSubscriptions(currentPublication.id);
  const publishedCount = pubArticles.filter((a) => a.status === 'published').length;
  const draftCount = pubArticles.filter((a) => a.status === 'draft').length;
  const activeSubscribers = pubSubscribers.filter((s) => s.status === 'active').length;

  // Render based on view state
  if (viewState.type === 'editor') {
    return (
      <ArticleEditor
        article={viewState.article}
        publicationId={currentPublication.id}
        groupId={groupId}
        onSave={(updates) => {
          if (viewState.article) {
            handleSaveArticle(viewState.article.id, updates);
          }
        }}
        onPublish={() => {
          if (viewState.article) {
            publishArticle(viewState.article.id);
            toast.success('Article published');
            setViewState({ type: 'articles' });
          }
        }}
        onSchedule={(scheduledAt) => {
          if (viewState.article) {
            scheduleArticle(viewState.article.id, scheduledAt);
            setViewState({ type: 'articles' });
          }
        }}
        onPreview={() => {
          if (viewState.article) {
            const article = usePublishingStore.getState().getArticle(viewState.article.id);
            if (article) {
              setViewState({ type: 'preview', article });
            }
          }
        }}
        onClose={() => setViewState({ type: 'articles' })}
        className="h-full"
      />
    );
  }

  if (viewState.type === 'preview' && viewState.article) {
    return (
      <div className="h-full overflow-y-auto p-8">
        <ArticleView
          article={viewState.article}
          publication={currentPublication}
          onBack={() => setViewState({ type: 'editor', article: viewState.article })}
          onRecordView={(sessionId) =>
            recordView(viewState.article!.id, currentPublication.id, sessionId)
          }
        />
      </div>
    );
  }

  if (viewState.type === 'settings') {
    return (
      <PublicationSettings
        publication={currentPublication}
        onClose={() => setViewState({ type: 'dashboard' })}
        className="h-full"
      />
    );
  }

  if (viewState.type === 'subscribers') {
    return (
      <div className="h-full overflow-y-auto p-8">
        <SubscriberList
          publicationId={currentPublication.id}
          onBack={() => setViewState({ type: 'dashboard' })}
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
            <h1 className="text-3xl font-bold">{currentPublication.name}</h1>
            <p className="text-muted-foreground">{currentPublication.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {currentPublication.settings.enableRss && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/rss/${currentPublication.slug}.xml`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Rss className="h-4 w-4 mr-2" />
                  RSS Feed
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setViewState({ type: 'settings' })}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button onClick={handleCreateArticle}>
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Published</CardDescription>
              <CardTitle className="text-3xl">{publishedCount}</CardTitle>
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
              <CardDescription>Subscribers</CardDescription>
              <CardTitle className="text-3xl">{activeSubscribers}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Articles</CardDescription>
              <CardTitle className="text-3xl">{pubArticles.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="articles" className="space-y-6">
          <TabsList>
            <TabsTrigger value="articles">
              <FileText className="h-4 w-4 mr-2" />
              Articles
            </TabsTrigger>
            <TabsTrigger value="subscribers">
              <Users className="h-4 w-4 mr-2" />
              Subscribers
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="articles">
            <ArticleList
              publicationId={currentPublication.id}
              onCreateArticle={handleCreateArticle}
              onEditArticle={(article) => setViewState({ type: 'editor', article })}
              onPreviewArticle={(article) => setViewState({ type: 'preview', article })}
              onDeleteArticle={(id) => setShowDeleteConfirm(id)}
            />
          </TabsContent>

          <TabsContent value="subscribers">
            <SubscriberList
              publicationId={currentPublication.id}
              onBack={() => {}}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Publication Analytics</CardTitle>
                <CardDescription>
                  View performance metrics for your publication
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                  <p>Analytics coming soon</p>
                  <p className="text-sm">
                    View article performance, subscriber growth, and more.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Article</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this article? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDeleteArticle(showDeleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
