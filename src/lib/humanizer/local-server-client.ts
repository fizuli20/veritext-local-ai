/**
 * Zero-dependency client for local OpenAI-compatible inference servers:
 * - LM Studio (http://localhost:1234/v1)
 * - Ollama (http://localhost:11434/v1)
 * - Custom OpenAI-compatible endpoints
 */

import {
  cleanLlmOutput,
  extractDeltaContent,
  RewriteOutputLimitError,
} from "./output-cleaner";

export type ModelFamily =
  | "gemma"
  | "qwen"
  | "mistral"
  | "muse"
  | "llama"
  | "hemmingway"
  | "other";

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
  providerType: "lm-studio" | "ollama" | "custom";
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

export const LOCAL_SERVER_PRESETS: Record<
  "lmStudio" | "ollama",
  LocalServerConfig
> = {
  lmStudio: {
    baseUrl: "http://localhost:1234/v1",
    providerType: "lm-studio",
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    providerType: "ollama",
  },
};

const STORAGE_KEY = "veritext_local_server_config";
const DISCOVERY_TIMEOUT_MS = 12_000;

export function localApiBase(baseUrl: string): string {
  const url = new URL(baseUrl.trim());
  const path = url.pathname.replace(/\/+$/, "");
  return url.origin + (path || "/v1");
}

export function loadStoredServerConfig(): LocalServerConfig {
  if (typeof window === "undefined") return LOCAL_SERVER_PRESETS.lmStudio;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return LOCAL_SERVER_PRESETS.lmStudio;
}

export function saveStoredServerConfig(cfg: LocalServerConfig): void {
  if (typeof window === "undefined") return;
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
  if (lower.includes("gemma")) return "gemma";
  if (lower.includes("qwen")) return "qwen";
  if (lower.includes("mistral") || lower.includes("mixtral")) return "mistral";
  if (lower.includes("muse")) return "muse";
  if (
    lower.includes("llama") ||
    lower.includes("alpaca") ||
    lower.includes("vicuna")
  )
    return "llama";
  if (lower.includes("hemmingway") || lower.includes("hemingway"))
    return "hemmingway";
  return "other";
}

/**
 * Determines optimal anti-slop sampling parameters tailored to model family.
 */
export function getSamplingParameters(
  modelId: string,
  style: "default" | "academic" | "creative" = "default",
): SamplingConfig {
  const family = classifyModelFamily(modelId);

  if (style === "academic") {
    return {
      temperature: 0.58,
      top_p: 0.88,
      frequency_penalty: 0.15,
      presence_penalty: 0.1,
      max_tokens: 2048,
    };
  }

  if (family === "gemma") {
    // Gemma Anti-Slop configuration
    return {
      temperature: 0.85,
      top_p: 0.92,
      frequency_penalty: 0.28,
      presence_penalty: 0.22,
      max_tokens: 2048,
    };
  }

  if (style === "creative") {
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
  apiKey?: string,
): Promise<{ models: DiscoveredModel[]; rawCount: number; error?: string }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);

  try {
    const cleanBase = localApiBase(baseUrl);
    // 1. Try /v1/models (standard OpenAI endpoint)
    let res = await fetch(`${cleanBase}/models`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    // If 404 and base URL has /v1, try root /api/v1/models (LM Studio native)
    if ([404, 405].includes(res.status) && cleanBase.endsWith("/v1")) {
      const rootBase = cleanBase.slice(0, -3);
      try {
        const altRes = await fetch(`${rootBase}/api/v1/models`, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
        if (altRes.ok) res = altRes;
      } catch {
        // keep original res
      }
    }

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const rawList: any[] = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.models)
        ? data.models
        : [];

    const models: DiscoveredModel[] = rawList.flatMap((m) => {
      const id = m?.id || m?.key || m?.name;
      if (typeof id !== "string" || !id.trim()) return [];
      if (m.type === "embedding" || /embed|minilm|bge-|nomic|gte-/i.test(id))
        return [];
      const family = classifyModelFamily(id);
      return [
        {
          id,
          name: m.name || m.display_name || id,
          family,
          isGemma: family === "gemma",
          contextLength: m.context_length || m.max_context_length,
        },
      ];
    });

    return { models, rawCount: rawList.length };
  } catch (err) {
    return {
      models: [],
      rawCount: 0,
      error: controller.signal.aborted
        ? "The local server did not respond to model discovery within 12 seconds."
        : err instanceof Error
          ? err.message
          : "Connection failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export type LocalServerErrorCategory =
  | "cors-blocked"
  | "server-offline"
  | "no-models"
  | "mixed-content"
  | "invalid-auth"
  | "timeout"
  | "generic";

export interface LocalServerDiagnostic {
  category: LocalServerErrorCategory;
  title: string;
  description: string;
  fixCommand?: string;
  instructions: string[];
}

export function classifyLocalServerError(
  err: any,
  baseUrl: string,
): LocalServerDiagnostic {
  const msg = String(err?.message || err || "").toLowerCase();
  const isHttps =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const isLocalhost =
    baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

  // Check for HTTPS -> localhost mixed content block
  if (
    isHttps &&
    isLocalhost &&
    (msg.includes("failed to fetch") || msg.includes("networkerror"))
  ) {
    return {
      category: "mixed-content",
      title: "HTTPS Mixed Content / Private Network Restriction",
      description:
        "The browser could not reach the local server. Possible causes include an offline server, CORS, or local-network permission.",
      instructions: [
        'Option A (Easiest): Run the app locally on http://localhost:3000 via "npm run dev".',
        "Allow local-network access for this site if your browser asks, and enable CORS on the local server.",
        "In LM Studio: Developer → Server Settings → Enable CORS, then restart the server.",
      ],
    };
  }

  // Check for CORS or Network error
  if (
    msg.includes("failed to fetch") ||
    msg.includes("cors") ||
    msg.includes("networkerror") ||
    msg.includes("load failed")
  ) {
    if (baseUrl.includes(":1234")) {
      return {
        category: "cors-blocked",
        title: "LM Studio Offline or CORS Not Enabled",
        description:
          "LM Studio is either not running on port 1234 or CORS headers are disabled.",
        fixCommand: "lms server start --cors",
        instructions: [
          "In LM Studio: Navigate to Developer / Local Server tab.",
          'Toggle "Enable CORS" to ON.',
          "Or start via terminal: lms server start --cors",
          "Ensure a model is loaded into memory.",
        ],
      };
    }
    if (baseUrl.includes(":11434")) {
      return {
        category: "cors-blocked",
        title: "Ollama Offline or CORS Origins Restricted",
        description:
          "Ollama is either offline or rejecting requests from this web origin.",
        fixCommand: 'OLLAMA_ORIGINS="*" ollama serve',
        instructions: [
          'Start Ollama with cross-origin access enabled: OLLAMA_ORIGINS="*" ollama serve',
          'On macOS: launchctl setenv OLLAMA_ORIGINS "*"',
          "Verify Ollama is reachable at http://localhost:11434",
        ],
      };
    }
    return {
      category: "server-offline",
      title: "Local Inference Server Unreachable",
      description: `Could not connect to ${baseUrl}. Verify the server is running and accessible.`,
      instructions: [
        `Check if ${baseUrl} responds to GET /v1/models in your browser.`,
        "Ensure the host machine firewall allows connections on this port.",
      ],
    };
  }

  if (
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("unauthorized")
  ) {
    return {
      category: "invalid-auth",
      title: "Authentication Required",
      description:
        "The local server rejected the request due to missing or invalid Bearer token.",
      instructions: [
        "Enter your configured API Key / Bearer token in the Server Settings.",
      ],
    };
  }

  if (msg.includes("abort") || msg.includes("timeout")) {
    return {
      category: "timeout",
      title: "Connection Timed Out",
      description: `Server at ${baseUrl} took longer than 12 seconds to respond.`,
      instructions: [
        "Check if the server is under heavy GPU load or generating another request.",
        "Restart the local inference process if it is unresponsive.",
      ],
    };
  }

  return {
    category: "generic",
    title: "Local Server Error",
    description:
      err?.message ||
      "An unexpected error occurred while communicating with the local server.",
    instructions: [
      "Inspect the server terminal / console for traceback information.",
    ],
  };
}

export interface StreamChatCompletionOptions {
  maxTokens?: number;
  temperature?: number;
  baseUrl: string;
  apiKey?: string;
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  style?: "default" | "academic" | "creative";
  signal?: AbortSignal;
  onModelPhase?: (phase: "thinking" | "writing" | "retrying") => void;
  onChunk?: (chunk: string, fullCleanedText: string) => void;
  onTelemetry?: (telemetry: StreamTelemetry) => void;
}

const SYSTEM_ROLE_ERROR =
  /(?:system (?:messages?|roles?)|role .{0,8}system).{0,40}(?:unsupported|not supported|not allowed|not permitted)|(?:unsupported|does not support|doesn't support).{0,35}(?:system (?:messages?|roles?)|role .{0,8}system)|(?:roles|messages) must alternate|only user and assistant|unsupported role/i;
const OPTIONAL_PARAMETER_ERROR =
  /reasoning_effort|frequency_penalty|presence_penalty|(?:reasoning|thinking).{0,18}(?:unsupported|not supported)|(?:unsupported|invalid|unrecognized) (?:sampling|penalt)|(?:unknown|extra|unsupported) (?:parameters?|fields?)/i;

function localInferenceError(
  status: number,
  message: string,
  modelId: string,
): Error {
  if (
    /out of memory|not enough (?:system |gpu )?memory|insufficient (?:memory|vram)|requires more (?:system |gpu )?memory|failed to allocate|allocation failed|resource exhausted|(?:failed to load (?:the )?model|model (?:failed to load|loading (?:was )?aborted))/i.test(
      message,
    )
  )
    return new Error(
      modelId +
        " could not load. Close other loaded models, then try a shorter context or a smaller quantization in your local server. Server detail: " +
        message,
    );
  if (
    /context (?:length|window|size)|exceeds.{0,30}(?:context|n_ctx)|too many (?:input|prompt) tokens|keep.{0,25}(?:context|n_ctx)/i.test(
      message,
    )
  )
    return new RewriteOutputLimitError(
      "The loaded context window for " +
        modelId +
        " is too small for this request. Increase its context length in your local server or rewrite a shorter passage. Server detail: " +
        message,
    );
  if (
    status === 404 ||
    /model.{0,80}(?:not found|not loaded|does not exist|unavailable)|no models? loaded/i.test(
      message,
    )
  )
    return new Error(
      modelId +
        " is unavailable for rewriting. Check that the model is installed and ready on your local server. Server detail: " +
        message,
    );
  return new Error(
    "Inference failed for " + modelId + " (HTTP " + status + "): " + message,
  );
}

function localServerMessage(raw: string): string {
  try {
    const body = JSON.parse(raw);
    raw = body.error?.message ?? body.error ?? body.message ?? raw;
  } catch {
    // Some compatible servers send plain text on error.
  }
  return String(raw).trim().slice(0, 550) || "No detail was returned.";
}

/** Streams only the answer text from a local OpenAI-compatible server. */
export async function streamChatCompletion(
  options: StreamChatCompletionOptions,
): Promise<string> {
  const {
    baseUrl,
    apiKey,
    modelId,
    systemPrompt,
    userPrompt,
    style,
    signal,
    onModelPhase,
    maxTokens,
    temperature,
  } = options;
  const cleanBase = localApiBase(baseUrl);
  const url = cleanBase + "/chat/completions";
  const sampling = getSamplingParameters(modelId, style);
  const ollama = new URL(cleanBase).port === "11434";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream, application/json",
  };
  if (apiKey) headers.Authorization = "Bearer " + apiKey;

  const body = {
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: temperature ?? sampling.temperature,
    top_p: sampling.top_p,
    max_tokens: maxTokens ?? sampling.max_tokens,
    stream: true,
  };
  let optional: Record<string, string | number> = {
    frequency_penalty: sampling.frequency_penalty,
    presence_penalty: sampling.presence_penalty,
    // Some Ollama templates emit a thinking prefix even with thinking disabled.
    // Leave the server's reasoning parser enabled so that trace stays separate.
    ...(ollama && /(?:^|\/)gpt-oss(?:[:/-]|$)/i.test(modelId)
      ? { reasoning_effort: "low" }
      : {}),
  };
  let folded = false;
  async function requestCompletion(): Promise<Response> {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, ...optional }),
      signal,
    });
    if (res.ok) return res;
    const message = localServerMessage(await res.text());
    if (res.status === 400 || res.status === 422) {
      if (!folded && SYSTEM_ROLE_ERROR.test(message)) {
        folded = true;
        body.messages = [
          {
            role: "user",
            content:
              "[System Instructions:\n" +
              systemPrompt +
              "]\n\n[Task:\n" +
              userPrompt +
              "]",
          },
        ];
        return requestCompletion();
      }
      if (
        Object.keys(optional).length &&
        OPTIONAL_PARAMETER_ERROR.test(message)
      ) {
        optional = {};
        return requestCompletion();
      }
    }
    throw localInferenceError(res.status, message, modelId);
  }

  const startedAt = performance.now();
  let result = await readLocalCompletion(
    await requestCompletion(),
    options,
    startedAt,
  );
  if (!result.text && result.reasoned && result.truncated) {
    onModelPhase?.("retrying");
    body.max_tokens = Math.max(sampling.max_tokens, body.max_tokens * 2);
    result = await readLocalCompletion(
      await requestCompletion(),
      options,
      startedAt,
    );
  }
  if (!result.text && result.reasoned)
    throw new Error(
      modelId +
        " finished without returning a draft after reasoning. Turn off thinking in your local server if the model supports it, or select an instruction model.",
    );
  if (result.truncated) throw new RewriteOutputLimitError();
  return result.text;
}

function isReasoning(message?: {
  reasoning_content?: unknown;
  reasoning?: unknown;
  thinking?: unknown;
}): boolean {
  return Boolean(
    message?.reasoning_content || message?.reasoning || message?.thinking,
  );
}
const INLINE_REASONING = /^\s*<(?:think|thought|reasoning|\|thought\|)>/i;

async function readLocalCompletion(
  res: Response,
  { modelId, onChunk, onTelemetry, onModelPhase }: StreamChatCompletionOptions,
  startTime: number,
): Promise<{ text: string; reasoned: boolean; truncated: boolean }> {
  if (res.headers?.get("content-type")?.includes("application/json")) {
    const payload = await res.json();
    if (payload.error)
      throw localInferenceError(
        res.status,
        localServerMessage(JSON.stringify(payload)),
        modelId,
      );
    const choice = payload.choices?.[0];
    if (!choice?.message)
      throw new Error(modelId + " returned an unexpected completion response.");
    checkFinishReason(choice.finish_reason);
    const answer = extractDeltaContent(choice.message);
    return {
      text: cleanLlmOutput(answer),
      reasoned: isReasoning(choice.message) || INLINE_REASONING.test(answer),
      truncated: choice.finish_reason === "length",
    };
  }
  if (!res.body) {
    throw new Error("Response body is null, cannot stream SSE.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let accumulatedRaw = "";
  let tokenCount = 0;
  let firstTokenTime: number | null = null;
  let buffer = "";

  let completed = false;
  let truncated = false;
  let reasoned = false;
  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") {
      completed = true;
      return;
    }
    const parsed = JSON.parse(payload);
    if (parsed.error)
      throw localInferenceError(
        res.status,
        localServerMessage(payload),
        modelId,
      );
    const choice = parsed.choices?.[0];
    const finishReason = choice?.finish_reason;
    checkFinishReason(finishReason);
    truncated ||= finishReason === "length";
    completed ||= finishReason === "length" || finishReason === "stop";
    const delta = choice?.delta;
    const content = extractDeltaContent(delta);
    accumulatedRaw += content;
    if (
      !reasoned &&
      (isReasoning(delta) || INLINE_REASONING.test(accumulatedRaw))
    ) {
      reasoned = true;
      if (firstTokenTime === null) onModelPhase?.("thinking");
    }
    if (!content) return;
    const cleaned = cleanLlmOutput(accumulatedRaw);
    if (!cleaned) return;
    tokenCount++;
    if (firstTokenTime === null) {
      firstTokenTime = performance.now();
      onModelPhase?.("writing");
    }
    onChunk?.(content, cleaned);
    const now = performance.now(),
      elapsedMs = Math.round(now - startTime),
      activeGenSec = (now - firstTokenTime) / 1000;
    onTelemetry?.({
      ttftMs: Math.round(firstTokenTime - startTime),
      tokensPerSec:
        activeGenSec > 0
          ? Math.round((tokenCount / activeGenSec) * 10) / 10
          : 0,
      totalTokens: tokenCount,
      elapsedMs,
    });
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        processLine(line);
        if (completed) break;
      }
      if (completed) break;
    }
    buffer += decoder.decode();
    if (!completed && buffer.trim()) processLine(buffer);
    if (!completed)
      throw new Error(
        "The connection ended before the model completed. The draft is incomplete.",
      );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  return { text: cleanLlmOutput(accumulatedRaw), reasoned, truncated };
}

function checkFinishReason(reason?: string): void {
  if (reason && reason !== "length" && reason !== "stop")
    throw new Error(
      `The model stopped without completing the draft (${reason}).`,
    );
}
