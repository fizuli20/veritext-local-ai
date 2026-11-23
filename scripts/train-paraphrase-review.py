"""Fit and evaluate the browser's abstaining paraphrase review on PAWS-Wiki.

Run with Python (numpy, pyarrow, scikit-learn) and Node 24 from this repository.
The dataset directory contains train.parquet, validation.parquet and test.parquet.
"""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np
import pyarrow.parquet as pq
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score


ROOT = Path(__file__).resolve().parent.parent
REVISION = "161ece9501cf0a11f3e48bd356eaa82de46d6a09"
SPLITS = {
    "train": "8dc9ad3e5f30ad9a86b290fe236d528ef23a5751fec9a35d99cbacf68ba277cf",
    "validation": "7760d829453764ba342a6f562809a8ed21c2c3eec3fd9ffa544089f145d42f6d",
    "test": "ae342ff12bb84b84b95f468abf5db6cb7c7bd578271299fe9c99be75b8132f4d",
}


def load(split, source_dir):
    path = source_dir / (split + ".parquet")
    if hashlib.sha256(path.read_bytes()).hexdigest() != SPLITS[split]:
        raise ValueError(f"Unexpected dataset revision for {split}.")
    data = pq.read_table(path).to_pydict()
    pairs = zip(data["sentence1"], data["sentence2"])
    lines = "\n".join(json.dumps(pair) for pair in pairs) + "\n"
    result = subprocess.run(
        ["node", str(ROOT / "scripts/paraphrase-training-features.mjs")],
        input=lines, capture_output=True, text=True, check=True,
    )
    features = np.array([json.loads(line) for line in result.stdout.splitlines()])
    return features, 1 - np.array(data["label"])


def eligible(features):
    return (features[:, 1] >= 0.75) & (features[:, 5] < 0.999) & (
        features[:, -1] >= 9
    ) & (features[:, -1] <= 55)


def review_stats(scores, labels, features, threshold):
    selected = (scores >= threshold) & eligible(features)
    correct = int(np.sum(labels[selected]))
    flagged = int(np.sum(selected))
    return {
        "pairs": len(labels),
        "eligible": int(np.sum(eligible(features))),
        "flagged": flagged,
        "correctFlags": correct,
        "falseFlags": flagged - correct,
        "precision": round(correct / flagged, 4) if flagged else None,
        "rocAuc": round(roc_auc_score(labels, scores), 4),
    }


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("dataset", type=Path)
    args.add_argument("--model", type=Path, required=True)
    args.add_argument("--report", type=Path, required=True)
    args = args.parse_args()

    train, train_labels = load("train", args.dataset)
    validation, validation_labels = load("validation", args.dataset)
    test, test_labels = load("test", args.dataset)
    model = HistGradientBoostingClassifier(
        max_iter=65, max_leaf_nodes=15, learning_rate=0.15,
        min_samples_leaf=35, early_stopping=False, random_state=24,
    ).fit(train, train_labels)
    validation_scores = model.decision_function(validation)
    # Choose the lowest cutoff with at least 30 review flags and 90% dev precision for an advisory signal.
    threshold = next(
        (float(cutoff) for cutoff in np.arange(0, 7.01, 0.1)
         if (stats := review_stats(
             validation_scores, validation_labels, validation, cutoff
         ))["flagged"] >= 30 and stats["precision"] >= 0.90),
        None,
    )
    if threshold is None:
        raise RuntimeError("No review cutoff met the development criteria.")
    test_scores = model.decision_function(test)
    report = {
        "dataset": "Google Research PAWS-Wiki Labeled Final",
        "datasetRevision": REVISION,
        "trainingPairs": len(train_labels),
        "reviewLogitCutoff": round(threshold, 3),
        "validation": review_stats(validation_scores, validation_labels, validation, threshold),
        "test": review_stats(test_scores, test_labels, test, threshold),
    }
    trees = []
    for predictor, in model._predictors:
        trees.append([
            round(float(node["value"]), 10) if node["is_leaf"] else [
                int(node["feature_idx"]), float(node["num_threshold"]),
                int(node["left"]), int(node["right"]),
            ]
            for node in predictor.nodes
        ])
    weights = {
        "bias": float(model._baseline_prediction.item()),
        "cutoff": report["reviewLogitCutoff"],
        "trees": trees,
    }
    args.model.write_text(json.dumps(weights, separators=(",", ":")) + "\n")
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
