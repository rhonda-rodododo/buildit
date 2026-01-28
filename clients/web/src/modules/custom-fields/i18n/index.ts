/**
 * Custom Fields Module Translations
 */

import { defineModuleTranslations } from '@/i18n/moduleI18n';

export default defineModuleTranslations({
  en: {
    title: 'Custom Fields',
    addField: 'Add Field',
    noFields: 'No custom fields',
    fieldName: 'Field Name',
    fieldType: 'Field Type',
    required: 'Required',
    optional: 'Optional',
    defaultValue: 'Default Value',
    placeholder: 'Placeholder',
    options: 'Options',
    validation: 'Validation',
    types: {
      text: 'Text',
      number: 'Number',
      date: 'Date',
      select: 'Select',
      multiselect: 'Multi-Select',
      checkbox: 'Checkbox',
      file: 'File',
      relationship: 'Relationship',
    },
    notSet: 'Not set',
    additionalInformation: 'Additional Information',
    unknownFieldType: 'Unknown field type: {{type}}',
    relationshipTo: 'Relationship to: {{type}}',
    noneSelected: 'None selected',
    yes: 'Yes',
    no: 'No',
    meta: {
      description: 'Define custom fields for forms and data collection.',
    },
  },
  es: {},
  fr: {},
  ar: {},
});
