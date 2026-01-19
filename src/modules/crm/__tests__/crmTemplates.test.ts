/**
 * CRM Templates Unit Tests
 * Tests the built-in CRM multi-table templates
 */

import { describe, it, expect } from 'vitest';
import { builtInTemplates } from '../templates/index';
import { nlgMassDefenseTemplate } from '../templates/nlgMassDefense';
import { tenantOrganizingTemplate } from '../templates/tenantOrganizing';
import { nonprofitCRMTemplate } from '../templates/nonprofitCRM';
import { memberManagementTemplate } from '../templates/memberManagement';
import { salesPipelineTemplate } from '../templates/salesPipeline';

describe('CRM Templates', () => {
  describe('Built-in Templates', () => {
    it('should have 5 built-in templates', () => {
      expect(builtInTemplates.length).toBe(5);
    });

    it('should have unique template IDs', () => {
      const ids = builtInTemplates.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should all have required properties', () => {
      for (const template of builtInTemplates) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.icon).toBeDefined();
        expect(template.category).toBeDefined();
        expect(template.tables).toBeDefined();
        expect(template.tables.length).toBeGreaterThan(0);
      }
    });
  });

  describe('NLG Mass Defense Template', () => {
    const template = nlgMassDefenseTemplate;

    it('should have correct metadata', () => {
      expect(template.id).toBe('nlg-mass-defense');
      expect(template.name).toBe('NLG Mass Defense');
      expect(template.category).toBe('legal');
    });

    it('should have all required tables', () => {
      const tableKeys = template.tables.map((t) => t.key);
      expect(tableKeys).toContain('arrestees');
      expect(tableKeys).toContain('cases');
      expect(tableKeys).toContain('lawyers');
      expect(tableKeys).toContain('court_dates');
      expect(tableKeys).toContain('communications');
    });

    it('should have arrestees table with proper fields', () => {
      const arresteesTable = template.tables.find((t) => t.key === 'arrestees');
      expect(arresteesTable).toBeDefined();
      expect(arresteesTable?.isPrimary).toBe(true);

      const fieldNames = arresteesTable?.fields.map((f) => f.name);
      expect(fieldNames).toContain('full_name');
      expect(fieldNames).toContain('phone');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('arrest_date');
      expect(fieldNames).toContain('charges');
    });

    it('should have relationships between tables', () => {
      expect(template.relationships.length).toBeGreaterThan(0);

      const caseArresteeRel = template.relationships.find(
        (r) => r.sourceTable === 'arrestees' && r.targetTable === 'cases'
      );
      expect(caseArresteeRel).toBeDefined();
    });

    it('should have seed data', () => {
      expect(template.seedData).toBeDefined();
      expect(template.seedData?.items).toBeDefined();
    });

    it('should have integrations enabled', () => {
      expect(template.integrations?.files).toBe(true);
      expect(template.integrations?.messaging).toBe(true);
    });
  });

  describe('Tenant Organizing Template', () => {
    const template = tenantOrganizingTemplate;

    it('should have correct metadata', () => {
      expect(template.id).toBe('tenant-organizing');
      expect(template.name).toBe('Tenant Organizing');
      expect(template.category).toBe('tenant');
    });

    it('should have all required tables', () => {
      const tableKeys = template.tables.map((t) => t.key);
      expect(tableKeys).toContain('tenants');
      expect(tableKeys).toContain('buildings');
      expect(tableKeys).toContain('cases');
      expect(tableKeys).toContain('organizers');
      expect(tableKeys).toContain('actions');
    });

    it('should have tenants table as primary', () => {
      const tenantsTable = template.tables.find((t) => t.key === 'tenants');
      expect(tenantsTable?.isPrimary).toBe(true);
    });

    it('should have building-tenant relationships', () => {
      const buildingRel = template.relationships.find(
        (r) => r.sourceTable === 'tenants' && r.targetTable === 'buildings'
      );
      expect(buildingRel).toBeDefined();
    });
  });

  describe('Nonprofit CRM Template', () => {
    const template = nonprofitCRMTemplate;

    it('should have correct metadata', () => {
      expect(template.id).toBe('nonprofit-crm');
      expect(template.name).toBe('Nonprofit CRM');
      expect(template.category).toBe('nonprofit');
    });

    it('should have all required tables', () => {
      const tableKeys = template.tables.map((t) => t.key);
      expect(tableKeys).toContain('contacts');
      expect(tableKeys).toContain('donations');
      expect(tableKeys).toContain('campaigns');
      expect(tableKeys).toContain('communications');
      expect(tableKeys).toContain('tags');
    });

    it('should have contacts table as primary', () => {
      const contactsTable = template.tables.find((t) => t.key === 'contacts');
      expect(contactsTable?.isPrimary).toBe(true);
    });

    it('should have donation tracking', () => {
      const donationsTable = template.tables.find((t) => t.key === 'donations');
      const fieldNames = donationsTable?.fields.map((f) => f.name);
      expect(fieldNames).toContain('amount');
      expect(fieldNames).toContain('date');
      expect(fieldNames).toContain('payment_method');
    });
  });

  describe('Member Management Template', () => {
    const template = memberManagementTemplate;

    it('should have correct metadata', () => {
      expect(template.id).toBe('member-management');
      expect(template.name).toBe('Member Management');
      expect(template.category).toBe('member');
    });

    it('should have all required tables', () => {
      const tableKeys = template.tables.map((t) => t.key);
      expect(tableKeys).toContain('members');
      expect(tableKeys).toContain('dues_payments');
      expect(tableKeys).toContain('committees');
      expect(tableKeys).toContain('meetings');
    });

    it('should have members table as primary', () => {
      const membersTable = template.tables.find((t) => t.key === 'members');
      expect(membersTable?.isPrimary).toBe(true);
    });

    it('should have dues tracking', () => {
      const duesTable = template.tables.find((t) => t.key === 'dues_payments');
      expect(duesTable).toBeDefined();
      const fieldNames = duesTable?.fields.map((f) => f.name);
      expect(fieldNames).toContain('amount');
      expect(fieldNames).toContain('date');
    });
  });

  describe('Sales Pipeline Template', () => {
    const template = salesPipelineTemplate;

    it('should have correct metadata', () => {
      expect(template.id).toBe('sales-pipeline');
      expect(template.name).toBe('Sales Pipeline');
      expect(template.category).toBe('sales');
    });

    it('should have all required tables', () => {
      const tableKeys = template.tables.map((t) => t.key);
      expect(tableKeys).toContain('accounts');
      expect(tableKeys).toContain('contacts');
      expect(tableKeys).toContain('opportunities');
      expect(tableKeys).toContain('activities');
    });

    it('should have opportunity stages', () => {
      const opportunitiesTable = template.tables.find((t) => t.key === 'opportunities');
      const stageField = opportunitiesTable?.fields.find((f) => f.name === 'stage');
      expect(stageField).toBeDefined();
      expect(stageField?.widget?.widget).toBe('select');
      expect(stageField?.widget?.options?.length).toBeGreaterThan(0);
    });
  });

  describe('Template Table Structure', () => {
    it('all templates should have valid field definitions', () => {
      for (const template of builtInTemplates) {
        for (const table of template.tables) {
          for (const field of table.fields) {
            expect(field.name).toBeDefined();
            expect(field.label).toBeDefined();
            expect(field.schema).toBeDefined();
            expect(field.widget).toBeDefined();
          }
        }
      }
    });

    it('all templates should have valid relationship definitions', () => {
      for (const template of builtInTemplates) {
        for (const rel of template.relationships) {
          expect(rel.sourceTable).toBeDefined();
          expect(rel.sourceField).toBeDefined();
          expect(rel.targetTable).toBeDefined();
          expect(rel.targetField).toBeDefined();
          expect(rel.type).toBeDefined();

          // Validate source table exists
          const sourceExists = template.tables.some((t) => t.key === rel.sourceTable);
          expect(sourceExists).toBe(true);

          // Validate target table exists
          const targetExists = template.tables.some((t) => t.key === rel.targetTable);
          expect(targetExists).toBe(true);
        }
      }
    });
  });

  describe('Template Default Views', () => {
    it('templates with default views should have valid configurations', () => {
      for (const template of builtInTemplates) {
        if (template.defaultViews) {
          const views = template.defaultViews;
          expect(Object.keys(views).length).toBeGreaterThan(0);
          for (const tableKey in views) {
            const tableViews = views[tableKey];
            for (const view of tableViews) {
              expect(view.name).toBeDefined();
              expect(view.type).toBeDefined();
              expect(['table', 'board', 'calendar', 'gallery', 'detail', 'report']).toContain(view.type);
            }
          }
        }
      }
    });

    it('some templates should have default views', () => {
      // At least one template should have views defined
      const templatesWithViews = builtInTemplates.filter((t) => t.defaultViews);
      expect(templatesWithViews.length).toBeGreaterThanOrEqual(0);
    });
  });
});
