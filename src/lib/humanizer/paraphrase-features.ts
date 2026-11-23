// Features shared by the PAWS-Wiki training script and the browser.
export function paraphraseFeatures(source: string, target: string): number[] {
  const tokenize = (text: string) =>
    text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [];
  const left = tokenize(source);
  const right = tokenize(target);
  const longest = Math.max(left.length, right.length, 1);
  const shortest = Math.max(Math.min(left.length, right.length), 1);

  function overlap(first: string[], second: string[]) {
    const counts = new Map<string, number>();
    for (const item of first) counts.set(item, (counts.get(item) ?? 0) + 1);
    let shared = 0;
    for (const item of second) {
      const count = counts.get(item) ?? 0;
      if (!count) continue;
      shared++;
      counts.set(item, count - 1);
    }
    return shared;
  }

  function ngrams(words: string[], size: number) {
    return words
      .slice(size - 1)
      .map((_, i) => words.slice(i, i + size).join(" "));
  }

  const order = new Array<number>(right.length + 1).fill(0);
  for (const word of left) {
    let diagonal = 0;
    for (let i = 1; i <= right.length; i++) {
      const previous = order[i]!;
      order[i] =
        word === right[i - 1]
          ? diagonal + 1
          : Math.max(previous, order[i - 1]!);
      diagonal = previous;
    }
  }

  const wordOverlap = overlap(left, right);
  const content = left.filter((word) => word.length >= 4);
  const targetContent = right.filter((word) => word.length >= 4);
  const edges = Math.min(3, shortest);
  const negation = new Set([
    "no",
    "not",
    "never",
    "none",
    "neither",
    "without",
    "cannot",
  ]);
  return [
    shortest / longest,
    wordOverlap / longest,
    wordOverlap / shortest,
    overlap(ngrams(left, 2), ngrams(right, 2)) / Math.max(1, longest - 1),
    overlap(ngrams(left, 3), ngrams(right, 3)) / Math.max(1, longest - 2),
    order[right.length]! / longest,
    order[right.length]! / Math.max(1, wordOverlap),
    overlap(content, targetContent) /
      Math.max(1, content.length, targetContent.length),
    overlap(left.slice(0, edges), right.slice(0, edges)) / edges,
    overlap(left.slice(-edges), right.slice(-edges)) / edges,
    Math.abs(
      left.filter((word) => negation.has(word)).length -
        right.filter((word) => negation.has(word)).length,
    ),
    longest,
  ];
}
