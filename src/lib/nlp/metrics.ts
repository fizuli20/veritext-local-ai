/**
 * Statistical NLP Evaluation Metrics:
 * - ROC Curve & Trapezoidal AUC
 * - TPR @ 1% FPR and TPR @ 5% FPR
 * - Expected Calibration Error (ECE)
 * - Domain-specific False Positive Rates
 */

export interface RocPoint {
  threshold: number;
  fpr: number; // False Positive Rate (x-axis)
  tpr: number; // True Positive Rate (y-axis)
}

export interface CalibrationBin {
  binIndex: number;
  confidenceLower: number;
  confidenceUpper: number;
  avgConfidence: number;
  empiricalAccuracy: number;
  sampleCount: number;
}

export interface RocEvaluationResult {
  auc: number;
  rocPoints: RocPoint[];
  tprAt1Fpr: number;
  tprAt5Fpr: number;
  ece: number;
  calibrationBins: CalibrationBin[];
}

/**
 * Computes ROC Curve points and Trapezoidal Area Under Curve (AUC).
 * Positive label (1) = AI-generated; Negative label (0) = Human-written.
 * Scores are assumed to be in [0, 1] or [0, 100].
 */
export function computeRocCurve(labels: (0 | 1)[], scores: number[]): RocEvaluationResult {
  if (labels.length !== scores.length || labels.length === 0) {
    throw new Error('Labels and scores must be non-empty arrays of identical length');
  }

  // Normalize scores to [0, 1]
  const maxScore = Math.max(...scores);
  const normalizedScores = maxScore > 1 ? scores.map((s) => s / 100) : [...scores];

  // Combine and sort descending by score
  const paired = labels.map((label, i) => ({ label, score: normalizedScores[i]! }));
  paired.sort((a, b) => b.score - a.score);

  const totalPositives = labels.filter((l) => l === 1).length;
  const totalNegatives = labels.filter((l) => l === 0).length;

  if (totalPositives === 0 || totalNegatives === 0) {
    return {
      auc: 0.5,
      rocPoints: [{ threshold: 1, fpr: 0, tpr: 0 }, { threshold: 0, fpr: 1, tpr: 1 }],
      tprAt1Fpr: 0,
      tprAt5Fpr: 0,
      ece: 0,
      calibrationBins: [],
    };
  }

  let tp = 0;
  let fp = 0;
  const rawPoints: RocPoint[] = [{ threshold: 1.01, fpr: 0, tpr: 0 }];

  for (let i = 0; i < paired.length; i++) {
    const item = paired[i]!;
    if (item.label === 1) tp++;
    else fp++;

    // Only emit point if next score is different or at end
    if (i === paired.length - 1 || paired[i + 1]?.score !== item.score) {
      rawPoints.push({
        threshold: Math.round(item.score * 1000) / 1000,
        fpr: Math.round((fp / totalNegatives) * 1000) / 1000,
        tpr: Math.round((tp / totalPositives) * 1000) / 1000,
      });
    }
  }

  if (rawPoints[rawPoints.length - 1]?.fpr !== 1 || rawPoints[rawPoints.length - 1]?.tpr !== 1) {
    rawPoints.push({ threshold: 0, fpr: 1, tpr: 1 });
  }

  // Trapezoidal AUC integration: sum((x_i - x_{i-1}) * (y_i + y_{i-1}) / 2)
  let auc = 0;
  for (let i = 1; i < rawPoints.length; i++) {
    const dx = (rawPoints[i]?.fpr ?? 0) - (rawPoints[i - 1]?.fpr ?? 0);
    const avgY = ((rawPoints[i]?.tpr ?? 0) + (rawPoints[i - 1]?.tpr ?? 0)) / 2;
    auc += dx * avgY;
  }
  auc = Math.max(0, Math.min(1, Math.round(auc * 10000) / 10000));

  // Compute TPR @ 1% FPR and 5% FPR
  const tprAt1Fpr = computeTprAtFpr(rawPoints, 0.01);
  const tprAt5Fpr = computeTprAtFpr(rawPoints, 0.05);

  // Compute Expected Calibration Error (ECE)
  const { ece, bins } = computeEce(labels, normalizedScores, 10);

  return {
    auc,
    rocPoints: rawPoints,
    tprAt1Fpr,
    tprAt5Fpr,
    ece,
    calibrationBins: bins,
  };
}

/**
 * Finds TPR at a specified FPR budget.
 */
export function computeTprAtFpr(points: RocPoint[], targetFpr: number): number {
  let bestTpr = 0;
  for (const pt of points) {
    if (pt.fpr <= targetFpr) {
      if (pt.tpr > bestTpr) bestTpr = pt.tpr;
    }
  }
  return Math.round(bestTpr * 1000) / 1000;
}

/**
 * Computes Expected Calibration Error across equal-width confidence bins:
 * ECE = sum( (|B_m| / N) * |acc(B_m) - conf(B_m)| )
 */
export function computeEce(
  labels: (0 | 1)[],
  normalizedScores: number[],
  numBins = 10
): { ece: number; bins: CalibrationBin[] } {
  const bins: CalibrationBin[] = [];
  const binWidth = 1.0 / numBins;
  const n = labels.length;

  let totalEce = 0;

  for (let b = 0; b < numBins; b++) {
    const lower = b * binWidth;
    const upper = (b + 1) * binWidth;

    const indices: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = normalizedScores[i]!;
      if (b === numBins - 1 ? s >= lower && s <= upper : s >= lower && s < upper) {
        indices.push(i);
      }
    }

    if (indices.length === 0) {
      bins.push({
        binIndex: b,
        confidenceLower: Math.round(lower * 100) / 100,
        confidenceUpper: Math.round(upper * 100) / 100,
        avgConfidence: (lower + upper) / 2,
        empiricalAccuracy: 0,
        sampleCount: 0,
      });
      continue;
    }

    const sumConf = indices.reduce((sum, i) => sum + (normalizedScores[i] ?? 0), 0);
    const avgConfidence = sumConf / indices.length;

    const positiveCount = indices.filter((i) => labels[i] === 1).length;
    const empiricalAccuracy = positiveCount / indices.length;

    const binWeight = indices.length / n;
    const binDiff = Math.abs(empiricalAccuracy - avgConfidence);
    totalEce += binWeight * binDiff;

    bins.push({
      binIndex: b,
      confidenceLower: Math.round(lower * 100) / 100,
      confidenceUpper: Math.round(upper * 100) / 100,
      avgConfidence: Math.round(avgConfidence * 1000) / 1000,
      empiricalAccuracy: Math.round(empiricalAccuracy * 1000) / 1000,
      sampleCount: indices.length,
    });
  }

  return {
    ece: Math.round(totalEce * 1000) / 1000,
    bins,
  };
}
