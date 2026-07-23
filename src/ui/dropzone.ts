import type { AppError } from '../types/index.js';
import { ACCEPTED_TYPES, MAX_FILE_SIZE } from '../types/index.js';

export function createDropzone(
  container: HTMLElement,
  onFile: (file: File) => void,
  onError: (error: AppError) => void
): { destroy: () => void } {
  const zone = document.createElement('div');
  zone.id = 'dropzone';
  zone.className = 'dropzone';
  zone.innerHTML = `
    <div class="dropzone-content">
      <svg class="dropzone-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <p class="dropzone-label">Drop an image here</p>
      <p class="dropzone-sublabel">or click to browse • PNG, JPEG, GIF, WebP, BMP, TIFF • Max 25MB</p>
    </div>
    <input type="file" id="file-input" accept="${ACCEPTED_TYPES.join(',')}" hidden />
  `;

  const fileInput = zone.querySelector('#file-input') as HTMLInputElement;

  function validateAndEmit(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])) {
      onError({ code: 'BAD_FILE_TYPE', message: `Unsupported file type: ${file.type}` });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      onError({ code: 'FILE_TOO_LARGE', message: `File is ${(file.size / 1024 / 1024).toFixed(1)}MB. Max is 25MB.` });
      return;
    }
    onFile(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.add('dropzone--active');
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('dropzone--active');
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('dropzone--active');
    const file = e.dataTransfer?.files[0];
    if (file) validateAndEmit(file);
  }

  function handleClick() {
    fileInput.click();
  }

  function handleFileChange() {
    const file = fileInput.files?.[0];
    if (file) validateAndEmit(file);
    fileInput.value = '';
  }

  zone.addEventListener('dragover', handleDragOver);
  zone.addEventListener('dragleave', handleDragLeave);
  zone.addEventListener('drop', handleDrop);
  zone.addEventListener('click', handleClick);
  fileInput.addEventListener('change', handleFileChange);

  container.appendChild(zone);

  return {
    destroy() {
      zone.removeEventListener('dragover', handleDragOver);
      zone.removeEventListener('dragleave', handleDragLeave);
      zone.removeEventListener('drop', handleDrop);
      zone.removeEventListener('click', handleClick);
      fileInput.removeEventListener('change', handleFileChange);
      zone.remove();
    },
  };
}
