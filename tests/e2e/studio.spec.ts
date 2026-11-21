import { test, expect } from "@playwright/test";
const source =
  'In 2024, Ana said "wait". The trial did not succeed. We need to review the results before making a decision.';
const edited =
  'Ana said "wait" in 2024. The trial did not succeed. We should review the results before making a decision.';

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
    return route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: "<thought>Hidden reasoning</thought>" + edited } }] })}\n\ndata: [DONE]`,
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
    page.getByText("Local model · gemma-integration-fixture", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("rewrite-review")).toContainText(
    "No changes to tracked",
  );
  await page.getByRole("button", { name: "Show changes", exact: true }).click();
  await expect(page.locator("ins").first()).toBeVisible();
  expect(completions).toBe(2);
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
