/**
 * Media Collective Proposal Templates
 *
 * Pre-defined proposal templates for media collectives.
 * Covers editorial governance, collective operations, and content decisions.
 */

import type { VotingSystem } from '../types';

/**
 * Proposal Template Definition
 * Used to pre-configure proposals for specific collective needs
 */
export interface ProposalTemplate {
  /** Unique template ID */
  id: string;

  /** Display title */
  title: string;

  /** Template description */
  description: string;

  /** Category for organization */
  category: 'editorial' | 'membership' | 'operations' | 'content' | 'coalition';

  /** Default voting system */
  votingSystem: VotingSystem;

  /** Default quorum percentage (0-100) */
  quorum: number;

  /** Default threshold for passing (0-100, for simple voting) */
  threshold?: number;

  /** Discussion period in milliseconds */
  discussionPeriod: number;

  /** Voting period in milliseconds */
  votingPeriod?: number;

  /** Placeholder description text */
  descriptionPlaceholder?: string;

  /** Pre-defined options (for ranked-choice or multiple options) */
  options?: string[];

  /** i18n key for localization */
  i18nKey?: string;
}

// Time constants
const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;

/**
 * Media Collective Proposal Templates
 */
export const MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  // Editorial Governance
  {
    id: 'editorial-policy-change',
    title: 'Editorial Policy Change',
    description: 'Propose changes to editorial guidelines, standards, or policies',
    category: 'editorial',
    votingSystem: 'consensus',
    quorum: 66,
    discussionPeriod: 7 * DAYS,
    votingPeriod: 5 * DAYS,
    descriptionPlaceholder:
      'Describe the proposed policy change, its rationale, and expected impact on editorial operations...',
    i18nKey: 'governance.templates.editorialPolicyChange',
  },
  {
    id: 'coverage-priority',
    title: 'Coverage Priority',
    description: 'Set or change coverage priorities for the collective',
    category: 'editorial',
    votingSystem: 'ranked-choice',
    quorum: 50,
    discussionPeriod: 3 * DAYS,
    votingPeriod: 3 * DAYS,
    descriptionPlaceholder: 'List the coverage areas or topics to prioritize and explain the rationale...',
    options: ['Local Politics', 'Labor & Unions', 'Housing', 'Environment', 'Police Accountability', 'Community Events'],
    i18nKey: 'governance.templates.coveragePriority',
  },
  {
    id: 'style-guide-update',
    title: 'Style Guide Update',
    description: 'Propose updates to the collective\'s style guide',
    category: 'editorial',
    votingSystem: 'simple-majority',
    quorum: 50,
    threshold: 66,
    discussionPeriod: 5 * DAYS,
    votingPeriod: 3 * DAYS,
    descriptionPlaceholder: 'Describe the proposed style guide changes...',
    i18nKey: 'governance.templates.styleGuideUpdate',
  },

  // Membership Decisions
  {
    id: 'new-member-approval',
    title: 'New Member Approval',
    description: 'Vote on accepting a new member to the collective',
    category: 'membership',
    votingSystem: 'simple-majority',
    quorum: 50,
    threshold: 66,
    discussionPeriod: 5 * DAYS,
    votingPeriod: 3 * DAYS,
    descriptionPlaceholder:
      'Introduce the prospective member: their background, skills, contributions, and why they want to join...',
    i18nKey: 'governance.templates.newMemberApproval',
  },
  {
    id: 'role-assignment',
    title: 'Role Assignment',
    description: 'Assign a member to a specific role (Editor, Publisher, etc.)',
    category: 'membership',
    votingSystem: 'simple-majority',
    quorum: 50,
    threshold: 66,
    discussionPeriod: 3 * DAYS,
    votingPeriod: 2 * DAYS,
    descriptionPlaceholder: 'Nominate the member for the role and explain their qualifications...',
    i18nKey: 'governance.templates.roleAssignment',
  },
  {
    id: 'elect-editorial-board',
    title: 'Elect Editorial Board',
    description: 'Elect members to serve on the editorial board',
    category: 'membership',
    votingSystem: 'ranked-choice',
    quorum: 66,
    discussionPeriod: 7 * DAYS,
    votingPeriod: 5 * DAYS,
    descriptionPlaceholder: 'List the candidates and their qualifications for the editorial board...',
    i18nKey: 'governance.templates.electEditorialBoard',
  },

  // Operations
  {
    id: 'join-coalition',
    title: 'Join Coalition',
    description: 'Vote on joining a regional or global media coalition',
    category: 'coalition',
    votingSystem: 'consensus',
    quorum: 75,
    discussionPeriod: 7 * DAYS,
    votingPeriod: 5 * DAYS,
    descriptionPlaceholder:
      'Describe the coalition: its members, purpose, syndication policies, and benefits of joining...',
    i18nKey: 'governance.templates.joinCoalition',
  },
  {
    id: 'leave-coalition',
    title: 'Leave Coalition',
    description: 'Vote on leaving a coalition the collective currently belongs to',
    category: 'coalition',
    votingSystem: 'consensus',
    quorum: 75,
    discussionPeriod: 7 * DAYS,
    votingPeriod: 5 * DAYS,
    descriptionPlaceholder: 'Explain the reasons for leaving and potential impacts...',
    i18nKey: 'governance.templates.leaveCoalition',
  },
  {
    id: 'partnership-agreement',
    title: 'Partnership Agreement',
    description: 'Establish a partnership with another organization',
    category: 'operations',
    votingSystem: 'simple-majority',
    quorum: 66,
    threshold: 75,
    discussionPeriod: 5 * DAYS,
    votingPeriod: 3 * DAYS,
    descriptionPlaceholder: 'Describe the partnership terms, mutual benefits, and obligations...',
    i18nKey: 'governance.templates.partnershipAgreement',
  },
  {
    id: 'budget-allocation',
    title: 'Budget Allocation',
    description: 'Allocate collective funds for specific purposes',
    category: 'operations',
    votingSystem: 'simple-majority',
    quorum: 66,
    threshold: 66,
    discussionPeriod: 5 * DAYS,
    votingPeriod: 3 * DAYS,
    descriptionPlaceholder: 'Detail the proposed budget allocation and justification...',
    i18nKey: 'governance.templates.budgetAllocation',
  },

  // Content Decisions
  {
    id: 'content-dispute',
    title: 'Content Dispute Resolution',
    description: 'Resolve disputes about published or pending content',
    category: 'content',
    votingSystem: 'consensus',
    quorum: 50,
    discussionPeriod: 3 * DAYS,
    votingPeriod: 2 * DAYS,
    descriptionPlaceholder:
      'Describe the content in question, the nature of the dispute, and proposed resolution...',
    i18nKey: 'governance.templates.contentDispute',
  },
  {
    id: 'retraction-request',
    title: 'Retraction or Correction',
    description: 'Vote on retracting or correcting published content',
    category: 'content',
    votingSystem: 'simple-majority',
    quorum: 50,
    threshold: 66,
    discussionPeriod: 2 * DAYS,
    votingPeriod: 2 * DAYS,
    descriptionPlaceholder: 'Identify the content, explain what needs correction, and provide accurate information...',
    i18nKey: 'governance.templates.retractionRequest',
  },
  {
    id: 'syndication-approval',
    title: 'Syndication Approval',
    description: 'Approve syndicating a specific article to coalition(s)',
    category: 'content',
    votingSystem: 'simple-majority',
    quorum: 33,
    threshold: 66,
    discussionPeriod: 1 * DAYS,
    votingPeriod: 1 * DAYS,
    descriptionPlaceholder: 'Identify the article and target coalition(s) for syndication...',
    i18nKey: 'governance.templates.syndicationApproval',
  },
];

/**
 * Get all proposal templates
 */
export function getAllProposalTemplates(): ProposalTemplate[] {
  return MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES;
}

/**
 * Get proposal templates by category
 */
export function getProposalTemplatesByCategory(
  category: ProposalTemplate['category']
): ProposalTemplate[] {
  return MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get a specific proposal template by ID
 */
export function getProposalTemplateById(id: string): ProposalTemplate | undefined {
  return MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get template categories with labels
 */
export function getProposalTemplateCategories(): Array<{
  id: ProposalTemplate['category'];
  label: string;
  count: number;
}> {
  const categories: ProposalTemplate['category'][] = [
    'editorial',
    'membership',
    'operations',
    'content',
    'coalition',
  ];

  const labels: Record<ProposalTemplate['category'], string> = {
    editorial: 'Editorial Governance',
    membership: 'Membership & Roles',
    operations: 'Operations & Finance',
    content: 'Content Decisions',
    coalition: 'Coalition Membership',
  };

  return categories.map((id) => ({
    id,
    label: labels[id],
    count: MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES.filter((t) => t.category === id).length,
  }));
}

export default MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES;
