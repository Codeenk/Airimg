import type { UploadProgress, UploadStage } from '../types/index.js';

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: '',
  compressing: 'Compressing image to WebP format…',
  uploading: 'Uploading to your Google Drive…',
  'setting-permissions': 'Applying public permissions (role:reader)…',
  done: 'Upload complete! Generating hotlink…',
  error: 'Process interrupted',
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
    <div class="progress-header">
      <div class="progress-title-group">
        <div class="progress-spinner" id="progress-spinner"></div>
        <span class="progress-label" id="progress-label">Processing…</span>
      </div>
      <span class="progress-percent" id="progress-percent">0%</span>
    </div>

    <div class="progress-bar-track">
      <div class="progress-bar-fill" id="progress-fill"></div>
    </div>

    <div class="progress-sublabel" id="progress-sublabel">Preparing image…</div>

    <div class="progress-steps-row">
      <div class="step-badge" id="step-compress">1. Compress</div>
      <div class="step-badge" id="step-upload">2. Drive Upload</div>
      <div class="step-badge" id="step-permissions">3. Public Access</div>
    </div>
  `;

  const fill = panel.querySelector('#progress-fill') as HTMLElement;
  const label = panel.querySelector('#progress-label') as HTMLElement;
  const sublabel = panel.querySelector('#progress-sublabel') as HTMLElement;
  const percent = panel.querySelector('#progress-percent') as HTMLElement;
  const stepCompress = panel.querySelector('#step-compress') as HTMLElement;
  const stepUpload = panel.querySelector('#step-upload') as HTMLElement;
  const stepPermissions = panel.querySelector('#step-permissions') as HTMLElement;

  container.appendChild(panel);

  return {
    update(prog: UploadProgress) {
      const pct = Math.round(prog.percent);
      fill.style.width = `${pct}%`;
      percent.textContent = `${pct}%`;
      label.textContent = STAGE_LABELS[prog.stage] || 'Processing…';
      sublabel.textContent = prog.message || '';

      // Update step badges
      stepCompress.className = 'step-badge';
      stepUpload.className = 'step-badge';
      stepPermissions.className = 'step-badge';

      if (prog.stage === 'compressing') {
        stepCompress.classList.add('step-badge--active');
      } else if (prog.stage === 'uploading') {
        stepCompress.classList.add('step-badge--done');
        stepUpload.classList.add('step-badge--active');
      } else if (prog.stage === 'setting-permissions') {
        stepCompress.classList.add('step-badge--done');
        stepUpload.classList.add('step-badge--done');
        stepPermissions.classList.add('step-badge--active');
      } else if (prog.stage === 'done') {
        stepCompress.classList.add('step-badge--done');
        stepUpload.classList.add('step-badge--done');
        stepPermissions.classList.add('step-badge--done');
      }

      if (prog.stage === 'error') {
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
