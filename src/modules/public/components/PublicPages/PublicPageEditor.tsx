/**
 * Public Page Editor Component
 * Rich text editor for creating/editing public pages
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SEOControls } from './SEOControls';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Quote,
  Minus,
  Undo,
  Redo,
  Eye,
  Save,
  Globe
} from 'lucide-react';
import type { PublicPage, PageType, PageStatus, SEOMetadata } from '../../types';
import { useState, useCallback, useEffect } from 'react';

interface PublicPageEditorProps {
  page: PublicPage | null;
  onSave: (page: Omit<PublicPage, 'id' | 'created' | 'createdBy' | 'updated'>) => void;
  onCancel: () => void;
  groupId: string;
}

export function PublicPageEditor({ page, onSave, onCancel, groupId }: PublicPageEditorProps) {
  const [title, setTitle] = useState(page?.title || '');
  const [slug, setSlug] = useState(page?.slug || '');
  const [type, setType] = useState<PageType>(page?.type || 'custom');
  const [status, setStatus] = useState<PageStatus>(page?.status || 'draft');
  const [seo, setSeo] = useState<SEOMetadata>(page?.seo || {});
  const [preview, setPreview] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: 'Write your page content here...',
      }),
    ],
    content: page?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  });

  // Auto-generate slug from title (for new pages only)
  useEffect(() => {
    if (!page && title) {
      const autoSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: auto-slug from title
      setSlug(autoSlug);
    }
  }, [title, page]);

  const handleSave = useCallback(() => {
    if (!editor || !title || !slug) return;

    const pageData = {
      groupId,
      title,
      slug,
      type,
      status,
      content: editor.getHTML(),
      seo,
      ...(status === 'published' && !page?.publishedAt ? { publishedAt: Date.now() } : {}),
    };

    onSave(pageData);
  }, [editor, groupId, title, slug, type, status, seo, page, onSave]);

  const handlePublish = useCallback(() => {
    setStatus('published');
    setTimeout(() => handleSave(), 100);
  }, [handleSave]);

  if (!editor) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {page ? 'Edit Page' : 'Create Page'}
          </h2>
          <p className="text-muted-foreground">
            Create SEO-optimized public pages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPreview(!preview)}>
            <Eye className="h-4 w-4 mr-2" />
            {preview ? 'Edit' : 'Preview'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          {status === 'draft' && (
            <Button onClick={handlePublish}>
              <Globe className="h-4 w-4 mr-2" />
              Publish
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="content" className="w-full">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4">
          {/* Basic Fields */}
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Page Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter page title"
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  yoursite.com/
                </span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="page-slug"
                  pattern="[a-z0-9-]+"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Page Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as PageType)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landing">Landing Page</SelectItem>
                  <SelectItem value="about">About Page</SelectItem>
                  <SelectItem value="events">Events Calendar</SelectItem>
                  <SelectItem value="contact">Contact Page</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Editor */}
          {!preview && (
            <Card className="overflow-hidden">
              {/* Toolbar */}
              <div className="border-b p-2 flex flex-wrap gap-1 bg-muted/30">
                <Button
                  variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                >
                  <Heading1 className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                  <Heading2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                >
                  <Heading3 className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  variant={editor.isActive('code') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleCode().run()}
                >
                  <Code className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                >
                  <Quote className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().setHorizontalRule().run()}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!editor.can().undo()}
                >
                  <Undo className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!editor.can().redo()}
                >
                  <Redo className="h-4 w-4" />
                </Button>
              </div>

              {/* Editor Content */}
              <div className="min-h-[400px]">
                <EditorContent editor={editor} />
              </div>
            </Card>
          )}

          {/* Preview */}
          {preview && (
            <Card className="p-8">
              <div className="prose prose-sm max-w-none">
                <h1>{title}</h1>
                <div dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
              </div>
            </Card>
          )}
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo">
          <SEOControls seo={seo} onUpdate={setSeo} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Page Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PageStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Draft pages are only visible to group admins
              </p>
            </div>

            {page?.publishedAt && (
              <div className="text-sm text-muted-foreground">
                Published: {new Date(page.publishedAt).toLocaleString()}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
