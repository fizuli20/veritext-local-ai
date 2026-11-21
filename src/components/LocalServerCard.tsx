'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Terminal,
  Cpu,
  HelpCircle,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import {
  LocalServerConfig,
  DiscoveredModel,
  LOCAL_SERVER_PRESETS,
  loadStoredServerConfig,
  saveStoredServerConfig,
  discoverLocalModels,
  classifyLocalServerError,
  LocalServerDiagnostic,
} from '../lib/humanizer/local-server-client';

interface LocalServerCardProps {
  onSelectModel?: (config: LocalServerConfig, model: DiscoveredModel) => void;
  activeConfig?: LocalServerConfig;
  className?: string;
}

export function LocalServerCard({ onSelectModel, activeConfig, className = '' }: LocalServerCardProps) {
  const [config, setConfig] = useState<LocalServerConfig>(activeConfig || loadStoredServerConfig());
  const [isScanning, setIsScanning] = useState(false);
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>(config.selectedModelId || '');
  const [diagnostic, setDiagnostic] = useState<LocalServerDiagnostic | null>(null);
  const [status, setStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    // Attempt auto-discovery on mount if URL is local
    let isMounted = true;
    void discoverLocalModels(config.baseUrl, config.apiKey).then((res) => {
      if (!isMounted) return;
      if (!res.error && res.models.length > 0) {
        setModels(res.models);
        setStatus('connected');
        const initialModel = res.models[0]?.id || '';
        const chosen = res.models.some((m) => m.id === selectedModelId) ? selectedModelId : initialModel;
        setSelectedModelId(chosen);
        const chosenModel = res.models.find((m) => m.id === chosen) || res.models[0];
        if (chosenModel && onSelectModel) {
          onSelectModel({ ...config, selectedModelId: chosen }, chosenModel);
        }
      }
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyPreset = (preset: 'lmStudio' | 'ollama') => {
    const nextCfg: LocalServerConfig = {
      ...LOCAL_SERVER_PRESETS[preset],
      selectedModelId: '',
    };
    setConfig(nextCfg);
    saveStoredServerConfig(nextCfg);
    handleDiscover(nextCfg.baseUrl);
  };

  const handleDiscover = async (urlToTest = config.baseUrl) => {
    setIsScanning(true);
    setDiagnostic(null);
    setStatus('idle');

    const res = await discoverLocalModels(urlToTest, config.apiKey);
    setIsScanning(false);

    if (res.error || res.models.length === 0) {
      const diag = classifyLocalServerError(
        res.error || (res.rawCount === 0 ? 'No models currently loaded in server' : 'Discovery failed'),
        urlToTest
      );
      setDiagnostic(diag);
      setStatus('error');
      setModels([]);
    } else {
      setModels(res.models);
      setStatus('connected');
      const initialModel = res.models[0]?.id || '';
      const chosen = res.models.some((m) => m.id === selectedModelId) ? selectedModelId : initialModel;
      setSelectedModelId(chosen);

      const updatedCfg: LocalServerConfig = {
        ...config,
        baseUrl: urlToTest,
        selectedModelId: chosen,
      };
      setConfig(updatedCfg);
      saveStoredServerConfig(updatedCfg);

      const modelObj = res.models.find((m) => m.id === chosen) || res.models[0];
      if (modelObj && onSelectModel) {
        onSelectModel(updatedCfg, modelObj);
      }
    }
  };

  const handleSelectModel = (id: string) => {
    setSelectedModelId(id);
    const updatedCfg: LocalServerConfig = {
      ...config,
      selectedModelId: id,
    };
    setConfig(updatedCfg);
    saveStoredServerConfig(updatedCfg);

    const modelObj = models.find((m) => m.id === id);
    if (modelObj && onSelectModel) {
      onSelectModel(updatedCfg, modelObj);
    }
  };

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div
      className={`p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4 text-xs ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Local Desktop Inference Engine (LM Studio / Ollama)
          </h3>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800">
            Zero-Token • Native VRAM
          </span>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2">
          {status === 'connected' && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Connected ({models.length} model{models.length > 1 ? 's' : ''})
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              Connection Issue
            </span>
          )}
          {status === 'idle' && isScanning && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Probing Server...
            </span>
          )}
        </div>
      </div>

      {/* Connection Presets & Endpoint Input */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Preset:</span>
            <button
              onClick={() => handleApplyPreset('lmStudio')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                config.baseUrl.includes(':1234')
                  ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              LM Studio (:1234)
            </button>
            <button
              onClick={() => handleApplyPreset('ollama')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                config.baseUrl.includes(':11434')
                  ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Ollama (:11434)
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            Runs at GPU speeds on your workstation with zero API keys.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => {
                const updated = { ...config, baseUrl: e.target.value };
                setConfig(updated);
                saveStoredServerConfig(updated);
              }}
              placeholder="http://localhost:1234/v1"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={() => handleDiscover()}
            disabled={isScanning || !config.baseUrl.trim()}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Connect & Detect'}
          </button>
        </div>
      </div>

      {/* Model Selection Dropdown */}
      {status === 'connected' && models.length > 0 && (
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              Active Inference Model:
            </label>
            <span className="font-mono text-[10px] text-slate-400">
              {models.find((m) => m.id === selectedModelId)?.family.toUpperCase()} Family
            </span>
          </div>

          <select
            value={selectedModelId}
            onChange={(e) => handleSelectModel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-xs text-slate-800 dark:text-slate-200 font-medium"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.isGemma ? '✦ (Gemma Anti-Slop Auto-Tuned)' : `(${m.family})`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* CORS & Server Diagnostics Doctor */}
      {diagnostic && status === 'error' && (
        <div className="p-3.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-2.5 text-xs text-rose-900 dark:text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">CORS Doctor: {diagnostic.title}</span>
              <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5">
                {diagnostic.description}
              </p>
            </div>
          </div>

          {diagnostic.fixCommand && (
            <div className="flex items-center justify-between p-2 rounded bg-slate-900 text-slate-100 font-mono text-[11px]">
              <code>{diagnostic.fixCommand}</code>
              <button
                onClick={() => handleCopyCommand(diagnostic.fixCommand!)}
                className="p-1 hover:text-indigo-400 transition-colors"
                title="Copy Command"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          <ul className="list-disc pl-5 space-y-1 text-[11px] text-rose-800 dark:text-rose-300">
            {diagnostic.instructions.map((inst, i) => (
              <li key={`inst-${i}`}>{inst}</li>
            ))}
          </ul>
        </div>
      )}

      {/* RAM-Tier Reference Guide */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between text-slate-500 font-semibold">
          <span>Recommended Model Roster by Workstation RAM:</span>
          <span className="font-mono text-[10px]">LM Studio GGUF / MLX</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[10px]">
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-bold text-slate-700 dark:text-slate-300 block">8 GB RAM / M1:</span>
            <span className="text-slate-500">Gemma 4 E4B • Qwen3.5-9B</span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-bold text-slate-700 dark:text-slate-300 block">16 GB RAM / M2-M3:</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Gemma 4 12B • StyleTune</span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-bold text-slate-700 dark:text-slate-300 block">24–32+ GB / RTX:</span>
            <span className="text-slate-500">Qwen3.8-27B • Muse Glimmer 30B</span>
          </div>
        </div>
      </div>
    </div>
  );
}
