import { countWords, tokenizeSentences } from "../nlp/tokenizer";
import {
  reviewRewrite,
  preservationInstructions,
  quantityClaims,
  rewriteExtent,
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
export interface GenerateRewrite {
  (request: {
    systemPrompt: string;
    userPrompt: string;
    onText: (text: string) => void;
    attempt: number;
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
  checks: { section: number; attempt: number; reason: string }[];
}
export async function runRewritePipeline(options: {
  text: string;
  mode: string;
  depth?: RewriteDepth;
  terms?: string[];
  signal?: AbortSignal;
  generate: GenerateRewrite;
  onProgress: (message: string) => void;
  onText: (text: string) => void;
}): Promise<RewriteOutcome> {
  const {
    text,
    mode,
    depth = "polish",
    terms = [],
    signal,
    generate,
    onProgress,
    onText,
  } = options;
  const started = performance.now();
  const documentLocks = lockRewriteSpans(text, terms);
  const parts = splitRewrite(documentLocks.text);
  let completed = "",
    retries = 0,
    retained = 0;
  const warnings: string[] = [];
  const checks: RewriteOutcome["checks"] = [];
  for (let i = 0; i < parts.length; i++) {
    if (signal?.aborted) throw new Error("Generation stopped.");
    const part = parts[i]!;
    if (!part.text.trim()) {
      completed += part.text + part.separator;
      continue;
    }
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
    const preserveQuantityClaims = quantityClaims(originalPart).length > 0;
    let accepted: string | null = null;
    let feedback = "";
    let usableLightEdit: string | null = null;
    const checkExtent =
      depth === "rephrase" &&
      countWords(originalPart) >= 60 &&
      generationLocks.locks.length === 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) throw new Error("Generation stopped.");
      if (attempt) retries++;
      onProgress(
        `${attempt ? "Refining" : "Editing"} section ${i + 1} of ${parts.length}…`,
      );
      const candidate = await generate({
        systemPrompt:
          rewriteInstructions(mode, depth) +
          (preserveQuantityClaims
            ? " Keep any sentence reporting two or more quantities unchanged, including the actions and subjects tied to those amounts."
            : "") +
          (generationLocks.locks.length
            ? ` Preserve every ${locked.prefix}_number_END marker exactly once. Markers stand for protected source text; never modify them.`
            : ""),
        userPrompt: `${feedback ? feedback + "\n\n" : ""}Edit the following passage. Return only the edited passage.\n\n${generationLocks.text}`,
        attempt,
        onText: (value) => {
          const preview = restoreRewriteSpans(
            value,
            generationLocks,
            false,
          ).replace(new RegExp(locked.prefix + String.raw`\S*$`), "");
          onText(completed + preview);
        },
      });
      if (signal?.aborted) throw new Error("Generation stopped.");
      try {
        const restored = restoreRewriteSpans(candidate, generationLocks);
        const issues = reviewRewrite(originalPart, restored, mode, terms);
        if (issues.length) {
          checks.push({
            section: i + 1,
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
              iss.includes("Possibility wording changed"),
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
            warnings.push(`Section ${i + 1}: ${issues.join("; ")}`);
            break;
          } else {
            continue;
          }
        }
        if (restored.trim() === originalPart.trim()) {
          checks.push({
            section: i + 1,
            attempt: attempt + 1,
            reason: "The model copied this section unchanged.",
          });
          feedback =
            "Your previous response copied the source unchanged. Improve sentence structure and phrasing while keeping the same meaning. Do not add or omit information.";
          if (attempt === 1) accepted = originalPart;
          continue;
        }
        if (
          checkExtent &&
          rewriteExtent(originalPart, restored) < 0.2 &&
          attempt === 0
        ) {
          usableLightEdit = restored;
          checks.push({
            section: i + 1,
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
          section: i + 1,
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
      const retryQualified = checkExtent && sentences.length >= 3;
      const segments: {
        text: string;
        kind: "locked" | "qualified" | "plain";
      }[] = [];
      let cursor = 0;
      for (const sentence of sentences) {
        const hasLockedSpan = ranges.some(
          (range) => range.start < sentence.end && range.end > sentence.start,
        );
        const hasQualifier =
          /\b(?:no|not|never|neither|cannot|without|can|could|may|might)\b|n['’]t\b/i.test(
            sentence.text,
          );
        const kind =
          hasLockedSpan || (hasQualifier && !retryQualified)
            ? "locked"
            : hasQualifier
              ? "qualified"
              : "plain";
        const value = originalPart.slice(cursor, sentence.end);
        const previous = segments.at(-1);
        if (previous?.kind === kind) previous.text += value;
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
        retries++;
        onProgress(
          `Editing surrounding prose in section ${i + 1} of ${parts.length}…`,
        );
        const leading = segment.text.match(/^\s*/)?.[0] ?? "";
        const trailing = segment.text.match(/\s*$/)?.[0] ?? "";
        const prefix = completed + recovered + leading;
        const draft = await generate({
          systemPrompt: rewriteInstructions(mode, depth),
          userPrompt: `Edit this excerpt with its original meaning and purpose intact. Keep who does what, when and why. A sentence about how to judge success must still describe that criterion. Remove empty lead-ins rather than turning them into claims.${segment.kind === "qualified" ? " Keep every original negative expression and possibility word, attached to the same claims. Leave any difficult sentence intact." : ""} Return only the edited excerpt.\n\n${segment.text.trim()}`,
          attempt: 2,
          onText: (value) => onText(prefix + value),
        });
        if (signal?.aborted) throw new Error("Generation stopped.");
        // Assess omissions against the whole recovered section below; a wordy
        // surrounding fragment may legitimately shrink more than the whole.
        const issues = reviewRewrite(segment.text, draft, "concise", terms);
        if (issues.length || !draft.trim()) {
          checks.push({
            section: i + 1,
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
        reviewRewrite(originalPart, recovered, mode, terms).length === 0
      ) {
        accepted = recovered;
        warnings.push(
          retainedProtected
            ? `Section ${i + 1}: protected sentences kept intact. The model revised smaller passages.`
            : `Section ${i + 1}: the model revised smaller passages after the whole-section draft failed its checks.`,
        );
      }
    }
    if (accepted === null || accepted.trim() === originalPart.trim()) {
      retained++;
      accepted = originalPart;
      warnings.push(
        `Section ${i + 1} retained: the model did not produce a changed draft that passed the checks.`,
      );
    }
    if (
      checkExtent &&
      accepted !== originalPart &&
      rewriteExtent(originalPart, accepted) < 0.2
    )
      warnings.push(
        `Section ${i + 1}: the available draft contains light wording changes.`,
      );
    completed += accepted + part.separator;
    onText(completed);
  }
  return {
    text: completed,
    parts: parts.length,
    retries,
    retained,
    warnings,
    elapsedMs: Math.round(performance.now() - started),
    changed: completed.trim() !== text.trim(),
    checks,
  };
}
