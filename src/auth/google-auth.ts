import type { AuthTokens } from '../types/index.js';
import { storeTokens, getTokens, clearTokens } from './token-store.js';

/** Google OAuth 2.0 Client ID — set via env var VITE_GOOGLE_CLIENT_ID */
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '27431707625-pd03n480k1gffa4rq9pnt1gbvj2frj55.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: any;
  }
}

let sdkPromise: Promise<void> | null = null;

export function loadGoogleSdk(): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity SDK')), { once: true });
      // Poll briefly if script element exists
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve();
        } else if (attempts > 50) {
          clearInterval(interval);
          reject(new Error('Google Identity SDK load timeout'));
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity SDK'));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export async function initiateSignIn(): Promise<void> {
  if (!CLIENT_ID) {
    throw {
      code: 'NOT_SIGNED_IN',
      message: 'Google Client ID is missing. Please set VITE_GOOGLE_CLIENT_ID in your .env file.',
    };
  }

  try {
    await loadGoogleSdk();
  } catch (e) {
    throw {
      code: 'NETWORK_ERROR',
      message: 'Google Identity Services SDK failed to load. Please check your network connection or ad blocker.',
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

  if (Date.now() >= tokens.expiresAt - 60000) {
    clearTokens();
    return null;
  }

  return tokens.accessToken;
}

export function isSignedIn(): boolean {
  const tokens = getTokens();
  if (!tokens) return false;
  return Date.now() < tokens.expiresAt - 60000;
}

export function signOut(): void {
  clearTokens();
}
