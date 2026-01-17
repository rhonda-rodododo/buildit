/**
 * PublicationSettings Component
 * Settings and configuration for a publication
 */

import { FC, useState } from 'react';
import { usePublishingStore } from '../publishingStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Palette,
  Rss,
  CreditCard,
  Share2,
  Save,
} from 'lucide-react';
import type { Publication, UpdatePublicationInput, ArticleVisibility } from '../types';
import { toast } from 'sonner';

interface PublicationSettingsProps {
  publication: Publication;
  onClose: () => void;
  className?: string;
}

export const PublicationSettings: FC<PublicationSettingsProps> = ({
  publication,
  onClose,
  className,
}) => {
  const { updatePublication } = usePublishingStore();

  // Form state
  const [name, setName] = useState(publication.name);
  const [description, setDescription] = useState(publication.description);
  const [logo, setLogo] = useState(publication.logo || '');
  const [coverImage, setCoverImage] = useState(publication.coverImage || '');

  // Theme state
  const [primaryColor, setPrimaryColor] = useState(publication.theme.primaryColor);
  const [fontFamily, setFontFamily] = useState(publication.theme.fontFamily);
  const [layout, setLayout] = useState(publication.theme.layout);
  const [darkMode, setDarkMode] = useState(publication.theme.darkMode);

  // Settings state
  const [defaultVisibility, setDefaultVisibility] = useState<ArticleVisibility>(
    publication.settings.defaultVisibility
  );
  const [allowComments, setAllowComments] = useState(publication.settings.allowComments);
  const [enableRss, setEnableRss] = useState(publication.settings.enableRss);
  const [rssFullContent, setRssFullContent] = useState(publication.settings.rssFullContent);
  const [enableEmailNotifications, setEnableEmailNotifications] = useState(
    publication.settings.enableEmailNotifications
  );
  const [enablePaidSubscriptions, setEnablePaidSubscriptions] = useState(
    publication.settings.enablePaidSubscriptions
  );
  const [subscriptionPrice, setSubscriptionPrice] = useState(
    publication.settings.subscriptionPrice || 0
  );

  // Social links state
  const [twitter, setTwitter] = useState(publication.settings.socialLinks?.twitter || '');
  const [nostr, setNostr] = useState(publication.settings.socialLinks?.nostr || '');
  const [website, setWebsite] = useState(publication.settings.socialLinks?.website || '');

  const handleSave = () => {
    const updates: UpdatePublicationInput = {
      name,
      description,
      logo: logo || undefined,
      coverImage: coverImage || undefined,
      theme: {
        primaryColor,
        secondaryColor: publication.theme.secondaryColor,
        accentColor: publication.theme.accentColor,
        fontFamily,
        layout,
        darkMode,
      },
      settings: {
        defaultVisibility,
        allowComments,
        requireSubscription: publication.settings.requireSubscription,
        enableRss,
        rssFullContent,
        enableEmailNotifications,
        enablePaidSubscriptions,
        subscriptionPrice: enablePaidSubscriptions ? subscriptionPrice : undefined,
        socialLinks: {
          twitter: twitter || undefined,
          nostr: nostr || undefined,
          website: website || undefined,
        },
      },
    };

    updatePublication(publication.id, updates);
    toast.success('Settings saved');
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Publication Settings</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="theme">Theme</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Basic information about your publication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="name">Publication Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="My Publication"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What is your publication about?"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="logo">Logo URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="logo"
                        value={logo}
                        onChange={(e) => setLogo(e.target.value)}
                        placeholder="https://example.com/logo.png"
                      />
                      {logo && (
                        <img
                          src={logo}
                          alt="Logo preview"
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="coverImage">Cover Image URL</Label>
                    <Input
                      id="coverImage"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder="https://example.com/cover.jpg"
                    />
                    {coverImage && (
                      <img
                        src={coverImage}
                        alt="Cover preview"
                        className="mt-2 h-32 w-full rounded-lg object-cover"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Theme Settings */}
          <TabsContent value="theme">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  <CardTitle>Theme & Appearance</CardTitle>
                </div>
                <CardDescription>
                  Customize how your publication looks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        placeholder="#3b82f6"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="fontFamily">Font Family</Label>
                    <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as typeof fontFamily)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sans">Sans-serif (Modern)</SelectItem>
                        <SelectItem value="serif">Serif (Classic)</SelectItem>
                        <SelectItem value="mono">Monospace (Technical)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="layout">Layout Style</Label>
                    <Select value={layout} onValueChange={(v) => setLayout(v as typeof layout)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="magazine">Magazine</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable dark mode for your publication
                      </p>
                    </div>
                    <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Settings */}
          <TabsContent value="content">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Rss className="h-5 w-5" />
                  <CardTitle>Content Settings</CardTitle>
                </div>
                <CardDescription>
                  Control how content is published and displayed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div>
                    <Label>Default Article Visibility</Label>
                    <Select
                      value={defaultVisibility}
                      onValueChange={(v) => setDefaultVisibility(v as ArticleVisibility)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="subscribers">Subscribers Only</SelectItem>
                        <SelectItem value="paid">Paid Subscribers Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Comments</Label>
                      <p className="text-sm text-muted-foreground">
                        Let readers comment on articles
                      </p>
                    </div>
                    <Switch checked={allowComments} onCheckedChange={setAllowComments} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable RSS Feed</Label>
                      <p className="text-sm text-muted-foreground">
                        Generate RSS feed for your publication
                      </p>
                    </div>
                    <Switch checked={enableRss} onCheckedChange={setEnableRss} />
                  </div>
                  {enableRss && (
                    <div className="flex items-center justify-between ml-6">
                      <div>
                        <Label>Full Content in RSS</Label>
                        <p className="text-sm text-muted-foreground">
                          Include full article content in RSS (vs excerpt only)
                        </p>
                      </div>
                      <Switch checked={rssFullContent} onCheckedChange={setRssFullContent} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Settings */}
          <TabsContent value="subscriptions">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  <CardTitle>Subscription Settings</CardTitle>
                </div>
                <CardDescription>
                  Configure subscriber features and monetization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Send email notifications to subscribers (requires email setup)
                      </p>
                    </div>
                    <Switch
                      checked={enableEmailNotifications}
                      onCheckedChange={setEnableEmailNotifications}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Paid Subscriptions</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable paid subscription tier for premium content
                      </p>
                    </div>
                    <Switch
                      checked={enablePaidSubscriptions}
                      onCheckedChange={setEnablePaidSubscriptions}
                    />
                  </div>
                  {enablePaidSubscriptions && (
                    <div className="ml-6">
                      <Label htmlFor="price">Monthly Price (USD)</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          id="price"
                          type="number"
                          min="1"
                          value={subscriptionPrice / 100}
                          onChange={(e) => setSubscriptionPrice(Math.round(parseFloat(e.target.value) * 100))}
                          className="w-24"
                        />
                        <span className="text-muted-foreground">/ month</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Social Links */}
          <TabsContent value="social">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  <CardTitle>Social Links</CardTitle>
                </div>
                <CardDescription>
                  Add social media links to your publication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="twitter">Twitter / X</Label>
                    <Input
                      id="twitter"
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value)}
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nostr">Nostr</Label>
                    <Input
                      id="nostr"
                      value={nostr}
                      onChange={(e) => setNostr(e.target.value)}
                      placeholder="npub..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
