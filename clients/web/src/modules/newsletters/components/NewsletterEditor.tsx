/**
 * NewsletterEditor Component
 * Rich text editor for composing newsletter issues
 */

import { FC, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNewslettersStore } from '../newslettersStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Save,
  Send,
  Clock,
  Eye,
  ArrowLeft,
  Calendar,
  Play,
} from 'lucide-react';
import type { NewsletterIssue, UpdateIssueInput, Newsletter, NewsletterSettings } from '../types';
import { toast } from 'sonner';
import { EmailDeliverySettings } from './EmailDeliverySettings';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { SecureEmbed, EmbedInputDialog } from '@/modules/documents/extensions/SecureEmbed';

interface NewsletterEditorProps {
  issue?: NewsletterIssue;
  newsletter: Newsletter;
  onSave: (updates: UpdateIssueInput) => void;
  onSend: () => void;
  onSchedule: (scheduledAt: number) => void;
  onPreview: () => void;
  onClose: () => void;
  onUpdateSettings?: (settings: Partial<NewsletterSettings>) => void;
  className?: string;
}

export const NewsletterEditor: FC<NewsletterEditorProps> = ({
  issue,
  newsletter,
  onSave,
  onSend,
  onSchedule,
  onPreview,
  onClose,
  onUpdateSettings,
  className,
}) => {
  const { t } = useTranslation();
  const { getActiveSubscribers } = useNewslettersStore();

  // Form state
  const [subject, setSubject] = useState(issue?.subject || '');
  const [previewText, setPreviewText] = useState(issue?.previewText || '');
  const [hasChanges, setHasChanges] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');

  // Subscriber count
  const activeSubscribers = getActiveSubscribers(newsletter.id);

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: t('newsletterEditor.compose.editorPlaceholder'),
      }),
      SecureEmbed,
    ],
    content: issue?.content || '',
    onUpdate: () => {
      setHasChanges(true);
    },
  });

  // Sync form state when issue changes
  useEffect(() => {
    if (issue) {
      setSubject(issue.subject);
      setPreviewText(issue.previewText || '');
      editor?.commands.setContent(issue.content);
    }
  }, [issue, editor]);

  // Auto-save
  const handleSave = useCallback(() => {
    const updates: UpdateIssueInput = {
      subject,
      previewText,
      content: editor?.getHTML() || '',
      contentFormat: 'html',
    };
    onSave(updates);
    setHasChanges(false);
    toast.success(t('newsletterEditor.toasts.draftSaved'));
  }, [subject, previewText, editor, onSave, t]);

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (!hasChanges) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasChanges, handleSave]);

  // Handle schedule
  const handleSchedule = () => {
    if (!scheduleDate) {
      toast.error(t('newsletterEditor.toasts.selectDate'));
      return;
    }

    const dateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    if (dateTime <= new Date()) {
      toast.error(t('newsletterEditor.toasts.futureDateRequired'));
      return;
    }

    onSchedule(dateTime.getTime());
    setShowScheduleDialog(false);
    toast.success(t('newsletterEditor.toasts.scheduled'));
  };

  // Handle send
  const handleSend = () => {
    if (!subject.trim()) {
      toast.error(t('newsletterEditor.toasts.enterSubject'));
      return;
    }

    if (!editor?.getText().trim()) {
      toast.error(t('newsletterEditor.toasts.addContent'));
      return;
    }

    if (activeSubscribers.length === 0) {
      toast.error(t('newsletterEditor.toasts.noSubscribers'));
      return;
    }

    // Save first
    handleSave();

    // Then send
    onSend();
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">
              {issue ? t('newsletterEditor.editIssue') : t('newsletterEditor.newIssue')}
            </h2>
            <p className="text-sm text-muted-foreground">{newsletter.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-sm text-muted-foreground">{t('newsletterEditor.unsavedChanges')}</span>
          )}
          <Button variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {t('newsletterEditor.saveDraft')}
          </Button>
          <Button variant="outline" onClick={onPreview}>
            <Eye className="h-4 w-4 mr-2" />
            {t('newsletterEditor.preview')}
          </Button>
          <Button variant="outline" onClick={() => setShowScheduleDialog(true)}>
            <Clock className="h-4 w-4 mr-2" />
            {t('newsletterEditor.schedule')}
          </Button>
          <Button onClick={handleSend} disabled={activeSubscribers.length === 0}>
            <Send className="h-4 w-4 mr-2" />
            {t('newsletterEditor.send', { count: activeSubscribers.length })}
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          <Tabs defaultValue="compose" className="space-y-6">
            <TabsList>
              <TabsTrigger value="compose">{t('newsletterEditor.tabs.compose')}</TabsTrigger>
              <TabsTrigger value="settings">{t('newsletterEditor.tabs.settings')}</TabsTrigger>
            </TabsList>

            <TabsContent value="compose" className="space-y-6">
              {/* Subject */}
              <div>
                <Label htmlFor="subject">{t('newsletterEditor.compose.subjectLine')}</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder={t('newsletterEditor.compose.subjectPlaceholder')}
                  className="text-lg"
                />
              </div>

              {/* Preview Text */}
              <div>
                <Label htmlFor="previewText">{t('newsletterEditor.compose.previewText')}</Label>
                <Input
                  id="previewText"
                  value={previewText}
                  onChange={(e) => {
                    setPreviewText(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder={t('newsletterEditor.compose.previewPlaceholder')}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {t('newsletterEditor.compose.previewHint')}
                </p>
              </div>

              {/* Editor */}
              <div>
                <Label>{t('newsletterEditor.compose.content')}</Label>
                <Card className="mt-2">
                  <CardContent className="p-4">
                    {/* Editor Toolbar */}
                    <div className="flex flex-wrap gap-1 border-b pb-2 mb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        className={editor?.isActive('bold') ? 'bg-muted' : ''}
                      >
                        B
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                        className={editor?.isActive('italic') ? 'bg-muted' : ''}
                      >
                        I
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          editor?.chain().focus().toggleHeading({ level: 2 }).run()
                        }
                        className={
                          editor?.isActive('heading', { level: 2 }) ? 'bg-muted' : ''
                        }
                      >
                        H2
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          editor?.chain().focus().toggleHeading({ level: 3 }).run()
                        }
                        className={
                          editor?.isActive('heading', { level: 3 }) ? 'bg-muted' : ''
                        }
                      >
                        H3
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          editor?.chain().focus().toggleBulletList().run()
                        }
                        className={editor?.isActive('bulletList') ? 'bg-muted' : ''}
                      >
                        •
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          editor?.chain().focus().toggleOrderedList().run()
                        }
                        className={editor?.isActive('orderedList') ? 'bg-muted' : ''}
                      >
                        1.
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          editor?.chain().focus().toggleBlockquote().run()
                        }
                        className={editor?.isActive('blockquote') ? 'bg-muted' : ''}
                      >
                        &ldquo;
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          editor?.chain().focus().setHorizontalRule().run()
                        }
                      >
                        —
                      </Button>
                      <EmbedInputDialog
                        onInsert={(url) => {
                          editor?.chain().focus().setSecureEmbed(url).run()
                        }}
                        trigger={
                          <Button variant="ghost" size="sm" title="Embed media">
                            <Play className="w-4 h-4" />
                          </Button>
                        }
                      />
                    </div>

                    {/* Editor Content */}
                    <EditorContent
                      editor={editor}
                      className="prose prose-lg max-w-none dark:prose-invert min-h-[400px] focus:outline-none"
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('newsletterEditor.settings.theme')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t('newsletterEditor.settings.headerImage')}</Label>
                    <Input
                      value={newsletter.headerImage || ''}
                      placeholder={t('newsletterEditor.settings.headerPlaceholder')}
                      disabled
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('newsletterEditor.settings.editInSettings')}
                    </p>
                  </div>
                  <div>
                    <Label>{t('newsletterEditor.settings.footerText')}</Label>
                    <Textarea
                      value={newsletter.footerText || ''}
                      placeholder={t('newsletterEditor.settings.footerPlaceholder')}
                      rows={2}
                      disabled
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('newsletterEditor.settings.editInSettings')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Email Delivery Settings (Epic 53B) */}
              {onUpdateSettings && (
                <EmailDeliverySettings
                  newsletter={newsletter}
                  onUpdate={onUpdateSettings}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('newsletterEditor.scheduleDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('newsletterEditor.scheduleDialog.description', {
                count: activeSubscribers.length,
                plural: activeSubscribers.length !== 1 ? 's' : ''
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="scheduleDate">{t('newsletterEditor.scheduleDialog.date')}</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="scheduleDate"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="scheduleTime">{t('newsletterEditor.scheduleDialog.time')}</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="scheduleTime"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              {t('newsletterEditor.cancel')}
            </Button>
            <Button onClick={handleSchedule}>
              <Clock className="h-4 w-4 mr-2" />
              {t('newsletterEditor.schedule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
