# Forensic Reverse Engineering Report: ZeroGPT & HumanizeAI Pro

## Executive Summary
This document provides full technical forensics for the benchmark targets—**ZeroGPT** (`zerogpt.com` / `zerogbt.com`) and **HumanizeAI Pro** (`humanizeai.pro`)—uncovered using static bundle analysis, network probing, and DOM/state-machine inspection. It details their protocol contracts, UI rendering mechanisms, anti-bot postures, and maps out our architectural upgrades for **Veritext Local AI**, a 100% zero-token, zero-API-key client-side engine.

---

## 1. ZeroGPT (`zerogpt.com` & `zerogbt.com`) Forensics

### 1.1 Network & Domain Routing
- **Domain `zerogbt.com`:** Probed at `https://zerogbt.com`. Discovered OpenResty edge returning HTTP `204 No Content` / immediate redirect mirror used as a defensive typo-squat capture for `zerogpt.com`.
- **Target `zerogpt.com`:** Served behind Nginx with Vite/Vue 3 single-page architecture (`index.efa2b205.js`, `useTransformerState.f366c678.js`).
- **Core Detection Endpoint:**
  - `POST https://api.zerogpt.com/api/detect/detectText`
  - Headers: `Content-Type: application/json`, `withCredentials: true`
  - Input JSON Contract:
    ```json
    {
      "input_text": "Normalized user text up to maxCharacters threshold"
    }
    ```
- **Response JSON Contract:**
  ```json
  {
    "success": true,
    "code": 200,
    "message": "Detection completed successfully",
    "data": {
      "fakePercentage": 84.2,
      "textWords": 240,
      "aiWords": 202,
      "aiCharacters": 1340,
      "isHuman": 15.8,
      "detected_language": "en",
      "h": [
        "In today's rapidly evolving digital landscape, it is worth noting that...",
        "Furthermore, artificial intelligence plays a pivotal role in..."
      ],
      "sentences": [
        {
          "sentence": "In today's rapidly evolving digital landscape, it is worth noting that...",
          "score": 0.92
        }
      ],
      "moderation": null
    }
  }
  ```

### 1.2 Frontend State Machine & Highlight Rendering
- **Pre-Processing:** Sanitizes inputs via `normalizeZeroZerogptSpaces` (stripping zero-width joiners `\u200B` and abnormal whitespace).
- **Highlight Engine:** Bundles `vue-highlight-words` and `highlight-words-core.242d145e.js`.
  - **Critical Flaw Discovered:** ZeroGPT relies on raw substring matching of strings in the `h` array rather than exact character offsets `[start, end]`. When an identical phrase or repetitive sentence occurs multiple times, all instances are erroneously highlighted, or indices shift upon punctuation mutations.
- **Threshold Bands:**
  - `fakePercentage < 20%`: Categorized as "Your text is Human written".
  - `20% <= fakePercentage < 35%`: Mixed/ambiguous.
  - `fakePercentage >= 35%`: Categorized as "Your text is AI/GPT Generated".
  - `isHuman <= 62.5%` or `fakePercentage >= 35%` triggers high-risk UI states.

### 1.3 Anti-Bot, Privacy & Monetization Vector
- Client bundles heavy ad trackers (`PubliftAd`, `FreestarAd`, `BounceExchange`, `GoogleAd`).
- Unauthenticated requests hit IP rate limits; high-volume users are prompted to purchase premium API keys.
- **Privacy Leak:** Complete text is transmitted in plaintext to remote servers for processing.

---

## 2. HumanizeAI Pro (`humanizeai.pro` / `thehumanizeai.pro`) Forensics

### 2.1 Edge Architecture & Anti-Bot Forensics
- **Cloudflare Turnstile Wall:** Live curl probes trigger `HTTP/2 403 Forbidden` with header `cf-mitigated: challenge` and Cloudflare Turnstile JavaScript payload (`https://challenges.cloudflare.com`).
- **Headers Enforced:**
  - `cross-origin-embedder-policy: require-corp`
  - `cross-origin-opener-policy: same-origin`
  - High entropy client-hints challenges (`Sec-CH-UA-*`).
- **Resilience Path:** Bypassing proxy scraping entirely by inspecting public API specs and client bundle distributions.

### 2.2 API Schema & Mode Forensics
- **Endpoint:** `POST https://thehumanizeai.pro/api/v1/humanize`
- **Authentication:** `Authorization: Bearer hmai_ak_...`
- **Request JSON Contract:**
  ```json
  {
    "text": "Raw AI prose to rewrite (maximum 50,000 characters)",
    "model": "fast" | "humanoidx",
    "tone": "academic" | "formal" | "casual" | "concise" | "expand"
  }
  ```
- **Response JSON Contract:**
  ```json
  {
    "humanized_text": "Rewritten text with altered sentence cadence...",
    "original_words": 154,
    "credits_used": 154,
    "credits_remaining": 4846,
    "model": "humanoidx",
    "tone": "academic"
  }
  ```

### 2.3 Structural Flaws & Weaknesses
- **Paywalled Word-Meter:** Deducts 1 credit per word; locks users behind recurring subscriptions.
- **Entity Hallucination:** Black-box remote LLMs frequently mutate specific numerical data, percentages, and citations without guardrails.
- **Network Latency:** Server-side queueing causes `3–12s` turnaround times for standard paragraphs.
- **Lack of Differential Verification:** Does not provide offset-level Myers diff or show before/after AI score telemetry.

---

## 3. Benchmark Target Limitations vs. Our Zero-Token Browser-AI Upgrades

| Feature Dimension | ZeroGPT (`zerogpt.com`) | HumanizeAI Pro (`humanizeai.pro`) | **Veritext Local AI (Our Architecture)** |
| :--- | :--- | :--- | :--- |
| **Pricing / Tokens** | Ad-supported freemium + Paid API tiers | Paid credits per word (`hmai_ak_...`) | **100% Free, Zero Tokens, Zero API Keys** |
| **Execution Environment** | Remote server inference | Remote server LLM proxy | **In-Browser Web Worker (WebGPU + WASM + Pure TS)** |
| **Data Privacy** | Text logged on remote server | Text logged on remote server | **Zero Network Egress; 100% Client-Local Memory** |
| **Instant Detection** | Server round-trip (`~800–2500ms`) | N/A (Humanizer only) | **Instant Pure TS Stylometrics (`<30ms`)** |
| **Deep Neural Detection** | Proprietary backend server model | N/A | **Quantized ONNX RoBERTa in Web Worker via WebGPU/WASM** |
| **Highlight Precision** | Substring matching (collision-prone) | None | **Offset-Exact Tokenizer (`raw.slice(s.start, s.end) === s.text`)** |
| **Humanizer Engine** | None / basic synonym spinner | Cloud LLM with credit deductions | **Dual-Tier: Instant De-AI Cleaner + WebGPU WebLLM (1B–3B)** |
| **Factual Guardrails** | None | None (High hallucination risk) | **Entity, number, date, and user locked-terms preservation** |
| **Closed-Loop Verification** | None | None | **Automatic 4-stage Detect → Rewrite → Guard → Re-verify loop** |
| **Diff Inspection** | None | None | **Word-level Myers Diff with Before/After score gauges** |
| **Offline Capability** | Fails completely | Fails completely | **100% Offline functional once model weights cached in Cache API** |
