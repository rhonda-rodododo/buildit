/**
 * Template Manager
 * Manages canned responses for messaging hotline with variable substitution
 */

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  shortcut?: string;
  category?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateContext {
  hotline_name?: string;
  operator_name?: string;
  caller_name?: string;
  date?: string;
  time?: string;
  [key: string]: string | undefined;
}

const DEFAULT_TEMPLATES: Omit<MessageTemplate, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'greeting',
    name: 'Greeting',
    content: 'Thank you for contacting {{hotline_name}}. My name is {{operator_name}} and I\'m here to help you. How can I assist you today?',
    variables: ['hotline_name', 'operator_name'],
    shortcut: 'Ctrl+G',
    category: 'General',
    isDefault: true,
  },
  {
    id: 'info_request',
    name: 'Request Info',
    content: 'To help you better, could you please provide some additional information about your situation? Specifically, I\'d like to know:\n\n1. When did this occur?\n2. Who was involved?\n3. What happened?',
    variables: [],
    shortcut: 'Ctrl+I',
    category: 'General',
    isDefault: true,
  },
  {
    id: 'followup',
    name: 'Follow-up Scheduled',
    content: 'Thank you for the information, {{caller_name}}. We\'ll follow up with you within 24-48 hours. If you have any additional questions or concerns in the meantime, please don\'t hesitate to reach out.',
    variables: ['caller_name'],
    category: 'General',
    isDefault: true,
  },
  {
    id: 'resolved',
    name: 'Resolution',
    content: 'I\'m glad we could help resolve your concern today, {{caller_name}}. Is there anything else I can assist you with before we close this conversation?',
    variables: ['caller_name'],
    shortcut: 'Ctrl+R',
    category: 'General',
    isDefault: true,
  },
  {
    id: 'hold_on',
    name: 'Please Hold',
    content: 'Thank you for your patience. I\'m looking into this for you and will respond shortly.',
    variables: [],
    shortcut: 'Ctrl+H',
    category: 'General',
    isDefault: true,
  },
  {
    id: 'transfer_notice',
    name: 'Transfer Notice',
    content: 'I\'m going to transfer you to a colleague who can better assist with this matter. They\'ll have access to our conversation so you won\'t need to repeat yourself. Please hold.',
    variables: [],
    category: 'General',
    isDefault: true,
  },
  {
    id: 'after_hours',
    name: 'After Hours',
    content: 'Thank you for contacting {{hotline_name}}. Our team is currently unavailable. Our normal hours are Monday-Friday, 9 AM - 5 PM. We\'ll respond to your message during the next business day.',
    variables: ['hotline_name'],
    category: 'Auto-Response',
    isDefault: true,
  },
  {
    id: 'emergency_resources',
    name: 'Emergency Resources',
    content: 'If you\'re experiencing an emergency, please call 911. For mental health crisis support, you can reach the 988 Suicide & Crisis Lifeline by calling or texting 988. We\'re here to support you.',
    variables: [],
    shortcut: 'Ctrl+E',
    category: 'Safety',
    isDefault: true,
  },
  {
    id: 'legal_disclaimer',
    name: 'Legal Disclaimer',
    content: 'Please note that the information provided here is for general guidance only and does not constitute legal advice. For specific legal questions, please consult with a qualified attorney.',
    variables: [],
    category: 'Legal',
    isDefault: true,
  },
  {
    id: 'know_your_rights',
    name: 'Know Your Rights',
    content: 'Here are some important things to remember:\n\n• You have the right to remain silent\n• You have the right to refuse consent to search\n• You have the right to speak with an attorney\n• You have the right to make a local phone call\n\nIf you\'re being questioned, you can say "I wish to remain silent" and "I want to speak to a lawyer."',
    variables: [],
    shortcut: 'Ctrl+K',
    category: 'Legal',
    isDefault: true,
  },
];

export class TemplateManager {
  private templates: Map<string, MessageTemplate> = new Map();
  private shortcuts: Map<string, string> = new Map(); // shortcut -> template id

  constructor() {
    this.loadDefaultTemplates();
  }

  /**
   * Load default templates
   */
  private loadDefaultTemplates(): void {
    const now = Date.now();
    DEFAULT_TEMPLATES.forEach((template) => {
      const fullTemplate: MessageTemplate = {
        ...template,
        createdAt: now,
        updatedAt: now,
      };
      this.templates.set(template.id, fullTemplate);
      if (template.shortcut) {
        this.shortcuts.set(template.shortcut, template.id);
      }
    });
  }

  /**
   * Get all templates
   */
  getAll(): MessageTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getByCategory(category: string): MessageTemplate[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /**
   * Get template by ID
   */
  get(id: string): MessageTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get template by shortcut
   */
  getByShortcut(shortcut: string): MessageTemplate | undefined {
    const id = this.shortcuts.get(shortcut);
    return id ? this.templates.get(id) : undefined;
  }

  /**
   * Add a new template
   */
  add(template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'>): MessageTemplate {
    const id = crypto.randomUUID();
    const now = Date.now();

    const fullTemplate: MessageTemplate = {
      ...template,
      id,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(id, fullTemplate);

    if (template.shortcut) {
      // Remove any existing shortcut mapping
      this.removeShortcut(template.shortcut);
      this.shortcuts.set(template.shortcut, id);
    }

    return fullTemplate;
  }

  /**
   * Update an existing template
   */
  update(id: string, updates: Partial<Omit<MessageTemplate, 'id' | 'createdAt' | 'isDefault'>>): MessageTemplate | undefined {
    const template = this.templates.get(id);
    if (!template) return undefined;

    // Don't allow modifying default templates
    if (template.isDefault && Object.keys(updates).length > 0) {
      // Create a copy instead
      const copy = this.add({
        name: updates.name || template.name,
        content: updates.content || template.content,
        variables: updates.variables || template.variables,
        shortcut: updates.shortcut,
        category: updates.category || template.category,
      });
      return copy;
    }

    // Update shortcut mapping if changed
    if (updates.shortcut !== undefined && updates.shortcut !== template.shortcut) {
      if (template.shortcut) {
        this.shortcuts.delete(template.shortcut);
      }
      if (updates.shortcut) {
        this.removeShortcut(updates.shortcut);
        this.shortcuts.set(updates.shortcut, id);
      }
    }

    const updated: MessageTemplate = {
      ...template,
      ...updates,
      updatedAt: Date.now(),
    };

    this.templates.set(id, updated);
    return updated;
  }

  /**
   * Delete a template
   */
  delete(id: string): boolean {
    const template = this.templates.get(id);
    if (!template) return false;

    // Don't allow deleting default templates
    if (template.isDefault) return false;

    if (template.shortcut) {
      this.shortcuts.delete(template.shortcut);
    }

    return this.templates.delete(id);
  }

  /**
   * Remove a shortcut from all templates
   */
  private removeShortcut(shortcut: string): void {
    const existingId = this.shortcuts.get(shortcut);
    if (existingId) {
      const template = this.templates.get(existingId);
      if (template && !template.isDefault) {
        template.shortcut = undefined;
        template.updatedAt = Date.now();
      }
      this.shortcuts.delete(shortcut);
    }
  }

  /**
   * Apply template with context variables
   */
  apply(template: MessageTemplate, context: TemplateContext): string {
    let content = template.content;

    // Add automatic date/time if not provided
    const now = new Date();
    const fullContext: TemplateContext = {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...context,
    };

    // Replace all variables
    for (const [key, value] of Object.entries(fullContext)) {
      if (value) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        content = content.replace(regex, value);
      }
    }

    // Remove any unreplaced variables
    content = content.replace(/{{[^}]+}}/g, '');

    return content;
  }

  /**
   * Apply template by ID
   */
  applyById(id: string, context: TemplateContext): string | undefined {
    const template = this.templates.get(id);
    return template ? this.apply(template, context) : undefined;
  }

  /**
   * Extract variables from content
   */
  extractVariables(content: string): string[] {
    const matches = content.matchAll(/{{(\w+)}}/g);
    return [...new Set(Array.from(matches, (m) => m[1]))];
  }

  /**
   * Get all unique categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.templates.forEach((t) => {
      if (t.category) categories.add(t.category);
    });
    return Array.from(categories).sort();
  }

  /**
   * Search templates by name or content
   */
  search(query: string): MessageTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.content.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get all shortcuts
   */
  getShortcuts(): Map<string, string> {
    return new Map(this.shortcuts);
  }

  /**
   * Handle keyboard shortcut
   */
  handleShortcut(event: KeyboardEvent, context: TemplateContext): string | null {
    const shortcut = this.buildShortcutString(event);
    const template = this.getByShortcut(shortcut);
    if (template) {
      event.preventDefault();
      return this.apply(template, context);
    }
    return null;
  }

  /**
   * Build shortcut string from keyboard event
   */
  private buildShortcutString(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    parts.push(event.key.toUpperCase());
    return parts.join('+');
  }
}

// Singleton instance
export const templateManager = new TemplateManager();
