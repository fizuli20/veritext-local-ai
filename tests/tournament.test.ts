import { describe, it, expect } from 'vitest';
import { runTournamentReranker, computeFallbackSemanticSimilarity } from '../src/lib/humanizer/tournament';

describe('Best-of-N Tournament Reranker', () => {
  const original = `
    In today's fast-paced world, it is worth noting that Dr. Marcus Vance presented 42 new algorithms in Paris on June 15, 2024.
  `;

  it('computes fallback semantic similarity correctly', () => {
    const simHigh = computeFallbackSemanticSimilarity(
      'Dr. Marcus Vance presented 42 new algorithms in Paris.',
      'In Paris, Dr. Marcus Vance unveiled 42 new algorithms.'
    );
    const simLow = computeFallbackSemanticSimilarity(
      'Dr. Marcus Vance presented 42 new algorithms in Paris.',
      'The orange cat slept quietly under the wooden chair in Kyoto.'
    );

    expect(simHigh).toBeGreaterThan(0.75);
    expect(simLow).toBeLessThan(0.70);
  });

  it('selects candidate with low AI score that preserves entities and passes semantic floor', () => {
    const result = runTournamentReranker({
      originalText: original,
      candidates: [
        {
          strategy: 'punchy-active',
          temperature: 0.72,
          // Preserves entities "Dr. Marcus Vance", "42", "Paris", "June 15, 2024", rewrites active
          text: 'Dr. Marcus Vance presented 42 new algorithms in Paris on June 15, 2024.',
          semanticSimilarity: 0.92,
        },
        {
          strategy: 'conversational-inversion',
          temperature: 0.85,
          // Drops entities, hallucinated
          text: 'Some researcher shared dozens of computer programs in France recently.',
          semanticSimilarity: 0.72, // Drops below 0.84 floor
        },
        {
          strategy: 'concrete-compression',
          temperature: 0.94,
          // Leaves AI clichés in text
          text: 'It is a testament to innovation that Dr. Marcus Vance delved into 42 algorithms in Paris on June 15, 2024.',
          semanticSimilarity: 0.88,
        },
      ],
      semanticFloor: 0.84,
      aiScores: [15, 20, 85], // candidate 1 is 15% AI, cand 2 is 20% AI, cand 3 is 85% AI
    });

    expect(result.winner.id).toBe('cand-1-punchy-active');
    expect(result.winner.guardrailPassed).toBe(true);
    expect(result.winner.semanticFloorPassed).toBe(true);
    expect(result.winner.isWinner).toBe(true);

    // Candidate 2 should have failed semantic floor (< 0.84) and failed guardrails
    const cand2 = result.candidates.find((c) => c.strategy === 'conversational-inversion');
    expect(cand2?.semanticFloorPassed).toBe(false);
    expect(cand2?.guardrailPassed).toBe(false);
  });
});
