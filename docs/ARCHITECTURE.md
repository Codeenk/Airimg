# Airimg Architecture Specification

## 1. Product Mission & Overview

Airimg is a serverless, zero-database image hotlinking service that allows users to:
1. **Authenticate via Google OAuth 2.0 (PKCE flow)** with minimal `drive.file` scope.
2. **Drag & drop images** into the browser for native client-side WebP compression (q=0.8, max 2560px long edge).
3. **Strip all EXIF/GPS metadata** automatically via canvas re-encoding before any network upload.
4. **Upload files directly** to the user's own Google Drive account via Google Drive API v3.
5. **Set public permissions** (`role: reader`, `type: anyone`) on the uploaded image.
6. **Generate a permanent hotlink URL**: `https://img.airimg.airlabs.eu.cc/i/<FILE_ID>`.
7. **Deliver images through a self-healing Cloudflare Worker edge layer** with multi-tier failover protection.

---

## 2. System Architecture & Component Flow

```
┌─────────────────────────────────────────────────────────┐
│                     User Browser                        │
│                                                         │
│ 1. Google OAuth 2.0 ──(Auth Code + PKCE)──► Google GIS  │
│    (drive.file scope)                                   │
│ 2. Canvas Compress  ──► Strips EXIF/GPS metadata        │
│    (WebP q=0.8, ≤2560px)                                │
│ 3. Multipart Upload ──────────────────────► Drive API v3 │
│ 4. Set Permissions  ──► role:reader, type:anyone        │
│ 5. Construct URL    ──► https://img.airimg.<domain>/i/<ID>│
└────────────────────────────┬────────────────────────────┘
                             │
                             │ HTTPS Request: /i/<FILE_ID>
                             ▼
┌─────────────────────────────────────────────────────────┐
│             Cloudflare Edge Layer (Worker)              │
│                                                         │
│ Step 1: Security Gate & Regex Validation                │
│         Validate FILE_ID format: ^[A-Za-z0-9_-]{20,50}$ │
│         Reject (400) non-matching IDs (Anti-SSRF)       │
│                                                         │
│ Step 2: Circuit Breaker Inspection                      │
│         Check breaker:public-hotlink KV state           │
│                                                         │
│ Step 3: Tiered Delivery Execution                       │
│                                                         │
│   PATH A (Default - Fast Public Hotlink):               │
│   drive.google.com/uc?export=view&id={FILE_ID}           │
│   [Only executed when breaker is CLOSED]                │
│                                                         │
│   PATH B (Fallback - Authenticated Drive API v3):       │
│   googleapis.com/drive/v3/files/{FILE_ID}?alt=media     │
│   [Service account bearer token, stable & documented]   │
│                                                         │
│   PATH C (Last Resort Cache - Stale Response):          │
│   Cloudflare Edge Cache match with Warning: 110 header  │
│                                                         │
│   PATH D (Terminal State - Fallback PNG):               │
│   Serve 404-fallback.png with HTTP 404 status           │
│                                                         │
│ Step 4: KV Breaker State Maintenance                    │
│         Debounced writes on state transitions only      │
│         (closed → open, open → closed)                  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Verified API Decisions (July 2026 Reference Baseline)

| Component / Decision | Verified Status & Rationale |
| :--- | :--- |
| **Google Drive API v3** | Confirmed current stable version. No v4 or deprecation notices exist. |
| **Auth: Google Identity Services (GIS) + PKCE** | Browser-only standard. Implicit flow and legacy `gapi.auth2` are deprecated by Google. |
| **`drive.google.com/uc?export=view&id=` (Path A)** | Informal endpoint known to exhibit intermittent 403 errors under load. Fast when functional, but never relied upon as a single point of failure. |
| **`files.get?alt=media` (Path B)** | Officially documented REST endpoint for media retrieval. Requires service account OAuth bearer token. |
| **Cloudflare Workers KV Limits (Free Tier)** | 100,000 reads/day, 1,000 writes/day, 1GB storage. Requires debounced write logic in breaker. |
| **Cloudflare Workers Execution Limits** | 100,000 requests/day, 10ms CPU/invocation, Cron Triggers included free. |

---

## 4. The Self-Healing System Architecture

### 4.1 Circuit Breaker (`breaker.ts`)
- **KV Key**: `breaker:public-hotlink`
- **State Schema**: `{ state: "closed" | "open", trippedAt: <timestamp>, failureCount: <int> }`
- **Debounce Protocol**: KV writes are performed **only on state transitions**:
  - `closed → open`: Triggered when in-memory failures reach threshold (5 consecutive errors). Performs 1 write.
  - `open → closed`: Triggered after a 5-minute cooldown period when a probe/request succeeds. Performs 1 write.
- **Quota Protection**: Ensures 5,000 burst failures produce at most single-digit KV writes, preventing KV quota exhaustion.

### 4.2 Tiered Fallback Matrix

| Tier | Endpoint / Mechanism | Conditions for Trigger | Response Headers |
| :--- | :--- | :--- | :--- |
| **Path A** | `https://drive.google.com/uc?export=view&id={id}` | Breaker is `closed` | `Cache-Control: public, max-age=31536000, immutable`, `X-Airimg-Path: A-public` |
| **Path B** | `https://www.googleapis.com/drive/v3/files/{id}?alt=media` | Breaker is `open` or Path A failed | `Authorization: Bearer <SA_TOKEN>`, `X-Airimg-Path: B-authenticated` |
| **Path C** | Cloudflare Edge Cache match | Path A & B failed | `Warning: 110 - stale response`, `X-Airimg-Path: C-stale-cache` |
| **Path D** | Embedded 404 PNG | All paths failed | HTTP 404, `Content-Type: image/png`, `X-Airimg-Path: D-fallback` |

### 4.3 Automated Health Monitor (`health-cron.ts`)
- Scheduled via Worker Cron Trigger (`*/5 * * * *` — every 5 minutes).
- Probes a designated test `FILE_ID` via Path A and Path B.
- Tracks latency and health status in KV (`health:status`).
- Triggers webhook alerts (Slack/Discord/email relay) on state changes (e.g. Path A going down or recovering).

---

## 5. Explicit Non-Goal Statement

> **Self-Healing Scope Boundaries**: The Airimg self-healing subsystem performs automated failover and recovery between pre-engineered, human-reviewed delivery pathways (Path A, Path B, Path C, Path D). It **does not** automatically discover unreleased third-party APIs, synthesize new protocol adapters, or rewrite its own code dynamically. If Google makes breaking architectural changes to both Drive API v3 and `uc?export=view`, human intervention is required to introduce a new delivery path.

---

## 6. Known Spec Corrections & Technical Tradeoffs

1. **Unlimited $0 Lifetime Storage**: Real rate limits and storage quotas apply to both Google Cloud and Cloudflare Free tiers. Airimg mitigates downtime risks via edge caching (1-year TTL) and tiered failover, not by pretending rate limits do not exist.
2. **Sub-50ms Latency Scope**: Sub-50ms response times apply strictly to edge cache hits. Initial cache-miss fetches via Path B (authenticated API) incur network round-trip time for token validation and Drive API media retrieval.
3. **Zero-Database Architectural Integrity**: `FILE_ID` encoded directly within the URL path (`/i/<FILE_ID>`) is the sole entity key. Workers KV is strictly restricted to runtime operational metadata (circuit breaker state, health probes) and is never used as an application database.
4. **15GB Personal Quotas**: The 15GB free tier limit operates on a per-user basis via Google OAuth (`drive.file` scope). Storage is bound to the end user's personal Google Drive, avoiding central application storage costs.
