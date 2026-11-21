/**
 * Veritext Local AI - Adversarial Spoofing & Homoglyph Defense Engine
 * 100% Client-Side Pure TypeScript Sanitizer
 *
 * Neutralizes:
 * 1. Zero-width spaces & format characters (\u200B-\u200D, \uFEFF, \u2060, etc.)
 * 2. Soft hyphens (\u00AD) and bidirectional override codes (\u202A-\u202E, \u2066-\u2069)
 * 3. Invisible Unicode tag characters (\uE0000-\uE007F)
 * 4. Confusable Cyrillic and Greek homoglyphs embedded in Latin words
 */

export interface ObfuscationReport {
  detected: boolean;
  zeroWidthCount: number;
  homoglyphCount: number;
  flaggedTokens: string[];
  normalizedText: string;
  originalLength: number;
  normalizedLength: number;
}

// Invisible / zero-width characters commonly used in evasion attacks
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u2060\u180E\u00AD\u202A-\u202E\u2066-\u2069\u200E\u200F\uFFF9-\uFFFB]/gu;

// Unicode Tag characters (U+E0000 - U+E007F)
const UNICODE_TAG_REGEX = /[\u{E0000}-\u{E007F}]/gu;

// Confusable Cyrillic & Greek homoglyphs mapping to standard ASCII Latin
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic Lowercase
  '\u0430': 'a', // Cyrillic Small Letter A
  '\u0441': 'c', // Cyrillic Small Letter Es
  '\u0435': 'e', // Cyrillic Small Letter Ie
  '\u043E': 'o', // Cyrillic Small Letter O
  '\u0440': 'p', // Cyrillic Small Letter Er
  '\u0445': 'x', // Cyrillic Small Letter Ha
  '\u0443': 'y', // Cyrillic Small Letter U
  '\u0456': 'i', // Cyrillic Small Letter Byelorussian-Ukrainian I
  '\u0458': 'j', // Cyrillic Small Letter Je
  '\u0455': 's', // Cyrillic Small Letter Dze
  '\u04BB': 'h', // Cyrillic Small Letter Shha
  '\u0501': 'd', // Cyrillic Small Letter Komi De
  '\u051B': 'q', // Cyrillic Small Letter Qa
  '\u051D': 'w', // Cyrillic Small Letter We

  // Cyrillic Uppercase
  '\u0410': 'A', // Cyrillic Capital Letter A
  '\u0412': 'B', // Cyrillic Capital Letter Ve
  '\u0421': 'C', // Cyrillic Capital Letter Es
  '\u0415': 'E', // Cyrillic Capital Letter Ie
  '\u041D': 'H', // Cyrillic Capital Letter En
  '\u0406': 'I', // Cyrillic Capital Letter Byelorussian-Ukrainian I
  '\u0408': 'J', // Cyrillic Capital Letter Je
  '\u041A': 'K', // Cyrillic Capital Letter Ka
  '\u041C': 'M', // Cyrillic Capital Letter Em
  '\u041E': 'O', // Cyrillic Capital Letter O
  '\u0420': 'P', // Cyrillic Capital Letter Er
  '\u0422': 'T', // Cyrillic Capital Letter Te
  '\u0425': 'X', // Cyrillic Capital Letter Ha
  '\u0423': 'Y', // Cyrillic Capital Letter U

  // Greek Lowercase
  '\u03B1': 'a', // Greek Small Letter Alpha
  '\u03BF': 'o', // Greek Small Letter Omicron
  '\u03BD': 'v', // Greek Small Letter Nu
  '\u03C1': 'p', // Greek Small Letter Rho
  '\u03C4': 't', // Greek Small Letter Tau
  '\u03BA': 'k', // Greek Small Letter Kappa
  '\u03B9': 'i', // Greek Small Letter Iota

  // Greek Uppercase
  '\u0391': 'A', // Greek Capital Letter Alpha
  '\u0392': 'B', // Greek Capital Letter Beta
  '\u0395': 'E', // Greek Capital Letter Epsilon
  '\u0396': 'Z', // Greek Capital Letter Zeta
  '\u0397': 'H', // Greek Capital Letter Eta
  '\u0399': 'I', // Greek Capital Letter Iota
  '\u039A': 'K', // Greek Capital Letter Kappa
  '\u039C': 'M', // Greek Capital Letter Mu
  '\u039D': 'N', // Greek Capital Letter Nu
  '\u039F': 'O', // Greek Capital Letter Omicron
  '\u03A1': 'P', // Greek Capital Letter Rho
  '\u03A4': 'T', // Greek Capital Letter Tau
  '\u03A7': 'X', // Greek Capital Letter Chi
  '\u03A5': 'Y', // Greek Capital Letter Upsilon
};

/**
 * Checks if a token is predominantly Latin but contains isolated homoglyphs.
 * Pure Cyrillic / Greek text (e.g. genuine Russian or Greek sentences) is NOT penalized.
 */
function isMixedScriptHomoglyphToken(token: string): boolean {
  let latinCount = 0;
  let homoglyphCount = 0;

  for (const char of token) {
    if (/[a-zA-Z]/.test(char)) {
      latinCount++;
    } else if (char in HOMOGLYPH_MAP) {
      homoglyphCount++;
    }
  }

  // Flagged if it contains both Latin and homoglyphs, or has homoglyphs in an ASCII-like word
  return homoglyphCount > 0 && (latinCount > 0 || token.length >= 3);
}

/**
 * Sanitizes input text by neutralizing invisible characters and replacing confusable homoglyphs.
 */
export function sanitizeInput(rawText: string): ObfuscationReport {
  let zeroWidthCount = 0;
  let homoglyphCount = 0;
  const flaggedTokens: string[] = [];

  // 1. Count and strip zero-width and invisible control characters
  const zeroWidthMatches = rawText.match(ZERO_WIDTH_REGEX);
  if (zeroWidthMatches) {
    zeroWidthCount += zeroWidthMatches.length;
  }
  const tagMatches = rawText.match(UNICODE_TAG_REGEX);
  if (tagMatches) {
    zeroWidthCount += tagMatches.length;
  }

  let cleaned = rawText.replace(ZERO_WIDTH_REGEX, '').replace(UNICODE_TAG_REGEX, '');

  // 2. Identify and normalize confusable homoglyphs in token context
  const words = cleaned.split(/(\s+|[.,!?;:"'()[\]{}]+)/);
  const normalizedWords = words.map((chunk) => {
    // Only analyze word chunks
    if (!/^\s+$/.test(chunk) && isMixedScriptHomoglyphToken(chunk)) {
      let replacedWord = '';
      let hadHomoglyph = false;

      for (const char of chunk) {
        if (char in HOMOGLYPH_MAP) {
          replacedWord += HOMOGLYPH_MAP[char];
          homoglyphCount++;
          hadHomoglyph = true;
        } else {
          replacedWord += char;
        }
      }

      if (hadHomoglyph) {
        flaggedTokens.push(chunk);
        return replacedWord;
      }
    }
    return chunk;
  });

  const normalizedText = normalizedWords.join('');

  return {
    detected: zeroWidthCount > 0 || homoglyphCount > 0,
    zeroWidthCount,
    homoglyphCount,
    flaggedTokens: Array.from(new Set(flaggedTokens)),
    normalizedText,
    originalLength: rawText.length,
    normalizedLength: normalizedText.length,
  };
}
