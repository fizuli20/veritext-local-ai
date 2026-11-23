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
    const legacy = vi.fn();
    const result = await runRewritePipeline({
      text: original,
      mode: "standard",
      depth: "rephrase",
      onProgress: () => {},
      generate: legacy,
      generateParagraph: generate,
    });
    expect(legacy).not.toHaveBeenCalled();
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
});
