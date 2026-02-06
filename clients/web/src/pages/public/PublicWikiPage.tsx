/**
 * Public Wiki Page
 * Public-facing wiki pages accessible without login
 */

import { FC, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { PageMeta } from '@/components/PageMeta';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  Search,
  ArrowLeft,
  Tag,
  FolderOpen,
  Clock,
  ExternalLink
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface WikiPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  tags: string[];
  version: number;
  updatedAt: number;
  isPublic: boolean;
}

export const PublicWikiPage: FC = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<WikiPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadPage = async () => {
      setIsLoading(true);

      // Attempt to load wiki page from Nostr kind:30023 (NIP-23 long-form content)
      try {
        const { NostrClient } = await import('@/core/nostr/client');
        const client = new NostrClient([
          { url: 'wss://relay.damus.io', read: true, write: false },
          { url: 'wss://relay.primal.net', read: true, write: false },
          { url: 'wss://nos.lol', read: true, write: false },
        ]);

        // Query for kind 30023 wiki-tagged long-form content with matching slug
        const events = await client.query(
          [{
            kinds: [30023],
            '#d': [slug || ''],
            '#t': ['wiki'],
            limit: 1,
          }],
          8000
        );

        if (events.length > 0) {
          const event = events[0];
          const titleTag = event.tags.find(t => t[0] === 'title');
          const publishedTag = event.tags.find(t => t[0] === 'published_at');
          const tags = event.tags.filter(t => t[0] === 't').map(t => t[1]);
          const dTag = event.tags.find(t => t[0] === 'd')?.[1] || '';

          // Determine category from tags
          const categoryTag = event.tags.find(t => t[0] === 'category');
          const category = categoryTag?.[1] || tags[0] || 'general';

          const wikiPage: WikiPage = {
            id: event.id,
            title: titleTag?.[1] || 'Untitled',
            slug: dTag,
            content: event.content,
            category,
            tags,
            version: 1,
            updatedAt: publishedTag
              ? parseInt(publishedTag[1]) * 1000
              : event.created_at * 1000,
            isPublic: true,
          };

          client.close();
          setPage(wikiPage);
          setIsLoading(false);
          return;
        }

        client.close();
      } catch {
        // Nostr query failed, fall through to demo data
      }

      // Fallback: demo wiki pages when Nostr data is unavailable
      const demoPages: WikiPage[] = [
        {
          id: 'wiki-1',
          title: 'Security Best Practices',
          slug: 'security-best-practices',
          content: `# Security Culture for Activists

## Digital Security
- **Use encrypted messaging**: Signal, Wire, or similar E2EE apps
- **Enable 2FA** on all accounts
- **Use VPN** when organizing online
- **Avoid** SMS/Facebook Messenger for sensitive communications

## Operational Security
- **Need-to-know** information sharing
- **Secure meeting** locations
- **Counter-surveillance** awareness
- **Document security** - shred sensitive papers

## Legal Know Your Rights
- **Right to remain silent** - you don't have to answer questions
- **Right to legal representation** - ask for a lawyer immediately
- **Do not consent to searches** - make them get a warrant
- **Document everything** - film police interactions when safe

## Additional Resources
- [EFF Surveillance Self-Defense](https://ssd.eff.org/)
- [National Lawyers Guild Know Your Rights](https://www.nlg.org/)`,
          category: 'security',
          tags: ['security', 'opsec', 'digital-security', 'legal'],
          version: 3,
          updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
          isPublic: true
        },
        {
          id: 'wiki-2',
          title: 'Power Mapping Guide',
          slug: 'power-mapping-guide',
          content: `# How to Power Map

Power mapping helps identify targets, allies, and opponents in campaigns.

## Steps

### 1. Identify Decision-Makers
Who has the power to give you what you want? Don't settle for lower-level officials.

### 2. Map Relationships and Influence
- Who influences the decision-maker?
- What relationships exist?
- Who do they listen to?

### 3. Find Pressure Points
- What do they care about?
- What's their political vulnerability?
- Where can you apply leverage?

### 4. Build Coalition of Allies
- Who shares your interests?
- Who can you activate?
- What resources do allies bring?

### 5. Design Escalating Tactics
- Start with inside game (meetings, testimony)
- Escalate to outside game (rallies, direct action)
- Always have a next step

## Tools
- Relationship mapping software
- Public records research
- Media monitoring
- Constituent pressure tracking`,
          category: 'strategy',
          tags: ['organizing', 'strategy', 'power-mapping'],
          version: 1,
          updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
          isPublic: true
        },
        {
          id: 'wiki-3',
          title: 'Consensus Decision Making',
          slug: 'consensus-decision-making',
          content: `# Consensus Process

## Overview
Consensus is a decision-making process that seeks agreement from all participants rather than a simple majority vote.

## The Process

### 1. Proposal
Present the idea clearly and concisely. Make sure everyone understands what's being proposed.

### 2. Clarifying Questions
Allow time for questions to ensure everyone understands. These aren't debates, just clarification.

### 3. Discussion
Hear concerns, suggestions, and amendments. This is where the proposal gets refined.

### 4. Temperature Check
Gauge support levels:
- 👍 Strong support
- 👌 Can live with it
- 🤔 Have concerns
- ✋ Need more discussion
- ✊ Block (fundamental objection)

### 5. Call for Consensus
Facilitator asks: "Does anyone have any remaining concerns or blocks?"

### 6. Addressing Blocks
Blocks must be addressed. They represent fundamental objections based on group values or safety.

## Tips for Good Consensus
- **Focus on interests**, not positions
- **Seek creative solutions** that address everyone's needs
- **Don't rush** - consensus takes time
- **Allow standoff** - someone can step aside if they disagree but won't block
- **Document decisions** clearly

## Common Pitfalls
- ❌ Treating consensus like a veto system
- ❌ Allowing one person to dominate discussion
- ❌ Moving too fast
- ❌ Not addressing underlying conflicts`,
          category: 'governance',
          tags: ['consensus', 'governance', 'decision-making'],
          version: 2,
          updatedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
          isPublic: true
        }
      ];

      // Find page by slug or show first page
      const foundPage = demoPages.find(p => p.slug === slug) || demoPages[0];

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      setPage(foundPage);
      setIsLoading(false);
    };

    loadPage();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <PublicWikiHeader t={t} />
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-3">
              <Skeleton className="h-10 w-3/4 mb-4" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div>
              <Skeleton className="h-10 w-full mb-4" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <PublicWikiHeader t={t} />
        <div className="container mx-auto px-4 py-12 max-w-6xl text-center">
          <h1 className="text-3xl font-bold mb-4">{t('publicWiki.pageNotFound')}</h1>
          <p className="text-muted-foreground mb-6">
            {t('publicWiki.pageNotFoundDesc')}
          </p>
          <Button asChild>
            <Link to="/wiki">{t('publicWiki.browseWiki')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <PageMeta
        titleKey="common.wiki"
        title={page.title}
        descriptionKey="meta.wiki"
        path={`/wiki/${page.slug}`}
        keywords={page.tags}
      />
      <PublicWikiHeader t={t} searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="md:col-span-3">
            <div className="mb-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/wiki">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('publicWiki.backToWiki')}
                </Link>
              </Button>
            </div>

            <Card className="p-8">
              {/* Page Header */}
              <div className="mb-6 pb-6 border-b">
                <h1 className="text-3xl md:text-4xl font-bold mb-4">{page.title}</h1>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {page.category && (
                    <div className="flex items-center gap-1">
                      <FolderOpen className="w-4 h-4" />
                      <span className="capitalize">{page.category}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{t('publicWiki.updated', { date: format(page.updatedAt, 'MMM d, yyyy') })}</span>
                  </div>

                  <span>{t('publicWiki.version', { number: page.version })}</span>
                </div>

                {page.tags && page.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    {page.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Markdown Content */}
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                <ReactMarkdown>{page.content}</ReactMarkdown>
              </div>

              {/* Page Footer */}
              <div className="mt-8 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {t('publicWiki.maintainedByComm')}
                  </div>
                  <Button variant="outline" asChild>
                    <Link to="/login">
                      {t('publicWiki.editPage')}
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Popular Pages */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                {t('publicWiki.popularPages')}
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/wiki/security-best-practices"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {t('publicWikiPage.popularPages.securityBestPractices')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/wiki/power-mapping-guide"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {t('publicWikiPage.popularPages.powerMappingGuide')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/wiki/consensus-decision-making"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {t('publicWikiPage.popularPages.consensusDecisionMaking')}
                  </Link>
                </li>
              </ul>
            </Card>

            {/* Categories */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">{t('publicWiki.categories')}</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/wiki/category/security" className="text-muted-foreground hover:text-foreground">
                    {t('publicWikiPage.categories.security')}
                  </Link>
                </li>
                <li>
                  <Link to="/wiki/category/strategy" className="text-muted-foreground hover:text-foreground">
                    {t('publicWikiPage.categories.strategy')}
                  </Link>
                </li>
                <li>
                  <Link to="/wiki/category/governance" className="text-muted-foreground hover:text-foreground">
                    {t('publicWikiPage.categories.governance')}
                  </Link>
                </li>
                <li>
                  <Link to="/wiki/category/legal" className="text-muted-foreground hover:text-foreground">
                    {t('publicWikiPage.categories.legal')}
                  </Link>
                </li>
              </ul>
            </Card>

            {/* Call to Action */}
            <Card className="p-4 bg-primary/5 border-primary/20">
              <h3 className="font-semibold mb-2">{t('publicWiki.joinMovement')}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {t('publicWiki.joinMovementDesc')}
              </p>
              <Button className="w-full" asChild>
                <Link to="/login">{t('publicWiki.signUp')}</Link>
              </Button>
            </Card>
          </div>
        </div>
      </div>

      <PublicFooter t={t} />
    </div>
  );
};

// Public Wiki Header
const PublicWikiHeader: FC<{ t: (key: string) => string; searchQuery?: string; onSearchChange?: (q: string) => void }> = ({
  t,
  searchQuery,
  onSearchChange
}) => {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            <span>{t('publicWiki.builditWiki')}</span>
          </Link>

          {onSearchChange && (
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t('publicWiki.searchWiki')}
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/campaigns">{t('publicWiki.campaigns')}</Link>
            </Button>
            <Button asChild>
              <Link to="/login">{t('publicWiki.login')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

// Reuse footer from CampaignPage
const PublicFooter: FC<{ t: (key: string) => string }> = ({ t }) => {
  return (
    <footer className="border-t bg-muted/30 mt-12">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold mb-3">{t('publicWiki.builditNetwork')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('publicWiki.builditDesc')}
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-3">{t('publicWiki.resources')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/wiki" className="text-muted-foreground hover:text-foreground">{t('publicWiki.knowledgeBase')}</Link></li>
              <li><Link to="/about" className="text-muted-foreground hover:text-foreground">{t('publicWiki.about')}</Link></li>
              <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground">{t('publicWiki.privacyPolicy')}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-3">{t('publicWiki.contact')}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>{t('publicWiki.builtWithPrivacy')}</li>
              <li>{t('publicWiki.poweredByNostr')}</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {t('publicWiki.builditNetwork')}. {t('publicWiki.freeOpenSource')}</p>
        </div>
      </div>
    </footer>
  );
};
