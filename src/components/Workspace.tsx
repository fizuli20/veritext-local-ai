'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Cpu,
  Sparkles,
  Layers,
  Settings,
  Github,
  Zap,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { probeHardwareCapabilities, HardwareCapabilities } from '@/lib/ml/capabilities';
import { ONNX_DETECTOR_MODELS, WEBLLM_HUMANIZER_MODELS, ModelDefinition } from '@/lib/ml/model-registry';
import { ModelLoaderCard } from './ModelLoaderCard';
import { HumanizerStudio } from './HumanizerStudio';
import { ScoreGauge } from './ScoreGauge';
import { HeatmapEditor } from './HeatmapEditor';
import { MetricsBar } from './MetricsBar';
import { analyzeStylometrics, StylometricResult } from '@/lib/nlp/stylometrics';
import { HumanizerMode } from '@/lib/humanizer/prompts';

export function Workspace() {
  const [activeTab, setActiveTab] = useState<'detector' | 'humanizer'>('humanizer');
  const [hardware, setHardware] = useState<HardwareCapabilities | null>(null);

  // Model States
  const [showModelManager, setShowModelManager] = useState(false);
  const [humanizerTier, setHumanizerTier] = useState<'lite' | 'balanced' | 'quality'>('lite');

  // Detector Worker States
  const [detectorWorker, setDetectorWorker] = useState<Worker | null>(null);
  const [isDetectorLoading, setIsDetectorLoading] = useState(false);
  const [detectorProgress, setDetectorProgress] = useState<{ file: string; progress: number; loaded: number; total: number } | null>(null);
  const [isDetectorReady, setIsDetectorReady] = useState(false);

  // Humanizer Worker States
  const [humanizerWorker, setHumanizerWorker] = useState<Worker | null>(null);
  const [isHumanizerLoading, setIsHumanizerLoading] = useState(false);
  const [humanizerProgress, setHumanizerProgress] = useState<{ text: string; progress: number } | null>(null);
  const [isHumanizerReady, setIsHumanizerReady] = useState(false);

  // Standalone Detector Tab States
  const [detectorText, setDetectorText] = useState(
    `In today's fast-paced world, artificial intelligence plays a pivotal role in transforming modern education. It is worth noting that adaptive learning platforms delve into student performance metrics to provide a comprehensive overview of academic progress. Furthermore, navigating the complexities of digital classrooms highlights the multifaceted nature of contemporary pedagogy.`
  );
  const [detectorResult, setDetectorResult] = useState<StylometricResult | null>(null);
  const [detectorLatency, setDetectorLatency] = useState<number>(0);
  const [detectorEngine, setDetectorEngine] = useState<string>('stylometric-instant');

  // Probe hardware on mount
  useEffect(() => {
    probeHardwareCapabilities().then((cap) => {
      setHardware(cap);
      if (cap.hasWebGPU) {
        setHumanizerTier('lite');
      }
    });
  }, []);

  // Compute detector tab results on change
  useEffect(() => {
    if (detectorText.trim().length >= 15) {
      const start = performance.now();
      const res = analyzeStylometrics(detectorText);
      setDetectorLatency(Math.round((performance.now() - start) * 10) / 10);
      setDetectorResult(res);
      setDetectorEngine('stylometric-instant');
    } else {
      setDetectorResult(null);
    }
  }, [detectorText]);

  // Load Neural Detector Worker
  const handleLoadDetector = () => {
    if (typeof window === 'undefined' || detectorWorker || isDetectorLoading) return;
    setIsDetectorLoading(true);

    try {
      const worker = new Worker(new URL('../workers/detector.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (e) => {
        const { type } = e.data;
        if (type === 'download-progress') {
          setDetectorProgress({
            file: e.data.file,
            progress: e.data.progress,
            loaded: e.data.loaded,
            total: e.data.total,
          });
        } else if (type === 'ready') {
          setIsDetectorReady(true);
          setIsDetectorLoading(false);
        } else if (type === 'result') {
          setDetectorResult(e.data.stylometricResult);
          setDetectorEngine(e.data.engine);
        }
      };

      worker.postMessage({ type: 'init', device: hardware?.hasWebGPU ? 'webgpu' : 'wasm' });
      setDetectorWorker(worker);
    } catch {
      setIsDetectorLoading(false);
    }
  };

  // Load WebLLM Humanizer Engine
  const handleLoadHumanizer = async () => {
    if (typeof window === 'undefined' || isHumanizerLoading) return;
    setIsHumanizerLoading(true);

    try {
      const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
      const selectedModelId = WEBLLM_HUMANIZER_MODELS[humanizerTier].id;

      const worker = new Worker(new URL('../workers/humanizer.worker.ts', import.meta.url), {
        type: 'module',
      });

      const engine = await CreateWebWorkerMLCEngine(worker, selectedModelId, {
        initProgressCallback: (report) => {
          setHumanizerProgress({
            text: report.text,
            progress: report.progress,
          });
        },
      });

      setIsHumanizerReady(true);
      setIsHumanizerLoading(false);
      setHumanizerWorker(worker);
    } catch (err: any) {
      setIsHumanizerLoading(false);
      console.warn('WebLLM load failed, fallback to Deterministic Engine:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Global Navigation Bar */}
      <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 font-bold font-mono text-sm shadow-sm">
            Vx
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100">
                Veritext
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Local AI
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              100% Zero-Token, Zero-API-Key Browser AI &amp; Pure TS Stylometrics
            </p>
          </div>
        </div>

        {/* Local AI Engine Status Pill */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setShowModelManager(true)}
            className="cursor-pointer hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-600 text-xs transition-colors"
            title="Click to view hardware details and manage cached model weights"
          >
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <span
                className={`w-2 h-2 rounded-full ${
                  hardware?.hasWebGPU ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="text-slate-700 dark:text-slate-300">
                {hardware?.hasWebGPU ? 'WebGPU Ready' : 'WASM Only'}
              </span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-500 text-[11px] font-mono">
              {isDetectorReady ? 'RoBERTa Cached' : 'Instant Stylometrics'}
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-500 text-[11px] font-mono">
              {isHumanizerReady ? 'WebLLM Ready' : 'Instant Cleaner'}
            </span>
          </div>

          <button
            onClick={() => setShowModelManager(!showModelManager)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
            title="Model Manager"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Engine Manager</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('humanizer')}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'humanizer'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Humanizer Studio
            </button>

            <button
              onClick={() => setActiveTab('detector')}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'detector'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              <Shield className="w-4 h-4" />
              AI Detector
            </button>
          </div>

          <div className="text-xs text-slate-500 font-mono hidden sm:block">
            Zero API Keys &bull; Zero Server Latency &bull; Zero Data Egress
          </div>
        </div>

        {/* Model Manager Drawer / Card */}
        {showModelManager && (
          <ModelLoaderCard
            hasWebGPU={hardware?.hasWebGPU ?? false}
            activeDetectorModel={ONNX_DETECTOR_MODELS.primary!}
            activeHumanizerTier={humanizerTier}
            onSelectHumanizerTier={setHumanizerTier}
            isDetectorLoading={isDetectorLoading}
            detectorProgress={detectorProgress}
            isDetectorReady={isDetectorReady}
            onLoadDetector={handleLoadDetector}
            isHumanizerLoading={isHumanizerLoading}
            humanizerProgress={humanizerProgress}
            isHumanizerReady={isHumanizerReady}
            onLoadHumanizer={handleLoadHumanizer}
          />
        )}

        {/* Tab 1: Humanizer Studio */}
        {activeTab === 'humanizer' && (
          <HumanizerStudio
            onOpenModelManager={() => setShowModelManager(true)}
            isWebLlmReady={isHumanizerReady}
            activeLlmTier={humanizerTier}
          />
        )}

        {/* Tab 2: Standalone AI Detector */}
        {activeTab === 'detector' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Editor & Heatmap */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Text to Analyze
                  </span>
                  <span className="font-mono text-slate-500">
                    {detectorText.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>

                <HeatmapEditor
                  rawText={detectorText}
                  onChangeText={setDetectorText}
                  sentences={detectorResult?.sentences ?? []}
                  isAnalyzing={false}
                />
              </div>

              {/* Right Col: Score Gauge & Breakdown */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col items-center">
                  <ScoreGauge
                    score={detectorResult?.aiScore ?? 0}
                    label="AI Score"
                    size={140}
                  />

                  {detectorResult && (
                    <div className="w-full mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Classification</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {detectorResult.isAi ? 'AI-Generated' : 'Authentic Human'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Confidence</span>
                        <span className="capitalize font-mono text-slate-800 dark:text-slate-200">
                          {detectorResult.confidence}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sentence Count</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {detectorResult.sentences.length}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Signals Breakdown */}
                {detectorResult && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm text-xs space-y-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block uppercase tracking-wider text-[11px]">
                      Six Normalized Stylometric Signals
                    </span>
                    <div className="space-y-2">
                      {Object.entries(detectorResult.signals).map(([key, val]) => (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="capitalize text-slate-600 dark:text-slate-400">
                              {key.replace(/([A-Z])/g, ' $1')}
                            </span>
                            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {Math.round(val * 100)}%
                            </span>
                          </div>
                          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-700 dark:bg-slate-300"
                              style={{ width: `${Math.round(val * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Metrics Bar */}
            {detectorResult && (
              <MetricsBar
                result={detectorResult}
                latencyMs={detectorLatency}
                engine={detectorEngine}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-4 px-4 lg:px-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>&copy; {new Date().getFullYear()} Veritext Local AI. 100% Free, Zero-Token, Zero-API-Key Architecture.</p>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span>Privacy Guaranteed: No text leaves browser memory</span>
        </div>
      </footer>
    </div>
  );
}
