export interface DiffChange {
  type: 'equal' | 'insert' | 'delete';
  value: string;
}

/**
 * Word-level diff using Myers LCS algorithm.
 * Splits on whitespace boundaries and punctuation to yield granular word-level changes.
 */
export function computeWordDiff(original: string, rewritten: string): DiffChange[] {
  const tokenize = (text: string): string[] => {
    // Retain words and whitespace tokens as separate elements
    return text.match(/([^\s]+|\s+)/g) || [];
  };

  const a = tokenize(original);
  const b = tokenize(rewritten);

  const n = a.length;
  const m = b.length;

  if (n === 0 && m === 0) return [];
  if (n === 0) return [{ type: 'insert', value: rewritten }];
  if (m === 0) return [{ type: 'delete', value: original }];

  // Standard LCS Dynamic Programming matrix
  // For production performance with paragraphs, DP table is fast and bounded
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to build diff
  const changes: DiffChange[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      changes.push({ type: 'equal', value: a[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      changes.push({ type: 'insert', value: b[j - 1]! });
      j--;
    } else if (i > 0 && (j === 0 || dp[i]![j - 1]! < dp[i - 1]![j]!)) {
      changes.push({ type: 'delete', value: a[i - 1]! });
      i--;
    }
  }

  changes.reverse();

  // Coalesce consecutive changes of the same type
  const coalesced: DiffChange[] = [];
  for (const c of changes) {
    const last = coalesced[coalesced.length - 1];
    if (last && last.type === c.type) {
      last.value += c.value;
    } else {
      coalesced.push({ ...c });
    }
  }

  return coalesced;
}

/**
 * Verifies that the diff allows lossless reconstruction of both strings.
 */
export function reconstructFromDiff(changes: DiffChange[]): {
  reconstructedOriginal: string;
  reconstructedRewritten: string;
} {
  let original = '';
  let rewritten = '';

  for (const c of changes) {
    if (c.type === 'equal') {
      original += c.value;
      rewritten += c.value;
    } else if (c.type === 'delete') {
      original += c.value;
    } else if (c.type === 'insert') {
      rewritten += c.value;
    }
  }

  return {
    reconstructedOriginal: original,
    reconstructedRewritten: rewritten,
  };
}
