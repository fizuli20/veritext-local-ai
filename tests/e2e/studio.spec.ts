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

test("rewrite retries copied text, preserves quotes and locked terms, and restores the previous draft", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("http://localhost:1234/**", async (route) => {
    if (route.request().url().endsWith("/models"))
      return route.fulfill({ json: { data: [{ id: "fixture-chat" }] } });
    const body = route.request().postDataJSON();
    const passage = body.messages.at(-1).content.split("\n\n").at(-1);
    attempts++;
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
  await expect(
    page.getByRole("textbox", { name: "Edited draft", exact: true }),
  ).toHaveValue(edited);
  expect(attempts).toBe(2);
  await expect(page.getByText(/^Local model .*1 retry$/)).toBeVisible();
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
  await expect(page.getByRole("status")).toContainText("7 sections checked");
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
  await expect(page.getByRole("heading", { name: "Too little text" })).toBeVisible();
});
