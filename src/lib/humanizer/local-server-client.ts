/**
 * Zero-dependency client for local OpenAI-compatible inference servers:
 * - LM Studio (http://localhost:1234/v1)
 * - Ollama (http://localhost:11434/v1)
 * - Custom OpenAI-compatible endpoints
 */

import { cleanLlmOutput, extractDeltaContent } from './output-cleaner';

export type ModelFamily = 'gemma' | 'qwen' | 'mistral' | 'muse' | 'llama' | 'hemmingway' | 'other';

export interface DiscoveredModel {
  id: string;
  name: string;
  family: ModelFamily;
  isGemma: boolean;
  contextLength?: number;
}

export interface LocalServerConfig {
  baseUrl: string;
  apiKey?: string;
  selectedModelId?: string;
  providerType: 'lm-studio' | 'ollama' | 'custom';
}

export interface SamplingConfig {
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
}

export interface StreamTelemetry {
  ttftMs: number;
  tokensPerSec: number;
  totalTokens: number;
  elapsedMs: number;
}

export const LOCAL_SERVER_PRESETS: Record<'lmStudio' | 'ollama', LocalServerConfig> = {
  lmStudio: {
    baseUrl: 'http://localhost:1234/v1',
    providerType: 'lm-studio',
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    providerType: 'ollama',
  },
};

const STORAGE_KEY = 'veritext_local_server_config';

export function loadStoredServerConfig(): LocalServerConfig {
  if (typeof window === 'undefined') return LOCAL_SERVER_PRESETS.lmStudio;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return LOCAL_SERVER_PRESETS.lmStudio;
}

export function saveStoredServerConfig(cfg: LocalServerConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

/**
 * Classifies model family based on model ID / name.
 */
export function classifyModelFamily(modelId: string): ModelFamily {
  const lower = modelId.toLowerCase();
  if (lower.includes('gemma')) return 'gemma';
  if (lower.includes('qwen')) return 'qwen';
  if (lower.includes('mistral') || lower.includes('mixtral')) return 'mistral';
  if (lower.includes('muse')) return 'muse';
  if (lower.includes('llama') || lower.includes('alpaca') || lower.includes('vicuna')) return 'llama';
  if (lower.includes('hemmingway') || lower.includes('hemingway')) return 'hemmingway';
  return 'other';
}

/**
 * Determines optimal anti-slop sampling parameters tailored to model family.
 */
export function getSamplingParameters(
  modelId: string,
  style: 'default' | 'academic' | 'creative' = 'default'
): SamplingConfig {
  const family = classifyModelFamily(modelId);

  if (style === 'academic') {
    return {
      temperature: 0.58,
      top_p: 0.88,
      frequency_penalty: 0.15,
      presence_penalty: 0.1,
      max_tokens: 2048,
    };
  }

  if (family === 'gemma') {
    // Gemma Anti-Slop configuration
    return {
      temperature: 0.85,
      top_p: 0.92,
      frequency_penalty: 0.28,
      presence_penalty: 0.22,
      max_tokens: 2048,
    };
  }

  if (style === 'creative') {
    return {
      temperature: 0.88,
      top_p: 0.94,
      frequency_penalty: 0.22,
      presence_penalty: 0.18,
      max_tokens: 2048,
    };
  }

  // Low-Slop default (Qwen, Mistral, Muse, Llama)
  return {
    temperature: 0.78,
    top_p: 0.9,
    frequency_penalty: 0.18,
    presence_penalty: 0.15,
    max_tokens: 2048,
  };
}

/**
 * Auto-discovers loaded/available models from LM Studio or Ollama.
 * Filters out embedding models and returns classified models.
 */
export async function discoverLocalModels(
  baseUrl: string,
  apiKey?: string
): Promise<{ models: DiscoveredModel[]; rawCount: number; error?: string }> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Timeout safety
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    // 1. Try /v1/models (standard OpenAI endpoint)
    let res = await fetch(`${cleanBase}/models`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    // If 404 and base URL has /v1, try root /api/v1/models (LM Studio native)
    if (!res.ok && cleanBase.endsWith('/v1')) {
      const rootBase = cleanBase.slice(0, -3);
      try {
        const altRes = await fetch(`${rootBase}/api/v1/models`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        if (altRes.ok) res = altRes;
      } catch {
        // keep original res
      }
    }

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const rawList: any[] = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];

    const nonEmbedding = rawList.filter((m) => {
      const id = String(m.id || m.name || '').toLowerCase();
      return (
        !id.includes('embed') &&
        !id.includes('minilm') &&
        !id.includes('bge-') &&
        !id.includes('nomic') &&
        !id.includes('gte-')
      );
    });

    const models: DiscoveredModel[] = nonEmbedding.map((m) => {
      const id = String(m.id || m.name);
      const family = classifyModelFamily(id);
      return {
        id,
        name: m.name || id,
        family,
        isGemma: family === 'gemma',
        contextLength: m.context_length || m.max_context_length,
      };
    });

    return { models, rawCount: rawList.length };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return { models: [], rawCount: 0, error: err.message || 'Connection failed' };
  }
}

export type LocalServerErrorCategory =
  | 'cors-blocked'
  | 'server-offline'
  | 'no-models'
  | 'mixed-content'
  | 'invalid-auth'
  | 'timeout'
  | 'generic';

export interface LocalServerDiagnostic {
  category: LocalServerErrorCategory;
  title: string;
  description: string;
  fixCommand?: string;
  instructions: string[];
}

export function classifyLocalServerError(err: any, baseUrl: string): LocalServerDiagnostic {
  const msg = String(err?.message || err || '').toLowerCase();
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

  // Check for HTTPS -> localhost mixed content block
  if (isHttps && isLocalhost && (msg.includes('failed to fetch') || msg.includes('networkerror'))) {
    return {
      category: 'mixed-content',
      title: 'HTTPS Mixed Content / Private Network Restriction',
      description:
        'Modern browsers block secure HTTPS web apps from making requests to insecure http://localhost without explicit permission.',
      instructions: [
        'Option A (Easiest): Run the app locally on http://localhost:3000 via "npm run dev".',
        'Option B (Chrome/Edge): In chrome://flags, set "Block insecure private network requests" to Disabled.',
        'Option C: Use LM Studio with a local reverse proxy or tunnel if running on remote https.',
      ],
    };
  }

  // Check for CORS or Network error
  if (msg.includes('failed to fetch') || msg.includes('cors') || msg.includes('networkerror') || msg.includes('load failed')) {
    if (baseUrl.includes(':1234')) {
      return {
        category: 'cors-blocked',
        title: 'LM Studio Offline or CORS Not Enabled',
        description: 'LM Studio is either not running on port 1234 or CORS headers are disabled.',
        fixCommand: 'lms server start --cors',
        instructions: [
          'In LM Studio: Navigate to Developer / Local Server tab.',
          'Toggle "Enable CORS" to ON.',
          'Or start via terminal: lms server start --cors',
          'Ensure a model is loaded into memory.',
        ],
      };
    }
    if (baseUrl.includes(':11434')) {
      return {
        category: 'cors-blocked',
        title: 'Ollama Offline or CORS Origins Restricted',
        description: 'Ollama is either offline or rejecting requests from this web origin.',
        fixCommand: 'OLLAMA_ORIGINS="*" ollama serve',
        instructions: [
          'Start Ollama with cross-origin access enabled: OLLAMA_ORIGINS="*" ollama serve',
          'On macOS: launchctl setenv OLLAMA_ORIGINS "*"',
          'Verify Ollama is reachable at http://localhost:11434',
        ],
      };
    }
    return {
      category: 'server-offline',
      title: 'Local Inference Server Unreachable',
      description: `Could not connect to ${baseUrl}. Verify the server is running and accessible.`,
      instructions: [
        `Check if ${baseUrl} responds to GET /v1/models in your browser.`,
        'Ensure the host machine firewall allows connections on this port.',
      ],
    };
  }

  if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized')) {
    return {
      category: 'invalid-auth',
      title: 'Authentication Required',
      description: 'The local server rejected the request due to missing or invalid Bearer token.',
      instructions: ['Enter your configured API Key / Bearer token in the Server Settings.'],
    };
  }

  if (msg.includes('abort') || msg.includes('timeout')) {
    return {
      category: 'timeout',
      title: 'Connection Timed Out',
      description: `Server at ${baseUrl} took longer than 3.5 seconds to respond.`,
      instructions: [
        'Check if the server is under heavy GPU load or generating another request.',
        'Restart the local inference process if it is unresponsive.',
      ],
    };
  }

  return {
    category: 'generic',
    title: 'Local Server Error',
    description: err?.message || 'An unexpected error occurred while communicating with the local server.',
    instructions: ['Inspect the server terminal / console for traceback information.'],
  };
}

export interface StreamChatCompletionOptions {
  baseUrl: string;
  apiKey?: string;
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  style?: 'default' | 'academic' | 'creative';
  signal?: AbortSignal;
  onChunk: (chunk: string, fullCleanedText: string) => void;
  onTelemetry?: (telemetry: StreamTelemetry) => void;
}

/**
 * Streams chat completions from LM Studio / Ollama via SSE.
 * Automatically retries with system instructions folded into user message if 400 is returned
 * (resolving Gemma 2/3 GGUF template system-role incompatibilities).
 */
export async function streamChatCompletion({
  baseUrl,
  apiKey,
  modelId,
  systemPrompt,
  userPrompt,
  style = 'default',
  signal,
  onChunk,
  onTelemetry,
}: StreamChatCompletionOptions): Promise<string> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/chat/completions`;
  const sampling = getSamplingParameters(modelId, style);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Attempt with standard system + user message
  let bodyPayload: any = {
    model: modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: sampling.temperature,
    top_p: sampling.top_p,
    frequency_penalty: sampling.frequency_penalty,
    presence_penalty: sampling.presence_penalty,
    max_tokens: sampling.max_tokens,
    stream: true,
  };

  let res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload),
    signal,
  });

  // Gemma Auto-Fallback: If 400 rejecting system role, retry folding system instructions into user prompt
  if (res.status === 400) {
    const errText = await res.text();
    const isSystemRoleRejection =
      errText.toLowerCase().includes('system') ||
      errText.toLowerCase().includes('developer') ||
      errText.toLowerCase().includes('role');

    if (isSystemRoleRejection) {
      bodyPayload = {
        model: modelId,
        messages: [
          {
            role: 'user',
            content: `[System Instructions:\n${systemPrompt}]\n\n[Task:\n${userPrompt}]`,
          },
        ],
        temperature: sampling.temperature,
        top_p: sampling.top_p,
        frequency_penalty: sampling.frequency_penalty,
        presence_penalty: sampling.presence_penalty,
        max_tokens: sampling.max_tokens,
        stream: true,
      };

      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal,
      });
    } else {
      throw new Error(`Local server returned HTTP 400: ${errText}`);
    }
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Inference failed (HTTP ${res.status}): ${errText}`);
  }

  if (!res.body) {
    throw new Error('Response body is null, cannot stream SSE.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');

  let accumulatedRaw = '';
  let accumulatedClean = '';
  let tokenCount = 0;
  const startTime = performance.now();
  let firstTokenTime: number | null = null;
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // Skip comments/heartbeats
        if (trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            const content = extractDeltaContent(delta);

            if (content) {
              tokenCount++;
              if (firstTokenTime === null) {
                firstTokenTime = performance.now();
              }
              accumulatedRaw += content;
              accumulatedClean = cleanLlmOutput(accumulatedRaw);
              onChunk(content, accumulatedClean);

              if (onTelemetry) {
                const now = performance.now();
                const elapsedMs = Math.round(now - startTime);
                const ttftMs = firstTokenTime ? Math.round(firstTokenTime - startTime) : elapsedMs;
                const activeGenSec = (now - (firstTokenTime || startTime)) / 1000;
                const tokensPerSec = activeGenSec > 0 ? Math.round((tokenCount / activeGenSec) * 10) / 10 : 0;
                onTelemetry({
                  ttftMs,
                  tokensPerSec,
                  totalTokens: tokenCount,
                  elapsedMs,
                });
              }
            }
          } catch {
            // Incomplete JSON segment, ignore and continue
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return cleanLlmOutput(accumulatedRaw);
}
