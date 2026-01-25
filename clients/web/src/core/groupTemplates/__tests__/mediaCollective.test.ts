/**
 * Media Collective Template Tests
 */

import { describe, it, expect } from 'vitest';
import {
  MEDIA_COLLECTIVE_TEMPLATE,
  BUILTIN_TEMPLATES,
  TEMPLATES_BY_CATEGORY,
} from '../templates';
import {
  MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES,
  getAllProposalTemplates,
  getProposalTemplatesByCategory,
  getProposalTemplateById,
  getProposalTemplateCategories,
} from '@/modules/governance/templates';

describe('Media Collective Template', () => {
  describe('Template Definition', () => {
    it('should have correct basic properties', () => {
      expect(MEDIA_COLLECTIVE_TEMPLATE.id).toBe('media-collective');
      expect(MEDIA_COLLECTIVE_TEMPLATE.name).toBe('Media Collective');
      expect(MEDIA_COLLECTIVE_TEMPLATE.category).toBe('civic');
      expect(MEDIA_COLLECTIVE_TEMPLATE.complexity).toBe(5);
      expect(MEDIA_COLLECTIVE_TEMPLATE.icon).toBe('📰');
    });

    it('should have required modules configured', () => {
      const requiredModules = MEDIA_COLLECTIVE_TEMPLATE.modules.filter((m) => m.required);
      const requiredIds = requiredModules.map((m) => m.moduleId);

      expect(requiredIds).toContain('publishing');
      expect(requiredIds).toContain('newsletters');
      expect(requiredIds).toContain('governance');
      expect(requiredIds).toContain('documents');
      expect(requiredIds).toContain('public');
      expect(requiredIds).toContain('messaging');
    });

    it('should have 8 modules configured', () => {
      expect(MEDIA_COLLECTIVE_TEMPLATE.modules.length).toBe(8);
    });

    it('should have publishing module with editorial workflow config', () => {
      const publishingModule = MEDIA_COLLECTIVE_TEMPLATE.modules.find(
        (m) => m.moduleId === 'publishing'
      );

      expect(publishingModule).toBeDefined();
      expect(publishingModule?.config?.editorialStyle).toBe('editorial-collective');
      expect(publishingModule?.config?.editorialWorkflow?.enabled).toBe(true);
      expect(publishingModule?.config?.editorialWorkflow?.requireApproval).toBe(true);
    });

    it('should have governance module with consensus default', () => {
      const governanceModule = MEDIA_COLLECTIVE_TEMPLATE.modules.find(
        (m) => m.moduleId === 'governance'
      );

      expect(governanceModule).toBeDefined();
      expect(governanceModule?.config?.defaultVotingSystem).toBe('consensus');
      expect(governanceModule?.config?.quorumRequired).toBe(true);
    });
  });

  describe('Enhancements', () => {
    it('should have 6 enhancements available', () => {
      expect(MEDIA_COLLECTIVE_TEMPLATE.enhancements?.length).toBe(6);
    });

    it('should have open-newsroom enhancement', () => {
      const enhancement = MEDIA_COLLECTIVE_TEMPLATE.enhancements?.find(
        (e) => e.id === 'open-newsroom'
      );

      expect(enhancement).toBeDefined();
      expect(enhancement?.name).toBe('Open Newsroom');
      expect(enhancement?.modules.some((m) => m.moduleId === 'forms')).toBe(true);
    });

    it('should have wire-service enhancement', () => {
      const enhancement = MEDIA_COLLECTIVE_TEMPLATE.enhancements?.find(
        (e) => e.id === 'wire-service'
      );

      expect(enhancement).toBeDefined();
      expect(enhancement?.name).toBe('Wire Service Mode');
    });

    it('should have fundraising enhancement', () => {
      const enhancement = MEDIA_COLLECTIVE_TEMPLATE.enhancements?.find(
        (e) => e.id === 'fundraising'
      );

      expect(enhancement).toBeDefined();
      expect(enhancement?.modules.some((m) => m.moduleId === 'fundraising')).toBe(true);
    });
  });

  describe('Default Channels', () => {
    it('should have 5 default channels', () => {
      expect(MEDIA_COLLECTIVE_TEMPLATE.defaultChannels?.length).toBe(5);
    });

    it('should have editorial channel', () => {
      const channel = MEDIA_COLLECTIVE_TEMPLATE.defaultChannels?.find(
        (c) => c.name === 'editorial'
      );

      expect(channel).toBeDefined();
      expect(channel?.type).toBe('chat');
      expect(channel?.privacy).toBe('members');
    });

    it('should have public announcements channel', () => {
      const channel = MEDIA_COLLECTIVE_TEMPLATE.defaultChannels?.find(
        (c) => c.name === 'announcements'
      );

      expect(channel).toBeDefined();
      expect(channel?.type).toBe('announcement');
      expect(channel?.privacy).toBe('public');
    });
  });

  describe('Default Roles', () => {
    it('should have 5 default roles', () => {
      expect(MEDIA_COLLECTIVE_TEMPLATE.defaultRoles?.length).toBe(5);
    });

    it('should have Editor role with appropriate permissions', () => {
      const role = MEDIA_COLLECTIVE_TEMPLATE.defaultRoles?.find((r) => r.name === 'Editor');

      expect(role).toBeDefined();
      expect(role?.permissions).toContain('review_articles');
      expect(role?.permissions).toContain('approve_articles');
    });

    it('should have Writer role', () => {
      const role = MEDIA_COLLECTIVE_TEMPLATE.defaultRoles?.find((r) => r.name === 'Writer');

      expect(role).toBeDefined();
      expect(role?.permissions).toContain('create_articles');
      expect(role?.permissions).toContain('submit_for_review');
    });

    it('should have Publisher role', () => {
      const role = MEDIA_COLLECTIVE_TEMPLATE.defaultRoles?.find((r) => r.name === 'Publisher');

      expect(role).toBeDefined();
      expect(role?.permissions).toContain('publish_articles');
      expect(role?.permissions).toContain('manage_syndication');
    });
  });

  describe('Demo Data', () => {
    it('should have demo data configuration', () => {
      expect(MEDIA_COLLECTIVE_TEMPLATE.demoData).toBeDefined();
      expect(MEDIA_COLLECTIVE_TEMPLATE.demoData?.available).toBe(true);
      expect(MEDIA_COLLECTIVE_TEMPLATE.demoData?.enabledByDefault).toBe(false);
    });

    it('should have seed names configured', () => {
      expect(MEDIA_COLLECTIVE_TEMPLATE.demoData?.seeds?.length).toBeGreaterThan(0);
      expect(MEDIA_COLLECTIVE_TEMPLATE.demoData?.seeds).toContain('governance-media-demo');
    });
  });

  describe('Template Registry Integration', () => {
    it('should be included in BUILTIN_TEMPLATES', () => {
      const template = BUILTIN_TEMPLATES.find((t) => t.id === 'media-collective');
      expect(template).toBeDefined();
    });

    it('should be in civic category', () => {
      const civicTemplates = TEMPLATES_BY_CATEGORY.civic;
      const template = civicTemplates.find((t) => t.id === 'media-collective');
      expect(template).toBeDefined();
    });
  });
});

describe('Media Collective Proposal Templates', () => {
  describe('Template Collection', () => {
    it('should have 13 proposal templates', () => {
      expect(MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES.length).toBe(13);
    });

    it('should return all templates via getAllProposalTemplates', () => {
      const templates = getAllProposalTemplates();
      expect(templates.length).toBe(13);
    });
  });

  describe('Template Categories', () => {
    it('should have 5 categories', () => {
      const categories = getProposalTemplateCategories();
      expect(categories.length).toBe(5);
    });

    it('should have editorial category', () => {
      const templates = getProposalTemplatesByCategory('editorial');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some((t) => t.id === 'editorial-policy-change')).toBe(true);
    });

    it('should have membership category', () => {
      const templates = getProposalTemplatesByCategory('membership');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some((t) => t.id === 'new-member-approval')).toBe(true);
    });

    it('should have coalition category', () => {
      const templates = getProposalTemplatesByCategory('coalition');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some((t) => t.id === 'join-coalition')).toBe(true);
    });
  });

  describe('Individual Templates', () => {
    it('should find editorial-policy-change template', () => {
      const template = getProposalTemplateById('editorial-policy-change');

      expect(template).toBeDefined();
      expect(template?.votingMethod).toBe('consensus');
      expect(template?.quorum).toBe(66);
    });

    it('should find coverage-priority template with ranked-choice', () => {
      const template = getProposalTemplateById('coverage-priority');

      expect(template).toBeDefined();
      expect(template?.votingMethod).toBe('ranked-choice');
      expect(template?.options).toBeDefined();
    });

    it('should find new-member-approval template', () => {
      const template = getProposalTemplateById('new-member-approval');

      expect(template).toBeDefined();
      expect(template?.votingMethod).toBe('simple');
      expect(template?.threshold).toBe(66);
    });

    it('should find join-coalition template with high quorum', () => {
      const template = getProposalTemplateById('join-coalition');

      expect(template).toBeDefined();
      expect(template?.votingMethod).toBe('consensus');
      expect(template?.quorum).toBe(75);
    });

    it('should return undefined for non-existent template', () => {
      const template = getProposalTemplateById('non-existent');
      expect(template).toBeUndefined();
    });
  });

  describe('Template Structure', () => {
    it('should have valid discussion periods', () => {
      for (const template of MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES) {
        expect(template.discussionPeriod).toBeGreaterThan(0);
      }
    });

    it('should have valid quorum values (0-100)', () => {
      for (const template of MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES) {
        expect(template.quorum).toBeGreaterThanOrEqual(0);
        expect(template.quorum).toBeLessThanOrEqual(100);
      }
    });

    it('should have i18n keys for all templates', () => {
      for (const template of MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES) {
        expect(template.i18nKey).toBeDefined();
        expect(template.i18nKey).toContain('governance.templates');
      }
    });
  });
});
