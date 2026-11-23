import { countWords, tokenizeSentences } from "../nlp/tokenizer";
import { cleanLlmOutput } from "./output-cleaner";
import { flagsPossibleMeaningChange } from "./paraphrase-review";
import {
  restructureFromSource,
  restructureConditionalInstructions,
  restructureQualifiedBenefit,
} from "./source-edits";
import {
  closingRecommendation,
  conditionalInstructions,
  protectedQualifiedSentences,
  quantityClaims,
  reviewFocusedRewrite,
  reviewRewrite,
  rewriteExtent,
  rewriteInstructions,
  writingStyleInstructions,
} from "./rewrite-review";

export interface ParagraphRequest {
  systemPrompt: string;
  userPrompt: string;
  responseSchema: string;
  attempt: number;
  maxTokens: number;
}

export type GenerateParagraph = (request: ParagraphRequest) => Promise<string>;

function parseEdits(raw: string): Record<string, unknown> {
  const result: unknown = JSON.parse(raw);
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new Error("The model returned an invalid edit plan.");
  return result as Record<string, unknown>;
}

/** Let the model read the whole paragraph. Apply only the checked replacements. */
export async function rewriteParagraph({
  text,
  mode,
  styleNote,
  voiceGuidance,
  terms,
  protectedRanges,
  signal,
  generate,
  generateBlock,
  onGenerate,
  onRetry,
}: {
  text: string;
  mode: string;
  styleNote?: string;
  voiceGuidance?: string;
  terms: string[];
  protectedRanges: { start: number; end: number }[];
  signal?: AbortSignal;
  generate: GenerateParagraph;
  generateBlock?: (
    request: Omit<ParagraphRequest, "responseSchema">,
  ) => Promise<string>;
  onGenerate?: () => void;
  onRetry: () => void;
}) {
  const sentences = tokenizeSentences(text);
  if (sentences.length < 4 || sentences.length > 12 || countWords(text) < 60)
    return null;
  // Preserve paragraph structure and list items through the existing path.
  if (/\n|^(?:[-*#>]\s|\d+[.)]\s)/.test(text.trim())) return null;

  const qualified = new Set(protectedQualifiedSentences(text));
  const conditional = new Set(conditionalInstructions(text));
  const sourceStyle = mode === "standard" || mode === "professional";
  const exactSentences = new Set([
    ...quantityClaims(text),
    closingRecommendation(text),
  ]);
  const parts = sentences.map((sentence, index) => {
    const locked =
      exactSentences.has(sentence.text) ||
      protectedRanges.some(
        (range) => range.start < sentence.end && range.end > sentence.start,
      );
    const qualifiedBenefit = qualified.has(sentence.text);
    const conditionalList = conditional.has(sentence.text);
    let sourceEdit: string | undefined;
    if (!locked && sourceStyle) {
      if (qualifiedBenefit)
        sourceEdit = restructureQualifiedBenefit(sentence.text);
      if (conditionalList)
        sourceEdit = restructureConditionalInstructions(sentence.text);
    }
    return {
      ...sentence,
      id: `s${index + 1}`,
      fixed: locked || ((qualifiedBenefit || conditionalList) && !sourceEdit),
      sourceEdit,
    };
  });
  const editable = parts.filter((part) => !part.fixed);
  if (editable.length < 2) return null;

  const systemPrompt = [
    "You edit prose for a reader. Change sentence openings or clause order where possible. Preserve meaning, the original language, facts, names, actions, and relationships.",
    "Keep questions, recommendations and criteria in their original roles. Preserve negation, uncertainty and both sides of comparisons. Do not add examples, evidence or explanations.",
    "Read all sentences for context. For each requested ID, return one replacement for that source sentence. It may become two short sentences. Never move a claim into another ID.",
    "Return only the JSON object. Use sentence IDs as keys and edited text as values. Avoid repeating the first few words of a sentence.",
    `Editing tone: ${mode}.`,
    writingStyleInstructions(styleNote ?? "", voiceGuidance ?? ""),
  ]
    .filter(Boolean)
    .join(" ");
  const source = JSON.stringify(
    Object.fromEntries(parts.map(({ id, text }) => [id, text])),
  );
  const edits = new Map<
    string,
    { text: string; extent: number; fromSource?: true; flagged?: boolean }
  >();
  if (sourceStyle) {
    for (const part of editable) {
      const edit = part.sourceEdit ?? restructureFromSource(part.text);
      if (
        edit &&
        !reviewFocusedRewrite(part.text, edit, mode, terms, text).length
      )
        edits.set(part.id, {
          text: edit,
          extent: rewriteExtent(part.text, edit),
          fromSource: true,
        });
    }
  }
  const problems = new Map<string, string>();
  let retries = 0;
  let requested = editable.filter(({ id }) => !edits.has(id));
  let block:
    | { start: number; end: number; text: string; edited: number }
    | undefined;
  if (generateBlock) {
    // A coherent passage is easier for an instruction model to edit in prose.
    // Keep the structured request for isolated sentences and failed blocks.
    const groups: (typeof parts)[] = [];
    let current: typeof parts = [];
    for (const part of parts) {
      if (part.fixed || part.sourceEdit) {
        if (current.length) groups.push(current);
        current = [];
      } else {
        current.push(part);
      }
    }
    if (current.length) groups.push(current);
    const group = groups
      .map((parts) => ({
        parts,
        unresolved: parts.filter(({ id }) => !edits.has(id)).length,
      }))
      .filter(
        ({ parts, unresolved }) =>
          unresolved > 0 && parts.length >= 2 && parts.length <= 7,
      )
      .sort((a, b) => b.unresolved - a.unresolved)[0]?.parts;
    if (group) {
      const start = group[0]!.start;
      const end = group.at(-1)!.end;
      const target = text.slice(start, end);
      const fallbackExtent = rewriteExtent(
        target,
        group.map(({ id, text }) => edits.get(id)?.text ?? text).join(" "),
      );
      const context = start > 0 ? parts[0]!.text : "";
      const qualifier = target.match(/\b(?:every|each) shift\b/i)?.[0];
      let feedback = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal?.aborted) throw new Error("Generation stopped.");
        if (attempt) {
          retries++;
          onRetry();
        } else {
          onGenerate?.();
        }
        let candidate: string;
        try {
          candidate = cleanLlmOutput(
            await generateBlock({
              systemPrompt:
                rewriteInstructions(
                  mode,
                  "rephrase",
                  styleNote,
                  true,
                  voiceGuidance,
                ) +
                (context
                  ? " One earlier sentence for context only: " +
                    JSON.stringify(context)
                  : ""),
              userPrompt:
                [
                  "Recast the target passage into clear prose. Use separate sentences for different actors where that helps. Keep independent requirements independent. Return the target passage only.",
                  qualifier
                    ? "Keep this exact qualifier attached to its original action: " +
                      JSON.stringify(qualifier) +
                      "."
                    : "",
                  feedback,
                ]
                  .filter(Boolean)
                  .join(" ") +
                "\n\n" +
                target,
              attempt,
              maxTokens: Math.min(900, Math.ceil(target.length / 3) + 95),
            }),
          );
        } catch (error) {
          if (signal?.aborted) throw error;
          break;
        }
        if (signal?.aborted) throw new Error("Generation stopped.");
        const edited = group.filter(
          (part) => !candidate.includes(part.text),
        ).length;
        const issues = reviewFocusedRewrite(
          target,
          candidate,
          mode,
          terms,
          text,
        );
        if (
          edited &&
          !issues.length &&
          rewriteExtent(target, candidate) > fallbackExtent
        ) {
          block = { start, end, text: candidate, edited };
          for (const { id } of group) edits.delete(id);
          requested = requested.filter(
            (part) => part.start < start || part.end > end,
          );
          break;
        }
        feedback = issues.length
          ? issues.join(" ")
          : "Use a new opening or clause order.";
      }
    }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal?.aborted) throw new Error("Generation stopped.");
    if (!requested.length) break;
    if (attempt) {
      retries++;
      onRetry();
    }
    const responseSchema = JSON.stringify({
      type: "object",
      properties: Object.fromEntries(
        requested.map(({ id }) => [id, { type: "string" }]),
      ),
      required: requested.map(({ id }) => id),
      additionalProperties: false,
    });
    const feedback = requested.map(({ id }) => ({
      id,
      instruction:
        problems.get(id) ??
        "Use a fresh opening or clause order and keep the same meaning.",
    }));
    let response: Record<string, unknown>;
    try {
      response = parseEdits(
        await generate({
          systemPrompt,
          userPrompt: `Edit only these sentence IDs: ${JSON.stringify(feedback)}\n\nSource paragraph in order:\n${source}`,
          responseSchema,
          attempt,
          maxTokens: Math.min(
            1000,
            Math.ceil(
              requested.reduce((size, part) => size + part.text.length, 0) / 3,
            ) +
              90 +
              requested.length * 15,
          ),
        }),
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      return buildResult();
    }
    if (signal?.aborted) throw new Error("Generation stopped.");
    for (const part of requested) {
      const value = response[part.id];
      if (typeof value !== "string") {
        problems.set(part.id, "Return the replacement for this ID.");
        continue;
      }
      const candidate = cleanLlmOutput(value);
      const issues = reviewFocusedRewrite(
        part.text,
        candidate,
        mode,
        terms,
        text,
      );
      if (issues.length) {
        problems.set(part.id, issues.join(" "));
        continue;
      }
      const extent = rewriteExtent(part.text, candidate);
      const flagged = flagsPossibleMeaningChange(part.text, candidate);
      if (flagged)
        problems.set(
          part.id,
          "Check who does each action and keep the original relationships clear.",
        );
      else if (extent < 0.3)
        problems.set(part.id, "Use a different opening or clause order.");
      else problems.delete(part.id);

      const previous = edits.get(part.id);
      // Prefer a retry without the advisory flag if it still makes a useful edit.
      // Retain a usable first candidate when the retry copies or fails review.
      if (
        extent > 0 &&
        (!previous ||
          (flagged === previous.flagged ? extent > previous.extent : !flagged))
      )
        edits.set(part.id, { text: candidate, extent, flagged });
    }
    requested = requested.filter(({ id }) => problems.has(id));
  }
  return buildResult();

  function buildResult() {
    const replacements = parts.flatMap(({ id, start, end }) => {
      const edit = edits.get(id);
      return edit ? [{ start, end, text: edit.text }] : [];
    });
    if (block) replacements.push(block);
    if (!replacements.length) return null;
    replacements.sort((a, b) => a.start - b.start);
    let cursor = 0;
    let draft = "";
    for (const part of replacements) {
      draft += text.slice(cursor, part.start) + part.text;
      cursor = part.end;
    }
    draft += text.slice(cursor);
    if (reviewRewrite(text, draft, mode, terms).length) return null;
    return {
      text: draft,
      retries,
      edited: edits.size + (block?.edited ?? 0),
      eligible: editable.length,
      fromSource: [...edits.values()].filter(({ fromSource }) => fromSource)
        .length,
    };
  }
}
