/// <reference lib="webworker" />

import { pipeline, env } from '@huggingface/transformers';
import { analyzeStylometrics } from '../lib/nlp/stylometrics';

// Configure transformers.js for browser client execution
env.allowLocalModels = false;
env.useBrowserCache = true;

let classifier: any = null;
let currentDevice: 'webgpu' | 'wasm' = 'wasm';
let isInitializing = false;

const PRIMARY_MODEL = 'onnx-community/chatgpt-detector-roberta-ONNX';
const FALLBACK_MODEL = 'onnx-community/roberta-base-openai-detector-ONNX';

async function initClassifier(devicePreference?: 'webgpu' | 'wasm') {
  if (classifier) return classifier;
  if (isInitializing) return;
  isInitializing = true;

  // Determine device
  if (devicePreference) {
    currentDevice = devicePreference;
  } else if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
    currentDevice = 'webgpu';
  } else {
    currentDevice = 'wasm';
  }

  self.postMessage({
    type: 'status',
    message: `Initializing neural detector on ${currentDevice.toUpperCase()}...`,
  });

  const progressCallback = (info: any) => {
    if (info.status === 'progress') {
      self.postMessage({
        type: 'download-progress',
        file: info.file || 'model.onnx',
        loaded: info.loaded || 0,
        total: info.total || 0,
        progress: Math.round(info.progress || 0),
      });
    }
  };

  try {
    classifier = await pipeline('text-classification', PRIMARY_MODEL, {
      device: currentDevice,
      dtype: 'q8',
      progress_callback: progressCallback,
    });
    self.postMessage({
      type: 'ready',
      model: PRIMARY_MODEL,
      device: currentDevice,
    });
  } catch (err: any) {
    self.postMessage({
      type: 'warning',
      message: `Primary model/WebGPU load failed: ${err?.message || err}. Falling back to WASM...`,
    });
    currentDevice = 'wasm';
    try {
      classifier = await pipeline('text-classification', FALLBACK_MODEL, {
        device: 'wasm',
        progress_callback: progressCallback,
      });
      self.postMessage({
        type: 'ready',
        model: FALLBACK_MODEL,
        device: 'wasm',
      });
    } catch (fallbackErr: any) {
      self.postMessage({
        type: 'error',
        error: `Neural detector failed to load: ${fallbackErr?.message || fallbackErr}`,
      });
    }
  } finally {
    isInitializing = false;
  }
}

async function runDetection(text: string, id: string) {
  // Always compute instant pure TS stylometrics
  const stylometricResult = analyzeStylometrics(text);

  if (!classifier) {
    // If neural model not loaded yet, return stylometric-instant
    self.postMessage({
      type: 'result',
      id,
      engine: 'stylometric-instant',
      score: stylometricResult.aiScore,
      isAi: stylometricResult.isAi,
      stylometricResult,
      neuralScore: null,
      ensembleScore: stylometricResult.aiScore,
    });
    return;
  }

  try {
    // Neural model scoring
    // Split into overlapping chunks if > 350 words
    const words = text.split(/\s+/);
    let rawNeuralProb = 0.5;

    if (words.length <= 350) {
      const output = await classifier(text);
      rawNeuralProb = parseModelScore(output);
    } else {
      // Chunking with 50-word overlap
      const chunkSize = 300;
      const overlap = 50;
      let totalProb = 0;
      let chunkCount = 0;

      for (let i = 0; i < words.length; i += chunkSize - overlap) {
        const slice = words.slice(i, i + chunkSize).join(' ');
        if (slice.trim().length > 0) {
          const out = await classifier(slice);
          totalProb += parseModelScore(out);
          chunkCount++;
        }
      }
      rawNeuralProb = chunkCount > 0 ? totalProb / chunkCount : 0.5;
    }

    const neuralAiScore = Math.round(rawNeuralProb * 100);

    // Hybrid ensemble blend: 0.65 * neuralScore + 0.35 * stylometricScore
    const ensembleScore = Math.round(0.65 * neuralAiScore + 0.35 * stylometricResult.aiScore);

    self.postMessage({
      type: 'result',
      id,
      engine: 'browser-hybrid-neural',
      device: currentDevice,
      score: ensembleScore,
      isAi: ensembleScore >= 50,
      neuralScore: neuralAiScore,
      stylometricResult,
      ensembleScore,
    });
  } catch (err: any) {
    // Graceful fallback to stylometric engine on any inference error
    self.postMessage({
      type: 'result',
      id,
      engine: 'stylometric-instant',
      score: stylometricResult.aiScore,
      isAi: stylometricResult.isAi,
      stylometricResult,
      neuralScore: null,
      ensembleScore: stylometricResult.aiScore,
      warning: `Inference warning: ${err?.message || err}. Reverted to Pure TS Stylometrics.`,
    });
  }
}

function parseModelScore(output: any): number {
  if (Array.isArray(output) && output.length > 0) {
    const item = output[0];
    if (item && typeof item.score === 'number') {
      const label = String(item.label || '').toLowerCase();
      if (label.includes('fake') || label.includes('ai') || label.includes('label_1')) {
        return item.score;
      } else {
        return 1 - item.score;
      }
    }
  }
  return 0.5;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, text, id, device } = e.data;

  if (type === 'init') {
    await initClassifier(device);
  } else if (type === 'detect') {
    await runDetection(text, id);
  }
};
