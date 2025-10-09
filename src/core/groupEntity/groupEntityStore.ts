/**
 * Group Entity Store
 * Manages group identities, encrypted keypairs, and message authorization
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { bytesToHex } from '@noble/hashes/utils';
import { db } from '../storage/db';
import type {
  GroupEntity,
  GroupEntitySettings,
  GroupEntityMessage,
  Coalition,
  CoalitionSettings,
  Channel,
  ChannelPermissions,
  MessageTemplate,
  DBGroupEntity,
  DBGroupEntityMessage,
  DBCoalition,
  DBChannel,
} from './types';

interface GroupEntityStore {
  /** Current "speak as" mode per group */
  speakingAs: Map<string, 'personal' | 'group'>;

  /** Cached group entities */
  entities: Map<string, GroupEntity>;

  /** Cached coalitions */
  coalitions: Coalition[];

  /** Cached channels */
  channels: Map<string, Channel[]>; // groupId -> channels

  /** Recent group entity messages (audit log) */
  auditLog: GroupEntityMessage[];

  // Actions
  /** Initialize store and load data */
  initialize: () => Promise<void>;

  /** Create group entity (generate keypair) */
  createGroupEntity: (groupId: string, settings?: Partial<GroupEntitySettings>) => Promise<GroupEntity>;

  /** Get group entity */
  getGroupEntity: (groupId: string) => Promise<GroupEntity | null>;

  /** Delete group entity */
  deleteGroupEntity: (groupId: string) => Promise<void>;

  /** Update group entity settings */
  updateSettings: (groupId: string, settings: Partial<GroupEntitySettings>) => Promise<void>;

  /** Toggle speak-as mode */
  toggleSpeakAs: (groupId: string) => void;

  /** Get current speak-as mode */
  getSpeakAsMode: (groupId: string) => 'personal' | 'group';

  /** Post message as group entity */
  postAsGroup: (params: {
    groupId: string;
    content: string;
    conversationId?: string;
    metadata?: GroupEntityMessage['metadata'];
  }) => Promise<GroupEntityMessage>;

  /** Get audit log for group */
  getAuditLog: (groupId: string, limit?: number) => Promise<GroupEntityMessage[]>;

  /** Create coalition */
  createCoalition: (params: {
    name: string;
    description?: string;
    groupIds: string[];
    individualPubkeys?: string[];
    settings?: Partial<CoalitionSettings>;
  }) => Promise<Coalition>;

  /** Get coalition */
  getCoalition: (id: string) => Promise<Coalition | null>;

  /** Update coalition */
  updateCoalition: (id: string, updates: Partial<Coalition>) => Promise<void>;

  /** Delete coalition */
  deleteCoalition: (id: string) => Promise<void>;

  /** Create channel */
  createChannel: (params: {
    groupId: string;
    name: string;
    description?: string;
    type: Channel['type'];
    permissions: ChannelPermissions;
  }) => Promise<Channel>;

  /** Get channels for group */
  getChannels: (groupId: string) => Promise<Channel[]>;

  /** Update channel */
  updateChannel: (id: string, updates: Partial<Channel>) => Promise<void>;

  /** Delete channel */
  deleteChannel: (id: string) => Promise<void>;

  /** Add message template */
  addTemplate: (groupId: string, template: Omit<MessageTemplate, 'id' | 'createdAt'>) => Promise<void>;

  /** Remove message template */
  removeTemplate: (groupId: string, templateId: string) => Promise<void>;
}

export const useGroupEntityStore = create<GroupEntityStore>()((set, get) => ({
  speakingAs: new Map(),
  entities: new Map(),
  coalitions: [],
  channels: new Map(),
  auditLog: [],

  initialize: async () => {
    try {
      // Load group entities
      const entities = await db.groupEntities.toArray();
      const entityMap = new Map<string, GroupEntity>();

      for (const dbEntity of entities) {
        entityMap.set(dbEntity.groupId, {
          groupId: dbEntity.groupId,
          pubkey: dbEntity.pubkey,
          createdAt: dbEntity.createdAt,
          createdBy: dbEntity.createdBy,
          settings: JSON.parse(dbEntity.settings) as GroupEntitySettings,
        });
      }

      // Load coalitions
      const dbCoalitions = await db.coalitions.toArray();
      const coalitions: Coalition[] = dbCoalitions.map((dbCoal) => ({
        id: dbCoal.id,
        name: dbCoal.name,
        description: dbCoal.description || undefined,
        groupIds: JSON.parse(dbCoal.groupIds),
        individualPubkeys: JSON.parse(dbCoal.individualPubkeys),
        conversationId: dbCoal.conversationId,
        createdBy: dbCoal.createdBy,
        createdAt: dbCoal.createdAt,
        settings: JSON.parse(dbCoal.settings) as CoalitionSettings,
      }));

      // Load channels
      const dbChannels = await db.channels.toArray();
      const channelMap = new Map<string, Channel[]>();

      for (const dbChan of dbChannels) {
        const channel: Channel = {
          id: dbChan.id,
          groupId: dbChan.groupId,
          name: dbChan.name,
          description: dbChan.description || undefined,
          type: dbChan.type,
          conversationId: dbChan.conversationId,
          permissions: JSON.parse(dbChan.permissions) as ChannelPermissions,
          createdBy: dbChan.createdBy,
          createdAt: dbChan.createdAt,
        };

        const existing = channelMap.get(dbChan.groupId) || [];
        channelMap.set(dbChan.groupId, [...existing, channel]);
      }

      set({ entities: entityMap, coalitions, channels: channelMap });
    } catch (error) {
      console.error('[GroupEntity] Failed to initialize:', error);
    }
  },

  createGroupEntity: async (groupId, settingsPartial = {}) => {
    const { useAuthStore } = await import('@/stores/authStore');
    const currentUser = useAuthStore.getState().currentIdentity;

    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    // Generate group keypair
    const privateKeyBytes = generateSecretKey();
    const privateKey = bytesToHex(privateKeyBytes);
    const pubkey = getPublicKey(privateKeyBytes);

    // Encrypt private key with group master key
    // Note: In production, derive group master key from group creation event
    // For MVP, we'll use a simple encryption with current user's key as placeholder
    const { encryptedData, iv } = await encryptGroupKey(privateKey, groupId);

    const defaultSettings: GroupEntitySettings = {
      speakerPermission: 'admins-only',
      requireApproval: false,
      templates: [],
      ...settingsPartial,
    };

    const dbEntity: DBGroupEntity = {
      id: uuidv4(),
      groupId,
      pubkey,
      encryptedPrivateKey: encryptedData,
      iv,
      createdAt: Date.now(),
      createdBy: currentUser.publicKey,
      settings: JSON.stringify(defaultSettings),
    };

    await db.groupEntities.add(dbEntity);

    const entity: GroupEntity = {
      groupId,
      pubkey,
      createdAt: dbEntity.createdAt,
      createdBy: dbEntity.createdBy,
      settings: defaultSettings,
    };

    set((state) => {
      const newEntities = new Map(state.entities);
      newEntities.set(groupId, entity);
      return { entities: newEntities };
    });

    return entity;
  },

  getGroupEntity: async (groupId) => {
    const cached = get().entities.get(groupId);
    if (cached) return cached;

    const dbEntity = await db.groupEntities.where({ groupId }).first();
    if (!dbEntity) return null;

    const entity: GroupEntity = {
      groupId: dbEntity.groupId,
      pubkey: dbEntity.pubkey,
      createdAt: dbEntity.createdAt,
      createdBy: dbEntity.createdBy,
      settings: JSON.parse(dbEntity.settings) as GroupEntitySettings,
    };

    set((state) => {
      const newEntities = new Map(state.entities);
      newEntities.set(groupId, entity);
      return { entities: newEntities };
    });

    return entity;
  },

  deleteGroupEntity: async (groupId) => {
    await db.groupEntities.where({ groupId }).delete();

    set((state) => {
      const newEntities = new Map(state.entities);
      newEntities.delete(groupId);
      return { entities: newEntities };
    });
  },

  updateSettings: async (groupId, settingsPartial) => {
    const entity = await get().getGroupEntity(groupId);
    if (!entity) throw new Error('Group entity not found');

    const newSettings: GroupEntitySettings = {
      ...entity.settings,
      ...settingsPartial,
    };

    await db.groupEntities
      .where({ groupId })
      .modify({ settings: JSON.stringify(newSettings) });

    set((state) => {
      const newEntities = new Map(state.entities);
      const updated = { ...entity, settings: newSettings };
      newEntities.set(groupId, updated);
      return { entities: newEntities };
    });
  },

  toggleSpeakAs: (groupId) => {
    set((state) => {
      const newMap = new Map(state.speakingAs);
      const current = newMap.get(groupId) || 'personal';
      newMap.set(groupId, current === 'personal' ? 'group' : 'personal');
      return { speakingAs: newMap };
    });
  },

  getSpeakAsMode: (groupId) => {
    return get().speakingAs.get(groupId) || 'personal';
  },

  postAsGroup: async ({ groupId, content, conversationId, metadata }) => {
    const { useAuthStore } = await import('@/stores/authStore');
    const currentUser = useAuthStore.getState().currentIdentity;

    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    const entity = await get().getGroupEntity(groupId);
    if (!entity) {
      throw new Error('Group entity not found');
    }

    // Check permissions
    if (entity.settings.speakerPermission === 'admins-only') {
      // In production, check if current user is admin
      // For MVP, we'll assume permission is granted
    }

    // Create message record
    const message: GroupEntityMessage = {
      id: uuidv4(),
      groupId,
      messageId: uuidv4(), // In production, this would be the Nostr event ID
      content,
      authorizedBy: currentUser.publicKey,
      authorizedAt: Date.now(),
      conversationId,
      metadata,
    };

    const dbMessage: DBGroupEntityMessage = {
      id: message.id,
      groupId: message.groupId,
      messageId: message.messageId,
      content: message.content,
      authorizedBy: message.authorizedBy,
      authorizedAt: message.authorizedAt,
      approved: 1,
      approvers: JSON.stringify([]),
      conversationId: message.conversationId || null,
      metadata: message.metadata ? JSON.stringify(message.metadata) : null,
    };

    await db.groupEntityMessages.add(dbMessage);

    // Add to audit log
    set((state) => ({
      auditLog: [message, ...state.auditLog].slice(0, 100), // Keep last 100
    }));

    return message;
  },

  getAuditLog: async (groupId, limit = 50) => {
    const messages = await db.groupEntityMessages
      .where({ groupId })
      .reverse()
      .limit(limit)
      .toArray();

    return messages.map((dbMsg) => ({
      id: dbMsg.id,
      groupId: dbMsg.groupId,
      messageId: dbMsg.messageId,
      content: dbMsg.content,
      authorizedBy: dbMsg.authorizedBy,
      authorizedAt: dbMsg.authorizedAt,
      approved: dbMsg.approved === 1,
      approvers: dbMsg.approvers ? JSON.parse(dbMsg.approvers) : undefined,
      conversationId: dbMsg.conversationId || undefined,
      metadata: dbMsg.metadata ? JSON.parse(dbMsg.metadata) : undefined,
    }));
  },

  createCoalition: async ({ name, description, groupIds, individualPubkeys = [], settings = {} }) => {
    const { useAuthStore } = await import('@/stores/authStore');
    const currentUser = useAuthStore.getState().currentIdentity;

    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    const defaultSettings: CoalitionSettings = {
      allowCrossPosting: true,
      votingThreshold: 0.5,
      permissions: {
        whoCanPost: 'group-admins',
        whoCanInvite: 'all-groups',
        whoCanRemove: 'consensus',
      },
      ...settings,
    };

    const coalition: Coalition = {
      id: uuidv4(),
      name,
      description,
      groupIds,
      individualPubkeys,
      conversationId: uuidv4(), // In production, create actual conversation
      createdBy: currentUser.publicKey,
      createdAt: Date.now(),
      settings: defaultSettings,
    };

    const dbCoalition: DBCoalition = {
      id: coalition.id,
      name: coalition.name,
      description: coalition.description || null,
      groupIds: JSON.stringify(coalition.groupIds),
      individualPubkeys: JSON.stringify(coalition.individualPubkeys),
      conversationId: coalition.conversationId,
      createdBy: coalition.createdBy,
      createdAt: coalition.createdAt,
      settings: JSON.stringify(coalition.settings),
    };

    await db.coalitions.add(dbCoalition);

    set((state) => ({
      coalitions: [...state.coalitions, coalition],
    }));

    return coalition;
  },

  getCoalition: async (id) => {
    const cached = get().coalitions.find((c) => c.id === id);
    if (cached) return cached;

    const dbCoalition = await db.coalitions.get(id);
    if (!dbCoalition) return null;

    const coalition: Coalition = {
      id: dbCoalition.id,
      name: dbCoalition.name,
      description: dbCoalition.description || undefined,
      groupIds: JSON.parse(dbCoalition.groupIds),
      individualPubkeys: JSON.parse(dbCoalition.individualPubkeys),
      conversationId: dbCoalition.conversationId,
      createdBy: dbCoalition.createdBy,
      createdAt: dbCoalition.createdAt,
      settings: JSON.parse(dbCoalition.settings) as CoalitionSettings,
    };

    set((state) => ({
      coalitions: [...state.coalitions, coalition],
    }));

    return coalition;
  },

  updateCoalition: async (id, updates) => {
    const existing = await get().getCoalition(id);
    if (!existing) throw new Error('Coalition not found');

    const updated = { ...existing, ...updates };

    await db.coalitions.update(id, {
      name: updated.name,
      description: updated.description || null,
      groupIds: JSON.stringify(updated.groupIds),
      individualPubkeys: JSON.stringify(updated.individualPubkeys),
      settings: JSON.stringify(updated.settings),
    });

    set((state) => ({
      coalitions: state.coalitions.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteCoalition: async (id) => {
    await db.coalitions.delete(id);

    set((state) => ({
      coalitions: state.coalitions.filter((c) => c.id !== id),
    }));
  },

  createChannel: async ({ groupId, name, description, type, permissions }) => {
    const { useAuthStore } = await import('@/stores/authStore');
    const currentUser = useAuthStore.getState().currentIdentity;

    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    const channel: Channel = {
      id: uuidv4(),
      groupId,
      name,
      description,
      type,
      conversationId: uuidv4(), // In production, create actual conversation
      permissions,
      createdBy: currentUser.publicKey,
      createdAt: Date.now(),
    };

    const dbChannel: DBChannel = {
      id: channel.id,
      groupId: channel.groupId,
      name: channel.name,
      description: channel.description || null,
      type: channel.type,
      conversationId: channel.conversationId,
      permissions: JSON.stringify(channel.permissions),
      createdBy: channel.createdBy,
      createdAt: channel.createdAt,
    };

    await db.channels.add(dbChannel);

    set((state) => {
      const newChannels = new Map(state.channels);
      const existing = newChannels.get(groupId) || [];
      newChannels.set(groupId, [...existing, channel]);
      return { channels: newChannels };
    });

    return channel;
  },

  getChannels: async (groupId) => {
    const cached = get().channels.get(groupId);
    if (cached) return cached;

    const dbChannels = await db.channels.where({ groupId }).toArray();

    const channels: Channel[] = dbChannels.map((dbChan) => ({
      id: dbChan.id,
      groupId: dbChan.groupId,
      name: dbChan.name,
      description: dbChan.description || undefined,
      type: dbChan.type,
      conversationId: dbChan.conversationId,
      permissions: JSON.parse(dbChan.permissions) as ChannelPermissions,
      createdBy: dbChan.createdBy,
      createdAt: dbChan.createdAt,
    }));

    set((state) => {
      const newChannels = new Map(state.channels);
      newChannels.set(groupId, channels);
      return { channels: newChannels };
    });

    return channels;
  },

  updateChannel: async (id, updates) => {
    await db.channels.update(id, {
      ...(updates.name && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description || null }),
      ...(updates.type && { type: updates.type }),
      ...(updates.permissions && { permissions: JSON.stringify(updates.permissions) }),
    });

    set((state) => {
      const newChannels = new Map(state.channels);
      for (const [groupId, channels] of newChannels.entries()) {
        const updatedChannels = channels.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        );
        newChannels.set(groupId, updatedChannels);
      }
      return { channels: newChannels };
    });
  },

  deleteChannel: async (id) => {
    await db.channels.delete(id);

    set((state) => {
      const newChannels = new Map(state.channels);
      for (const [groupId, channels] of newChannels.entries()) {
        newChannels.set(
          groupId,
          channels.filter((c) => c.id !== id)
        );
      }
      return { channels: newChannels };
    });
  },

  addTemplate: async (groupId, template) => {
    const entity = await get().getGroupEntity(groupId);
    if (!entity) throw new Error('Group entity not found');

    const { useAuthStore } = await import('@/stores/authStore');
    const currentUser = useAuthStore.getState().currentIdentity;

    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    const newTemplate: MessageTemplate = {
      ...template,
      id: uuidv4(),
      createdAt: Date.now(),
      createdBy: currentUser.publicKey,
    };

    const updatedSettings: GroupEntitySettings = {
      ...entity.settings,
      templates: [...entity.settings.templates, newTemplate],
    };

    await get().updateSettings(groupId, updatedSettings);
  },

  removeTemplate: async (groupId, templateId) => {
    const entity = await get().getGroupEntity(groupId);
    if (!entity) throw new Error('Group entity not found');

    const updatedSettings: GroupEntitySettings = {
      ...entity.settings,
      templates: entity.settings.templates.filter((t) => t.id !== templateId),
    };

    await get().updateSettings(groupId, updatedSettings);
  },
}));

/**
 * Encrypt group private key with AES-256-GCM
 * Note: In production, derive group master key from group creation event
 */
async function encryptGroupKey(
  privateKey: string,
  groupId: string
): Promise<{ encryptedData: string; iv: string }> {
  // Derive encryption key from groupId (placeholder for MVP)
  // In production, use proper key derivation from group creation event
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(groupId.padEnd(32, '0')),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('buildit-group-entity'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt private key
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(privateKey)
  );

  return {
    encryptedData: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypt group private key
 */
export async function decryptGroupKey(
  encryptedData: string,
  iv: string,
  groupId: string
): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Derive same encryption key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(groupId.padEnd(32, '0')),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('buildit-group-entity'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decode IV and encrypted data
  const ivArray = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const encryptedArray = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivArray },
    key,
    encryptedArray
  );

  return decoder.decode(decryptedBuffer);
}
