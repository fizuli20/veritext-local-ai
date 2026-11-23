import type { Page } from "@playwright/test";

export async function openEditorSection(page: Page, heading: string) {
  const summary = page.locator("summary").filter({ hasText: heading });
  if (
    !(await summary.evaluate((node) =>
      node.parentElement?.hasAttribute("open"),
    ))
  ) {
    await summary.click();
  }
}

export async function connectLocal(page: Page, provider?: "Ollama") {
  await page
    .getByRole("button", { name: "Model settings", exact: true })
    .click();
  if (provider)
    await page.getByRole("button", { name: provider, exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: "Return to editor" }).click();
}
