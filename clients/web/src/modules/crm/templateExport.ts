/**
 * Template Export/Import Utilities
 * Handles encrypted export and import of CRM templates
 * Supports both single templates and full group exports
 */

import type { CRMMultiTableTemplate, CRMTableDefinition, CRMRelationshipDefinition } from './types';
import { encryptDM, decryptDM } from '@/core/crypto/nip44';
import { nip19 } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';
import { logger } from '@/lib/logger';

/**
 * Export format version for forwards compatibility
 */
const EXPORT_FORMAT_VERSION = '1.0.0';

/**
 * Export types
 */
export type ExportType = 'template' | 'group';

/**
 * Template export metadata
 */
export interface TemplateExportMeta {
  version: string;
  type: ExportType;
  exportedAt: number;
  exportedBy: string; // pubkey
  allowedPubkeys?: string[]; // If set, only these users can import
}

/**
 * Encrypted template export format
 */
export interface EncryptedTemplateExport {
  meta: TemplateExportMeta;
  encryptedData: string; // NIP-44 encrypted JSON
  signature?: string; // Optional signature by exporter
}

/**
 * Decrypted template data (single template)
 */
export interface TemplateExportData {
  template: CRMMultiTableTemplate;
  sourceName?: string; // Original name if renamed
  sourceGroupId?: string;
}

/**
 * Full group export data
 */
export interface GroupExportData {
  groupId: string;
  groupName: string;
  templates: CRMMultiTableTemplate[];
  tables: CRMTableDefinition[];
  relationships: CRMRelationshipDefinition[];
  customData?: Record<string, unknown>;
}

/**
 * Export a single template with encryption
 */
export async function exportTemplate(
  template: CRMMultiTableTemplate,
  exporterPubkey: string,
  exporterPrivkey: string,
  options: {
    allowedPubkeys?: string[];
    includeSourceInfo?: boolean;
    sourceGroupId?: string;
  } = {}
): Promise<EncryptedTemplateExport> {
  try {
    // Prepare export data
    const exportData: TemplateExportData = {
      template: {
        ...template,
        // Reset ID for import
        id: 'IMPORT_TEMPLATE',
      },
      sourceName: template.name,
      sourceGroupId: options.sourceGroupId,
    };

    // Prepare metadata
    const meta: TemplateExportMeta = {
      version: EXPORT_FORMAT_VERSION,
      type: 'template',
      exportedAt: Date.now(),
      exportedBy: exporterPubkey,
      allowedPubkeys: options.allowedPubkeys,
    };

    // Encrypt using NIP-44 (to self for later decryption)
    const privkeyBytes = hexToBytes(exporterPrivkey);
    const encryptedData = encryptDM(
      JSON.stringify(exportData),
      privkeyBytes,
      exporterPubkey
    );

    logger.info('Exported template', { templateId: template.id, name: template.name });

    return {
      meta,
      encryptedData,
    };
  } catch (error) {
    logger.error('Failed to export template', { error });
    throw new Error('Failed to export template');
  }
}

/**
 * Import a template from encrypted export
 */
export async function importTemplate(
  encryptedExport: EncryptedTemplateExport,
  importerPrivkey: string,
  importerPubkey: string
): Promise<TemplateExportData> {
  try {
    // Check if importer is allowed
    if (
      encryptedExport.meta.allowedPubkeys &&
      encryptedExport.meta.allowedPubkeys.length > 0 &&
      !encryptedExport.meta.allowedPubkeys.includes(importerPubkey)
    ) {
      throw new Error('You are not authorized to import this template');
    }

    // Decrypt using NIP-44 with the exporter's pubkey
    const exporterPubkey = encryptedExport.meta.exportedBy;
    const privkeyBytes = hexToBytes(importerPrivkey);
    const decryptedJson = decryptDM(encryptedExport.encryptedData, privkeyBytes, exporterPubkey);
    const exportData: TemplateExportData = JSON.parse(decryptedJson);

    logger.info('Imported template', { templateName: exportData.template.name });

    return exportData;
  } catch (error) {
    logger.error('Failed to import template', { error });
    throw new Error('Failed to import template: Invalid or unauthorized');
  }
}

/**
 * Export an entire group's CRM data with encryption
 */
export async function exportGroupData(
  groupId: string,
  groupName: string,
  templates: CRMMultiTableTemplate[],
  tables: CRMTableDefinition[],
  relationships: CRMRelationshipDefinition[],
  exporterPubkey: string,
  exporterPrivkey: string,
  options: {
    allowedPubkeys?: string[];
    customData?: Record<string, unknown>;
  } = {}
): Promise<EncryptedTemplateExport> {
  try {
    // Prepare export data
    const exportData: GroupExportData = {
      groupId,
      groupName,
      templates: templates.map((t) => ({
        ...t,
        id: `IMPORT_${t.id}`,
      })),
      tables,
      relationships,
      customData: options.customData,
    };

    // Prepare metadata
    const meta: TemplateExportMeta = {
      version: EXPORT_FORMAT_VERSION,
      type: 'group',
      exportedAt: Date.now(),
      exportedBy: exporterPubkey,
      allowedPubkeys: options.allowedPubkeys,
    };

    // Encrypt using NIP-44 (to self for later decryption)
    const privkeyBytes = hexToBytes(exporterPrivkey);
    const encryptedData = encryptDM(
      JSON.stringify(exportData),
      privkeyBytes,
      exporterPubkey
    );

    logger.info('Exported group data', { groupId, groupName, templateCount: templates.length });

    return {
      meta,
      encryptedData,
    };
  } catch (error) {
    logger.error('Failed to export group data', { error });
    throw new Error('Failed to export group data');
  }
}

/**
 * Import group data from encrypted export
 */
export async function importGroupData(
  encryptedExport: EncryptedTemplateExport,
  importerPrivkey: string,
  importerPubkey: string
): Promise<GroupExportData> {
  try {
    // Check if this is a group export
    if (encryptedExport.meta.type !== 'group') {
      throw new Error('Invalid export type: expected group');
    }

    // Check if importer is allowed
    if (
      encryptedExport.meta.allowedPubkeys &&
      encryptedExport.meta.allowedPubkeys.length > 0 &&
      !encryptedExport.meta.allowedPubkeys.includes(importerPubkey)
    ) {
      throw new Error('You are not authorized to import this group data');
    }

    // Decrypt using NIP-44
    const exporterPubkey = encryptedExport.meta.exportedBy;
    const privkeyBytes = hexToBytes(importerPrivkey);
    const decryptedJson = decryptDM(encryptedExport.encryptedData, privkeyBytes, exporterPubkey);
    const exportData: GroupExportData = JSON.parse(decryptedJson);

    logger.info('Imported group data', {
      groupName: exportData.groupName,
      templateCount: exportData.templates.length,
    });

    return exportData;
  } catch (error) {
    logger.error('Failed to import group data', { error });
    throw new Error('Failed to import group data: Invalid or unauthorized');
  }
}

/**
 * Re-encrypt an export for a specific recipient
 * Allows sharing exports with designated users
 */
export async function reencryptExportForRecipient(
  encryptedExport: EncryptedTemplateExport,
  ownerPrivkey: string,
  ownerPubkey: string,
  recipientPubkey: string
): Promise<EncryptedTemplateExport> {
  try {
    // First, decrypt the export
    const exporterPubkey = encryptedExport.meta.exportedBy;

    // Verify we're the owner
    if (exporterPubkey !== ownerPubkey) {
      throw new Error('Only the original exporter can re-encrypt for sharing');
    }

    const privkeyBytes = hexToBytes(ownerPrivkey);
    const decryptedJson = decryptDM(encryptedExport.encryptedData, privkeyBytes, ownerPubkey);

    // Re-encrypt for the recipient
    const reEncryptedData = encryptDM(decryptedJson, privkeyBytes, recipientPubkey);

    // Update metadata
    const newMeta: TemplateExportMeta = {
      ...encryptedExport.meta,
      allowedPubkeys: [recipientPubkey, ownerPubkey],
    };

    logger.info('Re-encrypted export for recipient', {
      recipientPubkey: recipientPubkey.slice(0, 8),
    });

    return {
      meta: newMeta,
      encryptedData: reEncryptedData,
    };
  } catch (error) {
    logger.error('Failed to re-encrypt export', { error });
    throw new Error('Failed to re-encrypt export for sharing');
  }
}

/**
 * Serialize an encrypted export to a file-friendly format
 */
export function serializeExport(encryptedExport: EncryptedTemplateExport): string {
  return JSON.stringify(encryptedExport, null, 2);
}

/**
 * Deserialize an encrypted export from file content
 */
export function deserializeExport(content: string): EncryptedTemplateExport {
  try {
    const parsed = JSON.parse(content);

    // Validate structure
    if (!parsed.meta || !parsed.encryptedData) {
      throw new Error('Invalid export format');
    }

    if (!parsed.meta.version || !parsed.meta.type || !parsed.meta.exportedBy) {
      throw new Error('Invalid export metadata');
    }

    return parsed as EncryptedTemplateExport;
  } catch (error) {
    logger.error('Failed to deserialize export', { error });
    throw new Error('Invalid export file format');
  }
}

/**
 * Create a download link for an export
 */
export function createExportDownloadLink(
  encryptedExport: EncryptedTemplateExport
): string {
  const content = serializeExport(encryptedExport);
  const blob = new Blob([content], { type: 'application/json' });
  return URL.createObjectURL(blob);
}

/**
 * Get export file extension based on type
 */
export function getExportFilename(
  name: string,
  type: ExportType
): string {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = new Date().toISOString().split('T')[0];
  return `${safeName}_${type}_${timestamp}.buildit.json`;
}

/**
 * Parse a user identifier (npub, hex pubkey, or username)
 * Returns a hex pubkey if valid
 */
export function parseUserIdentifier(identifier: string): string | null {
  try {
    // Check if it's an npub
    if (identifier.startsWith('npub')) {
      const decoded = nip19.decode(identifier);
      if (decoded.type === 'npub') {
        return decoded.data;
      }
    }

    // Check if it's a hex pubkey (64 chars)
    if (/^[0-9a-fA-F]{64}$/.test(identifier)) {
      return identifier.toLowerCase();
    }

    // Could add username lookup in the future
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate export version compatibility
 */
export function isVersionCompatible(exportVersion: string): boolean {
  const [exportMajor] = exportVersion.split('.').map(Number);
  const [currentMajor] = EXPORT_FORMAT_VERSION.split('.').map(Number);

  // Major version must match
  return exportMajor === currentMajor;
}
