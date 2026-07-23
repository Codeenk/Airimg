import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getHistory, saveHistoryItem, deleteHistoryItem, clearAllHistory } from '../../src/storage/history-store.js';

// In-memory localStorage mock for node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

describe('history-store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with an empty history list', () => {
    expect(getHistory()).toEqual([]);
  });

  it('saves a new history item and retrieves it', () => {
    const item = saveHistoryItem({
      fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8',
      fileName: 'hero.png',
      originalSize: 100000,
      compressedSize: 20000,
      hotlinkUrl: 'https://img.airimg.airlabs.eu.cc/i/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8',
      fallbackUrl: 'https://airimg-worker.malandkar-sarvesh1.workers.dev/i/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8',
    });

    const history = getHistory();
    expect(history.length).toBe(1);
    expect(history[0].fileName).toBe('hero.png');
    expect(history[0].fileId).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8');
  });

  it('deletes an item by ID', () => {
    const item = saveHistoryItem({
      fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8',
      fileName: 'hero.png',
      originalSize: 100000,
      compressedSize: 20000,
      hotlinkUrl: 'https://img.airimg.airlabs.eu.cc/i/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8',
      fallbackUrl: 'https://airimg-worker.malandkar-sarvesh1.workers.dev/i/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8',
    });

    deleteHistoryItem(item.id);
    expect(getHistory().length).toBe(0);
  });

  it('clears all history items', () => {
    saveHistoryItem({
      fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8',
      fileName: 'test1.png',
      originalSize: 50000,
      compressedSize: 10000,
      hotlinkUrl: 'https://img.airimg.airlabs.eu.cc/i/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8',
      fallbackUrl: 'https://airimg-worker.malandkar-sarvesh1.workers.dev/i/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgV8',
    });

    clearAllHistory();
    expect(getHistory().length).toBe(0);
  });
});
