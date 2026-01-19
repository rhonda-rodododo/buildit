/**
 * Field Visibility Utilities
 * Functions for evaluating conditional visibility and required rules
 */

import type { FieldVisibilityRule, CustomField, CustomFieldValues } from './types';

/**
 * Evaluate a single visibility rule against current form values
 */
export function evaluateVisibilityRule(
  rule: FieldVisibilityRule,
  values: CustomFieldValues
): boolean {
  const fieldValue = values[rule.field];
  const compareValue = rule.value;

  switch (rule.operator) {
    case 'empty':
      return (
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case 'not-empty':
      return !(
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case 'equals':
      // Handle array comparison
      if (Array.isArray(fieldValue) && Array.isArray(compareValue)) {
        return (
          fieldValue.length === compareValue.length &&
          fieldValue.every((v, i) => v === compareValue[i])
        );
      }
      return fieldValue === compareValue;

    case 'not-equals':
      if (Array.isArray(fieldValue) && Array.isArray(compareValue)) {
        return !(
          fieldValue.length === compareValue.length &&
          fieldValue.every((v, i) => v === compareValue[i])
        );
      }
      return fieldValue !== compareValue;

    case 'contains':
      // String contains
      if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
        return fieldValue.toLowerCase().includes(compareValue.toLowerCase());
      }
      // Array contains
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(compareValue);
      }
      return false;

    case 'not-contains':
      if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
        return !fieldValue.toLowerCase().includes(compareValue.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(compareValue);
      }
      return true;

    case 'greater-than':
      if (typeof fieldValue === 'number' && typeof compareValue === 'number') {
        return fieldValue > compareValue;
      }
      // Date comparison
      if (fieldValue && compareValue) {
        const dateA = new Date(String(fieldValue)).getTime();
        const dateB = new Date(String(compareValue)).getTime();
        if (!isNaN(dateA) && !isNaN(dateB)) {
          return dateA > dateB;
        }
      }
      return false;

    case 'less-than':
      if (typeof fieldValue === 'number' && typeof compareValue === 'number') {
        return fieldValue < compareValue;
      }
      // Date comparison
      if (fieldValue && compareValue) {
        const dateA = new Date(String(fieldValue)).getTime();
        const dateB = new Date(String(compareValue)).getTime();
        if (!isNaN(dateA) && !isNaN(dateB)) {
          return dateA < dateB;
        }
      }
      return false;

    case 'in':
      // Check if fieldValue is in the compareValue array
      if (Array.isArray(compareValue)) {
        return compareValue.includes(fieldValue);
      }
      return false;

    case 'not-in':
      if (Array.isArray(compareValue)) {
        return !compareValue.includes(fieldValue);
      }
      return true;

    default:
      return true;
  }
}

/**
 * Evaluate all visibility rules for a field (AND logic)
 * Returns true if field should be visible
 */
export function evaluateFieldVisibility(
  field: CustomField,
  values: CustomFieldValues
): boolean {
  // If no visibility rules, field is always visible
  if (!field.visibilityRules || field.visibilityRules.length === 0) {
    return true;
  }

  // ALL rules must pass (AND logic)
  return field.visibilityRules.every((rule) =>
    evaluateVisibilityRule(rule, values)
  );
}

/**
 * Evaluate dynamic required rules for a field (AND logic)
 * Returns true if field should be required
 */
export function evaluateFieldRequired(
  field: CustomField,
  values: CustomFieldValues
): boolean {
  // If the schema says required, it's always required
  if (field.schema.required) {
    return true;
  }

  // If no requiredIf rules, use the schema required value
  if (!field.requiredIf || field.requiredIf.length === 0) {
    return false;
  }

  // ALL rules must pass for field to be required (AND logic)
  return field.requiredIf.every((rule) =>
    evaluateVisibilityRule(rule, values)
  );
}

/**
 * Get visible fields from a list of fields based on current values
 */
export function getVisibleFields(
  fields: CustomField[],
  values: CustomFieldValues
): CustomField[] {
  return fields.filter((field) => evaluateFieldVisibility(field, values));
}

/**
 * Get required fields from a list of fields based on current values
 * Returns the field names that are required
 */
export function getRequiredFieldNames(
  fields: CustomField[],
  values: CustomFieldValues
): string[] {
  return fields
    .filter((field) => evaluateFieldRequired(field, values))
    .map((field) => field.name);
}

/**
 * Validate required fields based on current values
 * Returns an object with field names as keys and error messages as values
 */
export function validateRequiredFields(
  fields: CustomField[],
  values: CustomFieldValues
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    // Skip if field is not visible
    if (!evaluateFieldVisibility(field, values)) {
      continue;
    }

    // Check if field is required
    const isRequired = evaluateFieldRequired(field, values);
    if (!isRequired) {
      continue;
    }

    // Check if field has a value
    const value = values[field.name];
    const isEmpty =
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      errors[field.name] = `${field.label} is required`;
    }
  }

  return errors;
}

/**
 * Create visibility rule helpers for common patterns
 */
export const visibilityRuleHelpers = {
  /**
   * Create a rule that shows field when another field equals a value
   */
  whenEquals: (field: string, value: unknown): FieldVisibilityRule => ({
    field,
    operator: 'equals',
    value,
  }),

  /**
   * Create a rule that shows field when another field is not empty
   */
  whenNotEmpty: (field: string): FieldVisibilityRule => ({
    field,
    operator: 'not-empty',
  }),

  /**
   * Create a rule that shows field when another field is empty
   */
  whenEmpty: (field: string): FieldVisibilityRule => ({
    field,
    operator: 'empty',
  }),

  /**
   * Create a rule that shows field when another field is in a list of values
   */
  whenIn: (field: string, values: unknown[]): FieldVisibilityRule => ({
    field,
    operator: 'in',
    value: values,
  }),

  /**
   * Create a rule that shows field when checkbox is checked
   */
  whenChecked: (field: string): FieldVisibilityRule => ({
    field,
    operator: 'equals',
    value: true,
  }),

  /**
   * Create a rule that shows field when checkbox is unchecked
   */
  whenUnchecked: (field: string): FieldVisibilityRule => ({
    field,
    operator: 'equals',
    value: false,
  }),
};
