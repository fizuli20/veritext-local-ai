import calibration from "../../data/detector-calibration.json";
import { countWords } from "../nlp/tokenizer";
import { detectLanguage } from "../nlp/language";

export const DETECTOR_MODEL = "onnx-community/tmr-ai-text-detector-ONNX";
export const DETECTOR_REVISION = "b9aa251e5bcda7e429fcc936767d921435945b60";

export interface DetectionEvidence {
  status: "insufficient-text" | "unsupported-language" | "uncertain" | "signal";
  verdict: string;
  modelScore: number | null;
  calibratedProbability: number | null;
  calibration: "unvalidated" | "HC3-provisional";
  referenceProbability?: number;
  referenceBin?: {
    count: number;
    aiCount: number;
    lower: number;
    upper: number;
  };
  explanation: string;
}

// The config at DETECTOR_REVISION explicitly maps 0=human and 1=ai.
// Refuse unknown labels instead of guessing which class LABEL_1 means.
export function parseAiScore(output: unknown): number {
  const rows = output as { label: string; score: number }[];
  const ai = Array.isArray(rows)
    ? rows.find((row) => row.label === "ai")
    : undefined;
  if (!ai || !Number.isFinite(ai.score) || ai.score < 0 || ai.score > 1) {
    throw new Error(
      "Detector returned an unexpected class mapping. Expected ai/human labels.",
    );
  }
  return ai.score;
}

export function wilsonInterval(
  successes: number,
  count: number,
): { lower: number; upper: number } {
  if (count === 0) return { lower: 0, upper: 1 };
  const z = 1.96,
    p = successes / count,
    denominator = 1 + (z * z) / count;
  const center = (p + (z * z) / (2 * count)) / denominator;
  const radius =
    (z * Math.sqrt((p * (1 - p)) / count + (z * z) / (4 * count * count))) /
    denominator;
  return {
    lower: Math.max(0, center - radius),
    upper: Math.min(1, center + radius),
  };
}
export function describeEvidence(
  text: string,
  score: number | null,
): DetectionEvidence {
  const base = {
    modelScore: score,
    calibratedProbability: null,
    calibration: "unvalidated" as const,
  };
  if (text.trim() && !detectLanguage(text).englishOptimized)
    return {
      ...base,
      modelScore: null,
      status: "unsupported-language",
      verdict: "English model only",
      explanation:
        "This detector has not been validated for this language. No authorship verdict is available.",
    };
  if (countWords(text) < 80)
    return {
      ...base,
      modelScore: null,
      status: "insufficient-text",
      verdict: "Too little text",
      explanation:
        "Use at least 80 words of English prose. Short passages cannot support a useful authorship estimate.",
    };
  if (
    score === null ||
    !calibration.active ||
    calibration.revision !== DETECTOR_REVISION
  )
    return {
      ...base,
      status: "uncertain",
      verdict: "Inconclusive",
      explanation: "No validated inference is available for this input.",
    };
  const logit = Math.log(Math.max(1e-6, score) / Math.max(1e-6, 1 - score));
  const referenceProbability =
    1 / (1 + Math.exp(-(calibration.slope * logit + calibration.intercept)));
  const bin =
    calibration.bins[Math.min(4, Math.floor(referenceProbability * 5))]!;
  const interval = wilsonInterval(bin.aiCount, bin.count);
  const evidence = {
    ...base,
    calibration: "HC3-provisional" as const,
    referenceProbability,
    referenceBin: { count: bin.count, aiCount: bin.aiCount, ...interval },
  };
  const high =
    score >= 0.8 && referenceProbability >= 0.8 && interval.lower > 0.5;
  const low =
    score <= 0.2 && referenceProbability <= 0.2 && interval.upper < 0.5;
  if (bin.count < 10 || (!high && !low))
    return {
      ...evidence,
      status: "uncertain",
      verdict: "Inconclusive",
      explanation:
        "The raw and reference-calibrated signals are ambiguous or disagree. No authorship conclusion is supported.",
    };
  return {
    ...evidence,
    status: "signal",
    verdict: high ? "AI-like patterns" : "Human-like patterns",
    explanation:
      "Both signals agree on a writing pattern. This is not proof of authorship. Newer models, edited text, and different domains can still be misclassified.",
  };
}

export function tokenWindows(
  ids: number[],
  size = 480,
  overlap = 64,
): number[][] {
  if (size <= overlap || overlap < 0)
    throw new Error("Invalid token window settings");
  const windows: number[][] = [];
  for (let start = 0; start < ids.length; start += size - overlap) {
    windows.push(ids.slice(start, start + size));
    if (start + size >= ids.length) break;
  }
  return windows;
}
