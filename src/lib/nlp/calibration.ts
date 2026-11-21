/**
 * Veritext Local AI - Domain-Aware Calibration & 3-Signal Forensic Ensemble
 * Calibrates AI probability curves across Academic, Technical, Creative, and ESL-Fair profiles.
 * Fuses Stylometrics, Neural RoBERTa, and Causal LM Perplexity/GLTR with dynamic confidence intervals.
 */

export type DomainProfile = 'general' | 'academic' | 'technical' | 'creative' | 'esl-fair';

export interface DomainConfig {
  id: DomainProfile;
  name: string;
  description: string;
  cvTargetLow: number;
  cvTargetHigh: number;
  transitionPenaltyFactor: number;
  contractionPenaltyFactor: number;
  entropyTolerance: number;
}

export const DOMAIN_PROFILES: Record<DomainProfile, DomainConfig> = {
  general: {
    id: 'general',
    name: 'General Purpose',
    description: 'Standard calibrated weights for journalism, blogs, essays, and general prose.',
    cvTargetLow: 0.35,
    cvTargetHigh: 0.55,
    transitionPenaltyFactor: 1.0,
    contractionPenaltyFactor: 1.0,
    entropyTolerance: 1.0,
  },
  academic: {
    id: 'academic',
    name: 'Academic / Research',
    description: 'Calibrated for peer-reviewed papers, literature reviews, and scientific abstracts.',
    cvTargetLow: 0.28,
    cvTargetHigh: 0.50,
    transitionPenaltyFactor: 0.35,
    contractionPenaltyFactor: 0.1,
    entropyTolerance: 0.85,
  },
  technical: {
    id: 'technical',
    name: 'Technical / Docs',
    description: 'Optimized for postmortems, RFCs, engineering specifications, and architecture docs.',
    cvTargetLow: 0.30,
    cvTargetHigh: 0.52,
    transitionPenaltyFactor: 0.40,
    contractionPenaltyFactor: 0.4,
    entropyTolerance: 0.70,
  },
  creative: {
    id: 'creative',
    name: 'Creative / Narrative',
    description: 'Tuned for fiction, personal memoirs, storytelling, dialogue, and expressive prose.',
    cvTargetLow: 0.42,
    cvTargetHigh: 0.70,
    transitionPenaltyFactor: 1.2,
    contractionPenaltyFactor: 1.3,
    entropyTolerance: 1.2,
  },
  'esl-fair': {
    id: 'esl-fair',
    name: 'ESL-Fair (Low False Positive)',
    description: 'Protects non-native English writers from false AI accusations by tolerating taught transitions and uniform sentence rhythms.',
    cvTargetLow: 0.22,
    cvTargetHigh: 0.48,
    transitionPenaltyFactor: 0.20,
    contractionPenaltyFactor: 0.2,
    entropyTolerance: 0.8,
  },
};

export interface ConfidenceInterval {
  score: number;
  margin: number;
  lower: number;
  upper: number;
  reliability: 'high' | 'medium' | 'low';
  mixedOrEdited: boolean;
}

export interface FusionResult {
  finalScore: number;
  isAi: boolean;
  confidenceInterval: ConfidenceInterval;
  weights: {
    stylometrics: number;
    roberta: number;
    perplexity: number;
  };
  domainApplied: DomainProfile;
  verdict: 'Human Written' | 'Likely Human' | 'Mixed / Edited' | 'Likely AI' | 'AI Generated';
}

/**
 * Calibrates the raw stylometric score based on the chosen domain profile.
 */
export function applyDomainCalibration(
  baseStylometricScore: number,
  domain: DomainProfile,
  signals: {
    burstiness: number;
    clicheLexicon: number;
    syntacticUniformity: number;
    lexicalDiversity: number;
  }
): number {
  if (domain === 'general') return baseStylometricScore;

  let adjusted = baseStylometricScore;

  // If text does NOT contain heavy Tier-1 AI clichés, apply domain allowances
  if (signals.clicheLexicon < 0.85) {
    if (domain === 'esl-fair') {
      // ESL writers are taught formal transitions ("Furthermore, In conclusion") and write in measured rhythms
      const discount = 28 * (1 - signals.clicheLexicon * 0.5);
      adjusted = Math.max(5, adjusted - discount);
    } else if (domain === 'academic') {
      // Scientific/academic writing legitimately avoids contractions and uses passive voice
      const discount = 24 * (1 - signals.clicheLexicon * 0.5);
      adjusted = Math.max(5, adjusted - discount);
    } else if (domain === 'technical') {
      // Technical docs repeat API names and identifiers
      const discount = 18 * (1 - signals.clicheLexicon * 0.5);
      adjusted = Math.max(5, adjusted - discount);
    } else if (domain === 'creative') {
      const discount = 12 * (1 - signals.clicheLexicon * 0.5);
      adjusted = Math.max(5, adjusted - discount);
    }
  }

  return Math.min(99, Math.max(2, Math.round(adjusted)));
}

/**
 * Fuses available signals (Stylometrics, RoBERTa, Perplexity/GLTR) into a unified ensemble.
 */
export function fuseForensicSignals(params: {
  stylometricScore: number;
  robertaScore?: number;
  perplexityScore?: number;
  wordCount: number;
  domain: DomainProfile;
}): FusionResult {
  const { stylometricScore, robertaScore, perplexityScore, wordCount, domain } = params;

  let finalScore = stylometricScore;
  let wStylometric = 1.0;
  let wRoberta = 0.0;
  let wPerplexity = 0.0;

  if (robertaScore !== undefined && perplexityScore !== undefined) {
    wRoberta = 0.45;
    wPerplexity = 0.30;
    wStylometric = 0.25;
    finalScore = Math.round(
      robertaScore * wRoberta + perplexityScore * wPerplexity + stylometricScore * wStylometric
    );
  } else if (robertaScore !== undefined) {
    wRoberta = 0.62;
    wStylometric = 0.38;
    finalScore = Math.round(robertaScore * wRoberta + stylometricScore * wStylometric);
  } else {
    finalScore = stylometricScore;
  }

  let signalDisagreement = 0;
  if (robertaScore !== undefined && perplexityScore !== undefined) {
    const scores = [stylometricScore, robertaScore, perplexityScore];
    const mean = (stylometricScore + robertaScore + perplexityScore) / 3;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / 3;
    signalDisagreement = Math.sqrt(variance);
  } else if (robertaScore !== undefined) {
    signalDisagreement = Math.abs(robertaScore - stylometricScore);
  }

  const mixedOrEdited = signalDisagreement > 28 || (finalScore >= 38 && finalScore <= 65);

  const baseMargin = Math.max(3, Math.min(14, Math.round(45 / Math.sqrt(Math.max(wordCount, 15)))));
  const disagreementPenalty = Math.round(Math.min(signalDisagreement * 0.25, 8));
  const margin = Math.min(20, baseMargin + disagreementPenalty);

  const lower = Math.max(0, finalScore - margin);
  const upper = Math.min(100, finalScore + margin);

  let reliability: 'high' | 'medium' | 'low' = 'high';
  if (wordCount < 80 || margin > 12) {
    reliability = 'low';
  } else if (wordCount < 180 || margin > 7) {
    reliability = 'medium';
  }

  let verdict: FusionResult['verdict'] = 'Human Written';
  if (mixedOrEdited) {
    verdict = 'Mixed / Edited';
  } else if (finalScore < 30) {
    verdict = 'Human Written';
  } else if (finalScore < 50) {
    verdict = 'Likely Human';
  } else if (finalScore < 75) {
    verdict = 'Likely AI';
  } else {
    verdict = 'AI Generated';
  }

  return {
    finalScore,
    isAi: finalScore >= 50,
    confidenceInterval: {
      score: finalScore,
      margin,
      lower,
      upper,
      reliability,
      mixedOrEdited,
    },
    weights: {
      stylometrics: wStylometric,
      roberta: wRoberta,
      perplexity: wPerplexity,
    },
    domainApplied: domain,
    verdict,
  };
}

/**
 * Derives an AI score [0, 100] from Document Perplexity, Fast-DetectGPT Curvature, and GLTR Top-K Distribution.
 * Full 3-signal forensic mode integrates:
 * 0.55 Curvature + 0.25 PPL Burstiness + 0.20 GLTR Rank Ratio (when curvature is available).
 */
export function derivePerplexityAiScore(params: {
  documentPerplexity: number;
  perplexityBurstiness: number;
  gltrDistribution: { top10: number; top100: number; top1000: number; beyond1000: number };
  curvature?: number;
}): number {
  const { documentPerplexity, perplexityBurstiness, gltrDistribution, curvature } = params;

  const pplSignal = Math.max(0, Math.min(1, (85 - documentPerplexity) / 65));
  const top10Ratio = gltrDistribution.top10 / 100;
  const beyond1000Ratio = gltrDistribution.beyond1000 / 100;
  const gltrSignal = Math.max(0, Math.min(1, top10Ratio * 1.1 - beyond1000Ratio * 1.5));
  const burstinessSignal = Math.max(0, Math.min(1, (40 - perplexityBurstiness) / 40));

  let composite = 0;
  if (curvature !== undefined) {
    // Fast-DetectGPT curvature: d(x) > 1.5 indicates AI; d(x) < 0 indicates human
    const curvatureSignal = Math.max(0, Math.min(1, (curvature + 0.4) / 2.4));
    composite = curvatureSignal * 0.55 + burstinessSignal * 0.25 + gltrSignal * 0.20;
  } else {
    composite = gltrSignal * 0.45 + pplSignal * 0.35 + burstinessSignal * 0.20;
  }

  const calibrated = 1 / (1 + Math.exp(-9 * (composite - 0.48)));
  return Math.min(99, Math.max(1, Math.round(calibrated * 100)));
}
