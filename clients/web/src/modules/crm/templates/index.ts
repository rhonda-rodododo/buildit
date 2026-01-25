/**
 * CRM Templates Index
 * Export all available CRM multi-table templates
 */

import type { CRMMultiTableTemplate } from '../types';

// Import all templates
import { nlgMassDefenseTemplate } from './nlgMassDefense';
import { tenantOrganizingTemplate } from './tenantOrganizing';
import { nonprofitCRMTemplate } from './nonprofitCRM';
import { memberManagementTemplate } from './memberManagement';
import { salesPipelineTemplate } from './salesPipeline';
import { unionElectionCampaignTemplate } from './unionElectionCampaign';
import { streetMedicsTemplate } from './streetMedics';
import { selfDefenseTemplate } from './selfDefense';

// Re-export individual templates
export {
  nlgMassDefenseTemplate,
  tenantOrganizingTemplate,
  nonprofitCRMTemplate,
  memberManagementTemplate,
  salesPipelineTemplate,
  unionElectionCampaignTemplate,
  streetMedicsTemplate,
  selfDefenseTemplate,
};

/**
 * All built-in CRM multi-table templates
 * Used by templateStore for combined template listing
 */
export const builtInTemplates: CRMMultiTableTemplate[] = [
  nlgMassDefenseTemplate,
  tenantOrganizingTemplate,
  nonprofitCRMTemplate,
  memberManagementTemplate,
  salesPipelineTemplate,
  unionElectionCampaignTemplate,
  streetMedicsTemplate,
  selfDefenseTemplate,
];
