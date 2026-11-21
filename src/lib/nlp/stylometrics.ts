import { tokenizeSentences, tokenizeWords, countWords, SentenceToken } from './tokenizer';
import { scanFingerprints } from './fingerprints';
import { calculateReadability, countSyllables, ReadabilityMetrics } from './readability';

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
export function analyzeStylometrics(rawText: string): StylometricResult {
  const sentences = tokenizeSentences(rawText);
  const words = tokenizeWords(rawText);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  if (wordCount < 15 || sentenceCount === 0) {
    // Insufficient input for reliable stylometrics
    return {
      aiScore: 10,
      rawComposite: 0.1,
      isAi: false,
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
        score: 10,
        reasons: ['Short text snippet'],
      })),
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
    adjacentJumps += Math.abs(curr - prev) / (curr + prev + 1);
  }
  const avgJump = sentenceCount > 1 ? adjacentJumps / (sentenceCount - 1) : 0.3;

  // Human prose: high CV (> 0.55), high jump (> 0.35)
  // LLM prose: uniform CV (< 0.35), low jump (< 0.22)
  let burstinessAiSignal = 0;
  if (cv < 0.25) {
    burstinessAiSignal = 0.95;
  } else if (cv < 0.38) {
    burstinessAiSignal = 0.75 - (cv - 0.25) * 1.5;
  } else if (cv < 0.55) {
    burstinessAiSignal = 0.55 - (cv - 0.38) * 1.8;
  } else {
    burstinessAiSignal = Math.max(0.05, 0.25 - (cv - 0.55) * 0.7);
  }

  // Adjust for jump ratio
  if (avgJump < 0.2) burstinessAiSignal = Math.min(1.0, burstinessAiSignal + 0.15);
  if (avgJump > 0.45) burstinessAiSignal = Math.max(0.02, burstinessAiSignal - 0.15);

  // ========================================================
  // Signal 2: Weighted LLM Cliché & Discourse Lexicon (w = 0.24)
  // ========================================================
  const fp = scanFingerprints(rawText);
  const weightedDensityPer100 = (fp.weightedScore / Math.max(1, wordCount)) * 100;

  // If density is high (> 2.0 weighted hits per 100 words), high AI probability
  let clicheSignal = Math.min(1.0, weightedDensityPer100 / 2.2);
  if (fp.tier1Count >= 2) {
    clicheSignal = Math.min(1.0, clicheSignal + 0.25);
  }

  // ========================================================
  // Signal 3: Syntactic Uniformity (w = 0.18)
  // ========================================================
  // Rule-of-three: "A, B, and C"
  const ruleOfThreeMatches = rawText.match(/\b\w+,\s+\w+,\s+and\s+\w+\b/gi) || [];
  const ruleOfThreeRate = (ruleOfThreeMatches.length / sentenceCount) * 10;

  // Repeated consecutive starters
  let repeatedStarters = 0;
  for (let i = 1; i < sentences.length; i++) {
    const prevStart = sentences[i - 1]!.text.trim().slice(0, 10).toLowerCase();
    const currStart = sentences[i]!.text.trim().slice(0, 10).toLowerCase();
    if (prevStart === currStart || (prevStart.startsWith('in ') && currStart.startsWith('in '))) {
      repeatedStarters++;
    }
  }
  const starterRepetitionRate = sentenceCount > 1 ? repeatedStarters / (sentenceCount - 1) : 0;

  // Passive voice heuristics: is/was/were/been/being + past participle (ending in -ed or irregular)
  const passiveMatches = rawText.match(/\b(is|was|were|been|being|are)\s+([a-z]{3,}ed|utilized|conducted|examined|observed|implemented)\b/gi) || [];
  const passiveRate = (passiveMatches.length / Math.max(1, wordCount)) * 100;

  let syntacticSignal = 0.2;
  if (ruleOfThreeRate > 1.2) syntacticSignal += 0.25;
  if (starterRepetitionRate > 0.25) syntacticSignal += 0.25;
  if (passiveRate > 1.8) syntacticSignal += 0.25;
  syntacticSignal = Math.min(1.0, Math.max(0.05, syntacticSignal));

  // ========================================================
  // Signal 4: Lexical Diversity — Bidirectional MTLD (w = 0.14)
  // ========================================================
  const wordTokens = words.map((w) => w.text);
  const mtld = calculateMTLD(wordTokens);

  // Contraction scarcity check: human writing frequently uses contractions
  const contractionMatches = rawText.match(/\b([a-zA-Z]+'(?:t|s|ve|re|ll|d|m))\b/gi) || [];
  const contractionRate = (contractionMatches.length / Math.max(1, wordCount)) * 100;

  // Raw LLMs typically exhibit moderate/inflated MTLD (65-110) while avoiding contractions entirely
  let lexicalDiversitySignal = 0.5;
  if (contractionRate === 0 && wordCount > 80) {
    lexicalDiversitySignal += 0.35;
  } else if (contractionRate > 1.2) {
    lexicalDiversitySignal -= 0.3;
  }

  if (mtld > 55 && mtld < 85) {
    // LLMs cluster heavily around 60-80
    lexicalDiversitySignal += 0.15;
  }
  lexicalDiversitySignal = Math.min(1.0, Math.max(0.05, lexicalDiversitySignal));

  // ========================================================
  // Signal 5: N-Gram Entropy & Stopword Uniformity (w = 0.12)
  // ========================================================
  const trigramEntropy = calculateTrigramEntropy(rawText);

  // Stopword density uniformity across sentences
  let stopwordDeviations = 0;
  for (const s of sentences) {
    const sWords = tokenizeWords(s.text);
    if (sWords.length === 0) continue;
    const stopCount = sWords.filter((w) => COMMON_STOPWORDS.has(w.text.toLowerCase())).length;
    const ratio = stopCount / sWords.length;
    // Typical English stopword ratio is ~0.45; LLMs maintain tight 0.40-0.48 on almost every sentence
    stopwordDeviations += Math.abs(ratio - 0.44);
  }
  const avgStopwordDev = stopwordDeviations / Math.max(1, sentences.length);

  let entropySignal = 0.5;
  // Natural prose has wider swings in stopword ratio across sentences
  if (avgStopwordDev < 0.08) {
    entropySignal += 0.3;
  } else if (avgStopwordDev > 0.16) {
    entropySignal -= 0.3;
  }

  // Trigram entropy: LLM prose tends to sit in a narrow predictable band (4.1 - 4.4)
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

    // Symmetric paragraphs (common in LLMs generating intro + 3 uniform points + conclusion)
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

  // Calibrated Logistic Sigmoid mapping:
  // Center at 0.42 with steepness k = 10.5
  // Ensures human prose maps to 5–25% and raw LLM prose maps to 75–98%
  const sigmoid = (x: number, x0 = 0.42, k = 10.5): number => {
    return 1 / (1 + Math.exp(-k * (x - x0)));
  };

  const calibratedScore = Math.max(2, Math.min(99, Math.round(sigmoid(rawComposite) * 100)));

  // ========================================================
  // Sentence-Level Scoring & Context Smoothing
  // Formula: 0.75 * sentenceRaw + 0.25 * docPrior
  // ========================================================
  const docPrior = calibratedScore;
  const sentenceAnalyses: SentenceAnalysis[] = sentences.map((s) => {
    const sLower = s.text.toLowerCase();
    const sFp = scanFingerprints(s.text);
    const reasons: string[] = [];

    let sentenceRawScore = 30;

    if (sFp.tier1Count > 0) {
      sentenceRawScore += sFp.tier1Count * 35;
      reasons.push(`Contains AI cliché: "${sFp.matches.filter(m => m.tier === 1).map(m => m.phrase).join(', ')}"`);
    }

    if (sFp.tier2Count > 0) {
      sentenceRawScore += sFp.tier2Count * 20;
      reasons.push(`Formulaic transition or hedging: "${sFp.matches.filter(m => m.tier === 2).map(m => m.phrase).join(', ')}"`);
    }

    // Monotonous length penalty
    if (s.wordCount >= 18 && s.wordCount <= 26 && cv < 0.35) {
      sentenceRawScore += 15;
      reasons.push('Uniform cadence (18-26 words) matching LLM rhythm');
    }

    // Short punchy natural sentences
    if (s.wordCount <= 8 && sFp.matches.length === 0) {
      sentenceRawScore = Math.max(5, sentenceRawScore - 25);
    }

    // Rule of three
    if (/\b\w+,\s+\w+,\s+and\s+\w+\b/i.test(s.text)) {
      sentenceRawScore += 12;
      reasons.push('Rule-of-three enumeration');
    }

    // Smooth with document prior
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

  // Readability
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
