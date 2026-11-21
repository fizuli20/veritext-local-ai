import { describe, it, expect } from 'vitest';
import { maskProtectedSpans, restoreProtectedSpans } from '../src/lib/humanizer/protected-spans';

describe('Protected-Span Masking & Restoration Engine (V3 Apex)', () => {
  it('masks and restores direct quotations with >= 4 words', () => {
    const text = 'The philosopher argued that "all knowledge begins with sensory experience and intuition" in his early work.';
    const { maskedText, spans } = maskProtectedSpans(text, { protectQuotes: true });

    expect(maskedText).toContain('__KEEP_0__');
    expect(spans).toHaveLength(1);
    expect(spans[0]!.type).toBe('quote');

    // Simulate rewriting surrounding prose
    const rewritten = 'The scholar maintained that __KEEP_0__ during his formative treatise.';
    const restored = restoreProtectedSpans(rewritten, spans);

    expect(restored).toBe('The scholar maintained that "all knowledge begins with sensory experience and intuition" during his formative treatise.');
  });

  it('masks and restores APA citations, IEEE refs, and DOI strings', () => {
    const text = 'Prior research (Smith et al., 2024) and recent surveys [1-3] confirmed this finding (doi: 10.1038/s41586-020-2649-2).';
    const { maskedText, spans } = maskProtectedSpans(text, { protectCitations: true });

    expect(maskedText).toContain('__KEEP_0__');
    expect(maskedText).toContain('__KEEP_1__');
    expect(maskedText).toContain('__KEEP_2__');

    const simulatedRewrite = 'Earlier investigations __KEEP_0__ along with documented benchmarks __KEEP_1__ verified the outcome (doi: __KEEP_2__).';
    const restored = restoreProtectedSpans(simulatedRewrite, spans);

    expect(restored).toContain('(Smith et al., 2024)');
    expect(restored).toContain('[1-3]');
    expect(restored).toContain('10.1038/s41586-020-2649-2');
  });

  it('masks and restores fenced code blocks, inline code, and LaTeX math', () => {
    const text = 'Consider the formula $E = mc^2$ and function `calculateVelocity()`, or the block:\n```python\ndef compute(x):\n    return x * 2\n```';
    const { maskedText, spans } = maskProtectedSpans(text, { protectCodeAndMath: true });

    expect(maskedText).not.toContain('```python');
    expect(maskedText).not.toContain('$E = mc^2$');

    const simulatedRewrite = 'Examine the relation __KEEP_2__ and utility __KEEP_1__, or the snippet:\n__KEEP_0__';
    const restored = restoreProtectedSpans(simulatedRewrite, spans);

    expect(restored).toContain('$E = mc^2$');
    expect(restored).toContain('`calculateVelocity()`');
    expect(restored).toContain('def compute(x):');
  });

  it('handles fuzzy placeholder variation from small LLMs', () => {
    const text = 'The server reported "internal error during database connection" at startup.';
    const { spans } = maskProtectedSpans(text);

    // LLM modified placeholder from __KEEP_0__ to KEEP_0 or __keep_0__
    const messyRewrite = 'The cluster logged KEEP_0 upon initiation.';
    const restored = restoreProtectedSpans(messyRewrite, spans);

    expect(restored).toContain('"internal error during database connection"');
  });
});
