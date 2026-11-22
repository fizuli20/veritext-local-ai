import { describe, it, expect } from "vitest";
import { importTextFile, MAX_IMPORT_BYTES } from "@/lib/io/import-text";
function file(name: string, text: string, size = text.length) {
  return { name, size, text: async () => text } as File;
}
describe("Private document import", () => {
  it("normalizes text/Markdown line endings without executing source markup", async () => {
    expect(
      await importTextFile(
        file("draft.md", "\uFEFF# Draft\r\n\r\n<script>source</script>"),
        100,
      ),
    ).toBe("# Draft\n\n<script>source</script>");
  });
  it("rejects unsupported, oversized, empty and over-limit documents without truncation", async () => {
    await expect(
      importTextFile(file("draft.html", "Text"), 100),
    ).rejects.toThrow("Choose a .txt");
    await expect(
      importTextFile(file("draft.txt", "", MAX_IMPORT_BYTES + 1), 100),
    ).rejects.toThrow("10 MB");
    await expect(importTextFile(file("draft.txt", "   "), 100)).rejects.toThrow(
      "No readable text",
    );
    await expect(
      importTextFile(file("draft.txt", "x".repeat(101)), 100),
    ).rejects.toThrow("no text was truncated");
  });
});
