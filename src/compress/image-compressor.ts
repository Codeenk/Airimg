import type { CompressResult, AppError } from '../types/index.js';
import { WEBP_QUALITY, MAX_LONG_EDGE, ACCEPTED_TYPES, MAX_FILE_SIZE } from '../types/index.js';

function validateFile(file: File): AppError | null {
  if (!ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])) {
    return { code: 'BAD_FILE_TYPE', message: `Unsupported file type: ${file.type}. Accepted: ${ACCEPTED_TYPES.join(', ')}` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { code: 'FILE_TOO_LARGE', message: `File is ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is ${MAX_FILE_SIZE / 1024 / 1024}MB.` };
  }
  return null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

function calculateDimensions(width: number, height: number): { w: number; h: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_LONG_EDGE) return { w: width, h: height };
  const scale = MAX_LONG_EDGE / longEdge;
  return { w: Math.round(width * scale), h: Math.round(height * scale) };
}

export async function compressImage(file: File): Promise<CompressResult> {
  const validationError = validateFile(file);
  if (validationError) {
    throw validationError;
  }

  const img = await loadImage(file);
  const { w, h } = calculateDimensions(img.naturalWidth, img.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw { code: 'COMPRESS_FAILED', message: 'Canvas 2D context unavailable' } satisfies AppError;

  // Drawing to canvas and re-encoding to WebP strips all EXIF/GPS metadata
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject({ code: 'COMPRESS_FAILED', message: 'WebP encoding failed' } satisfies AppError),
      'image/webp',
      WEBP_QUALITY
    );
  });

  return {
    blob,
    originalSize: file.size,
    compressedSize: blob.size,
    width: w,
    height: h,
  };
}

export { validateFile };
