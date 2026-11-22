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
