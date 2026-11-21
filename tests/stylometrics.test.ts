import { describe, it, expect } from 'vitest';
import { analyzeStylometrics } from '@/lib/nlp/stylometrics';
import { BENCHMARK_CORPUS } from './fixtures/benchmark-corpus';
import { ADVERSARIAL_CORPUS } from './fixtures/adversarial-corpus';

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

    console.log(`Mean Human AI Score: ${meanHumanScore.toFixed(1)}%`);
    console.log(`Mean LLM AI Score: ${meanLlmScore.toFixed(1)}%`);
    console.log(`Separation Delta: ${separation.toFixed(1)} points`);
    console.log(`Binary Accuracy: ${accuracy.toFixed(1)}%`);

    expect(separation).toBeGreaterThanOrEqual(35);
    expect(accuracy).toBeGreaterThanOrEqual(85);
  });

  it('evaluates the 50-passage adversarial corpus with >= 88% accuracy and <= 10% ESL/Academic false-positive rate', () => {
    const humanPassages = ADVERSARIAL_CORPUS.filter((p) => p.category.startsWith('human-'));
    const llmPassages = ADVERSARIAL_CORPUS.filter((p) => p.category === 'llm-raw');

    expect(humanPassages.length).toBe(15);
    expect(llmPassages.length).toBe(15);

    let humanCorrect = 0;
    let llmCorrect = 0;

    const humanScores: number[] = [];
    const llmScores: number[] = [];

    // Test Human passages with their domain profiles (ESL-Fair, Academic, etc.)
    for (const p of humanPassages) {
      const res = analyzeStylometrics(p.text, p.domain);
      humanScores.push(res.aiScore);
      if (res.aiScore < 50) {
        humanCorrect++;
      }
    }

    // Test Raw LLM passages
    for (const p of llmPassages) {
      const res = analyzeStylometrics(p.text, p.domain);
      llmScores.push(res.aiScore);
      if (res.aiScore >= 50) {
        llmCorrect++;
      }
    }

    const totalEvaluated = humanPassages.length + llmPassages.length;
    const overallAccuracy = ((humanCorrect + llmCorrect) / totalEvaluated) * 100;
    const eslAcademicPassages = humanPassages.filter((p) => p.category === 'human-esl' || p.category === 'human-academic');
    const eslAcademicFalsePositives = eslAcademicPassages.filter((p) => {
      const res = analyzeStylometrics(p.text, p.domain);
      return res.aiScore >= 50;
    }).length;
    const eslAcademicFpRate = (eslAcademicFalsePositives / eslAcademicPassages.length) * 100;

    const meanHumanScore = humanScores.reduce((a, b) => a + b, 0) / humanScores.length;
    const meanLlmScore = llmScores.reduce((a, b) => a + b, 0) / llmScores.length;

    console.log(`=== 50-PASSAGE ADVERSARIAL BENCHMARK ===`);
    console.log(`Overall Accuracy (Human vs Raw LLM): ${overallAccuracy.toFixed(1)}%`);
    console.log(`Mean Human Score: ${meanHumanScore.toFixed(1)}% | Mean LLM Score: ${meanLlmScore.toFixed(1)}%`);
    console.log(`Separation Delta: ${(meanLlmScore - meanHumanScore).toFixed(1)} points`);
    console.log(`ESL & Academic False-Positive Rate: ${eslAcademicFpRate.toFixed(1)}% (${eslAcademicFalsePositives}/${eslAcademicPassages.length})`);

    // Mandate: >= 88% accuracy across Human vs Raw LLM
    expect(overallAccuracy).toBeGreaterThanOrEqual(88);

    // Mandate: <= 10% false-positive rate on ESL & Academic human passages
    expect(eslAcademicFpRate).toBeLessThanOrEqual(10);
  });

  it('detects and neutralizes 10/10 adversarial evasion attacks in the corpus', () => {
    const advAttacks = ADVERSARIAL_CORPUS.filter((p) => p.category === 'adversarial' && p.expectedIsAi);
    expect(advAttacks.length).toBeGreaterThanOrEqual(8);

    let detectedAttacks = 0;
    for (const p of advAttacks) {
      const res = analyzeStylometrics(p.text);
      if (res.obfuscationReport.detected || res.aiScore >= 50) {
        detectedAttacks++;
      }
    }

    const detectionRate = (detectedAttacks / advAttacks.length) * 100;
    console.log(`Adversarial Attack Neutralization Rate: ${detectionRate.toFixed(1)}% (${detectedAttacks}/${advAttacks.length})`);
    expect(detectedAttacks).toBe(advAttacks.length);
  });

  it('guarantees p95 latency on 500-word passages is < 40ms', () => {
    const sample = BENCHMARK_CORPUS[0]!.text + ' ' + BENCHMARK_CORPUS[1]!.text + ' ' + BENCHMARK_CORPUS[2]!.text;
    const latencies: number[] = [];

    // Warm-up run
    analyzeStylometrics(sample);

    for (let i = 0; i < 25; i++) {
      const t0 = performance.now();
      analyzeStylometrics(sample);
      latencies.push(performance.now() - t0);
    }

    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index]!;

    console.log(`Stylometrics p50 latency: ${latencies[Math.floor(latencies.length * 0.5)]?.toFixed(2)}ms`);
    console.log(`Stylometrics p95 latency: ${p95Latency.toFixed(2)}ms`);

    expect(p95Latency).toBeLessThan(40);
  });
});
