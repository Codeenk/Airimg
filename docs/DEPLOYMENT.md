# Airimg Deployment & Operations Manual

This guide details the step-by-step process for deploying Airimg to production on Cloudflare Pages, Cloudflare Workers, and Google Cloud Console.

---

## 1. Target Infrastructure & Domains

- **Frontend SPA Domain**: `https://airimg.airlabs.eu.cc`
- **Hotlink Delivery Domain**: `https://img.airimg.airlabs.eu.cc`

---

## 2. Google Cloud Platform (GCP) Configuration

### 2.1 OAuth 2.0 Client ID (Frontend)
1. Navigate to **GCP Console** → **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. Select **Web application** as Application type.
4. Set Name: `Airimg Web Client`.
5. Under **Authorised JavaScript origins**, add:
   - `https://airimg.airlabs.eu.cc`
   - `http://localhost:5173`
6. Under **Authorised redirect URIs**, add:
   - `https://airimg.airlabs.eu.cc/`
   - `http://localhost:5173/`
7. Copy the generated **Client ID**.

### 2.2 Service Account (Edge Worker Path B)
1. Go to **IAM & Admin** → **Service Accounts**.
2. Click **Create Service Account** (Name: `airimg-edge-worker`).
3. Grant role: **Google Drive Viewer** (or leave unassigned; explicit file sharing is sufficient).
4. Go to **Keys** → **Add Key** → **Create new key** (JSON format).
5. Download the JSON key file.

---

## 3. Frontend Deployment Options

### Option A: Deploy Frontend to Vercel
1. Connect your GitHub repository to Vercel.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Add Environment Variables:
   - `VITE_GOOGLE_CLIENT_ID` = `27431707625-pd03n480k1gffa4rq9pnt1gbvj2frj55.apps.googleusercontent.com`
   - `VITE_HOTLINK_DOMAIN` = `img.airimg.airlabs.eu.cc`
6. Assign Custom Domain: `airimg.airlabs.eu.cc`.

### Option B: Deploy Frontend to Cloudflare Pages
```bash
# Build environment variables
VITE_GOOGLE_CLIENT_ID=27431707625-pd03n480k1gffa4rq9pnt1gbvj2frj55.apps.googleusercontent.com
VITE_HOTLINK_DOMAIN=img.airimg.airlabs.eu.cc

# Deploy dist to Cloudflare Pages
npx wrangler pages deploy dist --project-name=airimg
```

---

## 4. Edge Worker Deployment (Cloudflare Workers)

### 4.1 KV Namespace Provisioning
```bash
cd edge/worker
npx wrangler kv namespace create BREAKER_KV
```
Copy the returned `id` into `edge/worker/wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "BREAKER_KV"
id = "<YOUR_KV_NAMESPACE_ID>"
```

### 4.2 Worker Secrets Configuration
Execute the following commands in terminal and paste secret values when prompted:

```bash
# 1. Service Account JSON key string (entire contents of GCP service account JSON file)
npx wrangler secret put SERVICE_ACCOUNT_KEY

# 2. Alert Webhook URL (Slack / Discord / Email relay webhook URL)
npx wrangler secret put WEBHOOK_URL

# 3. Health Check Test FILE_ID (A publicly accessible test image FILE_ID in Drive)
npx wrangler secret put HEALTH_TEST_FILE_ID
```

### 4.3 Deploy Worker
```bash
npx wrangler deploy
```

---

## 5. DNS & Routing Setup (Cloudflare Dashboard)

1. Open Cloudflare Dashboard for domain `airlabs.eu.cc`.
2. Navigate to **Workers & Pages** → **Routes** (or Custom Domains).
3. Add Custom Domain for Worker: `img.airimg.airlabs.eu.cc`.
4. Route pattern: `img.airimg.airlabs.eu.cc/i/*` -> `airimg-worker`.

---

## 6. Self-Healing Verification & Health Checks

### Test Path A (Normal Execution)
```bash
curl -I https://img.airimg.airlabs.eu.cc/i/<VALID_FILE_ID>
# Expected response header: X-Airimg-Path: A-public
```

### Test Path B (Forced Failover)
Temporarily modify file permissions or simulate Path A failure:
```bash
curl -I https://img.airimg.airlabs.eu.cc/i/<FILE_ID>
# Expected response header: X-Airimg-Path: B-authenticated
```
