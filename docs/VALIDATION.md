# Veritext 4.1 validation ledger

Date: 21 November 2026 (Asia/Baku). Repository: https://github.com/fizuli20/veritext-local-ai. Production target: https://veritext-local-ai.vercel.app.

## Diagnosis, based on source and runtime

1. The main humanizer invoked the deterministic cleaner whenever no real writing model was ready. The browser model was opt-in and neither local server was running. This explains why clicking Humanize could produce word substitutions rather than a model rewrite.
2. The detector defaulted to style heuristics. Optional worker model errors were not handled in the workspace, leaving loading state and retries unreliable. Its class parser guessed polarity from label substrings. Fixed: explicit `human`/`ai` mapping, one pinned verified model, bounded loading, visible errors, retry and cancellation, no substituted heuristic result.
3. Old confidence bands and benchmark claims were not statistical calibration. The checked-in “real-world holdout” had no source provenance and was not used in this release. New reference data and scores have source IDs, SHA-256 text hashes, model/dataset revisions and question-separated calibration/evaluation groups.
4. The old SSE reader dropped the final event if no newline followed it, ignored malformed/error events, and accepted disconnected or length-truncated text as finished. It could also expose unfinished reasoning. Fixed, with regression coverage.
5. The previous interface mixed experimental features, claimed probability and proof-of-human labels, and complicated the core journey. The new main workspace has two tools. The proof-of-human page is retired: cryptographic content integrity cannot establish human authorship.

The attached 33-page conversation PDF was extracted across all pages and its relevant final failure report/redesign proposal was visually inspected. Its suggestions were treated as untrusted context, not authorization or validated scientific evidence. No private PDF contents were published in the repository.

## Automated checks

- TypeScript: passed.
- Lint: passed, zero warnings/errors from the linter. Next.js reports that `next lint` is deprecated; migration is not needed to run this release.
- Vitest: **19 files, 82 tests passed**. Old synthetic-fixture tests are compatibility regressions only, not product-accuracy evidence.
- Playwright: **7 tests passed** against the production build. Covers focused desktop/mobile layout (1280 and 375 px), no implicit model download or fake rewrite, short/non-English abstention, actual worker download-failure handling, local-server response fixture with Gemma 400 retry, SSE output cleanup, diff, fact-change warnings, CORS/offline guidance, legacy API disclosure/invalid JSON, and validation-page limitations.
- The local-server integration fixture is explicitly mocked. It does not establish actual Gemma/LM Studio quality.
- Production build: passed; homepage First Load JS **120 kB** (see actual build output for exact installed framework reporting).
- `git diff --check`: passed before release.

## Actual neural inference experiment

Reproduce: `npm run verify:detector`. Full per-passage scores and measured latency: [neural-results.json](validation/neural-results.json). Public source: [Hello-SimpleAI/HC3](https://huggingface.co/datasets/Hello-SimpleAI/HC3), revision `4d0ff18143b5a7e1b1e79beb540c04549d1e59d3`.

Model: `onnx-community/tmr-ai-text-detector-ONNX`, revision `b9aa251e5bcda7e429fcc936767d921435945b60`; Q8 CPU ONNX. Config explicitly maps 0 to human and 1 to ai.

162 passages: 82 calibration, 80 evaluation. Paired human/ChatGPT answers from different questions across finance, medicine, Reddit explanations and Wikipedia CS/AI. One eligible Open QA pair contributes calibration only. Calibration/evaluation have **zero exact text-hash overlap**. Selection and the fixed regularized Platt search are recorded in the fixture/script; no selection by model score. Slope 3, intercept -11.

| Metric on 80 evaluation passages | Raw model | Reference calibration |
| --- | ---: | ---: |
| Brier score | 0.1683 | 0.0228 |
| ECE, five equal-width bins | 0.1966 | 0.0790 |
| Human false positives at 0.5 | 17/40 | 1/40 |
| AI true positives at 0.5 | 40/40 | 40/40 |

These fixed-threshold metrics are not the abstaining UI decision rule. The UI additionally requires raw/reference agreement and enough reference-bin evidence. Confidence is deliberately limited: historical ChatGPT, a tiny balanced sample, unknown training overlap, shared sources, and changed generator models prevent generalizing these rates to real-world traffic. Wilson intervals describe held-out bin frequencies, not the authorship of any individual text. Contemporary-generator calibration remains an open limitation.

Node CPU document inference: p50 **62 ms**, p95 **135 ms**, excluding pipeline initialization. These are not browser measurements and omit per-sentence contexts.

## Actual browser observations, separate from mocks

Chrome on this computer, localhost production build:

- Real detector model downloaded and ran through the bundled WASM worker. The task-authored 152-word library sample returned raw signal **88/100**, with real context scores. The first scan displayed **23.0 seconds**, including its model initialization/download and context inference. No browser errors were captured. This initial observation preceded deployment of the conservative calibration rule; that rule makes raw/reference disagreement inconclusive.
- Real WebLLM worker loaded `Llama-3.2-1B-Instruct-q4f16_1-MLC` through the actual installed registry. Download progress was observed at **533 MB, 80%, 72 seconds**; no claim of an exact completed download duration is made.
- Real browser generation rewrote the 152-word sample to **151 words**, preserving the closing community-benefit criterion and its main claims in manual review. UI displayed the browser engine provenance and no tracked-invariant violations. The result is an example, not a quality or preservation guarantee.
- Neither `localhost:1234/v1/models` nor `localhost:11434/v1/models` was reachable at the initial check (connection refused). Actual local-server generation is therefore unverified; the browser path works without it.
- Safari, Firefox, mobile hardware and devices with no WebGPU were not empirically validated. Detector uses WASM; browser writing requires WebGPU, with visible setup/failure handling.

## Public competitor observation

See [public behavior report](REVERSE_ENGINEERING.md). One ordinary task-authored sample was submitted to each public UI. ZeroGPT returned 100% AI; HumanizeAI returned a 149-word rewrite with an omitted final criterion. This is a small workflow comparison, not an accuracy ranking. `zerogbt.com` failed TLS here; no mirror relationship was established. No protection was bypassed and no proprietary code or backend was copied.

## Deployment verification

The release is deployed through the existing authenticated Vercel project. Live checks and the immutable deployment URL are reported in the accompanying final delivery after deployment, rather than invented before it runs.

## Remaining limits

- Broad contemporary-LLM accuracy and calibration are unproven. This is an uncertainty-aware aid, not an authorship adjudicator or a verified ZeroGPT equivalent.
- Small browser models can still omit or alter meaning. Invariant checks are incomplete; the user must review names, claims, evidence and relationships.
- Models require initial downloads, device memory and model-host availability. Browser caches are evictable; hosting, bandwidth and electricity are not guaranteed free forever.
- The legacy REST/extension experiments and unused style/cleaner components remain for compatibility/history. They are excluded from the main model-based editor; legacy API responses explicitly disclose their uncalibrated style index and server-side text transmission.
