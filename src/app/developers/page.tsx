'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Terminal, Copy, Check, ArrowLeft, Play, Shield, Zap } from 'lucide-react';

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [sampleText, setSampleText] = useState(
    "In today's fast-paced world, artificial intelligence plays a pivotal role in modern education. Adaptive learning platforms delve into student performance metrics to provide a comprehensive overview."
  );
  const [selectedDomain, setSelectedDomain] = useState('general');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const curlSnippet =
    activeTab === 'single'
      ? `curl -X POST https://veritext-local-ai.vercel.app/api/detect \\
  -H "Content-Type: application/json" \\
  -d '{"text": "${sampleText.replace(/"/g, '\\"')}", "domain": "${selectedDomain}"}'`
      : `curl -X POST https://veritext-local-ai.vercel.app/api/batch-detect \\
  -H "Content-Type: application/json" \\
  -d '{"items": [{"id": "doc-1", "text": "${sampleText.replace(/"/g, '\\"')}", "domain": "${selectedDomain}"}]}'`;

  const tsSnippet =
    activeTab === 'single'
      ? `const res = await fetch('https://veritext-local-ai.vercel.app/api/detect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "${sampleText.slice(0, 60)}...",
    domain: "${selectedDomain}",
  }),
});
const data = await res.json();
console.log('AI Risk:', data.aiScore, '%');`
      : `const res = await fetch('https://veritext-local-ai.vercel.app/api/batch-detect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ id: 'doc-1', text: "${sampleText.slice(0, 60)}...", domain: "${selectedDomain}" }],
  }),
});
const data = await res.json();
console.log('Batch results:', data.items);`;

  const pythonSnippet =
    activeTab === 'single'
      ? `import requests

url = "https://veritext-local-ai.vercel.app/api/detect"
payload = {
    "text": """${sampleText}""",
    "domain": "${selectedDomain}"
}
response = requests.post(url, json=payload)
data = response.json()
print(f"AI Score: {data['aiScore']}%")`
      : `import requests

url = "https://veritext-local-ai.vercel.app/api/batch-detect"
payload = {
    "items": [
        {"id": "doc-1", "text": """${sampleText}""", "domain": "${selectedDomain}"}
    ]
}
response = requests.post(url, json=payload)
print(response.json())`;

  const handleCopy = (snippet: string, name: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(name);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const handleSendLiveTest = async () => {
    setIsLoading(true);
    setApiResponse(null);
    try {
      const endpoint = activeTab === 'single' ? '/api/detect' : '/api/batch-detect';
      const body =
        activeTab === 'single'
          ? { text: sampleText, domain: selectedDomain }
          : { items: [{ id: 'test-1', text: sampleText, domain: selectedDomain }] };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      setApiResponse(JSON.stringify(json, null, 2));
    } catch (err: any) {
      setApiResponse(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Studio
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 font-semibold">
              100% Free &amp; Zero-Key
            </span>
            <a
              href="/api/openapi.json"
              target="_blank"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-mono"
            >
              OpenAPI 3.1 Spec (JSON)
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Terminal className="w-6 h-6 text-indigo-500" />
            Zero-Token Developer API Playground
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Stateless, rate-limit resilient stylometric AI detection endpoints designed for automated CI/CD pipelines, LMS platforms, and editorial tooling.
          </p>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-800 dark:text-slate-200">Sub-10ms Execution</span>
              <span className="text-slate-500">Pure TypeScript algorithms compute 6 signals in &lt;5ms.</span>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center gap-3">
            <Shield className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-800 dark:text-slate-200">Zero Auth Required</span>
              <span className="text-slate-500">Public endpoints with generous in-memory rate limiting.</span>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center gap-3">
            <Terminal className="w-5 h-5 text-indigo-500 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-800 dark:text-slate-200">OpenAPI 3.1 Compliant</span>
              <span className="text-slate-500">Auto-generate client SDKs with OpenAPI Generator.</span>
            </div>
          </div>
        </div>

        {/* Interactive Request & Live Testing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Request Parameters */}
          <div className="space-y-4 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Request Configuration
              </span>
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded text-xs">
                <button
                  onClick={() => setActiveTab('single')}
                  className={`px-2.5 py-1 rounded font-medium ${
                    activeTab === 'single' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-slate-100' : 'text-slate-500'
                  }`}
                >
                  POST /api/detect
                </button>
                <button
                  onClick={() => setActiveTab('batch')}
                  className={`px-2.5 py-1 rounded font-medium ${
                    activeTab === 'batch' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-slate-100' : 'text-slate-500'
                  }`}
                >
                  POST /api/batch-detect
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Domain Calibration</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="general">general (Standard calibration)</option>
                <option value="academic">academic (High MTLD, low transition penalty)</option>
                <option value="technical">technical (Postmortems &amp; specifications)</option>
                <option value="creative">creative (Dialogue &amp; expressive prose)</option>
                <option value="esl-fair">esl-fair (Zero false-positive protection)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Sample Text Payload</label>
              <textarea
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                rows={5}
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 text-xs font-mono text-slate-800 dark:text-slate-200"
              />
            </div>

            <button
              onClick={handleSendLiveTest}
              disabled={isLoading || !sampleText.trim()}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isLoading ? 'Executing Request...' : 'Send Live API Request'}
            </button>
          </div>

          {/* Right: Live Response Inspector */}
          <div className="space-y-4 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 shadow-xs flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Response Inspector</span>
              {apiResponse && (
                <button
                  onClick={() => handleCopy(apiResponse, 'response')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {copiedSnippet === 'response' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  Copy JSON
                </button>
              )}
            </div>

            <div className="flex-1 bg-slate-950 p-3 rounded-lg overflow-x-auto min-h-[220px] font-mono text-[11px] leading-relaxed text-slate-300">
              {isLoading ? (
                <div className="text-indigo-400 animate-pulse">Running live stylometric analysis...</div>
              ) : apiResponse ? (
                <pre data-testid="response-json">{apiResponse}</pre>
              ) : (
                <div className="text-slate-500">
                  Click &quot;Send Live API Request&quot; above to inspect raw JSON output with scores, obfuscation report, and language telemetry.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Code Snippets (cURL, TypeScript, Python) */}
        <div className="space-y-4 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Client Integration Snippets
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* cURL */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>cURL</span>
                <button onClick={() => handleCopy(curlSnippet, 'curl')} className="text-slate-400 hover:text-slate-600">
                  {copiedSnippet === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-[10px] font-mono overflow-x-auto h-40">
                {curlSnippet}
              </pre>
            </div>

            {/* TypeScript */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>TypeScript / fetch</span>
                <button onClick={() => handleCopy(tsSnippet, 'ts')} className="text-slate-400 hover:text-slate-600">
                  {copiedSnippet === 'ts' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-[10px] font-mono overflow-x-auto h-40">
                {tsSnippet}
              </pre>
            </div>

            {/* Python */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Python / requests</span>
                <button onClick={() => handleCopy(pythonSnippet, 'py')} className="text-slate-400 hover:text-slate-600">
                  {copiedSnippet === 'py' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-[10px] font-mono overflow-x-auto h-40">
                {pythonSnippet}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
