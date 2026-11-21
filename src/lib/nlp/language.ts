/**
 * Fast (<2ms) zero-dependency language detector & multilingual guard
 * Supports: en, es, fr, de, tr, az, ru, ar, zh, ja, other
 */

export type LanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'tr'
  | 'az'
  | 'ru'
  | 'ar'
  | 'zh'
  | 'ja'
  | 'other';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  confidence: number;
  englishOptimized: boolean;
}

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  tr: 'Turkish',
  az: 'Azerbaijani',
  ru: 'Russian',
  ar: 'Arabic',
  zh: 'Chinese',
  ja: 'Japanese',
  other: 'Other / Multilingual',
};

// Signature trigrams for Latin-script languages
const TRIGRAM_PROFILES: Record<
  'en' | 'es' | 'fr' | 'de' | 'tr' | 'az',
  string[]
> = {
  en: ['the', 'and', 'ing', 'ion', 'tio', 'tha', 'ati', 'ent', 'for', 'with', 'thi', 'here', 'whi'],
  es: ['que', 'los', 'del', 'las', 'con', 'por', 'par', 'una', 'ion', 'ado', 'est', 'nte', 'ció'],
  fr: ['les', 'des', 'est', 'que', 'une', 'dan', 'tion', 'qui', 'pou', 'par', 'sur', 'ent', 'men'],
  de: ['der', 'die', 'und', 'den', 'ein', 'sch', 'ich', 'cht', 'ine', 'das', 'ung', 'gen', 'isc'],
  tr: ['bir', 'ile', 'ler', 'lar', 'den', 'dan', 'ini', 'nın', 'nin', 'ara', 'yor', 'eri', 'inde'],
  az: ['və ', 'bax', 'oldu', 'olan', 'nin', 'nın', 'ləri', 'ları', 'həm', 'üçün', 'edir', 'ilə'],
};

export function detectLanguage(text: string): LanguageInfo {
  if (!text || text.trim().length === 0) {
    return {
      code: 'en',
      name: LANGUAGE_NAMES.en,
      confidence: 1.0,
      englishOptimized: true,
    };
  }

  const sample = text.slice(0, 3000);

  // 1. Script-based Fast Checks (Japanese, Chinese, Arabic, Russian/Cyrillic)
  // Japanese has Hiragana or Katakana
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) {
    return {
      code: 'ja',
      name: LANGUAGE_NAMES.ja,
      confidence: 0.95,
      englishOptimized: false,
    };
  }

  // Chinese (Han ideographs without Japanese Kana)
  const cjkMatches = sample.match(/[\u4E00-\u9FFF]/g);
  if (cjkMatches && cjkMatches.length > 5) {
    const ratio = cjkMatches.length / sample.length;
    if (ratio > 0.15) {
      return {
        code: 'zh',
        name: LANGUAGE_NAMES.zh,
        confidence: 0.95,
        englishOptimized: false,
      };
    }
  }

  // Arabic script
  const arabicMatches = sample.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g);
  if (arabicMatches && arabicMatches.length > 5) {
    return {
      code: 'ar',
      name: LANGUAGE_NAMES.ar,
      confidence: 0.95,
      englishOptimized: false,
    };
  }

  // Cyrillic (Russian, etc.)
  const cyrillicMatches = sample.match(/[\u0400-\u04FF]/g);
  if (cyrillicMatches && cyrillicMatches.length > 5) {
    return {
      code: 'ru',
      name: LANGUAGE_NAMES.ru,
      confidence: 0.95,
      englishOptimized: false,
    };
  }

  // 2. Specific Latin Characters Check (Azerbaijani 'ə', 'Ə')
  if (/[əƏ]/.test(sample)) {
    return {
      code: 'az',
      name: LANGUAGE_NAMES.az,
      confidence: 0.95,
      englishOptimized: false,
    };
  }

  // Turkish-specific characters (ı, ğ, ş without ə)
  const trUnique = sample.match(/[ıİğĞşŞ]/g);
  if (trUnique && trUnique.length >= 2) {
    return {
      code: 'tr',
      name: LANGUAGE_NAMES.tr,
      confidence: 0.9,
      englishOptimized: false,
    };
  }

  // German specific (ä, ö, ü, ß)
  const deUnique = sample.match(/[äÄß]/g);
  if (deUnique && deUnique.length >= 2) {
    return {
      code: 'de',
      name: LANGUAGE_NAMES.de,
      confidence: 0.88,
      englishOptimized: false,
    };
  }

  // Spanish specific (ñ, ¿, ¡)
  const esUnique = sample.match(/[ñÑ¿¡]/g);
  if (esUnique && esUnique.length >= 1) {
    return {
      code: 'es',
      name: LANGUAGE_NAMES.es,
      confidence: 0.88,
      englishOptimized: false,
    };
  }

  // 3. Trigram Frequency Scoring for Latin script
  const lower = sample.toLowerCase().replace(/[^a-zçğıöşüéàèùâêîôûëïüñäöß\s]/g, ' ');
  const words = lower.split(/\s+/).filter(Boolean);

  // Common high-frequency words check
  const wordCounts = new Map<string, number>();
  for (const w of words) {
    wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
  }

  const scores: Record<'en' | 'es' | 'fr' | 'de' | 'tr' | 'az', number> = {
    en: 0,
    es: 0,
    fr: 0,
    de: 0,
    tr: 0,
    az: 0,
  };

  // Specific word bonus
  if (wordCounts.has('the')) scores.en += 10;
  if (wordCounts.has('and')) scores.en += 5;
  if (wordCounts.has('of')) scores.en += 4;
  if (wordCounts.has('in')) scores.en += 3;
  if (wordCounts.has('is')) scores.en += 3;

  if (wordCounts.has('de')) {
    scores.es += 2;
    scores.fr += 2;
  }
  if (wordCounts.has('la')) {
    scores.es += 2;
    scores.fr += 2;
  }
  if (wordCounts.has('que')) {
    scores.es += 4;
    scores.fr += 4;
  }
  if (wordCounts.has('el')) scores.es += 5;
  if (wordCounts.has('en') && !wordCounts.has('the')) scores.es += 3;
  if (wordCounts.has('los')) scores.es += 6;
  if (wordCounts.has('por')) scores.es += 5;
  if (wordCounts.has('para')) scores.es += 6;

  if (wordCounts.has('le')) scores.fr += 4;
  if (wordCounts.has('les')) scores.fr += 6;
  if (wordCounts.has('des')) scores.fr += 5;
  if (wordCounts.has('est')) scores.fr += 5;
  if (wordCounts.has('dans')) scores.fr += 6;
  if (wordCounts.has('pour')) scores.fr += 5;

  if (wordCounts.has('der')) scores.de += 6;
  if (wordCounts.has('die')) scores.de += 6;
  if (wordCounts.has('das')) scores.de += 6;
  if (wordCounts.has('und')) scores.de += 6;
  if (wordCounts.has('ist')) scores.de += 4;
  if (wordCounts.has('nicht')) scores.de += 5;

  if (wordCounts.has('ve')) scores.tr += 5;
  if (wordCounts.has('bir')) scores.tr += 5;
  if (wordCounts.has('bu')) {
    scores.tr += 3;
    scores.az += 3;
  }
  if (wordCounts.has('için')) scores.tr += 6;

  if (wordCounts.has('və')) scores.az += 8;
  if (wordCounts.has('üçün')) scores.az += 8;
  if (wordCounts.has('ilə')) scores.az += 6;

  // Extract letter trigrams
  for (let i = 0; i < lower.length - 2; i++) {
    const tri = lower.slice(i, i + 3);
    for (const [lang, triList] of Object.entries(TRIGRAM_PROFILES) as [
      'en' | 'es' | 'fr' | 'de' | 'tr' | 'az',
      string[],
    ][]) {
      if (triList.includes(tri)) {
        scores[lang] += 1;
      }
    }
  }

  // Find max scored language
  let bestLang: LanguageCode = 'en';
  let maxScore = -1;
  let totalScore = 0;

  for (const [lang, sc] of Object.entries(scores) as [
    'en' | 'es' | 'fr' | 'de' | 'tr' | 'az',
    number,
  ][]) {
    totalScore += sc;
    if (sc > maxScore) {
      maxScore = sc;
      bestLang = lang;
    }
  }

  if (totalScore === 0 || maxScore < 3) {
    return {
      code: 'en',
      name: LANGUAGE_NAMES.en,
      confidence: 0.6,
      englishOptimized: true,
    };
  }

  const confidence = Math.min(0.99, Math.max(0.65, maxScore / (totalScore || 1) + 0.4));

  return {
    code: bestLang,
    name: LANGUAGE_NAMES[bestLang],
    confidence: Math.round(confidence * 100) / 100,
    englishOptimized: bestLang === 'en',
  };
}
