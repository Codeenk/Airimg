import { describe, it, expect, beforeEach } from 'vitest';
import { storeTokens, getTokens, clearTokens, isTokenValid } from '../../src/auth/token-store.js';
import type { AuthTokens } from '../../src/types/index.js';

// Mock sessionStorage in node/vitest environment
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('token-store', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores and retrieves valid tokens from sessionStorage', () => {
    const validTokens: AuthTokens = {
      accessToken: 'test_access_token_123',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'https://www.googleapis.com/auth/drive.file'
    };

    storeTokens(validTokens);
    expect(getTokens()).toEqual(validTokens);
    expect(isTokenValid()).toBe(true);
  });

  it('automatically clears and returns null for expired tokens', () => {
    const expiredTokens: AuthTokens = {
      accessToken: 'expired_token',
      expiresAt: Date.now() - 1000, // 1 sec in the past
      scope: 'https://www.googleapis.com/auth/drive.file'
    };

    storeTokens(expiredTokens);
    expect(getTokens()).toBeNull();
    expect(isTokenValid()).toBe(false);
  });

  it('clears tokens properly', () => {
    const validTokens: AuthTokens = {
      accessToken: 'test_token',
      expiresAt: Date.now() + 3600 * 1000,
      scope: 'https://www.googleapis.com/auth/drive.file'
    };

    storeTokens(validTokens);
    clearTokens();
    expect(getTokens()).toBeNull();
    expect(isTokenValid()).toBe(false);
  });
});
