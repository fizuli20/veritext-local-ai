'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  BarChart3, 
  ShieldCheck, 
  AlertTriangle, 
  FileCheck, 
  Layers, 
  Sparkles, 
  Info,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import benchmarkData from '@/data/benchmark-results.json';

export default function BenchmarksPage() {
  const [hoveredRocPoint, setHoveredRocPoint] = useState<{ fpr: number; tpr: number; threshold: number } | null>(null);
  const [hoveredCalBin, setHoveredCalBin] = useState<(typeof benchmarkData.calibrationCurve)[0] | null>(null);

  // SVG dimensions for ROC & Calibration curves
  const width = 460;
  const height = 320;
  const margin = { top: 30, right: 30, bottom: 50, left: 55 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // ROC coordinate mapping: FPR -> X, TPR -> Y
  const mapRoc = (fpr: number, tpr: number) => ({
    x: margin.left + fpr * plotWidth,
    y: margin.top + (1 - tpr) * plotHeight,
  });

  // Calibration coordinate mapping: confidence -> X, accuracy -> Y
  const mapCal = (conf: number, acc: number) => ({
    x: margin.left + conf * plotWidth,
    y: margin.top + (1 - acc) * plotHeight,
  });

  // Sort and create ROC path
  const sortedRoc = [...benchmarkData.rocCurve].sort((a, b) => a.fpr - b.fpr || a.tpr - b.tpr);
  const rocPathD = sortedRoc.reduce((path, pt, idx) => {
    const { x, y } = mapRoc(pt.fpr, pt.tpr);
    return idx === 0 ? `M ${x} ${y}` : `${path} L ${x} ${y}`;
  }, '');

  // Fill area under ROC curve
  const firstPt = mapRoc(sortedRoc[0]?.fpr ?? 0, sortedRoc[0]?.tpr ?? 0);
  const lastPt = mapRoc(sortedRoc[sortedRoc.length - 1]?.fpr ?? 1, sortedRoc[sortedRoc.length - 1]?.tpr ?? 1);
  const rocAreaD = `${rocPathD} L ${lastPt.x} ${margin.top + plotHeight} L ${firstPt.x} ${margin.top + plotHeight} Z`;

  // Calibration active bins (with samples)
  const activeCalBins = benchmarkData.calibrationCurve.filter(b => b.sampleCount > 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background radial gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Studio</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Transparency & Calibration Benchmarks</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-medium">
              ROC-AUC {benchmarkData.metrics.auc.toFixed(3)}
            </span>
            <Link
              href="/verify"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 transition-colors font-medium"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Proof Verifier</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10 relative">
        {/* Hero Section */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Out-of-Distribution Empirical Evaluation · VeriText v4.0</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Real-World Detector Calibration & ROC Forensics
          </h1>
          <p className="text-slate-400 text-base max-w-3xl leading-relaxed">
            Most AI detectors claim 99%+ accuracy by testing solely on cliché-stuffed student essays. We benchmarked VeriText against out-of-distribution real-world corpora: subtle, hard cliché-free LLM rewrites, clinical academic literature, and encyclopedic articles. Here is our unvarnished empirical performance.
          </p>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">ROC-AUC</span>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {benchmarkData.metrics.auc.toFixed(3)}
            </div>
            <p className="text-[11px] text-slate-400">Area under ROC curve</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">TPR @ 5% FPR</span>
            <div className="text-2xl font-bold text-indigo-400 font-mono">
              {(benchmarkData.metrics.tprAt5Fpr * 100).toFixed(0)}%
            </div>
            <p className="text-[11px] text-slate-400">Recall at conservative false alarm</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">ECE Calibration</span>
            <div className="text-2xl font-bold text-amber-400 font-mono">
              {benchmarkData.metrics.ece.toFixed(3)}
            </div>
            <p className="text-[11px] text-slate-400">Expected Calibration Error</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Evaluation Corpus</span>
            <div className="text-2xl font-bold text-slate-200 font-mono">
              {benchmarkData.totalSamples}
            </div>
            <p className="text-[11px] text-slate-400">Curated holdout passages</p>
          </div>
        </div>

        {/* Dual Interactive Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Interactive ROC Curve */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  Receiver Operating Characteristic (ROC)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">True Positive Rate vs. False Positive Rate across thresholds</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/20">
                AUC {benchmarkData.metrics.auc.toFixed(3)}
              </span>
            </div>

            <div className="relative flex justify-center py-2 bg-slate-950/60 rounded-xl border border-slate-900 overflow-hidden">
              <svg width={width} height={height} className="select-none overflow-visible">
                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((val) => {
                  const x = margin.left + val * plotWidth;
                  const y = margin.top + (1 - val) * plotHeight;
                  return (
                    <g key={val} className="text-slate-800">
                      <line x1={x} y1={margin.top} x2={x} y2={margin.top + plotHeight} stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" />
                      <line x1={margin.left} y1={y} x2={margin.left + plotWidth} y2={y} stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" />
                      <text x={x} y={margin.top + plotHeight + 18} fill="#64748b" fontSize="10" textAnchor="middle" className="font-mono">{val}</text>
                      <text x={margin.left - 10} y={y + 3} fill="#64748b" fontSize="10" textAnchor="end" className="font-mono">{val}</text>
                    </g>
                  );
                })}

                {/* Random Classifier Baseline (Diagonal) */}
                <line
                  x1={margin.left}
                  y1={margin.top + plotHeight}
                  x2={margin.left + plotWidth}
                  y2={margin.top}
                  stroke="#475569"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />

                {/* Shaded Area under Curve */}
                <path d={rocAreaD} fill="url(#roc-gradient)" opacity="0.3" />

                {/* ROC Curve Path */}
                <path d={rocPathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Operating Threshold Point (Recommended threshold ~0.60) */}
                {(() => {
                  const opPt = sortedRoc.find(p => p.threshold <= 0.65) || sortedRoc[0];
                  if (!opPt) return null;
                  const { x, y } = mapRoc(opPt.fpr, opPt.tpr);
                  return (
                    <g>
                      <circle cx={x} cy={y} r="6" fill="#10b981" stroke="#047857" strokeWidth="2" className="animate-pulse" />
                      <text x={x + 10} y={y - 8} fill="#34d399" fontSize="10" fontWeight="bold">Operating Point (τ ≈ {opPt.threshold})</text>
                    </g>
                  );
                })()}

                {/* Interactive Points */}
                {sortedRoc.map((pt, i) => {
                  const { x, y } = mapRoc(pt.fpr, pt.tpr);
                  const isHovered = hoveredRocPoint?.threshold === pt.threshold;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={isHovered ? 6 : 3.5}
                      fill={isHovered ? '#6ee7b7' : '#10b981'}
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={() => setHoveredRocPoint(pt)}
                      onMouseLeave={() => setHoveredRocPoint(null)}
                    />
                  );
                })}

                {/* Axis Labels */}
                <text
                  x={margin.left + plotWidth / 2}
                  y={height - 10}
                  fill="#94a3b8"
                  fontSize="11"
                  textAnchor="middle"
                  fontWeight="500"
                >
                  False Positive Rate (1 - Specificity)
                </text>
                <text
                  x={-margin.top - plotHeight / 2}
                  y={16}
                  transform="rotate(-90)"
                  fill="#94a3b8"
                  fontSize="11"
                  textAnchor="middle"
                  fontWeight="500"
                >
                  True Positive Rate (Sensitivity)
                </text>

                {/* Gradient Def */}
                <defs>
                  <linearGradient id="roc-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Hover Tooltip Overlay */}
              {hoveredRocPoint && (
                <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1 pointer-events-none backdrop-blur-md">
                  <div className="font-semibold text-slate-200">Threshold: τ = {hoveredRocPoint.threshold}</div>
                  <div className="text-emerald-400 font-mono">TPR (Recall): {(hoveredRocPoint.tpr * 100).toFixed(1)}%</div>
                  <div className="text-rose-400 font-mono">FPR (False Alarm): {(hoveredRocPoint.fpr * 100).toFixed(1)}%</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> VeriText Forensic Classifier
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-slate-500 inline-block" /> Random Guess (AUC = 0.50)
              </span>
            </div>
          </div>

          {/* Chart 2: Calibration Reliability Curve */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Calibration Reliability Diagram
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Predicted Confidence vs. Empirical Accuracy (10 Quantile Bins)</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono border border-indigo-500/20">
                ECE {benchmarkData.metrics.ece.toFixed(3)}
              </span>
            </div>

            <div className="relative flex justify-center py-2 bg-slate-950/60 rounded-xl border border-slate-900 overflow-hidden">
              <svg width={width} height={height} className="select-none overflow-visible">
                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((val) => {
                  const x = margin.left + val * plotWidth;
                  const y = margin.top + (1 - val) * plotHeight;
                  return (
                    <g key={val} className="text-slate-800">
                      <line x1={x} y1={margin.top} x2={x} y2={margin.top + plotHeight} stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" />
                      <line x1={margin.left} y1={y} x2={margin.left + plotWidth} y2={y} stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" />
                      <text x={x} y={margin.top + plotHeight + 18} fill="#64748b" fontSize="10" textAnchor="middle" className="font-mono">{val}</text>
                      <text x={margin.left - 10} y={y + 3} fill="#64748b" fontSize="10" textAnchor="end" className="font-mono">{val}</text>
                    </g>
                  );
                })}

                {/* Perfect Calibration Diagonal */}
                <line
                  x1={margin.left}
                  y1={margin.top + plotHeight}
                  x2={margin.left + plotWidth}
                  y2={margin.top}
                  stroke="#6366f1"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />

                {/* Calibration Step Bars / Line */}
                {activeCalBins.map((bin, i) => {
                  const { x, y } = mapCal(bin.avgConfidence, bin.empiricalAccuracy);
                  const isHovered = hoveredCalBin?.binIndex === bin.binIndex;
                  return (
                    <g key={i}>
                      {/* Bar from baseline */}
                      <rect
                        x={x - 6}
                        y={y}
                        width="12"
                        height={margin.top + plotHeight - y}
                        fill={isHovered ? '#818cf8' : '#6366f1'}
                        opacity={isHovered ? 0.7 : 0.4}
                        rx="2"
                        className="transition-colors cursor-pointer"
                        onMouseEnter={() => setHoveredCalBin(bin)}
                        onMouseLeave={() => setHoveredCalBin(null)}
                      />
                      {/* Point dot */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 5 : 3.5}
                        fill={isHovered ? '#a5b4fc' : '#818cf8'}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredCalBin(bin)}
                        onMouseLeave={() => setHoveredCalBin(null)}
                      />
                    </g>
                  );
                })}

                {/* Axis Labels */}
                <text
                  x={margin.left + plotWidth / 2}
                  y={height - 10}
                  fill="#94a3b8"
                  fontSize="11"
                  textAnchor="middle"
                  fontWeight="500"
                >
                  Mean Predicted Confidence (p)
                </text>
                <text
                  x={-margin.top - plotHeight / 2}
                  y={16}
                  transform="rotate(-90)"
                  fill="#94a3b8"
                  fontSize="11"
                  textAnchor="middle"
                  fontWeight="500"
                >
                  Empirical Accuracy
                </text>
              </svg>

              {/* Hover Tooltip Overlay */}
              {hoveredCalBin && (
                <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1 pointer-events-none backdrop-blur-md">
                  <div className="font-semibold text-slate-200">
                    Bin {hoveredCalBin.confidenceLower.toFixed(1)} – {hoveredCalBin.confidenceUpper.toFixed(1)}
                  </div>
                  <div className="text-indigo-400 font-mono">
                    Avg Confidence: {(hoveredCalBin.avgConfidence * 100).toFixed(1)}%
                  </div>
                  <div className="text-emerald-400 font-mono">
                    Accuracy: {(hoveredCalBin.empiricalAccuracy * 100).toFixed(1)}%
                  </div>
                  <div className="text-slate-400 font-mono">
                    Sample Count: {hoveredCalBin.sampleCount}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" /> Empirical Bin Accuracy
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-indigo-400 inline-block" /> Perfect Calibration (y = x)
              </span>
            </div>
          </div>
        </div>

        {/* Domain False-Positive Table */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Domain-Specific False Positive Breakdown
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Stress-testing error rates across diverse linguistic domains and stealth AI rewrites
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">Evaluated on {benchmarkData.totalSamples} Blind Samples</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Corpus Domain</th>
                  <th className="py-3 px-4">Ground Truth</th>
                  <th className="py-3 px-4">Sample Size</th>
                  <th className="py-3 px-4">False Positive Rate (FPR)</th>
                  <th className="py-3 px-4 text-right">Domain Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {benchmarkData.domainResults.map((dom) => {
                  const isHuman = dom.domain === 'encyclopedic' || dom.domain === 'academic';
                  return (
                    <tr key={dom.domain} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-200 capitalize">
                        {dom.domain === 'encyclopedic' && 'Wikipedia / Encyclopedic Style'}
                        {dom.domain === 'academic' && 'ArXiv / Peer-Reviewed Clinical & Academic'}
                        {dom.domain === 'cliche-free-ai' && 'Modern Stealth AI (Zero-Cliché Rewrites)'}
                        {dom.domain === 'raw-ai' && 'Raw LLM Default Generation'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            isHuman
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {isHuman ? 'Human-Authored' : 'AI-Generated'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">{dom.samples} passages</td>
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {isHuman ? (
                          <span
                            className={
                              dom.falsePositiveRate > 15
                                ? 'text-amber-400 font-semibold'
                                : 'text-emerald-400 font-semibold'
                            }
                          >
                            {dom.falsePositiveRate}% FPR
                          </span>
                        ) : (
                          <span className="text-slate-500">N/A (True AI)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-xs text-slate-200">
                        <span className={dom.accuracy >= 90 ? 'text-emerald-400' : 'text-amber-400'}>
                          {dom.accuracy}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Limitations & Honest Disclosures Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-amber-500/30 backdrop-blur-md space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">
                Academic Honesty & Limitations Disclosure
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Statistical pattern recognition is inherently probabilistic. Here is why purely text-based detection must never be used punitively without verifiable provenance:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span>The Encyclopedic Bias</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Objective reference writing (e.g., Wikipedia) naturally exhibits low perplexity, low burstiness variance, and uniform syntax, leading to elevated false-positive risks on formulaic human prose.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Zero Guarantees Against Adversaries</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                While VeriText incorporates homoglyph stripping and curvature scoring, heavily edited or prompt-steered LLMs can mimic natural human burstiness distributions.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>The Solution: Cryptographic Proof</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Never rely solely on a probability score. Use VeriText&apos;s Proof-of-Human Studio to cryptographically record keystroke cadence, draft revisions, and sign tamper-evident authorship certificates.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80">
            <span className="text-xs text-slate-400">
              Want to provide indisputable proof of human writing to your professor or client?
            </span>
            <div className="flex items-center gap-3">
              <Link
                href="/verify"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-lg shadow-indigo-600/20"
              >
                <span>Open Offline Proof Verifier</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
