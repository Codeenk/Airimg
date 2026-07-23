/** Shared FILE_ID validation regex — must stay in sync with edge worker */
export const FILE_ID_REGEX = /^[A-Za-z0-9_-]{20,50}$/;

export interface CompressResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  webViewLink: string;
}

export interface HotlinkResult {
  fileId: string;
  hotlinkUrl: string;
  directDriveUrl: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresAt: number;
  scope: string;
}

export type UploadStage = 'idle' | 'compressing' | 'uploading' | 'setting-permissions' | 'done' | 'error';

export interface UploadProgress {
  stage: UploadStage;
  percent: number;
  message: string;
}

export interface AppError {
  code: 'NOT_SIGNED_IN' | 'BAD_FILE_TYPE' | 'FILE_TOO_LARGE' | 'NETWORK_ERROR' | 'DRIVE_QUOTA_EXCEEDED' | 'PERMISSION_FAILED' | 'COMPRESS_FAILED' | 'UNKNOWN';
  message: string;
  details?: unknown;
}

/** Max file size before compression: 25MB */
export const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** WebP compression quality */
export const WEBP_QUALITY = 0.8;

/** Max long edge in pixels */
export const MAX_LONG_EDGE = 2560;

/** Accepted image MIME types */
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'] as const;
