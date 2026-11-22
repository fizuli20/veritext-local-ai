import { describe, it, expect, vi } from "vitest";
import {
  lockRewriteSpans,
  restoreRewriteSpans,
  splitRewrite,
  runRewritePipeline,
} from "@/lib/humanizer/rewrite-pipeline";
const noop = () => {};
describe("Protected rewrite pipeline", () => {
  it("recovers from broken markers by editing surrounding prose while retaining fact-bearing sentences exactly", async () => {
    const text =
      'In 2024, Ana said "wait". At the present moment in time, we need to review the results.';
    let calls = 0;
    const result = await runRewritePipeline({
      text,
      mode: "concise",
      terms: ["Ana"],
      onText: noop,
      onProgress: noop,
      generate: async (request) => {
        calls++;
        if (calls <= 2) return "Invalid draft with missing facts.";
        expect(request.userPrompt).not.toContain("2024");
        expect(request.userPrompt).not.toContain("wait");
        return "We need to review the results now.";
      },
    });
    expect(calls).toBe(3);
    expect(result.changed).toBe(true);
    expect(result.text).toBe(
      'In 2024, Ana said "wait". We need to review the results now.',
    );
    expect(result.warnings.join(" ")).toContain(
      "protected sentences kept intact",
    );
  });
  it("accepts only complete known markers when the model varies whitespace, case or escaping", () => {
    const locked = lockRewriteSpans('In 2024, Ana said "wait".');
    const variant = locked.text
      .replace("VTLOCK_0_END", "vtlock 0 end")
      .replace("VTLOCK_1_END", String.raw`VTLOCK\_1\_END`);
    expect(restoreRewriteSpans(variant, locked)).toBe(
      'In 2024, Ana said "wait".',
    );
    expect(() =>
      restoreRewriteSpans(variant + " vtlock_999_end", locked),
    ).toThrow("unknown");
  });
  it("protects signs and scientific notation instead of overlooking reversed quantities", () => {
    const text = "Temperature was -12.5 and the tolerance was 1e-3.";
    const locked = lockRewriteSpans(text);
    expect(locked.locks.map((x) => x.value)).toEqual(["-12.5", "1e-3"]);
    expect(restoreRewriteSpans(locked.text, locked)).toBe(text);
  });
  it("restores exact short quotes, numbers, citations, code, URLs and locked names", () => {
    const text =
      'In 2024, Ana said "wait" (Smith, 2024). Cost: €1,250.50; limit 15%. See https://example.com/report and `x = 12`. VTLOCK is a source word.';
    const locked = lockRewriteSpans(text, ["Ana"]);
    expect(locked.prefix).not.toBe("VTLOCK");
    expect(locked.text).not.toContain("Ana");
    expect(restoreRewriteSpans(locked.text, locked)).toBe(text);
    expect(() =>
      restoreRewriteSpans(
        locked.text.replace(locked.locks[0]!.token, ""),
        locked,
      ),
    ).toThrow();
    expect(() =>
      restoreRewriteSpans(locked.text + locked.locks[0]!.token, locked),
    ).toThrow();
  });
  it("preserves complete long protected blocks and paragraph spacing when chunked", async () => {
    const text =
      "This is the opening paragraph.\n\n" +
      "```\n" +
      "const x = 12;\n".repeat(300) +
      "```\n\nThis is the closing paragraph.";
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      onProgress: noop,
      onText: noop,
      generate: async (request) => request.userPrompt.split("\n\n").at(-1)!,
    });
    expect(result.text).toContain(
      "```\n" + "const x = 12;\n".repeat(300) + "```",
    );
    expect(
      splitRewrite("  One.\n\nTwo.  ")
        .map((p) => p.text + p.separator)
        .join(""),
    ).toBe("  One.\n\nTwo.  ");
  });
  it("retries copied input and accepts a changed rewrite with locked facts", async () => {
    const text = "Ana did not review 40 applications in 2024.";
    const generate = vi.fn(async (request: { userPrompt: string }) => {
      const passage = request.userPrompt.split("\n\n").at(-1)!;
      return generate.mock.calls.length === 1
        ? passage
        : passage.replace("did not review", "did not examine");
    });
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      terms: ["Ana"],
      generate,
      onText: noop,
      onProgress: noop,
    });
    expect(result.retries).toBe(1);
    expect(result.retained).toBe(0);
    expect(result.text).toBe("Ana did not examine 40 applications in 2024.");
  });
  it("retains and labels the original section after repeated factual or unchanged failures", async () => {
    const text = "The experiment did not reduce costs by 15%.";
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      generate: async () => "The experiment reduced costs by 25%.",
      onText: noop,
      onProgress: noop,
    });
    expect(result.text).toBe(text);
    expect(result.retained).toBe(1);
    expect(result.changed).toBe(false);
    expect(result.warnings).toHaveLength(1);
  });
  it("never accepts a reversed claim on the second attempt when no facts are masked", async () => {
    const text =
      "The committee did not approve the proposal because the evidence was incomplete.";
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      onText: noop,
      onProgress: noop,
      generate: async () =>
        "The committee approved the proposal because the evidence was incomplete.",
    });
    expect(result.text).toBe(text);
    expect(result.changed).toBe(false);
    expect(
      result.checks.every((check) => check.reason.includes("Negation changed")),
    ).toBe(true);
  });
  it("does not erase a user's literal marker-like text during preview", () => {
    const source = "Keep __KEEP_4__ in the command documentation.";
    const locked = lockRewriteSpans(source);
    expect(restoreRewriteSpans(source, locked, false)).toBe(source);
  });
  it("passes full rewrite instructions to retries while rejecting reversed claims", async () => {
    const text =
      "The committee did not approve the proposal because the evidence was incomplete.";
    const generate = vi.fn(async (request) => {
      expect(request.systemPrompt).toContain("fresh version");
      return "The committee approved the proposal because the evidence was incomplete.";
    });
    const result = await runRewritePipeline({
      text,
      mode: "professional",
      depth: "rephrase",
      onText: noop,
      onProgress: noop,
      generate,
    });
    expect(result.text).toBe(text);
    expect(result.changed).toBe(false);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("gives full rewriting readable facts and rejects changed facts before accepting a retry", async () => {
    const text =
      'Ana reviewed 40 applications in 2024. She said "wait" and did not approve the proposal.';
    const generate = vi.fn(async (request) => {
      expect(request.userPrompt).toContain(text);
      expect(request.userPrompt).not.toContain("VTLOCK");
      return generate.mock.calls.length === 1
        ? 'Ana reviewed 41 applications in 2024. She said "wait" and did not approve the proposal.'
        : 'In 2024, Ana examined 40 applications. She said "wait" and did not approve the proposal.';
    });
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      terms: ["Ana"],
      onText: noop,
      onProgress: noop,
      generate,
    });
    expect(result.text).toContain("examined 40 applications");
    expect(result.changed).toBe(true);
    expect(result.retries).toBe(1);
    expect(result.checks[0]?.reason).toContain("Numbers or amounts changed");
  });
  it("keeps oversized protected blocks masked even in full rewrite mode", async () => {
    const text = "```\n" + "const x = 12;\n".repeat(300) + "```";
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      onText: noop,
      onProgress: noop,
      generate: async (request) => {
        expect(request.userPrompt.length).toBeLessThan(1000);
        expect(request.userPrompt).toContain("VTLOCK");
        return request.userPrompt.split("\n\n").at(-1)!;
      },
    });
    expect(result.text).toBe(text);
    expect(result.changed).toBe(false);
  });
  it("keeps a checked light edit when a stronger rewrite loses a qualifier", async () => {
    const text =
      "The neighborhood library can serve residents in several ways. Adults may learn how to use public services in evening classes. Students can bring their assignments to the quiet room. Volunteers help visitors sign up for new programs. Managers should check which programs serve people who do not already have a library card. The next meeting is about how to measure success.";
    const light = text.replace("next meeting", "upcoming meeting");
    const generate = vi.fn(async ({ attempt }) =>
      attempt === 0 ? light : text.replace("Adults may learn", "Adults learn"),
    );
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      onProgress: noop,
      onText: noop,
      generate,
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.text).toBe(light);
    expect(result.warnings.join(" ")).toContain("light wording changes");
    expect(
      result.checks.some((check) =>
        check.reason.includes("Possibility wording changed"),
      ),
    ).toBe(true);
  });

  it("includes the original qualifiers in instructions for a failed factual retry", async () => {
    const text =
      "The draft may be circulated after the review, but the board won’t approve it this week.";
    const generate = vi.fn(async ({ attempt, userPrompt }) => {
      if (attempt === 0)
        return "The draft will be circulated after the review, and the board will approve it this week.";
      expect(userPrompt).toContain(
        "Keep these qualifiers with their original claims: may",
      );
      expect(userPrompt).toContain(
        "negative expressions with their original claims: won’t",
      );
      return text.replace("circulated", "shared");
    });
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      onProgress: noop,
      onText: noop,
      generate,
    });
    expect(result.changed).toBe(true);
    expect(result.retries).toBe(1);
  });

  it("rewrites smaller qualified passages and retains any passage that fails its own checks", async () => {
    const text =
      "Adults may learn how to use public services in evening classes when the library is open. The staff prepare the rooms before the visitors arrive and leave the printed guides on the desks near the front of the room. The library will not require people to register in advance because the staff want residents to be able to drop in when they have time.";
    const generate = vi.fn(async ({ attempt, userPrompt }) => {
      if (attempt < 2)
        return text.replace("Adults may learn", "Adults will learn");
      const excerpt = userPrompt.split("\n\n").at(-1)!;
      if (excerpt.startsWith("Adults may"))
        return "In the evening, adults may learn to use public services in classes held during library hours.";
      if (excerpt.startsWith("The library will not"))
        return excerpt.replace("will not", "will");
      return excerpt;
    });
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      onProgress: noop,
      onText: noop,
      generate,
    });
    expect(result.text).toContain("In the evening, adults may learn");
    expect(result.text).toContain("The library will not require");
    expect(result.warnings.join(" ")).toContain(
      "protected sentences kept intact",
    );
    expect(generate).toHaveBeenCalledTimes(5);
  });

  it("does not accept a dropped approval action even when every number is retained", async () => {
    const fact =
      "In 2024, Ana reviewed 40 applications for Project Atlas and approved 12 for further study.";
    const text =
      fact + " The team will discuss the results at the next meeting.";
    const generate = vi.fn(async ({ attempt, systemPrompt }) => {
      if (attempt < 2) {
        expect(systemPrompt).toContain(
          "actions and subjects tied to those amounts",
        );
        return "In 2024, Ana received 40 applications for Project Atlas and 12 for further study. The team will discuss the results at the next meeting.";
      }
      return "At the next meeting, the team will discuss the results.";
    });
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      onProgress: noop,
      onText: noop,
      generate,
    });
    expect(result.text).toBe(
      fact + " At the next meeting, the team will discuss the results.",
    );
    expect(result.checks[0]?.reason).toContain(
      "Protected quantity claim changed",
    );
  });

  it("stops before generation and never substitutes a rule-based rewrite", async () => {
    const controller = new AbortController();
    controller.abort();
    const generate = vi.fn();
    await expect(
      runRewritePipeline({
        text: "Some source.",
        mode: "standard",
        signal: controller.signal,
        generate,
        onText: noop,
        onProgress: noop,
      }),
    ).rejects.toThrow("stopped");
    expect(generate).not.toHaveBeenCalled();
  });
});
