// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateFileId, handleRequest } from '../../edge/worker/src/handler.js';
import * as driveAuth from '../../edge/worker/src/drive-auth.js';

class MockKV {
  private store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('Worker Handler & Tiered Fallback', () => {
  let env: any;
  let ctx: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    env = {
      BREAKER_KV: new MockKV(),
      SERVICE_ACCOUNT_KEY: JSON.stringify({
        client_email: 'test@serviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----',
        token_uri: 'https://oauth2.googleapis.com/token',
      }),
      WEBHOOK_URL: '',
      HEALTH_TEST_FILE_ID: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8',
    };
    ctx = {
      waitUntil: vi.fn(),
    };

    // Mock global caches
    (globalThis as any).caches = {
      default: {
        match: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  describe('validateFileId', () => {
    it('validates FILE_ID format against regex', () => {
      expect(validateFileId('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8')).toBe(true);
      expect(validateFileId('abc')).toBe(false);
      expect(validateFileId('invalid_char!')).toBe(false);
    });
  });

  describe('handleRequest tiered fallback', () => {
    it('serves Path A (public hotlink) when healthy and returns 200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/webp' }),
        body: 'fake-image-stream',
      });

      const fileId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8';
      const res = await handleRequest(fileId, env, ctx);

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Airimg-Path')).toBe('A-public');
    });

    it('falls back to Path B (authenticated API) when Path A fails', async () => {
      vi.spyOn(driveAuth, 'mintServiceAccountToken').mockResolvedValue('sa_mock_token');

      // First fetch (Path A) fails, second fetch (Path B) succeeds
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 403 }) // Path A fails
        .mockResolvedValueOnce({ // Path B succeeds
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/webp' }),
          body: 'fake-image-stream-from-path-b',
        });

      const fileId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8';
      const res = await handleRequest(fileId, env, ctx);

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Airimg-Path')).toBe('B-authenticated');
    });

    it('falls through to Path D (404 fallback PNG) when all paths fail', async () => {
      vi.spyOn(driveAuth, 'mintServiceAccountToken').mockRejectedValue(new Error('Auth failed'));

      // Both Path A and Path B fail
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

      const fileId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8';
      const res = await handleRequest(fileId, env, ctx);

      expect(res.status).toBe(404);
      expect(res.headers.get('X-Airimg-Path')).toBe('D-fallback');
      expect(res.headers.get('Content-Type')).toBe('image/png');
    });
  });
});
