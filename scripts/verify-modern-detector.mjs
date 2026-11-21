// Independent stress test: frozen model and HC3 calibration, no fitting on this data.
import { pipeline } from "@huggingface/transformers";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
const model = "onnx-community/tmr-ai-text-detector-ONNX",
  revision = "b9aa251e5bcda7e429fcc936767d921435945b60";
const dataset = "textsightai/ai-text-detection-benchmark-2026",
  datasetRevision = "423b1768f0827675295fd6dc3cd255ad2f411183";
const calibration = JSON.parse(
  await readFile("src/data/detector-calibration.json", "utf8"),
);
if (calibration.slope !== 3 || calibration.intercept !== -11)
  throw new Error("This stress test requires the frozen 4.1 HC3 calibration.");
const files = [
  "human_wikipedia_pre2022.jsonl",
  "human_pmc_ccby_nonanglophone.jsonl",
  "ai_generated_2026-09-29.jsonl",
];
const rows = [];
for (const file of files) {
  const response = await fetch(
    `https://huggingface.co/datasets/${dataset}/resolve/${datasetRevision}/data/${file}`,
  );
  if (!response.ok) throw Error(`Dataset download ${response.status}`);
  rows.push(
    ...(await response.text())
      .trim()
      .split("\n")
      .map((line) => ({ ...JSON.parse(line), file })),
  );
}
const pipe = await pipeline("text-classification", model, {
  revision,
  dtype: "q8",
});
const results = [];
for (const row of rows) {
  const started = performance.now();
  const ids = pipe.tokenizer.encode(row.text, { add_special_tokens: false });
  let weighted = 0,
    total = 0;
  for (let start = 0; start < ids.length; start += 416) {
    const window = ids.slice(start, start + 480);
    const weight = window.length - (start ? 64 : 0);
    const output = await pipe(
      pipe.tokenizer.decode(window, { skip_special_tokens: true }),
      { top_k: null, truncation: true, max_length: 512 },
    );
    const ai = output.find((x) => x.label === "ai");
    if (!ai) throw Error("Unexpected model labels");
    weighted += ai.score * weight;
    total += weight;
    if (start + 480 >= ids.length) break;
  }
  const raw = weighted / total,
    reference =
      1 /
      (1 +
        Math.exp(
          -(
            calibration.slope *
              Math.log(Math.max(1e-6, raw) / Math.max(1e-6, 1 - raw)) +
            calibration.intercept
          ),
        ));
  results.push({
    id: row.id,
    label: row.label,
    source: row.source,
    genre: row.genre ?? null,
    file: row.file,
    textSha256: createHash("sha256").update(row.text).digest("hex"),
    raw,
    reference,
    latencyMs: Math.round(performance.now() - started),
  });
  if (results.length % 25 === 0)
    console.log("Scored", results.length, "/", rows.length);
}
function metrics(items, key) {
  const human = items.filter((r) => r.label === "human"),
    ai = items.filter((r) => r.label === "ai");
  const brier =
    items.reduce((s, r) => s + (r[key] - (r.label === "ai" ? 1 : 0)) ** 2, 0) /
    items.length;
  let wins = 0;
  for (const p of ai)
    for (const n of human)
      wins += p[key] > n[key] ? 1 : p[key] === n[key] ? 0.5 : 0;
  return {
    n: items.length,
    human: human.length,
    ai: ai.length,
    brier,
    auc: human.length && ai.length ? wins / (human.length * ai.length) : null,
    falsePositiveRate: human.length
      ? human.filter((r) => r[key] >= 0.5).length / human.length
      : null,
    recall: ai.length
      ? ai.filter((r) => r[key] >= 0.5).length / ai.length
      : null,
  };
}
const groups = Object.fromEntries(
  [...new Set(results.map((r) => r.source))].map((source) => [
    source,
    {
      raw: metrics(
        results.filter((r) => r.source === source),
        "raw",
      ),
      hc3: metrics(
        results.filter((r) => r.source === source),
        "reference",
      ),
    },
  ]),
);
const report = {
  created: new Date().toISOString(),
  model,
  revision,
  dataset,
  datasetRevision,
  sourceUrl: `https://huggingface.co/datasets/${dataset}`,
  datasetLicense:
    "CC-BY-SA-4.0; passage-level provenance and attribution are in the original dataset. Texts are fetched for local evaluation and not redistributed in this report.",
  selection:
    "All 155 pre-2022 Wikipedia passages, 183 pre-2022 PMC passages, 56 dataset-labelled 2026 AI passages; literature negative control excluded; no score-based selection.",
  protocol:
    "Frozen TMR Q8 model and frozen HC3 calibration (slope 3, intercept -11). No fitting, threshold selection or weight updates on this stress test.",
  limitations: [
    "Vendor-authored small evaluation set; source labels and generator identities are publisher assertions, not independently authenticated.",
    "Two genres; no representative current user base rates. Unknown model-training overlap.",
    "Passages may share articles or prompts; sample counts are not independent trials.",
    "No proprietary competitor scores inferred from this evaluation.",
  ],
  raw: metrics(results, "raw"),
  hc3: metrics(results, "reference"),
  groups,
  results,
};
await mkdir("docs/validation", { recursive: true });
await writeFile(
  "docs/validation/modern-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
