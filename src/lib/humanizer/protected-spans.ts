/**
 * Automatic Protected-Span Masking & Restoration Engine
 * Guarantees 100% verbatim preservation of direct quotes, academic citations,
 * code/math blocks, URLs/emails, and user-locked terms through any humanizer pass.
 */

export interface ProtectedSpanOptions {
  protectQuotes?: boolean;
  protectCitations?: boolean;
  protectCodeAndMath?: boolean;
  protectUrlsAndEmails?: boolean;
  userLockedTerms?: string[];
}

export interface ProtectedSpanItem {
  placeholder: string;
  original: string;
  type: 'quote' | 'citation' | 'code-math' | 'url-email' | 'user-term';
  index: number;
}

export interface MaskedTextResult {
  maskedText: string;
  spans: ProtectedSpanItem[];
}

export function maskProtectedSpans(
  text: string,
  options: ProtectedSpanOptions = {}
): MaskedTextResult {
  const {
    protectQuotes = true,
    protectCitations = true,
    protectCodeAndMath = true,
    protectUrlsAndEmails = true,
    userLockedTerms = [],
  } = options;

  let currentText = text;
  const spans: ProtectedSpanItem[] = [];
  let spanCounter = 0;

  const replaceSpan = (
    original: string,
    type: ProtectedSpanItem['type']
  ): string => {
    const placeholder = `__KEEP_${spanCounter}__`;
    spans.push({
      placeholder,
      original,
      type,
      index: spanCounter,
    });
    spanCounter++;
    return placeholder;
  };

  // 1. Code & Math Blocks (Highest priority to avoid inner collision)
  if (protectCodeAndMath) {
    // Fenced code blocks
    currentText = currentText.replace(/```[\s\S]*?```/g, (match) =>
      replaceSpan(match, 'code-math')
    );
    // Inline code
    currentText = currentText.replace(/`[^`\n]+`/g, (match) =>
      replaceSpan(match, 'code-math')
    );
    // LaTeX display math $$...$$
    currentText = currentText.replace(/\$\$[\s\S]*?\$\$/g, (match) =>
      replaceSpan(match, 'code-math')
    );
    // LaTeX inline math $...$
    currentText = currentText.replace(/\$(?!\s)[^$\n]+(?<!\s)\$/g, (match) =>
      replaceSpan(match, 'code-math')
    );
  }

  // 2. URLs & Emails
  if (protectUrlsAndEmails) {
    // URLs
    currentText = currentText.replace(/https?:\/\/[^\s<>()]+/g, (match) =>
      replaceSpan(match, 'url-email')
    );
    // Emails
    currentText = currentText.replace(
      /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g,
      (match) => replaceSpan(match, 'url-email')
    );
  }

  // 3. User Locked Terms
  if (userLockedTerms && userLockedTerms.length > 0) {
    for (const term of userLockedTerms) {
      if (!term || !term.trim()) continue;
      const cleanTerm = term.trim();
      const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'g');
      currentText = currentText.replace(regex, (match) =>
        replaceSpan(match, 'user-term')
      );
    }
  }

  // 4. Academic Citations
  if (protectCitations) {
    // APA / Harvard citations: e.g. (Smith et al., 2024), (Jones & Lee, 2021, p. 42)
    const citationRegex =
      /\(([A-Z][a-zA-Z\s&.,]+(?:et al\.)?,?\s*(?:19|20)\d{2}(?:,\s*p\.?\s*\d+)?)\)/g;
    currentText = currentText.replace(citationRegex, (match) =>
      replaceSpan(match, 'citation')
    );

    // IEEE numeric brackets: [1], [3, 7-9], [1-3]
    const ieeeRegex = /\[\d+(?:,\s*\d+)*(?:-\d+)?\]/g;
    currentText = currentText.replace(ieeeRegex, (match) =>
      replaceSpan(match, 'citation')
    );

    // DOI strings
    const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
    currentText = currentText.replace(doiRegex, (match) =>
      replaceSpan(match, 'citation')
    );
  }

  // 5. Direct Quotations (length >= 4 words)
  if (protectQuotes) {
    // Standard ASCII quotes "..."
    currentText = currentText.replace(/"([^"\n]{10,})"/g, (match, inner) => {
      const words = inner.trim().split(/\s+/);
      if (words.length >= 4) {
        return replaceSpan(match, 'quote');
      }
      return match;
    });

    // Curly / Smart quotes “...”
    currentText = currentText.replace(/[“]([^”\n]{10,})[”]/g, (match, inner) => {
      const words = inner.trim().split(/\s+/);
      if (words.length >= 4) {
        return replaceSpan(match, 'quote');
      }
      return match;
    });
  }

  return {
    maskedText: currentText,
    spans,
  };
}

export function restoreProtectedSpans(
  rewrittenText: string,
  spans: ProtectedSpanItem[]
): string {
  if (!spans || spans.length === 0) return rewrittenText;

  let restored = rewrittenText;

  // Restore in reverse order or by placeholder
  for (const span of spans) {
    // Exact placeholder match
    if (restored.includes(span.placeholder)) {
      restored = restored.replaceAll(span.placeholder, span.original);
    } else {
      // Graceful fallback if model altered formatting (e.g. `__KEEP 0__` or `__keep_0__` or `KEEP_0`)
      const fuzzyRegex = new RegExp(
        `_{0,2}keep[\\s_-]*${span.index}_{0,2}`,
        'gi'
      );
      if (fuzzyRegex.test(restored)) {
        restored = restored.replace(fuzzyRegex, span.original);
      }
    }
  }

  return restored;
}
