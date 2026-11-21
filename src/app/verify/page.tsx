'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileCheck,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Clock,
  Sparkles,
  Key,
  Layers,
  FileText
} from 'lucide-react';
import {
  verifyProof,
  VerificationResult,
  VeriTextProof,
  sha256Hex,
  canonicalJsonStringify,
} from '@/lib/proof/crypto';

export default function VerifyPage() {
  const [proofJsonText, setProofJsonText] = useState('');
  const [candidateText, setCandidateText] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setProofJsonText(content);
      setErrorMsg(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setProofJsonText(content);
      setErrorMsg(null);
    };
    reader.readAsText(file);
  };

  const runVerification = async () => {
    setErrorMsg(null);
    if (!proofJsonText.trim()) {
      setErrorMsg('Please upload or paste a .veritext-proof.json certificate.');
      return;
    }
    if (!candidateText.trim()) {
      setErrorMsg('Please enter or paste the candidate document text to verify.');
      return;
    }

    setIsVerifying(true);
    try {
      let parsedProof: VeriTextProof;
      try {
        parsedProof = JSON.parse(proofJsonText);
      } catch {
        throw new Error('Invalid JSON format in the provided proof file.');
      }

      if (!parsedProof.documentHash || !parsedProof.signatureBase64 || !parsedProof.publicKeyJwk) {
        throw new Error('Malformed VeriText proof structure. Missing documentHash, signatureBase64, or publicKeyJwk.');
      }

      const res = await verifyProof(parsedProof, candidateText);
      setResult(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const loadSample = async (tamper: boolean) => {
    setErrorMsg(null);
    const originalText =
      'Artificial intelligence systems continue to evolve rapidly. In this academic inquiry, we present empirical telemetry on genuine human composition cadence, proving that human writing manifests non-uniform inter-keystroke intervals and sustained revision checkpoints.';

    const candidate = tamper
      ? originalText.replace('rapidly.', 'rapidly!') // 1-character difference
      : originalText;

    // Construct valid demo key and proof in memory
    const subtle = globalThis.crypto.subtle;
    const keyPair = await subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    const publicJwk = await subtle.exportKey('jwk', keyPair.publicKey);
    const hash = await sha256Hex(originalText);

    const payload = {
      version: '1.0' as const,
      documentHash: hash,
      metadata: {
        wordCount: 30,
        charCount: originalText.length,
        timestamp: new Date().toISOString(),
        authorName: 'Dr. Jane Verified',
      },
      telemetry: {
        totalCompositionTimeSec: 210,
        activeKeystrokeCount: 220,
        pasteEventCount: 0,
        pastedCharCount: 0,
        totalCharCount: originalText.length,
        pasteRatio: 0.0,
        wordsPerMinute: 45,
        keystrokeEntropy: 2.74,
      },
      revisionCheckpoints: [
        { timestamp: new Date(Date.now() - 120000).toISOString(), charCount: 80, hash: 'cp1' },
        { timestamp: new Date(Date.now() - 60000).toISOString(), charCount: 160, hash: 'cp2' },
        { timestamp: new Date().toISOString(), charCount: originalText.length, hash },
      ],
      publicKeyJwk: publicJwk,
    };

    // Canonical stringify
    const canonical = canonicalJsonStringify(payload);

    const sigBuf = await subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      keyPair.privateKey,
      new TextEncoder().encode(canonical)
    );

    const bytes = new Uint8Array(sigBuf);
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i] ?? 0);
    const sigB64 = btoa(bin);

    const fullProof: VeriTextProof = {
      ...payload,
      signatureBase64: sigB64,
    };

    setProofJsonText(JSON.stringify(fullProof, null, 2));
    setCandidateText(candidate);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
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
              <FileCheck className="w-4 h-4 text-indigo-400" />
              <span>Offline Proof-of-Human Verifier</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-medium">
              100% Client-Side / Zero-Network
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8 relative">
        {/* Hero Section */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Cryptographic Integrity Verification · Web Crypto ECDSA P-256</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Independent Authorship Proof Verifier
          </h1>
          <p className="text-slate-400 text-base max-w-3xl leading-relaxed">
            Verify any document claimed to have been certified by the VeriText Proof-of-Human Studio. This tool executes entirely inside your browser sandbox using ECDSA P-256 public-key verification and SHA-256 hashing. If the document has been altered by even a single comma or letter, verification fails instantly.
          </p>
        </div>

        {/* Quick Demo Pre-fill Bar */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Try interactive test cases:</span>
          <button
            onClick={() => void loadSample(false)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors"
          >
            Load Valid Certified Document
          </button>
          <button
            onClick={() => void loadSample(true)}
            className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
          >
            Load 1-Character Tampered Document
          </button>
        </div>

        {/* Dual Input Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel 1: Proof JSON / Drag-and-drop */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-400" />
                1. Upload or Paste Proof (.veritext-proof.json)
              </span>
              <label className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1 font-medium">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Browse File</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="relative"
            >
              <textarea
                value={proofJsonText}
                onChange={(e) => setProofJsonText(e.target.value)}
                placeholder="Drag & drop .veritext-proof.json here or paste raw JSON..."
                rows={10}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 font-mono resize-y"
              />
            </div>
          </div>

          {/* Panel 2: Candidate Text */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                2. Candidate Document Text
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {candidateText.length} characters
              </span>
            </div>

            <textarea
              value={candidateText}
              onChange={(e) => setCandidateText(e.target.value)}
              placeholder="Paste the full, unmodified document text here to verify against the cryptographic signature..."
              rows={10}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 font-mono resize-y"
            />
          </div>
        </div>

        {/* Verification Trigger Button */}
        <div className="flex justify-center">
          <button
            onClick={() => void runVerification()}
            disabled={isVerifying || !proofJsonText.trim() || !candidateText.trim()}
            className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-sm shadow-xl shadow-indigo-600/25 transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isVerifying ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying Cryptographic Signatures...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Verify Document Authenticity</span>
              </>
            )}
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-sm flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Verification Report Result */}
        {result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Status Banner */}
            {result.valid ? (
              <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Document Authenticity Confirmed
                    </h2>
                    <p className="text-xs text-emerald-300 mt-1">
                      Digital ECDSA P-256 signature is valid and SHA-256 document digest matches exactly.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-400 font-medium">Authorship Trust Score</div>
                    <div className="text-3xl font-extrabold text-emerald-400 font-mono">
                      {result.trustScore} / 100
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-500/60 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shrink-0">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-rose-300">
                      {result.tamperMessage || 'TAMPER DETECTED: Verification Failed'}
                    </h2>
                    <p className="text-xs text-rose-400/90 mt-1">
                      The document text differs from the certified cryptographic hash. Even 1 character modification or invisible spacing alteration causes instant rejection.
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono font-bold text-xs">
                  INTEGRITY MISMATCH
                </span>
              </div>
            )}

            {/* Audit Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Metadata Card */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Author & Document Info
                </span>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500">Author:</span>
                    <div className="font-semibold text-slate-200 mt-0.5">
                      {result.proof.metadata.authorName || 'Anonymous Verified Author'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Certified Timestamp:</span>
                    <div className="text-slate-300 font-mono mt-0.5">
                      {new Date(result.proof.metadata.timestamp).toUTCString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Document Word / Char Count:</span>
                    <div className="text-slate-300 font-mono mt-0.5">
                      {result.proof.metadata.wordCount} words ({result.proof.metadata.charCount} chars)
                    </div>
                  </div>
                </div>
              </div>

              {/* Forensic Keystroke Telemetry */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Keystroke Telemetry
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase">Composition Time</span>
                    <div className="font-mono font-semibold text-slate-200">
                      {result.proof.telemetry.totalCompositionTimeSec}s
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase">Typing Speed</span>
                    <div className="font-mono font-semibold text-slate-200">
                      {result.proof.telemetry.wordsPerMinute} WPM
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase">Paste Ratio</span>
                    <div className="font-mono font-semibold text-indigo-300">
                      {(result.proof.telemetry.pasteRatio * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase">Cadence Entropy</span>
                    <div className="font-mono font-semibold text-emerald-400">
                      {result.proof.telemetry.keystrokeEntropy.toFixed(2)} bits
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust Score Breakdown */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Trust Score Breakdown
                </span>
                <div className="space-y-1.5 text-xs">
                  {result.trustReasons.map((reason, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-slate-300">
                      {result.valid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
