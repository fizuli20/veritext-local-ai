'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  Key,
  Download,
  Printer,
  Clock,
  Sparkles,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';
import {
  getOrCreateAuthorKeyPair,
  createAndSignProof,
  calculateIntervalEntropy,
  calculateTrustScore,
  sha256Hex,
  KeystrokeTelemetry,
  RevisionCheckpoint,
  VeriTextProof,
} from '@/lib/proof/crypto';

export default function ProofStudio() {
  const [text, setText] = useState('');
  const [authorName, setAuthorName] = useState('Anonymous Author');
  const [isSigning, setIsSigning] = useState(false);
  const [signedProof, setSignedProof] = useState<VeriTextProof | null>(null);
  const [copiedProof, setCopiedProof] = useState(false);

  // Telemetry recording state
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [keystrokeCount, setKeystrokeCount] = useState(0);
  const [pasteEvents, setPasteEvents] = useState(0);
  const [pastedChars, setPastedChars] = useState(0);
  const intervalsRef = useRef<number[]>([]);
  const lastKeyTimeRef = useRef<number | null>(null);
  const checkpointsRef = useRef<RevisionCheckpoint[]>([]);
  const lastCheckpointCharCountRef = useRef(0);
  const [checkpointsCount, setCheckpointsCount] = useState(0);

  // Timer for session composition
  useEffect(() => {
    if (!sessionStartTime) return;
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Periodic checkpoint saver (every 100 chars or 60s)
  const captureCheckpoint = useCallback(async (currentText: string) => {
    if (currentText.length === 0) return;
    try {
      const hash = await sha256Hex(currentText);
      const cp: RevisionCheckpoint = {
        timestamp: new Date().toISOString(),
        charCount: currentText.length,
        hash,
      };
      checkpointsRef.current.push(cp);
      lastCheckpointCharCountRef.current = currentText.length;
      setCheckpointsCount(checkpointsRef.current.length);
    } catch {
      // ignore
    }
  }, []);

  const handleKeyDown = () => {
    const now = Date.now();
    if (!sessionStartTime) {
      setSessionStartTime(now);
    }

    if (lastKeyTimeRef.current !== null) {
      const delta = now - lastKeyTimeRef.current;
      if (delta > 20 && delta < 5000) {
        intervalsRef.current.push(delta);
        // keep last 500 intervals
        if (intervalsRef.current.length > 500) {
          intervalsRef.current.shift();
        }
      }
    }
    lastKeyTimeRef.current = now;
    setKeystrokeCount((c) => c + 1);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedData = e.clipboardData.getData('text');
    if (pastedData) {
      setPasteEvents((c) => c + 1);
      setPastedChars((c) => c + pastedData.length);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    // Invalidate prior proof if text changed after signing
    if (signedProof) {
      setSignedProof(null);
    }

    // Check if we should trigger a checkpoint
    if (Math.abs(newText.length - lastCheckpointCharCountRef.current) >= 100) {
      void captureCheckpoint(newText);
    }
  };

  const resetSession = () => {
    setText('');
    setSignedProof(null);
    setSessionStartTime(null);
    setElapsedSec(0);
    setKeystrokeCount(0);
    setPasteEvents(0);
    setPastedChars(0);
    intervalsRef.current = [];
    lastKeyTimeRef.current = null;
    checkpointsRef.current = [];
    lastCheckpointCharCountRef.current = 0;
    setCheckpointsCount(0);
  };

  // Telemetry metrics
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const pasteRatio = text.length > 0 ? Math.min(1.0, pastedChars / text.length) : 0;
  const wordsPerMinute = elapsedSec > 10 ? Math.round((wordCount / elapsedSec) * 60) : 0;
  const entropy = calculateIntervalEntropy(intervalsRef.current);

  const currentTelemetry: KeystrokeTelemetry = {
    totalCompositionTimeSec: elapsedSec,
    activeKeystrokeCount: keystrokeCount,
    pasteEventCount: pasteEvents,
    pastedCharCount: pastedChars,
    totalCharCount: text.length,
    pasteRatio: parseFloat(pasteRatio.toFixed(3)),
    wordsPerMinute,
    keystrokeEntropy: entropy,
  };

  const { score: trustScore, reasons: trustReasons } = calculateTrustScore(
    currentTelemetry,
    checkpointsRef.current
  );

  const handleSign = async () => {
    if (!text.trim()) return;
    setIsSigning(true);
    try {
      // capture final checkpoint
      await captureCheckpoint(text);

      const { keyPair, publicKeyJwk } = await getOrCreateAuthorKeyPair();
      const proof = await createAndSignProof({
        text,
        authorName,
        telemetry: currentTelemetry,
        revisionCheckpoints: checkpointsRef.current,
        privateKey: keyPair.privateKey,
        publicKeyJwk,
      });

      setSignedProof(proof);
    } catch (err) {
      console.error('Failed to sign proof:', err);
      alert('Failed to generate cryptographic proof: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSigning(false);
    }
  };

  const handleDownloadProofJson = () => {
    if (!signedProof) return;
    const jsonStr = JSON.stringify(signedProof, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proof-${signedProof.documentHash.slice(0, 8)}.veritext-proof.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyProofJson = () => {
    if (!signedProof) return;
    void navigator.clipboard.writeText(JSON.stringify(signedProof, null, 2));
    setCopiedProof(true);
    setTimeout(() => setCopiedProof(false), 2000);
  };

  const handlePrintCertificate = () => {
    if (!signedProof) return;

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>VeriText Authorship Certificate - ${signedProof.documentHash.slice(0, 10)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: 0 auto; }
          .cert-border { border: 8px double #0f172a; padding: 36px; border-radius: 8px; position: relative; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
          .badge { display: inline-block; background: #e0e7ff; color: #3730a3; font-weight: bold; font-size: 12px; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
          h1 { margin: 8px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
          .subtitle { color: #64748b; font-size: 14px; }
          .content-block { margin: 24px 0; }
          .field { margin-bottom: 12px; }
          .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em; }
          .value { font-size: 15px; font-weight: 600; color: #1e293b; margin-top: 2px; }
          .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; word-break: break-all; background: #f8fafc; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0; }
          .telemetry-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .tel-item { text-align: center; }
          .tel-num { font-size: 20px; font-weight: bold; color: #4338ca; }
          .tel-lbl { font-size: 11px; color: #64748b; margin-top: 4px; }
          .trust-score-box { text-align: center; margin: 24px 0; padding: 16px; background: #ecfdf5; border: 2px solid #059669; border-radius: 8px; }
          .score-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #047857; letter-spacing: 0.05em; }
          .score-val { font-size: 36px; font-weight: 900; color: #065f46; margin: 4px 0; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="cert-border">
          <div class="header">
            <span class="badge">Cryptographic Proof-of-Human Protocol v1.0</span>
            <h1>Certificate of Authenticated Human Authorship</h1>
            <div class="subtitle">Indisputable, tamper-evident composition record certified by VeriText Engine</div>
          </div>

          <div class="trust-score-box">
            <div class="score-title">Forensic Authorship Trust Score</div>
            <div class="score-val">${signedProof ? calculateTrustScore(signedProof.telemetry, signedProof.revisionCheckpoints || []).score : 0} / 100</div>
            <div style="font-size: 12px; color: #047857;">Authentic manual composition verified via ECDSA P-256 digital signature</div>
          </div>

          <div class="content-block">
            <div class="field">
              <div class="label">Certified Author</div>
              <div class="value">${signedProof.metadata.authorName || 'Anonymous Verified Author'}</div>
            </div>
            <div class="field">
              <div class="label">Composition Timestamp (UTC)</div>
              <div class="value">${new Date(signedProof.metadata.timestamp).toUTCString()}</div>
            </div>
            <div class="field">
              <div class="label">Document SHA-256 Digest</div>
              <div class="mono">${signedProof.documentHash}</div>
            </div>
          </div>

          <div class="telemetry-grid">
            <div class="tel-item">
              <div class="tel-num">${signedProof.telemetry.totalCompositionTimeSec}s</div>
              <div class="tel-lbl">Composition Time</div>
            </div>
            <div class="tel-item">
              <div class="tel-num">${signedProof.telemetry.activeKeystrokeCount}</div>
              <div class="tel-lbl">Manual Keystrokes</div>
            </div>
            <div class="tel-item">
              <div class="tel-num">${(signedProof.telemetry.pasteRatio * 100).toFixed(1)}%</div>
              <div class="tel-lbl">Paste Ratio</div>
            </div>
            <div class="tel-item">
              <div class="tel-num">${signedProof.telemetry.keystrokeEntropy.toFixed(2)}</div>
              <div class="tel-lbl">Interval Entropy (bits)</div>
            </div>
          </div>

          <div class="content-block">
            <div class="field">
              <div class="label">ECDSA P-256 Cryptographic Signature (Base64)</div>
              <div class="mono">${signedProof.signatureBase64}</div>
            </div>
          </div>

          <div class="footer">
            <div>Verify independently offline at: <strong>https://veritext-local-ai.vercel.app/verify</strong></div>
            <div>VeriText Titan v4.0</div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              Proof-of-Human Author Studio
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-mono border border-indigo-500/20">
                ECDSA P-256
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-2xl">
              Write or edit your manuscript here. VeriText cryptographically records your natural typing cadence, revision timeline, and paste ratio, then signs a tamper-evident <code className="text-indigo-300">.veritext-proof.json</code> certificate using your browser-local private key.
            </p>
          </div>
        </div>

        <button
          onClick={resetSession}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Session</span>
        </button>
      </div>

      {/* Main Grid: Editor & Live Telemetry Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Area (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Author Name:</span>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="e.g. Dr. Jane Doe"
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 w-44"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{text.length} chars</span>
                <span>•</span>
                <span className="text-indigo-400 font-mono">{checkpointsCount} checkpoints</span>
              </div>
            </div>

            <textarea
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Start drafting here to record authentic keystroke rhythms, revision snapshots, and paste telemetry..."
              rows={14}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition-all font-mono leading-relaxed resize-y"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Keys are generated in your browser. No text is ever uploaded.</span>
              </div>

              <button
                onClick={handleSign}
                disabled={isSigning || !text.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {isSigning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing Cryptographic Proof...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sign & Generate Proof Certificate</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Signed Certificate Result Box */}
          {signedProof && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900/90 border border-indigo-500/30 backdrop-blur-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">
                    Cryptographic Proof Successfully Signed
                  </span>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-medium border border-emerald-500/20">
                  SHA-256 + ECDSA Valid
                </span>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Document Hash (SHA-256):</span>
                  <span className="text-indigo-300">{signedProof.documentHash.slice(0, 24)}...</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Signature Fingerprint:</span>
                  <span className="text-slate-300">{signedProof.signatureBase64.slice(0, 24)}...</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={handleDownloadProofJson}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Download .veritext-proof.json</span>
                </button>

                <button
                  onClick={handlePrintCertificate}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-200 text-xs font-medium transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Print Formal Certificate (PDF)</span>
                </button>

                <button
                  onClick={handleCopyProofJson}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition-colors"
                >
                  {copiedProof ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedProof ? 'Copied JSON!' : 'Copy JSON'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Telemetry Sidebar (1 Col) */}
        <div className="space-y-4">
          {/* Trust Score Gauge Card */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Authorship Trust Score
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                  trustScore >= 75
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : trustScore >= 40
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {trustScore >= 75 ? 'Strong Human Proof' : trustScore >= 40 ? 'Moderate Proof' : 'Needs More Cadence'}
              </span>
            </div>

            <div className="flex items-baseline justify-center gap-2 py-2">
              <span className="text-5xl font-black font-mono tracking-tight text-white">
                {trustScore}
              </span>
              <span className="text-slate-500 text-base font-semibold">/ 100</span>
            </div>

            {/* Score Breakdown Checklist */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3 text-xs">
              {trustReasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-slate-300 leading-tight">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry Metrics Card */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Live Telemetry Audit
            </span>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Active Time</span>
                <div className="text-lg font-bold text-slate-200 font-mono">{elapsedSec}s</div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Typing Speed</span>
                <div className="text-lg font-bold text-slate-200 font-mono">{wordsPerMinute} WPM</div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Manual Keys</span>
                <div className="text-lg font-bold text-slate-200 font-mono">{keystrokeCount}</div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Paste Ratio</span>
                <div className="text-lg font-bold text-indigo-400 font-mono">
                  {(pasteRatio * 100).toFixed(0)}%
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-0.5 col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Cadence Entropy</span>
                  <span className="text-xs text-emerald-400 font-mono font-bold">{entropy.toFixed(2)} bits</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (entropy / 3.0) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Copy-pasting wholesale will spike the Paste Ratio and penalize the trust score. Direct typing and editing yield maximum confidence.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
