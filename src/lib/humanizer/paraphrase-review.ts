import { paraphraseFeatures } from "./paraphrase-features";
import weights from "./paraphrase-review-weights.json";

/** Advisory signal for short, substantially overlapping English rewrites. */
export function flagsPossibleMeaningChange(
  source: string,
  candidate: string,
): boolean {
  // Avoid comparing long passages or very short replacements with this model.
  if (source === candidate || source.length > 450 || candidate.length > 450)
    return false;
  const features = paraphraseFeatures(source, candidate);
  const overlap = features[1]!;
  const length = features.at(-1)!;
  if (overlap < 0.75 || features[5]! >= 0.999 || length < 9 || length > 55)
    return false;
  let score = weights.bias;
  for (const tree of weights.trees) {
    let node = tree[0]!;
    while (typeof node !== "number") {
      const [feature, cutoff, left, right] = node;
      node = tree[features[feature!]! <= cutoff! ? left! : right!]!;
    }
    score += node;
  }
  return score >= weights.cutoff;
}
