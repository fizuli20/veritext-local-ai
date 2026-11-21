'use client';

import React from 'react';
import { StylometricResult } from '@/lib/nlp/stylometrics';
import { Activity, BookOpen, Clock, Cpu, Sparkles, Hash } from 'lucide-react';

interface MetricsBarProps {
  result: StylometricResult | null;
  latencyMs?: number;
  engine?: string;
}

export function MetricsBar({ result, latencyMs, engine = 'stylometric-instant' }: MetricsBarProps) {
  if (!result) return null;

  const { metrics, signals } = result;

  // Burstiness indicator
  let burstinessLabel = 'Jagged (Human)';
  let burstinessColor = 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400';
  if (metrics.sentenceLengthCV < 0.35) {
    burstinessLabel = 'Uniform (AI-like)';
    burstinessColor = 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400';
  } else if (metrics.sentenceLengthCV < 0.52) {
    burstinessLabel = 'Moderate';
    burstinessColor = 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400';
  }

  return (
    <div className="w-full bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs select-none">
      {/* Burstiness */}
      <div className="flex flex-col p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          Burstiness (CV)
        </span>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-sm">
            {metrics.sentenceLengthCV}
          </span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${burstinessColor}`}>
            {burstinessLabel}
          </span>
        </div>
      </div>

      {/* Lexical Diversity (MTLD) */}
      <div className="flex flex-col p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-slate-400" />
          Lexical Diversity
        </span>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-sm">
            {metrics.mtld}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">MTLD</span>
        </div>
      </div>

      {/* Trigram Entropy */}
      <div className="flex flex-col p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
          <Hash className="w-3.5 h-3.5 text-slate-400" />
          Trigram Entropy
        </span>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-sm">
            {metrics.trigramEntropy}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">bits</span>
        </div>
      </div>

      {/* Readability */}
      <div className="flex flex-col p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
          Flesch-Kincaid
        </span>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-sm">
            Grade {metrics.readability.fleschKincaidGrade}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {metrics.readability.fleschReadingEase} ease
          </span>
        </div>
      </div>

      {/* Cliché Lexicon count */}
      <div className="flex flex-col p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-slate-400" />
          LLM Clichés
        </span>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-sm">
            {metrics.clicheCount}
          </span>
          <span className="text-[10px] text-slate-500">phrases flagged</span>
        </div>
      </div>

      {/* Engine & Latency */}
      <div className="flex flex-col p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          Engine / Latency
        </span>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 truncate">
            {engine.includes('neural') ? 'RoBERTa WebGPU' : 'Pure TS Fast'}
          </span>
          {latencyMs !== undefined && (
            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {latencyMs}ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
