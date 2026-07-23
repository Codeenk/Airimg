import type { AuthTokens } from '../types/index.js';
import { storeTokens, getTokens, clearTokens } from './token-store.js';

/** Google OAuth 2.0 Client ID — set via env var VITE_GOOGLE_CLIENT_ID */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REDIRECT_URI = `${window.location.origin}/`;

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function initiateSignIn(): Promise<void> {
  if (!CLIENT_ID) {
    throw {
      code: 'NOT_SIGNED_IN',
      message: 'Google Client ID is missing. Please set VITE_GOOGLE_CLIENT_ID in your .env file.',
    };
  }
  const codeVerifier = generateCodeVerifier();
  sessionStorage.setItem('airimg_pkce_verifier', codeVerifier);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function handleAuthCallback(): Promise<AuthTokens | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;

  const codeVerifier = sessionStorage.getItem('airimg_pkce_verifier');
  if (!codeVerifier) return null;

  // Clean the URL
  window.history.replaceState({}, document.title, '/');
  sessionStorage.removeItem('airimg_pkce_verifier');

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    console.error('Token exchange failed:', await response.text());
    return null;
  }

  const data = await response.json();
  const tokens: AuthTokens = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };

  storeTokens(tokens);
  return tokens;
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
