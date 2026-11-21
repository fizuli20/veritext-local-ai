import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../src/lib/nlp/language';
import { analyzeStylometrics } from '../src/lib/nlp/stylometrics';

describe('Language Detector & Multilingual Guard (V3 Apex)', () => {
  it('correctly detects English text', () => {
    const text = 'The quick brown fox jumps over the lazy dog and provides an overview of the landscape.';
    const lang = detectLanguage(text);
    expect(lang.code).toBe('en');
    expect(lang.englishOptimized).toBe(true);
  });

  it('correctly detects Spanish text', () => {
    const text = 'El rápido zorro marrón salta sobre el perro perezoso en la colina para encontrar comida.';
    const lang = detectLanguage(text);
    expect(lang.code).toBe('es');
    expect(lang.englishOptimized).toBe(false);
  });

  it('correctly detects French text', () => {
    const text = 'Les étudiants travaillent dans la bibliothèque pour préparer les examens de fin d’année.';
    const lang = detectLanguage(text);
    expect(lang.code).toBe('fr');
    expect(lang.englishOptimized).toBe(false);
  });

  it('correctly detects German text', () => {
    const text = 'Die wissenschaftliche Untersuchung zeigt eine deutliche Steigerung der Effizienz im System.';
    const lang = detectLanguage(text);
    expect(lang.code).toBe('de');
    expect(lang.englishOptimized).toBe(false);
  });

  it('correctly detects Turkish text', () => {
    const text = 'Bu araştırma, büyük dil modellerinin eğitim süreçleri ve performans parametreleri için yeni yöntemler sunmaktadır.';
    const lang = detectLanguage(text);
    expect(lang.code).toBe('tr');
    expect(lang.englishOptimized).toBe(false);
  });

  it('correctly detects Azerbaijani text with unique letter ə', () => {
    const text = 'Süni intellekt sistemlərinin inkişafı və təhsil prosesində tətbiqi üçün yeni metodlar təqdim edilir.';
    const lang = detectLanguage(text);
    expect(lang.code).toBe('az');
    expect(lang.englishOptimized).toBe(false);
  });

  it('correctly detects Russian / Cyrillic text', () => {
    const text = 'Современные алгоритмы машинного обучения демонстрируют высокую точность при анализе данных.';
    const lang = detectLanguage(text);
    expect(lang.code).toBe('ru');
    expect(lang.englishOptimized).toBe(false);
  });

  it('safely disables English cliché penalties on non-English text', () => {
    // A Turkish sentence that happens to contain common English substrings
    const turkishText = 'Bu sistem verimlilik ve hız açısından incelendiğinde önemli sonuçlar ortaya koymaktadır.';
    const res = analyzeStylometrics(turkishText);
    expect(res.language.englishOptimized).toBe(false);
    expect(res.signals.clicheLexicon).toBe(0.0);
  });
});
