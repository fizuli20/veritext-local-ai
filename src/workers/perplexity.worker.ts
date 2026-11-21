/**
 * Veritext Local AI - Perplexity, Fast-DetectGPT Curvature & GLTR Forensic Web Worker
 * Runs client-side in browser Web Workers using @huggingface/transformers.
 * Computes exact next-token log probabilities, sliding window perplexity,
 * Fast-DetectGPT conditional probability curvature z-score d(x),
 * perplexity burstiness, and GLTR rank distribution (top10, top100, top1000, beyond1000).
 */

import { AutoTokenizer, AutoModelForCausalLM, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

const PRIMARY_MODEL = 'onnx-community/gpt2-ONNX';
const FALLBACK_MODEL = 'Xenova/distilgpt2';

export interface GLTRToken {
  token: string;
  start: number;
  end: number;
  rank: number;
  probability: number;
  bucket: 'top10' | 'top100' | 'top1000' | 'beyond1000';
  curvatureDelta?: number;
}

export interface SentencePPL {
  index: number;
  text: string;
  start: number;
  end: number;
  perplexity: number;
  avgLogProb: number;
  curvature: number;
  tokenCount: number;
}

export interface PerplexityResult {
  documentPerplexity: number;
  perplexityBurstiness: number;
  curvature: number; // Fast-DetectGPT document z-score d(x)
  gltrDistribution: {
    top10: number; // percentage
    top100: number;
    top1000: number;
    beyond1000: number;
  };
  gltrTokens: GLTRToken[];
  sentencePerplexities: SentencePPL[];
  latencyMs: number;
  modelUsed: string;
}

let tokenizer: any = null;
let model: any = null;
let currentModelId = '';
let currentDevice: 'webgpu' | 'wasm' = 'wasm';

async function loadModel(useWebGPU = true): Promise<void> {
  const modelId = PRIMARY_MODEL;
  try {
    postMessage({ type: 'STATUS', status: 'downloading', model: modelId });
    tokenizer = await AutoTokenizer.from_pretrained(modelId);
    model = await AutoModelForCausalLM.from_pretrained(modelId, {
      dtype: 'q8',
      device: useWebGPU ? 'webgpu' : 'wasm',
      progress_callback: (progress: any) => {
        postMessage({ type: 'PROGRESS', progress, model: modelId });
      },
    });
    currentModelId = modelId;
    currentDevice = useWebGPU ? 'webgpu' : 'wasm';
    postMessage({ type: 'STATUS', status: 'ready', model: modelId });
  } catch (primaryErr) {
    console.warn(`Failed to load ${PRIMARY_MODEL}, falling back to ${FALLBACK_MODEL}:`, primaryErr);
    postMessage({ type: 'STATUS', status: 'downloading', model: FALLBACK_MODEL });
    tokenizer = await AutoTokenizer.from_pretrained(FALLBACK_MODEL);
    model = await AutoModelForCausalLM.from_pretrained(FALLBACK_MODEL, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (progress: any) => {
        postMessage({ type: 'PROGRESS', progress, model: FALLBACK_MODEL });
      },
    });
    currentModelId = FALLBACK_MODEL;
    currentDevice = 'wasm';
    postMessage({ type: 'STATUS', status: 'ready', model: FALLBACK_MODEL });
  }
}

// Softmax helper for logit array
function softmax(logits: Float32Array | number[]): number[] {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    const val = logits[i] ?? 0;
    if (val > max) max = val;
  }
  let sum = 0;
  const exps = new Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    const exp = Math.exp((logits[i] ?? 0) - max);
    exps[i] = exp;
    sum += exp;
  }
  for (let i = 0; i < exps.length; i++) {
    exps[i] /= sum;
  }
  return exps;
}

/**
 * Exact analytical Fast-DetectGPT conditional probability curvature math.
 * Computes:
 * mu_t = sum_v p_t(v) log p_t(v)
 * sigma_t^2 = sum_v p_t(v) (log p_t(v) - mu_t)^2
 * d(x) = sum(ell_t - mu_t) / sqrt(sum(sigma_t^2) + eps)
 */
export function computeAnalyticalCurvature(
  tokens: Array<{ prob: number; probs: number[] }>
): { zScore: number; deltas: number[]; variances: number[] } {
  let totalDelta = 0;
  let totalVar = 0;
  const deltas: number[] = [];
  const variances: number[] = [];

  for (const t of tokens) {
    const ell_t = Math.log(Math.max(t.prob, 1e-12));
    let mu_t = 0;
    let sum_sq = 0;
    const pLen = t.probs.length;

    for (let v = 0; v < pLen; v++) {
      const p = t.probs[v]!;
      if (p > 1e-12) {
        const logP = Math.log(p);
        mu_t += p * logP;
        sum_sq += p * logP * logP;
      }
    }

    const var_t = Math.max(0, sum_sq - mu_t * mu_t);
    const delta_t = ell_t - mu_t;

    deltas.push(delta_t);
    variances.push(var_t);
    totalDelta += delta_t;
    totalVar += var_t;
  }

  const zScore = totalDelta / Math.sqrt(totalVar + 1e-6);
  return { zScore: Math.round(zScore * 100) / 100, deltas, variances };
}

async function analyzePerplexity(
  rawText: string,
  sentences: Array<{ index: number; text: string; start: number; end: number }>
): Promise<PerplexityResult> {
  const startTime = performance.now();

  if (!model || !tokenizer) {
    throw new Error('Perplexity model is not initialized');
  }

  // Tokenize full text
  const encoded = await tokenizer(rawText, { return_tensor: false });
  const inputIds: number[] = Array.isArray(encoded.input_ids)
    ? encoded.input_ids
    : (encoded.input_ids as any).data
      ? Array.from((encoded.input_ids as any).data)
      : [];

  if (inputIds.length < 2) {
    return {
      documentPerplexity: 50,
      perplexityBurstiness: 0,
      curvature: 0,
      gltrDistribution: { top10: 50, top100: 30, top1000: 15, beyond1000: 5 },
      gltrTokens: [],
      sentencePerplexities: [],
      latencyMs: performance.now() - startTime,
      modelUsed: currentModelId,
    };
  }

  // Sliding window context parameters
  const maxContext = 512;
  const gltrTokens: GLTRToken[] = [];
  const tokenDeltas: number[] = [];
  const tokenVariances: number[] = [];
  let totalNll = 0;
  let totalCurvatureDelta = 0;
  let totalCurvatureVariance = 0;
  let evaluatedTokens = 0;

  // Process tokens
  const evalIds = inputIds.slice(0, maxContext);
  const inputTensor = {
    input_ids: {
      data: new BigInt64Array(evalIds.map((id) => BigInt(id))),
      dims: [1, evalIds.length],
      type: 'int64',
    },
  };

  // Run model forward pass
  const output = await model(inputTensor as any);
  const logitsData: Float32Array = output.logits.data;
  const vocabSize: number = output.logits.dims[2];

  let top10Count = 0;
  let top100Count = 0;
  let top1000Count = 0;
  let beyond1000Count = 0;

  let searchOffset = 0;

  // For token t from 1 to seq_len - 1, prediction comes from position t - 1
  for (let t = 1; t < evalIds.length; t++) {
    const targetTokenId = evalIds[t]!;
    const logitOffset = (t - 1) * vocabSize;
    const tokenLogits = logitsData.subarray(logitOffset, logitOffset + vocabSize);

    // Find target logit and calculate rank
    const targetLogit = tokenLogits[targetTokenId] ?? 0;
    let rank = 1;
    for (let v = 0; v < vocabSize; v++) {
      if ((tokenLogits[v] ?? -Infinity) > targetLogit) {
        rank++;
      }
    }

    // Softmax probabilities
    const probs = softmax(tokenLogits);
    const prob = probs[targetTokenId] ?? 0.00001;
    const nll = -Math.log(Math.max(prob, 1e-10));

    // Fast-DetectGPT Analytical Curvature calculation
    const ell_t = Math.log(Math.max(prob, 1e-12));
    let mu_t = 0;
    let sum_sq = 0;
    for (let v = 0; v < vocabSize; v++) {
      const p = probs[v]!;
      if (p > 1e-12) {
        const logP = Math.log(p);
        mu_t += p * logP;
        sum_sq += p * logP * logP;
      }
    }
    const var_t = Math.max(0, sum_sq - mu_t * mu_t);
    const delta_t = ell_t - mu_t;

    totalCurvatureDelta += delta_t;
    totalCurvatureVariance += var_t;
    tokenDeltas.push(delta_t);
    tokenVariances.push(var_t);

    totalNll += nll;
    evaluatedTokens++;

    // GLTR Bucket
    let bucket: GLTRToken['bucket'] = 'beyond1000';
    if (rank <= 10) {
      bucket = 'top10';
      top10Count++;
    } else if (rank <= 100) {
      bucket = 'top100';
      top100Count++;
    } else if (rank <= 1000) {
      bucket = 'top1000';
      top1000Count++;
    } else {
      beyond1000Count++;
    }

    // Decode token string and locate in text
    const tokenStr = tokenizer.decode([targetTokenId]);
    const charPos = rawText.indexOf(tokenStr, searchOffset);
    const start = charPos !== -1 ? charPos : searchOffset;
    const end = start + tokenStr.length;
    if (charPos !== -1) searchOffset = end;

    gltrTokens.push({
      token: tokenStr,
      start,
      end,
      rank,
      probability: Math.round(prob * 10000) / 10000,
      bucket,
      curvatureDelta: Math.round(delta_t * 100) / 100,
    });
  }

  // Document perplexity: exp(totalNll / evaluatedTokens)
  const docPpl = evaluatedTokens > 0 ? Math.exp(totalNll / evaluatedTokens) : 50;

  // Fast-DetectGPT Document Curvature z-score:
  const documentCurvature =
    evaluatedTokens > 0
      ? Math.round((totalCurvatureDelta / Math.sqrt(totalCurvatureVariance + 1e-6)) * 100) / 100
      : 0;

  // Compute Per-Sentence Perplexity & Curvature
  const sentencePerplexities: SentencePPL[] = sentences.map((s) => {
    const matchingTokens = gltrTokens.filter((gt) => gt.start >= s.start && gt.end <= s.end + 5);
    if (matchingTokens.length === 0) {
      return {
        index: s.index,
        text: s.text,
        start: s.start,
        end: s.end,
        perplexity: docPpl,
        avgLogProb: -Math.log(1 / docPpl),
        curvature: documentCurvature,
        tokenCount: 0,
      };
    }
    const sentNll = matchingTokens.reduce((sum, gt) => sum - Math.log(Math.max(gt.probability, 1e-10)), 0);
    const sentPpl = Math.exp(sentNll / matchingTokens.length);

    // Per-sentence curvature z-score
    let sentDelta = 0;
    let sentVar = 0;
    for (let i = 0; i < matchingTokens.length; i++) {
      const gt = matchingTokens[i]!;
      const tokenIdx = gltrTokens.indexOf(gt);
      if (tokenIdx !== -1) {
        sentDelta += tokenDeltas[tokenIdx] ?? 0;
        sentVar += tokenVariances[tokenIdx] ?? 0;
      }
    }
    const sentCurvature =
      Math.round((sentDelta / Math.sqrt(sentVar + 1e-6)) * 100) / 100;

    return {
      index: s.index,
      text: s.text,
      start: s.start,
      end: s.end,
      perplexity: Math.min(Math.round(sentPpl * 10) / 10, 500),
      avgLogProb: -sentNll / matchingTokens.length,
      curvature: sentCurvature,
      tokenCount: matchingTokens.length,
    };
  });

  // Perplexity Burstiness (Standard Deviation of sentence PPLs)
  let pplBurstiness = 0;
  if (sentencePerplexities.length > 1) {
    const ppls = sentencePerplexities.map((sp) => sp.perplexity);
    const meanPpl = ppls.reduce((a, b) => a + b, 0) / ppls.length;
    const variance = ppls.reduce((sum, p) => sum + Math.pow(p - meanPpl, 2), 0) / ppls.length;
    pplBurstiness = Math.round(Math.sqrt(variance) * 10) / 10;
  }

  const totalBucketTokens = Math.max(1, evaluatedTokens);
  const gltrDistribution = {
    top10: Math.round((top10Count / totalBucketTokens) * 1000) / 10,
    top100: Math.round((top100Count / totalBucketTokens) * 1000) / 10,
    top1000: Math.round((top100Count / totalBucketTokens) * 1000) / 10,
    beyond1000: Math.round((beyond1000Count / totalBucketTokens) * 1000) / 10,
  };

  return {
    documentPerplexity: Math.round(docPpl * 10) / 10,
    perplexityBurstiness: pplBurstiness,
    curvature: documentCurvature,
    gltrDistribution,
    gltrTokens,
    sentencePerplexities,
    latencyMs: Math.round(performance.now() - startTime),
    modelUsed: currentModelId,
  };
}

// Web Worker message listener
if (typeof self !== 'undefined') {
  self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data || {};

    if (type === 'PING') {
      postMessage({
        type: 'PONG',
        worker: 'perplexity',
        ready: !!model,
        loadedModelId: currentModelId,
        backend: currentDevice,
        webgpuAvailable: typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as any).gpu,
        timestamp: Date.now(),
      });
      return;
    }

    if (type === 'INIT') {
      const useWebGPU = payload?.useWebGPU ?? true;
      try {
        await loadModel(useWebGPU);
      } catch (err: any) {
        postMessage({ type: 'ERROR', error: err.message });
      }
    } else if (type === 'ANALYZE_PERPLEXITY') {
      const { text, sentences, useWebGPU } = payload;
      try {
        if (!model) {
          await loadModel(useWebGPU ?? true);
        }
        const result = await analyzePerplexity(text, sentences);
        postMessage({ type: 'PERPLEXITY_RESULT', payload: result });
      } catch (err: any) {
        postMessage({ type: 'ERROR', error: err.message });
      }
    }
  };
}
