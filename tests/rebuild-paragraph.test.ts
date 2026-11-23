import { describe, expect, it, vi } from "vitest";
import { runRewritePipeline } from "@/lib/humanizer/rewrite-pipeline";
import { rebuildAudit, rebuiltDraft, rebuildSource } from "./fixtures/rebuild";

describe("whole paragraph rebuild", () => {
  it("lets the draft reorder source sentences and requires complete coverage", async () => {
    const generate = vi.fn().mockResolvedValueOnce(rebuiltDraft);
    const audit = vi.fn().mockResolvedValue(JSON.stringify(rebuildAudit));
    const result = await runRewritePipeline({
      text: "  " + rebuildSource + "  ",
      depth: "rebuild",
      mode: "standard",
      generate,
      generateParagraph: audit,
      onProgress: () => {},
    });
    expect(result).toMatchObject({
      text: "  " + rebuiltDraft + "  ",
      rebuilt: true,
      changed: true,
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]?.[0]).toMatchObject({
      userPrompt: expect.stringContaining("degree of certainty"),
      responseSchema: expect.stringContaining("coverage"),
    });
  });

  it("tries once more with feedback when the first draft copies the source", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(rebuildSource)
      .mockResolvedValueOnce(rebuiltDraft)
      .mockResolvedValueOnce(JSON.stringify(rebuildAudit));
    const result = await runRewritePipeline({
      text: rebuildSource,
      depth: "rebuild",
      mode: "standard",
      generate,
      onProgress: () => {},
    });
    expect(result).toMatchObject({
      rebuilt: true,
      retries: 1,
      text: rebuiltDraft,
    });
    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate.mock.calls[1]?.[0]).toMatchObject({
      attempt: 1,
      userPrompt: expect.stringContaining("Make a larger change"),
    });
  });

  it.each([
    { coverage: [[3], [], [1], [2]], added: [] },
    { coverage: [[3], [4], [1], [2]], added: [4] },
    { coverage: [[3], [9], [1], [2]], added: [] },
    { coverage: [[3], [3], [1], [2]], added: [] },
  ])(
    "keeps the audited draft unpublished if evidence is incomplete",
    async (audit) => {
      const generate = vi
        .fn()
        .mockResolvedValueOnce(rebuiltDraft)
        .mockResolvedValueOnce(JSON.stringify(audit))
        .mockResolvedValue(rebuildSource);
      const result = await runRewritePipeline({
        text: rebuildSource,
        depth: "rebuild",
        mode: "standard",
        generate,
        onProgress: () => {},
      });
      expect(result.rebuilt).toBeUndefined();
      expect(result.text).toBe(rebuildSource);
      expect(result.warnings[0]).toContain("could not verify");
    },
  );

  it("rejects a candidate that changes a protected quote before running the audit", async () => {
    const source = rebuildSource.replace("printed guide", '"printed guide"');
    const generate = vi
      .fn()
      .mockResolvedValueOnce(rebuiltDraft)
      .mockResolvedValue(source);
    const result = await runRewritePipeline({
      text: source,
      depth: "rebuild",
      mode: "standard",
      generate,
      onProgress: () => {},
    });
    expect(result.rebuilt).toBeUndefined();
    expect(result.text).toBe(source);
    expect(result.warnings[0]).toContain("source and structure checks");
    expect(
      generate.mock.calls.some(([request]) =>
        request.systemPrompt.includes("You check editorial accuracy."),
      ),
    ).toBe(false);
  });

  it("does not fall back after the user cancels the audit", async () => {
    const controller = new AbortController();
    const generate = vi
      .fn()
      .mockResolvedValueOnce(rebuiltDraft)
      .mockImplementationOnce(async () => {
        controller.abort(new Error("Stopped during review"));
        return JSON.stringify(rebuildAudit);
      });
    await expect(
      runRewritePipeline({
        text: rebuildSource,
        depth: "rebuild",
        mode: "standard",
        generate,
        onProgress: () => {},
        signal: controller.signal,
      }),
    ).rejects.toThrow("Stopped during review");
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
