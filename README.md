# Veritext 5.3.1

**5.0 workspace.** Revise a selected range in the edited draft with the same preservation checks, then undo if needed. The detector reports when checked paragraphs have widely different raw scores and includes their summary in the JSON export. Remember this workspace is off by default. Enable it to save source text, the edited draft, detector text and editing preferences, including the voice sample, in the current browser. Turning it off removes the saved copy. Restored text can be scanned again to generate fresh evidence.

A focused AI-text signal viewer and local rewrite editor. No paid inference API key is required.

- [Production](https://veritext-local-ai.vercel.app)
- [Validation and limitations](https://veritext-local-ai.vercel.app/benchmarks)
- [Measured test ledger](docs/VALIDATION.md)

## What runs

**Detector:** Detailed (default) uses the MIT-licensed `YatoVoid/forsakeai-detector` conversion of Desklib DeBERTa, pinned to `a155f82aeee54d33d8d6e50c963dda591cc548c8`, with weight-only INT8 storage and FP32 math. Its single output logit is passed through sigmoid, never single-class softmax. Transformers.js is pinned to 4.3.2 for correct DeBERTa tokenization. It runs single-thread WASM with a 438 MB initial download. Light retains the pinned `onnx-community/tmr-ai-text-detector-ONNX` Q8, single-thread WASM inside a browser worker. Input is segmented into overlapping 480-token windows, not guessed word limits. Basic scans score the document first and inspect up to six English paragraphs of at least 80 words. The export preserves the original offsets and uncalibrated paragraph scores. The document score appears first. The initial scan then adds up to eight sentence-context highlights, with a control to check more. Context scoring uses the same neural model and preserves raw UTF-16 offsets. It is capped at the first 60 contexts; remaining contexts are explicitly unscored. A bounded in-memory score cache avoids rescoring identical windows within the active worker. Light model labels are explicitly verified as `human` and `ai`. Switching profiles disposes the old model and clears the score cache. Scores and verdicts derive from the same inference; no phrase/punctuation-based score multiplier or injected .99 is used.

Raw model scores are not authorship probabilities. A provisional Platt calibration is fitted on 82 historical HC3 passages and evaluated on 80 different-question passages. The UI displays this limited reference separately, gives a sample-bin Wilson interval, and abstains when signals disagree, reference support is thin, input is under 80 words, or the detected language is unsupported. A separate frozen-model stress test on 394 public 2026-labelled passages exposed misses on newer AI: the earlier 4.2 HC3 calibration caught 28/56 AI-labelled texts at 0.5; the 4.3 Light recheck caught 26/56. The interface therefore explicitly treats low signal as authorship unknown. The calibration is not a reliable probability for contemporary or arbitrary writing. No refit on that stress test was used to conceal its failures. See the ledger for the actual failures and limits.

**4.3 measured comparison:** on the same 394 external items, With both models rechecked on Transformers.js 4.3.2, Detailed raw ROC AUC was 0.962 versus Light 0.882. Raw false positives: 51/338 versus 42/338; raw AI recall: 52/56 versus 44/56 at 0.5. Detailed historical-reference threshold 0.5: 10 human false positives, 43 AI detected. This set was previously examined, so this is a comparison, not blind validation. [Full score report](docs/validation/detailed-results.json).

**4.4 public-workflow comparison:** [Observed public outputs, differences and limits](docs/PUBLIC_WORKFLOW_COMPARISON.md). New: independent Light edit/Full rewrite depth, local TXT/Markdown/DOCX/text-PDF import, and a saved analysis with actual model/revision, context scores and uncertainty. Full rewrite supplies readable facts to the model and validates them afterwards; long protected blocks stay masked. This avoids making placeholder failures the only way to change a factual passage. Both paths use the same preservation checks and bounded recovery.

**Rewrite editor:** paste your text, choose Humanize, then copy the draft. The first click starts the selected WebGPU model and rewrites once it is ready. The default download is about 1 GB. Model settings lets you choose a different browser model or connect LM Studio/Ollama on loopback. The browser resolves the model against the installed WebLLM registry. Editing options and Draft tools contain optional controls. On eligible browser paragraphs, Full rewrite uses paragraph context and verifies model changes individually. It can also apply checked sentence restructurings derived from the source wording and labels them in the draft. Choose Light (Llama 1B), Balanced (Qwen 1.5B, default), or a larger Qwen 3B or Llama 3B model; model availability is resolved against the actual installed registry. Light edit masks numbers, short/long quotations, citations, URLs, code and user-locked terms before inference. Full rewrite supplies readable text for bounded sections and rejects changed tracked facts, repeated protected spans, and missing locked terms after inference. It rewrites bounded sections, retries unchanged or invalid output once with specific feedback, retries a light draft in Full rewrite while preserving it as a fallback, and retains and labels the original section if neither attempt passes. For a section containing protected facts, a bounded recovery pass can keep fact-bearing sentences intact while using the real model to edit up to four surrounding prose groups. That behavior is explicitly labelled. Complete known markers may be normalized for case/spacing/escaped underscores; missing or duplicated markers are rejected. Under Custom style, add a voice or audience preference and paste a paragraph you wrote. The browser derives guidance for sentence rhythm and word choice from the sample before rewriting. Add your own details suggests passages where a source, timeframe, or concrete example could help. The editor publishes the draft after its checks finish and keeps the last completed draft available if another attempt fails or stops. Completed drafts support a changes view, copy, export, one-step undo, and factual review. Check original and Check edited draft send the exact text to a separate detector field. After both scans, the editor shows their signals together when the same model was used and the texts still match. Checks flag changed numbers, quotations, citations, code, negation, possibility wording and substantial length changes. Reversed negations are never accepted on the second attempt. Recovery keeps negative/qualified sentences intact as well as protected facts. They cannot establish semantic equivalence; users must review the draft.

There are no guaranteed accuracy, human-authorship, plagiarism, or detector-evasion claims. The prior synthetic benchmark is not used as product validation.

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Detection downloads about 438 MB (Detailed) or 125 MB (Light) on first use. Browser rewriting downloads roughly 700 MB–2.4 GB depending on the selected model, plus runtime resources and uses substantial working memory. Cached model files can be evicted by the browser. Browser rewriting requires a working WebGPU adapter; detector WASM does not require WebGPU or cross-origin isolation. CPU speed, browser support, storage and memory vary by device.

For a larger local model, start LM Studio with a loaded chat model and enable CORS in Developer → Server Settings. Connect `http://localhost:1234/v1` in the editor. Ollama uses `http://localhost:11434/v1`; allow the exact app origin in its CORS configuration. Browser local-network permission may be required. If a hosted page cannot reach loopback, run Veritext locally. Do not disable browser security settings.

The first rewrite can wait while the local server loads the selected model. Look for the model's memory or context error in the editor if loading fails. A larger checkpoint and a longer context both increase memory use. An installed model can exceed the memory available to the local server.

## Privacy and cost

Browser inference keeps submitted text on the device. A selected local server receives the rewrite prompt and original text. Model files come from Hugging Face/MLC hosts. The legacy REST API receives submitted text on Vercel; it is **not** browser-private. No claim of zero compute, electricity, bandwidth, or unconditional free hosting is made. No paid inference services are used by this implementation.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run verify:detector
npm run verify:modern
npm run verify:detailed
```

`verify:modern` fetches the pinned CC-BY-SA-4.0 TextSight control set for local evaluation, excludes the literature negative control, and saves labels, source IDs, text hashes and scores without redistributing passages. Source labels/generator identities are dataset-publisher assertions. The script requires an active HC3 calibration matching the pinned model, loaded before external evaluation. New-runtime Light reports are saved as `light-v4-results.json` and `light-v4-modern-results.json`; the original reports remain historical.

`verify:detector` runs actual ONNX inference on the checked-in, source-labelled HC3 fixture, fits the predeclared regularized Platt calibration on calibration questions only, and saves raw per-passage scores and metrics. It is a diagnostic experiment, not an independent modern-LLM benchmark. Tests using local-server response fixtures verify integration only; the ledger separately identifies real browser inference.

## Legacy compatibility

`POST /api/detect` and `POST /api/batch-detect` still expose old style indices for existing consumers. They do not run neural inference. `aiScore` is explicitly uncalibrated, `isAi` and `calibratedProbability` are null, and confidence is low. Batch size is 10, with a bounded in-memory cache. There is no hosted `/api/humanize` route. `/api/health` describes configuration, not whether a user's client model loaded successfully. `/verify` explains why local signatures cannot certify human authorship.

Old stylometric, deterministic-cleaner and experimental components remain in the repository for compatibility/regression history, but are excluded from the main writing workflow. Their self-authored fixture results must not be cited as real-world accuracy.

## Deployment

This checkout is linked to the existing Vercel project `veritext-local-ai`. Run `vercel --prod --yes` after checks. Build-time model weights are not shipped to Vercel; clients download them only when requested.
