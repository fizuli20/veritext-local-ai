import { describe, it, expect } from 'vitest';
import { computeWordDiff, reconstructFromDiff } from '@/lib/nlp/diff';

describe('Myers Word-Level Diff Engine', () => {
  it('losslessly reconstructs both original and rewritten texts from diff changes', () => {
    const original = `In today's fast-paced world, artificial intelligence plays a pivotal role in education.`;
    const rewritten = `Today, machine learning tools are essential in modern classrooms.`;

    const diff = computeWordDiff(original, rewritten);
    expect(diff.length).toBeGreaterThan(0);

    const { reconstructedOriginal, reconstructedRewritten } = reconstructFromDiff(diff);

    expect(reconstructedOriginal).toBe(original);
    expect(reconstructedRewritten).toBe(rewritten);
  });

  it('handles identical strings with single equal hunk', () => {
    const text = 'The rain in Spain stays mainly in the plain.';
    const diff = computeWordDiff(text, text);

    expect(diff.length).toBe(1);
    expect(diff[0]!.type).toBe('equal');
    expect(diff[0]!.value).toBe(text);
  });

  it('handles empty strings cleanly', () => {
    const diff = computeWordDiff('', 'Hello world');
    expect(diff.length).toBe(1);
    expect(diff[0]!.type).toBe('insert');
    expect(diff[0]!.value).toBe('Hello world');
  });

  it('handles multiline paragraph diffs with formatting', () => {
    const original = `Paragraph one here.\n\nParagraph two with details.`;
    const rewritten = `Paragraph one updated.\n\nParagraph two with new details.`;

    const diff = computeWordDiff(original, rewritten);
    const { reconstructedOriginal, reconstructedRewritten } = reconstructFromDiff(diff);

    expect(reconstructedOriginal).toBe(original);
    expect(reconstructedRewritten).toBe(rewritten);
  });
});
