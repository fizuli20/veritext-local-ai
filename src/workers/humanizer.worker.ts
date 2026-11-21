/// <reference lib="webworker" />

import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

// Hook up WebWorkerMLCEngineHandler to worker postMessage/onmessage
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  if (msg.data && msg.data.type === 'PING') {
    self.postMessage({
      type: 'PONG',
      worker: 'humanizer',
      ready: true,
      loadedModelId: null,
      backend: 'webllm',
      webgpuAvailable: typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as any).gpu,
      timestamp: Date.now(),
    });
    return;
  }
  handler.onmessage(msg);
};
