/**
 * Field Templates Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { getTemplatesByEntityType, getTemplateById, EVENT_TEMPLATES, MUTUAL_AID_TEMPLATES } from '../templates';

describe('Field Templates', () => {
  describe('EVENT_TEMPLATES', () => {
    it('should have dietary preferences template', () => {
      const template = EVENT_TEMPLATES.find(t => t.id === 'event-dietary');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Dietary Preferences');
      expect(template?.fields.length).toBeGreaterThan(0);
    });

    it('should have accessibility template', () => {
      const template = EVENT_TEMPLATES.find(t => t.id === 'event-accessibility');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Accessibility Needs');
    });

    it('should have skills template', () => {
      const template = EVENT_TEMPLATES.find(t => t.id === 'event-skills');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Skills & Experience');
    });
  });

  describe('MUTUAL_AID_TEMPLATES', () => {
    it('should have medical support template', () => {
      const template = MUTUAL_AID_TEMPLATES.find(t => t.id === 'aid-medical');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Medical Support');
    });

    it('should have housing support template', () => {
      const template = MUTUAL_AID_TEMPLATES.find(t => t.id === 'aid-housing');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Housing Support');
    });
  });

  describe('getTemplatesByEntityType', () => {
    it('should return event templates for event entity', () => {
      const templates = getTemplatesByEntityType('event');
      expect(templates).toEqual(EVENT_TEMPLATES);
    });

    it('should return mutual aid templates for aid-request entity', () => {
      const templates = getTemplatesByEntityType('aid-request');
      expect(templates).toEqual(MUTUAL_AID_TEMPLATES);
    });

    it('should return empty array for unknown entity type', () => {
      const templates = getTemplatesByEntityType('contact' as any);
      expect(templates).toEqual([]);
    });
  });

  describe('getTemplateById', () => {
    it('should find event template by id', () => {
      const template = getTemplateById('event-dietary');
      expect(template).toBeDefined();
      expect(template?.id).toBe('event-dietary');
    });

    it('should find mutual aid template by id', () => {
      const template = getTemplateById('aid-medical');
      expect(template).toBeDefined();
      expect(template?.id).toBe('aid-medical');
    });

    it('should return undefined for unknown id', () => {
      const template = getTemplateById('non-existent');
      expect(template).toBeUndefined();
    });
  });

  describe('Template Structure', () => {
    it('should have proper field structure', () => {
      const template = EVENT_TEMPLATES[0];
      const field = template.fields[0];

      expect(field.name).toBeDefined();
      expect(field.label).toBeDefined();
      expect(field.schema).toBeDefined();
      expect(field.widget).toBeDefined();
      expect(field.order).toBeGreaterThanOrEqual(0);
    });

    it('should have widget configuration', () => {
      const template = EVENT_TEMPLATES.find(t => t.id === 'event-dietary');
      const multiSelectField = template?.fields.find(f => f.widget.widget === 'multi-select');

      expect(multiSelectField).toBeDefined();
      expect(multiSelectField?.widget.options).toBeDefined();
      expect(multiSelectField?.widget.options!.length).toBeGreaterThan(0);
    });
  });
});
