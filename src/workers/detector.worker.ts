/// <reference lib="webworker" />
import { pipeline, env } from "@huggingface/transformers";
import {
  DETECTOR_MODEL,
  DETECTOR_REVISION,
  parseAiScore,
  tokenWindows,
  describeEvidence,
} from "../lib/detector/evidence";
import { tokenizeSentences } from "../lib/nlp/tokenizer";

env.allowLocalModels = false;
env.useBrowserCache = true;
// A single WASM thread also works without cross-origin isolation.
env.backends.onnx.wasm!.numThreads = 1;
let classifier: any = null;
let initialization: Promise<void> | null = null;

async function initialize() {
  if (classifier) return;
  if (!initialization)
    initialization = (async () => {
      classifier = await pipeline("text-classification", DETECTOR_MODEL, {
        revision: DETECTOR_REVISION,
        device: "wasm",
        dtype: "q8",
        progress_callback: (progress: any) =>
          self.postMessage({ type: "progress", progress }),
      });
    })().catch((err) => {
      initialization = null;
      throw err;
    });
  await initialization;
}
async function scoreText(text: string) {
  const ids = classifier.tokenizer.encode(text, { add_special_tokens: false });
  const windows = tokenWindows(ids);
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < windows.length; i++) {
    const window = windows[i]!;
    const piece = classifier.tokenizer.decode(window, {
      skip_special_tokens: true,
    });
    const score = parseAiScore(
      await classifier(piece, {
        top_k: null,
        truncation: true,
        max_length: 512,
      }),
    );
    const weight = window.length - (i ? 64 : 0);
    weighted += score * weight;
    total += weight;
  }
  return total ? weighted / total : 0.5;
}
self.onmessage = async ({ data }: MessageEvent) => {
  if (data.type === "PING") {
    self.postMessage({
      type: "PONG",
      ready: !!classifier,
      loadedModelId: classifier ? DETECTOR_MODEL : null,
      backend: "wasm",
    });
    return;
  }
  try {
    if (data.type === "init") {
      await initialize();
      self.postMessage({
        type: "ready",
        model: DETECTOR_MODEL,
        device: "wasm",
      });
    }
    if (data.type === "detect") {
      const started = performance.now();
      const text = String(data.text ?? "");
      if (text.length > 20000)
        throw new Error("Maximum detector input is 20,000 characters.");
      const eligibility = describeEvidence(text, null);
      if (
        eligibility.status === "unsupported-language" ||
        eligibility.status === "insufficient-text"
      ) {
        self.postMessage({
          type: "result",
          id: data.id,
          text,
          evidence: eligibility,
          sentences: [],
          latencyMs: 0,
          engine: "input-check",
        });
        return;
      }
      await initialize();
      self.postMessage({
        type: "phase",
        id: data.id,
        message: "Model ready. Scoring the document…",
      });
      const score = await scoreText(text);
      const sentences = tokenizeSentences(text);
      const results = [];
      // Context windows are clearly labelled, never represented as isolated sentence probabilities.
      for (let i = 0; i < sentences.length; i++) {
        const current = sentences[i]!;
        const context = text.slice(
          sentences[Math.max(0, i - 1)]!.start,
          sentences[Math.min(sentences.length - 1, i + 1)]!.end,
        );
        results.push({ ...current, score: await scoreText(context) });
        self.postMessage({
          type: "analysis-progress",
          id: data.id,
          completed: i + 1,
          total: sentences.length,
        });
      }
      self.postMessage({
        type: "result",
        id: data.id,
        text,
        evidence: describeEvidence(text, score),
        sentences: results,
        engine: "TMR RoBERTa · WASM Q8",
        model: DETECTOR_MODEL,
        revision: DETECTOR_REVISION,
        latencyMs: Math.round(performance.now() - started),
      });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
