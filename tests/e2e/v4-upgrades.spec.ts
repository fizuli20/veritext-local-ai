import { test, expect } from "@playwright/test";
test("legacy API identifies its limitations and rejects invalid JSON", async ({
  request,
}) => {
  const res = await request.post("/api/detect", {
    data: {
      text: "A simple library gives the community a space to share books and discuss the stories they read.",
    },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.isAi).toBeNull();
  expect(json.calibratedProbability).toBeNull();
  expect(json.confidence).toBe("low");
  expect(json.scoreMeaning).toContain("Uncalibrated");
  const invalid = await request.post("/api/detect", {
    data: "{broken",
    headers: { "Content-Type": "application/json" },
  });
  expect(invalid.status()).toBe(400);
  const invalidBatch = await request.post("/api/batch-detect", {
    data: "{broken",
    headers: { "Content-Type": "application/json" },
  });
  expect(invalidBatch.status()).toBe(400);
});
test("validation page distinguishes the held-out sample from product accuracy", async ({
  page,
}) => {
  await page.goto("/benchmarks");
  await expect(
    page.getByRole("heading", { name: "Validation & limits", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0.023", { exact: true })).toBeVisible();
  await expect(page.getByText(/Training overlap is unknown/)).toBeVisible();
});
