/**
 * Public Wiki Page
 * Public-facing wiki pages accessible without login
 */

import { FC, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
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
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<WikiPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Nostr public wiki integration deferred to Epic 53A - using demo data
    const loadPage = async () => {
      setIsLoading(true);

      // Demo wiki pages
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
        <PublicWikiHeader />
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
        <PublicWikiHeader />
        <div className="container mx-auto px-4 py-12 max-w-6xl text-center">
          <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The wiki page you're looking for doesn't exist or is not public.
          </p>
          <Button asChild>
            <Link to="/wiki">Browse Wiki</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <PublicWikiHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="md:col-span-3">
            <div className="mb-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/wiki">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Wiki
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
                    <span>Updated {format(page.updatedAt, 'MMM d, yyyy')}</span>
                  </div>

                  <span>Version {page.version}</span>
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
                    This page is maintained by the community
                  </div>
                  <Button variant="outline" asChild>
                    <Link to="/login">
                      Edit Page
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
                Popular Pages
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/wiki/security-best-practices"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Security Best Practices
                  </Link>
                </li>
                <li>
                  <Link
                    to="/wiki/power-mapping-guide"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Power Mapping Guide
                  </Link>
                </li>
                <li>
                  <Link
                    to="/wiki/consensus-decision-making"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Consensus Decision Making
                  </Link>
                </li>
              </ul>
            </Card>

            {/* Categories */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Categories</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/wiki/category/security" className="text-muted-foreground hover:text-foreground">
                    Security
                  </Link>
                </li>
                <li>
                  <Link to="/wiki/category/strategy" className="text-muted-foreground hover:text-foreground">
                    Strategy
                  </Link>
                </li>
                <li>
                  <Link to="/wiki/category/governance" className="text-muted-foreground hover:text-foreground">
                    Governance
                  </Link>
                </li>
                <li>
                  <Link to="/wiki/category/legal" className="text-muted-foreground hover:text-foreground">
                    Legal
                  </Link>
                </li>
              </ul>
            </Card>

            {/* Call to Action */}
            <Card className="p-4 bg-primary/5 border-primary/20">
              <h3 className="font-semibold mb-2">Join the Movement</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Get access to private organizing tools and connect with organizers.
              </p>
              <Button className="w-full" asChild>
                <Link to="/login">Sign Up</Link>
              </Button>
            </Card>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
};

// Public Wiki Header
const PublicWikiHeader: FC<{ searchQuery?: string; onSearchChange?: (q: string) => void }> = ({
  searchQuery,
  onSearchChange
}) => {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            <span>BuildIt Wiki</span>
          </Link>

          {onSearchChange && (
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search wiki..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/campaigns">Campaigns</Link>
            </Button>
            <Button asChild>
              <Link to="/login">Login</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

// Reuse footer from CampaignPage
const PublicFooter: FC = () => {
  return (
    <footer className="border-t bg-muted/30 mt-12">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold mb-3">BuildIt Network</h3>
            <p className="text-sm text-muted-foreground">
              Privacy-first organizing platform for activists, unions, and community groups.
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-3">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/wiki" className="text-muted-foreground hover:text-foreground">Knowledge Base</Link></li>
              <li><Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link></li>
              <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-3">Contact</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Built with privacy & security first</li>
              <li>Powered by Nostr protocol</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} BuildIt Network. Free and open source.</p>
        </div>
      </div>
    </footer>
  );
};
