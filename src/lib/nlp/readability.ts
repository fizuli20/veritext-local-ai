export interface ReadabilityMetrics {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  totalWords: number;
  totalSentences: number;
  totalSyllables: number;
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
}

/**
 * Counts syllables in an English word using standard heuristic rules.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().trim().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;

  // Handle common prefixes and suffixes
  let cleaned = w
    .replace(/(?:[^laeiouy]|ed|es|e)$/, '')
    .replace(/^y/, '');

  if (cleaned.length === 0) return 1;

  const matches = cleaned.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(1, matches.length) : 1;
}

/**
 * Computes Flesch Reading Ease and Flesch-Kincaid Grade Level.
 */
export function calculateReadability(
  totalWords: number,
  totalSentences: number,
  totalSyllables: number
): ReadabilityMetrics {
  if (totalWords === 0 || totalSentences === 0) {
    return {
      fleschReadingEase: 100,
      fleschKincaidGrade: 0,
      totalWords: 0,
      totalSentences: 0,
      totalSyllables: 0,
      avgSentenceLength: 0,
      avgSyllablesPerWord: 0,
    };
  }

  const avgSentenceLength = totalWords / totalSentences;
  const avgSyllablesPerWord = totalSyllables / totalWords;

  // Flesch Reading Ease: 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
  const fleschReadingEase = Math.max(
    0,
    Math.min(
      100,
      Math.round((206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord) * 10) / 10
    )
  );

  // Flesch-Kincaid Grade: 0.39 * (total words / total sentences) + 11.8 * (total syllables / total words) - 15.59
  const fleschKincaidGrade = Math.max(
    0,
    Math.round((0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59) * 10) / 10
  );

  return {
    fleschReadingEase,
    fleschKincaidGrade,
    totalWords,
    totalSentences,
    totalSyllables,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
  };
}
