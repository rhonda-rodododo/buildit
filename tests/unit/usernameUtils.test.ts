import { describe, expect, it } from 'vitest';
import { validateUsername, normalizeUsername, formatUsername } from '@/core/username/usernameUtils';

describe('usernameUtils', () => {
  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      expect(validateUsername('alice').valid).toBe(true);
      expect(validateUsername('bob-organizer').valid).toBe(true);
      expect(validateUsername('user123').valid).toBe(true);
      expect(validateUsername('test-user-123').valid).toBe(true);
    });

    it('should reject too short usernames', () => {
      const result = validateUsername('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 3 characters');
    });

    it('should reject too long usernames', () => {
      const result = validateUsername('a'.repeat(21));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('20 characters or less');
    });

    it('should reject usernames with invalid characters', () => {
      expect(validateUsername('alice@test').valid).toBe(false);
      expect(validateUsername('bob.user').valid).toBe(false);
      expect(validateUsername('user name').valid).toBe(false);
      expect(validateUsername('user_name').valid).toBe(false);
    });

    it('should reject usernames starting or ending with hyphens', () => {
      expect(validateUsername('-alice').valid).toBe(false);
      expect(validateUsername('alice-').valid).toBe(false);
    });

    it('should reject usernames with consecutive hyphens', () => {
      const result = validateUsername('alice--bob');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive hyphens');
    });

    it('should reject reserved usernames', () => {
      expect(validateUsername('admin').valid).toBe(false);
      expect(validateUsername('moderator').valid).toBe(false);
      expect(validateUsername('system').valid).toBe(false);
    });
  });

  describe('normalizeUsername', () => {
    it('should convert to lowercase', () => {
      expect(normalizeUsername('Alice')).toBe('alice');
      expect(normalizeUsername('BOB-User')).toBe('bob-user');
    });

    it('should trim whitespace', () => {
      expect(normalizeUsername('  alice  ')).toBe('alice');
      expect(normalizeUsername('\talice\n')).toBe('alice');
    });
  });

  describe('formatUsername', () => {
    it('should add @ prefix', () => {
      expect(formatUsername('alice')).toBe('@alice');
      expect(formatUsername('bob-organizer')).toBe('@bob-organizer');
    });
  });
});
