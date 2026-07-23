import type { HotlinkResult, CompressResult } from '../types/index.js';

export function createResultPanel(container: HTMLElement): {
  show: (hotlink: HotlinkResult, compression: CompressResult) => void;
  hide: () => void;
  destroy: () => void;
} {
  const panel = document.createElement('div');
  panel.id = 'result-panel';
  panel.className = 'result-panel';
  panel.hidden = true;

  container.appendChild(panel);

  return {
    show(hotlink: HotlinkResult, compression: CompressResult) {
      const ratio = ((1 - compression.compressedSize / compression.originalSize) * 100).toFixed(0);
      const compressedKB = (compression.compressedSize / 1024).toFixed(1);
      const originalKB = (compression.originalSize / 1024).toFixed(1);

      panel.innerHTML = `
        <div class="result-card">
          <div class="result-thumbnail">
            <img src="${hotlink.directDriveUrl}" alt="Uploaded image" loading="lazy" />
          </div>
          <div class="result-details">
            <h3 class="result-title">Image uploaded successfully!</h3>
            <div class="result-stats">
              <span class="stat">${originalKB}KB → ${compressedKB}KB (${ratio}% smaller)</span>
              <span class="stat">${compression.width} × ${compression.height}px</span>
            </div>
            <div class="result-url-group">
              <label class="result-url-label">Hotlink URL</label>
              <div class="result-url-row">
                <input type="text" class="result-url-input" id="hotlink-input" value="${hotlink.hotlinkUrl}" readonly />
                <button class="btn btn-copy" id="copy-btn" title="Copy to clipboard">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="result-actions">
              <a href="${hotlink.hotlinkUrl}" target="_blank" class="btn btn-secondary" id="open-hotlink-btn">Open hotlink</a>
              <a href="https://drive.google.com/file/d/${hotlink.fileId}/view" target="_blank" class="btn btn-secondary" id="open-drive-btn">View in Drive</a>
              <button class="btn btn-primary" id="upload-another-btn">Upload another</button>
            </div>
          </div>
        </div>
      `;

      const copyBtn = panel.querySelector('#copy-btn')!;
      const hotlinkInput = panel.querySelector('#hotlink-input') as HTMLInputElement;

      copyBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(hotlinkInput.value);
        copyBtn.classList.add('btn-copy--copied');
        setTimeout(() => copyBtn.classList.remove('btn-copy--copied'), 2000);
      });

      const uploadAnotherBtn = panel.querySelector('#upload-another-btn')!;
      uploadAnotherBtn.addEventListener('click', () => {
        panel.hidden = true;
        // Dispatch custom event so main.ts can reset UI
        window.dispatchEvent(new CustomEvent('airimg:reset'));
      });

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
