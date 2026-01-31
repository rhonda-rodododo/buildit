/**
 * Wiki Module Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * UI-only types (CreatePageInput, UpdatePageInput) are defined here.
 */

import type { IndexabilitySettings } from '@/types/indexability';
import { DEFAULT_INDEXABILITY } from '@/types/indexability';

// Re-export all generated Zod schemas and types
export {
  PageStatusSchema,
  type PageStatus,
  PageVisibilitySchema,
  type PageVisibility,
  PagePermissionsSchema,
  type PagePermissions,
  WikiPageSchema,
  type WikiPage,
  PageRevisionSchema,
  type PageRevision,
  WikiCategorySchema,
  type WikiCategory,
  WikiLinkSchema,
  type WikiLink,
  PageCommentSchema,
  type PageComment,
  EditSuggestionSchema,
  type EditSuggestion,
  WikiSearchSchema,
  type WikiSearch,
  WIKI_SCHEMA_VERSION,
} from '@/generated/validation/wiki.zod';

// Re-export revision type with legacy alias
export type { PageRevision as WikiPageRevision } from '@/generated/validation/wiki.zod';

// Re-export indexability types for convenience
export type { IndexabilitySettings };
export { DEFAULT_INDEXABILITY };

/**
 * Create page input (form data — UI-only type)
 */
export interface CreatePageInput {
  groupId: string;
  title: string;
  content: string;
  categoryId?: string;
  tags?: string[];
  visibility?: import('@/generated/validation/wiki.zod').PageVisibility;
  status?: import('@/generated/validation/wiki.zod').PageStatus;
  summary?: string;
  indexability?: Partial<IndexabilitySettings>;
}

/**
 * Update page input (form data — UI-only type)
 */
export interface UpdatePageInput {
  pageId: string;
  title?: string;
  content?: string;
  categoryId?: string;
  tags?: string[];
  status?: import('@/generated/validation/wiki.zod').PageStatus;
  visibility?: import('@/generated/validation/wiki.zod').PageVisibility;
  summary?: string;
  changeDescription?: string;
  indexability?: Partial<IndexabilitySettings>;
}

/**
 * Generate URL-friendly slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}
