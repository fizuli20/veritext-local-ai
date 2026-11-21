'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Cpu,
  Sparkles,
  Settings,
  Github,
  CheckCircle2,
  UserCheck,
  FileCheck,
  Trash2,
  HelpCircle,
  X,
  Activity,
} from 'lucide-react';
import { probeHardwareCapabilities, HardwareCapabilities } from '@/lib/ml/capabilities';
import {
  ONNX_DETECTOR_MODELS,
  PERPLEXITY_MODELS,
} from '@/lib/ml/model-registry';
import { memoryScheduler } from '@/lib/ml/scheduler';
import { ModelLoaderCard } from './ModelLoaderCard';
import { HumanizerStudio } from './HumanizerStudio';
import { ScoreGauge } from './ScoreGauge';
import { HeatmapEditor } from './HeatmapEditor';
import { MetricsBar } from './MetricsBar';
import { analyzeStylometrics, StylometricResult } from '@/lib/nlp/stylometrics';
import { DomainProfile, DOMAIN_PROFILES } from '@/lib/nlp/calibration';
import { GLTRToken } from '@/workers/perplexity.worker';
import {
  VoiceProfile,
  loadStoredVoiceProfiles,
  saveVoiceProfile,
  deleteVoiceProfile,
} from '@/lib/nlp/voice-profile';
import { generateForensicHtmlReport, ForensicReportData } from '@/lib/io/documents';

export function Workspace() {
  const [activeTab, setActiveTab] = useState<'detector' | 'humanizer'>('humanizer');
  const [hardware, setHardware] = useState<HardwareCapabilities | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainProfile>('general');

  // Model & Scheduler States
  const [showModelManager, setShowModelManager] = useState(false);
  const [showVoiceDrawer, setShowVoiceDrawer] = useState(false);
  const [showKeyboardModal, setShowKeyboardModal] = useState(false);
  const [humanizerTier, setHumanizerTier] = useState<'lite' | 'balanced' | 'quality'>('lite');

  // Detector Worker States
  const [detectorWorker, setDetectorWorker] = useState<Worker | null>(null);
  const [isDetectorLoading, setIsDetectorLoading] = useState(false);
  const [detectorProgress, setDetectorProgress] = useState<{ file: string; progress: number; loaded: number; total: number } | null>(null);
  const [isDetectorReady, setIsDetectorReady] = useState(false);
  const [, setRobertaScore] = useState<number | undefined>(undefined);

  // Perplexity & GLTR Worker States
  const [pplWorker, setPplWorker] = useState<Worker | null>(null);
  const [isPplLoading, setIsPplLoading] = useState(false);
  const [isPplReady, setIsPplReady] = useState(false);
  const [gltrTokens, setGltrTokens] = useState<GLTRToken[]>([]);
  const [documentPpl, setDocumentPpl] = useState<number | null>(null);
  const [gltrDistribution, setGltrDistribution] = useState<{ top10: number; top100: number; top1000: number; beyond1000: number } | null>(null);

  // Humanizer Worker States
  const [humanizerWorker, setHumanizerWorker] = useState<Worker | null>(null);
  const [isHumanizerLoading, setIsHumanizerLoading] = useState(false);
  const [humanizerProgress, setHumanizerProgress] = useState<{ text: string; progress: number } | null>(null);
  const [isHumanizerReady, setIsHumanizerReady] = useState(false);

  // Voice Profiles
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [activeVoiceProfile, setActiveVoiceProfile] = useState<VoiceProfile | null>(null);
  const [newVoiceName, setNewVoiceName] = useState('');
  const [newVoiceSample, setNewVoiceSample] = useState('');

  // Offline PWA State
  const [isOfflineReady, setIsOfflineReady] = useState(false);

  // Standalone Detector Tab States
  const [detectorText, setDetectorText] = useState(
    `In today's fast-paced world, artificial intelligence plays a pivotal role in transforming modern education. It is worth noting that adaptive learning platforms delve into student performance metrics to provide a comprehensive overview of academic progress. Furthermore, navigating the complexities of digital classrooms highlights the multifaceted nature of contemporary pedagogy.`
  );
  const [detectorResult, setDetectorResult] = useState<StylometricResult | null>(null);
  const [detectorLatency, setDetectorLatency] = useState<number>(0);
  const [detectorEngine, setDetectorEngine] = useState<string>('stylometric-instant');

  // Register PWA Service Worker & Probe hardware on mount
  useEffect(() => {
    probeHardwareCapabilities().then((cap) => {
      setHardware(cap);
    });

    if (typeof window !== 'undefined') {
      setVoiceProfiles(loadStoredVoiceProfiles());

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js')
          .then(() => setIsOfflineReady(true))
          .catch(() => setIsOfflineReady(false));
      }
    }
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setShowKeyboardModal(true);
      }
      if (e.altKey && e.key === '1') {
        setActiveTab('detector');
      } else if (e.altKey && e.key === '2') {
        setActiveTab('humanizer');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute detector tab results on change
  useEffect(() => {
    if (detectorText.trim().length >= 15) {
      const start = performance.now();
      const res = analyzeStylometrics(detectorText, selectedDomain);
      setDetectorLatency(Math.round((performance.now() - start) * 10) / 10);
      setDetectorResult(res);
      setDetectorEngine('stylometric-instant');
    } else {
      setDetectorResult(null);
    }
  }, [detectorText, selectedDomain]);

  // Load Neural RoBERTa Worker
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
            loaded: e.data.loaded ?? 0,
            total: e.data.total ?? 100,
          });
        } else if (type === 'ready') {
          setIsDetectorReady(true);
          setIsDetectorLoading(false);
        } else if (type === 'result') {
          const neuralScore = e.data.neuralScore;
          setRobertaScore(neuralScore);
          setDetectorResult(e.data.stylometricResult);
          setDetectorLatency(e.data.latencyMs);
          setDetectorEngine('neural-roberta-ensemble');
        }
      };

      const primaryId = ONNX_DETECTOR_MODELS.primary?.id ?? 'onnx-community/chatgpt-detector-roberta-ONNX';
      worker.postMessage({ type: 'init', modelId: primaryId });
      setDetectorWorker(worker);
      memoryScheduler.registerWorker('detector', worker, primaryId);
    } catch (err) {
      console.error('Failed to instantiate detector worker:', err);
      setIsDetectorLoading(false);
    }
  };

  // Load Perplexity & GLTR Worker
  const handleLoadPerplexity = () => {
    if (typeof window === 'undefined' || pplWorker || isPplLoading) return;
    setIsPplLoading(true);

    try {
      const worker = new Worker(new URL('../workers/perplexity.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'INIT_COMPLETE' || (type === 'STATUS' && payload?.status === 'ready')) {
          setIsPplReady(true);
          setIsPplLoading(false);
        } else if (type === 'PERPLEXITY_RESULT') {
          setGltrTokens(payload.gltrTokens);
          setDocumentPpl(payload.documentPerplexity);
          setGltrDistribution(payload.gltrDistribution);
          setDetectorEngine('3-signal-forensic-ensemble');
        }
      };

      const primaryPplId = PERPLEXITY_MODELS.primary?.id ?? 'onnx-community/gpt2-ONNX';
      worker.postMessage({ type: 'INIT', payload: { useWebGPU: hardware?.hasWebGPU ?? true } });
      setPplWorker(worker);
      memoryScheduler.registerWorker('perplexity', worker, primaryPplId);
    } catch (err) {
      console.error('Failed to load perplexity worker:', err);
      setIsPplLoading(false);
    }
  };

  const handleLoadHumanizer = () => {
    if (typeof window === 'undefined' || humanizerWorker || isHumanizerLoading) return;
    setIsHumanizerLoading(true);
    try {
      const worker = new Worker(new URL('../workers/humanizer.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e) => {
        const { type } = e.data;
        if (type === 'init-progress') {
          setHumanizerProgress({ text: e.data.text, progress: e.data.progress });
        } else if (type === 'ready') {
          setIsHumanizerReady(true);
          setIsHumanizerLoading(false);
        }
      };
      setHumanizerWorker(worker);
      memoryScheduler.registerWorker('humanizer', worker);
    } catch (err) {
      console.error('Failed to load humanizer worker:', err);
      setIsHumanizerLoading(false);
    }
  };

  // Run 3-Signal Forensic Scan
  const handleRunFullForensicScan = () => {
    if (!detectorText.trim()) return;

    if (detectorWorker && isDetectorReady) {
      detectorWorker.postMessage({
        type: 'classify',
        text: detectorText,
        stylometricResult: analyzeStylometrics(detectorText, selectedDomain),
      });
    }

    if (pplWorker && isPplReady) {
      const stylo = analyzeStylometrics(detectorText, selectedDomain);
      pplWorker.postMessage({
        type: 'ANALYZE_PERPLEXITY',
        payload: {
          text: detectorText,
          sentences: stylo.sentences,
          useWebGPU: hardware?.hasWebGPU ?? true,
        },
      });
    } else {
      handleLoadPerplexity();
    }
  };

  // Unload Models Panic Button
  const handlePanicUnload = () => {
    memoryScheduler.unloadAllModels();
    setDetectorWorker(null);
    setIsDetectorReady(false);
    setIsDetectorLoading(false);
    setPplWorker(null);
    setIsPplReady(false);
    setIsPplLoading(false);
    setHumanizerWorker(null);
    setIsHumanizerReady(false);
    setIsHumanizerLoading(false);
    setGltrTokens([]);
    setDocumentPpl(null);
    setRobertaScore(undefined);
  };

  // Voice Profile Handlers
  const handleSaveVoice = () => {
    if (!newVoiceName.trim() || newVoiceSample.trim().length < 80) return;
    const profile = saveVoiceProfile(newVoiceName.trim(), 'Personal custom style', newVoiceSample.trim());
    setVoiceProfiles(loadStoredVoiceProfiles());
    setActiveVoiceProfile(profile);
    setNewVoiceName('');
    setNewVoiceSample('');
  };

  const handleDeleteVoice = (id: string) => {
    deleteVoiceProfile(id);
    setVoiceProfiles(loadStoredVoiceProfiles());
    if (activeVoiceProfile?.id === id) setActiveVoiceProfile(null);
  };

  // Printable HTML Report Export
  const handleExportForensicReport = () => {
    if (!detectorResult) return;

    const reportData: ForensicReportData = {
      documentTitle: 'Authorship & AI Detection Forensic Audit',
      timestamp: new Date().toISOString(),
      overallAiScore: detectorResult.aiScore,
      confidenceInterval: {
        score: detectorResult.aiScore,
        margin: 5,
        lower: Math.max(0, detectorResult.aiScore - 5),
        upper: Math.min(100, detectorResult.aiScore + 5),
        reliability: 'high',
        mixedOrEdited: detectorResult.aiScore >= 40 && detectorResult.aiScore <= 65,
      },
      isAi: detectorResult.isAi,
      domainProfile: DOMAIN_PROFILES[selectedDomain]?.name ?? 'General',
      wordCount: detectorResult.metrics.wordCount,
      sentenceCount: detectorResult.metrics.sentenceCount,
      burstinessCV: detectorResult.metrics.sentenceLengthCV,
      mtld: detectorResult.metrics.mtld,
      fleschKincaidGrade: detectorResult.metrics.readability.fleschKincaidGrade,
      gltrDistribution: gltrDistribution ?? undefined,
      obfuscationReport: detectorResult.obfuscationReport,
      sentences: detectorResult.sentences,
    };

    const html = generateForensicHtmlReport(reportData);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veritext-audit-report-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
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
                v2.0 Max
              </span>
              {isOfflineReady && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Offline-Ready
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              100% Zero-Token, Zero-API-Key Forensic AI Detector &amp; Tournament Humanizer
            </p>
          </div>
        </div>

        {/* Action Controls & Hardware Pill */}
        <div className="flex items-center gap-3">
          {/* Hardware Capability Pill */}
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
                {hardware?.hasWebGPU ? 'WebGPU Active' : 'WASM Only'}
              </span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-500 text-[11px] font-mono">
              3-Signal Forensic
            </span>
          </div>

          {/* Model Manager Drawer Toggle */}
          <button
            onClick={() => setShowModelManager(!showModelManager)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            title="Model & VRAM Manager"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Models</span>
          </button>

          {/* Shortcuts Help */}
          <button
            onClick={() => setShowKeyboardModal(true)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-500 hover:text-slate-800 text-xs"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* GitHub Link */}
          <a
            href="https://github.com/fizuli20/veritext-local-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1 transition-colors shadow-xs"
            title="GitHub Repository"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline font-mono font-medium">v2.0.0</span>
          </a>
        </div>
      </header>

      {/* Main Studio Navigation Tabs */}
      <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 pt-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('humanizer')}
              className={`px-4 py-2 rounded-lg font-medium text-xs flex items-center gap-2 transition-colors ${
                activeTab === 'humanizer'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Humanizer Studio &amp; Tournament
            </button>
            <button
              onClick={() => setActiveTab('detector')}
              className={`px-4 py-2 rounded-lg font-medium text-xs flex items-center gap-2 transition-colors ${
                activeTab === 'detector'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              3-Signal Forensic Detector &amp; GLTR
            </button>
          </div>
        </div>
      </div>

      {/* Workspace Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {/* Model Manager Drawer / Card */}
        {showModelManager && (
          <div className="mb-6">
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
            <div className="mt-2 flex justify-end">
              <button
                onClick={handlePanicUnload}
                className="py-1.5 px-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Unload Models from VRAM
              </button>
            </div>
          </div>
        )}

        {activeTab === 'humanizer' ? (
          <HumanizerStudio
            onOpenModelManager={() => setShowModelManager(true)}
            isWebLlmReady={isHumanizerReady}
            activeLlmTier={humanizerTier}
            domain={selectedDomain}
            onChangeDomain={setSelectedDomain}
            activeVoiceProfile={activeVoiceProfile?.fingerprint}
            voiceProfileName={activeVoiceProfile?.name}
            onOpenVoiceCloning={() => setShowVoiceDrawer(true)}
          />
        ) : (
          /* Standalone 3-Signal Forensic Detector Tab */
          <div className="flex flex-col space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Domain Profile:
                </span>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value as DomainProfile)}
                  className="text-xs py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                >
                  {Object.values(DOMAIN_PROFILES).map((dp) => (
                    <option key={dp.id} value={dp.id}>
                      {dp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunFullForensicScan}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Run 3-Signal Forensic Scan (RoBERTa + GLTR)
                </button>
                <button
                  onClick={handleExportForensicReport}
                  disabled={!detectorResult}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 font-medium text-xs flex items-center gap-1.5 disabled:opacity-40"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  Export Audit Report (.html)
                </button>
              </div>
            </div>

            {/* Score & Gauge Section */}
            {detectorResult && (
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="flex justify-center">
                  <ScoreGauge
                    score={detectorResult.aiScore}
                    label="Composite AI Probability"
                    size={170}
                  />
                </div>
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        detectorResult.aiScore >= 70
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                          : detectorResult.aiScore >= 35
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {detectorResult.aiScore >= 70
                        ? 'Likely AI-Generated'
                        : detectorResult.aiScore >= 35
                          ? 'Mixed / Heavily Edited'
                          : 'Human Written'}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      Confidence: {detectorResult.confidence} (±5%)
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Evaluated under the{' '}
                    <strong>{DOMAIN_PROFILES[selectedDomain]?.name}</strong> profile.
                    Stylometric variance, sentence burstiness ({detectorResult.metrics.sentenceLengthCV} CV), and lexical diversity ({detectorResult.metrics.mtld} MTLD) were synthesized with local token distributions.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px] text-slate-500">
                    <span>Engine: {detectorEngine}</span>
                    <span>•</span>
                    <span>Latency: {detectorLatency}ms</span>
                    {documentPpl && (
                      <>
                        <span>•</span>
                        <span>Perplexity: {documentPpl}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Heatmap & GLTR Token X-Ray Editor */}
            <div className="space-y-2">
              <HeatmapEditor
                rawText={detectorText}
                onChangeText={setDetectorText}
                sentences={detectorResult?.sentences ?? []}
                gltrTokens={gltrTokens}
                obfuscationReport={detectorResult?.obfuscationReport}
                isAnalyzing={isDetectorLoading || isPplLoading}
              />
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

      {/* Voice Cloning Drawer ("Match My Style") */}
      {showVoiceDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full p-6 shadow-2xl overflow-y-auto space-y-5 border-l border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Personal Voice Profiles
                </h3>
              </div>
              <button onClick={() => setShowVoiceDrawer(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">
              Paste 150–600 words of your own authentic writing to extract your quantitative rhythm, burstiness, and contraction profile. The tournament humanizer will mirror your exact voice.
            </p>

            {/* Form */}
            <div className="space-y-3">
              <input
                type="text"
                value={newVoiceName}
                onChange={(e) => setNewVoiceName(e.target.value)}
                placeholder="Profile Name (e.g. My Personal Essay Voice)"
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
              <textarea
                value={newVoiceSample}
                onChange={(e) => setNewVoiceSample(e.target.value)}
                placeholder="Paste your writing sample here (minimum 80 words)..."
                className="w-full h-32 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs resize-none"
              />
              <button
                onClick={handleSaveVoice}
                disabled={!newVoiceName.trim() || newVoiceSample.trim().length < 80}
                className="w-full py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-medium text-xs disabled:opacity-40"
              >
                Extract Fingerprint &amp; Save Profile
              </button>
            </div>

            {/* Saved Profiles */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[11px]">
                Saved Voice Profiles ({voiceProfiles.length})
              </span>
              {voiceProfiles.map((vp) => (
                <div
                  key={vp.id}
                  className={`p-3 rounded-lg border flex justify-between items-start ${
                    activeVoiceProfile?.id === vp.id
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-bold text-slate-800 dark:text-slate-200">{vp.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      Mean: {vp.fingerprint.meanSentenceLength}w • CV: {vp.fingerprint.sentenceLengthCV} • Contractions: {vp.fingerprint.contractionRate}%
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setActiveVoiceProfile(vp)}
                      className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white text-[10px] font-medium"
                    >
                      {activeVoiceProfile?.id === vp.id ? 'Active' : 'Select'}
                    </button>
                    <button
                      onClick={() => handleDeleteVoice(vp.id)}
                      className="p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-sm w-full p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Keyboard Shortcuts</span>
              <button onClick={() => setShowKeyboardModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 font-mono text-slate-700 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Alt + 1</span>
                <span>Switch to Detector</span>
              </div>
              <div className="flex justify-between">
                <span>Alt + 2</span>
                <span>Switch to Humanizer</span>
              </div>
              <div className="flex justify-between">
                <span>?</span>
                <span>Open this help dialog</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-4 px-4 lg:px-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 Veritext Local AI v2.0 Max. 100% Free, Zero-Token Architecture.</p>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span>Privacy: No text leaves browser RAM</span>
        </div>
      </footer>
    </div>
  );
}
