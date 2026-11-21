import { NextResponse } from 'next/server';
import { ONNX_DETECTOR_MODELS, WEBLLM_HUMANIZER_MODELS } from '@/lib/ml/model-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    product: 'Veritext Local AI',
    version: '1.0.0',
    mode: 'zero-token-local-ai',
    zeroKeyMandate: true,
    externalApiKeysRequired: false,
    engines: {
      detector: {
        tier1: 'Pure TypeScript Stylometrics (<30ms, Zero Download)',
        tier2: 'In-Browser RoBERTa ONNX Web Worker (WebGPU + WASM)',
        models: ONNX_DETECTOR_MODELS,
      },
      humanizer: {
        tier1: 'Deterministic De-AI Rule-Engine (Instant, Zero Download)',
        tier2: 'In-Browser WebGPU Local LLM (@mlc-ai/web-llm)',
        models: WEBLLM_HUMANIZER_MODELS,
      },
    },
    privacy: {
      zeroDataEgress: true,
      textLeavesBrowser: false,
      gdprCompliant: true,
    },
    timestamp: new Date().toISOString(),
  });
}
