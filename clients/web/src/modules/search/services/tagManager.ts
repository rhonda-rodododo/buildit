/**
 * Tag Manager Service
 * Manages user-defined tags with hierarchical support
 */

import { nanoid } from 'nanoid';
import type { Tag, TagWithChildren, EntityTag } from '../types';
import type { ModuleType } from '@/types/modules';
import type { DBTag, DBEntityTag } from '../schema';
import { dal } from '@/core/storage/dal';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

interface CreateTagInput {
  groupId: string;
  name: string;
  color?: string;
  parentTagId?: string;
  createdBy: string;
}

interface UpdateTagInput {
  name?: string;
  color?: string;
  parentTagId?: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a slug from a tag name
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert DB tag to Tag type
 */
function dbTagToTag(dbTag: DBTag): Tag {
  return {
    id: dbTag.id,
    groupId: dbTag.groupId,
    name: dbTag.name,
    slug: dbTag.slug,
    color: dbTag.color,
    parentTagId: dbTag.parentTagId,
    usageCount: dbTag.usageCount,
    createdAt: dbTag.createdAt,
    createdBy: dbTag.createdBy,
    updatedAt: dbTag.updatedAt,
  };
}

/**
 * Convert DB entity tag to EntityTag type
 */
function dbEntityTagToEntityTag(dbEntityTag: DBEntityTag): EntityTag {
  return {
    id: dbEntityTag.id,
    entityType: dbEntityTag.entityType,
    entityId: dbEntityTag.entityId,
    tagId: dbEntityTag.tagId,
    groupId: dbEntityTag.groupId,
    createdAt: dbEntityTag.createdAt,
    createdBy: dbEntityTag.createdBy,
  };
}

// ============================================================================
// Tag Manager Class
// ============================================================================

export class TagManager {
  /**
   * Create a new tag
   */
  async createTag(input: CreateTagInput): Promise<Tag> {
    const now = Date.now();
    const slug = slugify(input.name);

    // Check for duplicate slug in group
    const existing = await dal.queryCustom<DBTag>({
      sql: `SELECT * FROM tags WHERE group_id = ? AND slug = ? LIMIT 1`,
      params: [input.groupId, slug],
      dexieFallback: async (db: unknown) => {
        const dexieDb = db as { table: (name: string) => { where: (key: string) => { equals: (val: unknown[]) => { first: () => Promise<DBTag | undefined> } } } };
        const result = await dexieDb.table('tags').where('[groupId+slug]').equals([input.groupId, slug]).first();
        return result ? [result] : [];
      },
    });

    if (existing.length > 0) {
      throw new Error(`Tag "${input.name}" already exists in this group`);
    }

    // Validate parent tag if provided
    if (input.parentTagId) {
      const parent = await dal.get<DBTag>('tags', input.parentTagId);
      if (!parent) {
        throw new Error('Parent tag not found');
      }
      if (parent.groupId !== input.groupId) {
        throw new Error('Parent tag must be in the same group');
      }
      // Prevent deep nesting (max 2 levels)
      if (parent.parentTagId) {
        throw new Error('Tags can only be nested 2 levels deep');
      }
    }

    const tag: DBTag = {
      id: nanoid(),
      groupId: input.groupId,
      name: input.name,
      slug,
      color: input.color,
      parentTagId: input.parentTagId,
      usageCount: 0,
      createdAt: now,
      createdBy: input.createdBy,
      updatedAt: now,
    };

    await dal.add('tags', tag);
    logger.info('Created tag:', tag.name);

    return dbTagToTag(tag);
  }

  /**
   * Update a tag
   */
  async updateTag(tagId: string, input: UpdateTagInput): Promise<Tag> {
    const existing = await dal.get<DBTag>('tags', tagId);
    if (!existing) {
      throw new Error('Tag not found');
    }

    const updates: Partial<DBTag> = {
      updatedAt: Date.now(),
    };

    if (input.name !== undefined && input.name !== existing.name) {
      updates.name = input.name;
      updates.slug = slugify(input.name);

      // Check for duplicate slug
      const duplicates = await dal.queryCustom<DBTag>({
        sql: `SELECT * FROM tags WHERE group_id = ? AND slug = ? LIMIT 1`,
        params: [existing.groupId, updates.slug],
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { table: (name: string) => { where: (key: string) => { equals: (val: unknown[]) => { first: () => Promise<DBTag | undefined> } } } };
          const result = await dexieDb.table('tags').where('[groupId+slug]').equals([existing.groupId, updates.slug]).first();
          return result ? [result] : [];
        },
      });

      if (duplicates.length > 0 && duplicates[0].id !== tagId) {
        throw new Error(`Tag "${input.name}" already exists in this group`);
      }
    }

    if (input.color !== undefined) {
      updates.color = input.color;
    }

    if (input.parentTagId !== undefined) {
      if (input.parentTagId === null) {
        updates.parentTagId = undefined;
      } else {
        // Validate parent
        const parent = await dal.get<DBTag>('tags', input.parentTagId);
        if (!parent) {
          throw new Error('Parent tag not found');
        }
        if (parent.groupId !== existing.groupId) {
          throw new Error('Parent tag must be in the same group');
        }
        if (parent.parentTagId) {
          throw new Error('Tags can only be nested 2 levels deep');
        }
        if (parent.id === tagId) {
          throw new Error('Tag cannot be its own parent');
        }
        updates.parentTagId = input.parentTagId;
      }
    }

    await dal.update('tags', tagId, updates);

    const updated = await dal.get<DBTag>('tags', tagId);
    return dbTagToTag(updated!);
  }

  /**
   * Delete a tag
   */
  async deleteTag(tagId: string): Promise<void> {
    const tag = await dal.get<DBTag>('tags', tagId);
    if (!tag) {
      throw new Error('Tag not found');
    }

    // Move child tags to top level
    const children = await dal.query<DBTag>('tags', {
      whereClause: { parentTagId: tagId },
    });

    for (const child of children) {
      await dal.update('tags', child.id, {
        parentTagId: undefined,
        updatedAt: Date.now(),
      });
    }

    // Remove all entity-tag associations
    await dal.deleteWhere('entityTags', { tagId });

    // Delete the tag
    await dal.delete('tags', tagId);

    logger.info('Deleted tag:', tag.name);
  }

  /**
   * Get a tag by ID
   */
  async getTag(tagId: string): Promise<Tag | null> {
    const tag = await dal.get<DBTag>('tags', tagId);
    return tag ? dbTagToTag(tag) : null;
  }

  /**
   * Get all tags for a group
   */
  async getGroupTags(groupId: string): Promise<Tag[]> {
    const tags = await dal.query<DBTag>('tags', {
      whereClause: { groupId },
    });
    return tags.map(dbTagToTag);
  }

  /**
   * Get tags as a hierarchy
   */
  async getTagHierarchy(groupId: string): Promise<TagWithChildren[]> {
    const tags = await this.getGroupTags(groupId);

    // Build a map for quick lookup
    const tagMap = new Map<string, TagWithChildren>();
    const rootTags: TagWithChildren[] = [];

    // First pass: create TagWithChildren objects
    for (const tag of tags) {
      tagMap.set(tag.id, { ...tag, children: [] });
    }

    // Second pass: build hierarchy
    for (const tag of tags) {
      const tagWithChildren = tagMap.get(tag.id)!;

      if (tag.parentTagId) {
        const parent = tagMap.get(tag.parentTagId);
        if (parent) {
          parent.children.push(tagWithChildren);
        } else {
          // Parent not found, treat as root
          rootTags.push(tagWithChildren);
        }
      } else {
        rootTags.push(tagWithChildren);
      }
    }

    // Sort alphabetically
    const sortChildren = (tags: TagWithChildren[]): void => {
      tags.sort((a, b) => a.name.localeCompare(b.name));
      for (const tag of tags) {
        sortChildren(tag.children);
      }
    };

    sortChildren(rootTags);

    return rootTags;
  }

  /**
   * Search tags by name
   */
  async searchTags(groupId: string, query: string): Promise<Tag[]> {
    const tags = await this.getGroupTags(groupId);
    const lowerQuery = query.toLowerCase();

    return tags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(lowerQuery) ||
        tag.slug.includes(lowerQuery)
    );
  }

  /**
   * Add a tag to an entity
   */
  async addTagToEntity(
    entityType: ModuleType,
    entityId: string,
    tagId: string,
    groupId: string,
    createdBy: string
  ): Promise<EntityTag> {
    // Verify tag exists and belongs to the group
    const tag = await dal.get<DBTag>('tags', tagId);
    if (!tag) {
      throw new Error('Tag not found');
    }
    if (tag.groupId !== groupId) {
      throw new Error('Tag does not belong to this group');
    }

    // Check if already tagged
    const existing = await dal.queryCustom<DBEntityTag>({
      sql: `SELECT * FROM entity_tags WHERE entity_type = ? AND entity_id = ? AND tag_id = ? LIMIT 1`,
      params: [entityType, entityId, tagId],
      dexieFallback: async (db: unknown) => {
        const dexieDb = db as { table: (name: string) => { where: (key: string) => { equals: (val: unknown[]) => { and: (fn: (et: DBEntityTag) => boolean) => { first: () => Promise<DBEntityTag | undefined> } } } } };
        const result = await dexieDb.table('entityTags').where('[entityType+entityId]').equals([entityType, entityId]).and((et: DBEntityTag) => et.tagId === tagId).first();
        return result ? [result] : [];
      },
    });

    if (existing.length > 0) {
      return dbEntityTagToEntityTag(existing[0]);
    }

    const now = Date.now();
    const entityTag: DBEntityTag = {
      id: nanoid(),
      entityType,
      entityId,
      tagId,
      groupId,
      createdAt: now,
      createdBy,
    };

    await dal.add('entityTags', entityTag);

    // Increment usage count
    await dal.update('tags', tagId, {
      usageCount: tag.usageCount + 1,
      updatedAt: now,
    });

    return dbEntityTagToEntityTag(entityTag);
  }

  /**
   * Remove a tag from an entity
   */
  async removeTagFromEntity(
    entityType: ModuleType,
    entityId: string,
    tagId: string
  ): Promise<void> {
    const entityTags = await dal.queryCustom<DBEntityTag>({
      sql: `SELECT * FROM entity_tags WHERE entity_type = ? AND entity_id = ? AND tag_id = ? LIMIT 1`,
      params: [entityType, entityId, tagId],
      dexieFallback: async (db: unknown) => {
        const dexieDb = db as { table: (name: string) => { where: (key: string) => { equals: (val: unknown[]) => { and: (fn: (et: DBEntityTag) => boolean) => { first: () => Promise<DBEntityTag | undefined> } } } } };
        const result = await dexieDb.table('entityTags').where('[entityType+entityId]').equals([entityType, entityId]).and((et: DBEntityTag) => et.tagId === tagId).first();
        return result ? [result] : [];
      },
    });

    if (entityTags.length === 0) {
      return; // Already not tagged
    }

    await dal.delete('entityTags', entityTags[0].id);

    // Decrement usage count
    const tag = await dal.get<DBTag>('tags', tagId);
    if (tag && tag.usageCount > 0) {
      await dal.update('tags', tagId, {
        usageCount: tag.usageCount - 1,
        updatedAt: Date.now(),
      });
    }
  }

  /**
   * Get all tags for an entity
   */
  async getEntityTags(entityType: ModuleType, entityId: string): Promise<Tag[]> {
    const entityTags = await dal.queryCustom<DBEntityTag>({
      sql: `SELECT * FROM entity_tags WHERE entity_type = ? AND entity_id = ?`,
      params: [entityType, entityId],
      dexieFallback: async (db: unknown) => {
        const dexieDb = db as { table: (name: string) => { where: (key: string) => { equals: (val: unknown[]) => { toArray: () => Promise<DBEntityTag[]> } } } };
        return dexieDb.table('entityTags').where('[entityType+entityId]').equals([entityType, entityId]).toArray();
      },
    });

    if (entityTags.length === 0) return [];

    const tagIds = entityTags.map((et) => et.tagId);
    const tags = await dal.queryCustom<DBTag>({
      sql: `SELECT * FROM tags WHERE id IN (${tagIds.map(() => '?').join(',')})`,
      params: tagIds,
      dexieFallback: async (db: unknown) => {
        const dexieDb = db as { table: (name: string) => { where: (key: string) => { anyOf: (ids: string[]) => { toArray: () => Promise<DBTag[]> } } } };
        return dexieDb.table('tags').where('id').anyOf(tagIds).toArray();
      },
    });

    return tags.map(dbTagToTag);
  }

  /**
   * Get all entities with a specific tag
   */
  async getEntitiesByTag(
    tagId: string,
    entityType?: ModuleType
  ): Promise<EntityTag[]> {
    let entityTags: DBEntityTag[];

    if (entityType) {
      entityTags = await dal.queryCustom<DBEntityTag>({
        sql: `SELECT * FROM entity_tags WHERE tag_id = ? AND entity_type = ?`,
        params: [tagId, entityType],
        dexieFallback: async (db: unknown) => {
          const dexieDb = db as { table: (name: string) => { where: (key: string) => { equals: (val: string) => { and: (fn: (et: DBEntityTag) => boolean) => { toArray: () => Promise<DBEntityTag[]> } } } } };
          return dexieDb.table('entityTags').where('tagId').equals(tagId).and((et: DBEntityTag) => et.entityType === entityType).toArray();
        },
      });
    } else {
      entityTags = await dal.query<DBEntityTag>('entityTags', {
        whereClause: { tagId },
      });
    }

    return entityTags.map(dbEntityTagToEntityTag);
  }

  /**
   * Set all tags for an entity (replaces existing)
   */
  async setEntityTags(
    entityType: ModuleType,
    entityId: string,
    tagIds: string[],
    groupId: string,
    createdBy: string
  ): Promise<void> {
    // Get current tags
    const currentTags = await this.getEntityTags(entityType, entityId);
    const currentTagIds = new Set(currentTags.map((t) => t.id));
    const newTagIds = new Set(tagIds);

    // Remove tags that are no longer in the list
    for (const tagId of currentTagIds) {
      if (!newTagIds.has(tagId)) {
        await this.removeTagFromEntity(entityType, entityId, tagId);
      }
    }

    // Add new tags
    for (const tagId of newTagIds) {
      if (!currentTagIds.has(tagId)) {
        await this.addTagToEntity(entityType, entityId, tagId, groupId, createdBy);
      }
    }
  }

  /**
   * Get popular tags in a group
   */
  async getPopularTags(groupId: string, limit: number = 10): Promise<Tag[]> {
    const tags = await this.getGroupTags(groupId);

    return tags
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: TagManager | null = null;

/**
 * Get the singleton TagManager instance
 */
export function getTagManager(): TagManager {
  if (!instance) {
    instance = new TagManager();
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetTagManager(): void {
  instance = null;
}
