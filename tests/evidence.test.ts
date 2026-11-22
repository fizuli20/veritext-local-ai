import { describe, expect, it } from "vitest";
import {
  DETECTOR_PROFILES,
  wilsonInterval,
  describeEvidence,
  formatModelSignal,
  parseAiScore,
  tokenWindows,
} from "@/lib/detector/evidence";
import {
  reviewRewrite,
  rewriteInstructions,
  REWRITE_DEPTHS,
} from "@/lib/humanizer/rewrite-review";
const english =
  "The library offers a quiet place where students can read and learn together. ".repeat(
    10,
  );
describe("Detection evidence boundaries", () => {
  it("distinguishes small nonzero signals from zero and near-maximum scores from 100", () => {
    expect(formatModelSignal(0)).toBe("0");
    expect(formatModelSignal(0.0002)).toBe("<0.1");
    expect(formatModelSignal(0.004)).toBe("0.4");
    expect(formatModelSignal(0.975652)).toBe("97.6");
    expect(formatModelSignal(0.99998)).toBe(">99.9");
    expect(formatModelSignal(1)).toBe("100");
  });
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
    expect(describeEvidence(english, NaN).modelScore).toBeNull();
    expect(describeEvidence(english, 1.2).modelScore).toBeNull();
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
  it("uses the selected model's measured reference instead of sharing incompatible calibrations", () => {
    const detailed = describeEvidence(english, 0.9756, "detailed");
    expect(detailed.verdict).toBe("Elevated AI-like signal");
    expect(detailed.modelScore).toBe(0.9756);
    expect(detailed.referenceBin?.count).toBe(41);
    expect(
      describeEvidence(english, 0.9756, "light").referenceProbability,
    ).not.toBe(detailed.referenceProbability);
    expect(
      reviewRewrite(
        "The classes can help adults learn.",
        "The classes help adults learn.",
      ),
    ).toContain(
      "Possibility wording changed; check whether a qualified claim became certain.",
    );
  });
  it("requires the measured Detailed threshold even when the historical reference is elevated", () => {
    const threshold = DETECTOR_PROFILES.detailed.elevatedScoreFloor;
    const below = describeEvidence(english, threshold - 0.0001, "detailed");
    const atThreshold = describeEvidence(english, threshold, "detailed");
    expect(below.referenceProbability).toBeGreaterThan(0.8);
    expect(below.verdict).toBe("Inconclusive");
    expect(below.modelScore).toBe(threshold - 0.0001);
    expect(below.explanation).toContain("limit false flags");
    expect(atThreshold.verdict).toBe("Elevated AI-like signal");
    expect(atThreshold.calibratedProbability).toBeNull();
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
  it("separates rewriting depth from tone without relaxing factual preservation", () => {
    expect(Object.keys(REWRITE_DEPTHS)).toEqual(["polish", "rephrase"]);
    const full = rewriteInstructions("professional", "rephrase");
    expect(full).toContain("fresh version");
    expect(full).toContain("courteous professional");
    expect(full).toContain("all names, numbers");
    expect(full).toContain("every original claim and caveat");
    expect(rewriteInstructions("standard", "polish")).toContain(
      "restrained copy edit",
    );
  });
  it("flags repeated protected text rather than checking presence alone", () => {
    const text =
      'She said "wait". Read https://example.com/report for context.';
    expect(reviewRewrite(text, text + ' She said "wait".')).toContain(
      'Quotation changed: "wait"',
    );
    expect(
      reviewRewrite(text, text + " Read https://example.com/report.").some(
        (issue) => issue.startsWith("Protected url-email changed"),
      ),
    ).toBe(true);
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
