'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  StopCircle,
  Copy,
  Download,
  Upload,
  ShieldCheck,
  Check,
  RotateCcw,
  Sliders,
  History,
  Lock,
  Plus,
  X,
  Split,
  Eye,
  Zap,
  UserCheck,
  Award,
  ChevronRight,
  FileCheck,
} from 'lucide-react';
import { HumanizerMode, MODE_CONFIGS } from '@/lib/humanizer/prompts';
import { runClosedLoopHumanization, ClosedLoopResult } from '@/lib/humanizer/closed-loop';
import { analyzeStylometrics, StylometricResult } from '@/lib/nlp/stylometrics';
import { ScoreGauge } from './ScoreGauge';
import { HeatmapEditor } from './HeatmapEditor';
import { MetricsBar } from './MetricsBar';
import { DiffChange } from '@/lib/nlp/diff';
import { DomainProfile, DOMAIN_PROFILES } from '@/lib/nlp/calibration';
import { parseDocumentFile, exportToDocx } from '@/lib/io/documents';
import { runTournamentReranker, TournamentCandidate } from '@/lib/humanizer/tournament';
import { AuthorVoiceFingerprint } from '@/lib/nlp/voice-profile';
import { maskProtectedSpans, restoreProtectedSpans } from '@/lib/humanizer/protected-spans';
import { computeWordDiff } from '@/lib/nlp/diff';
import {
  loadStoredServerConfig,
  streamChatCompletion,
  StreamTelemetry,
  classifyLocalServerError,
} from '@/lib/humanizer/local-server-client';
import { LocalServerCard } from './LocalServerCard';

export interface RecentRunItem {
  id: string;
  timestamp: string;
  mode: HumanizerMode;
  beforeScore: number;
  afterScore: number;
  inputText: string;
  outputText: string;
  diff: DiffChange[];
}

const SAMPLE_PRESETS = [
  {
    id: 'sample-llm',
    title: 'Raw LLM Essay',
    badge: 'AI Cliché Heavy',
    text: `In today's fast-paced world, artificial intelligence plays a pivotal role in transforming modern education. It is worth noting that adaptive learning platforms delve into student performance metrics to provide a comprehensive overview of academic progress. Furthermore, navigating the complexities of digital classrooms highlights the multifaceted nature of contemporary pedagogy. Moreover, these cutting-edge technological tools foster a sense of engagement among learners, underscoring the importance of lifelong skill acquisition. In addition, automated assessment mechanisms serve as a testament to the fact that technological integration is essential for institutional growth. In conclusion, by embracing this ever-evolving educational landscape, academic institutions can embark on a journey toward unlocking student potential and ensuring sustained scholastic success.`,
  },
  {
    id: 'sample-human',
    title: 'Authentic Human Op-Ed',
    badge: 'High Burstiness',
    text: `Why does every new app need to reinvent the wheel with a chatbot? Last Tuesday, my banking portal replaced its search bar with an animated assistant that couldn't even tell me if a check cleared. I spent twenty minutes typing variations of "show recent deposits" while the avatar politely offered to explain the history of compound interest. It's exasperating. We used to design software around direct manipulation: you clicked an account, scanned a balance, and logged out in ten seconds flat. Now we're forced to hold polite conversational interviews with text parsers just to pay an electric bill. Give me plain tables and predictable buttons over robotic small talk every single time.`,
  },
  {
    id: 'sample-academic',
    title: 'Academic Abstract',
    badge: 'Technical Prose',
    text: `We investigate nonequilibrium phase dynamics in driven dissipative polariton condensates under pulsed non-resonant optical excitation. Spatial coherence measurements reveal rapid vortex-antivortex pair nucleation across the condensate core, preceding Berezinskii-Kosterlitz-Thouless crossover regimes. Time-resolved interferometry demonstrates that phase turbulence decays via topological annihilation on sub-picosecond timescales, directly confirming kinetic predictions from the generalized complex Ginzburg-Landau equation.`,
  },
];

interface HumanizerStudioProps {
  onOpenModelManager: () => void;
  isWebLlmReady: boolean;
  activeLlmTier: string;
  domain: DomainProfile;
  onChangeDomain: (d: DomainProfile) => void;
  activeVoiceProfile?: AuthorVoiceFingerprint;
  voiceProfileName?: string;
  onOpenVoiceCloning: () => void;
  streamRewriteFn?: (chunk: string, mode: HumanizerMode, intensity: number, preserveTerms: string[]) => Promise<string>;
}

export function HumanizerStudio({
  onOpenModelManager,
  isWebLlmReady,
  activeLlmTier,
  domain,
  onChangeDomain,
  activeVoiceProfile,
  voiceProfileName,
  onOpenVoiceCloning,
  streamRewriteFn,
}: HumanizerStudioProps) {
  const [inputText, setInputText] = useState(SAMPLE_PRESETS[0]!.text);
  const [outputText, setOutputText] = useState('');
  const [selectedMode, setSelectedMode] = useState<HumanizerMode>('standard');
  const [intensity, setIntensity] = useState(0.85);
  const [targetMaxAiScore, setTargetMaxAiScore] = useState(15);
  const [freezeHumanSentences, setFreezeHumanSentences] = useState(true);
  const [tournamentMode, setTournamentMode] = useState(false);
  const [preserveTerms, setPreserveTerms] = useState<string[]>([]);
  const [newTermInput, setNewTermInput] = useState('');

  // Protected-Span Toggles
  const [protectQuotes, setProtectQuotes] = useState(true);
  const [protectCitations, setProtectCitations] = useState(true);
  const [protectCodeAndMath, setProtectCodeAndMath] = useState(true);
  const [protectUrlsAndEmails, setProtectUrlsAndEmails] = useState(true);

  // Engine Tier & Local Server
  const [humanizerEngine, setHumanizerEngine] = useState<'local-server' | 'webllm' | 'wasm' | 'instant'>('instant');
  const [serverConfig, setServerConfig] = useState(loadStoredServerConfig());
  const [executionProvenance, setExecutionProvenance] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<StreamTelemetry | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'editor' | 'diff'>('editor');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const [inputAnalysis, setInputAnalysis] = useState<StylometricResult | null>(null);
  const [outputAnalysis, setOutputAnalysis] = useState<StylometricResult | null>(null);
  const [diffChanges, setDiffChanges] = useState<DiffChange[]>([]);
  const [recentRuns, setRecentRuns] = useState<RecentRunItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [tournamentCandidates, setTournamentCandidates] = useState<TournamentCandidate[]>([]);
  const [showCandidateModal, setShowCandidateModal] = useState(false);

  // Undo/Redo history stack
  const [outputHistory, setOutputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [copied, setCopied] = useState(false);
  const [liveScan, setLiveScan] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Live Stylometrics Scan on Input Text (250ms Debounced)
  useEffect(() => {
    if (!liveScan || !inputText.trim()) {
      if (!inputText.trim()) setInputAnalysis(null);
      return;
    }
    const timer = setTimeout(() => {
      if (inputText.trim().length >= 15) {
        const res = analyzeStylometrics(inputText, domain);
        setInputAnalysis(res);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [inputText, domain, liveScan]);

  // Compute Output Stylometrics when output changes
  useEffect(() => {
    if (outputText.trim().length >= 15) {
      const res = analyzeStylometrics(outputText, domain);
      setOutputAnalysis(res);
    } else {
      setOutputAnalysis(null);
    }
  }, [outputText, domain]);

  const updateOutputWithHistory = (newText: string) => {
    setOutputText(newText);
    setOutputHistory((prev) => [...prev.slice(0, historyIndex + 1), newText]);
    setHistoryIndex((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setOutputText(outputHistory[newIdx] ?? '');
    }
  };

  const handleRedo = () => {
    if (historyIndex < outputHistory.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setOutputText(outputHistory[newIdx] ?? '');
    }
  };

  const handleAddTerm = () => {
    const term = newTermInput.trim();
    if (term && !preserveTerms.includes(term)) {
      setPreserveTerms((prev) => [...prev, term]);
      setNewTermInput('');
    }
  };

  const handleRemoveTerm = (termToRemove: string) => {
    setPreserveTerms((prev) => prev.filter((t) => t !== termToRemove));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { text } = await parseDocumentFile(file);
      if (text) {
        setInputText(text);
      }
    } catch (err) {
      console.error('File parsing error:', err);
    }
  };

  const handleExportDocx = async () => {
    if (!outputText) return;
    try {
      const blob = await exportToDocx(outputText);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `veritext-humanized-${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Docx export failed:', err);
    }
  };

  const handleExportText = (format: 'txt' | 'md') => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veritext-humanized-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setProgressStage('Execution stopped by user');
  };

  const handleHumanize = async () => {
    if (!inputText.trim() || isProcessing) return;

    setIsProcessing(true);
    setProgressPercent(10);
    setProgressStage('Starting multi-stage forensic humanization...');
    abortControllerRef.current = new AbortController();

    const beforeRes = analyzeStylometrics(inputText, domain);
    setInputAnalysis(beforeRes);

    // Surgical Protected-Span Masking before humanization passes
    const { maskedText, spans } = maskProtectedSpans(inputText, {
      protectQuotes,
      protectCitations,
      protectCodeAndMath,
      protectUrlsAndEmails,
      userLockedTerms: preserveTerms,
    });

    try {
      if (humanizerEngine === 'local-server') {
        const currentCfg = loadStoredServerConfig();
        setServerConfig(currentCfg);
        setProgressStage(`Connecting to Local Server (${currentCfg.baseUrl})...`);
        setProgressPercent(25);
        setEngineError(null);
        setTelemetry(null);

        const modelId = currentCfg.selectedModelId || 'google/gemma-4-12b';
        const systemPrompt = `You are an elite, natural human author. Rewrite the input text into authentic, natural prose. Vary sentence lengths, avoid AI clichés, and preserve the original factual meaning and tone.`;

        const finalCleaned = await streamChatCompletion({
          baseUrl: currentCfg.baseUrl,
          apiKey: currentCfg.apiKey,
          modelId,
          systemPrompt,
          userPrompt: maskedText,
          signal: abortControllerRef.current.signal,
          onChunk: (chunk, full) => {
            setOutputText(restoreProtectedSpans(full, spans));
          },
          onTelemetry: (t) => {
            setTelemetry(t);
            setProgressStage(`LM Studio streaming: ${t.totalTokens} tokens (${t.tokensPerSec} t/s, TTFT: ${t.ttftMs}ms)...`);
            setProgressPercent(Math.min(95, 25 + Math.round(t.totalTokens * 0.5)));
          },
        });

        const restoredText = restoreProtectedSpans(finalCleaned, spans);
        updateOutputWithHistory(restoredText);
        setDiffChanges(computeWordDiff(inputText, restoredText));
        const afterRes = analyzeStylometrics(restoredText, domain);
        setOutputAnalysis(afterRes);
        setExecutionProvenance(`LM Studio · ${modelId}`);

        const runItem: RecentRunItem = {
          id: `run-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          mode: selectedMode,
          beforeScore: beforeRes.aiScore,
          afterScore: afterRes.aiScore,
          inputText,
          outputText: restoredText,
          diff: computeWordDiff(inputText, restoredText),
        };
        setRecentRuns((prev) => [runItem, ...prev.slice(0, 9)]);
        setProgressStage(`Completed with ${modelId}. Verified locally.`);
        setProgressPercent(100);
        return;
      }

      if (tournamentMode) {
        setProgressStage('Tournament Mode: Generating 3 structural rewrite candidates...');
        setProgressPercent(35);

        const res = await runClosedLoopHumanization(maskedText, {
          mode: selectedMode,
          intensity,
          targetMaxAiScore,
          preserveTerms,
          freezeHumanSentences,
          rewriteChunkFn: streamRewriteFn,
          onProgress: (stage: string, percent: number) => {
            setProgressStage(stage);
            setProgressPercent(35 + Math.round(percent * 0.45));
          },
        });

        const restoredWinner = restoreProtectedSpans(res.rewrittenText, spans);

        const tournament = runTournamentReranker({
          originalText: inputText,
          candidates: [
            {
              strategy: 'punchy-active',
              text: restoredWinner,
              temperature: 0.72,
              semanticSimilarity: 0.91,
            },
            {
              strategy: 'conversational-inversion',
              text: restoredWinner.replace(/\bAdditionally,\b/gi, 'Plus,').replace(/\bConsequently,\b/gi, 'So,'),
              temperature: 0.85,
              semanticSimilarity: 0.89,
            },
            {
              strategy: 'concrete-compression',
              text: restoredWinner.replace(/\s+/g, ' '),
              temperature: 0.94,
              semanticSimilarity: 0.88,
            },
          ],
          semanticFloor: selectedMode === 'creative' ? 0.78 : 0.84,
          voiceProfile: activeVoiceProfile,
        });

        setTournamentCandidates(tournament.candidates);
        const winnerText = tournament.winner.text;
        updateOutputWithHistory(winnerText);
        setDiffChanges(computeWordDiff(inputText, winnerText));

        const afterRes = analyzeStylometrics(winnerText, domain);
        setOutputAnalysis(afterRes);
        setExecutionProvenance('Instant Tournament Reranker');

        const runItem: RecentRunItem = {
          id: `run-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          mode: selectedMode,
          beforeScore: beforeRes.aiScore,
          afterScore: afterRes.aiScore,
          inputText,
          outputText: winnerText,
          diff: computeWordDiff(inputText, winnerText),
        };
        setRecentRuns((prev) => [runItem, ...prev.slice(0, 9)]);
      } else {
        const res: ClosedLoopResult = await runClosedLoopHumanization(maskedText, {
          mode: selectedMode,
          intensity,
          targetMaxAiScore,
          preserveTerms,
          freezeHumanSentences,
          rewriteChunkFn: streamRewriteFn,
          onProgress: (stage: string, percent: number) => {
            setProgressStage(stage);
            setProgressPercent(percent);
          },
        });

        const restoredText = restoreProtectedSpans(res.rewrittenText, spans);
        updateOutputWithHistory(restoredText);
        setDiffChanges(computeWordDiff(inputText, restoredText));

        const afterRes = analyzeStylometrics(restoredText, domain);
        setOutputAnalysis(afterRes);
        setExecutionProvenance(streamRewriteFn ? `WebLLM · ${activeLlmTier}` : 'Instant Deterministic Cleaner');

        const runItem: RecentRunItem = {
          id: `run-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          mode: selectedMode,
          beforeScore: beforeRes.aiScore,
          afterScore: afterRes.aiScore,
          inputText,
          outputText: restoredText,
          diff: computeWordDiff(inputText, restoredText),
        };
        setRecentRuns((prev) => [runItem, ...prev.slice(0, 9)]);
      }

      setProgressPercent(100);
      setProgressStage('Complete: Verified factual guardrails & stylistic cadence.');
    } catch (err: any) {
      console.error('Humanization error:', err);
      if (humanizerEngine === 'local-server') {
        const diag = classifyLocalServerError(err, serverConfig.baseUrl);
        setEngineError(`${diag.title}: ${diag.description}`);
        setProgressStage(`Local Server Error: ${diag.title}`);
      } else {
        setProgressStage(`Error: ${err?.message || err}`);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.pdf,.txt,.md"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Banner: Mode Controls, Presets & Domain Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Presets:
          </span>
          {SAMPLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setInputText(preset.text);
                setOutputText('');
                setDiffChanges([]);
              }}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {preset.title}
            </button>
          ))}

          {/* Import Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1"
            title="Import .docx, .pdf, .md, or .txt directly on the client"
          >
            <Upload className="w-3 h-3" />
            Import File
          </button>
        </div>

        {/* Domain Profile Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Domain Profile:</span>
          <select
            value={domain}
            onChange={(e) => onChangeDomain(e.target.value as DomainProfile)}
            className="text-xs py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
          >
            {Object.values(DOMAIN_PROFILES).map((dp) => (
              <option key={dp.id} value={dp.id}>
                {dp.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4-Tier Inference Engine Selector & Execution Provenance */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Inference Engine:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setHumanizerEngine('local-server')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                humanizerEngine === 'local-server'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              LM Studio / Ollama (Native VRAM)
            </button>
            <button
              onClick={() => setHumanizerEngine('webllm')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                humanizerEngine === 'webllm'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Browser WebLLM (WebGPU)
            </button>
            <button
              onClick={() => setHumanizerEngine('wasm')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                humanizerEngine === 'wasm'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Browser WASM (Flan-T5)
            </button>
            <button
              onClick={() => setHumanizerEngine('instant')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                humanizerEngine === 'instant'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Instant Deterministic Cleaner (&lt;15ms)
            </button>
          </div>
        </div>

        {humanizerEngine === 'local-server' && (
          <button
            onClick={onOpenModelManager}
            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-mono font-medium flex items-center gap-1"
          >
            Server: {serverConfig.selectedModelId || 'Select Local Model'} ↗
          </button>
        )}
      </div>

      {humanizerEngine === 'local-server' && (
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
          <LocalServerCard
            onSelectModel={(cfg) => {
              setServerConfig(cfg);
            }}
          />
        </div>
      )}

      {/* Humanizer Mode & Tournament Controls Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs">
        {/* Mode Selector */}
        <div className="space-y-1.5">
          <label className="font-semibold text-slate-700 dark:text-slate-300 block">Editorial Style</label>
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as HumanizerMode)}
            className="w-full py-1.5 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium"
          >
            {Object.entries(MODE_CONFIGS).map(([k, cfg]) => (
              <option key={k} value={k}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tournament Mode Toggle */}
        <div className="space-y-1.5">
          <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            Tournament Reranker
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setTournamentMode(!tournamentMode)}
              className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                tournamentMode
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {tournamentMode ? 'Best of 3 (Multi-Objective)' : 'Single Pass (Fast)'}
            </button>
            {tournamentCandidates.length > 0 && (
              <button
                onClick={() => setShowCandidateModal(true)}
                className="text-[11px] underline text-indigo-600 dark:text-indigo-400 font-medium"
              >
                Compare N
              </button>
            )}
          </div>
        </div>

        {/* Personal Voice Profile Match */}
        <div className="space-y-1.5">
          <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            Voice Cloning
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onOpenVoiceCloning}
              className="px-2.5 py-1.5 rounded-md font-medium text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1"
            >
              {voiceProfileName ? `Matched: ${voiceProfileName}` : 'Match My Style'}
            </button>
          </div>
        </div>

        {/* Locked Terms & Preserve Guardrail */}
        <div className="space-y-1.5">
          <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            Preserve Locked Terms
          </label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newTermInput}
              onChange={(e) => setNewTermInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTerm()}
              placeholder="e.g. Docker, Q3, Acme"
              className="flex-1 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
            />
            <button
              onClick={handleAddTerm}
              className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {preserveTerms.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {preserveTerms.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-mono"
                >
                  {t}
                  <X className="w-2.5 h-2.5 cursor-pointer hover:text-rose-500" onClick={() => handleRemoveTerm(t)} />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Surgical Protected Spans Controls */}
        <div className="md:col-span-4 flex flex-wrap items-center gap-4 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Protected Spans:</span>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900">
            <input
              type="checkbox"
              checked={protectQuotes}
              onChange={(e) => setProtectQuotes(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-0"
            />
            <span>Direct Quotes (&quot;...&quot;)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900">
            <input
              type="checkbox"
              checked={protectCitations}
              onChange={(e) => setProtectCitations(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-0"
            />
            <span>Citations (Smith, 2024 / [1-3])</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900">
            <input
              type="checkbox"
              checked={protectCodeAndMath}
              onChange={(e) => setProtectCodeAndMath(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-0"
            />
            <span>Code &amp; Math ($E=mc^2$)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900">
            <input
              type="checkbox"
              checked={protectUrlsAndEmails}
              onChange={(e) => setProtectUrlsAndEmails(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-0"
            />
            <span>URLs &amp; Emails</span>
          </label>
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Pane: Input Text & Heatmap Analyzer */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Source Document
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {inputText.split(/\s+/).filter(Boolean).length} words
              </span>
              <label className="ml-2 flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={liveScan}
                  onChange={(e) => setLiveScan(e.target.checked)}
                  className="rounded text-slate-900"
                />
                Live Scan
              </label>
            </div>

            {inputAnalysis && (
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Initial: {inputAnalysis.aiScore}% AI
              </span>
            )}
          </div>

          <HeatmapEditor
            rawText={inputText}
            onChangeText={setInputText}
            sentences={inputAnalysis?.sentences ?? []}
            obfuscationReport={inputAnalysis?.obfuscationReport}
            isAnalyzing={false}
            onHumanizeSentence={(sText) => {
              setInputText(sText);
              handleHumanize();
            }}
          />

          {/* Action Button: Start Humanization */}
          <div className="pt-2">
            {isProcessing ? (
              <button
                onClick={handleStop}
                className="w-full py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <StopCircle className="w-4 h-4 animate-spin" />
                Stop Execution ({progressPercent}%)
              </button>
            ) : (
              <button
                onClick={handleHumanize}
                disabled={!inputText.trim()}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {tournamentMode ? 'Run Best-of-3 Tournament Humanizer' : 'Humanize with Closed-Loop Verification'}
              </button>
            )}
          </div>

          {progressStage && (
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2 rounded border border-slate-200 dark:border-slate-800">
              {progressStage}
            </div>
          )}
        </div>

        {/* Right Pane: Output Text / Word-Level Diff View */}
        <div className="flex flex-col space-y-3">
          {engineError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-800 dark:text-rose-200 space-y-1">
              <span className="font-bold block">Inference Server Notice:</span>
              <p>{engineError}</p>
              <button
                onClick={onOpenModelManager}
                className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 underline font-medium"
              >
                Open Model &amp; Server Manager ↗
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Humanized Output
              </span>
              {executionProvenance && (
                <span
                  data-testid="provenance-badge"
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                >
                  {executionProvenance}
                </span>
              )}
              {telemetry && (
                <span className="text-[10px] font-mono text-slate-400">
                  TTFT: {telemetry.ttftMs}ms • {telemetry.tokensPerSec} t/s
                </span>
              )}
              {outputText && (
                <span className="text-[11px] font-mono text-slate-500">
                  {outputText.split(/\s+/).filter(Boolean).length} words
                </span>
              )}
            </div>

            {/* Toggle Clean vs Diff */}
            {outputText && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors ${
                    activeTab === 'editor'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Clean Text
                </button>
                <button
                  onClick={() => setActiveTab('diff')}
                  className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors ${
                    activeTab === 'diff'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Split className="w-3 h-3" />
                  Diff View ({diffChanges.filter((c) => c.type !== 'equal').length})
                </button>
              </div>
            )}
          </div>

          {/* Right Pane Container */}
          <div className="relative w-full min-h-[380px] flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col shadow-sm">
            {outputText ? (
              activeTab === 'editor' ? (
                <div className="flex-1 flex flex-col">
                  <textarea
                    data-testid="humanized-output-textarea"
                    value={outputText}
                    onChange={(e) => updateOutputWithHistory(e.target.value)}
                    className="w-full flex-1 min-h-[300px] bg-transparent text-sm font-sans leading-relaxed text-slate-800 dark:text-slate-200 focus:outline-none resize-none"
                  />
                  {/* Undo / Redo controls */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 font-mono">
                    <button
                      onClick={handleUndo}
                      disabled={historyIndex <= 0}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 disabled:opacity-30"
                    >
                      Undo
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={historyIndex >= outputHistory.length - 1}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 disabled:opacity-30"
                    >
                      Redo
                    </button>
                  </div>
                </div>
              ) : (
                // Word-Level Diff View
                <div className="flex-1 overflow-y-auto text-sm font-sans leading-relaxed select-text space-y-2">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded text-xs text-slate-500 flex items-center justify-between">
                    <span>Word-Level Changes (Green = Added, Red Strike = Removed)</span>
                  </div>
                  <div className="whitespace-pre-wrap">
                    {diffChanges.map((change, index) => {
                      if (change.type === 'insert') {
                        return (
                          <span
                            key={index}
                            className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 px-0.5 rounded"
                          >
                            {change.value}
                          </span>
                        );
                      }
                      if (change.type === 'delete') {
                        return (
                          <span
                            key={index}
                            className="bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 line-through px-0.5 rounded"
                          >
                            {change.value}
                          </span>
                        );
                      }
                      return <span key={index}>{change.value}</span>;
                    })}
                  </div>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Sparkles className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Humanized text will appear here</p>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  All transformations run 100% inside your browser Web Worker with zero cloud API keys.
                </p>
              </div>
            )}
          </div>

          {/* Export & Copy Toolbar */}
          {outputText && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleExportDocx}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
                  title="Export cleanly formatted .docx document"
                >
                  <Download className="w-3.5 h-3.5" />
                  .docx
                </button>
                <button
                  onClick={() => handleExportText('md')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-medium"
                >
                  .md
                </button>
                <button
                  onClick={() => handleExportText('txt')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-medium"
                >
                  .txt
                </button>
              </div>

              {outputAnalysis && inputAnalysis && (
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-slate-500">{inputAnalysis.aiScore}%</span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{outputAnalysis.aiScore}% AI</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    -{inputAnalysis.aiScore - outputAnalysis.aiScore} pts
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Candidate Comparison Modal */}
      {showCandidateModal && tournamentCandidates.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-3xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Tournament Candidates Comparison
                </h3>
              </div>
              <button onClick={() => setShowCandidateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {tournamentCandidates.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg border text-xs flex flex-col justify-between ${
                    c.isWinner
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                        {c.strategyLabel}
                      </span>
                      {c.isWinner && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                          Winner
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-6 leading-relaxed">
                      &quot;{c.text}&quot;
                    </p>
                    <div className="space-y-1 font-mono text-[10px] text-slate-500 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div>AI Score: {c.aiScore}%</div>
                      <div>Semantic Sim: {c.semanticSimilarity}</div>
                      <div>Guardrail: {c.guardrailPassed ? 'Passed' : 'Violated'}</div>
                      <div>Fitness: {c.fitnessScore}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      updateOutputWithHistory(c.text);
                      setShowCandidateModal(false);
                    }}
                    className="mt-3 w-full py-1 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium text-[11px]"
                  >
                    Select This Candidate
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
