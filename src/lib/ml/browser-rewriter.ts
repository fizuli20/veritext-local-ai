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
  const { CreateWebWorkerMLCEngine, prebuiltAppConfig } = await import(
    "@mlc-ai/web-llm"
  );
  const record = resolveWritingModel(prebuiltAppConfig.model_list, tier);
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
    timeout = setTimeout(() => {
      worker.terminate();
      reject(
        new Error(
          "Model download timed out after 5 minutes. Check your connection and retry.",
        ),
      );
    }, 300000);
  });
  try {
    const loading = CreateWebWorkerMLCEngine(
      worker,
      record.model_id,
      { initProgressCallback: (report) => onProgress(report.text) },
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
