export interface HistoryItem {
  id: string;
  fileId: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  hotlinkUrl: string;
  fallbackUrl: string;
  timestamp: number;
}

const STORAGE_KEY = 'airimg_vault_v1';
const MAX_HISTORY_ITEMS = 50;

export function getHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryItem(item: Omit<HistoryItem, 'id' | 'timestamp'>): HistoryItem {
  const history = getHistory();
  const newItem: HistoryItem = {
    ...item,
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  // Prepend new item and enforce 50-item limit
  const updated = [newItem, ...history.filter(h => h.fileId !== item.fileId)].slice(0, MAX_HISTORY_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save to localStorage vault:', e);
  }
  return newItem;
}

export function deleteHistoryItem(id: string): HistoryItem[] {
  const history = getHistory();
  const updated = history.filter(item => item.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to update localStorage vault:', e);
  }
  return updated;
}

export function clearAllHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear localStorage vault:', e);
  }
}
