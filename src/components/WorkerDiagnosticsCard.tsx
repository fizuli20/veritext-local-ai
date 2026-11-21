'use client';

import React, { useState } from 'react';
import { Activity, CheckCircle, XCircle, RefreshCw, Cpu, HardDrive } from 'lucide-react';
import { runRealWorkerDiagnostics, SystemDiagnosticsReport } from '../lib/ml/diagnostics';

export function WorkerDiagnosticsCard() {
  const [report, setReport] = useState<SystemDiagnosticsReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunDiagnostics = async () => {
    setIsRunning(true);
    try {
      const res = await runRealWorkerDiagnostics();
      setReport(res);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <h4 className="font-bold text-slate-800 dark:text-slate-200">
            Worker Truth Audit &amp; Hardware Diagnostics
          </h4>
        </div>

        <button
          onClick={handleRunDiagnostics}
          disabled={isRunning}
          className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 font-medium flex items-center gap-1.5 shadow-xs disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Auditing Workers...' : 'Run Real Worker Diagnostics'}
        </button>
      </div>

      {report ? (
        <div className="space-y-3">
          {/* Workers Status Table */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2">Web Worker Subsystem</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Handshake</th>
                  <th className="p-2">Backend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {report.workers.map((w) => (
                  <tr key={w.worker} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-2 font-sans font-medium text-slate-800 dark:text-slate-200">
                      {w.label}
                    </td>
                    <td className="p-2">
                      {w.ready ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold font-sans">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold font-sans">
                          <XCircle className="w-3.5 h-3.5" />
                          Failed: {w.error}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400">
                      {w.handshakeMs}ms
                    </td>
                    <td className="p-2 text-slate-500 uppercase">
                      {w.backend}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* WebGPU & Storage Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 font-sans">
                <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                Hardware Acceleration
              </span>
              <div className="text-slate-500 text-[10px]">
                {report.webgpu.supported ? (
                  <>
                    <div>Adapter: {report.webgpu.adapterName || 'WebGPU Active'}</div>
                    {report.webgpu.maxBufferSize && (
                      <div>Max Buffer: {Math.round(report.webgpu.maxBufferSize / (1024 * 1024))} MB</div>
                    )}
                  </>
                ) : (
                  <div>WebGPU not available on this device; running on WASM/CPU fallback.</div>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 font-sans">
                <HardDrive className="w-3.5 h-3.5 text-amber-500" />
                Browser Cache / OPFS Quota
              </span>
              <div className="text-slate-500 text-[10px]">
                {report.storage.quotaBytes ? (
                  <>
                    <div>Usage: {Math.round((report.storage.usageBytes || 0) / (1024 * 1024))} MB</div>
                    <div>Quota: {Math.round(report.storage.quotaBytes / (1024 * 1024 * 1024))} GB ({report.storage.usagePct}% used)</div>
                  </>
                ) : (
                  <div>Storage estimation not supported by browser.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-slate-500 text-[11px]">
          Click above to verify that all 5 browser Web Workers load cleanly without 404s, CORS restrictions, or silent fallback errors.
        </p>
      )}
    </div>
  );
}
