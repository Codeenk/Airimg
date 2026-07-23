import type { UploadResult } from '../types/index.js';
import { getValidAccessToken } from '../auth/google-auth.js';

const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const MAX_RETRIES = 3;
const RETRY_CODES = [403, 429, 500, 503];

function generateFileName(): string {
  return `${crypto.randomUUID()}.webp`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function uploadToDrive(
  blob: Blob,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw { code: 'NOT_SIGNED_IN', message: 'Not signed in. Please sign in with Google first.' };
  }

  const fileName = generateFileName();

  const metadata = {
    name: fileName,
    mimeType: 'image/webp',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob, fileName);

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(Math.pow(2, attempt) * 1000);
    }

    try {
      const response = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      });

      if (response.ok) {
        const data = await response.json();
        onProgress?.(100);
        return {
          fileId: data.id,
          fileName: data.name,
          mimeType: data.mimeType,
          webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
        };
      }

      if (response.status === 401) {
        throw { code: 'NOT_SIGNED_IN', message: 'Session expired. Please sign in again.' };
      }

      if (response.status === 403 && (await response.text()).includes('storageQuota')) {
        throw { code: 'DRIVE_QUOTA_EXCEEDED', message: 'Google Drive storage quota exceeded.' };
      }

      if (!RETRY_CODES.includes(response.status)) {
        throw { code: 'NETWORK_ERROR', message: `Upload failed with status ${response.status}` };
      }

      lastError = new Error(`Upload failed: ${response.status}`);
    } catch (e) {
      if ((e as any).code) throw e; // Re-throw AppErrors
      lastError = e;
    }
  }

  throw { code: 'NETWORK_ERROR', message: 'Upload failed after retries', details: lastError };
}
