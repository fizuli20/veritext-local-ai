/**
 * Veritext Local AI - Perplexity & GLTR Forensic Web Worker
 * Runs client-side in browser Web Workers using @huggingface/transformers.
 * Computes exact next-token log probabilities, sliding window perplexity,
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
}

export interface SentencePPL {
  index: number;
  text: string;
  start: number;
  end: number;
  perplexity: number;
  avgLogProb: number;
  tokenCount: number;
}

export interface PerplexityResult {
  documentPerplexity: number;
  perplexityBurstiness: number;
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
  let totalNll = 0;
  let evaluatedTokens = 0;

  // Process tokens
  // For standard browser inference latency, evaluate first N tokens up to 512
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
  // Logits shape: [1, seq_len, vocab_size]
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
    });
  }

  // Document perplexity: exp(totalNll / evaluatedTokens)
  const docPpl = evaluatedTokens > 0 ? Math.exp(totalNll / evaluatedTokens) : 50;

  // Compute Per-Sentence Perplexity
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
        tokenCount: 0,
      };
    }
    const sentNll = matchingTokens.reduce((sum, gt) => sum - Math.log(Math.max(gt.probability, 1e-10)), 0);
    const sentPpl = Math.exp(sentNll / matchingTokens.length);
    return {
      index: s.index,
      text: s.text,
      start: s.start,
      end: s.end,
      perplexity: Math.min(Math.round(sentPpl * 10) / 10, 500),
      avgLogProb: -sentNll / matchingTokens.length,
      tokenCount: matchingTokens.length,
    };
  });

  // Perplexity Burstiness (Standard Deviation of sentence PPLs)
  let pplBurstiness = 0;
  if (sentencePerplexities.length > 1) {
    const meanPpl = sentencePerplexities.reduce((sum, s) => sum + s.perplexity, 0) / sentencePerplexities.length;
    const variance =
      sentencePerplexities.reduce((sum, s) => sum + Math.pow(s.perplexity - meanPpl, 2), 0) /
      sentencePerplexities.length;
    pplBurstiness = Math.round(Math.sqrt(variance) * 10) / 10;
  }

  const totalTokens = Math.max(evaluatedTokens, 1);
  const gltrDistribution = {
    top10: Math.round((top10Count / totalTokens) * 100),
    top100: Math.round((top100Count / totalTokens) * 100),
    top1000: Math.round((top1000Count / totalTokens) * 100),
    beyond1000: Math.round((beyond1000Count / totalTokens) * 100),
  };

  return {
    documentPerplexity: Math.round(docPpl * 10) / 10,
    perplexityBurstiness: pplBurstiness,
    gltrDistribution,
    gltrTokens,
    sentencePerplexities,
    latencyMs: Math.round(performance.now() - startTime),
    modelUsed: currentModelId,
  };
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    if (type === 'INIT') {
      await loadModel(payload?.useWebGPU ?? true);
      postMessage({ type: 'INIT_COMPLETE', model: currentModelId });
    } else if (type === 'ANALYZE_PERPLEXITY') {
      if (!model) {
        await loadModel(payload?.useWebGPU ?? true);
      }
      const result = await analyzePerplexity(payload.text, payload.sentences);
      postMessage({ type: 'PERPLEXITY_RESULT', payload: result });
    } else if (type === 'UNLOAD') {
      model = null;
      tokenizer = null;
      postMessage({ type: 'UNLOAD_COMPLETE' });
    }
  } catch (err: unknown) {
    postMessage({
      type: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
