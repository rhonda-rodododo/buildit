/**
 * Governance Proposal Templates
 *
 * Pre-defined proposal templates for different group types.
 */

export {
  MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES,
  getAllProposalTemplates,
  getProposalTemplatesByCategory,
  getProposalTemplateById,
  getProposalTemplateCategories,
} from './mediaCollectiveProposals';

export type { ProposalTemplate } from './mediaCollectiveProposals';

export { mediaCollectiveGovernanceSeeds } from './mediaCollectiveSeeds';

/**
 * Get proposal templates for a group template ID
 */
export function getProposalTemplatesForGroupTemplate(templateId: string) {
  switch (templateId) {
    case 'media-collective':
      return import('./mediaCollectiveProposals').then((m) => m.MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES);
    default:
      return Promise.resolve([]);
  }
}

/**
 * Get seed data for a group template ID
 */
export function getSeedsForGroupTemplate(templateId: string) {
  switch (templateId) {
    case 'media-collective':
      return import('./mediaCollectiveSeeds').then((m) => m.mediaCollectiveGovernanceSeeds);
    default:
      return Promise.resolve([]);
  }
}
