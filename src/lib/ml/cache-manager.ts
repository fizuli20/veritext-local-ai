export interface CacheInspectionResult {
  hasTransformersCache: boolean;
  hasWebLlmCache: boolean;
  cacheKeys: string[];
  estimatedTotalMB: number;
}

/**
 * Checks whether browser has cached weights for Transformers.js or WebLLM.
 */
export async function inspectBrowserModelCache(): Promise<CacheInspectionResult> {
  let hasTransformersCache = false;
  let hasWebLlmCache = false;
  const cacheKeys: string[] = [];
  let estimatedTotalMB = 0;

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      for (const k of keys) {
        cacheKeys.push(k);
        if (k.includes('transformers') || k.includes('onnx') || k.includes('huggingface')) {
          hasTransformersCache = true;
        }
        if (k.includes('webllm') || k.includes('mlc')) {
          hasWebLlmCache = true;
        }
      }
    } catch {
      // Caches API may be restricted in private browsing
    }
  }

  // Check IndexedDB for WebLLM model weights
  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    try {
      if (indexedDB.databases) {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name && (db.name.includes('webllm') || db.name.includes('mlc'))) {
            hasWebLlmCache = true;
            cacheKeys.push(`idb:${db.name}`);
          }
        }
      }
    } catch {
      // IndexedDB enumeration optional
    }
  }

  if (typeof navigator !== 'undefined' && 'storage' in navigator && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      estimatedTotalMB = estimate.usage ? Math.round(estimate.usage / (1024 * 1024)) : 0;
    } catch {
      estimatedTotalMB = 0;
    }
  }

  return {
    hasTransformersCache,
    hasWebLlmCache,
    cacheKeys,
    estimatedTotalMB,
  };
}

/**
 * Clears all cached weights from Cache Storage and WebLLM IndexedDB.
 */
export async function clearBrowserModelCache(): Promise<{ success: boolean; clearedKeys: string[] }> {
  const clearedKeys: string[] = [];

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      for (const k of keys) {
        if (
          k.includes('transformers') ||
          k.includes('onnx') ||
          k.includes('huggingface') ||
          k.includes('webllm') ||
          k.includes('mlc')
        ) {
          await window.caches.delete(k);
          clearedKeys.push(k);
        }
      }
    } catch {
      // Ignore cache deletion errors
    }
  }

  // Delete IndexedDB databases created by WebLLM
  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    try {
      if (indexedDB.databases) {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name && (db.name.includes('webllm') || db.name.includes('mlc'))) {
            indexedDB.deleteDatabase(db.name);
            clearedKeys.push(`idb:${db.name}`);
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return {
    success: true,
    clearedKeys,
  };
}
