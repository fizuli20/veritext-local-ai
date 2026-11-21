# Codex Handoff & Forensic Audit Report

**Date:** November 22, 2026  
**Repository:** `fizuli20/veritext-local-ai`  
**Live Site Audited:** `https://veritext-local-ai.vercel.app/`  
**Engineer:** Antigravity Principal Systems Engineer  

---

## 1. Executive Summary & Codebase Baseline

A forensic audit of Codex's recent upgrades to `veritext-local-ai` (head commit `904cbab`) confirms that while the UI layout and aesthetic styling in `src/components/Workspace.tsx` are modern, sleek, and well-structured, **both the AI Detector and AI Humanizer fail during realistic user operation**.

### Baseline Code Health
- **TypeScript (`npx tsc --noEmit`):** 0 errors.
- **ESLint (`npm run lint`):** 0 errors.
- **Unit/Integration Tests (`npm test`):** 20 test files, 91 passing tests.
- **Git State:** Clean tree on `main` following commits `f6b36be`, `be706cd`, `557bbf2`, and `904cbab`.

However, the automated test suite passed because tests evaluated isolated components or mocked functions rather than end-to-end inference pipelines on realistic text.

---

## 2. Live Site Forensic Inspection Results

Using automated headless Chromium instrumentation against `https://veritext-local-ai.vercel.app/`:
1. **Initial Page Load:** 0 critical console errors; clean hydration.
2. **AI Detector Tab:**
   - On the default sample, the detector loads `onnx-community/tmr-ai-text-detector-ONNX` (WASM Q8).
   - On authentic human prose (e.g., grandfather's workbench memoir, 71 words), the detector produces high raw scores (~0.96) and displays `Inconclusive: 96/100 model signal` or flags human writing as ambiguous/AI.
3. **AI Humanizer Tab:**
   - The UI correctly displays Local Model presets (LM Studio `localhost:1234/v1`, Ollama `localhost:11434/v1`) and Browser WebLLM options.
   - When a mock/real local completion completes streaming, the output pane **reverts to the original input text** accompanied by the notice:
     > *"The model did not produce a changed draft that passed preservation checks after a retry. The original was retained. Try a larger model or another tone."*

---

## 3. Root Cause Analysis

### Root Cause 1: AI Detector Calibration Dead Zone & Raw Logit Shift
In `src/lib/detector/evidence.ts` and `src/data/detector-calibration.json`:
- **Platt Scaling Distortion:** Codex fitted Platt calibration coefficients (`slope: 3, intercept: -11`) against historical HC3 data.
- **The Mathematical Trap:**
  $$\text{Reference Probability} = \frac{1}{1 + e^{-(3 \cdot \text{logit}(\text{score}) - 11)}}$$
  For `referenceProbability` to reach $\ge 0.8$, the logit must satisfy $3 \cdot \text{logit} - 11 \ge 1.386 \implies \text{logit} \ge 4.128 \implies \text{score} \ge 0.9841$.
- **The Verdict Dead Zone:** In `evidence.ts`:
  ```typescript
  const high = score >= 0.8 && referenceProbability >= 0.8 && interval.lower > 0.5;
  const low = score <= 0.2 && referenceProbability <= 0.2 && interval.upper < 0.5;
  if (bin.count < 10 || (!high && !low)) {
    return { ...evidence, status: "uncertain", verdict: "Inconclusive" };
  }
  ```
  Any raw model score between $0.20$ and $0.984$ (a 78% range!) fails both `high` and `low`, automatically labeling the text as **Inconclusive**!
- **Single-Signal Fragility:** `detector.worker.ts` relied solely on raw TMR RoBERTa inference without fusing our proven multi-signal stylometrics (`analyzeStylometrics`) or Fast-DetectGPT curvature $d(x)$, allowing raw model logit bias to mischaracterize human prose.

### Root Cause 2: Humanizer Dropping LLM Streams & Reverting to Source
In `src/lib/humanizer/rewrite-pipeline.ts` and `src/lib/humanizer/rewrite-review.ts`:
- **Aggressive Over-Rejection:** `reviewRewrite` checks multiple fragile heuristics, including an exact count match for negation tokens (`no|not|never|neither|cannot|without|n't`). Natural paraphrasing often replaces "they might not have the chance" with "they rarely have the chance", shifting negation count by 1.
- **Total Discard Logic:** When `reviewRewrite` returns any issue, `runRewritePipeline` discards the entire LLM response:
  ```typescript
  if (issues.length) {
    feedback = "Your previous draft failed preservation checks...";
    continue; // attempt retry
  }
  ```
  After 2 attempts, if `accepted` is null, it executes:
  ```typescript
  if (accepted === null || accepted.trim() === originalPart.trim()) {
    retained++;
    accepted = originalPart; // Discards LLM output and keeps original text!
  }
  ```
  The user is returned their exact source text despite the model generating a valid rewrite.
- **Stream Termination Brittleness:** In `local-server-client.ts`, if an SSE stream closes without an explicit `data: [DONE]` line, line 548 threw an unhandled exception:
  `"The connection ended before the model completed. The draft is incomplete."`

### Root Cause 3: Service Worker (`public/sw.js`)
- `public/sw.js` previously unregistered itself, failing to provide proper caching or network pass-through guarantees for cross-origin assets (Hugging Face CDN, jsDelivr, local servers on ports 1234/11434).

---

## 4. Phase-by-Phase Remediation Plan

1. **Phase 1: Infrastructure & Service Worker**
   - Update `public/sw.js` to version `veritext-shell-v5`, bypass cross-origin / Range / non-GET requests immediately, and call `self.skipWaiting()` and `clients.claim()`.
   - Throttle worker progress messages to $\le 1$ per 150ms with trailing flush.
   - Enforce WebGPU $\to$ WASM fallback in worker initialization.

2. **Phase 2: AI Detector Calibration & Ensemble Fusion**
   - Ensemble TMR RoBERTa with pure TypeScript stylometrics (`analyzeStylometrics`) to eliminate false positives and false negatives.
   - Fix verdict boundaries in `evidence.ts` so human texts score $\le 25\%$ and AI texts score $\ge 75\%$.
   - Preserve 1-to-1 sentence character offsets without space or newline distortion.
   - Enforce verification gate in `scripts/verify-detector-real.mjs` (5 AI $\ge 75\%$, 5 Human $\le 25\%$).

3. **Phase 3: AI Humanizer Execution & Output Pipeline**
   - Ensure `runRewritePipeline` displays the LLM's rewrite with advisory review notes rather than discarding the output.
   - Support graceful SSE completion when chunks are received even if `[DONE]` is omitted.
   - Clean reasoning tokens (`<think>`, `<thought>`, `<|thought|>`) in real time.
   - Retain protected spans without leaking `__KEEP_` or `VTLOCK_` tokens.
   - Preserve Codex's UI layout and visual styling completely in `Workspace.tsx`.

4. **Phase 4: Automated Verification & Production Deployment**
   - Execute TypeScript check, ESLint, unit tests, detector verification script, and Playwright E2E.
   - Deploy live to Vercel (`vercel --prod --yes`) and verify production URL.
