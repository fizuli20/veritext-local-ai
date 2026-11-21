/**
 * Veritext Local AI - Local Semantic Fidelity Engine
 * Computes mean-pooled L2-normalized sentence embeddings and cosine similarities
 * via @huggingface/transformers (Xenova/all-MiniLM-L6-v2, Q8 quantized, ~23MB).
 */

import { AutoTokenizer, AutoModel, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

let tokenizer: any = null;
let model: any = null;

async function initModel(useWebGPU = false): Promise<void> {
  postMessage({ type: 'STATUS', status: 'downloading', model: MODEL_ID });
  tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  model = await AutoModel.from_pretrained(MODEL_ID, {
    dtype: 'q8',
    device: useWebGPU ? 'webgpu' : 'wasm',
    progress_callback: (progress: any) => {
      postMessage({ type: 'PROGRESS', progress, model: MODEL_ID });
    },
  });
  postMessage({ type: 'STATUS', status: 'ready', model: MODEL_ID });
}

/**
 * Mean pooling with attention mask and L2 normalization
 */
function meanPoolAndNormalize(
  tokenEmbeddings: Float32Array,
  dims: number[],
  attentionMaskData: any
): number[] {
  const [, seqLen, hiddenDim] = dims;
  if (!seqLen || !hiddenDim) return [];

  const pooled = new Array<number>(hiddenDim).fill(0);
  let tokenCount = 0;

  for (let s = 0; s < seqLen; s++) {
    const mask = Number(attentionMaskData[s] ?? 1);
    if (mask > 0) {
      tokenCount++;
      const offset = s * hiddenDim;
      for (let h = 0; h < hiddenDim; h++) {
        pooled[h] = (pooled[h] ?? 0) + (tokenEmbeddings[offset + h] ?? 0);
      }
    }
  }

  if (tokenCount > 0) {
    for (let h = 0; h < hiddenDim; h++) {
      pooled[h] = (pooled[h] ?? 0) / tokenCount;
    }
  }

  // L2 normalize
  let norm = 0;
  for (let h = 0; h < hiddenDim; h++) {
    norm += (pooled[h] ?? 0) * (pooled[h] ?? 0);
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let h = 0; h < hiddenDim; h++) {
      pooled[h] = (pooled[h] ?? 0) / norm;
    }
  }

  return pooled;
}

export function computeCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return Math.max(0, Math.min(1, Math.round(dot * 10000) / 10000));
}

async function getEmbedding(text: string): Promise<number[]> {
  if (!model || !tokenizer) {
    throw new Error('Embedding model not initialized');
  }
  const encoded = await tokenizer(text, {
    padding: true,
    truncation: true,
    max_length: 256,
  });

  const output = await model(encoded);
  const embeddingsData: Float32Array = output.last_hidden_state.data;
  const dims: number[] = output.last_hidden_state.dims;
  const maskData = encoded.attention_mask.data;

  return meanPoolAndNormalize(embeddingsData, dims, maskData);
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    if (type === 'INIT') {
      await initModel(payload?.useWebGPU ?? false);
      postMessage({ type: 'INIT_COMPLETE' });
    } else if (type === 'COMPUTE_SIMILARITY') {
      if (!model) await initModel(false);
      const originalEmb = await getEmbedding(payload.original);
      const candidateEmb = await getEmbedding(payload.candidate);
      const similarity = computeCosineSimilarity(originalEmb, candidateEmb);
      postMessage({
        type: 'SIMILARITY_RESULT',
        payload: {
          similarity,
          passedThreshold: similarity >= (payload.threshold ?? 0.84),
        },
      });
    } else if (type === 'BATCH_SIMILARITY') {
      if (!model) await initModel(false);
      const originalEmb = await getEmbedding(payload.original);
      const candidates: string[] = payload.candidates;
      const results = [];
      for (let i = 0; i < candidates.length; i++) {
        const cEmb = await getEmbedding(candidates[i] ?? '');
        const sim = computeCosineSimilarity(originalEmb, cEmb);
        results.push({
          index: i,
          similarity: sim,
          passedThreshold: sim >= (payload.threshold ?? 0.84),
        });
      }
      postMessage({ type: 'BATCH_SIMILARITY_RESULT', payload: results });
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
