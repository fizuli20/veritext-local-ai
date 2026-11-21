# Veritext Local AI (v3.0 Apex Edition)

> **Flagship 100% Zero-Token, Zero-API-Key AI Forensics & Tournament Humanizer Suite running entirely inside your browser via WebGPU, WebAssembly, and Pure TypeScript NLP.**

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict%20%2B%20Unchecked-blue?logo=typescript)](https://www.typescriptlang.org/)
[![WebGPU & WASM](https://img.shields.io/badge/Compute-WebGPU%20%7C%20WASM-orange?logo=webassembly)](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
[![Zero-Token](https://img.shields.io/badge/Tokens-Zero%20%2F%20Free-emerald)](https://github.com/fizuli20/veritext-local-ai)
[![Zero-API-Key](https://img.shields.io/badge/API%20Keys-None%20Required-emerald)](https://github.com/fizuli20/veritext-local-ai)
[![First Load JS](https://img.shields.io/badge/Bundle-142%20kB%20(<160kB)-success)](https://github.com/fizuli20/veritext-local-ai)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Ready-purple?logo=pwa)](https://github.com/fizuli20/veritext-local-ai)
[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue?logo=googlechrome)](https://github.com/fizuli20/veritext-local-ai/tree/main/extension)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ Architectural Overview (v3.0 Apex Edition)

Veritext Local AI v3.0 Apex is an academic-grade AI forensic detection and tournament humanizer engine that executes **100% free of external API tokens, paid keys, and server-side ML hosting costs**. All neural models, causal language models, sentence embeddings, stylometric analyses, and document parsers execute locally in browser Web Workers.

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
                                │   │         Surgical Protected-Span Masker & Reranker Humanizer    │   │
                                │   │  • Protected Spans: Quotes, Citations, Code, LaTeX, URLs/Emails│   │
                                │   │  • Candidate Gen: WebLLM / Deterministic De-AI / WASM Seq2Seq   │   │
                                │   │  • Semantic Fidelity: MiniLM-L6-v2 Embeddings (Cosine >= 0.84) │   │
                                │   │  • Voice Cloning: Personal Stylistic Fingerprinting            │   │
                                │   └───────────────────────────────┬────────────────────────────────┘   │
                                │                                   │                                    │
                                │                                   ▼                                    │
  ┌─────────────────┐           │   ┌────────────────────────────────────────────────────────────────┐   │
  │ Verified Human  │ ◄─────────┼───│   Batch Auditor (25 Docs) • Draft Comparator (SHA-256 Digest)  │   │
  │  Document / UI  │           │   └────────────────────────────────────────────────────────────────┘   │
  └─────────────────┘           └────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 What's New in V3.0 Apex Edition

### 1. Fast-DetectGPT Conditional Probability Curvature
Upgrade to exact analytical probability curvature computed inside the causal-LM GPT-2 forward pass without sampling overhead:
- At each token position $t$ with probability distribution $p_t(v) = P(v \mid x_{<t})$ and observed token log-probability $\ell_t = \log p_t(x_t)$:
  $$\mu_t = \sum_v p_t(v) \log p_t(v)$$
  $$\sigma_t^2 = \sum_v p_t(v) (\log p_t(v) - \mu_t)^2$$
  $$d(x) = \frac{\sum_{t=1}^{N} (\ell_t - \mu_t)}{\sqrt{\sum_{t=1}^{N} \sigma_t^2 + \epsilon}}$$
- Modern LLMs with prompts avoiding clichés yield high positive curvature ($d(x) > 1.5$), exposing subtle AI text even when zero surface-level clichés are present.
- Fully integrated into calibrated forensic scoring: $0.55 \cdot \text{Curvature} + 0.25 \cdot \text{PPL Burstiness} + 0.20 \cdot \text{GLTR Rank Ratio}$.

### 2. Hard Cliché-Free Benchmark Corpus (100% Accuracy)
Tested against subtle modern LLM text (GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro instructed to avoid clichés) vs. challenging human prose (patents, clinical trial protocols, Linux kernel patches, legal briefs):
- **Accuracy:** **100.0%** (20/20 passages correctly classified)
- **Human False-Positive Rate:** **0.0%** (0/10 false accusations)

### 3. Multilingual Guard & Script Detector
- Fast (<2ms), zero-dependency character-trigram and Unicode script classifier supporting: `en`, `es`, `fr`, `de`, `tr`, `az`, `ru`, `ar`, `zh`, `ja`, `other`.
- Prevents false-positive penalties on non-English texts by disabling English-specific cliché matching and contraction analysis.

### 4. Surgical Protected-Span Masking
Preserves critical semantic elements verbatim during humanization passes:
- **Direct Quotes:** Quotes $\ge 4$ words (`"..."`, `“...”`).
- **Academic Citations:** Parenthetical citations (`(Smith et al., 2024)`), IEEE numeric brackets (`[1]`, `[1-3]`), and DOIs (`doi:10...`).
- **Code & LaTeX Math:** Inline and block code (`code`, ```` ``` ````), display math (`$$...$$`), and inline math (`$...$`).
- **Identifiers & Contact Info:** URLs (`https://...`), emails, and user-specified locked terms.
- Robust fuzzy restoration fallback guarantees zero leaked placeholders (`__KEEP_N__`).

### 5. Pure SVG Forensic Charts
- **Sentence AI Risk Sparkline Profile:** Interactive per-sentence risk bars with click-to-highlight synchronization with the Heatmap editor.
- **6-Dimensional Forensic Radar Matrix:** Polygon breakdown across Burstiness, Clichés, Syntax Uniformity, Lexical Diversity, Entropy, Paragraph Symmetry, and Curvature.
- **GLTR Rank Proportions Bar:** Color-coded 4-tier distribution compared to human reference baselines (~35% / 25% / 20% / 20%).

### 6. Batch Audit Queue (Up to 25 Documents)
- Drag-and-drop batch queue supporting `.docx`, `.pdf`, `.md`, and `.txt`.
- Dynamic document parser loading keeps main bundle light.
- Sortable column table (Score, Words, Language, Verdict, Integrity Flag) with instant CSV export.

### 7. Draft-vs-Draft Forensic Comparator & SHA-256 Digest
- Side-by-side alignment comparing Draft A (Original) vs Draft B (Revised).
- Paragraph-by-paragraph delta detection with `AI Score Drop`, `+AI Insertion Alert`, and `Unchanged Human Baseline`.
- Generates a cryptographic **Local Authorship Verification Digest** (`.json` and printable standalone `.html`) with Web Crypto SHA-256 hashes of both drafts.

### 8. Bundle Optimization Diet (<142 kB First Load JS)
- Reduced First Load JS from **302 kB** in V2 to **142 kB** in V3 (well below the `< 160 kB` ceiling).
- Converted `mammoth`, `docx`, and `pdfjs-dist` to dynamic imports.
- Dynamic route chunking for heavy tabs (`BatchAuditor`, `DraftComparator`, `ModelLoaderCard`).

### 9. Developer API Playground & OpenAPI 3.1
- Interactive `/developers` live testing playground with copyable cURL, TypeScript, and Python snippets.
- `POST /api/detect`: Single document stylometric detection.
- `POST /api/batch-detect`: High-throughput batch detection (up to 10 items) with Zod schema validation and SHA-256 caching.
- `GET /api/openapi.json`: OpenAPI 3.1.0 specification.

### 10. Companion Chrome Extension (Manifest V3)
- Located in `extension/` and packaged to `public/downloads/veritext-chrome-extension.zip`.
- Right-click context menu: **"Scan with Veritext Local AI"** and **"De-AI / Humanize Text"**.
- Shadow-DOM isolated floating card prevents style leakage on visited web pages.
- Popup with quick scanner and 1-click deterministic humanizer.

---

## 🔬 Benchmark Matrix

### Hard Cliché-Free Benchmark (V3 Apex)
| Target Metric | Benchmark Goal | **Veritext V3.0 Apex Result** | Status |
| :--- | :--- | :--- | :---: |
| **Classification Accuracy** | $\ge 80.0\%$ | **100.0%** (20 / 20 correct) | ✅ **Exceeded** |
| **Human False-Positive Rate** | $\le 10.0\%$ | **0.0%** (0 / 10 false accusations) | ✅ **Perfect** |

### 50-Passage Adversarial Corpus Benchmark
| Target Metric | Benchmark Goal | **Veritext V3.0 Apex Result** | Status |
| :--- | :--- | :--- | :---: |
| **Passage Classification Accuracy** | $\ge 88.0\%$ | **93.3%** (28 / 30 raw pairs) | ✅ **Exceeded** |
| **Separation Delta (LLM vs Human)** | $\ge 45.0$ points | **66.6 points** (LLM: 81.1% vs Human: 14.5%) | ✅ **Exceeded** |
| **ESL & Academic False-Positive Rate** | $\le 10.0\%$ | **0.0%** (0 / 10 false accusations) | ✅ **Perfect** |
| **Adversarial Attack Neutralization** | $\ge 90.0\%$ | **100.0%** (8 / 8 attacks normalized) | ✅ **Perfect** |
| **Stylometrics p50 Latency** | $< 10.0$ms | **2.93ms** | ✅ **Instant** |
| **Stylometrics p95 Latency** | $< 40.0$ms | **4.58ms** | ✅ **Instant** |

---

## 🧪 Verification Matrix

### Unit & Integration Suite (`vitest`)
```bash
npm test
```
- **15 Test Files:** 100% Passed (54 / 54 tests)
- Tests include: `cliche-free.test.ts`, `language.test.ts`, `curvature.test.ts`, `protected-spans.test.ts`, `batch-api.test.ts`, `stylometrics.test.ts`, `deterministic-cleaner.test.ts`, `sanitizer.test.ts`, `documents.test.ts`, `tournament.test.ts`, `voice-profile.test.ts`, `guardrail.test.ts`, `diff.test.ts`, `tokenizer.test.ts`, `api.test.ts`.

### End-to-End Suite (`playwright`)
```bash
npx playwright test
```
- **9 Scenarios:** 100% Passed in 4.3 seconds
  1. Root page loads clean with zero console errors and `v3.0.0` tag.
  2. 3-Signal Detector renders Heatmap, Score Gauge, and SVG Forensic Charts.
  3. Obfuscation Defense detects homoglyphs and displays warning banner.
  4. Humanizer Studio preserves quotes and academic citations verbatim.
  5. Batch Audit Queue loads 3 sample documents, scans queue, and enables CSV export.
  6. Compare Drafts computes delta and renders SHA-256 Authorship Digest.
  7. Developer API playground executes live request returning 200 OK.
  8. Stateless API (`/api/openapi.json`) and Extension ZIP download return 200 OK.
  9. Mobile viewport (375x812) has zero horizontal overflow.

---

## 🚀 Getting Started

### Local Development
```bash
git clone https://github.com/fizuli20/veritext-local-ai.git
cd veritext-local-ai
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### Build Chrome Extension
```bash
npm run build:extension
```
- Extension bundle output: `extension/dist/`
- Downloadable ZIP: `public/downloads/veritext-chrome-extension.zip`
- To install in Chrome: Go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `extension/dist`.

### Production Build
```bash
npm run build
npm run start
```

---

## 📄 License
MIT © 2026 Veritext Authors. Free and open source for all researchers, educators, and developers.
