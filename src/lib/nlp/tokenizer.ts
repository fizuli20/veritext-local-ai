export interface SentenceToken {
  index: number;
  text: string;
  start: number;
  end: number;
  wordCount: number;
  paragraphIndex: number;
}

export interface WordToken {
  text: string;
  start: number;
  end: number;
}

const COMMON_ABBREVIATIONS = new Set([
  'dr', 'mr', 'mrs', 'ms', 'prof', 'sr', 'jr',
  'u.s', 'u.k', 'e.g', 'i.e', 'etc', 'vs', 'fig', 'al', 'inc', 'ltd', 'corp', 'co',
  'a.m', 'p.m', 'am', 'pm', 'd.c', 'st', 'mt',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'dept', 'univ', 'approx', 'est', 'min', 'sec', 'hr', 'no', 'vol', 'pp', 'ed'
]);

/**
 * Tokenizes raw text into offset-exact sentences.
 * Invariant: rawText.slice(s.start, s.end) === s.text
 */
export function tokenizeSentences(rawText: string): SentenceToken[] {
  if (!rawText || rawText.trim().length === 0) {
    return [];
  }

  const sentences: SentenceToken[] = [];
  const len = rawText.length;
  let currentStart = -1;
  let paragraphIndex = 0;
  let i = 0;

  // Helper to test if a period at index pos is an abbreviation, decimal, or mid-sentence dot
  const isAbbreviationOrDecimal = (pos: number): boolean => {
    // Check if followed by space and lowercase letter (sentences do not start with lowercase letters)
    let nextPos = pos + 1;
    while (nextPos < len && /\s/.test(rawText.charAt(nextPos))) {
      nextPos++;
    }
    if (nextPos < len && /[a-z]/.test(rawText.charAt(nextPos))) {
      return true;
    }

    // Check if decimal number: e.g. 3.14
    if (pos > 0 && pos < len - 1) {
      const prev = rawText.charAt(pos - 1);
      const next = rawText.charAt(pos + 1);
      if (/\d/.test(prev) && /\d/.test(next)) {
        return true;
      }
    }

    // Check if URL: e.g. zerogpt.com, https://foo.bar
    const windowStart = Math.max(0, pos - 20);
    const windowEnd = Math.min(len, pos + 20);
    const slice = rawText.slice(windowStart, windowEnd);
    if (/https?:\/\/[^\s]+/.test(slice) || /[a-zA-Z0-9-]+\.[a-zA-Z]{2,4}/.test(slice)) {
      if (pos + 1 < len && !/\s/.test(rawText.charAt(pos + 1))) {
        return true;
      }
    }

    // Check abbreviation by inspecting word before period
    let wordStart = pos - 1;
    while (wordStart >= 0 && /[a-zA-Z.]/.test(rawText.charAt(wordStart))) {
      wordStart--;
    }
    const candidate = rawText.slice(wordStart + 1, pos).toLowerCase();
    if (COMMON_ABBREVIATIONS.has(candidate)) {
      return true;
    }

    // Single letter initials: e.g., "J. K. Rowling"
    if (candidate.length === 1 && /[a-z]/i.test(candidate)) {
      return true;
    }

    return false;
  };

  while (i < len) {
    const ch = rawText.charAt(i);

    // Track paragraph breaks (double newline or more)
    if (ch === '\n') {
      if (i + 1 < len && rawText.charAt(i + 1) === '\n') {
        paragraphIndex++;
      }
    }

    // Find sentence start (skip leading whitespace)
    if (currentStart === -1) {
      if (!/\s/.test(ch)) {
        currentStart = i;
      }
      i++;
      continue;
    }

    // Look for sentence terminators: . ! ? or double newline
    const isTerminator = ch === '.' || ch === '!' || ch === '?';
    const isDoubleNewline = ch === '\n' && i + 1 < len && rawText.charAt(i + 1) === '\n';

    if (isTerminator) {
      // Check for ellipsis ...
      if (ch === '.' && i + 1 < len && rawText.charAt(i + 1) === '.') {
        while (i < len && rawText.charAt(i) === '.') {
          i++;
        }
        if (i < len && !/\s|["'’”)]/.test(rawText.charAt(i))) {
          continue;
        }
      } else if (ch === '.' && isAbbreviationOrDecimal(i)) {
        i++;
        continue;
      }

      // Check if followed by closing quote or parenthesis: e.g. "He said." or (1994).
      let endPos = i + 1;
      while (endPos < len && /["'’”»)}\]]/.test(rawText.charAt(endPos))) {
        endPos++;
      }

      // Ensure that this terminator is either at end of text, or followed by whitespace/newline
      if (endPos >= len || /\s/.test(rawText.charAt(endPos))) {
        const sentenceText = rawText.slice(currentStart, endPos);
        const words = tokenizeWords(sentenceText);
        if (words.length > 0) {
          sentences.push({
            index: sentences.length,
            text: sentenceText,
            start: currentStart,
            end: endPos,
            wordCount: words.length,
            paragraphIndex,
          });
        }
        currentStart = -1;
        i = endPos;
        continue;
      }
    } else if (isDoubleNewline) {
      const sentenceText = rawText.slice(currentStart, i);
      const words = tokenizeWords(sentenceText);
      if (words.length > 0) {
        sentences.push({
          index: sentences.length,
          text: sentenceText,
          start: currentStart,
          end: i,
          wordCount: words.length,
          paragraphIndex,
        });
      }
      currentStart = -1;
      i++;
      continue;
    }

    i++;
  }

  // Final sentence flush if text ended without terminator
  if (currentStart !== -1 && currentStart < len) {
    const sentenceText = rawText.slice(currentStart, len);
    const words = tokenizeWords(sentenceText);
    if (words.length > 0) {
      sentences.push({
        index: sentences.length,
        text: sentenceText,
        start: currentStart,
        end: len,
        wordCount: words.length,
        paragraphIndex,
      });
    }
  }

  return sentences;
}

/**
 * Extracts offset-exact words from a segment of text.
 */
export function tokenizeWords(text: string): WordToken[] {
  const words: WordToken[] = [];
  const regex = /\b[a-zA-Z0-9]+(?:'[a-zA-Z]+)?\b/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    words.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return words;
}

/**
 * Returns raw word count of a string.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const matches = text.match(/\b[a-zA-Z0-9]+(?:'[a-zA-Z]+)?\b/g);
  return matches ? matches.length : 0;
}
