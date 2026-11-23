import { describe, expect, it, vi } from "vitest";
import {
  rewriteParagraph,
  type ParagraphRequest,
} from "@/lib/humanizer/paragraph-rewrite";
import {
  lockRewriteSpans,
  runRewritePipeline,
} from "@/lib/humanizer/rewrite-pipeline";
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
      edited: 5,
      eligible: 5,
      fromSource: 3,
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
    expect(result?.edited).toBe(3);
    expect(result?.fromSource).toBe(3);
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
      edited: 6,
      eligible: 10,
      fromSource: 6,
    });
    expect(result.parts).toBe(2);
  });

  it("retains the original frequency in a connected rewrite", () => {
    const text =
      "Staff need time to answer questions rather than spend every shift sorting returns.";
    expect(
      reviewFocusedRewrite(
        text,
        text.replace("every shift", "shifts"),
        "standard",
        [],
        text,
      ),
    ).toContain("Keep the original frequency of every shift.");
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
