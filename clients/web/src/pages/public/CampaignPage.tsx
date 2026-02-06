/**
 * Public Campaign Page
 * Landing page for campaigns - accessible without login
 */

import { FC, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { PageMeta } from '@/components/PageMeta';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  MapPin,
  Users,
  Globe,
  ArrowRight,
  BookOpen,
  Mail,
  Share2
} from 'lucide-react';

interface CampaignData {
  id: string;
  name: string;
  slug: string;
  description: string;
  mission: string;
  demands: string[];
  upcomingEvents: Array<{
    id: string;
    title: string;
    description: string;
    startTime: number;
    location?: string;
  }>;
  recentUpdates: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: number;
  }>;
  memberCount?: number;
  isPublic: boolean;
}

export const CampaignPage: FC = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCampaign = async () => {
      setIsLoading(true);

      try {
        // Attempt to load campaign data from Nostr public events
        const { NostrClient } = await import('@/core/nostr/client');
        const client = new NostrClient([
          { _v: '1.0.0', url: 'wss://relay.damus.io', read: true, write: false },
          { _v: '1.0.0', url: 'wss://relay.primal.net', read: true, write: false },
          { _v: '1.0.0', url: 'wss://nos.lol', read: true, write: false },
        ]);

        // Query for kind 30023 (long-form content) tagged with the campaign slug
        // This is NIP-23 long-form content, used for campaign pages
        const events = await client.query(
          [{
            kinds: [30023],
            '#d': [slug || ''],
            '#t': ['campaign'],
            limit: 1,
          }],
          8000
        );

        if (events.length > 0) {
          const event = events[0];
          try {
            const content = JSON.parse(event.content);

            // Also query for associated public events (calendar events for this campaign)
            const oneMonthFromNow = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
            const calendarEvents = await client.query(
              [{
                kinds: [31922, 31923], // NIP-52 calendar events
                '#t': [slug || ''],
                until: oneMonthFromNow,
                limit: 5,
              }],
              5000
            );

            const upcomingEvents = calendarEvents.map((ce) => {
              try {
                const ceContent = JSON.parse(ce.content);
                const startTag = ce.tags.find(t => t[0] === 'start');
                const locationTag = ce.tags.find(t => t[0] === 'location');
                return {
                  id: ce.id,
                  title: ceContent.title || ce.tags.find(t => t[0] === 'title')?.[1] || 'Untitled Event',
                  description: ceContent.description || '',
                  startTime: startTag ? parseInt(startTag[1]) * 1000 : Date.now(),
                  location: locationTag?.[1],
                };
              } catch {
                return null;
              }
            }).filter((e): e is NonNullable<typeof e> => e !== null);

            // Query for recent kind 1 text notes tagged with the campaign
            const recentNotes = await client.query(
              [{
                kinds: [1],
                '#t': [slug || ''],
                limit: 5,
              }],
              5000
            );

            const recentUpdates = recentNotes.map((note) => ({
              id: note.id,
              title: note.content.substring(0, 60) + (note.content.length > 60 ? '...' : ''),
              content: note.content,
              createdAt: note.created_at * 1000,
            }));

            const campaignData: CampaignData = {
              id: event.id,
              name: content.name || content.title || 'Campaign',
              slug: slug || '',
              description: content.description || '',
              mission: content.mission || content.summary || '',
              demands: Array.isArray(content.demands) ? content.demands : [],
              upcomingEvents: upcomingEvents.length > 0 ? upcomingEvents : [],
              recentUpdates: recentUpdates.length > 0 ? recentUpdates : [],
              memberCount: content.memberCount,
              isPublic: true,
            };

            client.close();
            setCampaign(campaignData);
            setIsLoading(false);
            return;
          } catch {
            // JSON parsing failed, fall through to demo data
          }
        }

        client.close();
      } catch {
        // Nostr query failed, fall through to demo data
      }

      // Fallback: demo campaign data when Nostr data is unavailable
      const demoData: CampaignData = {
        id: 'campaign-1',
        name: 'Climate Justice Now',
        slug: slug || 'climate-justice',
        description: 'Fighting for climate action and environmental justice in our community',
        mission: 'We believe that climate change is the defining challenge of our time, and we demand immediate action from our elected officials. Our mission is to build power through grassroots organizing, direct action, and community education to win transformative climate policies that center justice and equity.',
        demands: [
          'Net-zero emissions by 2030',
          'Green jobs program for displaced workers',
          'Stop all new fossil fuel infrastructure',
          'Environmental justice for frontline communities',
          'Climate curriculum in all schools'
        ],
        upcomingEvents: [
          {
            id: 'event-1',
            title: 'Climate Justice Rally',
            description: 'Join us for a peaceful rally demanding climate action now! Bring signs, friends, and your voice.',
            startTime: Date.now() + 3 * 24 * 60 * 60 * 1000,
            location: 'City Hall Plaza'
          },
          {
            id: 'event-2',
            title: 'Community Organizing Workshop',
            description: 'Learn the fundamentals of grassroots organizing and power mapping.',
            startTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
            location: 'Community Center'
          }
        ],
        recentUpdates: [
          {
            id: 'update-1',
            title: 'Victory! City Council votes for renewable energy',
            content: 'After months of organizing, rallies, and public testimony, the City Council voted 7-2 to transition all municipal buildings to 100% renewable energy by 2025. This is a huge win for our campaign and shows what we can accomplish when we organize together!',
            createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000
          },
          {
            id: 'update-2',
            title: 'Next Rally: Climate Justice Now',
            content: 'Join us this Saturday at City Hall Plaza for our biggest rally yet. We need everyone to show up and demand real climate action. Bring your friends, family, and neighbors!',
            createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000
          }
        ],
        memberCount: 342,
        isPublic: true
      };

      setCampaign(demoData);
      setIsLoading(false);
    };

    loadCampaign();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <PublicHeader t={t} />
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <div className="space-y-8">
            <div className="space-y-4">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <PublicHeader t={t} />
        <div className="container mx-auto px-4 py-12 max-w-5xl text-center">
          <h1 className="text-3xl font-bold mb-4">{t('publicCampaign.campaignNotFound')}</h1>
          <p className="text-muted-foreground mb-6">
            {t('publicCampaign.campaignNotFoundDesc')}
          </p>
          <Button asChild>
            <Link to="/">{t('publicCampaign.goHome')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <PageMeta
        titleKey="common.campaigns"
        title={campaign.name}
        description={campaign.description}
        path={`/campaigns/${campaign.slug}`}
      />
      <PublicHeader t={t} />

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
        <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex-1">
              <h1 className="text-3xl md:text-5xl font-bold mb-4">
                {campaign.name}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-6">
                {campaign.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button size="lg" asChild>
              <Link to="/login">{t('publicCampaign.joinCampaign')}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#contact">{t('publicCampaign.contactUs')}</a>
            </Button>
            <Button size="lg" variant="ghost">
              <Share2 className="w-4 h-4 mr-2" />
              {t('publicCampaign.share')}
            </Button>
          </div>

          {campaign.memberCount && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{t('publicCampaign.members', { count: campaign.memberCount })}</span>
            </div>
          )}
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">
            {/* Mission */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">{t('publicCampaign.ourMission')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {campaign.mission}
              </p>
            </Card>

            {/* Demands */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">{t('publicCampaign.ourDemands')}</h2>
              <ul className="space-y-3">
                {campaign.demands.map((demand, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <ArrowRight className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{demand}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Recent Updates */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">{t('publicCampaign.recentUpdates')}</h2>
              {campaign.recentUpdates.map((update) => (
                <Card key={update.id} className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="text-lg font-semibold flex-1">{update.title}</h3>
                    <time className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(update.createdAt, 'MMM d, yyyy')}
                    </time>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {update.content}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Upcoming Events */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {t('publicCampaign.upcomingEvents')}
              </h3>
              <div className="space-y-4">
                {campaign.upcomingEvents.map((event) => (
                  <div key={event.id} className="border-b pb-4 last:border-0 last:pb-0">
                    <h4 className="font-medium mb-2">{event.title}</h4>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>{format(event.startTime, 'MMM d, h:mm a')}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          <span>{event.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Links */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">{t('publicCampaign.learnMore')}</h3>
              <div className="space-y-2">
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link to={`/campaigns/${campaign.slug}/wiki`}>
                    <BookOpen className="w-4 h-4 mr-2" />
                    {t('publicCampaign.knowledgeBase')}
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link to={`/campaigns/${campaign.slug}/about`}>
                    <Globe className="w-4 h-4 mr-2" />
                    {t('publicCampaign.aboutUs')}
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <a href="#contact">
                    <Mail className="w-4 h-4 mr-2" />
                    {t('publicCampaign.contact')}
                  </a>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Contact Form Section */}
      <section id="contact" className="bg-muted/50 border-t">
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">{t('publicCampaign.getInTouch')}</h2>
            <p className="text-muted-foreground">
              {t('publicCampaign.getInTouchDesc')}
            </p>
          </div>
          <div className="max-w-xl mx-auto">
            <Card className="p-6">
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('publicCampaign.name')}</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder={t('publicCampaign.yourName')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('publicCampaign.email')}</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder={t('publicCampaign.emailPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('publicCampaign.message')}</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    rows={4}
                    placeholder={t('publicCampaign.messagePlaceholder')}
                  />
                </div>
                <Button type="submit" className="w-full">
                  {t('publicCampaign.sendMessage')}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </section>

      <PublicFooter t={t} />
    </div>
  );
};

// Public Header Component
const PublicHeader: FC<{ t: (key: string) => string }> = ({ t }) => {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold">
          {t('publicWiki.builditNetwork')}
        </Link>
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link to="/campaigns">{t('publicWiki.campaigns')}</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/wiki">{t('publicCampaign.wiki')}</Link>
          </Button>
          <Button asChild>
            <Link to="/login">{t('publicWiki.login')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

// Public Footer Component
const PublicFooter: FC<{ t: (key: string) => string }> = ({ t }) => {
  return (
    <footer className="border-t bg-muted/30 mt-12">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
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
