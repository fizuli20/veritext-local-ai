'use client';

import React, { useState, useRef } from 'react';
import { DomainProfile, DOMAIN_PROFILES } from '../lib/nlp/calibration';
import { analyzeStylometrics, StylometricResult } from '../lib/nlp/stylometrics';
import { Upload, FileText, CheckCircle, AlertTriangle, Download, Trash2, StopCircle, RefreshCw } from 'lucide-react';

export interface BatchItem {
  id: string;
  filename: string;
  size: number;
  text: string;
  status: 'pending' | 'scanning' | 'done' | 'error';
  result?: StylometricResult;
  errorMessage?: string;
}

interface BatchAuditorProps {
  onInspectDocument?: (text: string, filename: string) => void;
  onInspectText?: (text: string) => void;
}

export function BatchAuditor({ onInspectDocument, onInspectText }: BatchAuditorProps) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [domain, setDomain] = useState<DomainProfile>('general');
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [sortField, setSortField] = useState<'filename' | 'score' | 'words'>('filename');
  const [sortAsc, setSortAsc] = useState(true);
  const abortRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic async document parser loader
  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, 25);
    const newItems: BatchItem[] = [];

    // Dynamically import document parser
    const { parseDocumentFile } = await import('../lib/io/documents');

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const id = `${file.name}-${Date.now()}-${i}`;
      try {
        const parsed = await parseDocumentFile(file);
        newItems.push({
          id,
          filename: file.name,
          size: file.size,
          text: parsed.text,
          status: 'pending',
        });
      } catch (err: any) {
        newItems.push({
          id,
          filename: file.name,
          size: file.size,
          text: '',
          status: 'error',
          errorMessage: err.message || 'Parse error',
        });
      }
    }

    setItems((prev) => [...prev, ...newItems].slice(0, 25));
  };

  const handleStartScan = async () => {
    if (items.length === 0 || isScanning) return;
    setIsScanning(true);
    abortRef.current = false;

    const pending = items.filter((it) => it.status === 'pending' || it.status === 'error');
    setProgress({ current: 0, total: pending.length });

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) break;
      const item = items[i]!;
      if (item.status === 'done' || !item.text) continue;

      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'scanning' } : it))
      );

      // Yield event loop
      await new Promise((r) => setTimeout(r, 20));

      try {
        const res = analyzeStylometrics(item.text, domain);
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'done', result: res } : it))
        );
      } catch (err: any) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: 'error', errorMessage: err.message } : it
          )
        );
      }

      setProgress((p) => ({ ...p, current: p.current + 1 }));
    }

    setIsScanning(false);
  };

  const handleStopScan = () => {
    abortRef.current = true;
    setIsScanning(false);
  };

  const handleExportCSV = () => {
    if (items.length === 0) return;
    const header = 'Filename,Words,Language,AI Score %,Verdict,Confidence,Obfuscation Detected\n';
    const rows = items
      .map((it) => {
        const r = it.result;
        const words = r ? r.metrics.wordCount : 0;
        const lang = r ? r.language.name : 'Unknown';
        const score = r ? r.aiScore : 'N/A';
        const verdict = r ? (r.aiScore >= 70 ? 'AI-Generated' : r.aiScore >= 35 ? 'Mixed' : 'Human') : 'N/A';
        const conf = r ? r.confidence : 'N/A';
        const obf = r ? (r.obfuscationReport.detected ? 'YES' : 'NO') : 'NO';
        return `"${it.filename}",${words},"${lang}",${score},"${verdict}","${conf}","${obf}"`;
      })
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veritext-batch-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortedItems = [...items].sort((a, b) => {
    if (sortField === 'filename') {
      return sortAsc ? a.filename.localeCompare(b.filename) : b.filename.localeCompare(a.filename);
    }
    if (sortField === 'score') {
      const sa = a.result?.aiScore ?? -1;
      const sb = b.result?.aiScore ?? -1;
      return sortAsc ? sa - sb : sb - sa;
    }
    if (sortField === 'words') {
      const wa = a.result?.metrics.wordCount ?? 0;
      const wb = b.result?.metrics.wordCount ?? 0;
      return sortAsc ? wa - wb : wb - wa;
    }
    return 0;
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Controls & Dropzone Bar */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              Batch Multi-Document Forensic Queue
            </h3>
            <p className="text-xs text-slate-500">
              Drop up to 25 documents (.docx, .pdf, .md, .txt) for concurrent client-side stylometric audit.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Domain:</span>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value as DomainProfile)}
              className="text-xs py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
            >
              {Object.values(DOMAIN_PROFILES).map((dp) => (
                <option key={dp.id} value={dp.id}>
                  {dp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-lg p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            multiple
            accept=".docx,.pdf,.md,.txt"
            className="hidden"
          />
          <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Click to select or drag and drop up to 25 files
          </p>
          <p className="text-[11px] text-slate-400 mt-1">.docx, .pdf, .md, or .txt</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const sampleFiles = [
                {
                  name: 'Research-Abstract.md',
                  text: 'In recent years, deep learning has achieved remarkable advancements across natural language processing and computer vision domains.',
                },
                {
                  name: 'Student-Essay-Draft.txt',
                  text: 'I started writing this essay at 2 a.m. yesterday; my thoughts were disorganized, but after three coffees, the structure finally came together.',
                },
                {
                  name: 'AI-Generated-Summary.docx',
                  text: 'Moreover, it is crucial to recognize that artificial intelligence plays a pivotal role in revolutionizing contemporary workflows through multifaceted optimization paradigms.',
                },
              ];
              setItems((prev) => [
                ...prev,
                ...sampleFiles.map((s, idx) => ({
                  id: `sample-${idx}-${Date.now()}`,
                  filename: s.name,
                  size: s.text.length,
                  text: s.text,
                  status: 'pending' as const,
                })),
              ].slice(0, 25));
            }}
            className="mt-2.5 inline-block text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline"
          >
            + Load 3 Sample Files
          </button>
        </div>

        {/* Queue Actions */}
        {items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-500 font-medium">
                {items.length} document{items.length > 1 ? 's' : ''} queued
              </span>
              {isScanning && (
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                  ({progress.current}/{progress.total} scanned)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isScanning ? (
                <button
                  onClick={handleStopScan}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center gap-1.5"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  Stop Scan
                </button>
              ) : (
                <button
                  onClick={handleStartScan}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 font-medium flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Scan Queue
                </button>
              )}

              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>

              <button
                onClick={() => setItems([])}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Clear queue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Forensic Table */}
      {items.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-400">
                  <th
                    onClick={() => {
                      setSortField('filename');
                      setSortAsc(!sortAsc);
                    }}
                    className="p-3 cursor-pointer hover:text-slate-900"
                  >
                    Document Name {sortField === 'filename' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => {
                      setSortField('words');
                      setSortAsc(!sortAsc);
                    }}
                    className="p-3 cursor-pointer hover:text-slate-900"
                  >
                    Words {sortField === 'words' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-3">Language</th>
                  <th
                    onClick={() => {
                      setSortField('score');
                      setSortAsc(!sortAsc);
                    }}
                    className="p-3 cursor-pointer hover:text-slate-900"
                  >
                    AI Score % {sortField === 'score' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-3">Verdict</th>
                  <th className="p-3">Integrity Flag</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {sortedItems.map((item) => {
                  const r = item.result;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-sans font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate" title={item.filename}>
                        {item.filename}
                      </td>
                      <td className="p-3 text-slate-500">
                        {r ? r.metrics.wordCount : item.status === 'scanning' ? '...' : '-'}
                      </td>
                      <td className="p-3 text-slate-500">
                        {r ? r.language.name : '-'}
                      </td>
                      <td className="p-3">
                        {r ? (
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                              r.aiScore >= 70
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                : r.aiScore >= 35
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {r.aiScore}%
                          </span>
                        ) : item.status === 'scanning' ? (
                          <span className="text-indigo-500 animate-pulse">Scanning...</span>
                        ) : item.status === 'error' ? (
                          <span className="text-rose-500">{item.errorMessage}</span>
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                      </td>
                      <td className="p-3 font-sans">
                        {r ? (
                          r.aiScore >= 70 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-medium">Likely AI</span>
                          ) : r.aiScore >= 35 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">Mixed</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Human</span>
                          )
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3">
                        {r?.obfuscationReport.detected ? (
                          <span className="flex items-center gap-1 text-rose-600 text-[11px] font-sans font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Obfuscated
                          </span>
                        ) : r ? (
                          <span className="flex items-center gap-1 text-emerald-600 text-[11px] font-sans">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Clean
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {r && (onInspectDocument || onInspectText) && (
                          <button
                            onClick={() => {
                              onInspectDocument?.(item.text, item.filename);
                              onInspectText?.(item.text);
                            }}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-sans font-medium"
                          >
                            Inspect
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
