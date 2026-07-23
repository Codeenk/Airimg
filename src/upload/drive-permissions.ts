import { getValidAccessToken } from '../auth/google-auth.js';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';

export async function setPublicPermission(fileId: string): Promise<void> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw { code: 'NOT_SIGNED_IN', message: 'Not signed in.' };
  }

  const response = await fetch(`${DRIVE_API_BASE}/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw {
      code: 'PERMISSION_FAILED',
      message: `Failed to set public permissions: ${response.status}`,
      details: errorText,
    };
  }
}
