import { FILE_ID_REGEX } from '../types/index.js';
import type { HotlinkResult } from '../types/index.js';

/** Domain for hotlink — set via env var VITE_HOTLINK_DOMAIN */
const HOTLINK_DOMAIN = (import.meta.env.VITE_HOTLINK_DOMAIN as string) || 'airimg-worker.malandkar-sarvesh1.workers.dev';
const WORKER_FALLBACK_DOMAIN = 'airimg-worker.malandkar-sarvesh1.workers.dev';

export function buildHotlink(fileId: string): HotlinkResult {
  if (!FILE_ID_REGEX.test(fileId)) {
    throw new Error(`Invalid FILE_ID format: ${fileId}`);
  }

  return {
    fileId,
    hotlinkUrl: `https://${HOTLINK_DOMAIN}/i/${fileId}`,
    fallbackWorkerUrl: `https://${WORKER_FALLBACK_DOMAIN}/i/${fileId}`,
    directDriveUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
  };
}

export function extractFileId(url: string): string | null {
  const match = url.match(/\/i\/([A-Za-z0-9_-]{20,50})$/);
  return match ? match[1] : null;
}
