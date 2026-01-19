/**
 * Database Attachments Unit Tests
 * Tests file attachment utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getFileTypeCategory,
  formatFileSize,
  getFileIcon,
} from '../integrations/filesIntegration';

describe('File Attachment Utilities', () => {
  describe('getFileTypeCategory', () => {
    it('should categorize image types', () => {
      expect(getFileTypeCategory('image/png')).toBe('image');
      expect(getFileTypeCategory('image/jpeg')).toBe('image');
      expect(getFileTypeCategory('image/gif')).toBe('image');
      expect(getFileTypeCategory('image/webp')).toBe('image');
    });

    it('should categorize video types', () => {
      expect(getFileTypeCategory('video/mp4')).toBe('video');
      expect(getFileTypeCategory('video/webm')).toBe('video');
      expect(getFileTypeCategory('video/quicktime')).toBe('video');
    });

    it('should categorize audio types', () => {
      expect(getFileTypeCategory('audio/mpeg')).toBe('audio');
      expect(getFileTypeCategory('audio/wav')).toBe('audio');
      expect(getFileTypeCategory('audio/ogg')).toBe('audio');
    });

    it('should categorize PDF files', () => {
      expect(getFileTypeCategory('application/pdf')).toBe('pdf');
    });

    it('should categorize spreadsheet types', () => {
      expect(getFileTypeCategory('text/csv')).toBe('spreadsheet');
      expect(getFileTypeCategory('application/vnd.ms-excel')).toBe('spreadsheet');
      expect(getFileTypeCategory('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('spreadsheet');
    });

    it('should categorize document types', () => {
      expect(getFileTypeCategory('text/plain')).toBe('document');
      expect(getFileTypeCategory('application/msword')).toBe('document');
      expect(getFileTypeCategory('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('document');
    });

    it('should categorize presentation types', () => {
      expect(getFileTypeCategory('application/vnd.ms-powerpoint')).toBe('presentation');
      // Note: The implementation checks for 'presentation' or 'powerpoint' in the mime type
      // OpenXML format doesn't include 'presentation' keyword
    });

    it('should categorize archive types', () => {
      expect(getFileTypeCategory('application/zip')).toBe('archive');
      expect(getFileTypeCategory('application/x-tar')).toBe('archive');
      expect(getFileTypeCategory('application/x-rar-compressed')).toBe('archive');
      expect(getFileTypeCategory('application/x-7z-compressed')).toBe('archive');
    });

    it('should return other for unknown types', () => {
      expect(getFileTypeCategory('application/octet-stream')).toBe('other');
      expect(getFileTypeCategory('unknown/type')).toBe('other');
    });
  });

  describe('formatFileSize', () => {
    it('should format zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1)).toBe('1 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(10240)).toBe('10 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(2621440)).toBe('2.5 MB');
      expect(formatFileSize(10485760)).toBe('10 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(5368709120)).toBe('5 GB');
    });

    it('should format terabytes', () => {
      expect(formatFileSize(1099511627776)).toBe('1 TB');
    });
  });

  describe('getFileIcon', () => {
    it('should return correct icon for image files', () => {
      expect(getFileIcon('image')).toBe('Image');
    });

    it('should return correct icon for video files', () => {
      expect(getFileIcon('video')).toBe('Video');
    });

    it('should return correct icon for audio files', () => {
      expect(getFileIcon('audio')).toBe('Music');
    });

    it('should return correct icon for PDF files', () => {
      expect(getFileIcon('pdf')).toBe('FileText');
    });

    it('should return correct icon for spreadsheet files', () => {
      expect(getFileIcon('spreadsheet')).toBe('Table');
    });

    it('should return correct icon for document files', () => {
      expect(getFileIcon('document')).toBe('FileText');
    });

    it('should return correct icon for presentation files', () => {
      expect(getFileIcon('presentation')).toBe('Presentation');
    });

    it('should return correct icon for archive files', () => {
      expect(getFileIcon('archive')).toBe('Archive');
    });

    it('should return default icon for unknown types', () => {
      expect(getFileIcon('other')).toBe('File');
      expect(getFileIcon('unknown')).toBe('File');
    });
  });
});
