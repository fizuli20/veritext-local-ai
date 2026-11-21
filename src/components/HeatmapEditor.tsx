'use client';

import React, { useState } from 'react';
import { SentenceAnalysis } from '@/lib/nlp/stylometrics';
import { Sparkles, Info, X } from 'lucide-react';

interface HeatmapEditorProps {
  rawText: string;
  onChangeText: (text: string) => void;
  sentences: SentenceAnalysis[];
  isAnalyzing: boolean;
  onHumanizeSentence?: (sentenceText: string, index: number) => void;
  readOnly?: boolean;
}

export function HeatmapEditor({
  rawText,
  onChangeText,
  sentences,
  isAnalyzing,
  onHumanizeSentence,
  readOnly = false,
}: HeatmapEditorProps) {
  const [selectedSentence, setSelectedSentence] = useState<SentenceAnalysis | null>(null);
  const [viewMode, setViewMode] = useState<'heatmap' | 'edit'>('heatmap');

  // If no analysis yet, render plain textarea
  if (sentences.length === 0 || viewMode === 'edit') {
    return (
      <div className="relative w-full h-full min-h-[350px] flex flex-col">
        <textarea
          value={rawText}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Paste or write prose here to analyze with 100% local stylometrics and browser neural AI..."
          className="w-full h-full min-h-[350px] p-4 text-sm font-sans leading-relaxed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 resize-y text-slate-800 dark:text-slate-200 placeholder-slate-400"
          readOnly={readOnly}
        />
        {sentences.length > 0 && (
          <button
            onClick={() => setViewMode('heatmap')}
            className="absolute bottom-3 right-3 text-[11px] font-medium px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-300 dark:border-slate-700 shadow-sm"
          >
            Show Heatmap Highlight View
          </button>
        )}
      </div>
    );
  }

  // Render offset-exact sentence spans (Zero dangerouslySetInnerHTML)
  return (
    <div className="relative w-full min-h-[350px] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      {/* Switch to Edit Mode Button */}
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
            Sentence AI Heatmap
          </span>
          <div className="flex items-center gap-2 text-[11px]">
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
        </div>

        <button
          onClick={() => setViewMode('edit')}
          className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 underline font-medium"
        >
          Edit Raw Text
        </button>
      </div>

      {/* Interactive Sentence Spans */}
      <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-sans whitespace-pre-wrap select-text">
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
              onClick={() => setSelectedSentence(s)}
              className={`cursor-pointer transition-colors px-0.5 py-0.5 rounded-sm ${bgClass} ${borderClass} ${
                isSelected ? 'ring-2 ring-slate-800 dark:ring-slate-300 ring-offset-1' : ''
              }`}
              title={`Click to view diagnostic breakdown (${s.score}% AI)`}
            >
              {s.text}{' '}
            </span>
          );
        })}
      </div>

      {/* Popover Card for Selected Sentence */}
      {selectedSentence && (
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs space-y-2 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Sentence #{selectedSentence.index + 1}
              </span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                  selectedSentence.score >= 70
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                    : selectedSentence.score >= 30
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                }`}
              >
                {selectedSentence.score}% AI Score
              </span>
            </div>

            <button
              onClick={() => setSelectedSentence(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300">
            &ldquo;{selectedSentence.text}&rdquo;
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
              Diagnostic Reasons:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400 text-[11px]">
              {selectedSentence.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          {onHumanizeSentence && (
            <div className="pt-1 flex justify-end">
              <button
                onClick={() => onHumanizeSentence(selectedSentence.text, selectedSentence.index)}
                className="text-xs font-medium py-1 px-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Humanize Just This Sentence
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
