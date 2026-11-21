'use client';

import React, { useState } from 'react';
import { Download, CheckCircle2, Trash2, Cpu, HardDrive, AlertCircle } from 'lucide-react';
import { ModelDefinition, ONNX_DETECTOR_MODELS, WEBLLM_HUMANIZER_MODELS } from '@/lib/ml/model-registry';
import { clearBrowserModelCache } from '@/lib/ml/cache-manager';

interface ModelLoaderCardProps {
  hasWebGPU: boolean;
  activeDetectorModel: ModelDefinition;
  activeHumanizerTier: 'lite' | 'balanced' | 'quality';
  onSelectHumanizerTier: (tier: 'lite' | 'balanced' | 'quality') => void;
  isDetectorLoading: boolean;
  detectorProgress: { file: string; progress: number; loaded: number; total: number } | null;
  isDetectorReady: boolean;
  onLoadDetector: () => void;
  isHumanizerLoading: boolean;
  humanizerProgress: { text: string; progress: number } | null;
  isHumanizerReady: boolean;
  onLoadHumanizer: () => void;
}

export function ModelLoaderCard({
  hasWebGPU,
  activeDetectorModel,
  activeHumanizerTier,
  onSelectHumanizerTier,
  isDetectorLoading,
  detectorProgress,
  isDetectorReady,
  onLoadDetector,
  isHumanizerLoading,
  humanizerProgress,
  isHumanizerReady,
  onLoadHumanizer,
}: ModelLoaderCardProps) {
  const [clearing, setClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState<string | null>(null);

  const selectedHumanizer = WEBLLM_HUMANIZER_MODELS[activeHumanizerTier];

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const res = await clearBrowserModelCache();
      setClearStatus(`Cleared ${res.clearedKeys.length} cached model stores.`);
      setTimeout(() => setClearStatus(null), 3000);
    } catch {
      setClearStatus('Error clearing cache');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            Browser Neural Engines & Model Manager
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            100% Client-side models running in Web Workers. Weights are downloaded directly to browser Cache API.
          </p>
        </div>

        <button
          onClick={handleClearCache}
          disabled={clearing}
          className="text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 hover:border-rose-200 transition-colors self-start"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {clearing ? 'Clearing...' : 'Clear Cached Models'}
        </button>
      </div>

      {clearStatus && (
        <div className="p-2 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded">
          {clearStatus}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* RoBERTa ONNX Detector Card */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Neural AI Detector (RoBERTa ONNX)
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                ~{activeDetectorModel.sizeMB} MB
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{activeDetectorModel.description}</p>
          </div>

          {/* Progress or Actions */}
          <div className="pt-2">
            {isDetectorReady ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Loaded & Cached Locally (Offline Ready)
              </div>
            ) : isDetectorLoading ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>Downloading ONNX weights...</span>
                  <span>{detectorProgress?.progress ?? 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-800 dark:bg-slate-200 transition-all duration-300"
                    style={{ width: `${detectorProgress?.progress ?? 5}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={onLoadDetector}
                className="w-full text-xs font-medium py-2 px-3 rounded bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download Neural Detector (~{activeDetectorModel.sizeMB} MB)
              </button>
            )}
          </div>
        </div>

        {/* WebLLM Humanizer Card */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Local LLM Humanizer (WebLLM)
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                ~{selectedHumanizer.sizeMB} MB
              </span>
            </div>

            {/* Model Tier Selector */}
            <div className="flex gap-1.5 mt-2">
              {(['lite', 'balanced', 'quality'] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => onSelectHumanizerTier(tier)}
                  className={`text-[11px] px-2.5 py-1 rounded font-medium capitalize transition-colors ${
                    activeHumanizerTier === tier
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-500 mt-2">{selectedHumanizer.description}</p>
          </div>

          {/* WebGPU Status Check */}
          {!hasWebGPU ? (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <span>
                WebGPU is not enabled in this browser. The <strong>Fast Deterministic De-AI Engine</strong> and{' '}
                <strong>WASM Neural Detector</strong> work 100% without WebGPU.
              </span>
            </div>
          ) : (
            <div className="pt-2">
              {isHumanizerReady ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  {selectedHumanizer.name} Ready
                </div>
              ) : isHumanizerLoading ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span className="truncate max-w-[200px]">{humanizerProgress?.text || 'Loading weights...'}</span>
                    <span>{humanizerProgress?.progress ? Math.round(humanizerProgress.progress * 100) : 0}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-800 dark:bg-slate-200 transition-all duration-300"
                      style={{ width: `${humanizerProgress?.progress ? humanizerProgress.progress * 100 : 5}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={onLoadHumanizer}
                  className="w-full text-xs font-medium py-2 px-3 rounded bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Load {selectedHumanizer.name} (~{selectedHumanizer.sizeMB} MB)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
