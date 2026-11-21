import { describe, it, expect } from 'vitest';
import { tokenizeSentences, tokenizeWords, countWords } from '@/lib/nlp/tokenizer';

describe('Offset-Exact Tokenizer', () => {
  it('guarantees raw.slice(s.start, s.end) === s.text for all sentences', () => {
    const raw = `Dr. Robert Vance, Ph.D., examined the $42,500 manifest at 03:14 UTC. Was Berth 9 really decommissioned? Yes! In 2023, harbor loggers repeatedly billed taxpayers for dredge maintenance on Berth 9. The catch? Berth 9 had been decommissioned five years prior. When our reporting team confronted commissioner Vance outside the safety building, he didn't call his attorney. He didn't speak either. He just walked away into the sleet.`;

    const sentences = tokenizeSentences(raw);
    expect(sentences.length).toBeGreaterThan(4);

    for (const s of sentences) {
      expect(raw.slice(s.start, s.end)).toBe(s.text);
      expect(s.wordCount).toBeGreaterThan(0);
    }
  });

  it('accurately handles abbreviations (Dr., U.S., e.g., vs., etc.) without premature splitting', () => {
    const raw = `The U.S. envoy met Dr. Jones at 9 a.m. in Washington, D.C. to discuss e.g. tariffs vs. subsidies. They agreed on three points.`;
    const sentences = tokenizeSentences(raw);

    expect(sentences.length).toBe(2);
    expect(raw.slice(sentences[0]!.start, sentences[0]!.end)).toBe(
      'The U.S. envoy met Dr. Jones at 9 a.m. in Washington, D.C. to discuss e.g. tariffs vs. subsidies.'
    );
    expect(raw.slice(sentences[1]!.start, sentences[1]!.end)).toBe('They agreed on three points.');
  });

  it('accurately handles decimals (3.14) and URLs without splitting', () => {
    const raw = `Visit https://zerogpt.com for details on the 3.14159 ratio. It is accurate.`;
    const sentences = tokenizeSentences(raw);

    expect(sentences.length).toBe(2);
    expect(sentences[0]!.text).toBe('Visit https://zerogpt.com for details on the 3.14159 ratio.');
    expect(sentences[1]!.text).toBe('It is accurate.');
  });

  it('handles quotes, ellipses, and parentheticals', () => {
    const raw = `He whispered, "Boy, if sunlight can't fly through the canopy... your apples will rot." Then he left.`;
    const sentences = tokenizeSentences(raw);

    expect(sentences.length).toBe(2);
    expect(raw.slice(sentences[0]!.start, sentences[0]!.end)).toBe(
      `He whispered, "Boy, if sunlight can't fly through the canopy... your apples will rot."`
    );
    expect(raw.slice(sentences[1]!.start, sentences[1]!.end)).toBe('Then he left.');
  });

  it('tokenizes words and returns correct counts', () => {
    const text = "Don't count the chickens before they've hatched.";
    const words = tokenizeWords(text);
    expect(words.length).toBe(7);
    expect(countWords(text)).toBe(7);
  });
});
