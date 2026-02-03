/**
 * CommentInput Component
 * Input for creating comments with @mention support and link previews
 */

import { FC, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePostsStore } from '../postsStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  useLinkPreviewFromText,
  LinkPreviewCard,
  LinkPreviewSkeleton,
} from '@/lib/linkPreview';

interface CommentInputProps {
  postId: string;
  parentCommentId?: string;
  onCommentAdded?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const CommentInput: FC<CommentInputProps> = ({
  postId,
  parentCommentId,
  onCommentAdded,
  onCancel,
  placeholder = 'Write a comment...',
  autoFocus = false,
}) => {
  const { currentIdentity } = useAuthStore();
  const { addComment } = usePostsStore();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Signal-style link preview generation
  const {
    loading: previewLoading,
    previews,
    removePreview,
    clearPreviews,
  } = useLinkPreviewFromText(content, {
    autoGenerate: true,
    debounceMs: 800,
    maxPreviews: 1,
  });

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addComment(postId, content.trim(), parentCommentId);
      setContent('');
      clearPreviews();
      onCommentAdded?.();
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error('Failed to add comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    // Cancel on Escape if parent comment
    if (e.key === 'Escape' && parentCommentId) {
      e.preventDefault();
      onCancel?.();
    }
  };

  if (!currentIdentity) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="resize-none min-h-[60px]"
          autoFocus={autoFocus}
          disabled={isSubmitting}
          aria-label={parentCommentId ? 'Write a reply' : 'Write a comment'}
        />
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            size="sm"
            className="h-[60px]"
            aria-label={parentCommentId ? 'Send reply' : 'Send comment'}
          >
            <Send className="w-4 h-4" />
          </Button>
          {parentCommentId && onCancel && (
            <Button
              onClick={onCancel}
              disabled={isSubmitting}
              size="sm"
              variant="outline"
              className="h-auto px-2 py-1 text-xs"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
      {/* Link Previews */}
      {(previews.length > 0 || previewLoading) && (
        <div className="space-y-2">
          {previewLoading && previews.length === 0 && (
            <LinkPreviewSkeleton compact />
          )}
          {previews.map((preview) => (
            <LinkPreviewCard
              key={preview.url}
              preview={preview}
              compact
              showRemove
              onRemove={() => removePreview(preview.url)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
