import type { AuthTokens } from '../types/index.js';

const STORAGE_KEY = 'airimg_auth_tokens';

export function storeTokens(tokens: AuthTokens): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function getTokens(): AuthTokens | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const tokens: AuthTokens = JSON.parse(raw);
    if (tokens.expiresAt <= Date.now()) {
      clearTokens();
      return null;
    }
    return tokens;
  } catch {
    clearTokens();
    return null;
  }
}

export function clearTokens(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isTokenValid(): boolean {
  const tokens = getTokens();
  return tokens !== null && tokens.expiresAt > Date.now();
}
