// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { uploadToDrive } from '../../src/upload/drive-upload.js';
import { setPublicPermission } from '../../src/upload/drive-permissions.js';
import * as googleAuth from '../../src/auth/google-auth.js';

describe('drive-upload & drive-permissions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadToDrive', () => {
    it('throws NOT_SIGNED_IN if user has no valid access token', async () => {
      vi.spyOn(googleAuth, 'getValidAccessToken').mockResolvedValue(null);
      const dummyBlob = new Blob(['test'], { type: 'image/webp' });

      await expect(uploadToDrive(dummyBlob)).rejects.toEqual({
        code: 'NOT_SIGNED_IN',
        message: 'Not signed in. Please sign in with Google first.',
      });
    });

    it('uploads multipart data and returns fileId on success', async () => {
      vi.spyOn(googleAuth, 'getValidAccessToken').mockResolvedValue('valid_token_123');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test_file_id_99999999999999999999',
          name: 'uuid.webp',
          mimeType: 'image/webp',
          webViewLink: 'https://drive.google.com/file/d/test_file_id_99999999999999999999/view',
        }),
      });
      globalThis.fetch = mockFetch;

      const dummyBlob = new Blob(['fake_webp_bytes'], { type: 'image/webp' });
      const progressCb = vi.fn();
      const result = await uploadToDrive(dummyBlob, progressCb);

      expect(result.fileId).toBe('test_file_id_99999999999999999999');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer valid_token_123' },
        })
      );
      expect(progressCb).toHaveBeenCalledWith(100);
    });

    it('throws DRIVE_QUOTA_EXCEEDED on 403 storageQuota error', async () => {
      vi.spyOn(googleAuth, 'getValidAccessToken').mockResolvedValue('valid_token_123');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'User storageQuota exceeded',
      });

      const dummyBlob = new Blob(['fake_bytes'], { type: 'image/webp' });
      await expect(uploadToDrive(dummyBlob)).rejects.toEqual({
        code: 'DRIVE_QUOTA_EXCEEDED',
        message: 'Google Drive storage quota exceeded.',
      });
    });
  });

  describe('setPublicPermission', () => {
    it('sends POST request to set role:reader and type:anyone', async () => {
      vi.spyOn(googleAuth, 'getValidAccessToken').mockResolvedValue('valid_token_123');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'permission_id_123' }),
      });
      globalThis.fetch = mockFetch;

      const fileId = 'test_file_id_99999999999999999999';
      await setPublicPermission(fileId);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid_token_123',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: 'reader', type: 'anyone' }),
        }
      );
    });

    it('throws PERMISSION_FAILED when Google API returns error', async () => {
      vi.spyOn(googleAuth, 'getValidAccessToken').mockResolvedValue('valid_token_123');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid permission request',
      });

      await expect(setPublicPermission('test_file_id_99999999999999999999')).rejects.toEqual({
        code: 'PERMISSION_FAILED',
        message: 'Failed to set public permissions: 400',
        details: 'Invalid permission request',
      });
    });
  });
});
