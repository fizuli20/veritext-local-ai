import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  classifyModelFamily,
  getSamplingParameters,
  discoverLocalModels,
  classifyLocalServerError,
  streamChatCompletion,
} from "../src/lib/humanizer/local-server-client";
import {
  cleanLlmOutput,
  extractDeltaContent,
} from "../src/lib/humanizer/output-cleaner";

describe("Output Cleaner & Thinking Stripper", () => {
  it("strips <think> and <thought> tags completely", () => {
    const raw = `<think>
I need to rewrite this sentence to sound more natural and vary the clause structure.
Let's eliminate the cliché "pivotal role".
</think>
Artificial intelligence fundamentally transforms classroom learning without repetitive buzzwords.`;

    const cleaned = cleanLlmOutput(raw);
    expect(cleaned).toBe(
      "Artificial intelligence fundamentally transforms classroom learning without repetitive buzzwords.",
    );
    expect(cleaned).not.toContain("<think>");
    expect(cleaned).not.toContain("pivotal role");
  });

  it("strips <thought> and <|thought|> tags", () => {
    const raw = `<thought>Internal reasoning here.</thought>Here is the revised draft: The students gathered early in the auditorium.`;
    const cleaned = cleanLlmOutput(raw);
    expect(cleaned).toBe("The students gathered early in the auditorium.");
  });

  it("strips conversational preambles and postambles", () => {
    const raw = `Here is a humanized version of the text:
We analyzed the quarterly metrics and noted a steady upward trend across all regions.

Hope this helps! Let me know if you need any adjustments.`;

    const cleaned = cleanLlmOutput(raw);
    expect(cleaned).toBe(
      "We analyzed the quarterly metrics and noted a steady upward trend across all regions.",
    );
  });

  it("extractDeltaContent skips reasoning deltas and extracts content", () => {
    expect(extractDeltaContent({ reasoning_content: "Let me think..." })).toBe(
      "",
    );
    expect(extractDeltaContent({ reasoning: "Thinking..." })).toBe("");
    expect(extractDeltaContent({ content: "Hello world" })).toBe("Hello world");
    expect(extractDeltaContent(null)).toBe("");
  });
});

describe("Local Server Client", () => {
  it("classifies model families accurately", () => {
    expect(classifyModelFamily("google/gemma-4-12b")).toBe("gemma");
    expect(classifyModelFamily("qwen2.5-14b-instruct")).toBe("qwen");
    expect(classifyModelFamily("mistral-nemo-12b")).toBe("mistral");
    expect(classifyModelFamily("muse-glimmer-30b")).toBe("muse");
    expect(classifyModelFamily("hemmingway-1.5")).toBe("hemmingway");
    expect(classifyModelFamily("meta-llama-3.1-8b")).toBe("llama");
    expect(classifyModelFamily("custom-finetune")).toBe("other");
  });

  it("applies Gemma Anti-Slop sampling presets for gemma models", () => {
    const gemmaParams = getSamplingParameters("gemma-2-9b-it");
    expect(gemmaParams.temperature).toBe(0.85);
    expect(gemmaParams.frequency_penalty).toBe(0.28);
    expect(gemmaParams.presence_penalty).toBe(0.22);

    const defaultParams = getSamplingParameters("qwen2.5-7b");
    expect(defaultParams.temperature).toBe(0.78);
    expect(defaultParams.frequency_penalty).toBe(0.18);
  });

  it("filters out embedding models during discovery", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "google/gemma-4-12b" },
          { id: "text-embedding-nomic-v1.5" },
          { id: "bge-large-en-v1.5" },
          { id: "all-MiniLM-L6-v2" },
          { id: "qwen2.5-7b-instruct" },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await discoverLocalModels("http://localhost:1234/v1");
    expect(res.models).toHaveLength(2);
    expect(res.models[0]?.id).toBe("google/gemma-4-12b");
    expect(res.models[0]?.family).toBe("gemma");
    expect(res.models[1]?.id).toBe("qwen2.5-7b-instruct");
    expect(res.rawCount).toBe(5);

    vi.unstubAllGlobals();
  });

  it("classifies CORS and server offline errors accurately", () => {
    const corsErr = classifyLocalServerError(
      new Error("Failed to fetch"),
      "http://localhost:1234/v1",
    );
    expect(corsErr.category).toBe("cors-blocked");
    expect(corsErr.fixCommand).toBe("lms server start --cors");

    const ollamaErr = classifyLocalServerError(
      new Error("Failed to fetch"),
      "http://localhost:11434/v1",
    );
    expect(ollamaErr.category).toBe("cors-blocked");
    expect(ollamaErr.fixCommand).toBe('OLLAMA_ORIGINS="*" ollama serve');
  });

  it("retries with folded system instructions on Gemma HTTP 400 error", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation((url, opts) => {
      callCount++;
      const body = JSON.parse(opts.body);
      if (callCount === 1) {
        // First call fails with Gemma system role error
        expect(body.messages[0].role).toBe("system");
        return Promise.resolve({
          status: 400,
          ok: false,
          text: async () => "System role not supported in this model template",
        });
      }
      // Second call must have folded prompt into user role
      expect(body.messages[0].role).toBe("user");
      expect(body.messages[0].content).toContain("[System Instructions:");
      expect(body.messages[0].content).toContain("Anti-AI Rewriter");

      // Return simulated SSE stream
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Rewritten "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"prose."}}]}\n\n',
        "data: [DONE]\n\n",
      ];
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of sseChunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        },
      });

      return Promise.resolve({
        status: 200,
        ok: true,
        body: stream,
      });
    });

    vi.stubGlobal("fetch", mockFetch);

    let collectedText = "";
    const result = await streamChatCompletion({
      baseUrl: "http://localhost:1234/v1",
      modelId: "google/gemma-4-12b",
      systemPrompt: "Anti-AI Rewriter",
      userPrompt: "Transform this text.",
      onChunk: (chunk, full) => {
        collectedText = full;
      },
    });

    expect(callCount).toBe(2);
    expect(result).toBe("Rewritten prose.");
    expect(collectedText).toBe("Rewritten prose.");

    vi.unstubAllGlobals();
  });
});

describe("stream completion integrity", () => {
  const run = async (body: string) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(body, {
            headers: { "content-type": "text/event-stream" },
          }),
        ),
    );
    try {
      return await streamChatCompletion({
        baseUrl: "http://localhost:1234/v1",
        modelId: "fixture",
        systemPrompt: "Copy edit",
        userPrompt: "Text",
        onChunk: () => {},
      });
    } finally {
      vi.unstubAllGlobals();
    }
  };
  it("processes the last SSE line without a newline", async () => {
    expect(
      await run(
        'data: {"choices":[{"delta":{"content":"Edited."}}]}\n\ndata: [DONE]',
      ),
    ).toBe("Edited.");
  });
  it("rejects disconnected, malformed, errored and length-limited streams", async () => {
    await expect(
      run('data: {"choices":[{"delta":{"content":"Partial"}}]}'),
    ).rejects.toThrow("incomplete");
    await expect(run("data: {bad}\n\n")).rejects.toThrow();
    await expect(
      run('data: {"error":{"message":"Model unavailable"}}\n\n'),
    ).rejects.toThrow("Model unavailable");
    await expect(
      run(
        'data: {"choices":[{"finish_reason":"length","delta":{"content":"Cut off"}}]}\n\ndata: [DONE]',
      ),
    ).rejects.toThrow("output limit");
  });
  it("withholds unfinished reasoning and preserves content beside a reasoning delta", () => {
    expect(cleanLlmOutput("<think>private unfinished reasoning")).toBe("");
    expect(cleanLlmOutput("<thought>private</thought>Public draft.")).toBe(
      "Public draft.",
    );
    expect(
      extractDeltaContent({ reasoning: "private", content: "public" }),
    ).toBe("public");
  });
});
