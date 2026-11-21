import { describe, it, expect } from 'vitest';
import { computeAnalyticalCurvature } from '../src/workers/perplexity.worker';

describe('Fast-DetectGPT Conditional Probability Curvature Math', () => {
  it('computes positive curvature on peaked/low-entropy (AI-like) token predictions', () => {
    // Model strongly predicts target token with high probability
    // e.g. prob = 0.85, other 9 tokens share remaining 0.15
    const syntheticAiTokens: Array<{ prob: number; probs: number[] }> = [];
    for (let i = 0; i < 20; i++) {
      const pTarget = 0.88;
      const otherP = (1 - pTarget) / 19;
      const probs = [pTarget, ...new Array(19).fill(otherP)];
      syntheticAiTokens.push({ prob: pTarget, probs });
    }

    const { zScore, deltas, variances } = computeAnalyticalCurvature(syntheticAiTokens);

    expect(Number.isFinite(zScore)).toBe(true);
    expect(Number.isNaN(zScore)).toBe(false);
    expect(zScore).toBeGreaterThan(0.5); // AI text has positive curvature
    expect(deltas.length).toBe(20);
    expect(variances.length).toBe(20);
  });

  it('computes low or negative curvature on uniform/diffuse (human/surprising) tokens', () => {
    // Target token has low probability compared to expectations
    // e.g. target prob = 0.05, but some other token had 0.60
    const syntheticHumanTokens: Array<{ prob: number; probs: number[] }> = [];
    for (let i = 0; i < 20; i++) {
      const pTarget = 0.04;
      const pDominant = 0.60;
      const remainder = (1 - pTarget - pDominant) / 18;
      const probs = [pTarget, pDominant, ...new Array(18).fill(remainder)];
      syntheticHumanTokens.push({ prob: pTarget, probs });
    }

    const { zScore } = computeAnalyticalCurvature(syntheticHumanTokens);

    expect(Number.isFinite(zScore)).toBe(true);
    expect(Number.isNaN(zScore)).toBe(false);
    expect(zScore).toBeLessThan(0.0); // Human / surprising text has negative curvature
  });

  it('guarantees numerical stability with zero probabilities and single-token arrays', () => {
    const singleToken = [{ prob: 1e-12, probs: [1.0, 0, 0, 0] }];
    const res = computeAnalyticalCurvature(singleToken);
    expect(Number.isFinite(res.zScore)).toBe(true);
    expect(Number.isNaN(res.zScore)).toBe(false);
  });
});
