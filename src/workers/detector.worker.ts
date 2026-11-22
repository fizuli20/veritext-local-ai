/// <reference lib="webworker" />
import {
  pipeline,
  AutoTokenizer,
  AutoModelForSequenceClassification,
  env,
} from "@huggingface/transformers";
import {
  DETECTOR_PROFILES,
  type DetectorTier,
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
let activeTier: DetectorTier = "light";
const scoreCache = new Map<string, number>();
let initialization: Promise<void> | null = null;

function createThrottledProgress(postFn: (msg: any) => void, throttleMs = 150) {
  let lastTime = 0;
  let trailingTimer: any = null;
  let lastProgress: any = null;

  return (progress: any) => {
    lastProgress = progress;
    const now = performance.now();
    if (progress.status === "done" || progress.status === "initiate") {
      if (trailingTimer) clearTimeout(trailingTimer);
      trailingTimer = null;
      lastTime = now;
      postFn({ type: "progress", progress });
      return;
    }
    if (now - lastTime >= throttleMs) {
      if (trailingTimer) clearTimeout(trailingTimer);
      trailingTimer = null;
      lastTime = now;
      postFn({ type: "progress", progress });
    } else if (!trailingTimer) {
      trailingTimer = setTimeout(() => {
        trailingTimer = null;
        lastTime = performance.now();
        if (lastProgress) {
          postFn({ type: "progress", progress: lastProgress });
        }
      }, throttleMs);
    }
  };
}

async function initialize(tier: DetectorTier) {
  if (classifier && activeTier === tier) return;
  if (classifier) {
    await classifier.dispose();
    classifier = null;
    initialization = null;
    scoreCache.clear();
  }
  if (!initialization)
    initialization = (async () => {
      const throttledProgress = createThrottledProgress(
        (msg) => self.postMessage(msg),
        150,
      );
      const profile = DETECTOR_PROFILES[tier];
      const options = {
        revision: profile.revision,
        device: "wasm" as const,
        progress_callback: throttledProgress,
      };
      if (tier === "detailed") {
        const tokenizer = await AutoTokenizer.from_pretrained(
          profile.model,
          options,
        );
        const model = await AutoModelForSequenceClassification.from_pretrained(
          profile.model,
          { ...options, dtype: "fp32" },
        );
        classifier = {
          tokenizer,
          // This model exports ONE logit. Softmax would incorrectly return 1
          // for every input; its documented AI polarity requires a sigmoid.
          run: async (piece: string) => {
            const { logits } = await model(
              tokenizer(piece, { truncation: true, max_length: 512 }),
            );
            const logit = Number(logits.data[0]);
            if (!Number.isFinite(logit))
              throw new Error("Invalid detector logit.");
            return 1 / (1 + Math.exp(-logit));
          },
          dispose: () => model.dispose(),
        };
      } else {
        const pipe = await pipeline("text-classification", profile.model, {
          ...options,
          dtype: "q8",
        });
        classifier = {
          tokenizer: pipe.tokenizer,
          run: async (piece: string) =>
            parseAiScore(
              await pipe(piece, {
                top_k: null,
                truncation: true,
                max_length: 512,
              }),
            ),
          dispose: () => pipe.dispose(),
        };
      }
      activeTier = tier;
    })().catch((err) => {
      initialization = null;
      throw err;
    });
  await initialization;
}
async function scoreText(text: string) {
  const cached = scoreCache.get(text);
  if (cached !== undefined) return cached;
  const ids = classifier.tokenizer.encode(text, { add_special_tokens: false });
  const windows = tokenWindows(ids);
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < windows.length; i++) {
    const window = windows[i]!;
    const piece = classifier.tokenizer.decode(window, {
      skip_special_tokens: true,
    });
    const score = await classifier.run(piece);
    const weight = window.length - (i ? 64 : 0);
    weighted += score * weight;
    total += weight;
  }
  const result = total ? weighted / total : 0.5;
  if (scoreCache.size >= 120)
    scoreCache.delete(scoreCache.keys().next().value!);
  scoreCache.set(text, result);
  return result;
}
self.onmessage = async ({ data }: MessageEvent) => {
  if (data.type === "PING") {
    self.postMessage({
      type: "PONG",
      ready: !!classifier,
      loadedModelId: classifier ? DETECTOR_PROFILES[activeTier].model : null,
      backend: "wasm",
    });
    return;
  }
  try {
    const tier: DetectorTier = data.tier === "detailed" ? "detailed" : "light";
    const profile = DETECTOR_PROFILES[tier];
    if (data.type === "init") {
      await initialize(tier);
      self.postMessage({
        type: "ready",
        model: profile.model,
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
      await initialize(tier);
      const loadedAt = performance.now();
      self.postMessage({
        type: "phase",
        id: data.id,
        message: "Model ready. Scoring the document…",
      });
      const docScore = await scoreText(text);
      const evidence = describeEvidence(text, docScore, tier);

      const sentences = data.includeContexts ? tokenizeSentences(text) : [];
      const results = [];
      // Context windows are clearly labelled, never represented as isolated sentence probabilities.
      for (let i = 0; i < sentences.length; i++) {
        const current = sentences[i]!;
        const context = text.slice(
          sentences[Math.max(0, i - 1)]!.start,
          sentences[Math.min(sentences.length - 1, i + 1)]!.end,
        );
        if (i < 60) {
          results.push({ ...current, score: await scoreText(context) });
        } else {
          results.push({ ...current, score: null });
        }
        if (i < 60)
          self.postMessage({
            type: "analysis-progress",
            id: data.id,
            completed: i + 1,
            total: Math.min(60, sentences.length),
          });
      }
      self.postMessage({
        type: "result",
        id: data.id,
        text,
        evidence,
        sentences: results,
        engine: `${profile.engine} · ${tier === "light" ? "WASM Q8" : "WASM · INT8 weights / FP32 math"}`,
        tier,
        contextLimit: data.includeContexts && sentences.length > 60 ? 60 : null,
        model: profile.model,
        revision: profile.revision,
        latencyMs: Math.round(performance.now() - started),
        loadingMs: Math.round(loadedAt - started),
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
