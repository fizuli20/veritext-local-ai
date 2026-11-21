import { NextResponse } from 'next/server';
import {
  ONNX_DETECTOR_MODELS,
  PERPLEXITY_MODELS,
  EMBEDDING_MODELS,
  WASM_PARAPHRASER_MODELS,
  WEBLLM_HUMANIZER_MODELS,
} from '@/lib/ml/model-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    product: 'Veritext Local AI',
    version: '2.0.0',
    mode: 'zero-token-local-ai-max',
    zeroKeyMandate: true,
    externalApiKeysRequired: false,
    engines: {
      detector: {
        signal1: 'Pure TypeScript Stylometrics (<30ms, Zero Download, 6 Normalized Signals)',
        signal2: 'In-Browser RoBERTa ONNX Classifier (WebGPU + WASM)',
        signal3: 'Causal LM Perplexity & GLTR Token X-Ray (sliding window, top-k rank distribution)',
        adversarialDefense: 'Zero-Width Stripper & Cyrillic/Greek Homoglyph Normalizer',
        domainCalibration: ['general', 'academic', 'technical', 'creative', 'esl-fair'],
        models: {
          roberta: ONNX_DETECTOR_MODELS,
          perplexity: PERPLEXITY_MODELS,
        },
      },
      humanizer: {
        tier1: 'Deterministic De-AI Rule-Engine (Instant, Zero Download)',
        tier2: 'Universal WASM Seq2Seq Paraphraser (CPU / iOS Safari / Non-WebGPU)',
        tier3: 'In-Browser WebGPU Local LLM (@mlc-ai/web-llm)',
        tournament: 'Best-of-N Multi-Objective Reranker (AI% + Semantic Sim + Guardrail + Voice Distance)',
        semanticFidelity: {
          model: EMBEDDING_MODELS.primary,
          hardFloor: 0.84,
        },
        models: {
          wasmSeq2Seq: WASM_PARAPHRASER_MODELS,
          webLlm: WEBLLM_HUMANIZER_MODELS,
        },
      },
      scheduler: {
        memoryBudgeting: 'Automatic sequential execution on <8GB RAM / constrained GPUs',
        panicUnloadAvailable: true,
      },
      privacy: {
        zeroDataEgress: true,
        textLeavesBrowser: false,
        gdprCompliant: true,
      },
    },
    timestamp: new Date().toISOString(),
  });
}
