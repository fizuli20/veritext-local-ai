import { countWords, tokenizeSentences } from "../nlp/tokenizer";
import { RewriteOutputLimitError } from "./output-cleaner";
import { rewriteParagraph, type GenerateParagraph } from "./paragraph-rewrite";
import {
  restructureConditionalInstructions,
  restructureFromSource,
  restructureQualifiedBenefit,
} from "./source-edits";
import {
  reviewRewrite,
  CLOSING_OMISSION,
  closingRecommendation,
  conditionalInstructions,
  reviewFocusedRewrite,
  preservationInstructions,
  quantityClaims,
  protectedQualifiedSentences,
  rewriteExtent,
  rewriteQualifierInstructions,
  rewriteInstructions,
  type RewriteDepth,
} from "./rewrite-review";

export interface LockedRewrite {
  text: string;
  locks: { token: string; value: string }[];
  prefix: string;
  ranges?: { start: number; end: number }[];
}
/** Freeze exact spans before inference. Tokens are validated before restoration. */
export function lockRewriteSpans(
  text: string,
  terms: string[] = [],
): LockedRewrite {
  let prefix = "VTLOCK";
  while (text.includes(prefix)) prefix += "X";
  const ranges: { start: number; end: number }[] = [];
  const patterns = [
    /```[\s\S]*?```/g,
    /`[^`\n]+`/g,
    /\$\$[\s\S]*?\$\$/g,
    /"[^"\n]+"|“[^”\n]+”/g,
    /https?:\/\/[^\s<>"”]+/g,
    /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,
    /\([A-Z][^()\n]{0,160}\b(?:19|20)\d{2}[^()\n]*\)/g,
    /\[\d+(?:[,\s–-]+\d+)*\]/g,
    /(?<![\p{L}\p{N}_])(?:[$€£])?[+-]?\d+(?:[,.]\d+)*(?:[eE][+-]?\d+)?(?:\s?%)?/gu,
  ];
  for (const pattern of patterns)
    for (const match of text.matchAll(pattern))
      ranges.push({ start: match.index!, end: match.index! + match[0].length });
  for (const term of terms.map((t) => t.trim()).filter(Boolean)) {
    let start = 0;
    while ((start = text.indexOf(term, start)) >= 0) {
      ranges.push({ start, end: start + term.length });
      start += term.length;
    }
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start < previous.end)
      previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  const locks = merged.map((range, index) => ({
    token: `${prefix}_${index}_END`,
    value: text.slice(range.start, range.end),
  }));
  let masked = "",
    cursor = 0;
  merged.forEach((range, index) => {
    masked += text.slice(cursor, range.start) + locks[index]!.token;
    cursor = range.end;
  });
  return { text: masked + text.slice(cursor), locks, prefix, ranges: merged };
}
export function restoreRewriteSpans(
  text: string,
  locked: LockedRewrite,
  strict = true,
): string {
  // Models sometimes escape underscores or vary case/spacing. Canonicalize
  // only complete markers with a known numeric ID; never invent missing facts.
  const separator = String.raw`[\s_\\-]*`;
  const markerPattern = new RegExp(
    locked.prefix + separator + String.raw`(\d+)` + separator + "END",
    "gi",
  );
  let restored = text.replace(markerPattern, (match, index) => {
    const token = `${locked.prefix}_${Number(index)}_END`;
    return locked.locks.some((lock) => lock.token === token) ? token : match;
  });
  for (const { token, value } of locked.locks) {
    const count = restored.split(token).length - 1;
    if (strict && count !== 1)
      throw new Error(
        `Protected source text was missing or repeated: ${value.slice(0, 100)}`,
      );
    restored = restored.split(token).join(value);
  }
  if (strict && new RegExp(locked.prefix, "i").test(restored))
    throw new Error("The model returned an unknown protected marker.");
  if (!strict) {
    restored = restored.replace(
      new RegExp(locked.prefix + String.raw`_\d+_END`, "gi"),
      "",
    );
  }
  return restored;
}
export interface RewritePart {
  text: string;
  separator: string;
  restructure?: true;
  context?: string;
}
/** Keep paragraph boundaries; prefer sentence/space boundaries inside long paragraphs. */
export function splitRewrite(
  text: string,
  maxCharacters = 1600,
): RewritePart[] {
  if (maxCharacters < 80) throw new Error("Chunk size too small");
  const parts: RewritePart[] = [];
  const blocks = text.split(/(\n[\t ]*\n+)/);
  for (let i = 0; i < blocks.length; i += 2) {
    let block = blocks[i] ?? "";
    const trailing = blocks[i + 1] ?? "";
    while (block.length > maxCharacters) {
      const area = block.slice(0, maxCharacters + 1);
      let boundary = -1;
      for (const match of area.matchAll(/[.!?]["”']?\s+/g))
        if (match.index! > maxCharacters * 0.4)
          boundary = match.index! + match[0].trimEnd().length;
      if (boundary < 0) boundary = area.lastIndexOf(" ");
      if (boundary < maxCharacters * 0.4) boundary = maxCharacters;
      const separator = block.slice(boundary).match(/^\s*/)?.[0] ?? "";
      parts.push({ text: block.slice(0, boundary), separator });
      block = block.slice(boundary + separator.length);
    }
    parts.push({ text: block, separator: trailing });
  }
  return parts;
}
const QUALIFIED_SENTENCE =
  /\b(?:no|not|never|neither|cannot|without|can|could|may|might)\b|n['’]t\b/i;

/** Shorter first-pass groups reduce whole-paragraph retries in qualified prose. */
function splitQualifiedProse(
  part: RewritePart,
  lockPrefix: string,
): RewritePart[] {
  if (part.text.includes(lockPrefix) || countWords(part.text) < 100)
    return [part];
  const sentences = tokenizeSentences(part.text);
  if (
    sentences.length < 6 ||
    sentences.filter(({ text }) => QUALIFIED_SENTENCE.test(text)).length < 3
  )
    return [part];

  const groups = Math.min(4, Math.ceil(sentences.length / 3));
  const pieces: RewritePart[] = [];
  let sentenceIndex = 0;
  let start = 0;
  for (let group = 0; group < groups; group++) {
    const earlier = sentences[sentenceIndex - 1]?.text;
    const context = earlier
      ? [...new Set([sentences[0]!.text, earlier])].join(" ").slice(0, 450)
      : undefined;
    sentenceIndex += Math.ceil(
      (sentences.length - sentenceIndex) / (groups - group),
    );
    const next = sentences[sentenceIndex];
    if (!next) {
      pieces.push({
        text: part.text.slice(start),
        separator: part.separator,
        restructure: true,
        context,
      });
      break;
    }
    const end = sentences[sentenceIndex - 1]!.end;
    pieces.push({
      text: part.text.slice(start, end),
      separator: part.text.slice(end, next.start),
      restructure: true,
      context,
    });
    start = next.start;
  }
  return pieces;
}

export interface GenerateRewrite {
  (request: {
    systemPrompt: string;
    userPrompt: string;
    attempt: number;
    restructure?: boolean;
    maxTokens?: number;
  }): Promise<string>;
}
export interface RewriteOutcome {
  text: string;
  parts: number;
  retries: number;
  retained: number;
  warnings: string[];
  elapsedMs: number;
  changed: boolean;
  lightFallback: boolean;
  sentenceEdits?: { edited: number; eligible: number; fromSource: number };
  checks: { section: number; attempt: number; reason: string }[];
}
async function rewriteEditableExcerpt({
  excerpt,
  systemPrompt,
  context,
  mode,
  terms,
  signal,
  generate,
}: {
  excerpt: string;
  systemPrompt: string;
  context: string;
  mode: string;
  terms: string[];
  signal?: AbortSignal;
  generate: GenerateRewrite;
}) {
  let best = excerpt;
  let bestExtent = 0;
  let retries = 0;
  let previousIssue = "";
  const sizeHint =
    tokenizeSentences(excerpt).length === 1
      ? `Return one sentence of roughly ${countWords(excerpt)} words.`
      : "";
  const checks: { attempt: number; reason: string }[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal?.aborted) throw new Error("Generation stopped.");
    if (attempt) retries++;
    let candidate: string;
    try {
      candidate = (
        await generate({
          systemPrompt,
          userPrompt:
            [
              "Rewrite only this excerpt. Move a clause or start with another idea already in the source.",
              "Keep the same level of detail. Leave any unspecified examples unspecified.",
              sizeHint,
              previousIssue,
              rewriteQualifierInstructions(excerpt),
            ]
              .filter(Boolean)
              .join(" ") +
            "\n\n" +
            excerpt,
          attempt,
          restructure: true,
        })
      ).trim();
    } catch (error) {
      if (signal?.aborted) throw new Error("Generation stopped.");
      if (!(error instanceof RewriteOutputLimitError) && !bestExtent)
        throw error;
      checks.push({
        attempt: attempt + 1,
        reason:
          error instanceof RewriteOutputLimitError
            ? error.message
            : "A stronger edit could not finish. The checked excerpt was kept.",
      });
      break;
    }
    if (signal?.aborted) throw new Error("Generation stopped.");
    const issues = reviewFocusedRewrite(
      excerpt,
      candidate,
      mode,
      terms,
      context,
    );
    const extent = rewriteExtent(excerpt, candidate);
    if (!issues.length && extent > bestExtent) {
      best = candidate;
      bestExtent = extent;
    }
    if (bestExtent >= 0.3) break;
    checks.push({
      attempt: attempt + 1,
      reason:
        issues.join(" ") ||
        (extent
          ? "The model made only small wording changes in this excerpt."
          : "The model copied this excerpt unchanged."),
    });
    previousIssue = issues.length
      ? preservationInstructions(excerpt, issues)
      : "Use a genuinely different sentence opening while keeping the same claims.";
  }
  return { text: best, retries, checks };
}

export async function runRewritePipeline(options: {
  text: string;
  mode: string;
  depth?: RewriteDepth;
  styleNote?: string;
  voiceGuidance?: string;
  terms?: string[];
  signal?: AbortSignal;
  generate: GenerateRewrite;
  generateParagraph?: GenerateParagraph;
  onProgress: (message: string) => void;
}): Promise<RewriteOutcome> {
  const {
    text,
    mode,
    depth = "polish",
    styleNote,
    voiceGuidance,
    terms = [],
    signal,
    generate,
    generateParagraph,
    onProgress,
  } = options;
  const started = performance.now();
  const documentLocks = lockRewriteSpans(text, terms);
  const paragraphBreak = /((?:\r?\n)[\t ]*(?:\r?\n)+)/;
  if (
    depth === "rephrase" &&
    generateParagraph &&
    paragraphBreak.test(text) &&
    !documentLocks.ranges?.some(({ start, end }) =>
      paragraphBreak.test(text.slice(start, end)),
    )
  ) {
    const blocks = text.split(paragraphBreak);
    const total = blocks.filter(
      (block, index) => index % 2 === 0 && block.trim(),
    ).length;
    let completed = "";
    let paragraph = 0;
    let parts = 0;
    let retained = 0;
    let retries = 0;
    const warnings: string[] = [];
    const checks: RewriteOutcome["checks"] = [];
    let allPlanned = true;
    const sentenceEdits = { edited: 0, eligible: 0, fromSource: 0 };
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index]!;
      if (index % 2 === 1 || !block.trim()) {
        completed += block;
        continue;
      }
      paragraph++;
      const outcome = await runRewritePipeline({
        ...options,
        text: block,
        onProgress: (message) =>
          onProgress(`Paragraph ${paragraph} of ${total}. ${message}`),
      });
      completed += outcome.text;
      retries += outcome.retries;
      retained += outcome.retained;
      warnings.push(
        ...outcome.warnings.map(
          (warning) => `Paragraph ${paragraph}. ${warning}`,
        ),
      );
      checks.push(
        ...outcome.checks.map((check) => ({
          ...check,
          section: check.section + parts,
        })),
      );
      parts += outcome.parts;
      if (outcome.sentenceEdits) {
        sentenceEdits.edited += outcome.sentenceEdits.edited;
        sentenceEdits.eligible += outcome.sentenceEdits.eligible;
        sentenceEdits.fromSource += outcome.sentenceEdits.fromSource;
      } else {
        allPlanned = false;
      }
    }
    const changed = completed.trim() !== text.trim();
    return {
      text: completed,
      parts,
      retained,
      retries,
      warnings,
      checks,
      elapsedMs: Math.round(performance.now() - started),
      changed,
      lightFallback:
        changed &&
        countWords(text) >= 60 &&
        rewriteExtent(text, completed) < 0.2,
      ...(allPlanned && sentenceEdits.eligible ? { sentenceEdits } : {}),
    };
  }
  if (depth === "rephrase" && generateParagraph && text.length <= 1600) {
    const result = await rewriteParagraph({
      text,
      mode,
      styleNote,
      voiceGuidance,
      terms,
      protectedRanges: documentLocks.ranges ?? [],
      signal,
      generateBlock: (request) => generate({ ...request, restructure: true }),
      onGenerate: () => onProgress("Rewriting a connected passage…"),
      generate: async (request) => {
        if (request.attempt === 0)
          onProgress("Rewriting with paragraph context…");
        return generateParagraph(request);
      },
      onRetry: () => onProgress("Refining individual sentences…"),
    });
    if (result) {
      const lightFallback = rewriteExtent(text, result.text) < 0.2;
      return {
        text: result.text,
        parts: 1,
        retained: 0,
        retries: result.retries,
        warnings: lightFallback
          ? ["The completed draft contains light wording changes."]
          : [],
        elapsedMs: Math.round(performance.now() - started),
        changed: true,
        lightFallback,
        sentenceEdits: {
          edited: result.edited,
          eligible: result.eligible,
          fromSource: result.fromSource,
        },
        checks: [],
      };
    }
  }
  const sections = splitRewrite(documentLocks.text);
  const parts =
    depth === "rephrase"
      ? sections.flatMap((section) =>
          splitQualifiedProse(section, documentLocks.prefix),
        )
      : sections;
  const totalSections = parts.filter((part) => part.text.trim()).length;
  let section = 0;
  let completed = "",
    retries = 0,
    retained = 0;
  const warnings: string[] = [];
  const checks: RewriteOutcome["checks"] = [];
  for (const part of parts) {
    if (signal?.aborted) throw new Error("Generation stopped.");
    if (!part.text.trim()) {
      completed += part.text + part.separator;
      continue;
    }
    section++;
    const locked = {
      text: part.text,
      prefix: documentLocks.prefix,
      locks: documentLocks.locks.filter((lock) =>
        part.text.includes(lock.token),
      ),
    };
    const originalPart = restoreRewriteSpans(part.text, locked);
    // Full rewriting needs readable factual context. Validate literal facts
    // afterwards rather than forcing small models to reason about placeholders.
    // Light editing retains exact marker restoration; both modes use the same
    // invariant checks and bounded recovery before anything is accepted.
    const generationLocks =
      depth === "rephrase" && originalPart.length <= 1600
        ? { ...locked, text: originalPart, locks: [] }
        : locked;
    const protectedAmounts = quantityClaims(originalPart);
    let accepted: string | null = null;
    let feedback = "";
    let usableLightEdit: string | null = null;
    const recommendation = closingRecommendation(originalPart);
    const conditional = conditionalInstructions(originalPart);
    const qualifiedStatements = protectedQualifiedSentences(originalPart);
    let keepClosingSentence = Boolean(recommendation);
    let outputLimited = false;
    const checkExtent =
      depth === "rephrase" &&
      countWords(originalPart) >= (part.restructure ? 30 : 60) &&
      generationLocks.locks.length === 0;
    const fixedSentences = new Set([
      ...protectedAmounts,
      ...conditional,
      ...qualifiedStatements,
    ]);
    if (recommendation) fixedSentences.add(recommendation);
    const editAroundProtected = Boolean(
      part.restructure && fixedSentences.size,
    );
    const fixedWordCount = [...fixedSentences].reduce(
      (count, sentence) => count + countWords(sentence),
      0,
    );
    const tryLargerEdit =
      checkExtent &&
      countWords(originalPart) - fixedWordCount >= (part.restructure ? 30 : 60);
    const subjectContext = part.context
      ? " Earlier source text identifies the subject and setting. Use it to resolve references, then edit only the requested excerpt: " +
        JSON.stringify(part.context)
      : "";
    for (let attempt = 0; !editAroundProtected && attempt < 2; attempt++) {
      if (signal?.aborted) throw new Error("Generation stopped.");
      if (attempt) retries++;
      onProgress(
        `${attempt ? "Refining" : "Editing"} section ${section} of ${totalSections}…`,
      );
      let candidate: string;
      try {
        candidate = await generate({
          systemPrompt:
            rewriteInstructions(
              mode,
              depth,
              styleNote,
              part.restructure,
              voiceGuidance,
            ) +
            subjectContext +
            (part.restructure
              ? " " + rewriteQualifierInstructions(originalPart)
              : "") +
            (protectedAmounts.length
              ? " Keep sentences reporting distinct amounts unchanged, including the actions and subjects tied to those amounts."
              : "") +
            (qualifiedStatements.length
              ? " Keep these qualified sentences word for word: benefits beginning with It or They, and contrasts joined by while or whereas. Keep the actions tied to the correct people."
              : "") +
            (conditional.length
              ? " Keep any opening prerequisite and its full list of instructions in the original sentence, word for word."
              : "") +
            (recommendation
              ? " Keep the original closing recommendation and its conditions word for word."
              : "") +
            (generationLocks.locks.length
              ? ` Preserve every ${locked.prefix}_number_END marker exactly once. Markers stand for protected source text; never modify them.`
              : ""),
          userPrompt: `${feedback ? feedback + "\n\n" : ""}Edit the following passage. Return only the edited passage.\n\n${generationLocks.text}`,
          attempt,
          restructure: part.restructure,
        });
      } catch (error) {
        if (signal?.aborted) throw new Error("Generation stopped.");
        outputLimited = error instanceof RewriteOutputLimitError;
        if (!outputLimited && !usableLightEdit) throw error;
        checks.push({
          section,
          attempt: attempt + 1,
          reason: usableLightEdit
            ? "A larger edit could not finish. The draft that passed checks was kept."
            : (error as RewriteOutputLimitError).message,
        });
        break;
      }
      if (signal?.aborted) throw new Error("Generation stopped.");
      try {
        const restored = restoreRewriteSpans(candidate, generationLocks);
        const issues = reviewRewrite(originalPart, restored, mode, terms, text);
        if (issues.length) {
          keepClosingSentence ||= issues.some((issue) =>
            issue.startsWith(CLOSING_OMISSION),
          );
          checks.push({
            section,
            attempt: attempt + 1,
            reason: issues.join(" "),
          });
          const hasFatalIssue = issues.some(
            (iss) =>
              iss.includes("Numbers or amounts changed") ||
              iss.includes("The model returned no rewrite") ||
              iss.includes("Protected") ||
              iss.includes("Locked term changed") ||
              iss.includes("Quotation changed") ||
              iss.includes("Negation changed") ||
              iss.includes("Possibility wording changed") ||
              iss.startsWith(CLOSING_OMISSION),
          );
          if (attempt === 0) {
            feedback = preservationInstructions(originalPart, issues);
            continue;
          } else if (
            !hasFatalIssue &&
            !usableLightEdit &&
            locked.locks.length === 0 &&
            restored.trim() !== originalPart.trim()
          ) {
            accepted = restored;
            warnings.push(`Section ${section}: ${issues.join("; ")}`);
            break;
          } else {
            continue;
          }
        }
        if (restored.trim() === originalPart.trim()) {
          checks.push({
            section,
            attempt: attempt + 1,
            reason: "The model copied this section unchanged.",
          });
          feedback =
            "Your previous response copied the source unchanged. Improve sentence structure and phrasing while keeping the same meaning. Do not add or omit information.";
          if (attempt === 1) accepted = originalPart;
          continue;
        }
        if (
          tryLargerEdit &&
          rewriteExtent(originalPart, restored) < 0.2 &&
          attempt === 0
        ) {
          usableLightEdit = restored;
          checks.push({
            section,
            attempt: attempt + 1,
            reason: "The first draft made only small wording changes.",
          });
          feedback =
            "Recast more sentence openings and clause structures while keeping the original actions, claims, and qualifiers. Keep protected text verbatim.";
          continue;
        }
        accepted = restored;
        break;
      } catch (error) {
        checks.push({
          section,
          attempt: attempt + 1,
          reason: error instanceof Error ? error.message : String(error),
        });
        feedback =
          "Your previous draft changed protected markers. Keep every marker exactly once and rewrite only the surrounding prose.";
      }
    }
    if (
      usableLightEdit &&
      (!accepted ||
        rewriteExtent(originalPart, accepted) <
          rewriteExtent(originalPart, usableLightEdit))
    )
      accepted = usableLightEdit;
    if (accepted === null || accepted.trim() === originalPart.trim()) {
      // Small models can lose markers. Recover using real inference only on
      // sentences outside protected ranges; never repair a fact by guessing.
      const ranges = lockRewriteSpans(originalPart, terms).ranges!;
      const sentences = tokenizeSentences(originalPart);
      // In Full rewrite, retry qualified prose in smaller groups. Exact
      // facts remain locked during recovery, and each group must pass checks.
      const retryQualified =
        part.restructure || (checkExtent && sentences.length >= 3);
      const segments: {
        text: string;
        kind: "locked" | "qualified" | "plain";
      }[] = [];
      let cursor = 0;
      for (const sentence of sentences) {
        const hasLockedSpan = ranges.some(
          (range) => range.start < sentence.end && range.end > sentence.start,
        );
        const hasQualifier = QUALIFIED_SENTENCE.test(sentence.text);
        const kind =
          hasLockedSpan ||
          fixedSentences.has(sentence.text) ||
          (keepClosingSentence && sentence === sentences.at(-1)) ||
          (hasQualifier && !retryQualified)
            ? "locked"
            : hasQualifier
              ? "qualified"
              : "plain";
        const value = originalPart.slice(cursor, sentence.end);
        const previous = segments.at(-1);
        if (
          previous?.kind === kind &&
          !(part.restructure && kind === "qualified") &&
          (!outputLimited ||
            kind === "locked" ||
            previous.text.length + value.length <= 700)
        )
          previous.text += value;
        else segments.push({ text: value, kind });
        cursor = sentence.end;
      }
      if (cursor < originalPart.length)
        segments.push({ text: originalPart.slice(cursor), kind: "locked" });
      let recovered = "",
        recoveryCalls = 0;
      let retainedProtected = false;
      for (const segment of segments) {
        if (signal?.aborted) throw new Error("Generation stopped.");
        if (
          segment.kind === "locked" ||
          !segment.text.trim() ||
          recoveryCalls >= 4
        ) {
          recovered += segment.text;
          if (segment.kind !== "plain" && segment.text.trim())
            retainedProtected = true;
          continue;
        }
        recoveryCalls++;
        if (!editAroundProtected) retries++;
        onProgress(
          editAroundProtected
            ? `Rewriting editable passages in section ${section} of ${totalSections}…`
            : `Editing surrounding prose in section ${section} of ${totalSections}…`,
        );
        const leading = segment.text.match(/^\s*/)?.[0] ?? "";
        const trailing = segment.text.match(/\s*$/)?.[0] ?? "";
        if (editAroundProtected) {
          const excerpt = segment.text.trim();
          const edit = await rewriteEditableExcerpt({
            excerpt,
            systemPrompt:
              rewriteInstructions(mode, depth, styleNote, true, voiceGuidance) +
              (/^(?:it|they|he|she|this|that|these|those|such)\b/i.test(excerpt)
                ? subjectContext
                : ""),
            context: text,
            mode,
            terms,
            signal,
            generate,
          });
          retries += edit.retries;
          checks.push(...edit.checks.map((check) => ({ ...check, section })));
          recovered += leading + edit.text + trailing;
          continue;
        }
        let draft: string;
        try {
          draft = await generate({
            systemPrompt:
              rewriteInstructions(
                mode,
                depth,
                styleNote,
                part.restructure,
                voiceGuidance,
              ) +
              subjectContext +
              (part.restructure
                ? " " + rewriteQualifierInstructions(segment.text)
                : ""),
            userPrompt: `Edit this excerpt with its original meaning and purpose intact. Keep who does what, when and why. A sentence about how to judge success must still describe that criterion. Remove empty lead-ins rather than turning them into claims.${segment.kind === "qualified" ? " Keep every original negative expression and possibility word, attached to the same claims. Leave any difficult sentence intact." : ""} Return only the edited excerpt.\n\n${segment.text.trim()}`,
            attempt: 2,
          });
        } catch (error) {
          if (!(error instanceof RewriteOutputLimitError)) throw error;
          checks.push({
            section,
            attempt: 2 + recoveryCalls,
            reason: error.message,
          });
          recovered += segment.text;
          continue;
        }
        if (signal?.aborted) throw new Error("Generation stopped.");
        // Assess omissions against the whole recovered section below; a wordy
        // surrounding fragment may legitimately shrink more than the whole.
        const issues = reviewRewrite(
          segment.text,
          draft,
          "concise",
          terms,
          text,
        );
        if (issues.length || !draft.trim()) {
          checks.push({
            section,
            attempt: 2 + recoveryCalls,
            reason: issues.join(" ") || "No usable surrounding-prose edit.",
          });
          recovered += segment.text;
          if (segment.kind !== "plain") retainedProtected = true;
        } else {
          recovered += leading + draft.trim() + trailing;
          if (
            segment.kind === "qualified" &&
            draft.trim() === segment.text.trim()
          )
            retainedProtected = true;
        }
      }
      if (
        recovered.trim() !== originalPart.trim() &&
        reviewRewrite(originalPart, recovered, mode, terms, text).length === 0
      ) {
        accepted = recovered;
        warnings.push(
          retainedProtected
            ? `Section ${section}: protected sentences kept intact. The model revised smaller passages.`
            : `Section ${section}: the model revised smaller passages after the whole-section draft failed its checks.`,
        );
      }
    }
    if (
      depth === "rephrase" &&
      (mode === "standard" || mode === "professional") &&
      locked.locks.length === 0
    ) {
      const draft = accepted ?? originalPart;
      const sourceSentences = new Set(
        tokenizeSentences(originalPart).map(({ text }) => text),
      );
      let revised = draft;
      for (const sentence of tokenizeSentences(draft).reverse()) {
        if (!sourceSentences.has(sentence.text)) continue;
        const edit =
          restructureConditionalInstructions(sentence.text) ??
          restructureQualifiedBenefit(sentence.text) ??
          restructureFromSource(sentence.text);
        if (
          edit &&
          !reviewFocusedRewrite(sentence.text, edit, mode, terms, text).length
        )
          revised =
            revised.slice(0, sentence.start) +
            edit +
            revised.slice(sentence.end);
      }
      if (
        revised !== draft &&
        !reviewRewrite(originalPart, revised, mode, terms, text).length
      ) {
        accepted = revised;
        warnings.push(
          `Section ${section}: source wording was reorganized in sentences the model left unchanged.`,
        );
      }
    }
    if (accepted === null || accepted.trim() === originalPart.trim()) {
      retained++;
      accepted = originalPart;
      warnings.push(
        `Section ${section} retained: the model did not produce a changed draft that passed the checks.`,
      );
    }
    if (
      checkExtent &&
      accepted !== originalPart &&
      rewriteExtent(originalPart, accepted) < 0.2
    )
      warnings.push(
        `Section ${section}: the available draft contains light wording changes.`,
      );
    completed += accepted + part.separator;
  }
  const changed = completed.trim() !== text.trim();
  const lightFallback =
    depth === "rephrase" &&
    changed &&
    countWords(text) >= 60 &&
    rewriteExtent(text, completed) < 0.2;
  if (parts.length > sections.length && lightFallback)
    warnings.push("The completed draft contains light wording changes.");
  return {
    text: completed,
    parts: totalSections,
    retries,
    retained,
    warnings,
    elapsedMs: Math.round(performance.now() - started),
    changed,
    lightFallback,
    checks,
  };
}
