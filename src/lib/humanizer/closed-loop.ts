import { analyzeStylometrics, StylometricResult } from '../nlp/stylometrics';
import { cleanTextDeterministically } from './deterministic-cleaner';
import { validateGuardrails, GuardrailResult } from './guardrail';
import { computeWordDiff, DiffChange } from '../nlp/diff';
import { HumanizerMode } from './prompts';

export interface ClosedLoopOptions {
  mode?: HumanizerMode;
  targetMaxAiScore?: number;      // default: 15%
  freezeHumanSentences?: boolean;  // default: true
  preserveTerms?: string[];
  intensity?: number;             // 0.5 - 1.0
  onProgress?: (stage: string, percent: number) => void;
  rewriteChunkFn?: (chunk: string, mode: HumanizerMode, intensity: number, preserveTerms: string[]) => Promise<string>;
}

export interface ClosedLoopResult {
  beforeScore: number;
  afterScore: number;
  scoreDrop: number;
  rewrittenText: string;
  diff: DiffChange[];
  guardrail: GuardrailResult;
  passesRun: number;
  sentencesFrozenCount: number;
  stageLogs: string[];
}

/**
 * Client-Side 4-Stage Closed-Loop Controller.
 * Stage 1: Pre-Analysis & Selective Freezing
 * Stage 2: Chunked Rewrite (Deterministic or WebLLM)
 * Stage 3: Entity Guardrail Validation
 * Stage 4: Re-verification & Targeted Micro-Refinement
 */
export async function runClosedLoopHumanization(
  inputText: string,
  options: ClosedLoopOptions = {}
): Promise<ClosedLoopResult> {
  const {
    mode = 'standard',
    targetMaxAiScore = 15,
    freezeHumanSentences = true,
    preserveTerms = [],
    intensity = 0.85,
    onProgress,
    rewriteChunkFn,
  } = options;

  const stageLogs: string[] = [];
  const log = (msg: string) => {
    stageLogs.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
  };

  // -------------------------------------------------------------
  // STAGE 1: Pre-Analysis & Selective Freezing
  // -------------------------------------------------------------
  onProgress?.('Stage 1: Analyzing input prose & sentence rhythms...', 15);
  log('Starting Stage 1: Pre-analysis via Stylometrics');
  const initialAnalysis: StylometricResult = analyzeStylometrics(inputText);
  const beforeScore = initialAnalysis.aiScore;
  log(`Initial AI Score: ${beforeScore}%`);

  let sentencesFrozenCount = 0;
  const sentencePlan: { text: string; freeze: boolean }[] = [];

  for (const s of initialAnalysis.sentences) {
    if (freezeHumanSentences && s.score < 30) {
      sentencePlan.push({ text: s.text, freeze: true });
      sentencesFrozenCount++;
    } else {
      sentencePlan.push({ text: s.text, freeze: false });
    }
  }

  log(`Selective Freezing: ${sentencesFrozenCount}/${sentencePlan.length} sentences preserved verbatim (<30% AI).`);

  // -------------------------------------------------------------
  // STAGE 2: Chunked Rewrite
  // -------------------------------------------------------------
  onProgress?.('Stage 2: Restructuring and humanizing text chunks...', 40);
  log('Starting Stage 2: Chunked execution');

  let pass1Text = '';

  if (rewriteChunkFn) {
    // Neural / WebLLM streaming path
    const chunksToRewrite: string[] = [];
    let currentChunk = '';

    for (const item of sentencePlan) {
      if (item.freeze) {
        if (currentChunk.trim().length > 0) {
          chunksToRewrite.push(currentChunk.trim());
          currentChunk = '';
        }
        chunksToRewrite.push(`__FROZEN__:${item.text}`);
      } else {
        currentChunk += (currentChunk ? ' ' : '') + item.text;
        // Group into 120-220 word chunks
        if (currentChunk.split(/\s+/).length >= 120) {
          chunksToRewrite.push(currentChunk.trim());
          currentChunk = '';
        }
      }
    }
    if (currentChunk.trim().length > 0) {
      chunksToRewrite.push(currentChunk.trim());
    }

    const rewrittenParts: string[] = [];
    for (let i = 0; i < chunksToRewrite.length; i++) {
      const part = chunksToRewrite[i]!;
      if (part.startsWith('__FROZEN__:')) {
        rewrittenParts.push(part.replace('__FROZEN__:', ''));
      } else {
        log(`Rewriting chunk ${i + 1}/${chunksToRewrite.length}`);
        const rewritten = await rewriteChunkFn(part, mode, intensity, preserveTerms);
        rewrittenParts.push(rewritten);
      }
    }
    pass1Text = rewrittenParts.join(' ');
  } else {
    // Fast Deterministic De-AI Engine path
    log('Running Fast Deterministic De-AI Cleaner');
    const cleaned = cleanTextDeterministically(inputText, {
      injectContractions: true,
      restructureCompoundSentences: true,
      preserveTerms,
    });
    pass1Text = cleaned.cleanedText;
  }

  // -------------------------------------------------------------
  // STAGE 3: Entity & Integrity Guardrail
  // -------------------------------------------------------------
  onProgress?.('Stage 3: Verifying factual entities, numbers, and locked terms...', 70);
  log('Starting Stage 3: Guardrail Validation');
  let guardrail = validateGuardrails(inputText, pass1Text, {
    mode,
    preserveTerms,
  });

  if (!guardrail.passed) {
    log(`Guardrail Warnings: ${guardrail.violations.join('; ')}`);
  } else {
    log('Guardrail: 100% of factual figures and locked terms preserved.');
  }

  // -------------------------------------------------------------
  // STAGE 4: Re-Verification & Targeted Micro-Refinement
  // -------------------------------------------------------------
  onProgress?.('Stage 4: Closed-loop verification and micro-refinement...', 90);
  log('Starting Stage 4: Re-scoring output');
  let currentAnalysis = analyzeStylometrics(pass1Text);
  let passesRun = 1;

  if (currentAnalysis.aiScore > targetMaxAiScore && currentAnalysis.aiScore >= 35) {
    log(`Post-Pass 1 AI Score is ${currentAnalysis.aiScore}% (> target ${targetMaxAiScore}%). Triggering Pass 2 micro-clean.`);
    // Run targeted deterministic cleaner to prune stubborn remaining clichés
    const microCleaned = cleanTextDeterministically(pass1Text, {
      injectContractions: true,
      restructureCompoundSentences: false,
      preserveTerms,
    });
    const pass2Analysis = analyzeStylometrics(microCleaned.cleanedText);
    if (pass2Analysis.aiScore < currentAnalysis.aiScore) {
      pass1Text = microCleaned.cleanedText;
      currentAnalysis = pass2Analysis;
      passesRun = 2;
      log(`Pass 2 micro-clean reduced score to ${currentAnalysis.aiScore}%.`);
    }
  }

  const afterScore = currentAnalysis.aiScore;
  const scoreDrop = beforeScore - afterScore;
  log(`Final Result: ${beforeScore}% -> ${afterScore}% (Reduction: ${scoreDrop} points).`);

  // Compute final Myers diff
  const diff = computeWordDiff(inputText, pass1Text);

  onProgress?.('Completed', 100);

  return {
    beforeScore,
    afterScore,
    scoreDrop,
    rewrittenText: pass1Text,
    diff,
    guardrail,
    passesRun,
    sentencesFrozenCount,
    stageLogs,
  };
}
