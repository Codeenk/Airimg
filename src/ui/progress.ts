import type { UploadProgress, UploadStage } from '../types/index.js';

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: '',
  compressing: 'Compressing image…',
  uploading: 'Uploading to Google Drive…',
  'setting-permissions': 'Setting public permissions…',
  done: 'Done!',
  error: 'Error',
};

export function createProgressPanel(container: HTMLElement): {
  update: (progress: UploadProgress) => void;
  show: () => void;
  hide: () => void;
  destroy: () => void;
} {
  const panel = document.createElement('div');
  panel.id = 'progress-panel';
  panel.className = 'progress-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="progress-bar-track">
      <div class="progress-bar-fill" id="progress-fill"></div>
    </div>
    <p class="progress-label" id="progress-label"></p>
    <p class="progress-sublabel" id="progress-sublabel"></p>
  `;

  const fill = panel.querySelector('#progress-fill') as HTMLElement;
  const label = panel.querySelector('#progress-label') as HTMLElement;
  const sublabel = panel.querySelector('#progress-sublabel') as HTMLElement;

  container.appendChild(panel);

  return {
    update(progress: UploadProgress) {
      fill.style.width = `${progress.percent}%`;
      label.textContent = STAGE_LABELS[progress.stage] || '';
      sublabel.textContent = progress.message || '';

      if (progress.stage === 'error') {
        panel.classList.add('progress-panel--error');
      } else {
        panel.classList.remove('progress-panel--error');
      }
    },
    show() {
      panel.hidden = false;
    },
    hide() {
      panel.hidden = true;
    },
    destroy() {
      panel.remove();
    },
  };
}
