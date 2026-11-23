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
  formatModelSignal,
  isNearModelCeiling,
  type DetectionEvidence,
} from "@/lib/detector/evidence";
import {
  discoverLocalModels,
  localApiBase,
  streamChatCompletion,
  type DiscoveredModel,
} from "@/lib/humanizer/local-server-client";
import {
  cleanLlmOutput,
  RewriteOutputLimitError,
} from "@/lib/humanizer/output-cleaner";
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
import {
  summarizePassageSignals,
  type PassageSignal,
} from "@/lib/detector/passages";
import {
  readWorkspace,
  WORKSPACE_ENABLED_KEY,
  WORKSPACE_KEY,
  type RewriteMode,
  type WorkspaceSnapshot,
} from "@/lib/workspace-storage";
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
  contextTarget?: number;
  passages?: PassageSignal[];
  eligiblePassageCount?: number;
  sentences: {
    start: number;
    end: number;
    text: string;
    score: number | null;
  }[];
}
type Tool = "detector" | "humanizer";
type DraftSelection = { start: number; end: number };
type RewriteTarget = "document" | DraftSelection;
type RewriteScanSource = "original" | "draft";
type RewriteScanSignal = { text: string; tier: DetectorTier; score: number };

const sample =
  "A neighborhood library can do more than lend books. It gives people a place to study, meet neighbors, and learn skills they might not otherwise have the chance to practice. Evening classes can help adults use online services, while quiet rooms give students somewhere to work when home is crowded. These benefits depend on practical choices. Opening hours need to match the lives of local residents, and staff need time to answer questions rather than spend every shift sorting returns. A larger building will not solve those problems on its own. Before expanding, library managers should ask visitors what they use, listen to people who never come through the door, and check whether existing services reach the people they were designed for. A small change to the timetable may help more readers than an expensive renovation. The useful measure is whether the library makes everyday life easier for the community it serves.";

export function Workspace() {
  const [interactive, setInteractive] = useState(false);
  const [rememberWorkspace, setRememberWorkspace] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [detectorTier, setDetectorTier] = useState<DetectorTier>("detailed");
  const [tab, setTab] = useState<Tool>("humanizer");
  const [rewriteInput, setRewriteInput] = useState("");
  const [detectorInput, setDetectorInput] = useState("");
  const [rewriteSignals, setRewriteSignals] = useState<
    Partial<Record<RewriteScanSource, RewriteScanSignal>>
  >({});
  const input = tab === "humanizer" ? rewriteInput : detectorInput;
  const [output, setOutput] = useState("");
  const [source, setSource] = useState("");
  const [depth, setDepth] = useState<RewriteDepth>("rephrase");
  const [mode, setMode] = useState<RewriteMode>("standard");
  const [styleNote, setStyleNote] = useState("");
  const [outputDepth, setOutputDepth] = useState<RewriteDepth>("rephrase");
  const [outputMode, setOutputMode] = useState<RewriteMode>("standard");
  const [writingTier, setWritingTier] = useState<WritingModelTier>("balanced");
  const [lockedTerms, setLockedTerms] = useState("");
  const [rewriteReport, setRewriteReport] = useState<RewriteOutcome | null>(
    null,
  );
  const [previousDraft, setPreviousDraft] = useState<{
    source: string;
    output: string;
    engine: string;
    mode: RewriteMode;
    depth: RewriteDepth;
    report: RewriteOutcome | null;
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
  const draftField = useRef<HTMLTextAreaElement | null>(null);
  const [pendingRewrite, setPendingRewrite] = useState<RewriteTarget | null>(
    null,
  );
  const [selection, setSelection] = useState<DraftSelection | null>(null);
  function captureSelection(field: HTMLTextAreaElement) {
    const { selectionStart: start, selectionEnd: end, value } = field;
    const next =
      start < end && value.slice(start, end).trim() ? { start, end } : null;
    setSelection((previous) =>
      previous?.start === next?.start && previous?.end === next?.end
        ? previous
        : next,
    );
  }

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
    function handleSelection() {
      const field = draftField.current;
      if (field && document.activeElement === field) captureSelection(field);
    }
    // The native event covers text selection from browser editing controls and
    // assistive technology, in addition to React's pointer/keyboard selection.
    document.addEventListener("selectionchange", handleSelection, true);
    return () =>
      document.removeEventListener("selectionchange", handleSelection, true);
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(WORKSPACE_ENABLED_KEY) === "yes") {
        setRememberWorkspace(true);
        const localCopy = localStorage.getItem(WORKSPACE_KEY);
        const restored = readWorkspace(localCopy);
        if (restored) {
          setRewriteInput(restored.rewriteInput);
          setDetectorInput(restored.detectorInput);
          setOutput(restored.output);
          setSource(restored.source);
          setLockedTerms(restored.lockedTerms);
          setStyleNote(restored.styleNote);
          setMode(restored.mode);
          setOutputMode(restored.outputMode);
          setDepth(restored.depth);
          setOutputDepth(restored.outputDepth);
          setDetectorTier(restored.detectorTier);
          setTab(restored.tab);
          if (restored.output) setEngineName("Restored draft");
        } else if (localCopy) {
          setRememberWorkspace(false);
          setStorageError(
            "This browser could not restore the saved workspace.",
          );
        }
      }
    } catch {
      // An unavailable local store must not block the editor.
    }
    function handleStorage(event: StorageEvent) {
      if (event.key === WORKSPACE_ENABLED_KEY && event.newValue !== "yes")
        setRememberWorkspace(false);
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!interactive || !rememberWorkspace) return;
    try {
      if (localStorage.getItem(WORKSPACE_ENABLED_KEY) !== "yes") return;
      const snapshot: WorkspaceSnapshot = {
        version: 1,
        rewriteInput,
        detectorInput,
        output,
        source,
        lockedTerms,
        styleNote,
        mode,
        outputMode,
        depth,
        outputDepth,
        detectorTier,
        tab,
      };
      const serialized = JSON.stringify(snapshot);
      if (serialized.length > 2_000_000)
        throw new Error("Workspace is too large.");
      localStorage.setItem(WORKSPACE_KEY, serialized);
      setStorageError("");
    } catch {
      setStorageError(
        "Could not save this workspace. Recent changes may be missing from the saved copy.",
      );
    }
  }, [
    interactive,
    rememberWorkspace,
    rewriteInput,
    detectorInput,
    output,
    source,
    lockedTerms,
    styleNote,
    mode,
    outputMode,
    depth,
    outputDepth,
    detectorTier,
    tab,
  ]);

  function rememberOnDevice(enabled: boolean) {
    try {
      if (enabled) {
        localStorage.setItem(WORKSPACE_ENABLED_KEY, "yes");
      } else {
        localStorage.removeItem(WORKSPACE_ENABLED_KEY);
        localStorage.removeItem(WORKSPACE_KEY);
      }
      setRememberWorkspace(enabled);
      setStorageError("");
    } catch {
      setStorageError(
        enabled
          ? "This browser is blocking local workspace storage."
          : "The saved copy could not be removed. Try again or clear this site's data.",
      );
    }
  }

  useEffect(() => {
    setInteractive(true);
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
    setPendingRewrite(null);
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
    const message =
      busy === "scan"
        ? "Scan stopped. Completed scores are still available."
        : busy === "load"
          ? "Model setup stopped."
          : output
            ? "Rewrite stopped. Your last completed draft is still available."
            : "Rewrite stopped.";
    setNotice(message);
  }
  function switchTool(tool: Tool) {
    setTab(tool);
    setError("");
    setNotice("");
  }

  function editInput(value: string, tool = tab) {
    setPendingRewrite(null);
    setError("");
    if (tool === "detector") {
      setDetectorInput(value);
      setScan(null);
      setNotice("");
      return;
    }
    setRewriteInput(value);
    setNotice(
      output && value !== source
        ? "Source text changed. The edited draft belongs to your previous source. Run Rewrite to create a new draft."
        : "",
    );
  }

  function checkRewriteText(text: string, from: RewriteScanSource) {
    editInput(text, "detector");
    switchTool("detector");
    void detect(false, text, from);
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
        `Imported ${file.name} on this device. No document was uploaded.${tab === "humanizer" && output ? " The edited draft belongs to your previous source. Run Rewrite to update it." : ""}`,
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
      contextTarget: scan.contextTarget ?? 0,
      contextsScored: scan.sentences.filter(
        (sentence) => sentence.score !== null,
      ).length,
      latencyMs: scan.latencyMs,
      contexts: scan.sentences,
      passages: scan.passages ?? [],
      paragraphSignalSummary: summarizePassageSignals(scan.passages ?? []),
      eligiblePassageCount: scan.eligiblePassageCount ?? 0,
      limitation:
        "Model signals are not proof of authorship. Reference estimates describe historical data. Context and paragraph scores are uncalibrated. This file contains the checked text.",
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
  function changeLocalAddress(value: string) {
    setBaseUrl(value);
    setModels([]);
    setModelId("");
    setConnectedUrl("");
  }
  function activateLocalModel(id: string) {
    // Release browser inference memory before the local server loads its model.
    browserWorker.current?.terminate();
    browserWorker.current = null;
    browserEngine.current = null;
    setBrowserName("");
    setModelId(id);
    setUseLocal(true);
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
      const address = localApiBase(baseUrl);
      const result = await discoverLocalModels(address);
      if (result.error) throw new Error(result.error);
      if (!result.models.length)
        throw new Error(
          "No writing model is loaded. Load a chat model in LM Studio or Ollama first.",
        );
      setModels(result.models);
      setConnectedUrl(address);
      activateLocalModel(result.models[0]!.id);
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
      if (operation.current === id) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof Error && err.name === "QuotaExceededError") {
          setError(
            "The browser ran out of storage while saving the model. Free some space or choose a smaller model.",
          );
        } else if (/NetworkError|Failed to fetch|Cache\.add/i.test(message)) {
          setError(
            "The model download stopped. Retry to reuse any cached files, or choose a smaller model.",
          );
        } else {
          setError(message);
        }
      }
    } finally {
      if (operation.current === id) {
        setBusy(null);
        setProgress("");
      }
    }
  }
  async function detect(
    includeContexts = false,
    text = detectorInput,
    from?: RewriteScanSource,
  ) {
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
    if (!includeContexts) setScan(null);
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
          setProgress(
            `Checking context ${data.completed + 1} of ${data.total}…`,
          );
        if (data.type === "error")
          fail(
            `Neural detector unavailable: ${data.error}. No fallback score was substituted.`,
          );
        if (data.type === "partial-result" && data.id === id) {
          const next: Scan = data;
          setScan((previous) => {
            if (
              !includeContexts ||
              !previous ||
              previous.text !== next.text ||
              previous.tier !== next.tier
            )
              return next;
            return {
              ...next,
              passages:
                (next.passages?.length ?? 0) >= (previous.passages?.length ?? 0)
                  ? next.passages
                  : previous.passages,
              sentences: next.sentences.map((sentence, index) => {
                const earlier = previous.sentences[index];
                return sentence.score === null &&
                  earlier?.start === sentence.start &&
                  earlier.end === sentence.end
                  ? earlier
                  : sentence;
              }),
            };
          });
        }
        if (data.type === "result" && data.id === id) {
          if (timer.current) clearTimeout(timer.current);
          setScan(data);
          const score = (data as Scan).evidence.modelScore;
          if (from && score !== null)
            setRewriteSignals((previous) => ({
              ...previous,
              [from]: { text, tier: detectorTier, score },
            }));
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
  const rewrite = useCallback(
    async (target: RewriteTarget = "document") => {
      setError("");
      setNotice("");
      if (!activeName) {
        setPendingRewrite(target);
        setSettings(true);
        setNotice(
          "Choose a writing model. Your rewrite will start when it is ready.",
        );
        return;
      }
      const selected = target === "document" ? null : target;
      const original = selected
        ? output.slice(selected.start, selected.end)
        : rewriteInput;
      if (!original.trim()) return;
      if (original.length > 12000) {
        setError(
          "Rewrite up to 12,000 characters at a time. Longer text is split into sections to fit the writing model.",
        );
        return;
      }
      const id = ++operation.current;
      setBusy("rewrite");
      setProgress(selected ? "Revising the selection…" : "Writing a draft…");
      const controller = new AbortController();
      abort.current = controller;
      timer.current = setTimeout(() => {
        if (operation.current === id) {
          controller.abort();
          browserEngine.current?.interruptGenerate();
        }
      }, 600000);
      let rewriteStep = "";
      try {
        const result = await runRewritePipeline({
          text: original,
          mode,
          depth,
          styleNote,
          terms: lockedTerms
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          signal: controller.signal,
          onProgress: (message) => {
            rewriteStep = message;
            if (operation.current === id) setProgress(message);
          },
          generate: async ({
            systemPrompt,
            userPrompt,
            attempt,
            restructure,
          }) => {
            if (useLocal && modelId && connectedUrl) {
              const waiting = setTimeout(() => {
                if (operation.current === id)
                  setProgress(
                    `${rewriteStep} Waiting for the local model to start responding.`,
                  );
              }, 5_000);
              try {
                return await streamChatCompletion({
                  baseUrl: connectedUrl,
                  modelId,
                  systemPrompt,
                  userPrompt,
                  signal: controller.signal,
                  style: mode === "academic" ? "academic" : "default",
                  onModelPhase: (phase) => {
                    clearTimeout(waiting);
                    if (operation.current !== id) return;
                    const detail =
                      phase === "thinking"
                        ? "The local model is reasoning before writing."
                        : phase === "retrying"
                          ? "Retrying with more room for the draft."
                          : "";
                    setProgress(
                      detail ? `${rewriteStep} ${detail}` : rewriteStep,
                    );
                  },
                });
              } finally {
                clearTimeout(waiting);
              }
            }
            if (!browserEngine.current)
              throw new Error("Load a writing model before rewriting.");
            const stream = await browserEngine.current.chat.completions.create({
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              stream: true,
              temperature: attempt || restructure ? 0.65 : 0.5,
              max_tokens: 1800,
            });
            let draft = "",
              truncated = false;
            for await (const chunk of stream) {
              if (controller.signal.aborted || operation.current !== id)
                throw new Error("Generation stopped.");
              if (chunk.choices[0]?.finish_reason === "length")
                truncated = true;
              draft += chunk.choices[0]?.delta.content ?? "";
            }
            if (truncated) throw new RewriteOutputLimitError();
            return cleanLlmOutput(draft);
          },
        });
        if (operation.current !== id) return;
        let nextDraft = result.text;
        if (selected) {
          const leading = original.match(/^\s*/)?.[0] ?? "";
          const trailing = original.match(/\s*$/)?.[0] ?? "";
          nextDraft =
            output.slice(0, selected.start) +
            leading +
            result.text.trim() +
            trailing +
            output.slice(selected.end);
          // The range may cut through a quotation, quantity claim or qualifier.
          // Review the merged draft against the previous draft, including its surroundings.
          const mergeIssues = reviewRewrite(
            output,
            nextDraft,
            outputMode,
            lockedTerms.split(","),
          );
          if (mergeIssues.length) {
            setError("Selection kept unchanged. " + mergeIssues[0]);
            return;
          }
          if (!result.changed || nextDraft === output) {
            setNotice(
              "No revision passed the checks for the selection. The draft is still available.",
            );
            return;
          }
        }
        if (!result.changed && output) {
          setNotice(
            "No new rewrite passed the preservation checks. Your previous draft is still available.",
          );
          return;
        }
        if (output)
          setPreviousDraft({
            source,
            output,
            engine: engineName,
            mode: outputMode,
            depth: outputDepth,
            report: rewriteReport,
          });
        if (!selected) {
          setSource(original);
          setOutputMode(mode);
        }
        setOutputDepth(depth);
        setSelection(null);
        setDiff(false);
        setEngineName(activeName);
        setOutput(nextDraft);
        setRewriteReport(result);
        if (!selected) {
          requestAnimationFrame(() => {
            const field = draftField.current;
            if (!field || operation.current !== id) return;
            field.setSelectionRange(0, 0);
            field.scrollTop = 0;
          });
        }
        setNotice(
          selected
            ? "Selected text revised. Review the updated draft."
            : result.changed
              ? `${result.lightFallback ? "Light edit ready." : "Draft ready."} ${result.parts - result.retained} of ${result.parts} sections edited. Review the changes before using the text.`
              : "The model did not produce a changed draft that passed preservation checks. Your original was retained.",
        );
      } catch (err) {
        if (operation.current === id) {
          const message = controller.signal.aborted
            ? useLocal
              ? "The local rewrite timed out after 10 minutes. Check the model status in your local server or try a shorter passage."
              : "The rewrite timed out."
            : err instanceof Error
              ? err.message
              : String(err);
          setError(
            output
              ? message + " Your last completed draft is still available."
              : message,
          );
        }
      } finally {
        if (operation.current === id) {
          if (timer.current) clearTimeout(timer.current);
          setBusy(null);
          setProgress("");
        }
      }
    },
    [
      activeName,
      rewriteInput,
      output,
      source,
      engineName,
      outputMode,
      outputDepth,
      rewriteReport,
      mode,
      styleNote,
      lockedTerms,
      depth,
      useLocal,
      modelId,
      connectedUrl,
    ],
  );
  // Resume the user's requested rewrite after either engine finishes setup.
  // No automatic downloads: loading still requires the explicit setup action.
  useEffect(() => {
    if (pendingRewrite && activeName && !busy && !connecting) {
      setPendingRewrite(null);
      setSettings(false);
      void rewrite(pendingRewrite);
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
  const paragraphSummary = summarizePassageSignals(scan?.passages ?? []);
  const originalSignal = rewriteSignals.original;
  const draftSignal = rewriteSignals.draft;
  const comparableSignals =
    originalSignal &&
    draftSignal &&
    originalSignal.text === rewriteInput &&
    source === rewriteInput &&
    draftSignal.text === output &&
    originalSignal.tier === draftSignal.tier;

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
              if (!busy && !importing) switchTool("detector");
            }}
          >
            AI Detector
          </button>
          <button
            aria-pressed={tab === "humanizer"}
            onClick={() => {
              if (!busy && !importing) switchTool("humanizer");
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
                {(
                  [
                    ["standard", "Standard"],
                    ["academic", "Academic"],
                    ["casual", "Casual"],
                    ["professional", "Professional"],
                    ["concise", "Shorten"],
                    ["expand", "Expand"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    disabled={!!busy}
                    aria-pressed={mode === id}
                    onClick={() => setMode(id)}
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
          {tab === "humanizer" && (
            <details className="vt-lock-toolbar">
              <summary>Custom style</summary>
              <label htmlFor="rewrite-style-note">
                Describe the voice or audience
              </label>
              <input
                id="rewrite-style-note"
                disabled={!!busy}
                value={styleNote}
                onChange={(event) => setStyleNote(event.target.value)}
                maxLength={300}
                placeholder="For example, warm and direct, with short sentences"
              />
            </details>
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
                disabled={!interactive || !!busy || importing}
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
                  <div className="vt-actions">
                    {tab === "humanizer" && input.trim() && (
                      <button
                        className="vt-secondary"
                        disabled={importing}
                        onClick={() =>
                          checkRewriteText(rewriteInput, "original")
                        }
                      >
                        Check original
                      </button>
                    )}
                    <button
                      className="vt-primary"
                      disabled={!input.trim() || importing}
                      onClick={
                        tab === "humanizer" ? () => rewrite() : () => detect()
                      }
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
                  </div>
                )}
              </div>
            </div>
            <div className="vt-pane vt-output">
              <div className="vt-pane-heading">
                <span>{tab === "humanizer" ? "Edited draft" : "Analysis"}</span>
                {tab === "humanizer" && output && (
                  <button
                    className="vt-text-button"
                    disabled={!!busy}
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
                        onChange={(e) => {
                          setSelection(null);
                          setOutput(e.target.value);
                        }}
                        ref={draftField}
                        onSelect={(event) =>
                          captureSelection(event.currentTarget)
                        }
                      />
                    )}
                    {!diff && (
                      <div className="vt-provenance vt-selection">
                        <button
                          className="vt-secondary"
                          disabled={!!busy || !selection}
                          onClick={() => {
                            if (selection) void rewrite(selection);
                          }}
                        >
                          Revise selection
                        </button>
                        <span>
                          {selection
                            ? countWords(
                                output.slice(selection.start, selection.end),
                              ) + " words selected"
                            : "Select text in your draft to revise just that part."}
                        </span>
                      </div>
                    )}
                    <p className="vt-provenance">
                      {engineName} ·{" "}
                      {rewriteReport && !rewriteReport.changed
                        ? "Original retained"
                        : rewriteReport?.lightFallback
                          ? "Light edit result"
                          : REWRITE_DEPTHS[outputDepth].label}
                      {rewriteReport
                        ? ` · ${(rewriteReport.elapsedMs / 1000).toFixed(1)} s · ${rewriteReport.retries} retr${rewriteReport.retries === 1 ? "y" : "ies"}`
                        : ""}
                    </p>
                    {comparableSignals && !busy && (
                      <p className="vt-provenance">
                        {originalSignal.tier === "detailed"
                          ? "Detailed"
                          : "Light"}{" "}
                        model signals · Original{" "}
                        {formatModelSignal(originalSignal.score)}/100 · Edited
                        draft {formatModelSignal(draftSignal.score)}/100
                        {isNearModelCeiling(originalSignal.score) &&
                          isNearModelCeiling(draftSignal.score) &&
                          " · Both are at the top of the model’s scale. The detector cannot distinguish them in this range."}
                      </p>
                    )}
                    {!busy &&
                      rewriteReport &&
                      (rewriteReport.checks.length > 0 ||
                        rewriteReport.warnings.length > 0) && (
                        <details className="vt-reference">
                          <summary>Rewrite checks</summary>
                          {rewriteReport.warnings.map((warning) => (
                            <p key={warning}>{warning}</p>
                          ))}
                          {rewriteReport.checks.map((check, i) => (
                            <p key={i}>
                              Section {check.section}, attempt {check.attempt}:{" "}
                              {check.reason}
                            </p>
                          ))}
                        </details>
                      )}
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
                              setRewriteReport(previousDraft.report);
                              setSelection(null);
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
                          onClick={() => checkRewriteText(output, "draft")}
                        >
                          {rewriteReport?.changed === false
                            ? "Check retained text"
                            : "Check edited draft"}{" "}
                          <ArrowRight size={15} />
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
                ) : busy === "rewrite" ? null : (
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
                  <h1 className="vt-print-title">Veritext text analysis</h1>
                  <p className="vt-eyebrow">{scan.engine}</p>
                  <h2>{scan.evidence.verdict}</h2>
                  {scan.evidence.referenceProbability !== undefined && (
                    <details className="vt-reference">
                      <summary>
                        Historical reference · limited transfer to newer AI
                      </summary>
                      <p>
                        HC3 reference estimate:{" "}
                        {formatModelSignal(scan.evidence.referenceProbability)}%
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
                      {formatModelSignal(scan.evidence.modelScore)}
                      <span>/100 model signal</span>
                    </div>
                  )}
                  <p>{scan.evidence.explanation}</p>
                  {scan.evidence.modelScore !== null &&
                    isNearModelCeiling(scan.evidence.modelScore) && (
                      <p className="vt-caution">
                        This result is at the top of the model’s scale. It does
                        not measure what percentage of the text was written by
                        AI.
                      </p>
                    )}
                  <p className="vt-caution">
                    The raw model signal is not a probability of authorship.
                    This detector missed newer AI writing in our stress test.
                    Low scores cannot establish human authorship. Historical HC3
                    reference estimates are not reliable probabilities for
                    current writing.
                  </p>
                  {!!scan.passages?.length && (
                    <section aria-label="Paragraph signals">
                      <h3>Paragraph signals</h3>
                      <p className="vt-small">
                        Compare parts of a mixed document. These scores show
                        model signals on each eligible English paragraph of 80
                        or more words.
                        {(scan.eligiblePassageCount ?? 0) >
                          scan.passages.length &&
                          ` Showing the first ${scan.passages.length} of ${scan.eligiblePassageCount} eligible paragraphs.`}
                      </p>
                      {paragraphSummary.widelyDifferent && (
                        <div
                          className="vt-paragraph-summary"
                          data-testid="paragraph-signal-summary"
                        >
                          <strong>Paragraph signals differ widely</strong>
                          <span>
                            Higher signal:{" "}
                            {paragraphSummary.highSignalParagraphs.join(", ")} ·
                            Lower signal:{" "}
                            {paragraphSummary.lowSignalParagraphs.join(", ")}
                          </span>
                          <span>
                            This variation cannot establish who wrote each
                            paragraph.
                          </span>
                        </div>
                      )}
                      {scan.passages.map((passage) => (
                        <details className="vt-reference" key={passage.start}>
                          <summary>
                            Paragraph {passage.paragraph} ·{" "}
                            {formatModelSignal(passage.score)}/100 ·{" "}
                            {passage.wordCount} words
                          </summary>
                          <p className="vt-passage">
                            {scan.text.slice(passage.start, passage.end)}
                          </p>
                        </details>
                      ))}
                    </section>
                  )}
                  {scan.sentences.length > 0 && (
                    <>
                      <h3>Context highlights</h3>
                      <p className="vt-small">
                        Amber marks a signal of 80/100 or higher in the sentence
                        and its neighbors. Gray marks text with no context score
                        yet.
                      </p>
                      <p className="vt-small">
                        Checked{" "}
                        {
                          scan.sentences.filter(
                            (sentence) => sentence.score !== null,
                          ).length
                        }{" "}
                        of {scan.sentences.length} sentence contexts.
                        {(scan.contextLimit ?? 0) < scan.sentences.length &&
                          ` A scan can check up to ${scan.contextLimit} contexts.`}
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
                                  s.score === null
                                    ? "#f1f3ef"
                                    : s.score >= 0.8
                                      ? "#fef08a"
                                      : "transparent",
                              }}
                              title={
                                s.score === null
                                  ? "Context not scored"
                                  : `Neighboring context signal: ${formatModelSignal(s.score)}/100`
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
                  {scan.sentences.some((sentence) => sentence.score === null) &&
                    scan.sentences.filter((sentence) => sentence.score !== null)
                      .length < (scan.contextLimit ?? 0) && (
                      <button
                        className="vt-secondary"
                        disabled={!!busy}
                        onClick={() => detect(true)}
                      >
                        Check more contexts <ArrowRight size={15} />
                      </button>
                    )}
                  {scan.evidence.modelScore !== null && (
                    <p className="vt-small">
                      {(scan.latencyMs / 1000).toFixed(1)} seconds
                      {scan.loadingMs && scan.loadingMs > 1000
                        ? " including model setup"
                        : ""}{" "}
                      · document
                      {scan.passages?.length ? " and paragraphs" : ""}
                      {scan.sentences.length ? " and contexts" : ""}
                    </p>
                  )}
                  <button className="vt-secondary" onClick={saveScan}>
                    Save analysis
                  </button>
                  {scan.evidence.modelScore !== null && (
                    <button
                      className="vt-secondary"
                      disabled={!!busy}
                      onClick={() => window.print()}
                    >
                      Print / Save PDF
                    </button>
                  )}
                  <button
                    className="vt-secondary"
                    disabled={!!busy}
                    onClick={() => {
                      switchTool("humanizer");
                      if (scan.text !== output)
                        editInput(scan.text, "humanizer");
                    }}
                  >
                    {output && scan.text === output
                      ? "Back to rewrite"
                      : "Use as rewrite source"}{" "}
                    <ArrowRight size={15} />
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
        <div className="vt-local-workspace">
          <label>
            <input
              type="checkbox"
              checked={rememberWorkspace}
              disabled={!interactive}
              onChange={(event) => rememberOnDevice(event.target.checked)}
            />
            Remember this workspace
          </label>
          <p>
            Save the source, draft and detector text in this browser. Turning
            this off removes the saved copy.
          </p>
          {storageError && <p role="alert">{storageError}</p>}
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
              setPendingRewrite(null);
              setSettings(false);
            }
          }}
        >
          <section
            role="dialog"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setPendingRewrite(null);
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
                  setPendingRewrite(null);
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
                  disabled={connecting || !!busy}
                  className="vt-text-button"
                  onClick={() => changeLocalAddress("http://localhost:1234/v1")}
                >
                  LM Studio
                </button>
                <button
                  disabled={connecting || !!busy}
                  className="vt-text-button"
                  onClick={() =>
                    changeLocalAddress("http://localhost:11434/v1")
                  }
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
                  onChange={(e) => changeLocalAddress(e.target.value)}
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
                    disabled={!!busy}
                    onChange={(e) => activateLocalModel(e.target.value)}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </select>
                  <p className="vt-connected">Connected · {modelId}</p>
                  <button
                    className="vt-secondary"
                    disabled={!!busy}
                    onClick={() => {
                      activateLocalModel(modelId);
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
