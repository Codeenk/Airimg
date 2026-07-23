import { CircuitBreaker } from './breaker.js';
import { mintServiceAccountToken } from './drive-auth.js';
import type { Env } from './index.js';

const FILE_ID_REGEX = /^[A-Za-z0-9_-]{20,50}$/;

export function validateFileId(id: string): boolean {
  return FILE_ID_REGEX.test(id);
}

async function tryPathA(fileId: string): Promise<Response | null> {
  try {
    const url = `https://drive.google.com/uc?export=view&id=${fileId}`;
    const resp = await fetch(url, { redirect: 'follow' });
    if (resp.ok && resp.headers.get('content-type')?.startsWith('image/')) {
      return resp;
    }
    return null;
  } catch {
    return null;
  }
}

async function tryPathB(fileId: string, env: Env): Promise<Response | null> {
  try {
    const token = await mintServiceAccountToken(env.SERVICE_ACCOUNT_KEY);
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) return resp;
    return null;
  } catch {
    return null;
  }
}

async function tryPathC(request: Request): Promise<Response | null> {
  try {
    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('Warning', '110 - stale response');
      headers.set('X-Airimg-Path', 'C-stale-cache');
      return new Response(cached.body, { status: cached.status, headers });
    }
    return null;
  } catch {
    return null;
  }
}

export async function handleRequest(fileId: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  const breaker = new CircuitBreaker(env.BREAKER_KV);
  const breakerState = await breaker.getState();

  const cacheKey = new Request(`https://cache.airimg.internal/i/${fileId}`);

  // Path A — public hotlink (only if breaker is closed)
  if (breakerState === 'closed') {
    const pathAResult = await tryPathA(fileId);
    if (pathAResult) {
      const response = new Response(pathAResult.body, {
        status: 200,
        headers: {
          'Content-Type': pathAResult.headers.get('content-type') || 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Airimg-Path': 'A-public',
        },
      });
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
      return response;
    }
    // Path A failed — record failure
    await breaker.recordFailure();
  }

  // Path B — authenticated Drive API
  const pathBResult = await tryPathB(fileId, env);
  if (pathBResult) {
    const response = new Response(pathBResult.body, {
      status: 200,
      headers: {
        'Content-Type': pathBResult.headers.get('content-type') || 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Airimg-Path': 'B-authenticated',
      },
    });
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    return response;
  }

  // Path C — stale cache
  const pathCResult = await tryPathC(cacheKey);
  if (pathCResult) return pathCResult;

  // Path D — 404 fallback PNG
  const fallbackPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const binaryString = atob(fallbackPngBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Response(bytes, {
    status: 404,
    headers: {
      'Content-Type': 'image/png',
      'X-Airimg-Path': 'D-fallback',
      'Cache-Control': 'no-cache',
    },
  });
}
