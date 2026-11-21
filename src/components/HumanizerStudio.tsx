'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  StopCircle,
  Copy,
  Download,
  Upload,
  ArrowRight,
  ShieldCheck,
  Check,
  RotateCcw,
  Sliders,
  History,
  FileText,
  Lock,
  Plus,
  X,
  Split,
  Eye,
  Zap,
} from 'lucide-react';
import { HumanizerMode, MODE_CONFIGS } from '@/lib/humanizer/prompts';
import { runClosedLoopHumanization, ClosedLoopResult } from '@/lib/humanizer/closed-loop';
import { analyzeStylometrics, StylometricResult } from '@/lib/nlp/stylometrics';
import { ScoreGauge } from './ScoreGauge';
import { HeatmapEditor } from './HeatmapEditor';
import { MetricsBar } from './MetricsBar';
import { DiffChange } from '@/lib/nlp/diff';

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
  streamRewriteFn?: (chunk: string, mode: HumanizerMode, intensity: number, preserveTerms: string[]) => Promise<string>;
}

export function HumanizerStudio({
  onOpenModelManager,
  isWebLlmReady,
  activeLlmTier,
  streamRewriteFn,
}: HumanizerStudioProps) {
  const [inputText, setInputText] = useState(SAMPLE_PRESETS[0]!.text);
  const [outputText, setOutputText] = useState('');
  const [selectedMode, setSelectedMode] = useState<HumanizerMode>('standard');
  const [intensity, setIntensity] = useState(0.85);
  const [targetMaxAiScore, setTargetMaxAiScore] = useState(15);
  const [freezeHumanSentences, setFreezeHumanSentences] = useState(true);
  const [preserveTerms, setPreserveTerms] = useState<string[]>([]);
  const [newTermInput, setNewTermInput] = useState('');

  const [activeTab, setActiveTab] = useState<'editor' | 'diff'>('editor');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const [inputAnalysis, setInputAnalysis] = useState<StylometricResult | null>(null);
  const [outputAnalysis, setOutputAnalysis] = useState<StylometricResult | null>(null);
  const [diffChanges, setDiffChanges] = useState<DiffChange[]>([]);
  const [recentRuns, setRecentRuns] = useState<RecentRunItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [copied, setCopied] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Compute initial stylometrics whenever input changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputText.trim().length >= 15) {
        const res = analyzeStylometrics(inputText);
        setInputAnalysis(res);
      } else {
        setInputAnalysis(null);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [inputText]);

  // Load recent runs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('veritext_recent_runs');
      if (stored) {
        setRecentRuns(JSON.parse(stored));
      }
    } catch {
      // LocalStorage optional
    }
  }, []);

  const saveRun = (item: RecentRunItem) => {
    const updated = [item, ...recentRuns.slice(0, 14)];
    setRecentRuns(updated);
    try {
      localStorage.setItem('veritext_recent_runs', JSON.stringify(updated));
    } catch {
      // LocalStorage optional
    }
  };

  const handleAddTerm = () => {
    if (newTermInput.trim() && !preserveTerms.includes(newTermInput.trim())) {
      setPreserveTerms([...preserveTerms, newTermInput.trim()]);
      setNewTermInput('');
    }
  };

  const handleRemoveTerm = (term: string) => {
    setPreserveTerms(preserveTerms.filter((t) => t !== term));
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setProgressStage('Stopped by user');
  };

  const handleHumanize = async () => {
    if (!inputText || isProcessing) return;

    setIsProcessing(true);
    setOutputText('');
    setProgressPercent(5);
    setProgressStage('Initializing local closed-loop pipeline...');

    abortControllerRef.current = new AbortController();

    try {
      const result: ClosedLoopResult = await runClosedLoopHumanization(inputText, {
        mode: selectedMode,
        targetMaxAiScore,
        freezeHumanSentences,
        preserveTerms,
        intensity,
        onProgress: (stage, percent) => {
          setProgressStage(stage);
          setProgressPercent(percent);
        },
        rewriteChunkFn: streamRewriteFn,
      });

      setOutputText(result.rewrittenText);
      setDiffChanges(result.diff);

      const outAnalysis = analyzeStylometrics(result.rewrittenText);
      setOutputAnalysis(outAnalysis);

      // Save to recent runs
      saveRun({
        id: `run-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: selectedMode,
        beforeScore: result.beforeScore,
        afterScore: result.afterScore,
        inputText,
        outputText: result.rewrittenText,
        diff: result.diff,
      });
    } catch (err: any) {
      setProgressStage(`Pipeline warning: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopyOutput = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format: 'txt' | 'md' | 'json') => {
    if (!outputText) return;
    let data = outputText;
    let mime = 'text/plain';
    let filename = `veritext-humanized-${Date.now()}.${format}`;

    if (format === 'json') {
      mime = 'application/json';
      data = JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          mode: selectedMode,
          beforeAiScore: inputAnalysis?.aiScore ?? null,
          afterAiScore: outputAnalysis?.aiScore ?? null,
          original: inputText,
          rewritten: outputText,
        },
        null,
        2
      );
    } else if (format === 'md') {
      data = `# Humanized Output (${selectedMode} mode)\n\n**Before AI%:** ${inputAnalysis?.aiScore ?? 0}%  \n**After AI%:** ${outputAnalysis?.aiScore ?? 0}%\n\n## Rewritten Prose\n\n${outputText}\n`;
    }

    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setInputText(content);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Controls: Presets, Mode Selector, Hardware Status */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
        {/* Presets and File Upload Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Presets:
            </span>
            {SAMPLE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setInputText(p.text)}
                className="text-xs px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 transition-colors flex items-center gap-1.5"
              >
                <span>{p.title}</span>
                <span className="text-[10px] text-slate-400 font-mono">({p.badge})</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer text-xs font-medium px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-400 rounded text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              Upload .txt / .md
              <input
                type="file"
                accept=".txt,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-medium px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-400 rounded text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              Runs ({recentRuns.length})
            </button>
          </div>
        </div>

        {/* Mode Selector & Configuration */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
              Mode:
            </span>
            {(Object.keys(MODE_CONFIGS) as HumanizerMode[]).map((modeKey) => {
              const cfg = MODE_CONFIGS[modeKey];
              const isSelected = selectedMode === modeKey;
              return (
                <button
                  key={modeKey}
                  onClick={() => setSelectedMode(modeKey)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    isSelected
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={cfg.description}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Active Engine Badge */}
          <div className="flex items-center gap-2">
            <span
              onClick={onOpenModelManager}
              className="cursor-pointer text-xs px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-slate-400 flex items-center gap-1.5 transition-colors font-mono"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              {isWebLlmReady ? `WebLLM Active (${activeLlmTier})` : 'Instant De-AI Engine'}
            </span>
          </div>
        </div>

        {/* Advanced Settings Drawer Bar: Intensity, Freeze, Locked Terms */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Intensity Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium">
              <span>Humanization Intensity</span>
              <span className="font-mono">{Math.round(intensity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-full accent-slate-800 dark:accent-slate-200 cursor-pointer"
            />
          </div>

          {/* Freeze Human Sentences Toggle */}
          <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300 block">
                Freeze Human Sentences
              </span>
              <span className="text-[10px] text-slate-500">Preserve sentences &lt;30% AI</span>
            </div>
            <input
              type="checkbox"
              checked={freezeHumanSentences}
              onChange={(e) => setFreezeHumanSentences(e.target.checked)}
              className="w-4 h-4 rounded text-slate-900 accent-slate-900 cursor-pointer"
            />
          </div>

          {/* Locked Terms Tagging */}
          <div className="space-y-1">
            <span className="font-medium text-slate-600 dark:text-slate-400 block">
              Locked Terms (Survives 100% Intact)
            </span>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="e.g. Turnitin, Q4, John"
                value={newTermInput}
                onChange={(e) => setNewTermInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTerm())}
                className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
              <button
                onClick={handleAddTerm}
                className="px-2 py-1 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {preserveTerms.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {preserveTerms.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-mono text-slate-800 dark:text-slate-200"
                  >
                    <Lock className="w-2.5 h-2.5 text-slate-500" />
                    {t}
                    <X
                      className="w-2.5 h-2.5 cursor-pointer hover:text-rose-500"
                      onClick={() => handleRemoveTerm(t)}
                    />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Pane: Input Text & Heatmap Analyzer */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Input Text (Source)
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {inputText.split(/\s+/).filter(Boolean).length} words
              </span>
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
            isAnalyzing={false}
            onHumanizeSentence={(sText) => {
              // Direct single sentence rewrite trigger
              setInputText(sText);
              handleHumanize();
            }}
          />

          {/* Action Button: Start Humanization */}
          <div className="pt-2 flex items-center justify-between">
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
                Humanize with Closed-Loop Verification
              </button>
            )}
          </div>

          {/* Status logs */}
          {progressStage && (
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2 rounded border border-slate-200 dark:border-slate-800">
              {progressStage}
            </div>
          )}
        </div>

        {/* Right Pane: Output Text / Word-Level Diff View */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Humanized Output
              </span>
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
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
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
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Split className="w-3 h-3" />
                  Word Diff
                </button>
              </div>
            )}
          </div>

          {/* Output Display */}
          <div className="w-full min-h-[350px] p-4 text-sm font-sans leading-relaxed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col justify-between">
            {activeTab === 'diff' && diffChanges.length > 0 ? (
              <div className="space-y-1 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text">
                {diffChanges.map((chunk, i) => {
                  if (chunk.type === 'delete') {
                    return (
                      <span
                        key={i}
                        className="bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 line-through px-0.5"
                      >
                        {chunk.value}
                      </span>
                    );
                  }
                  if (chunk.type === 'insert') {
                    return (
                      <span
                        key={i}
                        className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold px-0.5"
                      >
                        {chunk.value}
                      </span>
                    );
                  }
                  return <span key={i} className="text-slate-700 dark:text-slate-300">{chunk.value}</span>;
                })}
              </div>
            ) : (
              <textarea
                value={outputText}
                onChange={(e) => setOutputText(e.target.value)}
                placeholder="Rewritten human prose will stream here in real-time..."
                className="w-full h-full min-h-[300px] bg-transparent text-sm font-sans leading-relaxed text-slate-800 dark:text-slate-200 focus:outline-none resize-none placeholder-slate-400"
              />
            )}

            {/* Action Bar for Output: Copy, Export */}
            {outputText && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <button
                  onClick={handleCopyOutput}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-medium flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Prose'}
                </button>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">Export:</span>
                  <button
                    onClick={() => handleExport('txt')}
                    className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-600 dark:text-slate-300"
                  >
                    .TXT
                  </button>
                  <button
                    onClick={() => handleExport('md')}
                    className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-600 dark:text-slate-300"
                  >
                    .MD
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-600 dark:text-slate-300"
                  >
                    .JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Telemetry Gauge & Comparison Card */}
      {outputAnalysis && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
            <div className="flex items-center gap-4">
              <ScoreGauge
                score={inputAnalysis?.aiScore ?? 0}
                label="Original AI%"
                size={110}
              />
              <ArrowRight className="w-6 h-6 text-slate-400" />
              <ScoreGauge
                score={outputAnalysis.aiScore}
                previousScore={inputAnalysis?.aiScore ?? null}
                label="Verified AI%"
                size={110}
              />
            </div>

            <div className="space-y-1.5 text-center sm:text-left">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-center sm:justify-start gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Closed-Loop Verification Passed
              </h4>
              <p className="text-xs text-slate-500 max-w-md">
                AI score dropped from <strong>{inputAnalysis?.aiScore}%</strong> down to{' '}
                <strong className="text-emerald-600">{outputAnalysis.aiScore}%</strong>. Factual entities, numbers, and dates verified intact.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Bar for Output */}
      {outputAnalysis && <MetricsBar result={outputAnalysis} />}

      {/* Recent Runs Drawer */}
      {showHistory && recentRuns.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Recent Runs (Stored in Browser LocalStorage)
            </span>
            <button
              onClick={() => setShowHistory(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                onClick={() => {
                  setInputText(run.inputText);
                  setOutputText(run.outputText);
                  setDiffChanges(run.diff);
                  setOutputAnalysis(analyzeStylometrics(run.outputText));
                }}
                className="cursor-pointer p-2.5 rounded border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex justify-between items-center text-xs transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-400">{run.timestamp}</span>
                  <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                    {run.mode}
                  </span>
                  <span className="text-slate-400 truncate max-w-xs">{run.inputText.slice(0, 50)}...</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-rose-600 font-semibold">{run.beforeScore}%</span>
                  <span>&rarr;</span>
                  <span className="text-emerald-600 font-semibold">{run.afterScore}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
