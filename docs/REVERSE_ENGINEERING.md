# Public behavior comparison — 21 November 2026

This replaces the previous report, whose undocumented endpoint schemas, proprietary architecture claims and assertions about competitor defects could not be verified. No private service implementation, weights, proprietary code, protected API, authentication bypass, CAPTCHA workaround or rate-limit bypass was used.

## Observed

- `https://zerogbt.com`: a direct TLS connection failed in this environment. It was not established as an alias or mirror of ZeroGPT. The earlier claim that it was a defensive typo redirect is withdrawn.
- `https://www.zerogpt.com`: ordinary public browser UI was accessible. It offers a text area, Detect Text, a character counter, document result, highlighted spans and an edit handoff. The visible free counter was 15,000 characters. On the task-authored 152-word library passage, one ordinary submission returned 100% AI and highlighted all sentences. This is a single workflow observation, not accuracy validation.
- `https://humanizeai.pro` redirects to `https://www.humanizeai.pro`. Its public UI exposes tone, rewrite level, input/output, sample, upload and copy controls. One normal submission of that same 152-word passage returned 149 words. Manual comparison found that the final sentence about measuring community benefit was omitted and some wording strengthened (e.g. opportunities “impossible elsewhere”). This is a single preservation observation, not a broad quality conclusion.
- Neither ordinary sample required solving a CAPTCHA in this session. No protection was bypassed. Marketing claims about guaranteed evasion are unverified.

Sources: [ZeroGPT](https://www.zerogpt.com/), [Humanize AI](https://www.humanizeai.pro/). The ordinary sample is the `sample` string in `src/components/Workspace.tsx`, authored during this task, not private user writing.

## Inferences and unknowns

Server model architecture, training data, weights, calibration, private APIs and production accuracy remain unknown. Public UI cannot reveal those. Exact parity is neither established nor promised.

## Independent implementation

Veritext adopts general interaction principles: two focused tools, ample editor space, explicit actions, context highlighting and a draft comparison. Styling, components and inference logic are independently implemented. It does not call either competitor during normal operation and copies no proprietary code.

Detection runs an MIT-licensed public ONNX model. Its published card is a source claim, not our validation: [ONNX model](https://huggingface.co/onnx-community/tmr-ai-text-detector-ONNX), [original card](https://huggingface.co/Oxidane/tmr-ai-text-detector). In particular, the card describes 50,000 stratified training examples; the PDF's claim of 672,000 training examples should not be repeated as established fact.
