/**
 * Public Page List Component
 * Manage public pages with publish/unpublish workflow
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  MoreVertical,
  Edit,
  Globe,
  FileText,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  ExternalLink
} from 'lucide-react';
import type { PublicPage } from '../../types';
import { usePublicStore } from '../../publicStore';

interface PublicPageListProps {
  groupId: string;
  onEdit: (page: PublicPage) => void;
  onCreate: () => void;
  onView: (page: PublicPage) => void;
}

export function PublicPageList({ groupId, onEdit, onCreate, onView }: PublicPageListProps) {
  const pages = usePublicStore((state) => state.getPublicPages(groupId));
  const updatePage = usePublicStore((state) => state.updatePublicPage);
  const deletePage = usePublicStore((state) => state.deletePublicPage);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<PublicPage | null>(null);

  const handleTogglePublish = (page: PublicPage) => {
    const newStatus = page.status === 'published' ? 'draft' : 'published';
    updatePage(page.id, {
      status: newStatus,
      ...(newStatus === 'published' && !page.publishedAt ? { publishedAt: Date.now() } : {}),
    });
  };

  const handleDelete = (page: PublicPage) => {
    setPageToDelete(page);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (pageToDelete) {
      deletePage(pageToDelete.id);
      setPageToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleCopyLink = (page: PublicPage) => {
    const url = `${window.location.origin}/${groupId}/${page.slug}`;
    navigator.clipboard.writeText(url);
    // TODO: Show toast notification
  };

  const getTypeIcon = (type: PublicPage['type']) => {
    switch (type) {
      case 'landing':
        return <Globe className="h-4 w-4" />;
      case 'about':
        return <FileText className="h-4 w-4" />;
      case 'events':
        return <FileText className="h-4 w-4" />;
      case 'contact':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Public Pages</h2>
          <p className="text-muted-foreground">
            Create and manage SEO-optimized public pages
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Page
        </Button>
      </div>

      {/* Pages List */}
      {pages.length === 0 ? (
        <Card className="p-12 text-center">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No public pages yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first public page to share with the world
          </p>
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Page
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pages.map((page) => (
            <Card key={page.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getTypeIcon(page.type)}
                    <h3 className="text-lg font-semibold">{page.title}</h3>
                    <Badge variant={page.status === 'published' ? 'default' : 'secondary'}>
                      {page.status}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">URL:</span>
                      <code className="bg-muted px-2 py-1 rounded text-xs">
                        /{page.slug}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyLink(page)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>

                    <div>
                      <span className="font-medium">Type:</span> {page.type}
                    </div>

                    {page.seo.description && (
                      <div className="mt-2 text-muted-foreground line-clamp-2">
                        {page.seo.description}
                      </div>
                    )}

                    <div className="text-xs mt-2">
                      Created {new Date(page.created).toLocaleDateString()}
                      {page.publishedAt && (
                        <> • Published {new Date(page.publishedAt).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(page)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onView(page)}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTogglePublish(page)}>
                      {page.status === 'published' ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Publish
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyLink(page)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(page)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{pageToDelete?.title}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
