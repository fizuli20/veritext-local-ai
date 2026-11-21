'use client';

import React, { useState } from 'react';
import { analyzeStylometrics, StylometricResult } from '../lib/nlp/stylometrics';
import { GitCompare, Download, ArrowRight, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ParagraphDiffComparison {
  index: number;
  draftA?: { text: string; score: number };
  draftB?: { text: string; score: number };
  deltaScore?: number;
  status: 'humanized' | 'ai-insertion' | 'human-baseline' | 'neutral';
}

async function sha256Hex(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function DraftComparator() {
  const [draftAText, setDraftAText] = useState('');
  const [draftBText, setDraftBText] = useState('');
  const [resultA, setResultA] = useState<StylometricResult | null>(null);
  const [resultB, setResultB] = useState<StylometricResult | null>(null);
  const [comparisons, setComparisons] = useState<ParagraphDiffComparison[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const handleCompare = async () => {
    if (!draftAText.trim() || !draftBText.trim()) return;
    setIsComparing(true);

    const resA = analyzeStylometrics(draftAText);
    const resB = analyzeStylometrics(draftBText);

    setResultA(resA);
    setResultB(resB);

    // Paragraph-level alignment & comparison
    const parasA = draftAText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const parasB = draftBText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

    const maxLen = Math.max(parasA.length, parasB.length);
    const comps: ParagraphDiffComparison[] = [];

    for (let i = 0; i < maxLen; i++) {
      const pA = parasA[i];
      const pB = parasB[i];

      const scoreA = pA ? analyzeStylometrics(pA).aiScore : undefined;
      const scoreB = pB ? analyzeStylometrics(pB).aiScore : undefined;

      let status: ParagraphDiffComparison['status'] = 'neutral';
      let deltaScore: number | undefined = undefined;

      if (scoreA !== undefined && scoreB !== undefined) {
        deltaScore = scoreB - scoreA;
        if (deltaScore <= -20) {
          status = 'humanized';
        } else if (scoreA < 35 && scoreB < 35) {
          status = 'human-baseline';
        } else if (deltaScore >= 20 && scoreB >= 65) {
          status = 'ai-insertion';
        }
      } else if (!pA && pB && scoreB !== undefined) {
        status = scoreB >= 65 ? 'ai-insertion' : 'neutral';
      }

      comps.push({
        index: i,
        draftA: pA && scoreA !== undefined ? { text: pA, score: scoreA } : undefined,
        draftB: pB && scoreB !== undefined ? { text: pB, score: scoreB } : undefined,
        deltaScore,
        status,
      });
    }

    setComparisons(comps);
    setIsComparing(false);
  };

  const handleExportDigest = async (format: 'json' | 'html') => {
    if (!resultA || !resultB) return;

    const hashA = await sha256Hex(draftAText);
    const hashB = await sha256Hex(draftBText);
    const timestamp = new Date().toISOString();
    const overallDelta = resultB.aiScore - resultA.aiScore;

    const digest = {
      title: 'Veritext Local Authorship Verification Digest',
      version: '3.0.0 Apex',
      timestamp,
      hashes: {
        draftA_SHA256: hashA,
        draftB_SHA256: hashB,
      },
      metrics: {
        draftA_AIScore: resultA.aiScore,
        draftB_AIScore: resultB.aiScore,
        overallAIDelta: overallDelta,
        draftA_Words: resultA.metrics.wordCount,
        draftB_Words: resultB.metrics.wordCount,
      },
      paragraphs: comparisons,
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(digest, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `authorship-digest-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Veritext Local Authorship Digest</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; background: #fff; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .mono { font-family: monospace; font-size: 11px; color: #64748b; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
    .badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
    .ai-drop { background: #dcfce7; color: #15803d; }
    .ai-alert { background: #fee2e2; color: #b91c1c; }
    .para-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid #f1f5f9; padding: 12px 0; }
  </style>
</head>
<body>
  <h1>Veritext Local Authorship Verification Digest</h1>
  <p class="mono">Generated: ${timestamp} | Mode: 100% Client-Side Pure TypeScript</p>
  
  <div class="card">
    <h3>Cryptographic Integrity Hashes</h3>
    <p class="mono"><strong>Draft A (Original):</strong> ${hashA}</p>
    <p class="mono"><strong>Draft B (Revised):</strong>  ${hashB}</p>
    <div class="grid">
      <div><strong>Draft A AI Score:</strong> ${resultA.aiScore}% (${resultA.metrics.wordCount} words)</div>
      <div><strong>Draft B AI Score:</strong> ${resultB.aiScore}% (${resultB.metrics.wordCount} words)</div>
    </div>
    <p><strong>Overall AI Score Shift:</strong> ${overallDelta > 0 ? `+${overallDelta}% (Increased)` : `${overallDelta}% (Reduced)`}</p>
  </div>

  <h3>Paragraph-by-Paragraph Comparative Forensic Audit</h3>
  ${comparisons
    .map(
      (c) => `
    <div class="para-row">
      <div>
        <div class="mono">Draft A (Score: ${c.draftA?.score ?? 'N/A'}%)</div>
        <p>${c.draftA?.text ?? '<em>(Empty)</em>'}</p>
      </div>
      <div>
        <div class="mono">Draft B (Score: ${c.draftB?.score ?? 'N/A'}%) - 
          <span class="badge ${c.status === 'humanized' ? 'ai-drop' : c.status === 'ai-insertion' ? 'ai-alert' : ''}">
            ${c.status.toUpperCase()}
          </span>
        </div>
        <p>${c.draftB?.text ?? '<em>(Empty)</em>'}</p>
      </div>
    </div>
  `
    )
    .join('')}
</body>
</html>`;

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `authorship-digest-${Date.now()}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header and Action Card */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-indigo-500" />
              Draft-vs-Draft Forensic Comparator
            </h3>
            <p className="text-xs text-slate-500">
              Align two document iterations to audit AI score delta, verify humanization, or catch synthetic insertions.
            </p>
            <button
              type="button"
              onClick={() => {
                setDraftAText("Moreover, it is crucial to recognize that artificial intelligence plays a pivotal role in revolutionizing contemporary workflows through multifaceted optimization paradigms.");
                setDraftBText("Artificial intelligence changes how teams work. Rather than replacing everyone, it automates repetitive tasks and helps people focus on creative problem solving.");
              }}
              className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold block"
            >
              + Load Sample Comparison
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCompare}
              disabled={!draftAText.trim() || !draftBText.trim() || isComparing}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 text-xs font-medium flex items-center gap-1.5 shadow-xs disabled:opacity-40"
            >
              <GitCompare className="w-3.5 h-3.5" />
              Compare Drafts
            </button>
            {resultA && resultB && (
              <>
                <button
                  onClick={() => handleExportDigest('html')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Audit HTML
                </button>
                <button
                  onClick={() => handleExportDigest('json')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Digest JSON
                </button>
              </>
            )}
          </div>
        </div>

        {/* Two-Pane Text Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Draft A (Original)</span>
              {resultA && <span className="font-mono text-[11px] text-slate-400">{resultA.metrics.wordCount} words</span>}
            </label>
            <textarea
              value={draftAText}
              onChange={(e) => setDraftAText(e.target.value)}
              placeholder="Paste original draft text here..."
              className="w-full h-44 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs font-sans text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Draft B (Revised / Humanized)</span>
              {resultB && <span className="font-mono text-[11px] text-slate-400">{resultB.metrics.wordCount} words</span>}
            </label>
            <textarea
              value={draftBText}
              onChange={(e) => setDraftBText(e.target.value)}
              placeholder="Paste revised draft text here..."
              className="w-full h-44 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs font-sans text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Delta Metrics Summary */}
      {resultA && resultB && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block">DRAFT A AI RISK</span>
              <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-200">{resultA.aiScore}%</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block">DRAFT B AI RISK</span>
              <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-200">{resultB.aiScore}%</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block">NET AI SCORE SHIFT</span>
              <span
                className={`text-xl font-bold font-mono ${
                  resultB.aiScore < resultA.aiScore ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {resultB.aiScore - resultA.aiScore > 0 ? `+${resultB.aiScore - resultA.aiScore}%` : `${resultB.aiScore - resultA.aiScore}%`}
              </span>
            </div>
            {resultB.aiScore < resultA.aiScore ? (
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            )}
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block">LENGTH ADJUSTMENT</span>
              <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-200">
                {resultB.metrics.wordCount - resultA.metrics.wordCount >= 0
                  ? `+${resultB.metrics.wordCount - resultA.metrics.wordCount}`
                  : `${resultB.metrics.wordCount - resultA.metrics.wordCount}`}{' '}
                words
              </span>
            </div>
            <CheckCircle className="w-6 h-6 text-indigo-500" />
          </div>
        </div>
      )}

      {/* Paragraph Comparison Breakdown */}
      {comparisons.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
          {/* Authorship Verification Digest Info */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Local Authorship Verification Digest
              </span>
              <p className="text-slate-500 text-[11px]">
                Cryptographic SHA-256 Integrity Verification generated locally in browser. Zero cloud roundtrips.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportDigest('html')}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-white text-slate-700 dark:text-slate-300 text-[11px] font-medium"
              >
                Audit HTML
              </button>
              <button
                onClick={() => handleExportDigest('json')}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-white text-slate-700 dark:text-slate-300 text-[11px] font-medium"
              >
                Digest JSON
              </button>
            </div>
          </div>

          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Paragraph-Aligned Forensic Differential
          </h4>

          <div className="space-y-3">
            {comparisons.map((c) => (
              <div
                key={`comp-${c.index}`}
                className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-slate-400 font-semibold">
                    Paragraph #{c.index + 1}
                  </span>
                  <div>
                    {c.status === 'humanized' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200">
                        AI Score Drop ({c.deltaScore}%)
                      </span>
                    )}
                    {c.status === 'ai-insertion' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200">
                        +AI Insertion Alert
                      </span>
                    )}
                    {c.status === 'human-baseline' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Unchanged Human Baseline
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-700 dark:text-slate-300 text-xs font-sans leading-relaxed">
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 block mb-1">
                      Draft A {c.draftA ? `(${c.draftA.score}% AI)` : '(Empty)'}
                    </span>
                    <p>{c.draftA?.text || '—'}</p>
                  </div>

                  <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 block mb-1">
                      Draft B {c.draftB ? `(${c.draftB.score}% AI)` : '(Empty)'}
                    </span>
                    <p>{c.draftB?.text || '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
