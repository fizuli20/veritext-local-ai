import { test, expect } from '@playwright/test';

test.describe('VeriText V3.0 Apex Edition E2E Suite', () => {
  test('1. Root page loads clean with zero console errors and v3.0.0 tag', async ({ page }) => {
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

    // Check header branding and v3.0.0 tag
    await expect(page.locator('header').getByText('Veritext', { exact: true })).toBeVisible();
    await expect(page.locator('text=v3.0.0').first()).toBeVisible();

    // Check Extension & API links exist in header
    await expect(page.locator('a[title*="Chrome Extension"]')).toBeVisible();
    await expect(page.locator('a[title*="Developer API"]')).toBeVisible();

    // Verify zero fatal console errors on load
    expect(consoleErrors).toHaveLength(0);
  });

  test('2. 3-Signal Forensic Detector: Evaluates passage, renders Heatmap, Score Gauge, and SVG Forensic Charts', async ({ page }) => {
    await page.goto('/');

    // Navigate to Detector tab
    const detectorTab = page.locator('button:has-text("3-Signal Forensic Detector")');
    await detectorTab.click();

    // Verify Score Gauge appears and AI score is visible
    const scoreElement = page.locator('text=Composite AI Probability');
    await expect(scoreElement).toBeVisible();

    // Check SVG Forensic Charts are rendered (Sparkline + Radar Matrix + GLTR Bar)
    const chartsContainer = page.locator('text=Sentence AI Risk Profile');
    await expect(chartsContainer).toBeVisible();
    await expect(page.locator('text=Forensic Radar Matrix')).toBeVisible();
    await expect(page.locator('text=GLTR Rank Proportions')).toBeVisible();

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

    // Input adversarial text with Cyrillic homoglyphs & zero-width chars
    const textarea = page.locator('textarea').first();
    await textarea.fill('Th\u0435 quick brown fox jumps ov\u0435r th\u0435 l\u0430zy dog with unif\u043ermity \u200B\u200C and repetitive cadence.');

    // Verify the adversarial alert banner appears
    const alertBanner = page.locator('text=Adversarial Obfuscation Detected & Normalized');
    await expect(alertBanner).toBeVisible({ timeout: 5000 });
  });

  test('4. Humanizer Studio: Executes de-AI with protected quotes and citations preserved verbatim, toggling diff view', async ({ page }) => {
    await page.goto('/');

    // Humanizer Studio is default or click tab
    const humanizerTab = page.locator('button:has-text("Humanizer Studio")');
    await humanizerTab.click();

    // Verify Protected Spans controls exist
    await expect(page.locator('text=Direct Quotes')).toBeVisible();
    await expect(page.locator('text=Citations')).toBeVisible();

    // Input text with a quote and academic citation
    const inputText = 'In modern education, researchers note that "adaptive learning significantly improves student mastery" according to recent empirical trials (Smith et al., 2024). Furthermore, it is essential to utilize digital assessments to gauge progress across diverse cohorts.';
    const textarea = page.locator('textarea').first();
    await textarea.fill(inputText);

    // Disable tournament mode if needed for fast single-pass test
    const singlePassBtn = page.locator('button:has-text("Single Pass (Fast)"), button:has-text("Best of 3")');
    if (await singlePassBtn.isVisible()) {
      const btnText = await singlePassBtn.textContent();
      if (btnText?.includes('Best of 3')) {
        await singlePassBtn.click();
      }
    }

    // Click Humanize button
    const humanizeBtn = page.locator('button:has-text("Humanize with Closed-Loop Verification"), button:has-text("Run Best-of-3")');
    await humanizeBtn.click();

    // Wait for Humanized Output
    await expect(page.locator('text=Humanized Output')).toBeVisible();
    await expect(page.locator('button:has-text("Diff View")')).toBeVisible({ timeout: 15000 });

    // Verify that direct quote and citation are preserved verbatim in output
    const mainContent = await page.locator('main').textContent();
    expect(mainContent).toContain('"adaptive learning significantly improves student mastery"');
    expect(mainContent).toContain('(Smith et al., 2024)');

    // Toggle Diff View
    await page.locator('button:has-text("Diff View")').click();
    await expect(page.locator('text=Diff View')).toBeVisible();
  });

  test('5. Batch Audit Queue: Loads multiple documents, scans queue, and enables CSV export', async ({ page }) => {
    await page.goto('/');

    // Switch to Batch Audit Queue tab
    await page.locator('button:has-text("Batch Audit Queue")').click();

    // Verify dropzone is visible
    await expect(page.locator('text=Click to select or drag and drop up to 25 files')).toBeVisible();

    // Click "+ Load 3 Sample Files"
    await page.locator('button:has-text("Load 3 Sample Files")').click();

    // Check that table rows appeared
    await expect(page.locator('text=Research-Abstract.md')).toBeVisible();
    await expect(page.locator('text=Student-Essay-Draft.txt')).toBeVisible();
    await expect(page.locator('text=AI-Generated-Summary.docx')).toBeVisible();

    // Click "Scan Queue"
    await page.locator('button:has-text("Scan Queue")').click();

    // Wait until scanning completes and scores appear
    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible();
  });

  test('6. Compare Drafts: Aligns Draft A vs Draft B, computes delta, and generates SHA-256 digest', async ({ page }) => {
    await page.goto('/');

    // Switch to Compare Drafts tab
    await page.locator('button:has-text("Compare Drafts")').click();

    // Click "+ Load Sample Comparison"
    await page.locator('button:has-text("Load Sample Comparison")').click();

    // Click "Compare Drafts" button
    await page.locator('button:has-text("Compare Drafts")').last().click();

    // Verify delta metrics and SHA-256 digest section appear
    await expect(page.locator('text=NET AI SCORE SHIFT')).toBeVisible();
    await expect(page.locator('text=Local Authorship Verification Digest')).toBeVisible();
    await expect(page.locator('text=SHA-256 Integrity Verification')).toBeVisible();
  });

  test('7. Developer API Playground: Navigates to /developers, displays OpenAPI documentation, and executes live test call', async ({ page }) => {
    await page.goto('/developers');

    // Verify header and endpoint title
    await expect(page.locator('text=Zero-Token Developer API Playground')).toBeVisible();
    await expect(page.locator('text=POST /api/detect')).toBeVisible();

    // Verify OpenAPI link
    await expect(page.locator('a:has-text("OpenAPI 3.1 Spec (JSON)")')).toBeVisible();

    // Click "Send Live API Request"
    const runBtn = page.locator('button:has-text("Send Live API Request")');
    await runBtn.click();

    // Verify live response JSON with aiScore appears
    const responseBox = page.locator('[data-testid="response-json"]');
    await expect(responseBox).toBeVisible({ timeout: 5000 });
    await expect(responseBox).toContainText('aiScore');
  });

  test('8. Stateless API & Extension: GET /api/openapi.json and GET /downloads/veritext-chrome-extension.zip return 200', async ({ page }) => {
    // Check OpenAPI spec endpoint
    const resOpenApi = await page.request.get('/api/openapi.json');
    expect(resOpenApi.status()).toBe(200);
    const openapiJson = await resOpenApi.json();
    expect(openapiJson.openapi).toBe('3.1.0');
    expect(openapiJson.info.title).toContain('Veritext Local AI API');

    // Check Chrome Extension download zip endpoint
    const resZip = await page.request.get('/downloads/veritext-chrome-extension.zip');
    expect(resZip.status()).toBe(200);
    const contentLength = Number(resZip.headers()['content-length'] || 0);
    expect(contentLength).toBeGreaterThan(1000);
  });

  test('9. Mobile viewport (375x812) has zero horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Check horizontal scroll width
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(isOverflowing).toBe(false);
  });
});
