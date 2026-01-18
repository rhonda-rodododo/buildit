/**
 * Fundraising Page Component
 * Main page for managing fundraising campaigns
 */

import { useState } from 'react';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, MoreVertical, Edit, Eye, Trash2, Copy, BarChart, Users } from 'lucide-react';
import { CampaignBuilder } from './CampaignBuilder/CampaignBuilder';
import { PublicCampaignView } from './PublicCampaignView/PublicCampaignView';
import { TemplateGallery } from './CampaignTemplates/TemplateGallery';
import { DonorsList } from './DonorManagement/DonorsList';
import { AnalyticsDashboard } from '@/modules/public/components/Analytics/AnalyticsDashboard';
import { useFundraisingStore } from '../fundraisingStore';
import { useGroupContext } from '@/contexts/GroupContext';
import { useAuthStore } from '@/stores/authStore';
import type { Campaign, DonationTier } from '../types';

type ViewMode = 'list' | 'builder' | 'preview' | 'donors' | 'analytics' | 'templates';

export function FundraisingPage() {
  const { groupId } = useGroupContext();
  const currentIdentity = useAuthStore((state) => state.currentIdentity);
  const campaigns = useFundraisingStore((state) => state.getCampaignsByGroup(groupId));
  const addCampaign = useFundraisingStore((state) => state.addCampaign);
  const updateCampaign = useFundraisingStore((state) => state.updateCampaign);
  const deleteCampaign = useFundraisingStore((state) => state.deleteCampaign);
  const getDonationProgress = useFundraisingStore((state) => state.getDonationProgress);
  const getDonationTiers = useFundraisingStore((state) => state.getDonationTiers);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);

  const handleCreateCampaign = () => {
    setSelectedCampaign(null);
    setViewMode('builder');
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setViewMode('builder');
  };

  const handlePreviewCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setViewMode('preview');
  };

  const handleViewDonors = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setViewMode('donors');
  };

  const handleViewAnalytics = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setViewMode('analytics');
  };

  const handleSaveCampaign = (campaignData: {
    title: string;
    slug: string;
    description: string;
    category: Campaign['category'];
    goal: number;
    currency: string;
    tiers: Omit<DonationTier, 'id' | 'campaignId' | 'currentCount'>[];
  }) => {
    if (selectedCampaign) {
      // Update existing campaign (tiers are managed separately in the store)
      updateCampaign(selectedCampaign.id, {
        title: campaignData.title,
        slug: campaignData.slug,
        description: campaignData.description,
        category: campaignData.category,
        goal: campaignData.goal,
        currency: campaignData.currency,
        updated: Date.now(),
      });
    } else {
      // Create new campaign
      const newCampaign: Campaign = {
        id: nanoid(),
        groupId,
        title: campaignData.title,
        slug: campaignData.slug,
        description: campaignData.description,
        category: campaignData.category,
        goal: campaignData.goal,
        currentAmount: 0,
        currency: campaignData.currency,
        allowCustomAmount: true,
        allowRecurring: false,
        status: 'draft',
        created: Date.now(),
        createdBy: currentIdentity?.publicKey || '',
        updated: Date.now(),
        updateCount: 0,
        settings: {
          showDonorWall: true,
          allowAnonymousDonors: true,
          showDonorNames: true,
          showDonorAmounts: false,
          showDonorMessages: true,
          sendThankYouEmail: false,
          sendTaxReceipt: false,
          continueAfterGoal: true,
          notifyOnDonation: false,
          enabledProcessors: ['stripe'],
        },
      };
      addCampaign(newCampaign);
    }
    setViewMode('list');
  };

  const handlePublishToggle = (campaign: Campaign) => {
    updateCampaign(campaign.id, {
      status: campaign.status === 'active' ? 'draft' : 'active',
      publishedAt: campaign.status === 'draft' ? Date.now() : campaign.publishedAt,
      updated: Date.now(),
    });
  };

  const handleDelete = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (campaignToDelete) {
      deleteCampaign(campaignToDelete.id);
      setCampaignToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleCopyLink = (campaign: Campaign) => {
    const url = `${window.location.origin}/campaigns/${campaign.slug}`;
    navigator.clipboard.writeText(url);
    // TODO: Show toast notification
  };

  const formatCurrency = (cents: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  // Builder/Preview/Donors/Analytics views
  if (viewMode === 'builder') {
    return (
      <CampaignBuilder
        campaign={selectedCampaign || undefined}
        onSave={handleSaveCampaign}
        onCancel={() => setViewMode('list')}
      />
    );
  }

  if (viewMode === 'preview' && selectedCampaign) {
    const campaignTiers = getDonationTiers(selectedCampaign.id);

    const handleDonate = (_tierId?: string) => {
      // TODO: Implement donation flow with Bitcoin/Lightning
    };

    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Button variant="outline" onClick={() => setViewMode('list')}>
            ← Back to Campaigns
          </Button>
        </div>
        <PublicCampaignView
          campaign={selectedCampaign}
          tiers={campaignTiers}
          onDonate={handleDonate}
        />
      </div>
    );
  }

  if (viewMode === 'donors' && selectedCampaign) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Button variant="outline" onClick={() => setViewMode('list')}>
            ← Back to Campaigns
          </Button>
        </div>
        <DonorsList campaign={selectedCampaign} />
      </div>
    );
  }

  if (viewMode === 'analytics' && selectedCampaign) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Button variant="outline" onClick={() => setViewMode('list')}>
            ← Back to Campaigns
          </Button>
        </div>
        <AnalyticsDashboard resourceType="campaign" resourceId={selectedCampaign.id} />
      </div>
    );
  }

  if (viewMode === 'templates') {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Button variant="outline" onClick={() => setViewMode('list')}>
            ← Back to Campaigns
          </Button>
        </div>
        <TemplateGallery
          onSelectTemplate={(template) => {
            // Create campaign from template
            const newCampaign: Campaign = {
              id: nanoid(),
              groupId,
              title: template.title,
              slug: template.title.toLowerCase().replace(/\s+/g, '-') + '-' + nanoid(6),
              description: template.descriptionTemplate,
              category: template.category,
              goal: 0,
              currentAmount: 0,
              currency: 'USD',
              allowCustomAmount: true,
              allowRecurring: template.category !== 'bail', // No recurring for bail funds
              status: 'draft',
              created: Date.now(),
              createdBy: currentIdentity?.publicKey || '',
              updated: Date.now(),
              updateCount: 0,
              settings: {
                ...template.settings,
                enabledProcessors: template.settings.enabledProcessors || ['stripe'],
              } as Campaign['settings'],
            };
            addCampaign(newCampaign);
            setViewMode('list');
          }}
          onCreateBlank={() => {
            handleCreateCampaign();
          }}
        />
      </div>
    );
  }

  // Campaigns List View
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fundraising</h1>
          <p className="text-muted-foreground">
            Create and manage fundraising campaigns for your organization
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setViewMode('templates')}>
            View Templates
          </Button>
          <Button onClick={handleCreateCampaign}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Campaigns Grid */}
      {campaigns.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <h3 className="text-lg font-semibold">No campaigns yet</h3>
            <p className="text-muted-foreground">
              Create your first fundraising campaign to support strike funds, bail funds, mutual aid, and more.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleCreateCampaign}>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
              <Button variant="outline" onClick={() => setViewMode('templates')}>
                Browse Templates
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => {
            const progress = getDonationProgress(campaign.id);

            return (
              <Card key={campaign.id} className="p-6 hover:border-primary transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{campaign.title}</h3>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className="mb-2">
                      {campaign.status}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditCampaign(campaign)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePreviewCampaign(campaign)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewDonors(campaign)}>
                        <Users className="h-4 w-4 mr-2" />
                        Donors
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewAnalytics(campaign)}>
                        <BarChart className="h-4 w-4 mr-2" />
                        Analytics
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopyLink(campaign)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePublishToggle(campaign)}>
                        {campaign.status === 'active' ? 'Pause' : 'Publish'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(campaign)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{formatCurrency(progress.current, campaign.currency)}</span>
                    <span className="text-muted-foreground">of {formatCurrency(progress.goal, campaign.currency)}</span>
                  </div>
                  <Progress value={progress.percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">{progress.percentage}% funded</p>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{campaign.category}</Badge>
                </div>

                <div className="mt-4 pt-4 border-t flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditCampaign(campaign)}>
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handlePreviewCampaign(campaign)}>
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{campaignToDelete?.title}"? This will also delete all donations and updates. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
