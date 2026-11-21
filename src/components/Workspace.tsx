"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  rewriteInstructions,
  reviewRewrite,
} from "@/lib/humanizer/rewrite-review";
import { computeWordDiff } from "@/lib/nlp/diff";

interface Scan {
  text: string;
  evidence: DetectionEvidence;
  engine: string;
  latencyMs: number;
  sentences: { start: number; end: number; text: string; score: number }[];
}
const sample =
  "A neighborhood library can do more than lend books. It gives people a place to study, meet neighbors, and learn skills they might not otherwise have the chance to practice. Evening classes can help adults use online services, while quiet rooms give students somewhere to work when home is crowded. These benefits depend on practical choices. Opening hours need to match the lives of local residents, and staff need time to answer questions rather than spend every shift sorting returns. A larger building will not solve those problems on its own. Before expanding, library managers should ask visitors what they use, listen to people who never come through the door, and check whether existing services reach the people they were designed for. A small change to the timetable may help more readers than an expensive renovation. The useful measure is whether the library makes everyday life easier for the community it serves.";

export function Workspace() {
  const [tab, setTab] = useState<"detector" | "humanizer">("humanizer");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [source, setSource] = useState("");
  const [mode, setMode] = useState("standard");
  const [scan, setScan] = useState<Scan | null>(null);
  const [busy, setBusy] = useState<"scan" | "rewrite" | "load" | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [engineName, setEngineName] = useState("");
  const [settings, setSettings] = useState(false);
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
    () => (output && source ? reviewRewrite(source, output, mode) : []),
    [source, output, mode],
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
    if (browserName) {
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
    try {
      const { loadBrowserRewriter } = await import("@/lib/ml/browser-rewriter");
      const loaded = await loadBrowserRewriter((text) => {
        if (operation.current === id) setProgress(text);
      }, controller.signal);
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
  async function detect() {
    const eligibility = describeEvidence(input, null);
    setError("");
    setNotice("");
    if (
      eligibility.status === "insufficient-text" ||
      eligibility.status === "unsupported-language"
    ) {
      setScan({
        text: input,
        evidence: eligibility,
        engine: "Input check",
        latencyMs: 0,
        sentences: [],
      });
      return;
    }
    if (input.length > 20000) {
      setError("Use at most 20,000 characters per scan.");
      return;
    }
    const id = String(++operation.current);
    setBusy("scan");
    setProgress("Loading neural detector (about 125 MB on first use)…");
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
      worker.postMessage({ type: "detect", text: input, id });
    } catch (err) {
      setError(String(err));
      setBusy(null);
    }
  }
  async function rewrite() {
    setError("");
    setNotice("");
    if (!activeName) {
      setSettings(true);
      setNotice("Connect or load a writing model to create a rewrite.");
      return;
    }
    if (input.length > 4000) {
      setError(
        "Rewrite up to 4,000 characters at a time to fit the browser model context.",
      );
      return;
    }
    const id = ++operation.current;
    const original = input;
    setSource(original);
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
    }, 180000);
    try {
      const systemPrompt = rewriteInstructions(mode);
      let result = "";
      if (useLocal && modelId && connectedUrl) {
        result = await streamChatCompletion({
          baseUrl: connectedUrl,
          modelId,
          systemPrompt,
          userPrompt: original,
          signal: controller.signal,
          style: mode === "academic" ? "academic" : "default",
          onChunk: (_, text) => {
            if (operation.current === id) setOutput(text);
          },
        });
      } else if (browserEngine.current) {
        const stream = await browserEngine.current.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: original },
          ],
          stream: true,
          temperature: 0.4,
          max_tokens: 1800,
        });
        let truncated = false;
        for await (const chunk of stream) {
          if (chunk.choices[0]?.finish_reason === "length") truncated = true;
          if (controller.signal.aborted || operation.current !== id)
            throw new Error("Generation stopped.");
          result += chunk.choices[0]?.delta.content ?? "";
          setOutput(cleanLlmOutput(result));
        }
        if (truncated)
          throw new Error(
            "The model reached its output limit. The draft may be incomplete; shorten the input.",
          );
        result = cleanLlmOutput(result);
      }
      if (controller.signal.aborted)
        throw new Error(
          "Generation stopped or timed out. The draft may be incomplete.",
        );
      if (operation.current !== id) return;
      if (!result.trim())
        throw new Error(
          "The writing model returned no text. Try a different model.",
        );
      setOutput(result);
      setNotice(
        result.trim() === original.trim()
          ? "The model returned the original text without changes."
          : "Draft ready. Compare changes and review the meaning before using it.",
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
  }
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
              if (!busy) setTab("detector");
            }}
          >
            AI Detector
          </button>
          <button
            aria-pressed={tab === "humanizer"}
            onClick={() => {
              if (!busy) setTab("humanizer");
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
          <div
            className={`vt-editors ${tab === "detector" ? "vt-detector-editors" : ""}`}
          >
            <div className="vt-pane">
              <div className="vt-pane-heading">
                <label htmlFor="source-text">
                  {tab === "humanizer" ? "Original text" : "Text to check"}
                </label>
                <div>
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
              <textarea
                id="source-text"
                aria-label="Original text"
                value={input}
                disabled={!!busy}
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
                    disabled={!input.trim()}
                    onClick={tab === "humanizer" ? rewrite : detect}
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
                    <p className="vt-provenance">{engineName}</p>
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
                      No word swaps disguised as AI. A real model is required.
                    </small>
                  </div>
                )
              ) : scan ? (
                <div className="vt-scan" data-testid="detector-result">
                  <p className="vt-eyebrow">{scan.engine}</p>
                  <h2>{scan.evidence.verdict}</h2>
                  {scan.evidence.modelScore !== null && (
                    <div className="vt-score">
                      {Math.round(scan.evidence.modelScore * 100)}
                      <span>/100 model signal</span>
                    </div>
                  )}
                  <p>{scan.evidence.explanation}</p>
                  <p className="vt-caution">
                    The raw model signal is not a probability of authorship.
                    Calibration uses a small, historical HC3 sample; modern
                    models and other writing may behave differently.
                  </p>
                  {scan.sentences.length > 0 && (
                    <>
                      {scan.evidence.referenceProbability !== undefined && (
                        <div className="vt-reference">
                          <p>
                            HC3 reference estimate:{" "}
                            {Math.round(
                              scan.evidence.referenceProbability * 100,
                            )}
                            % AI class
                          </p>
                          {scan.evidence.referenceBin && (
                            <p>
                              In the corresponding held-out score bin,{" "}
                              {scan.evidence.referenceBin.aiCount}/
                              {scan.evidence.referenceBin.count} examples were
                              labelled AI. 95% bin frequency interval:{" "}
                              {Math.round(
                                scan.evidence.referenceBin.lower * 100,
                              )}
                              –
                              {Math.round(
                                scan.evidence.referenceBin.upper * 100,
                              )}
                              %. This interval describes that sample, not this
                              document.
                            </p>
                          )}
                        </div>
                      )}
                      <h3>Context highlights</h3>
                      <p className="vt-small">
                        Amber marks contexts with a model signal of 80/100 or
                        above. Sentence context scores are not calibrated
                        probabilities.
                      </p>
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
                                  s.score >= 0.8 ? "#fef08a" : "transparent",
                              }}
                              title={`Neighboring context signal: ${Math.round(s.score * 100)}/100`}
                            >
                              {scan.text.slice(s.start, s.end)}
                            </mark>
                          </span>
                        ))}
                        {scan.text.slice(scan.sentences.at(-1)?.end ?? 0)}
                      </div>
                      <p className="vt-small">
                        {(scan.latencyMs / 1000).toFixed(1)} seconds · TMR
                        RoBERTa Q8 on CPU/WASM
                      </p>
                    </>
                  )}
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
                    The first scan downloads an open neural model, about 125 MB.
                    Later scans reuse your browser cache when available.
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
            onClick={() => editInput(sample)}
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
            if (!busy) setSettings(false);
          }}
        >
          <section
            role="dialog"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
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
                  setSettings(false);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <p>Free of API keys. Pick the engine that fits your device.</p>
            <div className="vt-setup-section">
              <span className="vt-eyebrow">OPTION 01 · LOCAL SERVER</span>
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
            <div className="vt-setup-section">
              <span className="vt-eyebrow">OPTION 02 · IN YOUR BROWSER</span>
              <h3>Download a small writing model</h3>
              <p>
                About 900 MB once, plus working memory. Requires WebGPU. Small
                models work best for simple edits; quality and speed depend on
                your device.
              </p>
              <button
                className="vt-secondary"
                disabled={!!busy}
                onClick={loadBrowser}
              >
                {browserName
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
