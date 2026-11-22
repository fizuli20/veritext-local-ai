// Frozen revisions, HC3 question-disjoint calibration/evaluation, external comparison.
// External scores are NEVER used to fit calibration. Labels are dataset assertions.
import {
  AutoTokenizer,
  AutoModelForSequenceClassification,
} from "@huggingface/transformers";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const modelId = "YatoVoid/forsakeai-detector";
const revision = "a155f82aeee54d33d8d6e50c963dda591cc548c8";
const datasetRevision = "423b1768f0827675295fd6dc3cd255ad2f411183";
const corpus = JSON.parse(
  await readFile("tests/fixtures/hc3-validation.json", "utf8"),
);
const rows = corpus.items.map((x) => ({
  ...x,
  label: x.label ? "ai" : "human",
  dataset: "hc3",
}));
for (const file of [
  "human_wikipedia_pre2022.jsonl",
  "human_pmc_ccby_nonanglophone.jsonl",
  "ai_generated_2026-09-29.jsonl",
]) {
  const response = await fetch(
    `https://huggingface.co/datasets/textsightai/ai-text-detection-benchmark-2026/resolve/${datasetRevision}/data/${file}`,
  );
  if (!response.ok) throw Error(`Dataset fetch: ${response.status}`);
  rows.push(
    ...(await response.text())
      .trim()
      .split("\n")
      .map((line) => ({ ...JSON.parse(line), dataset: "modern" })),
  );
}
// Reuse a completed, locally saved run only when explicitly provided for report generation.
let results;
if (process.env.DETAILED_SCORES) {
  results = JSON.parse(
    await readFile(process.env.DETAILED_SCORES, "utf8"),
  ).filter((x) => x.dataset);
} else {
  const tokenizer = await AutoTokenizer.from_pretrained(modelId, { revision });
  const model = await AutoModelForSequenceClassification.from_pretrained(
    modelId,
    { revision, dtype: "fp32", device: "cpu" },
  );
  results = [];
  for (const row of rows) {
    const started = performance.now();
    const ids = tokenizer.encode(row.text, { add_special_tokens: false });
    let weighted = 0,
      total = 0;
    for (let start = 0; start < ids.length; start += 416) {
      const window = ids.slice(start, start + 480),
        weight = window.length - (start ? 64 : 0);
      const { logits } = await model(
        tokenizer(tokenizer.decode(window, { skip_special_tokens: true }), {
          truncation: true,
          max_length: 512,
        }),
      );
      const value = Number(logits.data[0]);
      if (!Number.isFinite(value)) throw Error("Non-finite logit");
      weighted += (1 / (1 + Math.exp(-value))) * weight;
      total += weight;
      if (start + 480 >= ids.length) break;
    }
    results.push({
      id: row.id,
      dataset: row.dataset,
      label: row.label,
      source: row.source,
      split: row.split,
      p: weighted / total,
      ms: Math.round(performance.now() - started),
    });
    if (results.length % 25 === 0)
      console.log("Scored", results.length, "/", rows.length);
  }
  await model.dispose();
}
if (
  results.length !== rows.length ||
  new Set(results.map((x) => x.id)).size !== rows.length
)
  throw Error("Incomplete or duplicate inference results");
const byId = new Map(rows.map((x) => [x.id, x]));
for (const result of results) {
  const row = byId.get(result.id);
  if (
    !row ||
    row.label !== result.label ||
    !Number.isFinite(result.p) ||
    result.p < 0 ||
    result.p > 1
  )
    throw Error("Mismatched result");
  result.textSha256 = createHash("sha256").update(row.text).digest("hex");
}
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => Math.log(Math.max(1e-6, p) / Math.max(1e-6, 1 - p));
const adjust = (p, a, b) => sigmoid(a * logit(p) + b);
const train = results.filter(
  (x) => x.dataset === "hc3" && x.split === "calibration",
);
const evaluation = results.filter(
  (x) => x.dataset === "hc3" && x.split === "evaluation",
);
let slope = 1,
  intercept = 0,
  best = Infinity;
for (let ai = 1; ai <= 100; ai++)
  for (let bi = -160; bi <= 20; bi++) {
    const a = ai * 0.1,
      b = bi * 0.1;
    const loss =
      train.reduce((s, r) => {
        const p = adjust(r.p, a, b),
          y = r.label === "ai" ? 1 : 0;
        return (
          s -
          y * Math.log(Math.max(1e-12, p)) -
          (1 - y) * Math.log(Math.max(1e-12, 1 - p))
        );
      }, 0) /
        train.length +
      0.005 * a * a;
    if (loss < best) {
      best = loss;
      slope = a;
      intercept = b;
    }
  }
const bins = Array.from({ length: 5 }, (_, i) => {
  const bin = evaluation.filter(
    (r) => Math.min(4, Math.floor(adjust(r.p, slope, intercept) * 5)) === i,
  );
  return {
    lower: i / 5,
    upper: (i + 1) / 5,
    count: bin.length,
    aiCount: bin.filter((r) => r.label === "ai").length,
    meanScore: bin.length
      ? bin.reduce((s, r) => s + adjust(r.p, slope, intercept), 0) / bin.length
      : null,
  };
});
function metrics(rows, transform = (x) => x) {
  const human = rows.filter((x) => x.label === "human"),
    ai = rows.filter((x) => x.label === "ai");
  return {
    count: rows.length,
    human: human.length,
    ai: ai.length,
    falsePositives: human.filter((x) => transform(x.p) >= 0.5).length,
    truePositives: ai.filter((x) => transform(x.p) >= 0.5).length,
    brier:
      rows.reduce(
        (s, r) => s + (transform(r.p) - (r.label === "ai" ? 1 : 0)) ** 2,
        0,
      ) / rows.length,
    auc:
      ai.reduce(
        (s, p) =>
          s +
          human.reduce(
            (n, h) => n + (p.p > h.p ? 1 : p.p === h.p ? 0.5 : 0),
            0,
          ),
        0,
      ) /
      (ai.length * human.length),
  };
}
const calibration = {
  model: modelId,
  revision,
  dataset: "Hello-SimpleAI/HC3",
  datasetRevision: "4d0ff18143b5a7e1b1e79beb540c04549d1e59d3",
  created: new Date().toISOString(),
  active: true,
  slope,
  intercept,
  calibrationCount: train.length,
  evaluationCount: evaluation.length,
  bins,
};
const modern = results.filter((x) => x.dataset === "modern");
const fitted = (x) => adjust(x, slope, intercept);
const report = {
  created: new Date().toISOString(),
  model: modelId,
  revision,
  runtime:
    "Transformers.js 4.3.2 / ONNX Runtime CPU / weight-only INT8, FP32 math",
  protocol:
    "480-token windows, 64-token overlap; sigmoid of the single AI logit; weighted mean. Regularized Platt fit exclusively on 82 HC3 calibration items. Held-out HC3 evaluation: 80 items. External comparison: all 394 previously examined TextSight items; not a blind or representative accuracy test.",
  datasetRevision,
  sourceUrl:
    "https://huggingface.co/datasets/textsightai/ai-text-detection-benchmark-2026",
  sourceLicense: "CC-BY-SA-4.0; see dataset source attribution",
  limitations: [
    "Historical calibration has distribution shift.",
    "TextSight vendor-supplied source/generator labels are unverified.",
    "Two external human genres; no claim of general accuracy.",
    "Browser runtime checked separately; CPU timings exclude first download.",
  ],
  calibration,
  hc3Raw: metrics(evaluation),
  hc3Reference: metrics(evaluation, fitted),
  modernRaw: metrics(modern),
  modernReference: metrics(modern, fitted),
  results,
};
await writeFile(
  "src/data/detector-detailed-calibration.json",
  JSON.stringify(calibration, null, 2) + "\n",
);
await writeFile(
  "docs/validation/detailed-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      hc3Raw: report.hc3Raw,
      hc3Reference: report.hc3Reference,
      modernRaw: report.modernRaw,
      modernReference: report.modernReference,
    },
    null,
    2,
  ),
);
