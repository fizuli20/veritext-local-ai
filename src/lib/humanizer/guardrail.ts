import { countWords } from '../nlp/tokenizer';

export interface GuardrailResult {
  passed: boolean;
  violations: string[];
  missingEntities: string[];
  missingPreservedTerms: string[];
  lengthRatio: number;
}

/**
 * Extracts numbers, dates, years, and percentages from text.
 */
export function extractFactualEntities(text: string): Set<string> {
  const entities = new Set<string>();

  // Extract percentages (e.g., 4.2%, 14.5%, 35%)
  const percentages = text.match(/\b\d+(?:\.\d+)?%/g) || [];
  percentages.forEach((p) => entities.add(p));

  // Extract currency figures (e.g., $185,000, $42,500)
  const currency = text.match(/\$\d{1,3}(?:,\d{3})*(?:\.\d+)?/g) || [];
  currency.forEach((c) => entities.add(c));

  // Extract standalone numbers and years (not part of percentages)
  const numbers = text.match(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?(?!\s*%)\b/g) || [];
  numbers.forEach((n) => {
    if (n.length >= 2 || /\d/.test(n)) {
      // Don't add if already part of a percentage (e.g. "4.2" when "4.2%" exists)
      if (!entities.has(`${n}%`)) {
        entities.add(n);
      }
    }
  });

  return entities;
}

/**
 * Validates rewritten text against original text to guarantee factual preservation.
 */
export function validateGuardrails(
  originalText: string,
  rewrittenText: string,
  options: {
    mode?: string;
    preserveTerms?: string[];
    maxAllowedLengthCollapse?: number; // e.g. 0.35 (35% loss)
  } = {}
): GuardrailResult {
  const { mode = 'standard', preserveTerms = [], maxAllowedLengthCollapse = 0.35 } = options;

  const originalEntities = extractFactualEntities(originalText);
  const rewrittenLower = rewrittenText.toLowerCase();

  const missingEntities: string[] = [];
  const missingPreservedTerms: string[] = [];
  const violations: string[] = [];

  // Check factual entities
  for (const entity of originalEntities) {
    if (!rewrittenText.includes(entity)) {
      missingEntities.push(entity);
      violations.push(`Factual entity "${entity}" was omitted or altered in the rewrite.`);
    }
  }

  // Check locked terms
  for (const term of preserveTerms) {
    if (term.trim().length > 0 && !rewrittenLower.includes(term.toLowerCase())) {
      missingPreservedTerms.push(term);
      violations.push(`Locked term "${term}" was missing from the rewrite.`);
    }
  }

  // Check length ratio
  const origWords = countWords(originalText);
  const rewWords = countWords(rewrittenText);
  const lengthRatio = origWords > 0 ? rewWords / origWords : 1.0;

  if (mode !== 'concise' && lengthRatio < 1 - maxAllowedLengthCollapse) {
    violations.push(
      `Text collapsed by ${Math.round((1 - lengthRatio) * 100)}% (exceeded ${maxAllowedLengthCollapse * 100}% threshold).`
    );
  }

  return {
    passed: violations.length === 0,
    violations,
    missingEntities,
    missingPreservedTerms,
    lengthRatio: Math.round(lengthRatio * 100) / 100,
  };
}
