import { describe, it, expect } from 'vitest';
import { cleanTextDeterministically } from '@/lib/humanizer/deterministic-cleaner';
import { analyzeStylometrics } from '@/lib/nlp/stylometrics';
import { extractFactualEntities } from '@/lib/humanizer/guardrail';
import { BENCHMARK_CORPUS } from './fixtures/benchmark-corpus';

describe('Instant Deterministic De-AI Cleaner', () => {
  it('achieves measurable AI score reduction on all 10 LLM benchmark passages', () => {
    const llmPassages = BENCHMARK_CORPUS.filter((p) => p.label === 'llm');
    const drops: number[] = [];

    for (const p of llmPassages) {
      const beforeRes = analyzeStylometrics(p.text);
      const cleaned = cleanTextDeterministically(p.text);
      const afterRes = analyzeStylometrics(cleaned.cleanedText);

      const drop = beforeRes.aiScore - afterRes.aiScore;
      drops.push(drop);
      console.log(`Passage ${p.id}: Before=${beforeRes.aiScore} After=${afterRes.aiScore} Drop=${drop}`);

      // Verify each passage sees a substantial AI score drop
      expect(drop).toBeGreaterThanOrEqual(10);
    }

    const meanDrop = drops.reduce((a, b) => a + b, 0) / drops.length;
    console.log(`Deterministic Cleaner Average AI% Drop: ${meanDrop.toFixed(1)} points`);
    expect(meanDrop).toBeGreaterThanOrEqual(25);
  });

  it('preserves 100% of numeric figures, years, and dates during cleaning', () => {
    const textWithData = `In today's fast-paced world, Q3 revenue reached $42,500,000 across 18 regional hubs. Furthermore, in 2023, user retention improved by 14.8% over the previous 12 months. It is worth noting that 350 enterprise clients renewed contracts.`;

    const originalEntities = extractFactualEntities(textWithData);
    expect(originalEntities.size).toBeGreaterThan(3);

    const cleaned = cleanTextDeterministically(textWithData);

    for (const entity of originalEntities) {
      expect(cleaned.cleanedText).toContain(entity);
    }
  });

  it('preserves user locked terms verbatim', () => {
    const raw = `In today's fast-paced world, Turnitin and ZeroGPT play a pivotal role in education.`;
    const cleaned = cleanTextDeterministically(raw, {
      preserveTerms: ['Turnitin', 'ZeroGPT'],
    });

    expect(cleaned.cleanedText).toContain('Turnitin');
    expect(cleaned.cleanedText).toContain('ZeroGPT');
    expect(cleaned.cleanedText.toLowerCase()).not.toContain('pivotal role');
  });
});
