import { describe, it, expect } from 'vitest';
import { analyzeStylometrics } from '@/lib/nlp/stylometrics';
import { BENCHMARK_CORPUS } from './fixtures/benchmark-corpus';

describe('Stylometric AI Detection Engine', () => {
  it('correctly discriminates between 10 Human and 10 LLM benchmark passages', () => {
    const humanPassages = BENCHMARK_CORPUS.filter((p) => p.label === 'human');
    const llmPassages = BENCHMARK_CORPUS.filter((p) => p.label === 'llm');

    expect(humanPassages.length).toBe(10);
    expect(llmPassages.length).toBe(10);

    const humanScores: number[] = [];
    const llmScores: number[] = [];

    let correctCount = 0;

    for (const p of humanPassages) {
      const res = analyzeStylometrics(p.text);
      humanScores.push(res.aiScore);
      if (res.aiScore < 50) correctCount++;
    }

    for (const p of llmPassages) {
      const res = analyzeStylometrics(p.text);
      llmScores.push(res.aiScore);
      if (res.aiScore >= 50) correctCount++;
    }

    const meanHumanScore = humanScores.reduce((a, b) => a + b, 0) / humanScores.length;
    const meanLlmScore = llmScores.reduce((a, b) => a + b, 0) / llmScores.length;
    const separation = meanLlmScore - meanHumanScore;
    const accuracy = (correctCount / 20) * 100;

    // Output stats for verification
    console.log(`Mean Human AI Score: ${meanHumanScore.toFixed(1)}%`);
    console.log(`Mean LLM AI Score: ${meanLlmScore.toFixed(1)}%`);
    console.log(`Separation Delta: ${separation.toFixed(1)} points`);
    console.log(`Binary Accuracy: ${accuracy.toFixed(1)}%`);

    // Non-negotiable requirements:
    // 1. Mean AI score on LLM passages exceeds human by >= 35 points
    expect(separation).toBeGreaterThanOrEqual(35);

    // 2. Binary classification accuracy at threshold 50 is >= 85%
    expect(accuracy).toBeGreaterThanOrEqual(85);
  });

  it('guarantees p95 latency on 500-word passages is < 50ms', () => {
    // Generate a realistic 500-word passage
    const sample = BENCHMARK_CORPUS[0]!.text + ' ' + BENCHMARK_CORPUS[1]!.text + ' ' + BENCHMARK_CORPUS[2]!.text;
    const latencies: number[] = [];

    // Warm-up run
    analyzeStylometrics(sample);

    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      analyzeStylometrics(sample);
      latencies.push(performance.now() - t0);
    }

    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index]!;

    console.log(`Stylometrics p50 latency: ${latencies[Math.floor(latencies.length * 0.5)]?.toFixed(2)}ms`);
    console.log(`Stylometrics p95 latency: ${p95Latency.toFixed(2)}ms`);

    expect(p95Latency).toBeLessThan(50);
  });
});
