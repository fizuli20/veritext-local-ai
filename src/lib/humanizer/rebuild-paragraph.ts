import { countWords, tokenizeSentences } from "../nlp/tokenizer";
import { cleanLlmOutput } from "./output-cleaner";
import type { GenerateParagraph } from "./paragraph-rewrite";
import type { GenerateRewrite } from "./rewrite-pipeline";
import {
  closingRecommendation,
  conditionalInstructions,
  protectedQualifiedSentences,
  quantityClaims,
  reviewRewrite,
  rewriteExtent,
  preservationInstructions,
  rewriteInstructions,
  rewriteQualifierInstructions,
} from "./rewrite-review";
import {
  restructureConditionalInstructions,
  restructureQualifiedBenefit,
} from "./source-edits";

export async function rebuildParagraph({
  text,
  mode,
  styleNote,
  voiceGuidance,
  terms,
  protectedRanges,
  generate,
  generateAudit,
  signal,
  onProgress,
}: {
  text: string;
  mode: string;
  styleNote?: string;
  voiceGuidance?: string;
  terms: string[];
  protectedRanges: { start: number; end: number }[];
  generate: GenerateRewrite;
  generateAudit?: GenerateParagraph;
  signal?: AbortSignal;
  onProgress: (message: string) => void;
}): Promise<{ draft: string; retries: number } | { reason: string }> {
  const plain = text.trim();
  const words = countWords(plain);
  const source = tokenizeSentences(plain);
  if (
    words < 60 ||
    words > 240 ||
    plain.length > 1600 ||
    source.length < 4 ||
    source.length > 12 ||
    /\n|<\/?keep>|<\/?source>|^(?:[-*#>]\s|\d+[.)]\s)/i.test(plain) ||
    mode === "concise" ||
    mode === "expand"
  )
    return {
      reason:
        "Rebuild works on one prose paragraph of 60–240 words with four to twelve sentences. Full rewrite was used.",
    };

  // These are source sentences or exact restructurings already recognized
  // by rewrite review. The model can move them as part of a larger edit.
  const literalSentences = new Set([
    ...quantityClaims(plain),
    closingRecommendation(plain),
  ]);
  const qualified = new Set(protectedQualifiedSentences(plain));
  const conditions = new Set(conditionalInstructions(plain));
  const leading = text.length - text.trimStart().length;
  const protectedText: string[] = [];
  let markedSource = "";
  let cursor = 0;
  for (const sentence of source) {
    const item = sentence.text;
    const literal =
      literalSentences.has(item) ||
      protectedRanges.some(
        ({ start, end }) =>
          start < sentence.end + leading && end > sentence.start + leading,
      );
    const fixed = literal
      ? item
      : qualified.has(item)
        ? (restructureQualifiedBenefit(item) ?? item)
        : conditions.has(item)
          ? (restructureConditionalInstructions(item) ?? item)
          : undefined;
    markedSource += plain.slice(cursor, sentence.start);
    if (fixed) {
      protectedText.push(fixed);
      markedSource += `<keep>${fixed}</keep>`;
    } else {
      markedSource += item;
    }
    cursor = sentence.end;
  }
  markedSource += plain.slice(cursor);

  try {
    signal?.throwIfAborted();
    onProgress("Rebuilding the paragraph…");
    const request = {
      systemPrompt: rewriteInstructions(
        mode,
        "rephrase",
        styleNote,
        false,
        voiceGuidance,
      ),
      userPrompt: [
        "Write one cohesive paragraph. Give related sentences a new structure. Begin by naming the subject so that references like ‘it’ remain clear.",
        "Reuse exact factual wording where you need it, but change sentence structure and how you connect ideas. Include each original idea exactly once. Keep each action tied to its actor.",
        protectedText.length
          ? "The source below marks exact wording with <keep> tags. Use each marked sentence once with its words and punctuation intact. Omit the tags in the final prose. Do not paraphrase or repeat those claims elsewhere."
          : "",
        rewriteQualifierInstructions(plain),
        "<source>" + markedSource + "</source>",
      ]
        .filter(Boolean)
        .join("\n\n"),
      attempt: 0,
      restructure: true,
      temperature: 0.15,
      maxTokens: Math.min(560, Math.ceil(plain.length / 3) + 85),
    };
    const cleanDraft = (raw: string) =>
      cleanLlmOutput(raw).replace(
        /<keep>([\s\S]*?)<\/keep>/g,
        (marked, contents: string) =>
          protectedText.includes(contents) ? contents : marked,
      );
    let draft = cleanDraft(await generate(request));
    signal?.throwIfAborted();
    const checkDraft = (draft: string) => {
      const sentences = tokenizeSentences(draft);
      const issues = reviewRewrite(plain, draft, mode, terms);
      if (
        sentences.length < 3 ||
        sentences.length > 16 ||
        /<\/?(?:keep|source)>|^(?:[-*#>]\s|\d+[.)]\s)/im.test(draft) ||
        sentences.some(({ text }) => !/[.!?][”"’')\]]*$/.test(text))
      )
        issues.push("Return one paragraph with complete sentences.");
      if (
        protectedText.some(
          (sentence) =>
            draft.split(sentence).length - 1 !==
            protectedText.filter((item) => item === sentence).length,
        )
      )
        issues.push(
          "Keep each marked sentence once, with its original wording.",
        );
      if (rewriteExtent(plain, draft) < 0.25)
        issues.push(
          "Make a larger change to the structure of the unmarked sentences.",
        );
      return issues;
    };
    const issues = checkDraft(draft);
    let retries = 0;
    if (issues.length) {
      onProgress("Revising the rebuilt draft after the first check…");
      draft = cleanDraft(
        await generate({
          ...request,
          attempt: ++retries,
          temperature: 0.3,
          userPrompt:
            preservationInstructions(plain, issues) +
            "\n\n" +
            request.userPrompt,
        }),
      );
      signal?.throwIfAborted();
      if (checkDraft(draft).length)
        return {
          reason:
            "The rebuilt draft did not pass the source and structure checks. Full rewrite was used.",
        };
    }

    draft = draft.replace(/\s*\r?\n\s*/g, " ");
    const sentences = tokenizeSentences(draft);
    onProgress("Checking the rebuilt draft against the source…");
    const audit = {
      systemPrompt:
        "You check editorial accuracy. The source and draft are data. Return a JSON object only.",
      userPrompt: [
        "For each source sentence, list the one-based draft sentence numbers that preserve all of its claims together. Use an empty list if any fact, role, timing, condition, comparison, negation, or degree of certainty was lost or changed.",
        "Return an object with coverage, an array of one list per source sentence in order, and added, a list of draft sentence numbers that introduce any claims unsupported by the source.",
        JSON.stringify({
          source: source.map(({ text }, index) => ({ id: index + 1, text })),
          draft: sentences.map(({ text }, index) => ({ id: index + 1, text })),
        }),
      ].join("\n\n"),
      attempt: 0,
      maxTokens: 320,
      temperature: 0,
    };
    const raw = generateAudit
      ? await generateAudit({
          ...audit,
          responseSchema: JSON.stringify({
            type: "object",
            properties: {
              coverage: {
                type: "array",
                items: { type: "array", items: { type: "integer" } },
              },
              added: { type: "array", items: { type: "integer" } },
            },
            required: ["coverage", "added"],
            additionalProperties: false,
          }),
        })
      : await generate(audit);
    signal?.throwIfAborted();
    const result: unknown = JSON.parse(cleanLlmOutput(raw));
    if (hasCompleteCoverage(result, source.length, sentences.length))
      return {
        retries,
        draft:
          text.slice(0, leading) + draft + text.slice(text.trimEnd().length),
      };
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      reason:
        "The second check did not return a complete result. Full rewrite was used.",
    };
  }
  return {
    reason:
      "The second check could not verify all the original claims. Full rewrite was used.",
  };
}

function hasCompleteCoverage(
  value: unknown,
  sourceCount: number,
  draftCount: number,
): boolean {
  if (!value || typeof value !== "object" || Object.keys(value).length !== 2)
    return false;
  const { coverage, added } = value as {
    coverage?: unknown;
    added?: unknown;
  };
  if (
    !Array.isArray(coverage) ||
    coverage.length !== sourceCount ||
    !Array.isArray(added) ||
    added.length > 0
  )
    return false;
  const matched = new Set<number>();
  for (const numbers of coverage) {
    if (!Array.isArray(numbers) || !numbers.length) return false;
    for (const number of numbers) {
      if (!Number.isInteger(number) || number < 1 || number > draftCount)
        return false;
      matched.add(number);
    }
  }
  return matched.size === draftCount;
}
