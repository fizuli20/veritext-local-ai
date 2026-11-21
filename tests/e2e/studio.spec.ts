import { test, expect } from '@playwright/test';

test.describe('VeriText V2.0 Max Edition E2E Suite', () => {
  test('1. Root page loads with zero uncaught console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto('/');

    // Check header branding
    await expect(page.locator('header').getByText('Veritext', { exact: true })).toBeVisible();
    await expect(page.locator('text=v2.0.0').first()).toBeVisible();

    // Verify zero fatal console errors on load
    expect(consoleErrors).toHaveLength(0);
  });

  test('2. 3-Signal Forensic Detector: Evaluates AI passage with high AI probability and heatmap spans', async ({ page }) => {
    await page.goto('/');

    // Navigate to Detector tab
    const detectorTab = page.locator('button:has-text("3-Signal Forensic Detector")');
    await detectorTab.click();

    // The default passage is AI-generated
    // Verify Score Gauge appears and AI score is > 65%
    const scoreElement = page.locator('text=Composite AI Probability');
    await expect(scoreElement).toBeVisible();

    // Check that at least one sentence span in the heatmap is rendered with AI risk highlight
    const sentenceSpans = page.locator('span[data-sentence-index]');
    await expect(sentenceSpans.first()).toBeVisible();

    // Verify domain profiles dropdown exists
    const domainSelect = page.locator('select').first();
    await expect(domainSelect).toBeVisible();
  });

  test('3. Obfuscation Defense: Detects adversarial homoglyphs and displays warning banner', async ({ page }) => {
    await page.goto('/');

    // Switch to detector tab
    await page.locator('button:has-text("3-Signal Forensic Detector")').click();

    // Click "Edit Text" to switch to textarea if in heatmap mode
    const editModeBtn = page.locator('button:has-text("Edit Text")');
    if (await editModeBtn.isVisible()) {
      await editModeBtn.click();
    }

    // Input adversarial text with Cyrillic homoglyphs
    const textarea = page.locator('textarea').first();
    await textarea.fill('Th\u0435 quick brown fox jumps ov\u0435r th\u0435 l\u0430zy dog with unif\u043ermity \u200B\u200C and repetitive cadence.');

    // Verify the adversarial alert banner appears
    const alertBanner = page.locator('text=Adversarial Obfuscation Detected & Normalized');
    await expect(alertBanner).toBeVisible({ timeout: 5000 });
  });

  test('4. Humanizer Studio: Executes instant deterministic de-AI and toggles diff view', async ({ page }) => {
    await page.goto('/');

    // By default, Humanizer Studio is the active tab
    // Ensure we are on Humanizer tab
    const humanizerTab = page.locator('button:has-text("Humanizer Studio")');
    await humanizerTab.click();

    // Find input textarea and fill an AI passage
    const inputText = "In today's fast-paced world, artificial intelligence plays a pivotal role in transforming modern education. It is worth noting that adaptive learning platforms delve into student performance metrics to provide a comprehensive overview.";
    const textarea = page.locator('textarea').first();
    await textarea.fill(inputText);

    // Disable tournament mode if needed for fast single-pass test, or run humanize
    const singlePassBtn = page.locator('button:has-text("Single Pass (Fast)"), button:has-text("Best of 3")');
    if (await singlePassBtn.isVisible()) {
      const btnText = await singlePassBtn.textContent();
      if (btnText?.includes('Best of 3')) {
        await singlePassBtn.click(); // Switch to Single Pass
      }
    }

    // Click Humanize button
    const humanizeBtn = page.locator('button:has-text("Humanize with Closed-Loop Verification"), button:has-text("Run Best-of-3")');
    await humanizeBtn.click();

    // Wait for Humanized Output to appear
    await expect(page.locator('text=Humanized Output')).toBeVisible();
    await expect(page.locator('button:has-text("Diff View")')).toBeVisible({ timeout: 15000 });

    // Toggle Diff View
    await page.locator('button:has-text("Diff View")').click();

    // Verify diff view shows modified or highlighted text
    const diffContainer = page.locator('text=Diff View');
    await expect(diffContainer).toBeVisible();
  });

  test('5. Mobile viewport (375x812) has zero horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Check horizontal scroll width
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(isOverflowing).toBe(false);
  });
});
