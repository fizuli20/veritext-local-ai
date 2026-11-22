import { pipeline } from "@huggingface/transformers";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
const model = "onnx-community/tmr-ai-text-detector-ONNX";
const revision = "b9aa251e5bcda7e429fcc936767d921435945b60";
const corpus = JSON.parse(
  await readFile("tests/fixtures/hc3-validation.json", "utf8"),
);
const started = performance.now();
const pipe = await pipeline("text-classification", model, {
  revision,
  dtype: "q8",
});
const loadingMs = Math.round(performance.now() - started);
console.log("id2label:", pipe.model.config.id2label);
const results = [];
for (const item of corpus.items) {
  const t = performance.now();
  const ids = pipe.tokenizer.encode(item.text, { add_special_tokens: false });
  let sum = 0,
    total = 0;
  for (let i = 0; i < ids.length; i += 416) {
    const window = ids.slice(i, i + 480),
      weight = window.length - (i ? 64 : 0);
    const output = await pipe(
      pipe.tokenizer.decode(window, { skip_special_tokens: true }),
      { top_k: null, truncation: true, max_length: 512 },
    );
    const ai = output.find((row) => row.label === "ai");
    if (!ai) throw Error("Unexpected label mapping");
    sum += ai.score * weight;
    total += weight;
    if (i + 480 >= ids.length) break;
  }
  const result = {
    id: item.id,
    questionId: item.questionId,
    source: item.source,
    label: item.label,
    sha256: item.sha256,
    score: sum / total,
    latencyMs: Math.round(performance.now() - t),
  };
  results.push(result);
  console.log(
    result.id,
    result.label,
    result.score.toFixed(6),
    result.latencyMs + "ms",
  );
}
const splitById = new Map(corpus.items.map((item) => [item.id, item.split]));
const calibration = results.filter(
    (r) => splitById.get(r.id) === "calibration",
  ),
  evaluation = results.filter((r) => splitById.get(r.id) === "evaluation");
const sigmoid = (x) => 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, x))));
const logit = (p) => Math.log(Math.max(1e-6, p) / Math.max(1e-6, 1 - p));
const adjust = (p, a = 1, b = 0) => sigmoid(a * logit(p) + b);
const brier = (rows, a = 1, b = 0) =>
  rows.reduce((s, r) => s + (adjust(r.score, a, b) - r.label) ** 2, 0) /
  rows.length;
let slope = 1,
  intercept = 0,
  best = Infinity;
// Fixed regularized Platt search. Fit exclusively on calibration questions.
for (let ai = 1; ai <= 100; ai++)
  for (let bi = -160; bi <= 20; bi++) {
    const a = ai * 0.1,
      b = bi * 0.1;
    const loss =
      calibration.reduce((s, r) => {
        const p = adjust(r.score, a, b);
        return (
          s -
          r.label * Math.log(Math.max(1e-12, p)) -
          (1 - r.label) * Math.log(Math.max(1e-12, 1 - p))
        );
      }, 0) /
        calibration.length +
      0.005 * a * a;
    if (loss < best) {
      best = loss;
      slope = a;
      intercept = b;
    }
  }
function metrics(rows, a = 1, b = 0) {
  const scores = rows.map((r) => ({ ...r, p: adjust(r.score, a, b) }));
  const positives = scores.filter((r) => r.label),
    negatives = scores.filter((r) => !r.label);
  let wins = 0;
  for (const p of positives)
    for (const n of negatives) wins += p.p > n.p ? 1 : p.p === n.p ? 0.5 : 0;
  const answered = scores.filter((r) => r.p <= 0.1 || r.p >= 0.9);
  const bins = Array.from({ length: 5 }, (_, i) => {
    const bin = scores.filter((r) => Math.min(4, Math.floor(r.p * 5)) === i);
    return {
      lower: i / 5,
      upper: (i + 1) / 5,
      count: bin.length,
      aiCount: bin.filter((r) => r.label).length,
      meanScore: bin.length
        ? bin.reduce((s, r) => s + r.p, 0) / bin.length
        : null,
    };
  });
  return {
    count: rows.length,
    brier: brier(rows, a, b),
    auc: wins / (positives.length * negatives.length),
    falsePositiveRate:
      negatives.filter((r) => r.p >= 0.5).length / negatives.length,
    truePositiveRate:
      positives.filter((r) => r.p >= 0.5).length / positives.length,
    coverage: answered.length / rows.length,
    selectiveAccuracy: answered.length
      ? answered.filter((r) => (r.p >= 0.9 ? 1 : 0) === r.label).length /
        answered.length
      : null,
    ece: bins.reduce(
      (s, bin) =>
        s +
        (bin.count
          ? (Math.abs(bin.meanScore - bin.aiCount / bin.count) * bin.count) /
            rows.length
          : 0),
      0,
    ),
    bins,
  };
}
const sorted = results.map((r) => r.latencyMs).sort((a, b) => a - b);
const report = {
  created: new Date().toISOString(),
  model,
  revision,
  backend: "Transformers.js 4.3.2 / Node ONNX CPU Q8 (not browser timings)",
  loadingMs,
  corpus: { ...corpus, items: undefined },
  split:
    "First 10 eligible questions per domain calibration, remaining 10 evaluation; open_qa contained only 1 eligible pair and contributes calibration only. No question overlap.",
  limitations: [
    "Small historical ChatGPT/HC3 sample across 5 domain configs (4 have evaluation data); not current models or representative user text.",
    "Possible training contamination is unknown. These are diagnostic results, not an independent broad accuracy claim.",
    "Model performance claims in its card are not reproduced here.",
    "Calibration is provisional and specific to the balanced historical HC3 reference sample. Unknown base rates, new models and domains can invalidate it.",
  ],
  plattFit: { slope, intercept, regularization: 0.005 },
  calibration: metrics(calibration, slope, intercept),
  evaluationRaw: metrics(evaluation),
  evaluationFitted: metrics(evaluation, slope, intercept),
  latencyMs: {
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
  },
  results,
};
await writeFile(
  "docs/validation/light-v4-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
const active = report.evaluationFitted.brier < report.evaluationRaw.brier;
await writeFile(
  "src/data/detector-calibration.json",
  JSON.stringify(
    {
      model,
      revision,
      dataset: corpus.source,
      datasetRevision: corpus.revision,
      created: report.created,
      active,
      slope,
      intercept,
      calibrationCount: calibration.length,
      evaluationCount: evaluation.length,
      bins: report.evaluationFitted.bins,
      scope:
        "Balanced historical HC3 English answers; not a validated probability of authorship for arbitrary text.",
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
