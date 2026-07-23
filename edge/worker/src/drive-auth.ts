/**
 * Mints a short-lived OAuth2 access token from a Google service account JSON key.
 * Used only for Path B fallback (authenticated Drive API access).
 * 
 * The service account key is stored as a Cloudflare Worker secret,
 * never committed to source.
 */

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

const TOKEN_CACHE = new Map<string, { token: string; expiresAt: number }>();

async function createJWT(sa: ServiceAccountKey): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const headerB64 = encode(header);
  const claimsB64 = encode(claims);
  const unsignedJwt = `${headerB64}.${claimsB64}`;

  // Import the PEM private key
  const pemContent = sa.private_key
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
    .replace(/-----END RSA PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${unsignedJwt}.${signatureB64}`;
}

export async function mintServiceAccountToken(serviceAccountKeyJson: string): Promise<string> {
  // Check cache first
  const cached = TOKEN_CACHE.get('sa_token');
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const sa: ServiceAccountKey = JSON.parse(serviceAccountKeyJson);
  const jwt = await createJWT(sa);

  const response = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Service account token exchange failed: ${response.status}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };

  TOKEN_CACHE.set('sa_token', {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}
