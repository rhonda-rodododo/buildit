/**
 * ArticleView Component
 * Public view for published articles with SEO and sharing
 */

import { FC, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  Calendar,
  BookOpen,
  Twitter,
  Link as LinkIcon,
  ArrowLeft,
} from 'lucide-react';
import type { Article, Publication } from '../types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/lib/security/sanitize';

interface ArticleViewProps {
  article: Article;
  publication: Publication;
  onBack: () => void;
  onRecordView?: (sessionId: string) => void;
  className?: string;
}

export const ArticleView: FC<ArticleViewProps> = ({
  article,
  publication,
  onBack,
  onRecordView,
  className,
}) => {
  // Record view on mount
  useEffect(() => {
    if (onRecordView) {
      // Generate a simple session ID for analytics
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      onRecordView(sessionId);
    }
  }, [article.id, onRecordView]);

  // Share handlers
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/p/${publication.slug}/${article.slug}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const handleShareTwitter = () => {
    const url = `${window.location.origin}/p/${publication.slug}/${article.slug}`;
    const text = `${article.title} by ${publication.name}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank'
    );
  };

  // Get author initial for avatar
  const authorInitial = article.authorName?.[0]?.toUpperCase() || 'A';

  return (
    <div className={className}>
      {/* Navigation */}
      <div className="mb-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {publication.name}
        </Button>
      </div>

      {/* Article Header */}
      <article className="max-w-3xl mx-auto">
        {/* Cover Image */}
        {article.coverImage && (
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full h-64 md:h-96 object-cover rounded-lg mb-8"
          />
        )}

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {article.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          {article.title}
        </h1>

        {/* Subtitle */}
        {article.subtitle && (
          <p className="text-xl text-muted-foreground mb-6">
            {article.subtitle}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          {/* Author */}
          <div className="flex items-center gap-2">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{authorInitial}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{article.authorName || 'Anonymous'}</p>
              <p className="text-sm text-muted-foreground">{publication.name}</p>
            </div>
          </div>

          <Separator orientation="vertical" className="h-10" />

          {/* Date */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(article.publishedAt || article.createdAt, 'MMMM d, yyyy')}
            </span>
          </div>

          {/* Reading Time */}
          {article.readingTimeMinutes && (
            <>
              <span className="text-muted-foreground">·</span>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{article.readingTimeMinutes} min read</span>
              </div>
            </>
          )}
        </div>

        {/* Visibility Badge */}
        {article.visibility !== 'public' && (
          <div className="mb-8 p-4 bg-muted/50 rounded-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <span>
              {article.visibility === 'subscribers'
                ? 'This article is for subscribers only'
                : 'This article is for paid subscribers only'}
            </span>
          </div>
        )}

        {/* Article Content - Sanitized to prevent XSS */}
        <div
          className="prose prose-lg max-w-none dark:prose-invert mb-12"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
        />

        {/* Share Section */}
        <Separator className="my-8" />

        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold mb-1">Share this article</h3>
            <p className="text-sm text-muted-foreground">
              Help spread the word
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={handleShareTwitter}>
              <Twitter className="h-4 w-4 mr-2" />
              Twitter
            </Button>
          </div>
        </div>

        {/* Publication Info */}
        <Separator className="my-8" />

        <div className="p-6 bg-muted/30 rounded-lg">
          <div className="flex items-start gap-4">
            {publication.logo && (
              <img
                src={publication.logo}
                alt={publication.name}
                className="h-16 w-16 rounded-lg object-cover"
              />
            )}
            <div>
              <h3 className="font-semibold text-lg mb-1">{publication.name}</h3>
              <p className="text-muted-foreground mb-4">{publication.description}</p>
              <Button variant="default" size="sm">
                Subscribe
              </Button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};
