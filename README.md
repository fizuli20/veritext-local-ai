# Veritext 4.2.1

A focused AI-text signal viewer and local rewrite editor. No paid inference API key is required.

- [Production](https://veritext-local-ai.vercel.app)
- [Validation and limitations](https://veritext-local-ai.vercel.app/benchmarks)
- [Measured test ledger](docs/VALIDATION.md)

## What runs

**Detector:** pinned `onnx-community/tmr-ai-text-detector-ONNX` Q8, single-thread WASM inside a browser worker. Input is segmented into overlapping 480-token windows, not guessed word limits. Basic scans score the document first. Optional sentence-context inspection scores neighboring contexts through the same neural model and preserves raw UTF-16 offsets. It is capped at the first 60 contexts; remaining contexts are explicitly unscored. A bounded in-memory score cache avoids rescoring identical windows within the active worker. Model labels are explicitly verified as `human` and `ai`.

Raw model scores are not authorship probabilities. A provisional Platt calibration is fitted on 82 historical HC3 passages and evaluated on 80 different-question passages. The UI displays this limited reference separately, gives a sample-bin Wilson interval, and abstains when signals disagree, reference support is thin, input is under 80 words, or the detected language is unsupported. A separate frozen-model stress test on 394 public 2026-labelled passages exposed misses on newer AI: HC3 calibration caught 28/56 AI-labelled texts at 0.5. The interface therefore explicitly treats low signal as authorship unknown. The calibration is not a reliable probability for contemporary or arbitrary writing. No refit on that stress test was used to conceal its failures. See the ledger for the actual failures and limits.

**Rewrite editor:** connect LM Studio/Ollama on loopback, or explicitly load a WebGPU writing model. The browser uses a model ID resolved from the installed WebLLM registry. No real model means a setup card, never a rule-based humanizer. Choose Light (Llama 1B), Balanced (Qwen 1.5B, default), or Larger (Llama 3B); model availability is resolved against the actual installed registry. The editor masks numbers, short/long quotations, citations, URLs, code and user-locked terms before inference. It rewrites bounded sections, retries unchanged or invalid output once, and retains and labels the original section if neither attempt passes. For a section containing protected facts, a bounded recovery pass can keep fact-bearing sentences intact while using the real model to edit up to four surrounding prose groups. That behavior is explicitly labelled. Complete known markers may be normalized for case/spacing/escaped underscores; missing or duplicated markers are rejected. Output streams into an editable draft with engine provenance, changes view, copy, export, stop, one-step undo, and factual-invariant review. Checks flag changed numbers, quotations, citations, code, negation, and substantial length changes. They cannot establish semantic equivalence; users must review the draft.

There are no guaranteed accuracy, human-authorship, plagiarism, or detector-evasion claims. The prior synthetic benchmark is not used as product validation.

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Detection downloads about 125 MB on first use. Browser rewriting downloads roughly 700 MB–2 GB depending on the selected model, plus runtime resources and uses substantial working memory. Cached model files can be evicted by the browser. Browser rewriting requires a working WebGPU adapter; detector WASM does not require WebGPU or cross-origin isolation. CPU speed, browser support, storage and memory vary by device.

For a larger local model, start LM Studio with a loaded chat model and enable CORS in Developer → Server Settings. Connect `http://localhost:1234/v1` in the editor. Ollama uses `http://localhost:11434/v1`; allow the exact app origin in its CORS configuration. Browser local-network permission may be required. If a hosted page cannot reach loopback, run Veritext locally. Do not disable browser security settings.

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
```

`verify:modern` fetches the pinned CC-BY-SA-4.0 TextSight control set for local evaluation, excludes the literature negative control, and saves labels, source IDs, text hashes and scores without redistributing passages. Source labels/generator identities are dataset-publisher assertions. The script refuses changed HC3 calibration parameters.

`verify:detector` runs actual ONNX inference on the checked-in, source-labelled HC3 fixture, fits the predeclared regularized Platt calibration on calibration questions only, and saves raw per-passage scores and metrics. It is a diagnostic experiment, not an independent modern-LLM benchmark. Tests using local-server response fixtures verify integration only; the ledger separately identifies real browser inference.

## Legacy compatibility

`POST /api/detect` and `POST /api/batch-detect` still expose old style indices for existing consumers. They do not run neural inference. `aiScore` is explicitly uncalibrated, `isAi` and `calibratedProbability` are null, and confidence is low. Batch size is 10, with a bounded in-memory cache. There is no hosted `/api/humanize` route. `/api/health` describes configuration, not whether a user's client model loaded successfully. `/verify` explains why local signatures cannot certify human authorship.

Old stylometric, deterministic-cleaner and experimental components remain in the repository for compatibility/regression history, but are excluded from the main writing workflow. Their self-authored fixture results must not be cited as real-world accuracy.

## Deployment

This checkout is linked to the existing Vercel project `veritext-local-ai`. Run `vercel --prod --yes` after checks. Build-time model weights are not shipped to Vercel; clients download them only when requested.
