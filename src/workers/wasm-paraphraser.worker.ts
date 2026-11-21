/**
 * Veritext Local AI - Universal WASM Seq2Seq Neural Paraphraser
 * Runs in standard WebAssembly on CPU threads without requiring WebGPU.
 * Powered by @huggingface/transformers (Xenova/flan-t5-small, Q8 quantized).
 * Serves as Tier 2 in the 3-Tier Humanizer Waterfall for Safari, mobile, and non-WebGPU devices.
 */

import { AutoTokenizer, AutoModelForSeq2SeqLM, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = 'Xenova/flan-t5-small';

let tokenizer: any = null;
let model: any = null;

async function initParaphraser(): Promise<void> {
  postMessage({ type: 'STATUS', status: 'downloading', model: MODEL_ID });
  tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  model = await AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (progress: any) => {
      postMessage({ type: 'PROGRESS', progress, model: MODEL_ID });
    },
  });
  postMessage({ type: 'STATUS', status: 'ready', model: MODEL_ID });
}

async function paraphraseText(
  text: string,
  mode: string = 'standard'
): Promise<{ rewritten: string; latencyMs: number }> {
  const startTime = performance.now();

  if (!model || !tokenizer) {
    throw new Error('WASM Paraphraser model is not initialized');
  }

  const promptPrefix =
    mode === 'casual'
      ? 'Rewrite casually and conversationally with contractions: '
      : mode === 'academic'
        ? 'Rewrite with scholarly rigor and clear syntax: '
        : 'Paraphrase in active human voice with varied rhythm: ';

  const inputPrompt = `${promptPrefix}${text}`;
  const inputs = await tokenizer(inputPrompt, {
    padding: true,
    truncation: true,
    max_length: 512,
  });

  const outputs = await model.generate({
    ...inputs,
    max_new_tokens: 300,
    temperature: 0.8,
    do_sample: true,
    top_k: 40,
    repetition_penalty: 1.2,
  });

  const rawDecoded = tokenizer.decode(outputs[0], { skip_special_tokens: true });
  const latencyMs = Math.round(performance.now() - startTime);

  return {
    rewritten: rawDecoded.trim(),
    latencyMs,
  };
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data || {};

  if (type === 'PING') {
    postMessage({
      type: 'PONG',
      worker: 'wasm-paraphraser',
      ready: !!model,
      loadedModelId: model ? MODEL_ID : null,
      backend: 'wasm',
      webgpuAvailable: typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as any).gpu,
      timestamp: Date.now(),
    });
    return;
  }

  try {
    if (type === 'INIT') {
      await initParaphraser();
      postMessage({ type: 'INIT_COMPLETE' });
    } else if (type === 'PARAPHRASE') {
      if (!model) await initParaphraser();
      const result = await paraphraseText(payload.text, payload.mode);
      postMessage({ type: 'PARAPHRASE_RESULT', payload: result });
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
