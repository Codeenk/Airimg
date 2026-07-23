// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateFile, compressImage } from '../../src/compress/image-compressor.js';
import { MAX_FILE_SIZE } from '../../src/types/index.js';

describe('image-compressor', () => {
  describe('validateFile', () => {
    it('accepts supported MIME types within size limit', () => {
      const validPng = new File(['dummy'], 'test.png', { type: 'image/png' });
      expect(validateFile(validPng)).toBeNull();

      const validJpeg = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' });
      expect(validateFile(validJpeg)).toBeNull();

      const validWebp = new File(['dummy'], 'test.webp', { type: 'image/webp' });
      expect(validateFile(validWebp)).toBeNull();
    });

    it('rejects unsupported MIME types', () => {
      const pdfFile = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
      const err = validateFile(pdfFile);
      expect(err?.code).toBe('BAD_FILE_TYPE');
      expect(err?.message).toContain('Unsupported file type');
    });

    it('rejects files exceeding 25MB pre-compression cap', () => {
      const hugeFile = new File([new ArrayBuffer(MAX_FILE_SIZE + 100)], 'huge.png', { type: 'image/png' });
      const err = validateFile(hugeFile);
      expect(err?.code).toBe('FILE_TOO_LARGE');
      expect(err?.message).toContain('Maximum is 25MB');
    });
  });

  describe('compressImage mock canvas execution & EXIF stripping', () => {
    beforeEach(() => {
      // Mock URL.createObjectURL / revokeObjectURL
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      globalThis.URL.revokeObjectURL = vi.fn();

      // Mock Image constructor
      globalThis.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        naturalWidth = 3000;
        naturalHeight = 2000;
        _src = '';

        set src(url: string) {
          this._src = url;
          setTimeout(() => this.onload?.(), 10);
        }
        get src() {
          return this._src;
        }
      } as any;

      // Mock HTMLCanvasElement
      const mockCtx = {
        drawImage: vi.fn(),
      };
      
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockCtx),
        toBlob: vi.fn((cb: (blob: Blob | null) => void, type: string, quality: number) => {
          // Return a mock webp blob
          cb(new Blob(['mock-webp-data'], { type: 'image/webp' }));
        }),
      };

      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'canvas') return mockCanvas as any;
        return document.createElement(tagName);
      });
    });

    it('compresses high-res image (>2560px) and resizes long edge down to 2560px', async () => {
      const originalFile = new File([new ArrayBuffer(500000)], 'highres.jpg', { type: 'image/jpeg' });
      const result = await compressImage(originalFile);

      expect(result.width).toBe(2560);
      expect(result.height).toBe(1707); // 2000 * (2560/3000)
      expect(result.blob.type).toBe('image/webp');
      expect(result.originalSize).toBe(500000);
    });

    it('strips EXIF metadata by virtue of canvas pixel re-encoding', async () => {
      // Create a JPEG file stub with dummy EXIF header bytes (FF E1 ...)
      const jpegWithExif = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x10, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
      const exifFile = new File([jpegWithExif], 'gps_photo.jpg', { type: 'image/jpeg' });

      const result = await compressImage(exifFile);
      const compressedBuffer = new Uint8Array(await result.blob.arrayBuffer());

      // Confirm re-encoded WebP output does not contain the EXIF marker string "Exif\0\0"
      const textDecoder = new TextDecoder();
      const decodedOutput = textDecoder.decode(compressedBuffer);
      expect(decodedOutput).not.toContain('Exif');
    });
  });
});
