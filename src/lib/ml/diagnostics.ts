/**
 * Real In-Browser Worker Truth Audit & System Diagnostics
 * Probes all 5 Web Workers with PING/PONG handshakes, measures latency,
 * and extracts WebGPU and OPFS storage metrics.
 */

export interface WorkerHealthReport {
  worker: 'detector' | 'perplexity' | 'embedding' | 'wasm-paraphraser' | 'humanizer';
  label: string;
  ready: boolean;
  handshakeMs: number;
  loadedModelId: string | null;
  backend: string;
  webgpuAvailable: boolean;
  error?: string;
}

export interface SystemDiagnosticsReport {
  timestamp: number;
  workers: WorkerHealthReport[];
  webgpu: {
    supported: boolean;
    adapterName?: string;
    maxBufferSize?: number;
    maxStorageBufferBindingSize?: number;
  };
  storage: {
    quotaBytes?: number;
    usageBytes?: number;
    usagePct?: number;
  };
  allHealthy: boolean;
}

const WORKER_DEFS: {
  key: WorkerHealthReport['worker'];
  label: string;
  path: string;
}[] = [
  { key: 'detector', label: 'RoBERTa Detector Worker', path: '../../workers/detector.worker.ts' },
  { key: 'perplexity', label: 'GPT-2 Curvature & PPL Worker', path: '../../workers/perplexity.worker.ts' },
  { key: 'embedding', label: 'MiniLM-L6 Embedding Worker', path: '../../workers/embedding.worker.ts' },
  { key: 'wasm-paraphraser', label: 'Flan-T5 Paraphraser Worker', path: '../../workers/wasm-paraphraser.worker.ts' },
  { key: 'humanizer', label: 'WebLLM Local LLM Worker', path: '../../workers/humanizer.worker.ts' },
];

function pingWorker(
  workerKey: WorkerHealthReport['worker'],
  label: string,
  createWorkerFn: () => Worker
): Promise<WorkerHealthReport> {
  return new Promise((resolve) => {
    let worker: Worker | null = null;
    const start = performance.now();
    let hasResolved = false;

    const timeoutId = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        if (worker) worker.terminate();
        resolve({
          worker: workerKey,
          label,
          ready: false,
          handshakeMs: Math.round(performance.now() - start),
          loadedModelId: null,
          backend: 'unknown',
          webgpuAvailable: false,
          error: 'Handshake timeout (3000ms)',
        });
      }
    }, 3000);

    try {
      worker = createWorkerFn();

      worker.onmessage = (e: MessageEvent) => {
        if (e.data && e.data.type === 'PONG') {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeoutId);
            const handshakeMs = Math.max(1, Math.round(performance.now() - start));
            const report: WorkerHealthReport = {
              worker: workerKey,
              label,
              ready: true,
              handshakeMs,
              loadedModelId: e.data.loadedModelId ?? null,
              backend: e.data.backend || 'wasm',
              webgpuAvailable: !!e.data.webgpuAvailable,
            };
            worker?.terminate();
            resolve(report);
          }
        }
      };

      worker.onerror = (err) => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeoutId);
          worker?.terminate();
          resolve({
            worker: workerKey,
            label,
            ready: false,
            handshakeMs: Math.round(performance.now() - start),
            loadedModelId: null,
            backend: 'error',
            webgpuAvailable: false,
            error: err.message || 'Worker script load failed',
          });
        }
      };

      worker.postMessage({ type: 'PING' });
    } catch (err: any) {
      if (!hasResolved) {
        hasResolved = true;
        clearTimeout(timeoutId);
        resolve({
          worker: workerKey,
          label,
          ready: false,
          handshakeMs: Math.round(performance.now() - start),
          loadedModelId: null,
          backend: 'error',
          webgpuAvailable: false,
          error: err.message || 'Worker instantiation failed',
        });
      }
    }
  });
}

export async function runRealWorkerDiagnostics(): Promise<SystemDiagnosticsReport> {
  const workerInstantiators: Record<WorkerHealthReport['worker'], () => Worker> = {
    detector: () => new Worker(new URL('../../workers/detector.worker.ts', import.meta.url), { type: 'module' }),
    perplexity: () => new Worker(new URL('../../workers/perplexity.worker.ts', import.meta.url), { type: 'module' }),
    embedding: () => new Worker(new URL('../../workers/embedding.worker.ts', import.meta.url), { type: 'module' }),
    'wasm-paraphraser': () => new Worker(new URL('../../workers/wasm-paraphraser.worker.ts', import.meta.url), { type: 'module' }),
    humanizer: () => new Worker(new URL('../../workers/humanizer.worker.ts', import.meta.url), { type: 'module' }),
  };

  const workerPromises = WORKER_DEFS.map((def) =>
    pingWorker(def.key, def.label, workerInstantiators[def.key])
  );

  const workerReports = await Promise.all(workerPromises);

  // Probe WebGPU
  let webgpuSupported = false;
  let adapterName: string | undefined;
  let maxBufferSize: number | undefined;
  let maxStorageBufferBindingSize: number | undefined;

  if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
    webgpuSupported = true;
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        const info = (await adapter.requestAdapterInfo?.()) || {};
        adapterName = info.description || info.device || 'WebGPU Compatible Adapter';
        maxBufferSize = adapter.limits?.maxBufferSize;
        maxStorageBufferBindingSize = adapter.limits?.maxStorageBufferBindingSize;
      }
    } catch {
      // ignore
    }
  }

  // Probe Storage
  let quotaBytes: number | undefined;
  let usageBytes: number | undefined;
  let usagePct: number | undefined;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      quotaBytes = est.quota;
      usageBytes = est.usage;
      if (quotaBytes && usageBytes) {
        usagePct = Math.round((usageBytes / quotaBytes) * 1000) / 10;
      }
    } catch {
      // ignore
    }
  }

  const allHealthy = workerReports.every((r) => r.ready);

  return {
    timestamp: Date.now(),
    workers: workerReports,
    webgpu: {
      supported: webgpuSupported,
      adapterName,
      maxBufferSize,
      maxStorageBufferBindingSize,
    },
    storage: {
      quotaBytes,
      usageBytes,
      usagePct,
    },
    allHealthy,
  };
}
