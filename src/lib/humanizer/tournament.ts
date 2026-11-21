/**
 * Veritext Local AI - Best-of-N Tournament Reranker
 * Evaluates multiple rewrite candidates using multi-objective optimization:
 * - Low AI Probability (Stylometrics / RoBERTa) [55%]
 * - Semantic Similarity (MiniLM Cosine Sim >= 0.84 floor) [30%]
 * - Guardrail Integrity (Numbers, Entities, Dates) [15%]
 * - Voice Profile Distance Penalty
 */

import { validateGuardrails } from './guardrail';
import { analyzeStylometrics } from '../nlp/stylometrics';
import { AuthorVoiceFingerprint, computeVoiceDistance } from '../nlp/voice-profile';

export interface TournamentCandidate {
  id: string;
  strategy: 'punchy-active' | 'conversational-inversion' | 'concrete-compression';
  strategyLabel: string;
  temperature: number;
  text: string;
  aiScore: number; // 0 - 100
  semanticSimilarity: number; // 0.0 - 1.0
  semanticFloorPassed: boolean;
  guardrailPassed: boolean;
  guardrailViolations: string[];
  voiceDistance?: number; // 0.0 - 1.0 (if voice profile provided)
  fitnessScore: number; // 0.0 - 1.0 (higher is better)
  isWinner: boolean;
}

export interface TournamentResult {
  winner: TournamentCandidate;
  candidates: TournamentCandidate[];
  originalText: string;
  semanticFloorApplied: number;
  totalEvaluated: number;
}

export interface TournamentOptions {
  originalText: string;
  candidates: Array<{
    strategy: 'punchy-active' | 'conversational-inversion' | 'concrete-compression';
    text: string;
    temperature: number;
    semanticSimilarity?: number; // Precomputed by embedding worker
  }>;
  semanticFloor?: number; // default 0.84, or 0.78 for creative
  voiceProfile?: AuthorVoiceFingerprint;
  // Optional pre-computed AI scores from neural detector
  aiScores?: number[];
}

/**
 * Fallback fast character/word overlap semantic similarity when embedding worker is not loaded.
 */
export function computeFallbackSemanticSimilarity(orig: string, cand: string): number {
  const wordsA = new Set((orig.toLowerCase().match(/[a-z0-9]+/g) ?? []));
  const wordsB = new Set((cand.toLowerCase().match(/[a-z0-9]+/g) ?? []));

  if (wordsA.size === 0 || wordsB.size === 0) return 0.5;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  const jaccard = union > 0 ? intersection / union : 0.5;

  return Math.min(0.98, Math.max(0.60, Math.round((0.55 + jaccard * 0.43) * 1000) / 1000));
}

/**
 * Runs the Tournament Reranking pipeline over N candidates.
 */
export function runTournamentReranker(options: TournamentOptions): TournamentResult {
  const { originalText, candidates, voiceProfile, aiScores } = options;
  const semanticFloor = options.semanticFloor ?? 0.84;

  const evaluated: TournamentCandidate[] = candidates.map((cand, idx) => {
    // 1. Compute or retrieve AI score
    let aiScore = 50;
    if (aiScores && aiScores[idx] !== undefined) {
      aiScore = aiScores[idx]!;
    } else {
      const stylo = analyzeStylometrics(cand.text);
      aiScore = stylo.aiScore;
    }

    // 2. Validate entity & numeric guardrails
    const guardrail = validateGuardrails(originalText, cand.text, {
      maxAllowedLengthCollapse: 0.50,
      mode: cand.strategy === 'punchy-active' || cand.strategy === 'concrete-compression' ? 'concise' : 'standard',
    });

    // 3. Semantic similarity
    const semanticSim =
      cand.semanticSimilarity !== undefined
        ? cand.semanticSimilarity
        : computeFallbackSemanticSimilarity(originalText, cand.text);
    const semanticFloorPassed = semanticSim >= semanticFloor;

    // 4. Voice Profile distance (if active)
    let voiceDist: number | undefined;
    let voicePenalty = 0;
    if (voiceProfile) {
      voiceDist = computeVoiceDistance(cand.text, voiceProfile);
      voicePenalty = voiceDist * 0.10;
    }

    // 5. Composite Fitness Objective Function:
    const aiTerm = (1 - aiScore / 100) * 0.55;
    const simTerm = semanticSim * 0.30;
    const guardTerm = (guardrail.passed ? 1.0 : 0.0) * 0.15;

    let fitness = aiTerm + simTerm + guardTerm - voicePenalty;

    // Disqualify if semantic floor failed (heavy penalty)
    if (!semanticFloorPassed) {
      fitness *= 0.4;
    }
    // Severe penalty if entities/numbers dropped
    if (!guardrail.passed) {
      fitness *= 0.6;
    }

    const strategyLabels: Record<string, string> = {
      'punchy-active': 'Punchy Active Restructure',
      'conversational-inversion': 'Conversational Inversion',
      'concrete-compression': 'Concrete Verb Compression',
    };

    return {
      id: `cand-${idx + 1}-${cand.strategy}`,
      strategy: cand.strategy,
      strategyLabel: strategyLabels[cand.strategy] ?? cand.strategy,
      temperature: cand.temperature,
      text: cand.text,
      aiScore,
      semanticSimilarity: semanticSim,
      semanticFloorPassed,
      guardrailPassed: guardrail.passed,
      guardrailViolations: guardrail.missingEntities,
      voiceDistance: voiceDist,
      fitnessScore: Math.round(fitness * 1000) / 1000,
      isWinner: false,
    };
  });

  // Sort by fitness descending
  evaluated.sort((a, b) => b.fitnessScore - a.fitnessScore);

  // Mark winner
  if (evaluated[0]) {
    evaluated[0].isWinner = true;
  }

  return {
    winner: evaluated[0] ?? {
      id: 'fallback',
      strategy: 'punchy-active',
      strategyLabel: 'Punchy Active',
      temperature: 0.7,
      text: originalText,
      aiScore: 50,
      semanticSimilarity: 1.0,
      semanticFloorPassed: true,
      guardrailPassed: true,
      guardrailViolations: [],
      fitnessScore: 0.5,
      isWinner: true,
    },
    candidates: evaluated,
    originalText,
    semanticFloorApplied: semanticFloor,
    totalEvaluated: evaluated.length,
  };
}
