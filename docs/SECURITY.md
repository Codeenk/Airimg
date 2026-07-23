# Airimg Security Model & Implementation

## 1. Minimal OAuth Scope (`drive.file`)

Airimg requests only a single OAuth 2.0 scope:
`https://www.googleapis.com/auth/drive.file`

### Security Guarantees:
- **Per-file Access Isolation**: The app can ONLY see and access files created by Airimg.
- **Zero Access to Personal Files**: The app cannot read, modify, or list any existing documents, photos, or files in the user's Google Drive.
- **Revocable Access**: The user can revoke permissions at any time via Google Account settings without impacting other files.

---

## 2. Authentication & Secret Management

- **Public Native App Flow (PKCE)**: Uses Google Identity Services with PKCE (Proof Key for Code Exchange, S256). No OAuth client secret is stored or used anywhere in the client codebase.
- **Origin Locking**: OAuth Client IDs must be strictly restricted in Google Cloud Console to authorized domains:
  - Production: `https://airimg.airlabs.eu.cc`
  - Development: `http://localhost:5173`
- **Token Security**:
  - OAuth access tokens are held exclusively in browser `sessionStorage`.
  - Tokens are never written to `localStorage`, IndexedDB, or cookies.
  - Tokens are never logged, tracked, or transmitted to any server other than official `*.googleapis.com` endpoints.
  - Tokens are cleared immediately on expiration or explicit sign-out.

---

## 3. Privacy & Metadata Protection

- **EXIF / GPS Stripping**: Raw user images are drawn onto an HTML5 Canvas / OffscreenCanvas and re-encoded into WebP format (`q=0.8`). This pixel re-encoding process completely strips all EXIF, GPS, camera metadata, and color profiles.
- **Randomized File Names**: Uploaded files are renamed using cryptographically secure UUIDs (`crypto.randomUUID() + '.webp'`). Original filenames uploaded by users are discarded before transmission.

---

## 4. Edge Layer Protection & Anti-SSRF

- **Regex Validation Gate**: Every request to the Cloudflare Worker validates the `FILE_ID` parameter against a strict regex before initiating any outbound fetch:
  `^[A-Za-z0-9_-]{20,50}$`
- **Anti-Open-Relay / SSRF Prevention**: Malformed IDs, URL path traversals, or external URLs are rejected with HTTP 400 at the edge before any backend HTTP request is made.
- **Worker Secret Storage**:
  - Google Service Account keys for Path B are stored exclusively as Cloudflare Worker secrets via `wrangler secret put SERVICE_ACCOUNT_KEY`.
  - Health check alert webhook URLs are stored via `wrangler secret put WEBHOOK_URL`.
  - Secrets are injected into the runtime environment at the edge and never exposed to git repositories or client bundles.

---

## 5. Client Validation & Armor

- Pre-upload validation enforces:
  - Allowed image MIME types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/bmp`, `image/tiff`
  - Pre-compression size limit: **25MB**
  - Dimension constraint: Long edge scaled to max **2560px**
