import { z } from 'zod'
import type { IndexabilitySettings } from '@/types/indexability'
import { DEFAULT_INDEXABILITY } from '@/types/indexability'

/**
 * Page status enum (matches protocol)
 */
export const PageStatusSchema = z.enum(['draft', 'published', 'archived', 'deleted', 'review'])
export type PageStatus = z.infer<typeof PageStatusSchema>

/**
 * Page visibility enum (matches protocol)
 */
export const PageVisibilitySchema = z.enum(['public', 'group', 'private', 'role-restricted'])
export type PageVisibility = z.infer<typeof PageVisibilitySchema>

/**
 * Page permissions object (matches protocol)
 */
export const PagePermissionsSchema = z.object({
  allowComments: z.boolean().optional(),
  allowSuggestions: z.boolean().optional(),
  editRoles: z.array(z.string()).optional(),
  viewRoles: z.array(z.string()).optional(),
})
export type PagePermissions = z.infer<typeof PagePermissionsSchema>

/**
 * Indexability settings schema for zod validation
 */
export const IndexabilitySettingsSchema = z.object({
  isSearchIndexable: z.boolean(),
  isAiIndexable: z.boolean(),
  noArchive: z.boolean().optional(),
})

export const WikiPageSchema = z.object({
  // Schema version for graceful degradation (protocol field)
  _v: z.string().default('1.0.0'),

  // Core fields
  id: z.string(),
  groupId: z.string(),
  title: z.string().min(1).max(200),
  slug: z.string(), // URL-friendly identifier (protocol field)
  content: z.string(),

  // Organization
  categoryId: z.string().optional(), // Protocol uses categoryId (not category)
  tags: z.array(z.string()).default([]),
  parentId: z.string().optional(), // Parent page for hierarchy

  // Status and visibility (protocol fields)
  status: PageStatusSchema.default('draft'),
  visibility: PageVisibilitySchema.default('group'),
  permissions: PagePermissionsSchema.optional(),

  // Versioning
  version: z.number().int().min(1),

  // Timestamps (protocol uses 'At' suffix)
  createdAt: z.number(),
  createdBy: z.string(), // pubkey
  updatedAt: z.number(),
  lastEditedBy: z.string().optional(), // pubkey of last editor

  // Optional protocol fields
  summary: z.string().optional(), // Brief summary for search
  aliases: z.array(z.string()).optional(), // Alternative slugs
  contributors: z.array(z.string()).optional(), // All contributors
  archivedAt: z.number().optional(),
  deletedAt: z.number().optional(),
  publishedAt: z.number().optional(),
  lockedBy: z.string().optional(),
  lockedAt: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),

  // Custom extension: indexability for search engines
  indexability: IndexabilitySettingsSchema.default(DEFAULT_INDEXABILITY),
})

export type WikiPage = z.infer<typeof WikiPageSchema>

/**
 * Page revision (matches protocol PageRevision)
 */
export const WikiPageRevisionSchema = z.object({
  _v: z.string().default('1.0.0'),
  id: z.string(),
  pageId: z.string(),
  version: z.number().int().min(1),
  title: z.string().optional(), // If title changed
  content: z.string(),
  diff: z.string().optional(), // Unified diff from previous
  summary: z.string().optional(), // Edit summary
  editedBy: z.string(), // pubkey
  createdAt: z.number(),
  editType: z.enum(['create', 'edit', 'revert', 'merge', 'move']).optional(),
  revertedFrom: z.number().optional(), // Version if revert
})

export type WikiPageRevision = z.infer<typeof WikiPageRevisionSchema>

/**
 * Wiki category (matches protocol WikiCategory)
 */
export const WikiCategorySchema = z.object({
  _v: z.string().default('1.0.0'),
  id: z.string(),
  groupId: z.string(),
  name: z.string().min(1).max(100),
  slug: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  order: z.number().optional(),
  parentId: z.string().optional(),
  pageCount: z.number().default(0),
  createdAt: z.number(),
  createdBy: z.string(),
  updatedAt: z.number().optional(),
})

export type WikiCategory = z.infer<typeof WikiCategorySchema>

/**
 * Create page input (form data)
 */
export interface CreatePageInput {
  groupId: string
  title: string
  content: string
  categoryId?: string
  tags?: string[]
  visibility?: PageVisibility
  status?: PageStatus
  summary?: string
  indexability?: Partial<IndexabilitySettings>
}

/**
 * Update page input (form data)
 */
export interface UpdatePageInput {
  pageId: string
  title?: string
  content?: string
  categoryId?: string
  tags?: string[]
  status?: PageStatus
  visibility?: PageVisibility
  summary?: string
  changeDescription?: string // For revision summary
  indexability?: Partial<IndexabilitySettings>
}

// Re-export indexability types for convenience
export type { IndexabilitySettings }
export { DEFAULT_INDEXABILITY }

// Helper function to generate slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
}
