import type { AuthTokens } from '../types/index.js';
import { storeTokens, getTokens, clearTokens } from './token-store.js';

/** Google OAuth 2.0 Client ID — set via env var VITE_GOOGLE_CLIENT_ID */
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '27431707625-pd03n480k1gffa4rq9pnt1gbvj2frj55.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: any;
  }
}

export async function initiateSignIn(): Promise<void> {
  if (!CLIENT_ID) {
    throw {
      code: 'NOT_SIGNED_IN',
      message: 'Google Client ID is missing. Please set VITE_GOOGLE_CLIENT_ID in your .env file.',
    };
  }

  return new Promise((resolve, reject) => {
    if (typeof window.google === 'undefined' || !window.google.accounts || !window.google.accounts.oauth2) {
      reject({
        code: 'NETWORK_ERROR',
        message: 'Google Identity Services SDK failed to load. Please check your network connection or ad blocker.',
      });
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.error) {
            reject({
              code: 'NOT_SIGNED_IN',
              message: `Google Sign-In failed: ${response.error}`,
            });
            return;
          }

          if (response.access_token) {
            const tokens: AuthTokens = {
              accessToken: response.access_token,
              expiresAt: Date.now() + (Number(response.expires_in) || 3600) * 1000,
              scope: response.scope || 'https://www.googleapis.com/auth/drive.file',
            };
            storeTokens(tokens);
            resolve();
          }
        },
      });

      client.requestAccessToken();
    } catch (e) {
      reject({
        code: 'NOT_SIGNED_IN',
        message: `Failed to initialize Google Sign-In: ${String(e)}`,
      });
    }
  });
}

export async function handleAuthCallback(): Promise<AuthTokens | null> {
  return getTokens();
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens) return null;
  // Token still valid (with 60s buffer)
  if (tokens.expiresAt > Date.now() + 60_000) {
    return tokens.accessToken;
  }
  // Token expired — user must re-auth
  clearTokens();
  return null;
}

export function signOut(): void {
  clearTokens();
}

export function isSignedIn(): boolean {
  return getTokens() !== null;
}
