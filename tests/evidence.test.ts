import { describe, expect, it } from "vitest";
import {
  wilsonInterval,
  describeEvidence,
  parseAiScore,
  tokenWindows,
} from "@/lib/detector/evidence";
import {
  reviewRewrite,
  rewriteInstructions,
} from "@/lib/humanizer/rewrite-review";
const english =
  "The library offers a quiet place where students can read and learn together. ".repeat(
    10,
  );
describe("Detection evidence boundaries", () => {
  it("refuses unknown class polarity and selects the actual AI class", () => {
    expect(
      parseAiScore([
        { label: "human", score: 0.8 },
        { label: "ai", score: 0.2 },
      ]),
    ).toBe(0.2);
    expect(() => parseAiScore([{ label: "LABEL_1", score: 0.9 }])).toThrow();
    expect(() => parseAiScore([{ label: "ai", score: NaN }])).toThrow();
  });
  it("abstains for short or unsupported text and ambiguous scores", () => {
    expect(describeEvidence("Short text.", 0.99).status).toBe(
      "insufficient-text",
    );
    expect(
      describeEvidence(
        "这是一个关于语言的测试，我们讨论文字和写作。 ".repeat(100),
        0.99,
      ).status,
    ).toBe("unsupported-language");
    expect(describeEvidence(english, 0.55).status).toBe("uncertain");
    expect(describeEvidence(english, 0.99).calibratedProbability).toBeNull();
    expect(describeEvidence(english, 0.01).verdict).toBe(
      "Low signal · authorship unknown",
    );
    expect(describeEvidence(english, NaN).status).toBe("uncertain");
    expect(
      reviewRewrite("The temperature was -12.5.", "The temperature was 12.5."),
    ).toContain("Numbers or amounts changed.");
  });
  it("uses wide finite sample intervals and abstains when raw and reference signals disagree", () => {
    expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 1 });
    expect(wilsonInterval(0, 36).upper).toBeGreaterThan(0.09);
    expect(wilsonInterval(37, 37).lower).toBeLessThan(0.91);
    expect(describeEvidence(english, 0.88).status).toBe("uncertain");
  });
  it("covers every token without overflowing or repeating the final overlap", () => {
    const ids = Array.from({ length: 1000 }, (_, i) => i);
    const windows = tokenWindows(ids);
    expect(windows.map((w) => w.length)).toEqual([480, 480, 168]);
    expect([...new Set(windows.flat())]).toEqual(ids);
    expect(tokenWindows(Array.from({ length: 480 }, (_, i) => i))).toHaveLength(
      1,
    );
    expect(() => tokenWindows(ids, 64, 64)).toThrow();
  });
});
describe("Meaning review", () => {
  it("handles nested protected quotes and links without a false warning", () => {
    const text =
      'She wrote "please visit https://example.com for more information" in the memo.';
    expect(reviewRewrite(text, text)).toEqual([]);
  });
  it("flags added and removed numbers, short quotations, and reversed claims", () => {
    const original =
      'The trial did not succeed. Ana said "wait" in 2024 (Smith, 2024).';
    const changed = 'The trial succeeded. Ana said "go" in 2025 (Smith, 2024).';
    expect(reviewRewrite(original, changed)).toEqual(
      expect.arrayContaining([
        "Numbers or amounts changed.",
        'Quotation changed: "wait"',
        "Negation changed; check whether a claim was reversed.",
      ]),
    );
  });
  it("accepts tracked invariants while never claiming semantic proof", () => {
    expect(
      reviewRewrite("We did not find 15 errors.", "We found no errors."),
    ).toContain("Numbers or amounts changed.");
    expect(
      reviewRewrite(
        "We found 15 errors in 2024.",
        "In 2024, we found 15 errors.",
      ),
    ).toEqual([]);
    expect(rewriteInstructions("standard")).not.toMatch(
      /undetectable|bypass|human score/i,
    );
  });
});
