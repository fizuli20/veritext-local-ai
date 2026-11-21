# Veritext Local AI (v4.0 Titan Edition)

> **Flagship 100% Zero-Token, Zero-API-Key AI Forensics, LM Studio/Ollama Native Connector & Cryptographic Proof-of-Human Suite running entirely inside your browser via WebGPU, WebAssembly, and Pure TypeScript NLP.**

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict%20%2B%20Unchecked-blue?logo=typescript)](https://www.typescriptlang.org/)
[![WebGPU & WASM](https://img.shields.io/badge/Compute-WebGPU%20%7C%20WASM-orange?logo=webassembly)](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
[![Zero-Token](https://img.shields.io/badge/Tokens-Zero%20%2F%20Free-emerald)](https://github.com/fizuli20/veritext-local-ai)
[![Zero-API-Key](https://img.shields.io/badge/API%20Keys-None%20Required-emerald)](https://github.com/fizuli20/veritext-local-ai)
[![First Load JS](https://img.shields.io/badge/Bundle-149%20kB%20(<160kB)-success)](https://github.com/fizuli20/veritext-local-ai)
[![ROC-AUC](https://img.shields.io/badge/ROC--AUC-0.975-brightgreen)](https://veritext-local-ai.vercel.app/benchmarks)
[![ECDSA P-256](https://img.shields.io/badge/Proof--of--Human-ECDSA%20P--256-blueviolet)](https://veritext-local-ai.vercel.app/verify)
[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue?logo=googlechrome)](https://github.com/fizuli20/veritext-local-ai/tree/main/extension)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ Architectural Overview (v4.0 Titan Edition)

Veritext Local AI v4.0 Titan is an academic-grade AI forensic detection, tournament humanizer, and cryptographic authorship certification engine that executes **100% free of external API tokens, paid keys, and server-side ML hosting costs**. Inference runs strictly via:
1. **User's Local Desktop Server:** Native **LM Studio** (`localhost:1234/v1`) or **Ollama** (`localhost:11434/v1`) streaming connector.
2. **In-Browser WebGPU/WASM Workers:** `@huggingface/transformers` and `@mlc-ai/web-llm` running inside isolated Web Workers.
3. **Pure TypeScript Instant Engines:** Stylometrics, Fast-DetectGPT curvature $d(x)$, homoglyph sanitization, and deterministic clean-up.

```text
                                ┌────────────────────────────────────────────────────────────────────────┐
                                │                       USER'S BROWSER SANDBOX                           │
                                │                                                                        │
  ┌─────────────────┐           │   ┌────────────────────────────────────────────────────────────────┐   │
  │   User Input    │ ──────────┼──►│     Adversarial Sanitizer (Zero-Width + Homoglyph Defense)     │   │
  └─────────────────┘           │   └───────────────────────────────┬────────────────────────────────┘   │
                                │                                   │                                    │
                                │                                   ▼                                    │
                                │   ┌────────────────────────────────────────────────────────────────┐   │
                                │   │    Multilingual Script Guard & Fast Trigram Language Detector   │   │
                                │   └───────────────────────────────┬────────────────────────────────┘   │
                                │                                   │                                    │
                                │                                   ▼                                    │
                                │   ┌────────────────────────────────────────────────────────────────┐   │
                                │   │        SOTA Fast-DetectGPT Curvature & 3-Signal Ensemble       │   │
                                │   │  • Signal 1: Pure TS Stylometrics (CV, MTLD, Entropy, Punct)   │   │
                                │   │  • Signal 2: RoBERTa ONNX Web Worker (WebGPU / WASM)           │   │
                                │   │  • Signal 3: Causal LM True Perplexity, Curvature d(x) & GLTR  │   │
                                │   │  • SVG Analytics: Sentence Sparkline + 6D Radar + GLTR Bar     │   │
                                │   └───────────────────────────────┬────────────────────────────────┘   │
                                │                                   │                                    │
                                │                                   ▼                                    │
                                │   ┌────────────────────────────────────────────────────────────────┐   │
                                │   │     4-Tier Humanizer & Desktop LLM Connector (Honest Badge)    │   │
                                │   │  • Tier 1: LM Studio / Ollama (Desktop Native VRAM via SSE)    │   │
                                │   │  • Tier 2: Browser WebLLM (Qwen2.5-1.5B via WebGPU)            │   │
                                │   │  • Tier 3: Browser WASM Seq2Seq (Flan-T5)                      │   │
                                │   │  • Tier 4: Instant Deterministic Cleaner (<15ms)               │   │
                                │   │  • Factual Guard: Protected Quotes, Citations, Code & Formulas │   │
                                │   │  • Semantic Fidelity: MiniLM-L6-v2 Embeddings (Cosine >= 0.84) │   │
                                │   └───────────────────────────────┬────────────────────────────────┘   │
                                │                                   │                                    │
                                │                                   ▼                                    │
  ┌─────────────────┐           │   ┌────────────────────────────────────────────────────────────────┐   │
  │ Verified Human  │ ◄─────────┼───│   Cryptographic Proof-of-Human Studio & Offline Verifier       │   │
  │ Certificate / UI│           │   │  • ECDSA P-256 + SHA-256 Document Hash Signing (.json)         │   │
  └─────────────────┘           │   │  • Keystroke Interval Cadence Entropy & Revision Timeline      │   │
                                │   │  • Offline Verifier (/verify) Flags Single-Character Tampering │   │
                                │   └────────────────────────────────────────────────────────────────┘   │
                                └────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key v4.0 Titan Upgrades

### 1. Native LM Studio & Ollama Desktop Streaming Connector
- **Zero-Dependency SSE Client:** Connects directly from browser JavaScript to `http://localhost:1234/v1` (LM Studio) or `http://localhost:11434/v1` (Ollama).
- **Model Family Auto-Tuning:** Detects `gemma`, `qwen`, `mistral`, `llama`, and `muse` families and auto-applies anti-slop sampling parameters (e.g., Gemma Anti-Slop: `temp 0.85, top_p 0.92, freq_penalty 0.28, pres_penalty 0.22`).
- **DeepSeek & Gemma `<think>` Stripping:** Cleans reasoning chains, `<thought>`, `<|thought|>`, and conversational filler (`"Here is the humanized text:"`) in real-time.
- **Actionable CORS Doctor:** Diagnoses connection failures instantly and provides one-click copyable terminal commands:
  ```bash
  # LM Studio
  lms server start --cors
  # Ollama
  OLLAMA_ORIGINS="*" ollama serve
  ```
- **Execution Provenance Badge:** Output cards honestly show the exact engine that processed the text (`LM Studio · google/gemma-4-12b`, `WebLLM · Qwen2.5-1.5B`, `WASM Seq2Seq`, or `Instant Stylometrics`).

### 2. Worker Truth Audit & System Diagnostics
- **Live Worker PING/PONG Protocol:** Probes all 5 Web Workers with handshake roundtrips, measuring response latency in milliseconds:
  1. `RoBERTa Detector Worker`
  2. `GPT-2 Curvature & PPL Worker`
  3. `MiniLM-L6 Embedding Worker`
  4. `Flan-T5 Paraphraser Worker`
  5. `WebLLM Local LLM Worker`
- **Hardware Telemetry:** Inspects `navigator.gpu`, active adapter limits, and OPFS/CacheStorage disk usage in a unified diagnostic table.

### 3. Out-of-Distribution Calibration & ROC Forensics (`/benchmarks`)
- **Holdout Corpus:** Evaluated against 4 diverse linguistic domains: Wikipedia/Encyclopedic, ArXiv/Academic, Subtle Cliché-Free AI, and Raw LLM default text.
- **Academic Metrics:** Measures **ROC-AUC (0.975)**, **TPR @ 5% FPR (50%)**, and **ECE Calibration Error (0.186)**.
- **Interactive SVG Dashboard:** Pure SVG Receiver Operating Characteristic (ROC) curve with operating threshold point ($\tau \approx 0.60$), 10-bin Calibration Reliability Diagram, and honest domain limitations disclosure.

### 4. Cryptographic "Proof-of-Human" Author Studio & Offline Verifier (`/verify`)
- **Web Crypto ECDSA P-256 + SHA-256:** Generates and stores author cryptographic keypairs locally in the browser.
- **Forensic Keystroke Telemetry:** Records active composition duration, typing speed (WPM), paste event ratios, and Shannon entropy of inter-keystroke intervals ($H > 2.5\text{ bits}$).
- **Continuous Revision Trail:** Captures intermediate SHA-256 draft snapshots over time, mathematically proving iterative manual creation.
- **Tamper-Evident Verification:** The offline verifier at `/verify` validates `.veritext-proof.json` against candidate text. **Any single-character alteration, punctuation swap, or whitespace edit immediately triggers a bold red `TAMPER DETECTED: Content does not match signed cryptographic hash` alert.**
- **Printable Certificate:** One-click PDF/print export of a formal Certificate of Authenticated Human Authorship.

---

## 📊 Benchmark Calibration Results

| Corpus Domain | Ground Truth | Sample Size | False Positive Rate | Accuracy |
| :--- | :--- | :--- | :--- | :--- |
| **Wikipedia / Encyclopedic** | Human-Authored | 5 passages | 40% FPR (Formulaic prose) | 60% |
| **ArXiv / Academic & Clinical** | Human-Authored | 5 passages | 0% FPR | 100% |
| **Modern Stealth AI (Zero-Cliché)** | AI-Generated | 5 passages | N/A (True AI) | 100% |
| **Raw LLM Default Generation** | AI-Generated | 5 passages | N/A (True AI) | 100% |

- **Overall ROC-AUC:** `0.975`
- **Expected Calibration Error (ECE):** `0.186`
- **First Load JS on `/`:** `149 kB` (Strictly `< 160 kB`)

---

## 📦 Developer API & Extension

### Live REST Endpoints (100% Free / Zero API Key)
- `POST /api/detect`: Fast 3-signal stylometric evaluation
- `POST /api/batch-detect`: High-throughput multi-document evaluation (up to 25 items)
- `GET /api/health`: Engine health and uptime status
- `GET /api/openapi.json`: OpenAPI 3.1 schema specification
- `GET /downloads/veritext-chrome-extension.zip`: Companion Manifest V3 browser extension

### Companion Chrome Extension
Download the packaged extension zip directly from `/downloads/veritext-chrome-extension.zip` or build from source:
```bash
npm run build:extension
```
Load unpacked in Chrome via `chrome://extensions` (Developer Mode).

---

## 🧪 Verification & Test Coverage

```bash
# Run all 18 Vitest test suites (72 tests)
npm test

# Run all 14 Playwright E2E scenarios
npx playwright test

# Check bundle size and build Next.js production output
npm run build
```

---

## 📄 License
MIT License. © 2026 Veritext Local AI.
