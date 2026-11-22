"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WebWorkerMLCEngine } from "@mlc-ai/web-llm";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Loader2,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { countWords } from "@/lib/nlp/tokenizer";
import {
  DETECTOR_PROFILES,
  type DetectorTier,
  describeEvidence,
  type DetectionEvidence,
} from "@/lib/detector/evidence";
import {
  discoverLocalModels,
  streamChatCompletion,
  type DiscoveredModel,
} from "@/lib/humanizer/local-server-client";
import { cleanLlmOutput } from "@/lib/humanizer/output-cleaner";
import {
  reviewRewrite,
  REWRITE_DEPTHS,
  type RewriteDepth,
} from "@/lib/humanizer/rewrite-review";
import {
  runRewritePipeline,
  type RewriteOutcome,
} from "@/lib/humanizer/rewrite-pipeline";
import { WRITING_MODELS, type WritingModelTier } from "@/lib/ml/writing-models";
import { computeWordDiff } from "@/lib/nlp/diff";

interface Scan {
  text: string;
  evidence: DetectionEvidence;
  engine: string;
  latencyMs: number;
  loadingMs?: number;
  model?: string;
  revision?: string;
  tier?: DetectorTier;
  contextLimit?: number | null;
  sentences: {
    start: number;
    end: number;
    text: string;
    score: number | null;
  }[];
}
const sample =
  "A neighborhood library can do more than lend books. It gives people a place to study, meet neighbors, and learn skills they might not otherwise have the chance to practice. Evening classes can help adults use online services, while quiet rooms give students somewhere to work when home is crowded. These benefits depend on practical choices. Opening hours need to match the lives of local residents, and staff need time to answer questions rather than spend every shift sorting returns. A larger building will not solve those problems on its own. Before expanding, library managers should ask visitors what they use, listen to people who never come through the door, and check whether existing services reach the people they were designed for. A small change to the timetable may help more readers than an expensive renovation. The useful measure is whether the library makes everyday life easier for the community it serves.";

export function Workspace() {
  const [detectorTier, setDetectorTier] = useState<DetectorTier>("detailed");
  const [tab, setTab] = useState<"detector" | "humanizer">("humanizer");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [source, setSource] = useState("");
  const [depth, setDepth] = useState<RewriteDepth>("rephrase");
  const [mode, setMode] = useState("standard");
  const [outputDepth, setOutputDepth] = useState<RewriteDepth>("rephrase");
  const [outputMode, setOutputMode] = useState("standard");
  const [writingTier, setWritingTier] = useState<WritingModelTier>("balanced");
  const [lockedTerms, setLockedTerms] = useState("");
  const [rewriteReport, setRewriteReport] = useState<RewriteOutcome | null>(
    null,
  );
  const [previousDraft, setPreviousDraft] = useState<{
    source: string;
    output: string;
    engine: string;
    mode: string;
    depth: RewriteDepth;
  } | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [busy, setBusy] = useState<"scan" | "rewrite" | "load" | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [engineName, setEngineName] = useState("");
  const [settings, setSettings] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [pendingRewrite, setPendingRewrite] = useState(false);
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234/v1");
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [connectedUrl, setConnectedUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [browserName, setBrowserName] = useState("");
  const [useLocal, setUseLocal] = useState(true);
  const [diff, setDiff] = useState(false);
  const [copied, setCopied] = useState(false);
  const detector = useRef<Worker | null>(null);
  const browserEngine = useRef<WebWorkerMLCEngine | null>(null);
  const browserWorker = useRef<Worker | null>(null);
  const abort = useRef<AbortController | null>(null);
  const operation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeName =
    useLocal && modelId && connectedUrl
      ? `Local model · ${modelId}`
      : browserName
        ? `Browser · ${browserName}`
        : "";
  const issues = useMemo(
    () =>
      output && source
        ? reviewRewrite(source, output, outputMode, lockedTerms.split(","))
        : [],
    [source, output, outputMode, lockedTerms],
  );
  const changes = useMemo(
    () =>
      diff && output && output.length <= 12000
        ? computeWordDiff(source, output)
        : [],
    [diff, source, output],
  );

  useEffect(() => {
    // Retire the old cache-first shell so deployed fixes cannot be hidden by it.
    navigator.serviceWorker
      ?.getRegistrations()
      .then((regs) =>
        regs.forEach((reg) => {
          if (reg.active?.scriptURL === `${location.origin}/sw.js`)
            void reg.unregister();
        }),
      )
      .catch(() => {});
    return () => {
      detector.current?.terminate();
      browserWorker.current?.terminate();
      abort.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function stop() {
    setPendingRewrite(false);
    operation.current++;
    abort.current?.abort();
    browserEngine.current?.interruptGenerate();
    if (busy === "scan") {
      detector.current?.terminate();
      detector.current = null;
    }
    if (timer.current) clearTimeout(timer.current);
    setBusy(null);
    setProgress("");
    setNotice("Stopped. Any partial rewrite is an unfinished draft.");
  }
  function editInput(value: string) {
    setPendingRewrite(false);
    setInput(value);
    setScan(null);
    setError("");
    setNotice(
      output && value !== source
        ? "Source text changed. The edited draft belongs to your previous source. Run Rewrite to create a new draft."
        : "",
    );
  }
  async function paste() {
    try {
      editInput(await navigator.clipboard.readText());
    } catch {
      setError(
        "Clipboard access is unavailable. Paste directly into the editor.",
      );
    }
  }
  async function importFile(file: File) {
    if (busy || importing) return;
    setImporting(true);
    setError("");
    setNotice("");
    const request = ++operation.current;
    try {
      const { importTextFile } = await import("@/lib/io/import-text");
      const text = await importTextFile(
        file,
        tab === "humanizer" ? 12000 : 20000,
      );
      if (operation.current !== request) return;
      editInput(text);
      setNotice(
        `Imported ${file.name} on this device. No document was uploaded.${output ? " The edited draft still belongs to your previous source; run Rewrite to update it." : ""}`,
      );
    } catch (error) {
      if (operation.current === request)
        setError(
          error instanceof Error
            ? error.message
            : "Could not read that document.",
        );
    } finally {
      setImporting(false);
    }
  }
  function saveScan() {
    if (!scan) return;
    const report = {
      schema: "veritext.neural-scan.v1",
      exportedAt: new Date().toISOString(),
      text: scan.text,
      evidence: scan.evidence,
      engine: scan.engine,
      model: scan.model ?? null,
      revision: scan.revision ?? null,
      profile: scan.tier ?? null,
      loadingMs: scan.loadingMs ?? 0,
      contextLimit: scan.contextLimit ?? null,
      latencyMs: scan.latencyMs,
      contexts: scan.sentences,
      limitation:
        "Model signals are not proof of authorship. Reference estimates describe historical data. Context scores are uncalibrated. This file contains the checked text.",
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "veritext-analysis.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  async function connect() {
    setConnecting(true);
    setError("");
    setModels([]);
    setModelId("");
    setConnectedUrl("");
    try {
      const url = new URL(baseUrl);
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("Use a local server on localhost or 127.0.0.1.");
      const result = await discoverLocalModels(baseUrl);
      if (result.error) throw new Error(result.error);
      if (!result.models.length)
        throw new Error(
          "No writing model is loaded. Load a chat model in LM Studio or Ollama first.",
        );
      setModels(result.models);
      setModelId(result.models[0]!.id);
      setConnectedUrl(baseUrl);
      setUseLocal(true);
      setNotice(
        "Local model connected. Your text is sent only to this selected local server when you rewrite.",
      );
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : err} In LM Studio, open Developer → Server Settings → Enable CORS, then start the server. Allow local network access if your browser asks. You can also run Veritext locally.`,
      );
    } finally {
      setConnecting(false);
    }
  }
  async function loadBrowser() {
    if (browserName === WRITING_MODELS[writingTier].id) {
      setUseLocal(false);
      setSettings(false);
      return;
    }
    const id = ++operation.current;
    const controller = new AbortController();
    abort.current = controller;
    setBusy("load");
    setError("");
    setProgress("Checking WebGPU…");
    if (browserEngine.current) {
      await browserEngine.current.unload().catch(() => {});
      browserWorker.current?.terminate();
      browserWorker.current = null;
      browserEngine.current = null;
      setBrowserName("");
    }
    try {
      const { loadBrowserRewriter } = await import("@/lib/ml/browser-rewriter");
      const loaded = await loadBrowserRewriter(
        (text) => {
          if (operation.current === id) setProgress(text);
        },
        controller.signal,
        writingTier,
      );
      if (operation.current !== id) {
        loaded.worker.terminate();
        return;
      }
      browserEngine.current = loaded.engine;
      browserWorker.current = loaded.worker;
      setBrowserName(loaded.modelId);
      setUseLocal(false);
      setSettings(false);
      setNotice("Browser writing model is ready.");
    } catch (err) {
      if (operation.current === id)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (operation.current === id) {
        setBusy(null);
        setProgress("");
      }
    }
  }
  async function detect(includeContexts = false, text = input) {
    const eligibility = describeEvidence(text, null);
    setError("");
    setNotice("");
    if (
      eligibility.status === "insufficient-text" ||
      eligibility.status === "unsupported-language"
    ) {
      setScan({
        text,
        evidence: eligibility,
        engine: "Input check",
        latencyMs: 0,
        sentences: [],
      });
      return;
    }
    if (text.length > 20000) {
      setError("Use at most 20,000 characters per scan.");
      return;
    }
    const id = String(++operation.current);
    setBusy("scan");
    setProgress(
      `Loading neural detector (about ${DETECTOR_PROFILES[detectorTier].downloadMB} MB on first use)…`,
    );
    setScan(null);
    try {
      if (!detector.current) {
        const worker = new Worker(
          new URL("../workers/detector.worker.ts", import.meta.url),
          { type: "module" },
        );
        detector.current = worker;
      }
      const worker = detector.current;
      const fail = (message: string) => {
        if (String(operation.current) !== id) return;
        if (timer.current) clearTimeout(timer.current);
        worker.terminate();
        detector.current = null;
        setError(message);
        setBusy(null);
        setProgress("");
      };
      timer.current = setTimeout(
        () =>
          fail(
            "Detector timed out after 3 minutes. Check your connection and retry. No fallback score was substituted.",
          ),
        180000,
      );
      worker.onerror = (event) =>
        fail(
          `The detector could not run: ${event.message}. Retry or use a different browser.`,
        );
      worker.onmessage = ({ data }) => {
        if (String(operation.current) !== id) return;
        if (data.type === "progress" && data.progress.status === "progress") {
          const p = data.progress;
          setProgress(
            `Loading ${p.file}: ${Math.round((p.loaded ?? 0) / 1048576)} MB${p.progress ? ` · ${Math.round(p.progress)}%` : ""}`,
          );
        }
        if (data.type === "phase" && data.id === id) setProgress(data.message);
        if (data.type === "analysis-progress" && data.id === id)
          setProgress(`Checking context ${data.completed} of ${data.total}…`);
        if (data.type === "error")
          fail(
            `Neural detector unavailable: ${data.error}. No fallback score was substituted.`,
          );
        if (data.type === "result" && data.id === id) {
          if (timer.current) clearTimeout(timer.current);
          setScan(data);
          setBusy(null);
          setProgress("");
        }
      };
      worker.postMessage({
        type: "detect",
        text,
        id,
        includeContexts,
        tier: detectorTier,
      });
    } catch (err) {
      setError(String(err));
      setBusy(null);
    }
  }
  const rewrite = useCallback(async () => {
    setError("");
    setNotice("");
    if (!activeName) {
      setPendingRewrite(true);
      setSettings(true);
      setNotice(
        "Choose a writing model. Your rewrite will start when it is ready.",
      );
      return;
    }
    if (input.length > 12000) {
      setError(
        "Rewrite up to 12,000 characters at a time. Longer text is split into sections to fit the writing model.",
      );
      return;
    }
    const id = ++operation.current;
    const original = input;
    if (output)
      setPreviousDraft({
        source,
        output,
        engine: engineName,
        mode: outputMode,
        depth: outputDepth,
      });
    setSource(original);
    setOutputMode(mode);
    setOutputDepth(depth);
    setRewriteReport(null);
    setOutput("");
    setDiff(false);
    setBusy("rewrite");
    setEngineName(activeName);
    setProgress("Writing a draft…");
    const controller = new AbortController();
    abort.current = controller;
    timer.current = setTimeout(() => {
      if (operation.current === id) {
        controller.abort();
        browserEngine.current?.interruptGenerate();
      }
    }, 600000);
    try {
      const result = await runRewritePipeline({
        text: original,
        mode,
        depth,
        terms: lockedTerms
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        signal: controller.signal,
        onProgress: (message) => {
          if (operation.current === id) setProgress(message);
        },
        onText: (text) => {
          if (operation.current === id) setOutput(text);
        },
        generate: async ({ systemPrompt, userPrompt, onText, attempt }) => {
          if (useLocal && modelId && connectedUrl)
            return streamChatCompletion({
              baseUrl: connectedUrl,
              modelId,
              systemPrompt,
              userPrompt,
              signal: controller.signal,
              style: mode === "academic" ? "academic" : "default",
              onChunk: (_, text) => onText(text),
            });
          if (!browserEngine.current)
            throw new Error("Load a writing model before rewriting.");
          const stream = await browserEngine.current.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            stream: true,
            temperature: attempt ? 0.65 : 0.5,
            max_tokens: 1800,
          });
          let draft = "",
            truncated = false;
          for await (const chunk of stream) {
            if (controller.signal.aborted || operation.current !== id)
              throw new Error("Generation stopped.");
            if (chunk.choices[0]?.finish_reason === "length") truncated = true;
            draft += chunk.choices[0]?.delta.content ?? "";
            onText(cleanLlmOutput(draft));
          }
          if (truncated)
            throw new Error(
              "The model reached its output limit. The draft is incomplete. Try a shorter source section.",
            );
          return cleanLlmOutput(draft);
        },
      });
      if (operation.current !== id) return;
      setOutput(result.text);
      setRewriteReport(result);
      setNotice(
        result.changed
          ? `Draft ready. ${result.parts} section${result.parts === 1 ? "" : "s"} checked${result.retained ? `; ${result.retained} retained unchanged` : ""}. Review the changes before using the text.`
          : "The model did not produce a changed draft that passed preservation checks after a retry. The original was retained. Try a larger model or another tone.",
      );
    } catch (err) {
      if (operation.current === id)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (operation.current === id) {
        if (timer.current) clearTimeout(timer.current);
        setBusy(null);
        setProgress("");
      }
    }
  }, [
    activeName,
    input,
    output,
    source,
    engineName,
    outputMode,
    outputDepth,
    mode,
    lockedTerms,
    depth,
    useLocal,
    modelId,
    connectedUrl,
  ]);
  // Resume the user's requested rewrite after either engine finishes setup.
  // No automatic downloads: loading still requires the explicit setup action.
  useEffect(() => {
    if (pendingRewrite && activeName && !busy && !connecting) {
      setPendingRewrite(false);
      setSettings(false);
      void rewrite();
    }
  }, [pendingRewrite, activeName, busy, connecting, rewrite]);

  function exportText() {
    const url = URL.createObjectURL(
      new Blob([output], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "veritext-edited-draft.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Select and copy the output directly.");
    }
  }
  const controlClass = "vt-secondary";
  return (
    <div className="vt-app">
      <header className="vt-header">
        <Link href="/" className="vt-brand">
          <span className="vt-logo">v</span>veritext
          <span className="vt-beta">LOCAL AI</span>
        </Link>
        <nav aria-label="Writing tools" className="vt-tabs">
          <button
            aria-pressed={tab === "detector"}
            onClick={() => {
              if (!busy && !importing) setTab("detector");
            }}
          >
            AI Detector
          </button>
          <button
            aria-pressed={tab === "humanizer"}
            onClick={() => {
              if (!busy && !importing) setTab("humanizer");
            }}
          >
            AI Humanizer
          </button>
        </nav>
        <button className="vt-engine" onClick={() => setSettings(true)}>
          <span className={activeName ? "vt-dot ready" : "vt-dot"} />
          <span>{activeName ? "Model ready" : "Set up AI"}</span>
          <Settings2 size={15} />
        </button>
      </header>
      <main className="vt-main">
        <div className="vt-intro">
          <p className="vt-eyebrow">YOUR WORDS. A LITTLE CLEARER.</p>
          <h1>
            {tab === "humanizer"
              ? "Good writing, in your own voice."
              : "A closer look at your text."}
          </h1>
          <p>
            {tab === "humanizer"
              ? "Refine a draft without losing what you meant. Private, local, and free of API keys."
              : "Explore AI-like patterns with an open model. A signal to consider, never proof of authorship."}
          </p>
        </div>
        {error && (
          <div role="alert" className="vt-message vt-error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="vt-message">
            {notice}
          </div>
        )}
        <section
          className="vt-studio"
          aria-label={tab === "humanizer" ? "Rewrite editor" : "Text detector"}
        >
          <div className="vt-toolbar">
            {tab === "humanizer" ? (
              <div className="vt-modes" aria-label="Rewrite tone">
                {[
                  ["standard", "Standard"],
                  ["academic", "Academic"],
                  ["casual", "Casual"],
                  ["professional", "Professional"],
                  ["concise", "Shorten"],
                  ["expand", "Expand"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    disabled={!!busy}
                    aria-pressed={mode === id}
                    onClick={() => setMode(id!)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="vt-tool-label">
                <ShieldCheck size={17} /> English prose · 80+ words
              </span>
            )}
            <span className="vt-protection">
              {tab === "humanizer"
                ? "Facts & quotations checked after rewriting"
                : "Neural analysis · runs in your browser"}
            </span>
          </div>
          {tab === "humanizer" && (
            <div
              className="vt-lock-toolbar"
              role="group"
              aria-label="Rewrite depth"
            >
              <span>Rewrite depth</span>
              {Object.entries(REWRITE_DEPTHS).map(([id, choice]) => (
                <button
                  key={id}
                  className="vt-secondary"
                  disabled={!!busy}
                  aria-pressed={depth === id}
                  onClick={() => setDepth(id as RewriteDepth)}
                >
                  {choice.label}
                </button>
              ))}
              <span>{REWRITE_DEPTHS[depth].description}</span>
            </div>
          )}
          {tab === "humanizer" && (
            <div className="vt-lock-toolbar">
              <label htmlFor="locked-terms">
                Keep these names or terms exactly
              </label>
              <input
                id="locked-terms"
                disabled={!!busy}
                maxLength={1000}
                value={lockedTerms}
                onChange={(e) => setLockedTerms(e.target.value)}
                placeholder="Optional: Ana, Project Atlas (comma-separated)"
              />
              <span>
                Numbers, quotes, links and citations are protected
                automatically.
              </span>
            </div>
          )}
          <div
            className={`vt-editors ${tab === "detector" ? "vt-detector-editors" : ""}`}
          >
            <div className="vt-pane">
              <div className="vt-pane-heading">
                <label htmlFor="source-text">
                  {tab === "humanizer" ? "Original text" : "Text to check"}
                </label>
                <div>
                  <input
                    ref={fileInput}
                    hidden
                    type="file"
                    aria-label="Import document"
                    accept=".txt,.md,.docx,.pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void importFile(file);
                    }}
                  />
                  <button
                    className="vt-text-button"
                    disabled={!!busy || importing}
                    onClick={() => fileInput.current?.click()}
                  >
                    {importing ? "Reading…" : "Upload file"}
                  </button>
                  <button
                    className="vt-text-button"
                    disabled={!!busy}
                    onClick={paste}
                  >
                    Paste
                  </button>
                  <button
                    className="vt-text-button"
                    disabled={!!busy}
                    onClick={() => editInput("")}
                  >
                    Clear
                  </button>
                </div>
              </div>
              {tab === "detector" && (
                <div style={{ padding: "0 20px 12px" }}>
                  <label htmlFor="detector-model">Detection model</label>{" "}
                  <select
                    id="detector-model"
                    disabled={!!busy}
                    value={detectorTier}
                    onChange={(event) => {
                      setDetectorTier(event.target.value as DetectorTier);
                      setScan(null);
                    }}
                  >
                    {Object.entries(DETECTOR_PROFILES).map(
                      ([tier, profile]) => (
                        <option key={tier} value={tier}>
                          {profile.label}
                        </option>
                      ),
                    )}
                  </select>
                  <p className="vt-small">
                    Detailed uses more memory and time. Choose Light on a
                    limited device. Neither model proves authorship.
                  </p>
                </div>
              )}
              <textarea
                id="source-text"
                aria-label="Original text"
                value={input}
                disabled={!!busy || importing}
                onChange={(e) => editInput(e.target.value)}
                maxLength={20000}
                placeholder={
                  tab === "humanizer"
                    ? "Paste your draft here. Keep the ideas. Find the right words."
                    : "Paste at least 80 words of English text to explore its writing patterns."
                }
              />
              <div className="vt-pane-footer">
                <span>
                  {countWords(input)} words{" "}
                  <span className="vt-count-detail">
                    · {input.length.toLocaleString()} characters
                  </span>
                </span>
                {busy ? (
                  <button className="vt-primary" onClick={stop}>
                    Stop
                  </button>
                ) : (
                  <button
                    className="vt-primary"
                    disabled={!input.trim() || importing}
                    onClick={tab === "humanizer" ? rewrite : () => detect()}
                  >
                    {tab === "humanizer" ? (
                      <>
                        <Sparkles size={16} /> Rewrite
                      </>
                    ) : (
                      <>
                        Detect text <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            <div className="vt-pane vt-output">
              <div className="vt-pane-heading">
                <span>{tab === "humanizer" ? "Edited draft" : "Analysis"}</span>
                {tab === "humanizer" && output && (
                  <button
                    className="vt-text-button"
                    onClick={() => {
                      if (output.length > 12000) {
                        setError("Use a shorter draft to compare changes.");
                        return;
                      }
                      setDiff(!diff);
                    }}
                  >
                    {diff ? "Edit draft" : "Show changes"}
                  </button>
                )}
              </div>
              {busy && (
                <div role="status" className="vt-progress">
                  <Loader2 size={16} className="animate-spin" />
                  {progress}
                </div>
              )}
              {tab === "humanizer" ? (
                output ? (
                  <>
                    {diff ? (
                      <div className="vt-diff" aria-label="Rewrite changes">
                        {changes.map((c, i) =>
                          c.type === "insert" ? (
                            <ins key={i}>{c.value}</ins>
                          ) : c.type === "delete" ? (
                            <del key={i}>{c.value}</del>
                          ) : (
                            <span key={i}>{c.value}</span>
                          ),
                        )}
                      </div>
                    ) : (
                      <textarea
                        aria-label="Edited draft"
                        value={output}
                        disabled={!!busy}
                        onChange={(e) => setOutput(e.target.value)}
                      />
                    )}
                    <p className="vt-provenance">
                      {engineName} · {REWRITE_DEPTHS[outputDepth].label}
                      {rewriteReport
                        ? ` · ${(rewriteReport.elapsedMs / 1000).toFixed(1)} s · ${rewriteReport.retries} retr${rewriteReport.retries === 1 ? "y" : "ies"}`
                        : ""}
                    </p>
                    {!busy && !!rewriteReport?.checks.length && (
                      <details className="vt-reference">
                        <summary>
                          Rewrite checks · {rewriteReport.checks.length} retry
                          reason{rewriteReport.checks.length === 1 ? "" : "s"}
                        </summary>
                        {rewriteReport.checks.map((check, i) => (
                          <p key={i}>
                            Section {check.section}, attempt {check.attempt}:{" "}
                            {check.reason}
                          </p>
                        ))}
                      </details>
                    )}
                    {!busy &&
                      rewriteReport?.warnings.map((warning) => (
                        <p
                          key={warning}
                          className="vt-review vt-review-warning"
                        >
                          {warning}
                        </p>
                      ))}
                    {!busy && (
                      <div
                        className={`vt-review ${issues.length ? "vt-review-warning" : ""}`}
                        data-testid="rewrite-review"
                      >
                        {issues.length ? (
                          <>
                            <strong>Review needed</strong>
                            <ul>
                              {issues.map((issue) => (
                                <li key={issue}>{issue}</li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          "No changes to tracked numbers, quotes, or protected spans found. This check cannot verify every claim or guarantee meaning."
                        )}
                      </div>
                    )}
                    <div className="vt-pane-footer">
                      <span>{countWords(output)} words</span>
                      <div className="vt-actions">
                        {previousDraft && (
                          <button
                            className="vt-secondary"
                            disabled={!!busy}
                            onClick={() => {
                              setOutput(previousDraft.output);
                              setSource(previousDraft.source);
                              setEngineName(previousDraft.engine);
                              setOutputMode(previousDraft.mode);
                              setOutputDepth(previousDraft.depth);
                              setPreviousDraft(null);
                              setRewriteReport(null);
                              setNotice("Previous draft restored.");
                            }}
                          >
                            Undo
                          </button>
                        )}
                        <button
                          className={controlClass}
                          disabled={!!busy}
                          onClick={exportText}
                        >
                          <Download size={15} /> Save
                        </button>
                        <button
                          className={controlClass}
                          disabled={!!busy}
                          onClick={() => {
                            editInput(output);
                            setTab("detector");
                            void detect(false, output);
                          }}
                        >
                          Check edited draft <ArrowRight size={15} />
                        </button>
                        <button
                          className={controlClass}
                          disabled={!!busy}
                          onClick={copy}
                        >
                          {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="vt-empty">
                    <div className="vt-empty-icon">
                      <Sparkles size={25} />
                    </div>
                    <h2>A thoughtful edit starts here.</h2>
                    <p>
                      {activeName
                        ? "Your writing model is ready. Add your draft and choose Rewrite."
                        : "Choose where your writing AI runs. Your draft stays on your device."}
                    </p>
                    {!activeName && (
                      <button
                        className="vt-secondary"
                        onClick={() => setSettings(true)}
                      >
                        Set up a free writing model <ArrowRight size={15} />
                      </button>
                    )}
                    <small>
                      Real model rewrites. Automatic fact protection. Your final
                      say.
                    </small>
                  </div>
                )
              ) : scan ? (
                <div className="vt-scan" data-testid="detector-result">
                  <p className="vt-eyebrow">{scan.engine}</p>
                  <h2>{scan.evidence.verdict}</h2>
                  {scan.evidence.referenceProbability !== undefined && (
                    <details className="vt-reference">
                      <summary>
                        Historical reference · limited transfer to newer AI
                      </summary>
                      <p>
                        HC3 reference estimate:{" "}
                        {Math.round(scan.evidence.referenceProbability * 100)}%
                        AI class
                      </p>
                      {scan.evidence.referenceBin && (
                        <p>
                          In the corresponding held-out score bin,{" "}
                          {scan.evidence.referenceBin.aiCount}/
                          {scan.evidence.referenceBin.count} examples were
                          labelled AI. 95% bin frequency interval:{" "}
                          {Math.round(scan.evidence.referenceBin.lower * 100)}–
                          {Math.round(scan.evidence.referenceBin.upper * 100)}
                          %. This interval describes that sample, not this
                          document.
                        </p>
                      )}
                    </details>
                  )}
                  {scan.evidence.modelScore !== null && (
                    <div className="vt-score">
                      {Math.round(scan.evidence.modelScore * 100)}
                      <span>/100 model signal</span>
                    </div>
                  )}
                  <p>{scan.evidence.explanation}</p>
                  <p className="vt-caution">
                    The raw model signal is not a probability of authorship.
                    This detector missed newer AI writing in our stress test.
                    Low scores cannot establish human authorship. Historical HC3
                    reference estimates are not reliable probabilities for
                    current writing.
                  </p>
                  {scan.evidence.modelScore !== null &&
                    scan.sentences.length === 0 && (
                      <button
                        className="vt-secondary"
                        disabled={!!busy}
                        onClick={() => detect(true)}
                      >
                        Inspect sentence contexts <ArrowRight size={15} />
                      </button>
                    )}
                  {scan.sentences.length > 0 && (
                    <>
                      <h3>Context highlights</h3>
                      <p className="vt-small">
                        Amber marks contexts with a model signal of 80/100 or
                        above. Sentence context scores are not calibrated
                        probabilities.
                      </p>
                      {scan.contextLimit && (
                        <p className="vt-small">
                          Only the first {scan.contextLimit} contexts were
                          scored to limit runtime. Remaining text is unscored.
                        </p>
                      )}
                      <div className="vt-highlights">
                        {scan.sentences.map((s, i) => (
                          <span key={i}>
                            <span>
                              {scan.text.slice(
                                i ? scan.sentences[i - 1]!.end : 0,
                                s.start,
                              )}
                            </span>
                            <mark
                              data-score={s.score}
                              style={{
                                background:
                                  s.score !== null && s.score >= 0.8
                                    ? "#fef08a"
                                    : "transparent",
                              }}
                              title={
                                s.score === null
                                  ? "Context not scored"
                                  : `Neighboring context signal: ${Math.round(s.score * 100)}/100`
                              }
                            >
                              {scan.text.slice(s.start, s.end)}
                            </mark>
                          </span>
                        ))}
                        {scan.text.slice(scan.sentences.at(-1)?.end ?? 0)}
                      </div>
                    </>
                  )}
                  {scan.evidence.modelScore !== null && (
                    <p className="vt-small">
                      {(scan.latencyMs / 1000).toFixed(1)} seconds
                      {scan.loadingMs && scan.loadingMs > 1000
                        ? " including model setup"
                        : ""}{" "}
                      · document
                      {scan.sentences.length ? " and contexts" : ""}
                    </p>
                  )}
                  <button className="vt-secondary" onClick={saveScan}>
                    Save analysis
                  </button>
                  <button
                    className="vt-secondary"
                    onClick={() => setTab("humanizer")}
                  >
                    Edit this text <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <div className="vt-empty">
                  <div className="vt-empty-icon">
                    <ShieldCheck size={26} />
                  </div>
                  <h2>Evidence, with room for uncertainty.</h2>
                  <p>
                    The first scan downloads the selected open model, about{" "}
                    {DETECTOR_PROFILES[detectorTier].downloadMB} MB. Later scans
                    reuse your browser cache when available.
                  </p>
                  <small>
                    Short or unsupported text receives no authorship verdict.
                  </small>
                </div>
              )}
            </div>
          </div>
        </section>
        <div className="vt-below">
          <button
            className="vt-text-button"
            disabled={!!busy}
            onClick={() => {
              editInput(sample);
              setNotice(
                "AI-authored library example loaded. Rewriting changes the wording; it does not establish human authorship.",
              );
            }}
          >
            Try a sample <ArrowRight size={14} />
          </button>
          <span>
            <ShieldCheck size={15} />{" "}
            {tab === "humanizer"
              ? "Browser AI or your local server. No paid API."
              : "Text is processed on this device. Model files download from Hugging Face."}
          </span>
        </div>
        <div className="vt-notes">
          <div>
            <h3>Keep your meaning</h3>
            <p>
              Compare edits, check names and facts, and make the final draft
              yours.
            </p>
          </div>
          <div>
            <h3>Know the limits</h3>
            <p>
              AI detection can be wrong. Never use a score alone to judge
              someone’s work.
            </p>
          </div>
          <div>
            <h3>Choose your engine</h3>
            <p>
              Use a browser model or connect the model you already run on your
              computer.
            </p>
          </div>
        </div>
      </main>
      <footer className="vt-footer">
        <span>veritext · local by choice</span>
        <div>
          <a href="/benchmarks">Validation & limits</a>
          <a href="https://github.com/fizuli20/veritext-local-ai">
            Source code
          </a>
          <a href="/developers">API</a>
        </div>
      </footer>
      {settings && (
        <div
          className="vt-modal-backdrop"
          onClick={() => {
            if (!busy) {
              setPendingRewrite(false);
              setSettings(false);
            }
          }}
        >
          <section
            role="dialog"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setPendingRewrite(false);
                if (busy === "load") stop();
                setSettings(false);
              }
              if (event.key === "Tab") {
                const items = Array.from(
                  event.currentTarget.querySelectorAll<HTMLElement>(
                    "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
                  ),
                );
                const first = items[0],
                  last = items.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                }
                if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
            aria-modal="true"
            aria-label="Writing model setup"
            className="vt-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vt-pane-heading">
              <h2>Your writing engine</h2>
              <button
                autoFocus
                aria-label="Close setup"
                className="vt-text-button"
                onClick={() => {
                  if (busy === "load") stop();
                  setPendingRewrite(false);
                  setSettings(false);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <p>Free of API keys. Pick the engine that fits your device.</p>
            {pendingRewrite && (
              <p role="status">
                Your rewrite will start automatically after setup.
              </p>
            )}
            <div className="vt-setup-section">
              <span className="vt-eyebrow">OPTION 01 · IN YOUR BROWSER</span>
              <h3>Download a small writing model</h3>
              <p>
                Choose a model for your device. Requires WebGPU. Larger models
                need more memory; useful edits are not guaranteed.
              </p>
              <label htmlFor="browser-writing-model">
                Browser writing model
              </label>
              <select
                id="browser-writing-model"
                value={writingTier}
                disabled={!!busy}
                onChange={(e) =>
                  setWritingTier(e.target.value as WritingModelTier)
                }
              >
                {Object.entries(WRITING_MODELS).map(([tier, model]) => (
                  <option key={tier} value={tier}>
                    {model.label}
                  </option>
                ))}
              </select>
              <p className="vt-small">
                {WRITING_MODELS[writingTier].description}
              </p>
              <button
                className="vt-secondary"
                disabled={!!busy}
                onClick={loadBrowser}
              >
                {browserName === WRITING_MODELS[writingTier].id
                  ? "Use browser model"
                  : busy === "load"
                    ? "Loading model…"
                    : "Load browser AI"}
              </button>
              {busy === "load" && (
                <>
                  <p role="status" className="vt-small">
                    {progress}
                  </p>
                  <button className="vt-text-button" onClick={stop}>
                    Stop download
                  </button>
                </>
              )}
            </div>
            <div className="vt-setup-section">
              <span className="vt-eyebrow">OPTION 02 · LOCAL SERVER</span>
              <h3>Use LM Studio or Ollama</h3>
              <p>
                Start a chat model on this computer. In LM Studio, enable CORS
                in Developer → Server Settings.
              </p>
              <div className="vt-preset">
                <button
                  disabled={connecting}
                  className="vt-text-button"
                  onClick={() => setBaseUrl("http://localhost:1234/v1")}
                >
                  LM Studio
                </button>
                <button
                  disabled={connecting}
                  className="vt-text-button"
                  onClick={() => setBaseUrl("http://localhost:11434/v1")}
                >
                  Ollama
                </button>
              </div>
              <label htmlFor="server-url">Local server address</label>
              <div className="vt-connect">
                <input
                  id="server-url"
                  value={baseUrl}
                  disabled={connecting || !!busy}
                  onChange={(e) => {
                    setBaseUrl(e.target.value);
                    setModelId("");
                    setConnectedUrl("");
                  }}
                />
                <button
                  className="vt-primary"
                  disabled={connecting || !!busy}
                  onClick={connect}
                >
                  {connecting ? "Connecting…" : "Connect"}
                </button>
              </div>
              {models.length > 0 && (
                <>
                  <label htmlFor="writing-model">Writing model</label>
                  <select
                    id="writing-model"
                    value={modelId}
                    onChange={(e) => {
                      setModelId(e.target.value);
                      setUseLocal(true);
                    }}
                  >
                    {models.map((m) => (
                      <option key={m.id}>{m.id}</option>
                    ))}
                  </select>
                  <p className="vt-connected">Connected · {modelId}</p>
                  <button
                    className="vt-secondary"
                    disabled={!!busy}
                    onClick={() => {
                      setUseLocal(true);
                      setSettings(false);
                    }}
                  >
                    Use local model
                  </button>
                </>
              )}
            </div>
            {error && (
              <p role="alert" className="vt-message vt-error">
                {error}
              </p>
            )}
            {activeName && (
              <button className="vt-primary" onClick={() => setSettings(false)}>
                Return to editor <ArrowRight size={16} />
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
