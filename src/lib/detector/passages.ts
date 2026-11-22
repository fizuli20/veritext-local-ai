import { detectLanguage } from "../nlp/language";
import { countWords } from "../nlp/tokenizer";

export interface PassageSpan {
  start: number;
  end: number;
  wordCount: number;
  paragraph: number;
}

export interface PassageSignal extends PassageSpan {
  score: number;
}

export const PASSAGE_LIMIT = 6;

/** Keep offsets in the original text for both the highlights and the export. */
export function eligiblePassages(text: string): PassageSpan[] {
  const spans: PassageSpan[] = [];
  const breaks = Array.from(text.matchAll(/\r?\n(?:[^\S\r\n]*\r?\n)+/g));
  if (breaks.length === 0) return spans;
  let start = 0;
  let paragraph = 0;
  function add(end: number) {
    const piece = text.slice(start, end);
    const trimmed = piece.trim();
    if (!trimmed) return;
    paragraph++;
    const wordCount = countWords(trimmed);
    if (wordCount < 80 || !detectLanguage(trimmed).englishOptimized) return;
    const offset = start + piece.length - piece.trimStart().length;
    spans.push({
      start: offset,
      end: offset + trimmed.length,
      wordCount,
      paragraph,
    });
  }
  for (const match of breaks) {
    add(match.index);
    start = match.index + match[0].length;
  }
  add(text.length);
  return spans.length === 1 && spans[0]!.wordCount === countWords(text)
    ? []
    : spans;
}
