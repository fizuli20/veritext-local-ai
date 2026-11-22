# Public workflow comparison, 22 November 2026

This work observes ordinary public behavior and implements an independent local editor/detector. No proprietary weights, private endpoints, source code, training recipes, or secret prompts were obtained or inferred. No CAPTCHA, access restriction, payment gate, or rate limit was bypassed. All submitted test text was public-source or authored for this task. Account suggestions were dismissed; no account was created.

## Domain verification

- `humanai.pro` redirected in native Chrome to a GoDaddy domain-for-sale page. It was not an active humanizer.
- `zerogbt.com` returned HTTP 204 with no content; no alias relationship was established.
- The matching products in the earlier task are [HumanizeAI](https://www.humanizeai.pro/) and [ZeroGPT](https://www.zerogpt.com/).

## What was observed

HumanizeAI exposes tone, an independent rewrite-level control, editable output, change highlighting, document upload, copy and a check-for-AI action. Its model, prompts, generation settings and safeguards are unknown. Two normal Balanced-level submissions completed:

| Passage | Input words | HumanizeAI output words | Manual comparison |
| --- | ---: | ---: | --- |
| Factual Project Atlas fixture | 96 | 91 | Retained numeral values, quote, citation and URL; applications became cases, records became case studies; omitted the final next-meeting-purpose sentence. |
| Built-in library example | 152 | 166 | Broad sentence recasting; made the skills claim stronger, from limited opportunity to impossible elsewhere; altered the final assessment criterion. |

These are two examples, not a quality rate, evidence of general superiority, or a detector-evasion result. Full observed outputs and exact limitations are in [the comparison ledger](validation/public-comparison-4.4.json). We did not copy its phrasing into rewrite rules or prompts.

ZeroGPT exposes a whole-document percentage, suspect-text highlights, document upload, a rewrite action and report export. Public requests do not reveal its training data, thresholds or internal scoring formula. Its public marketing accuracy claims were not treated as measurements.

| Shared passage | ZeroGPT observed result | Veritext Detailed observed result |
| --- | --- | --- |
| Built-in 152-word AI-authored library passage | 100% AI/GPT in the previous normal-form test | 98/100, elevated signal, native Chrome |
| Historical Wikipedia photosynthesis passage, 128 words | 0% AI/GPT, “Human written” | 37/100 raw signal, Inconclusive, 3.6 s warm native Chrome |
| Factual 96-word AI-authored passage | Submitted; remained pending for several minutes; no score recorded | Comparison incomplete; no number inferred for the public tool |

The historical human-source case came from English Wikipedia, Photosynthesis revision 1062819171 (2021-12-30), via the pinned TextSight CC-BY-SA-4.0 set. The first native typing operation removed Greek characters; both tools were deliberately given the identical observed 857-character text containing `phs ()` and `sunthesis ()`. This was a modified human-source passage, not an untouched authentication sample. We report that limitation rather than silently treating the texts as identical to the original corpus row.

A raw model signal and a proprietary percentage have different meanings. We do not force parity with ZeroGPT, learn its decision boundary from a handful of examples, or change a known-human input to a fabricated zero. The existing 394-item empirical comparisons and historical calibration remain the detector evidence. New UI/report features do not change the model or its scoring rules.

## Source-confirmed gaps and implementation

1. The old editor had tone choices, but no separate control over how much to rewrite. The new **Light edit / Full rewrite** control is independent of tone. Full is the default; its prompt asks for new sentence structure, varied flow, concrete wording, and preservation of every substantive claim and caveat. This is an editorial objective, not detector optimization.
2. Placeholder-masked facts frequently caused small models to lose markers. After two attempts the recovery retained whole fact/negation/possibility-bearing sentences, leaving few useful edits. Larger Llama 3B alone still showed this behavior: 152 → 141 words, 21.2 seconds, three retries, with sentence recovery disclosed. Full rewrite now gives bounded readable source text to the model and checks literal numbers, quote/protected-span counts, names locked by the user, negation and possibility wording afterwards. It rejects tracked fact changes and uses the same bounded recovery. Light retains exact marker restoration. Protected blocks whose restored text exceeds 1,600 characters remain masked to stay within context limits.
3. The active workspace lacked the public products’ file-input workflow. It now parses TXT, Markdown, DOCX and text-based PDF locally. Files are capped at 10 MB, PDFs at 100 pages, and extracted text at the selected tool’s input limit. Invalid, empty, image-only and oversized imports fail visibly without truncating or replacing the source. PDF parsing uses a bundled worker. No document text is uploaded. Scanned PDFs need OCR outside this import feature.
4. Detector export now saves its actual checked text, model/revision, engine, raw score, provisional reference evidence, context scores, latency and limits as JSON. It does not use the legacy heuristic forensic report, invent an authorship probability, or certify human authorship. Short/unsupported input keeps a null score in the exported report.

## Validation scope

Unit and production-build browser tests cover both depth prompts, whole-section retry and factual rejection, locked names, duplicate protected-span rejection, oversized protected-block context limits, output-depth provenance, real TXT/DOCX/PDF import, invalid/over-limit files retaining source, no import POST requests, and actual saved scan fields. Model response fixtures validate integration only. Native browser generation observations are recorded separately; a passed invariant check is not a proof of semantic equivalence. The free browser model requires a capable WebGPU device and an initial large download; public hosted tools do not expose comparable client hardware requirements. No claim of identical models, equal quality, broad accuracy, or guaranteed evasion is made.


## Actual generation with the new path

Actual native Chrome/Qwen 1.5B generation on the local production build, not mocked server responses:

- Factual fixture: **96 → 85 words, 4.1 seconds, no retry**, with locked Ana/Project Atlas, all numeral values, quote, citation, URL, negative claims and final next-meeting purpose retained in manual review.
- New onboarding memo, Professional tone: **89 → 76 words, 6.1 seconds, one retry**, with broader recasting. The explicit action of circulating the draft became generic feedback collection; invariant checks cannot assess that loss of specificity. Review remains required.
- Built-in library example: **152 → 144 words, 14.0 seconds, three retries**, with recovery retaining sensitive sentences. This remains a limitation for extensive rewriting; it is not counted as successful full recasting.

The comparison shows specific improvements and remaining weaknesses, not equivalence to a proprietary humanizer. Full source/output observations are in the linked JSON ledger. One unrelated legacy stylometrics timing assertion briefly exceeded its 40 ms threshold while native browser work was active; the functional tests passed. Subsequent isolated verification is recorded in the release evidence rather than hiding that timing failure.

Final release verification: **101 unit tests across 21 suites, 14 production-build browser tests, production build, type checking and lint passed**. New real-file tests parsed generated DOCX and PDF fixtures, not mocked text extraction, and confirmed that over-limit and malformed files leave the source intact. Native generations are separately recorded above.
