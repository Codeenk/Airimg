# Airimg

**Drag, compress, upload to your Google Drive, get a permanent hotlink.**

Airimg lets you:

1. **Sign in with Google** — OAuth 2.0 with PKCE, `drive.file` scope only
2. **Drag an image** into the browser
3. **Auto-compress** to WebP (strips EXIF/GPS metadata)
4. **Upload** directly to your own Google Drive
5. **Get a hotlink** — `https://img.airimg.<domain>/i/<FILE_ID>` — permanent, fast, embeddable

No backend, no database, no paid storage. Your images live in your Drive.

## Quick Start

```bash
# Install
npm install

# Create .env from template
cp .env.example .env
# Fill in VITE_GOOGLE_CLIENT_ID and VITE_HOTLINK_DOMAIN

# Dev server
npm run dev

# Build
npm run build

# Run tests
npm test
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design, including the self-healing edge delivery system with circuit breaker and tiered fallback.

## Security

See [docs/SECURITY.md](docs/SECURITY.md).

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
