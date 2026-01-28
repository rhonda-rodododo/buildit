/**
 * Tag Manager Service
 * Manages user-defined tags with hierarchical support
 */

import { nanoid } from 'nanoid';
import type { Tag, TagWithChildren, EntityTag } from '../types';
import type { ModuleType } from '@/types/modules';
import type { DBTag, DBEntityTag } from '../schema';
import { getDB } from '@/core/storage/db';
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
    const db = getDB();
    if (!db.tags) {
      throw new Error('Tags table not initialized');
    }

    const now = Date.now();
    const slug = slugify(input.name);

    // Check for duplicate slug in group
    const existing = await db.tags
      .where('[groupId+slug]')
      .equals([input.groupId, slug])
      .first();

    if (existing) {
      throw new Error(`Tag "${input.name}" already exists in this group`);
    }

    // Validate parent tag if provided
    if (input.parentTagId) {
      const parent = await db.tags.get(input.parentTagId);
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

    await db.tags.add(tag);
    logger.info('Created tag:', tag.name);

    return dbTagToTag(tag);
  }

  /**
   * Update a tag
   */
  async updateTag(tagId: string, input: UpdateTagInput): Promise<Tag> {
    const db = getDB();
    if (!db.tags) {
      throw new Error('Tags table not initialized');
    }

    const existing = await db.tags.get(tagId);
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
      const duplicate = await db.tags
        .where('[groupId+slug]')
        .equals([existing.groupId, updates.slug])
        .first();

      if (duplicate && duplicate.id !== tagId) {
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
        const parent = await db.tags.get(input.parentTagId);
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

    await db.tags.update(tagId, updates);

    const updated = await db.tags.get(tagId);
    return dbTagToTag(updated!);
  }

  /**
   * Delete a tag
   */
  async deleteTag(tagId: string): Promise<void> {
    const db = getDB();
    if (!db.tags || !db.entityTags) {
      throw new Error('Tags tables not initialized');
    }

    const tag = await db.tags.get(tagId);
    if (!tag) {
      throw new Error('Tag not found');
    }

    // Move child tags to top level
    const children = await db.tags
      .where('parentTagId')
      .equals(tagId)
      .toArray();

    for (const child of children) {
      await db.tags.update(child.id, {
        parentTagId: undefined,
        updatedAt: Date.now(),
      });
    }

    // Remove all entity-tag associations
    await db.entityTags.where('tagId').equals(tagId).delete();

    // Delete the tag
    await db.tags.delete(tagId);

    logger.info('Deleted tag:', tag.name);
  }

  /**
   * Get a tag by ID
   */
  async getTag(tagId: string): Promise<Tag | null> {
    const db = getDB();
    if (!db.tags) {
      return null;
    }

    const tag = await db.tags.get(tagId);
    return tag ? dbTagToTag(tag) : null;
  }

  /**
   * Get all tags for a group
   */
  async getGroupTags(groupId: string): Promise<Tag[]> {
    const db = getDB();
    if (!db.tags) {
      return [];
    }

    const tags = await db.tags.where('groupId').equals(groupId).toArray();
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
    const db = getDB();
    if (!db.tags || !db.entityTags) {
      throw new Error('Tags tables not initialized');
    }

    // Verify tag exists and belongs to the group
    const tag = await db.tags.get(tagId);
    if (!tag) {
      throw new Error('Tag not found');
    }
    if (tag.groupId !== groupId) {
      throw new Error('Tag does not belong to this group');
    }

    // Check if already tagged
    const existing = await db.entityTags
      .where('[entityType+entityId]')
      .equals([entityType, entityId])
      .and((et) => et.tagId === tagId)
      .first();

    if (existing) {
      return dbEntityTagToEntityTag(existing);
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

    await db.entityTags.add(entityTag);

    // Increment usage count
    await db.tags.update(tagId, {
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
    const db = getDB();
    if (!db.tags || !db.entityTags) {
      throw new Error('Tags tables not initialized');
    }

    const entityTag = await db.entityTags
      .where('[entityType+entityId]')
      .equals([entityType, entityId])
      .and((et) => et.tagId === tagId)
      .first();

    if (!entityTag) {
      return; // Already not tagged
    }

    await db.entityTags.delete(entityTag.id);

    // Decrement usage count
    const tag = await db.tags.get(tagId);
    if (tag && tag.usageCount > 0) {
      await db.tags.update(tagId, {
        usageCount: tag.usageCount - 1,
        updatedAt: Date.now(),
      });
    }
  }

  /**
   * Get all tags for an entity
   */
  async getEntityTags(entityType: ModuleType, entityId: string): Promise<Tag[]> {
    const db = getDB();
    if (!db.tags || !db.entityTags) {
      return [];
    }

    const entityTags = await db.entityTags
      .where('[entityType+entityId]')
      .equals([entityType, entityId])
      .toArray();

    const tagIds = entityTags.map((et) => et.tagId);
    const tags = await db.tags.where('id').anyOf(tagIds).toArray();

    return tags.map(dbTagToTag);
  }

  /**
   * Get all entities with a specific tag
   */
  async getEntitiesByTag(
    tagId: string,
    entityType?: ModuleType
  ): Promise<EntityTag[]> {
    const db = getDB();
    if (!db.entityTags) {
      return [];
    }

    let query = db.entityTags.where('tagId').equals(tagId);

    if (entityType) {
      query = query.and((et) => et.entityType === entityType);
    }

    const entityTags = await query.toArray();
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
