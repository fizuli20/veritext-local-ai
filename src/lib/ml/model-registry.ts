export interface ModelDefinition {
  id: string;
  name: string;
  family: 'roberta-onnx' | 'webllm';
  tier: 'instant' | 'lite' | 'balanced' | 'quality';
  sizeMB: number;
  vramMB: number;
  description: string;
  isCached?: boolean;
}

export const ONNX_DETECTOR_MODELS: Record<string, ModelDefinition> = {
  primary: {
    id: 'onnx-community/chatgpt-detector-roberta-ONNX',
    name: 'ChatGPT Detector RoBERTa (Q8 Quantized)',
    family: 'roberta-onnx',
    tier: 'lite',
    sizeMB: 125,
    vramMB: 250,
    description: 'High-precision RoBERTa neural sequence classifier quantized to 8-bit for browser WebGPU/WASM.',
  },
  fallback: {
    id: 'onnx-community/roberta-base-openai-detector-ONNX',
    name: 'RoBERTa Base OpenAI Detector (WASM Fallback)',
    family: 'roberta-onnx',
    tier: 'lite',
    sizeMB: 125,
    vramMB: 250,
    description: 'Resilient fallback neural detector for environments with restricted WebGPU extensions.',
  },
};

export const WEBLLM_HUMANIZER_MODELS: Record<'lite' | 'balanced' | 'quality', ModelDefinition> = {
  lite: {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B Instruct (Q4)',
    family: 'webllm',
    tier: 'lite',
    sizeMB: 880,
    vramMB: 1100,
    description: 'Ultra-fast 1B instruction-tuned model. Recommended for laptops, integrated GPUs, and quick rewrites.',
  },
  balanced: {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 1.5B Instruct (Q4)',
    family: 'webllm',
    tier: 'balanced',
    sizeMB: 1350,
    vramMB: 1800,
    description: 'Optimal balance of stylistic nuance and inference velocity. Excellent command of rhythm and syntax.',
  },
  quality: {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    name: 'Phi-3.5 Mini 3.8B Instruct (Q4)',
    family: 'webllm',
    tier: 'quality',
    sizeMB: 2200,
    vramMB: 3200,
    description: 'Highest stylistic flexibility and vocabulary depth. Recommended for dedicated GPUs (M1/M2/M3 or RTX).',
  },
};

/**
 * Resolves verified model ID against runtime web-llm prebuilt list if available.
 */
export function resolveWebLlmModelId(tier: 'lite' | 'balanced' | 'quality'): string {
  return WEBLLM_HUMANIZER_MODELS[tier].id;
}
