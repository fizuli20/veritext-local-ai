"""Compare base and adapted Qwen on the same editorial prompts."""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
from statistics import mean

from mlx_lm import generate, load
from mlx_lm.sample_utils import make_sampler

from prepare import MODALS, NUMBER, QUOTES, WORD, messages, read

BASE_REVISION = "8b403126fc14f14cfc99bb4cfa72ecbc129ea677"


def measure(source, draft):
    original = WORD.findall(source.lower())
    rewritten = WORD.findall(draft.lower())
    overlap = Counter(zip(original, original[1:])) & Counter(zip(rewritten, rewritten[1:]))
    return {
        "extent": round(1 - sum(overlap.values()) / max(1, len(original) - 1), 4),
        "changed": source.strip() != draft.strip(),
        "numbers": Counter(NUMBER.findall(source)) == Counter(NUMBER.findall(draft)),
        "quotes": Counter(QUOTES.findall(source)) == Counter(QUOTES.findall(draft)),
        "qualifierWords": Counter(MODALS.findall(source.lower())) == Counter(MODALS.findall(draft.lower())),
        "comparableLength": 0.7 <= len(rewritten) / max(1, len(original)) <= 1.35,
    }


def generate_drafts(base, adapter, examples, full_rewrite):
    model, tokenizer = load(str(base), adapter_path=str(adapter) if adapter else None)
    for example in examples:
        prompt = tokenizer.apply_chat_template(
            messages(example["source"], full_rewrite=full_rewrite), tokenize=False, add_generation_prompt=True,
        )
        draft = generate(model, tokenizer, prompt=prompt, max_tokens=360, sampler=make_sampler(temp=0)).strip()
        yield draft


def summary(rows, variant):
    summaries = [row[variant]["checks"] for row in rows]
    return {
        "examples": len(summaries),
        "meanChangedBigramFraction": round(mean(s["extent"] for s in summaries), 4),
        **{key: sum(s[key] for s in summaries)
           for key in ("changed", "numbers", "quotes", "qualifierWords", "comparableLength")},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", type=Path)
    parser.add_argument("adapter", type=Path)
    parser.add_argument("test_data", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--first-adapter", type=Path)
    parser.add_argument("--probes", type=Path, default=Path(__file__).with_name("probes.json"))
    parser.add_argument("--full-rewrite", action="store_true")
    parser.add_argument("--probes-only", action="store_true")
    parser.add_argument("--base-revision", default=BASE_REVISION)
    args = parser.parse_args()
    held_out = [
        {"id": f"iterater-{index + 1}", "source": row["messages"][1]["content"].split("\n\n", 1)[1]}
        for index, row in enumerate(read(args.test_data))
    ]
    if args.probes_only:
        held_out = []
    probes = json.loads(args.probes.read_text())
    rows = held_out + probes
    variants = {"base": None, "tuned": args.adapter}
    if args.first_adapter:
        variants["firstPilot"] = args.first_adapter
    for variant, adapter in variants.items():
        drafts = generate_drafts(args.base, adapter, rows, args.full_rewrite)
        for row, draft in zip(rows, drafts, strict=True):
            row[variant] = {"draft": draft, "checks": measure(row["source"], draft)}
            print(variant, row["id"], flush=True)
    report = {
        "baseRevision": args.base_revision,
        "adapterSha256": hashlib.sha256((args.adapter / "adapters.safetensors").read_bytes()).hexdigest(),
        "generation": "greedy, identical prompt, at most 360 output tokens",
        "fullRewritePrompt": args.full_rewrite,
        "benchmarks": {
            name: {variant: summary(group, variant) for variant in variants}
            for name, group in (
                ("iterater", held_out),
                ("originalProbes", [row for row in probes if row["id"] != "library-replay"]),
            ) if group
        },
        "originalProbeOutputs": probes,
    }
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report["benchmarks"], indent=2))


if __name__ == "__main__":
    main()
