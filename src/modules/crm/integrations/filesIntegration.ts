/**
 * Files Integration for CRM Module
 * Re-exports database file integration with CRM-specific utilities
 */

// Re-export all database file integration utilities
export {
  attachFileToRecord,
  attachFilesToRecord,
  detachFileFromRecord,
  getRecordAttachments,
  getFileTypeCategory,
  formatFileSize,
  getFileIcon,
  type FileInfo,
} from '@/modules/database/integrations/filesIntegration';

import type { RecordAttachment } from '@/modules/database/types';
import type { DatabaseRecord } from '@/modules/database/types';

/**
 * CRM-specific document categories
 */
export type CRMDocumentCategory =
  | 'contract'
  | 'agreement'
  | 'correspondence'
  | 'legal'
  | 'financial'
  | 'photo'
  | 'identification'
  | 'evidence'
  | 'report'
  | 'other';

/**
 * Get suggested document category based on file name and type
 */
export function suggestDocumentCategory(
  fileName: string,
  mimeType: string
): CRMDocumentCategory {
  const lowerName = fileName.toLowerCase();

  // Check file name patterns
  if (
    lowerName.includes('contract') ||
    lowerName.includes('lease') ||
    lowerName.includes('agreement')
  ) {
    return 'contract';
  }

  if (
    lowerName.includes('correspondence') ||
    lowerName.includes('letter') ||
    lowerName.includes('email')
  ) {
    return 'correspondence';
  }

  if (
    lowerName.includes('legal') ||
    lowerName.includes('court') ||
    lowerName.includes('filing') ||
    lowerName.includes('subpoena') ||
    lowerName.includes('motion')
  ) {
    return 'legal';
  }

  if (
    lowerName.includes('invoice') ||
    lowerName.includes('receipt') ||
    lowerName.includes('financial') ||
    lowerName.includes('donation')
  ) {
    return 'financial';
  }

  if (
    lowerName.includes('id') ||
    lowerName.includes('passport') ||
    lowerName.includes('license') ||
    lowerName.includes('identification')
  ) {
    return 'identification';
  }

  if (
    lowerName.includes('evidence') ||
    lowerName.includes('proof') ||
    lowerName.includes('documentation')
  ) {
    return 'evidence';
  }

  if (lowerName.includes('report') || lowerName.includes('summary')) {
    return 'report';
  }

  // Check mime type
  if (mimeType.startsWith('image/')) {
    return 'photo';
  }

  return 'other';
}

/**
 * Group attachments by category
 */
export function groupAttachmentsByCategory(
  attachments: RecordAttachment[]
): Map<CRMDocumentCategory, RecordAttachment[]> {
  const grouped = new Map<CRMDocumentCategory, RecordAttachment[]>();

  for (const attachment of attachments) {
    const category = suggestDocumentCategory(
      attachment.fileName || '',
      attachment.fileType || ''
    );
    const list = grouped.get(category) || [];
    list.push(attachment);
    grouped.set(category, list);
  }

  return grouped;
}

/**
 * Get all attachments for a contact across all their related records
 */
export async function getContactAttachments(
  _contactId: string,
  relatedRecords: DatabaseRecord[],
  getAttachments: (recordId: string, tableId: string) => Promise<RecordAttachment[]>
): Promise<RecordAttachment[]> {
  const allAttachments: RecordAttachment[] = [];

  // Get attachments from all related records
  for (const record of relatedRecords) {
    const attachments = await getAttachments(record.id, record.tableId);
    allAttachments.push(...attachments);
  }

  // Sort by date (most recent first)
  allAttachments.sort((a, b) => b.addedAt - a.addedAt);

  return allAttachments;
}

/**
 * Get category display info
 */
export function getCategoryDisplayInfo(
  category: CRMDocumentCategory
): { label: string; icon: string } {
  const info: Record<CRMDocumentCategory, { label: string; icon: string }> = {
    contract: { label: 'Contracts', icon: 'FileSignature' },
    agreement: { label: 'Agreements', icon: 'FileCheck' },
    correspondence: { label: 'Correspondence', icon: 'Mail' },
    legal: { label: 'Legal Documents', icon: 'Scale' },
    financial: { label: 'Financial', icon: 'DollarSign' },
    photo: { label: 'Photos', icon: 'Image' },
    identification: { label: 'Identification', icon: 'CreditCard' },
    evidence: { label: 'Evidence', icon: 'FileSearch' },
    report: { label: 'Reports', icon: 'FileText' },
    other: { label: 'Other', icon: 'File' },
  };

  return info[category];
}

/**
 * Check if attachment might contain sensitive information
 * Used to warn users about privacy considerations
 */
export function isSensitiveDocument(
  fileName: string,
  category: CRMDocumentCategory
): boolean {
  const sensitiveCategories: CRMDocumentCategory[] = [
    'legal',
    'financial',
    'identification',
    'evidence',
  ];

  if (sensitiveCategories.includes(category)) {
    return true;
  }

  const lowerName = fileName.toLowerCase();
  const sensitivePatterns = [
    'ssn',
    'social-security',
    'tax',
    'w-2',
    'w2',
    '1099',
    'bank',
    'medical',
    'health',
    'hipaa',
    'confidential',
    'private',
    'sensitive',
  ];

  return sensitivePatterns.some((pattern) => lowerName.includes(pattern));
}
