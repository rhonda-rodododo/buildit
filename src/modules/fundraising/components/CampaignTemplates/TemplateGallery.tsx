/**
 * Template Gallery Component
 * Gallery of pre-built campaign templates
 */

import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText } from 'lucide-react';
import type { CampaignTemplate, CampaignCategory } from '../../types';

interface TemplateGalleryProps {
  onSelectTemplate: (template: CampaignTemplate) => void;
  onCreateBlank: () => void;
}

// Built-in campaign templates
const BUILT_IN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'strike-fund',
    name: 'Strike Fund',
    description: 'Support workers on strike with essential resources',
    category: 'strike',
    title: 'Worker Strike Support Fund',
    descriptionTemplate: `**Support our striking workers!**

Our members are on strike for fair wages, safe working conditions, and dignity on the job. Every dollar helps keep them strong on the picket line.

- Strike pay for workers
- Legal defense fund
- Healthcare coverage
- Emergency support for families`,
    defaultTiers: [
      {
        name: 'Solidarity Supporter',
        amount: 2500, // $25
        description: 'Helps provide a day of strike pay for one worker',
        benefits: ['Strike fund supporter badge', 'Updates from the picket line'],
        order: 0,
        limited: false,
      },
      {
        name: 'Picket Line Partner',
        amount: 10000, // $100
        description: 'Covers a week of healthcare for a striking family',
        benefits: [
          'All Solidarity Supporter benefits',
          'Invitation to strategy call with strike leadership',
          'Strike solidarity t-shirt',
        ],
        order: 1,
        limited: false,
      },
      {
        name: 'Union Champion',
        amount: 50000, // $500
        description: 'Provides emergency support for 5 striking families',
        benefits: [
          'All Picket Line Partner benefits',
          'Recognition in campaign updates',
          'Invitation to victory celebration',
        ],
        order: 2,
        limited: true,
        maxCount: 50,
      },
    ],
    settings: {
      showDonorWall: true,
      allowAnonymousDonors: true,
      showDonorNames: true,
      showDonorAmounts: false,
      showDonorMessages: true,
      sendThankYouEmail: true,
      thankYouSubject: 'Thank You for Supporting Our Strike!',
      thankYouBody: 'Your solidarity means everything to our striking workers. Together we are stronger!',
      sendTaxReceipt: false,
      continueAfterGoal: true,
      notifyOnDonation: true,
      enabledProcessors: ['stripe', 'paypal'],
    },
    isBuiltIn: true,
  },
  {
    id: 'bail-fund',
    name: 'Bail Fund',
    description: 'Emergency bail fund for protesters and activists',
    category: 'bail',
    title: 'Emergency Bail Fund',
    descriptionTemplate: `**Free our protesters!**

When our community members are arrested for exercising their rights, we stand ready to get them out. This fund provides immediate bail for protesters.

100% of donations go directly to bail.`,
    settings: {
      showDonorWall: false, // Privacy: no donor wall
      allowAnonymousDonors: true,
      showDonorNames: false,
      showDonorAmounts: false,
      showDonorMessages: false,
      sendThankYouEmail: false, // No emails for privacy
      sendTaxReceipt: false,
      continueAfterGoal: true,
      notifyOnDonation: true,
      enabledProcessors: ['crypto'], // Crypto only for privacy
    },
    isBuiltIn: true,
  },
  {
    id: 'mutual-aid',
    name: 'Mutual Aid Fund',
    description: 'Community mutual aid and emergency support',
    category: 'mutual-aid',
    title: 'Community Mutual Aid Fund',
    descriptionTemplate: `**Solidarity, not charity**

Our mutual aid network provides direct support to community members in need. We believe in collective care and building power together.

- Emergency financial assistance
- Food and housing support
- Medical expenses
- Transportation help`,
    defaultTiers: [
      {
        name: 'Community Supporter',
        amount: 1000, // $10
        description: 'Helps provide a meal for someone in need',
        order: 0,
        limited: false,
      },
      {
        name: 'Mutual Aid Advocate',
        amount: 5000, // $50
        description: 'Covers emergency transportation or supplies',
        order: 1,
        limited: false,
      },
      {
        name: 'Solidarity Partner',
        amount: 20000, // $200
        description: 'Provides comprehensive emergency support',
        order: 2,
        limited: false,
      },
    ],
    settings: {
      showDonorWall: true,
      allowAnonymousDonors: true,
      showDonorNames: true,
      showDonorAmounts: false,
      showDonorMessages: true,
      sendThankYouEmail: true,
      thankYouSubject: 'Thank You for Your Solidarity',
      thankYouBody: 'Your contribution strengthens our community mutual aid network. We are all better together!',
      sendTaxReceipt: false,
      continueAfterGoal: true,
      notifyOnDonation: false,
      enabledProcessors: ['stripe', 'paypal'],
    },
    isBuiltIn: true,
  },
  {
    id: 'legal-defense',
    name: 'Legal Defense Fund',
    description: 'Legal support for activists and community defenders',
    category: 'legal',
    title: 'Legal Defense Fund',
    descriptionTemplate: `**Defend the defenders**

When activists face legal charges for their organizing work, we provide legal support to ensure justice is served.

- Criminal defense attorneys
- Bail and court costs
- Expert witnesses
- Appeal support`,
    defaultTiers: [
      {
        name: 'Legal Support',
        amount: 5000, // $50
        description: 'Contributes to legal consultation costs',
        order: 0,
        limited: false,
      },
      {
        name: 'Defense Partner',
        amount: 25000, // $250
        description: 'Helps cover attorney fees',
        order: 1,
        limited: false,
      },
      {
        name: 'Justice Champion',
        amount: 100000, // $1,000
        description: 'Provides comprehensive legal defense support',
        order: 2,
        limited: true,
        maxCount: 20,
      },
    ],
    settings: {
      showDonorWall: false, // Privacy for legal defense
      allowAnonymousDonors: true,
      showDonorNames: false,
      showDonorAmounts: false,
      showDonorMessages: false,
      sendThankYouEmail: false,
      sendTaxReceipt: false,
      continueAfterGoal: true,
      notifyOnDonation: true,
      enabledProcessors: ['crypto', 'stripe'],
    },
    isBuiltIn: true,
  },
];

export function TemplateGallery({ onSelectTemplate, onCreateBlank }: TemplateGalleryProps) {
  const { t } = useTranslation();
  const categoryColors: Record<CampaignCategory, string> = {
    general: 'default',
    bail: 'destructive',
    strike: 'secondary',
    'mutual-aid': 'default',
    legal: 'outline',
    emergency: 'destructive',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{t('campaignTemplateGallery.title')}</h2>
        <p className="text-muted-foreground">
          {t('campaignTemplateGallery.description')}
        </p>
      </div>

      {/* Blank Campaign Option */}
      <Card
        className="p-6 cursor-pointer hover:border-primary transition-colors"
        onClick={onCreateBlank}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{t('campaignTemplateGallery.blank.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('campaignTemplateGallery.blank.description')}
            </p>
          </div>
        </div>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BUILT_IN_TEMPLATES.map((template) => (
          <Card
            key={template.id}
            className="p-6 cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSelectTemplate(template)}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="h-6 w-6" />
                </div>
                <Badge variant={categoryColors[template.category] as any}>
                  {template.category}
                </Badge>
              </div>

              <div>
                <h3 className="font-semibold mb-1">{template.name}</h3>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </div>

              {template.defaultTiers && template.defaultTiers.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {t('campaignTemplateGallery.includesTiers', { count: template.defaultTiers.length })}
                </div>
              )}

              <Button variant="outline" className="w-full">
                {t('campaignTemplateGallery.useTemplate')}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
