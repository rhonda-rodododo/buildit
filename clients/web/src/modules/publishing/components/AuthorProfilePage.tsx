/**
 * AuthorProfilePage Component
 * Author bio, article listing, social links, and RSS feed link
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePublishingStore } from '../publishingStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  FileText,
  Rss,
  ExternalLink,
  Copy,
  Key,
} from 'lucide-react';
import type { Article, Publication } from '../types';
import { format } from 'date-fns';
import { toast } from 'sonner';

const ARTICLES_PER_PAGE = 10;

interface AuthorProfile {
  pubkey: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  socialLinks?: {
    nostr?: string;
    twitter?: string;
    mastodon?: string;
    bluesky?: string;
    website?: string;
  };
}

interface AuthorProfilePageProps {
  publicationId: string;
  publication: Publication;
  authorPubkey: string;
  /** Optional author profile data (from profile events) */
  profile?: AuthorProfile;
  onArticleClick?: (article: Article) => void;
  onBack?: () => void;
  className?: string;
}

export const AuthorProfilePage: FC<AuthorProfilePageProps> = ({
  publicationId,
  publication,
  authorPubkey,
  profile,
  onArticleClick,
  onBack,
  className,
}) => {
  const { t } = useTranslation();
  const { getPublicationArticles } = usePublishingStore();
  const [page, setPage] = useState(1);

  // Get articles by this author
  const authorArticles = useMemo(() => {
    return getPublicationArticles(publicationId, 'published')
      .filter((article) => article.authorPubkey === authorPubkey);
  }, [publicationId, authorPubkey, getPublicationArticles]);

  // Pagination
  const totalPages = Math.ceil(authorArticles.length / ARTICLES_PER_PAGE);
  const paginatedArticles = authorArticles.slice(
    (page - 1) * ARTICLES_PER_PAGE,
    page * ARTICLES_PER_PAGE
  );

  // Author display info
  const displayName = profile?.displayName || authorArticles[0]?.authorName || t('authorProfile.anonymous');
  const avatar = profile?.avatar;
  const bio = profile?.bio;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Truncated pubkey for display
  const truncatedPubkey = `${authorPubkey.slice(0, 8)}...${authorPubkey.slice(-8)}`;

  // Author RSS feed URL
  const authorRssUrl = publication.settings.enableRss
    ? `/rss/${publication.slug}/author/${authorPubkey.slice(0, 16)}.xml`
    : null;

  // Tags used by this author
  const authorTags = useMemo(() => {
    const tagCounts = new Map<string, number>();
    for (const article of authorArticles) {
      for (const tag of article.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [authorArticles]);

  // Copy pubkey to clipboard
  const copyPubkey = () => {
    navigator.clipboard.writeText(authorPubkey).then(() => {
      toast.success(t('authorProfile.pubkeyCopied'));
    }).catch(() => {
      toast.error(t('authorProfile.copyFailed'));
    });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header / Back Button */}
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t('authorProfile.backToArticles')}
        </Button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Author Profile Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                {/* Avatar */}
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatar} alt={displayName} />
                  <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                </Avatar>

                {/* Name */}
                <div>
                  <h2 className="text-xl font-bold">{displayName}</h2>
                  <button
                    onClick={copyPubkey}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto mt-1"
                    title={t('authorProfile.copyPubkey')}
                  >
                    <Key className="h-3 w-3" />
                    {truncatedPubkey}
                    <Copy className="h-3 w-3" />
                  </button>
                </div>

                {/* Bio */}
                {bio && (
                  <p className="text-sm text-muted-foreground">{bio}</p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-bold text-lg">{authorArticles.length}</p>
                    <p className="text-muted-foreground text-xs">
                      {t('authorProfile.articles')}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Social Links */}
                {profile?.socialLinks && (
                  <div className="w-full space-y-2">
                    <h4 className="text-sm font-medium text-left">
                      {t('authorProfile.socialLinks')}
                    </h4>
                    <div className="space-y-1">
                      {profile.socialLinks.nostr && (
                        <SocialLink
                          label="Nostr"
                          value={profile.socialLinks.nostr}
                          icon={<Key className="h-4 w-4" />}
                        />
                      )}
                      {profile.socialLinks.twitter && (
                        <SocialLink
                          label="Twitter/X"
                          value={profile.socialLinks.twitter}
                          href={`https://twitter.com/${profile.socialLinks.twitter.replace('@', '')}`}
                          icon={<ExternalLink className="h-4 w-4" />}
                        />
                      )}
                      {profile.socialLinks.mastodon && (
                        <SocialLink
                          label="Mastodon"
                          value={profile.socialLinks.mastodon}
                          href={profile.socialLinks.mastodon}
                          icon={<ExternalLink className="h-4 w-4" />}
                        />
                      )}
                      {profile.socialLinks.bluesky && (
                        <SocialLink
                          label="Bluesky"
                          value={profile.socialLinks.bluesky}
                          href={`https://bsky.app/profile/${profile.socialLinks.bluesky}`}
                          icon={<ExternalLink className="h-4 w-4" />}
                        />
                      )}
                      {profile.socialLinks.website && (
                        <SocialLink
                          label="Website"
                          value={profile.socialLinks.website}
                          href={profile.socialLinks.website}
                          icon={<ExternalLink className="h-4 w-4" />}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* RSS Feed Link */}
                {authorRssUrl && (
                  <>
                    <Separator />
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <a href={authorRssUrl} target="_blank" rel="noopener noreferrer">
                        <Rss className="h-4 w-4 mr-2" />
                        {t('authorProfile.rssFeed')}
                      </a>
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Author Tags */}
          {authorTags.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium mb-3">
                  {t('authorProfile.topTopics')}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {authorTags.map(([tag, count]) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                      <span className="ml-1 opacity-70">({count})</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Articles by Author */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('authorProfile.articlesByAuthor', { name: displayName })}
            </h3>
          </div>

          {paginatedArticles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {t('authorProfile.noArticles')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t('authorProfile.noArticlesDescription')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedArticles.map((article) => (
                <Card
                  key={article.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onArticleClick?.(article)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Cover Image */}
                      {article.coverImage && (
                        <img
                          src={article.coverImage}
                          alt={article.title}
                          className="w-32 h-20 object-cover rounded-md flex-shrink-0"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg mb-1 line-clamp-1">
                          {article.title}
                        </h3>

                        {article.subtitle && (
                          <p className="text-sm text-muted-foreground mb-1 line-clamp-1 italic">
                            {article.subtitle}
                          </p>
                        )}

                        {article.excerpt && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {article.excerpt}
                          </p>
                        )}

                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(
                              article.publishedAt || article.createdAt,
                              'MMMM d, yyyy'
                            )}
                          </span>
                          {article.readingTimeMinutes && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {article.readingTimeMinutes} {t('authorProfile.minRead')}
                            </span>
                          )}
                          {article.tags.length > 0 && (
                            <div className="flex gap-1">
                              {article.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {t('authorProfile.page', { page, total: totalPages })}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        {t('authorProfile.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        {t('authorProfile.next')}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Social link row component
interface SocialLinkProps {
  label: string;
  value: string;
  href?: string;
  icon: React.ReactNode;
}

const SocialLink: FC<SocialLinkProps> = ({ label, value, href, icon }) => {
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
        className="flex items-center gap-2 text-sm hover:text-primary transition-colors p-1.5 rounded-md hover:bg-accent"
      >
        {icon}
        <span className="truncate">{value}</span>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm p-1.5" title={label}>
      {icon}
      <span className="truncate text-muted-foreground">{value}</span>
    </div>
  );
};
