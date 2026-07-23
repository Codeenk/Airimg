import { getHistory, deleteHistoryItem, clearAllHistory, type HistoryItem } from '../storage/history-store.js';

export function createHistoryPanel(container: HTMLElement): {
  render: () => void;
  destroy: () => void;
} {
  const panel = document.createElement('section');
  panel.id = 'history-vault';
  panel.className = 'history-vault landing-section';

  function renderContent() {
    const items = getHistory();

    if (items.length === 0) {
      panel.innerHTML = `
        <div class="section-header">
          <h3 class="section-title">Hotlink Vault</h3>
          <p class="section-subtitle">Your generated embeddable hotlinks persist here in your browser.</p>
        </div>
        <div class="vault-empty font-mono">
          <p>Vault is empty. Drag and drop images above to populate your hotlink library.</p>
        </div>
      `;
      return;
    }

    panel.innerHTML = `
      <div class="section-header vault-header">
        <div>
          <h3 class="section-title">Hotlink Vault</h3>
          <p class="section-subtitle">${items.length} saved hotlink${items.length === 1 ? '' : 's'} stored in local browser memory.</p>
        </div>
        <button id="clear-vault-btn" class="btn btn-ghost btn-sm font-mono">Clear All</button>
      </div>

      <div class="vault-grid">
        ${items.map(item => renderItemCard(item)).join('')}
      </div>
    `;

    // Attach event listeners for copy and delete buttons
    const clearBtn = panel.querySelector('#clear-vault-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear all saved hotlinks from your browser vault?')) {
          clearAllHistory();
          renderContent();
        }
      });
    }

    panel.querySelectorAll('.vault-card').forEach(card => {
      const id = card.getAttribute('data-id');
      if (!id) return;

      const item = items.find(i => i.id === id);
      if (!item) return;

      const copyUrlBtn = card.querySelector('.btn-copy-url');
      const copyHtmlBtn = card.querySelector('.btn-copy-html');
      const copyMdBtn = card.querySelector('.btn-copy-md');
      const deleteBtn = card.querySelector('.btn-delete-item');

      copyUrlBtn?.addEventListener('click', () => copyText(item.hotlinkUrl, copyUrlBtn as HTMLElement, 'URL Copied!'));
      copyHtmlBtn?.addEventListener('click', () => copyText(`<img src="${item.hotlinkUrl}" alt="${item.fileName}" />`, copyHtmlBtn as HTMLElement, 'HTML Copied!'));
      copyMdBtn?.addEventListener('click', () => copyText(`![${item.fileName}](${item.hotlinkUrl})`, copyMdBtn as HTMLElement, 'Markdown Copied!'));

      deleteBtn?.addEventListener('click', () => {
        deleteHistoryItem(item.id);
        renderContent();
      });
    });
  }

  function renderItemCard(item: HistoryItem): string {
    const ratio = ((1 - item.compressedSize / item.originalSize) * 100).toFixed(0);
    const dateStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="vault-card" data-id="${item.id}">
        <div class="vault-card-body">
          <div class="vault-card-header">
            <span class="vault-filename" title="${item.fileName}">${item.fileName}</span>
            <span class="vault-savings font-mono">${ratio}% smaller</span>
          </div>

          <div class="vault-url-box font-mono">
            <input type="text" readonly value="${item.hotlinkUrl}" class="vault-url-input" />
          </div>

          <div class="vault-card-meta font-mono">
            <span>${(item.originalSize / 1024).toFixed(0)}KB → ${(item.compressedSize / 1024).toFixed(0)}KB</span>
            <span>${dateStr}</span>
          </div>
        </div>

        <div class="vault-card-actions">
          <button class="btn btn-ghost btn-xs btn-copy-url">Copy Link</button>
          <button class="btn btn-ghost btn-xs btn-copy-html">Copy HTML</button>
          <button class="btn btn-ghost btn-xs btn-copy-md">Copy MD</button>
          <button class="btn btn-ghost btn-xs btn-delete-item text-rose" title="Delete">✕</button>
        </div>
      </div>
    `;
  }

  function copyText(text: string, button: HTMLElement, label: string) {
    const orig = button.textContent;
    navigator.clipboard.writeText(text).then(() => {
      button.textContent = label;
      button.classList.add('btn-copied');
      setTimeout(() => {
        button.textContent = orig;
        button.classList.remove('btn-copied');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  }

  container.appendChild(panel);
  renderContent();

  return {
    render: renderContent,
    destroy() {
      panel.remove();
    },
  };
}
