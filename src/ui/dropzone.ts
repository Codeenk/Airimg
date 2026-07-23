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
      <h3 class="dropzone-heading">Drop image here</h3>
      <p class="dropzone-subheading">or <span class="dropzone-browse">browse files</span> from your computer</p>
      <p class="dropzone-specs font-mono">PNG, JPEG, WebP, GIF, BMP, TIFF &middot; Max 25MB</p>
    </div>
    <input type="file" id="file-input" accept="${ACCEPTED_TYPES.join(',')}" hidden />
  `;

  const fileInput = zone.querySelector('#file-input') as HTMLInputElement;

  function validateAndEmit(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])) {
      onError({ code: 'BAD_FILE_TYPE', message: `Unsupported file type: ${file.type || 'unknown'}. Please upload an image.` });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      onError({ code: 'FILE_TOO_LARGE', message: `File is ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum allowed is 25MB.` });
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
