import { describe, expect, it, vi } from "vitest";
import {
  rewriteParagraph,
  type ParagraphRequest,
} from "@/lib/humanizer/paragraph-rewrite";
import {
  lockRewriteSpans,
  runRewritePipeline,
} from "@/lib/humanizer/rewrite-pipeline";
import { flagsPossibleMeaningChange } from "@/lib/humanizer/paraphrase-review";
import { restructureFromSource } from "@/lib/humanizer/source-edits";
import {
  reviewFocusedRewrite,
  reviewRewrite,
} from "@/lib/humanizer/rewrite-review";

const original = [
  "A neighborhood library can do more than lend books.",
  "Its programs give people a place to study, meet neighbors, and practice skills.",
  "The library will run 12 sessions after the summer break.",
  "These services depend on practical choices about opening hours and staffing.",
  "Before expanding, managers should ask visitors what they use, speak to people who stay away, and check where current services are limited.",
  "A small change to the timetable may help more readers than an expensive renovation.",
  "The useful measure is whether the library makes everyday life easier for the community it serves.",
].join("  ");

describe("paragraph-context editing", () => {
  it("combines safe model edits with source-based edits and preserves exact sentences", async () => {
    const generate = vi.fn(async (request: ParagraphRequest) => {
      if (request.attempt === 0) {
        return JSON.stringify({
          s2: "Through its programs, people have somewhere to study, get to know neighbors, and practice skills.",
          s3: "The library will run 30 sessions after the summer break.",
          s4: "The library won't need staff or opening hours.",
        });
      }
      return JSON.stringify({
        s4: "Decisions about opening hours and staffing shape how these services work.",
      });
    });
    const prose = vi.fn(async () => {
      throw new Error("The fixture has only individual sentence edits.");
    });
    const result = await runRewritePipeline({
      text: original,
      mode: "standard",
      depth: "rephrase",
      voiceGuidance: "Favor short, direct sentences.",
      onProgress: () => {},
      generate: prose,
      generateParagraph: generate,
    });
    expect(prose).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]?.[0].systemPrompt).toContain(
      "Writing sample guidance for sentence rhythm and vocabulary: Favor short, direct sentences.",
    );
    expect(generate.mock.calls[0]?.[0].userPrompt).toContain(
      "The library will run 12 sessions",
    );
    expect(
      generate.mock.calls.map(
        ([request]) => JSON.parse(request.responseSchema).required,
      ),
    ).toEqual([["s2", "s4"], ["s4"]]);
    expect(result.sentenceEdits).toEqual({
      edited: 6,
      eligible: 6,
      fromSource: 4,
    });
    expect(result.lightFallback).toBe(false);
    expect(result.retries).toBe(1);
    expect(result.text).toContain(
      "The library will run 12 sessions after the summer break.  Decisions",
    );
    expect(result.text).toContain(
      "An expensive renovation may help fewer readers than a small change to the timetable.",
    );
  });

  it("can still apply source-based edits when the model response is incomplete", async () => {
    const result = await rewriteParagraph({
      text: original,
      mode: "standard",
      terms: [],
      protectedRanges: lockRewriteSpans(original).ranges ?? [],
      generate: async () => '{"s2":',
      onRetry: () => {},
    });
    expect(result?.edited).toBe(4);
    expect(result?.fromSource).toBe(4);
    expect(result?.text).toContain("Its programs give people a place to study");
  });

  it("leaves possessive comparisons and negated conditions for the model", () => {
    expect(
      restructureFromSource(
        "A branch may help more of its visitors than a library.",
      ),
    ).toBeUndefined();
    expect(
      restructureFromSource(
        "The clinic will not stay open because the school is closed.",
      ),
    ).toBeUndefined();
    expect(
      restructureFromSource("The clinic stays open when the school is closed."),
    ).toBe("When the school is closed, the clinic stays open.");
    expect(
      restructureFromSource("A technician left the machine on its own."),
    ).toBeUndefined();
    expect(
      restructureFromSource(
        "A larger building will not solve those problems on its own.",
      ),
    ).toBe("On its own, a larger building will not solve those problems.");
  });

  it("preserves paragraph breaks and totals the edits across the document", async () => {
    const result = await runRewritePipeline({
      text: `${original}\r\n\r\n${original}`,
      mode: "standard",
      depth: "rephrase",
      onProgress: () => {},
      generate: async () => "",
      generateParagraph: async () => "{}",
    });
    expect(result.text.split("\r\n\r\n")).toHaveLength(2);
    expect(result.sentenceEdits).toEqual({
      edited: 8,
      eligible: 12,
      fromSource: 8,
    });
    expect(result.parts).toBe(2);
  });

  it("rewrites protected benefit sentences through source-preserving transformations", async () => {
    const passage = [
      "The community center runs classes and shares equipment with nearby residents.",
      "It gives volunteers a place to practice skills they might not have used before.",
      "Weekend classes can help beginners learn repair skills, while workshop stations give members somewhere to finish projects after class.",
      "The main entrance on the south side of the building will remain open during the center's normal operating hours throughout the week.",
    ].join(" ");
    const result = await rewriteParagraph({
      text: passage,
      mode: "standard",
      terms: [],
      protectedRanges: [],
      generate: async () => "{}",
      onRetry: () => {},
    });
    expect(result?.fromSource).toBe(2);
    expect(result?.text).toContain(
      "It gives volunteers somewhere to practice skills they might not have used before.",
    );
    expect(result?.text).toContain(
      "While workshop stations give members somewhere to finish projects after class, weekend classes can help beginners learn repair skills.",
    );
    expect(reviewRewrite(passage, result!.text)).toEqual([]);
    expect(
      reviewRewrite(
        passage,
        result!.text.replace("help beginners", "help members"),
      ),
    ).toContain(
      "Protected qualified claim changed. Retain its original subjects and their separate actions.",
    );
  });

  it("retries an overlapping sentence when the trained review flags a role change", async () => {
    const source =
      "The safety officer gave the new instructions to the workers before closing.";
    const swapped =
      "The workers gave the new instructions to the safety officer before closing.";
    const revised =
      "Before closing, the safety officer handed the new instructions to the workers.";
    expect(flagsPossibleMeaningChange(source, swapped)).toBe(true);
    expect(flagsPossibleMeaningChange(source, revised)).toBe(false);
    const passage = [
      "Training at the facility included discussion and an exercise in which people practiced responding to a spill.",
      source,
      "Everyone at the facility received a copy of the safety materials.",
      "After lunch, the class returned to the training room on the ground floor to finish the exercise with a discussion about emergency equipment.",
    ].join(" ");
    const generate = vi.fn(async (request: ParagraphRequest) =>
      JSON.stringify({ s2: request.attempt > 0 ? revised : swapped }),
    );
    const result = await rewriteParagraph({
      text: passage,
      mode: "standard",
      terms: [],
      protectedRanges: [],
      generate,
      onRetry: () => {},
    });
    expect(generate.mock.calls[1]![0].userPrompt).toContain(
      "Check who does each action",
    );
    expect(result?.text).toContain(revised);
    expect(result?.text).not.toContain(swapped);
  });

  it("retains the original frequency in a connected rewrite", () => {
    const text =
      "Staff need time to answer questions rather than spend every shift sorting returns.";
    expect(
      reviewRewrite(text, text.replace("every shift", "shifts")),
    ).toContain(
      "Protected frequency changed. Keep the original frequency of every shift.",
    );
    expect(
      reviewFocusedRewrite(
        text,
        text.replace("every shift", "each shift"),
        "standard",
        [],
        text,
      ),
    ).toEqual([]);
  });

  it("keeps independent requirements from becoming cause and effect", () => {
    const original =
      "Opening hours need to match local residents' lives, and staff need time to answer questions rather than spend every shift sorting returns.";
    const inaccurate =
      "Opening hours should fit local residents' schedules. This allows staff to answer questions rather than spend every shift sorting returns.";
    const faithful = inaccurate.replace(
      "This allows staff",
      "Staff also need time",
    );
    expect(
      reviewFocusedRewrite(original, inaccurate, "standard", [], original),
    ).toContain(
      "Keep the original duties independent. Do not make one duty a cause or result of the other.",
    );
    expect(
      reviewFocusedRewrite(original, faithful, "standard", [], original),
    ).toEqual([]);
  });

  it("keeps public hours explicit and catches a direct reversal of a comparison", () => {
    const scheduling = "Opening hours should match local residents' schedules.";
    expect(
      reviewRewrite(
        scheduling,
        scheduling.replace("Opening hours", "Openings"),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Protected operating schedule changed"),
      ]),
    );
    expect(
      reviewRewrite(
        scheduling,
        scheduling.replace("Opening hours", "Hours of operation"),
      ),
    ).toEqual([]);

    const choice =
      "A schedule change may serve more residents than a capital project.";
    expect(
      reviewRewrite(
        choice,
        "A capital project may serve more residents than a schedule change.",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Protected comparison reversed"),
      ]),
    );
    expect(
      reviewRewrite(
        choice,
        "A capital project may serve fewer residents than a schedule change.",
      ),
    ).toEqual([]);
  });

  it("tries a connected edit before using a safe source-based replacement", async () => {
    const start = "A larger building will not solve those problems on its own.";
    const detail =
      "Practical choices about available services determine whether attendance improves.";
    const text = [
      "Neighbors across the district often use this community center for activities and services they cannot find close to home, including meetings on weekday evenings and informal drop-in events for residents throughout the year.",
      "The center will offer 12 sessions for 18 participants.",
      start,
      detail,
    ].join(" ");
    const connected = [
      "On its own, a larger building will not solve those problems.",
      "Better attendance depends on decisions about which services to offer.",
    ].join(" ");

    const generate = vi.fn(async ({ attempt }: { attempt: number }) =>
      attempt === 0
        ? connected.replace("will not solve", "will solve")
        : connected,
    );
    const result = await rewriteParagraph({
      text,
      mode: "standard",
      terms: [],
      protectedRanges: lockRewriteSpans(text).ranges ?? [],
      generate: async () => "{}",
      generateBlock: generate,
      onRetry: () => {},
    });
    expect(generate.mock.calls[0]![0]).toHaveProperty(
      "userPrompt",
      expect.stringContaining(start + " " + detail),
    );
    expect(generate.mock.calls[1]![0]).toHaveProperty(
      "userPrompt",
      expect.stringContaining("Negation changed"),
    );
    expect(result?.text).toContain(connected);
    expect(result?.fromSource).toBe(0);
  });

  it("uses a prose retry with the exact qualifier before falling back", async () => {
    const duty =
      "Staff need time to answer questions rather than spend every shift sorting returns.";
    const revised =
      "Practical decisions about opening hours and staffing shape these services. Rather than spending every shift sorting returns, staff need time to answer questions.";
    const source = original.replace(
      "opening hours and staffing.",
      `opening hours and staffing. ${duty}`,
    );
    const generate = vi.fn(async ({ attempt }: { attempt: number }) =>
      attempt ? revised : revised.replace("every shift", "shifts"),
    );
    const result = await runRewritePipeline({
      text: source,
      mode: "standard",
      depth: "rephrase",
      onProgress: () => {},
      generate,
      generateParagraph: async () => "{}",
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0]?.[0]).toHaveProperty(
      "userPrompt",
      expect.stringContaining("Keep this exact qualifier"),
    );
    expect(generate.mock.calls[1]?.[0]).toHaveProperty(
      "userPrompt",
      expect.stringContaining("Keep the original frequency"),
    );
    expect(result.text).toContain(revised);
  });
});
