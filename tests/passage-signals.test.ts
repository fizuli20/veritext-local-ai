import { describe, expect, it } from "vitest";
import { eligiblePassages } from "@/lib/detector/passages";

const longParagraph = "The library will reopen when the repairs are completed. "
  .repeat(10)
  .trim();
describe("Passage offsets for separate detector scores", () => {
  it("keeps exact original offsets and paragraph numbers across short and CRLF-separated paragraphs", () => {
    const text = `  ${longParagraph}\r\n \r\nShort interlude.\r\n\r\n  ${longParagraph}   `;
    const spans = eligiblePassages(text);
    expect(spans.map((span) => span.paragraph)).toEqual([1, 3]);
    expect(spans.map((span) => text.slice(span.start, span.end))).toEqual([
      longParagraph,
      longParagraph,
    ]);
  });
  it("skips a duplicate inference on text with only one paragraph", () => {
    expect(eligiblePassages(`\n\n${longParagraph}\n\n`)).toEqual([]);
  });
});
