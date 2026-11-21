/**
 * Veritext Local AI - Worker Resource & VRAM Scheduler
 * Probes hardware memory limits and enforces a strict Active Memory Budget
 * across low-end laptops, mobile devices, and high-end workstations.
 */

export interface SystemHardwareProfile {
  hasWebGPU: boolean;
  adapterName: string;
  deviceMemoryGB: number; // navigator.deviceMemory
  isLowMemoryDevice: boolean; // < 8GB RAM
  storageQuotaMB: number;
  storageUsageMB: number;
  recommendedHumanizerPreset: 'lite' | 'balanced' | 'quality';
  concurrencyAllowed: boolean;
}

export interface ModelResourceItem {
  id: string;
  name: string;
  engine: 'roberta' | 'perplexity' | 'embedding' | 'wasm-t5' | 'webllm';
  ramEstimateMB: number;
  vramEstimateMB: number;
  isLoaded: boolean;
}

export const KNOWN_MODEL_FOOTPRINTS: Record<string, { ramMB: number; vramMB: number }> = {
  'onnx-community/chatgpt-detector-roberta-ONNX': { ramMB: 124, vramMB: 250 },
  'onnx-community/gpt2-ONNX': { ramMB: 130, vramMB: 300 },
  'Xenova/all-MiniLM-L6-v2': { ramMB: 23, vramMB: 60 },
  'Xenova/flan-t5-small': { ramMB: 110, vramMB: 0 }, // WASM CPU only
  'Llama-3.2-1B-Instruct-q4f16_1-MLC': { ramMB: 880, vramMB: 1100 },
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC': { ramMB: 1350, vramMB: 1800 },
  'Phi-3.5-mini-instruct-q4f16_1-MLC': { ramMB: 2200, vramMB: 3200 },
};

let cachedProfile: SystemHardwareProfile | null = null;

/**
 * Probes system hardware capabilities, GPU limits, and available memory.
 */
export async function probeSystemHardware(): Promise<SystemHardwareProfile> {
  if (cachedProfile) return cachedProfile;

  if (typeof window === 'undefined') {
    return {
      hasWebGPU: false,
      adapterName: 'Server / Node Environment',
      deviceMemoryGB: 8,
      isLowMemoryDevice: false,
      storageQuotaMB: 0,
      storageUsageMB: 0,
      recommendedHumanizerPreset: 'lite',
      concurrencyAllowed: true,
    };
  }

  // 1. Device Memory Probe
  const deviceMemory = (navigator as any).deviceMemory || 8;
  const isLowMemory = deviceMemory < 8;

  // 2. Storage Quota Probe
  let storageQuotaMB = 0;
  let storageUsageMB = 0;
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      storageQuotaMB = Math.round((estimate.quota ?? 0) / (1024 * 1024));
      storageUsageMB = Math.round((estimate.usage ?? 0) / (1024 * 1024));
    } catch {
      // Storage estimation fallback
    }
  }

  // 3. WebGPU Probe
  let hasWebGPU = false;
  let adapterName = 'WASM / CPU Only';
  if ((navigator as any).gpu) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        hasWebGPU = true;
        const info = (adapter as any).info;
        adapterName = info?.description || info?.device || 'Hardware Accelerated WebGPU';
      }
    } catch {
      hasWebGPU = false;
    }
  }

  // Recommendation logic
  let recommendedPreset: 'lite' | 'balanced' | 'quality' = 'lite';
  if (hasWebGPU) {
    if (deviceMemory >= 16) {
      recommendedPreset = 'balanced';
    } else {
      recommendedPreset = 'lite';
    }
  }

  cachedProfile = {
    hasWebGPU,
    adapterName,
    deviceMemoryGB: deviceMemory,
    isLowMemoryDevice: isLowMemory,
    storageQuotaMB,
    storageUsageMB,
    recommendedHumanizerPreset: recommendedPreset,
    concurrencyAllowed: !isLowMemory && hasWebGPU,
  };

  return cachedProfile;
}

/**
 * Global registry of active workers for memory tracking and panic unloading.
 */
class MemoryScheduler {
  private activeWorkers = new Map<string, Worker>();
  private loadedModelIds = new Set<string>();

  registerWorker(name: string, worker: Worker, modelId?: string): void {
    this.activeWorkers.set(name, worker);
    if (modelId) this.loadedModelIds.add(modelId);
  }

  unregisterWorker(name: string, modelId?: string): void {
    const worker = this.activeWorkers.get(name);
    if (worker) {
      worker.terminate();
      this.activeWorkers.delete(name);
    }
    if (modelId) this.loadedModelIds.delete(modelId);
  }

  getLoadedFootprint(): { totalRamMB: number; totalVramMB: number; items: ModelResourceItem[] } {
    let totalRam = 0;
    let totalVram = 0;
    const items: ModelResourceItem[] = [];

    for (const id of this.loadedModelIds) {
      const footprint = KNOWN_MODEL_FOOTPRINTS[id] ?? { ramMB: 50, vramMB: 50 };
      totalRam += footprint.ramMB;
      totalVram += footprint.vramMB;

      items.push({
        id,
        name: id.split('/').pop() ?? id,
        engine: id.includes('roberta')
          ? 'roberta'
          : id.includes('gpt2')
            ? 'perplexity'
            : id.includes('MiniLM')
              ? 'embedding'
              : id.includes('t5')
                ? 'wasm-t5'
                : 'webllm',
        ramEstimateMB: footprint.ramMB,
        vramEstimateMB: footprint.vramMB,
        isLoaded: true,
      });
    }

    return { totalRamMB: totalRam, totalVramMB: totalVram, items };
  }

  /**
   * Emergency Panic Button: Terminates all active worker threads and releases VRAM/RAM.
   */
  unloadAllModels(): { unloadedCount: number } {
    let count = 0;
    for (const [name, worker] of this.activeWorkers.entries()) {
      try {
        worker.postMessage({ type: 'UNLOAD' });
        worker.terminate();
        count++;
      } catch (e) {
        console.warn(`Failed to terminate worker ${name}:`, e);
      }
    }
    this.activeWorkers.clear();
    this.loadedModelIds.clear();
    return { unloadedCount: count };
  }
}

export const memoryScheduler = new MemoryScheduler();
