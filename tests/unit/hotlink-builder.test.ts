import { describe, it, expect } from 'vitest';
import { buildHotlink, extractFileId } from '../../src/url/hotlink-builder.js';

describe('hotlink-builder', () => {
  describe('buildHotlink', () => {
    it('builds a valid hotlink for a valid FILE_ID', () => {
      const result = buildHotlink('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8');
      expect(result.fileId).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8');
      expect(result.hotlinkUrl).toContain('/i/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8');
      expect(result.directDriveUrl).toContain('uc?export=view&id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8');
    });

    it('rejects FILE_IDs that are too short', () => {
      expect(() => buildHotlink('abc')).toThrow();
    });

    it('rejects FILE_IDs with invalid characters', () => {
      expect(() => buildHotlink('AAAAAAAAAAAAAAAAAAAAAA!@#$%')).toThrow();
    });

    it('rejects FILE_IDs that are too long', () => {
      const longId = 'A'.repeat(51);
      expect(() => buildHotlink(longId)).toThrow();
    });

    it('accepts edge-case minimum length FILE_ID (20 chars)', () => {
      const id = 'A'.repeat(20);
      const result = buildHotlink(id);
      expect(result.fileId).toBe(id);
    });

    it('accepts edge-case maximum length FILE_ID (50 chars)', () => {
      const id = 'A'.repeat(50);
      const result = buildHotlink(id);
      expect(result.fileId).toBe(id);
    });
  });

  describe('extractFileId', () => {
    it('extracts FILE_ID from a valid hotlink URL', () => {
      const id = extractFileId('https://img.airimg.example.com/i/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8');
      expect(id).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8');
    });

    it('returns null for invalid URLs', () => {
      expect(extractFileId('https://example.com/not-valid')).toBeNull();
    });
  });
});
