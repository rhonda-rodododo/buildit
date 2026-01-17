/**
 * NewsletterEditor Component
 * Rich text editor for composing newsletter issues
 */

import { FC, useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import type { NewsletterIssue, UpdateIssueInput, Newsletter } from '../types';
import { toast } from 'sonner';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

interface NewsletterEditorProps {
  issue?: NewsletterIssue;
  newsletter: Newsletter;
  onSave: (updates: UpdateIssueInput) => void;
  onSend: () => void;
  onSchedule: (scheduledAt: number) => void;
  onPreview: () => void;
  onClose: () => void;
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
  className,
}) => {
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
        placeholder: 'Start writing your newsletter...',
      }),
    ],
    content: issue?.content || '',
    onUpdate: () => {
      setHasChanges(true);
    },
  });

  // Sync form state when issue changes
  useEffect(() => {
    if (issue) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Form sync from prop
      setSubject(issue.subject);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Form sync from prop
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
    toast.success('Draft saved');
  }, [subject, previewText, editor, onSave]);

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
      toast.error('Please select a date');
      return;
    }

    const dateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    if (dateTime <= new Date()) {
      toast.error('Scheduled time must be in the future');
      return;
    }

    onSchedule(dateTime.getTime());
    setShowScheduleDialog(false);
    toast.success('Newsletter scheduled');
  };

  // Handle send
  const handleSend = () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    if (!editor?.getText().trim()) {
      toast.error('Please add some content');
      return;
    }

    if (activeSubscribers.length === 0) {
      toast.error('No active subscribers to send to');
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
              {issue ? 'Edit Issue' : 'New Issue'}
            </h2>
            <p className="text-sm text-muted-foreground">{newsletter.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-sm text-muted-foreground">Unsaved changes</span>
          )}
          <Button variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button variant="outline" onClick={onPreview}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" onClick={() => setShowScheduleDialog(true)}>
            <Clock className="h-4 w-4 mr-2" />
            Schedule
          </Button>
          <Button onClick={handleSend} disabled={activeSubscribers.length === 0}>
            <Send className="h-4 w-4 mr-2" />
            Send ({activeSubscribers.length})
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          <Tabs defaultValue="compose" className="space-y-6">
            <TabsList>
              <TabsTrigger value="compose">Compose</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="compose" className="space-y-6">
              {/* Subject */}
              <div>
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="Your newsletter subject..."
                  className="text-lg"
                />
              </div>

              {/* Preview Text */}
              <div>
                <Label htmlFor="previewText">Preview Text (Optional)</Label>
                <Input
                  id="previewText"
                  value={previewText}
                  onChange={(e) => {
                    setPreviewText(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="First line shown in previews..."
                />
                <p className="text-sm text-muted-foreground mt-1">
                  This appears in the notification preview
                </p>
              </div>

              {/* Editor */}
              <div>
                <Label>Content</Label>
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
                  <CardTitle>Newsletter Theme</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Header Image URL</Label>
                    <Input
                      value={newsletter.headerImage || ''}
                      placeholder="https://example.com/header.png"
                      disabled
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Edit in newsletter settings
                    </p>
                  </div>
                  <div>
                    <Label>Footer Text</Label>
                    <Textarea
                      value={newsletter.footerText || ''}
                      placeholder="Footer text..."
                      rows={2}
                      disabled
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Edit in newsletter settings
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Newsletter</DialogTitle>
            <DialogDescription>
              Choose when to send this newsletter to {activeSubscribers.length}{' '}
              subscriber{activeSubscribers.length !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="scheduleDate">Date</Label>
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
              <Label htmlFor="scheduleTime">Time</Label>
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
              Cancel
            </Button>
            <Button onClick={handleSchedule}>
              <Clock className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
