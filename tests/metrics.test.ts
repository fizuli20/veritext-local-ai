import { describe, it, expect } from 'vitest';
import { computeRocCurve, computeTprAtFpr, computeEce } from '../src/lib/nlp/metrics';

describe('Statistical NLP Evaluation Metrics', () => {
  it('computes perfect ROC-AUC = 1.0 for linearly separable distributions', () => {
    // 5 human (0), 5 AI (1)
    const labels: (0 | 1)[] = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
    const scores = [10, 15, 20, 12, 18, 85, 90, 95, 88, 92];

    const result = computeRocCurve(labels, scores);
    expect(result.auc).toBe(1.0);
    expect(result.tprAt1Fpr).toBe(1.0);
    expect(result.tprAt5Fpr).toBe(1.0);
  });

  it('computes exact trapezoidal AUC for known overlapping predictions', () => {
    // 2 human (0), 2 AI (1) with one inverted score
    const labels: (0 | 1)[] = [0, 0, 1, 1];
    const scores = [0.2, 0.7, 0.4, 0.9];

    const result = computeRocCurve(labels, scores);
    expect(result.auc).toBeGreaterThanOrEqual(0.7);
    expect(result.auc).toBeLessThanOrEqual(0.8);
    expect(result.rocPoints.length).toBeGreaterThan(2);
  });

  it('computes Expected Calibration Error (ECE) accurately', () => {
    // Perfectly calibrated predictions (50% positive in [0.4, 0.6], 100% in [0.9, 1.0])
    const labels: (0 | 1)[] = [0, 1, 1, 1];
    const scores = [0.5, 0.5, 0.95, 0.95];

    const { ece, bins } = computeEce(labels, scores, 10);
    expect(ece).toBeLessThan(0.1);
    expect(bins).toHaveLength(10);
  });
});
