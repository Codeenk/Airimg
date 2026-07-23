import type { AppError } from '../types/index.js';
import { ACCEPTED_TYPES, MAX_FILE_SIZE } from '../types/index.js';

export function createDropzone(
  container: HTMLElement,
  onFiles: (files: File[]) => void,
  onError: (error: AppError) => void
): { destroy: () => void } {
  /* Outer shell — positions both the backlight and the clipped border wrapper */
  const shell = document.createElement('div');
  shell.className = 'dropzone-shell';

  /* LED backlight glow — sits OUTSIDE the clipped wrapper so it can bleed outward */
  const backlight = document.createElement('div');
  backlight.className = 'dropzone-led-backlight';
  shell.appendChild(backlight);

  /* RGB border wrapper — overflow:hidden clips the spinning conic gradient to a thin border */
  const wrapper = document.createElement('div');
  wrapper.className = 'dropzone-rgb-wrapper';
  shell.appendChild(wrapper);

  const zone = document.createElement('div');
  zone.id = 'dropzone';
  zone.className = 'dropzone';
  zone.innerHTML = `
    <div class="dropzone-content">
      <h3 class="dropzone-heading">Drop image(s) here</h3>
      <p class="dropzone-subheading">or <span class="dropzone-browse">browse files</span> from your computer</p>
      <p class="dropzone-specs font-mono">PNG, JPEG, WebP, GIF, BMP, TIFF &middot; Batch processing &middot; Max 25MB per file</p>
    </div>
    <input type="file" id="file-input" accept="${ACCEPTED_TYPES.join(',')}" multiple hidden />
  `;

  wrapper.appendChild(zone);

  const fileInput = zone.querySelector('#file-input') as HTMLInputElement;

  function validateAndEmit(files: File[]) {
    const validFiles: File[] = [];
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])) {
        onError({ code: 'BAD_FILE_TYPE', message: `Skipping unsupported file type: ${file.name} (${file.type || 'unknown'})` });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        onError({ code: 'FILE_TOO_LARGE', message: `Skipping ${file.name}: ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 25MB max.` });
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length > 0) {
      onFiles(validFiles);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.add('dropzone--active');
    shell.classList.add('shell--active');
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('dropzone--active');
    shell.classList.remove('shell--active');
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('dropzone--active');
    shell.classList.remove('shell--active');
    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      validateAndEmit(Array.from(droppedFiles));
    }
  }

  function handleClick() {
    fileInput.click();
  }

  function handleFileChange() {
    const selectedFiles = fileInput.files;
    if (selectedFiles && selectedFiles.length > 0) {
      validateAndEmit(Array.from(selectedFiles));
    }
    fileInput.value = '';
  }

  zone.addEventListener('dragover', handleDragOver);
  zone.addEventListener('dragleave', handleDragLeave);
  zone.addEventListener('drop', handleDrop);
  zone.addEventListener('click', handleClick);
  fileInput.addEventListener('change', handleFileChange);

  container.appendChild(shell);

  return {
    destroy() {
      zone.removeEventListener('dragover', handleDragOver);
      zone.removeEventListener('dragleave', handleDragLeave);
      zone.removeEventListener('drop', handleDrop);
      zone.removeEventListener('click', handleClick);
      fileInput.removeEventListener('change', handleFileChange);
      shell.remove();
    },
  };
}
