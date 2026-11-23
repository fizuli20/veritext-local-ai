import { test, expect } from "@playwright/test";
const source =
  'In 2024, Ana said "wait". The trial did not succeed. We need to review the results before making a decision.';
const edited =
  'In 2024, Ana said "wait". The trial did not succeed. We should review the results before making a decision.';

test("focused workspace, no automatic downloads, accessible setup, responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  const downloads: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("huggingface.co")) downloads.push(r.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good writing, in your own voice." }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Writing tools" }).getByRole("button"),
  ).toHaveCount(2);
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(source);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveCount(0);
  expect(downloads).toHaveLength(0);
  await page.getByRole("button", { name: "Close setup" }).click();
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("waits until the editor can retain text on a slow first load", async ({
  page,
}) => {
  let loadScripts = () => {};
  const scriptsReady = new Promise<void>((resolve) => {
    loadScripts = resolve;
  });
  await page.route("**/_next/static/chunks/**", async (route) => {
    if (route.request().resourceType() === "script") await scriptsReady;
    return route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(
      page.getByRole("textbox", { name: "Original text", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Try a sample" }),
    ).toBeDisabled();
  } finally {
    loadScripts();
  }
  const editor = page.getByRole("textbox", {
    name: "Original text",
    exact: true,
  });
  await editor.fill(source);
  await expect(editor).toHaveValue(source);
  await expect(
    page.getByRole("button", { name: "Rewrite", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Try a sample" }).click();
  await expect(editor).toHaveValue(/^A neighborhood library/);
});

test("short and non-English text receive no fake score", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "AI Detector", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Original text" })
    .fill("This is too short.");
  await page.getByRole("button", { name: "Detect text", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Too little text" }),
  ).toBeVisible();
  await expect(
    page.getByText("/100 model signal", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Original text" })
    .fill("这是一个关于语言的测试，我们讨论文字和写作。".repeat(30));
  await page.getByRole("button", { name: "Detect text", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "English model only" }),
  ).toBeVisible();
});

test("real worker executes its error path and clears the spinner on model download failure", async ({
  page,
}) => {
  await page.route("https://huggingface.co/**", (r) => r.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "AI Detector", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Original text" })
    .fill(
      "The library gives students a place to read their books and study together after school. ".repeat(
        8,
      ),
    );
  await page.getByRole("button", { name: "Detect text", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Neural detector unavailable" }),
  ).toBeVisible({ timeout: 25000 });
  await expect(
    page.getByRole("button", { name: "Detect text", exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId("detector-result")).toHaveCount(0);
});

test("local-server integration fixture: discovery, Gemma retry, streamed draft, diff and preservation", async ({
  page,
}) => {
  let completions = 0;
  await page.route("http://localhost:1234/**", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
        },
      });
    if (route.request().url().endsWith("/models"))
      return route.fulfill({
        json: { data: [{ id: "gemma-integration-fixture" }] },
      });
    completions++;
    if (completions === 1)
      return route.fulfill({ status: 400, body: "System role unsupported" });
    const body = route.request().postDataJSON();
    expect(body.messages[0].role).toBe("user");
    const prompt = body.messages.at(-1).content as string;
    const passage = prompt.split("\n\n").at(-1)!.replace(/\]$/, "");
    const maskedEdited = passage.replace(
      "We need to review",
      "We should review",
    );
    return route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: "<thought>Hidden reasoning</thought>" + maskedEdited } }] })}\n\ndata: [DONE]`,
    });
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(source);
  await page.getByRole("button", { name: "Set up AI", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByText("Connected · gemma-integration-fixture", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to editor" }).click();
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveValue(edited);
  await expect(
    page.getByText(/^Local model · gemma-integration-fixture/),
  ).toBeVisible();
  await expect(page.getByTestId("rewrite-review")).toContainText(
    "No changes to tracked",
  );
  await page.getByRole("button", { name: "Show changes", exact: true }).click();
  await expect(page.locator("ins").first()).toBeVisible();
  expect(completions).toBe(2);
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(source + " One more source detail.");
  await expect(page.getByRole("status")).toContainText("previous source");

  await page.getByRole("button", { name: "Edit draft", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Edited draft", exact: true })
    .fill(edited.replace("2024", "2025").replace("not ", ""));
  await expect(page.getByTestId("rewrite-review")).toContainText(
    "Numbers or amounts changed",
  );
  await expect(page.getByTestId("rewrite-review")).toContainText(
    "Negation changed",
  );
});

test("connection errors offer actionable setup without fake output", async ({
  page,
}) => {
  await page.route("http://localhost:1234/**", (r) => r.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Set up AI", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Enable CORS",
  );
  await expect(
    page.getByRole("button", { name: "Connect", exact: true }),
  ).toBeEnabled();
});

test("shows a local reasoning retry and publishes only the finished draft", async ({
  page,
}) => {
  let requests = 0;
  let unblock = () => {};
  const release = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  await page.route("http://localhost:11434/**", async (route) => {
    if (route.request().url().endsWith("/models"))
      return route.fulfill({ json: { data: [{ id: "qwen3:4b" }] } });
    const body = route.request().postDataJSON();
    requests++;
    expect(body.reasoning_effort).toBeUndefined();
    const passage = body.messages.at(-1).content.split("\n\n").at(-1);
    const accepted = passage.replace("We need to review", "We should review");
    if (requests === 2) await release;
    return route.fulfill({
      contentType: "text/event-stream",
      body:
        requests === 1
          ? 'data: {"choices":[{"delta":{"reasoning_content":"Private"}}]}\n\ndata: {"choices":[{"finish_reason":"length"}]}\n\n'
          : `data: ${JSON.stringify({ choices: [{ delta: { content: accepted }, finish_reason: "stop" }] })}\n\n`,
    });
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(source);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await page.getByRole("button", { name: "Ollama", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const draft = page.getByRole("textbox", {
    name: "Edited draft",
    exact: true,
  });
  try {
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Retrying with more room for the draft" }),
    ).toBeVisible();
    await expect(draft).toHaveCount(0);
  } finally {
    unblock();
  }
  await expect(draft).toHaveValue(edited);
  expect(requests).toBe(2);
});

test("rewrite retries copied text, preserves quotes and locked terms, and restores the previous draft", async ({
  page,
}) => {
  let attempts = 0;
  let retry = () => {};
  const allowRetry = new Promise<void>((resolve) => {
    retry = resolve;
  });
  await page.route("http://localhost:1234/**", async (route) => {
    if (route.request().url().endsWith("/models"))
      return route.fulfill({ json: { data: [{ id: "fixture-chat" }] } });
    const body = route.request().postDataJSON();
    const passage = body.messages.at(-1).content.split("\n\n").at(-1);
    attempts++;
    if (attempts === 2) await allowRetry;
    if (attempts === 3)
      return route.fulfill({ status: 503, body: "Fixture disconnected" });
    const draft =
      attempts === 1
        ? passage
        : passage.replace("We need to review", "We should review");
    return route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: draft } }] })}\n\ndata: [DONE]\n\n`,
    });
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(source);
  await page.getByLabel("Keep these names or terms exactly").fill("Ana");
  await page.getByRole("button", { name: "Set up AI", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByText("Connected · fixture-chat", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to editor" }).click();
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  try {
    await expect(page.getByRole("status")).toContainText("Refining section 1");
    await expect(
      page.getByRole("textbox", { name: "Edited draft", exact: true }),
    ).toHaveCount(0);
  } finally {
    retry();
  }
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveValue(edited);
  expect(attempts).toBe(2);
  await expect(page.getByText(/^Local model .*1 retry$/)).toBeVisible();
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Your last completed draft is still available." }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveValue(edited);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Previous draft restored.");
});

test("repeated invalid model output is retained and explicitly labelled, never presented as an improved rewrite", async ({
  page,
}) => {
  let calls = 0;
  await page.route("http://localhost:1234/**", async (route) => {
    if (route.request().url().endsWith("/models"))
      return route.fulfill({ json: { data: [{ id: "fixture-chat" }] } });
    calls++;
    return route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: "Ana changed the date to 2030 and claimed a success." } }] })}\n\ndata: [DONE]\n\n`,
    });
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(source);
  await page.getByRole("button", { name: "Set up AI", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByText("Connected · fixture-chat", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to editor" }).click();
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("original was retained");
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveValue(source);
  await expect(page.getByText(/^Local model.*Original retained/)).toBeVisible();
  await page.getByText("Rewrite checks", { exact: true }).click();
  await expect(
    page.getByText("Section 1 retained:", { exact: false }),
  ).toBeVisible();
  expect(calls).toBe(3);
});

test("long drafts above the old 4000-character limit are rewritten section by section with paragraph boundaries intact", async ({
  page,
}) => {
  const paragraph =
    "The team needs to review participant feedback before deciding which practical changes to make. "
      .repeat(8)
      .trim();
  const text = Array.from({ length: 7 }, () => paragraph).join("\n\n");
  expect(text.length).toBeGreaterThan(4000);
  let calls = 0;
  await page.route("http://localhost:1234/**", async (route) => {
    if (route.request().url().endsWith("/models"))
      return route.fulfill({ json: { data: [{ id: "fixture-chat" }] } });
    calls++;
    const body = route.request().postDataJSON();
    const passage = body.messages.at(-1).content.split("\n\n").at(-1);
    const draft = passage.replaceAll("needs to review", "should review");
    return route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: draft } }] })}\n\ndata: [DONE]\n\n`,
    });
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(text);
  await page.getByRole("button", { name: "Set up AI", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByText("Connected · fixture-chat", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to editor" }).click();
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveValue(text.replaceAll("needs to review", "should review"));
  expect(calls).toBe(7);
  await expect(page.getByRole("status")).toContainText(
    "7 of 7 sections edited",
  );
});

test("first rewrite resumes after explicit model setup instead of requiring another click", async ({
  page,
}) => {
  await page.route("http://localhost:1234/**", async (route) => {
    if (route.request().url().endsWith("/models"))
      return route.fulfill({
        json: { data: [{ id: "setup-resume-fixture" }] },
      });
    const body = route.request().postDataJSON();
    const passage = body.messages.at(-1).content.split("\n\n").at(-1);
    const draft = passage.replace("We need to review", "We should review");
    return route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: draft }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    });
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(source);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(
    page.getByText("Your rewrite will start automatically after setup."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveValue(edited);
  await page.route("https://huggingface.co/**", (route) => route.abort());
  await page
    .getByRole("button", { name: "Check edited draft", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Original text", exact: true }),
  ).toHaveValue(edited);
  await expect(
    page.getByRole("button", { name: "AI Detector", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "Too little text" }),
  ).toBeVisible();
});

test("compares two exact scans and returns to the original rewrite source", async ({
  page,
}) => {
  const original =
    "The library gives visitors a place to work quietly, ask questions, and borrow materials for projects. "
      .repeat(6)
      .trim();
  const draft = original.replaceAll(
    "gives visitors a place",
    "offers visitors a space",
  );
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor() {
        const code = `
          self.onmessage = ({data}) => self.postMessage({
            type: "result", id: data.id, text: data.text, tier: data.tier,
            engine: "Fixture detector", latencyMs: 10, sentences: [],
            evidence: {status:"uncertain", verdict:"Inconclusive",
              modelScore: data.text.includes("offers visitors") ? 0.63 : 0.82,
              calibratedProbability:null, explanation:"Fixture signal."}
          });
        `;
        super(
          URL.createObjectURL(new Blob([code], { type: "text/javascript" })),
        );
      }
    };
  });
  await page.route("http://localhost:1234/**", async (route) => {
    if (route.request().url().endsWith("/models"))
      return route.fulfill({ json: { data: [{ id: "comparison-fixture" }] } });
    return route.fulfill({
      contentType: "text/event-stream",
      body:
        "data: " +
        JSON.stringify({ choices: [{ delta: { content: draft } }] }) +
        "\n\ndata: [DONE]\n\n",
    });
  });
  await page.goto("/");
  const editor = page.getByRole("textbox", {
    name: "Original text",
    exact: true,
  });
  await editor.fill(original);
  await page
    .getByRole("button", { name: "Check original", exact: true })
    .click();
  await expect(page.getByTestId("detector-result")).toContainText(
    "82/100 model signal",
  );
  await page.getByRole("button", { name: "AI Humanizer", exact: true }).click();
  await expect(editor).toHaveValue(original);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const edited = page.getByRole("textbox", {
    name: "Edited draft",
    exact: true,
  });
  await expect(edited).toHaveValue(draft);
  await page
    .getByRole("button", { name: "Check edited draft", exact: true })
    .click();
  await expect(editor).toHaveValue(draft);
  await expect(page.getByTestId("detector-result")).toContainText(
    "63/100 model signal",
  );
  await expect(page.getByTestId("detector-result")).toContainText(
    "This is the exact draft from Veritext’s rewrite editor.",
  );
  await page
    .getByRole("button", { name: "Back to rewrite", exact: true })
    .click();
  await expect(editor).toHaveValue(original);
  await expect(edited).toHaveValue(draft);
  const comparison = page.getByText(
    /Detailed model signals.*Original 82\/100.*Edited draft 63\/100/,
  );
  await expect(comparison).toBeVisible();
  await edited.fill(draft + " Users can also ask about upcoming sessions.");
  await expect(comparison).toHaveCount(0);
});

test("imports real text, DOCX and PDF locally and leaves the source intact on invalid input", async ({
  page,
}) => {
  const errors: string[] = [];
  const documentUploads: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST" && !request.url().includes("_next"))
      documentUploads.push(request.url());
  });
  await page.goto("/");
  const input = page.getByLabel("Import document");
  const source = page.getByRole("textbox", {
    name: "Original text",
    exact: true,
  });
  await input.setInputFiles({
    name: "draft.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Review\n\nDo not change 2024."),
  });
  await expect(source).toHaveValue("# Review\n\nDo not change 2024.");
  await expect(page.getByRole("status")).toContainText(
    "No document was uploaded",
  );
  for (const extension of ["docx", "pdf"]) {
    await input.setInputFiles(`tests/fixtures/import-probe.${extension}`);
    await expect(page.getByRole("status")).toContainText(
      `Imported import-probe.${extension}`,
    );
    await expect(source).toHaveValue(
      /The meeting did not approve the plan in 2024\./,
    );
    await expect(source).toHaveValue(
      /Review the 12 applications before the next meeting\./,
    );
    await expect(page.getByRole("alert").filter({ hasText: /.+/ })).toHaveCount(
      0,
    );
  }
  const preserved = await source.inputValue();
  await input.setInputFiles({
    name: "too-long.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("x".repeat(12001)),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "no text was truncated" }),
  ).toBeVisible();
  await expect(source).toHaveValue(preserved);
  await input.setInputFiles({
    name: "bad.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a PDF"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: /Invalid PDF|PDF/ }),
  ).toBeVisible();
  await expect(source).toHaveValue(preserved);
  expect(documentUploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("exports the actual scan with uncertainty and no invented authorship probability", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "AI Detector", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill("Short source text.");
  await page.getByRole("button", { name: "Detect text", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save analysis", exact: true })
    .click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const report = JSON.parse(Buffer.concat(chunks).toString());
  expect(report.schema).toBe("veritext.neural-scan.v1");
  expect(report.text).toBe("Short source text.");
  expect(report.evidence.status).toBe("insufficient-text");
  expect(report.evidence.modelScore).toBeNull();
  expect(report.evidence.calibratedProbability).toBeNull();
  expect(report.limitation).toContain("not proof of authorship");
});

test("rewrite depth reaches the engine and the completed draft keeps its depth label", async ({
  page,
}) => {
  const prompts: string[] = [];
  await page.route("http://localhost:1234/**", async (route) => {
    if (route.request().url().endsWith("/models"))
      return route.fulfill({ json: { data: [{ id: "depth-fixture" }] } });
    const body = route.request().postDataJSON();
    prompts.push(body.messages[0].content);
    const passage = body.messages.at(-1).content.split("\n\n").at(-1);
    const draft = passage.replace("We need to review", "We should review");
    return route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: draft }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    });
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(source);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveValue(edited);
  expect(prompts[0]).toContain("fresh version");
  await page.getByRole("button", { name: "Light edit", exact: true }).click();
  await expect(
    page.getByText(/^Local model · depth-fixture · Full rewrite/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(
    page.getByText(/^Local model · depth-fixture · Light edit/),
  ).toBeVisible();
  expect(prompts.at(-1)).toContain("restrained copy edit");
});

test("shows a nonzero detector signal below one point and preserves the exact export score", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor() {
        const code = `
          self.onmessage = ({data}) => self.postMessage({
            type: "result", id: data.id, text: data.text, engine: "Fixture detector",
            latencyMs: 10, sentences: [],
            evidence: {status:"signal", verdict:"Low signal · authorship unknown", modelScore:0.0002, calibratedProbability:null, explanation:"Fixture low signal."}
          });
        `;
        super(
          URL.createObjectURL(new Blob([code], { type: "text/javascript" })),
        );
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "AI Detector", exact: true }).click();
  await page.getByRole("button", { name: "Try a sample" }).click();
  await page.getByRole("button", { name: "Detect text" }).click();
  const report = page.getByTestId("detector-result");
  await expect(
    report.getByRole("heading", { name: "Low signal · authorship unknown" }),
  ).toBeVisible();
  await expect(report).toContainText("<0.1/100 model signal");
  const downloading = page.waitForEvent("download");
  await report
    .getByRole("button", { name: "Save analysis", exact: true })
    .click();
  const stream = await (await downloading).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString()).evidence.modelScore).toBe(
    0.0002,
  );
});

test("presents a saturated detector value as a model signal and exports its exact value", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor() {
        const code = `
          self.onmessage = ({data}) => self.postMessage({
            type: "result", id: data.id, text: data.text, engine: "Fixture detector",
            latencyMs: 10, sentences: [],
            evidence: {status:"signal", verdict:"Elevated AI-like signal", modelScore:1, calibratedProbability:null, explanation:"Fixture high signal."}
          });
        `;
        super(
          URL.createObjectURL(new Blob([code], { type: "text/javascript" })),
        );
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "AI Detector", exact: true }).click();
  await page.getByRole("button", { name: "Try a sample" }).click();
  await page.getByRole("button", { name: "Detect text" }).click();
  const report = page.getByTestId("detector-result");
  await expect(report).toContainText(">99.9/100 model signal");
  await expect(report).toContainText("at the top of the model’s scale");
  const downloading = page.waitForEvent("download");
  await report
    .getByRole("button", { name: "Save analysis", exact: true })
    .click();
  const stream = await (await downloading).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString()).evidence.modelScore).toBe(
    1,
  );
});

test("keeps the document result available while adding context highlights and after stopping", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor() {
        const code = `
          self.onmessage = ({data}) => {
            const {id, text} = data;
            const evidence = {status:"signal", verdict:"Elevated AI-like signal", modelScore:0.98, calibratedProbability:null, explanation:"Fixture document result."};
            const draft = {id, text, evidence, engine:"Fixture detector", latencyMs:25,
              contextLimit:2, contextTarget:2, sentences:[{start:0,end:20,score:null},{start:20,end:text.length,score:null}], passages:[]};
            self.postMessage({type:"partial-result", ...draft});
            setTimeout(() => {
              draft.sentences[0].score = 0.91;
              self.postMessage({type:"partial-result", ...draft});
            }, 400);
          };
        `;
        super(
          URL.createObjectURL(new Blob([code], { type: "text/javascript" })),
        );
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "AI Detector", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Original text", exact: true })
    .fill(
      "The library staff is considering changing the opening hours to make it easier for residents to visit. ".repeat(
        6,
      ),
    );
  await page.getByRole("button", { name: "Detect text" }).click();
  await expect(
    page.getByText("Checked 0 of 2 sentence contexts."),
  ).toBeVisible();
  await expect(
    page.getByText("Checked 1 of 2 sentence contexts."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Elevated AI-like signal" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check more contexts" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Veritext text analysis" }),
  ).not.toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("heading", { name: "Veritext text analysis" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Original text", exact: true }),
  ).not.toBeVisible();
  expect((await page.pdf()).subarray(0, 5).toString()).toBe("%PDF-");
});
