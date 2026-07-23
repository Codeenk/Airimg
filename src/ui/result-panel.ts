import type { HotlinkResult, CompressResult } from '../types/index.js';

export interface ResultItem {
  hotlink: HotlinkResult;
  compression: CompressResult;
  previewUrl?: string;
  fileName?: string;
}

export function createResultPanel(container: HTMLElement): {
  show: (hotlink: HotlinkResult, compression: CompressResult, previewUrl?: string) => void;
  showAll: (items: ResultItem[]) => void;
  hide: () => void;
  destroy: () => void;
} {
  const panel = document.createElement('div');
  panel.id = 'result-panel';
  panel.className = 'result-panel';
  panel.hidden = true;

  container.appendChild(panel);

  function renderSingleCard(item: ResultItem, index: number): string {
    const { hotlink, compression, previewUrl, fileName } = item;
    const ratioVal = ((1 - compression.compressedSize / compression.originalSize) * 100);
    const ratio = ratioVal > 0 ? ratioVal.toFixed(0) : '0';
    const compressedKB = (compression.compressedSize / 1024).toFixed(1);
    const originalKB = (compression.originalSize / 1024).toFixed(1);

    const displaySrc = previewUrl || hotlink.fallbackWorkerUrl;
    const primaryId = `hotlink-primary-${index}`;
    const workerId = `hotlink-worker-${index}`;

    return `
      <div class="result-card">
        <div class="result-card-header">
          <div class="result-badge-success">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>${fileName ? fileName : 'Uploaded & Linked'}</span>
          </div>
          <span class="exif-stripped-tag">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            EXIF & GPS Stripped
          </span>
        </div>

        <div class="result-card-body">
          <div class="result-thumbnail-wrapper">
            <img src="${displaySrc}" alt="Uploaded preview" class="result-thumbnail-img result-img-element" />
            <div class="thumbnail-overlay">
              <a href="${hotlink.fallbackWorkerUrl}" target="_blank" class="btn-icon-overlay" title="View Full Image">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </a>
            </div>
          </div>

          <div class="result-content-wrapper">
            <div class="result-stats-grid">
              <div class="stat-card">
                <span class="stat-label">Original</span>
                <span class="stat-value">${originalKB} <small>KB</small></span>
              </div>
              <div class="stat-card stat-card--accent">
                <span class="stat-label">WebP Size</span>
                <span class="stat-value">${compressedKB} <small>KB</small></span>
              </div>
              <div class="stat-card stat-card--success">
                <span class="stat-label">Saved</span>
                <span class="stat-value">-${ratio}%</span>
              </div>
              <div class="stat-card">
                <span class="stat-label">Dimensions</span>
                <span class="stat-value">${compression.width}×${compression.height}</span>
              </div>
            </div>

            <!-- Hotlink URL 1: Primary Custom Domain -->
            <div class="result-url-field">
              <div class="url-field-header">
                <label class="url-field-label">Primary Hotlink URL</label>
                <span class="url-field-tag">img.airimg.airlabs.eu.cc</span>
              </div>
              <div class="url-input-group">
                <input type="text" class="url-input" id="${primaryId}" value="${hotlink.hotlinkUrl}" readonly />
                <button class="btn btn-copy" data-copy-target="${primaryId}">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <!-- Hotlink URL 2: Instant Worker Fallback -->
            <div class="result-url-field">
              <div class="url-field-header">
                <label class="url-field-label">Instant Cloudflare Worker URL</label>
                <span class="url-field-tag url-field-tag--live">Direct Worker</span>
              </div>
              <div class="url-input-group">
                <input type="text" class="url-input" id="${workerId}" value="${hotlink.fallbackWorkerUrl}" readonly />
                <button class="btn btn-copy" data-copy-target="${workerId}">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <div class="result-actions-row">
              <a href="https://drive.google.com/file/d/${hotlink.fileId}/view" target="_blank" class="btn btn-secondary">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                View in Google Drive
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    // Copy buttons handler
    panel.querySelectorAll('.btn-copy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetId = btn.getAttribute('data-copy-target')!;
        const inputEl = panel.querySelector(`#${targetId}`) as HTMLInputElement;
        if (inputEl) {
          await navigator.clipboard.writeText(inputEl.value);
          const spanEl = btn.querySelector('span');
          if (spanEl) {
            const orig = spanEl.textContent;
            spanEl.textContent = 'Copied!';
            btn.classList.add('btn-copy--copied');
            setTimeout(() => {
              spanEl.textContent = orig;
              btn.classList.remove('btn-copy--copied');
            }, 2000);
          }
        }
      });
    });

    // Upload another / Reset button handler
    const uploadAnotherBtn = panel.querySelector('#upload-another-btn');
    if (uploadAnotherBtn) {
      uploadAnotherBtn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('airimg:reset'));
      });
    }
  }

  function showItems(items: ResultItem[]) {
    if (items.length === 0) return;

    panel.innerHTML = `
      <div class="results-batch-container">
        ${items.length > 1 ? `
          <div class="results-batch-header">
            <h3 class="results-batch-title">Batch Upload Complete (${items.length} Images Linked)</h3>
          </div>
        ` : ''}
        <div class="results-stack">
          ${items.map((item, idx) => renderSingleCard(item, idx)).join('')}
        </div>
        <div class="results-footer-actions">
          <button class="btn btn-primary btn-lg" id="upload-another-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Upload More Images
          </button>
        </div>
      </div>
    `;

    bindEvents();
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  return {
    show(hotlink: HotlinkResult, compression: CompressResult, previewUrl?: string) {
      showItems([{ hotlink, compression, previewUrl }]);
    },
    showAll(items: ResultItem[]) {
      showItems(items);
    },
    hide() {
      panel.hidden = true;
      panel.innerHTML = '';
    },
    destroy() {
      panel.remove();
    },
  };
}
