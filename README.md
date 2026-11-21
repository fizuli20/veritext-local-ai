# Veritext Local AI

> **100% Zero-Token, Zero-API-Key AI Detector + Humanizer running entirely inside your browser via WebGPU, WebAssembly, and Pure TypeScript Stylometrics.**

[![Next.js 15](https://img.shields.io/badge/Next.js-15.2-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict%20%2B%20Unchecked-blue?logo=typescript)](https://www.typescriptlang.org/)
[![WebGPU & WASM](https://img.shields.io/badge/Compute-WebGPU%20%7C%20WASM-orange?logo=webassembly)](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
[![Zero-Token](https://img.shields.io/badge/Tokens-Zero%20%2F%20Free-emerald)](https://github.com/fizuli20/veritext-local-ai)
[![Zero-API-Key](https://img.shields.io/badge/API%20Keys-None%20Required-emerald)](https://github.com/fizuli20/veritext-local-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ Architectural Overview

Veritext Local AI eliminates all external AI API dependencies, paid tokens, and server-side model hosting costs. Every single detection and humanization pipeline runs **100% free** directly on the user's hardware through client Web Workers.

```text
                               ┌─────────────────────────────────────────────────────────────┐
                               │                    USER'S WEB BROWSER                       │
                               │                                                             │
 ┌─────────────────┐           │   ┌─────────────────────────────────────────────────────┐   │
 │   User Input    │ ─────────┼──►│             Offset-Exact Tokenizer                  │   │
 └─────────────────┘           │   └──────────────────────────┬──────────────────────────┘   │
                               │                              │                              │
                               │                              ▼                              │
                               │   ┌─────────────────────────────────────────────────────┐   │
                               │   │      Tier 1: Pure TS Stylometrics Engine (<30ms)    │   │
                               │   │   • Burstiness (CV & jump ratio)   • LLM Clichés     │   │
                               │   │   • Syntactic Uniformity           • MTLD Diversity │   │
                               │   │   • Trigram Shannon Entropy        • Symmetry       │   │
                               │   └──────────────────────────┬──────────────────────────┘   │
                               │                              │ (Instant Feedback)           │
                               │                              ▼                              │
                               │   ┌─────────────────────────────────────────────────────┐   │
                               │   │    Tier 2: In-Browser RoBERTa ONNX Web Worker       │   │
                               │   │      (@huggingface/transformers WebGPU / WASM)      │   │
                               │   └──────────────────────────┬──────────────────────────┘   │
                               │                              │                              │
                               │                              ▼                              │
                               │   ┌─────────────────────────────────────────────────────┐   │
                               │   │        Four-Stage Closed-Loop Humanizer             │   │
                               │   │   1. Pre-Analysis & Selective Freezing (<30% AI)    │   │
                               │   │   2. WebLLM (1B-3B) or Deterministic Cleaner        │   │
                               │   │   3. Entity & Number Guardrail Validation           │   │
                               │   │   4. Re-Verification & Targeted Micro-Refine        │   │
                               │   └──────────────────────────┬──────────────────────────┘   │
                               │                              │                              │
                               │                              ▼                              │
 ┌─────────────────┐           │   ┌─────────────────────────────────────────────────────┐   │
 │ Verified Human  │ ◄────────┼───│       Word-Level Myers Diff & Telemetry Gauge       │   │
 │     Output      │           │   └─────────────────────────────────────────────────────┘   │
 └─────────────────┘           └─────────────────────────────────────────────────────────────┘
```

---

## 🔬 Benchmark Verification Results (Phase 6)

Tested across the 20-passage realistic benchmark corpus (`tests/fixtures/benchmark-corpus.ts`) covering investigative journalism, engineering postmortems, personal narratives, op-eds, and academic abstracts:

| Metric | Target Specification | **Veritext Local AI Measured Result** |
| :--- | :--- | :--- |
| **Passage Classification Accuracy** | $\ge 85\%$ | **100.0%** (20 / 20 correct at threshold 50) |
| **Separation Delta (LLM vs Human)** | $\ge 35$ points | **75.2 points** (LLM: 93.3% vs Human: 18.1%) |
| **Mean Human Passage AI Score** | $\le 25\%$ | **18.1%** |
| **Mean Raw LLM Passage AI Score** | $\ge 75\%$ | **93.3%** |
| **Stylometrics p50 Latency** | $< 30$ms | **0.63ms** |
| **Stylometrics p95 Latency** | $< 50$ms | **0.97ms** |
| **Deterministic Cleaner Average AI% Drop** | $\ge 25$ points | **41.3 points** |
| **Factual Entity & Date Preservation** | $100\%$ | **100% Verified** |
| **Diff Reconstruction Precision** | Lossless | **100% Lossless** (`reconstruct(diff) === original`) |

---

## 🔒 Privacy & Security Guarantee

1. **Zero Data Egress:** Text entered into Veritext is never sent to OpenAI, Anthropic, Google, or any third-party server.
2. **Local Memory Execution:** Detection and humanization run in browser memory and Web Workers.
3. **No Strict CORP Wall:** Model weights download directly from Hugging Face Hub and CDN mirrors into browser Cache API / IndexedDB without cross-origin blocking.

---

## 💻 Hardware & Browser Support Matrix

| Browser / Hardware | Instant Stylometrics | In-Browser Neural Detector | Deterministic De-AI | WebGPU WebLLM (1B-3B) |
| :--- | :---: | :---: | :---: | :---: |
| **Chrome / Edge (Desktop, M1/M2/M3, RTX, Intel)** | ✅ `<1ms` | ✅ WebGPU | ✅ Instant | ✅ Full Local LLM |
| **Firefox (Desktop)** | ✅ `<1ms` | ✅ WASM | ✅ Instant | ⚠️ Fallback to Deterministic |
| **Safari (macOS / iOS)** | ✅ `<1ms` | ✅ WASM | ✅ Instant | ⚠️ Fallback to Deterministic |
| **Mobile Chrome (Android)** | ✅ `<2ms` | ✅ WASM / WebGPU | ✅ Instant | ✅ Tier: Lite (1B) |

---

## 🚀 Quickstart & Development

### Prerequisites
- Node.js `20.x` or higher
- npm `10.x` or higher

### Installation
```bash
git clone https://github.com/fizuli20/veritext-local-ai.git
cd veritext-local-ai
npm install
```

### Run Automated Test Suite
```bash
npm test
```

### Run Production Build
```bash
npm run build
npm run start
```

### Local Dev Server
```bash
npm run dev
# Open http://localhost:3000
```

---

## 📦 API Reference (Stateless Fast Endpoint)

Veritext also exposes a lightweight, zero-key Next.js API endpoint for automated CI and curl integrations:

### `POST /api/detect`
```bash
curl -X POST https://your-deployment.vercel.app/api/detect \
  -H "Content-Type: application/json" \
  -d '{"text": "In today'\''s fast-paced world, artificial intelligence plays a pivotal role in education."}'
```

Response:
```json
{
  "aiScore": 88,
  "rawComposite": 0.582,
  "isAi": true,
  "confidence": "high",
  "signals": {
    "burstiness": 0.95,
    "clicheLexicon": 0.82,
    "syntacticUniformity": 0.45,
    "lexicalDiversity": 0.65,
    "entropy": 0.4,
    "paragraphSymmetry": 0.3
  },
  "cached": false,
  "latencyMs": 1.2
}
```

### `GET /api/health`
Returns runtime engine status, supported in-browser models, and zero-key mandate confirmation.

---

## 📄 License
MIT © fizuli20
