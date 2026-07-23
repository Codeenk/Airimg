import type { Env } from './index.js';
import { mintServiceAccountToken } from './drive-auth.js';

interface HealthStatus {
  pathA: { ok: boolean; latencyMs: number; timestamp: number };
  pathB: { ok: boolean; latencyMs: number; timestamp: number };
}

const HEALTH_KV_KEY = 'health:status';
const HEALTH_HISTORY_KEY = 'health:history';

async function probePathA(fileId: string): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await fetch(`https://drive.google.com/uc?export=view&id=${fileId}`, {
      redirect: 'follow',
    });
    const latencyMs = Date.now() - start;
    return { ok: resp.ok && (resp.headers.get('content-type')?.startsWith('image/') ?? false), latencyMs };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

async function probePathB(fileId: string, serviceAccountKey: string): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const token = await mintServiceAccountToken(serviceAccountKey);
    const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const latencyMs = Date.now() - start;
    return { ok: resp.ok, latencyMs };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

async function sendWebhookAlert(webhookUrl: string, message: string): Promise<void> {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🖼️ Airimg Health Alert: ${message}`,
        content: `🖼️ Airimg Health Alert: ${message}`,
      }),
    });
  } catch {
    // Webhook failure is non-fatal
  }
}

export async function runHealthCheck(env: Env): Promise<void> {
  const fileId = env.HEALTH_TEST_FILE_ID;
  if (!fileId) return;

  const [pathA, pathB] = await Promise.all([
    probePathA(fileId),
    probePathB(fileId, env.SERVICE_ACCOUNT_KEY),
  ]);

  const currentStatus: HealthStatus = {
    pathA: { ...pathA, timestamp: Date.now() },
    pathB: { ...pathB, timestamp: Date.now() },
  };

  // Load previous status for state-change detection
  const prevRaw = await env.BREAKER_KV.get(HEALTH_KV_KEY);
  let prevStatus: HealthStatus | null = null;
  if (prevRaw) {
    try {
      prevStatus = JSON.parse(prevRaw);
    } catch {}
  }

  // Detect state changes and alert
  if (prevStatus) {
    if (prevStatus.pathA.ok && !currentStatus.pathA.ok) {
      await sendWebhookAlert(env.WEBHOOK_URL, `Path A (public hotlink) went DOWN. Latency: ${pathA.latencyMs}ms`);
    } else if (!prevStatus.pathA.ok && currentStatus.pathA.ok) {
      await sendWebhookAlert(env.WEBHOOK_URL, `Path A (public hotlink) recovered. Latency: ${pathA.latencyMs}ms`);
    }

    if (prevStatus.pathB.ok && !currentStatus.pathB.ok) {
      await sendWebhookAlert(env.WEBHOOK_URL, `⚠️ Path B (authenticated API) went DOWN. Latency: ${pathB.latencyMs}ms. BOTH PATHS MAY BE DOWN.`);
    } else if (!prevStatus.pathB.ok && currentStatus.pathB.ok) {
      await sendWebhookAlert(env.WEBHOOK_URL, `Path B (authenticated API) recovered. Latency: ${pathB.latencyMs}ms`);
    }
  }

  // Store current status
  await env.BREAKER_KV.put(HEALTH_KV_KEY, JSON.stringify(currentStatus));
}
