import { validateFileId, handleRequest } from './handler.js';
import { runHealthCheck } from './health-cron.js';

export interface Env {
  BREAKER_KV: KVNamespace;
  SERVICE_ACCOUNT_KEY: string;
  WEBHOOK_URL: string;
  HEALTH_TEST_FILE_ID: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/i\/(.+)$/);

    if (!match) {
      return new Response('Not Found', { status: 404 });
    }

    const fileId = match[1];

    if (!validateFileId(fileId)) {
      return new Response('Bad Request: Invalid file ID format', { status: 400 });
    }

    return handleRequest(fileId, env, ctx);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runHealthCheck(env));
  },
};
