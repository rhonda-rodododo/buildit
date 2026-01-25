/**
 * ArticleEditor Component
 * Rich text editor for creating and editing articles
 * Reuses TipTap editor from Documents module
 */

import { FC, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  ImageIcon,
  Link as LinkIcon,
  Table as TableIcon,
  Save,
  Eye,
  Clock,
  Send,
  X,
  CalendarIcon,
} from 'lucide-react';
import type { Article, ArticleVisibility, UpdateArticleInput } from '../types';
import type { SEOMetadata } from '../../public/types';
import { format } from 'date-fns';
import { toast } from 'sonner';

const lowlight = createLowlight(common);

interface ArticleEditorProps {
  article?: Article;
  publicationId: string;
  groupId: string;
  onSave: (updates: UpdateArticleInput) => void;
  onPublish: () => void;
  onSchedule: (scheduledAt: number) => void;
  onPreview: () => void;
  onClose: () => void;
  className?: string;
}

export const ArticleEditor: FC<ArticleEditorProps> = ({
  article,
  publicationId: _publicationId,
  groupId: _groupId,
  onSave,
  onPublish,
  onSchedule,
  onPreview,
  onClose,
  className,
}) => {
  const { t } = useTranslation();
  // Form state
  const [title, setTitle] = useState(article?.title || '');
  const [subtitle, setSubtitle] = useState(article?.subtitle || '');
  const [coverImage, setCoverImage] = useState(article?.coverImage || '');
  const [tags, setTags] = useState<string[]>(article?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [visibility, setVisibility] = useState<ArticleVisibility>(
    article?.visibility || 'public'
  );
  const [seo, setSeo] = useState<Partial<SEOMetadata>>(article?.seo || {});
  const [showSeoSettings, setShowSeoSettings] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Initialize editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 hover:underline',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Placeholder.configure({
        placeholder: 'Start writing your article...',
      }),
    ],
    content: article?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] p-4',
      },
    },
  });

  // Handle auto-save
  const handleAutoSave = useCallback(async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      const updates: UpdateArticleInput = {
        title,
        subtitle,
        content: editor.getHTML(),
        coverImage,
        tags,
        visibility,
        seo,
      };
      onSave(updates);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [editor, title, subtitle, coverImage, tags, visibility, seo, onSave]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (editor && !isSaving) {
        handleAutoSave();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [editor, isSaving, handleAutoSave]);

  // Handle manual save
  const handleSave = () => {
    if (!editor) return;

    const updates: UpdateArticleInput = {
      title,
      subtitle,
      content: editor.getHTML(),
      coverImage,
      tags,
      visibility,
      seo,
    };
    onSave(updates);
    setLastSaved(new Date());
    toast.success(t('articleEditor.articleSaved'));
  };

  // Handle publish
  const handlePublish = () => {
    handleSave();
    onPublish();
  };

  // Handle schedule
  const handleSchedule = () => {
    if (!scheduleDate) {
      toast.error(t('articleEditor.selectDateTime'));
      return;
    }
    handleSave();
    onSchedule(scheduleDate.getTime());
    toast.success(t('articleEditor.articleScheduled', { date: format(scheduleDate, 'PPpp') }));
  };

  // Handle tag input
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // Editor toolbar actions
  const addImage = () => {
    const url = window.prompt(t('articleEditor.imageUrlPrompt'));
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const setLink = () => {
    const url = window.prompt(t('articleEditor.linkUrlPrompt'));
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const insertTable = () => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            {t('articleEditor.close')}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isSaving ? (
              <span>{t('articleEditor.saving')}</span>
            ) : lastSaved ? (
              <span>{t('articleEditor.lastSaved', { time: format(lastSaved, 'p') })}</span>
            ) : (
              <span>{t('articleEditor.notSaved')}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {t('articleEditor.saveDraft')}
          </Button>
          <Button variant="outline" size="sm" onClick={onPreview}>
            <Eye className="h-4 w-4 mr-2" />
            {t('articleEditor.preview')}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Clock className="h-4 w-4 mr-2" />
                {t('articleEditor.schedule')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-4">
                <Calendar
                  mode="single"
                  selected={scheduleDate}
                  onSelect={setScheduleDate}
                  disabled={(date) => date < new Date()}
                />
                {scheduleDate && (
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSchedule}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {t('articleEditor.scheduleFor', { date: format(scheduleDate, 'PP') })}
                    </Button>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={handlePublish}>
            <Send className="h-4 w-4 mr-2" />
            {t('articleEditor.publish')}
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('articleEditor.titlePlaceholder')}
            className="text-4xl font-bold border-none focus:ring-0 px-0 mb-2"
          />

          {/* Subtitle */}
          <Input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder={t('articleEditor.subtitlePlaceholder')}
            className="text-xl text-muted-foreground border-none focus:ring-0 px-0 mb-4"
          />

          {/* Cover Image */}
          <div className="mb-6">
            {coverImage ? (
              <div className="relative">
                <img
                  src={coverImage}
                  alt="Cover"
                  className="w-full h-64 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => setCoverImage('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-32 border-dashed"
                onClick={() => {
                  const url = window.prompt(t('articleEditor.coverImagePrompt'));
                  if (url) setCoverImage(url);
                }}
              >
                <ImageIcon className="h-6 w-6 mr-2" />
                {t('articleEditor.addCoverImage')}
              </Button>
            )}
          </div>

          {/* Tags */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="px-2 py-1">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder={t('articleEditor.addTags')}
              className="max-w-xs"
            />
          </div>

          {/* Visibility */}
          <div className="mb-6 flex items-center gap-4">
            <Label>{t('articleEditor.visibility')}</Label>
            <Select
              value={visibility}
              onValueChange={(v) => setVisibility(v as ArticleVisibility)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t('articleEditor.visibilityOptions.public')}</SelectItem>
                <SelectItem value="subscribers">{t('articleEditor.visibilityOptions.subscribers')}</SelectItem>
                <SelectItem value="paid">{t('articleEditor.visibilityOptions.paid')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* SEO Settings Toggle */}
          <Button
            variant="link"
            size="sm"
            onClick={() => setShowSeoSettings(!showSeoSettings)}
            className="mb-4 px-0"
          >
            {showSeoSettings ? t('articleEditor.hideSeoSettings') : t('articleEditor.showSeoSettings')}
          </Button>

          {/* SEO Settings */}
          {showSeoSettings && (
            <div className="mb-6 p-4 border rounded-lg space-y-4">
              <h4 className="font-medium">{t('articleEditor.seoSettings')}</h4>
              <div className="grid gap-4">
                <div>
                  <Label>{t('articleEditor.metaTitle')}</Label>
                  <Input
                    value={seo.title || ''}
                    onChange={(e) => setSeo({ ...seo, title: e.target.value })}
                    placeholder={title || t('articleEditor.titlePlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('articleEditor.metaDescription')}</Label>
                  <Textarea
                    value={seo.description || ''}
                    onChange={(e) => setSeo({ ...seo, description: e.target.value })}
                    placeholder={t('articleEditor.metaDescriptionPlaceholder')}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>{t('articleEditor.ogImage')}</Label>
                  <Input
                    value={seo.ogImage || ''}
                    onChange={(e) => setSeo({ ...seo, ogImage: e.target.value })}
                    placeholder={coverImage || t('articleEditor.ogImagePlaceholder')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Editor Toolbar */}
          <div className="border rounded-lg mb-4">
            <div className="border-b bg-muted/50 p-2 flex flex-wrap gap-1">
              {/* Text formatting */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'bg-muted' : ''}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'bg-muted' : ''}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={editor.isActive('strike') ? 'bg-muted' : ''}
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={editor.isActive('code') ? 'bg-muted' : ''}
              >
                <Code className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-8" />

              {/* Headings */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
              >
                <Heading1 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
              >
                <Heading2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}
              >
                <Heading3 className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-8" />

              {/* Lists */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? 'bg-muted' : ''}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={editor.isActive('orderedList') ? 'bg-muted' : ''}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={editor.isActive('blockquote') ? 'bg-muted' : ''}
              >
                <Quote className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-8" />

              {/* Media & Links */}
              <Button variant="ghost" size="sm" onClick={addImage}>
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={setLink}>
                <LinkIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={insertTable}>
                <TableIcon className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-8" />

              {/* Undo/Redo */}
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

            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
};
