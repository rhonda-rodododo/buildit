/**
 * Built-in Database Templates
 * Pre-configured templates for common use cases
 */

import { DatabaseTemplate } from '../types';
import type { CustomField } from '@/modules/custom-fields/types';
import { nanoid } from 'nanoid';

const now = Date.now();

/**
 * Helper to create a field
 */
function createField(
  name: string,
  label: string,
  widget: CustomField['widget']['widget'],
  options?: { required?: boolean; placeholder?: string; helpText?: string; options?: Array<{ value: string; label: string }> }
): CustomField {
  const fieldDef: CustomField = {
    id: nanoid(),
    groupId: '',
    entityType: 'database-record',
    name,
    label,
    schema: {
      type: widget === 'multi-select' ? 'array' : widget === 'number' ? 'number' : widget === 'checkbox' ? 'boolean' : 'string',
      title: label,
      required: options?.required || false,
    },
    widget: {
      widget,
      placeholder: options?.placeholder,
      helpText: options?.helpText,
      options: options?.options,
    },
    order: 0,
    created: now,
    createdBy: 'system',
    updated: now,
  };

  if (options?.options) {
    fieldDef.schema.enum = options.options.map((o) => o.value);
    fieldDef.schema.enumLabels = options.options.map((o) => o.label);
  }

  return fieldDef;
}

/**
 * Contact Management Template
 */
export const CONTACT_TEMPLATE: DatabaseTemplate = {
  id: 'template-contact-basic',
  name: 'Contact Management',
  description: 'Basic contact database with essential fields for managing people and organizations',
  category: 'general',
  icon: 'Users',
  tables: [
    {
      name: 'Contacts',
      description: 'People and organizations',
      fields: [
        createField('first_name', 'First Name', 'text', { required: true, placeholder: 'John' }),
        createField('last_name', 'Last Name', 'text', { required: true, placeholder: 'Doe' }),
        createField('email', 'Email', 'text', { placeholder: 'john@example.com' }),
        createField('phone', 'Phone', 'text', { placeholder: '+1 (555) 123-4567' }),
        createField('organization', 'Organization', 'text', { placeholder: 'Acme Inc.' }),
        createField('title', 'Title', 'text', { placeholder: 'Senior Developer' }),
        createField('status', 'Status', 'select', {
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'prospect', label: 'Prospect' },
          ],
        }),
        createField('tags', 'Tags', 'multi-select', {
          options: [
            { value: 'client', label: 'Client' },
            { value: 'partner', label: 'Partner' },
            { value: 'vendor', label: 'Vendor' },
            { value: 'member', label: 'Member' },
          ],
        }),
        createField('notes', 'Notes', 'textarea'),
        createField('last_contact', 'Last Contact', 'date'),
      ],
    },
  ],
  relationships: [],
  isBuiltIn: true,
  created: now,
  updated: now,
};

/**
 * Project Tracker Template
 */
export const PROJECT_TEMPLATE: DatabaseTemplate = {
  id: 'template-project-tracker',
  name: 'Project Tracker',
  description: 'Track projects, tasks, and milestones with related tables',
  category: 'project',
  icon: 'Briefcase',
  tables: [
    {
      name: 'Projects',
      description: 'Main projects',
      fields: [
        createField('name', 'Project Name', 'text', { required: true }),
        createField('description', 'Description', 'textarea'),
        createField('status', 'Status', 'select', {
          required: true,
          options: [
            { value: 'planning', label: 'Planning' },
            { value: 'in-progress', label: 'In Progress' },
            { value: 'on-hold', label: 'On Hold' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ],
        }),
        createField('priority', 'Priority', 'select', {
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ],
        }),
        createField('start_date', 'Start Date', 'date'),
        createField('end_date', 'End Date', 'date'),
        createField('budget', 'Budget', 'number'),
      ],
    },
    {
      name: 'Tasks',
      description: 'Project tasks',
      fields: [
        createField('task_name', 'Task Name', 'text', { required: true }),
        createField('description', 'Description', 'textarea'),
        createField('project', 'Project', 'relationship'),
        createField('status', 'Status', 'select', {
          required: true,
          options: [
            { value: 'todo', label: 'To Do' },
            { value: 'in-progress', label: 'In Progress' },
            { value: 'review', label: 'In Review' },
            { value: 'done', label: 'Done' },
          ],
        }),
        createField('assignee', 'Assignee', 'text'),
        createField('due_date', 'Due Date', 'date'),
        createField('estimated_hours', 'Estimated Hours', 'number'),
        createField('actual_hours', 'Actual Hours', 'number'),
      ],
    },
  ],
  relationships: [
    {
      sourceTableName: 'Tasks',
      sourceFieldName: 'project',
      targetTableName: 'Projects',
      targetFieldName: 'name',
      type: 'many-to-one',
      onDelete: 'cascade',
    },
  ],
  isBuiltIn: true,
  created: now,
  updated: now,
};

/**
 * Inventory Management Template
 */
export const INVENTORY_TEMPLATE: DatabaseTemplate = {
  id: 'template-inventory',
  name: 'Inventory Management',
  description: 'Track inventory, stock levels, and suppliers',
  category: 'inventory',
  icon: 'Package',
  tables: [
    {
      name: 'Products',
      description: 'Products and items',
      fields: [
        createField('sku', 'SKU', 'text', { required: true, placeholder: 'PROD-001' }),
        createField('name', 'Product Name', 'text', { required: true }),
        createField('description', 'Description', 'textarea'),
        createField('category', 'Category', 'select', {
          options: [
            { value: 'electronics', label: 'Electronics' },
            { value: 'clothing', label: 'Clothing' },
            { value: 'food', label: 'Food' },
            { value: 'tools', label: 'Tools' },
            { value: 'other', label: 'Other' },
          ],
        }),
        createField('quantity', 'Quantity in Stock', 'number', { required: true }),
        createField('reorder_level', 'Reorder Level', 'number'),
        createField('unit_price', 'Unit Price', 'number'),
        createField('supplier', 'Supplier', 'relationship'),
        createField('location', 'Storage Location', 'text'),
        createField('last_restocked', 'Last Restocked', 'date'),
      ],
    },
    {
      name: 'Suppliers',
      description: 'Supplier information',
      fields: [
        createField('supplier_name', 'Supplier Name', 'text', { required: true }),
        createField('contact_person', 'Contact Person', 'text'),
        createField('email', 'Email', 'text'),
        createField('phone', 'Phone', 'text'),
        createField('address', 'Address', 'textarea'),
        createField('rating', 'Rating', 'select', {
          options: [
            { value: '5', label: '⭐⭐⭐⭐⭐' },
            { value: '4', label: '⭐⭐⭐⭐' },
            { value: '3', label: '⭐⭐⭐' },
            { value: '2', label: '⭐⭐' },
            { value: '1', label: '⭐' },
          ],
        }),
      ],
    },
  ],
  relationships: [
    {
      sourceTableName: 'Products',
      sourceFieldName: 'supplier',
      targetTableName: 'Suppliers',
      targetFieldName: 'supplier_name',
      type: 'many-to-one',
      onDelete: 'set-null',
    },
  ],
  isBuiltIn: true,
  created: now,
  updated: now,
};

/**
 * Event Planning Template
 */
export const EVENT_TEMPLATE: DatabaseTemplate = {
  id: 'template-event-planning',
  name: 'Event Planning',
  description: 'Organize events, attendees, and vendors',
  category: 'general',
  icon: 'Calendar',
  tables: [
    {
      name: 'Events',
      description: 'Events and gatherings',
      fields: [
        createField('event_name', 'Event Name', 'text', { required: true }),
        createField('description', 'Description', 'textarea'),
        createField('event_type', 'Event Type', 'select', {
          options: [
            { value: 'conference', label: 'Conference' },
            { value: 'workshop', label: 'Workshop' },
            { value: 'meetup', label: 'Meetup' },
            { value: 'party', label: 'Party' },
            { value: 'fundraiser', label: 'Fundraiser' },
          ],
        }),
        createField('start_date', 'Start Date & Time', 'datetime', { required: true }),
        createField('end_date', 'End Date & Time', 'datetime'),
        createField('location', 'Location', 'text'),
        createField('capacity', 'Capacity', 'number'),
        createField('status', 'Status', 'select', {
          options: [
            { value: 'planning', label: 'Planning' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'completed', label: 'Completed' },
          ],
        }),
      ],
    },
    {
      name: 'Attendees',
      description: 'Event attendees',
      fields: [
        createField('name', 'Name', 'text', { required: true }),
        createField('email', 'Email', 'text', { required: true }),
        createField('event', 'Event', 'relationship'),
        createField('ticket_type', 'Ticket Type', 'select', {
          options: [
            { value: 'general', label: 'General Admission' },
            { value: 'vip', label: 'VIP' },
            { value: 'staff', label: 'Staff' },
            { value: 'speaker', label: 'Speaker' },
          ],
        }),
        createField('checked_in', 'Checked In', 'checkbox'),
        createField('dietary_preferences', 'Dietary Preferences', 'multi-select', {
          options: [
            { value: 'vegetarian', label: 'Vegetarian' },
            { value: 'vegan', label: 'Vegan' },
            { value: 'gluten-free', label: 'Gluten-Free' },
            { value: 'halal', label: 'Halal' },
            { value: 'kosher', label: 'Kosher' },
          ],
        }),
      ],
    },
  ],
  relationships: [
    {
      sourceTableName: 'Attendees',
      sourceFieldName: 'event',
      targetTableName: 'Events',
      targetFieldName: 'event_name',
      type: 'many-to-one',
      onDelete: 'cascade',
    },
  ],
  isBuiltIn: true,
  created: now,
  updated: now,
};

/**
 * All built-in templates
 */
export const BUILT_IN_TEMPLATES: DatabaseTemplate[] = [
  CONTACT_TEMPLATE,
  PROJECT_TEMPLATE,
  INVENTORY_TEMPLATE,
  EVENT_TEMPLATE,
];
