# Veritext 5.3.1 connected edits and source fidelity

Five supplied drafts of the same library passage made extensive wording changes. In manual review, one draft muddled which choice benefits more readers, another omitted the final measure of success, and another replaced a crowded home with a noisy one. The reported ZeroGPT percentages are observations about those drafts on that run. The examples share the same source passage and do not establish a success rate across other writing or other detectors.

Full rewrite now gives the model a chance to edit a connected passage even if some of its sentences already have a safe source-based edit. It keeps the source-based edits if the model's passage fails review or changes less wording. Checks flag direct reversals of supported comparative constructions and the replacement of an explicit operating schedule with the ambiguous word “openings”. These checks use the text and its source. Detector results do not enter rewrite selection.

---

# Veritext 5.3 paste, humanize, copy

[HumanizeAI.pro](https://www.humanizeai.pro/) describes pasting text, clicking **Humanize AI**, completing a CAPTCHA when prompted, and copying the result. It offers optional tone and rewrite strength controls. Its [about page](https://www.humanizeai.pro/about) describes changing word choice and sentence structure. The exact production model and scoring logic are undisclosed. This comparison covers the public workflow.

The first click on Humanize in Veritext starts the browser model and automatically rewrites after it loads. The default requires a working WebGPU adapter and downloads about 1 GB on first use. The paste, automatic startup, and copy path is covered in Chromium using a controlled model-worker response. A separate test verifies that a browser without WebGPU retains the source text and makes model settings available. The local run passed 141 unit tests and 26 browser tests.

---

# Veritext 5.2 writing sample and detail suggestions

The rewrite editor derives style guidance from a writing sample in the browser. The regular rewrite and paragraph-context prompts receive the derived guidance. The sample itself is available for opt-in workspace storage and stays in the browser. Explicit tone and style preferences and source fidelity still guide the rewrite.

Draft suggestions point to the exact sentence and ask for an optional source, timeframe, group, or concrete outcome. Selecting a suggestion returns from the changes view and selects the sentence without editing it. Tests cover prompt delivery, sample privacy, opt-in storage, and selecting and clearing a detail suggestion.

---

# Veritext 5.1.3 parallel requirements

In a final browser retest, Llama kept staff responsible for answering questions but made that time a consequence of changes to opening hours. The source gave two parallel requirements. The focused review now rejects that new causal connection and the prose retry explains the distinction.

---

# Veritext 5.1.2 connected-passage retry

Connected passages now tell the model when a frequency qualifier must stay attached to its original action. If the passage fails review, the editor retries once with the specific preservation feedback before relying on sentence replacements or verified source changes.

---

# Veritext 5.1.1 rewrite fidelity

The first live Qwen 3B retest with the paragraph pipeline edited five of six editable sentences in 2.6 seconds, including four source-based edits. The model weakened “every shift” to “shifts” in that run. The focused check now keeps that frequency qualifier. Source-based rules also skip ambiguous negations, comparisons with possessive or combined subjects, and cases where “on its own” may modify the object.

The Detailed detector scored the original AI-authored library sample 97.6/100 and the source-based edit from the Llama session 98.4/100. The comparison used the exact texts and the same detector. The edited draft retains its high writing-pattern signal.

---

# Veritext 5.1 paragraph rewrites

Full rewrite in the browser can read a bounded paragraph, edit a connected passage in prose and request individual replacements for the remaining sentences. Exact facts and protected sentences are restored from the source. The editor checks replacements separately before checking the assembled paragraph. When an explicit comparison or clause can be reorganized from source wording, the editor can apply that structural edit even if the model copies the source or returns an incomplete answer. The draft identifies those source-based edits.

The comparison and criterion regressions cover lost qualifications, protected numbers, and damaged model responses. Tests cover independent retries and preservation of paragraph breaks. A separate experiment with a compact natural language inference model accepted a swapped-actor example, so it was excluded from the release.

Scans of the exact edited draft explain its origin. The detector signal remains independent of rewrite quality and cannot establish an authorship percentage.

---

# Veritext 5.0.8 open-ended statements

The live Qwen retest added community events to an opening that left other library activities unspecified. Focused rewrites now keep the original level of detail and check for new specifics in that open-ended comparison. The regression rejects the observed addition and still accepts a rearrangement of the original claim.

---

# Veritext 5.0.7 evaluation criteria

One focused Llama rewrite turned the proposed measure of the library's usefulness into a claim that its impact was undeniable and that it improved access to information. Focused rewrites now check that a proposed measure remains an evaluation and still refers to its original subject and outcome. The regression covers both the unsupported claim and a faithful restructuring of the measure.

---

# Veritext 5.0.6 comparison preservation

After the excerpt prompts were narrowed, one Llama browser run changed all three sections but invented computer access and lost the comparison between a timetable change and a renovation. The scoped rewrite check now verifies that the comparison remains and still includes its original counterpart. Regression tests cover both failed drafts and meaning-preserving rephrasings of those sentences.

---

# Veritext 5.0.5 excerpt context

A production Qwen run on 5.0.4 edited two sections in 12.9 seconds. The conclusion stayed unchanged after the model introduced negation into isolated sentences, and it turned the opening statement into a question. Scoped prompts now omit earlier sentences for self-contained excerpts and give single-sentence excerpts a length target. The rewrite check keeps declarative excerpts in statement form. Regression tests exercise each case.

---

# Veritext 5.0.4 scoped full rewrites

On the prior production build, real browser runs on the built-in library sample reproduced the reported problem. Qwen 2.5 3B edited one of three sections in 28.0 seconds with five retries. Llama 3.2 3B returned light edits in 52.5 seconds with eight retries. The Llama draft also invented overcrowding and long wait times when paraphrasing a reference to the original problems.

For groups with exact protected claims, Full rewrite copies those claims from the source and asks the model to edit the surrounding excerpts directly. A retry targets the affected excerpt. The editor checks each excerpt and then the assembled section. The regression uses the built-in sample, requires exact preservation of the benefits and expansion checklist, and checks that a dropped qualifier retries only its excerpt. A separate check catches the invented problems from the Llama baseline.

The editor reports how many sections changed, labels light edits, and groups detailed checks together. A retained original has its own label.

---

# Veritext 5.0.3 local models and detector saturation

A real Ollama chat completion with Qwen3 4B and a deliberately short output budget stopped after reasoning and returned no draft. In the same setup, disabling reasoning through the compatibility field caused some reasoning text to appear in the answer field. Veritext keeps reasoning separate, retries a reasoning-only output limit once with a larger budget, and uses the documented low effort option for GPT-OSS on the default Ollama endpoint.

Fixtures also cover a server rejecting optional fields, a chat template rejecting a system role, and a server returning structured context, memory, or model availability errors. The editor shows the model's progress and preserves completed drafts. An installed model may still need to load when the first rewrite starts, and available memory and context settings determine what the local server can run.

The detector shows values above 99.9 as `>99.9/100 model signal`. If both versions of a draft are in this range, the comparison explains that the scores do not distinguish them there. Exact raw values remain available in the exported JSON. The release does not change the detector weights or use its score to steer rewrites.

---

# Veritext 5.0.2 library-sample follow-up

A repeat test caught two more issues. The model combined the separate benefits for adults and students, and one recovery pass included a generated preamble. Regression tests cover both cases. The editor retains the conditional sentence linking each group to its own benefit and strips the preamble before reviewing a candidate.

The final warm browser run with Llama 3.2 3B on the same 152-word library sample finished in 26.9 seconds with five retries. The draft kept staff responsible for answering questions, retained the separate adult and student benefits, preserved the expansion checklist and timetable caveat, and opened at the top. One of three source sections was retained unchanged. This run measures one sample on one device.

---

# Veritext 5.0.1 library-sample rewrite regression

The reported Llama 3B output made only light changes and substituted an ambiguous pronoun for staff in the request to leave time for answering questions. Regression tests include that exact sentence. The editor now checks that explicit actors stay attached to coordinated duties. It retains a referenced qualified claim and keeps a qualified checklist with its prerequisite. Additional checks cover the store, new service, and new outcome introduced in intermediate real-model experiments. These checks are conservative and cannot establish complete semantic fidelity.

Full rewrite divides longer, heavily qualified prose into a few groups at sentence boundaries. Later groups receive earlier source context to keep the subject grounded. Shorter passes preserve the exact spacing between groups and keep their original caveats. When a full rewrite yields only light wording changes, the editor labels the output as a Light edit result. A new full output opens at the top of the draft.

A warm browser run of the reported 152-word library sample with Llama 3.2 3B took 30.1 seconds with six retries. About 25% of adjacent-word pairs changed, and one of three groups was retained. The output still identified staff as answering questions, preserved the timetable caveat and the pre-expansion checklist, and opened at the top. That is one observed run, not a general quality or latency guarantee.

Cold Llama 3B Cache Storage setup stopped twice during testing. IndexedDB completed the download and model startup on the same browser. Working Cache Storage model downloads remain supported.

---

# Veritext 5.0 workspace validation

Select text in the edited draft and choose Revise selection to send that range to the same writing engine. The rest of the draft remains byte-for-byte identical. The merged draft is checked against its prior version so that a selection that cuts through a protected quote or other checked span cannot bypass its protection. Undo restores the previous draft. A real Chrome run with Qwen 2.5 1.5B revised one selected sentence in 0.8 seconds and retained its exact surrounding text. This was a warm, single-device observation.

An earlier real-model draft kept the word "may" while assigning a result to a different subject. The rewrite review now flags that pattern when the draft keeps distinctive wording from the effect but drops all distinctive subject wording in the related qualified claim. The browser retest kept the specific timetable change and the uncertainty around its benefit. This is a conservative check with regression coverage and does not verify every meaning change.

The detector shows a paragraph variation summary when its checked passages contain both a raw signal of at least 80/100 and one of at most 20/100. In a real mixed-document test, a public-domain Lewis Carroll excerpt and Veritext's generated library sample produced **2.7/100** and **97.6/100** as separate paragraph signals. The combined document scored **82.4/100**. This demonstrates the display on one controlled example. It does not establish mixed authorship or broader model accuracy. [Source of the historical passage](https://www.gutenberg.org/files/928/928-h/928-h.htm)

Opt-in workspace storage was tested by saving, reloading, checking the three exact text fields, then turning it off and verifying the saved copy was removed. Saved state includes text and editing preferences. Inference evidence and running model sessions are generated anew. Browser fixtures separately verify revision, protected quote rejection, undo, and the JSON paragraph summary.

---

# Veritext 4.6.6 rewrite review and detector comparison

The Humanizer and Detector have separate text fields. Checking the original or the edited draft preserves both editor texts. The Humanizer shows the two document signals together once both exact versions have been scanned with the same model. Editing either text hides its stale comparison. This is a comparison of writing signals, with no inference about who wrote the text.

The editor catches a likely missing closing detail even when a replacement sentence keeps the sentence count unchanged, provided enough of the earlier passage still matches. It also skips the optional stronger rewrite when exact quantity claims and recommendations leave too little prose to justify another pass. If an optional pass is interrupted, the draft that already passed checks is still available.

Regression tests cover matched source and draft scans, return navigation, stale comparisons, omitted endings, and valid draft recovery.

---

# Veritext 4.6.5 rewrite and score display fixes

Model retries previously replaced the visible output with each provisional candidate. The editor now publishes a draft once its checks finish. A failed or stopped run preserves the last completed draft. Output-limit failures retry shorter source groups. If nothing passes, the editor labels the original as retained or keeps the previous completed draft. The browser fixture pauses a retry to verify that provisional text stays hidden, then injects a server failure to verify that the completed draft remains.

The detector expresses its raw score on a 100-point scale. A positive score below 0.1 points appears as `<0.1/100`. The display preserves the distinction between small signals and exact zero, and the JSON report keeps the full underlying value. This change is presentation only.

---

# Veritext 4.6.4 first-load reliability

The source editor now waits for the browser application to initialize before accepting typing. A delayed-script browser test reproduces the early-input condition on 4.6.3 and passes with the fix. The 4.6.3 detector release was independently checked in production with actual browser inference. The human technical-writing probe scored 96.61/100 and was correctly reported as inconclusive under the new cutoff. The built-in AI library example scored 97.57/100 and still returned an elevated signal.

---

# Veritext 4.6.3 detector threshold validation

The Detailed model still uses the same weights and reports the same raw scores. Its elevated-signal cutoff moved from an effective **94.85/100** to **96.96/100**, with the existing historical-reference and sample-support checks still applied. The stricter cutoff prioritizes fewer false flags. Scores near the prior cutoff can now be inconclusive.

| Eligible result | Previous cutoff | Current cutoff |
| --- | ---: | ---: |
| Held-out genres, AI passages flagged | 61/72 | 59/72 |
| Held-out genres, human passages flagged | 2/70 | 0/70 |
| Previously examined 2026 set, AI passages flagged | 40/56 | 39/56 |
| Previously examined 2026 set, human passages flagged | 4/334 | 2/334 |

We ran CPU inference on 288 passages from six [Learning to Rewrite dataset](https://github.com/ranhli/l2r_data) genres with the current Detailed and Light models, plus GPTTrace Ettin-150M and Ettin-1B. The threshold was selected on research, news and personal communication by maximizing recall under a 5% empirical false-flag cap. Education, creative writing and technical writing were held out from threshold selection. Three human passages across both splits were excluded because the editor would abstain before running inference. On the held-out groups, the two GPTTrace sizes flagged 51/72 and 50/72 AI passages at their development thresholds, compared with 59/72 for Detailed. The equal-weight model combinations tested did not improve on that held-out operating point. They remain evaluation candidates only.

Held-out overall correct counts were the same at the two Detailed cutoffs. Zero false flags in 70 human passages leaves uncertainty about the real rate. The 2026 results replay a separately reported, previously examined corpus. This comparison does not establish a general accuracy rate, training-data independence, or parity with a private detector. [Per-passage results, model revisions and method](validation/detector-domain-4.6.3.json)

---

# Veritext 4.6.2 genre comparison and rewrite regression tests

The same public or fictional inputs were submitted to the normal public [ZeroGPT detector](https://www.zerogpt.com/) and to Veritext 4.6.1. The input labels came from provenance. ZeroGPT's percentage and Veritext's raw model signal measure different things.

| Passage | Known source | ZeroGPT public result | Veritext Detailed |
| --- | --- | --- | --- |
| Library entrance notice | Synthetic | 100% AI GPT | Abstained, under 80 words |
| Seedling pilot-study summary | Synthetic | 100% AI GPT | Abstained, under 80 words |
| Mina and the station clock | Synthetic | 100% AI GPT | 76/100, inconclusive |
| *Alice's Adventures in Wonderland*, chapter I opening | [Lewis Carroll, Project Gutenberg](https://www.gutenberg.org/files/928/928-h/928-h.htm) | 0% AI GPT | 3/100, low signal |

Veritext's 80-word minimum stays in effect. In a real CPU inference check on 48 excerpts from the previously examined TextSight set, the same Detailed model and historical elevated-signal rule flagged **8/24 AI excerpts** at the first 70 words, versus **16/24** on the fuller excerpts. It flagged 0/24 human excerpts in either condition. At raw score 0.5, short excerpts flagged 5/24 human examples and full excerpts flagged 2/24. The samples were chosen by fixed hash order, 12 each from published academic and encyclopedic AI categories and human Wikipedia and PMC groups. This is a small paired stress test on familiar data. It does not validate 80 words as a precise cutoff or establish accuracy relative to ZeroGPT. [Per-passage scores and method](validation/short-text-4.6.2.json)

The three synthetic passages were also submitted to the public [HumanizeAI editor](https://www.humanizeai.pro/). Each tool was checked once per passage, with one later real-model retest of the Veritext research failure. Review was manual. The tools' rewrite settings have different meanings.

| Passage | HumanizeAI result | Veritext browser result |
| --- | --- | --- |
| Notice | Rephrased and dropped the final statement that normal library hours remain in effect. | Kept regular hours, entrance restrictions, and repair uncertainty in a 6.0-second run with Qwen 2.5 3B. |
| Research | Retained both measurements and dropped the recommendation to repeat the experiment. | The first candidate revision partly kept the point but reduced it to randomizing shelves. On the final build's 16.0-second retest, the browser model retained both group measurements and the full recommendation to repeat the experiment with randomized shelves. The remaining edits were modest. |
| Fiction | Rephrased substantially and changed the wording inside the note's direct quotation. | Preserved the direct quotation and the ending. The 15.2-second draft changed the character's action from counting lit windows to watching them. |

The final build rejects changed quantity relationships across sentences in the same section. It retries a suspected dropped ending and can keep the original ending during recovery. It protects closing recommendations paired with a condition in the tested forms. These checks do not establish complete semantic fidelity. Three targeted regression tests passed, with 111 unit tests total.

---

# Veritext 4.6.1 workflow and local model validation

The detector shows the document score as soon as it is ready, then adds paragraph signals and the first eight neighboring sentence-context scores. Check more contexts expands the scan to up to 60 contexts, preserving completed highlights while additional work runs. A stopped scan preserves completed results. JSON reports include context coverage, and the print layout can be saved as PDF using the browser. Context scores remain uncalibrated model signals. The existing detector and scoring thresholds were retained.

On the built-in 152-word library example in native Chrome, the Detailed detector returned 98/100. The initial scan showed 8 of 9 contexts, and expansion reached 9 of 9 with the same document score. This checks the workflow on a known AI sample. It does not establish accuracy or parity on unseen writing.

Custom style lets you describe a voice or audience separately from rewrite depth and tone. In a native Chrome run with Qwen 2.5 3B, a 62-word library notice became 60 words in 13.1 seconds. The notice retained the exact service outage times, existing reservations, email instruction, and access to the building, books, and study rooms. The edits were modest.

We evaluated an experimental Qwen3.5 4B browser build. The approximately 2.4 GB download stalled using Cache Storage, then completed using IndexedDB. The model streamed text, but Chrome stopped responding during the run and we could not verify a finished draft. The cause of the stall was not established. Version 4.6.1 removes this option from the public browser menu and keeps the tested Qwen 2.5 3B option.

The release passed 108 unit tests, 15 browser integration tests, lint, and the production build. The browser tests include coverage for progressive scores, retaining partial results after Stop, and rendering a print-ready PDF. Native Chrome model tests are recorded separately from mocked integration tests.

---

# Veritext 4.5.1 quality follow-up

The Detailed detector now reports up to six eligible English paragraph scores alongside the document score. On a browser test combining HC3 human-source passage `wiki_csai-120-0` with the built-in AI-written library example, the document signal was 70/100, with paragraph signals of 8/100 and 98/100. This deliberately contrasting example verifies the UI and score provenance. It cannot estimate accuracy on mixed documents in general. Paragraph scores are uncalibrated and their offsets are included in the exported analysis.

We also evaluated [GPTTrace Ettin-150M](https://huggingface.co/nakas/gpttrace-ettin150-text-v5e/tree/9dadc95474b74a7be285866203788a6568b3c216) with its int8 weights locally on the same 394 previously examined passages. We stripped invisible formatting, used its tokenizer, scored overlapping windows and combined their token-weighted signals. This used a custom evaluation harness on clean text. It did not reproduce the upstream product or its homoglyph normalization. At the raw 0.5 threshold, the candidate flagged 13 of 338 human samples and detected 26 of 56 AI samples (AUC 0.733). Detailed flagged 51 of 338 and detected 52 of 56 (AUC 0.962). Detailed's separately reported historical-reference threshold flagged 10 of 338 and detected 43 of 56. We kept Detailed as the default due to the candidate's lower recall and ranking on this set. These previously examined passages may overlap training sources.

Full rewrite now rewards a second, more substantial edit if it passes checks. It can recover work in smaller passages after whole-section failures and discloses when the completed draft changed little. Exact facts remain protected during recovery. A local Qwen 3B option is available alongside the existing lighter models. Different runs can produce different wording. The checks cover literal invariants and cannot establish complete fidelity.

The factual rewrite probe retained all numbers while dropping the approval action. The updated check keeps sentences with multiple quantities verbatim, except that standalone year-shaped tokens do not count toward the threshold. This preserves the relationship between amounts and the claims they quantify.

Validation for this release includes **107 unit tests and 14 browser tests**, plus production build, lint, and type checks. The earlier comparison and benchmark records follow.

---

# Veritext 4.4.0 — workflow comparison and rewrite validation

Date: 22 November 2026, Asia/Baku. [Public workflow comparison](PUBLIC_WORKFLOW_COMPARISON.md), [observed outputs and real-model tests](validation/public-comparison-4.4.json).

This release adds independent rewrite depth, a readable-context Full rewrite path with the same preservation checks, private TXT/Markdown/DOCX/PDF import, and actual neural-analysis export. Duplicate protected text is now rejected. It does not replace or refit the 4.3 detector, nor claim private model reconstruction, accuracy parity or guaranteed detector evasion. The public comparison found omissions/strengthened claims in the external humanizer as well as limitations in our own drafts; all are recorded.

The historical detector measurement ledger follows below. New native-model observations and automated release verification are reported separately in the linked comparison and delivery evidence. Browser integration fixtures are not counted as evidence of model quality.

---

# Veritext 4.3.0 — previous detector validation

Date: 22 November 2026, Asia/Baku. Repository: https://github.com/fizuli20/veritext-local-ai. Production: https://veritext-local-ai.vercel.app.

## Reproduced regression and fixes

The production built-in 152-word AI-authored library example returned **2/100**, "Low signal", with a WebGPU FP32 engine heading and a contradictory WASM Q8 footer. Source tracing found an unvalidated phrase/punctuation ensemble suppressing neural output, score/verdict inputs that differed (including injected .99 scores), and automatic FP32 GPU downloads around 475 MB despite a 125 MB notice. These have been removed. The displayed score and evidence now use the same real inference. Backend and download notices match the selected model.

Detailed now defaults to the pinned MIT-licensed `YatoVoid/forsakeai-detector` conversion of Desklib DeBERTa (438 MB, weight-only INT8 / FP32 math). Light retains the original TMR model (125 MB, Q8). Both run single-thread WASM; WebGPU is not required for detection. Transformers.js is pinned to 4.3.2 because the DeBERTa conversion specifies 4.x tokenization. The one-logit model uses sigmoid rather than an invalid single-class softmax. Profile switching disposes the previous model and clears the score cache. No score is inferred from clichés or punctuation.

In native Chrome on this computer, the production-build Detailed worker scored the identical library example **98/100**, with a matching elevated-signal verdict. First download/setup/document scan took **58.4 seconds**. Optional inspection of nine neighboring sentence contexts then took **22.6 seconds**, using the loaded model and cached document score. These are single-device observations, not latency guarantees. Chrome reported about 949 MB for the tab at that point. Limited-memory devices can select Light; phones and other browsers were not empirically tested in this release.

## Actual detector inference comparison

[Detailed score report, IDs and text hashes](validation/detailed-results.json). Reproduce with `npm run verify:detailed`. Calibration uses the same predeclared regularized Platt search, fitted exclusively on 82 HC3 calibration examples; evaluation uses 80 different-question HC3 examples. Detailed held-out historical reference at 0.5: **1/40 human false positives, 40/40 AI detected**. This is a small historical experiment.

The external comparison uses the same previously examined 394 TextSight passages and frozen dataset revision as below. No calibration fitting uses external examples. Model selection used this comparison, so this is **not blind validation**. Source labels and model identities remain publisher assertions. All passages were scored with actual ONNX Runtime CPU inference, Transformers.js 4.3.2, 480-token windows and 64-token overlap, applying sigmoid before token-weighted averaging. Full source text is not redistributed.

| External metric | Light | Detailed |
| --- | ---: | ---: |
| Raw ROC AUC | 0.882 | 0.962 |
| Raw false positives at 0.5 | 42/338 | 51/338 |
| Raw AI detected at 0.5 | 44/56 | 52/56 |
| HC3 reference false positives at 0.5 | 2/338 | 10/338 |
| HC3 reference AI detected at 0.5 | 26/56 | 43/56 |

At the UI's elevated-signal rule (raw >= .8, HC3 reference >= .8, sufficient held-out bin support), Detailed flagged **40/56 AI-labelled passages and 4/338 human-labelled passages**. The 0.5 table is not the UI's abstaining verdict rule. Improved recall trades off against historical-reference false positives. Low scores do not establish human authorship; high scores are not proof of AI use. No parity with ZeroGPT or any other proprietary detector is established.

The Light model was also fully rerun after the software upgrade: [HC3 run](validation/light-v4-results.json), [external run](validation/light-v4-modern-results.json). Its independently refitted historical calibration is slope 2.8/intercept -10. The earlier 4.2 reports below remain unchanged as historical evidence. These current-runtime comparisons show that Detailed improves ranking/recall but has more false positives than Light.

## Rewrite corrections and automated checks

The first requested rewrite resumes automatically after explicit browser/local-engine setup. Browser setup appears first, without automatic downloads. "Check edited draft" scans the actual output rather than leaving the original source in the detector. Closing setup cancels the pending request. Retry acceptance no longer allows reversed negations when a passage has no masked facts. Checks also flag lost possibility words such as "can" becoming a definite assertion; recovery keeps negative/qualified sentences and protected facts intact while using real model inference on surrounding prose. The preview no longer strips user-authored `__KEEP_n__` literals.

[Full native-browser source/output observations](validation/browser-4.3.json). Post-fix native Chrome generation on the production build: the first Rewrite resumed after explicit Qwen 1.5B loading and produced a 143-word draft from the 152-word example in 14.1 seconds, with three retry/recovery calls. Negative and possibility-bearing sentences remained intact; surrounding sentences changed. The UI disclosed retained sensitive sentences. Manual review found a change of emphasis in the final service-quality sentence, so this is not certified semantic equivalence or proof of detector evasion.

The Check edited draft action transferred the actual 143-word output into the detector and completed in 6.4 seconds including cached model setup, scoring it 99/100. That confirms the integration, not detector evasion; the rewrite remained AI-like.

The native production baseline rewrote the 152-word library sample to 140 words in 6.5 seconds, but dropped "can" from a claim. That observed loss motivated the qualification check; it is not counted as a successful meaning-preservation result. Post-fix real-generation observations are recorded separately in the delivery evidence. Invariant checks still cannot verify every meaning change; manual review remains necessary.

Production build, type checking and lint passed with no ESLint warnings. **94 unit tests in 20 suites and 11 production-build browser tests passed.** Browser response fixtures verify setup continuation, scanning edited output, streaming, factual rejection, retry/copy recovery, long sections, undo, errors, short/non-English abstention and responsive layout. Those fixtures are not evidence of model quality. The 556 actual model evaluations and native browser observations above are reported separately. LM Studio/Ollama generation is unverified because no local daemon/model is running; the integration has response-fixture coverage.

Public comparison boundaries: `zerogbt.com` returned an empty HTTP 204 response in this run and was not established as an alias. ZeroGPT's visible product is at `zerogpt.com`. A normal public-form submission there eventually returned **100% AI/GPT** for the identical 152-word library example. Detailed returned 98/100 model signal for that example. These are different scales and one example does not establish accuracy or parity; no protection was bypassed. Earlier single-sample observations below are historical, not accuracy evidence. HumanizeAI's public workflow was read, without inspecting or copying proprietary internals.

---

# Veritext 4.2.1 — historical validation

Date: 22 November 2026, Asia/Baku. Source: https://github.com/fizuli20/veritext-local-ai. Production: https://veritext-local-ai.vercel.app.

## Production follow-up and patch

The initial 4.2 production run completed its factual rewrite in 9.1 seconds (96 to 85 words), preserving the protected sentences. Manual review found an unnecessary added statement, “The current time is important,” in the unprotected prose. Invariant checks did not catch it. The 4.2.1 recovery prompt explicitly tells the model to remove empty lead-ins without converting them into new claims, with a counterexample. Typecheck, lint, all 91 unit tests, production build, and all 10 production-build browser tests were repeated after this patch and passed. Live recheck observations are included in the delivery report rather than assuming the prompt guarantees semantic fidelity.

The 4.2 live detector also completed a document-only scan in 1.2 seconds on the factual sample, with cached model assets. This is a single warm observation, not a latency distribution. Optional context scoring was a separate user action. No comparison to the old cold download-plus-context timing is implied.

## Changes verified in this release

- Browser writing now defaults to Qwen 2.5 1.5B, with explicit Light/Llama 1B and Larger/Llama 3B choices resolved from the installed WebLLM registry. Switching unloads the previous model before loading another. The larger 3B option was not empirically generated with in this release; memory/device limits still apply.
- Before inference, exact numbers (including signs/scientific notation), quotations, citations, links, code and user-locked names/terms are masked and checked. Missing, repeated or unknown markers are rejected. Only complete, known markers may be normalized for case, spacing or escaped underscores.
- Rewriting is bounded to 12,000 input characters and split into 1,600-character masked sections. An unchanged/invalid section gets one whole-section retry. If protected markers still fail, a recovery pass keeps all fact-bearing sentences exactly intact and uses real model inference on at most four surrounding prose groups. That recovery is explicitly disclosed. If checks still fail, the original section is retained and labelled. No word-swap fallback is used.
- One-step undo restores the prior draft. Retry reasons and elapsed time are visible. Manual edits are also checked against currently locked terms. This is an invariant check, not semantic verification.
- Basic detection scores the document first. Context inspection is an explicit second action, limited to 60 scored contexts, with the remaining text labelled unscored. A bounded worker-memory cache avoids identical re-inference. No external detector API was added.
- Low detector signals explicitly mean **authorship unknown** after the newer-model stress test below.

## Actual browser generation, not integration fixtures

Native Chrome on this computer, local development build, actual WebGPU WebLLM using `Qwen2.5-1.5B-Instruct-q4f16_1-MLC`. Test prose was authored during this task. Full before/after text and limitations: [browser-rewrite-4.2.json](validation/browser-rewrite-4.2.json).

1. A factual 96-word draft became **83 words in 9.5 seconds**, with two retry/recovery calls displayed. Initial marker-based drafts lost facts such as 2024 and 15% and were rejected. The successful recovery preserved the fact-bearing sentences exactly and revised the surrounding wordy closing sentences. The UI disclosed that choice. Manual comparison retained Ana, Project Atlas, 2024, 40, 12, 15%, the short quotation, citation, URL and negative claims.
2. An ordinary 88-word project update became **69 words in 2.7 seconds with no retry**. Manual comparison retained the feedback-review, clarification request, next-meeting questions, and practical-improvement goals.

These are two observed examples, not a general quality rate or a statistically measured latency distribution. The earlier failed drafts are recorded rather than counted as successful rewrites. Actual LM Studio/Ollama generation remains unverified because no local server was running; response fixtures verify the integration behavior.

## Newer-model stress test — frozen model and calibration

Reproduce with `npm run verify:modern`. Full per-passage IDs, labels, source groups, SHA-256 text hashes, raw and calibrated scores: [modern-results.json](validation/modern-results.json).

Source: TextSight (2026), [AI text detection control set](https://huggingface.co/datasets/textsightai/ai-text-detection-benchmark-2026), revision `423b1768f0827675295fd6dc3cd255ad2f411183`, CC-BY-SA-4.0 with individual source attribution in the dataset. All 155 pre-2022 Wikipedia and 183 PMC passages, and all 56 AI-labelled 2026 passages were evaluated. The literature negative control was excluded. Full passages are downloaded for local evaluation and are not redistributed in this score report. Generator identities/ground-truth labels are publisher assertions, not independently authenticated.

The TMR model/revision and HC3 slope 3/intercept -11 were frozen before this evaluation; no fitting, threshold tuning, or score-based sample selection was performed on the stress set.

| Frozen threshold 0.5 | Raw model | HC3 reference |
| --- | ---: | ---: |
| Human false positives | 54 / 338 | 1 / 338 |
| AI-labelled passages detected | 45 / 56 | 28 / 56 |
| Brier score on this imbalanced set | 0.1241 | 0.0692 |

The HC3 reference missed **12/12 labelled Claude Opus 5** and **7/8 labelled Qwen 3.8** passages. It detected 10/12 GPT-4.1, 6/12 gpt-oss-120b, and 11/12 Claude Haiku 4.5 passages. Low scores therefore cannot establish human authorship. The UI does not expose these fixed-threshold counts as its abstaining decision rule, and does not claim parity with proprietary detectors. This is a small vendor-authored two-genre stress test; article/prompt correlation, sample imbalance, generator identity uncertainty, and unknown training overlap limit any generalization. The historical HC3 result below remains an experiment, not modern-model validation.

## Automated and production checks

Typecheck and lint passed. Vitest: **20 files / 91 tests passed**. Playwright: **10 tests passed against the production build**. Production build passed; homepage First Load JS: **125 kB**. `git diff --check` passed. These checks were run after the final recovery changes. Development verification already covers long inputs above the previous 4,000-character cap, paragraph preservation, protected-marker failure, retry/recovery limits, explicit retained-source output, local Gemma compatibility fixtures, undo, and current detector limitations. Response-fixture tests do not establish actual local LLM quality. Production HTTP/model smoke checks are performed only after deployment is ready.

---

## Archived 4.1 baseline

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
- Vitest: **19 files, 83 tests passed**. Old synthetic-fixture tests are compatibility regressions only, not product-accuracy evidence.
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

The initial 4.1 implementation (`f6b36be`) was deployed successfully to https://veritext-local-2r9k985or-fizuli20s-projects.vercel.app and aliased to https://veritext-local-ai.vercel.app. The final small follow-up adds clearer model-ready feedback, an explicit stale-source draft notice and handling for a stream that sends DONE but leaves the connection open. All checks were repeated after those changes.

Live production checks: homepage, benchmarks, developers, retired verify page, health, and OpenAPI all returned HTTP 200; health reported 4.1.0. Twenty fresh small legacy detection requests returned explicit null authorship probabilities. Internet roundtrip latency was p50 **347.0 ms**, p95 **484.3 ms**; this is not neural inference latency. See [production-smoke.json](validation/production-smoke.json).

Actual production browser neural detection on the 152-word task sample returned raw **88/100**, reference estimate **1%**, and correctly showed **Inconclusive** because the two signals disagreed. The held-out reference bin had 0/36 labelled-AI passages, with a displayed 95% interval of 0–10%. This example exposes the limits of historical calibration on current AI-generated prose. First production scan displayed **22.1 seconds**, including initial download/model startup and context inference. No browser errors were observed.

The live browser writing-model download was stopped and retried through the product UI; it recovered to a ready model. Final production status and rewrite observation are recorded in the delivery ledger accompanying this release.

## Remaining limits

- Broad contemporary-LLM accuracy and calibration are unproven. This is an uncertainty-aware aid, not an authorship adjudicator or a verified ZeroGPT equivalent.
- Small browser models can still omit or alter meaning. Invariant checks are incomplete; the user must review names, claims, evidence and relationships.
- Models require initial downloads, device memory and model-host availability. Browser caches are evictable; hosting, bandwidth and electricity are not guaranteed free forever.
- The legacy REST/extension experiments and unused style/cleaner components remain for compatibility/history. They are excluded from the main model-based editor; legacy API responses explicitly disclose their uncalibrated style index and server-side text transmission.
