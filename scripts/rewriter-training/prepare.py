"""Prepare grouped, meaning-preserving human revisions for MLX QLoRA."""

import argparse
from collections import Counter
import csv
import hashlib
import json
from pathlib import Path
import random
import re

SYSTEM = (
    "You are a careful editor. Rebuild the passage in clear, natural English. "
    "Keep each claim, qualification, number, name, and relationship. "
    "Return only the edited passage."
)
FULL_REWRITE = (
    "Recast this passage in fresh, natural English. Change the sentence structure "
    "and wording noticeably while keeping each fact, role, condition, and claim. "
    "Return only the rewritten passage."
)
REVISION = "3b0bdabb090d04062ebc17e54ac889a64f5cb791"
DATASET_SHA256 = {
    "train": "3f60e9989879b7a51b994edbe4536a5bd30556670f47b6677815bf0ed45c0acc",
    "dev": "9b8e216ca1874260bcf63365877225b2ee1547b70f1945fc172be1fcd945fc70",
    "test": "b3f371261389662eebd8395f8b78020eef84a85218c03b2df6823d2c7f551b4b",
}
PERMITTED_INTENTS = {"clarity", "coherence", "fluency", "style"}
WORD = re.compile(r"\b[\w’'-]+\b")
NUMBER = re.compile(r"\b\d+(?:[,.]\d+)*\b")
QUOTES = re.compile(r'"[^"\n]+"|“[^”\n]+”')
MODALS = re.compile(r"\b(?:can|could|may|might|not|without|unless|never|must)\b", re.I)


def messages(source, target=None, full_rewrite=False):
    chat = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": (FULL_REWRITE if full_rewrite else "Edit the following passage. Return only the edited passage.") + "\n\n" + source},
    ]
    if target is not None:
        chat.append({"role": "assistant", "content": target})
    return chat


def read(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def document_key(row):
    # The supplied splits can place different revisions of one source in multiple splits.
    return str(row["doc_id"])


def normalize(text):
    return re.sub(r"\s+([,.!?])", r"\1", " ".join(text.split()))


def replay(text, edits, start, end):
    cursor = start
    chunks = []
    for edit in edits:
        left, right = edit["start_char_pos"], edit["end_char_pos"]
        if (left < start and right <= start) or left >= end:
            continue
        if left < cursor or right > end or text[left:right] != (edit.get("before") or ""):
            return None
        if edit["major_intent"] not in PERMITTED_INTENTS:
            return None
        replacement = edit.get("after") or ""
        if left == right and replacement and replacement[0].isalnum():
            if left > start and text[left - 1].isalnum():
                replacement = " " + replacement
            if text[left:left + 1].isalnum() and replacement[-1].isalnum():
                replacement += " "
        if not replacement and left > start and text[left - 1].isalnum() and text[right:right + 1].isalnum():
            replacement = " "
        chunks.extend([text[cursor:left], replacement])
        cursor = right
    return normalize("".join(chunks) + text[cursor:end])


def revisions(row, minimum_extent):
    source = row["before_revision"]
    edits = sorted(row["edit_actions"], key=lambda edit: (edit["start_char_pos"], edit["end_char_pos"]))
    boundaries = sorted({0, len(source), *(pos for pos in row["sents_char_pos"] if 0 < pos < len(source))})
    for index, start in enumerate(boundaries):
        for end in boundaries[index + 2:index + 7]:
            before = normalize(source[start:end])
            terms = WORD.findall(before.lower())
            if not 45 <= len(terms) <= 155:
                continue
            after = replay(source, edits, start, end)
            if not after or not before.endswith((".", "!", "?")) or not after.endswith((".", "!", "?")):
                continue
            if any(Counter(pattern.findall(before.lower())) != Counter(pattern.findall(after.lower()))
                   for pattern in (NUMBER, QUOTES, MODALS)):
                continue
            rewritten = WORD.findall(after.lower())
            if not 0.8 <= len(rewritten) / len(terms) <= 1.25:
                continue
            kept = Counter(zip(terms, terms[1:])) & Counter(zip(rewritten, rewritten[1:]))
            extent = 1 - sum(kept.values()) / (len(terms) - 1)
            if minimum_extent <= extent <= 0.50:
                yield extent, before, after


def prepare(raw, output, editorial_pairs=None):
    official = {}
    for split, checksum in DATASET_SHA256.items():
        path = raw / (split + ".json")
        if hashlib.sha256(path.read_bytes()).hexdigest() != checksum:
            raise ValueError(f"Unexpected SHA-256 for {path}.")
        official[split] = read(path)
    full_rewrite = editorial_pairs is not None
    authored = []
    if editorial_pairs:
        with editorial_pairs.open(newline="") as original_examples:
            authored = list(csv.DictReader(original_examples, delimiter="\t"))
        if not authored or any(not row["source"] or not row["revision"] for row in authored):
            raise ValueError("Missing editorial examples.")
    used_docs = set()
    used_text = set()
    report = {
        "datasetRevision": REVISION,
        "sha256": DATASET_SHA256,
        "splits": {},
    }
    output.mkdir(parents=True, exist_ok=True)
    splits = (("test", "test"), ("dev", "valid"), ("train", "train"))
    for original_split, target_split in splits:
        rows = official[original_split]
        samples = []
        seen_windows = set()
        for row in rows:
            key = document_key(row)
            if key in used_docs or row.get("domain") not in {"wiki", "news", "arxiv"}:
                continue
            minimum_extent = 0.27 if full_rewrite and target_split == "train" else 0.13
            candidates = sorted(revisions(row, minimum_extent), reverse=True)
            for _, source, target in candidates:
                if source in used_text or source in seen_windows:
                    continue
                samples.append((key, row["domain"], source, target))
                seen_windows.add(source)
                # Keep only the strongest eligible window per revision.
                break
        used_docs.update(map(document_key, rows))
        used_text.update(seen_windows)
        if target_split == "train" and full_rewrite:
            for index, edit in enumerate(authored):
                if edit["source"] in used_text:
                    raise ValueError("Duplicate source in authored examples.")
                used_text.add(edit["source"])
                samples.extend([(f"editorial-{index}", "original", edit["source"], edit["revision"])] * 2)
            report["authoredTrainingExamples"] = len(authored)
            report["authoredWeight"] = 2
        random.Random(42).shuffle(samples)
        with (output / (target_split + ".jsonl")).open("w") as destination:
            for _, _, source, target in samples:
                destination.write(json.dumps({"messages": messages(source, target, full_rewrite)}) + "\n")
        report["splits"][target_split] = {
            "examples": len(samples),
            "documents": len({key for key, _, _, _ in samples}),
            "domains": dict(Counter(domain for _, domain, _, _ in samples)),
        }
    (output / "dataset-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raw", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--editorial-pairs", type=Path)
    args = parser.parse_args()
    prepare(args.raw, args.output, args.editorial_pairs)
