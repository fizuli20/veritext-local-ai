import { describe, expect, it, vi } from "vitest";
import {
  describeVoiceSample,
  suggestPersonalDetails,
} from "@/lib/humanizer/editor-guidance";
import { runRewritePipeline } from "@/lib/humanizer/rewrite-pipeline";

const sample =
  "I dropped my keys by the pier. I didn’t see them at first. A woman with a blue bag helped me look. She found them under a bench beside the lantern. I thanked her and caught the last ferry home.";

describe("editor guidance", () => {
  it("derives bounded guidance without copying sample details into the writing prompt", async () => {
    expect(describeVoiceSample("I wrote a short note.")).toBe("");
    expect(describeVoiceSample("word ".repeat(70))).toBe("");
    const voiceGuidance = describeVoiceSample(sample);
    expect(voiceGuidance).toContain("short, direct sentences");
    expect(voiceGuidance).toContain("Natural contractions");
    const generate = vi.fn(
      async ({ systemPrompt }: { systemPrompt: string }) => {
        expect(systemPrompt).toContain(voiceGuidance);
        expect(systemPrompt).toContain("Use a professional tone");
        expect(systemPrompt).toContain("Keep the source point of view");
        expect(systemPrompt).not.toMatch(/pier|lantern|ferry/);
        return "The library currently closes at 5 pm.";
      },
    );
    const result = await runRewritePipeline({
      text: "The library closes at 5 pm.",
      mode: "standard",
      depth: "rephrase",
      styleNote: "Use a professional tone",
      voiceGuidance,
      generate,
      onProgress: () => {},
    });
    expect(result.changed).toBe(true);
  });

  it("points to exact draft sentences and skips existing detail, quotes and code", () => {
    const draft = [
      'The transcript says, "Research shows a measurable impact."',
      "A snippet reads: `Recently we added a feature.`",
      "Research shows improved retention (Smith, 2024).",
      "Recently, the library changed its hours on Monday.",
      "Research shows this approach works.",
      "We plan to expand in the near future.",
      "Many residents need help with the form.",
      "The project could make a difference.",
      "Several participants asked questions.",
    ].join("\n\n");
    const hints = suggestPersonalDetails(draft);
    expect(hints.map(({ text }) => text)).toEqual([
      "Research shows this approach works.",
      "We plan to expand in the near future.",
      "Many residents need help with the form.",
      "The project could make a difference.",
    ]);
    for (const { start, end, text } of hints)
      expect(draft.slice(start, end)).toBe(text);
  });
});
