/**
 * Publishing Store
 * State management for articles, publications, and subscriptions
 */

import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type {
  Article,
  ArticleDraft,
  Publication,
  Subscription,
  ArticleView,
  ArticleAnalytics,
  PublicationAnalytics,
  CreateArticleInput,
  UpdateArticleInput,
  CreatePublicationInput,
  UpdatePublicationInput,
  SubscribeInput,
  RSSFeed,
  RSSFeedItem,
  PublicationTheme,
  PublicationSettings,
} from './types';
import type { SEOMetadata } from '../public/types';
import { DEFAULT_INDEXABILITY } from '@/types/indexability';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 100);
}

/**
 * Calculate reading time in minutes (assuming 200 words per minute)
 */
function calculateReadingTime(content: string): number {
  const text = content.replace(/<[^>]*>/g, ''); // Strip HTML
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount / 200);
}

/**
 * Count words in content
 */
function countWords(content: string): number {
  const text = content.replace(/<[^>]*>/g, '');
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Generate excerpt from content
 */
function generateExcerpt(content: string, maxLength = 160): string {
  const text = content.replace(/<[^>]*>/g, '');
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
}

/**
 * Get default theme
 */
function getDefaultTheme(): PublicationTheme {
  return {
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af',
    accentColor: '#f59e0b',
    fontFamily: 'sans',
    layout: 'default',
    darkMode: true,
  };
}

/**
 * Get default settings
 */
function getDefaultSettings(): PublicationSettings {
  return {
    defaultVisibility: 'public',
    allowComments: true,
    requireSubscription: false,
    enableRss: true,
    rssFullContent: false,
    enableEmailNotifications: false,
    enablePaidSubscriptions: false,
  };
}

/**
 * Get default SEO
 */
function getDefaultSEO(): SEOMetadata {
  return {
    robots: 'index, follow',
  };
}

// ============================================================================
// Store State Interface
// ============================================================================

interface PublishingState {
  // Publications
  publications: Map<string, Publication>;
  currentPublicationId: string | null;

  // Articles
  articles: Map<string, Article>;
  articleDrafts: Map<string, ArticleDraft>;
  currentArticleId: string | null;

  // Subscriptions
  subscriptions: Map<string, Subscription>;

  // Article Views
  articleViews: Map<string, ArticleView[]>;

  // Analytics (computed)
  articleAnalytics: Map<string, ArticleAnalytics>;
  publicationAnalytics: Map<string, PublicationAnalytics>;

  // Loading state
  isLoading: boolean;
  error: string | null;
}

interface PublishingActions {
  // Publication CRUD
  createPublication: (input: CreatePublicationInput) => Publication;
  updatePublication: (id: string, updates: UpdatePublicationInput) => void;
  deletePublication: (id: string) => void;
  getPublication: (id: string) => Publication | undefined;
  getGroupPublications: (groupId: string) => Publication[];
  setCurrentPublication: (id: string | null) => void;

  // Article CRUD
  createArticle: (input: CreateArticleInput) => Article;
  updateArticle: (id: string, updates: UpdateArticleInput) => void;
  deleteArticle: (id: string) => void;
  getArticle: (id: string) => Article | undefined;
  getPublicationArticles: (publicationId: string, status?: string) => Article[];
  setCurrentArticle: (id: string | null) => void;

  // Article publishing
  publishArticle: (id: string) => void;
  unpublishArticle: (id: string) => void;
  scheduleArticle: (id: string, scheduledAt: number) => void;

  // Article drafts
  saveDraft: (draft: Partial<ArticleDraft> & { publicationId: string; groupId: string }) => ArticleDraft;
  getDraft: (id: string) => ArticleDraft | undefined;
  getArticleDraft: (articleId: string) => ArticleDraft | undefined;
  deleteDraft: (id: string) => void;

  // Subscriptions
  subscribe: (input: SubscribeInput) => Subscription;
  unsubscribe: (subscriptionId: string) => void;
  getSubscription: (publicationId: string, subscriberPubkey: string) => Subscription | undefined;
  getPublicationSubscriptions: (publicationId: string) => Subscription[];
  updateSubscriptionPreferences: (subscriptionId: string, preferences: Subscription['preferences']) => void;

  // Article Views
  recordView: (articleId: string, publicationId: string, sessionId: string, metadata?: Partial<ArticleView>) => void;
  getArticleViews: (articleId: string) => ArticleView[];

  // Analytics
  computeArticleAnalytics: (articleId: string) => ArticleAnalytics;
  computePublicationAnalytics: (publicationId: string) => PublicationAnalytics;

  // RSS Feed
  generateRSSFeed: (publicationId: string, baseUrl: string) => RSSFeed;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Bulk operations
  loadPublications: (publications: Publication[]) => void;
  loadArticles: (articles: Article[]) => void;
  loadSubscriptions: (subscriptions: Subscription[]) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const usePublishingStore = create<PublishingState & PublishingActions>((set, get) => ({
  // Initial State
  publications: new Map(),
  currentPublicationId: null,
  articles: new Map(),
  articleDrafts: new Map(),
  currentArticleId: null,
  subscriptions: new Map(),
  articleViews: new Map(),
  articleAnalytics: new Map(),
  publicationAnalytics: new Map(),
  isLoading: false,
  error: null,

  // ============================================================================
  // Publication CRUD
  // ============================================================================

  createPublication: (input) => {
    const now = Date.now();
    const publication: Publication = {
      id: uuid(),
      groupId: input.groupId,
      name: input.name,
      description: input.description,
      slug: input.slug || generateSlug(input.name),
      logo: input.logo,
      theme: { ...getDefaultTheme(), ...input.theme },
      navigation: [],
      settings: { ...getDefaultSettings(), ...input.settings },
      status: 'active',
      defaultSeo: getDefaultSEO(),
      ownerPubkey: '', // Will be set by caller with current user's pubkey
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      const publications = new Map(state.publications);
      publications.set(publication.id, publication);
      return { publications };
    });

    return publication;
  },

  updatePublication: (id, updates) =>
    set((state) => {
      const publications = new Map(state.publications);
      const publication = publications.get(id);
      if (publication) {
        const updated: Publication = {
          ...publication,
          ...updates,
          theme: updates.theme
            ? { ...publication.theme, ...updates.theme }
            : publication.theme,
          settings: updates.settings
            ? { ...publication.settings, ...updates.settings }
            : publication.settings,
          defaultSeo: updates.defaultSeo
            ? { ...publication.defaultSeo, ...updates.defaultSeo }
            : publication.defaultSeo,
          updatedAt: Date.now(),
        };
        publications.set(id, updated);
      }
      return { publications };
    }),

  deletePublication: (id) =>
    set((state) => {
      const publications = new Map(state.publications);
      publications.delete(id);

      // Also remove all articles for this publication
      const articles = new Map(state.articles);
      for (const [articleId, article] of articles) {
        if (article.publicationId === id) {
          articles.delete(articleId);
        }
      }

      return {
        publications,
        articles,
        currentPublicationId: state.currentPublicationId === id ? null : state.currentPublicationId,
      };
    }),

  getPublication: (id) => get().publications.get(id),

  getGroupPublications: (groupId) =>
    Array.from(get().publications.values())
      .filter((pub) => pub.groupId === groupId)
      .sort((a, b) => b.createdAt - a.createdAt),

  setCurrentPublication: (id) => set({ currentPublicationId: id }),

  // ============================================================================
  // Article CRUD
  // ============================================================================

  createArticle: (input) => {
    const now = Date.now();
    const article: Article = {
      id: uuid(),
      publicationId: input.publicationId,
      groupId: input.groupId,
      title: input.title,
      subtitle: input.subtitle,
      slug: generateSlug(input.title),
      content: input.content || '',
      excerpt: input.content ? generateExcerpt(input.content) : undefined,
      coverImage: input.coverImage,
      authorPubkey: '', // Will be set by caller
      tags: input.tags || [],
      status: 'draft',
      visibility: input.visibility || 'public',
      seo: { ...getDefaultSEO(), ...input.seo },
      indexability: { ...DEFAULT_INDEXABILITY, ...input.indexability },
      createdAt: now,
      updatedAt: now,
      readingTimeMinutes: input.content ? calculateReadingTime(input.content) : 0,
      wordCount: input.content ? countWords(input.content) : 0,
      version: 1,
      lastSavedAt: now,
    };

    set((state) => {
      const articles = new Map(state.articles);
      articles.set(article.id, article);
      return { articles };
    });

    return article;
  },

  updateArticle: (id, updates) =>
    set((state) => {
      const articles = new Map(state.articles);
      const article = articles.get(id);
      if (article) {
        const now = Date.now();
        const updated: Article = {
          ...article,
          ...updates,
          seo: updates.seo ? { ...article.seo, ...updates.seo } : article.seo,
          indexability: updates.indexability
            ? { ...article.indexability, ...updates.indexability }
            : article.indexability,
          updatedAt: now,
          lastSavedAt: now,
          version: article.version + 1,
        };

        // Recalculate slug if title changed
        if (updates.title && updates.title !== article.title) {
          updated.slug = generateSlug(updates.title);
        }

        // Recalculate reading time and word count if content changed
        if (updates.content !== undefined) {
          updated.readingTimeMinutes = calculateReadingTime(updates.content);
          updated.wordCount = countWords(updates.content);
          updated.excerpt = generateExcerpt(updates.content);
        }

        articles.set(id, updated);
      }
      return { articles };
    }),

  deleteArticle: (id) =>
    set((state) => {
      const articles = new Map(state.articles);
      articles.delete(id);
      return {
        articles,
        currentArticleId: state.currentArticleId === id ? null : state.currentArticleId,
      };
    }),

  getArticle: (id) => get().articles.get(id),

  getPublicationArticles: (publicationId, status) => {
    let articles = Array.from(get().articles.values())
      .filter((article) => article.publicationId === publicationId);

    if (status) {
      articles = articles.filter((article) => article.status === status);
    }

    return articles.sort((a, b) => {
      // Published articles sorted by publishedAt
      if (a.publishedAt && b.publishedAt) {
        return b.publishedAt - a.publishedAt;
      }
      // Otherwise by updatedAt
      return b.updatedAt - a.updatedAt;
    });
  },

  setCurrentArticle: (id) => set({ currentArticleId: id }),

  // ============================================================================
  // Article Publishing
  // ============================================================================

  publishArticle: (id) =>
    set((state) => {
      const articles = new Map(state.articles);
      const article = articles.get(id);
      if (article) {
        const now = Date.now();
        articles.set(id, {
          ...article,
          status: 'published',
          publishedAt: now,
          scheduledAt: undefined,
          updatedAt: now,
        });
      }
      return { articles };
    }),

  unpublishArticle: (id) =>
    set((state) => {
      const articles = new Map(state.articles);
      const article = articles.get(id);
      if (article) {
        articles.set(id, {
          ...article,
          status: 'draft',
          updatedAt: Date.now(),
        });
      }
      return { articles };
    }),

  scheduleArticle: (id, scheduledAt) =>
    set((state) => {
      const articles = new Map(state.articles);
      const article = articles.get(id);
      if (article) {
        articles.set(id, {
          ...article,
          status: 'scheduled',
          scheduledAt,
          updatedAt: Date.now(),
        });
      }
      return { articles };
    }),

  // ============================================================================
  // Article Drafts
  // ============================================================================

  saveDraft: (draftInput) => {
    const now = Date.now();
    const draft: ArticleDraft = {
      id: draftInput.id || uuid(),
      articleId: draftInput.articleId,
      publicationId: draftInput.publicationId,
      groupId: draftInput.groupId,
      title: draftInput.title || 'Untitled',
      subtitle: draftInput.subtitle,
      content: draftInput.content || '',
      coverImage: draftInput.coverImage,
      tags: draftInput.tags || [],
      savedAt: now,
      authorPubkey: draftInput.authorPubkey || '',
    };

    set((state) => {
      const articleDrafts = new Map(state.articleDrafts);
      articleDrafts.set(draft.id, draft);
      return { articleDrafts };
    });

    return draft;
  },

  getDraft: (id) => get().articleDrafts.get(id),

  getArticleDraft: (articleId) => {
    return Array.from(get().articleDrafts.values()).find(
      (draft) => draft.articleId === articleId
    );
  },

  deleteDraft: (id) =>
    set((state) => {
      const articleDrafts = new Map(state.articleDrafts);
      articleDrafts.delete(id);
      return { articleDrafts };
    }),

  // ============================================================================
  // Subscriptions
  // ============================================================================

  subscribe: (input) => {
    const subscription: Subscription = {
      id: uuid(),
      publicationId: input.publicationId,
      groupId: '', // Will be set based on publication
      subscriberPubkey: input.subscriberPubkey,
      subscriberEmail: input.subscriberEmail,
      tier: input.tier,
      status: 'active',
      subscribedAt: Date.now(),
      preferences: {
        emailNotifications: input.preferences?.emailNotifications ?? false,
        nostrNotifications: input.preferences?.nostrNotifications ?? true,
        digestFrequency: input.preferences?.digestFrequency ?? 'immediate',
      },
    };

    const publication = get().publications.get(input.publicationId);
    if (publication) {
      subscription.groupId = publication.groupId;
    }

    set((state) => {
      const subscriptions = new Map(state.subscriptions);
      subscriptions.set(subscription.id, subscription);
      return { subscriptions };
    });

    return subscription;
  },

  unsubscribe: (subscriptionId) =>
    set((state) => {
      const subscriptions = new Map(state.subscriptions);
      const subscription = subscriptions.get(subscriptionId);
      if (subscription) {
        subscriptions.set(subscriptionId, {
          ...subscription,
          status: 'cancelled',
          cancelledAt: Date.now(),
        });
      }
      return { subscriptions };
    }),

  getSubscription: (publicationId, subscriberPubkey) => {
    return Array.from(get().subscriptions.values()).find(
      (sub) =>
        sub.publicationId === publicationId &&
        sub.subscriberPubkey === subscriberPubkey &&
        sub.status === 'active'
    );
  },

  getPublicationSubscriptions: (publicationId) =>
    Array.from(get().subscriptions.values())
      .filter((sub) => sub.publicationId === publicationId)
      .sort((a, b) => b.subscribedAt - a.subscribedAt),

  updateSubscriptionPreferences: (subscriptionId, preferences) =>
    set((state) => {
      const subscriptions = new Map(state.subscriptions);
      const subscription = subscriptions.get(subscriptionId);
      if (subscription) {
        subscriptions.set(subscriptionId, {
          ...subscription,
          preferences,
        });
      }
      return { subscriptions };
    }),

  // ============================================================================
  // Article Views
  // ============================================================================

  recordView: (articleId, publicationId, sessionId, metadata) => {
    const view: ArticleView = {
      id: uuid(),
      articleId,
      publicationId,
      sessionId,
      viewedAt: Date.now(),
      ...metadata,
    };

    set((state) => {
      const articleViews = new Map(state.articleViews);
      const views = articleViews.get(articleId) || [];
      articleViews.set(articleId, [...views, view]);
      return { articleViews };
    });
  },

  getArticleViews: (articleId) => get().articleViews.get(articleId) || [],

  // ============================================================================
  // Analytics
  // ============================================================================

  computeArticleAnalytics: (articleId) => {
    const views = get().getArticleViews(articleId);
    const uniqueSessions = new Set(views.map((v) => v.sessionId)).size;

    // Compute referrers
    const referrerCounts: Record<string, number> = {};
    for (const view of views) {
      const ref = view.referrer || 'direct';
      referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
    }

    const topReferrers = Object.entries(referrerCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([referrer, count]) => ({ referrer, count }));

    // Compute views by day (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const viewsByDay: Record<string, number> = {};
    for (const view of views) {
      if (view.viewedAt >= thirtyDaysAgo) {
        const date = new Date(view.viewedAt).toISOString().split('T')[0];
        viewsByDay[date] = (viewsByDay[date] || 0) + 1;
      }
    }

    const analytics: ArticleAnalytics = {
      articleId,
      totalViews: views.length,
      uniqueViews: uniqueSessions,
      avgReadTimeSeconds: views.reduce((sum, v) => sum + (v.readTimeSeconds || 0), 0) / (views.length || 1),
      avgScrollDepthPercent: views.reduce((sum, v) => sum + (v.scrollDepthPercent || 0), 0) / (views.length || 1),
      topReferrers,
      viewsByDay: Object.entries(viewsByDay)
        .map(([date, viewCount]) => ({ date, views: viewCount }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      computedAt: Date.now(),
    };

    set((state) => {
      const articleAnalytics = new Map(state.articleAnalytics);
      articleAnalytics.set(articleId, analytics);
      return { articleAnalytics };
    });

    return analytics;
  },

  computePublicationAnalytics: (publicationId) => {
    const publication = get().publications.get(publicationId);
    if (!publication) {
      throw new Error('Publication not found');
    }

    const articles = get().getPublicationArticles(publicationId);
    const subscriptions = get().getPublicationSubscriptions(publicationId);

    // Compute total views
    let totalViews = 0;
    const topArticles: { articleId: string; title: string; views: number }[] = [];

    for (const article of articles) {
      const views = get().getArticleViews(article.id);
      totalViews += views.length;
      topArticles.push({
        articleId: article.id,
        title: article.title,
        views: views.length,
      });
    }

    topArticles.sort((a, b) => b.views - a.views);

    // Compute monthly stats
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const newSubscribersThisMonth = subscriptions.filter(
      (sub) => sub.subscribedAt >= thirtyDaysAgo
    ).length;

    let viewsThisMonth = 0;
    for (const article of articles) {
      const views = get().getArticleViews(article.id);
      viewsThisMonth += views.filter((v) => v.viewedAt >= thirtyDaysAgo).length;
    }

    const analytics: PublicationAnalytics = {
      publicationId,
      totalArticles: articles.length,
      publishedArticles: articles.filter((a) => a.status === 'published').length,
      totalViews,
      totalSubscribers: subscriptions.filter((s) => s.status === 'active').length,
      newSubscribersThisMonth,
      viewsThisMonth,
      topArticles: topArticles.slice(0, 10),
      freeSubscribers: subscriptions.filter((s) => s.status === 'active' && s.tier === 'free').length,
      paidSubscribers: subscriptions.filter((s) => s.status === 'active' && s.tier === 'paid').length,
      computedAt: Date.now(),
    };

    set((state) => {
      const publicationAnalytics = new Map(state.publicationAnalytics);
      publicationAnalytics.set(publicationId, analytics);
      return { publicationAnalytics };
    });

    return analytics;
  },

  // ============================================================================
  // RSS Feed
  // ============================================================================

  generateRSSFeed: (publicationId, baseUrl) => {
    const publication = get().publications.get(publicationId);
    if (!publication) {
      throw new Error('Publication not found');
    }

    const articles = get()
      .getPublicationArticles(publicationId, 'published')
      .slice(0, 50); // Latest 50 articles

    const items: RSSFeedItem[] = articles.map((article) => ({
      title: article.title,
      link: `${baseUrl}/p/${publication.slug}/${article.slug}`,
      pubDate: new Date(article.publishedAt || article.createdAt).toUTCString(),
      description: article.excerpt || generateExcerpt(article.content),
      content: publication.settings.rssFullContent ? article.content : undefined,
      author: article.authorName || article.authorPubkey,
      guid: article.id,
      categories: article.tags,
      enclosure: article.coverImage
        ? {
            url: article.coverImage,
            type: 'image/jpeg',
          }
        : undefined,
    }));

    const feed: RSSFeed = {
      title: publication.name,
      description: publication.description,
      link: `${baseUrl}/p/${publication.slug}`,
      language: 'en',
      lastBuildDate: new Date().toUTCString(),
      generator: 'BuildIt Network Publishing',
      items,
    };

    return feed;
  },

  // ============================================================================
  // State Management
  // ============================================================================

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  loadPublications: (publications) =>
    set((state) => {
      const newPublications = new Map(state.publications);
      for (const pub of publications) {
        newPublications.set(pub.id, pub);
      }
      return { publications: newPublications };
    }),

  loadArticles: (articles) =>
    set((state) => {
      const newArticles = new Map(state.articles);
      for (const article of articles) {
        newArticles.set(article.id, article);
      }
      return { articles: newArticles };
    }),

  loadSubscriptions: (subscriptions) =>
    set((state) => {
      const newSubscriptions = new Map(state.subscriptions);
      for (const sub of subscriptions) {
        newSubscriptions.set(sub.id, sub);
      }
      return { subscriptions: newSubscriptions };
    }),
}));
