import { tokenizeSentences, tokenizeWords, countWords, SentenceToken } from './tokenizer';
import { scanFingerprints } from './fingerprints';
import { calculateReadability, countSyllables, ReadabilityMetrics } from './readability';
import { sanitizeInput, ObfuscationReport } from './sanitizer';
import { DomainProfile, applyDomainCalibration } from './calibration';

export interface SignalBreakdown {
  burstiness: number;         // w = 0.24
  clicheLexicon: number;       // w = 0.24
  syntacticUniformity: number; // w = 0.18
  lexicalDiversity: number;    // w = 0.14
  entropy: number;             // w = 0.12
  paragraphSymmetry: number;   // w = 0.08
}

export interface SentenceAnalysis {
  index: number;
  text: string;
  start: number;
  end: number;
  score: number; // 0-100%
  reasons: string[];
}

export interface StylometricResult {
  aiScore: number;           // 0-100 calibrated
  rawComposite: number;      // 0-1
  isAi: boolean;             // threshold >= 50
  confidence: 'low' | 'medium' | 'high';
  signals: SignalBreakdown;
  sentences: SentenceAnalysis[];
  obfuscationReport: ObfuscationReport;
  domainApplied: DomainProfile;
  metrics: {
    sentenceLengthMean: number;
    sentenceLengthStdDev: number;
    sentenceLengthCV: number;
    mtld: number;
    trigramEntropy: number;
    readability: ReadabilityMetrics;
    clicheCount: number;
    wordCount: number;
    sentenceCount: number;
  };
}

const COMMON_STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me'
]);

/**
 * Calculates Bidirectional Measure of Textual Lexical Diversity (MTLD).
 * Standard evaluation with TTR threshold = 0.72.
 */
export function calculateMTLD(words: string[], targetTTR = 0.72): number {
  if (words.length < 10) return 40;

  const runEvaluation = (tokens: string[]): number => {
    let factors = 0;
    let types = new Set<string>();
    let tokenCount = 0;

    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i]!.toLowerCase();
      types.add(w);
      tokenCount++;

      const ttr = types.size / tokenCount;
      if (ttr <= targetTTR) {
        factors++;
        types.clear();
        tokenCount = 0;
      }
    }

    if (tokenCount > 0) {
      const remainingTTR = types.size / tokenCount;
      const partialFactor = (1 - remainingTTR) / (1 - targetTTR);
      factors += Math.max(0, Math.min(1, partialFactor));
    }

    return factors > 0 ? tokens.length / factors : tokens.length;
  };

  const forward = runEvaluation(words);
  const backward = runEvaluation([...words].reverse());
  return Math.round(((forward + backward) / 2) * 10) / 10;
}

export const calculateBidirectionalMTLD = calculateMTLD;

/**
 * Computes character trigram Shannon entropy.
 */
export function calculateTrigramEntropy(text: string): number {
  const clean = text.toLowerCase().replace(/\s+/g, ' ');
  if (clean.length < 3) return 3.0;

  const counts = new Map<string, number>();
  let total = 0;

  for (let i = 0; i <= clean.length - 3; i++) {
    const trigram = clean.slice(i, i + 3);
    counts.set(trigram, (counts.get(trigram) || 0) + 1);
    total++;
  }

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }

  return Math.round(entropy * 100) / 100;
}

/**
 * Pure TypeScript Stylometric AI Detection Engine.
 */
export function analyzeStylometrics(
  rawInput: string,
  domain: DomainProfile = 'general'
): StylometricResult {
  // 1. Sanitize input for zero-width characters and confusable homoglyphs
  const obfuscationReport = sanitizeInput(rawInput);
  const rawText = obfuscationReport.normalizedText;

  const sentences = tokenizeSentences(rawText);
  const words = tokenizeWords(rawText);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  if (wordCount < 15 || sentenceCount === 0) {
    // Insufficient input for reliable stylometrics
    return {
      aiScore: obfuscationReport.detected ? 75 : 10,
      rawComposite: 0.1,
      isAi: obfuscationReport.detected,
      confidence: 'low',
      signals: {
        burstiness: 0.1,
        clicheLexicon: 0.1,
        syntacticUniformity: 0.1,
        lexicalDiversity: 0.1,
        entropy: 0.1,
        paragraphSymmetry: 0.1,
      },
      sentences: sentences.map((s, idx) => ({
        index: idx,
        text: s.text,
        start: s.start,
        end: s.end,
        score: obfuscationReport.detected ? 75 : 10,
        reasons: [obfuscationReport.detected ? 'Adversarial obfuscation detected' : 'Short text snippet'],
      })),
      obfuscationReport,
      domainApplied: domain,
      metrics: {
        sentenceLengthMean: wordCount,
        sentenceLengthStdDev: 0,
        sentenceLengthCV: 0,
        mtld: 50,
        trigramEntropy: 3.5,
        readability: calculateReadability(wordCount, 1, wordCount),
        clicheCount: 0,
        wordCount,
        sentenceCount,
      },
    };
  }

  // ========================================================
  // Signal 1: Sentence-Length Burstiness (w = 0.24)
  // ========================================================
  const lengths = sentences.map((s) => s.wordCount);
  const sumLengths = lengths.reduce((acc, v) => acc + v, 0);
  const meanLength = sumLengths / sentenceCount;

  const variance =
    lengths.reduce((acc, v) => acc + Math.pow(v - meanLength, 2), 0) /
    sentenceCount;
  const stdDevLength = Math.sqrt(variance);
  const cv = meanLength > 0 ? stdDevLength / meanLength : 0;

  // Adjacent jump ratio: |L_i - L_{i-1}| / (L_i + L_{i-1})
  let adjacentJumps = 0;
  for (let i = 1; i < lengths.length; i++) {
    const prev = lengths[i - 1]!;
    const curr = lengths[i]!;
    adjacentJumps += Math.abs(curr - prev) / (curr + prev);
  }
  const jumpRatio = adjacentJumps / Math.max(1, lengths.length - 1);

  let burstinessAiSignal = 0;
  if (domain === 'esl-fair') {
    // ESL writers naturally write uniform sentence lengths (~10-15 words); do not penalize
    burstinessAiSignal = cv < 0.10 ? 0.35 : cv < 0.22 ? 0.20 : 0.05;
  } else if (domain === 'academic') {
    burstinessAiSignal = cv < 0.16 ? 0.55 : cv < 0.28 ? 0.30 : 0.10;
  } else {
    if (cv < 0.22) {
      burstinessAiSignal = 1.0;
    } else if (cv < 0.35) {
      burstinessAiSignal = 0.85;
    } else if (cv < 0.48) {
      burstinessAiSignal = 0.5;
    } else if (cv < 0.6) {
      burstinessAiSignal = 0.2;
    } else {
      burstinessAiSignal = 0.05;
    }
  }

  if (domain !== 'esl-fair') {
    if (jumpRatio < 0.25) {
      burstinessAiSignal = Math.min(1.0, burstinessAiSignal + 0.15);
    } else if (jumpRatio > 0.45) {
      burstinessAiSignal = Math.max(0.0, burstinessAiSignal - 0.15);
    }
  }

  // ========================================================
  // Signal 2: Cliché & Discourse Markers (w = 0.24)
  // ========================================================
  const fp = scanFingerprints(rawText);
  const normalizedTier1Per100 = (fp.tier1Count / wordCount) * 100;
  const normalizedTier2Per100 = (fp.tier2Count / wordCount) * 100;

  let clicheSignal = 0;
  if (fp.tier1Count >= 3 || normalizedTier1Per100 >= 1.5) {
    clicheSignal = 1.0;
  } else if (fp.tier1Count === 2 || normalizedTier1Per100 >= 0.8) {
    clicheSignal = 0.85;
  } else if (fp.tier1Count === 1) {
    clicheSignal = 0.65;
  } else if (normalizedTier2Per100 >= 2.0) {
    clicheSignal = 0.55;
  } else if (normalizedTier2Per100 >= 1.0) {
    clicheSignal = 0.35;
  } else {
    clicheSignal = 0.05;
  }

  // ========================================================
  // Signal 3: Syntactic Uniformity (w = 0.18)
  // ========================================================
  let syntacticSignal = 0.2;

  // Rule of three
  const ruleOfThreeMatches = rawText.match(/\b\w+,\s+\w+,\s+and\s+\w+\b/gi) || [];
  if (ruleOfThreeMatches.length >= 2) {
    syntacticSignal += 0.35;
  } else if (ruleOfThreeMatches.length === 1) {
    syntacticSignal += 0.15;
  }

  // Repeated consecutive sentence starters
  const starters = sentences
    .map((s) => {
      const match = s.text.trim().match(/^[A-Za-z]+/);
      return match ? match[0].toLowerCase() : '';
    })
    .filter(Boolean);

  let repeatedStarters = 0;
  for (let i = 0; i < starters.length - 1; i++) {
    if (starters[i] === starters[i + 1]) repeatedStarters++;
  }
  if (repeatedStarters >= 2) syntacticSignal += 0.25;

  // Contraction scarcity in informal/general text
  const contractionCount = (rawText.match(/\b\w+['’](t|re|ve|ll|d|s|m)\b/gi) || []).length;
  const contractionRate = (contractionCount / wordCount) * 100;
  if (contractionRate === 0 && wordCount > 100) {
    syntacticSignal += 0.2;
  }

  syntacticSignal = Math.min(1.0, Math.max(0.0, syntacticSignal));

  // ========================================================
  // Signal 4: Lexical Diversity — MTLD (w = 0.14)
  // ========================================================
  const rawWords = words.map((w) => w.text);
  const mtld = calculateMTLD(rawWords);

  let lexicalDiversitySignal = 0.5;
  if (domain === 'academic') {
    lexicalDiversitySignal = mtld > 160 ? 0.45 : 0.20;
  } else if (domain === 'esl-fair') {
    lexicalDiversitySignal = mtld > 140 ? 0.45 : mtld > 90 ? 0.30 : 0.15;
  } else {
    if (mtld > 140) {
      lexicalDiversitySignal = 0.90; // LLM uniform vocabulary rotation
    } else if (mtld > 100) {
      lexicalDiversitySignal = 0.70;
    } else if (mtld > 65) {
      lexicalDiversitySignal = 0.45;
    } else {
      lexicalDiversitySignal = 0.15; // Natural human repetition
    }
  }

  // ========================================================
  // Signal 5: N-Gram Entropy & Stopword Uniformity (w = 0.12)
  // ========================================================
  const trigramEntropy = calculateTrigramEntropy(rawText);

  let stopwordDeviations = 0;
  for (const s of sentences) {
    const sWords = tokenizeWords(s.text);
    if (sWords.length === 0) continue;
    const stopCount = sWords.filter((w) => COMMON_STOPWORDS.has(w.text.toLowerCase())).length;
    const ratio = stopCount / sWords.length;
    stopwordDeviations += Math.abs(ratio - 0.44);
  }
  const avgStopwordDev = stopwordDeviations / Math.max(1, sentences.length);

  let entropySignal = 0.5;
  if (avgStopwordDev < 0.08) {
    entropySignal += 0.3;
  } else if (avgStopwordDev > 0.16) {
    entropySignal -= 0.3;
  }

  if (trigramEntropy >= 4.1 && trigramEntropy <= 4.45) {
    entropySignal += 0.2;
  }
  entropySignal = Math.min(1.0, Math.max(0.05, entropySignal));

  // ========================================================
  // Signal 6: Paragraph Symmetry (w = 0.08)
  // ========================================================
  const paragraphs = rawText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  let paraSymmetrySignal = 0.3;
  if (paragraphs.length >= 2) {
    const paraLengths = paragraphs.map((p) => countWords(p));
    const avgParaLength = paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length;
    const paraVariance =
      paraLengths.reduce((a, b) => a + Math.pow(b - avgParaLength, 2), 0) /
      paraLengths.length;
    const paraCV = avgParaLength > 0 ? Math.sqrt(paraVariance) / avgParaLength : 0;

    if (paraCV < 0.2) {
      paraSymmetrySignal = 0.8;
    } else if (paraCV > 0.5) {
      paraSymmetrySignal = 0.15;
    }
  }

  // ========================================================
  // Composite Weighted Aggregation & Sigmoid Calibration
  // ========================================================
  const weights = {
    burstiness: 0.24,
    clicheLexicon: 0.24,
    syntacticUniformity: 0.18,
    lexicalDiversity: 0.14,
    entropy: 0.12,
    paragraphSymmetry: 0.08,
  };

  const rawComposite =
    burstinessAiSignal * weights.burstiness +
    clicheSignal * weights.clicheLexicon +
    syntacticSignal * weights.syntacticUniformity +
    lexicalDiversitySignal * weights.lexicalDiversity +
    entropySignal * weights.entropy +
    paraSymmetrySignal * weights.paragraphSymmetry;

  const sigmoid = (x: number, x0 = 0.42, k = 10.5): number => {
    return 1 / (1 + Math.exp(-k * (x - x0)));
  };

  let calibratedScore = Math.max(2, Math.min(99, Math.round(sigmoid(rawComposite) * 100)));

  // If adversarial evasion was detected, elevate the score
  if (obfuscationReport.detected) {
    calibratedScore = Math.max(calibratedScore, 75);
  }

  // Apply Domain Calibration (ESL-fair, Academic, Technical, Creative)
  calibratedScore = applyDomainCalibration(calibratedScore, domain, {
    burstiness: burstinessAiSignal,
    clicheLexicon: clicheSignal,
    syntacticUniformity: syntacticSignal,
    lexicalDiversity: lexicalDiversitySignal,
  });

  // ========================================================
  // Sentence-Level Scoring & Context Smoothing
  // ========================================================
  const docPrior = calibratedScore;
  const sentenceAnalyses: SentenceAnalysis[] = sentences.map((s) => {
    const sFp = scanFingerprints(s.text);
    const reasons: string[] = [];

    let sentenceRawScore = 30;

    if (sFp.tier1Count > 0) {
      sentenceRawScore += sFp.tier1Count * 35;
      reasons.push(`Contains AI cliché: "${sFp.matches.filter(m => m.tier === 1).map(m => m.phrase).join(', ')}"`);
    }

    if (sFp.tier2Count > 0) {
      const mult = domain === 'esl-fair' ? 8 : domain === 'academic' ? 10 : 20;
      sentenceRawScore += sFp.tier2Count * mult;
      reasons.push(`Formulaic transition or hedging: "${sFp.matches.filter(m => m.tier === 2).map(m => m.phrase).join(', ')}"`);
    }

    if (s.wordCount >= 18 && s.wordCount <= 26 && cv < 0.35) {
      sentenceRawScore += 15;
      reasons.push('Uniform cadence (18-26 words) matching LLM rhythm');
    }

    if (s.wordCount <= 8 && sFp.matches.length === 0) {
      sentenceRawScore = Math.max(5, sentenceRawScore - 25);
    }

    if (/\b\w+,\s+\w+,\s+and\s+\w+\b/i.test(s.text)) {
      sentenceRawScore += 12;
      reasons.push('Rule-of-three enumeration');
    }

    const smoothedScore = Math.round(
      0.75 * Math.min(100, Math.max(0, sentenceRawScore)) + 0.25 * docPrior
    );

    return {
      index: s.index,
      text: s.text,
      start: s.start,
      end: s.end,
      score: Math.max(2, Math.min(99, smoothedScore)),
      reasons: reasons.length > 0 ? reasons : ['Stylometric cadence aligned with document average'],
    };
  });

  let totalSyllables = 0;
  for (const w of words) {
    totalSyllables += countSyllables(w.text);
  }
  const readability = calculateReadability(wordCount, sentenceCount, totalSyllables);

  let confidence: 'low' | 'medium' | 'high' = 'high';
  if (wordCount < 40) confidence = 'low';
  else if (wordCount < 90) confidence = 'medium';

  return {
    aiScore: calibratedScore,
    rawComposite: Math.round(rawComposite * 1000) / 1000,
    isAi: calibratedScore >= 50,
    confidence,
    signals: {
      burstiness: Math.round(burstinessAiSignal * 100) / 100,
      clicheLexicon: Math.round(clicheSignal * 100) / 100,
      syntacticUniformity: Math.round(syntacticSignal * 100) / 100,
      lexicalDiversity: Math.round(lexicalDiversitySignal * 100) / 100,
      entropy: Math.round(entropySignal * 100) / 100,
      paragraphSymmetry: Math.round(paraSymmetrySignal * 100) / 100,
    },
    sentences: sentenceAnalyses,
    obfuscationReport,
    domainApplied: domain,
    metrics: {
      sentenceLengthMean: Math.round(meanLength * 10) / 10,
      sentenceLengthStdDev: Math.round(stdDevLength * 10) / 10,
      sentenceLengthCV: Math.round(cv * 100) / 100,
      mtld,
      trigramEntropy,
      readability,
      clicheCount: fp.matches.length,
      wordCount,
      sentenceCount,
    },
  };
}
