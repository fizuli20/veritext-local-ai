'use client';

import React from 'react';
import { SignalBreakdown, SentenceAnalysis } from '../lib/nlp/stylometrics';

interface ForensicChartsProps {
  signals?: SignalBreakdown;
  sentences?: SentenceAnalysis[];
  curvature?: number;
  robertaScore?: number;
  gltrDistribution?: {
    top10: number;
    top100: number;
    top1000: number;
    beyond1000: number;
  } | null;
  onSelectSentence?: (index: number) => void;
  selectedSentenceIndex?: number | null;
}

export function ForensicCharts({
  signals,
  sentences = [],
  curvature,
  robertaScore,
  gltrDistribution,
  onSelectSentence,
  selectedSentenceIndex,
}: ForensicChartsProps) {
  // 1. Radar Chart Coordinates for 6 (or 8) signals
  const radarDimensions = [
    { key: 'burstiness', label: 'Burstiness', value: signals?.burstiness ?? 0 },
    { key: 'clicheLexicon', label: 'Clichés', value: signals?.clicheLexicon ?? 0 },
    { key: 'syntacticUniformity', label: 'Syntax Uniformity', value: signals?.syntacticUniformity ?? 0 },
    { key: 'lexicalDiversity', label: 'Lexical Diversity', value: signals?.lexicalDiversity ?? 0 },
    { key: 'entropy', label: 'Entropy', value: signals?.entropy ?? 0 },
    { key: 'paragraphSymmetry', label: 'Para Symmetry', value: signals?.paragraphSymmetry ?? 0 },
  ];

  if (curvature !== undefined) {
    const normCurv = Math.max(0, Math.min(1, (curvature + 0.5) / 2.5));
    radarDimensions.push({ key: 'curvature', label: 'Curvature (d(x))', value: normCurv });
  }
  if (robertaScore !== undefined) {
    radarDimensions.push({ key: 'roberta', label: 'RoBERTa Neural', value: robertaScore / 100 });
  }

  const numAxes = radarDimensions.length;
  const radarRadius = 75;
  const radarCenter = 100;

  // Generate radar polygon points
  const radarPoints = radarDimensions.map((dim, i) => {
    const angle = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
    const r = radarRadius * Math.max(0.05, Math.min(1.0, dim.value));
    const x = radarCenter + r * Math.cos(angle);
    const y = radarCenter + r * Math.sin(angle);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs text-xs">
      {/* Chart 1: Sentence AI Risk Sparkline Profile */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-slate-200">Sentence AI Risk Profile</span>
          <span className="font-mono text-[10px] text-slate-400">{sentences.length} sentences</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Click any bar to locate and highlight sentence in editor.
        </p>

        {sentences.length === 0 ? (
          <div className="h-28 flex items-center justify-center text-slate-400 text-xs">
            Awaiting input text...
          </div>
        ) : (
          <div className="h-28 flex items-end gap-1 overflow-x-auto pt-2 pb-1 px-1">
            {sentences.map((s) => {
              const heightPct = Math.max(8, s.score);
              const isSelected = selectedSentenceIndex === s.index;
              let bg = 'bg-emerald-500';
              if (s.score >= 70) bg = 'bg-rose-500';
              else if (s.score >= 35) bg = 'bg-amber-500';

              return (
                <div
                  key={`spark-${s.index}`}
                  onClick={() => onSelectSentence?.(s.index)}
                  title={`Sentence #${s.index + 1}: ${s.score}% AI Risk`}
                  className={`flex-1 min-w-[8px] max-w-[20px] rounded-t cursor-pointer transition-all hover:opacity-80 ${bg} ${
                    isSelected ? 'ring-2 ring-slate-900 dark:ring-white scale-y-105' : ''
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Chart 2: 6-Signal Radar / Breakdown Matrix */}
      <div className="flex flex-col items-center justify-center">
        <div className="w-full flex items-center justify-between mb-1">
          <span className="font-semibold text-slate-800 dark:text-slate-200">Forensic Radar Matrix</span>
          <span className="font-mono text-[10px] text-indigo-500">{numAxes} signals</span>
        </div>
        <svg viewBox="0 0 200 200" className="w-44 h-44 overflow-visible">
          {/* Radar background grid circles */}
          {[0.25, 0.5, 0.75, 1.0].map((level) => (
            <circle
              key={`grid-${level}`}
              cx={radarCenter}
              cy={radarCenter}
              r={radarRadius * level}
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeDasharray={level === 1.0 ? '0' : '2,2'}
            />
          ))}

          {/* Axes spokes */}
          {radarDimensions.map((dim, i) => {
            const angle = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
            const x = radarCenter + radarRadius * Math.cos(angle);
            const y = radarCenter + radarRadius * Math.sin(angle);
            return (
              <line
                key={`spoke-${dim.key}`}
                x1={radarCenter}
                y1={radarCenter}
                x2={x}
                y2={y}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
              />
            );
          })}

          {/* Filled radar polygon */}
          <polygon
            points={radarPoints}
            fill="rgba(99, 102, 241, 0.25)"
            stroke="#6366f1"
            strokeWidth="2"
            className="transition-all duration-300"
          />

          {/* Axis Labels */}
          {radarDimensions.map((dim, i) => {
            const angle = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
            const labelR = radarRadius + 14;
            const lx = radarCenter + labelR * Math.cos(angle);
            const ly = radarCenter + labelR * Math.sin(angle);
            return (
              <text
                key={`lbl-${dim.key}`}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[9px] fill-slate-500 font-mono font-medium"
              >
                {dim.label.split(' ')[0]}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Chart 3: GLTR Token Distribution & Human Benchmark Comparison */}
      <div className="flex flex-col space-y-2 justify-between">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-slate-200">GLTR Rank Proportions</span>
          <span className="font-mono text-[10px] text-slate-400">4-Tier LM</span>
        </div>

        {gltrDistribution ? (
          <div className="space-y-3 pt-1">
            {/* Active Document Distribution Bar */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-500 mb-1">
                <span>Active Document</span>
                <span>Top10: {gltrDistribution.top10}%</span>
              </div>
              <div className="h-4 w-full flex rounded-md overflow-hidden shadow-xs">
                <div style={{ width: `${gltrDistribution.top10}%` }} className="bg-emerald-500" title={`Top 10: ${gltrDistribution.top10}%`} />
                <div style={{ width: `${gltrDistribution.top100}%` }} className="bg-amber-400" title={`Top 100: ${gltrDistribution.top100}%`} />
                <div style={{ width: `${gltrDistribution.top1000}%` }} className="bg-rose-400" title={`Top 1000: ${gltrDistribution.top1000}%`} />
                <div style={{ width: `${gltrDistribution.beyond1000}%` }} className="bg-purple-500" title={`> 1000: ${gltrDistribution.beyond1000}%`} />
              </div>
            </div>

            {/* Reference Human vs AI Baseline Bands */}
            <div className="space-y-1.5 pt-1 text-[10px] font-mono text-slate-400">
              <div className="flex items-center justify-between">
                <span>Human Reference:</span>
                <span className="text-slate-600 dark:text-slate-300">~35% / 25% / 20% / 20%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>AI Reference:</span>
                <span className="text-rose-600 dark:text-rose-400">&gt;65% / 20% / 10% / 5%</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between text-[9px] font-mono pt-1 text-slate-500 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> &lt;10</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400" /> &lt;100</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-400" /> &lt;1000</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-500" /> &gt;1000</span>
            </div>
          </div>
        ) : (
          <div className="h-28 flex flex-col items-center justify-center text-slate-400 text-xs text-center px-4">
            <span>Run 3-Signal Forensic Scan to populate Causal LM token rank distributions.</span>
          </div>
        )}
      </div>
    </div>
  );
}
