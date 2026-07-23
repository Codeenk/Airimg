import { isSignedIn, initiateSignIn, signOut } from './auth/google-auth.js';
import { compressImage } from './compress/image-compressor.js';
import { uploadToDrive } from './upload/drive-upload.js';
import { setPublicPermission } from './upload/drive-permissions.js';
import { buildHotlink } from './url/hotlink-builder.js';
import { createDropzone } from './ui/dropzone.js';
import { createProgressPanel } from './ui/progress.js';
import { createResultPanel } from './ui/result-panel.js';
import { createHistoryPanel } from './ui/history-panel.js';
import { saveHistoryItem } from './storage/history-store.js';
import type { AppError, CompressResult } from './types/index.js';

// ---- DOM References ----
const authBtn = document.getElementById('auth-btn')!;
const workspace = document.getElementById('workspace')!;
const errorBanner = document.getElementById('error-banner')!;
const errorMessage = document.getElementById('error-message')!;
const errorDismiss = document.getElementById('error-dismiss')!;

// ---- UI Components ----
createDropzone(workspace, handleFiles, showError);
const progress = createProgressPanel(workspace);
const resultPanel = createResultPanel(workspace);
const historyPanel = createHistoryPanel(workspace);

// ---- State ----
let isProcessing = false;

// ---- Auth State ----
function updateAuthUI() {
  if (isSignedIn()) {
    authBtn.textContent = 'Sign out';
    authBtn.classList.add('btn-auth--signed-in');
  } else {
    authBtn.textContent = 'Sign in with Google';
    authBtn.classList.remove('btn-auth--signed-in');
  }
}

authBtn.addEventListener('click', async () => {
  if (isSignedIn()) {
    signOut();
    updateAuthUI();
  } else {
    try {
      await initiateSignIn();
      updateAuthUI();
    } catch (e) {
      showError(e as AppError);
    }
  }
});

errorDismiss.addEventListener('click', () => {
  errorBanner.hidden = true;
});

// ---- Reset handler ----
window.addEventListener('airimg:reset', () => {
  resultPanel.hide();
  progress.hide();
  isProcessing = false;
});

// ---- Error Display ----
function showError(error: AppError) {
  errorMessage.textContent = error.message;
  errorBanner.hidden = false;
  progress.update({ stage: 'error', percent: 100, message: error.message });
}

// ---- Main Multi-File Upload Pipeline ----
async function handleFiles(files: File[]) {
  if (isProcessing || files.length === 0) return;

  if (!isSignedIn()) {
    showError({ code: 'NOT_SIGNED_IN', message: 'Please click "Sign in with Google" at the top right to authenticate your Drive before uploading.' });
    return;
  }

  isProcessing = true;
  errorBanner.hidden = true;
  resultPanel.hide();
  progress.show();

  const total = files.length;
  let lastHotlink = null;
  let lastCompressResult: CompressResult | null = null;
  let lastPreviewUrl = '';

  for (let i = 0; i < total; i++) {
    const file = files[i];
    const itemPrefix = total > 1 ? `[${i + 1}/${total}] ` : '';

    try {
      // Stage 1: Compress
      progress.update({ stage: 'compressing', percent: (i / total) * 100 + 10 / total, message: `${itemPrefix}Compressing ${file.name}…` });
      let compressResult: CompressResult;
      try {
        compressResult = await compressImage(file);
        lastPreviewUrl = URL.createObjectURL(compressResult.blob);
      } catch (e) {
        throw { code: 'COMPRESS_FAILED', message: (e as AppError).message || `Compression failed for ${file.name}` } satisfies AppError;
      }
      const ratio = ((1 - compressResult.compressedSize / compressResult.originalSize) * 100).toFixed(0);
      progress.update({
        stage: 'compressing',
        percent: (i / total) * 100 + 30 / total,
        message: `${itemPrefix}Compressed ${file.name}: ${(compressResult.originalSize / 1024).toFixed(0)}KB → ${(compressResult.compressedSize / 1024).toFixed(0)}KB (${ratio}% smaller)`,
      });

      // Stage 2: Upload
      progress.update({ stage: 'uploading', percent: (i / total) * 100 + 40 / total, message: `${itemPrefix}Uploading ${file.name} to Google Drive…` });
      const uploadResult = await uploadToDrive(compressResult.blob, (pct) => {
        progress.update({ stage: 'uploading', percent: (i / total) * 100 + (40 + pct * 0.4) / total, message: `${itemPrefix}Uploading ${file.name}…` });
      });

      // Stage 3: Set permissions
      progress.update({ stage: 'setting-permissions', percent: (i / total) * 100 + 85 / total, message: `${itemPrefix}Setting public permissions…` });
      await setPublicPermission(uploadResult.fileId);

      // Stage 4: Build hotlink
      const hotlink = buildHotlink(uploadResult.fileId);

      // Save to LocalStorage Hotlink Vault
      saveHistoryItem({
        fileId: uploadResult.fileId,
        fileName: file.name,
        originalSize: compressResult.originalSize,
        compressedSize: compressResult.compressedSize,
        hotlinkUrl: hotlink.hotlinkUrl,
        fallbackUrl: hotlink.fallbackWorkerUrl,
      });

      // Update UI Vault Panel
      historyPanel.render();

      lastHotlink = hotlink;
      lastCompressResult = compressResult;

    } catch (e) {
      const appError = (e as AppError).code
        ? (e as AppError)
        : { code: 'UNKNOWN' as const, message: String(e) };
      showError(appError);
      if (total === 1) break;
    }
  }

  // Done!
  if (lastHotlink && lastCompressResult) {
    progress.update({ stage: 'done', percent: 100, message: total > 1 ? `Batch upload complete (${total} files)` : 'Image uploaded and linked!' });
    progress.hide();
    resultPanel.show(lastHotlink, lastCompressResult, lastPreviewUrl);
  }

  isProcessing = false;
}

// ---- Init ----
async function init() {
  updateAuthUI();
}

init();
