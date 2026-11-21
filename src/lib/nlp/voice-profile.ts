/**
 * Veritext Local AI - Personal Voice Cloning ("Match My Style")
 * Extracts quantitative author fingerprints from 150-600 words of authentic writing
 * and converts them into concise WebLLM prompt directives and tournament distance penalties.
 */

import { tokenizeSentences, countWords } from './tokenizer';
import { calculateReadability, countSyllables } from './readability';
import { calculateBidirectionalMTLD } from './stylometrics';

export interface AuthorVoiceFingerprint {
  meanSentenceLength: number;
  sentenceLengthCV: number;
  contractionRate: number; // per 100 words
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  mtld: number;
  avgWordLength: number;
  punctuationProfile: {
    emDashRate: number; // per 100 words
    semicolonRate: number;
    questionMarkRate: number;
  };
}

export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  sampleSnippet: string;
  fingerprint: AuthorVoiceFingerprint;
  createdAt: string;
}

const STORAGE_KEY = 'veritext_voice_profiles_v2';

const CONTRACTION_REGEX = /\b(can't|won't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|it's|that's|what's|there's|who's|i'm|you're|we're|they're|i've|you've|we've|they've|i'll|you'll|he'll|she'll|we'll|they'll|i'd|you'd|he'd|she'd|we'd|they'd|couldn't|wouldn't|shouldn't)\b/gi;

/**
 * Extracts a quantitative Author Style Fingerprint from a sample of user prose.
 */
export function extractVoiceFingerprint(sampleText: string): AuthorVoiceFingerprint {
  const sentences = tokenizeSentences(sampleText);
  const words = sampleText.match(/[a-zA-Z0-9'-]+/g) ?? [];
  const wordCount = Math.max(words.length, 1);
  const sentenceCount = Math.max(sentences.length, 1);

  // 1. Sentence length mean & CV
  const lengths = sentences.map((s) => countWords(s.text));
  const meanLen = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 15;
  const variance =
    lengths.length > 1
      ? lengths.reduce((acc, l) => acc + Math.pow(l - meanLen, 2), 0) / lengths.length
      : 0;
  const stdDev = Math.sqrt(variance);
  const cv = meanLen > 0 ? stdDev / meanLen : 0.35;

  // 2. Contraction rate
  const contractionMatches = sampleText.match(CONTRACTION_REGEX);
  const contractionCount = contractionMatches ? contractionMatches.length : 0;
  const contractionRate = Math.round((contractionCount / wordCount) * 100 * 10) / 10;

  // 3. Syllables & Readability
  let totalSyllables = 0;
  for (const w of words) {
    totalSyllables += countSyllables(w);
  }
  const readability = calculateReadability(wordCount, sentenceCount, totalSyllables);
  const mtld = calculateBidirectionalMTLD(words.map((w) => w.toLowerCase()));

  // 4. Word length
  const totalLetters = words.reduce((acc, w) => acc + w.length, 0);
  const avgWordLen = Math.round((totalLetters / wordCount) * 10) / 10;

  // 5. Punctuation rates per 100 words
  const emDashes = (sampleText.match(/—|--/g) ?? []).length;
  const semicolons = (sampleText.match(/;/g) ?? []).length;
  const questions = (sampleText.match(/\?/g) ?? []).length;

  return {
    meanSentenceLength: Math.round(meanLen * 10) / 10,
    sentenceLengthCV: Math.round(cv * 100) / 100,
    contractionRate,
    fleschKincaidGrade: Math.round(readability.fleschKincaidGrade * 10) / 10,
    fleschReadingEase: Math.round(readability.fleschReadingEase * 10) / 10,
    mtld: Math.round(mtld),
    avgWordLength: avgWordLen,
    punctuationProfile: {
      emDashRate: Math.round((emDashes / wordCount) * 100 * 10) / 10,
      semicolonRate: Math.round((semicolons / wordCount) * 100 * 10) / 10,
      questionMarkRate: Math.round((questions / wordCount) * 100 * 10) / 10,
    },
  };
}

/**
 * Converts a quantitative fingerprint into high-precision, compact LLM prompt instructions.
 */
export function generateVoicePromptDirective(fingerprint: AuthorVoiceFingerprint): string {
  const contractionAdvice =
    fingerprint.contractionRate > 1.2
      ? 'Use frequent natural contractions (don\'t, it\'s, we\'ve).'
      : fingerprint.contractionRate > 0.4
        ? 'Use occasional natural contractions.'
        : 'Avoid contractions, preferring uncontracted formal expressions.';

  const burstinessAdvice =
    fingerprint.sentenceLengthCV > 0.45
      ? 'Create extreme sentence length contrast: pair very short 4-word punchy sentences with longer 22-word explanatory clauses.'
      : 'Maintain steady, balanced sentence rhythms with moderate variation.';

  const lengthAdvice = `Target average sentence length around ${Math.round(fingerprint.meanSentenceLength)} words.`;

  return `[AUTHOR VOICE PROFILE CONSTRAINTS]:
- ${lengthAdvice}
- ${burstinessAdvice}
- ${contractionAdvice}
- Vocabulary level: Flesch-Kincaid Grade ~${Math.round(fingerprint.fleschKincaidGrade)}.
Do NOT introduce AI clichés. Mirror this exact cadence.`;
}

/**
 * Calculates a normalized distance penalty [0, 1] between a candidate rewrite and the target author voice.
 */
export function computeVoiceDistance(candidateText: string, target: AuthorVoiceFingerprint): number {
  const cand = extractVoiceFingerprint(candidateText);

  const lenDiff = Math.abs(cand.meanSentenceLength - target.meanSentenceLength) / Math.max(target.meanSentenceLength, 1);
  const cvDiff = Math.abs(cand.sentenceLengthCV - target.sentenceLengthCV);
  const contrDiff = Math.abs(cand.contractionRate - target.contractionRate) / Math.max(target.contractionRate + 0.5, 1);
  const gradeDiff = Math.abs(cand.fleschKincaidGrade - target.fleschKincaidGrade) / Math.max(target.fleschKincaidGrade, 1);

  // Composite normalized distance [0, 1]
  const distance = lenDiff * 0.35 + cvDiff * 0.30 + contrDiff * 0.20 + gradeDiff * 0.15;
  return Math.max(0, Math.min(1, Math.round(distance * 100) / 100));
}

export function loadStoredVoiceProfiles(): VoiceProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveVoiceProfile(name: string, description: string, sampleText: string): VoiceProfile {
  const fingerprint = extractVoiceFingerprint(sampleText);
  const profile: VoiceProfile = {
    id: `vp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    description,
    sampleSnippet: sampleText.substring(0, 180) + (sampleText.length > 180 ? '...' : ''),
    fingerprint,
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    const existing = loadStoredVoiceProfiles();
    const updated = [profile, ...existing.filter((p) => p.name !== name)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  return profile;
}

export function deleteVoiceProfile(id: string): void {
  if (typeof window === 'undefined') return;
  const existing = loadStoredVoiceProfiles();
  const updated = existing.filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
