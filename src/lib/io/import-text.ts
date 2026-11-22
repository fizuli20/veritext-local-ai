/** Parse supported documents locally. No network request contains document text. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export async function importTextFile(
  file: File,
  maxCharacters: number,
): Promise<string> {
  if (file.size > MAX_IMPORT_BYTES)
    throw new Error("Choose a document smaller than 10 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  let text: string;
  if (extension === "txt" || extension === "md") text = await file.text();
  else if (extension === "docx") {
    const { default: mammoth } = await import("mammoth");
    text = (
      await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    ).value;
  } else if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 100)
        throw new Error("Import up to 100 PDF pages at a time.");
      const pages: string[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) =>
              "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
            )
            .join(""),
        );
        if (pages.join("\n\n").length > maxCharacters)
          throw new Error(
            `This document exceeds ${maxCharacters.toLocaleString()} characters. Import a shorter section.`,
          );
        page.cleanup();
      }
      text = pages.join("\n\n");
    } finally {
      await task.destroy();
    }
  } else
    throw new Error("Choose a .txt, .md, .docx or text-based .pdf document.");
  text = text
    .replace(/\r\n?/g, "\n")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!text)
    throw new Error(
      "No readable text was found. Scanned PDFs need OCR before import.",
    );
  if (text.length > maxCharacters)
    throw new Error(
      `This document exceeds ${maxCharacters.toLocaleString()} characters. Import a shorter section; no text was truncated.`,
    );
  return text;
}
