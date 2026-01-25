/**
 * PublicationSettings Component
 * Settings and configuration for a publication
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    toast.success(t('publishing.settingsSaved'));
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{t('publishing.settings')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {t('publishing.saveChanges')}
          </Button>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">{t('publishing.tabs.general')}</TabsTrigger>
            <TabsTrigger value="theme">{t('publishing.tabs.theme')}</TabsTrigger>
            <TabsTrigger value="content">{t('publishing.tabs.content')}</TabsTrigger>
            <TabsTrigger value="subscriptions">{t('publishing.tabs.subscriptions')}</TabsTrigger>
            <TabsTrigger value="social">{t('publishing.tabs.social')}</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>{t('publishing.general.title')}</CardTitle>
                <CardDescription>
                  {t('publishing.general.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="name">{t('publishing.general.name')}</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('publishing.general.namePlaceholder')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">{t('publishing.general.descriptionLabel')}</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('publishing.general.descriptionPlaceholder')}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="logo">{t('publishing.general.logoUrl')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="logo"
                        value={logo}
                        onChange={(e) => setLogo(e.target.value)}
                        placeholder={t('publishing.general.logoPlaceholder')}
                      />
                      {logo && (
                        <img
                          src={logo}
                          alt={t('publishing.general.logoPreview')}
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="coverImage">{t('publishing.general.coverImageUrl')}</Label>
                    <Input
                      id="coverImage"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder={t('publishing.general.coverImagePlaceholder')}
                    />
                    {coverImage && (
                      <img
                        src={coverImage}
                        alt={t('publishing.general.coverPreview')}
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
                  <CardTitle>{t('publishing.theme.title')}</CardTitle>
                </div>
                <CardDescription>
                  {t('publishing.theme.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="primaryColor">{t('publishing.theme.primaryColor')}</Label>
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
                    <Label htmlFor="fontFamily">{t('publishing.theme.fontFamily')}</Label>
                    <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as typeof fontFamily)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sans">{t('publishing.theme.fontSans')}</SelectItem>
                        <SelectItem value="serif">{t('publishing.theme.fontSerif')}</SelectItem>
                        <SelectItem value="mono">{t('publishing.theme.fontMono')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="layout">{t('publishing.theme.layout')}</Label>
                    <Select value={layout} onValueChange={(v) => setLayout(v as typeof layout)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">{t('publishing.theme.layoutDefault')}</SelectItem>
                        <SelectItem value="magazine">{t('publishing.theme.layoutMagazine')}</SelectItem>
                        <SelectItem value="minimal">{t('publishing.theme.layoutMinimal')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t('publishing.theme.darkMode')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('publishing.theme.darkModeDesc')}
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
                  <CardTitle>{t('publishing.content.title')}</CardTitle>
                </div>
                <CardDescription>
                  {t('publishing.content.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div>
                    <Label>{t('publishing.content.defaultVisibility')}</Label>
                    <Select
                      value={defaultVisibility}
                      onValueChange={(v) => setDefaultVisibility(v as ArticleVisibility)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">{t('publishing.content.visibilityPublic')}</SelectItem>
                        <SelectItem value="subscribers">{t('publishing.content.visibilitySubscribers')}</SelectItem>
                        <SelectItem value="paid">{t('publishing.content.visibilityPaid')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t('publishing.content.allowComments')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('publishing.content.allowCommentsDesc')}
                      </p>
                    </div>
                    <Switch checked={allowComments} onCheckedChange={setAllowComments} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t('publishing.content.enableRss')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('publishing.content.enableRssDesc')}
                      </p>
                    </div>
                    <Switch checked={enableRss} onCheckedChange={setEnableRss} />
                  </div>
                  {enableRss && (
                    <div className="flex items-center justify-between ml-6">
                      <div>
                        <Label>{t('publishing.content.fullRss')}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t('publishing.content.fullRssDesc')}
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
                  <CardTitle>{t('publishing.subscriptions.title')}</CardTitle>
                </div>
                <CardDescription>
                  {t('publishing.subscriptions.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t('publishing.subscriptions.emailNotifications')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('publishing.subscriptions.emailNotificationsDesc')}
                      </p>
                    </div>
                    <Switch
                      checked={enableEmailNotifications}
                      onCheckedChange={setEnableEmailNotifications}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t('publishing.subscriptions.paidSubscriptions')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('publishing.subscriptions.paidSubscriptionsDesc')}
                      </p>
                    </div>
                    <Switch
                      checked={enablePaidSubscriptions}
                      onCheckedChange={setEnablePaidSubscriptions}
                    />
                  </div>
                  {enablePaidSubscriptions && (
                    <div className="ml-6">
                      <Label htmlFor="price">{t('publishing.subscriptions.monthlyPrice')}</Label>
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
                        <span className="text-muted-foreground">{t('publishing.subscriptions.perMonth')}</span>
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
                  <CardTitle>{t('publishing.social.title')}</CardTitle>
                </div>
                <CardDescription>
                  {t('publishing.social.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="twitter">{t('publishing.social.twitter')}</Label>
                    <Input
                      id="twitter"
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value)}
                      placeholder={t('publishing.social.twitterPlaceholder')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nostr">{t('publishing.social.nostr')}</Label>
                    <Input
                      id="nostr"
                      value={nostr}
                      onChange={(e) => setNostr(e.target.value)}
                      placeholder={t('publishing.social.nostrPlaceholder')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">{t('publishing.social.website')}</Label>
                    <Input
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder={t('publishing.social.websitePlaceholder')}
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
