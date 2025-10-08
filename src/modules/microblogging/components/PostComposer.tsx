/**
 * PostComposer Component
 * Rich text composer for creating posts with privacy controls
 */

import { FC, useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePostsStore } from '../postsStore';
import type { PostPrivacy, CreatePostInput } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Image,
  Video,
  MapPin,
  Calendar,
  FileText,
  Lock,
  Globe,
  Users,
  Shield,
  Smile,
  Hash,
  AtSign,
  Send,
  X,
} from 'lucide-react';
import { EmojiPicker } from '@/components/media/EmojiPicker';

interface PostComposerProps {
  placeholder?: string;
  onPostCreated?: () => void;
  className?: string;
}

export const PostComposer: FC<PostComposerProps> = ({
  placeholder = "What's on your mind? Share updates, organize actions, build solidarity...",
  onPostCreated,
  className,
}) => {
  const { currentIdentity } = useAuthStore();
  const { createPost } = usePostsStore();

  const [content, setContent] = useState('');
  const [privacy, setPrivacy] = useState<PostPrivacy>('group');
  const [isPosting, setIsPosting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!content.trim() || !currentIdentity) return;

    setIsPosting(true);

    try {
      // Extract hashtags
      const hashtags = (content.match(/#[\w]+/g) || []).map(tag => tag.slice(1));

      // Extract mentions
      const mentions = (content.match(/@[\w]+/g) || []).map(mention => mention.slice(1));

      const input: CreatePostInput = {
        content: content.trim(),
        contentType: 'text',
        visibility: {
          privacy,
        },
        hashtags,
        mentions,
      };

      await createPost(input);

      // Clear form
      setContent('');
      setPrivacy('group');
      onPostCreated?.();

      // Show success toast
      toast.success('Post created successfully');
    } catch (error) {
      console.error('Failed to create post:', error);
      toast.error('Failed to create post')
    } finally {
      setIsPosting(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + emoji + content.substring(end);

    setContent(newContent);

    // Set cursor position after emoji
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
    }, 0);

    setShowEmojiPicker(false);
  };

  const getPrivacyIcon = (privacyLevel: PostPrivacy) => {
    switch (privacyLevel) {
      case 'public':
        return <Globe className="w-4 h-4" />;
      case 'followers':
        return <Users className="w-4 h-4" />;
      case 'group':
        return <Lock className="w-4 h-4" />;
      case 'encrypted':
        return <Shield className="w-4 h-4" />;
    }
  };

  const getPrivacyLabel = (privacyLevel: PostPrivacy) => {
    switch (privacyLevel) {
      case 'public':
        return 'Public';
      case 'followers':
        return 'Followers';
      case 'group':
        return 'Group only';
      case 'encrypted':
        return 'Encrypted';
    }
  };

  const getPrivacyDescription = (privacyLevel: PostPrivacy) => {
    switch (privacyLevel) {
      case 'public':
        return 'Visible to anyone, shared on public relays';
      case 'followers':
        return 'Only people who follow you can see this';
      case 'group':
        return 'Only members of your groups can see this';
      case 'encrypted':
        return 'End-to-end encrypted, only specific people can decrypt';
    }
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        {/* Text Input */}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="min-h-[100px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
          disabled={isPosting}
        />

        {/* Character count and hashtag/mention indicators */}
        {content && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{content.length} characters</span>
            {(content.match(/#[\w]+/g) || []).length > 0 && (
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                {(content.match(/#[\w]+/g) || []).length} hashtag{(content.match(/#[\w]+/g) || []).length !== 1 ? 's' : ''}
              </span>
            )}
            {(content.match(/@[\w]+/g) || []).length > 0 && (
              <span className="flex items-center gap-1">
                <AtSign className="w-3 h-3" />
                {(content.match(/@[\w]+/g) || []).length} mention{(content.match(/@[\w]+/g) || []).length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          {/* Media and attachment buttons - TODO: Implement functionality */}
          <div className="flex items-center gap-1">
            {/* TODO: Implement image upload with Files module
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3"
              disabled={true}
              title="Add image (coming soon)"
            >
              <Image className="w-4 h-4" />
            </Button>
            */}
            {/* TODO: Implement video upload
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3"
              disabled={true}
              title="Add video (coming soon)"
            >
              <Video className="w-4 h-4" />
            </Button>
            */}
            {/* TODO: Implement location tagging
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3"
              disabled={true}
              title="Add location (coming soon)"
            >
              <MapPin className="w-4 h-4" />
            </Button>
            */}
            {/* TODO: Link to Events module
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3"
              disabled={true}
              title="Create event (coming soon)"
            >
              <Calendar className="w-4 h-4" />
            </Button>
            */}
            {/* TODO: Link to Documents module
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3"
              disabled={true}
              title="Attach document (coming soon)"
            >
              <FileText className="w-4 h-4" />
            </Button>
            */}

            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={isPosting}
                title="Add emoji"
              >
                <Smile className="w-4 h-4" />
              </Button>

              {showEmojiPicker && (
                <div className="absolute left-0 bottom-full mb-2 z-50">
                  <Card className="relative shadow-lg">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-background shadow-md z-10"
                      onClick={() => setShowEmojiPicker(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <EmojiPicker
                      onEmojiSelect={handleEmojiSelect}
                    />
                  </Card>
                </div>
              )}
            </div>
          </div>

          {/* Privacy selector and post button */}
          <div className="flex items-center gap-2">
            <Select
              value={privacy}
              onValueChange={(value) => setPrivacy(value as PostPrivacy)}
              disabled={isPosting}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <div className="flex items-center gap-2">
                  {getPrivacyIcon(privacy)}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="group">
                  <div className="flex items-center gap-2">
                    {getPrivacyIcon('group')}
                    <div>
                      <div className="font-medium">{getPrivacyLabel('group')}</div>
                      <div className="text-xs text-muted-foreground">
                        {getPrivacyDescription('group')}
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    {getPrivacyIcon('public')}
                    <div>
                      <div className="font-medium">{getPrivacyLabel('public')}</div>
                      <div className="text-xs text-muted-foreground">
                        {getPrivacyDescription('public')}
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="followers">
                  <div className="flex items-center gap-2">
                    {getPrivacyIcon('followers')}
                    <div>
                      <div className="font-medium">{getPrivacyLabel('followers')}</div>
                      <div className="text-xs text-muted-foreground">
                        {getPrivacyDescription('followers')}
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="encrypted">
                  <div className="flex items-center gap-2">
                    {getPrivacyIcon('encrypted')}
                    <div>
                      <div className="font-medium">{getPrivacyLabel('encrypted')}</div>
                      <div className="text-xs text-muted-foreground">
                        {getPrivacyDescription('encrypted')}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isPosting}
              size="sm"
              className="h-9"
            >
              {isPosting ? (
                'Posting...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Post
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
