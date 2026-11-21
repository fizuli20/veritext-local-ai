'use client';

import React, { useState } from 'react';
import { SentenceAnalysis } from '@/lib/nlp/stylometrics';
import { GLTRToken } from '@/workers/perplexity.worker';
import { ObfuscationReport } from '@/lib/nlp/sanitizer';
import { Sparkles, Info, X, Eye, ShieldAlert, Cpu } from 'lucide-react';

interface HeatmapEditorProps {
  rawText: string;
  onChangeText: (text: string) => void;
  sentences: SentenceAnalysis[];
  gltrTokens?: GLTRToken[];
  obfuscationReport?: ObfuscationReport;
  isAnalyzing: boolean;
  onHumanizeSentence?: (sentenceText: string, index: number) => void;
  readOnly?: boolean;
  selectedSentenceIndex?: number | null;
  onSelectSentence?: (index: number) => void;
}

export function HeatmapEditor({
  rawText,
  onChangeText,
  sentences,
  gltrTokens = [],
  obfuscationReport,
  isAnalyzing,
  onHumanizeSentence,
  readOnly = false,
  selectedSentenceIndex,
  onSelectSentence,
}: HeatmapEditorProps) {
  const [selectedSentence, setSelectedSentence] = useState<SentenceAnalysis | null>(null);
  const [hoveredGltr, setHoveredGltr] = useState<GLTRToken | null>(null);
  const [viewMode, setViewMode] = useState<'heatmap' | 'gltr' | 'edit'>('heatmap');

  React.useEffect(() => {
    if (selectedSentenceIndex !== undefined && selectedSentenceIndex !== null) {
      const match = sentences.find((s) => s.index === selectedSentenceIndex);
      if (match) setSelectedSentence(match);
    }
  }, [selectedSentenceIndex, sentences]);

  const hasGltr = gltrTokens.length > 0;

  return (
    <div className="relative w-full min-h-[380px] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
      {/* Obfuscation Alert Banner */}
      {obfuscationReport && obfuscationReport.detected && (
        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-md flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 animate-fadeIn">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Adversarial Obfuscation Detected & Normalized:</span>
            <span className="ml-1 text-amber-800 dark:text-amber-300">
              Found {obfuscationReport.zeroWidthCount} zero-width / invisible characters and {obfuscationReport.homoglyphCount} confusable homoglyphs. Text was automatically neutralized for analysis.
            </span>
            {obfuscationReport.flaggedTokens.length > 0 && (
              <div className="mt-1 font-mono text-[10px] text-amber-700 dark:text-amber-400">
                Flagged tokens: {obfuscationReport.flaggedTokens.slice(0, 6).join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode Controls Header */}
      <div className="flex flex-wrap justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs gap-2">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/50">
          <button
            onClick={() => setViewMode('heatmap')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewMode === 'heatmap'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Sentence Heatmap
          </button>
          <button
            onClick={() => setViewMode('gltr')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
              viewMode === 'gltr'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3 h-3 text-indigo-500" />
            GLTR Token X-Ray {hasGltr && `(${gltrTokens.length})`}
          </button>
          <button
            onClick={() => setViewMode('edit')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewMode === 'edit'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Edit Text
          </button>
        </div>

        {/* Legend */}
        {viewMode === 'heatmap' && (
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;30% Human
            </span>
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> 30-69% Mixed
            </span>
            <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> &ge;70% AI
            </span>
          </div>
        )}

        {viewMode === 'gltr' && (
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <span className="flex items-center gap-1 text-emerald-600">
              <span className="w-2 h-2 rounded bg-emerald-500/80" /> Top 10
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <span className="w-2 h-2 rounded bg-amber-400/80" /> Top 100
            </span>
            <span className="flex items-center gap-1 text-rose-600">
              <span className="w-2 h-2 rounded bg-rose-400/80" /> Top 1000
            </span>
            <span className="flex items-center gap-1 text-purple-600">
              <span className="w-2 h-2 rounded bg-purple-500/80" /> &gt;1000 Human
            </span>
          </div>
        )}
      </div>

      {/* Editor Content Area */}
      {viewMode === 'edit' || sentences.length === 0 ? (
        <div className="relative w-full h-full min-h-[300px] flex-1">
          <textarea
            value={rawText}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder="Paste or write prose here to analyze with 100% local stylometrics and browser neural AI..."
            className="w-full h-full min-h-[300px] p-2 text-sm font-sans leading-relaxed bg-transparent border-0 focus:outline-none resize-y text-slate-800 dark:text-slate-200 placeholder-slate-400"
            readOnly={readOnly}
          />
        </div>
      ) : viewMode === 'gltr' ? (
        // GLTR Token X-Ray View
        <div className="relative flex-1 text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-sans select-text">
          {!hasGltr ? (
            <div className="p-6 text-center text-xs text-slate-500">
              <Cpu className="w-5 h-5 mx-auto mb-2 text-slate-400" />
              GLTR Token X-Ray requires the Causal LM Perplexity worker. Click &quot;Run 3-Signal Forensic Scan&quot; to inspect next-token distributions.
            </div>
          ) : (
            <div className="p-1 whitespace-pre-wrap leading-relaxed">
              {gltrTokens.map((t, idx) => {
                let badgeClass = 'bg-purple-100 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200 border-b border-purple-400';
                if (t.bucket === 'top10') {
                  badgeClass = 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 border-b border-emerald-400';
                } else if (t.bucket === 'top100') {
                  badgeClass = 'bg-amber-100 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 border-b border-amber-400';
                } else if (t.bucket === 'top1000') {
                  badgeClass = 'bg-rose-100 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 border-b border-rose-400';
                }

                return (
                  <span
                    key={`gltr-${idx}`}
                    onMouseEnter={() => setHoveredGltr(t)}
                    onMouseLeave={() => setHoveredGltr(null)}
                    className={`inline-block px-0.5 rounded cursor-pointer transition-colors ${badgeClass}`}
                  >
                    {t.token}
                  </span>
                );
              })}
            </div>
          )}

          {/* GLTR Hover Tooltip */}
          {hoveredGltr && (
            <div className="absolute bottom-2 right-2 p-2 bg-slate-900/95 text-white text-[11px] font-mono rounded shadow-lg border border-slate-700 pointer-events-none z-20">
              <div>Token: &quot;{hoveredGltr.token.trim()}&quot;</div>
              <div>Predicted Rank: #{hoveredGltr.rank}</div>
              <div>Probability: {(hoveredGltr.probability * 100).toFixed(2)}%</div>
              <div>Category: {hoveredGltr.bucket}</div>
            </div>
          )}
        </div>
      ) : (
        // Sentence Heatmap View
        <div className="flex-1 text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-sans whitespace-pre-wrap select-text">
          {sentences.map((s) => {
            let bgClass = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 hover:bg-emerald-100';
            let borderClass = 'border-b border-emerald-300 dark:border-emerald-700';

            if (s.score >= 70) {
              bgClass = 'bg-rose-100/70 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 hover:bg-rose-200/80';
              borderClass = 'border-b border-rose-400 dark:border-rose-700';
            } else if (s.score >= 30) {
              bgClass = 'bg-amber-100/60 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 hover:bg-amber-200/70';
              borderClass = 'border-b border-amber-400 dark:border-amber-700';
            }

            const isSelected = selectedSentence?.index === s.index;

            return (
              <span
                key={`sent-${s.index}`}
                title={`${s.score}% AI Risk`}
                data-sentence-index={s.index}
                onClick={() => {
                  setSelectedSentence(s);
                  onSelectSentence?.(s.index);
                }}
                className={`cursor-pointer transition-colors px-0.5 py-0.5 rounded-sm ${bgClass} ${borderClass} ${
                  isSelected ? 'ring-2 ring-slate-900 dark:ring-slate-100' : ''
                }`}
              >
                {s.text}{' '}
              </span>
            );
          })}
        </div>
      )}

      {/* Selected Sentence Popover */}
      {selectedSentence && (
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/90 rounded-lg border border-slate-200 dark:border-slate-700 text-xs shadow-md animate-fadeIn">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                  selectedSentence.score >= 70
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                    : selectedSentence.score >= 30
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                }`}
              >
                {selectedSentence.score}% AI Risk
              </span>
              <span className="text-slate-500 text-[11px]">Sentence #{selectedSentence.index + 1}</span>
            </div>
            <button
              onClick={() => setSelectedSentence(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mb-2 italic text-slate-700 dark:text-slate-300 font-sans text-xs">
            &ldquo;{selectedSentence.text}&rdquo;
          </div>

          <div className="space-y-1 mb-3">
            <span className="font-semibold text-[11px] text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
              Forensic Signals:
            </span>
            {selectedSentence.reasons.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Info className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{r}</span>
              </div>
            ))}
          </div>

          {onHumanizeSentence && (
            <button
              onClick={() => {
                onHumanizeSentence(selectedSentence.text, selectedSentence.index);
                setSelectedSentence(null);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded font-medium text-xs hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Humanize Only This Sentence
            </button>
          )}
        </div>
      )}
    </div>
  );
}
