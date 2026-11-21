export interface HardwareCapabilities {
  hasWebGPU: boolean;
  adapterInfo: {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  } | null;
  hasWasm: boolean;
  estimatedStorage: {
    quotaMB: number;
    usageMB: number;
    availableMB: number;
  } | null;
  recommendedDetectorMode: 'webgpu' | 'wasm';
  recommendedHumanizerTier: 'lite' | 'balanced' | 'quality' | 'deterministic-only';
}

/**
 * Probes browser hardware capabilities (WebGPU, WASM, Storage Quota).
 */
export async function probeHardwareCapabilities(): Promise<HardwareCapabilities> {
  let hasWebGPU = false;
  let adapterInfo: HardwareCapabilities['adapterInfo'] = null;

  if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
    try {
      const gpu = (navigator as any).gpu;
      const adapter = await gpu.requestAdapter();
      if (adapter) {
        hasWebGPU = true;
        if (adapter.requestAdapterInfo) {
          const info = await adapter.requestAdapterInfo();
          adapterInfo = {
            vendor: info.vendor || 'Unknown',
            architecture: info.architecture || 'Unknown',
            device: info.device || 'Unknown',
            description: info.description || 'WebGPU Hardware Adapter',
          };
        } else {
          adapterInfo = {
            description: 'WebGPU Compatible Accelerator',
          };
        }
      }
    } catch {
      hasWebGPU = false;
    }
  }

  // Check WASM support
  const hasWasm = typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';

  // Check Cache Storage Quota
  let estimatedStorage: HardwareCapabilities['estimatedStorage'] = null;
  if (typeof navigator !== 'undefined' && 'storage' in navigator && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const quotaMB = estimate.quota ? Math.round(estimate.quota / (1024 * 1024)) : 0;
      const usageMB = estimate.usage ? Math.round(estimate.usage / (1024 * 1024)) : 0;
      estimatedStorage = {
        quotaMB,
        usageMB,
        availableMB: Math.max(0, quotaMB - usageMB),
      };
    } catch {
      // Storage estimation optional
    }
  }

  const recommendedDetectorMode: 'webgpu' | 'wasm' = hasWebGPU ? 'webgpu' : 'wasm';

  let recommendedHumanizerTier: HardwareCapabilities['recommendedHumanizerTier'] = 'deterministic-only';
  if (hasWebGPU) {
    recommendedHumanizerTier = 'balanced';
  }

  return {
    hasWebGPU,
    adapterInfo,
    hasWasm,
    estimatedStorage,
    recommendedDetectorMode,
    recommendedHumanizerTier,
  };
}
