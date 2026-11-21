import { describe, it, expect } from 'vitest';
import { sanitizeInput } from '../src/lib/nlp/sanitizer';

describe('Adversarial Sanitizer & Homoglyph Defense', () => {
  it('detects and strips zero-width spaces, soft hyphens, and bidirectional overrides', () => {
    // Injected with zero-width space (\u200B), soft hyphen (\u00AD), and byte order mark (\uFEFF)
    const attackText = 'In\u200B to\u00ADday\uFEFF\'s fast-paced world\u202E.';
    const report = sanitizeInput(attackText);

    expect(report.detected).toBe(true);
    expect(report.zeroWidthCount).toBeGreaterThanOrEqual(4);
    expect(report.normalizedText).toBe("In today's fast-paced world.");
  });

  it('detects and normalizes Cyrillic lookalikes embedded in Latin words', () => {
    // "delve" with Cyrillic 'е' (\u0435)
    // "tapestry" with Cyrillic 'а' (\u0430) and 'р' (\u0440)
    const attackText = 'We must d\u0435lv\u0435 into the t\u0430\u0440estry of modern tech.';
    const report = sanitizeInput(attackText);

    expect(report.detected).toBe(true);
    expect(report.homoglyphCount).toBe(4);
    expect(report.flaggedTokens.length).toBeGreaterThan(0);
    expect(report.normalizedText).toBe('We must delve into the tapestry of modern tech.');
  });

  it('preserves clean text without flagging false positives', () => {
    const cleanText = 'The quick brown fox jumps over the lazy dog. 3.14159 is pi.';
    const report = sanitizeInput(cleanText);

    expect(report.detected).toBe(false);
    expect(report.zeroWidthCount).toBe(0);
    expect(report.homoglyphCount).toBe(0);
    expect(report.normalizedText).toBe(cleanText);
  });
});
