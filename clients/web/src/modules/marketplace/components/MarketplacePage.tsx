/**
 * MarketplacePage Component
 * Main marketplace page with tab navigation and listing views
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  ShoppingBag,
  Users,
  ArrowRightLeft,
  Wrench,
} from 'lucide-react';
import { useMarketplaceStore } from '../marketplaceStore';
import { useListings } from '../hooks/useMarketplace';
import { useListingSearch } from '../hooks/useListingSearch';
import { ListingCard } from './ListingCard';
import { ListingDetailDialog } from './ListingDetailDialog';
import { CreateListingDialog } from './CreateListingDialog';
import { CoopDirectoryPage } from './CoopDirectoryPage';
import { CoopProfilePage } from './CoopProfilePage';
import { SkillExchangePage } from './SkillExchangePage';
import { ResourceLibraryPage } from './ResourceLibraryPage';
import type { Listing, CoopProfile, MarketplaceTab, ListingType } from '../types';

type DetailView =
  | { type: 'none' }
  | { type: 'listing-detail'; listing: Listing }
  | { type: 'coop-profile'; coop: CoopProfile };

export function MarketplacePage() {
  const { t } = useTranslation();
  const activeTab = useMarketplaceStore((s) => s.activeTab);
  const setActiveTab = useMarketplaceStore((s) => s.setActiveTab);
  const viewMode = useMarketplaceStore((s) => s.viewMode);
  const setViewMode = useMarketplaceStore((s) => s.setViewMode);

  const { createListing } = useListings();
  const {
    results,
    searchQuery,
    setSearchQuery,
    listingType,
    setListingType,
    sortBy,
    setSortBy,
    totalCount,
  } = useListingSearch();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>({ type: 'none' });

  const handleCreateListing = (data: Parameters<typeof createListing>[0]) => {
    createListing(data);
    setShowCreateDialog(false);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as MarketplaceTab);
    setDetailView({ type: 'none' });
  };

  // If viewing a co-op profile, show that
  if (detailView.type === 'coop-profile') {
    return (
      <div className="h-full p-4 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <CoopProfilePage
            coop={detailView.coop}
            onBack={() => setDetailView({ type: 'none' })}
            onSelectListing={(listing) =>
              setDetailView({ type: 'listing-detail', listing })
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('marketplace.title')}</h1>
            <p className="text-muted-foreground">{t('marketplace.description')}</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('marketplace.newListing')}
          </Button>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="listings" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">{t('marketplace.allCategories')}</span>
            </TabsTrigger>
            <TabsTrigger value="coops" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{t('marketplace.coops')}</span>
            </TabsTrigger>
            <TabsTrigger value="skills" className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('marketplace.skillExchange')}</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">{t('marketplace.resources')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Listings Tab */}
          <TabsContent value="listings" className="space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('marketplace.search')}
                  className="pl-9"
                />
              </div>
              <Select
                value={listingType ?? 'all'}
                onValueChange={(v) => setListingType(v === 'all' ? undefined : (v as ListingType))}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t('marketplace.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('marketplace.allCategories')}</SelectItem>
                  <SelectItem value="product">{t('marketplace.products')}</SelectItem>
                  <SelectItem value="service">{t('marketplace.services')}</SelectItem>
                  <SelectItem value="co-op">{t('marketplace.coops')}</SelectItem>
                  <SelectItem value="initiative">{t('marketplace.initiatives')}</SelectItem>
                  <SelectItem value="resource">{t('marketplace.resources')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t('marketplace.sortNewest')}</SelectItem>
                  <SelectItem value="price-low">{t('marketplace.sortPriceLow')}</SelectItem>
                  <SelectItem value="price-high">{t('marketplace.sortPriceHigh')}</SelectItem>
                  <SelectItem value="nearest">{t('marketplace.sortNearest')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Results count */}
            <p className="text-sm text-muted-foreground">
              {results.length} of {totalCount} {t('marketplace.listings', 'listings')}
            </p>

            {/* Listings Grid/List */}
            {results.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="max-w-md mx-auto space-y-4">
                  <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-semibold">{t('marketplace.noListings')}</h3>
                  <p className="text-muted-foreground">
                    {t('marketplace.noListingsDescription')}
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('marketplace.createListing')}
                  </Button>
                </div>
              </Card>
            ) : (
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    : 'space-y-3'
                }
              >
                {results.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onClick={(l) =>
                      setDetailView({ type: 'listing-detail', listing: l })
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Co-ops Tab */}
          <TabsContent value="coops">
            <CoopDirectoryPage
              onViewCoop={(coop) => setDetailView({ type: 'coop-profile', coop })}
              onCreateCoop={() => {
                // In a full implementation, this would open a co-op registration dialog
              }}
            />
          </TabsContent>

          {/* Skills Tab */}
          <TabsContent value="skills">
            <SkillExchangePage />
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources">
            <ResourceLibraryPage />
          </TabsContent>
        </Tabs>

        {/* Listing Detail Dialog */}
        <ListingDetailDialog
          listing={detailView.type === 'listing-detail' ? detailView.listing : null}
          open={detailView.type === 'listing-detail'}
          onOpenChange={(open) => {
            if (!open) setDetailView({ type: 'none' });
          }}
        />

        {/* Create Listing Dialog */}
        <CreateListingDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSave={handleCreateListing}
        />
      </div>
    </div>
  );
}
