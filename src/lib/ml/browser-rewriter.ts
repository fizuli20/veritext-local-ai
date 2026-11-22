import type { WebWorkerMLCEngine } from "@mlc-ai/web-llm";
import { resolveWritingModel, type WritingModelTier } from "./writing-models";
export async function loadBrowserRewriter(
  onProgress: (text: string) => void,
  signal?: AbortSignal,
  tier: WritingModelTier = "balanced",
): Promise<{ engine: WebWorkerMLCEngine; worker: Worker; modelId: string }> {
  const gpu = (
    navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }
  ).gpu;
  if (!gpu || !(await gpu.requestAdapter()))
    throw new Error(
      "WebGPU is unavailable here. Connect LM Studio/Ollama, or use a browser with a working WebGPU adapter.",
    );
  if (signal?.aborted) throw new Error("Model loading stopped.");
  const { CreateWebWorkerMLCEngine, prebuiltAppConfig, hasModelInCache } =
    await import("@mlc-ai/web-llm");
  const record = resolveWritingModel(prebuiltAppConfig.model_list, tier);
  // Keep working caches on existing devices. Cold Llama downloads use
  // IndexedDB after these large shards repeatedly failed in Cache Storage.
  const useIndexedDB =
    tier === "quality" &&
    !(await hasModelInCache(record.model_id, prebuiltAppConfig).catch(
      () => false,
    ));
  if (signal?.aborted) throw new Error("Model loading stopped.");
  const worker = new Worker(
    new URL("../../workers/humanizer.worker.ts", import.meta.url),
    { type: "module" },
  );
  let timeout: ReturnType<typeof setTimeout>;
  let abortLoad: () => void;
  const cancelled = new Promise<never>((_, reject) => {
    abortLoad = () => {
      worker.terminate();
      reject(
        new Error(
          "Model loading stopped. You can retry; completed model files may be cached.",
        ),
      );
    };
    signal?.addEventListener("abort", abortLoad, { once: true });
    if (signal?.aborted) abortLoad();
    timeout = setTimeout(
      () => {
        worker.terminate();
        reject(
          new Error(
            "Model setup timed out. Check your connection and retry. Completed model files may be cached.",
          ),
        );
      },
      useIndexedDB ? 360000 : 300000,
    );
  });
  try {
    const loading = CreateWebWorkerMLCEngine(
      worker,
      record.model_id,
      {
        initProgressCallback: (report) => onProgress(report.text),
        ...(useIndexedDB
          ? { appConfig: { ...prebuiltAppConfig, cacheBackend: "indexeddb" } }
          : {}),
      },
      { context_window_size: 4096 },
    );
    const engine = await Promise.race([loading, cancelled]);
    return { engine, worker, modelId: record.model_id };
  } catch (error) {
    worker.terminate();
    throw error;
  } finally {
    clearTimeout(timeout!);
    signal?.removeEventListener("abort", abortLoad!);
  }
}
