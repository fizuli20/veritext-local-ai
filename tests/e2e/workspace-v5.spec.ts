import { expect, test, type Page } from "@playwright/test";

const source =
  'In 2024, Ana said "wait". The trial did not succeed. We need to review the results before making a decision.';
const draft = source.replace("We need to review", "We should review");

async function writingFixture(page: Page) {
  const passages: string[] = [];
  await page.route("http://localhost:1234/**", async (route) => {
    if (route.request().url().endsWith("/models"))
      return route.fulfill({ json: { data: [{ id: "workspace-fixture" }] } });
    const body = route.request().postDataJSON();
    const passage = body.messages.at(-1).content.split("\n\n").at(-1);
    passages.push(passage);
    const edited =
      passage === source
        ? draft
        : passage === "wait"
          ? "pause"
          : passage.replace("review the results", "go over the results");
    return route.fulfill({
      contentType: "text/event-stream",
      body:
        "data: " +
        JSON.stringify({ choices: [{ delta: { content: edited } }] }) +
        "\n\ndata: [DONE]\n\n",
    });
  });
  return passages;
}

async function createDraft(page: Page) {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(source);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveValue(draft);
}

test("revises only the selected text, protects a quote across the range boundary, and supports undo", async ({
  page,
}) => {
  const calls = await writingFixture(page);
  await createDraft(page);
  const output = page.getByRole("textbox", {
    name: "Edited draft",
    exact: true,
  });
  const revise = page.getByRole("button", { name: "Revise selection" });
  await expect(revise).toBeDisabled();
  async function select(text: string) {
    await output.evaluate((element: HTMLTextAreaElement, value) => {
      const start = element.value.indexOf(value);
      element.focus();
      element.setSelectionRange(start, start + value.length);
    }, text);
    await expect(revise).toBeEnabled();
  }
  await select("review the results");
  await revise.click();
  const updated = draft.replace("review the results", "go over the results");
  await expect(output).toHaveValue(updated);
  expect(calls.at(-1)).toBe("review the results");
  await expect(page.getByRole("status")).toHaveText(
    "Selected text revised. Review the updated draft.",
  );

  await select("wait");
  await revise.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Selection kept unchanged." }),
  ).toBeVisible();
  await expect(output).toHaveValue(updated);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(output).toHaveValue(draft);
  await expect(
    page.getByRole("textbox", { name: "Original text", exact: true }),
  ).toHaveValue(source);
});

test("keeps no workspace by default, restores opted-in texts, and clears the saved copy", async ({
  page,
}) => {
  await writingFixture(page);
  await createDraft(page);
  const remember = page.getByRole("checkbox", {
    name: "Remember this workspace",
  });
  await expect(remember).not.toBeChecked();
  const storedCopy = () =>
    page.evaluate(() => localStorage.getItem("veritext.workspace.v1"));
  expect(await storedCopy()).toBeNull();
  await page.getByRole("button", { name: "AI Detector", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill("Different detector input.");
  await remember.check();
  await expect
    .poll(async () => JSON.parse((await storedCopy()) ?? "{}").detectorInput)
    .toBe("Different detector input.");
  await page.reload();
  await expect(remember).toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "Original text", exact: true }),
  ).toHaveValue("Different detector input.");
  await page.getByRole("button", { name: "AI Humanizer", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Original text", exact: true }),
  ).toHaveValue(source);
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveValue(draft);
  await expect(page.getByText(/Restored draft ·/)).toBeVisible();
  await remember.uncheck();
  await expect.poll(storedCopy).toBeNull();
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveValue(draft);
  await page.reload();
  await expect(remember).not.toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "Original text", exact: true }),
  ).toHaveValue("");
});

test("guides rewrites with a private voice sample and selects optional detail prompts in the draft", async ({
  page,
}) => {
  const voice =
    "I dropped my keys by the pier. I didn’t see them at first. A woman with a blue bag helped me look. She found them under a bench beside the lantern. I thanked her and caught the last ferry home.";
  const original =
    "We plan to expand the library's weekend hours in the near future.";
  const revised =
    "We plan to extend the library's weekend hours in the near future.";
  const requests: string[] = [];
  await page.route("http://localhost:1234/**", async (route) => {
    if (route.request().url().endsWith("/models"))
      return route.fulfill({ json: { data: [{ id: "voice-fixture" }] } });
    requests.push(route.request().postData() ?? "");
    return route.fulfill({
      contentType: "text/event-stream",
      body:
        "data: " +
        JSON.stringify({ choices: [{ delta: { content: revised } }] }) +
        "\n\ndata: [DONE]\n\n",
    });
  });
  await page.goto("/");
  await page.getByText("Custom style", { exact: true }).click();
  const sample = page.getByRole("textbox", { name: "Your writing sample" });
  await sample.fill(voice);
  await expect(
    page.getByText(/Ready\. The editor uses your sentence rhythm/),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(original);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const editedDraft = page.getByRole("textbox", {
    name: "Edited draft",
    exact: true,
  });
  await expect(editedDraft).toHaveValue(revised);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain("Writing sample guidance");
  expect(requests[0]).not.toMatch(/pier|lantern|ferry/);
  await page.getByText(/Add your own details/).click();
  await expect(page.getByText(/When did this happen/)).toBeVisible();
  await page.getByRole("button", { name: "Show changes", exact: true }).click();
  await page
    .getByRole("button", { name: "Select in draft", exact: true })
    .click();
  await expect(editedDraft).toBeFocused();
  expect(
    await editedDraft.evaluate((el: HTMLTextAreaElement) =>
      el.value.slice(el.selectionStart, el.selectionEnd),
    ),
  ).toBe(revised);
  await editedDraft.fill(
    revised.replace("in the near future", "on December 5"),
  );
  await expect(page.getByText(/Add your own details/)).toHaveCount(0);
  const stored = () =>
    page.evaluate(() => localStorage.getItem("veritext.workspace.v1"));
  expect(await stored()).toBeNull();
  const remember = page.getByRole("checkbox", {
    name: "Remember this workspace",
  });
  await remember.check();
  await expect
    .poll(async () => JSON.parse((await stored()) ?? "{}").voiceSample)
    .toBe(voice);
  await page.reload();
  await page.getByText("Custom style", { exact: true }).click();
  await expect(sample).toHaveValue(voice);
  await remember.uncheck();
  await expect.poll(stored).toBeNull();
});

test("shows widely different checked paragraphs and exports the same passage summary", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor() {
        const script = `
          self.onmessage = ({data}) => {
            const split = data.text.indexOf("\\n\\n");
            self.postMessage({type:"result", id:data.id, text:data.text, tier:data.tier, engine:"Fixture detector",
              latencyMs:10, sentences:[], eligiblePassageCount:2,
              passages:[{start:0,end:split,wordCount:90,paragraph:1,score:0.08},{start:split+2,end:data.text.length,wordCount:90,paragraph:2,score:0.98}],
              evidence:{status:"uncertain", verdict:"Inconclusive", modelScore:0.7, calibratedProbability:null, explanation:"Fixture score."}
            });
          };
        `;
        super(
          URL.createObjectURL(new Blob([script], { type: "text/javascript" })),
        );
      }
    };
  });
  const paragraph =
    "The library offers visitors a quiet space to review documents and get assistance when needed. "
      .repeat(6)
      .trim();
  await page.goto("/");
  await page.getByRole("button", { name: "AI Detector", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(paragraph + "\n\n" + paragraph);
  await page.getByRole("button", { name: "Detect text", exact: true }).click();
  const report = page.getByTestId("detector-result");
  await expect(report).toContainText("70/100 model signal");
  await expect(report.getByTestId("paragraph-signal-summary")).toContainText(
    "Higher signal: 2 · Lower signal: 1",
  );
  const pending = page.waitForEvent("download");
  await report
    .getByRole("button", { name: "Save analysis", exact: true })
    .click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(
    JSON.parse(Buffer.concat(chunks).toString()).paragraphSignalSummary,
  ).toEqual({
    paragraphsScored: 2,
    highSignalParagraphs: [2],
    lowSignalParagraphs: [1],
    widelyDifferent: true,
  });
});
