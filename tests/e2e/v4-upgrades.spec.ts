import { test, expect } from '@playwright/test';

test.describe('VeriText V4.0 Titan Upgrades E2E Suite', () => {
  test('Scenario 10: Worker Diagnostics runs PING/PONG across workers and displays telemetry', async ({ page }) => {
    await page.goto('/');

    // Open Models Manager modal
    const modelsBtn = page.locator('button:has-text("Models")');
    await modelsBtn.click();

    // Check Worker Truth Audit card is present
    await expect(page.locator('text=Worker Truth Audit & Hardware Diagnostics')).toBeVisible();

    // Trigger Real Diagnostics
    const runDiagBtn = page.locator('button:has-text("Run Real Worker Diagnostics")');
    await expect(runDiagBtn).toBeVisible();
    await runDiagBtn.click();

    // Check that Worker Status table renders
    await expect(page.locator('text=Web Worker Subsystem')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=RoBERTa Detector Worker')).toBeVisible();
    await expect(page.locator('text=GPT-2 Curvature & PPL Worker')).toBeVisible();
  });

  test('Scenario 11: Connect to Mock LM Studio, stream completions, strip thought tags, and display provenance badge', async ({ page }) => {
    // Intercept any request to port 1234
    await page.route((url) => url.port === '1234', async (route) => {
      const urlStr = route.request().url();
      if (urlStr.includes('/models')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            data: [
              { id: 'google/gemma-4-12b', object: 'model' },
            ],
          }),
        });
      } else if (urlStr.includes('/chat/completions')) {
        const sseStream = [
          'data: {"choices":[{"delta":{"content":"<think>Deliberating tone and cadence.</think>Here is the humanized text: Authentic human prose with natural flow."}}]}\n\n',
          'data: [DONE]\n\n',
        ].join('');

        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: sseStream,
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // Select Local Server Engine button
    const localEngineBtn = page.locator('button:has-text("LM Studio / Ollama")');
    await localEngineBtn.click();

    // Click "Connect & Detect" button in Local Server Card
    const connectBtn = page.locator('button:has-text("Connect & Detect")').first();
    await connectBtn.click();

    // Verify model option appears
    await expect(page.locator('text=Connected (1 model)').first()).toBeVisible({ timeout: 5000 });

    // Click Humanize Text
    const humanizeBtn = page.locator('button:has-text("Humanize with Closed-Loop Verification")');
    await humanizeBtn.click();

    // Verify thought tags stripped from output
    const outputArea = page.locator('[data-testid="humanized-output-textarea"]');
    await expect(outputArea).toBeVisible({ timeout: 10000 });
    await expect(outputArea).not.toHaveValue(/<think>/);
    await expect(outputArea).toHaveValue(/Authentic human prose with natural flow/);

    // Verify Honest Execution Provenance Badge
    await expect(page.locator('[data-testid="provenance-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="provenance-badge"]')).toContainText('LM Studio · google/gemma-4-12b');
  });

  test('Scenario 12: Trigger CORS error on local server connector and display CORS Doctor guidance', async ({ page }) => {
    // Abort connection to simulate blocked / non-running server on port 1234
    await page.route((url) => url.port === '1234', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');

    // Select Local Server Engine button
    const localEngineBtn = page.locator('button:has-text("LM Studio / Ollama")');
    await localEngineBtn.click();

    // Click Connect & Detect
    const connectBtn = page.locator('button:has-text("Connect & Detect")').first();
    await connectBtn.click();

    // Verify CORS Doctor diagnosis appears
    await expect(page.locator('text=CORS Doctor:').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=lms server start --cors').first()).toBeVisible();
  });

  test('Scenario 13: Transparency Dashboard (/benchmarks) renders SVG ROC curve, AUC badge, and domain table', async ({ page }) => {
    await page.goto('/benchmarks');

    // Verify header and page title
    await expect(page.locator('text=Real-World Detector Calibration & ROC Forensics')).toBeVisible();

    // Verify ROC-AUC KPI card and badge
    await expect(page.locator('text=Receiver Operating Characteristic (ROC)')).toBeVisible();
    await expect(page.locator('text=0.975').first()).toBeVisible();

    // Verify Calibration Reliability Diagram
    await expect(page.locator('text=Calibration Reliability Diagram')).toBeVisible();

    // Verify Domain-Specific False Positive Breakdown Table
    await expect(page.locator('text=Domain-Specific False Positive Breakdown')).toBeVisible();
    await expect(page.locator('text=Wikipedia / Encyclopedic Style')).toBeVisible();
    await expect(page.locator('text=ArXiv / Peer-Reviewed Clinical & Academic')).toBeVisible();
    await expect(page.locator('text=Modern Stealth AI (Zero-Cliché Rewrites)')).toBeVisible();

    // Verify link to Proof Verifier
    await expect(page.locator('a[href="/verify"]').first()).toBeVisible();
  });

  test('Scenario 14: Proof-of-Human Studio records cadence, signs proof, and Offline Verifier flags tampered document', async ({ page }) => {
    await page.goto('/');

    // Navigate to Proof-of-Human Studio tab
    const proofTab = page.locator('button:has-text("Proof-of-Human Studio")');
    await proofTab.click();

    // Verify editor is visible
    const editor = page.locator('textarea[placeholder*="Start drafting here"]');
    await expect(editor).toBeVisible();

    // Type human text to generate keystrokes
    await editor.fill('This is a genuine research composition demonstrating natural human typing rhythm.');
    await editor.press('KeyA');
    await editor.press('KeyB');

    // Click Sign & Generate Proof Certificate
    const signBtn = page.locator('button:has-text("Sign & Generate Proof Certificate")');
    await signBtn.click();

    // Verify certificate generation confirmation
    await expect(page.locator('text=Cryptographic Proof Successfully Signed')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Document Hash (SHA-256):')).toBeVisible();

    // Now navigate to Offline Verifier at /verify
    await page.goto('/verify');
    await expect(page.locator('text=Independent Authorship Proof Verifier')).toBeVisible();

    // Test Case A: Load valid certified document
    const loadValidBtn = page.locator('button:has-text("Load Valid Certified Document")');
    await loadValidBtn.click();

    const verifyBtn = page.locator('button:has-text("Verify Document Authenticity")');
    await verifyBtn.click();

    await expect(page.locator('text=Document Authenticity Confirmed')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Authorship Trust Score')).toBeVisible();

    // Test Case B: Load 1-character tampered document
    const loadTamperedBtn = page.locator('button:has-text("Load 1-Character Tampered Document")');
    await loadTamperedBtn.click();
    await verifyBtn.click();

    // Verify bold red TAMPER DETECTED alert
    await expect(page.locator('text=TAMPER DETECTED')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=INTEGRITY MISMATCH')).toBeVisible();
  });
});
