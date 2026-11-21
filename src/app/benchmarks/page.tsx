import Link from "next/link";
import modern from "../../../docs/validation/modern-results.json";
import report from "../../../docs/validation/neural-results.json";
export default function BenchmarksPage() {
  const raw = report.evaluationRaw,
    fit = report.evaluationFitted;
  return (
    <div className="vt-app">
      <header className="vt-header">
        <Link className="vt-brand" href="/">
          veritext
        </Link>
        <Link href="/">Return to editor →</Link>
      </header>
      <main className="vt-main" style={{ maxWidth: 900, paddingBottom: 70 }}>
        <div className="vt-intro">
          <p className="vt-eyebrow">MEASURED, NOT PROMISED</p>
          <h1>Validation & limits</h1>
          <p>
            Small reproducible checks. Honest uncertainty. No guaranteed
            detection or evasion.
          </p>
        </div>
        <section className="vt-studio" style={{ padding: 28 }}>
          <h2 className="text-xl mb-3">Newer-model stress test</h2>
          <p className="text-sm leading-7">
            We ran the unchanged model and historical HC3 calibration on 394
            passages from{" "}
            <a className="underline" href={modern.sourceUrl}>
              TextSight’s public 2026 control set
            </a>
            : 338 human-source passages and 56 passages labelled as outputs from
            five newer models. The dataset labels and generator identities are
            publisher assertions. This vendor-authored, two-genre set is a
            stress test, not a representative accuracy benchmark.
          </p>
          <div className="overflow-x-auto my-6">
            <table className="w-full text-sm text-left leading-8">
              <thead>
                <tr>
                  <th>At the frozen 0.5 threshold</th>
                  <th>Raw model</th>
                  <th>HC3 reference</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Human false positives</td>
                  <td>54 / 338</td>
                  <td>1 / 338</td>
                </tr>
                <tr>
                  <td>AI texts detected</td>
                  <td>45 / 56</td>
                  <td>28 / 56</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="vt-message vt-error">
            The HC3 calibration missed all 12 passages labelled Claude Opus 5
            and 7 of 8 labelled Qwen 3.8. We therefore never interpret a low
            score as evidence of human authorship. This exposes a real
            limitation; we did not refit on the stress-test examples to hide the
            misses.
          </p>
          <p className="text-sm mb-8">
            <a
              className="underline"
              href="https://github.com/fizuli20/veritext-local-ai/blob/main/docs/validation/modern-results.json"
            >
              Inspect every stress-test score and protocol
            </a>
          </p>
          <h2 className="text-xl mb-3">Historical calibration experiment</h2>
          <p className="text-sm leading-7">
            TMR RoBERTa ONNX Q8, pinned revision {report.revision.slice(0, 12)},
            evaluated on {report.results.length} source-labelled passages from
            the historical{" "}
            <a
              className="underline"
              href="https://huggingface.co/datasets/Hello-SimpleAI/HC3"
            >
              HC3 dataset
            </a>
            . We fitted a regularized Platt calibration on{" "}
            {report.calibration.count} passages and evaluated on {fit.count}{" "}
            passages from different questions. Four domains have evaluation
            data: finance, medicine, Reddit explanations, and Wikipedia
            computer-science answers. Open QA supplied one eligible pair for
            calibration only.
          </p>
          <div className="overflow-x-auto my-6">
            <table className="w-full text-sm text-left leading-8">
              <thead>
                <tr>
                  <th>Held-out metric</th>
                  <th>Raw model</th>
                  <th>Reference calibrated</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Brier score (lower is better)</td>
                  <td>{raw.brier.toFixed(3)}</td>
                  <td>{fit.brier.toFixed(3)}</td>
                </tr>
                <tr>
                  <td>Expected calibration error, 5 bins</td>
                  <td>{raw.ece.toFixed(3)}</td>
                  <td>{fit.ece.toFixed(3)}</td>
                </tr>
                <tr>
                  <td>False positives at 0.5 threshold</td>
                  <td>{(raw.falsePositiveRate * 100).toFixed(1)}%</td>
                  <td>{(fit.falsePositiveRate * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>True positives at 0.5 threshold</td>
                  <td>{(raw.truePositiveRate * 100).toFixed(1)}%</td>
                  <td>{(fit.truePositiveRate * 100).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="vt-message vt-error">
            These figures describe 40 human and 40 old ChatGPT answers, not all
            writing. Training overlap is unknown. Sample selection, balanced
            class prevalence, correlated sources, and the age of the generator
            limit the findings. A low false-positive count here does not
            establish a low real-world error rate.
          </p>
          <h3 className="text-lg mt-6 mb-2">How the editor uses uncertainty</h3>
          <p className="text-sm leading-7">
            The raw neural signal and the historical reference estimate appear
            separately. We return “inconclusive” when they disagree, when the
            evidence is ambiguous, or when the reference bin is too small. The
            displayed 95% Wilson interval describes the fraction of labelled AI
            examples in a held-out score bin. It is not a confidence interval
            for the authorship of your document. We abstain below 80 words and
            for detected non-English text. The language check itself can be
            wrong.
          </p>
          <h3 className="text-lg mt-6 mb-2">Performance and browser support</h3>
          <p className="text-sm leading-7">
            The Node CPU benchmark measured p50 {report.latencyMs.p50} ms and
            p95 {report.latencyMs.p95} ms per document, excluding initial model
            load. These are not browser timings. Browser checks, cold downloads,
            rewrite results and remaining limitations are recorded in the
            repository validation report. Detection uses single-thread WASM;
            writing models require a working WebGPU adapter or a connected local
            server. Browser caches can be cleared or evicted.
          </p>
          <h3 className="text-lg mt-6 mb-2">Rewriting and preservation</h3>
          <p className="text-sm leading-7">
            The editor uses a real language model and never silently replaces it
            with word swaps. Numbers, quotations, citations, links, code and
            user-locked terms are protected before inference. The editor retries
            unchanged or invalid sections once, then labels sections retained
            from the original. Output remains an editable draft. Checks cannot
            prove semantic equivalence; review names, claims, relationships and
            omissions yourself. No output is guaranteed to evade detectors.
          </p>
          <p className="mt-6 text-sm">
            <a
              className="underline"
              href="https://github.com/fizuli20/veritext-local-ai/blob/main/docs/VALIDATION.md"
            >
              Read the test ledger
            </a>{" "}
            ·{" "}
            <a
              className="underline"
              href="https://github.com/fizuli20/veritext-local-ai/blob/main/docs/validation/neural-results.json"
            >
              Raw per-passage scores
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
