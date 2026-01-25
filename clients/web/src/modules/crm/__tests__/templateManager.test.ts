/**
 * CRM Template Manager Unit Tests
 * Tests the CRM template manager functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crmTemplateManager } from '../crmTemplateManager';
import { builtInTemplates } from '../templates/index';
import type { CRMMultiTableTemplate, CRMTemplateCategory } from '../types';

// Mock the template store
vi.mock('../templateStore', () => ({
  useTemplateStore: {
    getState: () => ({
      customTemplates: new Map(),
      getAllTemplates: () => builtInTemplates,
      getTemplateById: (id: string) => builtInTemplates.find((t) => t.id === id),
      loadCustomTemplates: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock the database manager
vi.mock('@/modules/database/databaseManager', () => ({
  databaseManager: {
    createTable: vi.fn().mockResolvedValue({ id: 'test-table-id' }),
    createRelationship: vi.fn().mockResolvedValue({ id: 'test-rel-id' }),
  },
}));

// Mock the database store
vi.mock('@/modules/database/databaseStore', () => ({
  useDatabaseStore: {
    getState: () => ({
      tables: [],
      addTable: vi.fn(),
      addRelationship: vi.fn(),
    }),
  },
}));

describe('CRM Template Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableTemplates', () => {
    it('should return all available templates', () => {
      const templates = crmTemplateManager.getAvailableTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(6);
    });

    it('should return templates with groupId filter', () => {
      const templates = crmTemplateManager.getAvailableTemplates('test-group');
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('getBuiltInTemplates', () => {
    it('should return only built-in templates', () => {
      const templates = crmTemplateManager.getBuiltInTemplates();
      expect(templates).toEqual(builtInTemplates);
      expect(templates.length).toBe(8);
    });

    it('should include all expected template IDs', () => {
      const templates = crmTemplateManager.getBuiltInTemplates();
      const ids = templates.map((t) => t.id);
      expect(ids).toContain('nlg-mass-defense');
      expect(ids).toContain('tenant-organizing');
      expect(ids).toContain('nonprofit-crm');
      expect(ids).toContain('member-management');
      expect(ids).toContain('sales-pipeline');
      expect(ids).toContain('union-election-campaign');
      expect(ids).toContain('street-medics');
      expect(ids).toContain('self-defense');
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return templates filtered by legal category', () => {
      const templates = crmTemplateManager.getTemplatesByCategory('legal');
      expect(templates.every((t) => t.category === 'legal')).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should return templates filtered by sales category', () => {
      const templates = crmTemplateManager.getTemplatesByCategory('sales');
      expect(templates.every((t) => t.category === 'sales')).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should return templates filtered by member category', () => {
      const templates = crmTemplateManager.getTemplatesByCategory('member');
      expect(templates.every((t) => t.category === 'member')).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent category', () => {
      const templates = crmTemplateManager.getTemplatesByCategory('nonexistent' as CRMTemplateCategory);
      expect(templates.length).toBe(0);
    });
  });

  describe('getTemplateById', () => {
    it('should return correct template by ID', () => {
      const template = crmTemplateManager.getTemplateById('nlg-mass-defense');
      expect(template).toBeDefined();
      expect(template?.id).toBe('nlg-mass-defense');
      expect(template?.name).toBe('NLG Mass Defense');
    });

    it('should return undefined for non-existent ID', () => {
      const template = crmTemplateManager.getTemplateById('non-existent-template');
      expect(template).toBeUndefined();
    });
  });

  describe('isCustomTemplate', () => {
    it('should return false for built-in templates', () => {
      const isCustom = crmTemplateManager.isCustomTemplate('nlg-mass-defense');
      expect(isCustom).toBe(false);
    });
  });

  describe('Template Validation', () => {
    it('should validate template has required tables', () => {
      const template = crmTemplateManager.getTemplateById('nlg-mass-defense');
      expect(template?.tables.length).toBeGreaterThan(0);
    });

    it('should validate template has primary table', () => {
      const template = crmTemplateManager.getTemplateById('nlg-mass-defense');
      const primaryTable = template?.tables.find((t) => t.isPrimary);
      expect(primaryTable).toBeDefined();
    });

    it('should validate all tables have fields', () => {
      const template = crmTemplateManager.getTemplateById('nlg-mass-defense');
      if (template) {
        for (const table of template.tables) {
          expect(table.fields.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Category Coverage', () => {
    it('should cover different template categories', () => {
      // Each built-in template has a category, check they can be retrieved
      const templates = crmTemplateManager.getBuiltInTemplates();
      const categories = new Set(templates.map((t) => t.category));
      // Should have multiple categories covered
      expect(categories.size).toBeGreaterThan(1);
    });

    it('should return empty array for unused categories', () => {
      // Categories defined in type but not used in templates
      const templates = crmTemplateManager.getTemplatesByCategory('civil-defense');
      expect(templates).toEqual([]);
    });
  });
});
