import { describe, it, expect } from 'vitest';
import { CLICHE_FREE_CORPUS } from './fixtures/cliche-free-corpus';
import { scanFingerprints } from '../src/lib/nlp/fingerprints';
import { analyzeStylometrics } from '../src/lib/nlp/stylometrics';

describe('Hard Cliché-Free Benchmark Suite (V3 Apex)', () => {
  it('explicitly verifies that all 10 subtle LLM passages contain ZERO Tier-1 clichés', () => {
    for (const passage of CLICHE_FREE_CORPUS.filter((p) => p.type === 'llm')) {
      const fp = scanFingerprints(passage.text);
      expect(fp.tier1Count, `Passage ${passage.id} should have zero Tier-1 clichés`).toBe(0);
    }
  });

  it('discriminates subtle modern LLM text from human text with >= 80% accuracy and <= 10% human false positives', () => {
    let correct = 0;
    let humanFalsePositives = 0;
    const humanPassages = CLICHE_FREE_CORPUS.filter((p) => p.type === 'human');
    const llmPassages = CLICHE_FREE_CORPUS.filter((p) => p.type === 'llm');

    console.log('\n=== HARD CLICHÉ-FREE BENCHMARK EVALUATION ===');

    for (const p of humanPassages) {
      const res = analyzeStylometrics(p.text, 'general');
      const isCorrect = res.aiScore < 50;
      if (isCorrect) correct++;
      else {
        humanFalsePositives++;
        console.warn(`[HUMAN FALSE POSITIVE] ${p.id} (${p.title}): Score=${res.aiScore}%`, res.signals, res.metrics);
      }
    }

    for (const p of llmPassages) {
      const res = analyzeStylometrics(p.text, 'general');
      const isCorrect = res.aiScore >= 50;
      if (isCorrect) correct++;
      else {
        console.warn(`[LLM FALSE NEGATIVE] ${p.id} (${p.title}): Score=${res.aiScore}%`);
      }
    }

    const accuracy = (correct / CLICHE_FREE_CORPUS.length) * 100;
    const humanFpRate = (humanFalsePositives / humanPassages.length) * 100;

    console.log(`Hard Cliché-Free Accuracy: ${accuracy.toFixed(1)}% (${correct}/${CLICHE_FREE_CORPUS.length})`);
    console.log(`Human False-Positive Rate: ${humanFpRate.toFixed(1)}% (${humanFalsePositives}/${humanPassages.length})`);

    expect(humanFpRate).toBeLessThanOrEqual(10.0);
    expect(accuracy).toBeGreaterThanOrEqual(80.0);
  });
});
